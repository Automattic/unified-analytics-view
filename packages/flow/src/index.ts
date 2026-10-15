import { applies, formatDimension, layerKeys, registerMark, registerPreset, roleOf, rowKeys, ruleFor } from '@unified-analytics/core';
import type { CustomMark, FitRule, Part, PathNode, PlacedNode, RectNode, Row, SceneNode, TextNode } from '@unified-analytics/core';

/* The `link` mark: a ribbon from a value of one dimension to a value of another, as a custom mark (core's marks.ts).
 * One layer of it, alone, is a Sankey of one step. This is its half for core: a scene in ratios and its place in
 * pixels, with no DOM. The painter is in dom.ts.
 *
 *   { "mark": "link", "encode": { "x": <the source dimension>, "y": <the target dimension>, "size": <a metric> } }
 *
 * The query is by the two dimensions, so rows come back long, one per pair. Two columns of nodes, the sources on the
 * left and the targets on the right, each node as tall as the engine's total for its value (`result.totalsBy`), in the
 * engine's order. A ribbon for each row, as wide at each end as the row's share of the node it meets.
 *
 * The plan gave the target `x2`. Core keeps `x2` for a bar, a rule or an area that runs from one value to another,
 * and `encode` is a closed set a custom mark cannot add to, so the target is on `y`.
 *
 * It depends on core alone, and on the DOM package for its painter. One step is two stacks and a curve between them. */

const SERIES = 6;       // the series colours there are: a source takes one
const GAP = 0.02;       // of the plot's height, between one node and the next
/** px across a node. A scene has no pixels, so this is each painter's, as a dot's radius is. */
export const NODE = 8;
/** px between a node and its label. */
export const LABEL = 6;
const LINE = 14;        // px a label's line takes, for a painter that cannot measure one

/* Labels go first, and then the view is not a smaller Sankey: it becomes the grid of the same pairs, which reads at any
 * width. The first dimension is down its side and the second across, so the sources are its rows and the targets its columns. */
export const LINK_RULES: FitRule[] = [
  { id: 'guides', layout: 'link', container: 'view', needs: { inline: 320, block: 140 },      // a label inside each column, and ribbons between
    hide: ['labels'], keep: 'guides' },
  { id: 'marks',  layout: 'link', container: 'view', needs: { inline: 280, block: 120 },      // ribbons too short, or nodes too thin, to follow
    hide: [], fallback: 'heatmap', keep: 'marks' },
];

/** Which of one column's labels stand, where each takes `line` of the column: the larger node's first, and one that
 * would meet a label that stands does not. `at` is where a label's middle is and `rank` its node's place by size. */
export function standing(labels: { at: number; rank: number }[], line: number): boolean[] {
  const kept: number[] = [], on = labels.map(() => false);
  labels.map((l, i) => [l, i] as const).sort((a, b) => a[0].rank - b[0].rank).forEach(([l, i]) => { if (kept.every((k) => Math.abs(k - l.at) >= line)) { kept.push(l.at); on[i] = true; } });
  return on;
}

const round = (n: number) => Math.round(n * 100) / 100;
/** A ribbon in a box 100 by 100: from `y0`, `w0` deep, on the left edge to `y1`, `w1` deep, on the right, all in ratios of the box. */
const ribbon = (y0: number, w0: number, y1: number, w1: number) => { const [a, b, c, d] = [y0, y0 + w0, y1, y1 + w1].map((y) => round(y * 100)); return 'M0,' + a + 'C50,' + a + ' 50,' + c + ' 100,' + c + 'L100,' + d + 'C50,' + d + ' 50,' + b + ' 0,' + b + 'Z'; };

interface Node { key: string; value: Row[string]; v: number; i: number; y: number; h: number }

export const linkMark: CustomMark = {
  rules: LINK_RULES,

  scene({ layers, guides, query, result, catalog }) {
    const l = layers[0]!, { x: src, y: tgt, size: m } = l.encode || {}, by = query.by || [];
    if (layers.length > 1) throw new Error('A Sankey draws one "' + l.mark + '" layer, and this view has ' + layers.length + '. Keep one, with the source on x, the target on y and the metric on size.');
    const dim = (f: unknown): f is string => typeof f === 'string' && f in catalog.dimensions;
    if (!dim(src) || !dim(tgt) || src === tgt) throw new Error('A "' + l.mark + '" layer runs from the values of one dimension to the values of another, the source on x and the target on y, and this one has ' + JSON.stringify(src) + ' on x and ' + JSON.stringify(tgt) + ' on y. '
      + (by.length === 2 ? 'Encode "' + by[0] + '" on x and "' + by[1] + '" on y.' : 'Make query.by two dimensions, the source and then the target, and encode the first on x and the second on y.'));
    if (typeof m !== 'string') throw new Error('A "' + l.mark + '" layer needs the metric each ribbon is as wide as on size, and this one has ' + JSON.stringify(m) + ' there. Encode one of the query\'s metrics: ' + query.metrics.join(', ') + '.');
    // A node is as tall as the engine's total for its value. The rows are one per pair, and are never summed to make one.
    const none = [src, tgt].find((d) => !Array.isArray(result.totalsBy?.[d]));
    if (none) throw new Error('A "' + l.mark + '" layer makes each node as tall as the engine\'s total for its value, and this result has no totalsBy for "' + none + '". Return it from the query layer: a row for each value of "' + none + '", holding its total of "' + m + '".');
    const sources = result.totalsBy![src]!.length;
    if (sources > SERIES) throw new Error('Running from "' + src + '" makes ' + sources + ' sources, and there are ' + SERIES + ' series colours. Add "limit": ' + SERIES + ' to the query, or less.');

    // Each column in the engine's order. A value with no total, or one of zero, has no node: there is nothing to be as tall as.
    const cols = [src, tgt].map((d) => { const rows = result.totalsBy![d]!, keys = rowKeys(rows, d); return rows.map((r, i): Node => ({ key: keys.get(r)!, value: r[d], v: r[m] as number, i, y: 0, h: 0 })).filter((n) => n.v > 0); });
    // The plot is as tall as the engine's total, so with a `limit` a column stops short of the foot by what the values
    // past the limit hold. Where a column's nodes come to more than that, as they do for a metric that does not add up,
    // or the engine gives no total, the plot is as tall as the taller column. That is geometry: no value is made of it.
    const whole = Math.max(result.totals[m] || 0, ...cols.map((c) => c.reduce((s, n) => s + n.v, 0)));
    const unit = (1 - GAP * (Math.max(1, ...cols.map((c) => c.length)) - 1)) / (whole || 1);
    for (const c of cols) c.reduce((y, n) => { n.y = y; n.h = n.v * unit; return y + n.h + GAP; }, 0);

    // A ribbon for each row whose value is above zero and whose two ends have a node. At a source the ribbons lie in
    // the targets' order, and at a target in the sources', so two from one node do not cross.
    const of = cols.map((c) => new Map(c.map((n) => [n.key, n]))), pairs = rowKeys(result.rows, src, tgt);
    const key = (r: Row) => pairs.get(r) + ':' + r[tgt];
    const flows = result.rows.map((r) => ({ r, s: of[0]!.get(String(r[src])), t: of[1]!.get(String(r[tgt])), v: r[m] as number, y0: 0, y1: 0 })).filter((f): f is typeof f & { s: Node; t: Node } => !!f.s && !!f.t && f.v > 0);
    const used = new Map<Node, number>(), take = (n: Node, w: number) => { const at = used.get(n) ?? 0; used.set(n, at + w); return n.y + at; };
    const ends = (f: (typeof flows)[number]) => [f.v / f.s.v * f.s.h, f.v / f.t.v * f.t.h] as const;
    for (const f of flows.slice().sort((a, b) => a.s.i - b.s.i || a.t.i - b.t.i)) f.y0 = take(f.s, ends(f)[0]);
    for (const f of flows.slice().sort((a, b) => a.t.i - b.t.i || a.s.i - b.s.i)) f.y1 = take(f.t, ends(f)[1]);

    // Paint follows the source: a series colour for each, by its place in the engine's order, and its ribbons in that
    // colour's soft tone. A target is where several sources meet, so it is no one's colour.
    const id = layerKeys(layers)[0]!, role = roleOf(l), paint = (n: Node) => 'series.' + (n.i + 1);
    const nodes: SceneNode[] = flows.map((f): PathNode => ({ key: id + ':' + key(f.r), part: 'plot', kind: 'path', d: ribbon(f.y0, ends(f)[0], f.y1, ends(f)[1]), points: [], fill: true,
      paint: paint(f.s), opacity: 0.35, tone: 'soft', row: key(f.r), layer: 'data', role }));
    const dims = [src, tgt];
    cols.forEach((c, side) => nodes.push(...c.map((n): RectNode => ({ key: 'node:' + dims[side] + ':' + n.key, part: 'plot', kind: 'rect', x: side, y: n.y, h: n.h, paint: side ? 'ink.muted' : paint(n), layer: 'data', role }))));
    // A label for each node, ranked by its node's size within its column: where two would meet, the larger node's stands.
    cols.forEach((c, side) => {
      const ranks = c.slice().sort((a, b) => b.v - a.v);
      nodes.push(...c.map((n): TextNode => ({ key: 'label:' + dims[side] + ':' + n.key, part: 'labels', kind: 'text', text: formatDimension(n.value, catalog.dimensions[dims[side]!]!), x: side, t: 1 - (n.y + n.h / 2),
        anchor: side ? 'end' : 'start', baseline: 'middle', font: 'tick', paint: 'ink', layer: 'guide', rank: ranks.indexOf(n) + 1 })));
    });
    // A plan's guides are on or off together, and the labels are this mark's.
    const parts: Part[] = guides.ramp || guides.size ? ['plot', 'labels'] : ['plot'];
    return { nodes, rows: result.rows.map(key), parts };
  },

  // A box as wide as the view and as tall as a plot with axes is, or as the room where that is less. The nodes stand at
  // its edges, the ribbons run between them, and each label is inside its column, over the ribbons.
  place(scene, W, room, container) {
    const rule = (id: string) => ruleFor(container.rules.fit.concat(LINK_RULES), scene.layout, id);
    const h = room == null ? container.rules.axes.height : Math.max(rule('marks')?.needs.block ?? 0, Math.min(container.rules.axes.height, room));
    // Core asks a custom mark's `guides` rule only for a ramp or a key to sizes, so the labels' room is asked here.
    const guides = rule('guides'), labelled = scene.parts.includes('labels') && !(guides && applies(guides, { view: { inline: W, block: room } }));
    const kx = (W - 2 * NODE) / 100, ky = h / 100, nodes: PlacedNode[] = [], labels: TextNode[] = [];
    for (const n of scene.nodes) {
      if (n.part === 'plot' && n.kind === 'path') nodes.push({ key: n.key, kind: 'path', d: n.d!.replace(/([\d.]+),([\d.]+)/g, (_, x: string, y: string) => round(NODE + Number(x) * kx) + ',' + round(Number(y) * ky)), fill: true, paint: n.paint, layer: n.layer, ...(n.opacity != null && { opacity: n.opacity }) });
      else if (n.part === 'plot' && n.kind === 'rect') nodes.push({ key: n.key, kind: 'rect', x: n.x ? W - NODE : 0, y: round(n.y! * h), w: NODE, h: round(n.h! * h), rx: 0, paint: n.paint, layer: n.layer });
      else if (n.part === 'labels' && n.kind === 'text' && labelled) labels.push(n);
    }
    // A label stays inside the box, and gives way to the label of a larger node it would meet.
    const at = (n: TextNode) => Math.min(Math.max((1 - n.t!) * h, LINE / 2), h - LINE / 2);
    for (const side of [0, 1]) {
      const col = labels.filter((n) => n.x === side), on = standing(col.map((n) => ({ at: at(n), rank: n.rank! })), LINE);
      nodes.push(...col.filter((_, i) => on[i]).map((n): PlacedNode => ({ key: n.key, kind: 'text', x: side ? W - NODE - LABEL : NODE + LABEL, y: round(at(n)), text: n.text, anchor: n.anchor, baseline: 'middle', font: n.font, paint: n.paint, layer: n.layer })));
    }
    return { nodes, height: h, plot: { w: W, h } };
  },
};

/** Register the `link` mark, and the preset that draws it. A spec then names the mark in `mark`, or the preset in `use`. */
export function registerLink(): void {
  registerMark('link', linkMark);
  // Core cannot name this mark, so its preset is registered here. A working name: check it against @automattic/charts before it ships.
  registerPreset('sankey', { layers: [{ mark: 'link', encode: { x: '$by', y: '$split', size: '$metric' } }] });
}
