import { formatDimension, formatValue, heldBox, registerMark, registerPreset, roleOf, ruleFor, seqScale } from '@unified-analytics/core';
import type { CustomMark, FitRule, MarkView, Part, PlacedNode, RectNode, Row, SceneNode, TextNode } from '@unified-analytics/core';

/* The `partition` mark: a box divided by area, nested once, which is a treemap. A custom mark (core's marks.ts). This
 * is its half for core: a scene in ratios and its place in pixels, with no DOM and no dependency but core. The
 * painter is in dom.ts.
 *
 *   { "mark": "partition", "encode": { "x": <the parent dimension>, "detail": <the child dimension>, "size": <a metric>, "color": <a metric> } }
 *
 * `x` is the dimension the box is divided by, and `size` the metric each part's area is its share of. With a second
 * dimension on `detail`, each part is divided again by it. A metric on `color` paints every box a step of the
 * sequential ramp in place of a series colour for each parent.
 *
 * Every area is a share of a total the engine gives, and no row is summed. The whole box is the metric's total. A
 * parent is its total over its children, from `totalsBy`, and with one dimension each row's own value. A child is its
 * value against its parent's total. So where a `limit` left rows out, the boxes stop short and what the rows past
 * the limit hold is left unpainted: at the end of the whole box for parents left out, and at the end of a parent's
 * box, in its tint, for children left out. A band stops short of its end the same way.
 *
 * The part holds its shape, because squares are made for one shape of box: 1.6 wide to 1 tall. */

/** A box, in whatever units it was asked for in. */
export interface Box { x: number; y: number; w: number; h: number }

/** Squarify (Bruls, Huizing and van Wijk, 2000): a box for each of `values`, in the order given, in a box `w` by `h`,
 * each as near a square as its row allows. An area is its value's share of `total`, so where the values hold less
 * than the total the room for the rest is left empty, after the last of them. Values are positive.
 * It does not sort, since the order is the engine's: a ranked dimension arrives largest first, which is what the
 * method wants, and one in an order of its own keeps that order and has longer boxes for it.
 * Where the values hold more than `total` they are fitted to what they hold, so that no box leaves the room: a
 * rounding, or a total that is not the sum of its parts. That is geometry, and no share said anywhere is made of it. */
export function squarify(values: number[], w: number, h: number, total = 0): Box[] {
  const whole = Math.max(total, values.reduce((s, v) => s + v, 0)), k = whole > 0 ? (w * h) / whole : 0, areas = values.map((v) => v * k), out: Box[] = [];
  // The worst shape in a row of areas that add up to `s`, the least of them `lo` and the most `hi`, along a side `side` long.
  const worst = (s: number, lo: number, hi: number, side: number) => Math.max((side * side * hi) / (s * s), (s * s) / (side * side * lo));
  let x = 0, y = 0, i = 0;
  while (i < areas.length) {
    // A row is set along the shorter side of the room that is left, and takes boxes while they get no less square.
    const rw = w - x, rh = h - y, side = Math.min(rw, rh);
    let j = i, s = 0, lo = Infinity, hi = 0;
    for (; j < areas.length; j++) {
      const a = areas[j]!;
      if (j > i && worst(s + a, Math.min(lo, a), Math.max(hi, a), side) > worst(s, lo, hi, side)) break;
      s += a; lo = Math.min(lo, a); hi = Math.max(hi, a);
    }
    const thick = side > 0 ? s / side : 0;
    for (let at = 0; i < j; i++) {
      const len = thick > 0 ? areas[i]! / thick : 0;
      out.push(rw >= rh ? { x, y: y + at, w: thick, h: len } : { x: x + at, y, w: len, h: thick });
      at += len;
    }
    if (rw >= rh) x += thick; else y += thick;
  }
  return out;
}

const ASPECT = 1.6;   // the part's width over its height
const MAX = 480;      // px across a treemap that has room to spare
const HEAD = 16;      // px a parent's name takes at the top of its box, over its children
const LINE = 14;      // px a label's line takes
const CHAR = 6;       // px a character of a label takes, near enough, where nothing can be measured
const SERIES = 6;     // the series colours there are

/* Below the room a treemap needs it is not a smaller treemap: the view becomes a list of the same query. Which list
 * depends on the query, and a rule names one preset, so there are two rules: the first whose preset the query can
 * fill is the one that applies (core's fallbackRule). With two dimensions it is `pair-list`, registered below, since
 * `bar-list` has one dimension to its rows and would leave the other undrawn. With one it is `bar-list`. */
export const PARTITION_RULES: FitRule[] = [
  { id: 'guides', layout: 'partition', container: 'view', needs: { inline: 320, block: 170 },     // the ramp, where a metric is on color
    hide: ['ramp', 'size'], keep: 'guides' },
  { id: 'marks',  layout: 'partition', container: 'view', needs: { inline: 280, block: 120 },     // boxes too small to tell apart, or to name
    hide: [], fallback: 'pair-list', keep: 'marks' },
  { id: 'marks-flat', layout: 'partition', container: 'view', needs: { inline: 280, block: 120 }, // the same room, for a query by one dimension
    hide: [], fallback: 'bar-list', keep: 'marks' },
];

interface Leaf { key: string; name: string; row: Row; box: Box; paint: string }
interface Group extends Leaf { kids: Leaf[]; rows: Row[]; n: number }

/** What a view's layers ask for, checked, and the boxes it comes to: a group for each parent with its box in ratios of
 * the part, and in each its children, with their boxes in ratios of the parent's. Both the scene and the names are made from this. */
function read({ layers, query, result, catalog }: Omit<MarkView, 'guides'>) {
  const l = layers[0]!, { x: dim, detail, size, color } = l.encode || {}, by = query.by || [], q = '"' + l.mark + '"';
  if (layers.length > 1) throw new Error('A treemap draws one ' + q + ' layer, and this view has ' + layers.length + '. Put the dimension to divide by on x, the one to divide each part by on detail, and the metric on size, in one layer.');
  if (typeof dim !== 'string' || !(dim in catalog.dimensions)) throw new Error('A ' + q + ' layer needs the dimension to divide the box by on x, and this one has ' + JSON.stringify(dim) + ' there. Encode one of the query\'s dimensions on x: ' + (by.join(', ') || 'it has none, so add one to query.by') + '.');
  if (typeof size !== 'string' || !(size.split('@')[0]! in catalog.metrics)) throw new Error('A ' + q + ' layer needs a metric on size, which each box\'s area is a share of, and this one has ' + JSON.stringify(size) + ' there. Encode one of the query\'s metrics on size: ' + query.metrics.join(', ') + '.');
  if (detail === dim) throw new Error('A ' + q + ' layer divides by the dimension on x and then by the one on detail, and this one has "' + dim + '" on both. ' + (by.length > 1 ? 'Encode "' + by.find((d) => d !== dim) + '" on detail' : 'Remove "detail", for one level') + '.');
  if (color != null && !(typeof color === 'string' && color.split('@')[0]! in catalog.metrics)) throw new Error('A ' + q + ' layer takes a metric on color, to paint every box by the ramp, and this one has ' + JSON.stringify(color) + ' there. Encode one of the query\'s metrics on color, or remove it: each "' + dim + '" then has a series colour.');
  const two = typeof detail === 'string', by2 = result.totalsBy?.[dim];
  // A parent is sized by what the engine says it holds over all its children. With no such total there is no honest
  // box for it: its rows may be short of it by a `limit`, and are never summed.
  if (two && !by2) throw new Error('A ' + q + ' layer divided by "' + dim + '" and then "' + detail + '" sizes each "' + dim + '" by the engine\'s total for it, and this result has no totalsBy["' + dim + '"]. Return totalsBy from the query layer, or remove "' + detail + '" from detail and from query.by, for one level.');
  const tops = two ? by2! : result.rows, of = (r: Row) => String(r[dim]), is = (v: unknown): v is number => typeof v === 'number' && v > 0;
  const lost = two ? result.rows.find((r) => !tops.some((t) => of(t) === of(r))) : undefined;
  if (lost) throw new Error('The result has a row for the "' + dim + '" "' + of(lost) + '", and totalsBy["' + dim + '"] has no total for it, so there is no box to put it in. Return a total for every "' + dim + '" the rows hold.');
  // Nothing is a share of a total that is null or zero, and a value that is null, zero or below zero has no area.
  const total = result.totals[size], shown = total ? tops.filter((r) => is(r[size])) : [];
  const drawn = two ? result.rows.filter((r) => is(r[size]) && shown.some((t) => of(t) === of(r))) : shown;
  // The colour scale runs over the boxes that are painted by it, as a grid's runs over its cells.
  const fill = typeof color === 'string' ? seqScale(drawn.map((r) => r[color]).filter((v): v is number => typeof v === 'number'), catalog.metrics[color.split('@')[0]!]) : null;
  if (!fill && shown.length > SERIES) throw new Error('Dividing by "' + dim + '" makes ' + shown.length + ' boxes, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less, or encode a metric on color to paint every box by the ramp.');
  // A key is made unique as it is given out: two rows of one value, or a value with the separator in it.
  const id = roleOf(l) + ':' + l.mark, taken = new Set<string>();
  const key = (k: string) => { let u = k; for (let n = 2; taken.has(u); n++) u = k + '#' + n; taken.add(u); return u; };
  const paint = (r: Row, i: number) => (fill ? fill.paint(r[color as string] as number | null | undefined) : 'series.' + (i + 1));
  const groups = squarify(shown.map((r) => r[size] as number), ASPECT, 1, total || 0).map((b, i): Group => {
    const top = shown[i]!, k = key(id + ':' + of(top)), rows = two ? result.rows.filter((r) => of(r) === of(top)) : [top], inside = rows.filter((r) => two && is(r[size]));
    const kids = squarify(inside.map((r) => r[size] as number), b.w, b.h, top[size] as number).map((c, j): Leaf => ({
      key: key(k + ':' + inside[j]![detail as string]), name: formatDimension(inside[j]![detail as string], catalog.dimensions[detail as string]!), row: inside[j]!,
      box: { x: b.w ? c.x / b.w : 0, y: b.h ? c.y / b.h : 0, w: b.w ? c.w / b.w : 0, h: b.h ? c.h / b.h : 0 }, paint: paint(inside[j]!, i) }));
    return { key: k, name: formatDimension(top[dim], catalog.dimensions[dim]!), row: top, rows, box: { x: b.x / ASPECT, y: b.y, w: b.w / ASPECT, h: b.h }, paint: two && fill ? 'seq.none' : paint(top, i), kids, n: i + 1 };
  });
  return { groups, two, fill, dim, role: roleOf(l), none: drawn.some((r) => fill && r[color as string] == null), key };
}

/** What each box says, by its node's key: its name, under its parent's where it has one, and each of the query's
 * metrics in the catalog's formats. A parent's are the engine's totals for it. This is a box's accessible name and its
 * readout, so no value is said by area or colour alone. `row` is the row it came from, and `rows` the rows inside it. */
export function boxNames(view: Omit<MarkView, 'guides'>): Map<string, { says: string; row: Row; rows: Row[] }> {
  const { groups } = read(view), { query, catalog } = view;
  const values = (r: Row) => query.metrics.filter((m) => r[m] !== undefined).map((m) => catalog.metrics[m]!.label + ' ' + formatValue(r[m] as number | null, catalog.metrics[m]!)).join('; ');
  return new Map(groups.flatMap((g): [string, { says: string; row: Row; rows: Row[] }][] => [[g.key, { says: g.name + ': ' + values(g.row), row: g.row, rows: g.rows }],
    ...g.kids.map((c): [string, { says: string; row: Row; rows: Row[] }] => [c.key, { says: g.name + ', ' + c.name + ': ' + values(c.row), row: c.row, rows: [c.row] }])]));
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

export const partitionMark: CustomMark = {
  rules: PARTITION_RULES,

  /* The nodes, in order: a parent's box, its name, and then each of its children's boxes with the child's name after
   * it. A parent's box is set in the part, as a cell is: `x` and `w` across it and `y` and `h` down it. A child's is
   * set in its parent's box the same way, under the parent's name, and carries the two values it came from as `pair`.
   * A name is the label of the box before it, and has the rank of that box among them all by area, the largest first.
   * No node has a `row`: a box is not a row of the result one for one, so the painter names and steps through them itself. */
  scene(view) {
    const { groups, two, fill, dim, role, none, key } = read(view), { guides, result } = view;
    const nodes: SceneNode[] = [], labels: [TextNode, number][] = [];
    // A name on a series colour is in the colour of the ground the view is on, which every series colour is made to
    // stand out from. A step of the ramp may be near either end, so there a name is in ink with a halo of the ground.
    const on = fill ? 'ink' : 'background';
    const label = (of: Leaf, area: number, paint: string, halo: boolean) => {
      const n: TextNode = { key: key(of.key + ':label'), part: 'plot', kind: 'text', text: of.name, anchor: 'start', font: 'tick', paint, layer: 'guide', ...(halo && { halo }) };
      labels.push([n, area]); nodes.push(n);
    };
    for (const g of groups) {
      const b = g.box, at = { x: round(b.x), y: round(b.y), w: round(b.w), h: round(b.h) };
      // A parent that is divided is the ground its children stand on: a tint of its colour, or the tone of no value.
      // What its children do not cover is what the rows past a `limit` hold.
      nodes.push({ key: g.key, part: 'plot', kind: 'rect', ...at, paint: g.paint, ...(two && !fill && { opacity: 0.14, tone: 'soft' as const }), layer: two && fill ? 'guide' : 'data', role: two && fill ? 'context' : role });
      label(g, b.w * b.h, two ? (fill ? 'ink.muted' : g.paint) : on, !two && !!fill);
      for (const c of g.kids) {
        nodes.push({ key: c.key, part: 'plot', kind: 'rect', x: round(c.box.x), y: round(c.box.y), w: round(c.box.w), h: round(c.box.h), pair: [String(g.row[dim]), String(c.row[view.layers[0]!.encode!.detail as string])], paint: c.paint, layer: 'data', role } satisfies RectNode);
        label(c, b.w * b.h * c.box.w * c.box.h, on, !!fill);
      }
    }
    labels.map(([n, area], i) => [n, area, i] as const).sort((a, b) => b[1] - a[1] || a[2] - b[2]).forEach(([n], i) => { n.rank = i; });
    if (fill) nodes.push(...fill.ramp(none));
    const parts: Part[] = ['plot'];
    if (fill && guides.ramp) parts.push('ramp');
    return { nodes, rows: result.rows.map((r) => String(r[dim])), aspect: ASPECT, parts };
  },

  /* A box of the part's shape: as wide as the view up to MAX, no taller than the room, and in the middle of the width.
   * Parents are 2 px apart, a pixel in from the part's edge all round, and children 1 px. A parent's name has a line at the top of its box, over its children,
   * while the box can give it one, and a name is set only where it fits its box, by a width worked out from its
   * length: nothing is measured here. Where a parent's name does not fit, its children's are left out too, so a
   * child is never named without the parent it is in. */
  place(scene, W, room, container) {
    const least = ruleFor(container.rules.fit.concat(PARTITION_RULES), scene.layout, 'marks')?.needs.block ?? 0;
    const { w, h, left } = heldBox(W, room, scene.aspect!, MAX, least * scene.aspect!);
    const nodes: PlacedNode[] = [], fits = (n: TextNode, b: Box) => n.text.length * CHAR + 8 <= b.w && LINE <= b.h;
    let parent: Box = { x: 0, y: 0, w: 0, h: 0 }, inner = parent, named = false, last = parent;
    // A parent that is divided is a ground: a tint, or the tone of no value. Its name has a line of its own over its children.
    const two = scene.nodes.some((n) => n.part === 'plot' && n.kind === 'rect' && (!!n.pair || n.tone === 'soft' || n.role === 'context'));
    for (const n of scene.nodes) {
      if (n.part !== 'plot') continue;
      if (n.kind === 'rect') {
        const child = !!n.pair, of = child ? inner : { x: left + 1, y: 1, w, h }, gap = child ? 1 : 2;
        last = { x: of.x + n.x! * of.w, y: of.y + n.y! * of.h, w: Math.max(0, n.w! * of.w - gap), h: Math.max(0, n.h! * of.h - gap) };
        nodes.push({ key: n.key, kind: 'rect', ...last, rx: 2, paint: n.paint, layer: n.layer, ...(n.opacity != null && { opacity: n.opacity }) });
        if (!child) parent = last;
      } else if (n.kind === 'text') {
        const child = last !== parent, divided = !child && two, head = divided ? Math.min(HEAD, parent.h * 0.3) : 0;
        const shows: boolean = child ? named && fits(n, last) : fits(n, divided ? { ...parent, h: head } : parent);
        if (!child) { named = shows; inner = { x: parent.x, y: parent.y + head, w: parent.w + 1, h: parent.h - head + 1 }; }
        if (shows) nodes.push({ key: n.key, kind: 'text', x: last.x + 4, y: last.y + (divided ? head / 2 : LINE / 2 + 2), text: n.text, anchor: 'start', baseline: 'middle', font: n.font, paint: n.paint, layer: n.layer, ...(n.halo && { halo: true }) });
      }
    }
    return { nodes, height: h, plot: { w, h } };
  },
};

/** Register the `partition` mark, and the presets that go with it. A spec then names the mark in `mark`, or `treemap` in `use`. */
export function registerPartition(): void {
  registerMark('partition', partitionMark);
  // Core cannot name this mark, so its preset is registered here. Working names: check each against @automattic/charts before it ships.
  // `treemap` is two levels, since a preset's slots are filled or refused whole: one level is the layer written out, with no `detail`.
  registerPreset('treemap', { layers: [{ mark: 'partition', encode: { x: '$by', detail: '$split', size: '$metric' } }] });
  // What a treemap of two dimensions becomes below the room it needs: a row for each pair, in the engine's order, named
  // by both. The ranked list has one dimension to its rows, and core refuses a view that leaves a dimension undrawn.
  registerPreset('pair-list', { layers: [
    { mark: 'bar',  encode: { y: '$split', x: '$metric' } },
    { mark: 'text', encode: { y: '$split', text: '$by' }, role: 'context' },
    { mark: 'text', encode: { y: '$split', text: '$split' } },
    { mark: 'text', encode: { y: '$split', text: '$metric' }, align: 'end' } ] });
}
