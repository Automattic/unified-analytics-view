import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, makeContainer, place, resolve, type Layer, type PainterName, type Result, type Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';

// Step 4 of docs/uncommon-coverage-plan.md: what rows, bars, ticks and rules take that they refused. Each part of the
// step has its facts here. The samples are swept, and have their golden scenes, at the foot of this file.
const run = (spec: Spec, w = 346, h: number | null = null, result: Result = runQuery(spec.query)) => {
  const container = makeContainer(w, h, 'svg', 8), plan = resolve(spec, result, container, catalog), ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (spec: Spec, result: Result = runQuery(spec.query)) => { try { run(spec, 346, null, result); } catch (e) { return (e as Error).message; } };
const of = <T = any>(nodes: { key: string }[], start: string) => nodes.filter((n) => n.key.startsWith(start)) as unknown as T[];
const label = (y: string): Layer => ({ mark: 'text', encode: { y, text: y } });
const S = (name: string) => moreSamples[name]!.spec, view = new Ajv().compile(viewSchema);

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

describe('stack: "diverge"', () => {
  const rows = (by: string[], limit: number): Spec => ({ query: { metrics: ['visitors'], by, limit }, layers: [{ mark: 'bar', encode: { y: by[0]!, x: 'visitors', color: by[1]! }, stack: 'diverge' }, label(by[0]!)] });
  const plot = (by: string[], limit: number): Spec => ({ query: { metrics: ['visitors'], by, limit }, layers: [{ mark: 'bar', encode: { x: by[0]!, y: 'visitors', color: by[1]! }, stack: 'diverge' }] });
  const ends = (n: { v: number; v0?: number }) => [n.v0 ?? 0, n.v];

  it('with two series sets one to each side of zero in a row\'s track: the population pyramid', () => {
    const { ratio, result } = run(rows(['channel', 'device'], 2)), pair = (c: string, d: string) => result.rows.find((r) => r.channel === c && r.device === d)!.visitors as number;
    expect(ratio.series).toEqual(['Desktop', 'Mobile']);
    // The track runs from the most on the first side to the most on the second, and zero is where the two meet in every row.
    const zero = pair('Search', 'Desktop') / (pair('Search', 'Desktop') + pair('Search', 'Mobile'));
    for (const c of ['Search', 'Direct']) {
      const [a, b] = of<{ v: number; v0?: number }>(ratio.nodes, 'primary:bar:' + c + ':') as [any, any];
      expect(ends(a)[1]).toBeCloseTo(zero, 12); expect(ends(b)[0]).toBeCloseTo(zero, 12);
      expect(ends(b)[1] - ends(b)[0]).toBeCloseTo(pair(c, 'Mobile') / (pair('Search', 'Desktop') + pair('Search', 'Mobile')), 12);
    }
    expect(ends(of<{ v: number; v0?: number }>(ratio.nodes, 'primary:bar:Search:')[0]!)[0]).toBe(0);
    expect(ratio.track).toBe('beside');
  });
  it('with an odd count sets the middle series half on each side: five are the Likert chart', () => {
    const { ratio, result } = run(rows(['device', 'channel'], 5)), bars = of<{ v: number; v0?: number; series: string }>(ratio.nodes, 'primary:bar:Desktop:');
    expect(bars.map((n) => n.series)).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email']);
    bars.slice(1).forEach((n, i) => expect(ends(n)[0]).toBe(ends(bars[i]!)[1]));
    // Zero is the middle of the third in every row.
    const mid = (row: string) => { const [, , m] = of<{ v: number; v0?: number }>(ratio.nodes, 'primary:bar:' + row + ':'); return (ends(m!)[0] + ends(m!)[1]) / 2; };
    expect(mid('Mobile')).toBeCloseTo(mid('Desktop'), 12); expect(mid('Tablet')).toBeCloseTo(mid('Desktop'), 12);
    expect(result.rows.length).toBe(15);
  });
  it('on an axis sets the first half below the zero line, and its ticks count away from zero on both sides', () => {
    const { ratio, result } = run(plot(['channel', 'device'], 2)), [a, b] = of<{ v: number; v0?: number }>(ratio.nodes, 'primary:bar:Search:') as [any, any];
    const ticks = of<{ t: number; text: string }>(ratio.nodes, 'ytick:'), zero = ticks.find((n) => n.text === '0')!.t;
    expect(ticks.map((n) => n.text)).toEqual(['3k', '2k', '1k', '0', '1k', '2k']);
    expect(of(ratio.nodes, 'ytick:').map((n: any) => n.key)).toEqual(['ytick:-3000', 'ytick:-2000', 'ytick:-1000', 'ytick:0', 'ytick:1000', 'ytick:2000']);
    expect([a.v, b.v0]).toEqual([zero, zero]);
    expect(a.v0 ?? 0).toBeLessThan(zero); expect(b.v).toBeGreaterThan(zero);
    expect(ratio.nodes.find((n) => n.key === 'grid:0')).toMatchObject({ paint: 'axis', t: zero });
    // The readout and the sentence say each value as it is: nothing is negative but where it is drawn.
    expect(result.rows.every((r) => (r.visitors as number) > 0)).toBe(true);
    expect(run(plot(['channel', 'device'], 2)).plan.text).toBe('Search is the largest channel at 41% of visitors, and Desktop the largest device at 50%.');
  });
  it('leaves "center" as it was: half of the whole stack on each side, whatever the count', () => {
    const centred: Spec = { ...plot(['channel', 'device'], 2), layers: [{ mark: 'bar', encode: { x: 'channel', y: 'visitors', color: 'device' }, stack: 'center' }] };
    const [a, b] = of<{ v: number; v0?: number }>(run(centred).ratio.nodes, 'primary:bar:Search:') as [any, any], ticks = of<{ t: number; text: string }>(run(centred).ratio.nodes, 'ytick:');
    // About the middle of the plot, and with no value axis to count away from it (step 3 of the same plan).
    expect(((a.v0 ?? 0) + b.v) / 2).toBeCloseTo(0.5, 12);
    expect(ticks).toEqual([]);
  });
  it('refuses a value below zero, which has no side of its own to be on', () => {
    const result = runQuery(plot(['channel', 'device'], 2).query), odd: Result = { ...result, rows: result.rows.map((r, i) => (i === 1 ? { ...r, visitors: -5 } : r)) };
    expect(err(plot(['channel', 'device'], 2), odd)).toBe('stack: "diverge" sets each series to one side of zero by its place among them, and "visitors" is -5 for "Mobile" at "Search". Use stack: "zero", where a value below zero stacks downward.');
  });
  it('is in the schema, and needs a dimension on color as every stack does', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'bar', encode: { y: 'channel', x: 'visitors' }, stack: 'diverge' }] }))
      .toBe('Layer 1 has "stack" and no dimension on color, so there is nothing to stack. Encode the query\'s second dimension on color, or remove "stack".');
  });
});

describe('several marks to a row, by detail', () => {
  const q = { metrics: ['visitors'], by: ['channel', 'country'], range: '28d' };
  const strip = (mark = 'dot', more: Record<string, string> = {}): Spec => ({ query: q, layers: [{ mark, encode: { y: 'channel', x: 'visitors', detail: 'country', ...more } }, label('channel')] });

  it('a dot for each pair of a row and a detail value, on the row\'s track, all in one paint at half strength: the strip plot', () => {
    const { ratio, result } = run(strip()), dots = of<{ key: string; x: number; t: number; paint: string; opacity: number; series: string; row: string }>(ratio.nodes, 'primary:dot:');
    expect(dots.length).toBe(6 * 15);
    expect(ratio.rows).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other']);
    expect([ratio.series, ratio.detail!.length, ratio.parts, ratio.track]).toEqual([undefined, 15, ['rows'], 'beside']);
    expect(new Set(dots.map((n) => [n.paint, n.opacity, n.t].join())).size).toBe(1);
    expect(dots[0]).toMatchObject({ key: 'primary:dot:Search:US', row: 'Search', series: 'US', paint: 'series.1', opacity: 0.5, t: 0.5, x: 1 });
    // Each stands at its own pair's value: the track runs to the most any pair has, and no pair is added to another.
    const most = Math.max(...result.rows.map((r) => r.visitors as number));
    for (const r of result.rows.slice(0, 30)) expect(dots.find((n) => n.row === r.channel && n.series === r.country)!.x).toBeCloseTo((r.visitors as number) / most, 12);
    expect(new Set(dots.map((n) => n.key)).size).toBe(dots.length);
  });
  it('a tick the same way, and a colour for each row where the row\'s own dimension is on color', () => {
    const ticks = of<{ x: number; x2: number; t: number; t2: number; opacity: number }>(run(strip('tick')).ratio.nodes, 'primary:tick:Email:');
    expect(ticks.length).toBe(15);
    expect(ticks.every((n) => n.x === n.x2 && n.t === 0 && n.t2 === 1 && n.opacity === 0.5)).toBe(true);
    const { ratio } = run(strip('dot', { color: 'channel' }));
    expect(['Search', 'Direct', 'Other'].map((c) => [...new Set(of<{ paint: string }>(ratio.nodes, 'primary:dot:' + c + ':').map((n) => n.paint))])).toEqual([['series.1'], ['series.2'], ['series.6']]);
    expect(ratio.series).toBe(undefined);
  });
  it('has no limit of six, no legend, and a row\'s value is still the engine\'s total', () => {
    const { ratio, plan, result } = run({ ...strip(), layers: [...strip().layers!, { mark: 'text', encode: { y: 'channel', text: 'visitors' }, align: 'end' }] });
    expect(plan.guides).toEqual({});
    expect(of<{ text: string }>(ratio.nodes, 'primary:text#2:').map((n) => n.text)).toEqual(result.totalsBy!.channel!.map((r) => (r.visitors as number).toLocaleString('en-US')));
  });
  it('says who leads each dimension, from the engine\'s totals, and sums no row', () => {
    expect(run(strip()).plan.text).toBe('Search is the largest channel at 41% of visitors, and United States the largest country at 33%.');
  });
  it('gives up rows under a height limit, and the list for the number where a track has no room', () => {
    expect(run(strip(), 346, 100).plan).toMatchObject({ layout: 'rows', rowLimit: 3, dropped: ['rows 4 to 6'] });
    expect(run(strip(), 150).plan.layout).toBe('none');
  });
  it('refuses a bar or a rule there, which would lie one over another, and names the fix', () => {
    expect(err(strip('rule'))).toBe('Layer 1 is a "rule" in rows with "country" on detail, which would lay one over another in each row, all in one paint. Use "dot" or "tick" for a mark at each value, or remove "detail".');
    expect(err(strip('bar'))).toBe('Layer 1 is a "bar" in rows with "country" on detail, which would lay one over another in each row, all in one paint. Use "dot" or "tick" for a mark at each value, or encode "country" on color and give the bar "stack", or remove "detail".');
  });
});

describe('points coloured by a second dimension', () => {
  const q = { metrics: ['embed_x', 'embed_y'], by: ['term', 'intent'], range: '28d' };
  const dot: Layer = { mark: 'dot', encode: { x: 'embed_x', y: 'embed_y', color: 'intent', detail: 'term' } };

  it('a dot with one dimension on color and the other on detail is a point for each value of detail\'s, painted by color\'s', () => {
    const { ratio, plan } = run({ query: q, layers: [dot] });
    expect(ratio.rows!.length).toBe(24);
    expect(ratio.series).toEqual(['Pricing', 'How to', 'Privacy']);
    expect(ratio.detail).toBe(undefined);
    expect([1, 2, 3].map((j) => ratio.nodes.filter((n) => n.part === 'points' && n.paint === 'series.' + j).length)).toEqual([8, 8, 8]);
    expect(ratio.nodes.find((n) => n.part === 'points')).toMatchObject({ key: 'primary:dot:pricing:Pricing', row: 'pricing', series: 'Pricing' });
    expect(ratio.nodes.filter((n) => n.part === 'points').every((n) => n.opacity == null)).toBe(true);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis', 'legend']);
    // The sentence is the one for points, and not the one for two dimensions, which has no total here to lead with.
    expect(plan.text).toBe('Across 24 search terms in the last 28 days, the range of first component is -0.7 to 0.73 and of second component is -0.64 to 0.65. getting started is highest on first component and sso setup on second component.');
  });
  it('whichever way the query names the two', () => {
    const turned = { ...q, by: ['intent', 'term'] }, { ratio, plan } = run({ query: turned, layers: [dot] }, 346, null, runQuery(q));
    expect([ratio.rows!.length, ratio.series]).toEqual([24, ['Pricing', 'How to', 'Privacy']]);
    expect(plan.text).toMatch(/^Across 24 search terms in the last 28 days/);
  });
  it('steps down as any plot of points: the legend, and then the number alone', () => {
    expect(run({ query: q, layers: [dot] }, 300).plan).toMatchObject({ layout: 'cartesian', guides: { x: true }, dropped: ['the legend'] });
    expect(run({ query: q, layers: [dot] }, 234).plan.layout).toBe('none');
  });
});

describe('size on a bar: a column as wide as its share', () => {
  const q = { metrics: ['visitors'], by: ['channel', 'device'], range: '28d' };
  const mekko = (more: Partial<Layer> = { stack: 'normalize' }, query: Spec['query'] = q): Spec => ({ query, layers: [{ mark: 'bar', encode: { x: 'channel', y: 'visitors', color: 'device', size: 'visitors' }, ...more }] });

  it('sets each column edge to edge, as wide as its x\'s share of the engine\'s total, and divides it by share: the Marimekko', () => {
    const { ratio, result, plan } = run(mekko()), all = result.totals.visitors!;
    let from = 0;
    for (const t of result.totalsBy!.channel!) {
      const bars = of<{ x: number; w: number; v: number; v0?: number }>(ratio.nodes, 'primary:bar:' + t.channel + ':');
      for (const n of bars) { expect(n.x).toBeCloseTo(from, 12); expect(n.w).toBeCloseTo((t.visitors as number) / all, 12); }
      expect(bars[2]!.v).toBeCloseTo(1, 12);
      from += (t.visitors as number) / all;
    }
    expect(from).toBeCloseTo(1, 12);
    expect(ratio.scale).toBe('linear');
    // A width is no dot's size: there is no key to sizes, and nothing of one to give up.
    expect([ratio.parts, plan.guides.size, ratio.nodes.some((n) => n.part === 'size')]).toEqual([['y-axis', 'plot', 'x-axis', 'legend'], undefined, false]);
    expect(of<{ text: string }>(ratio.nodes, 'ytick:').map((n) => n.text)).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
  });
  it('is of the engine\'s total, so with a limit the columns stop short of the plot\'s end', () => {
    const { ratio, result } = run(mekko({ stack: 'normalize' }, { ...q, limit: 3 })), last = of<{ x: number; w: number }>(ratio.nodes, 'primary:bar:Social:')[0]!;
    expect(result.totalsBy!.channel!.length).toBe(3);
    expect(last.x + last.w).toBeCloseTo(result.totalsBy!.channel!.reduce((s, r) => s + (r.visitors as number), 0) / result.totals.visitors!, 12);
    expect(last.x + last.w).toBeLessThan(0.9);
  });
  it('labels each column under its middle, ranked by width, and a pixel painter leaves out the ones that would meet a wider column\'s', () => {
    const { ratio, scene } = run(mekko()), ticks = of<{ key: string; x: number; rank?: number }>(ratio.nodes, 'xtick:');
    expect(ticks.map((n) => [n.key, n.rank])).toEqual([['xtick:Search', undefined], ['xtick:Direct', 1], ['xtick:Social', 2], ['xtick:AI assistants', 3], ['xtick:Email', 4], ['xtick:Other', 5]]);
    const bar = of<{ x: number; w: number }>(ratio.nodes, 'primary:bar:Direct:')[0]!;
    expect(ticks[1]!.x).toBeCloseTo(bar.x + bar.w / 2, 12);
    expect(of(scene.nodes, 'xtick:').map((n: any) => n.key)).toEqual(['xtick:Search', 'xtick:Direct', 'xtick:Social', 'xtick:Email']);
    expect(of(run(mekko(), 700).scene.nodes, 'xtick:').map((n: any) => n.key)).toEqual(['xtick:Search', 'xtick:Direct', 'xtick:Social', 'xtick:AI assistants', 'xtick:Other']);
    // The rule that gives up a middle date is not these labels': under 380 px they are still thinned by what meets.
    expect(run(mekko(), 346).plan.dropped).toEqual([]);
  });
  it('is placed in pixels by its own ratios, and steps down as any plot does', () => {
    const { scene } = run(mekko()), a = of<{ x: number; w: number }>(scene.nodes, 'primary:bar:Search:')[0]!, b = of<{ x: number; w: number }>(scene.nodes, 'primary:bar:Direct:')[0]!;
    expect(a.x + a.w).toBeCloseTo(b.x, 9);
    expect(run(mekko(), 250).plan).toMatchObject({ layout: 'cartesian', side: true, dropped: ['axes and grid (added the number to make up for them)'] });
    expect(run(mekko(), 120).plan.layout).toBe('none');
  });
  it('is refused where the plot is not one of shares, and where the engine gives no total to be a share of', () => {
    const fix = 'which makes each column as wide as its share of the engine\'s total. That is read in a plot of shares: a dimension on x, the query\'s other dimension on color, and stack: "normalize". Add what is missing, or remove "size".';
    expect(err(mekko({ stack: 'zero' }))).toBe('Layer 1 is a bar with "visitors" on size, ' + fix);
    expect(err(mekko({}))).toBe('Layer 1 is a bar with "visitors" on size, ' + fix);
    expect(err({ query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'bar', encode: { x: 'channel', y: 'visitors', size: 'visitors' } }] })).toBe('Layer 1 is a bar with "visitors" on size, ' + fix);
    const result = runQuery(q);
    expect(err(mekko(), { ...result, totals: { visitors: null } })).toBe('A bar with "visitors" on size is as wide as its share of the engine\'s total of it, and this result\'s totals give null for "visitors". Return the total from the query layer, or remove "size" for columns of one width.');
  });
});

describe('a tick at the foot of a plot of points, and half a tick', () => {
  const q = { metrics: ['embed_x', 'embed_y'], by: ['term'], range: '28d' };
  const rug = (x = 'embed_x', first = false): Spec => { const dot: Layer = { mark: 'dot', encode: { x: 'embed_x', y: 'embed_y' } }, tick: Layer = { mark: 'tick', encode: { x } }; return { query: q, layers: first ? [tick, dot] : [dot, tick] }; };

  it('with a metric on x and nothing on y is a short stroke for each row, where its dot is along x: the rug', () => {
    const { ratio, scene, plan } = run(rug()), strokes = of<{ x: number; x2: number; t: number; t2: number; row: string; opacity: number; paint: string; width?: number }>(ratio.nodes, 'primary:tick:');
    const dots = of<{ x: number; row: string }>(ratio.nodes, 'primary:dot:');
    expect(strokes.length).toBe(24);
    strokes.forEach((n, i) => expect([n.x, n.x2, n.t, n.t2, n.row, n.paint, n.opacity, n.width]).toEqual([dots[i]!.x, dots[i]!.x, 0, 0.05, dots[i]!.row, 'ink', 0.5, undefined]));
    expect(strokes.every((n) => (n as any).part === 'plot')).toBe(true);
    expect([plan.layout, ratio.parts, ratio.scale]).toEqual(['cartesian', ['y-axis', 'plot', 'points', 'x-axis'], 'linear']);
    // In pixels it stands on the foot of the plot, under its row's dot.
    const px = of<{ x1: number; x2: number; y1: number; y2: number }>(scene.nodes, 'primary:tick:')[0]!, dot = of<{ cx: number }>(scene.nodes, 'primary:dot:')[0]!;
    expect([px.x1, px.x2, px.y1]).toEqual([dot.cx, dot.cx, 162]);
    expect(px.y1 - px.y2).toBeCloseTo(152 * 0.05, 9);
  });
  it('changes nothing else of the plot: the same scale, the same sentence, the same steps down', () => {
    const plain: Spec = { query: q, layers: [rug().layers![0]!] }, a = run(rug()), b = run(plain);
    expect(of(a.ratio.nodes, 'xtick:')).toEqual(of(b.ratio.nodes, 'xtick:'));
    expect(of(a.ratio.nodes, 'primary:dot:')).toEqual(of(b.ratio.nodes, 'primary:dot:'));
    expect(a.plan.text).toBe(b.plan.text);
    expect(run(rug(), 234).plan.layout).toBe('none');
    expect(of(run(rug('embed_x', true)).ratio.nodes, 'primary:tick:').length).toBe(24);
  });
  it('is refused at a metric the plot\'s x does not measure, and with a metric on y it is still no rug', () => {
    expect(err({ ...rug('embed_y') })).toBe('Layer 2 is a tick at "embed_y" along the foot of a plot whose x is "embed_x", so it would stand at places the axis does not measure. Encode "embed_x" on its x.');
    expect(err({ query: q, layers: [{ mark: 'tick', encode: { x: 'embed_x', y: 'embed_y' } }] })).toBe('Layer 1 is a tick with the metric "embed_x" on x, and a tick needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
  });
  it('with align is the half of a tick to one side of its band\'s middle', () => {
    const day = { metrics: ['response_time'], by: ['date.day'], range: '28d' }, at = (align?: Layer['align']) => of<{ x: number; x2: number; t: number; t2: number }>(run({ query: day, layers: [{ mark: 'tick', encode: { x: 'date.day', y: 'response_time@open' }, ...(align && { align }) }] }).ratio.nodes, 'primary:tick:')[3]!;
    const whole = at(), start = at('start'), end = at('end'), mid = (whole.x + whole.x2) / 2;
    expect([start.x, start.x2]).toEqual([whole.x, mid]);
    expect([end.x, end.x2]).toEqual([mid, whole.x2]);
    expect([start.t, start.t2, end.t]).toEqual([whole.t, whole.t, whole.t]);
  });
  it('and in a row\'s track, where the start is the top of the row', () => {
    const list = (align?: Layer['align']): Spec => ({ query: { metrics: ['pageviews'], by: ['page'], limit: 3 }, layers: [{ mark: 'tick', encode: { y: 'page', x: 'pageviews' }, ...(align && { align }) }, label('page')] });
    const ends = (align?: Layer['align']) => { const n = of<{ t: number; t2: number }>(run(list(align)).ratio.nodes, 'primary:tick:')[0]!; return [n.t, n.t2]; };
    expect([ends(), ends('start'), ends('end')]).toEqual([[0, 1], [0.5, 1], [0, 0.5]]);
  });
});

describe('a rule from a number, and a rule across a plot', () => {
  const pages = { metrics: ['response_time'], by: ['page'], range: '28d', limit: 4 };
  const scatter = { metrics: ['visitors', 'page_conversion'], by: ['page'], range: '28d' };
  const dot: Layer = { mark: 'dot', encode: { x: 'visitors', y: 'page_conversion' } };

  it('on an axis a rule from a number to a row\'s value is the stroke from the value to the number', () => {
    const up = (encode: Record<string, string | number>): Spec => ({ query: pages, layers: [{ mark: 'rule', encode: { x: 'page', ...encode } }] });
    const a = of<{ x: number; t: number; t2: number }>(run(up({ y: 200, y2: 'response_time@max' })).ratio.nodes, 'reference:rule:'), b = of<{ x: number; t: number; t2: number }>(run(up({ y: 'response_time@max', y2: 200 })).ratio.nodes, 'reference:rule:');
    expect(a.length).toBe(4);
    expect(a.map((n) => [n.x, n.t, n.t2])).toEqual(b.map((n) => [n.x, n.t2, n.t]));
    expect(new Set(a.map((n) => n.t)).size).toBe(1);
    // Both give the scale the same ends, so the ticks are the same.
    expect(of(run(up({ y: 200, y2: 'response_time@max' })).ratio.nodes, 'ytick:')).toEqual(of(run(up({ y: 'response_time@max', y2: 200 })).ratio.nodes, 'ytick:'));
  });
  it('is still refused between two numbers, and a bar still starts at a field', () => {
    expect(err({ query: pages, layers: [{ mark: 'rule', encode: { x: 'page', y: 0, y2: 500 } }] })).toBe('Layer 1 is a rule from 0 to 500 on y, so every row\'s would be the one stroke. Encode a metric, or a companion the result returns with one, at either end, or keep one number for a line at it.');
    expect(err({ query: pages, layers: [{ mark: 'bar', encode: { x: 'page', y: 0, y2: 'response_time@max' } }] })).toBe('Layer 1 has "y2" and no value on y to run from. Encode where it starts on y: a metric, or a companion the result returns with one.');
  });
  it('with numbers at both ends on both axes is one line across a plot of points, drawn as a reference is', () => {
    const { ratio, scene, plan } = run({ query: scatter, layers: [{ mark: 'rule', encode: { x: 0, y: 0, x2: 2000, y2: 4 } }, dot] }), line = ratio.nodes.find((n) => n.key === 'reference:rule') as any;
    const ticks = (k: string) => of<{ text: string; x?: number; t?: number }>(ratio.nodes, k), x2k = ticks('xtick:').find((n) => n.text === '2k')!.x!, y4 = ticks('ytick:').find((n) => n.text === '4%')!.t!;
    expect(line).toMatchObject({ kind: 'path', part: 'plot', paint: 'rule', dash: '5 3', width: 1.5, role: 'reference', layer: 'data' });
    expect(line.points).toEqual([{ row: '', x: ticks('xtick:').find((n) => n.text === '0')!.x, v: 0 }, { row: '', x: x2k, v: y4 }]);
    expect(line.fill).toBe(undefined);
    // It is a place on each scale, so the scales hold it, as they hold a rule at one number.
    const far = run({ query: scatter, layers: [{ mark: 'rule', encode: { x: 0, y: 0, x2: 9000, y2: 30 } }, dot] }).ratio;
    expect([of<{ text: string }>(far.nodes, 'xtick:').pop()!.text, of<{ text: string }>(far.nodes, 'ytick:').pop()!.text]).toEqual(['10k', '30%']);
    // In pixels it is a straight stroke between the two places, and the plot is read by its points as before.
    expect((scene.nodes.find((n) => n.key === 'reference:rule') as any).d).toMatch(/^M[\d.]+,[\d.]+L[\d.]+,[\d.]+$/);
    expect(plan.text).toBe(run({ query: scatter, layers: [dot] }).plan.text);
    expect(ratio.rows!.length).toBe(8);
  });
  it('with a field at an end is a line for each row, from its own values', () => {
    const then = { ...scatter, metrics: ['visitors', 'pageviews'], compare: 'previous' as const };
    const { ratio, result } = run({ query: then, layers: [{ mark: 'rule', encode: { x: 'visitors@previous', y: 'pageviews@previous', x2: 'visitors', y2: 'pageviews' }, role: 'context' }, { mark: 'dot', encode: { x: 'visitors', y: 'pageviews' } }] });
    const lines = of<{ key: string; row: string; points: { x: number; v: number }[]; paint: string; dash?: string }>(ratio.nodes, 'context:rule:'), dots = of<{ x: number; t: number; row: string }>(ratio.nodes, 'primary:dot:');
    // A page with no period before it has no line.
    expect(lines.length).toBe(result.rows.filter((r) => r['visitors@previous'] != null).length);
    expect(lines.length).toBe(7);
    for (const n of lines) { const d = dots.find((o) => o.row === n.row)!; expect([n.points[1]!.x, n.points[1]!.v, n.paint, n.dash]).toEqual([d.x, d.t, 'ink', undefined]); }
    expect(lines[0]!.key).toBe('context:rule:/');
  });
  it('is refused on a time or a category axis, and with a label it has no place for', () => {
    expect(err({ query: pages, layers: [{ mark: 'bar', encode: { x: 'page', y: 'response_time' } }, { mark: 'rule', encode: { x: 0, y: 0, x2: 1, y2: 500 } }] }))
      .toBe('A rule with x, y, x2 and y2 runs across a plot from one place to another, and this plot has a time or a category on x, where a place has no number. Put a metric on the other layers\' x, or keep y and y2 alone for a stroke at each x.');
    expect(err({ query: scatter, layers: [{ mark: 'rule', encode: { x: 0, y: 0, x2: 2000, y2: 4 }, label: 'Even' }, dot] })).toBe('A rule that runs across a plot has no place for its label yet. Remove "label", and name the line in the view\'s title.');
  });
});

describe('the range behind a row\'s marks, divided at the catalog\'s bands', () => {
  const q = { metrics: ['signups'], by: ['device'], range: '28d' };
  const bullet: Spec = { query: q, use: 'bullet' };
  const withMetric = (def: Partial<(typeof catalog.metrics)[string]>) => ({ ...catalog, metrics: { ...catalog.metrics, signups: { label: 'Sign-ups', unit: 'count', polarity: 'up' as const, ...def } } });
  const bands = (cat = catalog, spec: Spec = bullet) => { const container = makeContainer(346, null, 'svg', 8), result = runQuery(q), plan = resolve(spec, result, container, cat), ratio = buildScene(plan, q, result, cat); return { ratio, scene: place(ratio, container) }; };

  it('a bar with nothing on x is the metric\'s domain in every row, a part for each band, in paints of their own', () => {
    const { ratio, scene } = bands(), parts = of<{ key: string; v: number; v0?: number; paint: string; layer: string; role: string; row: string }>(ratio.nodes, 'context:bar:Mobile:');
    expect(parts.map((n) => [n.key, n.v0 ?? 0, n.v, n.paint])).toEqual([['context:bar:Mobile:1', 0, 0.4, 'band.1'], ['context:bar:Mobile:2', 0.4, 0.8, 'band.2'], ['context:bar:Mobile:3', 0.8, 1, 'band.3']]);
    expect(parts.every((n) => n.layer === 'guide' && n.role === 'context' && n.row === 'Mobile')).toBe(true);
    // They come before the bar and the tick, so a painter that draws in order has them behind, and they are as tall as the row.
    const keys = ratio.nodes.map((n) => n.key);
    expect(keys.indexOf('context:bar:Mobile:3')).toBeLessThan(keys.indexOf('primary:bar:Mobile'));
    const px = of<{ x: number; w: number; y: number; h: number }>(scene.nodes, 'context:bar:Mobile:'), bar = scene.nodes.find((n) => n.key === 'primary:bar:Mobile') as any;
    expect(px.map((n) => [n.y, n.h])).toEqual([[32, 28], [32, 28], [32, 28]]);
    expect([bar.y, bar.h]).toEqual([40, 12]);
    expect(px[0]!.x + px[0]!.w).toBeCloseTo(px[1]!.x, 9);
    expect(ratio.track).toBe('beside');
  });
  it('holds the track to the whole domain, so a value is read against it', () => {
    const { ratio } = bands();
    expect((ratio.nodes.find((n) => n.key === 'primary:bar:Desktop') as any).v).toBeCloseTo(158 / 500, 12);
    expect((ratio.nodes.find((n) => n.key === 'reference:tick:Desktop') as any).x).toBe(0.8);
  });
  it('is one part where the catalog gives no bands, and nothing where it gives no domain, as a target it does not give has no tick', () => {
    expect(of<{ paint: string; v: number }>(bands(withMetric({ domain: [0, 500] })).ratio.nodes, 'context:bar:Desktop:').map((n) => [n.paint, n.v])).toEqual([['band.1', 1]]);
    expect(of(bands(withMetric({ bands: [200, 400] })).ratio.nodes, 'context:bar:').length).toBe(0);
    // A band outside the domain divides nothing.
    expect(of(bands(withMetric({ domain: [0, 500], bands: [200, 900] })).ratio.nodes, 'context:bar:Desktop:').length).toBe(2);
  });
  it('errors name the fix: more bands than there are paints, and a range of no metric', () => {
    expect(() => bands(withMetric({ domain: [0, 500], bands: [100, 200, 300] }))).toThrow('The catalog divides "signups" into 4 bands, and there are 3 band paints. Give its "bands" 2 values at most.');
    expect(() => bands(catalog, { query: q, layers: [{ mark: 'bar', encode: { y: 'device' }, role: 'context' }, label('device')] }))
      .toThrow('Layer 1 is a bar with nothing on x, which is the range a row\'s marks are read against, and no other mark in these rows puts a metric on x for it to be the range of. Add one, for example { "mark": "bar", "encode": { "y": "device", "x": a metric } }, or encode a metric on this bar\'s x.');
  });
});

describe('the fixture engine, for step 4', () => {
  it('keeps a dimension that has an order of its own in it, alone and as the rows of a pair, and divides each row its own way', () => {
    const ages = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'], { rows, totals, totalsBy } = runQuery(S('pyramid').query);
    expect(runQuery({ metrics: ['visitors'], by: ['age'] }).rows.map((r) => r.age)).toEqual(ages);
    expect([...new Set(rows.map((r) => r.age))]).toEqual(ages);
    expect(totalsBy!.sex!.map((r) => r.sex)).toEqual(['Female', 'Male']);
    // Every pair adds up to its row, and the rows to the engine's total. Women are the fewer among the youngest and the more among the oldest.
    for (const t of totalsBy!.age!) expect(rows.filter((r) => r.age === t.age).reduce((s, r) => s + (r.visitors as number), 0)).toBe(t.visitors);
    expect(totalsBy!.age!.reduce((s, r) => s + (r.visitors as number), 0)).toBeCloseTo(totals.visitors!, -1);
    const women = (age: string) => (rows.find((r) => r.age === age && r.sex === 'Female')!.visitors as number) / (totalsBy!.age!.find((r) => r.age === age)!.visitors as number);
    expect(women('18–24')).toBeLessThan(0.5); expect(women('65+')).toBeGreaterThan(0.55);
  });
  it('answers a survey by statement and answer, the answers in their own order from one end to the other', () => {
    const { rows, totalsBy } = runQuery(S('likert').query);
    expect(rows.length).toBe(25);
    expect(totalsBy!.answer!.map((r) => r.answer)).toEqual(['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']);
    expect(totalsBy!.question!.map((r) => r.question)).toEqual(['Easy to set up', 'Clear reports', 'Fast enough', 'Good value', 'Would recommend']);
    expect(runQuery(S('likert').query, 'empty')).toMatchObject({ rows: [], totalsBy: { question: [], answer: [] } });
  });
  it('returns every twentieth of the load times beside a normal curve\'s, with no total of either', () => {
    const { rows, totals } = runQuery(S('qq').query);
    expect(rows.length).toBe(19);
    expect([rows[0], rows[18]]).toEqual([{ quantile: '5%', load_normal: 0.76, load_quantile: 1.1 }, { quantile: '95%', load_normal: 4.04, load_quantile: 5.6 }]);
    expect(totals).toEqual({ load_normal: null, load_quantile: null });
    expect(runQuery({ ...S('qq').query, range: '7d' }).rows).toEqual(rows);
  });
});

describe('the samples of step 4', () => {
  it('a population pyramid: an age band a row, women to one side of zero and men to the other, from the preset', () => {
    const { ratio, plan, result } = run(S('pyramid'));
    expect(plan.preset).toBe('pyramid');
    expect(ratio.rows).toEqual(['18–24', '25–34', '35–44', '45–54', '55–64', '65+']);
    expect(ratio.series).toEqual(['Female', 'Male']);
    const zero = of<{ v: number }>(ratio.nodes, 'primary:bar:18–24:')[0]!.v;
    for (const age of ratio.rows!) { const [f, m] = of<{ v: number; v0?: number; paint: string }>(ratio.nodes, 'primary:bar:' + age + ':') as [any, any]; expect([f.v, m.v0, f.paint, m.paint]).toEqual([zero, zero, 'series.1', 'series.2']); }
    // The readout's and the sentence's numbers are the engine's, and no count is below zero.
    expect(result.rows.every((r) => (r.visitors as number) > 0)).toBe(true);
    expect(plan.text).toBe('25–34 is the largest age band at 27% of visitors, and Female the largest sex at 53%.');
  });
  it('a Likert chart: the same preset over five answers, the middle one half on each side of zero in every row', () => {
    const { ratio, plan } = run(S('likert'));
    expect(ratio.series).toEqual(['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree']);
    const mid = ratio.rows!.map((q) => { const n = of<{ v: number; v0: number }>(ratio.nodes, 'primary:bar:' + q + ':')[2]!; return (n.v0 + n.v) / 2; });
    mid.forEach((m) => expect(m).toBeCloseTo(mid[0]!, 12));
    expect(ratio.nodes.find((n) => n.key === 'legend-top')).toMatchObject({ text: 'Agree 33%', paint: 'series.4' });
    expect(plan.text).toBe('Easy to set up is the largest statement at 20% of responses, and Agree the largest answer at 33%.');
  });
  it('a strip plot and a Marimekko, each from its preset', () => {
    expect([run(S('strip')).plan.preset, run(S('strip')).ratio.nodes.filter((n) => n.kind === 'circle' && n.part === 'rows').length]).toEqual(['strip', 90]);
    expect([run(S('marimekko')).plan.preset, run(S('marimekko')).ratio.scale]).toEqual(['marimekko', 'linear']);
  });
  it('an OHLC chart: a stroke from the day\'s least to its most, the opening to the start of its band and the close to the end', () => {
    const { ratio, plan, result } = run(S('ohlc')), day = result.rows[5]!, k = day['date.day'] as string, node = (key: string) => ratio.nodes.find((n) => n.key === key + ':' + k) as any;
    const stroke = node('primary:rule'), open = node('primary:tick'), close = node('primary:tick#2'), v = (f: string) => (day['response_time@' + f] as number) / 800;
    expect(plan.layers.map((l) => l.role + ':' + l.mark)).toEqual(['primary:rule', 'primary:tick', 'primary:tick']);
    expect([stroke.t, stroke.t2, open.t, close.t]).toEqual([v('min'), v('max'), v('open'), v('close')]);
    expect([open.x2, close.x]).toEqual([stroke.x, stroke.x]);
    expect(stroke.x - open.x).toBeCloseTo(close.x2 - stroke.x, 12);
    // Every mark is the central one, so a short plot keeps them all, and the sentence says the range they run over.
    expect(run(S('ohlc'), 250).plan.dropped).toEqual(['axes and grid (added the number to make up for them)']);
    expect(plan.text).toBe('Response time: 436ms in the last 28 days.');
  });
  it('a Q-Q plot: a point for each quantile, and the line they would lie on were the times normal', () => {
    const { ratio, plan } = run(S('qq')), line = ratio.nodes.find((n) => n.key === 'reference:rule') as any;
    expect(line.points.map((p: any) => [p.x, p.v])).toEqual([[0, 0], [1, 1]]);
    expect(ratio.nodes.filter((n) => n.part === 'points').length).toBe(19);
    expect(['xtick:', 'ytick:'].map((k) => of<{ text: string }>(ratio.nodes, k).map((n) => n.text))).toEqual([['0ms', '2s', '4s', '6s'], ['0ms', '2s', '4s', '6s']]);
    expect(plan.text).toBe('Across 19 quantiles in the last 28 days, the range of normal quantile is 760ms to 4s and of load time quantile is 1.1s to 5.6s. 95% is highest on both.');
  });
});

describe('the sweep, for the samples of step 4', () => {
  // The layout each has at 346, 250, 120 and 10 px. A plot of points has no bare form, and a track beside its label gives way under 160 px.
  const samples: Record<string, string[]> = {
    pyramid: ['rows', 'rows', 'none', 'prose'], likert: ['rows', 'rows', 'none', 'prose'], strip: ['rows', 'rows', 'none', 'prose'],
    marimekko: ['cartesian', 'cartesian', 'none', 'prose'], ohlc: ['cartesian', 'cartesian', 'none', 'prose'],
    // Neither has a total, so the number that stands in for the plot is a dash.
    rug: ['cartesian', 'none', 'none', 'prose'], qq: ['cartesian', 'none', 'none', 'prose'],
  };
  const painters: PainterName[] = ['svg', 'dots'], heights = [null, 300, 160, 100, 60, 40], widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
  const at = (name: string, w: number, h: number | null, sc: (typeof scenarios)[number], painter: PainterName = 'svg') => {
    const spec = S(name), container = makeContainer(w, h, painter, 8), result = runQuery(spec.query, sc), plan = resolve(spec, result, container, catalog), ratio = buildScene(plan, spec.query, result, catalog);
    return { plan, ratio, scene: place(ratio, container) };
  };
  for (const [name, layouts] of Object.entries(samples)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, and ratios from 0 to 1', () => {
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const where = [name, sc, p, w, h].join(' '), { plan, ratio, scene } = at(name, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + where).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + where).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + where).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + where).toBeLessThanOrEqual(h);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'x2', 'w', 'v', 'v0', 't', 't2']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + where + ' ' + n.key).toBe(true);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + where).toEqual(keys);
      }
    });
    it(name + ': is in the schema, resolves in every data state, and steps down to the number', () => {
      expect(view(S(name)), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) {
        expect([346, 250, 120, 10].map((w) => at(name, w, null, sc).plan.layout), sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'none', 'prose'] : layouts);
        expect(at(name, 700, null, sc).plan.dropped, sc).toEqual([]);
      }
    });
  }
  it('golden scenes', () => {
    for (const name of Object.keys(samples)) for (const [w, h] of [[346, null], [234, null], [346, 100]] as const) expect(at(name, w, h, 'typical').scene).toMatchSnapshot(`${name} at ${w} by ${h ?? 'any'}`);
  });
});
