import { describe, expect, it } from 'vitest';
import { buildScene, formatUnit, makeContainer, metricOf, resolve, unitsOf, type Catalog, type PathNode, type Result, type Spec } from '@unified-analytics/core';
import { catalog as fixtures, runQuery } from '@unified-analytics/fixtures';
import { crossMarks, hitNodes, readout, rowsAt, step } from '../packages/dom/src/keys.ts';
import { pathTargets } from '../packages/dom/src/layouts/points.ts';
import { mix, pairUp } from '../packages/dom/src/motion.ts';

// Step 3 of docs/uncommon-coverage-plan.md: what a line and an area take that they refused. Here, on a catalog and
// results of its own, is what a companion's unit is and how a scale of ranks runs. The samples that use them, and what
// each one is, are in test/uncommon.test.ts, with the fixture's facts.
const catalog: Catalog = {
  metrics: {
    hits: { label: 'Hits', unit: 'count', polarity: 'up' },
    // A companion the catalog has an entry for, under its whole name: it is in a unit of its own.
    'hits@rank': { label: 'Rank', unit: 'rank', polarity: 'down' },
    'hits@share': { label: 'Cumulative share', unit: 'ratio', polarity: 'none' },
  },
  dimensions: { 'date.day': { label: 'Day', type: 'time' }, source: { label: 'Source', type: 'categorical' } },
};
const SOURCES = ['Search', 'Direct', 'Social'];
// Three sources over three days. Search and Direct change places on the last day.
const HITS = [[300, 200, 100], [310, 250, 90], [240, 330, 120]];
const pairs: Result = {
  rows: HITS.flatMap((day, i) => day.map((hits, j) => ({ 'date.day': '2026-10-0' + (i + 1), source: SOURCES[j]!, hits, 'hits@rank': 1 + day.filter((n) => n > hits).length }))),
  totals: { hits: 1940 }, meta: { range: '3d', compare: null, notes: [] },
  totalsBy: { 'date.day': HITS.map((day, i) => ({ 'date.day': '2026-10-0' + (i + 1), hits: day.reduce((s, n) => s + n, 0) })), source: SOURCES.map((source, j) => ({ source, hits: HITS.reduce((s, day) => s + day[j]!, 0) })) },
};
const bySource: Result = {
  rows: [{ source: 'Search', hits: 850, 'hits@share': 0.438, 'hits@p50': 300 }, { source: 'Direct', hits: 780, 'hits@share': 0.84, 'hits@p50': 250 }, { source: 'Social', hits: 310, 'hits@share': 1, 'hits@p50': 100 }],
  totals: { hits: 1940 }, meta: { range: '3d', compare: null, notes: [] },
};
const scene = (spec: Spec, result: Result, cat = catalog, w = 500) => { const plan = resolve(spec, result, makeContainer(w), cat); return { plan, scene: buildScene(plan, spec.query, result, cat) }; };
const err = (spec: Spec, result: Result) => { try { scene(spec, result); } catch (e) { return (e as Error).message; } };
const ticks = (s: ReturnType<typeof scene>, part = 'y-axis') => s.scene.nodes.filter((n) => n.part === part && n.kind === 'text').map((n) => (n as { text: string }).text);
const paths = (s: ReturnType<typeof scene>) => s.scene.nodes.filter((n): n is PathNode => n.kind === 'path');

describe('a companion\'s unit', () => {
  const bars = { mark: 'bar' as const, encode: { x: 'source', y: 'hits' } };
  const withLine = (y: string): Spec => ({ query: { metrics: ['hits'], by: ['source'] }, layers: [bars, { mark: 'line', encode: { x: 'source', y }, paint: 'series.2' }] });
  it('is its metric\'s where the catalog has no entry for it, so it shares its metric\'s axis', () => {
    expect(metricOf(catalog, 'hits@p50')).toBe(catalog.metrics.hits);
    expect(unitsOf(catalog, withLine('hits@p50').layers!)).toEqual(['count']);
    const s = scene(withLine('hits@p50'), bySource);
    expect(s.scene.parts).toEqual(['y-axis', 'plot', 'x-axis']);
    expect(paths(s)[0]!.points.map((p) => p.v)).toEqual([300 / 1000, 250 / 1000, 100 / 1000]);
  });
  it('is its own where the catalog has an entry under its whole name: a share beside a count has the far axis, and is not flat on the count\'s', () => {
    expect(metricOf(catalog, 'hits@share')).toBe(catalog.metrics['hits@share']);
    expect(unitsOf(catalog, withLine('hits@share').layers!)).toEqual(['count', 'ratio']);
    const s = scene(withLine('hits@share'), bySource);
    expect(s.scene.parts).toEqual(['y-axis', 'plot', 'y-axis-2', 'x-axis']);
    expect(ticks(s, 'y-axis-2')).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
    expect(paths(s)[0]!.points.map((p) => p.v)).toEqual([0.438, 0.84, 1]);
  });
  it('core reads no suffix to know it: the same companion under a catalog that says nothing of it is a count', () => {
    const { 'hits@share': _share, ...metrics } = catalog.metrics, bare = { ...catalog, metrics };
    expect(unitsOf(bare, withLine('hits@share').layers!)).toEqual(['count']);
    expect(paths(scene(withLine('hits@share'), bySource, bare))[0]!.points.map((p) => p.v)).toEqual([0.438 / 1000, 0.84 / 1000, 1 / 1000]);
  });
  it('is how its value is written in the readout, under its own label, where one with no entry is under its suffix', () => {
    const layers = [bars, { mark: 'line' as const, encode: { x: 'source', y: 'hits@share' } }, { mark: 'tick' as const, encode: { x: 'source', y: 'hits@p50' } }];
    expect(readout(bySource.rows[0]!, { metrics: ['hits'], by: ['source'] }, catalog, layers)).toBe('Search: Hits 850, cumulative share 44%, p50 300');
  });
  it('counts toward the two units a plot has an axis for', () => {
    expect(err({ query: { metrics: ['hits'], by: ['date.day', 'source'] }, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'hits', color: 'source' } }, { mark: 'line', encode: { x: 'date.day', y: 'hits@rank', color: 'source' } }, { mark: 'line', encode: { x: 'date.day', y: 'hits@share', color: 'source' } }] }, { ...pairs, rows: pairs.rows.map((r) => ({ ...r, 'hits@share': 0.5 })) }))
      .toBe('These layers measure in 3 units (count, rank, ratio), and a plot has a y axis on each side at most. Remove a layer, or draw them as separate views.');
  });
});

describe('the unit rank', () => {
  const bump: Spec = { query: { metrics: ['hits'], by: ['date.day', 'source'] }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'hits@rank', color: 'source' } }] };
  it('is written as a place in an order, and as the bare number on a scale of them', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map((n) => formatUnit(n, 'rank'))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th']);
    expect([formatUnit(3, 'rank', 'compact'), formatUnit(3, 'rank', 'exact'), formatUnit(2.5, 'rank'), formatUnit(null, 'rank')]).toEqual(['3', '3rd', '2.5', '–']);
  });
  it('has a scale that runs from 1 at the top to the last rank at the foot, with a tick and a grid line for each', () => {
    const s = scene(bump, pairs), lines = paths(s);
    expect(s.scene.nodes.filter((n) => n.part === 'y-axis').map((n) => [n.key, (n as { text: string }).text, (n as { t: number }).t, n.rank])).toEqual([['ytick:1', '1', 1, undefined], ['ytick:2', '2', 0.5, 1], ['ytick:3', '3', 0, undefined]]);
    expect(s.scene.nodes.filter((n) => n.key.startsWith('grid:')).map((n) => [(n as { t: number }).t, n.paint])).toEqual([[1, 'grid'], [0.5, 'grid'], [0, 'grid']]);
    // First place is at the top, and the two that change places on the last day cross.
    expect(lines.map((n) => [n.series, n.points.map((p) => p.v)])).toEqual([['Search', [1, 1, 0.5]], ['Direct', [0.5, 0.5, 1]], ['Social', [0, 0, 0]]]);
    // A label stands where its line ends, so the labels read in the last day's order.
    expect(s.scene.nodes.filter((n) => n.part === 'labels').map((n) => [(n as { text: string }).text, (n as { t: number }).t])).toEqual([['Search', 0.5], ['Direct', 1], ['Social', 0]]);
  });
  it('is said in prose: who is first and on how many of the rows, and who rose and fell the furthest from the first to the last', () => {
    expect(scene(bump, pairs).plan.text).toBe('In the last 3 days, Search is first by hits on 2 of 3 days. Direct rose from 2nd to 1st, and Search fell from 1st to 2nd.');
    // Nobody moved: said so. The ranks are the engine's, and none is worked out from the hits.
    const still: Result = { ...pairs, rows: pairs.rows.map((r) => ({ ...r, 'hits@rank': 1 + SOURCES.indexOf(r.source as string) })) };
    expect(scene(bump, still).plan.text).toBe('In the last 3 days, Search is first by hits on all 3 days. No source changed place.');
    // With no range in the answer none is named.
    expect(scene(bump, { ...still, meta: { compare: null, notes: [] } }).plan.text).toBe('Search is first by hits on all 3 days. No source changed place.');
  });
  it('past ten ranks has a tick for every few, the first and the last among them', () => {
    const many: Result = { ...pairs, rows: Array.from({ length: 23 }, (_, j) => ({ 'date.day': '2026-10-01', source: 'S' + j, hits: 100 - j, 'hits@rank': j + 1 })), totalsBy: undefined as never };
    const s = scene({ ...bump, layers: [{ mark: 'dot', encode: { x: 'date.day', y: 'hits@rank', detail: 'source' } }] }, many);
    expect(ticks(s)).toEqual(['1', '3', '6', '9', '12', '15', '18', '21', '23']);
  });
  it('a metric of its own may be in it, and what is no rank is at the foot: a bar of ranks is tallest for the first', () => {
    const cat: Catalog = { ...catalog, metrics: { place: { label: 'Place', unit: 'rank', polarity: 'down' } } };
    const result: Result = { rows: [{ source: 'Search', place: 1 }, { source: 'Direct', place: 2 }, { source: 'Social', place: 3 }], totals: { place: null }, meta: { compare: null, notes: [] } };
    const s = scene({ query: { metrics: ['place'], by: ['source'] }, layers: [{ mark: 'bar', encode: { x: 'source', y: 'place' } }] }, result, cat);
    expect(s.scene.nodes.filter((n) => n.kind === 'rect').map((n) => [(n as { v: number }).v, (n as { v0?: number }).v0])).toEqual([[1, undefined], [0.5, undefined], [0, undefined]]);
    expect(readout(result.rows[1]!, { metrics: ['place'], by: ['source'] }, cat, [])).toBe('Direct: Place 2nd');
  });
});

describe('a line in a plot of points', () => {
  const q = { metrics: ['visitors', 'signups'], by: ['date.day'], range: '28d' }, at = { x: 'visitors', y: 'signups' };
  const joined: Spec = { spec: 'view/0', query: q, layers: [{ mark: 'line', encode: at }, { mark: 'dot', encode: at }] };
  const of = (spec: Spec, w = 500) => { const result = runQuery(spec.query), container = makeContainer(w), plan = resolve(spec, result, container, fixtures); return { plan, result, scene: buildScene(plan, spec.query, result, fixtures), container }; };
  it('joins the rows in the engine\'s order, straight from each to the next, in the points\' own part', () => {
    const { scene, result } = of(joined), [line, tail] = scene.nodes.filter((n): n is PathNode => n.kind === 'path'), dots = scene.nodes.filter((n) => n.kind === 'circle' && n.part === 'points') as any[];
    expect(scene.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis']);
    expect([line!.key, line!.part, line!.curve, tail!.key, tail!.part, tail!.dash]).toEqual(['primary:line', 'points', undefined, 'primary:line:partial', 'points', '2 4']);
    // A point for each whole day, in the days' order, each where its dot is. The order is time's and not x's: the line turns back on itself.
    expect(line!.points.map((p) => p.row)).toEqual(result.rows.slice(0, -1).map((r) => r['date.day']));
    expect(line!.points.map((p) => [p.x, p.v])).toEqual(dots.slice(0, -1).map((n) => [n.x, n.t]));
    expect(line!.points.some((p, i, all) => i > 0 && p.x < all[i - 1]!.x)).toBe(true);
    expect(line!.d).toMatch(/^M[\d.]+,[\d.]+(L[\d.]+,[\d.]+){26}$/);
    // The unfinished day is joined on by a dashed stroke, as on any line.
    expect(tail!.points.map((p) => p.row)).toEqual(result.rows.slice(-2).map((r) => r['date.day']));
  });
  it('is a plot of points to the fit rules: no bare form, and the number alone below the room its axes need', () => {
    expect([500, 346, 250, 120, 10].map((w) => of(joined, w).plan.layout)).toEqual(['cartesian', 'cartesian', 'none', 'none', 'prose']);
    expect(of(joined, 250).plan.dropped).toEqual(['all marks (kept the number)']);
    const alone = of({ ...joined, layers: [joined.layers![0]!] }, 250);
    expect([alone.plan.layout, alone.plan.dropped]).toEqual(['none', ['all marks (kept the number)']]);
  });
  it('has no target along x and no crosshair: its points are the targets, in the line\'s order, with or without a dot on each', () => {
    const { scene, result, plan } = of(joined), rows = rowsAt(scene, q, result);
    expect(hitNodes(scene)).toEqual([]);
    expect(crossMarks(scene, plan.layers, rows.rows, fixtures).size).toBe(0);
    expect(scene.rows).toEqual(result.rows.map((r) => r['date.day']));
    // With no dot layer the line's own points stand in, one for each row it passes, the unfinished day's among them.
    const bare = of({ ...joined, layers: [joined.layers![0]!] }).scene, targets = pathTargets(bare.nodes.filter((n): n is PathNode => n.kind === 'path'));
    expect(bare.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis']);
    expect(targets.map((n) => n.row)).toEqual(bare.rows);
    expect(targets[3]).toMatchObject({ key: 'at:2026-09-11', part: 'points', kind: 'circle' });
    // Left and right step back and on along the line and stop at its ends. Up and down are no step.
    expect([step('ArrowRight', -1, 28), step('ArrowRight', 5, 28), step('ArrowLeft', 5, 28), step('ArrowRight', 27, 28), step('ArrowUp', 5, 28), step('ArrowDown', 5, 28)]).toEqual([0, 6, 4, 27, null, null]);
    expect(readout(result.rows[0]!, q, fixtures, plan.layers)).toBe('Sep 8: Visitors 416; Sign-ups ' + result.rows[0]!.signups);
  });
  it('morphs point for point, across as well as up: a point is at a value on x too', () => {
    const from = [{ x: 0.2, v: 0.2 }, { x: 0.8, v: 0.4 }], to = [{ x: 0.6, v: 0.6 }, { x: 0.4, v: 0.8 }, { x: 0.1, v: 0.1 }];
    expect(pairUp(from, to)).toEqual([from[0], from[1], from[1]]);
    expect(pairUp([], to)).toEqual(to);
    expect(mix(pairUp(from, to), to, 0.5, true).map((p) => [+p.x.toFixed(3), +p.v.toFixed(3)])).toEqual([[0.4, 0.4], [0.6, 0.6], [0.45, 0.25]]);
    // At its end a morph draws the scene's own path (motion.ts), so nothing rests on this sum.
    expect(mix(pairUp(from, to), to, 1, true).map((p) => [+p.x.toFixed(9), +p.v.toFixed(9)])).toEqual(to.map((p) => [p.x, p.v]));
  });
  it('an area there is refused: there is no one way along x to fill under', () => {
    expect((() => { try { of({ ...joined, layers: [{ mark: 'area', encode: at }] }); } catch (e) { return (e as Error).message; } })())
      .toBe('Layer 1 is an area with the metric "visitors" on x, and an area fills under a line that runs one way along x, which the points of two metrics do not. Use "line" to join the points in the order of their rows, or put a dimension on x.');
  });
});
