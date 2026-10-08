import { max, min } from 'd3-array';
import { scaleBand, scaleLinear, scalePoint } from 'd3-scale';
import { CHAR_W, delta, fmt, fmtDay, fmtPct } from './format.ts';
import { pathD } from './path.ts';
import { leader } from './prose.ts';
import type { Catalog, Guides, Layer, Mark, Part, PathNode, PlanShape, Query, Result, Role, Row, Scene, SceneNode } from './types.ts';

/* Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a part, a paint token (never a colour) and a layer: "data" or "guide".
 * Nothing here is in pixels: positions are ratios of the part's box. */
type Body = Pick<Scene, 'nodes' | 'rows' | 'series' | 'scale'>;

const num = (r: Row, f: string) => r[f] as number;
/** The role a layer plays: the one it states, or the one its mark and series imply. */
export function roleOf(l: Layer): Role {
  return l.role || (l.series === 'previous' ? 'comparison' : l.mark === 'rule' ? 'reference' : 'primary');
}
/* A layer's key names it by role and mark, and does not count the layers before it, so it holds when another layer
 * drops. Two layers of one role and mark are told apart by a count among themselves alone: `primary:text`, then
 * `primary:text#2`. Layers of the previous series are counted last. A reduction drops whole roles, and missing prior
 * data drops the whole previous series, so neither can move a count. */
function layerKeys(layers: Layer[]): string[] {
  const seen: Record<string, number> = {}, keys: string[] = [];
  for (const prev of [false, true]) layers.forEach((l, i) => {
    if ((l.series === 'previous') !== prev) return;
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
  unit: ReturnType<typeof xScale>;
  /** A value on y, as a ratio of the plot's height. */
  v: (n: number) => number;
  /** Where a row's mark starts and where it ends, as ratios: from the baseline, or from the series stacked under it. */
  ends: (r: Row) => [number, number];
  /** A bar's place among those beside it at one x: which, of how many. */
  slot?: [number, number];
}
type MarkFn = (l: Layer, d: Draw) => SceneNode[];

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
const bar: MarkFn = (_l, { id, series, role, paint, prev, rows, k, unit, ends, slot: [j, n] = [0, 1] }) => rows.map((r) => {
  const [v0, v] = ends(r), w = unit.w / n;
  return { key: id + ':' + k(r) + (series == null ? '' : ':' + series), part: 'plot', kind: 'rect', x: unit.x(k(r)) + j * w, w, v, ...(v0 && { v0 }), row: k(r), ...(series != null && { series }),
    paint, opacity: r.partial && !prev ? 0.4 : 1, layer: 'data', role };
});
const rule: MarkFn = (l, { id, role, v }) => {
  const t = v(l.encode!.y as number);
  const nodes: SceneNode[] = [{ key: id, part: 'plot', kind: 'line', t, paint: 'rule', dash: '5 3', width: 1.5, layer: 'data', role }];
  if (l.label) nodes.push({ key: id + ':label', part: 'plot', kind: 'text', t, text: l.label, anchor: 'end', font: 'tick', paint: 'rule', halo: true, layer: 'guide', role });
  return nodes;
};
/* The marks a plot draws, by name. A new mark is a function here. */
const PLOT_MARKS: Partial<Record<Mark, MarkFn>> = { line: path, area: path, bar, rule };

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
function sceneCartesian(catalog: Catalog, layers: Layer[], guides: Guides, result: Result): Body {
  const nodes: SceneNode[] = [], rows = result.rows;
  const xField = xDimOf(catalog, layers)!;
  const k = (r: Row) => r[xField] as string, keys = [...new Set(rows.map(k))];
  // A view has two dimensions at most and one is on x, so there is one to split by. Its order is the engine's, not the rows':
  // paint follows it, so a value keeps its colour when the ranking moves.
  const split = layers.map((l) => splitOf(catalog, l, xField)).find(Boolean) || null;
  const series = split ? [...new Set(((result.totalsBy && result.totalsBy[split]) || rows).map((r) => r[split] as string))] : [];
  if (series.length > SERIES) throw new Error('Splitting by "' + split + '" makes ' + series.length + ' series, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');
  const isTime = catalog.dimensions[xField]!.type === 'time';
  const scale = layers.some((l) => l.mark === 'bar') ? 'band' : 'point';
  const yField = (l: Layer) => (l.series === 'previous' ? l.encode!.y + '@previous' : (l.encode!.y as string));
  // Where each row's mark starts and ends, in its metric's own terms: from zero, or from the series stacked under it.
  // A stack runs in the series' order, the first at the bottom, and a value below zero stacks downward.
  // Normalized, each is a share of the engine's total for its x, so with a `limit` a stack stops short of the top.
  const whole = new Map(((result.totalsBy && result.totalsBy[xField]) || []).map((r) => [k(r), r]));
  const spans = layers.map((l) => {
    const out = new Map<Row, [number, number]>();
    if (typeof (l.encode && l.encode.y) !== 'string') return out;
    const f = yField(l), share = l.stack === 'normalize';
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
  const unit = xScale(keys, scale, 0, 1);

  if (guides.y) scales.forEach(({ v, ticks, coarse, text }, ui) => ticks.forEach((t) => {
    // A short plot keeps the ticks a count of 2 would give on this scale. The rest are ranked, to be given up there.
    const rank = coarse.includes(t) ? {} : { rank: 1 };
    // The second scale's ticks are on the far side, keyed by its unit. The grid is the first scale's alone.
    if (ui) { if (guides.y2) nodes.push({ key: 'ytick:' + units[ui] + ':' + t, part: 'y-axis-2', kind: 'text', t: v(t), text: text(t), anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank }); return; }
    if (guides.grid) nodes.push({ key: 'grid:' + t, part: 'plot', kind: 'line', t: v(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide', ...rank });
    nodes.push({ key: 'ytick:' + t, part: 'y-axis', kind: 'text', t: v(t), text: text(t), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank });
  }));
  if (guides.x && keys.length) {
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
    if (!draw) throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use line, area, bar or rule.');
    const v = scaleOf(l).v;
    const d: Draw = { id: ids[i]!, role: roleOf(l), paint: l.paint || (prev ? 'compare' : 'series.1'), prev, rows: rows.filter((r) => span.has(r)), k, unit, v,
      ends: (r) => { const [lo, hi] = span.get(r)!; return [v(lo), v(hi)]; } };
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
    // A label sits beside the plot at the height its line ends. ponytail: two lines that end close have labels that
    // collide. Nothing moves them apart yet (reference, Open 5).
    series.forEach((s, j) => {
      if (ends.has(s)) nodes.push({ key: 'label:' + s, part: 'labels', kind: 'text', series: s, t: ends.get(s)!, text: s, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'series.' + (j + 1), layer: 'guide' });
    });
    series.forEach((s, j) => {
      nodes.push({ key: 'swatch:' + s, part: 'legend', kind: 'rect', series: s, paint: 'series.' + (j + 1), layer: 'data' });
      nodes.push({ key: 'legend:' + s, part: 'legend', kind: 'text', series: s, text: s, anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' });
    });
  }
  return { nodes, rows: keys, ...(split && { series }), scale };
}

/** Room the widest value label needs in a bar list. */
export function valueRoomOf(catalog: Catalog, layers: Layer[], rows: Row[]): number {
  let room = 0;
  layers.forEach((l) => {
    const f = l.encode && l.encode.text;
    if (l.mark === 'text' && typeof f === 'string' && f in catalog.metrics) room = Math.max(room, (max(rows, (r) => fmt(num(r, f)).length) || 0) * CHAR_W + 14);
  });
  return room;
}

// A dimension on y, a metric on x: the ranked bar list.
function sceneRows(catalog: Catalog, layers: Layer[], rows: Row[]): Body {
  const nodes: SceneNode[] = [];
  const dim = layers.map((l) => l.encode && l.encode.y).find((f) => isDim(catalog, f)) as string;
  const barL = layers.find((l) => l.mark === 'bar');
  const top = barL ? max(rows, (r) => num(r, barL.encode!.x as string)) || 1 : 1, ids = layerKeys(layers);
  rows.forEach((r) => {
    const k = r[dim] as string;
    layers.forEach((l, li) => {
      if (l.mark === 'bar') {
        nodes.push({ key: ids[li] + ':' + k, part: 'rows', kind: 'rect', v: num(r, l.encode!.x as string) / top, row: k, paint: l.paint || 'series.1', opacity: 0.2, layer: 'data', role: roleOf(l) });
      } else if (l.mark === 'text') {
        const f = l.encode!.text as string, metric = f in catalog.metrics;
        nodes.push({ key: ids[li] + ':' + k, part: 'rows', kind: 'text', row: k, text: metric ? fmt(num(r, f)) : String(r[f]),
          anchor: l.align === 'end' ? 'end' : 'start', baseline: 'middle', font: metric ? 'value' : 'label', paint: 'ink', layer: 'data', role: roleOf(l) });
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
  // Both legends, each in its own part. The plan names one in `parts`; a fit rule swaps them.
  rows.forEach((r, i) => {
    nodes.push({ key: 'swatch:' + k(r), part: 'legend', kind: 'rect', row: k(r), paint: 'series.' + ((i % 6) + 1), layer: 'data' });
    nodes.push({ key: 'legend:' + k(r), part: 'legend', kind: 'text', row: k(r), text: String(k(r)), anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' });
    nodes.push({ key: 'share:' + k(r), part: 'legend', kind: 'text', row: k(r), text: fmtPct(num(r, m) / total), anchor: 'end', baseline: 'middle', font: 'value', paint: 'ink', layer: 'guide' });
  });
  // One line for the whole band, so it names no row.
  if (rows.length) nodes.push({ key: 'legend:top', part: 'legend-top', kind: 'text', text: k(rows[0]!) + ' ' + fmtPct(num(rows[0]!, m) / total), anchor: 'start', font: 'label', paint: 'ink', layer: 'guide' });
  return { nodes, rows: rows.map(k) };
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
  let note: string | null = M.rangeTotal === 'sum of daily' ? 'Sum of daily counts' : null;
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
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
    body = sceneCartesian(catalog, p.layers, p.guides, result);
    const key = body.series ? p.guides.legend : undefined;                 // layers that were split may have been given up
    if (p.guides.y) parts.push('y-axis');
    parts.push('plot');
    if (body.nodes.some((n) => n.part === 'y-axis-2')) parts.push('y-axis-2');
    if (key === 'labels') parts.push('labels');
    if (p.guides.x) parts.push('x-axis');
    if (key === 'full') parts.push('legend');
  } else if (p.layout === 'rows') {
    parts.push('rows');
    body = sceneRows(catalog, p.layers, result.rows.slice(0, p.rowLimit || result.rows.length));
  } else if (p.layout === 'band') {
    parts.push('band');
    if (p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
    body = sceneBand(p.layers[0]!, result.rows, result.totals);
  }
  return { layout: p.layout, parts, ...(side && { side }), ...body, nodes: number.concat(body.nodes) };
}
