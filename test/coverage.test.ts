import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, expand, makeContainer, place, resolve, type PainterName, type Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';

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

// The plots and the rows among them. Another layout has a suite of its own: test/radial.test.ts, test/cell.test.ts.
// Ranges and ticks have one too: test/ranges.test.ts.
const ranges = ['box', 'errors', 'waterfall', 'candlestick', 'fan', 'dumbbell', 'bullet', 'cleveland', 'lollipop', 'tornado', 'fans'];
const specs = Object.fromEntries(Object.entries(moreSamples).map(([k, s]) => [k, s.spec] as const).filter(([k, s]) => !ranges.includes(k) && ['cartesian', 'rows'].includes(run(s, 700).plan.layout)));
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
      // A plot of points has no bare form: under the room its axes need it is the number alone (test/points.test.ts).
      const points = ['scatter', 'bubble', 'quadrant', 'embedding', 'connected'].includes(name);
      // Rows of text with no column of values ask for their label's 90 px and nothing measured, so they are still rows at 120.
      const plain = name === 'stem';
      for (const sc of scenarios) {
        // 10 px is narrower than any number, "0" included.
        const layouts = [346, 250, 120, 10].map((w) => run(spec, w, null, sc).plan.layout), marks = run(spec, 700).plan.layout;
        expect(layouts, sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'none', 'prose'] : [marks, points ? 'none' : marks, plain ? marks : 'none', 'prose']);
        // What rows give up first is their own, and is held in test/coverage-rows.test.ts.
        // A plot that compares says first what it has no prior period for, where it has none: the difference sample is the one such plot here.
        if (marks === 'cartesian' && !points) expect(run(spec, 250, null, sc).plan.dropped.filter((d) => !d.includes('(no prior data)'))[0], sc).toBe(sc === 'empty' ? undefined : 'axes and grid (added the number to make up for them)');
        // With room for everything, all that is missing is what there is no prior period to say.
        expect(run(spec, 700, null, sc).plan.dropped, sc).toEqual(sc === 'no-prior' && spec.query.compare ? [expect.stringContaining('(no prior data)')] : []);
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
    expect(['share:Search', 'share:Direct', 'share:Social', 'legend-top', 'sub'].map(text)).toEqual(['41%', '28%', '14%', 'Search 41%', 'Search 41%']);
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
    expect(err(bar({ x: 'date.day', y: 'visitors' }, ['date.day', 'channel']))).toBe('The query is by "channel", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
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

describe('detail splits a plot into series and paints none apart', () => {
  const q = { metrics: ['visitors'], by: ['date.day', 'country'], range: '28d' };
  const by = (mark: string, more: Record<string, unknown> = {}, encode: Record<string, string | number> = {}): Spec => ({ spec: 'view/0', query: q, layers: [{ mark, encode: { x: 'date.day', y: 'visitors', detail: 'country', ...encode }, ...more }] });
  const marks = (spec: Spec, result = runQuery(spec.query)) => buildScene(resolve(spec, result, makeContainer(700), catalog), spec.query, result, catalog);
  const countries = ['US', 'IN', 'GB', 'DE', 'BR', 'CA', 'FR', 'AU', 'JP', 'ES', 'MX', 'ID', 'NG', 'ZA', 'SE'];

  it('a path per value for a line, keyed by the value, all in the layer\'s own paint and drawn light', () => {
    const scene = marks(by('line')), paths = scene.nodes.filter((n) => n.kind === 'path');
    expect(scene).toMatchObject({ layout: 'cartesian', detail: countries, scale: 'point' });
    expect(scene.series).toBeUndefined();
    expect(paths.map((n) => n.key)).toEqual(countries.flatMap((c) => ['primary:line:' + c, 'primary:line:' + c + ':partial']));
    expect(paths.map((n) => n.series)).toEqual(countries.flatMap((c) => [c, c]));
    expect(new Set(paths.map((n) => n.paint + ' ' + n.opacity))).toEqual(new Set(['series.1 0.5']));
    expect(new Set(marks(by('line', { paint: 'series.3' })).nodes.filter((n) => n.kind === 'path').map((n) => n.paint))).toEqual(new Set(['series.3']));
  });
  it('more than six is no error: the limit is the count of colours, and none is spent', () => {
    expect(marks(by('line')).detail!.length).toBe(15);
    expect(err({ ...by('line'), layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'country' } }] })).toBe('Splitting by "country" makes 15 series, and there are 6 series colours. Add "limit": 6 to the query, or less.');
  });
  it('has no legend and no labels, in the scene, the plan or what the plan gives up', () => {
    for (const w of [700, 346, 300, 250]) {
      const { plan, ratio } = run(by('line'), w);
      expect(ratio.nodes.filter((n) => n.part === 'legend' || n.part === 'labels'), String(w)).toEqual([]);
      expect(ratio.parts.filter((p) => p === 'legend' || p === 'labels'), String(w)).toEqual([]);
      expect(plan.guides.legend, String(w)).toBeUndefined();
      expect(plan.dropped.filter((d) => d.includes('legend')), String(w)).toEqual([]);
    }
  });
  it('a rect per pair for a bar, side by side in one paint, and a tint per value for an area', () => {
    const rects = marks(by('bar')).nodes.filter((n): n is Extract<typeof n, { kind: 'rect' }> => n.kind === 'rect' && n.part === 'plot');
    expect(rects.length).toBe(28 * 15);
    expect(rects.slice(0, 2).map((n) => [n.key, n.series, n.row, n.paint])).toEqual([['primary:bar:2026-09-08:US', 'US', '2026-09-08', 'series.1'], ['primary:bar:2026-09-09:US', 'US', '2026-09-09', 'series.1']]);
    const day = rects.filter((n) => n.row === '2026-09-08').sort((a, b) => a.x! - b.x!);
    expect(day.map((n) => n.series)).toEqual(countries);
    day.slice(1).forEach((n, i) => expect(n.x).toBeCloseTo(day[i]!.x! + day[i]!.w!, 9));
    const areas = marks(by('area')).nodes.filter((n) => n.kind === 'path');
    expect(areas.map((n) => [n.key, n.paint, n.tone, n.opacity])).toEqual(countries.map((c) => ['primary:area:' + c, 'series.1', 'soft', 0.14]));
  });
  it('place() draws every series, with keys of their own and no legend', () => {
    const { scene, ratio } = run(by('line'), 346), keys = scene.nodes.map((n) => n.key);
    expect(countries.every((c) => keys.includes('primary:line:' + c))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => /^(swatch|legend|label):/.test(k))).toEqual([]);
    expect(scene.height).toBe(run({ ...by('line'), query: { ...q, limit: 3 } }, 346).scene.height);
    expect(ratio.detail).toEqual(countries);
  });
  it('a layer painted by color beside it brings the colours, the legend and the limit back', () => {
    const both: Spec = { ...by('line'), query: { ...q, by: ['date.day', 'device'] }, layers: [{ mark: 'area', encode: { x: 'date.day', y: 'visitors', detail: 'device' } }, { mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'device' } }] };
    const scene = marks(both), paths = scene.nodes.filter((n) => n.kind === 'path' && !n.key.includes(':partial'));
    expect(scene.series).toEqual(['Desktop', 'Mobile', 'Tablet']);
    expect(scene.detail).toBeUndefined();
    expect(paths.map((n) => [n.key, n.paint])).toEqual([['primary:area:Desktop', 'series.1'], ['primary:area:Mobile', 'series.1'], ['primary:area:Tablet', 'series.1'], ['primary:line:Desktop', 'series.1'], ['primary:line:Mobile', 'series.2'], ['primary:line:Tablet', 'series.3']]);
    expect(scene.nodes.filter((n) => n.part === 'legend').length).toBe(6);
  });
  it('color is as it was: its series are named in the scene, painted apart and drawn whole', () => {
    const { ratio } = run(moreSamples.series!.spec, 700), paths = ratio.nodes.filter((n) => n.kind === 'path' && !n.key.includes(':partial'));
    expect(ratio.series).toEqual(['Desktop', 'Mobile', 'Tablet']);
    expect('detail' in ratio).toBe(false);
    expect(paths.map((n) => [n.paint, n.opacity])).toEqual([['series.1', undefined], ['series.2', undefined], ['series.3', undefined]]);
  });
  it('the prose says who leads, and nothing of a colour or a legend', () => {
    expect(run(moreSamples.spaghetti!.spec, 700).plan.text).toBe('United States is the largest country at 32% of visitors in the last 28 days, and leads on all 28 days.');
  });
  it('the schema takes a dimension\'s name on detail, and no number', () => {
    expect(view(by('line')), JSON.stringify(view.errors)).toBe(true);
    expect(view(by('line', {}, { detail: 5 }))).toBe(false);
  });
  it('errors name the fix: what is not a dimension of the query, a layer split twice, a stack, and a layout that does not read it', () => {
    expect(err(by('line', {}, { detail: 'visitors' }))).toBe('Layer 1 encodes "visitors" on detail, and detail splits a layer by one of the query\'s dimensions: date.day, country. Encode one of those, or remove "detail".');
    expect(err(by('line', {}, { detail: 'device' }))).toBe('Layer 1 encodes "device" on detail, and detail splits a layer by one of the query\'s dimensions: date.day, country. Encode one of those, or remove "detail".');
    expect(err(by('line', {}, { detail: 5 }))).toBe('Layer 1 encodes 5 on detail, and detail splits a layer by one of the query\'s dimensions: date.day, country. Encode one of those, or remove "detail".');
    expect(err({ query: { metrics: ['visitors'] }, layers: [{ mark: 'line', encode: { y: 'visitors', detail: 'country' } }] })).toBe('Layer 1 encodes "country" on detail, and detail splits a layer by one of the query\'s dimensions, of which it has none. Add one to query.by, or remove "detail".');
    const twice = 'and a layer is split into series once: painted apart with a legend by color, or all in its own paint by detail. Remove one of the two.';
    expect(err(by('line', {}, { color: 'country' }))).toBe('Layer 1 encodes "country" on color and "country" on detail, ' + twice);
    expect(err(by('line', {}, { color: 'country', detail: 'date.day' }))).toBe('Layer 1 encodes "country" on color and "date.day" on detail, ' + twice);
    expect(err(by('area', { stack: 'zero' }))).toBe('Layer 1 has "stack" and is split by detail, which paints every series alike, so a stack of them could not be read. Encode "country" on color in place of detail, or remove "stack".');
    const rows: Spec = { query: { metrics: ['visitors'], by: ['channel', 'device'] }, layers: [{ mark: 'bar', encode: { y: 'channel', x: 'visitors', detail: 'device' } }] };
    expect(err(rows)).toBe('Layer 1 encodes "device" on detail, and these layers are laid out as "rows", which does not split a layer by detail. It is read in: cartesian. Put a dimension on x and a metric on y, or remove "detail".');
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
    expect(at(labelled.scene, 'label:Desktop').y).toBeCloseTo(ly!, 2);
    // Mobile ends close under Desktop, so its label is moved down to a line's height from it. Six labels keep that distance too.
    expect(at(labelled.scene, 'label:Mobile').y - at(labelled.scene, 'label:Desktop').y).toBeCloseTo(12, 9);
    const six = run(specs.area!, 300).scene.nodes.filter((n) => n.key.startsWith('label:')).map((n) => (n as unknown as { y: number }).y).sort((a, b) => a - b);
    expect(six.length).toBe(6);
    six.forEach((yy, i) => { if (i) expect(yy - six[i - 1]!).toBeGreaterThanOrEqual(12 - 1e-9); expect(yy).toBeLessThanOrEqual(162); });          // a path is written to three places
  });
});

describe('stacking, and bars side by side', () => {
  const plot = (spec: Spec, w = 700, result = runQuery(spec.query)) => { const container = makeContainer(w), ratio = buildScene(resolve(spec, result, container, catalog), spec.query, result, catalog); return { ratio, scene: place(ratio, container), result }; };
  const rects = (ratio: { nodes: any[] }, row: string) => ratio.nodes.filter((n) => n.kind === 'rect' && n.part === 'plot' && n.row === row) as { key: string; x: number; w: number; v: number; v0?: number; series: string }[];
  // The samples are presets. These are their layers, with the stack swapped.
  const stacked = expand(specs.stacked!), as = (stack: string | undefined, spec = stacked): Spec => { const laid = expand(spec); return { ...laid, layers: [{ ...laid.layers![0]!, stack } as any] }; };
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
  it('stack: "center" sets each stack half on either side of the middle of the plot, and has no value axis', () => {
    const { ratio } = plot(as('center')), zero = 0.5;
    expect(view(as('center')), JSON.stringify(view.errors)).toBe(true);
    // A scale that counts away from the middle says nothing of how thick a band is: no tick, no grid, no gutter for them.
    expect(ratio.nodes.filter((n) => n.part === 'y-axis' || n.key.startsWith('grid:'))).toEqual([]);
    expect(ratio.parts).toEqual(['plot', 'x-axis', 'legend']);
    for (const row of ratio.rows!) {
      const [desktop, mobile, tablet] = rects(ratio, row);
      // The tallest stack runs from the foot of the plot to its top: with no axis the scale is not rounded.
      expect(((desktop!.v0 ?? 0) + tablet!.v) / 2, row).toBeCloseTo(zero, 12);
      expect((desktop!.v0 ?? 0) < zero && tablet!.v > zero, row).toBe(true);
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

describe('a scale per unit', () => {
  const dual = specs.dual!, ticks = (ratio: { nodes: any[] }, part: string) => ratio.nodes.filter((n) => n.part === part).map((n) => n.text);
  it('layers whose metrics differ in unit get a y scale each, and a second axis on the far side', () => {
    const { ratio, plan, result } = run(dual, 346);
    expect(plan.guides).toEqual({ x: true, y: true, y2: true, grid: true });
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'y-axis-2', 'x-axis']);
    expect(ticks(ratio, 'y-axis')).toEqual(['0', '200', '400', '600']);
    expect(ticks(ratio, 'y-axis-2')).toEqual(['$0', '$1k', '$2k', '$3k', '$4k']);
    expect(ratio.nodes.filter((n) => n.part === 'y-axis-2').map((n) => [n.key, (n as { anchor: string }).anchor])[1]).toEqual(['ytick:usd:1000', 'start']);
    // Each mark is on its own scale. The grid is the first scale's.
    const first = result.rows[0]!, bar = ratio.nodes.find((n) => n.key === 'primary:bar:' + first['date.day']) as { v: number }, line = ratio.nodes.find((n) => n.key === 'primary:line') as { points: { v: number }[] };
    expect(bar.v).toBeCloseTo((first.visitors as number) / 600, 12);
    expect(line.points[0]!.v).toBeCloseTo((first.revenue as number) / 4000, 12);
    expect(ratio.nodes.filter((n) => n.key.startsWith('grid:')).map((n) => n.key)).toEqual(['grid:0', 'grid:200', 'grid:400', 'grid:600']);
  });
  it('two metrics of one unit share a scale, and a constant is on the first', () => {
    const counts: Spec = { query: { metrics: ['visitors', 'pageviews'], by: ['date.day'] }, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'line', encode: { x: 'date.day', y: 'pageviews' } }, { mark: 'rule', encode: { y: 1000 } }] };
    const { ratio, plan } = run(counts, 346);
    expect(plan.guides.y2).toBe(undefined);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'x-axis']);
    expect(ticks(ratio, 'y-axis')).toEqual(['0', '500', '1k', '1.5k']);
    expect((ratio.nodes.find((n) => n.key === 'reference:rule') as { t: number }).t).toBeCloseTo(1000 / 1500, 12);
  });
  it('the second axis is given up before the first, and the marks keep their scale', () => {
    const wide = run(dual, 346), narrow = run(dual, 300), marks = (r: typeof wide) => r.ratio.nodes.filter((n) => n.layer === 'data' && n.part === 'plot');
    expect(narrow.plan).toMatchObject({ guides: { x: true, y: true, grid: true }, dropped: ['the second y axis', 'the middle date label'] });
    expect(narrow.ratio.parts).toEqual(['y-axis', 'plot', 'x-axis']);
    expect(marks(narrow)).toEqual(marks(wide));
    expect(run({ ...dual, keep: ['guides'] }, 300).plan.guides.y2).toBe(true);
    expect(run(dual, 250).plan.guides).toEqual({ x: false, y: false, grid: false });
  });
  it('place() gives the second axis a gutter of its own', () => {
    const { scene } = run(dual, 346), tick = scene.nodes.find((n) => n.key === 'ytick:usd:1000') as { x: number; y: number }, last = scene.nodes.filter((n) => n.key.startsWith('primary:bar:')).pop() as { x: number; w: number };
    expect(tick).toMatchObject({ x: 346 - 30, y: 162 - 152 / 4 });
    expect(last.x + last.w).toBeLessThan(346 - 36);
  });
  it('shares are a unit of their own, and a third unit is an error that names the fix', () => {
    const mixed: Spec = { query: { metrics: ['visitors'], by: ['date.day', 'device'] }, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors', color: 'device' }, stack: 'normalize' }, { mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'device' } }] };
    const { ratio } = run(mixed, 700);
    expect([ticks(ratio, 'y-axis').pop(), ticks(ratio, 'y-axis-2').pop()]).toEqual(['100%', '300']);
    expect(ratio.nodes.find((n) => n.part === 'y-axis-2')!.key).toBe('ytick:count:0');
    expect(err({ query: { metrics: ['visitors', 'revenue'], by: ['date.day', 'device'] }, layers: [...mixed.layers!, { mark: 'line', encode: { x: 'date.day', y: 'revenue', color: 'device' } }] }))
      .toBe('These layers measure in 3 units (share, count, usd), and a plot has a y axis on each side at most. Remove a layer, or draw them as separate views.');
  });
});

describe('tldr prose for two dimensions and for two metrics', () => {
  const text = (name: string, sc?: (typeof scenarios)[number]) => run(specs[name]!, 346, null, sc).plan.text;
  it('says who leads each dimension, as a share of the engine\'s total, and over time on how many days', () => {
    expect(text('series')).toBe('Desktop is the largest device at 52% of visitors in the last 28 days, and leads on 26 of 28 days.');
    expect(text('stacked')).toBe(text('series'));
    expect(text('area')).toBe('Search is the largest channel at 42% of page views in the last 28 days, and leads on all 28 days.');
    expect(text('grouped')).toBe('Search is the largest channel at 41% of visitors, and Desktop the largest device at 50%.');
    expect(text('grouped', 'empty')).toBe('Visitors: nothing recorded in the last 28 days.');
  });
  it('says each metric of two, the first with the range', () => {
    expect(text('dual')).toBe('Visitors: 10.5k in the last 28 days. This is a sum of daily counts, not a unique count. Revenue: $63.5k.');
    expect(run({ ...specs.dual!, query: { ...specs.dual!.query, compare: 'previous' } }, 346).plan.text)
      .toBe('Visitors: 10.5k in the last 28 days, up 12% on the previous period. This is a sum of daily counts, not a unique count. Revenue: $63.5k, up 8.1% on the previous period.');
    expect(text('diverging')).toBe('Net subscribers: 180 in the last 28 days.');
  });
  it('the note under the number names the leader the engine names, not the first pair', () => {
    const note = (spec: Spec) => (run(spec, 346).ratio.nodes.find((n) => n.key === 'sub') as { text: string }).text;
    expect(note(specs.grouped!)).toBe('Top: Search');
    expect(note({ ...specs.grouped!, layers: [{ ...expand(specs.grouped!).layers![0]!, stack: 'normalize' }] })).toBe('Search 41%');
    expect(note(specs.stacked!)).toBe('Sum of daily counts');
  });
});

describe('presets with a second dimension', () => {
  it('fill $split from the query\'s second dimension', () => {
    const q = { metrics: ['visitors'], by: ['date.day', 'device'] }, encode = { x: 'date.day', y: 'visitors', color: 'device' };
    expect(expand({ use: 'grouped-bar', query: q }).layers).toEqual([{ mark: 'bar', encode }]);
    expect(expand({ use: 'stacked-bar', query: q }).layers).toEqual([{ mark: 'bar', encode, stack: 'zero' }]);
    expect(expand({ use: 'stacked-area', query: q }).layers).toEqual([{ mark: 'area', encode, stack: 'zero' }]);
    expect(run(specs.stacked!, 346).plan.preset).toBe('stacked-bar');
  });
  it('errors name the fix: a split preset with one dimension, and a one-dimension preset with two', () => {
    expect(err({ use: 'stacked-bar', query: { metrics: ['visitors'], by: ['date.day'] } })).toBe('The "stacked-bar" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
    expect(err({ use: 'line', query: { metrics: ['visitors'], by: ['date.day', 'device'] } })).toBe('The query is by "device", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
  });
});
