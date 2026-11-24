import { describe, expect, it } from 'vitest';
import { rangeLabel, type Catalog, type Result, type Row, type Spec } from '@unified-analytics/core';
import { inProgressNote, most, notShownNote, tldrProse } from '../packages/core/src/prose.ts';
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
  ['a ranking', { spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['sku'] } }, result(skus), 'Revenue: $300. The top sku is A.'],
  ['a numeric dimension', { spec: 'view/0', layers: [{ mark: 'line', encode: { x: 'size', y: 'revenue' } }], query: { metrics: ['revenue'], by: ['size'] } }, result([{ size: 1, revenue: 200 }, { size: 2, revenue: 100 }]), 'Revenue: $300.'],
  ['two metrics as points', { spec: 'view/0', layers: [{ mark: 'dot', encode: { x: 'revenue', y: 'orders' } }], query: { metrics: ['revenue', 'orders'], by: ['sku'] } }, result(skus), 'Revenue: $300. Orders: 30. The top sku is A.'],
  ['a split over time', { spec: 'view/0', layers: [{ mark: 'line', encode: { x: 'day', y: 'revenue', color: 'sku' } }], query: { metrics: ['revenue'], by: ['day', 'sku'] } }, result([{ day: '2026-10-01', sku: 'A', revenue: 200 }, { day: '2026-10-01', sku: 'B', revenue: 100 }], { totalsBy }), 'Revenue: $300.'],
  ['a grid', { spec: 'view/0', layers: [{ mark: 'cell', encode: { x: 'hour', y: 'sku', color: 'revenue' } }], query: { metrics: ['revenue'], by: ['hour', 'sku'] } }, result(pairs, { totalsBy }), 'Revenue: $300. The top hour is 9.'],
];

describe('a view with no range names none', () => {
  for (const [name, spec, res, prose] of cases) it(name, () => {
    const all = said(spec, res);
    expect(all).not.toMatch(/undefined|null/);
    expect(all.split(' | ')[0]).toBe(prose);
  });
  it('and still names the one it has', () => {
    expect(said(cases[0]![1], result([], {}, '7d'))).toMatch(/^Revenue: nothing recorded in the last 7 days\./);
    expect(said(cases[3]![1], result(skus, {}, '7d'))).toMatch(/^Revenue: \$300 in the last 7 days\. The top sku is A\./);
  });
  it('one day is said as one, and an instant as now', () => {
    expect(said(cases[2]![1], result([{ revenue: 300 }], {}, '1d'))).toMatch(/^Revenue: \$300 in the last day\./);
    expect(rangeLabel('now')).toBe('right now');
  });
  // Presets and custom ranges are Open in the reference. Until they are settled, a form the prose cannot read is refused
  // rather than said as written: "Revenue: $300 in the 2026-09".
  it.each(['2026-09', '24h', 'today', '0d', '2026-09-01/2026-09-30'])('a range of "%s" is refused by name, with the forms a view reads', (range) => {
    expect(() => said(cases[2]![1], result([{ revenue: 300 }], {}, range))).toThrow('The result has meta.range: "' + range + '", and a view reads a range as a count of days, "28d", or as "now". Send one of those from the query layer, or leave meta.range out and the prose names no range.');
  });
});

// A label is made plural by one rule wherever a view counts it, so a label ending in a consonant and "y" reads "-ies".
describe('a count is pluralised as plural() does it', () => {
  it('in what a view says of the rows it has no place for', () => {
    expect([notShownNote(2, 'Country'), notShownNote(1, 'Country'), notShownNote(3, 'Page'), notShownNote(0, 'Page')]).toEqual(['2 countries not shown', '1 country not shown', '3 pages not shown', '']);
  });
});

// A row may have no figure, and a value may hold the very words the sentence is made of.
describe('the prose of rows with no figure, and of values with words of its own', () => {
  it('finds the most among the rows that have a figure', () => {
    expect(most([{ k: 'a' }, { k: 'b', v: -3 }, { k: 'c', v: null }, { k: 'd', v: -1 }], 'v')).toEqual({ k: 'd', v: -1 });
    expect(most([{ k: 'a', v: null }], 'v')).toEqual({ k: 'a', v: null });
    expect(most([], 'v')).toBeUndefined();
  });
  it('names a leader whole when it has words of its own in it', () => {
    const res = result([{ sku: 'About the team', revenue: 200 }]);
    expect(tldrProse({ metrics: ['revenue'], by: ['sku'] }, res, false, catalog)).toBe('Revenue: $300. The top sku is About the team.');
  });
});

describe('the note an unfinished bucket carries', () => {
  it('names the bucket', () => {
    expect(inProgressNote('day')).toBe('Today is still in progress.');
    expect(inProgressNote('hour')).toBe('This hour is still in progress.');
  });
});
