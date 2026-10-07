import { CONTAINER_RULES, KEEP } from './container.ts';
import { PRESETS, expand } from './presets.ts';
import { place } from './place.ts';
import { buildScene, tldrValueText, isDim, valueRoomOf } from './scene.ts';
import { tldrProse } from './prose.ts';
import type { Catalog, Container, Layer, Layout, Plan, PlanShape, PresetLibrary, Query, Reduction, ReductionId, Result, Role, PlacedScene, Spec } from './types.ts';

/* Start from everything the spec asks for, then apply the container's reductions
 * in order until the view fits. Layers carry a role; reductions act on roles. */
const ROLE_NAMES: Partial<Record<Role, string>> = { comparison: 'comparison series', reference: 'reference lines', context: 'context fill' };

export function roleOf(l: Layer): Role {
  return l.role || (l.series === 'previous' ? 'comparison' : l.mark === 'rule' ? 'reference' : 'primary');
}

function detectLayout(catalog: Catalog, layers: Layer[]): Layout {
  if (layers.some((l) => l.encode && isDim(catalog, l.encode.x))) return 'cartesian';
  if (layers.some((l) => l.encode && isDim(catalog, l.encode.y))) return 'rows';
  if (layers.some((l) => l.encode && isDim(catalog, l.encode.color))) return 'band';
  throw new Error('These layers put no dimension on x, y or color, so there is nothing to lay out.');
}

function checkLayers(layers: Layer[], q: Query): void {
  const known = (q.by || []).concat(q.metrics);
  layers.forEach((l, i) => {
    if (!l || !l.mark) throw new Error('Layer ' + (i + 1) + ' has no "mark". Use one of: line, area, bar, rule, text.');
    Object.entries(l.encode || {}).forEach(([ch, f]) => {
      if (typeof f === 'number') return;
      if (known.indexOf(f) < 0) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + ch + ', which the query does not return. It returns: ' + known.join(', ') + '.');
    });
  });
}

/** Fit a spec to a container. Throws, with a message that names the fix, when the spec is invalid. */
export function resolve(spec0: Spec, result: Result, container: Container, catalog: Catalog, presets: PresetLibrary = PRESETS): Plan {
  const spec = expand(spec0, presets), q = spec.query || ({} as Query);
  if (!q.metrics || !q.metrics.length) throw new Error('A view needs query.metrics, for example ["visitors"].');
  const m = q.metrics[0]!, M = catalog.metrics[m]!, by = (q.by || [])[0], rules = container.rules || CONTAINER_RULES, keep = spec.keep || [], dropped: string[] = [];
  let layers = (spec.layers || []).slice();
  if (!layers.length && by) throw new Error('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: ' + Object.keys(presets).join(', ') + '.');
  checkLayers(layers, q);
  if (layers.some((l) => l.series === 'previous') && (q.compare !== 'previous' || result.totals[m + '@previous'] == null)) {
    layers = layers.filter((l) => l.series !== 'previous');
    if (!result.meta.empty) dropped.push(q.compare === 'previous' ? 'comparison series (no prior data)' : 'comparison series (the query has no "compare")');
  }
  const share = layers.some((l) => l.stack === 'normalize');
  const p: PlanShape = { layout: layers.length ? detectLayout(catalog, layers) : 'none', layers, guides: {}, tldrValue: rules.tldrValue.above === 'always' || !!M.instant || !layers.length, side: false, rowLimit: null,
                         share, text: tldrProse(q, result, share, catalog) };
  if (p.layout === 'cartesian') p.guides = { x: true, y: true, grid: true };
  if (p.layout === 'band') p.guides = { legend: 'full' };
  if (result.meta.empty || (M.instant && !result.rows.length)) {
    if (M.instant || !layers.length) { p.layout = 'none'; p.layers = []; p.tldrValue = true; p.guides = {}; }
    else { p.layout = 'notice'; p.layers = []; p.guides = {}; p.tldrValue = false; }
  }

  const valueLen = tldrValueText(catalog, q, result, true).length;
  const sideMin = Math.max(76, container.displayWidth(valueLen));
  function minWidth(): number {
    let w = 0;
    if (p.layout === 'none') w = container.displayWidth(valueLen);
    else if (p.layout === 'notice') w = rules.notice.minWidth;
    else if (p.layout === 'cartesian') w = p.side ? sideMin + 12 + rules.bare.minPlotWidth : (p.guides.x || p.guides.y) ? rules.axes.minWidth : rules.bare.minPlotWidth;
    else if (p.layout === 'rows') w = valueRoomOf(catalog, p.layers, result.rows) + rules.rows.minLabelWidth;
    else if (p.layout === 'band') w = p.guides.legend === 'full' ? rules.band.minWidthWithLegend : rules.band.minWidth;
    return p.tldrValue && !p.side && p.layout !== 'prose' ? Math.max(w, container.displayWidth(valueLen)) : w;
  }
  let scene!: PlacedScene;
  function fits(): boolean {
    scene = place(buildScene(p, q, result, catalog), container);
    if (p.layout === 'prose') return true;
    if (container.width < minWidth()) return false;
    if (container.height != null && scene.height > container.height) return false;
    if (p.layout === 'cartesian' && scene.plot && p.layers.some((l) => roleOf(l) !== 'primary'))
      return scene.plot.w >= rules.secondary.minPlotWidth && scene.plot.h >= rules.secondary.minPlotHeight;
    return true;
  }
  const act: Record<ReductionId, () => string | null> = {
    'drop-guides': () => {
      if (p.layout === 'cartesian' && (p.guides.x || p.guides.y || p.guides.grid)) { p.guides = { x: false, y: false, grid: false }; p.tldrValue = true; p.side = true; return 'axes and grid (added the number to make up for them)'; }
      if (p.layout === 'band' && p.guides.legend === 'full') { p.guides = { legend: 'top' }; return 'the legend, except the largest segment'; }
      return null;
    },
    'drop-secondary': () => {
      const gone = p.layers.filter((l) => roleOf(l) !== 'primary');
      if (!gone.length) return null;
      p.layers = p.layers.filter((l) => roleOf(l) === 'primary');
      if (!p.layers.length) { p.layout = 'none'; p.tldrValue = true; p.side = false; p.guides = {}; }
      return gone.map((l) => ROLE_NAMES[roleOf(l)] || roleOf(l) + ' layers').filter((s, i, a) => a.indexOf(s) === i).join(', ');
    },
    'trim-rows': () => {
      if (p.layout !== 'rows' || container.height == null) return null;
      const n = result.rows.length, cur = p.rowLimit || n, rh = rules.rows.rowHeight + rules.rows.gap;
      const above = p.tldrValue ? place(buildScene({ ...p, layout: 'none', layers: [] }, q, result, catalog), container).height + 16 : 0;
      const k = Math.max(1, Math.floor((container.height - above + rules.rows.gap) / rh));
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
  if (p.layout === 'cartesian' && p.guides.x && container.width < 380 && isDim(catalog, by) && catalog.dimensions[by]!.type === 'time') dropped.push('the middle date label');

  return {
    preset: spec0.use && !spec0.layers ? spec0.use : null, layout: p.layout,
    layers: p.layers.map((l) => Object.assign({}, l, { role: roleOf(l) })),
    guides: p.guides, tldrValue: p.tldrValue, side: p.side, rowLimit: p.rowLimit, share: p.share,
    reductions: steps, dropped, needs: { width: minWidth(), height: scene.height }, text: p.text,
  };
}
