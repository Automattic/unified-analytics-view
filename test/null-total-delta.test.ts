// A total may be null, where the engine has no figure for the range. Compared with the period before, the number read
// "–" and the change "▼ 100% on the previous period": `delta` took the missing figure for zero. With no current figure
// there is nothing to compare, so no change is claimed: no delta node, no clause in the prose, a dash in a table's cell.
import { describe, expect, it } from 'vitest';
import { type Catalog, type Result, type Spec } from '@unified-analytics/core';
import { ofUnbounded } from './helpers.ts';

const catalog: Catalog = { metrics: { revenue: { label: 'Revenue', unit: 'usd', polarity: 'up' } }, dimensions: { sku: { label: 'SKU', type: 'categorical' } } };
const result = (total: number | null, rows: Result['rows'] = [{ revenue: total }]): Result =>
  ({ rows, totals: { revenue: total, 'revenue@previous': 200 }, meta: { range: '28d', compare: 'previous', notes: [], empty: false } });
const view = (spec: Spec, res: Result) => { const { plan, scene } = ofUnbounded(spec, res, spec.query, catalog); return { text: plan.text, nodes: scene.nodes }; };
const number: Spec = { spec: 'view/0', query: { metrics: ['revenue'], compare: 'previous' } };
const table: Spec = { spec: 'view/0', layers: [{ mark: 'text', encode: { y: 'sku', text: 'sku' } }, { mark: 'text', encode: { y: 'sku', text: 'revenue' }, series: 'delta' }], query: { metrics: ['revenue'], by: ['sku'], compare: 'previous' } };

describe('a null total, compared with the period before', () => {
  it('claims no change: a dash for the number, no delta beside it, no clause in the prose', () => {
    const v = view(number, result(null));
    expect(v.nodes.filter((n) => n.kind === 'text').map((n) => [n.key, n.text])).toEqual([['value', '–']]);
    expect(v.text).toBe('Revenue: – in the last 28 days.');
  });
  it('nor with no prior figure either: nothing is said of a comparison at all', () => {
    expect(view(number, { ...result(null), totals: { revenue: null } }).text).toBe('Revenue: – in the last 28 days.');
  });
  it('a row with no figure has a dash in a column of changes', () => {
    const v = view(table, result(300, [{ sku: 'A', revenue: null, 'revenue@previous': 200 }, { sku: 'B', revenue: 100, 'revenue@previous': 200 }]));
    expect(v.nodes.flatMap((n) => (n.kind === 'text' && /▼|–/.test(n.text) ? [n.text] : []))).toEqual(['–', '▼ 50%']);
  });
  it('a figure is still compared', () => {
    const v = view(number, result(100));
    expect(v.nodes.find((n) => n.key === 'delta')).toMatchObject({ text: '▼ 50% on the previous period', short: '▼ 50%', paint: 'delta.bad' });
    expect(v.text).toBe('Revenue: $100 in the last 28 days, down 50% on the previous period.');
    expect(view(number, { ...result(100), totals: { revenue: 100 } }).text).toBe('Revenue: $100 in the last 28 days, with no prior period to compare.');
  });
});
