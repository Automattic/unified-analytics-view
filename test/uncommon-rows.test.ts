import { describe, expect, it } from 'vitest';
import { buildScene, makeContainer, place, resolve, type Layer, type Result, type Spec } from '@unified-analytics/core';
import { catalog, runQuery } from '@unified-analytics/fixtures';

// Step 4 of docs/uncommon-coverage-plan.md: what rows, bars, ticks and rules take that they refused. Each part of the
// step has its facts here. The samples are swept, and have their golden scenes, at the foot of this file.
const run = (spec: Spec, w = 346, h: number | null = null, result: Result = runQuery(spec.query)) => {
  const container = makeContainer(w, h, 'svg', 8), plan = resolve(spec, result, container, catalog), ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (spec: Spec, result: Result = runQuery(spec.query)) => { try { run(spec, 346, null, result); } catch (e) { return (e as Error).message; } };
const of = <T = any>(nodes: { key: string }[], start: string) => nodes.filter((n) => n.key.startsWith(start)) as unknown as T[];
const label = (y: string): Layer => ({ mark: 'text', encode: { y, text: y } });

describe('a row divided by a second dimension', () => {
  const q = { metrics: ['visitors'], by: ['channel', 'device'], range: '28d' };
  const split = (stack: Layer['stack'] = 'zero', more: Layer[] = []): Spec => ({ query: q, layers: [{ mark: 'bar', encode: { y: 'channel', x: 'visitors', color: 'device' }, stack }, label('channel'), ...more] });
  const value: Layer = { mark: 'text', encode: { y: 'channel', text: 'visitors' }, align: 'end' };

  it('has a row for each value of the first dimension, and in it a bar for each value of the second, end to end', () => {
    const { ratio, result } = run(split());
    expect(ratio.rows).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other']);
    expect(ratio.series).toEqual(['Desktop', 'Mobile', 'Tablet']);
    expect(ratio.track).toBe('beside');
    const bars = of<{ key: string; v: number; v0?: number; paint: string; series: string; opacity?: number }>(ratio.nodes, 'primary:bar:Search:');
    expect(bars.map((n) => [n.key, n.series, n.paint])).toEqual([['primary:bar:Search:Desktop', 'Desktop', 'series.1'], ['primary:bar:Search:Mobile', 'Mobile', 'series.2'], ['primary:bar:Search:Tablet', 'Tablet', 'series.3']]);
    expect([bars[0]!.v0, bars[1]!.v0, bars[2]!.v0]).toEqual([undefined, bars[0]!.v, bars[1]!.v]);
    expect(bars.every((n) => n.opacity == null)).toBe(true);
    // The longest row fills the track, and each bar is its pair's value on it.
    const top = result.totalsBy!.channel![0]!.visitors as number, pair = result.rows.find((r) => r.channel === 'Search' && r.device === 'Desktop')!;
    expect(bars[2]!.v).toBe(1);
    expect(bars[0]!.v).toBeCloseTo((pair.visitors as number) / top, 12);
    expect(of(ratio.nodes, 'primary:bar:').length).toBe(18);
  });
  it('says a row\'s value as the engine\'s total for it, and never sums its pairs', () => {
    const result = runQuery(q), odd: Result = { ...result, totalsBy: { ...result.totalsBy!, channel: result.totalsBy!.channel!.map((r) => (r.channel === 'Search' ? { ...r, visitors: 9999 } : r)) } };
    expect(of<{ text: string }>(run(split('zero', [value])).ratio.nodes, 'primary:text#2:').map((n) => n.text)).toEqual(result.totalsBy!.channel!.map((r) => (r.visitors as number).toLocaleString('en-US')));
    expect(of<{ text: string }>(run(split('zero', [value]), 346, null, odd).ratio.nodes, 'primary:text#2:Search')[0]!.text).toBe('9,999');
    // And a share is of that total, so a stack of shares stops short of the end where the engine's total is more than its pairs.
    const shares = of<{ v: number }>(run(split('normalize'), 346, null, odd).ratio.nodes, 'primary:bar:Search:');
    expect(shares[2]!.v).toBeCloseTo((result.totalsBy!.channel![0]!.visitors as number) / 9999, 12);
    expect(of<{ v: number }>(run(split('normalize')).ratio.nodes, 'primary:bar:Direct:')[2]!.v).toBeCloseTo(1, 12);
  });
  it('has a legend in the series\' order, and one line for the series with the most, in its colour', () => {
    const { ratio, plan } = run(split());
    expect(ratio.parts).toEqual(['rows', 'legend']);
    expect(plan.guides).toEqual({ legend: 'full' });
    expect(ratio.nodes.filter((n) => n.part === 'legend').map((n) => [n.key, n.paint])).toEqual([['swatch:Desktop', 'series.1'], ['legend:Desktop', 'ink'], ['swatch:Mobile', 'series.2'], ['legend:Mobile', 'ink'], ['swatch:Tablet', 'series.3'], ['legend:Tablet', 'ink']]);
    expect(ratio.nodes.find((n) => n.key === 'legend-top')).toMatchObject({ part: 'legend-top', text: 'Desktop 50%', paint: 'series.1', series: 'Desktop' });
  });
  it('steps its legend down as a band\'s: to the one line, and then to nothing, before the rows go', () => {
    const at = (w: number, h: number | null) => { const { plan, ratio, scene } = run(split(), w, h); return [ratio.parts, plan.rowLimit, scene.height, plan.dropped]; };
    expect(at(346, null)).toEqual([['rows', 'legend'], null, 6 * 32 - 4 + 26, []]);
    expect(at(346, 160)).toEqual([['rows', 'legend'], 4, 150, ['rows 5 to 6']]);
    expect(at(346, 100)).toEqual([['rows', 'legend-top'], 2, 84, ['rows 3 to 6', 'the legend, except the series with the most']]);
    expect(at(346, 60)).toEqual([['rows'], 2, 60, ['rows 3 to 6', 'the legend']]);
    expect(run({ ...split(), keep: ['guides'] }, 346, 100).ratio.parts).toEqual(['rows', 'legend']);
    // The legend of a narrow list wraps, and the rows give up what it takes.
    expect(run(split(), 250, 160).scene.nodes.filter((n) => n.key.startsWith('legend:')).length).toBe(3);
  });
  it('is placed end to end in pixels, each bar as long as its share and no longer', () => {
    const { scene } = run(split()), px = of<{ x: number; w: number; y: number; h: number }>(scene.nodes, 'primary:bar:Social:');
    expect(px[0]!.x + px[0]!.w).toBeCloseTo(px[1]!.x, 9);
    expect(px[1]!.x + px[1]!.w).toBeCloseTo(px[2]!.x, 9);
    expect(px.every((n) => n.h === 12)).toBe(true);
    expect(scene.nodes.find((n) => n.key === 'legend:Desktop')).toMatchObject({ y: 16, ty: 6 * 32 - 4 });
  });
  it('is held to the six series colours, and to a result with the engine\'s totals by row', () => {
    const many: Spec = { query: { metrics: ['visitors'], by: ['device', 'country'] }, layers: [{ mark: 'bar', encode: { y: 'device', x: 'visitors', color: 'country' }, stack: 'zero' }, label('device')] };
    expect(err(many)).toBe('Splitting by "country" makes 15 series, and there are 6 series colours. Add "limit": 6 to the query, or less.');
    const { totalsBy: _totalsBy, ...bare } = runQuery(q);
    expect(err(split(), bare)).toBe('These rows are divided by "device", so each is a value of "channel" and reads the engine\'s total for it, and this result has no totalsBy["channel"]. Return it from the query layer, or take "device" off the layers and out of query.by.');
  });
  it('is a stacked bar\'s alone: any other mark there is still painted by the row\'s own dimension', () => {
    const plain: Spec = { query: q, layers: [{ mark: 'bar', encode: { y: 'channel', x: 'visitors', color: 'device' } }, label('channel')] };
    expect(err(plain)).toBe('Layer 1 is in rows by "channel" and encodes "device" on color. A row is painted by its own dimension, for a colour each, or by a companion the result returns with it, for rows that go together. Encode "channel" on color, or remove it. To divide each row\'s bar by "device", give the layer "stack".');
    expect(err({ query: q, layers: [{ mark: 'dot', encode: { y: 'channel', x: 'visitors', color: 'device' } }, label('channel')] }))
      .toBe('Layer 1 is in rows by "channel" and encodes "device" on color. A row is painted by its own dimension, for a colour each, or by a companion the result returns with it, for rows that go together. Encode "channel" on color, or remove it.');
  });
  it('says who leads each dimension, from the engine\'s totals', () => {
    expect(run(split()).plan.text).toBe('Search is the largest channel at 41% of visitors, and Desktop the largest device at 50%.');
  });
});
