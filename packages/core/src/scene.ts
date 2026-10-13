import { max, min } from 'd3-array';
import { scaleBand, scaleLinear, scalePoint, scaleQuantize } from 'd3-scale';
import { CHAR_W, delta, fmt, fmtPct, fmtTime, formatBin, formatDimension, formatUnit, formatValue } from './format.ts';
import { arcD, pathD } from './path.ts';
import { customMarks } from './marks.ts';
import { NOW, crossesZero, emptyNote, endsOf, leader, portion } from './prose.ts';
import { UNIT_CELLS, UNIT_MOST, UNIT_SEATS, unitCount, unitSeats, unitShares, unitWorth } from './unit.ts';
import type { ArcNode, Catalog, DimensionDef, Guides, Layer, Mark, MetricDef, Part, PathNode, PlanShape, Polarity, Query, RectNode, Result, Role, Row, Scene, SceneNode, TextNode } from './types.ts';

/* Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a part, a paint token (never a colour) and a layer: "data" or "guide".
 * Nothing here is in pixels: positions are ratios of the part's box. */
type Body = Pick<Scene, 'nodes' | 'rows' | 'series' | 'detail' | 'ys' | 'scale' | 'track'>;

const num = (r: Row, f: string) => r[f] as number;
/* A row's dimension value as its key. A result may hold a number or a boolean there, and a key is compared with
 * what a painter wrote into an attribute, so it is a string from here on. */
const str = (r: Row, f: string) => String(r[f]);
/** The key of each row of a result: its value of `dim`, and for a row that says a value again, the value and which
 * time it is (`Google#2`). So no two rows share a key, a mark or a place, whatever a result repeats: a host that
 * hands over labels where it had ids repeats one. In a plot split by `split` the rows of one value are its series,
 * and only a value said again within one series is a repeat.
 * ponytail: which of two such rows is the second is the result's order, so when the ranking turns they change places. */
export function rowKeys(rows: Row[], dim: string, split?: string | null): Map<Row, string> {
  const keys = new Map<Row, string>(), taken = new Set<string>();
  for (const r of rows) {
    const of = split ? '\n' + r[split] : '';
    let k = str(r, dim);
    for (let n = 2; taken.has(k + of); n++) k = str(r, dim) + '#' + n;
    taken.add(k + of); keys.set(r, k);
  }
  return keys;
}
/** The role a layer plays: the one it states, or the one its mark and series imply. */
export function roleOf(l: Layer): Role {
  return l.role || (l.series === 'previous' ? 'comparison' : l.mark === 'rule' ? 'reference' : 'primary');
}
/* A layer's key names it by role and mark, and does not count the layers before it, so it holds when another layer
 * drops. Two layers of one role and mark are told apart by a count among themselves alone: `primary:text`, then
 * `primary:text#2`. Layers of the previous series, and of a row's delta, are counted last. A reduction drops whole roles, and missing prior
 * data drops the whole previous series, so neither can move a count. */
export function layerKeys(layers: Layer[]): string[] {
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
  /** The series are in one paint, by `detail`, and lie over each other: a line lets the ones under it show, so where many run together reads darker. */
  mass?: boolean;
  role: Role;
  paint: string;
  prev: boolean;
  rows: Row[];
  k: (r: Row) => string;
  /** On a linear x a row's bin has a width of its own, `span`, and `w` is nothing. */
  unit: ReturnType<typeof xScale> & { span?: (k: string) => number };
  /** A value on x, as a ratio of the plot's width, where x is linear. */
  xv?: ((n: number) => number) | undefined;
  /** What a row says of a field: a metric's value in its unit, and anything else as itself. */
  say: (r: Row, f: string) => string;
  /** The plot sets one metric against another, and its dots are a part of their own, `points`. */
  points?: boolean;
  /** The metric the plot's dots are sized by, and the most it holds. */
  size?: { field: string; top: number } | undefined;
  /** A value on y, as a ratio of the plot's height. */
  v: (n: number) => number;
  /** Where a row's mark starts and where it ends, as ratios: from the baseline, or from the series stacked under it. */
  ends: (r: Row) => [number, number];
  /** A bar's place among those beside it at one x: which, of how many. */
  slot?: [number, number];
  /** For a bar or an area with two ends that is painted by direction, and for bars that go both ways from nothing: its metric's polarity, which turns the paint of the way it goes. */
  polarity?: Polarity | undefined;
  /** For a `unit`: what one of its glyphs is worth, in its metric's own terms. */
  worth?: number | undefined;
  /** x is a number dimension the engine cut into bins: a line or an area is flat across each, and steps at its edges, as a bar there has no gap. */
  step?: boolean;
}
type MarkFn = (l: Layer, d: Draw) => SceneNode[];
/** A field's definition: its own, where the catalog has one under its whole name, and for a companion with none the
 * one of the metric it came with. So a companion is in its metric's unit unless the catalog says otherwise
 * (`"pageviews@rank": { "unit": "rank" }`), and core reads no suffix to know it. */
export const metricOf = (catalog: Catalog, f: unknown): MetricDef | undefined => (typeof f !== 'string' ? undefined : Object.hasOwn(catalog.metrics, f) ? catalog.metrics[f] : catalog.metrics[f.split('@')[0]!]);
/** The paint of a mark that runs from one value to another: good or bad by which way it goes, turned by its metric's
 * polarity. One whose metric has no better way keeps its own paint. Positions are compared as they are drawn. */
const toned = (polarity: Polarity | undefined, from: number, to: number, paint: string) => (!polarity || polarity === 'none' ? paint : (to < from) === (polarity === 'down') ? 'delta.good' : 'delta.bad');

type Pt = PathNode['points'][number];
/** An area between two ends, cut where they cross: each piece lies wholly to one side, `up` where the second end is the
 * higher. A point where the two are level belongs to the piece before it.
 * ponytail: a crossing is found on the straight line between two rows, and the pieces are then drawn with the curve of
 * the lines beside them. So a piece's tip is a hair from where those curves cross. Solve the curves if it ever shows. */
function cut(pts: Pt[]): { up: boolean; pts: Pt[] }[] {
  const out: { up: boolean; pts: Pt[] }[] = [], gap = (p: Pt) => p.v - (p.v0 || 0);
  let cur: Pt[] = [], way = 0;
  pts.forEach((p, i) => {
    const d = Math.sign(gap(p));
    if (d && way && d !== way) {
      const a = pts[i - 1]!, da = gap(a), f = da / (da - gap(p)), v = a.v + (p.v - a.v) * f;
      // Where the ends meet between two rows, which is no row's: the piece before ends there and the next begins. Level at a row, that row is where.
      const at: Pt = da ? { x: a.x + (p.x - a.x) * f, v, ...(v && { v0: v }) } : a;
      if (da) cur.push(at);
      out.push({ up: way > 0, pts: cur }); cur = [at];
    }
    if (d) way = d;
    cur.push(p);
  });
  if (cur.length) out.push({ up: way >= 0, pts: cur });
  return out;
}
const MASS = 0.5;    // how much of its paint a line of a mass is drawn in, and a dot or a tick of one on a row's track
const path: MarkFn = (l, { id: layer, series, mass, role: role0, paint, prev, rows: pts, k, unit, ends, polarity, step, points: joined }) => {
  const id = series == null ? layer : layer + ':' + series, role = series == null ? { role: role0 } : { role: role0, series };
  const whole = pts.filter((r) => prev || !r.partial);
  if (!whole.length) return [];
  // Between rows a line is smoothed, with a curve that never leaves the values it joins. Not where it joins the points of
  // two metrics, which run in no order along x: straight from each to the next, since a curve there would say a path nobody
  // took. And not over bins, where a value holds across its bin and changes at its edge.
  const curve = joined ? undefined : step ? 'step' as const : 'monotone' as const, part: Part = joined ? 'points' : 'plot', bent = curve && { curve };
  // An area's points say where it starts only when that is not the bottom of the plot.
  const points = (rs: Row[]): Pt[] => rs.map((r) => { const [v0, v] = ends(r); return { row: k(r), x: unit.cx(k(r)), v, ...(l.mark === 'area' && v0 && { v0 }), ...(step && { w: unit.span!(k(r)) }) }; });
  if (l.mark === 'area') {
    // An area under a line is a tint. Stacked, each is the mark itself.
    const area = (key: string, ps: Pt[], paint: string): SceneNode => ({ key, part, kind: 'path', d: pathD(ps, curve, true), points: ps, ...bent, fill: true, paint, ...(!(l.stack && series != null) && { opacity: 0.14, tone: 'soft' as const }), layer: 'data', ...role });
    // Painted by direction, it is cut where its two ends cross, and each piece is a gain or a loss. A piece is keyed by the row it starts at.
    if (polarity && polarity !== 'none') return cut(points(whole)).map((piece) => area(id + ':' + piece.pts.find((p) => p.row != null)!.row, piece.pts, toned(polarity, 0, piece.up ? 1 : -1, paint)));
    return [area(id, points(whole), paint)];
  }
  const nodes: SceneNode[] = [{ key: id, part, kind: 'path', d: pathD(points(whole), curve), points: points(whole), ...bent, paint, width: prev ? 1.5 : 2, dash: prev ? '3 3' : null, ...(mass && { opacity: MASS }), layer: 'data', ...role }];
  // A range that starts or ends inside a bucket leaves that one incomplete: dashed in from the first, and out to the last.
  const from = pts.indexOf(whole[0]!), lead = pts.slice(0, from).concat(whole[0]!), tail = [whole[whole.length - 1]!].concat(pts.slice(from).filter((r) => r.partial));
  for (const [key, rs] of [[':partial:lead', lead], [':partial', tail]] as const)
    if (!prev && rs.length > 1) nodes.push({ key: id + key, part, kind: 'path', d: pathD(points(rs)), points: points(rs), paint, width: 2, dash: '2 4', opacity: mass ? MASS : 0.75, layer: 'data', ...role, note: 'incomplete bucket' });
  return nodes;
};
const bar: MarkFn = (_l, { id, series, role, paint, prev, rows, k, unit, ends, polarity, slot: [j, n] = [0, 1] }) => rows.map((r) => {
  const [v0, v] = ends(r), w = (unit.span ? unit.span(k(r)) : unit.w) / n;
  return { key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'plot', kind: 'rect', x: unit.x(k(r)) + j * w, w, v, ...(v0 && { v0 }), row: k(r), ...(series != null && { series }),
    paint: toned(polarity, v0, v, paint), opacity: r.partial && !prev ? 0.4 : 1, layer: 'data', role };
});
/** Whether a rule runs across the plot from one place to another: it has both ends on both axes. */
const across = (l: Layer) => l.mark === 'rule' && l.encode != null && l.encode.x2 != null && l.encode.y2 != null;
const rule: MarkFn = (l, { id, series, role, rows, k, unit, ends, v, xv }) => {
  const { x, y, x2, y2 } = l.encode || {};
  // Both ends on both axes: one line across the plot, from (x, y) to (x2, y2). Numbers make the one line, drawn as a
  // reference is. A field is a row's own value, so with any field there is a line for each row, in the layer's paint.
  // It is a path of two points, since a painter's line is level or upright.
  if (across(l)) {
    if (!xv) throw new Error('A rule with x, y, x2 and y2 runs across a plot from one place to another, and this plot has a time or a category on x, where a place has no number. Put a metric on the other layers\' x, or keep y and y2 alone for a stroke at each x.');
    if (l.label) throw new Error('A rule that runs across a plot has no place for its label yet. Remove "label", and name the line in the view\'s title.');
    const at = (f: string | number | undefined, r?: Row) => (typeof f === 'number' ? f : r && (r[f!] as number | null | undefined));
    const line = (key: string, r?: Row): SceneNode[] => {
      const [x0, y0, x1, y1] = [x, y, x2, y2].map((f) => at(f, r));
      if (x0 == null || y0 == null || x1 == null || y1 == null) return [];   // a row with an end missing has no line
      const points = [{ row: r ? k(r) : '', x: xv(x0), v: v(y0) }, { row: r ? k(r) : '', x: xv(x1), v: v(y1) }];
      return [{ key, part: 'plot', kind: 'path', d: pathD(points), points, ...(r ? { row: k(r), paint: l.paint || 'ink', width: 2 } : { paint: 'rule', width: 1.5, dash: '5 3' }), layer: 'data', role }];
    };
    return [x, y, x2, y2].every((f) => typeof f === 'number') ? line(id) : rows.flatMap((r) => line(id + ':' + k(r), r));
  }
  // A field on y, or on y2 from a number: a segment for each row, standing at its x from one of its values to another, or up from zero where it has one end.
  if (typeof y === 'string' || y2 != null) return rows.map((r): SceneNode => {
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
export const SIZES = 4;    // the steps a value on `size` falls into. How big each is, in pixels, is the painter's
/** The step for a value, 1 to SIZES, by area: the square root of its share of the most. */
export const sizeStep = (n: number, top: number) => Math.min(SIZES, Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n) / top) * SIZES)));
// A point for each row, at its values on x and y. One that is sized lets what is under it show.
const dot: MarkFn = (l, { id, series, role, paint, rows, k, unit, ends, size, points }) => {
  const sized = l.encode!.size != null && size;
  return rows.map((r): SceneNode => ({ key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: points ? 'points' : 'plot', kind: 'circle', pulse: false, x: unit.cx(k(r)), t: ends(r)[1],
    ...(sized && { size: sizeStep(num(r, sized.field), sized.top), opacity: 0.7 }), row: k(r), ...(series != null && { series }), paint, layer: 'data', role }));
};
// A label on each row's point, in a part of its own over the plot, so a rule can give them all up. Each has its place
// among them, the largest point first: by the metric the dots are sized by, or else by its own y. A painter gives up
// the ones that collide from the last, since only it knows how wide a label is (reference, Open 5).
const label: MarkFn = (l, { id, series, role, rows, k, unit, ends, size, say }) => {
  const { y, text: f } = l.encode || {};
  if (typeof y !== 'string' || typeof f !== 'string') throw new Error('A "text" layer in a plot needs a field on y, for where each label sits, and one on text, for what it says: for example { "x": "<a metric>", "y": "<a metric>", "text": "<the dimension>" }.');
  const by = size ? size.field : y, order = rows.slice().sort((a, b) => num(b, by) - num(a, by));
  return rows.map((r): TextNode => ({ key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'point-labels', kind: 'text', x: unit.cx(k(r)), t: ends(r)[1], text: say(r, f),
    anchor: 'middle', font: 'tick', paint: 'ink', halo: true, row: k(r), ...(series != null && { series }), rank: order.indexOf(r) + 1, layer: 'guide', role }));
};
const RUG = 0.05;    // how far up the plot a stroke of a rug stands
// A short stroke across its row's band, at its value. With `align` it is the half of that to one side of the band's
// middle: the start, which is where x begins, or the end.
// In a plot of points, with a metric on x and nothing on y, it is a stroke at the foot of the plot at each row's value
// there: a rug. Strokes lie over each other where rows are close, so each lets the ones under it show.
const tick: MarkFn = (l, { id, series, role, rows, k, unit, ends, xv }) => rows.map((r): SceneNode => {
  const own = { key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'plot' as const, kind: 'line' as const, row: k(r), ...(series != null && { series }), paint: l.paint || 'ink', layer: 'data' as const, role };
  if (l.encode!.y == null) { const at = xv!(num(r, l.encode!.x as string)); return { ...own, x: at, x2: at, t: 0, t2: RUG, opacity: MASS }; }
  const w = unit.span ? unit.span(k(r)) : unit.w, x = unit.x(k(r)) + (l.align === 'end' ? w / 2 : 0), t = ends(r)[1];
  return { ...own, x, x2: x + (l.align ? w / 2 : w), t, t2: t, width: 2 };
});
// A stack of glyphs up from the axis, one for each `worth` of the row's value: its span runs from nothing to the whole
// glyphs it is drawn as (sceneCartesian), so it is on the scale every other mark of the plot is on, and an axis or a rule
// reads true against it. A glyph has the width of its row's band and its own share of the height. Which of the two
// it is as wide as is the painter's to say, in pixels (types.ts, CircleNode).
const unitStack: MarkFn = (l, { id, role, paint, rows, k, unit, ends, v, worth }) => {
  if (worth == null) throw new Error('A "unit" in a plot needs a metric on y to count its glyphs from, and this one has ' + held(l.encode?.y) + ' there. Encode { "x": <the dimension>, "y": <a metric> }.');
  const h = v(worth) - v(0);
  return rows.flatMap((r) => {
    const [from, to] = ends(r), w = unit.span ? unit.span(k(r)) : unit.w;
    return Array.from({ length: Math.round((to - from) / h) }, (_, j): SceneNode => ({ key: id + ':' + k(r) + ':' + (j + 1), part: 'plot', kind: 'circle', pulse: false, x: unit.cx(k(r)), t: from + (j + 0.5) * h, w, h,
      row: k(r), paint, ...(r.partial && { opacity: 0.4 }), layer: 'data', role }));
  });
};
/** What a layer's glyphs are worth where they are counted from one metric, row by row: the round number at which the
 * largest of `rows` is ten glyphs or fewer. A count's glyph is worth one thing at least. */
function worthOf(catalog: Catalog, f: string, rows: Row[]): number {
  return unitWorth(max(rows, (r) => r[f] as number) ?? 0, UNIT_MOST, metricOf(catalog, f)?.unit === 'count');
}
/** What a channel holds, as an error says it. */
const held = (f: unknown) => (f == null ? 'nothing' : JSON.stringify(f));
/** What a row's value is called in an error: the field, and the row it is in. */
const valueOf = (f: string, key: string) => 'The value of "' + f + '" for "' + key + '"';
/** The key to a `unit`: what one glyph is worth, in its metric's own format. A guide, under the marks. None where a glyph is worth one. */
function unitKey(id: string, worth: number, metric: MetricDef | undefined): SceneNode[] {
  return worth === 1 ? [] : [{ key: 'unit-key:' + id, part: 'unit-key', kind: 'text', text: 'Each is ' + (metric ? formatValue(worth, metric) : fmt(worth)), anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' }];
}
/** A layer's own paint, where it states one. `delta` is the paint of its metric's change over the range, as the tldr
 * value's delta has it: good or bad by the metric's polarity. With no change to judge, the layer has stated none. */
function paintOf(l: Layer, catalog: Catalog, result: Result): string | undefined {
  if (l.paint === 'direction') return undefined;                          // not a paint: each mark is painted by the way it goes, over the layer's own
  if (l.paint !== 'delta') return l.paint;
  const f = l.encode && (isDim(catalog, l.encode.y) ? l.encode.x : l.encode.y), M = metricOf(catalog, f);
  const d = M && delta(result.totals[f as string] as number, result.totals[f + '@previous'], M.polarity);
  return d && d.pct != null && d.paint !== 'ink.muted' ? d.paint : undefined;
}
/* The marks a plot draws, by name. A new mark is a function here. */
const PLOT_MARKS: Partial<Record<Mark, MarkFn>> = { line: path, area: path, bar, rule, dot, text: label, tick, unit: unitStack };

const SERIES = 6;   // paint tokens run from series.1 to series.6
const BANDS = 3;    // and from band.1 to band.3: the parts a metric's catalog `bands` divide its range into, the least first

/** The dimension a plot's layers put on x. */
export function xDimOf(catalog: Catalog, layers: Layer[]): string | undefined {
  return layers.map((l) => l.encode && l.encode.x).find((f) => isDim(catalog, f)) as string | undefined;
}
/** The units a plot's layers measure in, in layer order: a y scale each. Metrics of one catalog `unit` share a scale, and
 * shares of a whole are a unit of their own. A companion is in its metric's unit, or in its own where the catalog has
 * an entry for it (metricOf). A layer with a constant on y has none, and is drawn on the first. */
function unitOf(catalog: Catalog, l: Layer, xField?: string): string | null {
  // A mark that starts at a number measures in what its second end does. Not a rule across a plot, whose ends are places on the plot's own scales.
  const y = l.encode && l.encode.y, M = metricOf(catalog, typeof y === 'number' && !across(l) ? l.encode!.y2 : y);
  if (!M) return null;
  return l.stack === 'normalize' && splitOf(catalog, l, xField) ? 'share' : M.unit;
}
export function unitsOf(catalog: Catalog, layers: Layer[]): string[] {
  const x = xDimOf(catalog, layers), units = [...new Set(layers.map((l) => unitOf(catalog, l, x)).filter((u): u is string => u != null))];
  if (units.length > 2) throw new Error('These layers measure in ' + units.length + ' units (' + units.join(', ') + '), and a plot has a y axis on each side at most. Remove a layer, or draw them as separate views.');
  return units;
}
/** Whether a plot's layers are split into series that are painted apart, and so have a legend, and whether one of those
 * is a line or an area, which has an end to label. A split by `detail` paints none apart, and is not one of these. */
export function seriesOf(catalog: Catalog, layers: Layer[]): { lines: boolean } | null {
  const x = xDimOf(catalog, layers), split = layers.filter((l) => paintedOf(catalog, l, x));
  return split.length ? { lines: split.some((l) => l.mark === 'line' || l.mark === 'area') } : null;
}
/** The dimension a layer is split into series by and painted apart by: the one on `color`, unless it is the one on x. */
function paintedOf(catalog: Catalog, l: Layer, xField?: string): string | null {
  const c = l.encode && l.encode.color;
  return isDim(catalog, c) && c !== xField ? c : null;
}
/** The dimension a layer is split into series by with nothing painted apart: the one on `detail`, unless it is the one
 * on x. Every series is then in the layer's own paint, with no legend, and there may be more than there are colours. */
export function detailOf(catalog: Catalog, l: Layer, xField?: string): string | null {
  const d = l.encode && l.encode.detail;
  return isDim(catalog, d) && d !== xField ? d : null;
}
/** The dimension a layer in a plot is split into series by, whichever way: by `color`, or else by `detail`. */
export function splitOf(catalog: Catalog, l: Layer, xField?: string): string | null {
  return paintedOf(catalog, l, xField) || detailOf(catalog, l, xField);
}
/** The dimension a plot of points has a point for each value of: the query's first, or, where a layer paints its dots
 * by one dimension and names the other on `detail`, that other. The first is then what the points are coloured by. */
export function pointDimOf(catalog: Catalog, layers: Layer[], by?: string): string | undefined {
  const own = layers.map((l) => l.encode || {}).find((e) => isDim(catalog, e.color) && isDim(catalog, e.detail) && e.color !== e.detail);
  return (own && (own.detail as string)) || by;
}
/** The layouts that split a layer by `detail`. In another, a layer with it is refused (plan.ts). A step that reads it adds its layout. */
export const DETAIL_LAYOUTS: string[] = ['cartesian', 'radial', 'rows'];

/** Where each row of a layer that is split into a stack starts and ends, in its metric's own terms, by row. A stack
 * runs in the series' order, the first at its foot, and a value below zero stacks downward. `all` is what a row is a
 * share of: the engine's total for its x or its row, or 1. Centred, a stack sits half on each side of zero.
 * Diverging, the series keep their order and the stack is moved so that the first half of them lie below zero and the
 * second half above it: with an odd count the middle one lies half on each side. Which side a series is on is its
 * place among them, so a value below zero has no meaning there and is refused. */
function stacked(rows: Row[], series: string[], split: string, k: (r: Row) => string, f: string, mode: Layer['stack'], all: (r: Row) => number): Map<Row, [number, number]> {
  const out = new Map<Row, [number, number]>(), up: Record<string, number> = {}, down: Record<string, number> = {}, under: Record<string, number> = {}, half = series.length / 2;
  series.forEach((s, j) => rows.forEach((r) => {
    if (r[split] !== s || r[f] == null) return;
    const n = num(r, f), run = n < 0 ? down : up, from = run[k(r)] || 0, of = all(r);
    if (mode === 'diverge' && n < 0) throw new Error('stack: "diverge" sets each series to one side of zero by its place among them, and "' + f + '" is ' + n + ' for "' + s + '" at "' + k(r) + '". Use stack: "zero", where a value below zero stacks downward.');
    run[k(r)] = from + n;
    out.set(r, [from / of, (from + n) / of]);
    // What of this stack lies below zero: the whole of a series in the first half, and half of the middle one.
    under[k(r)] = (under[k(r)] || 0) + (j + 1 <= half ? n : j < half ? n / 2 : 0) / of;
  }));
  if (mode === 'diverge') out.forEach((ends, r) => out.set(r, [ends[0] - under[k(r)]!, ends[1] - under[k(r)]!]));
  if (mode === 'center') out.forEach((ends, r) => { const mid = ((up[k(r)] || 0) + (down[k(r)] || 0)) / 2; out.set(r, [ends[0] - mid, ends[1] - mid]); });
  return out;
}

// A dimension on x, a metric on y, and with a second dimension on color a series for each of its values.
// The scales are derived here, once: x from its dimension, and a y for each unit the layers measure in.
// Each layer's mark draws against them.
// With a metric on x as well, a row is still one value of a dimension: the query's, `by`. `xField` is the dimension the
// rows are keyed by either way, and `xOn` the field x is measured along where that is a linear scale.
function sceneCartesian(catalog: Catalog, layers: Layer[], guides: Guides, result: Result, by?: string): Body {
  const nodes: SceneNode[] = [], rows = result.rows;
  const xDim = xDimOf(catalog, layers), xField = (xDim || pointDimOf(catalog, layers, by))!;
  const xOn = !xDim ? (layers.map((l) => (across(l) ? undefined : l.encode && l.encode.x)).find((f) => typeof f === 'string') as string) : catalog.dimensions[xDim]!.type === 'number' ? xDim : null;
  // A view has two dimensions at most and one is on x, so there is one to split by. Its order is the engine's, not the rows':
  // paint follows it, so a value keeps its colour when the ranking moves.
  const split = layers.map((l) => splitOf(catalog, l, xField)).find(Boolean) || null;
  // A row of the engine's totals is not one of the result's, and is keyed by its value as it is.
  const own = rowKeys(rows, xField, split), k = (r: Row) => own.get(r) ?? str(r, xField), keys = [...new Set(rows.map(k))];
  // What a key says on the axis: its row's value, which a repeat shares with the row it repeats.
  const said = new Map(rows.map((r) => [k(r), str(r, xField)]));
  const series = split ? [...new Set(((result.totalsBy && result.totalsBy[split]) || rows).map((r) => r[split] as string))] : [];
  // Whether any layer paints its series apart. Only that spends the series colours, so only that is held to their count, and has a legend.
  const painted = layers.some((l) => paintedOf(catalog, l, xField));
  if (painted && series.length > SERIES) throw new Error('Splitting by "' + split + '" makes ' + series.length + ' series, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
  const isTime = catalog.dimensions[xField]!.type === 'time';
  // A bar with a metric on size is a column as wide as its x's share of the engine's total of that metric. The columns
  // then stand edge to edge at widths of their own, so x is no band: every node carries its own place, as on a linear x.
  const wide = layers.map((l) => (l.mark === 'bar' ? l.encode!.size : undefined)).find((f): f is string => typeof f === 'string');
  const shared = layers.some((l) => l.mark === 'bar' || l.mark === 'tick' || l.mark === 'unit') ? 'band' : 'point', scale = xOn || wide ? 'linear' : shared;
  const yField = (l: Layer) => (l.series === 'previous' ? l.encode!.y + '@previous' : (l.encode!.y as string));
  // Where each row's mark starts and ends, in its metric's own terms: from zero, or from the series stacked under it.
  // A stack runs in the series' order, the first at the bottom, and a value below zero stacks downward.
  // Normalized, each is a share of the engine's total for its x, so with a `limit` a stack stops short of the top.
  const whole = new Map(((result.totalsBy && result.totalsBy[xField]) || []).map((r) => [k(r), r]));
  const worths: (number | undefined)[] = [];
  const spans = layers.map((l, i) => {
    const out = new Map<Row, [number, number]>();
    // A rule from a number to one of the row's values is the same stroke as one from the value to the number.
    const from = l.encode && l.encode.y, upTo = l.encode && l.encode.y2;
    if (typeof from === 'number' && typeof upTo === 'string' && !across(l)) { rows.forEach((r) => { if (r[upTo] != null) out.set(r, [from, num(r, upTo)]); }); return out; }
    if (typeof (l.encode && l.encode.y) !== 'string' || across(l)) return out;
    const f = yField(l), share = l.stack === 'normalize', y2 = l.encode!.y2;
    // A unit runs from nothing to the whole glyphs its value is drawn as, which is not quite its value.
    if (l.mark === 'unit') { const worth = worths[i] = worthOf(catalog, f, rows); rows.forEach((r) => { if (r[f] != null) out.set(r, [0, unitCount(num(r, f), worth, valueOf(f, k(r))) * worth]); }); return out; }
    // A second end: the mark runs from one of the engine's values to another, and stands on nothing. A row with either missing has no mark.
    if (y2 != null) { rows.forEach((r) => { const to = typeof y2 === 'number' ? y2 : r[y2]; if (r[f] != null && to != null) out.set(r, [num(r, f), to as number]); }); return out; }
    // A tick that is a `reference` stands at its metric's catalog `target`, as a gauge's mark does. With no target there is none.
    if (l.mark === 'tick' && roleOf(l) === 'reference') { const to = metricOf(catalog, f)?.target; if (to != null) rows.forEach((r) => out.set(r, [0, to])); return out; }
    if (!l.stack || !splitOf(catalog, l, xField)) { rows.forEach((r) => { if (r[f] != null) out.set(r, [0, num(r, f)]); }); return out; }
    if (share && rows.length && !whole.size) throw new Error('stack: "normalize" divides by the engine\'s total for each "' + xField + '", and this result has no totalsBy. Return it from the query layer, or use stack: "zero".');
    return stacked(rows, series, split!, k, f, l.stack, share ? (r) => (whole.get(str(r, xField))![f] as number) || Infinity : () => 1);   // no total for this x: no share, so no height
  });
  // A scale for each unit. It holds zero and whatever is on either side of it, so a mark below zero hangs from the zero
  // line and not from the bottom of the plot. Always rounded to 4 ticks: a scene with no size cannot pick a tick count
  // by height. Shares run to the whole.
  const units = unitsOf(catalog, layers), scaleOf = (l: Layer) => scales[Math.max(0, units.indexOf(unitOf(catalog, l, xField)!))]!;
  // Where no layer has a metric itself on y, only companions of one (a box's quartiles), the ticks are in that metric's unit, as the readout says a companion.
  const lone = metricOf(catalog, layers.flatMap((l) => (l.encode ? [l.encode.y, l.encode.y2] : [])).find((y) => typeof y === 'string'))?.unit || 'count';
  const scales = (units.length ? units : ['']).map((u, ui) => {
    const vals: number[] = [];
    layers.forEach((l, i) => {
      const y = l.encode && l.encode.y;
      // A rule across the plot is held by the scale at both its ends: its numbers on the first, and its fields on their unit's.
      if (across(l)) { if (Math.max(0, units.indexOf(unitOf(catalog, l, xField)!)) === ui) for (const f of [y, l.encode!.y2]) vals.push(...(typeof f === 'number' ? [f] : rows.map((r) => r[f!] as number).filter((n) => n != null))); }
      else if (typeof y === 'number' && !spans[i]!.size) { if (!ui) vals.push(y); } else if (Math.max(0, units.indexOf(unitOf(catalog, l, xField)!)) === ui) spans[i]!.forEach((ends) => vals.push(...ends));
    });
    // Ranks run from 1 at the top down to the last of them, with a tick for each, and for every few of them past ten.
    // The first and the last stay on a short plot. What is no rank (the zero a bar or an area starts from) is at the foot.
    if (u === 'rank') {
      const last = Math.max(1, Math.ceil(max(vals) ?? 1)), every = Math.ceil(last / 10);
      const ticks = Array.from({ length: last }, (_, i) => i + 1).filter((n) => n === 1 || n === last || (n % every === 0 && last - n >= every / 2));
      return { v: (n: number) => (n < 1 ? 0 : last === 1 ? 1 : (last - n) / (last - 1)), ticks, coarse: [1, last], text: (t: number) => formatUnit(t, u, 'compact') };
    }
    // A stack set about the middle is read by how thick each band is, and a scale that counts away from the middle says
    // nothing true of that. So it has no ticks and no grid, and is not rounded: the bands take the height of the plot.
    const centred = layers.some((l, i) => l.stack === 'center' && spans[i]!.size > 0 && Math.max(0, units.indexOf(unitOf(catalog, l, xField)!)) === ui);
    const share = u === 'share', lo = Math.min(0, min(vals) ?? 0), hi = share ? 1 : Math.max(0, max(vals) ?? 0) || (lo ? 0 : 1);
    const y = scaleLinear().domain([lo, hi]);
    if (guides.y && !centred) y.nice(4);
    const [bottom, top] = y.domain() as [number, number];
    if (centred) return { v: (n: number) => (n - bottom) / (top - bottom), ticks: [], coarse: [], text: String };
    // A short plot keeps the ticks a count of 2 would give on this scale. Where the two counts share only zero (a top of 8, 80, 800: steps of 5 and of 2), every other tick stays instead.
    const fine = y.ticks(4), two = y.ticks(2).filter((t) => fine.includes(t));
    // A diverging stack counts away from zero on both sides, so its ticks say how much and not which side: no series is less than nothing.
    const away = layers.some((l) => l.stack === 'diverge' && splitOf(catalog, l, xField) && Math.max(0, units.indexOf(unitOf(catalog, l, xField)!)) === ui);
    return { v: (n: number) => (n - bottom) / (top - bottom), ticks: fine, coarse: two.length > 1 ? two : fine.filter((_, i) => i % 2 === 0), text: (t: number) => (share ? fmtPct(t) : formatUnit(away ? Math.abs(t) : t, u || lone, 'compact')) };
  });
  let unit: Draw['unit'] = xScale(keys, shared, 0, 1), xv: Draw['xv'];
  // A column's width is its x's total over the engine's total, so with a `limit` the columns stop short of the plot's end, as a band does.
  const widths = new Map<string, number>();
  if (wide && keys.length) {
    const all = result.totals[wide];
    if (!all) throw new Error('A bar with "' + wide + '" on size is as wide as its share of the engine\'s total of it, and this result\'s totals give ' + JSON.stringify(all) + ' for "' + wide + '". Return the total from the query layer, or remove "size" for columns of one width.');
    let run = 0;
    const from = new Map(keys.map((key) => { const at = run, w = ((whole.get(said.get(key)!)?.[wide] as number) || 0) / all; widths.set(key, w); run += w; return [key, at]; }));
    unit = { x: (key) => from.get(key)!, w: 0, cx: (key) => from.get(key)! + widths.get(key)! / 2, span: (key) => widths.get(key)! };
  }
  if (xOn) {
    // A linear x. A row sits at its value, or where it has a bin, `<dimension>@end`, across it. A metric's scale holds
    // zero and is rounded, as y's is. A dimension's runs from its first bin to its last and no further, so bars meet
    // the edges of the plot. Its ticks are y's too, and all but the two ends are ranked, as the middle date is.
    const at = new Map(rows.map((r) => [k(r), r])), lo = (key: string) => num(at.get(key)!, xOn), hi = (key: string) => (at.get(key)![xOn + '@end'] as number | undefined) ?? lo(key);
    const vals = keys.flatMap((key) => [lo(key), hi(key)]).concat(layers.map((l) => l.encode && l.encode.x).filter((x): x is number => typeof x === 'number'))
      .concat(layers.filter(across).flatMap((l) => [l.encode!.x, l.encode!.x2].flatMap((f) => (typeof f === 'number' ? [f] : rows.map((r) => r[f!] as number).filter((n) => n != null)))));
    const x = scaleLinear().domain(xDim ? [min(vals) ?? 0, max(vals) ?? 1] : [Math.min(0, min(vals) ?? 0), Math.max(0, max(vals) ?? 0) || 1]);
    if (guides.x && !xDim) x.nice(4);
    const [left, right] = x.domain() as [number, number], to = (n: number) => (n - left) / (right - left || 1);
    xv = to;
    const xM = xDim ? undefined : metricOf(catalog, xOn);                 // a number dimension has no unit in the catalog, so its ticks are plain numbers
    unit = { x: (key) => to(lo(key)), w: 0, cx: (key) => to((lo(key) + hi(key)) / 2), span: (key) => to(hi(key)) - to(lo(key)) };
    if (guides.x && keys.length) x.ticks(4).forEach((t, i, all) => {
      nodes.push(axisTick('x-axis', t, to(t), xM ? formatValue(t, xM, 'compact') : fmt(t, true), { anchor: to(t) <= 0 ? 'start' : to(t) >= 1 ? 'end' : 'middle', rank: Number(i > 0 && i < all.length - 1) }));
    });
  }
  // One metric sizes the dots of a plot, whichever layers name it. On a bar it is the column's width, and has no key.
  const sizeBy = layers.map((l) => (l.mark === 'bar' ? undefined : l.encode && l.encode.size)).find((f): f is string => typeof f === 'string');
  const size = sizeBy ? { field: sizeBy, top: max(rows, (r) => num(r, sizeBy)) || 1 } : undefined;

  if (guides.y) scales.forEach(({ v, ticks, coarse, text }, ui) => ticks.forEach((t) => {
    // A short plot keeps the ticks a count of 2 would give on this scale. The rest are ranked, to be given up there.
    const rank = Number(!coarse.includes(t));
    // The second scale's ticks are on the far side, keyed by its unit. The grid is the first scale's alone.
    if (ui) { if (guides.y2) nodes.push(axisTick('y-axis-2', units[ui] + ':' + t, v(t), text(t), { rank })); return; }
    if (guides.grid) nodes.push({ key: 'grid:' + t, part: 'plot', kind: 'line', t: v(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide', ...(rank && { rank }) });
    nodes.push(axisTick('y-axis', t, v(t), text(t), { rank }));
  }));
  if (guides.x && keys.length && !xOn) {
    const last = keys.length - 1;
    // First, middle and last, each once: one row has one tick. The prototype emits it twice, under one key.
    const idx = isTime ? [...new Set([0, Math.floor(last / 2), last])] : keys.map((_, i) => i);
    // Under columns of unequal width a label is ranked by how wide its column is: the widest stays, and the rest are
    // given up from the narrowest where they would meet, which only a painter that knows how wide a label is can see.
    const order = wide ? keys.slice().sort((a, b) => widths.get(b)! - widths.get(a)!) : [];
    idx.forEach((i, j) => {
      const mid = isTime && j > 0 && j < idx.length - 1, rank = wide ? order.indexOf(keys[i]!) : mid ? 1 : 0;   // the middle date is given up on a narrow plot
      nodes.push(axisTick('x-axis', keys[i]!, unit.cx(keys[i]!), isTime ? fmtTime(said.get(keys[i]!)!) : said.get(keys[i]!)!,
        { row: keys[i]!, anchor: !isTime ? 'middle' : j === 0 ? 'start' : j === idx.length - 1 ? 'end' : 'middle', rank }));
    });
  }
  const ids = layerKeys(layers), ends = new Map<string, number>();
  // Bars of one metric that fall below nothing as well as rise from it: each is a gain or a loss, and is painted as one.
  // A split plot's bars are painted by their series, and are not these.
  const diverges = (l: Layer) => { const y = l.encode!.y; return typeof y === 'string' && !splitOf(catalog, l, xField) && rows.some((r) => (r[y] as number) < 0); };
  const say: Draw['say'] = (r, f) => { const M = metricOf(catalog, f); return typeof r[f] !== 'number' ? String(r[f]) : M ? formatValue(r[f] as number, M) : fmt(r[f] as number); };
  layers.forEach((l, i) => {
    const draw = PLOT_MARKS[l.mark], prev = l.series === 'previous', span = spans[i]!;
    if (!draw) throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use line, area, bar, rule, dot, text, tick or unit.');
    // A bar stands on a row's share of x, a tick lies across it, and a unit's glyphs are as wide as it. A metric there gives it none, and neither does a number dimension that came with no bins.
    // But for a tick with nothing on y, which stands at the foot of a plot of points at each row's value on x: a rug.
    const rug = l.mark === 'tick' && !!xOn && !xDim && l.encode!.y == null;
    if (rug && l.encode!.x !== xOn) throw new Error('Layer ' + (i + 1) + ' is a tick at ' + JSON.stringify(l.encode!.x) + ' along the foot of a plot whose x is "' + xOn + '", so it would stand at places the axis does not measure. Encode "' + xOn + '" on its x.');
    if ((l.mark === 'bar' || l.mark === 'tick' || l.mark === 'unit') && xOn && !xDim && !rug) throw new Error('Layer ' + (i + 1) + ' is a ' + l.mark + ' with the metric "' + xOn + '" on x, and a ' + l.mark + ' needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
    // An area fills down from a line that runs one way along x. The points of two metrics run in no order there.
    if (l.mark === 'area' && xOn && !xDim) throw new Error('Layer ' + (i + 1) + ' is an area with the metric "' + xOn + '" on x, and an area fills under a line that runs one way along x, which the points of two metrics do not. Use "line" to join the points in the order of their rows, or put a dimension on x.');
    if ((l.mark === 'bar' || l.mark === 'unit') && xOn && rows.length && rows[0]![xOn + '@end'] == null) throw new Error((l.mark === 'bar' ? 'Bars' : 'The glyphs of a unit') + ' on the number dimension "' + xOn + '" need its bins, and this result has no "' + xOn + '@end". Return where each bin ends from the query layer, or use line or dot.');
    const v = scaleOf(l).v;
    const d: Draw = { say, id: ids[i]!, role: roleOf(l), paint: paintOf(l, catalog, result) || (prev ? 'compare' : 'series.1'), prev, rows: rows.filter((r) => (rug ? r[xOn!] != null : across(l) || span.has(r))), k, unit, v, xv, size, points: !!xOn && !xDim, worth: worths[i],
      ends: (r) => { const [lo, hi] = span.get(r)!; return [v(lo), v(hi)]; },
      step: !!xDim && !!xOn && rows.length > 0 && rows[0]![xOn + '@end'] != null,
      // A mark with two ends is painted by which way it goes only where its layer says so: `paint: "direction"`.
      ...((l.paint === 'direction' ? l.encode!.y2 != null : l.mark === 'bar' && !l.paint && l.encode!.y2 == null && diverges(l)) && { polarity: metricOf(catalog, [l.encode!.y, l.encode!.y2].find((f) => typeof f === 'string'))?.polarity }) };
    if (!splitOf(catalog, l, xField)) return nodes.push(...draw(l, d));
    // Split by detail, every series is in the layer's own paint, and none has a label at its end: a label is in its series' colour.
    const plain = !paintedOf(catalog, l, xField);
    series.forEach((s, j) => {
      // Bars of one x that are not stacked sit side by side: overlapping bars are never what was meant. Lines and areas overlay.
      const drawn = draw(l, { ...d, series: s, paint: prev || plain ? d.paint : 'series.' + (j + 1), ...(plain && { mass: true }), rows: d.rows.filter((r) => r[split!] === s), ...(l.mark === 'bar' && !l.stack && { slot: [j, series.length] }) });
      nodes.push(...drawn);
      // Where the series' line ends, for its label: half way up its band where areas are stacked.
      const last = drawn.filter((n): n is PathNode => n.kind === 'path').map((n) => n.points[n.points.length - 1]!).pop();
      if (last && !plain) ends.set(s, l.mark === 'area' && l.stack ? ((last.v0 || 0) + last.v) / 2 : last.v);
    });
  });
  if (painted) {
    // Both keys to the series, each in its own part, as a band has. The plan names one in `parts`; a fit rule swaps them.
    // A label sits beside the plot at the height its line ends. Two lines that end close have labels that collide:
    // that is the painter's to see to, as place() does, since only it knows how tall a label is (reference, Open 5).
    series.forEach((s, j) => {
      if (ends.has(s)) nodes.push({ key: 'label:' + s, part: 'labels', kind: 'text', series: s, t: ends.get(s)!, text: s, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'series.' + (j + 1), layer: 'guide' });
    });
    nodes.push(...seriesLegend(series));
  }
  if (size) nodes.push(...sizeKey(metricOf(catalog, size.field)!, size.top));
  layers.forEach((l, i) => { if (worths[i] != null) nodes.push(...unitKey(ids[i]!, worths[i]!, metricOf(catalog, l.encode!.y))); });
  return { nodes, rows: keys, ...(split && (painted ? { series } : { detail: series })), scale };
}
/** A tick's label on an axis, whichever layout the axis is in: a plot's and a grid's are the same node. It stands at
 * `at` along its axis, a ratio: across for the x axis, and up for the two beside the plot, whose labels end at the plot
 * on the near side and start from it on the far one. One with a rank is given up for room before one with none, and
 * one under a mark of a row says which. What stands on an axis, and which of its labels are ranked, is the layout's:
 * a scale's round numbers, the first, middle and last of a run of days, every category, the edges of bins. */
function axisTick(part: 'x-axis' | 'y-axis' | 'y-axis-2', k: string | number, at: number, text: string, { anchor, row, rank }: { anchor?: TextNode['anchor']; row?: string; rank?: number } = {}): TextNode {
  const x = part === 'x-axis';
  return { key: (x ? 'xtick:' : 'ytick:') + k, part, kind: 'text', ...(x ? { x: at } : { t: at }), ...(row != null && { row }), text, anchor: anchor ?? (x ? 'middle' : part === 'y-axis' ? 'end' : 'start'),
    ...(!x && { baseline: 'middle' as const }), font: 'tick', paint: 'ink.muted', layer: 'guide', ...(rank && { rank }) };
}
/** The key to sizes: the metric's name, then each step with the most it stands for, in the metric's unit. */
export function sizeKey(metric: MetricDef, top: number): SceneNode[] {
  // A step of a count is a whole number of things. Where the most is so few that the steps would round to each other, they are said as they are.
  const whole = (n: number) => (metric.unit === 'count' && top >= SIZES ** 2 ? Math.round(n) : n);
  const nodes: SceneNode[] = [{ key: 'size:title', part: 'size', kind: 'text', text: metric.label, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' }];
  for (let s = 1; s <= SIZES; s++) {
    nodes.push({ key: 'size:' + s, part: 'size', kind: 'circle', pulse: false, size: s, paint: 'ink.muted', layer: 'guide' });
    nodes.push({ key: 'size:' + s + ':label', part: 'size', kind: 'text', text: formatValue(whole(top * (s / SIZES) ** 2), metric, 'compact'), anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
  }
  return nodes;
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
  const f = l.encode!.text as string, M = catalog.metrics[f], D = catalog.dimensions[f];
  // A dimension is said as the readout says it, so a day is "Sep 29". The prototype writes it raw: a deliberate departure.
  if (!M || l.series !== 'delta') return { text: M ? formatValue(num(r, f), M) : D ? formatDimension(r[f], D) : String(r[f]), paint: 'ink' };
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

/* What a mark in a row's track is drawn with: its layer's key, role and paint, the row's key, its value and its second end, and the track's scale. */
interface Track {
  id: string;
  role: Role;
  paint: string;
  k: string;
  /** The row's value on the track. */
  at: number;
  /** Its second end, where the layer has one. */
  to?: number;
  /** A value on the track's x, as a ratio of its width. */
  v: (n: number) => number;
  /** The track stands beside the label, so its marks are not behind any text. */
  beside: boolean;
  /** For a bar with two ends: its metric's polarity. */
  polarity?: Polarity | undefined;
  /** For a `unit`: what one of its glyphs is worth. `at` is then the whole glyphs the row's value is drawn as, times it. */
  worth?: number | undefined;
  /** The series this is, where the layer is split into them: the row then has a mark for each. */
  series?: string;
  /** The series are in one paint, by `detail`, and lie over each other on the track: each lets the ones under it show, as a line of a mass does. */
  mass?: boolean;
}
/* A mark's key and what it came from: its row, and its series where the row has one of it for each. */
const inRow = ({ id, k, series }: Track) => ({ key: id + ':' + k + (series == null ? '' : ':' + series), row: k, ...(series != null && { series }) });
type TrackFn = (l: Layer, d: Track) => SceneNode[];

// A bar runs from zero to its value, so one below zero lies to the left of where the others start. With a second end
// it runs from its value to that, and where its layer says `paint: "direction"` it is painted by which way it goes. Behind a label it is a tint.
const trackBar: TrackFn = (_l, d) => {
  const { role, paint, at, to, v, beside, polarity } = d, v0 = v(to == null ? 0 : at), v1 = v(to ?? at);
  return [{ ...inRow(d), part: 'rows', kind: 'rect', v: v1, ...(v0 && { v0 }), paint: toned(polarity, v0, v1, paint), ...(!beside && { opacity: 0.2, tone: 'soft' as const }), layer: 'data', role }];
};
// A rule lies along the track from one of the row's values to another, or from zero where it has one end.
const trackRule: TrackFn = (l, { id, role, k, at, to, v }) => [{ key: id + ':' + k, part: 'rows', kind: 'line', x: v(at), x2: v(to ?? 0), t: 0.5, row: k, paint: l.paint || 'ink', layer: 'data', role }];
// A tick stands across the row at its value.
// With `align` it is the half of that to one side of the row's middle: the start is the top of the row, where a page begins.
const trackTick: TrackFn = (l, d) => [{ ...inRow(d), part: 'rows', kind: 'line', x: d.v(d.at), x2: d.v(d.at), t: l.align === 'start' ? 0.5 : 0, t2: l.align === 'end' ? 0.5 : 1, paint: l.paint || 'ink', width: 2, ...(d.mass && { opacity: MASS }), layer: 'data', role: d.role }];
// A dot stands on the track at its value, half way up the row. With a dimension on detail the row has one for each of its pairs.
const trackDot: TrackFn = (_l, d) => [{ ...inRow(d), part: 'rows', kind: 'circle', pulse: false, x: d.v(d.at), t: 0.5, paint: d.paint, ...(d.mass && { opacity: MASS }), layer: 'data', role: d.role }];
// A run of glyphs along the track from where it has zero, one for each `worth`. A glyph has its own share of the track
// and the height of the row, and is as large as the lesser of the two lets it be: that is the painter's (types.ts, CircleNode).
const trackUnit: TrackFn = (_l, { id, role, paint, k, at, v, worth = 1 }) => {
  const w = v(worth) - v(0);
  return Array.from({ length: Math.round(at / worth) }, (_, j): SceneNode => ({ key: id + ':' + k + ':' + (j + 1), part: 'rows', kind: 'circle', pulse: false, x: v((j + 0.5) * worth), t: 0.5, w, h: 1, row: k, paint, layer: 'data', role }));
};
/* The marks a row's track draws, by name. A new mark is a function here. Text is not among them: it is set in the row, not on the scale. */
const TRACK_MARKS: Partial<Record<Mark, TrackFn>> = { bar: trackBar, rule: trackRule, tick: trackTick, dot: trackDot, unit: trackUnit };
/** Whether a row's track is read by where its marks are, and so stands beside the label and not behind it: any mark but a bar from zero, a bar that is divided into a stack, and the range behind the marks. */
export function trackBeside(layers: Layer[]): boolean {
  return layers.some((l) => TRACK_MARKS[l.mark] && (l.mark !== 'bar' || !!l.stack || (l.encode && (l.encode.x2 != null || l.encode.x == null))));
}
/** The marks core draws itself, as an error lists them. Any other name is a custom mark's, registered in code (marks.ts). */
export const BUILT_IN_MARKS: string[] = [...new Set(Object.keys(PLOT_MARKS).concat(Object.keys(TRACK_MARKS), 'arc', 'cell'))];

/** The dimension the rows of a list are divided by, where a layer divides them: the query's other dimension, on the
 * `color` of a stacked bar or on `detail`. Null for a list whose rows are the result's own. */
export function rowSplitOf(catalog: Catalog, layers: Layer[]): string | null {
  const dim = layers.map((l) => l.encode && l.encode.y).find((f) => isDim(catalog, f)) as string | undefined;
  return (dim && layers.map((l) => splitOf(catalog, l, dim)).find(Boolean)) || null;
}
/* What a list has a row for: its key, the row its text and its undivided marks read, and the result's rows it holds.
 * A list is a row of the result each. Divided by a second dimension the result holds a row for each pair, so a row of
 * the list is a value of the first, in the order the result first has them, and what it reads is the engine's total
 * for that value: no pair is summed to make one. */
function listOf(catalog: Catalog, layers: Layer[], result: Result): { dim: string; split: string | null; own: Map<Row, string>; items: { k: string; row: Row; pairs: Row[] }[] } {
  const dim = layers.map((l) => l.encode && l.encode.y).find((f) => isDim(catalog, f)) as string, split = rowSplitOf(catalog, layers), rows = result.rows;
  const own = rowKeys(rows, dim, split);
  if (!split) return { dim, split, own, items: rows.map((r) => ({ k: own.get(r)!, row: r, pairs: [r] })) };
  const totals = result.totalsBy && result.totalsBy[dim];
  if (rows.length && !totals) throw new Error('These rows are divided by "' + split + '", so each is a value of "' + dim + '" and reads the engine\'s total for it, and this result has no totalsBy["' + dim + '"]. Return it from the query layer, or take "' + split + '" off the layers and out of query.by.');
  const total = new Map((totals || []).map((t) => [str(t, dim), t]));
  return { dim, split, own, items: [...new Set(rows.map((r) => own.get(r)!))].map((k) => { const pairs = rows.filter((r) => own.get(r) === k); return { k, row: total.get(str(pairs[0]!, dim)) || { [dim]: pairs[0]![dim] }, pairs }; }) };
}
/** The rows a list has, as what each one's text reads: the result's rows, or the engine's totals for the first
 * dimension where a layer divides the rows by the second. For whatever counts or measures a list's rows. */
export function listRows(catalog: Catalog, layers: Layer[], result: Result): Row[] {
  return listOf(catalog, layers, result).items.map((i) => i.row);
}

// A dimension on y: a row for each of its values, with a track that has a metric on x. The ranked bar list is the first of these.
// The track's scale is derived here, once, from what its layers put on x. It is linear and holds zero and whatever is on
// either side of it, and it is not rounded: a row's track has no axis to read against.
// With the query's second dimension on the color of a stacked bar, each row's bar is divided into a series for each of
// its values, in that dimension's own order, which is the engine's: paint follows it, and there is a legend.
// With it on the detail of a dot or a tick, a row has one for each of its pairs, all in one paint and with no legend.
function sceneRows(catalog: Catalog, layers: Layer[], result: Result, limit: number | null): Body {
  const nodes: SceneNode[] = [];
  const { dim, split, own, items: all } = listOf(catalog, layers, result), items = all.slice(0, limit || all.length), rows = items.map((i) => i.row), shown = items.flatMap((i) => i.pairs);
  // A bar with nothing on x is no mark of a value: it is the range the row's marks are read against, as an arc with
  // nothing on angle is a gauge's. It is the catalog `domain` of the metric the other marks put on the track, divided
  // where the catalog's `bands` divide it. The track's scale holds it whole.
  const ranged = (l: Layer) => l.mark === 'bar' && l.encode!.x == null && l.encode!.x2 == null, fieldOn = (l: Layer) => [l.encode!.x, l.encode!.x2].find((f) => typeof f === 'string') as string | undefined;
  const tracked = layers.filter((l) => TRACK_MARKS[l.mark] && !ranged(l)), units = [...new Set(tracked.map((l) => metricOf(catalog, fieldOn(l))?.unit))];
  const behind = layers.findIndex(ranged), of = (tracked.map(fieldOn).find(Boolean) || '').split('@')[0]!, range = behind < 0 ? undefined : catalog.metrics[of];
  if (behind >= 0 && !range) throw new Error('Layer ' + (behind + 1) + ' is a bar with nothing on x, which is the range a row\'s marks are read against, and no other mark in these rows puts a metric on x for it to be the range of. Add one, for example { "mark": "bar", "encode": { "y": "' + dim + '", "x": a metric } }, or encode a metric on this bar\'s x.');
  // Where each part of the range starts and ends: the domain's two ends, and each band between them. A metric the
  // catalog gives no domain has no range to draw, as one with no target has no tick at it: no mark, and no error.
  const [least, most] = (range && range.domain) || [], edges = least == null || most == null ? [] : [least, ...((range && range.bands) || []).filter((b) => b > least && b < most), most];
  if (edges.length - 1 > BANDS) throw new Error('The catalog divides "' + of + '" into ' + (edges.length - 1) + ' bands, and there are ' + BANDS + ' band paints. Give its "bands" ' + (BANDS - 1) + ' values at most.');
  if (units.length > 1) throw new Error('These rows have marks that measure in ' + units.length + ' units (' + units.join(', ') + '), and a row has one track. Keep the marks of one unit, and show the other metric as a text layer.');
  // What a layer puts on the track in one row: its value, and its second end where it has one. A layer of the previous
  // series reads the metric's companion. A tick that is a `reference` stands at the metric's catalog `target`, as a gauge's mark does.
  // What a unit's glyphs are worth is worked out from every row of the result, so it holds when a height limit trims the list.
  const worths = new Map(tracked.filter((l) => l.mark === 'unit').map((l) => {
    const x = l.encode!.x;
    if (typeof x !== 'string' || !metricOf(catalog, x)) throw new Error('A "unit" in rows needs a metric on x to count its glyphs from, and this one has ' + held(x) + ' there. Encode { "y": "' + dim + '", "x": <a metric> }.');
    return [l, worthOf(catalog, x, all.map((i) => i.row))];
  }));
  const keyOf = new Map(items.map((i) => [i.row, i.k]));
  const on = (l: Layer, r: Row): (number | null | undefined)[] => {
    const { x, x2 } = l.encode!, f = l.series === 'previous' ? x + '@previous' : (x as string);
    // A unit lies from nothing to the whole glyphs its value is drawn as, which is not quite its value.
    if (worths.has(l)) return [r[f] == null ? null : unitCount(num(r, f), worths.get(l)!, valueOf(f, keyOf.get(r)!)) * worths.get(l)!];
    const at = typeof x === 'number' ? x : l.mark === 'tick' && roleOf(l) === 'reference' ? metricOf(catalog, f)?.target : (r[f] as number | null | undefined);
    return x2 == null ? [at] : [at, typeof x2 === 'number' ? x2 : (r[x2] as number | null | undefined)];
  };
  // The series a divided row has, and where each one's share of a stacked bar starts and ends. A share is of the
  // engine's total for the row.
  const series = split ? [...new Set(((result.totalsBy && result.totalsBy[split]) || result.rows).map((r) => r[split] as string))] : [];
  const divides = (l: Layer) => !!split && splitOf(catalog, l, dim) === split, painted = layers.some((l) => paintedOf(catalog, l, dim));
  if (painted && series.length > SERIES) throw new Error('Splitting by "' + split + '" makes ' + series.length + ' series, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
  // By detail a row has a mark for each pair where the marks can lie over each other and still be read: a dot or a tick.
  const lost = layers.findIndex((l) => divides(l) && !l.stack && l.mark !== 'dot' && l.mark !== 'tick');
  if (lost >= 0) throw new Error('Layer ' + (lost + 1) + ' is a "' + layers[lost]!.mark + '" in rows with "' + split + '" on detail, which would lay one over another in each row, all in one paint. Use "dot" or "tick" for a mark at each value' + (layers[lost]!.mark === 'bar' ? ', or encode "' + split + '" on color and give the bar "stack"' : '') + ', or remove "detail".');
  const whole = new Map(items.flatMap((i) => i.pairs.map((r) => [r, i.row] as const)));
  const spans = new Map(tracked.filter((l) => divides(l) && l.stack).map((l) => { const f = l.encode!.x as string; return [l, stacked(shown, series, split!, (r) => own.get(r)!, f, l.stack, l.stack === 'normalize' ? (r) => (whole.get(r)![f] as number) || Infinity : () => 1)] as const; }));
  const vals = edges.concat(tracked.flatMap((l) => (spans.has(l) ? [...spans.get(l)!.values()].flat() : divides(l) ? shown.flatMap((r) => on(l, r) as number[]) : rows.flatMap((r) => on(l, r) as number[])))), beside = trackBeside(layers);
  const lo = Math.min(0, min(vals) ?? 0), hi = Math.max(0, max(vals) ?? 0) || (lo ? 0 : 1), v = (n: number) => (n - lo) / (hi - lo);
  const ids = layerKeys(layers), cols = columnsOf(catalog, layers);
  // A column after the first is ranked by its place, so the last goes first. One column of values needs no header: the view's title says what it is.
  const rank = (l: Layer) => { const j = cols.indexOf(l); return j > 0 && { rank: j }; };
  // Where the columns are headed, so is what the rows are: the dimension's name over the labels, from the start.
  if (cols.length > 1) nodes.push({ key: 'column:' + dim, part: 'columns', kind: 'text', text: catalog.dimensions[dim]!.label, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
  if (cols.length > 1) cols.forEach((l) => {
    nodes.push({ key: 'column:' + ids[layers.indexOf(l)], part: 'columns', kind: 'text', text: columnLabel(catalog, l), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank(l) });
  });
  // A mark with a field on color is painted by it, row by row: rows that share a value share a series colour, in the
  // order the values first come. The row's own dimension there is a colour for each row.
  const shade = (l: Layer, r: Row) => { const c = l.encode!.color; return typeof c === 'string' ? 'series.' + ([...new Set(rows.map((x) => x[c]))].indexOf(r[c]) % SERIES + 1) : undefined; };
  items.forEach(({ k, row: r, pairs }) => {
    // The row itself: what a painter keys, and what is chosen and named when the row is.
    nodes.push({ key: 'row:' + k, part: 'rows', kind: 'row', row: k, paint: 'ink', layer: 'data' });
    layers.forEach((l, li) => {
      const draw = TRACK_MARKS[l.mark], span = spans.get(l);
      // The range behind the marks: a part for each band, from the least. They are a guide, as a grid is, and in paints of their own.
      if (ranged(l)) edges.slice(1).forEach((to, j) => nodes.push({ key: ids[li] + ':' + k + ':' + (j + 1), part: 'rows', kind: 'rect', v: v(to), ...(v(edges[j]!) && { v0: v(edges[j]!) }), row: k, paint: 'band.' + (j + 1), layer: 'guide', role: roleOf(l) }));
      else if (draw && divides(l)) {
        // A mark for each of the row's pairs, in the series' order: a stacked bar's share, from where the one before it ends.
        // By detail it is a mark at each pair's own value, all in the layer's paint.
        series.forEach((s, j) => pairs.forEach((p) => {
          if (p[split!] !== s) return;
          const ends = span ? span.get(p) : on(l, p), d = { id: ids[li]!, role: roleOf(l), k, series: s, v, beside };
          if (!ends || ends[0] == null) return;
          nodes.push(...draw(l, span ? { ...d, paint: 'series.' + (j + 1), at: ends[0], to: ends[1]! } : { ...d, paint: paintOf(l, catalog, result) || shade(l, r) || 'series.1', at: ends[0], mass: true }));
        }));
      } else if (draw) {
        const [at, to] = on(l, r), two = l.encode!.x2 != null;
        if (at == null || (two && to == null)) return;                  // a row with nothing to mark has no mark
        nodes.push(...draw(l, { id: ids[li]!, role: roleOf(l), paint: paintOf(l, catalog, result) || shade(l, r) || (l.series === 'previous' ? 'compare' : 'series.1'), k, at, ...(two && { to: to! }), v, beside, worth: worths.get(l),
          ...(l.mark === 'bar' && two && l.paint === 'direction' && { polarity: metricOf(catalog, fieldOn(l))?.polarity }) }));
      } else if (l.mark === 'text') {
        const cell = cellOf(catalog, l, r);
        nodes.push({ key: ids[li] + ':' + k, part: 'rows', kind: 'text', row: k, text: cell.text,
          anchor: l.align === 'end' ? 'end' : 'start', baseline: 'middle', font: cols.includes(l) ? 'value' : 'label', paint: cell.paint, layer: 'data', role: roleOf(l), ...rank(l) });
      } else {
        throw new Error('The "' + l.mark + '" mark has no rule for rows yet. Use bar, text, rule, tick, dot or unit.');
      }
    });
  });
  worths.forEach((worth, l) => nodes.push(...unitKey(ids[layers.indexOf(l)]!, worth, metricOf(catalog, l.encode!.x))));
  if (painted) {
    // Both keys to the series, each in its own part, as a band has: a swatch and a name for each, and one line that
    // names the series with the most, in its colour, by the engine's totals. The plan names one in `parts`.
    const name = (s: unknown) => formatDimension(s as string, catalog.dimensions[split!]!), f = layers.find((l) => spans.has(l))!.encode!.x as string, by = result.totalsBy && result.totalsBy[split!];
    nodes.push(...seriesLegend(series, name));
    const top = by && leader(result, split!, f);
    if (top) nodes.push({ key: 'legend-top', part: 'legend-top', kind: 'text', series: top[split!] as string, text: name(top[split!]) + ' ' + portion(num(top, f), result.totals[f], metricOf(catalog, f)!), anchor: 'start', font: 'label', paint: 'series.' + (series.indexOf(top[split!] as string) + 1), layer: 'guide' });
  }
  return { nodes, rows: items.map((i) => i.k), ...(split && (painted ? { series } : { detail: series })), ...(beside && { track: 'beside' as const }) };
}

// No positional dimension: one band, stacked and normalized, split by colour. A share is of the engine's total, so
// with a `limit` the band stops short of its end by what the rows past the limit hold. With no total, or one of zero,
// no segment has a share and none has a length: the legend says each value. The rows are never summed to make one.
function sceneBand(catalog: Catalog, layer: Layer, rows: Row[], totals: Result['totals']): Body {
  const nodes: SceneNode[] = [], m = layer.encode!.x as string, dim = layer.encode!.color as string;
  const total = totals[m] || Infinity, own = rowKeys(rows, dim), k = (r: Row) => own.get(r)!;
  rows.forEach((r, i) => {
    nodes.push({ key: 'seg:' + k(r), part: 'band', kind: 'rect', v: num(r, m) / total, row: k(r), paint: 'series.' + ((i % 6) + 1), layer: 'data', role: roleOf(layer) });
  });
  return { nodes: nodes.concat(shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, catalog.metrics[m]!, totals[m], (i) => 'series.' + ((i % 6) + 1))), rows: rows.map(k) };
}
// A `unit` where a bar would make the band: a grid of a hundred cells, ten rows of ten, in reading order. The part
// holds its shape, as a circle of arcs does. With a dimension on color the cells are shared out among its values by
// each one's share of the engine's total (unitShares), a run of cells and a series colour each, and the cells that
// leaves, the rows past a `limit`, are painted as no value. With no total, or one of zero, every cell is: the legend
// says each value, and the rows are never summed. With no dimension the metric is read against its catalog `domain`, as
// a gauge reads it: the cells up to its place are lit, and the rest are the same paint as a tint. A cell there is
// keyed by its place alone, so one that stays lit keeps its key. The legend is the band's.
function sceneGrid(catalog: Catalog, layer: Layer, id: string, result: Result): Body & Pick<Scene, 'aspect'> {
  const m = layer.encode!.x, dim = layer.encode!.color, M = metricOf(catalog, m), side = Math.sqrt(UNIT_CELLS), role = roleOf(layer);
  if (typeof m !== 'string' || !M || m.includes('@')) throw new Error('A "unit" with no dimension on x or y is a grid of a hundred, and needs a metric on x to share it out by. This one has ' + held(m) + ' there. Encode { "x": <a metric>, "color": <a dimension> }.');
  const nodes: SceneNode[] = [], own = paintOf(layer, catalog, result) || 'series.1';
  const cell = (key: string, more: Partial<RectNode>): number => nodes.push({ key, part: 'band', kind: 'rect', x: (nodes.length % side) / side, w: 1 / side, y: Math.floor(nodes.length / side) / side, h: 1 / side, paint: own, layer: 'data', role, ...more });
  if (!isDim(catalog, dim)) {
    if (!M.domain) throw new Error('A "unit" with no dimension reads "' + m + '" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the grid by it.');
    const v = result.totals[m], [least, most] = M.domain, lit = v == null || !(v > least) ? 0 : Math.max(1, Math.round(Math.min(1, (v - least) / (most - least || 1)) * UNIT_CELLS));
    for (let i = 0; i < UNIT_CELLS; i++) cell(id + ':' + (i + 1), i < lit ? {} : { opacity: 0.14, tone: 'soft' });
    return { nodes: nodes.concat(unitKey(id, (most - least) / UNIT_CELLS, M)), aspect: 1 };
  }
  const rows = result.rows, total = result.totals[m], keys = rowKeys(rows, dim), k = (r: Row) => keys.get(r)!, paint = (i: number) => 'series.' + ((i % SERIES) + 1);
  // A count of cells cannot be less than none, so a value below zero is refused, as a stack's is.
  const cells = unitShares(rows.map((r) => { const v = (r[m] as number | null) ?? 0; unitCount(v, 1, valueOf(m, k(r))); return v; }), total);
  rows.forEach((r, i) => { for (let n = 1; n <= cells[i]! && nodes.length < UNIT_CELLS; n++) cell(id + ':' + k(r) + ':' + n, { row: k(r), paint: paint(i) }); });
  for (let n = 1; nodes.length < UNIT_CELLS; n++) cell(id + '#rest:' + n, { paint: 'seq.none' });
  return { nodes: nodes.concat(shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, M, total, paint)), rows: rows.map(k), aspect: 1 };
}
// A legend's entry, whichever legend it is in: a swatch in the paint of what it stands for, a row or a series, and its name.
const legendEntry = (k: string, of: { row: string } | { series: string }, text: string, paint: string): SceneNode[] => [
  { key: 'swatch:' + k, part: 'legend', kind: 'rect', ...of, paint, layer: 'data' },
  { key: 'legend:' + k, part: 'legend', kind: 'text', ...of, text, anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' },
];
// The legend of a plot or of rows split into series that are painted apart: an entry for each, in the series' own
// order, which is the order of their paints. An entry has no value: a series is read against the axis.
const seriesLegend = (series: string[], name: (s: string) => string = (s) => s): SceneNode[] => series.flatMap((s, j) => legendEntry(s, { series: s }, name(s), 'series.' + (j + 1)));
// The legends of a whole split by colour, for a band and for a circle of arcs: both of them, each in its own part.
// The plan names one in `parts`; a fit rule swaps them.
// A segment is named as the readout names it, so a day is "Sep 29". The prototype writes it raw: a deliberate departure.
// `said` is what an entry says of its row in place of its share: rings that are read against a range say the value.
function shareLegend(rows: Row[], k: (r: Row) => string, f: string, dim: DimensionDef, m: string, M: MetricDef, total: number | null | undefined, paint: (i: number) => string, said = (r: Row) => portion(num(r, m), total, M)): SceneNode[] {
  const nodes: SceneNode[] = [], name = (r: Row) => formatDimension(r[f], dim);
  rows.forEach((r, i) => {
    nodes.push(...legendEntry(k(r), { row: k(r) }, name(r), paint(i)));
    nodes.push({ key: 'share:' + k(r), part: 'legend', kind: 'text', row: k(r), text: said(r), anchor: 'end', baseline: 'middle', font: 'value', paint: 'ink', layer: 'guide' });
  });
  // One line for the whole of it, so it names no row. Its key has no colon after `legend`, so no segment's entry can
  // share it, whatever the segment is called. The prototype's is `legend:top`: a deliberate departure.
  if (rows.length) nodes.push({ key: 'legend-top', part: 'legend-top', kind: 'text', text: name(rows[0]!) + ' ' + said(rows[0]!), anchor: 'start', font: 'label', paint: 'ink', layer: 'guide' });
  return nodes;
}

const GAP = 0.004;    // turns between one segment and the next
const MARK = 0.004;   // turns to either side of a value that is marked on the circle, and not swept to
/** The inner radius from which a circle of arcs has a hole the number sits in. */
export const HOLE = 0.5;

const INNER = 0.3;   // the inner radius of the innermost ring, where a dimension on radius gives each value one
const RING = 0.82;   // how much of its share of the radius a ring fills. The rest parts it from the next
const SPLIT = 0.6;   // how far from the inner radius to the rim the first ring ends and the second starts
const CHILD = 0.6;   // how much of its segment's paint an arc of the second ring is drawn in
const RINGS = 6;     // the most rings a circle is divided into: under that each is too thin to follow round

// Arcs about one centre. No positional dimension and no general polar coordinates: `angle` and `radius` take a
// metric and a dimension between them, and which holds what is the form.
// A metric on angle and a dimension on color: a segment per row, each its share of the engine's total, so with a `limit`
// the circle stops short of closing, as a band stops short of its end. With a second dimension on detail there is a
// ring outside it, each segment's span divided among that dimension's values: the query is by the two, and a
// segment's span is the engine's total for it (`totalsBy`), never the sum of its rows.
// A dimension on angle and a metric on radius: an equal slice per row, in the engine's order, each reaching out to its
// value on a square-root scale, so its area carries the value. It starts at the centre: radius holds the metric.
// A dimension on radius and a metric on angle: a ring per row, the first outermost, each swept against the catalog
// `domain`, or the largest row where the metric has none. With nothing on angle it is the whole ring, behind the value.
// With no dimension it reads the metric against its catalog `domain`: its total swept from the start, or, as a
// `reference`, its `target` marked. A constant on angle is marked the same way. A layer with nothing on angle is the
// whole sweep: the range behind the value.
function sceneRadial(catalog: Catalog, layers: Layer[], q: Query, result: Result): Body & Pick<Scene, 'aspect'> {
  const half = layers.some((l) => l.sweep === 'half'), from = half ? -0.25 : 0, span = half ? 0.5 : 1;
  const ids = layerKeys(layers), arcs: ArcNode[] = [], legend: SceneNode[] = [], rim: SceneNode[] = [], seats: SceneNode[] = [];
  let keys: string[] | undefined, rings: string | undefined, detail: string[] | undefined;
  const arc = (key: string, l: Layer, lo: number, hi: number, r0: number, paint: string, more?: Partial<ArcNode>, r1 = 1): ArcNode => {
    const a = { a0: from + lo * span, a1: from + hi * span, r0, r1 };
    return { key, part: 'radial', kind: 'arc', ...a, d: arcD(a), paint, layer: 'data', role: roleOf(l), ...more };
  };
  layers.forEach((l, i) => {
    const enc = l.encode || {}, angle = enc.angle, r0 = enc.radius ?? 0, n = 'Layer ' + (i + 1), split = detailOf(catalog, l);
    // A `unit` about a centre: seats round the half circle, in rings, a wedge of them and a series colour for each row.
    // A seat is one of the metric while the engine's total is a hundred or fewer, and beyond that the round number at
    // which the total is a hundred seats or fewer. Each row's seats are its own value in whole glyphs, so they need not
    // sum to the total's. Under a `limit` the seats the rows past it would have are there, painted as no value.
    if (l.mark === 'unit') {
      const m = angle, dim = enc.color, M = metricOf(catalog, m), rows = result.rows, total = M && result.totals[m as string];
      if (typeof m !== 'string' || !M || !isDim(catalog, dim)) throw new Error(n + ' is a "unit" about a centre, which is seats round a half circle, and has ' + held(m) + ' on angle and ' + held(dim) + ' on color. Put a metric on angle and a dimension on color. For a grid read against the metric\'s range, put the metric on x and nothing on angle.');
      if (l.sweep !== 'half') throw new Error(n + ' is a "unit" with a metric on angle and no "sweep", and its seats sit round a half circle. Add "sweep": "half" to the layer.');
      if (keys) throw new Error(n + ' is a second layer split by color, and a circle is divided once. Remove one of them.');
      if (rows.length > SERIES) throw new Error('Splitting by "' + dim + '" makes ' + rows.length + ' groups of seats, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
      const own = rowKeys(rows, dim), k = (r: Row) => own.get(r)!, whole = M.unit === 'count';
      // With no total to read, the largest row is ten seats or fewer, as a stack's largest is ten glyphs.
      const worth = total ? unitWorth(total, UNIT_SEATS, whole) : worthOf(catalog, m, rows);
      const counts = rows.map((r) => (r[m] == null ? 0 : unitCount(num(r, m), worth, valueOf(m, k(r))))), filled = counts.reduce((s, c) => s + c, 0);
      const rest = q.limit && total ? Math.max(0, Math.round(total / worth) - filled) : 0, { seats: at, pitch } = unitSeats(filled + rest);
      const seat = (key: string, more: Partial<SceneNode>) => {
        const { a, r } = at[seats.length]!, turn = Math.PI * (1 - a);
        seats.push({ key, part: 'radial', kind: 'circle', pulse: false, x: 0.5 + r * Math.cos(turn) / 2, t: r * Math.sin(turn), w: pitch / 2, h: pitch, paint: 'seq.none', layer: 'data', role: roleOf(l), ...more } as SceneNode);
      };
      rows.forEach((r, j) => { for (let c = 1; c <= counts[j]!; c++) seat(ids[i] + ':' + k(r) + ':' + c, { row: k(r), paint: 'series.' + (j + 1) }); });
      for (let c = 1; c <= rest; c++) seat(ids[i] + '#rest:' + c, {});
      legend.push(...unitKey(ids[i]!, worth, M), ...shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, M, total, (j) => 'series.' + (j + 1)));
      keys = rows.map(k);
      return;
    }
    if (l.mark !== 'arc') throw new Error('The "' + l.mark + '" mark has no rule about a centre yet. Use arc or unit, or take "angle" off the other layers.');
    if (typeof r0 === 'number' && !(r0 >= 0 && r0 < 1)) throw new Error(n + ' has ' + JSON.stringify(r0) + ' on radius. It takes a number from 0 up to 1, the inner radius as a share of the outer (0.6 makes a donut); a metric, with a dimension on angle, for how far each slice reaches; or a dimension, with a metric on angle, for a ring each.');
    // A slice or a ring for each row: one dimension, on angle or on radius, and the metric on the other.
    const one = isDim(catalog, angle) ? angle : isDim(catalog, r0) ? r0 : null;
    if (typeof r0 === 'string') {
      if (!one) throw new Error(n + ' has the metric "' + r0 + '" on radius and no dimension on angle, so there is no slice for it to set the reach of. Put a dimension on angle, for a slice each, or a number from 0 up to 1 on radius for the inner radius.');
      if (one === angle && isDim(catalog, r0)) throw new Error(n + ' has a dimension on both angle ("' + angle + '") and radius ("' + r0 + '"), and an arc is laid out by one. Keep the dimension on angle and put a metric on radius, for a slice each, or keep it on radius and put a metric on angle, for a ring each.');
    }
    if (one != null) {
      const slices = one === angle, what = slices ? 'slice' : 'ring', dim = catalog.dimensions[one]!, rows = result.rows, own = rowKeys(rows, one), k = (r: Row) => own.get(r)!;
      if (l.sweep) throw new Error(n + ' has sweep: "half" and a ' + what + ' for each "' + one + '", which goes all the way round. Remove "sweep": it is for a circle divided by color, and for a gauge.');
      if (split) throw new Error(n + ' encodes "' + split + '" on detail and has a ' + what + ' for each "' + one + '". A second ring divides the segments of a circle that color has divided: put the metric on angle, "' + one + '" on color and "' + split + '" on detail, or remove "detail".');
      const m = slices ? r0 : angle, M = metricOf(catalog, m), top = M ? Math.max(0, max(rows, (r) => num(r, m as string)) ?? 0) || 1 : 1;
      if (slices && !M) throw new Error(n + ' has a slice for each "' + one + '" and ' + (enc.radius == null ? 'nothing' : JSON.stringify(enc.radius)) + ' on radius. Every slice is as wide as the next, so a metric on radius says how far each reaches: put one there. For a share each, put the metric on angle and "' + one + '" on color.');
      // ponytail: slices in one paint. A second dimension on color would stack each slice, and that is not built.
      if (slices && enc.color != null) throw new Error(n + ' encodes ' + JSON.stringify(enc.color) + ' on color and has a slice for each "' + one + '", and the slices are drawn in one paint. Remove "color", or set the layer\'s "paint".');
      if (enc.color != null && enc.color !== one) throw new Error(n + ' has a ring for each "' + one + '" and encodes ' + JSON.stringify(enc.color) + ' on color. A ring is painted by its own dimension, for a colour and a legend entry each: encode "' + one + '" on color, or remove it.');
      // A circle is divided once. Rings of one dimension may be drawn by several layers: the whole ring, and the value on it.
      if (keys && rings !== one) throw new Error(n + ' divides the circle again, by "' + one + '", and a circle is divided once. Remove one of the layers that divide it.');
      if (!slices && rows.length > RINGS) throw new Error('A ring for each "' + one + '" makes ' + rows.length + ' rings, and a circle has room for ' + RINGS + '. Add "limit": ' + RINGS + ' to the query, or less.');
      if (slices) {
        // Where to thin the labels from: about four stay, then those half way between them, then the rest.
        const every = Math.ceil(rows.length / 4), rank = (j: number) => (j % every ? { rank: every % 2 || j % (every / 2) ? 2 : 1 } : {});
        rows.forEach((r, j) => {
          const reach = r[m as string] == null ? 0 : Math.sqrt(Math.max(0, num(r, m as string)) / top), lo = j / rows.length, hi = (j + 1) / rows.length, mid = (lo + hi) * Math.PI;
          // A row with no value, or none above zero, has no slice. It keeps its place and its label.
          if (reach > 0) arcs.push(arc(ids[i] + ':' + k(r), l, lo, hi - (rows.length > 1 ? GAP : 0), 0, l.paint || 'series.1', { row: k(r) }, reach));
          rim.push({ key: 'rim:' + k(r), part: 'rim', kind: 'text', x: 0.5 + Math.sin(mid) / 2, t: 0.5 + Math.cos(mid) / 2, row: k(r), text: formatDimension(r[one], dim),
            anchor: Math.sin(mid) > 0.2 ? 'start' : Math.sin(mid) < -0.2 ? 'end' : 'middle', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank(j) });
        });
      } else {
        if (angle != null && (!M || isDim(catalog, angle))) throw new Error(n + ' has a ring for each "' + one + '" and ' + JSON.stringify(angle) + ' on angle. Put a metric on angle, which each ring\'s arc sweeps to, or leave angle out for the whole ring.');
        const [least, most] = (M && M.domain) || [0, top], pitch = (1 - INNER) / (rows.length || 1), shade = (j: number) => l.paint || (enc.color != null ? 'series.' + (j + 1) : 'series.1');
        rows.forEach((r, j) => {
          const r1 = 1 - j * pitch, inner = r1 - pitch * RING;
          if (angle == null) return arcs.push(arc(ids[i] + ':' + k(r), l, 0, 1, inner, shade(j), { row: k(r), opacity: 0.14, tone: 'soft' }, r1));
          if (r[m as string] != null) arcs.push(arc(ids[i] + ':' + k(r), l, 0, Math.min(1, Math.max(0, (num(r, m as string) - least) / (most - least || 1))), inner, shade(j), { row: k(r) }, r1));
        });
        // A ring in a colour of its own has an entry in the legend, which says its value: a ring is no share of a whole.
        if (angle != null && enc.color != null && !legend.length) legend.push(...shareLegend(rows, k, one, dim, m as string, M!, null, shade, (r) => formatValue(r[m as string] as number | null, M!)));
      }
      keys = rows.map(k); rings = slices ? '' : one;
      return;
    }
    if (isDim(catalog, enc.color)) {
      const m = angle as string, dim = enc.color, total = result.totals[m] || Infinity, inner = r0 as number;
      if (!(m in catalog.metrics)) throw new Error(n + ' splits by "' + dim + '" with ' + JSON.stringify(angle) + ' on angle. Put a metric on angle: each segment is its share of that metric\'s total.');
      if (keys) throw new Error(n + ' is a second layer split by color, and a circle is divided once. Remove one of them.');
      // With a second ring a row is a pair, so the segments are the engine's own rows for the first dimension.
      const whole = split ? result.totalsBy && result.totalsBy[dim] : result.rows;
      if (!whole) throw new Error(n + ' divides each "' + dim + '" by "' + split + '", and a segment\'s span is the engine\'s total for it: this result has no totalsBy. Return it from the query layer, or remove "detail".');
      const rows = whole, own = rowKeys(rows, dim), k = (r: Row) => own.get(r)!, edge = split ? inner + (1 - inner) * SPLIT : 1;
      if (rows.length > SERIES) throw new Error('Splitting by "' + dim + '" makes ' + rows.length + ' segments, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
      // The second ring's values in the engine's order, which each segment's arcs run in.
      const kids = split ? [...new Set(((result.totalsBy && result.totalsBy[split]) || result.rows).map((r) => str(r, split)))] : [];
      // Each segment starts where the one before it ends, a hair apart.
      let run = 0;
      rows.forEach((r, j) => {
        const lo = run / total, hi = (run += num(r, m)) / total;
        arcs.push(arc(ids[i] + ':' + k(r), l, lo, Math.max(lo, hi - (rows.length > 1 ? GAP / span : 0)), inner, 'series.' + (j + 1), { row: k(r) }, edge));
        // Its part of the second ring starts where it does, and each arc there is a share of the same total: lighter, in
        // its segment's paint, and with no entry in the legend. Rows past a `limit` leave it short of its segment's end.
        // ponytail: a pair the result says twice would share a key. A result is one row per pair.
        let at = lo * total;
        const mine = result.rows.filter((p) => split && p[dim] === r[dim] && p[m] != null).sort((a, b) => kids.indexOf(str(a, split!)) - kids.indexOf(str(b, split!)));
        mine.forEach((p) => {
          const start = at / total, end = (at += num(p, m)) / total;
          arcs.push(arc(ids[i] + ':' + k(r) + ':' + str(p, split!), l, start, Math.max(start, end - GAP / span), edge, 'series.' + (j + 1), { row: k(r), series: str(p, split!), opacity: CHILD }));
        });
      });
      legend.push(...shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, catalog.metrics[m]!, result.totals[m], (j) => 'series.' + (j + 1)));
      keys = rows.map(k);
      if (split) detail = kids;
      return;
    }
    if (split) throw new Error(n + ' encodes "' + split + '" on detail and no dimension on color. A second ring divides the segments of a circle that color has divided: encode the query\'s other dimension on color, or remove "detail".');
    if (angle == null) return arcs.push(arc(ids[i]!, l, 0, 1, r0 as number, l.paint || 'series.1', { opacity: 0.14, tone: 'soft' }));
    const marked = typeof angle === 'number' || roleOf(l) === 'reference', m = typeof angle === 'number' ? q.metrics[0]! : angle, M = catalog.metrics[m];
    if (!M) throw new Error(n + ' has "' + m + '" on angle, which is not a metric. Put a metric on angle, and a dimension on color.');
    if (!M.domain) throw new Error(n + ' reads "' + m + '" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the circle by it.');
    const v = typeof angle === 'number' ? angle : marked ? M.target : result.totals[m], [least, most] = M.domain;
    if (v == null) return;                                                   // no target to mark, or no total to sweep to
    const at = Math.min(1, Math.max(0, (v - least) / (most - least || 1)));
    // ponytail: a mark is a thin arc, since there is no `tick` mark to draw it with yet (chart-coverage-plan, step 3).
    arcs.push(marked ? arc(ids[i]!, l, Math.max(0, at - MARK / span), Math.min(1, at + MARK / span), r0 as number, l.paint || 'rule') : arc(ids[i]!, l, 0, at, r0 as number, l.paint || 'series.1'));
  });
  // The number sits in the hole of a donut: the short form, which is what fits. Whether it shows is a fit rule's to say.
  const inner = arcs.filter((a) => a.role === 'primary').map((a) => a.r0), nodes: SceneNode[] = arcs;
  if (inner.length && Math.min(...inner) >= HOLE) nodes.push({ key: 'hole', part: 'hole', kind: 'text', text: tldrValueText(catalog, q, result, true), anchor: 'middle', font: 'display', paint: 'ink', layer: 'data' });
  return { nodes: nodes.concat(rim, seats, legend), ...(keys && { rows: keys }), ...(detail && { detail }), aspect: half ? 2 : 1 };
}

const SEQ = 10;     // paint tokens run from seq.1 to seq.10, and seq.none is a cell with no value
const DIV = 9;      // and from div.1 to div.9 where the values cross zero: four steps below it, div.5 at it, four above
/** The colour scale, which outputs tokens: a value is quantized to a step of a ramp, between the least and the most
 * of `vals`, or the ends of the domain the catalog states for `metric`, whose unit the ends are written in. Which
 * ramp is read from those ends and is no one's to state. Where they cross zero the scale is diverging about it:
 * zero is in the neutral middle step, and both arms are measured by the end farther from zero, so two values as far
 * from zero as each other are as many steps from the middle. Anything else is sequential. No value is `seq.none`
 * on either ramp, and not a step of it: nothing is not a little, and it is not zero. `ramp` is the legend, set in
 * order: the low end, a swatch for each step, the high end, and with `none` the swatch for no value. A diverging
 * one says zero after its middle swatch, and its ends are the scale's, which are as far from zero as each other. */
export function seqScale(vals: number[], metric?: MetricDef): { paint(v: number | null | undefined): string; ramp(none: boolean): SceneNode[] } {
  const [lo, hi] = endsOf(vals, metric), say = (n: number) => (metric ? formatValue(n, metric, 'compact') : fmt(n, true));
  const far = Math.max(-lo, hi), div = crossesZero([lo, hi]), name = div ? 'div.' : 'seq.', n = div ? DIV : SEQ;
  // Values that are all one have no least and most. They are measured from zero.
  const ends = div ? [-far, far] : lo < hi ? [lo, hi] : [Math.min(lo, 0), Math.max(hi, lo ? 0 : 1)];
  const step = scaleQuantize<number>().domain(ends).range(Array.from({ length: n }, (_, i) => i + 1));
  const end = (key: string, v: string): SceneNode => ({ key: 'ramp:' + key, part: 'ramp', kind: 'text', text: v, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
  const swatch = (key: string | number, paint = name + key): SceneNode => ({ key: 'ramp:' + key, part: 'ramp', kind: 'rect', paint, layer: 'data' });
  return {
    paint: (v) => (v == null ? 'seq.none' : name + step(v)),
    ramp: (none) => [end('low', say(ends[0]!)), ...Array.from({ length: n }, (_, i) => (div && i === (DIV - 1) / 2 ? [swatch(i + 1), end('zero', say(0))] : [swatch(i + 1)])).flat(), end('high', say(ends[1]!)), ...(none ? [swatch('none', 'seq.none'), end('none:label', 'No data')] : [])],
  };
}

// A dimension on x and another on y, and a metric on color: a grid of cells, each painted a step of the colour scale.
// With none on x the grid is one column wide, a strip, and with none on y it is one row tall.
// Both positions are discrete and the cells meet; the gap between them is the painter's. A cell with no value is
// `seq.none` and not the lowest step: nothing is not a little. A pair the result has no row for is drawn the same way.
// A `dot` stands in the middle of each pair, in place of the cell or over it, sized by a metric in a plot's size steps:
// by how far the value is from zero, whichever side it is on. Alone, it may be painted by a metric too, as a cell is.
function sceneMatrix(catalog: Catalog, layers: Layer[], result: Result): Body {
  const cell = layers.find((l) => l.mark === 'cell'), dot = layers.find((l) => l.mark === 'dot'), l = cell || dot || layers[0]!, { x: xf, y: yf } = l.encode || {};
  const metric = (f: unknown): f is string => typeof f === 'string' && f in catalog.metrics, of = (r: Row, f: string | undefined) => (f == null ? '' : String(r[f]));
  // One colour scale to a grid: the cell's, or the dot's where it stands alone.
  const m = cell ? cell.encode!.color : dot && dot.encode!.color, sized = dot && dot.encode!.size;
  if (layers.length !== (cell ? 1 : 0) + (dot ? 1 : 0) || layers.length > 2 || (xf != null && !isDim(catalog, xf)) || (yf != null && !isDim(catalog, yf)) || (xf == null && yf == null) || (cell && !metric(m))
    || (dot && (!metric(sized) || xf == null || yf == null || dot.encode!.x !== xf || dot.encode!.y !== yf || (cell ? dot.encode!.color != null : m != null && !metric(m))))) {
    throw new Error('A dimension on both x and y makes a grid, and a grid draws a "cell" with a metric on color, a "dot" with a metric on size, or the two together on the same x and y. Write { "mark": "cell", "encode": { "x": "' + xf + '", "y": "' + yf + '", "color": a metric } }, or { "mark": "dot", "encode": { "x": "' + xf + '", "y": "' + yf + '", "size": a metric } }, which may have a metric on color where no cell has one. Leave x or y out of a cell alone for one column or one row, or move a dimension off an axis.');
  }
  // Each dimension in its own order, which is the engine's, so the grid does not turn with the ranking.
  const domain = (f: string) => [...new Set(((result.totalsBy && result.totalsBy[f]) || result.rows).map((r) => String(r[f])))];
  // A binned quantity has an order of its own, least first, whatever the engine ranked its rows by.
  const binned = (f: string | undefined) => (f == null ? [''] : catalog.dimensions[f]!.type === 'number' ? domain(f).sort((a, b) => Number(a) - Number(b)) : domain(f));
  // Down the side a category is read from the top, as a table is. A quantity beside another dimension is read from the
  // foot, as a plot's y axis is: its least bin is the bottom row. Alone it is one column, a list, and reads down.
  const xs = binned(xf), ys = xf != null && yf != null && catalog.dimensions[yf]!.type === 'number' ? binned(yf).reverse() : binned(yf);
  const held = (f: string) => new Map(result.rows.map((r) => [of(r, xf) + '\n' + of(r, yf), r[f] as number | null | undefined])), known = (at: Map<string, number | null | undefined>) => [...at.values()].filter((v): v is number => v != null);
  // The colour scale runs from the least to the most of the cells drawn. That is geometry, as the top of a y scale is,
  // and not a total, so it is read from the rows. A domain the catalog states for the metric comes before it.
  const at = metric(m) ? held(m) : null, vals = at ? known(at) : [], seq = at && seqScale(vals, catalog.metrics[m as string]!);
  // A size is read the same way: the most a dot stands for is the value farthest from zero, or the farther end of a stated domain.
  const sizes = metric(sized) ? held(sized) : null, top = sizes ? Math.max(...endsOf(known(sizes), catalog.metrics[sized as string]!).map(Math.abs)) || 1 : 1;
  const nodes: SceneNode[] = [], ids = layerKeys(layers), nx = xs.length, ny = ys.length;
  // Every sixth label stays, and the rest are ranked to be given up where they would meet: every third goes last.
  const rank = (i: number) => (i % 6 ? (i % 3 ? 2 : 1) : 0);
  const end = (f: string, v: string) => result.rows.find((r) => String(r[f]) === v)?.[f + '@end'];
  const tick = (f: string, v: string) => formatDimension(v, catalog.dimensions[f]!);
  // Down the side a bin's label is the bin, start to end. Along the foot there is no room for that, and a bin is read
  // as on any binned axis: an edge at each end of it.
  if (yf != null) ys.forEach((y, j) => nodes.push(axisTick('y-axis', y, 1 - (j + 0.5) / ny, end(yf, y) == null ? tick(yf, y) : formatBin(y, end(yf, y)), { rank: rank(j) })));
  const edges = xf != null && xs.length > 0 && xs.every((x) => end(xf, x) != null);
  if (xf != null) xs.forEach((x, i) => nodes.push(axisTick('x-axis', x, (i + (edges ? 0 : 0.5)) / nx, tick(xf, x), { anchor: edges && !i ? 'start' : 'middle', rank: rank(i) })));
  if (edges) nodes.push(axisTick('x-axis', 'end', 1, String(end(xf!, xs[nx - 1]!)), { anchor: 'end' }));
  // A row of the grid at a time, from the top: reading order. A layer at a time, the cells under the dots.
  const each = (draw: (x: string, y: string, i: number, j: number) => SceneNode) => ys.forEach((y, j) => xs.forEach((x, i) => nodes.push(draw(x, y, i, j))));
  if (cell) each((x, y, i, j) => ({ key: ids[layers.indexOf(cell)] + ':' + x + ':' + y, part: 'plot', kind: 'rect', x: i / nx, w: 1 / nx, y: j / ny, h: 1 / ny, pair: [x, y], paint: seq!.paint(at!.get(x + '\n' + y)), layer: 'data', role: roleOf(cell) }));
  // A dot with no value is the least a painter draws, in the paint of no value: the pair is still there to be read.
  if (dot) each((x, y, i, j) => {
    const v = sizes!.get(x + '\n' + y), paint = v == null ? 'seq.none' : !cell && seq ? seq.paint(at!.get(x + '\n' + y)) : dot.paint || 'series.1';
    return { key: ids[layers.indexOf(dot)] + ':' + x + ':' + y, part: 'plot', kind: 'circle', pulse: false, x: (i + 0.5) / nx, t: 1 - (j + 0.5) / ny, ...(v != null && { size: sizeStep(Math.abs(v), top) }), pair: [x, y], paint, layer: 'data', role: roleOf(dot) };
  });
  if (seq) nodes.push(...seq.ramp(vals.length < nx * ny));
  if (sizes) nodes.push(...sizeKey(catalog.metrics[sized as string]!, top));
  return { nodes, rows: xs, ys };
}

/** The value shown as the number, formatted. */
export function tldrValueText(catalog: Catalog, q: Query, result: Result, compact?: boolean): string {
  const m = q.metrics[0]!, M = catalog.metrics[m]!;
  return formatValue(M.instant ? result.totals[m] || 0 : result.meta.empty ? 0 : result.totals[m], M, compact ? 'compact' : undefined);
}

/* The tldr value: a total from the engine, a delta if the query compares, and a derived note.
 * It carries both forms of its text. Which one is set depends on the room, so that is not decided here. */
function sceneNumber(catalog: Catalog, q: Query, result: Result, share: boolean): SceneNode[] {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, by = (q.by || [])[0], rows = result.rows;
  const nodes: SceneNode[] = [];
  const value = (text: string, short = text) => nodes.push({ key: 'value', part: 'number', kind: 'text', text, ...(short !== text && { short }), anchor: 'start', font: 'display', paint: 'ink', layer: 'data', ...(M.definition && { note: M.definition }) });
  const sub = (text: string, rank?: number) => nodes.push({ key: 'sub', part: 'number', kind: 'text', text, anchor: 'start', font: 'tick', paint: 'ink.muted', layer: 'guide', ...(rank && { rank }) });
  if (M.instant) {
    const n = t[m] || 0;
    nodes.push({ key: 'pulse', part: 'number', kind: 'circle', paint: n > 0 ? 'live' : 'ink.muted', pulse: n > 0, layer: 'data' });
    value(formatValue(n, M)); sub(NOW);
    return nodes;
  }
  if (result.meta.empty) { value(formatValue(0, M)); sub(emptyNote(M)); return nodes; }
  let note: string | null = M.rangeTotal === 'sum of daily' ? 'Sum of daily counts' : M.target != null ? 'Target ' + formatValue(M.target, M) : null;
  if (by && catalog.dimensions[by]!.type === 'categorical' && rows.length) {
    const top = leader(result, by, m)!;                                      // with two dimensions a row is a pair, so the leader is the engine's
    const name = formatDimension(top[by], catalog.dimensions[by]!);
    // With no total there is no share to say, and where the engine has no figure for any value there is no top one either.
    note = share && t[m] ? name + ' ' + fmtPct(num(top, m) / t[m]!) : top[m] == null ? note : 'Top: ' + name;
  }
  const dl = q.compare === 'previous' ? delta(t[m] as number, t[m + '@previous'], M.polarity) : null;
  value(formatValue(t[m], M), formatValue(t[m], M, 'compact'));
  if (dl && dl.text) nodes.push({ key: 'delta', part: 'number', kind: 'text', text: dl.text + (dl.pct != null ? ' on the previous period' : ''), ...(dl.pct != null && { short: dl.text }), anchor: 'start', font: 'value', paint: dl.paint, layer: 'guide' });
  if (note) sub(note, 1);                                                   // the note is given up beside a bare plot
  return nodes;
}

/* A metric's value, and a companion's, is a finite number or null, in a row and in the totals. Anything else is refused
 * here, once, before any scene is built: NaN would reach a path's `d`, a bar's ratios, the scale and the number as itself. */
function checkValues(result: Result, catalog: Catalog): void {
  const check = (has: Row, where: string) => {
    for (const f in has) {
      const v = has[f], of = f.split('@')[0]!;
      if (v === null || Number.isFinite(v)) continue;
      // A number dimension is a bin on a linear x, and `@end` its other edge: the scale is made of both.
      if ((f === of || f === of + '@end') && Object.hasOwn(catalog.dimensions, of) && catalog.dimensions[of]!.type === 'number') throw new Error('The result has "' + f + '": ' + (typeof v === 'string' ? JSON.stringify(v) : String(v)) + ' in ' + where + ', and a number dimension\'s value is a finite number or null. Send the bin\'s start and end as numbers from the query layer, or give the dimension "type": "categorical" in the catalog where its values are names.');
      if (Object.hasOwn(catalog.metrics, of)) throw new Error('The result has "' + f + '": ' + (typeof v === 'string' ? JSON.stringify(v) : String(v)) + ' in ' + where + ', and a metric\'s value is a finite number or null. Send null from the query layer where there is no figure: it is drawn as a gap and written as a dash.');
    }
  };
  result.rows.forEach((r, i) => check(r, 'row ' + (i + 1)));
  check(result.totals, 'its totals');
  for (const d in result.totalsBy) result.totalsBy[d]!.forEach((r, i) => check(r, 'row ' + (i + 1) + ' of totalsBy["' + d + '"]'));
}

/** The scene for a plan, in ratios. It takes no size: plan for a container with no limits and this is everything the spec asks for. */
export function buildScene(p: PlanShape, q: Query, result: Result, catalog: Catalog): Scene {
  checkValues(result, catalog);
  if (p.layout === 'prose') return { layout: 'prose', parts: [], nodes: [], text: p.text };
  const number = sceneNumber(catalog, q, result, p.share);
  const parts: Part[] = p.tldrValue || p.layout === 'none' ? ['number'] : [];
  let body: Body = { nodes: [] }, side = false;
  // The key to a unit's glyphs, where the plan shows it and the scene has one: a glyph worth one has none.
  const unitKeyed = () => { if (p.guides.unitKey && body.nodes.some((n) => n.part === 'unit-key')) parts.push('unit-key'); };
  if (p.layout === 'notice') {
    parts.push('notice');
    body.nodes.push({ key: 'notice', part: 'notice', kind: 'text', text: emptyNote(catalog.metrics[q.metrics[0]!]!, true), anchor: 'middle', baseline: 'middle', font: 'label', paint: 'ink.muted', layer: 'guide' });
  } else if (p.layout === 'cartesian') {
    side = p.side;                                                          // a bare plot, set beside the number
    if (side && !parts.length) parts.push('number');
    body = sceneCartesian(catalog, p.layers, p.guides, result, (q.by || [])[0]);
    const key = body.series ? p.guides.legend : undefined;                 // layers that were split may have been given up
    if (p.guides.y && body.nodes.some((n) => n.part === 'y-axis')) parts.push('y-axis');   // a stack about the middle has no value axis
    parts.push('plot');
    if (body.nodes.some((n) => n.part === 'points')) parts.push('points');
    if (p.guides.pointLabels && body.nodes.some((n) => n.part === 'point-labels')) parts.push('point-labels');
    if (body.nodes.some((n) => n.part === 'y-axis-2')) parts.push('y-axis-2');
    if (key === 'labels') parts.push('labels');
    if (p.guides.x) parts.push('x-axis');
    if (key === 'full') parts.push('legend');
    if (p.guides.size && body.nodes.some((n) => n.part === 'size')) parts.push('size');
    unitKeyed();
  } else if (p.layout === 'matrix') {
    body = sceneMatrix(catalog, p.layers, result);
    if (p.guides.y) parts.push('y-axis');
    parts.push('plot');
    if (p.guides.x) parts.push('x-axis');
    if (p.guides.ramp && body.nodes.some((n) => n.part === 'ramp')) parts.push('ramp');
    if (p.guides.size && body.nodes.some((n) => n.part === 'size')) parts.push('size');
  } else if (p.layout === 'rows') {
    if (p.guides.columns) parts.push('columns');
    parts.push('rows');
    body = sceneRows(catalog, p.layers, result, p.rowLimit);
    unitKeyed();
    // The key to a divided row's series, under the rows: all of it, or the one line.
    if (body.series && p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
  } else if (p.layout === 'band') {
    // A unit there is a grid of cells in the band's part, where a bar is the band itself.
    const unit = p.layers.findIndex((l) => l.mark === 'unit');
    body = unit < 0 ? sceneBand(catalog, p.layers[0]!, result.rows, result.totals) : sceneGrid(catalog, p.layers[unit]!, layerKeys(p.layers)[unit]!, result);
    parts.push('band');
    unitKeyed();
    if (p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
  } else if (p.layout === 'radial') {
    body = sceneRadial(catalog, p.layers, q, result);
    parts.push('radial');
    // A number above the circle is not said again inside it.
    if (!parts.includes('number') && body.nodes.some((n) => n.part === 'hole')) parts.push('hole');
    if (p.guides.rim && body.nodes.some((n) => n.part === 'rim')) parts.push('rim');
    unitKeyed();
    if (p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
  } else if (customMarks().has(p.layout)) {
    // A custom mark builds its own scene, and says which of its parts the plan shows.
    const { parts: own, ...rest } = customMarks().get(p.layout)!.scene({ layers: p.layers, guides: p.guides, query: q, result, catalog });
    parts.push(...own);
    body = rest;
  }
  return { layout: p.layout, parts, ...(side && { side }), ...body, nodes: number.concat(body.nodes) };
}
