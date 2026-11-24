// A total may be null, where the engine has no figure for the range, and a share is of the engine's total. `t[m] || 1`
// used to divide by one, and said a share of 431800%. With no total, or one of zero, no
// percentage is said and no segment has a length: the value is said in its place. The rows are never summed.
import { describe, expect, it } from 'vitest';
import { type Catalog, type Result, type Row, type Spec } from '@unified-analytics/core';
import { ofUnbounded } from './helpers.ts';

const catalog: Catalog = {
  metrics: { visitors: { label: 'Visitors', unit: 'count', polarity: 'up' } },
  dimensions: { channel: { label: 'Channel', type: 'categorical' }, hour: { label: 'Hour', type: 'categorical' }, day: { label: 'Day', type: 'time' } },
};
const rows = [{ channel: 'Search', visitors: 4318 }, { channel: 'Direct', visitors: 2000 }];
const pairs = [{ channel: 'Search', hour: '9', visitors: 4318 }, { channel: 'Direct', hour: '10', visitors: 2000 }];
const days = [{ day: '2026-10-01', channel: 'Search', visitors: 4318 }, { day: '2026-10-01', channel: 'Direct', visitors: 2000 }];
const totalsBy = { channel: rows, hour: [{ hour: '9', visitors: 4318 }, { hour: '10', visitors: 2000 }], day: [{ day: '2026-10-01', visitors: null }] };
const result = (rows: Row[], total: number | null, more: Partial<Result> = {}): Result => ({ rows, totals: { visitors: total }, meta: { range: '28d', compare: null, notes: [], empty: false }, ...more });
const view = (spec: Spec, res: Result) => { const { plan, scene } = ofUnbounded(spec, res, spec.query, catalog); return { text: plan.text, nodes: scene.nodes }; };
const q = { metrics: ['visitors'], by: ['channel'] };
const specs: Record<string, [Spec, Result['rows'], Partial<Result>]> = {
  band: [{ spec: 'view/0', use: 'share-bar', query: q }, rows, {}],
  pie: [{ spec: 'view/0', layers: [{ mark: 'arc', encode: { angle: 'visitors', color: 'channel' } }], query: q }, rows, {}],
  two: [{ spec: 'view/0', layers: [{ mark: 'bar', stack: 'normalize', encode: { x: 'hour', y: 'visitors', color: 'channel' } }], query: { metrics: ['visitors'], by: ['channel', 'hour'] } }, pairs, { totalsBy }],
  time: [{ spec: 'view/0', layers: [{ mark: 'bar', stack: 'normalize', encode: { x: 'day', y: 'visitors', color: 'channel' } }], query: { metrics: ['visitors'], by: ['day', 'channel'] } }, days, { totalsBy }],
  grid: [{ spec: 'view/0', layers: [{ mark: 'cell', encode: { x: 'hour', y: 'channel', color: 'visitors' } }], query: { metrics: ['visitors'], by: ['hour', 'channel'] } }, pairs, { totalsBy }],
};
const shown = (name: string, total: number | null) => { const [spec, rs, more] = specs[name]!, v = view(spec, result(rs, total, more)); return { ...v, said: [v.text, ...v.nodes.flatMap((n) => (n.kind === 'text' && /^(number|legend)/.test(n.part) ? [n.text] : []))].join(' | ') }; };
// What follows the number in the sentence: the leader of the query's first dimension, where it is categorical.
const leader: Record<string, string> = { band: ' The top channel is Search.', pie: ' The top channel is Search.', two: ' The top channel is Search.', time: '', grid: ' The top hour is 9.' };

describe.each([[null], [0]])('a share view whose total is %s', (total) => {
  it.each(Object.keys(specs))('%s: says the value, and no percentage', (name) => {
    const v = shown(name, total);
    expect(v.text).toBe('Visitors: ' + (total == null ? 'no figure' : '0') + ' in the last 28 days.' + leader[name]);
    expect(v.said).not.toMatch(/%|NaN|Infinity|null/);
  });
  it('a band and a pie have no length to give a segment, and the legend says each value', () => {
    const band = shown('band', total).nodes, pie = shown('pie', total).nodes, texts = (ns: typeof band) => ns.flatMap((n) => (n.kind === 'text' && n.part !== 'number' ? [n.text] : []));
    expect(band.flatMap((n) => (n.part === 'band' && n.kind === 'rect' ? [n.w] : []))).toEqual([0, 0]);
    expect(pie.flatMap((n) => (n.kind === 'arc' ? [n.a1 - n.a0] : []))).toEqual([0, 0]);
    for (const ns of [band, pie]) expect(texts(ns)).toEqual(['Search', '4,318', 'Direct', '2,000', 'Search 4,318']);
    expect(band.find((n) => n.key === 'sub')).toMatchObject({ text: 'Top: Search' });
  });
  it('a stack normalized over an x the engine totals as null stands at no height', () => {
    expect(shown('time', total).nodes.flatMap((n) => (n.kind === 'rect' && n.part === 'plot' ? [n.y] : []))).toEqual([0, 0]);
  });
});
it('with a total, a share is still said', () => {
  expect(shown('band', 6318).said).toBe('Visitors: 6,318 in the last 28 days. The top channel is Search, at 68%. | 6,318 | Search 68% | Search | 68% | Direct | 32% | Search 68%');
  expect(shown('grid', 6318).text).toBe('Visitors: 6,318 in the last 28 days. The top hour is 9.');
});
