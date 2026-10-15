import { describe, expect, it } from 'vitest';
import { resolve, unboundedContainer, type Catalog, type Result, type Spec } from '@unified-analytics/core';
import { errOf } from './helpers.ts';

// A name the catalog does not carry is refused by resolve(), by name, with what the catalog has and what to do.
const catalog: Catalog = {
  metrics: { revenue: { label: 'Revenue', unit: 'usd', polarity: 'up' }, orders: { label: 'Orders', unit: 'count', polarity: 'up' } },
  dimensions: { day: { label: 'Day', type: 'time' }, sku: { label: 'SKU', type: 'categorical' } },
};
const result: Result = { rows: [{ sku: 'A', revenue: 2 }], totals: { revenue: 2 }, meta: { range: '28d', compare: null, notes: [] } };
const refused = (spec: Spec, cat = catalog) => errOf(() => resolve(spec, result, unboundedContainer(), cat)) ?? 'no error';

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
