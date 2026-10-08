import { max, min } from 'd3-array';
import { scaleBand, scaleLinear, scalePoint, scaleQuantize } from 'd3-scale';
import { CHAR_W, delta, fmt, fmtDay, fmtPct, formatDimension, formatValue } from './format.ts';
import { arcD, pathD } from './path.ts';
import { leader } from './prose.ts';
import type { ArcNode, Catalog, Guides, Layer, Mark, Part, PathNode, PlanShape, Polarity, Query, Result, Role, Row, Scene, SceneNode, TextNode } from './types.ts';

/* Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a part, a paint token (never a colour) and a layer: "data" or "guide".
 * Nothing here is in pixels: positions are ratios of the part's box. */
type Body = Pick<Scene, 'nodes' | 'rows' | 'series' | 'ys' | 'scale'>;

const num = (r: Row, f: string) => r[f] as number;
/** The role a layer plays: the one it states, or the one its mark and series imply. */
export function roleOf(l: Layer): Role {
  return l.role || (l.series === 'previous' ? 'comparison' : l.mark === 'rule' ? 'reference' : 'primary');
}
/* A layer's key names it by role and mark, and does not count the layers before it, so it holds when another layer
 * drops. Two layers of one role and mark are told apart by a count among themselves alone: `primary:text`, then
 * `primary:text#2`. Layers of the previous series, and of a row's delta, are counted last. A reduction drops whole roles, and missing prior
 * data drops the whole previous series, so neither can move a count. */
function layerKeys(layers: Layer[]): string[] {
  const seen: Record<string, number> = {}, keys: string[] = [];
  for (const prev of [false, true]) layers.forEach((l, i) => {
    if (!!l.series !== prev) return;
    const base = roleOf(l) + ':' + l.mark, n = (seen[base] = (seen[base] || 0) + 1);
    keys[i] = n > 1 ? base + '#' + n : base;
  });
  return keys;
}
export function isDim(catalog: Catalog, f: unknown): f is string { return typeof f === 'string' && f in catalog.dimensions; }

/** How a plot shares x among its rows. The scene uses it on 0 to 1 and place() in pixels, so both divide the room the same way. */
export function xScale(rows: string[], scale: 'band' | 'point', lo: number, hi: number) {
  const band = scaleBand<string>().domain(rows).range([lo, hi]).paddingInner(0.26).paddingOuter(0.1);
  const point = scalePoint<string>().domain(rows).range([lo, hi]);
  const x = (k: string) => (scale === 'band' ? band(k) : point(k)) as number;
  const w = scale === 'band' ? band.bandwidth() : 0;
  return { x, w, cx: (k: string) => x(k) + w / 2 };
}

/* What a mark in the plot is drawn with: its layer's key, role and paint, the rows it has a value for, and the plot's scales. */
interface Draw {
  id: string;
  /** The series this is, where the layer is split into them. `rows` are then that series' alone. */
  series?: string;
  role: Role;
  paint: string;
  prev: boolean;
  rows: Row[];
  k: (r: Row) => string;
  /** On a linear x a row's bin has a width of its own, `span`, and `w` is nothing. */
  unit: ReturnType<typeof xScale> & { span?: (k: string) => number };
  /** A value on x, as a ratio of the plot's width, where x is linear. */
  xv?: (n: number) => number;
  /** The plot sets one metric against another, and its dots are a part of their own, `points`. */
  points?: boolean;
  /** The metric the plot's dots are sized by, and the most it holds. */
  size?: { field: string; top: number };
  /** A value on y, as a ratio of the plot's height. */
  v: (n: number) => number;
  /** Where a row's mark starts and where it ends, as ratios: from the baseline, or from the series stacked under it. */
  ends: (r: Row) => [number, number];
  /** A bar's place among those beside it at one x: which, of how many. */
  slot?: [number, number];
  /** For a bar with two ends: its metric's polarity, which turns the paint of the way it goes. */
  polarity?: Polarity;
}
type MarkFn = (l: Layer, d: Draw) => SceneNode[];
/** A field's metric: the one a companion came with, or itself. */
const metricOf = (catalog: Catalog, f: unknown) => (typeof f === 'string' ? catalog.metrics[f.split('@')[0]!] : undefined);
/** The paint of a bar that runs from one value to another: good or bad by which way it goes, turned by its metric's
 * polarity. One whose metric has no better way keeps its own paint. Positions are compared as they are drawn. */
const toned = (polarity: Polarity | undefined, from: number, to: number, paint: string) => (!polarity || polarity === 'none' ? paint : (to < from) === (polarity === 'down') ? 'delta.good' : 'delta.bad');

const path: MarkFn = (l, { id: layer, series, role: role0, paint, prev, rows: pts, k, unit, ends }) => {
  const id = series == null ? layer : layer + ':' + series, role = series == null ? { role: role0 } : { role: role0, series };
  const whole = pts.filter((r) => prev || !r.partial);
  if (!whole.length) return [];
  // An area's points say where it starts only when that is not the bottom of the plot.
  const points = (rs: Row[]): PathNode['points'] => rs.map((r) => { const [v0, v] = ends(r); return { row: k(r), x: unit.cx(k(r)), v, ...(l.mark === 'area' && v0 && { v0 }) }; });
  // An area under a line is a tint. Stacked, each is the mark itself.
  if (l.mark === 'area') return [{ key: id, part: 'plot', kind: 'path', d: pathD(points(whole), 'monotone', true), points: points(whole), curve: 'monotone', fill: true, paint, ...(!(l.stack && series != null) && { opacity: 0.14 }), layer: 'data', ...role }];
  const nodes: SceneNode[] = [{ key: id, part: 'plot', kind: 'path', d: pathD(points(whole), 'monotone'), points: points(whole), curve: 'monotone', paint, width: prev ? 1.5 : 2, dash: prev ? '3 3' : null, layer: 'data', ...role }];
  const tail = prev ? [] : [whole[whole.length - 1]!].concat(pts.filter((r) => r.partial));
  if (tail.length > 1) nodes.push({ key: id + ':partial', part: 'plot', kind: 'path', d: pathD(points(tail)), points: points(tail), paint, width: 2, dash: '2 4', opacity: 0.75, layer: 'data', ...role, note: 'incomplete bucket' });
  return nodes;
};
const bar: MarkFn = (_l, { id, series, role, paint, prev, rows, k, unit, ends, polarity, slot: [j, n] = [0, 1] }) => rows.map((r) => {
  const [v0, v] = ends(r), w = (unit.span ? unit.span(k(r)) : unit.w) / n;
  return { key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'plot', kind: 'rect', x: unit.x(k(r)) + j * w, w, v, ...(v0 && { v0 }), row: k(r), ...(series != null && { series }),
    paint: toned(polarity, v0, v, paint), opacity: r.partial && !prev ? 0.4 : 1, layer: 'data', role };
});
const rule: MarkFn = (l, { id, series, role, rows, k, unit, ends, v, xv }) => {
  const { x, y } = l.encode || {};
  // A field on y: a segment for each row, standing at its x from one of its values to another, or up from zero where it has one end.
  if (typeof y === 'string') return rows.map((r): SceneNode => {
    const [t, t2] = ends(r), at = unit.cx(k(r));
    return { key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'plot', kind: 'line', x: at, x2: at, t, t2, row: k(r), ...(series != null && { series }), paint: l.paint || 'ink', layer: 'data', role };
  });
  // A constant on x stands the height of the plot. Its label sits beside it, at the top.
  if (typeof x === 'number') {
    if (!xv) throw new Error('A rule at x: ' + x + ' needs a scale to be measured on, and this plot has a time or a category on x. Put the rule on y, or a metric or a number dimension on x.');
    const at = xv(x), up: SceneNode[] = [{ key: id, part: 'plot', kind: 'line', x: at, x2: at, t: 0, t2: 1, paint: 'rule', dash: '5 3', width: 1.5, layer: 'data', role }];
    if (l.label) up.push({ key: id + ':label', part: 'plot', kind: 'text', x: at, t: 1, text: l.label, anchor: 'start', font: 'tick', paint: 'rule', halo: true, layer: 'guide', role });
    return up;
  }
  if (typeof y !== 'number') throw new Error('A rule is drawn at a number, and this one has none on x or on y. Encode one, for example { "y": 1000 }.');
  const t = v(y);
  const nodes: SceneNode[] = [{ key: id, part: 'plot', kind: 'line', t, paint: 'rule', dash: '5 3', width: 1.5, layer: 'data', role }];
  if (l.label) nodes.push({ key: id + ':label', part: 'plot', kind: 'text', t, text: l.label, anchor: 'end', font: 'tick', paint: 'rule', halo: true, layer: 'guide', role });
  return nodes;
};
const SIZES = 4;    // the steps a value on `size` falls into. How big each is, in pixels, is the painter's
/** The step for a value, 1 to SIZES, by area: the square root of its share of the most. */
const sizeStep = (n: number, top: number) => Math.min(SIZES, Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n) / top) * SIZES)));
// A point for each row, at its values on x and y. One that is sized lets what is under it show.
const dot: MarkFn = (l, { id, series, role, paint, rows, k, unit, ends, size, points }) => {
  const sized = l.encode!.size != null && size;
  return rows.map((r): SceneNode => ({ key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: points ? 'points' : 'plot', kind: 'circle', pulse: false, x: unit.cx(k(r)), t: ends(r)[1],
    ...(sized && { size: sizeStep(num(r, sized.field), sized.top), opacity: 0.7 }), row: k(r), ...(series != null && { series }), paint, layer: 'data', role }));
};
// A label on each row's point, in a part of its own over the plot, so a rule can give them all up. Each has its place
// among them, the largest point first: by the metric the dots are sized by, or else by its own y. A painter gives up
// the ones that collide from the last, since only it knows how wide a label is (reference, Open 5).
const label: MarkFn = (l, { id, series, role, rows, k, unit, ends, size }) => {
  const { y, text: f } = l.encode || {};
  if (typeof y !== 'string' || typeof f !== 'string') throw new Error('A "text" layer in a plot needs a field on y, for where each label sits, and one on text, for what it says: for example { "x": "<a metric>", "y": "<a metric>", "text": "<the dimension>" }.');
  const by = size ? size.field : y, order = rows.slice().sort((a, b) => num(b, by) - num(a, by));
  return rows.map((r): TextNode => ({ key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'point-labels', kind: 'text', x: unit.cx(k(r)), t: ends(r)[1], text: typeof r[f] === 'number' ? fmt(r[f] as number) : String(r[f]),
    anchor: 'middle', font: 'tick', paint: 'ink', halo: true, row: k(r), ...(series != null && { series }), rank: order.indexOf(r) + 1, layer: 'guide', role }));
};
// A short stroke across its row's band, at its value.
const tick: MarkFn = (l, { id, series, role, rows, k, unit, ends }) => rows.map((r): SceneNode => {
  const x = unit.x(k(r)), t = ends(r)[1];
  return { key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'plot', kind: 'line', x, x2: x + (unit.span ? unit.span(k(r)) : unit.w), t, t2: t, row: k(r), ...(series != null && { series }), paint: l.paint || 'ink', width: 2, layer: 'data', role };
});
/* The marks a plot draws, by name. A new mark is a function here. */
const PLOT_MARKS: Partial<Record<Mark, MarkFn>> = { line: path, area: path, bar, rule, dot, text: label, tick };

const SERIES = 6;   // paint tokens run from series.1 to series.6

/** The dimension a plot's layers put on x. */
export function xDimOf(catalog: Catalog, layers: Layer[]): string | undefined {
  return layers.map((l) => l.encode && l.encode.x).find((f) => isDim(catalog, f)) as string | undefined;
}
/** The units a plot's layers measure in, in layer order: a y scale each. Metrics of one catalog `unit` share a scale, and
 * shares of a whole are a unit of their own. A layer with a constant on y has none, and is drawn on the first. */
function unitOf(catalog: Catalog, l: Layer, xField?: string): string | null {
  const y = l.encode && l.encode.y;
  if (typeof y !== 'string' || !(y in catalog.metrics)) return null;
  return l.stack === 'normalize' && splitOf(catalog, l, xField) ? 'share' : catalog.metrics[y]!.unit;
}
export function unitsOf(catalog: Catalog, layers: Layer[]): string[] {
  const x = xDimOf(catalog, layers), units = [...new Set(layers.map((l) => unitOf(catalog, l, x)).filter((u): u is string => u != null))];
  if (units.length > 2) throw new Error('These layers measure in ' + units.length + ' units (' + units.join(', ') + '), and a plot has a y axis on each side at most. Remove a layer, or draw them as separate views.');
  return units;
}
/** Whether a plot's layers are split into series, and whether one of those is a line or an area, which has an end to label. */
export function seriesOf(catalog: Catalog, layers: Layer[]): { lines: boolean } | null {
  const x = xDimOf(catalog, layers), split = layers.filter((l) => splitOf(catalog, l, x));
  return split.length ? { lines: split.some((l) => l.mark === 'line' || l.mark === 'area') } : null;
}
/** The dimension a layer in a plot is split into series by: the one on `color`, unless it is the one on x. */
export function splitOf(catalog: Catalog, l: Layer, xField?: string): string | null {
  const c = l.encode && l.encode.color;
  return isDim(catalog, c) && c !== xField ? c : null;
}

// A dimension on x, a metric on y, and with a second dimension on color a series for each of its values.
// The scales are derived here, once: x from its dimension, and a y for each unit the layers measure in.
// Each layer's mark draws against them.
// With a metric on x as well, a row is still one value of a dimension: the query's, `by`. `xField` is the dimension the
// rows are keyed by either way, and `xOn` the field x is measured along where that is a linear scale.
function sceneCartesian(catalog: Catalog, layers: Layer[], guides: Guides, result: Result, by?: string): Body {
  const nodes: SceneNode[] = [], rows = result.rows;
  const xDim = xDimOf(catalog, layers), xField = (xDim || by)!;
  const xOn = !xDim ? (layers.map((l) => l.encode && l.encode.x).find((f) => typeof f === 'string') as string) : catalog.dimensions[xDim]!.type === 'number' ? xDim : null;
  const k = (r: Row) => String(r[xField]), keys = [...new Set(rows.map(k))];
  // A view has two dimensions at most and one is on x, so there is one to split by. Its order is the engine's, not the rows':
  // paint follows it, so a value keeps its colour when the ranking moves.
  const split = layers.map((l) => splitOf(catalog, l, xField)).find(Boolean) || null;
  const series = split ? [...new Set(((result.totalsBy && result.totalsBy[split]) || rows).map((r) => r[split] as string))] : [];
  if (series.length > SERIES) throw new Error('Splitting by "' + split + '" makes ' + series.length + ' series, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
  const isTime = catalog.dimensions[xField]!.type === 'time';
  const shared = layers.some((l) => l.mark === 'bar' || l.mark === 'tick') ? 'band' : 'point', scale = xOn ? 'linear' : shared;
  const yField = (l: Layer) => (l.series === 'previous' ? l.encode!.y + '@previous' : (l.encode!.y as string));
  // Where each row's mark starts and ends, in its metric's own terms: from zero, or from the series stacked under it.
  // A stack runs in the series' order, the first at the bottom, and a value below zero stacks downward.
  // Normalized, each is a share of the engine's total for its x, so with a `limit` a stack stops short of the top.
  const whole = new Map(((result.totalsBy && result.totalsBy[xField]) || []).map((r) => [k(r), r]));
  const spans = layers.map((l) => {
    const out = new Map<Row, [number, number]>();
    if (typeof (l.encode && l.encode.y) !== 'string') return out;
    const f = yField(l), share = l.stack === 'normalize', y2 = l.encode!.y2;
    // A second end: the mark runs from one of the engine's values to another, and stands on nothing. A row with either missing has no mark.
    if (y2 != null) { rows.forEach((r) => { const to = typeof y2 === 'number' ? y2 : r[y2]; if (r[f] != null && to != null) out.set(r, [num(r, f), to as number]); }); return out; }
    // A tick that is a `reference` stands at its metric's catalog `target`, as a gauge's mark does. With no target there is none.
    if (l.mark === 'tick' && roleOf(l) === 'reference') { const to = metricOf(catalog, f)?.target; if (to != null) rows.forEach((r) => out.set(r, [0, to])); return out; }
    if (!l.stack || !splitOf(catalog, l, xField)) { rows.forEach((r) => { if (r[f] != null) out.set(r, [0, num(r, f)]); }); return out; }
    if (share && rows.length && !whole.size) throw new Error('stack: "normalize" divides by the engine\'s total for each "' + xField + '", and this result has no totalsBy. Return it from the query layer, or use stack: "zero".');
    const up: Record<string, number> = {}, down: Record<string, number> = {};
    series.forEach((s) => rows.forEach((r) => {
      if (r[split!] !== s || r[f] == null) return;
      const n = num(r, f), run = n < 0 ? down : up, from = run[k(r)] || 0, all = share ? (whole.get(k(r))![f] as number) || 1 : 1;
      run[k(r)] = from + n;
      out.set(r, [from / all, (from + n) / all]);
    }));
    // Centred, a stack sits half on each side of zero.
    if (l.stack === 'center') out.forEach((ends, r) => { const mid = ((up[k(r)] || 0) + (down[k(r)] || 0)) / 2; out.set(r, [ends[0] - mid, ends[1] - mid]); });
    return out;
  });
  // A scale for each unit. It holds zero and whatever is on either side of it, so a mark below zero hangs from the zero
  // line and not from the bottom of the plot. Always rounded to 4 ticks: a scene with no size cannot pick a tick count
  // by height. Shares run to the whole.
  const units = unitsOf(catalog, layers), scaleOf = (l: Layer) => scales[Math.max(0, units.indexOf(unitOf(catalog, l, xField)!))]!;
  const scales = (units.length ? units : ['']).map((u, ui) => {
    const vals: number[] = [];
    layers.forEach((l, i) => {
      const y = l.encode && l.encode.y;
      if (typeof y === 'number') { if (!ui) vals.push(y); } else if (Math.max(0, units.indexOf(unitOf(catalog, l, xField)!)) === ui) spans[i]!.forEach((ends) => vals.push(...ends));
    });
    const share = u === 'share', lo = Math.min(0, min(vals) ?? 0), hi = share ? 1 : Math.max(0, max(vals) ?? 0) || (lo ? 0 : 1);
    const y = scaleLinear().domain([lo, hi]);
    if (guides.y) y.nice(4);
    const [bottom, top] = y.domain() as [number, number];
    return { v: (n: number) => (n - bottom) / (top - bottom), ticks: y.ticks(4), coarse: y.ticks(2), text: (t: number) => (share ? fmtPct(t) : fmt(t, true)) };
  });
  let unit: Draw['unit'] = xScale(keys, shared, 0, 1), xv: Draw['xv'];
  if (xOn) {
    // A linear x. A row sits at its value, or where it has a bin, `<dimension>@end`, across it. A metric's scale holds
    // zero and is rounded, as y's is. A dimension's runs from its first bin to its last and no further, so bars meet
    // the edges of the plot. Its ticks are y's too, and all but the two ends are ranked, as the middle date is.
    const at = new Map(rows.map((r) => [k(r), r])), lo = (key: string) => num(at.get(key)!, xOn), hi = (key: string) => (at.get(key)![xOn + '@end'] as number | undefined) ?? lo(key);
    const vals = keys.flatMap((key) => [lo(key), hi(key)]).concat(layers.map((l) => l.encode && l.encode.x).filter((x): x is number => typeof x === 'number'));
    const x = scaleLinear().domain(xDim ? [min(vals) ?? 0, max(vals) ?? 1] : [Math.min(0, min(vals) ?? 0), Math.max(0, max(vals) ?? 0) || 1]);
    if (guides.x && !xDim) x.nice(4);
    const [left, right] = x.domain() as [number, number], to = (n: number) => (n - left) / (right - left || 1);
    xv = to;
    unit = { x: (key) => to(lo(key)), w: 0, cx: (key) => to((lo(key) + hi(key)) / 2), span: (key) => to(hi(key)) - to(lo(key)) };
    if (guides.x && keys.length) x.ticks(4).forEach((t, i, all) => {
      nodes.push({ key: 'xtick:' + t, part: 'x-axis', kind: 'text', x: to(t), text: fmt(t, true), anchor: to(t) <= 0 ? 'start' : to(t) >= 1 ? 'end' : 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...(i > 0 && i < all.length - 1 && { rank: 1 }) });
    });
  }
  // One metric sizes the dots of a plot, whichever layers name it.
  const sizeBy = layers.map((l) => l.encode && l.encode.size).find((f): f is string => typeof f === 'string');
  const size = sizeBy ? { field: sizeBy, top: max(rows, (r) => num(r, sizeBy)) || 1 } : undefined;

  if (guides.y) scales.forEach(({ v, ticks, coarse, text }, ui) => ticks.forEach((t) => {
    // A short plot keeps the ticks a count of 2 would give on this scale. The rest are ranked, to be given up there.
    const rank = coarse.includes(t) ? {} : { rank: 1 };
    // The second scale's ticks are on the far side, keyed by its unit. The grid is the first scale's alone.
    if (ui) { if (guides.y2) nodes.push({ key: 'ytick:' + units[ui] + ':' + t, part: 'y-axis-2', kind: 'text', t: v(t), text: text(t), anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank }); return; }
    if (guides.grid) nodes.push({ key: 'grid:' + t, part: 'plot', kind: 'line', t: v(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide', ...rank });
    nodes.push({ key: 'ytick:' + t, part: 'y-axis', kind: 'text', t: v(t), text: text(t), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank });
  }));
  if (guides.x && keys.length && !xOn) {
    const last = keys.length - 1;
    // First, middle and last, each once: one row has one tick. The prototype emits it twice, under one key.
    const idx = isTime ? [...new Set([0, Math.floor(last / 2), last])] : keys.map((_, i) => i);
    idx.forEach((i, j) => {
      const mid = isTime && j > 0 && j < idx.length - 1;                  // given up on a narrow plot
      nodes.push({ key: 'xtick:' + keys[i], part: 'x-axis', kind: 'text', x: unit.cx(keys[i]!), row: keys[i]!, text: isTime ? fmtDay(keys[i]!) : String(keys[i]),
        anchor: !isTime ? 'middle' : j === 0 ? 'start' : j === idx.length - 1 ? 'end' : 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...(mid && { rank: 1 }) });
    });
  }
  const ids = layerKeys(layers), ends = new Map<string, number>();
  layers.forEach((l, i) => {
    const draw = PLOT_MARKS[l.mark], prev = l.series === 'previous', span = spans[i]!;
    if (!draw) throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use line, area, bar, rule, dot, text or tick.');
    // A bar stands on a row's share of x, and a tick lies across it. A metric there gives it none, and neither does a number dimension that came with no bins.
    if ((l.mark === 'bar' || l.mark === 'tick') && xOn && !xDim) throw new Error('Layer ' + (i + 1) + ' is a ' + l.mark + ' with the metric "' + xOn + '" on x, and a ' + l.mark + ' needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
    if (l.mark === 'bar' && xOn && rows.length && rows[0]![xOn + '@end'] == null) throw new Error('Bars on the number dimension "' + xOn + '" need its bins, and this result has no "' + xOn + '@end". Return where each bin ends from the query layer, or use line or dot.');
    const v = scaleOf(l).v;
    const d: Draw = { id: ids[i]!, role: roleOf(l), paint: l.paint || (prev ? 'compare' : 'series.1'), prev, rows: rows.filter((r) => span.has(r)), k, unit, v, xv, size, points: !!xOn && !xDim,
      ends: (r) => { const [lo, hi] = span.get(r)!; return [v(lo), v(hi)]; },
      ...(l.mark === 'bar' && l.encode!.y2 != null && !l.paint && { polarity: metricOf(catalog, l.encode!.y)?.polarity }) };
    if (!splitOf(catalog, l, xField)) return nodes.push(...draw(l, d));
    series.forEach((s, j) => {
      // Bars of one x that are not stacked sit side by side: overlapping bars are never what was meant. Lines and areas overlay.
      const drawn = draw(l, { ...d, series: s, paint: prev ? d.paint : 'series.' + (j + 1), rows: d.rows.filter((r) => r[split!] === s), ...(l.mark === 'bar' && !l.stack && { slot: [j, series.length] }) });
      nodes.push(...drawn);
      // Where the series' line ends, for its label: half way up its band where areas are stacked.
      const last = drawn.filter((n): n is PathNode => n.kind === 'path').map((n) => n.points[n.points.length - 1]!).pop();
      if (last) ends.set(s, l.mark === 'area' && l.stack ? ((last.v0 || 0) + last.v) / 2 : last.v);
    });
  });
  if (split) {
    // Both keys to the series, each in its own part, as a band has. The plan names one in `parts`; a fit rule swaps them.
    // A label sits beside the plot at the height its line ends. Two lines that end close have labels that collide:
    // that is the painter's to see to, as place() does, since only it knows how tall a label is (reference, Open 5).
    series.forEach((s, j) => {
      if (ends.has(s)) nodes.push({ key: 'label:' + s, part: 'labels', kind: 'text', series: s, t: ends.get(s)!, text: s, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'series.' + (j + 1), layer: 'guide' });
    });
    series.forEach((s, j) => {
      nodes.push({ key: 'swatch:' + s, part: 'legend', kind: 'rect', series: s, paint: 'series.' + (j + 1), layer: 'data' });
      nodes.push({ key: 'legend:' + s, part: 'legend', kind: 'text', series: s, text: s, anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' });
    });
  }
  // The key to sizes: the metric's name, then each step with the most it stands for.
  if (size) {
    nodes.push({ key: 'size:title', part: 'size', kind: 'text', text: metricOf(catalog, size.field)!.label, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    for (let s = 1; s <= SIZES; s++) {
      nodes.push({ key: 'size:' + s, part: 'size', kind: 'circle', pulse: false, size: s, paint: 'ink.muted', layer: 'guide' });
      nodes.push({ key: 'size:' + s + ':label', part: 'size', kind: 'text', text: fmt(Math.round(size.top * (s / SIZES) ** 2), true), anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    }
  }
  return { nodes, rows: keys, ...(split && { series }), scale };
}

/** A row's columns: its `text` layers that show a metric, in layer order. The first stays. The rest are ranked, and given up from the right. */
export function columnsOf(catalog: Catalog, layers: Layer[]): Layer[] {
  return layers.filter((l) => l.mark === 'text' && typeof (l.encode && l.encode.text) === 'string' && (l.encode!.text as string) in catalog.metrics);
}
/** What heads a column. */
export function columnLabel(catalog: Catalog, l: Layer): string {
  return l.series === 'delta' ? 'Change' : catalog.metrics[l.encode!.text as string]!.label;
}
// What a text layer says in one row.
function cellOf(catalog: Catalog, l: Layer, r: Row): { text: string; paint: string } {
  const f = l.encode!.text as string, M = catalog.metrics[f];
  if (!M || l.series !== 'delta') return { text: M ? formatValue(num(r, f), M) : String(r[f]), paint: 'ink' };
  // The row's change, as the tldr value's delta says the total's. A row with nothing before it has a dash: a column has no room for the words.
  const d = delta(num(r, f), r[f + '@previous'] as number | null | undefined, M.polarity);
  return { text: d.state === 'none' ? '–' : d.text, paint: d.paint };
}
export const TICK_W = CHAR_W - 0.8;   // rough advance of the 11px tick face, which a column's header is set in

/** Room a row's columns need between them: for each, its widest value, or its header where there are headers.
 * Measured in characters, as place() sets them. */
export function valueRoomOf(catalog: Catalog, layers: Layer[], rows: Row[]): number {
  const cols = columnsOf(catalog, layers);
  return cols.reduce((room, l) => room + Math.max((max(rows, (r) => cellOf(catalog, l, r).text.length) || 0) * CHAR_W, cols.length > 1 ? columnLabel(catalog, l).length * TICK_W : 0) + 14, 0);
}

/* What a mark in a row's track is drawn with: its layer's key, role and paint, the row, and the track's scale. */
interface Track {
  id: string;
  role: Role;
  paint: string;
  row: Row;
  k: string;
  /** A value on the track's x, as a ratio of its width. */
  v: (n: number) => number;
}
type TrackFn = (l: Layer, d: Track) => SceneNode[];

// A bar runs from zero to its value, so one below zero lies to the left of where the others start.
const trackBar: TrackFn = (l, { id, role, paint, row, k, v }) => {
  const v0 = v(0);
  return [{ key: id + ':' + k, part: 'rows', kind: 'rect', v: v(num(row, l.encode!.x as string)), ...(v0 && { v0 }), row: k, paint, opacity: 0.2, layer: 'data', role }];
};
/* The marks a row's track draws, by name. A new mark is a function here. Text is not among them: it is set in the row, not on the scale. */
const TRACK_MARKS: Partial<Record<Mark, TrackFn>> = { bar: trackBar };

// A dimension on y: a row for each of its values, with a track that has a metric on x. The ranked bar list is the first of these.
// The track's scale is derived here, once, from what its layers put on x. It is linear and holds zero and whatever is on
// either side of it, and it is not rounded: a row's track has no axis to read against.
function sceneRows(catalog: Catalog, layers: Layer[], rows: Row[]): Body {
  const nodes: SceneNode[] = [];
  const dim = layers.map((l) => l.encode && l.encode.y).find((f) => isDim(catalog, f)) as string;
  const tracked = layers.filter((l) => TRACK_MARKS[l.mark]), units = [...new Set(tracked.map((l) => catalog.metrics[l.encode!.x as string]?.unit))];
  if (units.length > 1) throw new Error('These rows have marks that measure in ' + units.length + ' units (' + units.join(', ') + '), and a row has one track. Keep the marks of one unit, and show the other metric as a text layer.');
  const vals = tracked.flatMap((l) => rows.map((r) => num(r, l.encode!.x as string)));
  const lo = Math.min(0, min(vals) ?? 0), hi = Math.max(0, max(vals) ?? 0) || (lo ? 0 : 1), v = (n: number) => (n - lo) / (hi - lo);
  const ids = layerKeys(layers), cols = columnsOf(catalog, layers);
  // A column after the first is ranked by its place, so the last goes first. One column of values needs no header: the view's title says what it is.
  const rank = (l: Layer) => { const j = cols.indexOf(l); return j > 0 && { rank: j }; };
  if (cols.length > 1) cols.forEach((l) => {
    nodes.push({ key: 'column:' + ids[layers.indexOf(l)], part: 'columns', kind: 'text', text: columnLabel(catalog, l), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank(l) });
  });
  rows.forEach((r) => {
    const k = r[dim] as string;
    // The row itself: what a painter keys, and what is chosen and named when the row is.
    nodes.push({ key: 'row:' + k, part: 'rows', kind: 'row', row: k, paint: 'ink', layer: 'data' });
    layers.forEach((l, li) => {
      const draw = TRACK_MARKS[l.mark];
      if (draw) {
        nodes.push(...draw(l, { id: ids[li]!, role: roleOf(l), paint: l.paint || 'series.1', row: r, k, v }));
      } else if (l.mark === 'text') {
        const cell = cellOf(catalog, l, r);
        nodes.push({ key: ids[li] + ':' + k, part: 'rows', kind: 'text', row: k, text: cell.text,
          anchor: l.align === 'end' ? 'end' : 'start', baseline: 'middle', font: cols.includes(l) ? 'value' : 'label', paint: cell.paint, layer: 'data', role: roleOf(l), ...rank(l) });
      } else {
        throw new Error('The "' + l.mark + '" mark has no rule for rows yet. Use bar or text.');
      }
    });
  });
  return { nodes, rows: rows.map((r) => r[dim] as string) };
}

// No positional dimension: one band, stacked and normalized, split by colour. A share is of the engine's total, so
// with a `limit` the band stops short of its end by what the rows past the limit hold.
function sceneBand(layer: Layer, rows: Row[], totals: Result['totals']): Body {
  const nodes: SceneNode[] = [], m = layer.encode!.x as string, dim = layer.encode!.color as string;
  const total = totals[m] || 1, k = (r: Row) => r[dim] as string;
  rows.forEach((r, i) => {
    nodes.push({ key: 'seg:' + k(r), part: 'band', kind: 'rect', v: num(r, m) / total, row: k(r), paint: 'series.' + ((i % 6) + 1), layer: 'data', role: roleOf(layer) });
  });
  return { nodes: nodes.concat(shareLegend(rows, k, m, total, (i) => 'series.' + ((i % 6) + 1))), rows: rows.map(k) };
}
// The legends of a whole split by colour, for a band and for a circle of arcs: both of them, each in its own part.
// The plan names one in `parts`; a fit rule swaps them.
function shareLegend(rows: Row[], k: (r: Row) => string, m: string, total: number, paint: (i: number) => string): SceneNode[] {
  const nodes: SceneNode[] = [];
  rows.forEach((r, i) => {
    nodes.push({ key: 'swatch:' + k(r), part: 'legend', kind: 'rect', row: k(r), paint: paint(i), layer: 'data' });
    nodes.push({ key: 'legend:' + k(r), part: 'legend', kind: 'text', row: k(r), text: String(k(r)), anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' });
    nodes.push({ key: 'share:' + k(r), part: 'legend', kind: 'text', row: k(r), text: fmtPct(num(r, m) / total), anchor: 'end', baseline: 'middle', font: 'value', paint: 'ink', layer: 'guide' });
  });
  // One line for the whole of it, so it names no row.
  if (rows.length) nodes.push({ key: 'legend:top', part: 'legend-top', kind: 'text', text: k(rows[0]!) + ' ' + fmtPct(num(rows[0]!, m) / total), anchor: 'start', font: 'label', paint: 'ink', layer: 'guide' });
  return nodes;
}

const GAP = 0.004;    // turns between one segment and the next
const MARK = 0.004;   // turns to either side of a value that is marked on the circle, and not swept to
/** The inner radius from which a circle of arcs has a hole the number sits in. */
export const HOLE = 0.5;

// A metric on angle: arcs about one centre. No positional dimension and no general polar coordinates.
// With a dimension on color a layer is a segment per row, each its share of the engine's total, so with a `limit` the
// circle stops short of closing, as a band stops short of its end. With none it reads the metric against its catalog
// `domain`: its total swept from the start, or, as a `reference`, its `target` marked. A constant on angle is marked the
// same way. A layer with nothing on angle is the whole sweep: the range behind the value.
function sceneRadial(catalog: Catalog, layers: Layer[], q: Query, result: Result): Body & Pick<Scene, 'aspect'> {
  const half = layers.some((l) => l.sweep === 'half'), from = half ? -0.25 : 0, span = half ? 0.5 : 1;
  const ids = layerKeys(layers), arcs: ArcNode[] = [], legend: SceneNode[] = [];
  let keys: string[] | undefined;
  const arc = (key: string, l: Layer, lo: number, hi: number, r0: number, paint: string, more?: Partial<ArcNode>): ArcNode => {
    const a = { a0: from + lo * span, a1: from + hi * span, r0, r1: 1 };
    return { key, part: 'radial', kind: 'arc', ...a, d: arcD(a), paint, layer: 'data', role: roleOf(l), ...more };
  };
  layers.forEach((l, i) => {
    const enc = l.encode || {}, angle = enc.angle, r0 = enc.radius ?? 0, n = 'Layer ' + (i + 1);
    if (l.mark !== 'arc') throw new Error('The "' + l.mark + '" mark has no rule about a centre yet. Use arc, or take "angle" off the other layers.');
    if (typeof r0 !== 'number' || !(r0 >= 0 && r0 < 1)) throw new Error(n + ' has ' + JSON.stringify(r0) + ' on radius. It takes a number from 0 up to 1: the inner radius, as a share of the outer. 0.6 makes a donut.');
    if (isDim(catalog, enc.color)) {
      const m = angle as string, dim = enc.color, rows = result.rows, total = result.totals[m] || 1, k = (r: Row) => r[dim] as string;
      if (!(m in catalog.metrics)) throw new Error(n + ' splits by "' + dim + '" with ' + JSON.stringify(angle) + ' on angle. Put a metric on angle: each segment is its share of that metric\'s total.');
      if (keys) throw new Error(n + ' is a second layer split by color, and a circle is divided once. Remove one of them.');
      if (rows.length > SERIES) throw new Error('Splitting by "' + dim + '" makes ' + rows.length + ' segments, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
      // Each segment starts where the one before it ends, a hair apart.
      let run = 0;
      rows.forEach((r, j) => {
        const lo = run / total, hi = (run += num(r, m)) / total;
        arcs.push(arc(ids[i] + ':' + k(r), l, lo, Math.max(lo, hi - (rows.length > 1 ? GAP / span : 0)), r0, 'series.' + (j + 1), { row: k(r) }));
      });
      legend.push(...shareLegend(rows, k, m, total, (j) => 'series.' + (j + 1)));
      keys = rows.map(k);
      return;
    }
    if (angle == null) return arcs.push(arc(ids[i]!, l, 0, 1, r0, l.paint || 'series.1', { opacity: 0.14 }));
    const marked = typeof angle === 'number' || roleOf(l) === 'reference', m = typeof angle === 'number' ? q.metrics[0]! : angle, M = catalog.metrics[m];
    if (!M) throw new Error(n + ' has "' + m + '" on angle, which is not a metric. Put a metric on angle, and a dimension on color.');
    if (!M.domain) throw new Error(n + ' reads "' + m + '" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the circle by it.');
    const v = typeof angle === 'number' ? angle : marked ? M.target : result.totals[m], [least, most] = M.domain;
    if (v == null) return;                                                   // no target to mark, or no total to sweep to
    const at = Math.min(1, Math.max(0, (v - least) / (most - least || 1)));
    // ponytail: a mark is a thin arc, since there is no `tick` mark to draw it with yet (chart-coverage-plan, step 3).
    arcs.push(marked ? arc(ids[i]!, l, Math.max(0, at - MARK / span), Math.min(1, at + MARK / span), r0, l.paint || 'rule') : arc(ids[i]!, l, 0, at, r0, l.paint || 'series.1'));
  });
  // The number sits in the hole of a donut: the short form, which is what fits. Whether it shows is a fit rule's to say.
  const inner = arcs.filter((a) => a.role === 'primary').map((a) => a.r0), nodes: SceneNode[] = arcs;
  if (inner.length && Math.min(...inner) >= HOLE) nodes.push({ key: 'hole', part: 'hole', kind: 'text', text: tldrValueText(catalog, q, result, true), anchor: 'middle', font: 'display', paint: 'ink', layer: 'data' });
  return { nodes: nodes.concat(legend), ...(keys && { rows: keys }), aspect: half ? 2 : 1 };
}

const SEQ = 7;      // paint tokens run from seq.1 to seq.7, and seq.none is a cell with no value

// A dimension on x and another on y, and a metric on color: a grid of cells, each painted a step of the sequential ramp.
// Both positions are discrete and the cells meet; the gap between them is the painter's. A cell with no value is
// `seq.none` and not the lowest step: nothing is not a little. A pair the result has no row for is drawn the same way.
function sceneMatrix(catalog: Catalog, layers: Layer[], result: Result): Body {
  const l = layers[0]!, { x: xf, y: yf, color: m } = l.encode || {};
  if (layers.length > 1 || l.mark !== 'cell' || !isDim(catalog, xf) || !isDim(catalog, yf) || typeof m !== 'string' || !(m in catalog.metrics)) {
    throw new Error('A dimension on both x and y makes a grid, and a grid draws one layer: a "cell" with a metric on color. Write { "mark": "cell", "encode": { "x": "' + xf + '", "y": "' + yf + '", "color": a metric } } alone, or move a dimension off an axis.');
  }
  // Each dimension in its own order, which is the engine's, so the grid does not turn with the ranking.
  const domain = (f: string) => [...new Set(((result.totalsBy && result.totalsBy[f]) || result.rows).map((r) => r[f] as string))];
  const xs = domain(xf), ys = domain(yf), at = new Map(result.rows.map((r) => [r[xf] + '\n' + r[yf], r[m] as number | null | undefined]));
  // The colour scale runs from the least to the most of the cells drawn. That is geometry, as the top of a y scale is,
  // and not a total, so it is read from the rows. A domain the catalog states for the metric comes before it.
  const vals = [...at.values()].filter((v): v is number => v != null), stated = catalog.metrics[m]!.domain;
  const [lo, hi] = stated || [min(vals) ?? 0, max(vals) ?? 0];
  // Cells that all hold one value have no least and most. They are measured from zero.
  const ends = lo < hi ? [lo, hi] : [Math.min(lo, 0), Math.max(hi, lo ? 0 : 1)];
  const step = scaleQuantize<number>().domain(ends).range(Array.from({ length: SEQ }, (_, i) => i + 1));
  const nodes: SceneNode[] = [], id = layerKeys(layers)[0]!, role = roleOf(l), nx = xs.length, ny = ys.length;
  // Every sixth label stays, and the rest are ranked to be given up where they would meet: every third goes last.
  const rank = (i: number) => (i % 6 ? { rank: i % 3 ? 2 : 1 } : {});
  const tick = (f: string, v: string) => formatDimension(v, catalog.dimensions[f]!);
  ys.forEach((y, j) => nodes.push({ key: 'ytick:' + y, part: 'y-axis', kind: 'text', t: 1 - (j + 0.5) / ny, text: tick(yf, y), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank(j) }));
  xs.forEach((x, i) => nodes.push({ key: 'xtick:' + x, part: 'x-axis', kind: 'text', x: (i + 0.5) / nx, text: tick(xf, x), anchor: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank(i) }));
  // A row of the grid at a time, from the top: reading order.
  ys.forEach((y, j) => xs.forEach((x, i) => {
    const v = at.get(x + '\n' + y);
    nodes.push({ key: id + ':' + x + ':' + y, part: 'plot', kind: 'rect', x: i / nx, w: 1 / nx, y: j / ny, h: 1 / ny, pair: [x, y], paint: v == null ? 'seq.none' : 'seq.' + step(v), layer: 'data', role });
  }));
  // The ramp is set in order: the low value, a swatch for each step, the high value, and the swatch for no value where a cell has none.
  const end = (key: string, v: string): SceneNode => ({ key: 'ramp:' + key, part: 'ramp', kind: 'text', text: v, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
  const swatch = (key: string | number): SceneNode => ({ key: 'ramp:' + key, part: 'ramp', kind: 'rect', paint: 'seq.' + key, layer: 'data' });
  nodes.push(end('low', fmt(ends[0], true)), ...Array.from({ length: SEQ }, (_, i) => swatch(i + 1)), end('high', fmt(ends[1], true)));
  if (vals.length < nx * ny) nodes.push(swatch('none'), end('none:label', 'No data'));
  return { nodes, rows: xs, ys };
}

/** The value shown as the number, formatted. */
export function tldrValueText(catalog: Catalog, q: Query, result: Result, compact?: boolean): string {
  const m = q.metrics[0]!;
  if (catalog.metrics[m]!.instant) return String(result.totals[m] || 0);
  return result.meta.empty ? '0' : fmt(result.totals[m], compact);
}

/* The tldr value: a total from the engine, a delta if the query compares, and a derived note.
 * It carries both forms of its text. Which one is set depends on the room, so that is not decided here. */
function sceneNumber(catalog: Catalog, q: Query, result: Result, share: boolean): SceneNode[] {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, by = (q.by || [])[0], rows = result.rows;
  const nodes: SceneNode[] = [];
  const value = (text: string, short = text) => nodes.push({ key: 'value', part: 'number', kind: 'text', text, ...(short !== text && { short }), anchor: 'start', font: 'display', paint: 'ink', layer: 'data' });
  const sub = (text: string, rank?: number) => nodes.push({ key: 'sub', part: 'number', kind: 'text', text, anchor: 'start', font: 'tick', paint: 'ink.muted', layer: 'guide', ...(rank && { rank }) });
  if (M.instant) {
    const n = t[m] || 0;
    nodes.push({ key: 'pulse', part: 'number', kind: 'circle', paint: n > 0 ? 'live' : 'ink.muted', pulse: n > 0, layer: 'data' });
    value(String(n)); sub(n ? 'on the site right now' : 'Nobody is here right now');
    return nodes;
  }
  if (result.meta.empty) { value('0'); sub('No visits yet'); return nodes; }
  let note: string | null = M.rangeTotal === 'sum of daily' ? 'Sum of daily counts' : M.target != null ? 'Target ' + fmt(M.target) : null;
  if (by && catalog.dimensions[by]!.type === 'categorical' && rows.length) {
    const top = leader(result, by, m)!;                                      // with two dimensions a row is a pair, so the leader is the engine's
    note = share ? top[by] + ' ' + fmtPct(num(top, m) / (t[m] || 1)) : 'Top: ' + top[by];
  }
  const dl = q.compare === 'previous' ? delta(t[m] as number, t[m + '@previous'], M.polarity) : null;
  value(fmt(t[m]), fmt(t[m], true));
  if (dl) nodes.push({ key: 'delta', part: 'number', kind: 'text', text: dl.text + (dl.pct != null ? ' on the previous period' : ''), ...(dl.pct != null && { short: dl.text }), anchor: 'start', font: 'value', paint: dl.paint, layer: 'guide' });
  if (note) sub(note, 1);                                                   // the note is given up beside a bare plot
  return nodes;
}

/** The scene for a plan, in ratios. It takes no size: plan for a container with no limits and this is everything the spec asks for. */
export function buildScene(p: PlanShape, q: Query, result: Result, catalog: Catalog): Scene {
  if (p.layout === 'prose') return { layout: 'prose', parts: [], nodes: [], text: p.text };
  const number = sceneNumber(catalog, q, result, p.share);
  const parts: Part[] = p.tldrValue || p.layout === 'none' ? ['number'] : [];
  let body: Body = { nodes: [] }, side = false;
  if (p.layout === 'notice') {
    parts.push('notice');
    body.nodes.push({ key: 'notice', part: 'notice', kind: 'text', text: 'No visits in this period yet', anchor: 'middle', baseline: 'middle', font: 'label', paint: 'ink.muted', layer: 'guide' });
  } else if (p.layout === 'cartesian') {
    side = p.side;                                                          // a bare plot, set beside the number
    if (side && !parts.length) parts.push('number');
    body = sceneCartesian(catalog, p.layers, p.guides, result, (q.by || [])[0]);
    const key = body.series ? p.guides.legend : undefined;                 // layers that were split may have been given up
    if (p.guides.y) parts.push('y-axis');
    parts.push('plot');
    if (body.nodes.some((n) => n.part === 'points')) parts.push('points');
    if (p.guides.pointLabels && body.nodes.some((n) => n.part === 'point-labels')) parts.push('point-labels');
    if (body.nodes.some((n) => n.part === 'y-axis-2')) parts.push('y-axis-2');
    if (key === 'labels') parts.push('labels');
    if (p.guides.x) parts.push('x-axis');
    if (key === 'full') parts.push('legend');
    if (p.guides.size && body.nodes.some((n) => n.part === 'size')) parts.push('size');
  } else if (p.layout === 'matrix') {
    body = sceneMatrix(catalog, p.layers, result);
    if (p.guides.y) parts.push('y-axis');
    parts.push('plot');
    if (p.guides.x) parts.push('x-axis');
    if (p.guides.ramp) parts.push('ramp');
  } else if (p.layout === 'rows') {
    if (p.guides.columns) parts.push('columns');
    parts.push('rows');
    body = sceneRows(catalog, p.layers, result.rows.slice(0, p.rowLimit || result.rows.length));
  } else if (p.layout === 'band') {
    parts.push('band');
    if (p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
    body = sceneBand(p.layers[0]!, result.rows, result.totals);
  } else if (p.layout === 'radial') {
    body = sceneRadial(catalog, p.layers, q, result);
    parts.push('radial');
    // A number above the circle is not said again inside it.
    if (!parts.includes('number') && body.nodes.some((n) => n.part === 'hole')) parts.push('hole');
    if (p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
  }
  return { layout: p.layout, parts, ...(side && { side }), ...body, nodes: number.concat(body.nodes) };
}
