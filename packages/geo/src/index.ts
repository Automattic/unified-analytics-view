import { geoEqualEarth, geoPath, type ExtendedFeatureCollection, type GeoProjection } from 'd3-geo';
import { dotRadius, notShownNote, registerMark, roleOf, seqScale, sizeKey, sizeStep } from '@universal-analytics/core';
import type { CircleNode, CustomMark, FitRule, Part, PathNode, PlacedNode, Row, SceneNode, TextNode } from '@universal-analytics/core';

/* The `geo` mark: a map of regions, as a custom mark (core's marks.ts). This is its half for core: a scene in ratios
 * and its place in pixels, with no DOM. The painter is in dom.ts.
 *
 *   { "mark": "geo", "encode": { "x": <a dimension>, "color": <a metric>, "size": <a metric> } }
 *
 * `x` is the dimension whose values are region keys: where a row is drawn is the shape whose id is its value. A
 * metric on `color` fills each region with a step of the sequential ramp, as a cell is filled, and a region the result
 * has no row for is `seq.none`. A metric on `size` stands a symbol at each region's centroid, in a dot's size steps.
 * One of the two, or both.
 *
 * A row whose value is no shape's id is not on the map: the map draws what it can, and a note under it says how many
 * rows it left out, in core's words and by the dimension's label. A row with no value there, null or empty, is one of them.
 *
 * The boundary shapes are an input, handed in when the mark is made, as the catalog is handed to core. They are
 * projected here, once, into a box 100 wide. The part holds that box's shape and is never stretched.
 * This is the only package that depends on d3-geo. */

/** Boundary shapes: a GeoJSON FeatureCollection with a feature for each region, whose `id` is the value the region's
 * dimension has for it, matched as it is written: "US" is not "us". `properties.name` is what the region is called.
 * A feature with a name and no id is drawn and can have no row: land no value of the dimension stands for.
 * `keys` says what the ids are, for the error a result that matches none of them gets. */
export interface Shapes { type: string; keys?: string; features: { type: string; id?: string | number; properties?: { name?: string } | null; geometry: { type: string; coordinates: unknown[] } | null }[] }

const BOX = 100;      // the width of the box paths are drawn in. Its height follows from the shapes
const MAP = 480;      // px across a map that has room to spare
const NOTE = 18;      // px the line of the note takes under the map

/* Below the room a map needs it is not a smaller map: the view becomes the ranked list of the same query. The note goes
 * with the keys, before that, so it never takes the room of a small map, and is never beside the list, which has every row. */
export const GEO_RULES: FitRule[] = [
  { id: 'guides', layout: 'geo', container: 'view', needs: { inline: 320, block: 170 },      // the ramp, and the key to sizes
    hide: ['ramp', 'size', 'note'], keep: 'guides' },
  { id: 'marks',  layout: 'geo', container: 'view', needs: { inline: 280, block: 120 },      // regions too small to tell apart
    hide: [], fallback: 'bar-list', keep: 'marks' },
];

/** A path drawn in the scene's box, at `k` times the size. Paths here are moves and lines to absolute points, so every number in one is a length. */
const scaled = (d: string, k: number) => d.replace(/-?\d+(?:\.\d+)?/g, (n) => String(Math.round(Number(n) * k * 100) / 100));

/** The geo mark for a set of boundary shapes. They are fitted to the box whole, so the map is of the shapes handed in:
 * the world, or one country's regions. `projection` is d3-geo's, and Equal Earth where none is given, which keeps areas true. */
export function geoMark(shapes: Shapes, projection: GeoProjection = geoEqualEarth()): CustomMark {
  if (!shapes || shapes.type !== 'FeatureCollection' || !Array.isArray(shapes.features) || !shapes.features.length || shapes.features.some((f) => !f || (f.id == null && !f.properties?.name))) {
    throw new Error('The geo mark needs boundary shapes: a GeoJSON FeatureCollection in which every feature has an "id", the value the region\'s dimension has for it, or where no value stands for it a "properties.name". Hand one to geoMark() or registerGeo().');
  }
  const all = shapes as unknown as ExtendedFeatureCollection, path = geoPath(projection.fitWidth(BOX, all)).digits(1);
  const height = path.bounds(all)[1][1], aspect = Math.round(BOX / height * 1000) / 1000;
  // ponytail: a symbol stands at the centroid of the whole shape, which for a country with far-flung parts is not on
  // its mainland. The centroid of its largest polygon, if that shows.
  const regions = all.features.map((f) => { const [cx, cy] = path.centroid(f); return { id: f.id == null ? null : String(f.id), key: String(f.id ?? f.properties!.name), d: path(f), x: cx / BOX, t: 1 - cy / height }; }).filter((s) => s.d && Number.isFinite(s.x + s.t));

  return {
    rules: GEO_RULES,

    scene({ layers, guides, query, result, catalog }) {
      const l = layers[0]!, { x: dim, color, size } = l.encode || {}, rows = result.rows;
      if (layers.length > 1) throw new Error('A map draws one "' + l.mark + '" layer, and this view has ' + layers.length + '. Put the metric to fill by on color and the metric for symbols on size, in one layer.');
      if (typeof dim !== 'string' || !(dim in catalog.dimensions)) throw new Error('A "' + l.mark + '" layer needs the dimension whose values are region keys on x, and this one has ' + JSON.stringify(dim) + ' there. Encode one of the query\'s dimensions on x: ' + ((query.by || []).join(', ') || 'it has none, so add one to query.by') + '.');
      if (![color, size].some((f) => typeof f === 'string' && f in catalog.metrics) || (color != null && !(color in catalog.metrics))) {
        throw new Error('A "' + l.mark + '" layer needs a metric on color, to fill each region by, or on size, for a symbol on each, and this one has ' + JSON.stringify(color) + ' on color and ' + JSON.stringify(size) + ' on size. Encode one of the query\'s metrics: ' + query.metrics.join(', ') + '.');
      }
      // A row with no value for the dimension, null or empty, has no shape, and is no sign that the shapes are the wrong ones.
      const named = rows.filter((r) => r[dim] != null && r[dim] !== '');
      const at = new Map<string | null, Row>(named.map((r) => [String(r[dim]), r])), drawn = regions.filter((s) => at.has(s.id));
      const keyed = regions.filter((s) => s.id != null);
      if (named.length && !drawn.length) {
        throw new Error('None of the ' + named.length + ' values of "' + dim + '" is the id of a boundary shape. The first is "' + named[0]![dim] + '", and the shapes ' + (shapes.keys ? 'are keyed on ' + shapes.keys + ': ' : 'have ') + keyed.slice(0, 2).map((s) => '"' + s.id + '"').join(', ') + ' and ' + (keyed.length - 2) + ' more. Have the engine send those ids for "' + dim + '", or hand geoMark() shapes whose ids are its values.');
      }
      const of = (id: string | null, f: unknown) => (typeof f === 'string' ? (at.get(id)?.[f] as number | null | undefined) : undefined);
      const values = (f: unknown) => drawn.map((s) => of(s.id, f)).filter((v): v is number => v != null);
      // The colour scale runs over the regions drawn, as a grid's runs over its cells: geometry, read from the rows.
      const fill = typeof color === 'string' ? seqScale(values(color), catalog.metrics[color]!) : null;
      const top = Math.max(0, ...values(size)) || 1, id = roleOf(l) + ':' + l.mark, role = roleOf(l);
      // Every shape handed in is drawn, in the shapes' own order, so the map does not change with the ranking. One the
      // result has a row for carries it. Under symbols the regions are the ground they stand on, in the tone of no value.
      const nodes: SceneNode[] = regions.map((s): PathNode => ({ key: id + ':' + s.key, part: 'plot', kind: 'path', d: s.d, points: [], fill: true,
        paint: fill ? fill.paint(of(s.id, color)) : 'seq.none', layer: fill ? 'data' : 'guide', role: fill ? role : 'context', ...(at.has(s.id) && { row: s.id! }) }));
      if (typeof size === 'string') nodes.push(...drawn.filter((s) => of(s.id, size) != null).map((s): CircleNode => ({ key: id + ':' + s.key + ':symbol', part: 'points', kind: 'circle', pulse: false, x: s.x, t: s.t,
        size: sizeStep(of(s.id, size)!, top), opacity: 0.7, row: s.id!, paint: l.paint || 'series.1', layer: 'data', role })));
      // Rows the map has no shape for: a count of rows, and of nothing in them.
      const ids = new Set(regions.map((s) => s.id)), note = notShownNote(rows.length - named.filter((r) => ids.has(String(r[dim]))).length, catalog.dimensions[dim]!.label);
      if (note) nodes.push({ key: 'note:not-shown', part: 'note', kind: 'text', text: note, anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
      if (fill) nodes.push(...fill.ramp(regions.some((s) => of(s.id, color) == null)));
      if (typeof size === 'string') nodes.push(...sizeKey(catalog.metrics[size]!, top));
      const sized = typeof size === 'string', parts: Part[] = ['plot'];
      if (sized) parts.push('points');
      if (note && (guides.ramp || guides.size)) parts.push('note');
      if (fill && guides.ramp) parts.push('ramp');
      if (sized && guides.size) parts.push('size');
      return { nodes, rows: rows.map((r) => String(r[dim])), aspect, parts };
    },

    // A box of the shapes' own aspect: as wide as the view up to MAP, no taller than the room, and in the middle of the width.
    // The note is a line under it, at the start of the width as the keys are, and the room it takes is not the map's.
    place(scene, W, room, container) {
      const least = container.rules.fit.concat(GEO_RULES).find((r) => r.layout === scene.layout && r.id === 'marks')?.needs.block ?? 0;
      const note = scene.parts.includes('note') ? scene.nodes.find((n): n is TextNode => n.part === 'note' && n.kind === 'text') : undefined, under = note ? NOTE : 0;
      const w = Math.min(W, MAP, room == null ? Infinity : Math.max(least, room - under) * scene.aspect!), h = w / scene.aspect!, left = (W - w) / 2;
      const nodes: PlacedNode[] = [];
      for (const n of scene.nodes) {
        if (n.part === 'plot' && n.kind === 'path') nodes.push({ key: n.key, kind: 'path', d: scaled(n.d!, w / BOX), fill: true, paint: n.paint, layer: n.layer, ...(left && { tx: left }) });
        else if (n.part === 'points' && n.kind === 'circle') nodes.push({ key: n.key, kind: 'circle', cx: left + n.x! * w, cy: (1 - n.t!) * h, r: dotRadius(n.size), pulse: false, paint: n.paint, layer: n.layer, opacity: n.opacity });
      }
      if (note) nodes.push({ key: note.key, kind: 'text', x: 0, y: h + NOTE / 2 + 2, text: note.text, anchor: note.anchor, baseline: note.baseline, font: note.font, paint: note.paint, layer: note.layer });
      return { nodes, height: h + under, plot: { w, h } };
    },
  };
}

/** Register the `geo` mark with its boundary shapes. A spec then names it in `mark`. */
export function registerGeo(shapes: Shapes, projection?: GeoProjection): void {
  registerMark('geo', geoMark(shapes, projection));
}
