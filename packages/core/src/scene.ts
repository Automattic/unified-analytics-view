import { max, sum } from 'd3-array';
import { scaleBand, scaleLinear, scalePoint } from 'd3-scale';
import { CHAR_W, delta, fmt, fmtDay, fmtPct } from './format.ts';
import { pathD } from './path.ts';
import type { Catalog, Guides, Layer, Part, PathNode, PlanShape, Query, Result, Role, Row, Scene, SceneNode } from './types.ts';

/* Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a part, a paint token (never a colour) and a layer: "data" or "guide".
 * Nothing here is in pixels: positions are ratios of the part's box. */
type Body = Pick<Scene, 'nodes' | 'rows' | 'scale'>;

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

// A dimension on x, a metric on y: line, area, bar, rule.
function sceneCartesian(catalog: Catalog, layers: Layer[], guides: Guides, rows: Row[]): Body {
  const nodes: SceneNode[] = [];
  const xField = layers.map((l) => l.encode && l.encode.x).find((f) => isDim(catalog, f)) as string;
  const keys = rows.map((r) => r[xField] as string);
  const isTime = catalog.dimensions[xField]!.type === 'time';
  const scale = layers.some((l) => l.mark === 'bar') ? 'band' : 'point';
  const yField = (l: Layer) => (l.series === 'previous' ? l.encode!.y + '@previous' : (l.encode!.y as string));
  const yVals: number[] = [];
  layers.forEach((l) => {
    const y = l.encode && l.encode.y;
    if (typeof y === 'number') yVals.push(y);
    else if (y) rows.forEach((r) => { const v = r[yField(l)]; if (v != null) yVals.push(v as number); });
  });
  // Always rounded to 4 ticks: a scene with no size cannot pick a tick count by height.
  const y = scaleLinear().domain([0, max(yVals) || 1]);
  if (guides.y) y.nice(4);
  const top = y.domain()[1]!, v = (n: number) => n / top;
  const unit = xScale(keys, scale, 0, 1);

  const coarse = y.ticks(2);
  if (guides.y) y.ticks(4).forEach((t) => {
    // A short plot keeps the ticks a count of 2 would give on this scale. The rest are ranked, to be given up there.
    const rank = coarse.includes(t) ? {} : { rank: 1 };
    if (guides.grid) nodes.push({ key: 'grid:' + t, part: 'plot', kind: 'line', t: v(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide', ...rank });
    nodes.push({ key: 'ytick:' + t, part: 'y-axis', kind: 'text', t: v(t), text: fmt(t, true), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide', ...rank });
  });
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
  const ids = layerKeys(layers);
  layers.forEach((l, i) => {
    const id = ids[i]!, prev = l.series === 'previous', role = roleOf(l);
    const paint = l.paint || (prev ? 'compare' : 'series.1');
    if (l.mark === 'line' || l.mark === 'area') {
      const f = yField(l), pts = rows.filter((r) => r[f] != null);
      const whole = pts.filter((r) => prev || !r.partial);
      if (!whole.length) return;
      const k = (r: Row) => r[xField] as string;
      const points = (rs: Row[]): PathNode['points'] => rs.map((r) => ({ row: k(r), x: unit.cx(k(r)), v: v(num(r, f)) }));
      if (l.mark === 'area') {
        nodes.push({ key: id, part: 'plot', kind: 'path', d: pathD(points(whole), 'monotone', true), points: points(whole), curve: 'monotone', fill: true, paint, opacity: 0.14, layer: 'data', role });
      } else {
        nodes.push({ key: id, part: 'plot', kind: 'path', d: pathD(points(whole), 'monotone'), points: points(whole), curve: 'monotone', paint, width: prev ? 1.5 : 2, dash: prev ? '3 3' : null, layer: 'data', role });
        const tail = prev ? [] : [whole[whole.length - 1]!].concat(pts.filter((r) => r.partial));
        if (tail.length > 1) nodes.push({ key: id + ':partial', part: 'plot', kind: 'path', d: pathD(points(tail)), points: points(tail), paint, width: 2, dash: '2 4', opacity: 0.75, layer: 'data', role, note: 'incomplete bucket' });
      }
    } else if (l.mark === 'bar') {
      const f = yField(l);
      rows.forEach((r) => {
        if (r[f] == null) return;
        nodes.push({ key: id + ':' + r[xField], part: 'plot', kind: 'rect', x: unit.x(r[xField] as string), w: unit.w, v: v(num(r, f)), row: r[xField] as string,
          paint, opacity: r.partial && !prev ? 0.4 : 1, layer: 'data', role });
      });
    } else if (l.mark === 'rule') {
      const t = v(l.encode!.y as number);
      nodes.push({ key: id, part: 'plot', kind: 'line', t, paint: 'rule', dash: '5 3', width: 1.5, layer: 'data', role });
      if (l.label) nodes.push({ key: id + ':label', part: 'plot', kind: 'text', t, text: l.label, anchor: 'end', font: 'tick', paint: 'rule', halo: true, layer: 'guide', role });
    } else {
      throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use line, area, bar or rule.');
    }
  });
  return { nodes, rows: keys, scale };
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

// No positional dimension: one band, stacked and normalized, split by colour.
function sceneBand(layer: Layer, rows: Row[]): Body {
  const nodes: SceneNode[] = [], m = layer.encode!.x as string, dim = layer.encode!.color as string;
  const total = sum(rows, (r) => num(r, m)) || 1, k = (r: Row) => r[dim] as string;
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
    note = share ? rows[0]![by] + ' ' + fmtPct(num(rows[0]!, m) / (sum(rows, (r) => num(r, m)) || 1)) : 'Top: ' + rows[0]![by];
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
    if (p.guides.y) parts.push('y-axis');
    parts.push('plot');
    if (p.guides.x) parts.push('x-axis');
    body = sceneCartesian(catalog, p.layers, p.guides, result.rows);
  } else if (p.layout === 'rows') {
    parts.push('rows');
    body = sceneRows(catalog, p.layers, result.rows.slice(0, p.rowLimit || result.rows.length));
  } else if (p.layout === 'band') {
    parts.push('band');
    if (p.guides.legend) parts.push(p.guides.legend === 'top' ? 'legend-top' : 'legend');
    body = sceneBand(p.layers[0]!, result.rows);
  }
  return { layout: p.layout, parts, ...(side && { side }), ...body, nodes: number.concat(body.nodes) };
}
