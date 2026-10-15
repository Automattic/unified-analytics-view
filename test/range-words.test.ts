import { describe, expect, it } from 'vitest';
import { rangeLabel, type Catalog, type Result, type Row, type Spec } from '@unified-analytics/core';
import { inProgressNote, most, rangeProse, tldrProse } from '../packages/core/src/prose.ts';
import { ofUnbounded } from './helpers.ts';

// query.range is optional in the schema, so an answer may name no range. A view then says nothing of one: no word is made up.
const catalog: Catalog = {
  metrics: { revenue: { label: 'Revenue', unit: 'usd', polarity: 'up' }, orders: { label: 'Orders', unit: 'count', polarity: 'up' } },
  dimensions: { day: { label: 'Day', type: 'time' }, sku: { label: 'SKU', type: 'categorical' }, size: { label: 'Size', type: 'number' }, hour: { label: 'Hour', type: 'categorical' } },
};
const result = (rows: Row[], more: Partial<Result> = {}, range?: string): Result =>
  ({ rows, totals: { revenue: 300, orders: 30 }, meta: { ...(range && { range }), compare: null, notes: [], empty: !rows.length } as Result['meta'], ...more });
const said = (spec: Spec, res: Result) => {
  const { plan, scene } = ofUnbounded(spec, res, spec.query, catalog);
  return [plan.text, ...scene.nodes.flatMap((n) => (n.kind === 'text' ? [n.text] : [])), ...res.meta.notes].join(' | ');
};
const skus = [{ sku: 'A', revenue: 200, orders: 10 }, { sku: 'B', revenue: 100, orders: 20 }];
const pairs = [{ sku: 'A', hour: '9', revenue: 200 }, { sku: 'B', hour: '10', revenue: 100 }];
const totalsBy = { sku: [{ sku: 'A', revenue: 200 }, { sku: 'B', revenue: 100 }], hour: [{ hour: '9', revenue: 200 }, { hour: '10', revenue: 100 }], day: [] };

// [what it is, the spec, the result, the prose with no range]
const cases: [string, Spec, Result, string][] = [
  ['an empty answer', { spec: 'view/0', query: { metrics: ['revenue'] } }, result([]), 'Revenue: nothing recorded.'],
  ['an empty answer, with marks', { spec: 'view/0', use: 'line', query: { metrics: ['revenue'], by: ['day'] } }, result([]), 'Revenue: nothing recorded.'],
  ['a total', { spec: 'view/0', query: { metrics: ['revenue'] } }, result([{ revenue: 300 }]), 'Revenue: $300.'],
  ['a ranking', { spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['sku'] } }, result(skus), 'Top skus by revenue: A ($200), B ($100).'],
  ['a numeric dimension', { spec: 'view/0', layers: [{ mark: 'line', encode: { x: 'size', y: 'revenue' } }], query: { metrics: ['revenue'], by: ['size'] } }, result([{ size: 1, revenue: 200 }, { size: 2, revenue: 100 }]), 'Revenue: $300. The most, $200, at a size of 1.'],
  ['two metrics as points', { spec: 'view/0', layers: [{ mark: 'dot', encode: { x: 'revenue', y: 'orders' } }], query: { metrics: ['revenue', 'orders'], by: ['sku'] } }, result(skus), 'Across 2 skus, the range of revenue is $100 to $200 and of orders is 10 to 20. A is highest on revenue and B on orders.'],
  ['a split over time', { spec: 'view/0', layers: [{ mark: 'line', encode: { x: 'day', y: 'revenue', color: 'sku' } }], query: { metrics: ['revenue'], by: ['day', 'sku'] } }, result([{ day: '2026-10-01', sku: 'A', revenue: 200 }, { day: '2026-10-01', sku: 'B', revenue: 100 }], { totalsBy }), 'A is the largest sku at 67% of revenue, and leads on all 1 day.'],
  ['a grid', { spec: 'view/0', layers: [{ mark: 'cell', encode: { x: 'hour', y: 'sku', color: 'revenue' } }], query: { metrics: ['revenue'], by: ['hour', 'sku'] } }, result(pairs, { totalsBy }), 'Most revenue at 9, A ($200). 9 is the busiest hour at 67% of revenue, and A the busiest sku at 67%.'],
];

describe('a view with no range names none', () => {
  for (const [name, spec, res, prose] of cases) it(name, () => {
    const all = said(spec, res);
    expect(all).not.toMatch(/undefined|null/);
    expect(all.split(' | ')[0]).toBe(prose);
  });
  it('and still names the one it has', () => {
    expect(said(cases[0]![1], result([], {}, '7d'))).toMatch(/^Revenue: nothing recorded in the last 7 days\./);
    expect(said(cases[3]![1], result(skus, {}, '7d'))).toMatch(/^Top skus by revenue, last 7 days: /);
  });
  it('one day is said as one, and an instant as now', () => {
    expect(said(cases[2]![1], result([{ revenue: 300 }], {}, '1d'))).toMatch(/^Revenue: \$300 in the last day\./);
    expect(said(cases[3]![1], result(skus, {}, '1d'))).toMatch(/^Top skus by revenue, last day: /);
    expect(rangeLabel('now')).toBe('right now');
  });
  // Presets and custom ranges are Open in the reference. Until they are settled, a form the prose cannot read is refused
  // rather than said as written: "Revenue: $300 in the 2026-09".
  it.each(['2026-09', '24h', 'today', '0d', '2026-09-01/2026-09-30'])('a range of "%s" is refused by name, with the forms a view reads', (range) => {
    expect(() => said(cases[2]![1], result([{ revenue: 300 }], {}, range))).toThrow('The result has meta.range: "' + range + '", and a view reads a range as a count of days, "28d", or as "now". Send one of those from the query layer, or leave meta.range out and the prose names no range.');
  });
});

// A label is made plural by one rule wherever the prose counts it, so a label ending in a consonant and "y" reads "-ies".
describe('a count in the prose is pluralised as plural() does it', () => {
  const ys: Catalog = { metrics: { revenue: { label: 'Revenue', unit: 'usd', polarity: 'up' } }, dimensions: { delivery: { label: 'Delivery', type: 'time' }, country: { label: 'Country', type: 'categorical' } } };
  it('in the range a view of ranges says', () => {
    const res = result([{ country: 'DE', 'revenue@p25': 10, 'revenue@p75': 20 }, { country: 'FR', 'revenue@p25': 5, 'revenue@p75': 30 }]);
    expect(rangeProse({ metrics: ['revenue'], by: ['country'] }, res, ys, ['revenue@p25', 'revenue@p75'])).toBe(' Between $5 and $30 across 2 countries.');
  });
  it('in the days a split leads on', () => {
    const res = result([{ delivery: '1', country: 'DE', revenue: 200 }, { delivery: '1', country: 'FR', revenue: 100 }], { totalsBy: { country: [{ country: 'DE', revenue: 200 }, { country: 'FR', revenue: 100 }] } });
    expect(tldrProse({ metrics: ['revenue'], by: ['delivery', 'country'] }, res, false, ys)).toBe('DE is the largest country at 67% of revenue, and leads on all 1 delivery.');
  });
});

// A row may have no figure, and a value may hold the very words the sentence is made of.
describe('the prose of rows with no figure, and of values with words of its own', () => {
  it('finds the most among the rows that have a figure', () => {
    expect(most([{ k: 'a' }, { k: 'b', v: -3 }, { k: 'c', v: null }, { k: 'd', v: -1 }], 'v')).toEqual({ k: 'd', v: -1 });
    expect(most([{ k: 'a', v: null }], 'v')).toEqual({ k: 'a', v: null });
    expect(most([], 'v')).toBeUndefined();
  });
  it('says how far points run, and which is highest, of the points that have a figure', () => {
    const res = result([{ sku: 'A', revenue: null, orders: -3 }, { sku: 'B', revenue: 100, orders: -1 }, { sku: 'C', revenue: 200, orders: null }]);
    expect(tldrProse({ metrics: ['revenue', 'orders'], by: ['sku'] }, res, false, catalog, true)).toBe('Across 3 skus, the range of revenue is $100 to $200 and of orders is -3 to -1. C is highest on revenue and B on orders.');
  });
  it('leads with the value whole when it has "the" in it', () => {
    const res = result([{ sku: 'About the team', hour: '9', revenue: 200 }], { totalsBy: { sku: [{ sku: 'About the team', revenue: 200 }], hour: [{ hour: '9', revenue: 200 }] } });
    expect(tldrProse({ metrics: ['revenue'], by: ['sku', 'hour'] }, res, false, catalog)).toBe('About the team is the largest sku at 67% of revenue, and 9 the largest hour at 67%.');
  });
});

describe('the note an unfinished bucket carries', () => {
  it('names the bucket', () => {
    expect(inProgressNote('day')).toBe('Today is still in progress.');
    expect(inProgressNote('hour')).toBe('This hour is still in progress.');
  });
});
