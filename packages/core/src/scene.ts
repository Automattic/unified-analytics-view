import { max, min } from 'd3-array';
import { scaleBand, scaleLinear, scalePoint, scaleQuantize } from 'd3-scale';
import { CHAR_W, delta, fmtPct, fmtTime, formatBin, formatDimension, formatMetric, formatUnit, formatValue, orList } from './format.ts';
import { arcD, pathD, steady } from './path.ts';
import { customMarks, type CustomMark, type MarkView } from './marks.ts';
import { NOW, crossesZero, emptyNote, endsOf, leader, portion } from './prose.ts';
import { UNIT_CELLS, UNIT_MOST, UNIT_SEATS, unitCount, unitSeats, unitShares, unitWorth } from './unit.ts';
import { baseOf } from './types.ts';
import type { ArcNode, Catalog, DimensionDef, Domains, Guides, Layer, Mark, MetricDef, Part, PathNode, PlanShape, Polarity, Query, RectNode, Result, Role, Row, Scene, SceneNode, TextNode } from './types.ts';

/* Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a part, a paint token (never a colour) and a layer: "data" or "guide".
 * Nothing here is in pixels: positions are ratios of the part's box. */
type Body = Pick<Scene, 'nodes' | 'rows' | 'series' | 'detail' | 'ys' | 'scale' | 'track'>;

const num = (r: Row, f: string) => r[f] as number;
/* A row's dimension value as its key. A result may hold a number or a boolean there, and a key is compared with
 * what a painter wrote into an attribute, so it is a string from here on. */
const str = (r: Row, f: string) => String(r[f]);
/** A dimension's values in its own order, which is the engine's: its row of totals for each where it sends them, and
 * else the order its rows first have them, each a key's string. */
const orderOf = (result: Result, f: string) => [...new Set(((result.totalsBy && result.totalsBy[f]) || result.rows).map((r) => str(r, f)))];
/** The ends of a linear scale that holds zero and whatever is on either side of it. With nothing to hold it is 0 to 1;
 * with nothing above zero it ends at zero. */
const holdingZero = (vals: number[]): [number, number] => { const lo = Math.min(0, min(vals) ?? 0); return [lo, Math.max(0, max(vals) ?? 0) || (lo ? 0 : 1)]; };
/** Where a value lies along a range, least to most, as a ratio held to 0 to 1. A range of one value is measured as one wide. */
/* The views of a facet share their scales. So every scale's domain goes through `common`: a view takes the one its
 * result names (`Result.domains`), and tells what it would take alone while `widest` is asking the facet's views. */
let asked: Domains | null = null;
export const common = (result: Pick<Result, 'domains'>, name: string, own: [number, number]): [number, number] => {
  if (asked) { const d = asked[name]; asked[name] = d ? [Math.min(d[0], own[0]), Math.max(d[1], own[1])] : own; }
  return (result.domains && result.domains[name]) || own;
};
/** Every scale's domain as wide as any of the views built in `build` takes alone. */
export function widest(build: () => void): Domains { const all: Domains = (asked = {}); try { build(); } finally { asked = null; } return all; }
const along = ([least, most]: [number, number], v: number) => Math.min(1, Math.max(0, (v - least) / (most - least || 1)));
/** The key of each row of a result: its value of `dim`, and for a row that says a value again, the value and which
 * time it is (`Google#2`). So no two rows share a key, a mark or a place, whatever a result repeats: a host that
 * hands over labels where it had ids repeats one. In a plot split by `split` the rows of one value are its series,
 * and only a value said again within one series is a repeat.
 * ponytail: which of two such rows is the second is the result's order, so when the ranking turns they change places. */
export function rowKeys(rows: Row[], dim: string, split?: string | null): Map<Row, string> {
  const keys = new Map<Row, string>(), unique = uniqueKeys();
  for (const r of rows) keys.set(r, unique(str(r, dim), split ? '\n' + r[split] : ''));
  return keys;
}
/** A maker of keys that no two things share: each call returns its key as it is the first time, and with which time it
 * is after that (`Google#2`). Keys are counted apart `within` a group, where they need be unique only there. */
export function uniqueKeys(): (k: string, within?: string) => string {
  const taken = new Set<string>();
  return (k, within = '') => {
    let u = k;
    for (let n = 2; taken.has(u + within); n++) u = k + '#' + n;
    taken.add(u + within);
    return u;
  };
}
/** The role a layer plays: the one it states, or the one its mark and series imply. */
export function roleOf(l: Layer): Role {
  return l.role || (l.series === 'previous' ? 'comparison' : l.mark === 'rule' ? 'reference' : 'primary');
}
/* A layer's key names it by role and mark, and does not count the layers before it, so it holds when another layer
 * drops. Two layers of one role and mark are told apart by a count among themselves alone: `primary:text`, then
 * `primary:text#2`. Layers of the previous series, and of a row's delta, are counted last. A rule takes whole roles, and missing prior
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
/** A dimension of the catalog's. */
export function isDim(catalog: Catalog, f: unknown): f is string { return typeof f === 'string' && f in catalog.dimensions; }
/** A metric, or a companion the engine returns with one, such as "pageviews@density". */
export const isMetric = (catalog: Catalog, f: unknown): f is string => typeof f === 'string' && baseOf(f) in catalog.metrics;

/** How a plot shares x among its rows, on 0 to 1. */
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
  /** For a rule `at` values of the list on x: each one the axis has, and where it stands. */
  at?: { value: string; x: number }[] | undefined;
  /** For a `unit`: what one of its glyphs is worth, in its metric's own terms. */
  worth?: number | undefined;
  /** x is a number dimension the engine cut into bins: a line or an area is flat across each, and steps at its edges, as a bar there has no gap. */
  step?: boolean;
  /** What a row's mark is known by, where the space says it and not the row alone: in a grid a mark is of a pair of
   * values, one on each axis. A mark that asks takes its key from here, and whatever else says which it is. */
  of?: (r: Row) => { key: string; row?: string; series?: string; pair?: [string, string] };
  /** The field labels are ranked by, the largest first, where that is not the one on y: in a grid y is a list, and a label is ranked by what it says. */
  rank?: string;
  /** The part its marks are in, where that is not the plot: a list's `track`, where they are drawn on their side, and a circle's own. */
  part?: Part;
  /** The space is bent about a centre: along x is round the circle and up y is out from the middle, so a line runs round from each place to the next and closes. */
  bend?: boolean;
}
type MarkFn = (l: Layer, d: Draw) => SceneNode[];
/** What a row says of a field, in a catalog's terms. */
const sayOf = (catalog: Catalog): Draw['say'] => (r, f) => { const M = metricOf(catalog, f); return typeof r[f] !== 'number' ? String(r[f]) : formatMetric(r[f] as number, M); };
/** A mark's key and what it came from: its layer, its row, and its series where the row has one of it for each. */
const markOf = (id: string, k: string, series?: string) => ({ key: id + ':' + k + (series == null ? '' : ':' + series), row: k, ...(series != null && { series }) });
/** A field's definition: its own, where the catalog has one under its whole name, and for a companion with none the
 * one of the metric it came with. So a companion is in its metric's unit unless the catalog says otherwise
 * (`"pageviews@rank": { "unit": "rank" }`), and core reads no suffix to know it. */
export const metricOf = (catalog: Catalog, f: unknown): MetricDef | undefined => (typeof f !== 'string' ? undefined : Object.hasOwn(catalog.metrics, f) ? catalog.metrics[f] : catalog.metrics[baseOf(f)]);
/** The paint of a mark that runs from one value to another: good or bad by which way it goes, turned by its metric's
 * polarity. One whose metric has no better way keeps its own paint. Positions are compared as they are drawn. */
const toned = (polarity: Polarity | undefined, from: number, to: number, paint: string) => (!polarity || polarity === 'none' ? paint : (to < from) === (polarity === 'down') ? 'delta.good' : 'delta.bad');

type Pt = PathNode['points'][number];
/** An area between two ends, cut where they cross: each piece lies wholly to one side, `up` where the second end is the
 * higher. A point where the two are level belongs to the piece before it.
 * ponytail: a crossing is found on the straight line between two rows, and the pieces are then drawn with the curve of
 * the lines beside them. So a piece's tip is a hair from where those curves cross. Solve the curves if it ever shows. */
function cut(pts: Pt[]): { up: boolean; pts: Pt[] }[] {
  const out: { up: boolean; pts: Pt[] }[] = [], gap = (p: Pt) => p.y - (p.y2 || 0);
  let cur: Pt[] = [], way = 0;
  pts.forEach((p, i) => {
    const d = Math.sign(gap(p));
    if (d && way && d !== way) {
      const a = pts[i - 1]!, da = gap(a), f = da / (da - gap(p)), v = a.y + (p.y - a.y) * f;
      // Where the ends meet between two rows, which is no row's: the piece before ends there and the next begins. Level at a row, that row is where.
      const at: Pt = da ? { x: a.x + (p.x - a.x) * f, y: v, ...(v && { y2: v }) } : a;
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
const FADED = 0.4;   // how much of its paint an incomplete bucket's bar, glyph or stacked piece is drawn in
/** A fill that tints and does not mark: the area under a line, the cells a gauge's grid has not reached, the ring or the sweep behind a value. */
export const TINT = { opacity: 0.14, tone: 'soft' as const };
/** How a reference line is drawn: a dashed rule, thinner than a series' line. */
const REFERENCE = { paint: 'rule', dash: '5 3', width: 1.5 };
/** A reference rule's label, in the rule's paint, at `at` in the plot. */
const ruleLabel = (id: string, text: string, role: Role, at: { x?: number; y: number }, anchor: TextNode['anchor']): TextNode => ({ key: id + ':label', part: 'plot', kind: 'text', ...at, text, anchor, font: 'tick', paint: 'rule', halo: true, layer: 'guide', role });
const path: MarkFn = (l, { id: layer, series, mass, role: role0, paint, prev, rows: pts, k, unit, ends, polarity, step, points: joined, part: own, bend }) => {
  const id = series == null ? layer : layer + ':' + series, role = series == null ? { role: role0 } : { role: role0, series };
  const whole = pts.filter((r) => prev || !r.partial);
  if (!whole.length) return [];
  // Between rows a line is smoothed, with a curve that never leaves the values it joins. Not where it joins the points of
  // two metrics, which run in no order along x: straight from each to the next, since a curve there would say a path nobody
  // took. And not over bins, where a value holds across its bin and changes at its edge.
  // About a centre it runs straight from each place to the next and back to the first: a curve would bow out past the values it joins.
  const curve = bend ? 'radial' as const : joined ? undefined : step ? 'step' as const : 'monotone' as const, part: Part = own ?? (joined ? 'points' : 'plot'), bent = curve && { curve };
  // An area's points say where it starts only when that is not the bottom of the plot.
  const points = (rs: Row[]): Pt[] => rs.map((r) => { const [v0, v] = ends(r); return { row: k(r), x: unit.cx(k(r)), y: v, ...(l.mark === 'area' && v0 && { y2: v0 }), ...(step && { w: unit.span!(k(r)) }) }; });
  if (l.mark === 'area') {
    // An area under a line is a tint. Stacked, each is the mark itself.
    const area = (key: string, ps: Pt[], paint: string): SceneNode => ({ key, part, kind: 'path', d: pathD(ps, curve, true), points: ps, ...bent, fill: true, paint, ...(!(l.stack && series != null) && TINT), layer: 'data', ...role });
    // Painted by direction, it is cut where its two ends cross, and each piece is a gain or a loss. A piece is keyed by the row it starts at.
    if (polarity && polarity !== 'none') return cut(points(whole)).map((piece) => area(id + ':' + piece.pts.find((p) => p.row != null)!.row, piece.pts, toned(polarity, 0, piece.up ? 1 : -1, paint)));
    // Stacked, an incomplete bucket is drawn too, as a bar of one is: a piece of its own in from the first and out to the last, faded.
    if (!(l.stack && series != null) || prev) return [area(id, points(whole), paint)];
    return [area(id, points(whole), paint), ...partials().map(([key, rs]): SceneNode => ({ ...area(id + key, points(rs), paint), opacity: FADED, note: 'incomplete bucket' }))];
  }
  const nodes: SceneNode[] = [{ key: id, part, kind: 'path', d: pathD(points(whole), curve), points: points(whole), ...bent, paint, width: prev ? 1.5 : 2, dash: prev ? '3 3' : null, ...(mass && { opacity: MASS }), layer: 'data', ...role }];
  if (!prev) for (const [key, rs] of partials()) nodes.push({ key: id + key, part, kind: 'path', d: pathD(points(rs)), points: points(rs), paint, width: 2, dash: '2 4', opacity: mass ? MASS : 0.75, layer: 'data', ...role, note: 'incomplete bucket' });
  return nodes;
  // A range that starts or ends inside a bucket leaves that one incomplete: dashed in from the first, and out to the last.
  function partials(): [string, Row[]][] {
    const from = pts.indexOf(whole[0]!), lead = pts.slice(0, from).concat(whole[0]!), tail = [whole[whole.length - 1]!].concat(pts.slice(from).filter((r) => r.partial));
    return ([[':partial:lead', lead], [':partial', tail]] as [string, Row[]][]).filter(([, rs]) => rs.length > 1);
  }
};
const bar: MarkFn = (_l, { id, series, role, paint, prev, rows, k, unit, ends, polarity, slot: [j, n] = [0, 1] }) => rows.map((r) => {
  const [v0, v] = ends(r), w = (unit.span ? unit.span(k(r)) : unit.w) / n;
  return { ...markOf(id, k(r), series), part: 'plot', kind: 'rect', x: unit.x(k(r)) + j * w, w, y: v, ...(v0 && { y2: v0 }),
    paint: toned(polarity, v0, v, paint), opacity: r.partial && !prev ? FADED : 1, layer: 'data', role };
});
/** Whether a rule runs across the plot from one place to another: it has both ends on both axes. */
const across = (l: Layer) => l.mark === 'rule' && l.encode != null && l.encode.x2 != null && l.encode.y2 != null;
const rule: MarkFn = (l, { id, series, role, rows, k, unit, ends, v, xv, at }) => {
  const { x, y, x2, y2 } = l.encode || {};
  // At values of the axis's own list: an upright line at each, the height of the plot, as one at a number is on a scale.
  if (at) {
    const on = Object.keys(l.encode || {});
    if (on.length) throw new Error('A rule "at" a value stands the height of the plot at that value of x, and this one also has ' + orList(on) + ' encoded. Remove "at" for the rule those make, or remove them.');
    return at.flatMap(({ value, x: place }): SceneNode[] => {
      const key = id + ':' + value;
      return [{ key, part: 'plot', kind: 'line', x: place, x2: place, y: 0, y2: 1, ...REFERENCE, layer: 'data', role }, ...(l.label ? [ruleLabel(key, l.label, role, { x: place, y: 1 }, place > 0.5 ? 'end' : 'start')] : [])];
    });
  }
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
      const points = [{ row: r ? k(r) : '', x: xv(x0), y: v(y0) }, { row: r ? k(r) : '', x: xv(x1), y: v(y1) }];
      return [{ key, part: 'plot', kind: 'path', d: pathD(points), points, ...(r ? { row: k(r), paint: l.paint || 'ink', width: 2 } : REFERENCE), layer: 'data', role }];
    };
    return [x, y, x2, y2].every((f) => typeof f === 'number') ? line(id) : rows.flatMap((r) => line(id + ':' + k(r), r));
  }
  // A field on y, or on y2 from a number: a segment for each row, standing at its x from one of its values to another, or up from zero where it has one end.
  if ((typeof y === 'string' || y2 != null) && l.label) throw new Error('A rule for each row has no place for its label yet. Remove "label", and name what the strokes are in the view\'s title.');
  if (typeof y === 'string' || y2 != null) return rows.map((r): SceneNode => {
    const [t, t2] = ends(r), at = unit.cx(k(r));
    return { ...markOf(id, k(r), series), part: 'plot', kind: 'line', x: at, x2: at, y: t, y2: t2, paint: l.paint || 'ink', layer: 'data', role };
  });
  // A constant on x stands the height of the plot. Its label sits beside it, at the top, on the side with more room.
  if (typeof x === 'number') {
    if (!xv) throw new Error('A rule at x: ' + x + ' needs a scale to be measured on, and this plot has a time or a category on x. Put the rule on y, or a metric or a number dimension on x.');
    const at = xv(x), up: SceneNode[] = [{ key: id, part: 'plot', kind: 'line', x: at, x2: at, y: 0, y2: 1, ...REFERENCE, layer: 'data', role }];
    if (l.label) up.push(ruleLabel(id, l.label, role, { x: at, y: 1 }, at > 0.5 ? 'end' : 'start'));
    return up;
  }
  if (typeof y !== 'number') throw new Error('A rule is drawn at a number, and this one has none on x or on y. Encode one, for example { "y": 1000 }.');
  const t = v(y);
  const nodes: SceneNode[] = [{ key: id, part: 'plot', kind: 'line', y: t, ...REFERENCE, layer: 'data', role }];
  if (l.label) nodes.push(ruleLabel(id, l.label, role, { y: t }, 'end'));
  return nodes;
};
export const SIZES = 4;    // the steps a value on `size` falls into. How big each is, in pixels, is the painter's
/** The step for a value, 1 to SIZES, by area: the square root of its share of the most. */
export const sizeStep = (n: number, top: number) => Math.min(SIZES, Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n) / top) * SIZES)));
// A point for each row, at its values on x and y. One that is sized lets what is under it show.
const dot: MarkFn = (l, { id, series, role, paint, rows, k, unit, ends, size, points, part }) => {
  const sized = l.encode!.size != null && size;
  return rows.map((r): SceneNode => ({ ...markOf(id, k(r), series), part: part ?? (points ? 'points' : 'plot'), kind: 'circle', pulse: false, x: unit.cx(k(r)), y: ends(r)[1],
    ...(sized && { size: sizeStep(num(r, sized.field), sized.top), opacity: 0.7 }), paint, layer: 'data', role }));
};
// A label on each row's point, in a part of its own over the plot, so a rule can give them all up. Each has its place
// among them, the largest point first: by the metric the dots are sized by, or else by its own y. A painter gives up
// the ones that collide from the last, since only it knows how wide a label is (reference, Open 5).
const label: MarkFn = (l, { id, series, role, rows, k, unit, ends, size, say, of, rank }) => {
  const { y, text: f } = l.encode || {};
  // In a plot a label sits at its row's value on y. Where the space says what a mark is known by, it says where it stands as well.
  if (typeof f !== 'string' || (!of && typeof y !== 'string')) throw new Error('A "text" layer in a plot needs a field on y, for where each label sits, and one on text, for what it says: for example { "x": "<a metric>", "y": "<a metric>", "text": "<the dimension>" }.');
  const by = size ? size.field : rank ?? (y as string), order = rows.slice().sort((a, b) => num(b, by) - num(a, by));
  return rows.map((r): TextNode => ({ ...(of ? of(r) : markOf(id, k(r), series)), part: 'point-labels', kind: 'text', x: unit.cx(k(r)), y: ends(r)[1], text: say(r, f),
    anchor: 'middle', font: 'tick', paint: 'ink', halo: true, rank: order.indexOf(r) + 1, layer: 'guide', role }));
};
const RUG = 0.05;    // how far up the plot a stroke of a rug stands
// A short stroke across its row's band, at its value. With `align` it is the half of that to one side of the band's
// middle: the start, which is where x begins, or the end.
// In a plot of points, with a metric on x and nothing on y, it is a stroke at the foot of the plot at each row's value
// there: a rug. Strokes lie over each other where rows are close, so each lets the ones under it show.
const tick: MarkFn = (l, { id, series, role, rows, k, unit, ends, xv }) => rows.map((r): SceneNode => {
  const own = { ...markOf(id, k(r), series), part: 'plot' as const, kind: 'line' as const, paint: l.paint || 'ink', layer: 'data' as const, role };
  if (l.encode!.y == null) { const at = xv!(num(r, l.encode!.x as string)); return { ...own, x: at, x2: at, y: 0, y2: RUG, opacity: MASS }; }
  const w = unit.span ? unit.span(k(r)) : unit.w, x = unit.x(k(r)) + (l.align === 'end' ? w / 2 : 0), t = ends(r)[1];
  return { ...own, x, x2: x + (l.align ? w / 2 : w), y: t, y2: t, width: 2 };
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
    return Array.from({ length: Math.round((to - from) / h) }, (_, j): SceneNode => ({ key: id + ':' + k(r) + ':' + (j + 1), part: 'plot', kind: 'circle', pulse: false, x: unit.cx(k(r)), y: from + (j + 0.5) * h, w, h,
      row: k(r), paint, ...(r.partial && { opacity: FADED }), layer: 'data', role }));
  });
};
/** What a layer's glyphs are worth where they are counted from one metric, row by row: the round number at which the
 * largest of `rows` is ten glyphs or fewer. A count's glyph is worth one thing at least. */
function worthOf(catalog: Catalog, f: string, rows: Row[], result: Result): number {
  return unitWorth(common(result, 'worth', [0, max(rows, (r) => r[f] as number) ?? 0])[1], UNIT_MOST, metricOf(catalog, f)?.unit === 'count');
}
/** What a channel holds, as an error says it. */
const held = (f: unknown) => (f == null ? 'nothing' : JSON.stringify(f));
/** What a row's value is called in an error: the field, and the row it is in. */
const valueOf = (f: string, key: string) => 'The value of "' + f + '" for "' + key + '"';
/** The key to a `unit`: what one glyph is worth, in its metric's own format. A guide, under the marks. None where a glyph is worth one. */
function unitKey(id: string, worth: number, metric: MetricDef | undefined): SceneNode[] {
  return worth === 1 ? [] : [{ key: 'unit-key:' + id, part: 'unit-key', kind: 'text', text: 'Each is ' + formatMetric(worth, metric), anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' }];
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

/** Paint tokens run from series.1 to series.SERIES: a layer split into more series than that is refused (tooManySeries). */
export const SERIES = 6;
/** The error for a split into more series than there are colours: `lead` says what splits (`Splitting by "page"`),
 * `what` what it makes of each value, and `more` another fix, where there is one. A custom mark throws it too. */
export const tooManySeries = (lead: string, n: number, what: string, more = '') =>
  lead + ' makes ' + n + ' ' + what + ', and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less' + more + '.';
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
/** What a layer of a plot measures on y, where it is a mark drawn in the layer's own paint: its metric, and for a
 * companion the metric it came with, since a box's quartiles are one quantity. A companion with a catalog entry of
 * its own (`pageviews@rank`) is a quantity of its own. A rule, a tick and a label are set in ink, and measure nothing here. */
const PAINTED: Mark[] = ['line', 'area', 'bar', 'dot', 'unit'];
function measureOf(catalog: Catalog, l: Layer): string | null {
  const f = !PAINTED.includes(l.mark) || !l.encode ? null : typeof l.encode.y === 'string' ? l.encode.y : l.encode.y2;
  return typeof f !== 'string' || !isMetric(catalog, f) ? null : Object.hasOwn(catalog.metrics, f) ? f : baseOf(f);
}
/** The quantities a plot's layers measure, in layer order. With more than one, the layers differ by metric: each
 * metric has a series colour, where its layer states no paint, and an entry in the legend, as each value of a
 * dimension on `color` has. */
export function measuresOf(catalog: Catalog, layers: Layer[]): string[] {
  return [...new Set(layers.map((l) => measureOf(catalog, l)).filter((m): m is string => m != null))];
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
    if (str(r, split) !== s || r[f] == null) return;
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
  const series = split ? orderOf(result, split) : [];
  // Whether any layer paints its series apart. Only that spends the series colours, so only that is held to their count, and has a legend.
  const painted = layers.some((l) => paintedOf(catalog, l, xField));
  if (painted && series.length > SERIES) throw new Error(tooManySeries('Splitting by "' + split + '"', series.length, 'series'));
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
    if (l.mark === 'unit') { const worth = worths[i] = worthOf(catalog, f, rows, result); rows.forEach((r) => { if (r[f] != null) out.set(r, [0, unitCount(num(r, f), worth, valueOf(f, k(r))) * worth]); }); return out; }
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
      const last = common(result, 'y' + ui, [1, Math.max(1, Math.ceil(max(vals) ?? 1))])[1], every = Math.ceil(last / 10);
      const ticks = Array.from({ length: last }, (_, i) => i + 1).filter((n) => n === 1 || n === last || (n % every === 0 && last - n >= every / 2));
      return { v: (n: number) => (n < 1 ? 0 : last === 1 ? 1 : (last - n) / (last - 1)), ticks, coarse: [1, last], text: (t: number) => formatUnit(t, u, 'compact') };
    }
    // A stack set about the middle is read by how thick each band is, and a scale that counts away from the middle says
    // nothing true of that. So it has no ticks and no grid, and is not rounded: the bands take the height of the plot.
    const centred = layers.some((l, i) => l.stack === 'center' && spans[i]!.size > 0 && Math.max(0, units.indexOf(unitOf(catalog, l, xField)!)) === ui);
    const share = u === 'share', [lo, most] = common(result, 'y' + ui, holdingZero(vals));
    const y = scaleLinear().domain([lo, share ? 1 : most]);
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
    const x = scaleLinear().domain(common(result, 'x', xDim ? [min(vals) ?? 0, max(vals) ?? 1] : holdingZero(vals)));
    if (guides.x && !xDim) x.nice(4);
    const [left, right] = x.domain() as [number, number], to = (n: number) => (n - left) / (right - left || 1);
    xv = to;
    const xM = xDim ? undefined : metricOf(catalog, xOn);                 // a number dimension has no unit in the catalog, so its ticks are plain numbers
    unit = { x: (key) => to(lo(key)), w: 0, cx: (key) => to((lo(key) + hi(key)) / 2), span: (key) => to(hi(key)) - to(lo(key)) };
    if (guides.x && keys.length) x.ticks(4).forEach((t, i, all) => {
      nodes.push(axisTick('x-axis', t, to(t), formatMetric(t, xM, true), { anchor: to(t) <= 0 ? 'start' : to(t) >= 1 ? 'end' : 'middle', rank: Number(i > 0 && i < all.length - 1) }));
    });
  }
  // One metric sizes the dots of a plot, whichever layers name it. On a bar it is the column's width, and has no key.
  const sizeBy = layers.map((l) => (l.mark === 'bar' ? undefined : l.encode && l.encode.size)).find((f): f is string => typeof f === 'string');
  const size = sizeBy ? { field: sizeBy, top: common(result, 'size', [0, max(rows, (r) => num(r, sizeBy)) || 1])[1] } : undefined;

  if (guides.y) scales.forEach(({ v, ticks, coarse, text }, ui) => ticks.forEach((t) => {
    // A short plot keeps the ticks a count of 2 would give on this scale. The rest are ranked, to be given up there.
    const rank = Number(!coarse.includes(t));
    // The second scale's ticks are on the far side, keyed by its unit. The grid is the first scale's alone.
    if (ui) { if (guides.y2) nodes.push(axisTick('y-axis-2', units[ui] + ':' + t, v(t), text(t), { rank })); return; }
    if (guides.grid) nodes.push({ key: 'grid:' + t, part: 'plot', kind: 'line', y: v(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide', ...(rank && { rank }) });
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
  // Layers that measure several metrics are told apart as series are: a series colour for each metric, in layer order,
  // where the layer states no paint, and the paint it is drawn in for its entry in the legend. Not beside a split by
  // color, whose series the colours are spent on.
  // Without its legend the colours say nothing, so a plan that shows none has every series in its layer's own paint.
  const measures = painted ? [] : measuresOf(catalog, layers), several = measures.length > 1, paints = new Map<string, string>(), told = !!guides.legend;
  // One metric paints the bars and dots of a plot, whichever layers name it on color: each is a step of the ramp, by
  // its row's value, and the ramp is the key. The colours of a plot say one thing, so not beside a split or several metrics.
  const tints = layers.map((l) => l.encode && l.encode.color).filter((f): f is string => isMetric(catalog, f)), tint = tints[0];
  if (new Set(tints).size > 1) throw new Error('These layers put ' + new Set(tints).size + ' metrics on color (' + [...new Set(tints)].join(', ') + '), and a plot has one colour scale. Put one of them on color, and show the other on y or as a size.');
  if (tint && (painted || several)) throw new Error('"' + tint + '" is on color, which paints each mark by its value, and these layers are also told apart by colour: ' + (painted ? 'they are split by "' + split + '"' : 'they measure ' + measures.join(' and ')) + '. Keep one: take "' + tint + '" off color, or ' + (painted ? 'put "' + split + '" on detail' : 'draw one metric') + '.');
  const ramp = tint ? seqScale(rows.map((r) => r[tint]).filter((n): n is number => typeof n === 'number'), metricOf(catalog, tint)!, result) : null;
  const unpainted = several ? layers.findIndex((l) => !l.paint && l.series !== 'previous' && measures.indexOf(measureOf(catalog, l)!) >= SERIES) : -1;
  if (unpainted >= 0) throw new Error('These layers measure ' + measures.length + ' metrics (' + measures.join(', ') + '), and there are ' + SERIES + ' series colours for the ones that state no paint. Give layer ' + (unpainted + 1) + ' a "paint", or draw fewer metrics on one plot.');
  // Bars of one metric that fall below nothing as well as rise from it: each is a gain or a loss, and is painted as one.
  // A split plot's bars are painted by their series, and are not these.
  const diverges = (l: Layer) => { const y = l.encode!.y; return typeof y === 'string' && !splitOf(catalog, l, xField) && rows.some((r) => (r[y] as number) < 0); };
  const say = sayOf(catalog);
  layers.forEach((l, i) => {
    const draw = PLOT_MARKS[l.mark], prev = l.series === 'previous', span = spans[i]!;
    if (!draw) throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use ' + orList(Object.keys(PLOT_MARKS)) + '.');
    // A bar stands on a row's share of x, a tick lies across it, and a unit's glyphs are as wide as it. A metric there gives it none, and neither does a number dimension that came with no bins.
    // But for a tick with nothing on y, which stands at the foot of a plot of points at each row's value on x: a rug.
    const rug = l.mark === 'tick' && !!xOn && !xDim && l.encode!.y == null;
    if (l.mark === 'tick' && l.encode!.y == null && !rug) throw new Error('Layer ' + (i + 1) + ' is a tick with nothing on y, so there is no value to stand it at. Encode a metric on y, for a stroke across each "' + xField + '" at its value. With no y a tick is a rug, along the foot of a plot whose x is a metric.');
    if (rug && l.encode!.x !== xOn) throw new Error('Layer ' + (i + 1) + ' is a tick at ' + JSON.stringify(l.encode!.x) + ' along the foot of a plot whose x is "' + xOn + '", so it would stand at places the axis does not measure. Encode "' + xOn + '" on its x.');
    if ((l.mark === 'bar' || l.mark === 'tick' || l.mark === 'unit') && xOn && !xDim && !rug) throw new Error('Layer ' + (i + 1) + ' is a ' + l.mark + ' with the metric "' + xOn + '" on x, and a ' + l.mark + ' needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
    // An area fills down from a line that runs one way along x. The points of two metrics run in no order there.
    if (l.mark === 'area' && xOn && !xDim) throw new Error('Layer ' + (i + 1) + ' is an area with the metric "' + xOn + '" on x, and an area fills under a line that runs one way along x, which the points of two metrics do not. Use "line" to join the points in the order of their rows, or put a dimension on x.');
    if ((l.mark === 'bar' || l.mark === 'unit') && xOn && rows.length && rows[0]![xOn + '@end'] == null) throw new Error((l.mark === 'bar' ? 'Bars' : 'The glyphs of a unit') + ' on the number dimension "' + xOn + '" need its bins, and this result has no "' + xOn + '@end". Return where each bin ends from the query layer, or use line or dot.');
    if (l.at != null && xOn && !xDim) throw new Error('Layer ' + (i + 1) + ' is a rule "at" a value of x, and this plot\'s x is the metric "' + xOn + '", which is a scale and has no values to stand at. Give the place as a number: { "encode": { "x": ' + (typeof l.at === 'number' ? l.at : 0) + ' } }.');
    // Where each value a rule is `at` stands: the place of a row that has it on x. One no row has is not drawn.
    const at = l.at == null ? undefined : [l.at].flat().flatMap((value) => { const key = [...said].find(([, has]) => has === String(value)); return key ? [{ value: String(value), x: unit.cx(key[0]) }] : []; });
    const v = scaleOf(l).v, far = units.indexOf(unitOf(catalog, l, xField)!) > 0;
    // What is on the second scale says so, node by node: it goes with the axis it is read against.
    // And what is painted a colour that the legend is the key to says so: it is drawn plain where there is no legend.
    const on = (drawn: SceneNode[], keyed = false) => { for (const n of drawn) { if (far) n.axis = 2; if (keyed) n.legend = true; } return drawn; };
    const m = several ? measureOf(catalog, l) : null;
    const d: Draw = { say, id: ids[i]!, role: roleOf(l), paint: paintOf(l, catalog, result) || (prev ? 'compare' : 'series.' + (m == null || !told ? 1 : measures.indexOf(m) + 1)), prev, rows: rows.filter((r) => (rug ? r[xOn!] != null : across(l) || span.has(r))), k, unit, v, xv, at, size: guides.size ? size : undefined, points: !!xOn && !xDim, worth: worths[i],
      ends: (r) => { const [lo, hi] = span.get(r)!; return [v(lo), v(hi)]; },
      step: !!xDim && !!xOn && rows.length > 0 && rows[0]![xOn + '@end'] != null,
      // A mark with two ends is painted by which way it goes only where its layer says so: `paint: "direction"`.
      ...((l.paint === 'direction' ? l.encode!.y2 != null : l.mark === 'bar' && !l.paint && l.encode!.y2 == null && diverges(l)) && { polarity: metricOf(catalog, [l.encode!.y, l.encode!.y2].find((f) => typeof f === 'string'))?.polarity }) };
    // A metric's entry is in the paint of the layer that marks it: its primary one, where it has a fill under it too.
    if (m != null && !prev && (!paints.has(m) || d.role === 'primary')) paints.set(m, d.paint);
    // A layer with the plot's metric on color: each of its marks is painted off the ramp by its row's value, split by `detail` or not.
    const tinted = !!ramp && l.encode!.color === tint;
    if (tinted && l.paint) throw new Error('Layer ' + (i + 1) + ' has "' + tint + '" on color and the paint "' + l.paint + '", and a mark has one paint. Remove "paint" to paint each mark by its value, or take "' + tint + '" off color.');
    const shade = (drawn: SceneNode[], of: Row[]) => {
      if (!tinted) return drawn;
      const by = new Map(of.map((r) => [k(r), r]));                           // a mark's row, among the rows it was drawn from: one series' where the layer is split
      for (const n of drawn) if (n.layer === 'data' && n.row != null) { n.paint = ramp!.paint(by.get(n.row)?.[tint!] as number | null | undefined); n.legend = true; }
      return drawn;
    };
    if (!splitOf(catalog, l, xField)) {
      const drawn = shade(on(draw(l, d), m != null && !prev && !l.paint), d.rows), last = m == null || prev ? undefined : drawn.filter((n): n is PathNode => n.kind === 'path').map((n) => n.points[n.points.length - 1]!).pop();
      if (last) ends.set(m!, last.y);                                       // where the metric's line ends, for its label
      return nodes.push(...drawn);
    }
    // Split by detail, every series is in the layer's own paint, and none has a label at its end: a label is in its series' colour.
    const plain = !paintedOf(catalog, l, xField);
    series.forEach((s, j) => {
      // Bars of one x that are not stacked sit side by side: overlapping bars are never what was meant. Lines and areas overlay.
      const own = d.rows.filter((r) => str(r, split!) === s);
      const drawn = shade(on(draw(l, { ...d, series: s, paint: prev || plain || !told ? d.paint : 'series.' + (j + 1), ...(plain && { mass: true }), rows: own, ...(l.mark === 'bar' && !l.stack && { slot: [j, series.length] }) }), !prev && !plain), own);
      nodes.push(...drawn);
      // Where the series' line ends, for its label: half way up its band where areas are stacked.
      const last = drawn.filter((n): n is PathNode => n.kind === 'path').map((n) => n.points[n.points.length - 1]!).pop();
      if (last && !plain) ends.set(s, l.mark === 'area' && l.stack ? ((last.y2 || 0) + last.y) / 2 : last.y);
    });
  });
  if (painted) {
    // Both keys to the series, each in its own part, as a band has. The plan names one in `parts`; a fit rule swaps them.
    // A label sits beside the plot at the height its line ends. Two lines that end close have labels that collide:
    // that is the painter's to see to, since only it knows how tall a label is (reference, Open 5).
    series.forEach((s, j) => {
      if (ends.has(s)) nodes.push({ key: 'label:' + s, part: 'labels', kind: 'text', series: s, y: ends.get(s)!, text: s, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'series.' + (j + 1), layer: 'guide' });
    });
    nodes.push(...seriesLegend(series));
  } else if (several) {
    // The same two keys, for metrics: an entry each, named by its label, and a label where its line ends.
    measures.forEach((f) => {
      const name = metricOf(catalog, f)!.label, paint = paints.get(f) ?? 'series.1';
      if (ends.has(f)) nodes.push({ key: 'label:' + f, part: 'labels', kind: 'text', y: ends.get(f)!, text: name, anchor: 'start', baseline: 'middle', font: 'tick', paint, layer: 'guide' });
      nodes.push(...legendEntry(f, {}, name, paint));
    });
  }
  if (size) nodes.push(...sizeKey(metricOf(catalog, size.field)!, size.top));
  if (ramp) nodes.push(...ramp.ramp(rows.some((r) => r[tint!] == null)));
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
  return { key: (x ? 'xtick:' : 'ytick:') + k, part, kind: 'text', ...(x ? { x: at } : { y: at }), ...(row != null && { row }), text, anchor: anchor ?? (x ? 'middle' : part === 'y-axis' ? 'end' : 'start'),
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
/** The gap after a row's column of values. */
export const COLUMN_PAD = 14;
/** The room a column of values takes: its widest value, or its header where it has one and that is wider, and the gap after it. Measured in characters. */
export const columnRoom = (valueChars: number, headerChars = 0) => Math.max(valueChars * CHAR_W, headerChars * TICK_W) + COLUMN_PAD;


/* A row's track draws the plot's marks, turned (reference, Decided 51): a list is a plot on its side, so what a plot
 * has up its height a track has along its length, and what a plot has across a band a track has up the row, from the
 * top, where a row starts. A mark is one function, the plot's, handed one row and the track's scale, and what it makes
 * is turned once, here. What a list alone does to a mark is said after the turn, in `inTrack`. */
/** What a row hands a mark in its track: its layer's key, role and paint, the row, its value and its second end, and the track's scale. */
interface Track {
  id: string; role: Role; paint: string; say: Draw['say'];
  k: string; row: Row;
  /** The row's value on the track, and its second end, where the layer has one. */
  at: number; to?: number;
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
/** A list's layer as the plot's functions read one: what it has on y is on x, and what it has on x and x2 is on y and
 * y2. A rule with one end at a number lies from zero to it in each row, which a plot says with a second end at zero.
 * A label is a plot's rule's: what a list's layer reads of its own fields is the reads table's to say (reads.ts). */
const turnLayer = ({ label: _label, ...l }: Layer): Layer => {
  const { x, y, x2, y2: _, ...rest } = l.encode || {};
  return { ...l, encode: { ...rest, ...(y != null && { x: y }), ...(x != null && { y: x }), ...(x2 != null ? { y2: x2 } : l.mark === 'rule' && typeof x === 'number' && { y2: 0 }) } };
};
/** A node of the plot's, in a row's track. A rect keeps no band: it is as tall as its row. A line's ends up the row are said from the lower. */
const turn = (n: SceneNode): SceneNode => {
  if (n.kind === 'rect') { const { x: _x, w: _w, y, y2, ...rest } = n; return { ...rest, part: 'rows', ...(y != null && { x: y }), ...(y2 != null && { x2: y2 }) }; }
  if (n.kind === 'line') { const { x = 0, x2 = x, y, y2 = y, ...rest } = n, a = 1 - x, b = 1 - x2; return { ...rest, part: 'rows', x: y, x2: y2, y: Math.min(a, b), ...(a !== b && { y2: Math.max(a, b) }) }; }
  if (n.kind === 'circle') { const { x = 0, y, w, h, ...rest } = n; return { ...rest, part: 'rows', x: y, y: 1 - x, ...(h != null && { w: h }), ...(w != null && { h: w }) }; }
  return n;
};
/* The marks a row's track draws, by name: the plot's own functions. A new mark is a function there. Text is not among them: it is set in the row, not on the scale. */
const TRACK_MARKS: Partial<Record<Mark, MarkFn>> = { bar, rule, tick, dot, unit: unitStack };
/** One row is a band of its own: the whole of its track's height. */
const ROW = { x: () => 0, w: 1, cx: () => 0.5 };
/** A mark in a row's track: the plot's, of this one row, turned. A bar runs from zero to its value, or from its value
 * to its second end; a rule from its value to its second end, or to zero; and anything else stands at its value. */
function inTrack(l: Layer, d: Track): SceneNode[] {
  const { at, to, v } = d, ends: [number, number] = l.mark === 'bar' ? [v(to == null ? 0 : at), v(to ?? at)] : l.mark === 'rule' ? [v(at), v(to ?? 0)] : [v(0), v(at)];
  const drawn = TRACK_MARKS[l.mark]!(turnLayer(l), { id: d.id, role: d.role, paint: d.paint, prev: false, rows: [d.row], k: () => d.k, unit: ROW, say: d.say, v, ends: () => ends, series: d.series, polarity: d.polarity, worth: d.worth }).map(turn);
  for (const n of drawn) {
    // What a list alone does. A bar is whole, since no row is an unfinished bucket, and behind its label it is a tint.
    // A dot or a tick of a mass lets the ones under it show.
    if (n.kind === 'rect') { delete n.opacity; if (!d.beside) Object.assign(n, { opacity: 0.2, tone: 'soft' }); }
    else if (d.mass) n.opacity = MASS;
  }
  return drawn;
}
/** Whether a row's track is read by where its marks are, and so stands beside the label and not behind it: any mark but a bar from zero, a bar that is divided into a stack, the range behind the marks, and a line or an area down the list. */
export function trackBeside(layers: Layer[]): boolean {
  return layers.some((l) => LIST_MARKS[l.mark] || (TRACK_MARKS[l.mark] && (l.mark !== 'bar' || !!l.stack || (l.encode && (l.encode.x2 != null || l.encode.x == null)))));
}

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

// A dimension on y: a row for each of its values, with a track that has a metric on x. The ranked bar list is the first of these.
// The track's scale is derived here, once, from what its layers put on x. It is linear and holds zero and whatever is on
// either side of it, and it is not rounded: a row's track has no axis to read against.
// With the query's second dimension on the color of a stacked bar, each row's bar is divided into a series for each of
// its values, in that dimension's own order, which is the engine's: paint follows it, and there is a legend.
// With it on the detail of a dot or a tick, a row has one for each of its pairs, all in one paint and with no legend.
// `told` is whether the plan shows a legend: without one a divided row's series are in one paint, parted by their gaps.
function sceneRows(catalog: Catalog, layers: Layer[], result: Result, told = true): Body {
  const nodes: SceneNode[] = [];
  const { dim, split, own, items: all } = listOf(catalog, layers, result), items = all, rows = items.map((i) => i.row), shown = items.flatMap((i) => i.pairs);
  // A bar with nothing on x is no mark of a value: it is the range the row's marks are read against, as an arc with
  // nothing on angle is a gauge's. It is the catalog `domain` of the metric the other marks put on the track, divided
  // where the catalog's `bands` divide it. The track's scale holds it whole.
  const ranged = (l: Layer) => l.mark === 'bar' && l.encode!.x == null && l.encode!.x2 == null, fieldOn = (l: Layer) => [l.encode!.x, l.encode!.x2].find((f) => typeof f === 'string') as string | undefined;
  const tracked = layers.filter((l) => (TRACK_MARKS[l.mark] || LIST_MARKS[l.mark]) && !ranged(l)), units = [...new Set(tracked.map((l) => metricOf(catalog, fieldOn(l))?.unit).filter((u) => u != null))];   // a mark at a number alone has no unit, and stands on the track's scale as it is
  const behind = layers.findIndex(ranged), of = baseOf(tracked.map(fieldOn).find(Boolean) || ''), range = behind < 0 ? undefined : catalog.metrics[of];
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
    return [l, worthOf(catalog, x, all.map((i) => i.row), result)];
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
  const series = split ? orderOf(result, split) : [];
  const divides = (l: Layer) => !!split && splitOf(catalog, l, dim) === split, painted = layers.some((l) => paintedOf(catalog, l, dim));
  if (painted && series.length > SERIES) throw new Error(tooManySeries('Splitting by "' + split + '"', series.length, 'series'));
  // By detail a row has a mark for each pair where the marks can lie over each other and still be read: a dot or a tick.
  const lost = layers.findIndex((l) => divides(l) && !l.stack && l.mark !== 'dot' && l.mark !== 'tick');
  if (lost >= 0) throw new Error('Layer ' + (lost + 1) + ' is a "' + layers[lost]!.mark + '" in rows with "' + split + '" on detail, which would lay one over another in each row, all in one paint. Use "dot" or "tick" for a mark at each value' + (layers[lost]!.mark === 'bar' ? ', or encode "' + split + '" on color and give the bar "stack"' : '') + ', or remove "detail".');
  const whole = new Map(items.flatMap((i) => i.pairs.map((r) => [r, i.row] as const)));
  const spans = new Map(tracked.filter((l) => divides(l) && l.stack).map((l) => { const f = l.encode!.x as string; return [l, stacked(shown, series, split!, (r) => own.get(r)!, f, l.stack, l.stack === 'normalize' ? (r) => (whole.get(r)![f] as number) || Infinity : () => 1)] as const; }));
  const vals = edges.concat(tracked.flatMap((l) => (spans.has(l) ? [...spans.get(l)!.values()].flat() : divides(l) ? shown.flatMap((r) => on(l, r) as number[]) : rows.flatMap((r) => on(l, r) as number[])))), beside = trackBeside(layers);
  const [lo, hi] = common(result, 'track', holdingZero(vals)), v = (n: number) => (n - lo) / (hi - lo);
  const ids = layerKeys(layers), cols = columnsOf(catalog, layers), say = sayOf(catalog);
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
      if (ranged(l)) edges.slice(1).forEach((to, j) => nodes.push({ key: ids[li] + ':' + k + ':' + (j + 1), part: 'rows', kind: 'rect', x: v(to), ...(v(edges[j]!) && { x2: v(edges[j]!) }), row: k, paint: 'band.' + (j + 1), layer: 'guide', role: roleOf(l) }));
      else if (draw && divides(l)) {
        // A mark for each of the row's pairs, in the series' order: a stacked bar's share, from where the one before it ends.
        // By detail it is a mark at each pair's own value, all in the layer's paint.
        series.forEach((s, j) => pairs.forEach((p) => {
          if (str(p, split!) !== s) return;
          const ends = span ? span.get(p) : on(l, p), d = { id: ids[li]!, role: roleOf(l), say, k, row: p, series: s, v, beside };
          if (!ends || ends[0] == null) return;
          const drawn = inTrack(l, span ? { ...d, paint: told ? 'series.' + (j + 1) : 'series.1', at: ends[0], to: ends[1]! } : { ...d, paint: paintOf(l, catalog, result) || shade(l, r) || 'series.1', at: ends[0], mass: true });
          if (span) for (const n of drawn) n.legend = true;                 // a stacked piece is in its series' colour, which the legend is the key to
          nodes.push(...drawn);
        }));
      } else if (draw) {
        const [at, to] = on(l, r), two = l.encode!.x2 != null;
        if (at == null || (two && to == null)) return;                  // a row with nothing to mark has no mark
        nodes.push(...inTrack(l, { id: ids[li]!, role: roleOf(l), say, paint: paintOf(l, catalog, result) || shade(l, r) || (l.series === 'previous' ? 'compare' : 'series.1'), k, row: r, at, ...(two && { to: to! }), v, beside, worth: worths.get(l),
          ...(l.mark === 'bar' && two && l.paint === 'direction' && { polarity: metricOf(catalog, fieldOn(l))?.polarity }) }));
      } else if (l.mark === 'text') {
        const cell = cellOf(catalog, l, r);
        nodes.push({ key: ids[li] + ':' + k, part: 'rows', kind: 'text', row: k, text: cell.text,
          anchor: l.align === 'end' ? 'end' : 'start', baseline: 'middle', font: cols.includes(l) ? 'value' : 'label', paint: cell.paint, layer: 'data', role: roleOf(l), ...rank(l) });
      } else if (!LIST_MARKS[l.mark]) {
        throw new Error('The "' + l.mark + '" mark has no rule for rows yet. Use ' + orList([...Object.keys(TRACK_MARKS), ...Object.keys(LIST_MARKS), 'text']) + '.');
      }
    });
  });
  // The plot's marks that run down a list, by the plot's own functions, on their side (LIST_MARKS): a row's place down
  // the list is what a plot has along x, and the track's scale what it has up y. One mark to the list and not one to a
  // row, so they are in a part of their own, `track`, that lies over every row's track, and a surface turns them.
  const place = new Map(items.map((i, j) => [i.k, j])), count = items.length;
  layers.forEach((l, li) => {
    const draw = LIST_MARKS[l.mark], prev = l.series === 'previous';
    if (draw) nodes.push(...draw(l, {
      id: ids[li]!, role: roleOf(l), paint: paintOf(l, catalog, result) || (prev ? 'compare' : 'series.1'), prev, rows: rows.filter((r) => on(l, r)[0] != null), k: (r) => keyOf.get(r)!, say: sayOf(catalog), v, part: 'track',
      unit: { x: (k) => place.get(k)! / count, w: 1 / count, cx: (k) => (place.get(k)! + 0.5) / count }, ends: (r) => [v(0), v(on(l, r)[0] as number)],
    }));
  });
  worths.forEach((worth, l) => nodes.push(...unitKey(ids[layers.indexOf(l)]!, worth, metricOf(catalog, l.encode!.x))));
  if (painted) {
    // Both keys to the series, each in its own part, as a band has: a swatch and a name for each, and one line that
    // names the series with the most, in its colour, by the engine's totals. The plan names one in `parts`.
    const name = (s: unknown) => formatDimension(s as string, catalog.dimensions[split!]!), f = layers.find((l) => spans.has(l))!.encode!.x as string, by = result.totalsBy && result.totalsBy[split!];
    nodes.push(...seriesLegend(series, name));
    const top = by && leader(result, split!, f);
    if (top) nodes.push({ key: 'legend-top', part: 'legend-top', kind: 'text', series: str(top, split!), text: name(top[split!]) + ' ' + portion(num(top, f), result.totals[f], metricOf(catalog, f)!), anchor: 'start', font: 'label', paint: 'series.' + (series.indexOf(str(top, split!)) + 1), layer: 'guide' });
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
    nodes.push({ key: 'seg:' + k(r), part: 'band', kind: 'rect', w: num(r, m) / total, row: k(r), paint: 'series.' + ((i % SERIES) + 1), layer: 'data', role: roleOf(layer) });
  });
  return { nodes: nodes.concat(shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, catalog.metrics[m]!, totals[m], (i) => 'series.' + ((i % SERIES) + 1))), rows: rows.map(k) };
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
  const cell = (key: string, more: Partial<RectNode>): number => nodes.push({ key, part: 'band', kind: 'rect', x: (nodes.length % side) / side, w: 1 / side, y: 1 - (Math.floor(nodes.length / side) + 1) / side, h: 1 / side, paint: own, layer: 'data', role, ...more });
  if (!isDim(catalog, dim)) {
    if (!M.domain) throw new Error('A "unit" with no dimension reads "' + m + '" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the grid by it.');
    const v = result.totals[m], [least, most] = M.domain, lit = v == null || !(v > least) ? 0 : Math.max(1, Math.round(along(M.domain, v) * UNIT_CELLS));
    for (let i = 0; i < UNIT_CELLS; i++) cell(id + ':' + (i + 1), i < lit ? {} : TINT);
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
const legendEntry = (k: string, of: { row?: string; series?: string }, text: string, paint: string): SceneNode[] => [
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
// `told` is whether the plan shows a legend: without one the segments, rings and seats are in one paint, parted by their gaps.
function sceneRadial(catalog: Catalog, layers: Layer[], q: Query, result: Result, told = true): Body & Pick<Scene, 'aspect'> {
  const hue = (j: number) => (told ? 'series.' + (j + 1) : 'series.1');
  const half = layers.some((l) => l.sweep === 'half'), from = half ? -0.25 : 0, span = half ? 0.5 : 1;
  const ids = layerKeys(layers), arcs: ArcNode[] = [], legend: SceneNode[] = [], rim: SceneNode[] = [], seats: SceneNode[] = [];
  let keys: string[] | undefined, rings: string | undefined, detail: string[] | undefined, around: string | undefined, sliced = false;
  // What reaches out from the centre by a metric, at each place round a dimension on angle: a slice, and the plot's
  // marks bent (ROUND_MARKS). They are on the circle's one scale out, from nothing at the middle to the most of them at
  // the rim: by area where a slice reaches, since a slice is read by its area, and by distance where only lines and dots do.
  // ponytail: one metric out from the centre. Several would need a colour and a legend entry each, as a plot's layers have.
  const reaching = layers.filter((l) => (l.mark === 'arc' || ROUND_MARKS[l.mark]) && isDim(catalog, l.encode?.angle) && typeof l.encode?.radius === 'string' && !!metricOf(catalog, l.encode.radius));
  const outBy = (l: Layer) => (l.series === 'previous' ? l.encode!.radius + '@previous' : (l.encode!.radius as string)), reached = [...new Set(reaching.map((l) => baseOf(l.encode!.radius as string)))];
  if (reached.length > 1) throw new Error('These layers reach out from the centre by ' + reached.length + ' metrics (' + reached.join(', ') + '), and a circle has one scale out from its middle. Keep the layers of one metric, or draw the other in a view of its own.');
  const most = common(result, 'reach', [0, Math.max(0, ...reaching.flatMap((l) => result.rows.map((r) => (r[outBy(l)] as number | null | undefined) ?? 0))) || 1])[1], byArea = reaching.some((l) => l.mark === 'arc');
  const reach = (v: number) => (byArea ? Math.sqrt(Math.max(0, v) / most) : Math.max(0, v) / most), bent: SceneNode[] = [];
  // The names round the rim, one at the middle of each place. Where to thin them from: about four stay, then those half way between them, then the rest.
  const rimOf = (rows: Row[], one: string, k: (r: Row) => string) => {
    const dim = catalog.dimensions[one]!, every = Math.ceil(rows.length / 4), rank = (j: number) => (j % every ? { rank: every % 2 || j % (every / 2) ? 2 : 1 } : {});
    rows.forEach((r, j) => {
      const lo = j / rows.length, hi = (j + 1) / rows.length, mid = (lo + hi) * Math.PI;
      rim.push({ key: 'rim:' + k(r), part: 'rim', kind: 'text', x: steady(0.5 + Math.sin(mid) / 2), y: steady(0.5 + Math.cos(mid) / 2), row: k(r), text: formatDimension(r[one], dim),
        anchor: Math.sin(mid) > 0.2 ? 'start' : Math.sin(mid) < -0.2 ? 'end' : 'middle', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank(j) });
    });
  };
  const arc = (key: string, l: Layer, lo: number, hi: number, r0: number, paint: string, more?: Partial<ArcNode>, r1 = 1): ArcNode => {
    const a = { a0: from + lo * span, a1: from + hi * span, r0, r1 };
    return { key, part: 'radial', kind: 'arc', ...a, d: arcD(a), paint, layer: 'data', role: roleOf(l), ...more };
  };
  layers.forEach((l, i) => {
    const enc = l.encode || {}, angle = enc.angle, r0 = enc.radius ?? 0, n = 'Layer ' + (i + 1), split = detailOf(catalog, l);
    const twice = n + ' is a second layer split by color, and a circle is divided once. Remove one of them.';
    // A `unit` about a centre: seats round the half circle, in rings, a wedge of them and a series colour for each row.
    // A seat is one of the metric while the engine's total is a hundred or fewer, and beyond that the round number at
    // which the total is a hundred seats or fewer. Each row's seats are its own value in whole glyphs, so they need not
    // sum to the total's. Under a `limit` the seats the rows past it would have are there, painted as no value.
    if (l.mark === 'unit') {
      const m = angle, dim = enc.color, M = metricOf(catalog, m), rows = result.rows, total = M && result.totals[m as string];
      if (typeof m !== 'string' || !M || !isDim(catalog, dim)) throw new Error(n + ' is a "unit" about a centre, which is seats round a half circle, and has ' + held(m) + ' on angle and ' + held(dim) + ' on color. Put a metric on angle and a dimension on color. For a grid read against the metric\'s range, put the metric on x and nothing on angle.');
      if (l.sweep !== 'half') throw new Error(n + ' is a "unit" with a metric on angle and no "sweep", and its seats sit round a half circle. Add "sweep": "half" to the layer.');
      if (keys) throw new Error(twice);
      if (rows.length > SERIES) throw new Error(tooManySeries('Splitting by "' + dim + '"', rows.length, 'groups of seats'));
      const own = rowKeys(rows, dim), k = (r: Row) => own.get(r)!, whole = M.unit === 'count';
      // With no total to read, the largest row is ten seats or fewer, as a stack's largest is ten glyphs.
      const worth = total ? unitWorth(total, UNIT_SEATS, whole) : worthOf(catalog, m, rows, result);
      const counts = rows.map((r) => (r[m] == null ? 0 : unitCount(num(r, m), worth, valueOf(m, k(r))))), filled = counts.reduce((s, c) => s + c, 0);
      const rest = q.limit && total ? Math.max(0, Math.round(total / worth) - filled) : 0, { seats: at, pitch } = unitSeats(filled + rest);
      const seat = (key: string, more: Partial<SceneNode>) => {
        const { a, r } = at[seats.length]!, turn = Math.PI * (1 - a);
        seats.push({ key, part: 'radial', kind: 'circle', pulse: false, x: steady(0.5 + r * Math.cos(turn) / 2), y: steady(r * Math.sin(turn)), w: pitch / 2, h: pitch, paint: 'seq.none', layer: 'data', role: roleOf(l), ...more } as SceneNode);
      };
      rows.forEach((r, j) => { for (let c = 1; c <= counts[j]!; c++) seat(ids[i] + ':' + k(r) + ':' + c, { row: k(r), paint: hue(j), legend: true }); });
      for (let c = 1; c <= rest; c++) seat(ids[i] + '#rest:' + c, {});
      legend.push(...unitKey(ids[i]!, worth, M), ...shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, M, total, (j) => 'series.' + (j + 1)));
      keys = rows.map(k);
      return;
    }
    // The plot's marks, bent: each by the plot's own function, handed a place round the circle where a plot has one
    // along x and the reach out from the middle where it has a value up y. A dot is then set where the two put it in
    // the part's box, as a seat is, and a path's `d` is drawn about the middle, as an arc's is (pathD).
    const round = ROUND_MARKS[l.mark];
    if (round) {
      const f = enc.radius;
      if (!isDim(catalog, angle) || typeof f !== 'string' || !metricOf(catalog, f)) throw new Error(n + ' is a "' + l.mark + '" about a centre, which stands at each value of a dimension round the circle and reaches out to its value, and it has ' + held(angle) + ' on angle and ' + held(f) + ' on radius. Put a dimension on angle and a metric on radius.');
      if (keys && around !== angle) throw new Error(n + ' divides the circle again, by "' + angle + '", and a circle is divided once. Remove one of the layers that divide it.');
      const rows = result.rows, own = rowKeys(rows, angle), k = (r: Row) => own.get(r)!, place = new Map(rows.map((r, j) => [k(r), j])), count = rows.length, prev = l.series === 'previous', by = outBy(l);
      const drawn = round(l, { id: ids[i]!, role: roleOf(l), paint: paintOf(l, catalog, result) || (prev ? 'compare' : 'series.1'), prev, rows: rows.filter((r) => r[by] != null), k, say: sayOf(catalog), v: reach, part: 'radial', bend: true,
        unit: { x: (key) => place.get(key)! / count, w: 1 / count, cx: (key) => (place.get(key)! + 0.5) / count }, ends: (r) => [0, reach(num(r, by))] });
      bent.push(...drawn.map((node): SceneNode => (node.kind === 'circle' ? { ...node, x: steady(0.5 + node.y! * Math.sin(node.x! * TURN) / 2), y: steady(0.5 + node.y! * Math.cos(node.x! * TURN) / 2) } : node)));
      if (!rim.length) rimOf(rows, angle, k);
      keys = rows.map(k); around = angle; rings = '';
      return;
    }
    if (l.mark !== 'arc') throw new Error('The "' + l.mark + '" mark has no rule about a centre yet. Use ' + orList(['arc', 'unit', ...Object.keys(ROUND_MARKS)]) + ', or take "angle" off the other layers.');
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
      const m = slices ? r0 : angle, M = metricOf(catalog, m), top = M ? common(result, 'ring', [0, Math.max(0, max(rows, (r) => num(r, m as string)) ?? 0) || 1])[1] : 1;
      if (slices && !M) throw new Error(n + ' has a slice for each "' + one + '" and ' + (enc.radius == null ? 'nothing' : JSON.stringify(enc.radius)) + ' on radius. Every slice is as wide as the next, so a metric on radius says how far each reaches: put one there. For a share each, put the metric on angle and "' + one + '" on color.');
      // ponytail: slices in one paint. A second dimension on color would stack each slice, and that is not built.
      if (slices && enc.color != null) throw new Error(n + ' encodes ' + JSON.stringify(enc.color) + ' on color and has a slice for each "' + one + '", and the slices are drawn in one paint. Remove "color", or set the layer\'s "paint".');
      if (enc.color != null && enc.color !== one) throw new Error(n + ' has a ring for each "' + one + '" and encodes ' + JSON.stringify(enc.color) + ' on color. A ring is painted by its own dimension, for a colour and a legend entry each: encode "' + one + '" on color, or remove it.');
      // A circle is divided once. Rings of one dimension may be drawn by several layers: the whole ring, and the value on it.
      // But for slices under the plot's marks at the same places: a line or dots over a rose.
      if (keys && rings !== one && !(slices && around === one && !sliced)) throw new Error(n + ' divides the circle again, by "' + one + '", and a circle is divided once. Remove one of the layers that divide it.');
      if (!slices && rows.length > RINGS) throw new Error('A ring for each "' + one + '" makes ' + rows.length + ' rings, and a circle has room for ' + RINGS + '. Add "limit": ' + RINGS + ' to the query, or less.');
      if (slices) {
        rows.forEach((r, j) => {
          const out = r[m as string] == null ? 0 : reach(num(r, m as string)), lo = j / rows.length, hi = (j + 1) / rows.length;
          // A row with no value, or none above zero, has no slice. It keeps its place and its label.
          if (out > 0) arcs.push(arc(ids[i] + ':' + k(r), l, lo, hi - (rows.length > 1 ? GAP : 0), 0, l.paint || 'series.1', { row: k(r) }, out));
        });
        if (!rim.length) rimOf(rows, one, k);
        sliced = true; around = one;
      } else {
        if (angle != null && (!M || isDim(catalog, angle))) throw new Error(n + ' has a ring for each "' + one + '" and ' + JSON.stringify(angle) + ' on angle. Put a metric on angle, which each ring\'s arc sweeps to, or leave angle out for the whole ring.');
        const [least, most] = (M && M.domain) || [0, top], pitch = (1 - INNER) / (rows.length || 1), shade = (j: number) => l.paint || (enc.color != null ? hue(j) : 'series.1'), keyed = enc.color != null && !l.paint && { legend: true as const };
        rows.forEach((r, j) => {
          const r1 = 1 - j * pitch, inner = r1 - pitch * RING;
          if (angle == null) return arcs.push(arc(ids[i] + ':' + k(r), l, 0, 1, inner, shade(j), { row: k(r), ...TINT, ...keyed }, r1));
          if (r[m as string] != null) arcs.push(arc(ids[i] + ':' + k(r), l, 0, along([least, most], num(r, m as string)), inner, shade(j), { row: k(r), ...keyed }, r1));
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
      if (keys) throw new Error(twice);
      // With a second ring a row is a pair, so the segments are the engine's own rows for the first dimension.
      const whole = split ? result.totalsBy && result.totalsBy[dim] : result.rows;
      if (!whole) throw new Error(n + ' divides each "' + dim + '" by "' + split + '", and a segment\'s span is the engine\'s total for it: this result has no totalsBy. Return it from the query layer, or remove "detail".');
      const rows = whole, own = rowKeys(rows, dim), k = (r: Row) => own.get(r)!, edge = split ? inner + (1 - inner) * SPLIT : 1;
      if (rows.length > SERIES) throw new Error(tooManySeries('Splitting by "' + dim + '"', rows.length, 'segments'));
      // The second ring's values in the engine's order, which each segment's arcs run in.
      const kids = split ? orderOf(result, split) : [];
      // Each segment starts where the one before it ends, a hair apart.
      let run = 0;
      rows.forEach((r, j) => {
        const lo = run / total, hi = (run += num(r, m)) / total;
        arcs.push(arc(ids[i] + ':' + k(r), l, lo, Math.max(lo, hi - (rows.length > 1 ? GAP / span : 0)), inner, hue(j), { row: k(r), legend: true }, edge));
        // Its part of the second ring starts where it does, and each arc there is a share of the same total: lighter, in
        // its segment's paint, and with no entry in the legend. Rows past a `limit` leave it short of its segment's end.
        // ponytail: a pair the result says twice would share a key. A result is one row per pair.
        let at = lo * total;
        const mine = result.rows.filter((p) => split && p[dim] === r[dim] && p[m] != null).sort((a, b) => kids.indexOf(str(a, split!)) - kids.indexOf(str(b, split!)));
        mine.forEach((p) => {
          const start = at / total, end = (at += num(p, m)) / total;
          arcs.push(arc(ids[i] + ':' + k(r) + ':' + str(p, split!), l, start, Math.max(start, end - GAP / span), edge, hue(j), { row: k(r), series: str(p, split!), opacity: CHILD, legend: true }));
        });
      });
      legend.push(...shareLegend(rows, k, dim, catalog.dimensions[dim]!, m, catalog.metrics[m]!, result.totals[m], (j) => 'series.' + (j + 1)));
      keys = rows.map(k);
      if (split) detail = kids;
      return;
    }
    if (split) throw new Error(n + ' encodes "' + split + '" on detail and no dimension on color. A second ring divides the segments of a circle that color has divided: encode the query\'s other dimension on color, or remove "detail".');
    if (angle == null) return arcs.push(arc(ids[i]!, l, 0, 1, r0 as number, l.paint || 'series.1', TINT));
    const marked = typeof angle === 'number' || roleOf(l) === 'reference', m = typeof angle === 'number' ? q.metrics[0]! : angle, M = catalog.metrics[m];
    if (!M) throw new Error(n + ' has "' + m + '" on angle, which is not a metric. Put a metric on angle, and a dimension on color.');
    if (!M.domain) throw new Error(n + ' reads "' + m + '" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the circle by it.');
    const v = typeof angle === 'number' ? angle : marked ? M.target : result.totals[m], [least, most] = M.domain;
    if (v == null) return;                                                   // no target to mark, or no total to sweep to
    const at = along(M.domain, v);
    // ponytail: a mark is a thin arc, since there is no `tick` mark to draw it with yet (chart-coverage-plan, step 3).
    arcs.push(marked ? arc(ids[i]!, l, Math.max(0, at - MARK / span), Math.min(1, at + MARK / span), r0 as number, l.paint || 'rule') : arc(ids[i]!, l, 0, at, r0 as number, l.paint || 'series.1'));
  });
  // The number sits in the hole of a donut: the short form, which is what fits. Whether it shows is a fit rule's to say.
  const inner = arcs.filter((a) => a.role === 'primary').map((a) => a.r0), nodes: SceneNode[] = arcs;
  if (inner.length && Math.min(...inner) >= HOLE) nodes.push({ key: 'hole', part: 'hole', kind: 'text', text: tldrValueText(catalog, q, result, true), anchor: 'middle', font: 'display', paint: 'ink', layer: 'data' });
  return { nodes: nodes.concat(bent, rim, seats, legend), ...(keys && { rows: keys }), ...(detail && { detail }), aspect: half ? 2 : 1 };
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
export function seqScale(vals: number[], metric?: MetricDef, result: Pick<Result, 'domains'> = {}): { paint(v: number | null | undefined): string; ramp(none: boolean): SceneNode[] } {
  const [lo, hi] = common(result, 'color', endsOf(vals, metric)), say = (n: number) => formatMetric(n, metric, true);
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
// A grid is a plot whose two axes are both lists, so a mark of the plot's that needs no quantity to stand at is drawn
// here by the plot's own function, handed the grid's places (GRID_MARKS): a `text` says a value in the middle of each pair.
function sceneMatrix(catalog: Catalog, layers: Layer[], result: Result): Body {
  const rest = layers.filter((l) => !GRID_MARKS[l.mark]);
  const cell = rest.find((l) => l.mark === 'cell'), dot = rest.find((l) => l.mark === 'dot'), l = cell || dot || layers[0]!, { x: xf, y: yf } = l.encode || {};
  const metric = (f: unknown): f is string => typeof f === 'string' && f in catalog.metrics, of = (r: Row, f: string | undefined) => (f == null ? '' : String(r[f]));
  // One colour scale to a grid: the cell's, or the dot's where it stands alone.
  const m = cell ? cell.encode!.color : dot && dot.encode!.color, sized = dot && dot.encode!.size;
  if (rest.length !== (cell ? 1 : 0) + (dot ? 1 : 0) || rest.length > 2 || (xf != null && !isDim(catalog, xf)) || (yf != null && !isDim(catalog, yf)) || (xf == null && yf == null) || (cell && !metric(m))
    || (dot && (!metric(sized) || xf == null || yf == null || dot.encode!.x !== xf || dot.encode!.y !== yf || (cell ? dot.encode!.color != null : m != null && !metric(m))))) {
    throw new Error('A dimension on both x and y makes a grid, and a grid draws a "cell" with a metric on color, a "dot" with a metric on size, or the two together on the same x and y. Write { "mark": "cell", "encode": { "x": "' + xf + '", "y": "' + yf + '", "color": a metric } }, or { "mark": "dot", "encode": { "x": "' + xf + '", "y": "' + yf + '", "size": a metric } }, which may have a metric on color where no cell has one. A "text" on the same x and y says a value over either. Leave x or y out of a cell alone for one column or one row, or move a dimension off an axis.');
  }
  // What a plot's mark needs of a grid: something under it, the grid's own axes, and one layer of each.
  // A layer is known by where it stands among the layers, since a spec may hold one object twice.
  const sharedAt = layers.flatMap((o, i) => (GRID_MARKS[o.mark] ? [i] : []));
  sharedAt.forEach((i) => {
    const own = layers[i]!, first = sharedAt.find((j) => layers[j]!.mark === own.mark)!;
    const n = 'Layer ' + (i + 1) + ' is a "' + own.mark + '" in a grid', xy = '"x": ' + JSON.stringify(xf) + ', "y": ' + JSON.stringify(yf);
    // ponytail: a cell or a dot is what a reader steps to and a pointer finds, so a text has to stand over one. Text alone is a table of values, which the element gives as its table already: let it be a grid of its own if that is ever asked for.
    if (!cell && !dot) throw new Error(n + ' with no cell or dot under it, and it is the cells and dots that a reader steps through. Add { "mark": "cell", "encode": { ' + xy + ', "color": a metric } } before it, or a "dot" with a metric on size.');
    if (own.encode?.x !== xf || own.encode?.y !== yf) throw new Error(n + ' whose axes are not the grid\'s. Encode { ' + xy + ' } on it, as the ' + (cell ? 'cell' : 'dot') + ' does.');
    if (own.mark === 'text' && typeof own.encode?.text !== 'string') throw new Error(n + ' with nothing on text, so it has nothing to say. Encode what each pair should say there, for example { ' + xy + ', "text": ' + JSON.stringify(cell?.encode?.color ?? dot?.encode?.size) + ' }.');
    if (first !== i) throw new Error(n + ', and layer ' + (first + 1) + ' is one already: a pair has room for one. Remove one of the two.');
  });
  // Each dimension in its own order, which is the engine's, so the grid does not turn with the ranking.
  // A binned quantity has an order of its own, least first, whatever the engine ranked its rows by.
  const binned = (f: string | undefined) => (f == null ? [''] : catalog.dimensions[f]!.type === 'number' ? orderOf(result, f).sort((a, b) => Number(a) - Number(b)) : orderOf(result, f));
  // Down the side a category is read from the top, as a table is. A quantity beside another dimension is read from the
  // foot, as a plot's y axis is: its least bin is the bottom row. Alone it is one column, a list, and reads down.
  const xs = binned(xf), ys = xf != null && yf != null && catalog.dimensions[yf]!.type === 'number' ? binned(yf).reverse() : binned(yf);
  const held = (f: string) => new Map(result.rows.map((r) => [of(r, xf) + '\n' + of(r, yf), r[f] as number | null | undefined])), known = (at: Map<string, number | null | undefined>) => [...at.values()].filter((v): v is number => v != null);
  // The colour scale runs from the least to the most of the cells drawn. That is geometry, as the top of a y scale is,
  // and not a total, so it is read from the rows. A domain the catalog states for the metric comes before it.
  const at = metric(m) ? held(m) : null, vals = at ? known(at) : [], seq = at && seqScale(vals, catalog.metrics[m as string]!, result);
  // A size is read the same way: the most a dot stands for is the value farthest from zero, or the farther end of a stated domain.
  const sizes = metric(sized) ? held(sized) : null, top = sizes ? common(result, 'size', [0, Math.max(...endsOf(known(sizes), catalog.metrics[sized as string]!).map(Math.abs)) || 1])[1] : 1;
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
  if (cell) each((x, y, i, j) => ({ key: ids[layers.indexOf(cell)] + ':' + x + ':' + y, part: 'plot', kind: 'rect', x: i / nx, w: 1 / nx, y: 1 - (j + 1) / ny, h: 1 / ny, pair: [x, y], paint: seq!.paint(at!.get(x + '\n' + y)), layer: 'data', role: roleOf(cell) }));
  // A dot with no value is the least a painter draws, in the paint of no value: the pair is still there to be read.
  if (dot) each((x, y, i, j) => {
    const v = sizes!.get(x + '\n' + y), paint = v == null ? 'seq.none' : !cell && seq ? seq.paint(at!.get(x + '\n' + y)) : dot.paint || 'series.1';
    return { key: ids[layers.indexOf(dot)] + ':' + x + ':' + y, part: 'plot', kind: 'circle', pulse: false, x: (i + 0.5) / nx, y: 1 - (j + 0.5) / ny, ...(v != null && { size: sizeStep(Math.abs(v), top) }), pair: [x, y], paint, layer: 'data', role: roleOf(dot) };
  });
  // The plot's marks, each handed the grid's places: a row of the result is a pair, in the middle of its place on each axis.
  for (const i of sharedAt) {
    const own = layers[i]!, f = own.encode?.text, rows = result.rows.filter((r) => typeof f !== 'string' || r[f] != null);
    nodes.push(...GRID_MARKS[own.mark]!(own, {
      id: ids[i]!, role: roleOf(own), paint: own.paint || 'ink', prev: false, rows, say: sayOf(catalog), v: (n) => n,
      k: (r) => of(r, xf) + '\n' + of(r, yf), unit: { x: (k) => xs.indexOf(k.split('\n')[0]!) / nx, w: 1 / nx, cx: (k) => (xs.indexOf(k.split('\n')[0]!) + 0.5) / nx },
      ends: (r) => { const t = 1 - (ys.indexOf(of(r, yf)) + 0.5) / ny; return [t, t]; },
      of: (r) => ({ key: ids[i] + ':' + of(r, xf) + ':' + of(r, yf), pair: [of(r, xf), of(r, yf)] }),
      ...(metric(sized) && { size: { field: sized, top } }), ...(typeof f === 'string' && { rank: f }),
    }));
  }
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
      const v = has[f], of = baseOf(f);
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

/* The plot's marks that a grid draws too, by the plot's own functions: the ones that need no quantity to stand at.
 * A tick, a rule, a line and a bar are measured along an axis, and a grid has two lists. A new one is a name here. */
const GRID_MARKS: Partial<Record<Mark, MarkFn>> = { text: label };
/* And the ones a list draws, on their side: a mark that joins the rows, where a row's own marks are its track's
 * (TRACK_MARKS). A line runs down the list from each row's value to the next, and an area fills back to where the
 * track has nothing. */
const LIST_MARKS: Partial<Record<Mark, MarkFn>> = { line: path, area: path };
/* And the ones a circle draws, bent about its centre: a place round the circle is what a plot has along x, and how far
 * out from the middle what it has up y. A line runs round from each place to the next and closes, an area fills in
 * from it to the centre, and a dot stands at each place. */
const ROUND_MARKS: Partial<Record<Mark, MarkFn>> = { line: path, area: path, dot };
/* And the ones drawn over a custom mark, at the places it offers (CustomMark.places): a mark that stands at a place
 * and needs no axis. A `text` says something at each value's place: the names or the values on a map. */
const OVER_MARKS: Partial<Record<Mark, MarkFn>> = { text: label };
/** The marks of the plot's that may lie over a custom mark that offers its places. */
export const overMarks = (): string[] => Object.keys(OVER_MARKS);
/** What is drawn over a custom mark: each layer that is not the mark's own, by the plot's function, handed the mark's places. */
function sceneOver(layers: Layer[], name: string, mark: CustomMark, view: MarkView): SceneNode[] {
  const at = layers.flatMap((l, i) => (l.mark === name ? [] : [i]));
  if (!at.length || !mark.places) return [];
  const ids = layerKeys(layers), dim = view.layers[0]?.encode?.x as string, place = mark.places(view), key = (r: Row) => String(r[dim]);
  return at.flatMap((i) => {
    const own = layers[i]!, n = 'Layer ' + (i + 1) + ' is a "' + own.mark + '" over a "' + name + '"', f = own.encode?.text, first = at.find((j) => layers[j]!.mark === own.mark)!;
    if (own.encode?.x !== dim) throw new Error(n + ', whose places are the values of ' + JSON.stringify(dim) + '. Encode { "x": ' + JSON.stringify(dim) + ' } on it, as the "' + name + '" layer does.');
    if (typeof f !== 'string') throw new Error(n + ' with nothing on text, so it has nothing to say. Encode what each place should say there, for example { "x": ' + JSON.stringify(dim) + ', "text": ' + JSON.stringify(view.query.metrics[0]) + ' }.');
    if (first !== i) throw new Error(n + ', and layer ' + (first + 1) + ' is one already: a place has room for one. Remove one of the two.');
    // A row says something where it has something to say and its value has a place.
    const rows = view.result.rows.filter((r) => r[f] != null && r[dim] != null && place(key(r)));
    return OVER_MARKS[own.mark]!(own, { id: ids[i]!, role: roleOf(own), paint: own.paint || 'ink', prev: false, rows, say: sayOf(view.catalog), v: (x) => x, k: key, rank: f,
      unit: { x: (k) => place(k)!.x, w: 0, cx: (k) => place(k)!.x }, ends: (r) => { const y = place(key(r))!.y; return [y, y]; }, of: (r) => ({ key: ids[i] + ':' + key(r), row: key(r) }) });
  });
}
const TURN = 2 * Math.PI;

/** The scene for a plan, in ratios. Neither takes a size, so this is everything the spec asks for. */
export function buildScene(p: PlanShape, q: Query, result: Result, catalog: Catalog): Scene {
  checkValues(result, catalog);
  const number = sceneNumber(catalog, q, result, p.share);
  const parts: Part[] = p.tldrValue || p.layout === 'none' ? ['number'] : [];
  let body: Body = { nodes: [] };
  // The key to a unit's glyphs, where the plan shows it and the scene has one: a glyph worth one has none.
  const unitKeyed = () => { if (p.guides.unitKey && body.nodes.some((n) => n.part === 'unit-key')) parts.push('unit-key'); };
  // A ramp or a key to sizes, where the plan shows it and the scene has one.
  const keyTo = (part: 'ramp' | 'size', guide: boolean | undefined) => { if (guide && body.nodes.some((n) => n.part === part)) parts.push(part); };
  if (p.layout === 'notice') {
    parts.push('notice');
    body.nodes.push({ key: 'notice', part: 'notice', kind: 'text', text: emptyNote(catalog.metrics[q.metrics[0]!]!, true), anchor: 'middle', baseline: 'middle', font: 'label', paint: 'ink.muted', layer: 'guide' });
  } else if (p.layout === 'cartesian') {
    body = sceneCartesian(catalog, p.layers, p.guides, result, (q.by || [])[0]);
    if (p.guides.y && body.nodes.some((n) => n.part === 'y-axis')) parts.push('y-axis');   // a stack about the middle has no value axis
    parts.push('plot');
    if (body.nodes.some((n) => n.part === 'points')) parts.push('points');
    if (p.guides.pointLabels && body.nodes.some((n) => n.part === 'point-labels')) parts.push('point-labels');
    if (body.nodes.some((n) => n.part === 'y-axis-2')) parts.push('y-axis-2');
    if (p.guides.x) parts.push('x-axis');
    if (p.guides.legend && body.nodes.some((n) => n.part === 'legend')) parts.push('legend');
    keyTo('ramp', p.guides.ramp);
    keyTo('size', p.guides.size);
    unitKeyed();
  } else if (p.layout === 'matrix') {
    body = sceneMatrix(catalog, p.layers, result);
    if (p.guides.y && body.nodes.some((n) => n.part === 'y-axis')) parts.push('y-axis');   // one row of cells has no label down its side
    parts.push('plot');
    if (p.guides.pointLabels && body.nodes.some((n) => n.part === 'point-labels')) parts.push('point-labels');
    if (p.guides.x) parts.push('x-axis');
    keyTo('ramp', p.guides.ramp);
    keyTo('size', p.guides.size);
  } else if (p.layout === 'rows') {
    if (p.guides.columns) parts.push('columns');
    parts.push('rows');
    body = sceneRows(catalog, p.layers, result, !!p.guides.legend);
    if (body.nodes.some((n) => n.part === 'track')) parts.push('track');
    unitKeyed();
    // The key to a divided row's series, under the rows.
    if (body.series && p.guides.legend) parts.push('legend');
  } else if (p.layout === 'band') {
    // A unit there is a grid of cells in the band's part, where a bar is the band itself.
    const unit = p.layers.findIndex((l) => l.mark === 'unit');
    body = unit < 0 ? sceneBand(catalog, p.layers[0]!, result.rows, result.totals) : sceneGrid(catalog, p.layers[unit]!, layerKeys(p.layers)[unit]!, result);
    parts.push('band');
    unitKeyed();
    if (p.guides.legend) parts.push('legend');
  } else if (p.layout === 'radial') {
    body = sceneRadial(catalog, p.layers, q, result, !!p.guides.legend);
    parts.push('radial');
    // A number above the circle is not said again inside it.
    if (!parts.includes('number') && body.nodes.some((n) => n.part === 'hole')) parts.push('hole');
    if (p.guides.rim && body.nodes.some((n) => n.part === 'rim')) parts.push('rim');
    unitKeyed();
    if (p.guides.legend) parts.push('legend');
  } else if (customMarks().has(p.layout)) {
    // A custom mark builds its own scene, and says which of its parts the plan shows.
    // What lies over it is the plot's, at the places the mark offers: its own layers are all its scene is handed.
    const mark = customMarks().get(p.layout)!, view = { layers: p.layers.filter((l) => l.mark === p.layout), guides: p.guides, query: q, result, catalog };
    const { parts: own, ...rest } = mark.scene(view), over = sceneOver(p.layers, p.layout, mark, view);
    parts.push(...own);
    body = { ...rest, nodes: rest.nodes.concat(over) };
    if (p.guides.pointLabels && over.some((n) => n.part === 'point-labels')) parts.push('point-labels');
  }
  return { layout: p.layout, parts, ...body, nodes: number.concat(body.nodes) };
}
