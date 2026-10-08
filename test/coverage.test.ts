import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, makeContainer, place, resolve, type PainterName, type Spec } from '@universal-analytics/core';
import viewSchema from '@universal-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, samples, scenarios } from '@universal-analytics/fixtures';

// What the grammar draws beyond the prototype's six samples (docs/chart-coverage-plan.md). Nothing here has a
// prototype to match, so it is held to its own sweep, facts and golden scenes.
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg') => {
  const container = makeContainer(w, h, painter, 8), result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
// The engine refuses some queries itself. `q` is one it answers, for an error that is resolve()'s to make.
const err = (s: Spec, q = s.query) => { try { resolve(s, runQuery(q), makeContainer(346), catalog); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);

const specs = Object.fromEntries(Object.entries(moreSamples).map(([k, s]) => [k, s.spec]));
const painters: PainterName[] = ['svg', 'dots'];
const heights = [null, 300, 160, 100, 60, 40];
const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];

describe('the sweep, for what the prototype does not know', () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, and ratios from 0 to 1', () => {
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'v', 'v0', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
        // Placing changes no key and no order. It only leaves out what the size has no room for.
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
      }
    });
    it(name + ': resolves in every data state, and steps down to the number and then the prose', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) {
        // 10 px is narrower than any number, "0" included.
        const layouts = [346, 250, 120, 10].map((w) => run(spec, w, null, sc).plan.layout);
        expect(layouts, sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'none', 'prose'] : ['cartesian', 'cartesian', 'none', 'prose']);
        expect(run(spec, 250, null, sc).plan.dropped[0], sc).toBe(sc === 'empty' ? undefined : 'axes and grid (added the number to make up for them)');
        expect(run(spec, 700, null, sc).plan.dropped, sc).toEqual([]);
      }
    });
  }
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [234, null], [346, 100]];
  for (const name of Object.keys(specs)) for (const [w, h] of sizes) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
});

describe('shares are of the engine\'s total', () => {
  const mix = samples.mix!.spec, top3: Spec = { ...mix, query: { ...mix.query, limit: 3 } };
  it('with a limit, the band, its legend, the note and the prose say a share of everything, not of the rows shown', () => {
    const { ratio, plan } = run(top3, 346), text = (key: string) => (ratio.nodes.find((n) => n.key === key) as { text: string }).text;
    const band = ratio.nodes.filter((n) => n.part === 'band').map((n) => (n as { v: number }).v);
    expect(band.map((v) => Math.round(v * 100))).toEqual([41, 28, 14]);
    expect(['share:Search', 'share:Direct', 'share:Social', 'legend:top', 'sub'].map(text)).toEqual(['41%', '28%', '14%', 'Search 41%', 'Search 41%']);
    expect(plan.text).toBe('Search is the largest channel at 41% of visitors, followed by Direct at 28%.');
  });
  it('the fixture\'s channels add up to its total at any range', () => {
    for (const range of ['7d', '14d', '28d']) {
      const { rows, totals } = runQuery({ ...mix.query, range });
      expect(Math.abs(rows.reduce((s, r) => s + (r.visitors as number), 0) - totals.visitors!), range).toBeLessThanOrEqual(3);
    }
  });
});

describe('two dimensions', () => {
  const byDay = { metrics: ['visitors'], by: ['date.day', 'channel'], range: '28d', compare: 'previous' as const };
  const total = (rows: { visitors?: unknown }[]) => rows.reduce((s, r) => s + (r.visitors as number), 0);
  it('the engine answers with a row per pair, and with totals per value of each dimension', () => {
    const { rows, totals, totalsBy } = runQuery(byDay), days = runQuery({ ...byDay, by: ['date.day'] }).rows;
    expect(rows.length).toBe(28 * 6);
    expect(rows[0]).toEqual({ 'date.day': '2026-09-08', channel: 'Search', partial: false, visitors: 177, 'visitors@previous': 158 });
    // A day's pairs add up to the day, so a total by day is what the query by day alone returns.
    expect(totalsBy!['date.day']).toEqual(days);
    for (const d of days) expect(total(rows.filter((r) => r['date.day'] === d['date.day'])), String(d['date.day'])).toBe(d.visitors);
    expect(totalsBy!.channel!.map((r) => r.channel)).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other']);
    expect(total(totalsBy!.channel!)).toBe(totals.visitors);
    // Time is the outer dimension whichever way the query names them.
    expect(runQuery({ ...byDay, by: ['channel', 'date.day'] }).rows).toEqual(rows);
  });
  it('a limit keeps the first values of each categorical dimension, and a total still covers the rest', () => {
    const { rows, totalsBy } = runQuery({ ...byDay, limit: 3 }), all = runQuery(byDay).totalsBy!;
    expect(rows.length).toBe(28 * 3);
    expect(totalsBy!.channel).toEqual(all.channel!.slice(0, 3));
    expect(totalsBy!['date.day']).toEqual(all['date.day']);
    const pairs = runQuery({ metrics: ['visitors'], by: ['page', 'channel'], limit: 2 });
    expect(pairs.rows.map((r) => r.page + ' ' + r.channel)).toEqual(['/ Search', '/ Direct', '/pricing Search', '/pricing Direct']);
  });
  it('no prior period and no data', () => {
    expect(runQuery(byDay, 'no-prior').rows[0]!['visitors@previous']).toBe(null);
    expect(runQuery(byDay, 'empty')).toMatchObject({ rows: [], totalsBy: { 'date.day': [], channel: [] }, meta: { empty: true } });
  });
  it('the schema takes two dimensions and no more, and not one twice', () => {
    const spec = (by: string[]) => ({ spec: 'view/0', query: { metrics: ['visitors'], by }, layers: [{ mark: 'bar', encode: { x: by[0], y: 'visitors', color: by[1] } }] });
    expect(view(spec(['date.day', 'channel'])), JSON.stringify(view.errors)).toBe(true);
    expect(view(spec(['date.day', 'channel', 'device']))).toBe(false);
    expect(view(spec(['channel', 'channel']))).toBe(false);
  });
  it('errors name the fix: a third dimension, a field the query lacks, and a dimension nothing encodes', () => {
    const bar = (encode: Record<string, string>, by: string[]): Spec => ({ query: { metrics: ['visitors'], by }, layers: [{ mark: 'bar', encode }] });
    expect(err(bar({ x: 'date.day', y: 'visitors' }, ['date.day', 'channel', 'device']), { metrics: ['visitors'] })).toBe('A view is by one dimension or by two different ones, and query.by has: date.day, channel, device. Remove all but two.');
    expect(err(bar({ x: 'date.day', y: 'visitors', color: 'device' }, ['date.day', 'channel']))).toBe('Layer 1 encodes "device" on color, which the query does not return. It returns: date.day, channel, visitors.');
    expect(err(bar({ x: 'date.day', y: 'visitors' }, ['date.day', 'channel']))).toBe('The query is by "channel", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, or remove it from query.by.');
    expect(() => runQuery({ metrics: ['visitors'], by: ['channel', 'channel'] })).toThrow('A query is by one dimension or by two different ones. This one is by: channel, channel.');
  });
});

describe('color splits a plot into series', () => {
  const byDevice: Spec = { spec: 'view/0', query: { metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'device' } }] };
  const marks = (spec: Spec, result = runQuery(spec.query)) => buildScene(resolve(spec, result, makeContainer(700), catalog), spec.query, result, catalog);
  it('a path per series for a line, keyed and painted by the series', () => {
    const scene = marks(byDevice), paths = scene.nodes.filter((n) => n.kind === 'path');
    expect(scene).toMatchObject({ layout: 'cartesian', series: ['Desktop', 'Mobile', 'Tablet'], scale: 'point' });
    expect(scene.rows!.length).toBe(28);
    expect(paths.map((n) => [n.key, n.series, n.paint])).toEqual([
      ['primary:line:Desktop', 'Desktop', 'series.1'], ['primary:line:Desktop:partial', 'Desktop', 'series.1'],
      ['primary:line:Mobile', 'Mobile', 'series.2'], ['primary:line:Mobile:partial', 'Mobile', 'series.2'],
      ['primary:line:Tablet', 'Tablet', 'series.3'], ['primary:line:Tablet:partial', 'Tablet', 'series.3'],
    ]);
    expect(paths[0]!.points.length).toBe(27);
  });
  it('a rect per pair for a bar, with the series in its key', () => {
    const rects = marks({ ...byDevice, layers: [{ mark: 'bar', encode: byDevice.layers![0]!.encode }] }).nodes.filter((n) => n.kind === 'rect' && n.part === 'plot');
    expect(rects.length).toBe(28 * 3);
    // A series at a time, as paths are.
    expect([0, 1, 28, 56].map((i) => rects[i]!.key)).toEqual(['primary:bar:2026-09-08:Desktop', 'primary:bar:2026-09-09:Desktop', 'primary:bar:2026-09-08:Mobile', 'primary:bar:2026-09-08:Tablet']);
    expect(rects[28]).toMatchObject({ row: '2026-09-08', series: 'Mobile', paint: 'series.2' });
  });
  it('paint follows the dimension\'s order, not the rows\'', () => {
    const result = runQuery(byDevice.query), paint = (res: typeof result) => Object.fromEntries(marks(byDevice, res).nodes.filter((n) => n.kind === 'path').map((n) => [n.series, n.paint]));
    expect(paint({ ...result, rows: result.rows.slice().reverse() })).toEqual(paint(result));
    // An engine that sends no totals by dimension leaves only the rows to order by.
    expect(marks(byDevice, { ...result, totalsBy: undefined, rows: result.rows.slice().reverse() }).series).toEqual(['Tablet', 'Mobile', 'Desktop']);
  });
  it('more than six series is an error that names the fix', () => {
    const byPage: Spec = { query: { metrics: ['visitors'], by: ['date.day', 'page'] }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'page' } }] };
    expect(err(byPage)).toBe('Splitting by "page" makes 8 series, and there are 6 series colours. Add "limit": 6 to the query, or less.');
    expect(marks({ ...byPage, query: { ...byPage.query, limit: 6 } }).series!.length).toBe(6);
  });
  it('a layer with no color is one series still, beside those that are split', () => {
    const scene = marks({ ...byDevice, layers: [...byDevice.layers!, { mark: 'rule', encode: { y: 200 }, label: 'Target' }] });
    expect(scene.nodes.filter((n) => n.role === 'reference').map((n) => [n.key, n.series])).toEqual([['reference:rule', undefined], ['reference:rule:label', undefined]]);
  });
});

describe('a split plot\'s legend', () => {
  const series = specs.series!;
  const key = (w: number, h: number | null = null, spec = series) => { const { plan, ratio, scene } = run(spec, w, h); return { legend: plan.guides.legend, parts: ratio.parts, dropped: plan.dropped, scene, ratio }; };
  it('is every series at first, then a label at the end of each line, then nothing', () => {
    expect(key(346)).toMatchObject({ legend: 'full', parts: ['y-axis', 'plot', 'x-axis', 'legend'], dropped: ['the middle date label'] });
    expect(key(300)).toMatchObject({ legend: 'labels', parts: ['y-axis', 'plot', 'labels', 'x-axis'], dropped: ['the legend (kept a label at the end of each line)', 'the middle date label'] });
    expect(key(346, 170)).toMatchObject({ legend: 'labels' });
    expect(key(250)).toMatchObject({ legend: undefined, parts: ['number', 'plot'] });
    // Bars have no end to label.
    const bars: Spec = { ...series, layers: [{ mark: 'bar', encode: series.layers![0]!.encode }] };
    expect(key(300, null, bars)).toMatchObject({ legend: undefined, parts: ['y-axis', 'plot', 'x-axis'], dropped: ['the legend', 'the middle date label'] });
    expect(key(300, null, { ...series, keep: ['guides'] }).legend).toBe('full');
  });
  it('the scene carries both forms, each in its own part, and place() draws the one the plan names', () => {
    for (const w of [346, 300, 250]) {
      const { ratio, scene, legend } = key(w), placed = scene.nodes.map((n) => n.key).filter((k) => /^(swatch|legend|label):/.test(k));
      expect(ratio.nodes.filter((n) => n.part === 'legend').map((n) => n.key)).toEqual(['swatch:Desktop', 'legend:Desktop', 'swatch:Mobile', 'legend:Mobile', 'swatch:Tablet', 'legend:Tablet']);
      expect(ratio.nodes.filter((n) => n.part === 'labels').map((n) => [n.key, n.paint])).toEqual([['label:Desktop', 'series.1'], ['label:Mobile', 'series.2'], ['label:Tablet', 'series.3']]);
      expect(placed.length, String(w)).toBe(legend === 'full' ? 6 : legend === 'labels' ? 3 : 0);
    }
  });
  it('the legend sits under the plot and wraps, and the labels take a gutter beside it', () => {
    const full = key(346).scene, at = (scene: typeof full, k: string) => scene.nodes.find((n) => n.key === k) as { x: number; y: number; ty?: number; text: string };
    expect(full.height).toBe(184 + 26);
    // A swatch and its gap are 18 px, a name 6.6 px a character, and 14 px part one entry from the next.
    const names = ['legend:Desktop', 'legend:Mobile', 'legend:Tablet'].map((k) => at(full, k));
    expect(names.map((n) => n.y + n.ty!)).toEqual([200, 200, 200]);
    [18, 18 + 7 * 6.6 + 14 + 18, 18 + 7 * 6.6 + 14 + 18 + 6 * 6.6 + 14 + 18].forEach((x, i) => expect(names[i]!.x).toBeCloseTo(x, 9));
    expect(key(100 + 320, null, { ...series, query: { ...series.query, by: ['date.day', 'channel'] }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'channel' } }] }).scene.height).toBe(184 + 46);
    // "Desktop" is the longest label: 7 characters and 6 px of gap. A label is level with the last point of its line.
    const labelled = key(300), line = labelled.scene.nodes.find((n) => n.key === 'primary:line:Desktop:partial') as { d: string }, [lx, ly] = line.d.split('L').pop()!.split(',').map(Number);
    expect(at(labelled.scene, 'label:Desktop')).toMatchObject({ x: 300 - 6 - 7 * 6.6, text: 'Desktop', anchor: 'start', baseline: 'middle' });
    expect(lx).toBeCloseTo(300 - 6 - 7 * 6.6 - 6 - 2, 2);
    expect(at(labelled.scene, 'label:Desktop').y).toBeCloseTo(ly!, 2);          // a path is written to three places
  });
});

describe('stacking, and bars side by side', () => {
  const plot = (spec: Spec, w = 700, result = runQuery(spec.query)) => { const container = makeContainer(w), ratio = buildScene(resolve(spec, result, container, catalog), spec.query, result, catalog); return { ratio, scene: place(ratio, container), result }; };
  const rects = (ratio: { nodes: any[] }, row: string) => ratio.nodes.filter((n) => n.kind === 'rect' && n.part === 'plot' && n.row === row) as { key: string; x: number; w: number; v: number; v0?: number; series: string }[];
  const stacked = specs.stacked!, as = (stack: string | undefined, spec = stacked): Spec => ({ ...spec, layers: [{ ...spec.layers![0]!, stack } as any] });
  it('stack: "zero" starts each series where the one under it ends, in the series\' order', () => {
    const { ratio, result } = plot(stacked), [desktop, mobile, tablet] = rects(ratio, '2026-09-08');
    expect([desktop!.series, mobile!.series, tablet!.series]).toEqual(['Desktop', 'Mobile', 'Tablet']);
    expect(desktop!.v0).toBe(undefined);
    expect([mobile!.v0, tablet!.v0]).toEqual([desktop!.v, mobile!.v]);
    expect(new Set([desktop!.x, mobile!.x, tablet!.x]).size).toBe(1);
    // The top of a stack is its day's total on the y scale, which runs to 600 here.
    expect(ratio.nodes.filter((n) => n.part === 'y-axis').map((n) => (n as { text: string }).text)).toEqual(['0', '200', '400', '600']);
    expect(tablet!.v).toBeCloseTo((result.totalsBy!['date.day']![0]!.visitors as number) / 600, 12);
  });
  it('stack: "normalize" makes each a share of the engine\'s total for its x, so a limit leaves the stack short', () => {
    const shares = as('normalize'), { ratio } = plot(shares);
    expect(ratio.nodes.filter((n) => n.part === 'y-axis').map((n) => (n as { text: string }).text)).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
    for (const row of ratio.rows!) expect(rects(ratio, row).pop()!.v, row).toBeCloseTo(1, 12);
    const top2 = plot({ ...shares, query: { ...shares.query, limit: 2 } }), all = top2.result.totalsBy!['date.day']![0]!.visitors as number, [d, m] = top2.result.rows;
    expect(rects(top2.ratio, '2026-09-08').map((n) => n.series)).toEqual(['Desktop', 'Mobile']);
    expect(rects(top2.ratio, '2026-09-08').pop()!.v).toBeCloseTo(((d!.visitors as number) + (m!.visitors as number)) / all, 12);
    expect(rects(top2.ratio, '2026-09-08').pop()!.v).toBeLessThan(0.95);
    // The same holds with no guides to round the scale: shares run to the whole.
    expect(rects(plot({ ...shares, query: { ...shares.query, limit: 2 } }, 250).ratio, '2026-09-08').pop()!.v).toBeLessThan(0.95);
  });
  it('stack: "center" sets each stack half on either side of zero', () => {
    const { ratio } = plot(as('center')), zero = (ratio.nodes.find((n) => n.key === 'ytick:0') as { t: number }).t;
    expect(view(as('center')), JSON.stringify(view.errors)).toBe(true);
    expect(zero).toBe(0.5);
    for (const row of ratio.rows!) {
      const [desktop, mobile, tablet] = rects(ratio, row);
      expect((desktop!.v0! + tablet!.v) / 2, row).toBeCloseTo(zero, 12);
      expect(desktop!.v0! < zero && tablet!.v > zero, row).toBe(true);
      expect([mobile!.v0, tablet!.v0], row).toEqual([desktop!.v, mobile!.v]);
    }
  });
  it('a bar with color and no stack sits beside its neighbours, and they fill the room one bar had', () => {
    const grouped = plot(specs.grouped!), [a, b, c] = rects(grouped.ratio, 'Search'), one = rects(plot(as('zero', specs.grouped!)).ratio, 'Search')[0]!;
    expect([a!.key, b!.key, c!.key]).toEqual(['primary:bar:Search:Desktop', 'primary:bar:Search:Mobile', 'primary:bar:Search:Tablet']);
    expect([a!.v0, b!.v0, c!.v0]).toEqual([undefined, undefined, undefined]);
    expect(a!.x).toBe(one.x);
    expect(b!.x).toBeCloseTo(a!.x + a!.w, 12);
    expect(a!.w * 3).toBeCloseTo(one.w, 12);
    // Lines and areas with no stack overlay: every series starts at the baseline.
    const overlay = plot(as(undefined, specs.area!)).ratio.nodes.filter((n) => n.kind === 'path');
    expect(overlay.every((n) => n.points.every((p) => p.v0 == null) && n.opacity === 0.14)).toBe(true);
  });
  it('stacked areas share their edges, are the mark itself and not a tint, and are labelled half way up', () => {
    const { ratio } = plot(specs.area!), areas = ratio.nodes.filter((n) => n.kind === 'path');
    expect(areas.map((n) => n.key)).toEqual(['primary:area:Search', 'primary:area:Direct', 'primary:area:Social', 'primary:area:AI assistants', 'primary:area:Email', 'primary:area:Other']);
    expect(areas[1]!.points.map((p) => p.v0)).toEqual(areas[0]!.points.map((p) => p.v));
    expect(areas.map((n) => n.opacity)).toEqual(Array(6).fill(undefined));
    const end = areas[1]!.points[areas[1]!.points.length - 1]!;
    expect((ratio.nodes.find((n) => n.key === 'label:Direct') as { t: number }).t).toBe((end.v0! + end.v) / 2);
  });
  it('place() reads v0: a stacked bar starts where the one under it ends, in pixels too', () => {
    const { scene } = plot(stacked, 346), at = (k: string) => scene.nodes.find((n) => n.key === k) as { x: number; y: number; w: number; h: number };
    const desktop = at('primary:bar:2026-09-08:Desktop'), mobile = at('primary:bar:2026-09-08:Mobile');
    expect(desktop.y + desktop.h).toBeCloseTo(162, 9);
    expect(mobile.y + mobile.h).toBeCloseTo(desktop.y, 9);
    expect(mobile.x).toBeCloseTo(desktop.x, 9);
    const grouped = plot(specs.grouped!, 346).scene.nodes.filter((n) => n.key.startsWith('primary:bar:Search')) as { x: number; w: number }[];
    expect(grouped[1]!.x).toBeCloseTo(grouped[0]!.x + grouped[0]!.w, 9);
  });
  it('errors name the fix: a stack with nothing to stack, and shares with no total to divide by', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['date.day'] }, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors' }, stack: 'zero' }] }))
      .toBe('Layer 1 has "stack" and no dimension on color, so there is nothing to stack. Encode the query\'s second dimension on color, or remove "stack".');
    const shares = as('normalize'), result = { ...runQuery(shares.query), totalsBy: undefined };
    expect(() => resolve(shares, result, makeContainer(346), catalog)).toThrow('stack: "normalize" divides by the engine\'s total for each "date.day", and this result has no totalsBy. Return it from the query layer, or use stack: "zero".');
    expect(view({ ...stacked, layers: [{ ...stacked.layers![0]!, stack: 'pile' }] })).toBe(false);
  });
});

describe('a signed domain', () => {
  const diverging = specs.diverging!, at = (w: number) => run(diverging, w);
  it('the fixture has days below zero', () => {
    const { rows, totals } = runQuery(diverging.query), below = rows.filter((r) => (r.net_subscribers as number) < 0);
    expect([rows.length, below.length, totals.net_subscribers]).toEqual([28, 8, 180]);
    expect(() => runQuery({ metrics: ['net_subscribers'], by: ['page'] })).toThrow('The fixture has "net_subscribers" by day, channel or device, and not page by page. Query it by one of those.');
  });
  it('the scale covers what is below zero, and the axis line sits at zero', () => {
    const { ratio, scene, result } = at(346), ticks = ratio.nodes.filter((n) => n.part === 'y-axis') as { text: string; t: number }[];
    expect(ticks.map((n) => n.text)).toEqual(['-20', '-10', '0', '10', '20']);
    const zero = ticks.find((n) => n.text === '0')!.t, axis = ratio.nodes.filter((n) => n.paint === 'axis');
    expect(zero).toBe(0.5);
    expect(axis.map((n) => [n.key, (n as { t: number }).t])).toEqual([['grid:0', zero]]);
    // Every bar starts at zero. One for a day below it hangs down from there.
    const bars = ratio.nodes.filter((n) => n.kind === 'rect') as { row: string; v: number; v0: number }[];
    expect(bars.every((n) => n.v0 === zero)).toBe(true);
    for (const r of result.rows) expect(bars.find((n) => n.row === r['date.day'])!.v < zero, String(r['date.day'])).toBe((r.net_subscribers as number) < 0);
    // In pixels the zero line is half way up a plot that runs from 162 to 10, and bars meet it from either side.
    const y0 = 162 - zero * 152, placed = scene.nodes.filter((n) => n.kind === 'rect') as { key: string; y: number; h: number }[];
    expect((scene.nodes.find((n) => n.key === 'grid:0') as { y1: number }).y1).toBeCloseTo(y0, 9);
    for (const r of result.rows) {
      const px = placed.find((n) => n.key === 'primary:bar:' + r['date.day'])!, n = r.net_subscribers as number;
      expect(n < 0 ? px.y : px.y + px.h, px.key).toBeCloseTo(y0, 9);
      expect(px.h, px.key).toBeCloseTo(Math.abs(n) / 40 * 152, 9);
    }
  });
  it('an area fills to zero, and a scale of nothing but values below zero ends there', () => {
    const area = run({ ...diverging, layers: [{ mark: 'area', encode: diverging.layers![0]!.encode }] }, 346).ratio.nodes.find((n) => n.kind === 'path')!;
    expect(new Set(area.points.map((p) => p.v0))).toEqual(new Set([0.5]));
    const result = runQuery(diverging.query), down = { ...result, rows: result.rows.map((r) => ({ ...r, net_subscribers: -Math.abs(r.net_subscribers as number) - 1 })) };
    const ratio = buildScene(resolve(diverging, down, makeContainer(346), catalog), diverging.query, down, catalog);
    expect((ratio.nodes.filter((n) => n.part === 'y-axis') as { text: string }[]).map((n) => n.text).pop()).toBe('0');
    expect((ratio.nodes.filter((n) => n.kind === 'rect') as { v0: number }[]).every((n) => n.v0 === 1)).toBe(true);
  });
});
