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
    expect(((a.v0 ?? 0) + b.v) / 2).toBeCloseTo(ticks.find((n) => n.text === '0')!.t, 12);
    expect(ticks.map((n) => n.text)).toEqual(['-4k', '-2k', '0', '2k', '4k']);
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
