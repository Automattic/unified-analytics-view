import { describe, expect, it } from 'vitest';
import { buildScene, formatValue, makeContainer, resolve, type Catalog, type Layer, type Result, type Spec } from '@universal-analytics/core';

/* What the sidebar test case asked of the grammar: a metric's unit in every place its value is said, a mark painted
 * by which way its metric went, and rows painted by a field. On a catalog and results of its own. */
const catalog: Catalog = {
  metrics: {
    engaged: { label: 'Engaged time', unit: 'seconds', polarity: 'up' },
    finished: { label: 'Read to the end', unit: 'ratio', polarity: 'up' },
    bounces: { label: 'Bounces', unit: 'count', polarity: 'down' },
    visitors: { label: 'Visitors', unit: 'count', polarity: 'none' },
  },
  dimensions: { 'date.day': { label: 'Day', type: 'time' }, source: { label: 'Source', type: 'categorical' } },
};
const days = (m: string, values: number[], now: number, before: number | null): Result => ({
  rows: values.map((v, i) => ({ 'date.day': '2026-10-0' + (i + 1), [m]: v, [m + '@previous']: v })), totals: { [m]: now, [m + '@previous']: before }, meta: { range: '3d', compare: 'previous', notes: [] } });
const trend = (m: string, paint?: string): Spec => ({ query: { metrics: [m], by: ['date.day'], range: '3d', compare: 'previous' }, layers: [{ mark: 'line', encode: { x: 'date.day', y: m }, ...(paint && { paint }) }] });
const scene = (spec: Spec, result: Result, w = 500) => { const plan = resolve(spec, result, makeContainer(w), catalog); return { plan, scene: buildScene(plan, spec.query, result, catalog) }; };
const text = (s: ReturnType<typeof scene>, key: string) => { const n = s.scene.nodes.find((x) => x.key === key); return n && n.kind === 'text' ? n.text : undefined; };

describe('a metric\'s unit', () => {
  it('seconds read as a length of time, in its two largest parts', () => {
    const say = (v: number) => formatValue(v, catalog.metrics.engaged!);
    expect([0, 48, 60, 228, 3600, 3905, 90061].map(say)).toEqual(['0s', '48s', '1m', '3m 48s', '1h', '1h 5m', '25h 1m']);
  });
  it('is in the tldr value, the axis and the prose, for a time and for a rate', () => {
    const time = scene(trend('engaged'), days('engaged', [200, 228, 240], 228, 209));
    expect(text(time, 'value')).toBe('3m 48s');
    expect(time.scene.nodes.filter((n) => n.part === 'y-axis' && n.kind === 'text').map((n) => (n as { text: string }).text)).toContain('1m 40s');
    expect(time.plan.text).toContain('Engaged time: 3m 48s');
    const rate = scene(trend('finished'), days('finished', [0.4, 0.38, 0.36], 0.38, 0.396));
    expect(text(rate, 'value')).toBe('38%');
    expect(rate.scene.nodes.filter((n) => n.part === 'y-axis' && n.kind === 'text').map((n) => (n as { text: string }).text)).toContain('40%');
  });
});

describe('paint: "delta"', () => {
  const paint = (m: string, now: number, before: number | null, p = 'delta') => scene(trend(m, p), days(m, [1, 2, 3], now, before)).scene.nodes.find((n) => n.kind === 'path')!.paint;
  it('is good or bad by which way the metric went and which way is better', () => {
    expect(paint('engaged', 228, 209)).toBe('delta.good');
    expect(paint('engaged', 200, 209)).toBe('delta.bad');
    expect(paint('bounces', 228, 209)).toBe('delta.bad');
  });
  it('is the layer\'s own paint where there is no change to judge', () => {
    expect(paint('visitors', 228, 209)).toBe('series.1');   // no way is better
    expect(paint('engaged', 228, null)).toBe('series.1');   // no prior period
    expect(paint('engaged', 209, 209)).toBe('series.1');    // no change
    expect(paint('engaged', 228, 209, 'series.3')).toBe('series.3');
  });
});

describe('color in rows', () => {
  const result: Result = { rows: [['Search', 'Other', 40], ['AI assistants', 'Watched', 8], ['Direct', 'Other', 10]].map(([source, kind, visitors]) => ({ source, 'source@kind': kind, visitors })),
    totals: { visitors: 58 }, meta: { range: '3d', compare: null, notes: [] } };
  const list = (color: string): Spec => ({ query: { metrics: ['visitors'], by: ['source'], range: '3d' }, layers: [{ mark: 'bar', encode: { y: 'source', x: 'visitors', color } }, { mark: 'text', encode: { y: 'source', text: 'source' } }] as Layer[] });
  const bars = (color: string) => scene(list(color), result).scene.nodes.filter((n) => n.kind === 'rect').map((n) => n.paint);
  it('the rows\' own dimension is a colour for each row', () => expect(bars('source')).toEqual(['series.1', 'series.2', 'series.3']));
  it('a companion of it paints the rows that share a value alike', () => expect(bars('source@kind')).toEqual(['series.1', 'series.2', 'series.1']));
  it('anything else is an error that names the fix', () => expect(() => scene(list('visitors'), result)).toThrow(/Encode "source" on color, or remove it/));
});
