import { CONTAINER_RULES, KEEP } from './container.ts';
import { applies, ruleFor, type FitRule } from './fit.ts';
import { PRESETS, expand, usesPrevious } from './presets.ts';
import { COLUMNS_BLOCK, place } from './place.ts';
import { buildScene, columnLabel, columnsOf, tldrValueText, isDim, roleOf, seriesOf, trackBeside, unitsOf, valueRoomOf, xDimOf } from './scene.ts';
import { gridProse, tldrProse } from './prose.ts';
import type { Catalog, Container, Layer, Layout, Plan, PlanShape, PresetLibrary, Query, Reduction, ReductionId, Result, Role, PlacedScene, Spec } from './types.ts';

/* Start from everything the spec asks for, then apply the container's reductions
 * in order until the view fits. Layers carry a role; reductions act on roles. */
const ROLE_NAMES: Partial<Record<Role, string>> = { comparison: 'comparison series', reference: 'reference lines', context: 'context fill' };

/* The layout a layer's fields ask for: what is on x, on y and on color, first match first. `any` asks nothing of its channel. */
type FieldKind = 'dimension' | 'metric' | 'any';
const LAYOUTS: [x: FieldKind, y: FieldKind, color: FieldKind, layout: Layout][] = [
  ['dimension', 'dimension', 'any',       'matrix'],
  ['dimension', 'any',       'any',       'cartesian'],
  ['any',       'dimension', 'any',       'rows'],
  ['metric',    'metric',    'any',       'cartesian'],    // a point for each row, at two metrics. Before the band, which asks nothing of x
  ['any',       'any',       'dimension', 'band'],
];

/** A metric, or a companion the engine returns with one, such as "pageviews@density". */
const isMetric = (catalog: Catalog, f: unknown): f is string => typeof f === 'string' && f.split('@')[0]! in catalog.metrics;
/** Whether a plot sets one metric against another: a point for each row. It has a dimension to key its rows by, and none on x. */
const isPoints = (catalog: Catalog, layers: Layer[]) => !xDimOf(catalog, layers) && !layers.some((l) => isDim(catalog, l.encode && l.encode.y)) && layers.some((l) => isMetric(catalog, l.encode && l.encode.x));

function detectLayout(catalog: Catalog, layers: Layer[]): Layout {
  const is = (kind: FieldKind, f: unknown) => kind === 'any' || (kind === 'metric' ? isMetric(catalog, f) : isDim(catalog, f));
  // Anything on angle is laid out about a centre, whatever else is encoded. It is not a row of the table: that asks about x, y and color.
  if (layers.some((l) => l.encode && l.encode.angle != null)) return 'radial';
  for (const [x, y, color, layout] of LAYOUTS) if (layers.some((l) => l.encode && is(x, l.encode.x) && is(y, l.encode.y) && is(color, l.encode.color))) return layout;
  throw new Error('These layers put no dimension on x, y or color, so there is nothing to lay out.');
}

function checkLayers(layers: Layer[], q: Query, catalog: Catalog, result: Result): void {
  const by = q.by || [], known = by.concat(q.metrics);
  if (by.length > 2 || (by.length === 2 && by[0] === by[1])) throw new Error('A view is by one dimension or by two different ones, and query.by has: ' + by.join(', ') + '. Remove all but two.');
  layers.forEach((l, i) => {
    if (!l || !l.mark) throw new Error('Layer ' + (i + 1) + ' has no "mark". Use one of: line, area, bar, rule, text, arc, cell, dot, tick.');
    // A second end belongs to a mark that can run from one value to another, and needs the first end to run from.
    for (const [end, start] of [['x2', 'x'], ['y2', 'y']] as const) {
      if (l.encode?.[end] == null) continue;
      if (['bar', 'rule', 'area'].indexOf(l.mark) < 0) throw new Error('Layer ' + (i + 1) + ' is a "' + l.mark + '" with "' + end + '", and only a bar, a rule or an area runs from one value to another. Use one of those, or remove "' + end + '".');
      if (typeof l.encode[start] !== 'string' || isDim(catalog, l.encode[start])) throw new Error('Layer ' + (i + 1) + ' has "' + end + '" and no value on ' + start + ' to run from. Encode where it starts on ' + start + ': a metric, or a companion the result returns with one.');
    }
    if (l.series === 'delta' && !(l.mark === 'text' && isDim(catalog, l.encode && l.encode.y) && typeof (l.encode && l.encode.text) === 'string' && (l.encode!.text as string) in catalog.metrics))
      throw new Error('Layer ' + (i + 1) + ' has series: "delta", which is a row\'s change in a metric. Make it a text layer with the dimension on y and the metric on text.');
    if (l.stack && !isDim(catalog, l.encode && l.encode.color)) throw new Error('Layer ' + (i + 1) + ' has "stack" and no dimension on color, so there is nothing to stack. Encode the query\'s second dimension on color, or remove "stack".');
    Object.entries(l.encode || {}).forEach(([ch, f]) => {
      if (typeof f === 'number') return;
      if (ch === 'size' && !(f.split('@')[0]! in catalog.metrics)) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on size, and a size is a quantity. Encode one of the query\'s metrics: ' + q.metrics.join(', ') + '.');
      // A companion of a field the query returns is the engine's to send, so it is looked for in the result. An empty result has none to show.
      const row = result.rows[0], of = f.split('@')[0]!;
      if (f !== of && known.indexOf(of) >= 0 && row && !(f in row)) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + ch + ', which the result does not return. With "' + of + '" it returns: ' + (Object.keys(row).filter((c) => c.split('@')[0] === of && c !== of).join(', ') || 'nothing') + '.');
      if (f !== of && known.indexOf(of) >= 0) return;
      if (known.indexOf(f) < 0) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + ch + ', which the query does not return. It returns: ' + known.join(', ') + '.');
    });
  });
  // A metric on x and on y is a point for each value of a dimension. With none there is one row at most.
  if (!by.length && layers.some((l) => l.encode && [l.encode.x, l.encode.y].every((f) => typeof f === 'string' && f in catalog.metrics))) throw new Error('These layers set one metric against another, and the query has no dimension, so there is no row to draw a point for. Add one to query.by, for example ["page"].');
  // Rows come back one per pair. A dimension that no layer encodes would leave several rows drawn in one place.
  const unused = by.length === 2 && layers.length ? by.find((d) => !layers.some((l) => Object.values(l.encode || {}).indexOf(d) >= 0)) : null;
  if (unused) throw new Error('The query is by "' + unused + '", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, or remove it from query.by.');
}

/** Fit a spec to a container. Throws, with a message that names the fix, when the spec is invalid. */
export function resolve(spec0: Spec, result: Result, container: Container, catalog: Catalog, presets: PresetLibrary = PRESETS): Plan {
  const spec = expand(spec0, presets), q = spec.query || ({} as Query);
  if (!q.metrics || !q.metrics.length) throw new Error('A view needs query.metrics, for example ["visitors"].');
  const m = q.metrics[0]!, M = catalog.metrics[m]!, by = (q.by || [])[0], rules = container.rules || CONTAINER_RULES, keep = spec.keep || [], dropped: string[] = [];
  let layers = (spec.layers || []).slice();
  if (!layers.length && by) throw new Error('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: ' + Object.keys(presets).join(', ') + '.');
  checkLayers(layers, q, catalog, result);
  if (layers.some(usesPrevious) && (q.compare !== 'previous' || result.totals[m + '@previous'] == null)) {
    const why = q.compare === 'previous' ? ' (no prior data)' : ' (the query has no "compare")';
    if (!result.meta.empty) [['previous', 'comparison series'], ['delta', 'the change on the previous period']].forEach(([series, what]) => { if (layers.some((l) => l.series === series)) dropped.push(what + why); });
    layers = layers.filter((l) => !usesPrevious(l));
  }
  const share = layers.some((l) => l.stack === 'normalize' || l.mark === 'arc');
  // A plot of points has no sparkline form: two metrics need both their axes to be read. So it has no bare rung, and
  // below the room its axes need it is the number alone. Its `points` rule says so, where the others' is `axes`.
  const points = !!layers.length && isPoints(catalog, layers);
  const p: PlanShape = { layout: layers.length ? detectLayout(catalog, layers) : 'none', layers, guides: {}, tldrValue: rules.tldrValue.above === 'always' || !!M.instant || !layers.length, side: false, rowLimit: null,
                         share, text: tldrProse(q, result, share, catalog, points) };
  if (p.layout === 'cartesian') p.guides = { x: true, y: true, grid: true };
  if (p.layout === 'matrix') { p.guides = { x: true, y: true, ramp: true }; p.text = gridProse(q, result, catalog) ?? p.text; }
  // A split plot starts with its legend. Its rules step that down to a label at the end of each line, where there
  // are lines, and then to nothing. They are asked once, of the view: unlike the reductions, they change no one else's room.
  const series = p.layout === 'cartesian' ? seriesOf(catalog, layers) : null;
  const short = (id: string, layout: Layout = 'cartesian') => { const r = ruleFor(rules.fit, layout, id); return !!r && !(r.keep && keep.indexOf(r.keep) >= 0) && applies(r, { view: { inline: container.width, block: container.height } }); };
  if (series) { if (!short('legend')) p.guides.legend = 'full'; else if (series.lines && !short('labels')) p.guides.legend = 'labels'; }
  // Layers that measure in two units have a y axis on each side, and the second is given up first.
  const twoUnits = p.layout === 'cartesian' && unitsOf(catalog, layers).length > 1;
  if (twoUnits && !short('axis-2')) p.guides.y2 = true;
  // Labels on the points go first, then the key to sizes. Both are asked once, as the legend is.
  const labelled = p.layout === 'cartesian' && layers.some((l) => l.mark === 'text'), sized = p.layout === 'cartesian' && layers.some((l) => l.encode && l.encode.size != null);
  if (labelled && !short('point-labels')) p.guides.pointLabels = true;
  if (sized && !short('size')) p.guides.size = true;
  if (p.layout === 'band') p.guides = { legend: 'full' };
  // A circle divided by a dimension has the band's legend. One that reads a metric against its range has none.
  if (p.layout === 'radial' && layers.some((l) => isDim(catalog, l.encode && l.encode.color))) p.guides = { legend: 'full' };
  if (result.meta.empty || (M.instant && !result.rows.length)) {
    if (M.instant || !layers.length) { p.layout = 'none'; p.layers = []; p.tldrValue = true; p.guides = {}; }
    else { p.layout = 'notice'; p.layers = []; p.guides = {}; p.tldrValue = false; }
  }

  const valueLen = tldrValueText(catalog, q, result, true).length;
  const rule = (id: string) => ruleFor(rules.fit, p.layout, id);
  // A row short of room gives up its ranked columns from the right: every column of values but the first. The room they
  // need is measured, so no rule can say it; the label's is the `marks` rule's. Headers stand over what is left, if that
  // is more than one column, and are a guide the view gives up when it is short. Both are asked once, as the legend is.
  // A track that stands beside its label asks for room of its own, by its own rule, as a plot of points does.
  const beside = () => (p.layout === 'rows' && trackBeside(p.layers) && rule('track')) || undefined;
  if (p.layout === 'rows') {
    const label = (beside() || rule('marks'))?.needs.inline ?? 0;
    for (let cols = columnsOf(catalog, p.layers); cols.length > 1 && container.width < label + valueRoomOf(catalog, p.layers, result.rows); cols = columnsOf(catalog, p.layers)) {
      const last = cols[cols.length - 1]!;
      p.layers = p.layers.filter((l) => l !== last);
      dropped.push('the "' + columnLabel(catalog, last) + '" column');
    }
    if (columnsOf(catalog, p.layers).length > 1 && !short('columns', 'rows')) p.guides.columns = true;
  }
  // The view rule the layout stands on now, and the room beside its part that only measuring gives:
  // a number wider than the bare plot's rule allows it, or a row's widest value.
  function guard(): { rule?: FitRule; measured: number } {
    if (p.layout === 'cartesian') return p.side ? { rule: rule('marks'), measured: Math.max(0, container.displayWidth(valueLen) - rules.bare.numberWidth) } : { rule: (points && rule('points')) || rule('axes'), measured: 0 };
    if (p.layout === 'rows') return { rule: beside() || rule('marks'), measured: valueRoomOf(catalog, p.layers, result.rows) };
    if (p.layout === 'band') return { rule: rule(p.guides.legend === 'full' ? 'legend' : 'marks'), measured: 0 };
    if (p.layout === 'radial') return { rule: rule(p.guides.legend === 'full' ? 'legend' : 'marks'), measured: 0 };
    if (p.layout === 'matrix') return { rule: rule(p.guides.ramp && keep.indexOf('guides') < 0 ? 'ramp' : 'marks'), measured: 0 };   // a ramp the spec keeps asks for no room of its own
    return { rule: rule('notice'), measured: 0 };
  }
  // A number that stands alone or above the marks has to fit too. No rule can say so: the need is its own width.
  const numberWidth = () => (p.layout === 'none' || (p.tldrValue && !p.side && p.layout !== 'prose') ? container.displayWidth(valueLen) : 0);
  function minWidth(): number {
    const g = guard();
    return Math.max(((g.rule && g.rule.needs.inline) || 0) + g.measured, numberWidth());
  }
  // The number alone with all it has, as tall as it would be with no height limit.
  const alone = (shape: PlanShape) => place(buildScene(shape, q, result, catalog), { ...container, height: null }).height;
  let scene!: PlacedScene;
  function fits(): boolean {
    scene = place(buildScene(p, q, result, catalog), container);
    if (p.layout === 'prose') return true;
    const g = guard(), view = { inline: container.width, block: container.height };
    if (view.inline < numberWidth() || (g.rule && applies(g.rule, { view: { inline: view.inline - g.measured, block: view.block } }))) return false;
    // A rule's block need is the least its part can take. What the view really takes depends on its content, so the scene is measured as well.
    if (container.height != null && scene.height > container.height) return false;
    const secondary = rule('secondary');
    if (secondary && scene.plot && p.layers.some((l) => roleOf(l) !== 'primary')) return !applies(secondary, { view, plot: { inline: scene.plot.w, block: scene.plot.h } });
    return true;
  }
  const act: Record<ReductionId, () => string | null> = {
    'drop-guides': () => {
      if (p.layout === 'cartesian' && points) return null;                 // no bare plot: the next step that applies is the number
      if (p.layout === 'cartesian' && (p.guides.x || p.guides.y || p.guides.grid)) { p.guides = { x: false, y: false, grid: false }; p.tldrValue = true; p.side = true; return 'axes and grid (added the number to make up for them)'; }
      if (p.layout === 'band' && p.guides.legend === 'full') { p.guides = { legend: 'top' }; return 'the legend, except the largest segment'; }
      // A circle steps down as a band does, and then once more: it is still worth drawing with no legend at all.
      if (p.layout === 'radial' && p.guides.legend) {
        if (p.guides.legend === 'full') { p.guides = { legend: 'top' }; if (fits()) return 'the legend, except the largest segment'; }
        p.guides = {};
        return 'the legend';
      }
      if (p.layout === 'matrix' && p.guides.ramp) { p.guides = { ...p.guides, ramp: false }; return 'the colour ramp'; }
      return null;
    },
    'drop-secondary': () => {
      if (p.layout === 'rows') return null;                                // rows have no rule about roles: giving one up would win a row no room
      const gone = p.layers.filter((l) => roleOf(l) !== 'primary');
      if (!gone.length) return null;
      p.layers = p.layers.filter((l) => roleOf(l) === 'primary');
      if (!p.layers.length) { p.layout = 'none'; p.tldrValue = true; p.side = false; p.guides = {}; }
      return gone.map((l) => ROLE_NAMES[roleOf(l)] || roleOf(l) + ' layers').filter((s, i, a) => a.indexOf(s) === i).join(', ');
    },
    'trim-rows': () => {
      if (p.layout !== 'rows' || container.height == null) return null;
      const n = result.rows.length, cur = p.rowLimit || n, rh = rules.rows.rowHeight + rules.rows.gap;
      const above = p.tldrValue ? alone({ ...p, layout: 'none', layers: [] }) + 16 : 0;
      const k = Math.max(1, Math.floor((container.height - above - (p.guides.columns ? COLUMNS_BLOCK : 0) + rules.rows.gap) / rh));
      if (k >= cur) return null;
      p.rowLimit = k;
      return k + 1 === n ? 'row ' + n : 'rows ' + (k + 1) + ' to ' + n;
    },
    'collapse': () => {
      if (p.layout === 'none') return null;
      const was = p.layout; p.layout = 'none'; p.layers = []; p.guides = {}; p.tldrValue = true; p.side = false; p.rowLimit = null;
      return was === 'notice' ? 'the empty-state notice' : 'all marks (kept the number)';
    },
    'prose': () => { p.layout = 'prose'; p.layers = []; p.guides = {}; p.tldrValue = false; p.side = false; return 'the number (kept the sentence)'; },
  };
  const steps: Reduction[] = rules.order.map((id) => ({ id, state: 'not needed' }));
  let done = fits();
  steps.forEach((st) => {
    if (done) return;
    const kept = KEEP[st.id];
    if (kept && keep.indexOf(kept) >= 0) { st.state = 'kept by the spec'; return; }
    const what = act[st.id]();
    if (what) { st.state = 'applied'; dropped.push(what); done = fits(); } else st.state = 'nothing to drop';
  });
  // place() gives up the note of a number that stands alone before the reducer gives up the number. Said here, as the middle label is.
  if (p.layout === 'none' && container.height != null && alone(p) > container.height) dropped.push('the note under the number');
  if (p.layout === 'cartesian' && p.guides.x && series && p.guides.legend !== 'full') dropped.push(p.guides.legend === 'labels' ? 'the legend (kept a label at the end of each line)' : 'the legend');
  if (p.layout === 'cartesian' && p.guides.y && twoUnits && !p.guides.y2) dropped.push('the second y axis');
  // place() leaves the number out of a hole too small for it, by the `hole` rule and by the number's own width.
  if (p.layout === 'radial' && buildScene(p, q, result, catalog).parts.includes('hole') && !scene.nodes.some((n) => n.key === 'hole')) dropped.push('the number in the hole');
  if (p.layout === 'cartesian' && p.guides.x && labelled && !p.guides.pointLabels) dropped.push('the labels on the points');
  if (p.layout === 'cartesian' && p.guides.x && sized && !p.guides.size) dropped.push('the key to sizes');
  if (p.layout === 'rows' && columnsOf(catalog, p.layers).length > 1 && !p.guides.columns) dropped.push('the column headers');
  const midTick = rule('mid-tick');
  if (p.layout === 'cartesian' && p.guides.x && midTick && applies(midTick, { view: { inline: container.width } }) && catalog.dimensions[xDimOf(catalog, p.layers)!]?.type === 'time') dropped.push('the middle date label');

  return {
    preset: spec0.use && !spec0.layers ? spec0.use : null, layout: p.layout,
    layers: p.layers.map((l) => Object.assign({}, l, { role: roleOf(l) })),
    guides: p.guides, tldrValue: p.tldrValue, side: p.side, rowLimit: p.rowLimit, share: p.share,
    reductions: steps, dropped, needs: { width: minWidth(), height: scene.height }, text: p.text,
  };
}
