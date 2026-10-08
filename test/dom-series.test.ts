import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, buildScene, expand, pathD, resolve, unboundedContainer, type PathNode, type RectNode } from '@universal-analytics/core';
import { catalog, moreSamples, runQuery, type Scenario } from '@universal-analytics/fixtures';
import { compileFitRules } from '../packages/dom/src/compile.ts';
import { band } from '../packages/dom/src/layouts/band.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { hitNodes, readout, readoutAt, rowsAt, stepSeries } from '../packages/dom/src/keys.ts';
import { apart } from '../packages/dom/src/measure.ts';
import { mix, resample } from '../packages/dom/src/motion.ts';
import { pivot } from '../packages/dom/src/view.ts';

// What <ua-view> adds for a plot split into series, a stack, a signed scale and a second unit, where it is a plain
// function or a string. That they draw, fit and move is checked in a browser on the bench.

const of = (sample: string, scenario: Scenario = 'typical', range = '28d') => {
  const spec = { ...moreSamples[sample]!.spec, query: { ...moreSamples[sample]!.spec.query, range } }, result = runQuery(spec.query, scenario);
  return { spec, result, scene: buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog) };
};
const names = Object.keys(moreSamples);

describe('bars', () => {
  it('run from where they start to their value, whichever is the higher', () => {
    expect(cartesian.css).toContain('inset-block-end: calc(min(var(--vg-v0, 0), var(--vg-v)) * 100%);');
    expect(cartesian.css).toContain('block-size: calc(max(var(--vg-v) - var(--vg-v0, 0), var(--vg-v0, 0) - var(--vg-v)) * 100%);');
  });
  it('have a start to read in a stack and below zero, and none in a group', () => {
    const rects = (sample: string) => of(sample).scene.nodes.filter((n): n is RectNode => n.part === 'plot' && n.kind === 'rect');
    expect(rects('stacked').filter((n) => n.series !== 'Desktop').every((n) => n.v0! > 0 && n.v! >= n.v0!)).toBe(true);
    expect(rects('diverging').some((n) => n.v! < n.v0!)).toBe(true);
    expect(rects('grouped').every((n) => n.v0 == null)).toBe(true);
  });
});

describe('a split path', () => {
  const areas = (range: string) => of('area', 'typical', range).scene.nodes.filter((n): n is PathNode => n.kind === 'path');

  it.each(names)('has a key of its own in %s, so a morph holds to its series', (sample) => {
    const keys = of(sample).scene.nodes.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('keeps its key when the rows change', () => {
    expect(areas('7d').map((n) => n.key)).toEqual(areas('28d').map((n) => n.key));
  });
  it('morphs where it starts as well as where it ends, and lands on the shape core drew', () => {
    const from = areas('28d')[1]!, to = areas('7d')[1]!, old = resample(from.points, to.points);
    expect(old.every((p) => p.v0! > 0 && p.v0! < p.v)).toBe(true);
    const half = mix(old, to.points, 0.5);
    half.forEach((p, i) => expect(p.v0).toBeCloseTo((old[i]!.v0! + to.points[i]!.v0!) / 2, 9));
    expect(pathD(mix(old, to.points, 1), to.curve, to.fill)).toBe(to.d);
  });
  it('gains a start when it had none, and loses one', () => {
    expect(mix([{ x: 0, v: 0.4 }], [{ x: 0, v: 0.8, v0: 0.2 }], 0.5)).toEqual([{ x: 0, v: 0.6000000000000001, v0: 0.1 }]);
    expect(mix([{ x: 0, v: 0.8, v0: 0.2 }], [{ x: 0, v: 0.4 }], 1)).toEqual([{ x: 0, v: 0.4, v0: 0 }]);
  });
});

describe('the cartesian layout\'s guides', () => {
  const rules = (id: string) => CONTAINER_RULES.fit.filter((r) => r.layout === 'cartesian' && r.id === id);
  const fig = '.vg[data-layout="cartesian"]:not([data-keep~="guides"])';

  it('swaps the legend for the labels at the line ends, as a grid, and then gives those up', () => {
    expect(compileFitRules(rules('legend'), { cartesian: cartesian.fit! }).split('\n').slice(0, 6)).toEqual([
      '/* cartesian legend */', '@container view (inline-size < 320px) {',
      '  ' + fig + ' .vg-legend { display: none; }', '  ' + fig + ' .vg-labels { display: block; }', '  ' + fig + ' .vg-labels { display: grid; }', '}',
    ]);
    const css = compileFitRules(CONTAINER_RULES.fit, { cartesian: cartesian.fit! });
    expect(css.indexOf(fig + ' .vg-labels { display: none; }')).toBeGreaterThan(css.lastIndexOf(fig + ' .vg-labels { display: grid; }'));
  });
  it('gives up the second axis before the first, and with it whenever the axes go', () => {
    expect(compileFitRules(rules('axis-2'))).toBe('/* cartesian axis-2 */\n@container view (inline-size < 340px) {\n  ' + fig + ' .vg-y-axis-2 { display: none; }\n}');
    expect(compileFitRules(rules('axes'), { cartesian: cartesian.fit! })).toContain(fig + ' .vg-y-axis-2 { display: none; }');
  });
  it('keeps the labels out until a rule brings them in, and the legend out of a plot that is not split', () => {
    expect(cartesian.css).toContain('.vg-labels { grid-area: labels; display: none; }');
    expect(cartesian.css).toContain('.vg[data-layout="cartesian"]:not([data-parts~="legend"]) .vg-legend { display: none; }');
    expect(of('series').scene.parts).toContain('legend');
    expect(of('diverging').scene.parts).not.toContain('legend');
  });
  it('says the band\'s legend differently, under the same class, and leaves the band\'s alone', () => {
    expect(cartesian.css).toContain('.vg[data-layout="cartesian"] .vg-legend { grid-area: legend; display: flex; flex-wrap: wrap;');
    expect(band.css).toContain('.vg-legend { display: grid;');
  });
});

describe('apart', () => {
  it('leaves labels that are clear of each other where they are', () => {
    expect(apart([10, 60, 110], 14, 150)).toEqual([10, 60, 110]);
  });
  it('sets those that are close a line apart, whatever order they come in', () => {
    expect(apart([50, 52, 20], 14, 150)).toEqual([50, 64, 20]);
    expect(apart([52, 50], 14, 150)).toEqual([64, 50]);
  });
  it('pushes back up from the bottom of the room', () => {
    expect(apart([140, 145, 148], 14, 150)).toEqual([122, 136, 150]);
  });
  it('gives up the lowest when there is no room for all', () => {
    expect(apart([5, 10, 15, 20], 14, 30)).toEqual([2, 16, 30, null]);
    expect(apart([5], 14, 0)).toEqual([0]);
    expect(apart([], 14, 100)).toEqual([]);
  });
  it('holds the series\' labels of a three-line plot apart in a 152 px plot', () => {
    const ys = of('series').scene.nodes.filter((n) => n.part === 'labels').map((n) => (1 - (n as { t: number }).t) * 152);
    const at = apart(ys, 14, 152).filter((y): y is number => y != null).sort((a, b) => a - b);
    expect(at).toHaveLength(3);
    at.slice(1).forEach((y, i) => expect(y - at[i]!).toBeGreaterThanOrEqual(14));
  });
});

describe('hit targets of a split plot', () => {
  // A stacked area stops at the last whole day, as core draws it, so the unfinished one has no mark and no target.
  it.each(names)('tile the plot in %s, one per x that drew a mark', (sample) => {
    const { scene } = of(sample), hits = hitNodes(scene);
    expect(hits.map((h) => h.row)).toEqual(sample === 'area' ? scene.rows!.slice(0, -1) : scene.rows);
    hits.forEach((h, i) => expect(h.x! + h.w!).toBeCloseTo(hits[i + 1]?.x ?? 1, 9));
  });
  it('centre on a group of bars, not on the last of them', () => {
    const { scene } = of('grouped'), hits = hitNodes(scene);
    const bars = scene.nodes.filter((n): n is RectNode => n.part === 'plot' && n.kind === 'rect' && n.row === 'Search');
    expect(bars).toHaveLength(3);
    const lo = Math.min(...bars.map((b) => b.x!)), hi = Math.max(...bars.map((b) => b.x! + b.w!));
    expect(hits[0]!.x! + hits[0]!.c * hits[0]!.w!).toBeCloseTo((lo + hi) / 2, 9);
    // The axis label stands under the same place.
    expect((scene.nodes.find((n) => n.key === 'xtick:Search') as { x: number }).x).toBeCloseTo((lo + hi) / 2, 9);
  });
});

describe('the readout of a split plot', () => {
  const at = (sample: string) => { const { spec, result, scene } = of(sample), q = expand(spec).query; return { q, result, scene, ...rowsAt(scene, q, result) }; };

  it('finds the rows at each x, in the series\' order', () => {
    const { rows, x, split, scene } = at('stacked');
    expect([x, split]).toEqual(['date.day', 'device']);
    expect(rows).toHaveLength(28);
    rows.forEach((r, i) => { expect(r.map((p) => p.device)).toEqual(scene.series); expect(r.every((p) => p['date.day'] === scene.rows![i])).toBe(true); });
  });
  it('keeps a row per point where there is no split, two metrics or one', () => {
    for (const sample of ['diverging', 'dual']) { const { rows, split, result } = at(sample); expect(split).toBeUndefined(); expect(rows.map((r) => r[0])).toEqual(result.rows); }
  });
  it('says the x, the engine\'s total there and every series', () => {
    const { rows, x, split, q, result } = at('stacked'), total = result.totalsBy![x!]![0];
    expect(readoutAt(rows[0]!, total, q, catalog, x!, split!)).toBe('Sep 8: Visitors 416 (Desktop 217, Mobile 173, Tablet 26)');
    expect(readoutAt(rows[27]!, result.totalsBy![x!]![27], q, catalog, x!, split!)).toMatch(/^Oct 5: Visitors \d+ so far \(Desktop \d+, Mobile \d+, Tablet \d+\)$/);
    expect(readoutAt(rows[0]!, undefined, q, catalog, x!, split!)).toBe('Sep 8: Visitors (Desktop 217, Mobile 173, Tablet 26)');
  });
  it('says one pair as any row is said', () => {
    const { rows, q } = at('grouped');
    expect(readout(rows[0]![1]!, q, catalog)).toMatch(/^Search, Mobile: Visitors [\d,]+$/);
  });
  it('reads two units at one x', () => {
    const { rows, q } = at('dual');
    expect(readout(rows[0]![0]!, q, catalog)).toBe('Sep 8: Visitors 416; Revenue 2,453');
  });
});

describe('stepSeries', () => {
  it('goes up from the whole point through the series and stops at the last', () => {
    expect(stepSeries('ArrowUp', -1, 3)).toBe(0);
    expect(stepSeries('ArrowUp', 1, 3)).toBe(2);
    expect(stepSeries('ArrowUp', 2, 3)).toBe(2);
  });
  it('comes back down to the whole point', () => {
    expect(stepSeries('ArrowDown', 1, 3)).toBe(0);
    expect(stepSeries('ArrowDown', 0, 3)).toBe(-1);
    expect(stepSeries('ArrowDown', -1, 3)).toBe(-1);
  });
  it('leaves left and right, and a plot with no series, alone', () => {
    expect(stepSeries('ArrowRight', 0, 3)).toBeNull();
    expect(stepSeries('ArrowUp', -1, 0)).toBeNull();
  });
});

describe('the table of two dimensions', () => {
  it('is a pivot: a row per x, a column per series and the metric over all of them', () => {
    const { spec, result, scene } = of('stacked'), p = pivot(expand(spec).query, result, ['visitors']);
    expect(p.cols).toEqual(scene.series);
    expect(p.rows.map((r) => r.key)).toEqual(scene.rows);
    expect(p.rows[0]!.cells).toEqual([217, 173, 26, 416]);
  });
  it('takes every total from the engine', () => {
    const { spec, result } = of('grouped'), p = pivot(expand(spec).query, result, ['visitors']);
    expect(p.foot).toEqual([...result.totalsBy!.device!.map((t) => t.visitors), result.totals.visitors]);
    expect(p.rows.map((r) => r.cells.at(-1))).toEqual(result.totalsBy!.channel!.map((t) => t.visitors));
  });
  it('leaves a cell empty where the result has no row or no total', () => {
    const { spec, result } = of('grouped'), q = expand(spec).query;
    const p = pivot(q, { ...result, rows: result.rows.slice(1), totalsBy: undefined }, ['visitors']);
    // With no totals the columns run as the rows come: Mobile, Tablet, then Desktop, which Search has lost.
    expect(p.rows[0]!.cells).toEqual([result.rows[1]!.visitors, result.rows[2]!.visitors, undefined, undefined]);
  });
});
