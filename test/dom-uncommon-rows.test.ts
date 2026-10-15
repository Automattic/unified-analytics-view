import { describe, expect, it } from 'vitest';
import { FIT_RULES, buildScene, expand, resolve, unboundedContainer, type Spec } from '@unified-analytics/core';
import { compileFitRules, paintVar } from '@unified-analytics/dom';
import { catalog, moreSamples, runQuery } from '@unified-analytics/fixtures';
import { KEYS_CSS, hitNodes, readout, readoutAt, rowsAt, stepSeries } from '../packages/dom/src/keys.ts';
import { rows as painter } from '../packages/dom/src/layouts/rows.ts';
import { TRACK_CSS } from '../packages/dom/src/layouts/track.ts';
import { ofUnbounded } from './helpers.ts';

// What <ua-view> does for step 4 of docs/uncommon-coverage-plan.md, where that is strings and plain functions. The
// element itself was looked at in a browser, on the bench.
const of = (name: string) => {
  const spec = moreSamples[name]!.spec, result = runQuery(spec.query), q = expand(spec).query, { plan, scene } = ofUnbounded(spec, result, q);
  return { spec, q, result, plan, scene };
};

describe('a list whose rows are divided into series', () => {
  it('has the result\'s rows at each of its own, in the series\' order, and reads a row from the engine\'s total for it', () => {
    const { scene, q, result } = of('pyramid'), at = rowsAt(scene, q, result);
    expect([at.x, at.split]).toEqual(['age', 'sex']);
    expect(at.rows.map((rs) => rs.map((r) => r.sex))).toEqual(scene.rows!.map(() => ['Female', 'Male']));
    const total = result.totalsBy!.age![1]!;
    expect(readoutAt(at.rows[1]!, total, q, catalog, 'age', 'sex')).toBe('25–34: Visitors 2,843 (Female 1,448, Male 1,395)');
    expect(readout(at.rows[1]![0]!, q, catalog, [])).toBe('25–34, Female: Visitors 1,448');
  });
  it('by detail says how many a row holds and which has the most, and not every one', () => {
    const { scene, q, result } = of('strip'), at = rowsAt(scene, q, result);
    expect(at.rows[1]!.length).toBe(15);
    expect(readoutAt(at.rows[1]!, result.totalsBy!.channel![1], q, catalog, 'channel', 'country', true)).toBe('Direct: Visitors 2,949 (15 countries, the most United States 889)');
  });
  it('steps through a row\'s series with right and left, on from the whole row and back to it, and the other way on a page that reads from the right', () => {
    expect(stepSeries('ArrowRight', -1, 2, true)).toBe(0);
    expect(stepSeries('ArrowRight', 1, 2, true)).toBe(1);
    expect(stepSeries('ArrowLeft', 0, 2, true)).toBe(-1);
    expect(stepSeries('ArrowLeft', -1, 2, true)).toBe(-1);
    expect([stepSeries('ArrowUp', 0, 2, true), stepSeries('ArrowDown', 0, 2, true)]).toEqual([null, null]);     // those step from row to row
    expect([stepSeries('ArrowLeft', -1, 2, true, true), stepSeries('ArrowRight', 0, 2, true, true)]).toEqual([0, -1]);
    // A plot is as it was: up and down, whatever the page.
    expect([stepSeries('ArrowUp', -1, 3), stepSeries('ArrowRight', 0, 3)]).toEqual([0, null]);
  });
  it('draws the chosen series whole and stands the rest of its row back', () => {
    expect(KEYS_CSS).toContain('.uav-row:has(> [data-chosen]) > i[data-series]:not([data-chosen]) { opacity: var(--ua-charts-opacity-dim, 50%) !important; }');
    expect(KEYS_CSS).toContain('.uav-row > i[data-chosen] { opacity: 1 !important; }');
  });
  it('sets a stack\'s parts end to end with no least length, the range behind the marks as tall as the row, and half a tick in its half', () => {
    expect(TRACK_CSS).toContain('.uav-body[data-track] .uav-row > i[data-series]:not([data-mark]) { border-radius: 0; inline-size: max(0px, calc(var(--uav-v) * (100% - 2 * var(--uav-row-gap)) - var(--ua-charts-stroke-width-rule, 1px))); }');
    expect(TRACK_CSS).toContain('.uav-body[data-track] .uav-row > i[data-mark="band"] { inset-block: 0;');
    expect(TRACK_CSS).toContain('i[data-mark="tick"] { inset-block: calc((1 - var(--uav-t2)) * 100%) calc(var(--uav-t) * 100%);');
    expect(paintVar('band.2')).toBe('var(--ua-charts-color-band-2, color-mix(in srgb, currentColor 16%, transparent))');
  });
  it('swaps its legend for the one line, and gives both up, by the same rules resolve() asks', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows'), { rows: painter.fit ?? {} });
    expect(css).toContain('/* rows legend */\n@container uav-view (inline-size < 169.5px) {\n  .uav[data-layout="rows"]:not([data-keep~="guides"]) .uav-legend { display: none; }\n  .uav[data-layout="rows"]:not([data-keep~="guides"]) .uav-legend-top { display: block; }\n}');
    expect(css).toContain('/* rows legend */\n@container uav-view (block-size < 149.5px) {');
    expect(css).toContain('/* rows legend-top */\n@container uav-view (block-size < 83.5px) {\n  .uav[data-layout="rows"]:not([data-keep~="guides"]) :is(.uav-legend, .uav-legend-top) { display: none; }\n}');
    expect(css.indexOf('rows legend-top')).toBeGreaterThan(css.indexOf('rows legend */'));
    expect(painter.css).toContain('.uav[data-layout="rows"] :is(.uav-legend, .uav-legend-top) { grid-column: 1 / -1; grid-row: 3; }');
  });
});

describe('hit targets', () => {
  it('of columns of widths of their own meet where one column ends and the next begins', () => {
    const { scene } = of('marimekko'), hits = hitNodes(scene), bar = (row: string) => scene.nodes.find((n) => n.key === 'primary:bar:' + row + ':Desktop') as any;
    expect(hits.map((h) => h.row)).toEqual(scene.rows);
    expect(hits[0]!.x).toBe(0);
    hits.slice(1).forEach((h, i) => { expect(h.x).toBeCloseTo(bar(h.row!).x, 12); expect(hits[i]!.x! + hits[i]!.w!).toBeCloseTo(h.x!, 12); });
    expect(hits[0]!.c).toBeCloseTo(0.5, 12);
  });
  it('of an OHLC chart stand about the stroke, and not about the half tick to one side of it', () => {
    const { scene } = of('ohlc'), hits = hitNodes(scene), stroke = scene.nodes.find((n) => n.key === 'primary:rule:' + scene.rows![5]) as any;
    expect(hits.length).toBe(28);
    expect(hits[5]!.x! + hits[5]!.w! * hits[5]!.c).toBeCloseTo(stroke.x, 12);
  });
  it('are a plot of points\' own dots where it has a rug or a line across it: the plot\'s layer names no point', () => {
    for (const name of ['rug', 'qq']) {
      const { scene, q, result } = of(name), at = rowsAt(scene, q, result);
      expect(scene.parts).toContain('points');
      expect(at.rows.every((rs) => rs.length === 1)).toBe(true);
    }
    const coloured: Spec = { query: { metrics: ['embed_x', 'embed_y'], by: ['term', 'intent'] }, layers: [{ mark: 'dot', encode: { x: 'embed_x', y: 'embed_y', color: 'intent', detail: 'term' } }] };
    const result = runQuery(coloured.query), scene = buildScene(resolve(coloured, result, unboundedContainer(), catalog), coloured.query, result, catalog), at = rowsAt(scene, coloured.query, result);
    // A coloured point is one row, read as a row: its name, what it is coloured by, and its two values.
    expect([at.rows.length, at.rows[0]!.length]).toEqual([24, 1]);
    expect(readout(at.rows[0]![0]!, coloured.query, catalog, [])).toMatch(/^pricing, Pricing: First component -?[\d.]+; Second component -?[\d.]+$/);
  });
});
