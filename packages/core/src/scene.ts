import { max, sum } from 'd3-array';
import { scaleBand, scaleLinear, scalePoint } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { CHAR_W, clip, delta, fmt, fmtDay, fmtPct, type Delta } from './format.ts';
import type { Catalog, Guides, Host, Layer, PlanShape, Query, Result, Row, Scene, SceneNode } from './types.ts';

/* Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a paint token (never a colour) and a layer: "data" or "guide". */
interface Part { nodes: SceneNode[]; height: number }

const num = (r: Row, f: string) => r[f] as number;
export function isDim(catalog: Catalog, f: unknown): f is string { return typeof f === 'string' && f in catalog.dimensions; }
function shift(nodes: SceneNode[], dx: number, dy: number): SceneNode[] {
  nodes.forEach((n) => { n.tx = (n.tx || 0) + dx; n.ty = (n.ty || 0) + dy; });
  return nodes;
}

// A dimension on x, a metric on y: line, area, bar, rule.
function sceneCartesian(catalog: Catalog, layers: Layer[], guides: Guides, rows: Row[], W: number, H: number): Part {
  const nodes: SceneNode[] = [];
  const xField = layers.map((l) => l.encode && l.encode.x).find((f) => isDim(catalog, f)) as string;
  const keys = rows.map((r) => r[xField] as string);
  const isTime = catalog.dimensions[xField]!.type === 'time';
  const hasBar = layers.some((l) => l.mark === 'bar');
  const yField = (l: Layer) => (l.series === 'previous' ? l.encode!.y + '@previous' : (l.encode!.y as string));
  const yVals: number[] = [];
  layers.forEach((l) => {
    const y = l.encode && l.encode.y;
    if (typeof y === 'number') yVals.push(y);
    else if (y) rows.forEach((r) => { const v = r[yField(l)]; if (v != null) yVals.push(v as number); });
  });
  const nTicks = H < 120 ? 2 : 4;
  const ml = guides.y ? 36 : 1, mr = guides.y ? 6 : 1, mt = guides.y ? 10 : 3, mb = guides.x ? 22 : 3;
  const y = scaleLinear().domain([0, max(yVals) || 1]).range([H - mb, mt]);
  if (guides.y) y.nice(nTicks);
  const band = scaleBand<string>().domain(keys).range([ml, W - mr]).paddingInner(0.26).paddingOuter(0.1);
  const point = scalePoint<string>().domain(keys).range([ml + 2, W - mr - 2]);
  const x = (k: string) => (hasBar ? band(k) : point(k)) as number;
  const bw = hasBar ? band.bandwidth() : 0;
  const cx = (k: string) => x(k) + bw / 2;

  if (guides.y) y.ticks(nTicks).forEach((t) => {
    if (guides.grid) nodes.push({ key: 'grid:' + t, kind: 'line', x1: ml, x2: W - mr, y1: y(t), y2: y(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide' });
    nodes.push({ key: 'ytick:' + t, kind: 'text', x: ml - 6, y: y(t), text: fmt(t, true), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
  });
  if (guides.x && keys.length) {
    const last = keys.length - 1;
    const idx = isTime ? (W < 380 || last < 2 ? [0, last] : [0, Math.floor(last / 2), last]) : keys.map((_, i) => i);
    idx.forEach((i, j) => {
      nodes.push({ key: 'xtick:' + keys[i], kind: 'text', x: cx(keys[i]!), y: H - 5, text: isTime ? fmtDay(keys[i]!) : String(keys[i]),
        anchor: !isTime ? 'middle' : j === 0 ? 'start' : j === idx.length - 1 ? 'end' : 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    });
  }
  layers.forEach((l, i) => {
    const id = 'L' + i + ':' + l.mark, prev = l.series === 'previous';
    const paint = l.paint || (prev ? 'compare' : 'series.1');
    if (l.mark === 'line' || l.mark === 'area') {
      const f = yField(l), pts = rows.filter((r) => r[f] != null);
      const whole = pts.filter((r) => prev || !r.partial);
      if (!whole.length) return;
      const px = (r: Row) => cx(r[xField] as string), py = (r: Row) => y(num(r, f));
      if (l.mark === 'area') {
        nodes.push({ key: id, kind: 'path', d: area<Row>().x(px).y0(y(0)).y1(py).curve(curveMonotoneX)(whole), fill: true, paint, opacity: 0.14, layer: 'data' });
      } else {
        nodes.push({ key: id, kind: 'path', d: line<Row>().x(px).y(py).curve(curveMonotoneX)(whole), paint, width: prev ? 1.5 : 2, dash: prev ? '3 3' : null, layer: 'data' });
        const tail = prev ? [] : pts.filter((r) => r.partial);
        if (tail.length) nodes.push({ key: id + ':partial', kind: 'path', d: line<Row>().x(px).y(py)([whole[whole.length - 1]!].concat(tail)), paint, width: 2, dash: '2 4', opacity: 0.75, layer: 'data', note: 'incomplete bucket' });
      }
    } else if (l.mark === 'bar') {
      const f = yField(l);
      rows.forEach((r) => {
        if (r[f] == null) return;
        nodes.push({ key: id + ':' + r[xField], kind: 'rect', x: x(r[xField] as string), y: y(num(r, f)), w: bw, h: Math.max(0, y(0) - y(num(r, f))), rx: Math.min(2, bw / 4),
          paint, opacity: r.partial && !prev ? 0.4 : 1, layer: 'data' });
      });
    } else if (l.mark === 'rule') {
      const v = l.encode!.y as number;
      nodes.push({ key: id, kind: 'line', x1: ml, x2: W - mr, y1: y(v), y2: y(v), paint: 'rule', dash: '5 3', width: 1.5, layer: 'data' });
      if (l.label) nodes.push({ key: id + ':label', kind: 'text', x: W - mr, y: y(v) - 5, text: l.label, anchor: 'end', font: 'tick', paint: 'rule', halo: true, layer: 'guide' });
    } else {
      throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use line, area, bar or rule.');
    }
  });
  return { nodes, height: H };
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
function sceneRows(catalog: Catalog, layers: Layer[], rows: Row[], W: number): Part {
  const nodes: SceneNode[] = [], gap = 4, rowH = 28;
  const dim = layers.map((l) => l.encode && l.encode.y).find((f) => isDim(catalog, f)) as string;
  const barL = layers.find((l) => l.mark === 'bar');
  const x = scaleLinear().domain([0, barL ? max(rows, (r) => num(r, barL.encode!.x as string)) || 1 : 1]).range([0, W]);
  const valueRoom = valueRoomOf(catalog, layers, rows);
  rows.forEach((r, i) => {
    const top = i * (rowH + gap), k = r[dim];
    layers.forEach((l, li) => {
      if (l.mark === 'bar') {
        nodes.push({ key: 'L' + li + ':bar:' + k, kind: 'rect', x: 0, y: top, w: Math.max(3, x(num(r, l.encode!.x as string))), h: rowH, rx: 3, paint: l.paint || 'series.1', opacity: 0.2, layer: 'data' });
      } else if (l.mark === 'text') {
        const f = l.encode!.text as string, metric = f in catalog.metrics, end = l.align === 'end';
        const raw = metric ? fmt(num(r, f)) : String(r[f]);
        nodes.push({ key: 'L' + li + ':text:' + k, kind: 'text', x: end ? W - 8 : 8, y: top + rowH / 2, text: end ? raw : clip(raw, Math.floor((W - 16 - valueRoom) / CHAR_W)),
          anchor: end ? 'end' : 'start', baseline: 'middle', font: metric ? 'value' : 'label', paint: 'ink', layer: 'data' });
      } else {
        throw new Error('The "' + l.mark + '" mark has no rule for rows yet. Use bar or text.');
      }
    });
  });
  return { nodes, height: Math.max(0, rows.length * (rowH + gap) - gap) };
}

// No positional dimension: one band, stacked and normalized, split by colour.
function sceneBand(layer: Layer, rows: Row[], W: number, legend: Guides['legend']): Part {
  const nodes: SceneNode[] = [], m = layer.encode!.x as string, dim = layer.encode!.color as string, barH = 24, gap = 2;
  const total = sum(rows, (r) => num(r, m)) || 1, usable = W - gap * (rows.length - 1);
  let x0 = 0, h = barH;
  rows.forEach((r, i) => {
    const w = (num(r, m) / total) * usable;
    nodes.push({ key: 'seg:' + r[dim], kind: 'rect', x: x0, y: 0, w, h: barH, rx: 2, paint: 'series.' + ((i % 6) + 1), layer: 'data' });
    x0 += w + gap;
  });
  if (legend === 'full') {
    rows.forEach((r, i) => {
      const yy = barH + 20 + i * 24;
      nodes.push({ key: 'swatch:' + r[dim], kind: 'rect', x: 0, y: yy - 6, w: 12, h: 12, rx: 2, paint: 'series.' + ((i % 6) + 1), layer: 'data' });
      nodes.push({ key: 'legend:' + r[dim], kind: 'text', x: 20, y: yy, text: clip(String(r[dim]), Math.floor((W - 70) / CHAR_W)), anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' });
      nodes.push({ key: 'share:' + r[dim], kind: 'text', x: W, y: yy, text: fmtPct(num(r, m) / total), anchor: 'end', baseline: 'middle', font: 'value', paint: 'ink', layer: 'guide' });
      h = yy + 10;
    });
  } else if (legend === 'top' && rows.length) {
    nodes.push({ key: 'legend:top', kind: 'text', x: 0, y: barH + 18, text: clip(rows[0]![dim] + ' ' + fmtPct(num(rows[0]!, m) / total), Math.floor(W / CHAR_W)), anchor: 'start', font: 'label', paint: 'ink', layer: 'guide' });
    h = barH + 24;
  }
  return { nodes, height: h };
}

// One big number, an optional delta and an optional note.
function sceneStat(o: { value: string; delta?: Delta | null; sub?: string | null; W: number; host: Host; pulse?: boolean; small?: boolean }): Part {
  const nodes: SceneNode[] = [], W = o.W, lead = o.pulse != null ? 20 : 0;
  const disp = o.host.display(o.value.length, W - lead, o.small);
  if (o.pulse != null) nodes.push({ key: 'pulse', kind: 'circle', cx: 7, cy: disp.h / 2, r: 5, paint: o.pulse ? 'live' : 'ink.muted', pulse: !!o.pulse, layer: 'data' });
  nodes.push({ key: 'value', kind: 'text', x: lead, y: 0, h: disp.h, cell: disp.cell, text: o.value, anchor: 'start', font: 'display', paint: 'ink', layer: 'data' });
  let yy = disp.h + 18;
  if (o.delta) {
    const long = !o.small && W >= 200 && o.delta.pct != null;
    nodes.push({ key: 'delta', kind: 'text', x: 0, y: yy, text: clip(o.delta.text + (long ? ' on the previous period' : ''), Math.floor(W / CHAR_W)), anchor: 'start', font: 'value', paint: o.delta.paint, layer: 'guide' });
    yy += 18;
  }
  if (o.sub && W >= 120) {
    nodes.push({ key: 'sub', kind: 'text', x: 0, y: yy, text: clip(o.sub, Math.floor(W / (CHAR_W - 0.8))), anchor: 'start', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    yy += 16;
  }
  return { nodes, height: yy - 10 };
}

/** The value shown as the number, formatted. */
export function headValue(catalog: Catalog, q: Query, result: Result, compact?: boolean): string {
  const m = q.metrics[0]!;
  if (catalog.metrics[m]!.instant) return String(result.totals[m] || 0);
  return result.meta.empty ? '0' : fmt(result.totals[m], compact);
}

/** The number: a total from the engine, a delta if the query compares, and a derived note. */
export function headline(catalog: Catalog, q: Query, result: Result, share: boolean, host: Host, W: number, small: boolean): Part {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, by = (q.by || [])[0], rows = result.rows;
  if (M.instant) { const n = t[m] || 0; return sceneStat({ value: String(n), sub: n ? 'on the site right now' : 'Nobody is here right now', W, host, pulse: n > 0, small }); }
  if (result.meta.empty) return sceneStat({ value: '0', sub: 'No visits yet', W, host, small });
  let note: string | null = M.rangeTotal === 'sum of daily' ? 'Sum of daily counts' : null;
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
    note = share ? rows[0]![by] + ' ' + fmtPct(num(rows[0]!, m) / (sum(rows, (r) => num(r, m)) || 1)) : 'Top: ' + rows[0]![by];
  }
  const dl = q.compare === 'previous' ? delta(t[m] as number, t[m + '@previous'], M.polarity) : null;
  return sceneStat({ value: fmt(t[m], small || W < 160), delta: dl, sub: small ? null : note, W, host, small });
}

export function buildScene(p: PlanShape, q: Query, result: Result, host: Host, catalog: Catalog): Scene {
  const W = host.width, H = host.height, rules = host.rules;
  if (p.layout === 'sentence') return { width: W, height: 0, nodes: [], text: p.text };
  let out: Part, plot: Scene['plot'] | null = null;
  if (p.layout === 'none') {
    out = headline(catalog, q, result, p.share, host, W, false);
  } else if (p.layout === 'cartesian' && p.side) {             // a bare plot, set beside the number
    const lw = Math.round(Math.max(host.displayWidth(headValue(catalog, q, result, true).length), Math.min(120, Math.max(76, W * 0.42))));
    const s = headline(catalog, q, result, p.share, host, lw, true), h = Math.max(rules.bare.height, s.height), pw = Math.max(8, W - lw - 12);
    const c = sceneCartesian(catalog, p.layers, p.guides, result.rows, pw, h);
    out = { nodes: s.nodes.concat(shift(c.nodes, lw + 12, 0)), height: h }; plot = { w: pw, h };
  } else {
    const hd = p.headline ? headline(catalog, q, result, p.share, host, W, false) : null, above = hd ? hd.height + 16 : 0;
    let body: Part;
    if (p.layout === 'notice') {
      const h = H ? Math.max(40, Math.min(120, H - above)) : 120;
      body = { height: h, nodes: [{ key: 'notice', kind: 'text', x: W / 2, y: h / 2, text: clip('No visits in this period yet', Math.floor(W / CHAR_W)), anchor: 'middle', baseline: 'middle', font: 'label', paint: 'ink.muted', layer: 'guide' }] };
    } else if (p.layout === 'cartesian') {
      const guided = p.guides.x || p.guides.y;
      const ph = !guided ? rules.bare.height : H ? Math.max(rules.axes.minHeight, Math.min(rules.axes.height, H - above)) : rules.axes.height;
      body = sceneCartesian(catalog, p.layers, p.guides, result.rows, W, ph); plot = { w: W, h: ph };
    } else if (p.layout === 'rows') {
      body = sceneRows(catalog, p.layers, result.rows.slice(0, p.rowLimit || result.rows.length), W);
    } else {
      body = sceneBand(p.layers[0]!, result.rows, W, p.guides.legend);
    }
    out = hd ? { nodes: hd.nodes.concat(shift(body.nodes, 0, above)), height: above + body.height } : body;
  }
  const scene: Scene = { width: W, height: Math.ceil(out.height), nodes: out.nodes };
  if (plot) scene.plot = plot;
  return scene;
}
