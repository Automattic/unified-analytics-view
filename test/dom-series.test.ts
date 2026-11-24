import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, RAMP_BLOCK, SIZE_KEY_BLOCK, expand, pathD, type PathNode, type RectNode } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { compileFitRules } from '../packages/dom/src/compile.ts';
import { LEGEND_CSS, SPLIT_PLAIN } from '../packages/dom/src/chrome/legend.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { KEYS_CSS, hitNodes, readout, readoutAt, readoutLines, rowsAt, stepSeries } from '../packages/dom/src/keys.ts';
import { apart, thinLabels } from '../packages/dom/src/measure.ts';
import { mix, resample } from '../packages/dom/src/motion.ts';
import { pivot } from '../packages/dom/src/table.ts';
import { ofUnbounded } from './helpers.ts';

// What <ua-view> adds for a plot split into series, a stack, a signed scale and a second unit, where it is a plain
// function or a string. That they draw, fit and move is checked in a browser on the bench.

const of = (sample: string, scenario: Scenario = 'typical', range = '28d') => {
  const spec = { ...moreSamples[sample]!.spec, query: { ...moreSamples[sample]!.spec.query, range } }, result = runQuery(spec.query, scenario);
  return { spec, result, scene: ofUnbounded(spec, result).scene };
};
const names = Object.keys(moreSamples).filter((k) => of(k).scene.layout === 'cartesian' && of(k).scene.scale !== 'linear');   // the plots that share x among rows; points and other layouts have their own tests

describe('bars', () => {
  it('run from where they start to their value, whichever is the higher', () => {
    expect(cartesian.css).toContain('inset-block-end: calc(min(var(--uav-v0, 0), var(--uav-v)) * 100%);');
    expect(cartesian.css).toContain('block-size: max(0px, calc(max(var(--uav-v) - var(--uav-v0, 0), var(--uav-v0, 0) - var(--uav-v)) * 100% - var(--uav-gap-y, 0px)));');
  });
  it('are parted from the next in their row by a line\'s width: side by side at the far edge, in a stack at the top', () => {
    expect(cartesian.css).toContain('inline-size: calc(var(--uav-w) * 100% - var(--uav-gap-x, 0px));');
    expect(cartesian.css).toContain('.uav-bars i[data-beside] { --uav-gap-x: var(--ua-charts-stroke-width-rule, 1px); }');
    expect(cartesian.css).toContain('.uav-bars i[data-stacked] { --uav-gap-y: var(--ua-charts-stroke-width-rule, 1px); }');
  });
  it('have a start to read in a stack and below zero, and none in a group', () => {
    const rects = (sample: string) => of(sample).scene.nodes.filter((n): n is RectNode => n.part === 'plot' && n.kind === 'rect');
    expect(rects('stacked').filter((n) => n.series !== 'Desktop').every((n) => n.y2! > 0 && n.y! >= n.y2!)).toBe(true);
    expect(rects('diverging').some((n) => n.y! < n.y2!)).toBe(true);
    expect(rects('grouped').every((n) => n.y2 == null)).toBe(true);
  });
});

describe('a split path', () => {
  const areas = (range: string) => of('area', 'typical', range).scene.nodes.filter((n): n is PathNode => n.kind === 'path' && !n.note);

  it.each(names)('has a key of its own in %s, so a morph holds to its series', (sample) => {
    const keys = of(sample).scene.nodes.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('keeps its key when the rows change', () => {
    expect(areas('7d').map((n) => n.key)).toEqual(areas('28d').map((n) => n.key));
  });
  it('morphs where it starts as well as where it ends, and lands on the shape core drew', () => {
    const from = areas('28d')[1]!, to = areas('7d')[1]!, old = resample(from.points, to.points);
    expect(old.every((p) => p.y2! > 0 && p.y2! < p.y)).toBe(true);
    const half = mix(old, to.points, 0.5);
    half.forEach((p, i) => expect(p.y2).toBeCloseTo((old[i]!.y2! + to.points[i]!.y2!) / 2, 9));
    expect(pathD(mix(old, to.points, 1), to.curve, to.fill)).toBe(to.d);
  });
  it('gains a start when it had none, and loses one', () => {
    expect(mix([{ x: 0, y: 0.4 }], [{ x: 0, y: 0.8, y2: 0.2 }], 0.5)).toEqual([{ x: 0, y: 0.6000000000000001, y2: 0.1 }]);
    expect(mix([{ x: 0, y: 0.8, y2: 0.2 }], [{ x: 0, y: 0.4 }], 1)).toEqual([{ x: 0, y: 0.4, y2: 0 }]);
  });
});

describe('the cartesian layout\'s guides', () => {
  const rules = (id: string) => CONTAINER_RULES.fit.filter((r) => r.layout === 'cartesian' && r.id === id);
  const fig = '.uav[data-layout="cartesian"]:not([data-keep~="guides"])';

  it('swaps the legend for the labels at the line ends, as a grid, where there are ends to label', () => {
    // Bars and dots have none, so the rule asks for a line (or, by its twin, an area) and their legend stays.
    // The condition is in :where(), which weighs nothing: a rule further down the ladder still overrides this one.
    const lines = fig.replace(':not', ':where([data-marks~="line"]):not');
    expect(compileFitRules(rules('legend'), { cartesian: cartesian.fit! }).split('\n').slice(0, 6)).toEqual([
      '/* cartesian legend */', '@container uav-view (inline-size < 319.5px) {',
      '  ' + lines + ' .uav-legend { display: none; }', '  ' + lines + ' .uav-labels { display: block; }', '  ' + lines + ' .uav-labels { display: grid; }', '}',
    ]);
    expect(compileFitRules(rules('legend-area'), { cartesian: cartesian.fit! })).toBe(compileFitRules(rules('legend'), { cartesian: cartesian.fit! }).replaceAll('"line"', '"area"').replaceAll('legend */', 'legend-area */'));
    expect(CONTAINER_RULES.fit.filter((r) => r.layout === 'cartesian' && r.hide.includes('legend') && !r.hide.includes('plot')).map((r) => [r.id, r.mark ?? 'any'])).toEqual([['legend', 'line'], ['legend-area', 'area'], ['labels', 'any']]);
  });
  // A key under the plot takes a line of its own, and a view with the key to sizes states its height: so it states the ramp's line too.
  it('is taller by the ramp\'s line where dots are painted by one metric and sized by another', () => {
    expect(cartesian.css).toContain('.uav[data-layout="cartesian"] .uav-ramp { grid-column: 1 / -1; }');
    expect(cartesian.css).toMatch(new RegExp('\\[data-parts~="size"\\]\\[data-parts~="ramp"\\] \\{ --uav-body-block: calc\\(.* \\+ ' + (SIZE_KEY_BLOCK + RAMP_BLOCK) + 'px\\); \\}'));
  });
  it('gives both up with the axes, and with them the colours they were the key to', () => {
    const css = compileFitRules(CONTAINER_RULES.fit, { cartesian: cartesian.fit! });
    expect(css.indexOf(fig + ' :is(.uav-labels, .uav-legend, .uav-ramp) { display: none; }')).toBeGreaterThan(css.lastIndexOf(' .uav-labels { display: grid; }'));
    expect(css.match(/\[data-layout="cartesian"\]\[data-marks/)).toBeNull();
    expect(compileFitRules(rules('labels'), { cartesian: cartesian.fit! }).split('\n').slice(0, 7)).toEqual([
      '/* cartesian labels */', '@container uav-view (inline-size < 279.5px) {', '  ' + fig + ' :is(.uav-labels, .uav-legend, .uav-ramp) { display: none; }', '  ' + fig + ' { --uav-split: plain; }',
      ...Object.entries(SPLIT_PLAIN).map(([sel, decl]) => '  ' + fig + ' ' + sel + ' { ' + decl + ' }'), '}',
    ]);
    // What a legend keyed is the first series' colour, and a tint of it where the mark was a tint.
    expect(SPLIT_PLAIN).toEqual({
      '[data-legend]:not([data-tone])': '--uav-paint: var(--ua-charts-color-series-1, currentColor) !important;',
      '[data-legend][data-tone]': '--uav-paint: var(--ua-charts-color-series-1-soft, color-mix(in srgb, var(--ua-charts-color-series-1, currentColor) 14%, transparent)) !important;',
    });
  });
  it('keeps the second axis as long as the first, and takes what is drawn on it when the axes go', () => {
    expect(rules('axis-2')).toEqual([]);
    expect(compileFitRules(rules('axes'), { cartesian: cartesian.fit! })).toContain(fig + ' :is(.uav-x-axis, .uav-y-axis, .uav-y-axis-2, .uav-grid, [data-axis="2"], .uav-size) { display: none; }');
  });
  it('keeps the labels out until a rule brings them in, and the legend out of a plot that is not split', () => {
    expect(cartesian.css).toContain('.uav-labels { grid-area: labels; display: none; }');
    expect(LEGEND_CSS).toContain('.uav:not([data-parts~="legend"]) .uav-legend { display: none; }');
    expect(of('series').scene.parts).toContain('legend');
    expect(of('diverging').scene.parts).not.toContain('legend');
  });
  it('says the band\'s legend differently, under the same class, and leaves the band\'s alone', () => {
    expect(cartesian.css).toContain('.uav[data-layout="cartesian"] .uav-legend { grid-area: legend; }');
    expect(LEGEND_CSS).toContain('.uav-legend[data-names] { display: flex; flex-wrap: wrap;');
    expect(LEGEND_CSS).toContain('.uav-legend { display: grid;');
  });
});

describe('thinLabels', () => {
  it('hands on only labels with a box, and marks the ones given up, keeping the rest', () => {
    const el = (rects: number) => ({ rects, thin: false, getClientRects: () => ({ length: rects }), toggleAttribute(_: string, on: boolean) { this.thin = on; } });
    const els = [el(1), el(0), el(1)], root = { querySelectorAll: () => els } as unknown as ParentNode;
    let seen = 0;
    thinLabels(root, 'span', (labels) => { seen = labels.length; return [false, true]; });
    expect([seen, els.map((e) => e.thin)]).toEqual([2, [false, false, true]]);
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
    const ys = of('series').scene.nodes.filter((n) => n.part === 'labels').map((n) => (1 - (n as { y: number }).y) * 152);
    const at = apart(ys, 14, 152).filter((y): y is number => y != null).sort((a, b) => a - b);
    expect(at).toHaveLength(3);
    at.slice(1).forEach((y, i) => expect(y - at[i]!).toBeGreaterThanOrEqual(14));
  });
});

describe('hit targets of a split plot', () => {
  // Every row drew a mark, the unfinished day of a stacked area among them, so every row has a target.
  it.each(names)('tile the plot in %s, one per x that drew a mark', (sample) => {
    const { scene } = of(sample), hits = hitNodes(scene);
    expect(hits.map((h) => h.row)).toEqual(scene.rows);
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
  it('sets the same out as a head and a line to each series, for the readout that draws a swatch beside each', () => {
    const { rows, x, split, q, result } = at('stacked'), total = result.totalsBy![x!]![0];
    expect(readoutLines(rows[0]!, total, q, catalog, x!, split!)).toEqual({ head: 'Sep 8: Visitors 416', lines: [
      { series: 'Desktop', name: 'Desktop', value: '217' }, { series: 'Mobile', name: 'Mobile', value: '173' }, { series: 'Tablet', name: 'Tablet', value: '26' }] });
    expect(readoutLines(rows[27]!, result.totalsBy![x!]![27], q, catalog, x!, split!).head).toMatch(/^Oct 5: Visitors \d+ so far$/);
    expect(readoutLines(rows[0]!, undefined, q, catalog, x!, split!).head).toBe('Sep 8: Visitors');
    expect(KEYS_CSS).toContain('.uav-readout[data-lines] { display: grid; grid-template-columns: 8px minmax(0, 1fr) auto;');
  });
  it('says a series with no value at a point in words, as the readout of that series alone does', () => {
    const { rows, x, split, q, result } = at('stacked'), total = result.totalsBy![x!]![0], none = rows[0]!.map((r, i) => (i ? r : { ...r, visitors: null }));
    expect(readoutAt(none, total, q, catalog, x!, split!)).toBe('Sep 8: Visitors 416 (Desktop no data, Mobile 173, Tablet 26)');
    expect(readoutLines(none, total, q, catalog, x!, split!).lines[0]!.value).toBe('No data');
    expect(readout(none[0]!, q, catalog, [])).toBe('Sep 8, Desktop: No data');
  });
  it('finds the rows of a plot split by detail the same way, in the order of scene.detail', () => {
    const { rows, x, split, scene } = at('spaghetti');
    expect([x, split, scene.series]).toEqual(['date.day', 'country', undefined]);
    expect(rows).toHaveLength(28);
    rows.forEach((r, i) => { expect(r.map((p) => p.country)).toEqual(scene.detail); expect(r.every((p) => p['date.day'] === scene.rows![i])).toBe(true); });
    expect(hitNodes(scene).map((h) => h.row)).toEqual(scene.rows);
  });
  it('says how many series a mass has and which has the most, and not every one', () => {
    const { rows, x, split, q, result } = at('spaghetti'), total = result.totalsBy![x!]![0];
    expect(readoutAt(rows[0]!, total, q, catalog, x!, split!, true)).toBe('Sep 8: Visitors 416 (15 countries, the most United States 137)');
    expect(readoutAt(rows[0]!, undefined, q, catalog, x!, split!, true)).toBe('Sep 8: Visitors (15 countries, the most United States 137)');
    expect(readoutAt(rows[0]!.slice(1, 2), undefined, q, catalog, x!, split!, true)).toMatch(/^Sep 8: Visitors \(1 country, the most India \d+\)$/);
    expect(readoutAt(rows[0]!.map((r) => ({ ...r, visitors: null })), undefined, q, catalog, x!, split!, true)).toBe('Sep 8: Visitors (15 countries)');
    // One of them, chosen, is said as any pair is.
    expect(readout(rows[0]![1]!, q, catalog, [])).toMatch(/^Sep 8, India: Visitors \d+$/);
  });
  it('draws the chosen line of a mass whole', () => {
    expect(KEYS_CSS).toContain('.uav-body[data-mass] .uav-plot path[data-emphasis="highlighted"] { opacity: 1 !important; }');
  });
  it('says one pair as any row is said', () => {
    const { rows, q } = at('grouped');
    expect(readout(rows[0]![1]!, q, catalog, [])).toMatch(/^Search, Mobile: Visitors [\d,]+$/);
  });
  it('reads two units at one x', () => {
    const { rows, q } = at('dual');
    expect(readout(rows[0]![0]!, q, catalog, [])).toBe('Sep 8: Visitors 416; Revenue $2,453');
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
