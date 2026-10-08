import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, makeContainer, place, resolve, type PainterName, type Spec } from '@universal-analytics/core';
import viewSchema from '@universal-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples, scenarios } from '@universal-analytics/fixtures';

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
  it('a layer with no color is one series still, beside those that are split', () => {
    const scene = marks({ ...byDevice, layers: [...byDevice.layers!, { mark: 'rule', encode: { y: 200 }, label: 'Target' }] });
    expect(scene.nodes.filter((n) => n.role === 'reference').map((n) => [n.key, n.series])).toEqual([['reference:rule', undefined], ['reference:rule:label', undefined]]);
  });
});
