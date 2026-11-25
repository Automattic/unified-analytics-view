import { CONTAINER_RULES } from './container.ts';
import { fitTo, gaveWay, type Fit, type Rooms } from './fit.ts';
import { guidesOf } from './guides.ts';
import { formats, orList, rangeOf, timeOf } from './format.ts';
import { customMarks } from './marks.ts';
import { PRESETS, expand, fills, presetNames, usesPrevious } from './presets.ts';
import { checkReads } from './reads.ts';
import { DETAIL_LAYOUTS, SERIES, isMetric, buildScene, widest, columnsOf, isDim, metricOf, overMarks, pointDimOf, roleOf, xDimOf } from './scene.ts';
import { filterSaid, tldrProse } from './prose.ts';
import { LAYER_FIELDS, MARKS, QUERY_FIELDS, SPEC_FIELDS, baseOf } from './types.ts';
import type { Catalog, ContainerRules, Layer, Layout, Plan, PlanShape, PresetLibrary, Query, Result, Scene, Spec, Where } from './types.ts';

/* The layout a layer's fields ask for: what is on x, on y and on color, first match first. `any` asks nothing of its channel. */
type FieldKind = 'dimension' | 'metric' | 'any';
const BY_FIELDS: [x: FieldKind, y: FieldKind, color: FieldKind, layout: Layout][] = [
  ['dimension', 'dimension', 'any',       'matrix'],
  ['dimension', 'any',       'any',       'cartesian'],
  ['any',       'dimension', 'any',       'rows'],
  ['metric',    'metric',    'any',       'cartesian'],    // a point for each row, at two metrics. Before the band, which asks nothing of x
  ['any',       'any',       'dimension', 'band'],
];

/** Whether a plot sets one metric against another: a point for each row. It has a dimension to key its rows by, and none on x. */
const isPoints = (catalog: Catalog, layers: Layer[]) => !xDimOf(catalog, layers) && !layers.some((l) => isDim(catalog, l.encode && l.encode.y)) && layers.some((l) => isMetric(catalog, l.encode && l.encode.x));

/** The layout a view's layers ask for, the layer that asked, and why: what explain() says of it. */
export interface LayoutChoice { layout: Layout; layer: number; why: string }
const KIND_NAMES: Record<FieldKind, string> = { dimension: 'a dimension', metric: 'a metric', any: '' };

export function layoutOf(catalog: Catalog, layers: Layer[]): LayoutChoice {
  // A custom mark is laid out by its own code, under its own name, and that code draws its layers alone.
  // But for the plot's marks that stand at a place, over a mark that offers its places (marks.ts, `places`).
  const custom = layers.findIndex((l) => customMarks().has(l.mark)), offers = custom >= 0 && !!customMarks().get(layers[custom]!.mark)!.places;
  const other = custom >= 0 ? layers.find((l) => l.mark !== layers[custom]!.mark && !(offers && overMarks().includes(l.mark))) : undefined;
  if (other) throw new Error('The "' + layers[custom]!.mark + '" mark is laid out by its own code, and layer ' + (layers.indexOf(other) + 1) + ' is a "' + other.mark + '". ' + (offers ? 'Over it a ' + orList(overMarks()) + ' may be drawn, at each of its places, and nothing else. ' : '') + 'Keep the "' + layers[custom]!.mark + '" layers alone, and draw the others as a view of their own.');
  if (custom >= 0) return { layout: layers[custom]!.mark, layer: custom, why: 'the "' + layers[custom]!.mark + '" mark is registered in code and lays itself out' };
  const is = (kind: FieldKind, f: unknown) => kind === 'any' || (kind === 'metric' ? isMetric(catalog, f) : isDim(catalog, f));
  const find = (test: (l: Layer) => boolean) => layers.findIndex(test);
  // Anything on angle is laid out about a centre, whatever else is encoded. It is not a row of the table: that asks about x, y and color.
  let i = find((l) => l.encode?.angle != null);
  if (i >= 0) return { layout: 'radial', layer: i, why: 'something is on angle, so it is drawn about a centre' };
  // A cell along one dimension is a grid one column wide or one row tall, and not a list's rows or a plot.
  i = find((l) => l.mark === 'cell' && !!l.encode && (isDim(catalog, l.encode.y) || (l.encode.y == null && isDim(catalog, l.encode.x))));
  if (i >= 0) return { layout: 'matrix', layer: i, why: 'a cell along a dimension is a grid' };
  for (const [x, y, color, layout] of BY_FIELDS) {
    i = find((l) => !!l.encode && is(x, l.encode.x) && is(y, l.encode.y) && is(color, l.encode.color));
    if (i >= 0) return { layout, layer: i, why: ([['x', x], ['y', y], ['color', color]] as const).filter(([, k]) => k !== 'any').map(([ch, k]) => KIND_NAMES[k] + ' on ' + ch).join(' and ') };
  }
  // A unit with a metric and no dimension at all is a grid read against the metric's range, in the place a band has.
  i = find((l) => l.mark === 'unit' && isMetric(catalog, l.encode?.x));
  if (i >= 0) return { layout: 'band', layer: i, why: 'a unit with a metric and no dimension is a grid read against its range' };
  throw new Error('These layers put no dimension on x, y or color, so there is nothing to lay out.');
}

function checkLayers(layers: Layer[], q: Query, catalog: Catalog, result: Result): void {
  const by = q.by || [], known = by.concat(q.metrics);
  if (by.length > 2 || (by.length === 2 && by[0] === by[1])) throw new Error('A view is by one dimension or by two different ones, and query.by has: ' + by.join(', ') + '. Remove all but two.');
  layers.forEach((l, i) => {
    if (!l || !l.mark) throw new Error('Layer ' + (i + 1) + ' has no "mark". Use one of: ' + MARKS.join(', ') + '.');
    // A name the schema cannot check: it is one of core's marks or one registered in code, and anything else is an error here.
    if (!(MARKS as readonly string[]).includes(l.mark) && !customMarks().has(l.mark)) throw new Error('Layer ' + (i + 1) + ' has the mark "' + l.mark + '", which is not built in and is not registered. Built in: ' + MARKS.join(', ') + '. Registered: ' + ([...customMarks().keys()].join(', ') || 'none') + '. Use one of those, or register it with registerMark("' + l.mark + '", …) before the view is resolved.');
    // A second end belongs to a mark that can run from one value to another, and needs the first end to run from.
    for (const [end, start] of [['x2', 'x'], ['y2', 'y']] as const) {
      if (l.encode?.[end] == null) continue;
      if (['bar', 'rule', 'area'].indexOf(l.mark) < 0) throw new Error('Layer ' + (i + 1) + ' is a "' + l.mark + '" with "' + end + '", and only a bar, a rule or an area runs from one value to another. Use one of those, or remove "' + end + '".');
      // A rule may start at a number: to one of the row's values, which is the stroke from that value to the number, or to a place across the plot.
      // A bar may too, to one of the row's values: the same bar, and by `paint: "direction"` one that runs from the number to the value.
      const from = l.encode[start], to = l.encode[end], across = l.encode.x2 != null && l.encode.y2 != null;
      if ((l.mark === 'rule' || l.mark === 'bar') && typeof from === 'number' && ((across && l.mark === 'rule') || (typeof to === 'string' && !isDim(catalog, to)))) continue;
      if (l.mark === 'rule' && typeof from === 'number') throw new Error('Layer ' + (i + 1) + ' is a rule from ' + from + ' to ' + JSON.stringify(to) + ' on ' + start + ', so every row\'s would be the one stroke. Encode a metric, or a companion the result returns with one, at either end, or keep one number for a line at it.');
      if (typeof l.encode[start] !== 'string' || isDim(catalog, l.encode[start])) throw new Error('Layer ' + (i + 1) + ' has "' + end + '" and no value on ' + start + ' to run from. Encode where it starts on ' + start + ': a metric, or a companion the result returns with one.');
    }
    // A unit counts one value in glyphs, in its own paint or a colour for each group. What would lay glyphs over glyphs, or run them from a second value, is refused here by name.
    if (l.mark === 'unit') {
      const n = 'Layer ' + (i + 1) + ' is a "unit"', e = l.encode || {}, grid = !isDim(catalog, e.x) && !isDim(catalog, e.y) && e.angle == null;
      // With no dimension it reads the engine's total. A query by one would return rows that nothing here draws.
      if (grid && e.y == null && !isDim(catalog, e.color) && by.length) throw new Error(n + ' with no dimension, which reads "' + e.x + '" over the whole range, and the query is by "' + by[0] + '". Encode "' + by[0] + '" on color to divide the grid by it, or remove it from query.by.');
      if (l.series) throw new Error(n + ' with series: "' + l.series + '", and a unit draws this period\'s value alone: glyphs of two periods would lie over each other. Remove "series", or use "bar" or "line" for the comparison.');
      if (l.stack && !(l.stack === 'normalize' && grid)) throw new Error(n + ' with stack: "' + l.stack + '", and a unit\'s glyphs are counted from nothing, each group on its own. ' + (grid ? 'A grid divided by color is shares of the whole already: remove "stack", or write "normalize".' : 'Remove "stack", or use "bar" to stack a second dimension.'));
      if ((isDim(catalog, e.x) || isDim(catalog, e.y)) && [e.color, e.detail].some((f) => isDim(catalog, f) && f !== e.x && f !== e.y)) throw new Error(n + ' split by "' + [e.color, e.detail].find((f) => isDim(catalog, f) && f !== e.x && f !== e.y) + '", and a unit on an axis counts one value for each row: glyphs of several series would lie over each other. Use "bar" with "stack" for a second dimension, or remove it from the layer and from query.by.');
    }
    // Painted by direction, a mark is a gain or a loss by which of its two ends is the higher. So it has two, and no colours of a split to give up for it.
    if (l.paint === 'direction') {
      const end = (['x2', 'y2'] as const).find((e) => l.encode?.[e] != null);
      if (!end || (l.mark !== 'bar' && l.mark !== 'area')) throw new Error('Layer ' + (i + 1) + ' is a "' + l.mark + '" with paint: "direction"' + (end ? '' : ' and one end') + ', and that paints a bar or an area by which way it runs from one value to another. Give a bar or an area its second end on x2 or y2, or name a paint token: series.1 to series.' + SERIES + ', delta.good, delta.bad.');
      if (l.encode!.color != null) throw new Error('Layer ' + (i + 1) + ' has paint: "direction" and encodes "' + l.encode!.color + '" on color, and a mark has one paint: its series\' colour, or a gain\'s or a loss\'s. Remove one of the two.');
    }
    if (l.series === 'delta' && !(l.mark === 'text' && isDim(catalog, l.encode && l.encode.y) && typeof (l.encode && l.encode.text) === 'string' && (l.encode!.text as string) in catalog.metrics))
      throw new Error('Layer ' + (i + 1) + ' has series: "delta", which is a row\'s change in a metric. Make it a text layer with the dimension on y and the metric on text.');
    // The period before is of a metric. A layer that encodes none had nothing to take it of, and was drawn as it stood.
    if (l.series === 'previous' && !Object.values(l.encode || {}).some((f) => isMetric(catalog, f))) throw new Error('Layer ' + (i + 1) + ' has series: "previous" and encodes no metric, so there is no period before to draw. Encode the metric it is the period before of, or remove "series".');
    // A mark has one paint: the one its layer states, or a colour for each value of a dimension on color. With both, one was dropped.
    const lp = l.encode?.color;
    if (l.paint && l.paint !== 'direction' && isDim(catalog, lp)) throw new Error('Layer ' + (i + 1) + ' has the paint "' + l.paint + '" and encodes "' + lp + '" on color, and a mark has one paint: the one stated, or a colour for each "' + lp + '". Remove one of the two' + (by.indexOf(lp) >= 0 && lp !== l.encode?.x && lp !== l.encode?.y ? ', or put "' + lp + '" on detail to split the layer and draw every series in that paint.' : '.'));
    // A dimension on detail splits a layer and paints nothing apart. It is one of the query's dimensions, and no companion or number.
    const ld = l.encode?.detail;
    if (ld != null && by.indexOf(ld as string) < 0) throw new Error('Layer ' + (i + 1) + ' encodes ' + JSON.stringify(ld) + ' on detail, and detail splits a layer by one of the query\'s dimensions' + (by.length ? ': ' + by.join(', ') + '. Encode one of those' : ', of which it has none. Add one to query.by') + ', or remove "detail".');
    // A plot with a dimension on x has one more to split by, so a layer there is split once: painted apart, or not.
    const lcd = l.encode?.color;
    if (ld != null && isDim(catalog, lcd) && (lcd === ld || isDim(catalog, l.encode?.x))) throw new Error('Layer ' + (i + 1) + ' encodes "' + lcd + '" on color and "' + ld + '" on detail, and a layer is split into series once: painted apart with a legend by color, or all in its own paint by detail. Remove one of the two.');
    if (l.stack && ld != null) throw new Error('Layer ' + (i + 1) + ' has "stack" and is split by detail, which paints every series alike, so a stack of them could not be read. Encode "' + ld + '" on color in place of detail, or remove "stack".');
    if (l.stack && !isDim(catalog, l.encode && l.encode.color)) throw new Error('Layer ' + (i + 1) + ' has "stack" and no dimension on color, so there is nothing to stack. Encode the query\'s second dimension on color, or remove "stack".');
    // In rows a colour says which rows go together, so it is the rows' own dimension or something the engine says of it.
    // A stacked bar is the one mark that is divided there: by the query's other dimension, into a series for each of its values.
    const { x: lx, y: ly, color: lc } = l.encode || {}, divided = l.mark === 'bar' && !!l.stack && by.indexOf(lc as string) >= 0;
    if (l.mark !== 'cell' && !divided && isDim(catalog, ly) && !isDim(catalog, lx) && typeof lc === 'string' && baseOf(lc) !== ly) throw new Error('Layer ' + (i + 1) + ' is in rows by "' + ly + '" and encodes "' + lc + '" on color. A row is painted by its own dimension, for a colour each, or by a companion the result returns with it, for rows that go together. Encode "' + ly + '" on color, or remove it.' + (l.mark === 'bar' && by.indexOf(lc) >= 0 ? ' To divide each row\'s bar by "' + lc + '", give the layer "stack".' : ''));
    // A size on a bar is its column's width, which is a share of a whole: so the plot is one of shares, column by column.
    if (l.mark === 'bar' && l.encode?.size != null && !(isDim(catalog, lx) && isDim(catalog, lc) && lc !== lx && l.stack === 'normalize')) throw new Error('Layer ' + (i + 1) + ' is a bar with ' + JSON.stringify(l.encode.size) + ' on size, which makes each column as wide as its share of the engine\'s total. That is read in a plot of shares: a dimension on x, the query\'s other dimension on color, and stack: "normalize". Add what is missing, or remove "size".');
    Object.entries(l.encode || {}).forEach(([ch, f]) => {
      if (typeof f === 'number') return;
      if (ch === 'size' && !isMetric(catalog, f)) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on size, and a size is a quantity. Encode one of the query\'s metrics: ' + q.metrics.join(', ') + '.');
      // A companion of a field the query returns is the engine's to send, so it is looked for in the result. An empty result has none to show.
      const row = result.rows[0], of = baseOf(f);
      if (f !== of && known.indexOf(of) >= 0 && row && !(f in row)) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + ch + ', which the result does not return. With "' + of + '" it returns: ' + (Object.keys(row).filter((c) => baseOf(c) === of && c !== of).join(', ') || 'nothing') + '.');
      if (f !== of && known.indexOf(of) >= 0) return;
      if (known.indexOf(f) < 0) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + ch + ', which the query does not return. It returns: ' + known.join(', ') + '.');
    });
  });
  // A metric on x and on y is a point for each value of a dimension. With none there is one row at most.
  if (!by.length && layers.some((l) => l.encode && [l.encode.x, l.encode.y].every((f) => typeof f === 'string' && f in catalog.metrics))) throw new Error('These layers set one metric against another, and the query has no dimension, so there is no row to draw a point for. Add one to query.by, for example ["page"].');
  // Rows come back one per pair. A dimension that no layer encodes would leave several rows drawn in one place.
  const unused = by.length === 2 && layers.length ? by.find((d) => !layers.some((l) => Object.values(l.encode || {}).indexOf(d) >= 0)) : null;
  if (unused) throw new Error('The query is by "' + unused + '", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
}

/** A filter in one form, so that two are compared by what they hold: its dimensions in order, a value as a list of one, a list in order. */
const filterOf = (w: Where = {}) => JSON.stringify(Object.keys(w).sort().map((d) => { const h = w[d]!; return [d, Array.isArray(h) || typeof h !== 'object' ? [h].flat().map(String).sort() : { from: h.from ?? null, to: h.to ?? null }]; }));
/** A query's filter is refused where it holds a dimension to nothing or to a run it has no order for, and where the
 * answer is not of it: a view would say one thing and show another. */
function checkWhere(q: Query, result: Result, catalog: Catalog): void {
  for (const [d, h] of Object.entries(q.where || {})) {
    const at = 'query.where holds "' + d + '" to ' + JSON.stringify(h), run = !!h && typeof h === 'object' && !Array.isArray(h);
    if (h == null || (Array.isArray(h) ? !h.length : run && h.from == null && h.to == null)) throw new Error(at + ', which is no value. Write one of its values, a list of them, or a run as { "from": …, "to": … }, or remove "' + d + '" from where.');
    if (run && catalog.dimensions[d]!.type === 'categorical') throw new Error(at + ', and "' + d + '" is categorical: its values have no order to run from one to another. List the values it may take, or remove "' + d + '" from where.');
  }
  if (filterOf(q.where) !== filterOf(result.meta.where)) throw new Error('The query ' + (Object.keys(q.where || {}).length ? 'filters by where: ' + JSON.stringify(q.where) : 'has no "where"') + ', and the answer says it is of ' + (result.meta.where ? 'where: ' + JSON.stringify(result.meta.where) : 'everything, with no "where" in its meta') + '. An engine that filters says so on its answer, as meta.where. Pass what this query returned, or make query.where the same.');
}

/** The plan for a spec: its layout, its layers with their roles, its guides and its sentence. It takes no size, so
 * it is everything the spec asks for. What a room is short of is the fit rules' to say (`fitTo`, `viewAt`), and a
 * surface's to act on. `rules` are a context's own. Throws, with a message that names the fix, when the spec is invalid. */
export function resolve(spec0: Spec, result: Result, catalog: Catalog, rules: ContainerRules = CONTAINER_RULES, presets: PresetLibrary = PRESETS): Plan {
  if (spec0.facet != null) throw new Error('This spec has "facet": ' + JSON.stringify(spec0.facet) + ', so it is a view for each value of that dimension and has no one plan. Ask facets(spec, result, catalog) for the views and resolve each, or remove "facet".');
  const spec = expand(spec0, presets), q = spec.query || ({} as Query);
  // A field that nothing reads is refused by name, where it was once read past: a view was drawn without the size, the
  // switch or the filter its author wrote.
  const stray = (has: object, takes: readonly string[]) => Object.keys(has).find((k) => !takes.includes(k) && (has as Record<string, unknown>)[k] !== undefined);
  for (const [what, has, takes, more] of [['The spec', spec0, SPEC_FIELDS, ' A view says what to show and nothing of how: no size, breakpoint or switch.'], ['The spec\'s query', q, QUERY_FIELDS, ' A filter is "where".'], ...(spec0.layers || []).map((l, i) => ['Layer ' + (i + 1), l || {}, LAYER_FIELDS, ' What a mark draws is on its channels, in "encode".'] as const)] as const) {
    const k = stray(has, takes);
    if (k != null) throw new Error(what + ' has "' + k + '", which it does not take. It takes: ' + takes.join(', ') + '.' + more);
  }
  if (!q.metrics || !q.metrics.length) throw new Error('A view needs query.metrics, for example ["visitors"].');
  // A name the catalog does not carry is refused here, once, before anything reads its definition.
  for (const [kind, where, names, has] of [['metric', 'metrics', q.metrics, catalog.metrics], ['dimension', 'by', q.by || [], catalog.dimensions], ['dimension', 'where', Object.keys(q.where || {}), catalog.dimensions]] as const) for (const f of names)
    if (!Object.hasOwn(has, f)) throw new Error('The catalog has no ' + kind + ' "' + f + '". It has: ' + (Object.keys(has).join(', ') || 'none') + '. Add it to the catalog passed in, or correct the name in query.' + where + '.');
  // A metric the catalog gives by some dimensions only cannot be answered by another, and is refused before anything is drawn.
  for (const f of q.metrics) {
    const takes = catalog.metrics[f]!.by, where = takes && (['by', 'where'] as const).find((w) => (w === 'by' ? q.by || [] : Object.keys(q.where || {})).some((d) => !takes.includes(d)));
    if (!where) continue;
    const d = (where === 'by' ? q.by! : Object.keys(q.where!)).find((x) => !takes!.includes(x))!;
    throw new Error('The metric "' + f + '" is not answered by "' + d + '": the catalog gives it by ' + (takes!.length ? orList(takes!) : 'no dimension') + '. ' + (takes!.length ? 'Ask it by one of those, or take' : 'Take') + ' "' + d + '" out of query.' + where + '.');
  }
  checkWhere(q, result, catalog);
  const m = q.metrics[0]!, M = catalog.metrics[m]!, by = (q.by || [])[0], dropped: string[] = [];
  let layers = (spec.layers || []).slice();
  if (!layers.length && by) throw new Error('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: ' + presetNames(presets).join(', ') + '.');
  checkLayers(layers, q, catalog, result);
  // A time no view can read is refused here, once, before anything is built or painted. fmtTime's error names the forms.
  for (const d of q.by || []) if (catalog.dimensions[d]?.type === 'time') for (const r of result.rows) if (r[d] != null) timeOf(String(r[d]));
  if (result.meta.range) rangeOf(result.meta.range);                   // and a range the prose cannot say, the same way
  if (layers.some(usesPrevious) && (q.compare !== 'previous' || result.totals[m + '@previous'] == null)) {
    const why = q.compare === 'previous' ? ' (no prior data)' : ' (the query has no "compare")';
    if (!result.meta.empty) [['previous', 'comparison series'], ['delta', 'the change on the previous period']].forEach(([series, what]) => { if (layers.some((l) => l.series === series)) dropped.push(what + why); });
    layers = layers.filter((l) => !usesPrevious(l));
  }
  // An arc is a share of a whole unless it is a slice or a ring of its own: those are read by how far they reach, and ranked.
  // A unit divided by color with no dimension on an axis is shares of a whole, as an arc's segments are: a grid, or seats.
  const unit = layers.some((l) => l.mark === 'unit'), divided = (l: Layer) => l.mark === 'unit' && isDim(catalog, l.encode?.color) && !isDim(catalog, l.encode?.x) && !isDim(catalog, l.encode?.y);
  const share = layers.some((l) => l.stack === 'normalize' || (l.mark === 'arc' && !isDim(catalog, l.encode?.angle) && !isDim(catalog, l.encode?.radius)) || divided(l));
  // A custom mark brings the rules of its own layout. A context's rules for that layout come first.
  const all = spec.layers || [];
  const choice = layers.length ? layoutOf(catalog, layers) : null, laid = choice ? choice.layout : 'none', custom = customMarks().get(laid);
  // A band is one bar divided by share, or one grid of glyphs. A second layer had no place in it and was dropped, and a
  // bar was divided by share whatever its `stack` said.
  if (laid === 'band' && all.length > 1 && all.every((l) => l.mark === 'bar' || l.mark === 'unit')) throw new Error('These layers are laid out as a band (' + choice!.why + '), which draws one layer, and there are ' + all.length + '. Keep one, or put a dimension on x or on y to lay them out as a plot or a list.');
  const banded = laid === 'band' ? all.findIndex((l) => l.mark === 'bar' && l.stack && l.stack !== 'normalize') : -1;
  if (banded >= 0) throw new Error('Layer ' + (banded + 1) + ' is a bar in a band with stack: "' + all[banded]!.stack + '", and a band is one bar divided by share. Write stack: "normalize", or remove "stack".');
  // What a layer encodes and nothing reads is refused (reads.ts): every layer the spec has, so a view is not valid with a
  // comparison and refused without one. It is asked once the scene has been built, below.
  // Where every layer was of the period before and none is left, the layout is the one they would have had.
  const read = () => { const c = choice ?? (all.length ? layoutOf(catalog, all) : null); if (c) checkReads(c.layout, c.why, all, catalog); };
  // A layout that does not read detail would draw its series over each other, and say nothing. A custom mark reads its own channels.
  const lost = custom || DETAIL_LAYOUTS.includes(laid) ? -1 : layers.findIndex((l) => l.encode?.detail != null);
  if (lost >= 0) throw new Error('Layer ' + (lost + 1) + ' encodes "' + layers[lost]!.encode!.detail + '" on detail, and these layers are laid out as "' + laid + '", which does not split a layer by detail. It is read in: ' + DETAIL_LAYOUTS.join(', ') + '. Put a dimension on x and a metric on y, or remove "detail".');
  // A plot has a mark for each value of one dimension: the one on x, or under two metrics the one its points are keyed by.
  // On color that dimension splits nothing and paints nothing apart, and on detail beside itself on x it is said twice.
  if (laid === 'cartesian') {
    const xDim = xDimOf(catalog, layers), each = xDim || pointDimOf(catalog, layers, by);
    layers.forEach((l, i) => {
      const ch = each == null ? null : l.encode?.color === each ? 'color' : xDim && l.encode?.detail === xDim ? 'detail' : null;
      if (ch) throw new Error('Layer ' + (i + 1) + ' encodes "' + each + '" on ' + ch + ', and this plot has a mark for each "' + each + '" already, so it splits the layer no further and no mark is painted by it. Remove "' + ch + '".'
        + (xDim && ch === 'color' ? ' For a colour each, put "' + each + '" on y and the metric on x: a row is painted by its own dimension.' : ''));
    });
  }
  // Glyphs with no dimension say how far along its range a metric is, and not what it is: the number stands above them.
  // The view's text is in its container's locale, and so is its scene's, which is built from this plan.
  const F = formats(rules.locale, rules.words);
  const p: PlanShape = { layout: laid, layers, guides: guidesOf(laid, layers, catalog), tldrValue: rules.tldrValue.above === 'always' || !!M.instant || !layers.length || (unit && !by),
                         share, text: tldrProse(q, result, share, catalog, F), ...(rules.locale != null && { locale: rules.locale }), ...(rules.words && { words: rules.words }) };
  // What the answer is filtered to is said last, of everything before it: a view of some rows never reads as one of all.
  const only = filterSaid(result.meta.where, catalog, F);
  if (only) p.text += ' ' + F.say('filtered', { filter: only });
  if (result.meta.empty || (M.instant && !result.rows.length)) {
    if (M.instant || !layers.length) { p.layout = 'none'; p.layers = []; p.tldrValue = true; p.guides = {}; }
    else { p.layout = 'notice'; p.layers = []; p.guides = {}; p.tldrValue = false; }
  }
  // The headers of a row's columns are the key to the columns under them, and a list of one column has none.
  if (p.layout === 'rows' && columnsOf(catalog, p.layers).length < 2) delete p.guides.columns;
  // The scene's own errors come first: they know more of the form. Where it breaks on what no one foresaw, what the
  // layers encode that nothing reads is the likelier cause, and is said in its place.
  try { buildScene(p, q, result, catalog); } catch (e) { if (e instanceof TypeError) read(); throw e; }
  read();
  return {
    preset: spec0.use && !spec0.layers ? spec0.use : null, layout: p.layout,
    layers: p.layers.map((l) => Object.assign({}, l, { role: roleOf(l) })),
    guides: p.guides, tldrValue: p.tldrValue, share: p.share, dropped, text: p.text, ...(p.locale != null && { locale: p.locale }), ...(p.words && { words: p.words }),
  };
}

/** A view at a room, with no browser: what resolve() and buildScene() make of the spec with no limits, and what the fit
 * rules make of that at the room (`fitTo`). Where a rule's `fallback` holds there, this is the view the spec gives way
 * to, read the same way, and `gave` says what it gave way from. A plot's room is the first view's own, so the view
 * it gives way to is asked nothing of its plot. */
export function viewAt(spec: Spec, result: Result, catalog: Catalog, room: Rooms, rules: ContainerRules = CONTAINER_RULES, presets: PresetLibrary = PRESETS, via: string[] = []): { spec: Spec; plan: Plan; scene: Scene; fit: Fit; gave: string[] } {
  const plan = resolve(spec, result, catalog, rules, presets), full = expand(spec, presets), q = full.query;
  const scene = buildScene(plan, q, result, catalog), custom = customMarks().get(plan.layout);
  const fit = fitTo(scene, room, custom ? rules.fit.concat(custom.rules) : rules.fit, { marks: plan.layers.map((l) => l.mark), fills: (use) => fills(use, q, presets), via });
  if (!fit.fallback) return { spec, plan, scene, fit, gave: via };
  const { layers: _layers, ...rest } = spec;
  return viewAt({ ...rest, use: fit.fallback.fallback! }, result, catalog, { view: room.view }, rules, presets, via.concat(gaveWay(fit.fallback)));
}

/** One view of a facet: what it is of, and the spec and result a surface draws it from, as it draws any view. */
export interface Facet { key: string; label: string; spec: Spec; result: Result }
/** The views of a spec with `facet`: a small board (reference, Decided 26 and 45). There is one for each value of the
 * facet's dimension, in the engine's order. Each is the spec without the facet, asked of that value's rows alone, with
 * the engine's totals for the value, and every scale as wide as the widest of them takes (`Result.domains`), so the
 * views are read against one another. Where they stand is the surface's: a spec says no columns. A result with no
 * value of the dimension is one view, of the whole, which says that it is empty. */
export function facets(spec0: Spec, result: Result, catalog: Catalog, rules: ContainerRules = CONTAINER_RULES, presets: PresetLibrary = PRESETS): Facet[] {
  // What the spec is for is said once, of the views together, and not again by each of them.
  const { facet: f, description: _description, ...rest } = spec0, by = (rest.query && rest.query.by) || [];
  if (typeof f !== 'string' || !by.includes(f)) throw new Error('The spec\'s "facet" is ' + JSON.stringify(f) + ', and a facet is one of the query\'s dimensions: ' + (by.length ? by.map((d) => '"' + d + '"').join(' or ') : 'it has none in "by"') + '. ' + (by.length ? 'Name one of them' : 'Add the dimension to query.by and name it') + ', or remove "facet".');
  const dim = catalog.dimensions[f];
  if (!dim) throw new Error('The catalog has no dimension "' + f + '". It has: ' + (Object.keys(catalog.dimensions).join(', ') || 'none') + '. Add it to the catalog passed in, or correct the name in query.by.');
  const spec = { ...rest, query: { ...rest.query, by: by.filter((d) => d !== f) } };
  (expand(spec, presets).layers || []).forEach((l, i) => Object.entries(l.encode || {}).forEach(([channel, held]) => {
    if (held === f) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + channel + ', and "' + f + '" is the facet: each view holds one value of it. Take it off the layer, or remove "facet" and keep it there.');
  }));
  // The engine's total for a value: its row of totalsBy where the query has a second dimension, and its own row where it has none.
  const whole = result.totalsBy && result.totalsBy[f], values = [...new Set((whole || result.rows).map((r) => String(r[f])))], F = formats(rules.locale, rules.words);
  if (!values.length) return [{ key: '', label: dim.label, spec, result }];
  const views = values.map((v): Facet => {
    const rows = result.rows.filter((r) => String(r[f]) === v), total = (by.length > 1 ? whole && whole.find((r) => String(r[f]) === v) : rows[0]) || {};
    const totals = Object.fromEntries(Object.keys(result.totals).map((m) => [m, typeof total[m] === 'number' ? (total[m] as number) : null]));
    return { key: v, label: F.dimension(v, dim), spec: { ...spec, title: F.dimension(v, dim) }, result: { rows, totals, meta: rows.length ? result.meta : { ...result.meta, empty: true } } };   // a value the result has no rows for says so
  });
  const domains = widest(() => views.forEach((v) => buildScene(resolve(v.spec, v.result, catalog, rules, presets), expand(v.spec, presets).query, v.result, catalog)));
  for (const v of views) v.result.domains = domains;
  return views;
}
