import { describe, expect, it } from 'vitest';
import { FIT_RULES, buildScene, expand, resolve, type Catalog, type Result, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';
import { err, ofUnbounded, run, shown, validView as view } from './helpers.ts';

// What the grammar draws beyond the first six samples (docs/chart-coverage-plan.md), held to its own sweep, facts and
// golden scenes.
// The engine refuses some queries itself. `q` is one it answers, for an error that is resolve()'s to make.

// The plots and the rows among them. Another layout has a suite of its own: test/radial.test.ts, test/cell.test.ts.
// Ranges and ticks have one too: test/ranges.test.ts.
// So has the unit mark: test/unit.test.ts.
// And so have the samples of step 4 of the Uncommon plan: test/uncommon-rows.test.ts.
const ranges = ['box', 'errors', 'waterfall', 'candlestick', 'fan', 'dumbbell', 'bullet', 'cleveland', 'lollipop', 'tornado', 'fans', 'pyramid', 'likert', 'strip', 'marimekko', 'rug', 'ohlc', 'qq'], units = ['units', 'wilkinson', 'isotype'];
const specs = Object.fromEntries(Object.entries(moreSamples).map(([k, s]) => [k, s.spec] as const).filter(([k, s]) => !ranges.includes(k) && !units.includes(k) && ['cartesian', 'rows'].includes(run(s, 700).plan.layout)));
const heights = [null, 300, 160, 100, 60, 40];
const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];

describe('the sweep, for the samples beyond the first six', () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, ratios from 0 to 1, and at every room parts the scene has', () => {
      for (const sc of scenarios) for (const h of heights) for (const w of widths) {
        const at = [name, sc, w, h].join(' ');
        const { ratio, fit } = run(spec, w, h, sc);
        const all = ratio.nodes.map((n) => n.key);
        expect(new Set(all).size, 'duplicate keys: ' + at).toBe(all.length);
        expect(JSON.stringify(ratio, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'v', 'v0', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
        expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), 'parts with nothing in them: ' + at).toEqual([]);
      }
    });
    it(name + ': resolves in every data state, and steps down to the number', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      // A plot of points has no bare form: under the room its axes need it is the number alone (test/points.test.ts).
      const points = ['scatter', 'bubble', 'quadrant', 'embedding', 'connected'].includes(name);
      const marks = run(spec, 700).plan.layout;
      for (const sc of scenarios) {
        expect(run(spec, 346, null, sc).plan.layout, sc).toBe(sc === 'empty' ? 'notice' : marks);
        // Under the room its axes need a plot is bare beside the number, and under the room its marks need the number alone.
        // Rows ask for their label's 90 px, and 160 where their track stands beside it. What their values need beside it is measured, and is no rule's to say.
        const parts = [250, 120, 80].map((w) => run(spec, w, null, sc).fit.parts), whole = run(spec, 700, null, sc).ratio;
        expect(parts, sc).toEqual(sc === 'empty' ? [['notice'], ['number'], ['number']]
          : marks === 'cartesian' ? [points ? ['number'] : ['number', 'plot'], ['number'], ['number']] : [whole.parts, whole.track === 'beside' ? ['number'] : whole.parts, ['number']]);
        if (marks === 'cartesian' && sc !== 'empty') expect(run(spec, 250, null, sc).fit.set.arrange, sc).toBe('side');
        // With room for everything no rule holds, and all that is missing is what there is no prior period to say.
        expect(run(spec, 700, null, sc).fit.held, sc).toEqual([]);
        expect(run(spec, 700, null, sc).plan.dropped, sc).toEqual(sc === 'no-prior' && spec.query.compare ? [expect.stringContaining('(no prior data)')] : []);
      }
    });
  }
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [234, null], [346, 100]];
  for (const name of Object.keys(specs)) {
    it(name, () => expect(run(specs[name]!, 346).ratio).toMatchSnapshot());
    it(name + ', at each room', () => expect(sizes.map(([w, h]) => [w, h, shown(run(specs[name]!, w, h))])).toMatchSnapshot());
  }
});

describe('shares are of the engine\'s total', () => {
  const mix = samples.mix!.spec, top3: Spec = { ...mix, query: { ...mix.query, limit: 3 } };
  it('with a limit, the band, its legend, the note and the prose say a share of everything, not of the rows shown', () => {
    const { ratio, plan } = run(top3, 346), text = (key: string) => (ratio.nodes.find((n) => n.key === key) as { text: string }).text;
    const band = ratio.nodes.filter((n) => n.part === 'band').map((n) => (n as { w: number }).w);
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
    expect(err(bar({ x: 'date.day', y: 'visitors' }, ['date.day', 'channel', 'device']), runQuery({ metrics: ['visitors'] }))).toBe('A view is by one dimension or by two different ones, and query.by has: date.day, channel, device. Remove all but two.');
    expect(err(bar({ x: 'date.day', y: 'visitors', color: 'device' }, ['date.day', 'channel']))).toBe('Layer 1 encodes "device" on color, which the query does not return. It returns: date.day, channel, visitors.');
    expect(err(bar({ x: 'date.day', y: 'visitors' }, ['date.day', 'channel']))).toBe('The query is by "channel", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
    expect(() => runQuery({ metrics: ['visitors'], by: ['channel', 'channel'] })).toThrow('A query is by one dimension or by two different ones. This one is by: channel, channel.');
  });
});

describe('color splits a plot into series', () => {
  const byDevice: Spec = { spec: 'view/0', query: { metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'device' } }] };
  const marks = (spec: Spec, result = runQuery(spec.query)) => buildScene(resolve(spec, result, catalog), spec.query, result, catalog);
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
  const marks = (spec: Spec, result = runQuery(spec.query)) => buildScene(resolve(spec, result, catalog), spec.query, result, catalog);
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
  it('has no legend and no labels, in the scene, the plan or what a rule takes or puts in place', () => {
    const key = (p: string) => p === 'legend' || p === 'labels';
    for (const w of [700, 346, 300, 250]) {
      const { plan, ratio, fit } = run(by('line'), w);
      expect(ratio.nodes.filter((n) => key(n.part)), String(w)).toEqual([]);
      expect(ratio.parts.concat(fit.parts as typeof ratio.parts).filter(key), String(w)).toEqual([]);
      expect(plan.guides.legend, String(w)).toBeUndefined();
      expect(fit.held.flatMap((h) => h.hid.concat(h.showed)).filter(key), String(w)).toEqual([]);
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
  it('the scene has every series, with keys of their own and no legend', () => {
    const { ratio } = run(by('line'), 346), keys = ratio.nodes.map((n) => n.key);
    expect(countries.every((c) => keys.includes('primary:line:' + c))).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k) => /^(swatch|legend|label):/.test(k))).toEqual([]);
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
    // Rows read detail for a dot or a tick (test/uncommon-rows.test.ts). A bar there would lie one over another.
    expect(err(rows)).toBe('Layer 1 is a "bar" in rows with "device" on detail, which would lay one over another in each row, all in one paint. Use "dot" or "tick" for a mark at each value, or encode "device" on color and give the bar "stack", or remove "detail".');
    const grid: Spec = { query: { metrics: ['visitors'], by: ['weekday', 'hour'] }, layers: [{ mark: 'cell', encode: { x: 'hour', y: 'weekday', color: 'visitors', detail: 'hour' } }] };
    expect(err(grid)).toBe('Layer 1 encodes "hour" on detail, and these layers are laid out as "matrix", which does not split a layer by detail. It is read in: cartesian, radial, rows. Put a dimension on x and a metric on y, or remove "detail".');
  });
});

describe('a split plot\'s legend', () => {
  const series = specs.series!;
  const key = (w: number, h: number | null = null, spec = series) => { const r = run(spec, w, h); return { ...shown(r), legend: r.plan.guides.legend, ratio: r.ratio }; };
  it('is every series at first, then a label at the end of each line, and with neither the marks are one colour', () => {
    const marks = (r: ReturnType<typeof key>) => r.ratio.nodes.filter((n) => n.layer === 'data' && n.part === 'plot');
    expect(key(346)).toMatchObject({ legend: true, parts: ['y-axis', 'plot', 'x-axis', 'legend'], rules: ['mid-tick'], hidden: ['x-tick.mid'] });
    expect(key(300)).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'labels'], rules: ['legend', 'mid-tick'] });
    expect(key(346, 170)).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'labels'] });
    expect(key(300).set.split).toBeUndefined();
    // Bare beside the number, nothing says which colour is which. They were three colours with no key once; now the
    // rule that takes the key says the marks are one, and the number is of them all. A scene takes no size, so its
    // marks keep their series' paints: each says its paint is a legend's, which is what the switch acts on.
    const bare = key(250);
    expect(bare).toMatchObject({ parts: ['number', 'plot'], set: { arrange: 'side', split: 'plain' }, rules: ['axes', 'legend', 'labels', 'mid-tick'] });
    expect([...new Set(marks(bare).map((n) => n.paint))]).toEqual(['series.1', 'series.2', 'series.3']);
    expect(marks(bare).every((n) => n.legend === true)).toBe(true);
    // Bars have no end to label, so their legend stays for as long as the axes do. It left at 320 px once, with
    // nothing in its place.
    const bars: Spec = { ...series, layers: [{ mark: 'bar', encode: series.layers![0]!.encode }] };
    expect(key(300, null, bars)).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'legend'], rules: ['mid-tick'] });
    expect(key(346, 170, bars).parts).toEqual(['y-axis', 'plot', 'x-axis', 'legend']);
    expect(key(250, null, bars)).toMatchObject({ parts: ['number', 'plot'], set: { split: 'plain' } });
    expect(marks(key(250, null, bars)).every((n) => n.legend === true)).toBe(true);
    expect(key(300, null, { ...series, keep: ['guides'] })).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'legend'], rules: ['kept:legend', 'mid-tick'] });
  });
  it('the scene carries both forms, each in its own part, and the fit names the one that shows', () => {
    for (const w of [346, 300, 250]) {
      const { ratio, parts } = key(w);
      expect(ratio.nodes.filter((n) => n.part === 'legend').map((n) => n.key)).toEqual(['swatch:Desktop', 'legend:Desktop', 'swatch:Mobile', 'legend:Mobile', 'swatch:Tablet', 'legend:Tablet']);
      expect(ratio.nodes.filter((n) => n.part === 'labels').map((n) => [n.key, n.paint])).toEqual([['label:Desktop', 'series.1'], ['label:Mobile', 'series.2'], ['label:Tablet', 'series.3']]);
      expect(parts.filter((p) => p === 'legend' || p === 'labels'), String(w)).toEqual(w === 346 ? ['legend'] : w === 300 ? ['labels'] : []);
    }
  });
  it('a label is level with the last point of its line', () => {
    const { ratio } = key(300), tail = ratio.nodes.find((n) => n.key === 'primary:line:Desktop:partial') as { points: { y: number }[] };
    expect(ratio.nodes.find((n) => n.key === 'label:Desktop')).toMatchObject({ y: tail.points.at(-1)!.y, text: 'Desktop', anchor: 'start', baseline: 'middle' });
  });
});

describe('stacking, and bars side by side', () => {
  const plot = (spec: Spec, result = runQuery(spec.query)) => ({ ratio: buildScene(resolve(spec, result, catalog), spec.query, result, catalog), result });
  const rects = (ratio: { nodes: any[] }, row: string) => ratio.nodes.filter((n) => n.kind === 'rect' && n.part === 'plot' && n.row === row) as { key: string; x: number; w: number; y: number; y2?: number; series: string }[];
  // The samples are presets. These are their layers, with the stack swapped.
  const stacked = expand(specs.stacked!), as = (stack: string | undefined, spec = stacked): Spec => { const laid = expand(spec); return { ...laid, layers: [{ ...laid.layers![0]!, stack } as any] }; };
  it('stack: "zero" starts each series where the one under it ends, in the series\' order', () => {
    const { ratio, result } = plot(stacked), [desktop, mobile, tablet] = rects(ratio, '2026-09-08');
    expect([desktop!.series, mobile!.series, tablet!.series]).toEqual(['Desktop', 'Mobile', 'Tablet']);
    expect(desktop!.y2).toBe(undefined);
    expect([mobile!.y2, tablet!.y2]).toEqual([desktop!.y, mobile!.y]);
    expect(new Set([desktop!.x, mobile!.x, tablet!.x]).size).toBe(1);
    // The top of a stack is its day's total on the y scale, which runs to 600 here.
    expect(ratio.nodes.filter((n) => n.part === 'y-axis').map((n) => (n as { text: string }).text)).toEqual(['0', '200', '400', '600']);
    expect(tablet!.y).toBeCloseTo((result.totalsBy!['date.day']![0]!.visitors as number) / 600, 12);
  });
  it('stack: "normalize" makes each a share of the engine\'s total for its x, so a limit leaves the stack short', () => {
    const shares = as('normalize'), { ratio } = plot(shares);
    expect(ratio.nodes.filter((n) => n.part === 'y-axis').map((n) => (n as { text: string }).text)).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
    for (const row of ratio.rows!) expect(rects(ratio, row).pop()!.y, row).toBeCloseTo(1, 12);
    const top2 = plot({ ...shares, query: { ...shares.query, limit: 2 } }), all = top2.result.totalsBy!['date.day']![0]!.visitors as number, [d, m] = top2.result.rows;
    expect(rects(top2.ratio, '2026-09-08').map((n) => n.series)).toEqual(['Desktop', 'Mobile']);
    expect(rects(top2.ratio, '2026-09-08').pop()!.y).toBeCloseTo(((d!.visitors as number) + (m!.visitors as number)) / all, 12);
    expect(rects(top2.ratio, '2026-09-08').pop()!.y).toBeLessThan(0.95);
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
      expect(((desktop!.y2 ?? 0) + tablet!.y) / 2, row).toBeCloseTo(zero, 12);
      expect((desktop!.y2 ?? 0) < zero && tablet!.y > zero, row).toBe(true);
      expect([mobile!.y2, tablet!.y2], row).toEqual([desktop!.y, mobile!.y]);
    }
  });
  it('a bar with color and no stack sits beside its neighbours, and they fill the room one bar had', () => {
    const grouped = plot(specs.grouped!), [a, b, c] = rects(grouped.ratio, 'Search'), one = rects(plot(as('zero', specs.grouped!)).ratio, 'Search')[0]!;
    expect([a!.key, b!.key, c!.key]).toEqual(['primary:bar:Search:Desktop', 'primary:bar:Search:Mobile', 'primary:bar:Search:Tablet']);
    expect([a!.y2, b!.y2, c!.y2]).toEqual([undefined, undefined, undefined]);
    expect(a!.x).toBe(one.x);
    expect(b!.x).toBeCloseTo(a!.x + a!.w, 12);
    expect(a!.w * 3).toBeCloseTo(one.w, 12);
    // Lines and areas with no stack overlay: every series starts at the baseline.
    const overlay = plot(as(undefined, specs.area!)).ratio.nodes.filter((n) => n.kind === 'path');
    expect(overlay.every((n) => n.points.every((p) => p.y2 == null) && n.opacity === 0.14)).toBe(true);
  });
  it('stacked areas share their edges, are the mark itself and not a tint, and are labelled half way up', () => {
    const { ratio } = plot(specs.area!), paths = ratio.nodes.filter((n) => n.kind === 'path'), areas = paths.filter((n) => !n.note);
    expect(areas.map((n) => n.key)).toEqual(['primary:area:Search', 'primary:area:Direct', 'primary:area:Social', 'primary:area:AI assistants', 'primary:area:Email', 'primary:area:Other']);
    expect(areas[1]!.points.map((p) => p.y2)).toEqual(areas[0]!.points.map((p) => p.y));
    expect(areas.map((n) => n.opacity)).toEqual(Array(6).fill(undefined));
    // The unfinished day is drawn too, as a bar of one is: faded, out from the last whole day, on the same edges.
    const tails = paths.filter((n) => n.note === 'incomplete bucket');
    // A label stands where its band ends, at the plot's edge, as a split line's does at the end of its tail.
    const end = tails[1]!.points[tails[1]!.points.length - 1]!;
    expect((ratio.nodes.find((n) => n.key === 'label:Direct') as { y: number }).y).toBe((end.y2! + end.y) / 2);
    expect(tails.map((n) => n.key)).toEqual(areas.map((n) => n.key + ':partial'));
    expect(tails.every((n) => n.opacity === 0.4 && n.fill)).toBe(true);
    tails.forEach((t, i) => expect(t.points[0]).toEqual(areas[i]!.points[areas[i]!.points.length - 1]));
    expect(tails[1]!.points.map((p) => p.y2)).toEqual(tails[0]!.points.map((p) => p.y));
  });
  it('errors name the fix: a stack with nothing to stack, and shares with no total to divide by', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['date.day'] }, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors' }, stack: 'zero' }] }))
      .toBe('Layer 1 has "stack" and no dimension on color, so there is nothing to stack. Encode the query\'s second dimension on color, or remove "stack".');
    const shares = as('normalize'), result = { ...runQuery(shares.query), totalsBy: undefined };
    expect(() => resolve(shares, result, catalog)).toThrow('stack: "normalize" divides by the engine\'s total for each "date.day", and this result has no totalsBy. Return it from the query layer, or use stack: "zero".');
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
    const { ratio, result } = at(346), ticks = ratio.nodes.filter((n) => n.part === 'y-axis') as { text: string; y: number }[];
    expect(ticks.map((n) => n.text)).toEqual(['-20', '-10', '0', '10', '20']);
    const zero = ticks.find((n) => n.text === '0')!.y, axis = ratio.nodes.filter((n) => n.paint === 'axis');
    expect(zero).toBe(0.5);
    expect(axis.map((n) => [n.key, (n as { y: number }).y])).toEqual([['grid:0', zero]]);
    // Every bar starts at zero. One for a day below it hangs down from there.
    const bars = ratio.nodes.filter((n) => n.kind === 'rect') as { row: string; y: number; y2: number }[];
    expect(bars.every((n) => n.y2 === zero)).toBe(true);
    for (const r of result.rows) expect(bars.find((n) => n.row === r['date.day'])!.y < zero, String(r['date.day'])).toBe((r.net_subscribers as number) < 0);
  });
  it('an area fills to zero, and a scale of nothing but values below zero ends there', () => {
    const area = run({ ...diverging, layers: [{ mark: 'area', encode: diverging.layers![0]!.encode }] }, 346).ratio.nodes.find((n) => n.kind === 'path')!;
    expect(new Set(area.points.map((p) => p.y2))).toEqual(new Set([0.5]));
    const result = runQuery(diverging.query), down = { ...result, rows: result.rows.map((r) => ({ ...r, net_subscribers: -Math.abs(r.net_subscribers as number) - 1 })) };
    const ratio = buildScene(resolve(diverging, down, catalog), diverging.query, down, catalog);
    expect((ratio.nodes.filter((n) => n.part === 'y-axis') as { text: string }[]).map((n) => n.text).pop()).toBe('0');
    expect((ratio.nodes.filter((n) => n.kind === 'rect') as { y2: number }[]).every((n) => n.y2 === 1)).toBe(true);
  });
});

describe('a scale per unit', () => {
  const dual = specs.dual!, ticks = (ratio: { nodes: any[] }, part: string) => ratio.nodes.filter((n) => n.part === part).map((n) => n.text);
  it('layers whose metrics differ in unit get a y scale each, and a second axis on the far side', () => {
    const { ratio, plan, result } = run(dual, 346);
    // Two metrics are told apart, so the view has a legend too.
    expect(plan.guides).toEqual({ x: true, y: true, y2: true, grid: true, legend: true });
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'y-axis-2', 'x-axis', 'legend']);
    expect(ticks(ratio, 'y-axis')).toEqual(['0', '200', '400', '600']);
    expect(ticks(ratio, 'y-axis-2')).toEqual(['$0', '$1k', '$2k', '$3k', '$4k']);
    expect(ratio.nodes.filter((n) => n.part === 'y-axis-2').map((n) => [n.key, (n as { anchor: string }).anchor])[1]).toEqual(['ytick:usd:1000', 'start']);
    // Each mark is on its own scale. The grid is the first scale's.
    const first = result.rows[0]!, bar = ratio.nodes.find((n) => n.key === 'primary:bar:' + first['date.day']) as { y: number }, line = ratio.nodes.find((n) => n.key === 'primary:line') as { points: { y: number }[] };
    expect(bar.y).toBeCloseTo((first.visitors as number) / 600, 12);
    expect(line.points[0]!.y).toBeCloseTo((first.revenue as number) / 4000, 12);
    expect(ratio.nodes.filter((n) => n.key.startsWith('grid:')).map((n) => n.key)).toEqual(['grid:0', 'grid:200', 'grid:400', 'grid:600']);
  });
  it('two metrics of one unit share a scale, and a constant is on the first', () => {
    const counts: Spec = { query: { metrics: ['visitors', 'pageviews'], by: ['date.day'] }, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'line', encode: { x: 'date.day', y: 'pageviews' } }, { mark: 'rule', encode: { y: 1000 } }] };
    const { ratio, plan } = run(counts, 346);
    expect(plan.guides.y2).toBe(undefined);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'x-axis', 'legend']);
    expect(ticks(ratio, 'y-axis')).toEqual(['0', '500', '1k', '1.5k']);
    expect((ratio.nodes.find((n) => n.key === 'reference:rule') as { y: number }).y).toBeCloseTo(1000 / 1500, 12);
  });
  it('layers that differ by metric are told apart as series are: a colour each where none is stated, an entry each in the legend, and a label where a line ends', () => {
    const counts: Spec = { query: { metrics: ['visitors', 'pageviews'], by: ['date.day'] }, layers: [{ mark: 'area', encode: { x: 'date.day', y: 'visitors' }, role: 'context' }, { mark: 'line', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'line', encode: { x: 'date.day', y: 'pageviews' } }] };
    const { ratio, plan } = run(counts, 346), paint = (key: string) => ratio.nodes.find((n) => n.key === key)!.paint;
    // The fill under a line is its metric's, in its metric's colour. The second metric takes the next.
    expect([paint('context:area'), paint('primary:line'), paint('primary:line#2')]).toEqual(['series.1', 'series.1', 'series.2']);
    expect(plan.guides.legend).toBe(true);
    expect(ratio.nodes.filter((n) => n.part === 'legend').map((n) => [n.key, n.paint, (n as { text?: string }).text])).toEqual([
      ['swatch:visitors', 'series.1', undefined], ['legend:visitors', 'ink', 'Visitors'], ['swatch:pageviews', 'series.2', undefined], ['legend:pageviews', 'ink', 'Page views']]);
    // The legend's rule swaps it for a label at each line's end, in the line's colour, as a split plot's does.
    const narrow = run(counts, 300);
    expect(narrow.fit.parts.filter((p) => p === 'legend' || p === 'labels')).toEqual(['labels']);
    expect(narrow.ratio.nodes.filter((n) => n.part === 'labels').map((n) => [n.key, n.paint, (n as { text?: string }).text])).toEqual([['label:visitors', 'series.1', 'Visitors'], ['label:pageviews', 'series.2', 'Page views']]);
    // A paint that is stated stands, and one metric has no legend: nor have a box's quartiles, which are one metric's.
    expect(run({ ...counts, layers: [counts.layers![1]!, { ...counts.layers![2]!, paint: 'series.4' }] }, 346).ratio.nodes.find((n) => n.key === 'swatch:pageviews')!.paint).toBe('series.4');
    expect(run({ query: counts.query, layers: [counts.layers![0]!, counts.layers![1]!] }, 346).plan.guides.legend).toBe(undefined);
    expect(run(moreSamples.box!.spec, 346).plan.guides.legend).toBe(undefined);
    // Beside a split by color the colours are the series', and the legend is theirs.
    expect(run(specs.grouped!, 346).ratio.nodes.filter((n) => n.part === 'legend' && n.kind === 'text').map((n) => n.series)).toEqual(run(specs.grouped!, 346).ratio.series);
  });
  it('the second axis is the key to what is measured on it: it stays as long as the first, and in the bare plot its layers go with it', () => {
    const wide = run(dual, 346), narrow = shown(run(dual, 300)), marks = wide.ratio.nodes.filter((n) => n.layer === 'data' && n.part === 'plot');
    // It went under 340 px once, and left the line in dollars to be read against the axis of visitors.
    expect(narrow).toMatchObject({ parts: ['y-axis', 'plot', 'y-axis-2', 'x-axis', 'labels'], rules: ['legend', 'mid-tick'] });
    expect(narrow.hidden).not.toContain('axis:2');
    // What is drawn on the second scale says so, and the rule that takes the axes takes it with them.
    expect([...new Set(marks.map((n) => n.key.split(':')[1] + ' ' + (n.axis ?? 1)))]).toEqual(['bar 1', 'line 2']);
    expect(FIT_RULES.find((r) => r.layout === 'cartesian' && r.id === 'axes')!.hide).toEqual(['x-axis', 'y-axis', 'y-axis-2', 'grid', 'axis:2', 'size']);
    expect(FIT_RULES.some((r) => r.id === 'axis-2')).toBe(false);
    // Under the axes' need the plot is bare beside the number, and of one unit, which is the number's.
    expect(shown(run(dual, 250))).toMatchObject({ parts: ['number', 'plot'], set: { arrange: 'side', split: 'plain' }, hidden: expect.arrayContaining(['axis:2', 'x-tick.mid']) });
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

// A dimension may hold numbers. Its series are keys all the same, strings as a painter reads them back from an attribute.
describe('a split by a dimension of numbers', () => {
  const cat = { metrics: { revenue: { label: 'Revenue', unit: 'usd', polarity: 'up' } }, dimensions: { day: { label: 'Day', type: 'time' }, tier: { label: 'Tier', type: 'number' } } } as const;
  const rows = ['2026-10-01', '2026-10-02'].flatMap((day) => [1, 2].map((tier) => ({ day, tier, revenue: tier * 100 })));
  const res = { rows, totals: { revenue: 600 }, totalsBy: { tier: [{ tier: 1, revenue: 200 }, { tier: 2, revenue: 400 }], day: [{ day: '2026-10-01', revenue: 300 }, { day: '2026-10-02', revenue: 300 }] }, meta: { compare: null, notes: [], empty: false } } as unknown as Result;
  const query = { metrics: ['revenue'], by: ['day', 'tier'] };
  it.each([['line', 'x', 'y'], ['bar', 'y', 'x']] as const)('names its series as strings, and draws each, in a %s', (mark, dim, metric) => {
    const spec: Spec = { spec: 'view/0', layers: [{ mark, encode: { [dim]: 'day', [metric]: 'revenue', color: 'tier' }, ...(mark === 'bar' && { stack: 'zero' }) }], query } as Spec;
    const { scene } = ofUnbounded(spec, res, query, cat as unknown as Catalog);
    expect(scene.series).toEqual(['1', '2']);
    expect(scene.nodes.filter((n) => n.series === '2' && n.layer !== 'guide').length).toBeGreaterThan(0);
  });
});

// A metric on x holds zero, as one on y does: with nothing above zero, its axis ends there.
it('a metric on x with nothing above zero ends at zero', () => {
  const cat = { metrics: { a: { label: 'A', unit: 'count', polarity: 'up' }, b: { label: 'B', unit: 'count', polarity: 'up' } }, dimensions: { sku: { label: 'SKU', type: 'categorical' } } } as unknown as Catalog;
  const res = { rows: [{ sku: 'p', a: -1000, b: 1 }, { sku: 'q', a: -10, b: 2 }], totals: {}, meta: { compare: null, notes: [], empty: false } } as unknown as Result;
  const query = { metrics: ['a', 'b'], by: ['sku'] }, spec = { spec: 'view/0', layers: [{ mark: 'dot', encode: { x: 'a', y: 'b' } }], query } as Spec;
  const ticks = ofUnbounded(spec, res, query, cat).scene.nodes.filter((n) => n.key.startsWith('xtick:')).map((n) => (n as { text: string }).text);
  expect(ticks.at(-1)).toBe('0');
});

// A rule at a value of the list on x (reference, section 6, "A rule at a value"; Decided 46). A string on a channel
// is a field, so the place is said in the layer field `at`.
describe('a rule at a value of x', () => {
  const launch = moreSamples.launch!.spec, at = (layer: object, query = launch.query, rest: object[] = launch.layers!.slice(0, 2)) => ({ ...launch, query, layers: [...rest, layer] }) as Spec;
  const rules = (s: Spec) => ofUnbounded(s).scene.nodes.filter((n) => n.role === 'reference') as unknown as { key: string; x: number; x2: number }[];
  it('stands the height of the plot where that value is, with its label beside it', () => {
    const [line, label] = rules(launch), dates = runQuery(launch.query).rows.map((r) => r['date.day']), i = dates.indexOf('2026-09-21');
    expect(i).toBeGreaterThan(0);
    expect(line).toMatchObject({ key: 'reference:rule:2026-09-21', kind: 'line', y: 0, y2: 1, paint: 'rule', dash: '5 3' });
    expect(line!.x).toBeCloseTo(i / (dates.length - 1));
    expect(line!.x2).toBe(line!.x);
    expect(label).toMatchObject({ key: 'reference:rule:2026-09-21:label', kind: 'text', text: 'Launch', anchor: 'start' });
    expect(view(launch), JSON.stringify(view.errors)).toBe(true);
  });
  it('a list of values is a rule at each, keyed by its value, and on bars it stands at the middle of its band', () => {
    expect(rules(at({ mark: 'rule', at: ['2026-09-21', '2026-09-30'] })).map((n) => n.key)).toEqual(['reference:rule:2026-09-21', 'reference:rule:2026-09-30']);
    const byChannel = { metrics: ['visitors'], by: ['channel'], range: '28d' }, bars = at({ mark: 'rule', at: 'Social' }, byChannel, [{ mark: 'bar', encode: { x: 'channel', y: 'visitors' } }]);
    const scene = ofUnbounded(bars).scene, bar = scene.nodes.find((n) => n.key === 'primary:bar:Social') as unknown as { x: number; w: number };
    expect(rules(bars)[0]!.x).toBeCloseTo(bar.x + bar.w / 2);
  });
  it('a value the axis does not have is not drawn, and is no error', () => {
    expect(rules(at({ mark: 'rule', at: '2025-01-01', label: 'Before the range' }))).toEqual([]);
    expect(rules(at({ mark: 'rule', at: ['2025-01-01', '2026-09-21'] })).map((n) => n.key)).toEqual(['reference:rule:2026-09-21']);
  });
  it('names the fix where it cannot stand', () => {
    expect(err(at({ mark: 'rule', at: '2026-09-21', encode: { y: 100 } }))).toMatch(/A rule "at" a value stands the height of the plot at that value of x, and this one also has y encoded\. Remove "at" for the rule those make, or remove them\./);
    expect(err(at({ mark: 'dot', at: '2026-09-21', encode: { x: 'date.day', y: 'visitors' } }))).toMatch(/Layer 3 has "at", and the "dot" mark in a "cartesian" layout reads none\. Remove it\. It is read by: rule in cartesian\./);
    const points = { metrics: ['visitors', 'pageviews'], by: ['channel'], range: '28d' };
    expect(err(at({ mark: 'rule', at: 'Social' }, points, [{ mark: 'dot', encode: { x: 'visitors', y: 'pageviews' } }]))).toMatch(/Layer 2 is a rule "at" a value of x, and this plot's x is the metric "visitors", which is a scale and has no values to stand at\. Give the place as a number/);
    const list = [{ mark: 'bar', encode: { y: 'channel', x: 'visitors' } }, { mark: 'text', encode: { y: 'channel', text: 'channel' } }];
    expect(err(at({ mark: 'rule', at: 'Social', encode: { x: 100 } }, { metrics: ['visitors'], by: ['channel'], range: '28d' }, list))).toMatch(/Layer 3 has "at", and the "rule" mark in a "rows" layout reads none/);
  });
});

// A metric on color in a plot (reference, section 7, "Colour by a metric in a plot"; Decided 47): each bar or dot is a
// step of the ramp by its row's value, and the ramp is the key, as under a grid of cells.
describe('a metric on color in a plot', () => {
  const tinted = moreSamples.tinted!.spec, rows = runQuery(tinted.query).rows, q3 = { metrics: ['visitors', 'page_conversion', 'pageviews'], by: ['page'], range: '28d' };
  const of = (layers: object[], query: object = tinted.query) => ({ ...tinted, query, layers }) as Spec;
  const marks = (s: Spec) => ofUnbounded(s).scene.nodes.filter((n) => (n.part === 'plot' || n.part === 'points') && n.layer === 'data' && n.row != null) as unknown as { row: string; paint: string; legend?: boolean }[];
  const step = (paint: string) => Number(paint.split('.')[1]);
  it('paints each bar a step of the ramp by its row\'s value, and the ramp runs from the least to the most', () => {
    const bars = marks(tinted), by = new Map(rows.map((r) => [String(r.page), r.page_conversion as number])), sorted = [...bars].sort((a, b) => by.get(a.row)! - by.get(b.row)!);
    expect(bars.length).toBe(rows.length);
    expect(bars.every((b) => /^seq\.\d+$/.test(b.paint) && b.legend)).toBe(true);
    expect(sorted.map((b) => step(b.paint))).toEqual(sorted.map((b) => step(b.paint)).sort((a, b) => a - b));
    expect(step(sorted[0]!.paint)).toBe(1);
    expect(step(sorted.at(-1)!.paint)).toBeGreaterThan(step(sorted[0]!.paint));
    const { scene } = ofUnbounded(tinted), ramp = scene.nodes.filter((n) => n.part === 'ramp');
    expect(scene.parts).toEqual(['y-axis', 'plot', 'x-axis', 'ramp']);
    expect(ramp.filter((n) => n.kind === 'rect').length).toBeGreaterThan(2);
    expect(view(tinted), JSON.stringify(view.errors)).toBe(true);
  });
  it('paints dots as it does bars, in a plot of points and with a key to their sizes beside the ramp', () => {
    const points = of([{ mark: 'dot', encode: { x: 'visitors', y: 'pageviews', color: 'page_conversion', size: 'visitors' } }], q3);
    expect(marks(points).every((d) => /^seq\.\d+$/.test(d.paint))).toBe(true);
    expect(ofUnbounded(points).scene.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis', 'ramp', 'size']);
  });
  it('paints the marks of a layer split by detail too, each by its own row', () => {
    const byDay = { metrics: ['visitors', 'pageviews'], by: ['date.day', 'country'], range: '7d' }, split = of([{ mark: 'dot', encode: { x: 'date.day', y: 'visitors', detail: 'country', color: 'pageviews' } }], byDay);
    const dots = marks(split);
    expect(dots.length).toBeGreaterThan(7);
    expect(dots.every((d) => /^seq\.\d+$/.test(d.paint) && d.legend)).toBe(true);
    expect(new Set(dots.map((d) => d.paint)).size).toBeGreaterThan(1);
  });
  it('keeps the ramp as long as the axes, and under their need draws the bars in one paint with no ramp', () => {
    expect(shown(run(tinted, 300))).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'ramp'] });
    const bare = shown(run(tinted, 250));
    expect(bare.parts).toEqual(['number', 'plot']);
    expect(bare.set).toMatchObject({ split: 'plain' });
  });
  it('names the fix where a plot\'s colours would say two things', () => {
    const bar = { mark: 'bar', encode: { x: 'page', y: 'visitors', color: 'page_conversion' } };
    expect(err(of([{ ...bar, paint: 'series.2' }]))).toMatch(/Layer 1 has "page_conversion" on color and the paint "series\.2", and a mark has one paint\. Remove "paint" to paint each mark by its value, or take "page_conversion" off color\./);
    expect(err(of([bar, { mark: 'dot', encode: { x: 'page', y: 'visitors', color: 'pageviews' } }], q3))).toMatch(/These layers put 2 metrics on color \(page_conversion, pageviews\), and a plot has one colour scale\./);
    expect(err(of([bar, { mark: 'line', encode: { x: 'page', y: 'pageviews' } }], q3))).toMatch(/"page_conversion" is on color, which paints each mark by its value, and these layers are also told apart by colour: they measure visitors and pageviews\. Keep one: take "page_conversion" off color, or draw one metric\./);
  });
});
