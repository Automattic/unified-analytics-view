import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import { CHAR_W, clip } from './format.ts';
import { applies, ruleFor } from './fit.ts';
import { xScale } from './scene.ts';
import type { Container, PathNode, PlacedNode, PlacedRect, PlacedScene, PlacedText, RectNode, Scene, SceneNode, TextNode } from './types.ts';

/* place() turns the ratio scene into pixels, for painters with no CSS: the dot
 * grid, canvas and the bench's SVG. What the DOM leaves to its stylesheet is a
 * constant here: gutters, row heights, character widths, and the room below
 * which ranked nodes go. Placed nodes drop `part`, `role`, `row` and `rank`. */
interface Block { nodes: PlacedNode[]; height: number }
type Point = PathNode['points'][number];

const SHORT_PLOT = 120;   // px of plot height under which ranked y ticks go

const rect = ({ part, role, row, rank, x: _x, w: _w, v, ...n }: RectNode, x: number, y: number, w: number, h: number, rx: number): PlacedRect => ({ ...n, x, y, w, h, rx });
const text = ({ part, role, row, rank, x: _x, t, short, ...n }: TextNode, x: number, y: number, s: string = n.text): PlacedText => ({ ...n, x, y, text: s });
const fit = (s: string, room: number) => clip(s, Math.floor(room / CHAR_W));
function shift(nodes: PlacedNode[], dx: number, dy: number): PlacedNode[] {
  nodes.forEach((n) => { n.tx = (n.tx || 0) + dx; n.ty = (n.ty || 0) + dy; });
  return nodes;
}

// One big number, an optional delta and an optional note.
function placeNumber(nodes: SceneNode[], W: number, container: Container, small: boolean): Block {
  const out: PlacedNode[] = [], pulse = nodes.find((n) => n.kind === 'circle'), lead = pulse ? 20 : 0;
  const face = (font: TextNode['font']) => nodes.find((n): n is TextNode => n.kind === 'text' && n.font === font);
  const value = face('display')!, dl = face('value'), sub = face('tick');
  const shown = small || W < 160 ? value.short ?? value.text : value.text;
  const disp = container.display(shown.length, W - lead, small);
  if (pulse) out.push({ key: pulse.key, kind: 'circle', cx: 7, cy: disp.h / 2, r: 5, paint: pulse.paint, pulse: pulse.pulse, layer: pulse.layer });
  out.push({ ...text(value, lead, 0, shown), h: disp.h, cell: disp.cell });
  let yy = disp.h + 18;
  if (dl) {
    out.push(text(dl, 0, yy, fit(!small && W >= 200 ? dl.text : dl.short ?? dl.text, W)));
    yy += 18;
  }
  if (sub && W >= 120 && !(small && sub.rank)) {
    out.push(text(sub, 0, yy, clip(sub.text, Math.floor(W / (CHAR_W - 0.8)))));
    yy += 16;
  }
  return { nodes: out, height: yy - 10 };
}

// The plot with its axes. The gutters for the tick labels are constants. `narrow` is the `mid-tick` rule's verdict on the view.
function placePlot(scene: Scene, W: number, H: number, narrow: boolean): PlacedNode[] {
  const gy = scene.parts.includes('y-axis'), gx = scene.parts.includes('x-axis');
  const ml = gy ? 36 : 1, mr = gy ? 6 : 1, mt = gy ? 10 : 3, mb = gx ? 22 : 3, inset = scene.scale === 'point' ? 2 : 0;
  const y = scaleLinear().domain([0, 1]).range([H - mb, mt]);
  const xs = xScale(scene.rows!, scene.scale!, ml + inset, W - mr - inset);
  const px = (p: Point) => xs.cx(p.row), py = (p: Point) => y(p.v);
  const out: PlacedNode[] = [];
  scene.nodes.forEach((n) => {
    if (n.part === 'number') return;
    if (n.rank && (n.part === 'x-axis' ? narrow : H < SHORT_PLOT)) return;
    if (n.kind === 'line') {
      const { part, role, row, rank, t, ...rest } = n;
      out.push({ ...rest, x1: ml, x2: W - mr, y1: y(t), y2: y(t) });
    } else if (n.kind === 'path') {
      const { part, role, row, rank, points, curve, ...rest } = n;
      const d = n.fill ? area<Point>().x(px).y0(y(0)).y1(py) : line<Point>().x(px).y(py);
      if (curve) d.curve(curveMonotoneX);
      out.push({ ...rest, d: d(points) });
    } else if (n.kind === 'rect') {
      out.push(rect(n, xs.x(n.row!), y(n.v!), xs.w, Math.max(0, y(0) - y(n.v!)), Math.min(2, xs.w / 4)));
    } else if (n.kind === 'text') {
      out.push(n.part === 'y-axis' ? text(n, ml - 6, y(n.t!)) : n.part === 'x-axis' ? text(n, xs.cx(n.row!), H - 5) : text(n, W - mr, y(n.t!) - 5));
    }
  });
  return out;
}

// The ranked bar list: rows of a fixed height, labels clipped by character width.
function placeRows(scene: Scene, W: number): Block {
  const rowH = 28, gap = 4, rows = scene.rows!, x = scaleLinear().domain([0, 1]).range([0, W]);
  const values = scene.nodes.filter((n): n is TextNode => n.part === 'rows' && n.kind === 'text' && n.font === 'value');
  const valueRoom = values.length ? Math.max(...values.map((n) => n.text.length)) * CHAR_W + 14 : 0;
  const nodes: PlacedNode[] = [];
  scene.nodes.forEach((n) => {
    if (n.part !== 'rows') return;
    const top = rows.indexOf(n.row!) * (rowH + gap);
    if (n.kind === 'rect') nodes.push(rect(n, 0, top, Math.max(3, x(n.v!)), rowH, 3));
    else if (n.kind === 'text') nodes.push(n.anchor === 'end' ? text(n, W - 8, top + rowH / 2) : text(n, 8, top + rowH / 2, fit(n.text, W - 16 - valueRoom)));
  });
  return { nodes, height: Math.max(0, rows.length * (rowH + gap) - gap) };
}

// One band and its legend.
function placeBand(scene: Scene, W: number): Block {
  const barH = 24, gap = 2, rows = scene.rows!, usable = W - gap * (rows.length - 1);
  const nodes: PlacedNode[] = [];
  let x0 = 0, h = barH;
  scene.nodes.forEach((n) => {
    if (n.part === 'band' && n.kind === 'rect') {
      const w = n.v! * usable;
      nodes.push(rect(n, x0, 0, w, barH, 2));
      x0 += w + gap;
    } else if (n.part === 'legend' && n.kind === 'text' && n.row == null) {      // the one-line legend
      nodes.push(text(n, 0, barH + 18, fit(n.text, W)));
      h = barH + 24;
    } else if (n.part === 'legend') {
      const yy = barH + 20 + rows.indexOf(n.row!) * 24;
      if (n.kind === 'rect') nodes.push(rect(n, 0, yy - 6, 12, 12, 2));
      else if (n.kind === 'text') nodes.push(n.anchor === 'end' ? text(n, W, yy) : text(n, 20, yy, fit(n.text, W - 70)));
      h = yy + 10;
    }
  });
  return { nodes, height: h };
}

/** The pixel scene for a container: the ratio scene, placed at its size. Pure. */
export function place(scene: Scene, container: Container): PlacedScene {
  const W = container.width, H = container.height, rules = container.rules;
  if (scene.layout === 'prose') return { width: W, height: 0, nodes: [], text: scene.text };
  const number = (w: number, small: boolean) => placeNumber(scene.nodes.filter((n) => n.part === 'number'), w, container, small);
  // What resolve() reports as dropped is what is left out here: both ask the same rule.
  const midTick = ruleFor(rules.fit, 'cartesian', 'mid-tick'), narrow = !!midTick && applies(midTick, { view: { inline: W } });
  let out: Block, plot: PlacedScene['plot'] | null = null;
  if (scene.layout === 'none') {
    out = number(W, false);
  } else if (scene.side) {                                     // a bare plot, set beside the number
    const value = scene.nodes.find((n): n is TextNode => n.kind === 'text' && n.font === 'display')!;
    const lw = Math.round(Math.max(container.displayWidth((value.short ?? value.text).length), Math.min(120, Math.max(rules.bare.numberWidth, W * 0.42))));
    const s = number(lw, true), h = Math.max(rules.bare.height, s.height), pw = Math.max(8, W - lw - 12);
    out = { nodes: s.nodes.concat(shift(placePlot(scene, pw, h, narrow), lw + 12, 0)), height: h }; plot = { w: pw, h };
  } else {
    const hd = scene.parts.includes('number') ? number(W, false) : null, above = hd ? hd.height + 16 : 0;
    let body: Block;
    if (scene.layout === 'notice') {
      // The least a notice is built to is its rule's block need. With no rule it has no least.
      const least = ruleFor(rules.fit, 'notice', 'notice')?.needs.block ?? 0, h = H ? Math.max(least, Math.min(120, H - above)) : 120;
      body = { height: h, nodes: scene.nodes.filter((n): n is TextNode => n.part === 'notice' && n.kind === 'text').map((n) => text(n, W / 2, h / 2, fit(n.text, W))) };
    } else if (scene.layout === 'cartesian') {
      const guided = scene.parts.includes('x-axis') || scene.parts.includes('y-axis');
      const ph = !guided ? rules.bare.height : H ? Math.max(rules.axes.minHeight, Math.min(rules.axes.height, H - above)) : rules.axes.height;
      body = { nodes: placePlot(scene, W, ph, narrow), height: ph }; plot = { w: W, h: ph };
    } else if (scene.layout === 'rows') {
      body = placeRows(scene, W);
    } else {
      body = placeBand(scene, W);
    }
    out = hd ? { nodes: hd.nodes.concat(shift(body.nodes, 0, above)), height: above + body.height } : body;
  }
  const placed: PlacedScene = { width: W, height: Math.ceil(out.height), nodes: out.nodes };
  if (plot) placed.plot = plot;
  return placed;
}
