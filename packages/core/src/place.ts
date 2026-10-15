import { scaleLinear } from 'd3-scale';
import { CHAR_W, clip } from './format.ts';
import { applies, ruleFor } from './fit.ts';
import { customMarks } from './marks.ts';
import { arcD, pathD } from './path.ts';
import { SIZES, TICK_W, xScale } from './scene.ts';
import type { CircleNode, Container, Part, PathNode, PlacedCircle, PlacedNode, PlacedRect, PlacedScene, PlacedText, RectNode, Scene, SceneNode, TextNode } from './types.ts';

/* place() turns the ratio scene into pixels, for painters with no CSS: the dot
 * grid, canvas and the bench's SVG. What the DOM leaves to its stylesheet is a
 * constant here: gutters, row heights, character widths, and the room below
 * which ranked nodes go. Placed nodes drop `part`, `role`, `row`, `series`, `pair` and `rank`. */
interface Block { nodes: PlacedNode[]; height: number }
type Point = PathNode['points'][number];

export const SHORT_PLOT = 120;   // px of plot height under which ranked y ticks go
const LABEL = 14;         // characters a label at a line's end is given before it is clipped
const LABEL_LINE = 12;    // px from one such label to the next
const RADIAL = 160;       // px across a circle of arcs that has room to spare
const RIM = 14;           // px a circle gives up all round to the labels at its rim: a line of them
const SEATS = 240;        // px across a half circle of seats that has: a seat of a hundred is then 11 px, and
export const SEATS_LEAST = 160;  // the least it is built to: a seat of 7. Under that the legend gives way before the seats do
const GRID = 160;         // px across a unit's grid of a hundred that has room to spare, and
export const GRID_LEAST = 100;   // the least it is built to: a cell of 9 px, a hairline apart
export const NUMBER_SHORT = 160;  // px of width under which the number takes its short form
export const DELTA_FULL = 200;    // px of width the delta's long form needs
export const NOTE_LEAST = 120;    // px of width under which the number's note goes
export const POINT_INSET = 2;     // px a point scale puts its first and last marks inside the plot
export const NOTICE_HEIGHT = 120; // px a notice is tall where it is not held shorter
/** The line a unit's key takes under its glyphs, in px. */
export const UNIT_KEY_BLOCK = 20;
/** A dot's radius in px: by its size step, or the one size of a dot that has none. */
export const radius = (size?: number) => (size ? 2 + 2.5 * size : 3);
/** The radius of a unit's glyph in px, from the room it has across and up: the largest circle that holds, a hairline clear of the next. */
export const glyphRadius = (w: number, h: number) => Math.max(1, Math.min(w, h) - 1) / 2;

/** A label's box, and its rank: a ranked label is given up before an unranked one, and the higher its rank the sooner. */
export interface LabelBox { x: number; y: number; w: number; h: number; rank?: number | undefined }
/** Which labels to give up so that no two are closer than `gap`. They are taken in order of rank, and one that would
 * meet a label already kept goes. For any painter that has measured its labels: place() here, the DOM's measured pass.
 * ponytail: every label against every kept one, and a label never moves to make room. A first cut, and not the answer
 * to label collision (reference, Open 5). */
export function declutter(boxes: LabelBox[], gap = 2): boolean[] {
  const kept: LabelBox[] = [], gone = boxes.map(() => false);
  boxes.map((_, i) => i).sort((a, b) => (boxes[a]!.rank || 0) - (boxes[b]!.rank || 0) || a - b).forEach((i) => {
    const b = boxes[i]!;
    if (kept.some((k) => b.x < k.x + k.w + gap && k.x < b.x + b.w + gap && b.y < k.y + k.h + gap && k.y < b.y + b.h + gap)) gone[i] = true; else kept.push(b);
  });
  return gone;
}

const rect = ({ part, role, row, series, rank, x: _x, w: _w, v, v0, ...n }: RectNode, x: number, y: number, w: number, h: number, rx: number): PlacedRect => ({ ...n, x, y, w, h, rx });
const circle = ({ part, role, row, series, rank, x: _x, t: _t, size, w: _w, h: _h, ...n }: CircleNode, cx: number, cy: number, r = radius(size)): PlacedCircle => ({ ...n, cx, cy, r });
const text = ({ part, role, row, series, rank, x: _x, t, short, ...n }: TextNode, x: number, y: number, s: string = n.text): PlacedText => ({ ...n, x, y, text: s });
const fit = (s: string, room: number) => clip(s, Math.floor(room / CHAR_W));
function shift(nodes: PlacedNode[], dx: number, dy: number): PlacedNode[] {
  nodes.forEach((n) => { n.tx = (n.tx || 0) + dx; n.ty = (n.ty || 0) + dy; });
  return nodes;
}

// One big number, an optional delta and an optional note. `note` is false where the box is too short for it.
function placeNumber(nodes: SceneNode[], W: number, container: Container, small: boolean, note = true): Block {
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
  if (sub && note && W >= 120 && !(small && sub.rank)) {
    out.push(text(sub, 0, yy, clip(sub.text, Math.floor(W / (CHAR_W - 0.8)))));
    yy += 16;
  }
  return { nodes: out, height: yy - 10 };
}

// The plot with its axes. The gutters for the tick labels are constants. `narrow` is the `mid-tick` rule's verdict on the view.
function placePlot(scene: Scene, W: number, H: number, narrow: boolean): PlacedNode[] {
  const gy = scene.parts.includes('y-axis'), gx = scene.parts.includes('x-axis');
  // Labels at the line ends take a gutter beside the plot, as wide as the longest of them up to LABEL characters.
  const labels = scene.parts.includes('labels') ? scene.nodes.filter((n): n is TextNode => n.part === 'labels' && n.kind === 'text') : [];
  const lw = labels.length ? Math.min(LABEL, Math.max(...labels.map((n) => n.text.length))) * CHAR_W + 6 : 0;
  // The second y axis has a gutter as the first does, between the plot and those labels.
  const g2 = scene.parts.includes('y-axis-2') ? 30 : 0;
  const ml = gy ? 36 : 1, mr = (gy ? 6 : 1) + g2 + lw, mt = gy ? 10 : 3, mb = gx ? 22 : 3, inset = scene.scale === 'point' ? 2 : 0;
  const y = scaleLinear().domain([0, 1]).range([H - mb, mt]);
  // On a linear x every node has its own ratio of the plot's width. Otherwise a node is placed by its row, on the scale the scene used.
  // A ratio of the plot's width is taken inside the inset, which is where the scale the scene used runs.
  const lin = scene.scale === 'linear', pw = W - ml - mr, px = (x: number) => ml + inset + x * (pw - 2 * inset);
  const xs = xScale(scene.rows!, scene.scale === 'linear' ? 'point' : scene.scale!, ml + inset, W - mr - inset);
  const at = (n: { x?: number; row?: string }) => (lin || n.row == null ? px(n.x!) : xs.cx(n.row));
  const box = { x: (p: Point) => at(p), y };
  // Labels on points, where the plan shows them: each above its point, clipped as a line's label is and kept inside
  // the plot. Where two would collide the one of lower rank is left out.
  const dots = new Map(scene.nodes.filter((n): n is CircleNode => n.kind === 'circle' && n.row != null).map((n) => [n.row, n.size]));
  const tags = (scene.parts.includes('point-labels') ? scene.nodes.filter((n): n is TextNode => n.part === 'point-labels' && n.kind === 'text') : []).map((n) => {
    const s = clip(n.text, LABEL), w = s.length * CHAR_W;
    const r = radius(dots.get(n.row)) + 4, above = y(n.t!) - r;
    // Under its point where there is no room above it.
    return { n, s, w, x: Math.max(ml + w / 2, Math.min(at(n), W - mr - w / 2)), y: above < LABEL_LINE ? y(n.t!) + r + LABEL_LINE - 3 : above };
  });
  const lost = declutter(tags.map((a) => ({ x: a.x - a.w / 2, y: a.y - LABEL_LINE, w: a.w, h: LABEL_LINE, rank: a.n.rank }))), tag = new Map(tags.filter((_, i) => !lost[i]).map((a) => [a.n.key, a]));
  // Labels of lines that end close are set a line apart: pushed down from the highest, then back up from the bottom of the plot.
  // ponytail: a first cut for pixel painters, and not the answer to label collision (reference, Open 5).
  const labelY = new Map<string, number>(), down = labels.slice().sort((a, b) => b.t! - a.t!);
  down.reduce((least, n) => { const at = Math.max(y(n.t!), least); labelY.set(n.key, at); return at + LABEL_LINE; }, -Infinity);
  down.reverse().reduce((most, n) => { const at = Math.min(labelY.get(n.key)!, most); labelY.set(n.key, at); return at - LABEL_LINE; }, y(0));
  // Labels under columns of widths of their own, each a row on a linear x: one that would meet a label of a wider column is left out.
  const under = gx && lin ? scene.nodes.filter((n): n is TextNode => n.part === 'x-axis' && n.kind === 'text' && n.row != null) : [];
  const met = declutter(under.map((n) => ({ x: px(n.x!) - n.text.length * TICK_W / 2, y: 0, w: n.text.length * TICK_W, h: LABEL_LINE, rank: n.rank })), 6), thin = new Set(under.filter((_, i) => met[i]).map((n) => n.key));
  const out: PlacedNode[] = [];
  scene.nodes.forEach((n) => {
    if (n.part === 'number' || n.part === 'legend' || (n.part === 'labels' && !lw) || (n.part === 'y-axis-2' && !g2)) return;
    if (n.part === 'size' || n.part === 'unit-key') return;
    if (n.part === 'point-labels') { const a = tag.get(n.key); if (a) out.push(text(a.n, a.x, a.y, a.s)); return; }
    if (under.includes(n as TextNode) ? thin.has(n.key) : n.rank && (n.part === 'x-axis' ? narrow : H < SHORT_PLOT)) return;
    if (n.kind === 'line') {
      const { part, role, row, series, rank, t, x, x2, t2, ...rest } = n;
      out.push({ ...rest, x1: x == null ? ml : px(x), x2: x2 == null ? W - mr : px(x2), y1: y(t), y2: y(t2 ?? t) });
    } else if (n.kind === 'path') {
      const { part, role, row, series, rank, points, curve, ...rest } = n;
      out.push({ ...rest, d: pathD(points, curve, n.fill, box) });
    } else if (n.kind === 'rect') {
      // A bar of a series has a place of its own within its x, so its ratios are placed. The rest share the scale the scene used.
      const [bx, bw] = n.series == null && !lin ? [xs.x(n.row!), xs.w] : [px(n.x!), n.w! * pw], from = y(n.v0 ?? 0), to = y(n.v!);
      out.push(rect(n, bx, Math.min(from, to), bw, Math.abs(from - to), Math.min(2, bw / 4)));
    } else if (n.kind === 'circle') {
      // A unit's glyph has its band's width and its share of the plot's height, and is as large as the lesser lets it be.
      out.push(n.w == null ? circle(n, at(n), y(n.t!)) : circle(n, at(n), y(n.t!), glyphRadius(n.w * (pw - 2 * inset), n.h! * (y(0) - y(1)))));
    } else if (n.kind === 'text') {
      out.push(n.part === 'y-axis' ? text(n, ml - 6, y(n.t!)) : n.part === 'x-axis' ? text(n, at(n), H - 5)
        : n.part === 'y-axis-2' ? text(n, W - mr + 6, y(n.t!)) : n.part === 'labels' ? text(n, W - lw, labelY.get(n.key)!, clip(n.text, LABEL))
        : n.x != null ? text(n, px(n.x) + (n.anchor === 'end' ? -4 : 4), y(n.t!) + 9) : text(n, W - mr, y(n.t!) - 5));       // beside a rule that stands, or above one that lies
    }
  });
  return out;
}

// The key to the series of a split plot, or of a divided row under its rows: whichever of the two the scene's parts
// name, and nothing where they name neither. The legend is a swatch and a name per series, set in a row that wraps.
// The one line, which only a divided row has, names the series with the most, in its colour.
function placeLegend(scene: Scene, W: number): Block {
  if (!scene.parts.includes('legend')) {
    const top = scene.parts.includes('legend-top') && scene.nodes.find((n): n is TextNode => n.part === 'legend-top' && n.kind === 'text');
    return top ? { nodes: [text(top, 0, 18, fit(top.text, W))], height: 24 } : { nodes: [], height: 0 };
  }
  const nodes: PlacedNode[] = [], of = (kind: string, s: string) => scene.nodes.find((n) => n.part === 'legend' && n.kind === kind && n.series === s);
  let x = 0, yy = 16;
  scene.series!.forEach((s) => {
    const swatch = of('rect', s) as RectNode, name = of('text', s) as TextNode, w = 18 + Math.min(name.text.length * CHAR_W, W - 18);
    if (x && x + w > W) { x = 0; yy += 20; }
    nodes.push(rect(swatch, x, yy - 6, 12, 12, 2), text(name, x + 18, yy, fit(name.text, W - 18)));
    x += w + 14;
  });
  return { nodes, height: yy + 10 };
}
/** The height the key to a list's series takes under its rows, at a width. Nothing where the scene shows none. */
export const legendBlock = (scene: Scene, W: number): number => placeLegend(scene, W).height;

// A grid of cells, with a label for each of its rows in a gutter as wide as the longest, and for each column under it.
// Cells are a hairline apart. Labels thin by rank: the highest rank goes first, until those left along an axis are clear
// of each other, by character width across and by a line's height down. The unranked always stay.
function placeMatrix(scene: Scene, W: number, H: number): PlacedNode[] {
  const texts = (part: Part) => (scene.parts.includes(part) ? scene.nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text') : []);
  const ys = texts('y-axis'), xs = texts('x-axis');
  const ml = ys.length ? Math.min(LABEL, Math.max(...ys.map((n) => n.text.length))) * CHAR_W + 14 : 0, pw = W - ml, ph = H - (xs.length ? 22 : 0);   // CHAR_W is short for a capital, so the gutter is not
  const below = (labels: TextNode[], pitch: number, size: (n: TextNode) => number) =>
    [3, 2].find((r) => labels.filter((n) => (n.rank || 0) < r).every((n, i, kept) => !i || pitch * (labels.indexOf(n) - labels.indexOf(kept[i - 1]!)) >= (size(n) + size(kept[i - 1]!)) / 2 + 8)) ?? 1;
  const xr = below(xs, pw / xs.length, (n) => n.text.length * CHAR_W), yr = below(ys, ph / ys.length, () => LABEL_LINE - 8);
  const out: PlacedNode[] = [];
  scene.nodes.forEach((n) => {
    if (n.kind === 'rect' && n.part === 'plot') {
      const { part, role, rank, x, w, y, h, pair, ...rest } = n;
      out.push({ ...rest, x: ml + x! * pw, y: y! * ph, w: Math.max(1, w! * pw - 1), h: Math.max(1, h! * ph - 1), rx: 1 });
    } else if (n.kind === 'circle' && n.part === 'plot') {
      // A dot is a plot's dot, and no wider than its cell: where the cells are small each step is its share of one.
      const { pair, ...dot } = n, room = Math.min(pw / (scene.rows?.length || 1), ph / (scene.ys?.length || 1)) - 1;
      out.push({ ...circle(dot, ml + n.x! * pw, (1 - n.t!) * ph), r: Math.max(0.5, Math.min(radius(n.size), (room * (n.size ?? 0.4)) / SIZES / 2)) });
    } else if (n.kind === 'text' && ys.includes(n)) { if ((n.rank || 0) < yr) out.push(text(n, ml - 6, (1 - n.t!) * ph, clip(n.text, LABEL))); }
    else if (n.kind === 'text' && xs.includes(n) && (n.rank || 0) < xr) out.push(text(n, ml + n.x! * pw, H - 5));
  });
  return out;
}

const STRIP = 34 + 22;    // one row of cells, and the labels along its foot
// A grid's ramp, set in a line in the scene's order: text by character width, swatches side by side. What the line has no room for is left out.
function placeRamp(scene: Scene, W: number): Block {
  const nodes: PlacedNode[] = [];
  let x = 0;
  // The swatch that zero is said beside stands a little clear of the arm before it, so the two read as a pair, as no value's do.
  scene.nodes.filter((n) => n.part === 'ramp').forEach((n, i, ramp) => {
    const w = n.kind === 'text' ? n.text.length * CHAR_W + 6 : 15, lead = n.key === 'ramp:none' ? 10 : (n.kind === 'text' && x) || ramp[i + 1]?.key === 'ramp:zero' ? 5 : 0;
    if (x + lead + w > W) return;
    if (n.kind === 'rect') nodes.push(rect(n, x + lead, 8, 14, 10, 1)); else if (n.kind === 'text') nodes.push(text(n, x + lead, 13));
    x += lead + w;
  });
  return { nodes, height: 24 };
}

// What a unit's glyph is worth, in a line of its own under the glyphs, where the plan shows it.
function placeUnitKey(scene: Scene): Block {
  const nodes = scene.parts.includes('unit-key') ? scene.nodes.filter((n): n is TextNode => n.part === 'unit-key' && n.kind === 'text').map((n) => text(n, 0, UNIT_KEY_BLOCK / 2 + 2)) : [];
  return { nodes, height: nodes.length ? UNIT_KEY_BLOCK : 0 };
}
/** `under` set after `over`, down the page. */
const stack = (over: Block, under: Block): Block => ({ nodes: over.nodes.concat(shift(under.nodes, 0, over.height)), height: over.height + under.height });

// The key to sizes, in one line: the metric's name, then each step's dot and the most it stands for.
function placeSize(scene: Scene): Block {
  const nodes: PlacedNode[] = [], mid = 14;
  let x = 0;
  scene.nodes.forEach((n) => {
    if (n.part !== 'size') return;
    if (n.kind === 'circle') { const r = radius(n.size); nodes.push(circle(n, x + r, mid)); x += 2 * r + 4; }
    else if (n.kind === 'text') { nodes.push(text(n, x, mid)); x += n.text.length * CHAR_W + 10; }
  });
  return { nodes, height: 28 };
}

// The ranked bar list: rows of a fixed height, labels clipped by character width.
/** The room each of a row's columns takes, the first of them first: its widest text, a header among them, and 14 px.
 * The DOM sets a column by its content. It asks this only for when to give one up, so that it agrees with resolve(). */
export function columnRooms(scene: Scene): number[] {
  const room: number[] = [];
  scene.nodes.forEach((n) => {
    // The header over the labels is no column of values: it starts where they do and takes no room of its own.
    if (n.kind !== 'text' || !((n.part === 'columns' && n.anchor !== 'start') || (n.part === 'rows' && n.font === 'value'))) return;
    const i = n.rank || 0;
    room[i] = Math.max(room[i] || 0, n.text.length * (n.part === 'columns' ? TICK_W : CHAR_W) + 14);
  });
  return room;
}
export const COLUMNS_BLOCK = 20;   // px the headers take over the rows

// Rows of a fixed height. The track, with the bar in it, lies behind the label and the first column of values, and each
// ranked column stands beyond its end. Labels are clipped by character width.
// A track that is read by where its marks are stands beside the label instead: after it, and short of the first column
// of values. The label then has its own width, up to LABEL characters and no more than 45% of the room the two share.
function placeRows(scene: Scene, W: number, { rowHeight: rowH, gap }: Container['rules']['rows']): Block {
  const rows = scene.rows!, room = columnRooms(scene), head = scene.parts.includes('columns') ? COLUMNS_BLOCK : 0;
  // Where a column's text ends, and where the track does: short of the right edge by the ranked columns' room.
  const edge = (i: number) => W - 8 - room.slice(i + 1).reduce((s, w) => s + w, 0), track = edge(0) + 8;
  const valueRoom = room[0] || 0, beside = scene.track === 'beside';
  // A row's labels are set from the start in the order they come. Each before the last is as wide as its longest text.
  const labels = scene.nodes.filter((n): n is TextNode => n.part === 'rows' && n.kind === 'text' && n.anchor !== 'end');
  const col = new Map(labels.map((n) => [n.key, labels.filter((o) => o.row === n.row).indexOf(n)])), last = Math.max(0, ...col.values());
  const wide = (j: number) => Math.max(0, ...labels.filter((n) => col.get(n.key) === j).map((n) => n.text.length)) * CHAR_W;
  const left = (j: number) => 8 + Array.from({ length: j }, (_, i) => wide(i) + 8).reduce((s, w) => s + w, 0);
  const own = beside ? Math.min(Math.min(LABEL * CHAR_W, wide(last)), (track - valueRoom - left(last)) * 0.45) : track - valueRoom - left(last) - 8;
  // Beside the label a mark keeps 4 px inside each end of its track, so a dot at either end is whole.
  const x = scaleLinear().domain([0, 1]).range(beside ? [left(last) + own + 12, track - valueRoom - 4] : [0, track]);
  const nodes: PlacedNode[] = [];
  scene.nodes.forEach((n) => {
    if (head && n.part === 'columns' && n.kind === 'text') nodes.push(text(n, n.anchor === 'start' ? 8 : edge(n.rank || 0), head / 2));
    if (n.part !== 'rows' || n.kind === 'row') return;
    const top = head + rows.indexOf(n.row!) * (rowH + gap);
    // A bar lies from where its track has zero to its value, and is never thinner than 3 px. Beside the label it is a band through the middle of the row.
    // One of a stack is as long as its share and no longer, or it would lie over the next. So is a part of the range behind the marks, which is as tall as the row.
    if (n.kind === 'rect') { const from = x(n.v0 ?? 0), to = x(n.v!), band = n.layer === 'guide', thin = beside && !band ? 8 : 0, own = n.series == null && !band; nodes.push(rect(n, Math.min(from, to), top + thin, Math.max(own ? 3 : 0, Math.abs(to - from)), rowH - 2 * thin, own ? 3 : 0)); }
    else if (n.kind === 'text') nodes.push(n.anchor === 'end' ? text(n, edge(n.rank || 0), top + rowH / 2) : text(n, left(col.get(n.key)!), top + rowH / 2, col.get(n.key)! < last ? n.text : fit(n.text, own)));
    else if (n.kind === 'line') { const { part, role, row, series, rank, t, x: x1, x2, t2, ...rest } = n; nodes.push({ ...rest, x1: x(x1!), x2: x(x2!), y1: top + (1 - t) * rowH, y2: top + (1 - (t2 ?? t)) * rowH }); }
    // A unit's glyph has its share of the track, and the row's height less 4 px above and below.
    else if (n.kind === 'circle') nodes.push(circle(n, x(n.x!), top + (1 - n.t!) * rowH, n.w == null ? undefined : glyphRadius(n.w * (x(1) - x(0)), n.h! * rowH - 8)));
  });
  return stack({ nodes, height: head + Math.max(0, rows.length * (rowH + gap) - gap) }, placeUnitKey(scene));
}

// The legend of a whole split by colour, under a band or a circle of arcs that ends at `top`: whichever of the two
// the plan shows. Its height is where it ends, and `top` where it shows neither.
function placeShares(scene: Scene, W: number, top: number): Block {
  const rows = scene.rows || [], nodes: PlacedNode[] = [];
  let h = top;
  scene.nodes.forEach((n) => {
    if (!scene.parts.includes(n.part)) return;
    if (n.part === 'legend-top' && n.kind === 'text') {
      nodes.push(text(n, 0, top + 18, fit(n.text, W)));
      h = top + 24;
    } else if (n.part === 'legend') {
      const yy = top + 20 + rows.indexOf(n.row!) * 24;
      if (n.kind === 'rect') nodes.push(rect(n, 0, yy - 6, 12, 12, 2));
      else if (n.kind === 'text') nodes.push(n.anchor === 'end' ? text(n, W, yy) : text(n, 20, yy, fit(n.text, W - 70)));
      h = yy + 10;
    }
  });
  return { nodes, height: h };
}

// A unit's grid, its key and the legend under them. The grid holds its shape, as a circle of arcs does: a square as wide
// as the view up to GRID and no taller than `room` leaves once the key and the legend are set, though never under
// GRID_LEAST. It sits in the middle of the width, and its cells are a hairline apart. `plot` is that square.
function placeGrid(scene: Scene, W: number, room: number | null): Block & { plot: { w: number; h: number } } {
  const key = placeUnitKey(scene), under = key.height + placeShares(scene, W, 0).height;
  const S = Math.min(W, GRID, room == null ? Infinity : Math.max(GRID_LEAST, room - under)), left = (W - S) / 2;
  const cells = scene.nodes.filter((n): n is RectNode => n.part === 'band' && n.kind === 'rect').map(({ y, h, ...n }) => rect(n, left + n.x! * S, y! * S, Math.max(1, n.w! * S - 1), Math.max(1, h! * S - 1), 1));
  const above = stack({ nodes: cells, height: S }, key), legend = placeShares(scene, W, above.height);
  return { nodes: above.nodes.concat(legend.nodes), height: legend.height, plot: { w: S, h: S } };
}

// One band and its legend.
function placeBand(scene: Scene, W: number): Block {
  const barH = 24, gap = 2, rows = scene.rows!, usable = W - gap * (rows.length - 1);
  const nodes: PlacedNode[] = [];
  let x0 = 0;
  scene.nodes.forEach((n) => {
    if (n.part !== 'band' || n.kind !== 'rect' || !scene.parts.includes(n.part)) return;
    const w = n.v! * usable;
    nodes.push(rect(n, x0, 0, w, barH, 2));
    x0 += w + gap;
  });
  const legend = placeShares(scene, W, barH);
  return { nodes: nodes.concat(legend.nodes), height: legend.height };
}

// Arcs about one centre, and the legend under them. The part holds its shape: a box of the scene's `aspect`, as wide as
// the view up to RADIAL and no taller than `room` leaves once the legend is set, though never under `least` across.
// It sits in the middle of the width. `plot` is that box, which the `hole` rule asks about.
// Labels round the rim, where the plan shows them, stand outside the circle, which gives up RIM all round to them. Those
// to either side run out of the box into the view's width, which the `rim` rule holds wide enough. Where two would
// collide the one of higher rank is left out.
function placeRadial(scene: Scene, W: number, room: number | null, container: Container): Block & { plot: { w: number; h: number } } {
  const rules = container.rules.fit, aspect = scene.aspect || 1, least = ruleFor(rules, 'radial', 'marks')?.needs.block ?? 0;
  // Seats want more room than arcs do: a hundred of them are small. Their key is a line between them and the legend.
  const key = placeUnitKey(scene), under = key.height + placeShares(scene, W, 0).height, seats = scene.nodes.some((n) => n.part === 'radial' && n.kind === 'circle');
  const D = Math.min(W, seats ? SEATS : RADIAL, room == null ? Infinity : Math.max(seats ? SEATS_LEAST : least, (room - under) * aspect)), h = D / aspect, plot = { w: D, h };
  const nodes: PlacedNode[] = [], R = D / 2 - (scene.parts.includes('rim') ? RIM : 0);
  let r0 = 1;
  const tags = (scene.parts.includes('rim') ? scene.nodes.filter((n): n is TextNode => n.part === 'rim' && n.kind === 'text') : []).map((n) => {
    const w = n.text.length * TICK_W, x = W / 2 + (R + 4) * (2 * n.x! - 1);
    return { n, x, y: D / 2 - (R + 8) * (2 * n.t! - 1), box: { x: n.anchor === 'start' ? x : n.anchor === 'end' ? x - w : x - w / 2, w } };
  });
  const lost = declutter(tags.map((a) => ({ ...a.box, y: a.y - LABEL_LINE / 2, h: LABEL_LINE, rank: a.n.rank })));
  scene.nodes.forEach((n) => {
    if (n.kind === 'arc') {
      // An arc is drawn about the origin, and moved to the centre: the middle of a circle, and of the foot of a half.
      const { part, role, row, series, rank, a0, a1, r0: inner, r1, kind, ...rest } = n;
      if (role === 'primary') r0 = Math.min(r0, inner);
      nodes.push({ ...rest, kind: 'path', d: arcD(n, R), fill: true, tx: W / 2, ty: D / 2 });
    } else if (n.part === 'rim' && n.kind === 'text') {
      const i = tags.findIndex((a) => a.n === n);
      if (i >= 0 && !lost[i]) nodes.push(text(n, tags[i]!.x, tags[i]!.y));
    } else if (n.part === 'hole' && n.kind === 'text' && scene.parts.includes('hole')) {
      // The number in the hole is the small face, whose width displayWidth() gives, and it shows only where its corners are inside the hole.
      const hole = ruleFor(rules, 'radial', 'hole'), face = container.display(n.text.length, r0 * D, true);
      const wide = container.displayWidth(n.text.length), tall = aspect === 1 ? face.h / 2 : face.h;
      if (hole && applies(hole, { view: { inline: W }, plot: { inline: plot.w, block: plot.h } })) return;
      if (Math.hypot(wide / 2, tall) > r0 * D / 2) return;
      nodes.push({ ...text(n, W / 2, D / 2 - (aspect === 1 ? face.h / 2 : face.h)), h: face.h, cell: face.cell });
    } else if (n.part === 'radial' && n.kind === 'circle') {
      // A seat, across and up the part's own box.
      nodes.push(circle(n, (W - D) / 2 + n.x! * D, (1 - n.t!) * h, glyphRadius(n.w! * D, n.h! * h)));
    }
  });
  const above = stack({ nodes, height: h }, key), legend = placeShares(scene, W, above.height);
  return { nodes: above.nodes.concat(legend.nodes), height: legend.height, plot };
}

/** The pixel scene for a container: the ratio scene, placed at its size. Pure. */
export function place(scene: Scene, container: Container): PlacedScene {
  const W = container.width, H = container.height, rules = container.rules;
  if (scene.layout === 'prose') return { width: W, height: 0, nodes: [], text: scene.text };
  const number = (w: number, small: boolean, note?: boolean) => placeNumber(scene.nodes.filter((n) => n.part === 'number'), w, container, small, note);
  // What resolve() reports as dropped is what is left out here: both ask the same rule.
  const midTick = ruleFor(rules.fit, 'cartesian', 'mid-tick'), narrow = !!midTick && applies(midTick, { view: { inline: W } });
  let out: Block, plot: PlacedScene['plot'] | null = null;
  if (scene.layout === 'none') {
    out = number(W, false);
    // A number alone that is too tall for the box gives up its note before the view gives up the number. The prototype goes straight to prose.
    if (H != null && out.height > H) out = number(W, false, false);
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
      // The least a plot with axes is built to is the `axes` rule's block need, so the two cannot be set apart.
      const least = ruleFor(rules.fit, 'cartesian', 'axes')?.needs.block ?? 0;
      const legend = placeLegend(scene, W);
      // The key to sizes goes under the legend, and both come out of the plot's height.
      if (scene.parts.includes('size')) { const sizes = placeSize(scene); legend.nodes.push(...shift(sizes.nodes, 0, legend.height)); legend.height += sizes.height; }
      const key = placeUnitKey(scene);
      legend.nodes.push(...shift(key.nodes, 0, legend.height)); legend.height += key.height;
      const ph = !guided ? rules.bare.height : H ? Math.max(least, Math.min(rules.axes.height, H - above - legend.height)) : rules.axes.height;
      body = { nodes: placePlot(scene, W, ph, narrow).concat(shift(legend.nodes, 0, ph)), height: ph + legend.height }; plot = { w: W, h: ph };
    } else if (scene.layout === 'matrix') {
      // A grid has no bare form. The least it is built to is its `marks` rule's block need, and its ramp is set under it.
      const least = ruleFor(rules.fit, 'matrix', 'marks')?.needs.block ?? 0;
      const keys = [scene.parts.includes('ramp') && placeRamp(scene, W), scene.parts.includes('size') && placeSize(scene)].filter((b): b is Block => !!b);
      const ramp = { nodes: keys.flatMap((b, i) => shift(b.nodes, 0, keys.slice(0, i).reduce((s, k) => s + k.height, 0))), height: keys.reduce((s, b) => s + b.height, 0) };
      // One row of cells is as tall as a cell, with its labels under it, where nothing says how tall the view is.
      const strip = scene.ys?.length === 1 && scene.ys[0] === '';
      const ph = H ? Math.max(least, Math.min(rules.axes.height, H - above - ramp.height)) : strip ? STRIP : rules.axes.height;
      body = { nodes: placeMatrix(scene, W, ph).concat(shift(ramp.nodes, 0, ph)), height: ph + ramp.height };
    } else if (scene.layout === 'rows') {
      const list = placeRows(scene, W, rules.rows), key = placeLegend(scene, W);
      body = { nodes: list.nodes.concat(shift(key.nodes, 0, list.height)), height: list.height + key.height };
    } else if (scene.layout === 'radial') {
      const radial = placeRadial(scene, W, H ? H - above : null, container);
      body = radial; plot = radial.plot;
    } else if (customMarks().has(scene.layout)) {
      // A custom mark places its own parts. Its ramp and its key to sizes are set under them, as a grid's and a plot's are.
      const keys = [scene.parts.includes('ramp') && placeRamp(scene, W), scene.parts.includes('size') && placeSize(scene)].filter((b): b is Block => !!b), under = keys.reduce((s, b) => s + b.height, 0);
      const own = customMarks().get(scene.layout)!.place(scene, W, H ? H - above - under : null, container);
      body = { nodes: keys.reduce((nodes, b, i) => nodes.concat(shift(b.nodes, 0, own.height + keys.slice(0, i).reduce((s, k) => s + k.height, 0))), own.nodes), height: own.height + under };
      if (own.plot) plot = own.plot;
    } else if (scene.aspect) {
      const grid = placeGrid(scene, W, H ? H - above : null);
      body = grid; plot = grid.plot;
    } else {
      body = placeBand(scene, W);
    }
    out = hd ? { nodes: hd.nodes.concat(shift(body.nodes, 0, above)), height: above + body.height } : body;
  }
  // A pixel painter draws a tint as the paint at the node's opacity, so `tone` stops here.
  const placed: PlacedScene = { width: W, height: Math.ceil(out.height), nodes: out.nodes.map((n) => { const { tone: _tone, ...rest } = n as PlacedNode & { tone?: string }; return rest; }) };
  if (plot) placed.plot = plot;
  return placed;
}
