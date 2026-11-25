import { describe, expect, it } from 'vitest';
import { resolve, type Catalog, type Result, type Spec } from '@unified-analytics/core';
import { errOf } from './helpers.ts';

// A name the catalog does not carry is refused by resolve(), by name, with what the catalog has and what to do.
const catalog: Catalog = {
  metrics: { revenue: { label: 'Revenue', unit: 'usd', polarity: 'up' }, orders: { label: 'Orders', unit: 'count', polarity: 'up' } },
  dimensions: { day: { label: 'Day', type: 'time' }, sku: { label: 'SKU', type: 'categorical' } },
};
const result: Result = { rows: [{ sku: 'A', revenue: 2 }], totals: { revenue: 2 }, meta: { range: '28d', compare: null, notes: [] } };
const refused = (spec: Spec, cat = catalog) => errOf(() => resolve(spec, result, cat)) ?? 'no error';

describe('a name the catalog does not carry', () => {
  const metric = 'The catalog has no metric "revenu". It has: revenue, orders. Add it to the catalog passed in, or correct the name in query.metrics.';
  const dimension = 'The catalog has no dimension "skew". It has: day, sku. Add it to the catalog passed in, or correct the name in query.by.';
  it('a metric, the number alone', () => expect(refused({ spec: 'view/0', query: { metrics: ['revenu'] } })).toBe(metric));
  it('a metric, with marks', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenu'], by: ['sku'] } })).toBe(metric));
  it('a second metric', () => expect(refused({ spec: 'view/0', query: { metrics: ['revenue', 'revenu'] } })).toBe(metric));
  it('a dimension', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['skew'] } })).toBe(dimension));
  it('a second dimension', () => expect(refused({ spec: 'view/0', layers: [{ mark: 'line', encode: { x: 'day', y: 'revenue', color: 'skew' } }], query: { metrics: ['revenue'], by: ['day', 'skew'] } })).toBe(dimension));
  it('a name every object has is not a metric', () => expect(refused({ spec: 'view/0', query: { metrics: ['toString'] } })).toMatch(/^The catalog has no metric "toString"\./));
  it('an empty catalog says so', () => expect(refused({ spec: 'view/0', query: { metrics: ['revenue'] } }, { metrics: {}, dimensions: {} })).toMatch(/It has: none\./));
});

// A field that nothing reads was read past, and the view drawn without what its author wrote. It is refused by name,
// with the fields there are. A filter under another name is the one that matters most: the answer would be of everything.
describe('a field a spec, its query or a layer does not take', () => {
  const q = { metrics: ['revenue'], by: ['sku'] };
  it('a size in a spec', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: q, width: 346 } as Spec))
    .toBe('The spec has "width", which it does not take. It takes: spec, title, description, use, query, layers, facet, readout. A view says what to show and nothing of how: no size, breakpoint or switch.'));
  it('a filter under another name', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: { ...q, filter: { sku: 'A' } } } as unknown as Spec))
    .toBe('The spec\'s query has "filter", which it does not take. It takes: metrics, by, range, compare, limit, where. A filter is "where".'));
  it('a colour on a layer', () => expect(refused({ spec: 'view/0', query: q, layers: [{ mark: 'bar', encode: { y: 'sku', x: 'revenue' } }, { mark: 'text', encode: { y: 'sku', text: 'sku' }, color: 'red' }] } as unknown as Spec))
    .toBe('Layer 2 has "color", which it does not take. It takes: mark, encode, series, role, stack, sweep, label, at, align, paint. What a mark draws is on its channels, in "encode".'));
  // `keep` was the one lever a spec had over what a container gives up. It went on November 24: a spec has none.
  it('keep, which a spec once took', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: q, keep: ['guides'] } as unknown as Spec)).toMatch(/^The spec has "keep", which it does not take\. It takes: spec, title, description, use, query, layers, facet, readout\./));
  it('a field that is written and holds nothing is no field', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: q, width: undefined } as Spec)).toBe('no error'));
});

// A catalog may say which dimensions the engine answers a metric by (`by` on the metric). A query that asks it by
// another is refused before it is run or drawn, in `by` and in `where` alike: its engine has no answer for it.
describe('a metric asked by a dimension its catalog does not give it by', () => {
  const some: Catalog = { metrics: { revenue: { ...catalog.metrics.revenue!, by: ['day', 'sku'] }, orders: { ...catalog.metrics.orders!, by: [] } }, dimensions: { ...catalog.dimensions, channel: { label: 'Channel', type: 'categorical' } } };
  it('in by', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['channel'] } }, some))
    .toBe('The metric "revenue" is not answered by "channel": the catalog gives it by day or sku. Ask it by one of those, or take "channel" out of query.by.'));
  it('in where', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['sku'], where: { channel: 'Search' } } }, some))
    .toBe('The metric "revenue" is not answered by "channel": the catalog gives it by day or sku. Ask it by one of those, or take "channel" out of query.where.'));
  it('a second metric, by none', () => expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue', 'orders'], by: ['sku'] } }, some))
    .toBe('The metric "orders" is not answered by "sku": the catalog gives it by no dimension. Take "sku" out of query.by.'));
  it('by one it gives, and a metric that says nothing is asked by any', () => {
    expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['sku'] } }, some)).toBe('no error');
    expect(refused({ spec: 'view/0', use: 'bar-list', query: { metrics: ['revenue'], by: ['sku'] } })).toBe('no error');
  });
});

// What a view is for, in its author's words (`description`). It is a field a spec takes, it changes nothing that is
// drawn or said of the data, and a facet says it once, of its views together.
describe('a description on a spec', () => {
  const q = { metrics: ['revenue'], by: ['sku'] }, about = 'How each product sold.';
  it('is taken, and the plan and its sentence are what they were without it', () => {
    const spec: Spec = { spec: 'view/0', use: 'bar-list', query: q };
    expect(refused({ ...spec, description: about })).toBe('no error');
    expect(resolve({ ...spec, description: about }, result, catalog)).toEqual(resolve(spec, result, catalog));
  });
});

