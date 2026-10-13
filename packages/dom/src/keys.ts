import { formatBin, formatDimension, formatValue, layerKeys, partialNote, plural, rowKeys, unitsOf, type Catalog, type Layer, type Query, type RectNode, type Result, type Row, type Scene } from '@unified-analytics/core';
import { attr, ensure, paintVar, prop } from './dom.ts';
import { apart } from './measure.ts';
import { FOCUS, HOVER, token } from './tokens.ts';
import { nearest } from './layouts/points.ts';

/* Hit targets, the keyboard and the readout. A layout marks the element that holds its points with `data-hits`
 * ("x" where they run across, "y" where they run down), and each point is a child carrying `data-row`. Bars in a
 * list and segments of a band are their own targets. A plot has no element per point, so it gets a layer of them.
 *
 * The keyboard is version 4's, read from `useKeyboardNavigation` on Jetpack trunk: one tab stop, nothing chosen on
 * focus, left and right step and stop at the ends, Enter or Space activates the chosen point, Escape lets go of it
 * and Tab moves on. To assistive technology the holder is a listbox and each point an option named by its readout,
 * so the words on screen and the words announced are one string.
 *
 * A plot split into series has several values at each point. The point's readout says them all, and up and down
 * step through the series there: up from the whole point to the first series, which is the foot of a stack, and
 * down again to the whole. Left and right keep the series. Version 4 was not read for this; it is ours until it is.
 *
 * A plot split by `detail` has series in one paint and no legend, and may have any number of them. Its point says how
 * many there are and which has the most, and not every one. Up and down step through them as they do through
 * colours, one at a time in the engine's order: a chosen one stands out of the mass, which is the one way to read a
 * single line of many. ponytail: one press a series, so the fortieth of forty is forty presses away. Home, End and a
 * step of several would shorten it, if a plot of that many is ever read by keyboard. */

/** The companions of a metric the view asked for: the fields of `row` that came with `m` and that one of the plan's
 * layers encodes, in the engine's order. A result may carry more, and those are not the view's to say. The comparison
 * is not one of these: the query asks for it. The readout and the table both list by this. */
export function companions(m: string, row: Row | undefined, layers: Layer[]): string[] {
  return Object.keys(row ?? {}).filter((f) => f.startsWith(m + '@') && f !== m + '@previous' && layers.some((l) => Object.values(l.encode || {}).includes(f)));
}

/** What the readout says for one row of the result, in the catalog's formats: the dimension value, each metric
 * (marked when its bucket is unfinished), its comparison if the row has one, and each companion of it that a layer
 * encodes, under its suffix: what a range or a tick is drawn from is said as well as shown. */
export function readout(row: Row, q: Query, catalog: Catalog, layers: Layer[]): string {
  // A bin is named by both its ends, as its label on an axis is.
  // Two bins are each named by their dimension as well: two bare ranges do not say which is which.
  const both = (q.by || []).filter((d) => row[d + '@end'] != null).length > 1;
  const dims = (q.by || []).map((d) => (row[d + '@end'] == null ? formatDimension(row[d], catalog.dimensions[d]!) : (both ? catalog.dimensions[d]!.label + ' ' : '') + formatBin(row[d], row[d + '@end']))).join(', '), partial = partialNote(row);
  const values = q.metrics.map((m) => {
    const def = catalog.metrics[m]!, prev = q.compare === 'previous' ? row[m + '@previous'] : null;
    const more = companions(m, row, layers).filter((f) => row[f] != null).map((f) => ', ' + f.slice(m.length + 1) + ' ' + formatValue(row[f] as number, def)).join('');
    return def.label + ' ' + formatValue(row[m] as number | null, def) + (partial && ' ' + partial) + (prev == null ? '' : ', previous period ' + formatValue(prev as number, def)) + more;
  }).join('; ');
  return dims ? dims + ': ' + values : values;
}

/** Whether a row's own words already say every value its readout would: each metric's, the period before where the
 * query compares, and what the engine sent with it. Such a row has no readout to show: it would be the row again.
 * ponytail: by the values alone. A label cut short for room is not counted as unsaid; the table has it whole. */
export function written(shown: string, row: Row, q: Query, catalog: Catalog, layers: Layer[]): boolean {
  return q.metrics.every((m) => {
    const def = catalog.metrics[m]!, also = q.compare === 'previous' && row[m + '@previous'] != null ? [m + '@previous'] : [];
    return [m, ...also, ...companions(m, row, layers).filter((f) => row[f] != null)].every((f) => shown.includes(formatValue(row[f] as number | null, def)));
  });
}

/** What the readout says for one point of a split plot, from the rows there: the x value, each metric with the
 * engine's total for that x when the result has one, and the value of every series. With `mass`, where the series
 * are in one paint and may be many, it says how many there are and the one with the most there, by name: a comparison
 * of the engine's rows, as the prose's leader is. */
export function readoutAt(rows: Row[], total: Row | undefined, q: Query, catalog: Catalog, x: string, split: string, mass = false): string {
  const first = rows[0] ?? {}, partial = partialNote(first), of = catalog.dimensions[split]!;
  return formatDimension(first[x], catalog.dimensions[x]!) + ': ' + q.metrics.map((m) => {
    const def = catalog.metrics[m]!, said = (r: Row) => formatDimension(r[split], of) + ' ' + formatValue(r[m] as number | null, def);
    const top = rows.filter((r) => r[m] != null).reduce<Row | undefined>((a, r) => (!a || (r[m] as number) > (a[m] as number) ? r : a), undefined);
    return def.label + (total ? ' ' + formatValue(total[m] as number | null, def) + (partial && ' ' + partial) : '')
      + ' (' + (mass ? rows.length + ' ' + (rows.length === 1 ? of.label.toLowerCase() : plural(of.label.toLowerCase())) + (top ? ', the most ' + said(top) : '') : rows.map(said).join(', ')) + ')';
  }).join('; ');
}

/** The rows of the result at each point of the scene. One each, in step, unless the plot is split into series:
 * then `x` and `split` name the two dimensions, and a point has a row per series, in the series' order, whether they
 * are painted apart (`scene.series`) or not (`scene.detail`). A point is
 * found by the key core gave its rows (rowKeys), never by their value: two rows may say one value, and each has a
 * point of its own. */
export function rowsAt(scene: Scene, q: Query, result: Result): { rows: Row[][]; x?: string | undefined; split?: string } {
  const keys = scene.rows ?? [], by = q.by || [], order = scene.series ?? scene.detail ?? [];
  // ponytail: scene.rows and result.rows are taken to run in step, as every scene builder with no split makes them.
  if (!order.length || by.length !== 2) return { rows: keys.map((_, i) => (result.rows[i] ? [result.rows[i]!] : [])), x: by[0] };
  const x = by.find((d) => result.rows.length > 0 && keys.includes(String(result.rows[0]![d]))) ?? by[0]!, split = by.find((d) => d !== x)!;
  const rank = (r: Row) => order.indexOf(String(r[split])), own = rowKeys(result.rows, x, split);
  return { rows: keys.map((k) => result.rows.filter((r) => own.get(r) === k).sort((a, b) => rank(a) - rank(b))), x, split };
}

/** A value a crosshair marks at one point of a plot: how far up the plot it is, what it says, which y axis it is read
 * on (the second unit's is the far one), and the line it is a point of. */
export interface CrossMark { t: number; text: string; side: 0 | 1; role?: string; series?: string }

/** What each line of a plot draws at each of its rows, by row: a line's value there, in its metric's format, and where
 * the scene set it. A line is read against the axes, so these are what a crosshair says on them. A filled area says
 * nothing of its own, and neither does a bar or a dot, which wears the outline and keeps the readout.
 * `rows` are the result's at each point, as rowsAt() gives them, and `split` the dimension a split plot's series are of. */
export function crossMarks(scene: Scene, layers: Layer[], rows: Row[][], catalog: Catalog, split?: string): Map<string, CrossMark[]> {
  const out = new Map<string, CrossMark[]>(), keys = scene.rows ?? [];
  if (scene.layout !== 'cartesian') return out;
  const ids = layerKeys(layers), units = unitsOf(catalog, layers), seen = new Set<string>();
  layers.forEach((l, li) => {
    const y = l.encode?.y, def = typeof y === 'string' ? catalog.metrics[y.split('@')[0]!] : undefined;
    if (l.mark !== 'line' || typeof y !== 'string' || !def) return;
    const prev = l.series === 'previous', field = prev ? y + '@previous' : y, side = units.indexOf(unitsOf(catalog, [l])[0]!) > 0 ? 1 : 0;
    for (const n of scene.nodes) {
      // A line's unfinished tail, and an unfinished lead, are paths of their own, and the row where two meet is in both.
      if (n.kind !== 'path' || n.fill || n.part !== 'plot' || n.key.replace(/:partial(:lead)?$/, '') !== (n.series == null ? ids[li] : ids[li] + ':' + n.series)) continue;
      for (const p of n.points) {
        const at = rows[keys.indexOf(p.row)] ?? [], row = n.series == null ? at[0] : at.find((r) => String(r[split!]) === n.series), id = li + ':' + (n.series ?? '') + ':' + p.row;
        if (row?.[field] == null || seen.has(id)) continue;
        seen.add(id);
        const partial = prev ? '' : partialNote(row);
        out.set(p.row, (out.get(p.row) ?? []).concat({ t: p.v, text: formatValue(row[field] as number, def) + (partial && ' ' + partial), side, ...(n.role && { role: n.role }), ...(n.series != null && { series: n.series }) }));
      }
    }
  });
  return out;
}

/** Where up and down move to among the series at one point, from `at` (-1 when the whole point is chosen). Null
 * when the key is not such a step. It stops at the last series, and at the whole point on the way back. */
export function stepSeries(key: string, at: number, count: number): number | null {
  const d = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
  return d && count ? Math.min(Math.max(at + d, -1), count - 1) : null;
}

/** Where a key moves to among `count` points, from `at` (-1 when none is chosen). Null when the key is not a step.
 * Up and down step only where the points run down the page. Where they run across it from the right, `rtl`, left is
 * the way on and right the way back: an arrow moves the way it points. */
export function step(key: string, at: number, count: number, vertical = false, rtl = false): number | null {
  const on = rtl ? 'ArrowLeft' : 'ArrowRight', back = rtl ? 'ArrowRight' : 'ArrowLeft';
  const d = key === on || (vertical && key === 'ArrowDown') ? 1 : key === back || (vertical && key === 'ArrowUp') ? -1 : 0;
  return d && count ? Math.min(Math.max(at + d, 0), count - 1) : null;
}

/** The hit targets of a plot: one per row that drew a mark, tiling the plot from edge to edge, each reaching half
 * way to its neighbours. `c` is where the row's own x falls inside its target, for the rule that marks it: the
 * middle of its bars taken together, since a group has several side by side. */
export function hitNodes(scene: Scene): (RectNode & { c: number })[] {
  const cx = new Map<string, number>(), bars = new Map<string, [lo: number, hi: number]>();
  for (const n of scene.nodes) {
    if (n.part !== 'plot') continue;
    if (n.kind === 'rect' && n.row != null && n.x != null) { const b = bars.get(n.row); bars.set(n.row, [Math.min(b?.[0] ?? n.x, n.x), Math.max(b?.[1] ?? n.x, n.x + (n.w || 0))]); }
    else if (n.kind === 'path') for (const p of n.points) cx.set(p.row, p.x);
    else if (n.kind === 'circle' && n.row != null && n.x != null) cx.set(n.row, n.x);       // a dot on a time or category axis
    else if (n.kind === 'line' && n.row != null && n.x != null) cx.set(n.row, (n.x + (n.x2 ?? n.x)) / 2);   // a row's rule, or its tick
  }
  bars.forEach(([lo, hi], row) => cx.set(row, lo + (hi - lo) / 2));
  const at = (scene.rows ?? []).filter((r) => cx.has(r)).map((r) => [r, cx.get(r)!] as const);
  return at.map(([row, x], i) => {
    const lo = i ? (at[i - 1]![1] + x) / 2 : 0, hi = i < at.length - 1 ? (x + at[i + 1]![1]) / 2 : 1;
    return { key: 'hit:' + row, part: 'plot', kind: 'rect', row, x: lo, w: hi - lo, c: hi > lo ? (x - lo) / (hi - lo) : 0.5, paint: 'rule', layer: 'guide' };
  });
}

/* Nothing here changes a size the measured pass reads: the readout is out of flow, and a chosen point gains only
 * an outline, an underline, a tint or a rule.
 *
 * A chosen mark says how it was chosen: `data-active` is "keys" or "pointer". The holder with focus and the mark an
 * arrow key chose in it wear one outline (FOCUS in tokens.ts): inside a holder and a row, which are clipped at their
 * edge, about a mark that stands free, and as the edge of a shape in an SVG. What the pointer is over wears the
 * quieter one (HOVER): a hairline in those places, and a tint behind a row. A plot of lines has no mark at a point to
 * wear either, so a rule stands there, in the width and colour of whichever it is; where a bar or a dot is there to
 * wear it, the rule goes. */
export const KEYS_CSS = `
:is([data-hits], .uav-cells):focus-visible { ${FOCUS.inside} }
/* A row's bar and its text are positioned, and so are the rows of a list, so they are painted over an outline drawn
 * inside the row or the list that holds them. There the outline is a box of its own, over them all. */
.uav-rows:focus-visible { outline: none; }
.uav-rows:focus-visible::after, .uav-row[data-active="keys"]::after { content: ""; position: absolute; inset: 0; pointer-events: none; ${FOCUS.inside} }
:is(.uav-bars, .uav-dots, .uav-points, .uav-band, .uav-cells) [data-active="keys"] { ${FOCUS.around} }
svg[data-hits] path[data-active="keys"] { ${FOCUS.stroke} }
.uav-row[data-active="pointer"] { ${HOVER.row} }
:is(.uav-bars, .uav-dots, .uav-points, .uav-band, .uav-cells) [data-active="pointer"] { ${HOVER.around} }
svg[data-hits] path[data-active="pointer"] { ${HOVER.stroke} }
.uav-readout { position: absolute; z-index: 1; left: 0; top: 0; box-sizing: border-box; inline-size: max-content; max-inline-size: 100%; padding: 2px 6px; border-radius: ${token('border-radius-tooltip')};
  pointer-events: none; font-family: ${token('font-family-tick')}; font-size: var(--uav-font-tick); font-optical-sizing: none; font-variant-numeric: tabular-nums;
  color: ${token('color-label-inverse')}; background: ${token('color-tooltip-surface')}; box-shadow: ${token('elevation-tooltip')}; }
/* In the top layer it is placed on the screen, over whatever holds the view, and is as wide as its words up to a width of its own. */
.uav-readout[popover] { position: fixed; inset: auto; margin: 0; border: 0; overflow: visible; max-inline-size: min(320px, 100vw - 8px); }
/* A line is read against the axes, so at a point of one the readout is a crosshair: the rule that stands at the point,
 * one that lies at each line's value there, and that value said on the axis it is read from, with the point's own
 * name on the x axis. It is drawn in the plot's box and its words stand over the tick labels they are among. A value
 * wider than its axis's gutter grows into the plot and never out of the view. The second line of a comparison is
 * said more quietly, on the secondary surface. */
/* The crosshair's words hang past the plot, over the axes. The plot is a layer of its own, so it is the plot that is
 * raised while it has a crosshair, or the axis labels after it would be drawn over them. */
.uav-plot:has(> .uav-cross) { z-index: 2; }
.uav-cross { position: absolute; inset: 0; z-index: 1; pointer-events: none; --uav-rule: ${HOVER.width}; --uav-rule-paint: ${paintVar('rule')}; }
.uav-cross[data-active="keys"] { --uav-rule: ${FOCUS.width}; --uav-rule-paint: ${FOCUS.color}; }
.uav-cross i { position: absolute; inset-inline: 0; inset-block-start: calc((1 - var(--uav-t)) * 100% - var(--uav-rule) / 2); block-size: var(--uav-rule); background: var(--uav-rule-paint); }
.uav-cross span { position: absolute; box-sizing: border-box; padding: 1px 5px; border-radius: ${token('border-radius-tooltip')}; white-space: nowrap;
  font-family: ${token('font-family-tick')}; font-size: var(--uav-font-tick); font-optical-sizing: none; font-variant-numeric: tabular-nums; color: ${token('color-label-inverse')}; background: ${token('color-tooltip-surface')}; box-shadow: ${token('elevation-tooltip')}; }
.uav-cross-x { inset-block-start: calc(100% + 3px); unicode-bidi: plaintext; }
.uav-cross-y { translate: 0 -50%; text-align: end; }
.uav-cross-y[data-side="1"] { text-align: start; }
.uav-cross-y[data-role="comparison"] { background: ${token('color-tooltip-surface-secondary')}; }
.uav-cross [data-thin] { visibility: hidden; }
/* A row that says its own value has told the reader what the readout would, so there the readout waits, as a tooltip
 * does, and is not in the way of the list. A mark that is read against an axis, a ramp or a legend says no number, so
 * its readout comes at once. It waits only to appear: once it is up it follows the pointer or the keys from row to
 * row, and it is hidden again by leaving. The words a screen reader is given do not wait.
 * The readout is taken out with \`hidden\`, so its first style is where the wait starts from. */
.uav:has(.uav-row > .uav-f-value) > .uav-readout { transition: visibility 0s ${token('motion-delay-tooltip')}; }
@starting-style { .uav:has(.uav-row > .uav-f-value) > .uav-readout { visibility: hidden; } }
.uav-hits { position: absolute; inset: 0; }
.uav-body[data-scale="point"] .uav-hits { inset-inline: 2px; }
.uav-hits i { position: absolute; inset-block: 0; inset-inline-start: calc(var(--uav-x) * 100%); inline-size: calc(var(--uav-w) * 100%); }
/* Hit targets are not marks. On a data change they take their new places at once, and one whose row has gone
 * goes at once: motion.ts keeps a leaving node only while --uav-leaving is set. */
.uav[data-moving] .uav-hits [data-key] { transition: none; }
.uav[data-moving] .uav-plot .uav-hits [data-exit] { --uav-leaving: initial; transition: none; }
.uav-hits [data-active] { --uav-rule: ${HOVER.width}; --uav-rule-paint: ${paintVar('rule')}; }
.uav-hits [data-active="keys"] { --uav-rule: ${FOCUS.width}; --uav-rule-paint: ${FOCUS.color}; }
.uav-hits [data-active]::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: calc(var(--uav-c) * 100% - var(--uav-rule) / 2); inline-size: var(--uav-rule); background: var(--uav-rule-paint); }
.uav-plot:has(:is(.uav-bars, .uav-dots) > [data-active]) .uav-hits [data-active]::before { display: none; }
.uav-legend span[data-active] { text-decoration: underline; }
/* A series chosen at a point: the rest of the plot stands back, and its name is marked wherever it is written. */
.uav-plot:has([data-chosen]) :is(.uav-bars i, path):not([data-chosen]) { opacity: 0.3 !important; }
/* In a plot split by detail every line is drawn light, so that many together read darker. The one chosen is drawn whole. */
.uav-body[data-mass] .uav-plot path[data-chosen] { opacity: 1 !important; }
:is(.uav-legend, .uav-labels) span[data-chosen] { text-decoration: underline; }`;

/** A view's readout: one element, the figure's own, which every layout that says what is under the pointer sets.
 * In the top layer where there is one, so nothing that holds the view can clip it: a card, a scrolling panel. */
export function readoutOf(fig: HTMLElement): HTMLElement {
  const tip = ensure(fig, 'div', 'uav-readout');
  if (typeof tip.showPopover === 'function') tip.setAttribute('popover', 'manual');
  return tip;
}
/** Take the readout away. */
export function hideReadout(tip: HTMLElement): void {
  tip.hidden = true;
  watching.get(tip)?.abort(); watching.delete(tip);
  if (tip.hasAttribute('popover') && tip.isConnected && tip.matches(':popover-open')) tip.hidePopover();
}
// What is listening for the scroll that takes a shown readout away. Let go when it is hidden, however that came about.
const watching = new WeakMap<HTMLElement, AbortController>();
/** Show the readout, with the words it already has, at a point: over the point's middle, `--uav-c` along it where
 * the point says, and above it, or below where there is no room above.
 * ponytail: placed once, when chosen. It does not follow a resize, and a scroll takes it away. */
export function placeReadout(tip: HTMLElement, fig: HTMLElement, point: HTMLElement): void {
  tip.hidden = false;
  const floats = tip.hasAttribute('popover') && tip.isConnected;
  if (floats && !tip.matches(':popover-open')) {
    tip.showPopover();
    // It is set on the screen and not in the page, so it would be left behind by a scroll. It goes instead. A scroll
    // does not leave the shadow tree it happens in, so every tree the view is inside is listened to, and the window.
    const gone = new AbortController(), heard = { capture: true, passive: true, signal: gone.signal };
    watching.set(tip, gone);
    for (let node: Node | null = fig; node; node = node instanceof ShadowRoot ? node.host : null) {
      node = node.getRootNode();
      node.addEventListener('scroll', () => hideReadout(tip), heard);
    }
    addEventListener('scroll', () => hideReadout(tip), heard);
  }
  const f = fig.getBoundingClientRect(), r = point.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const c = parseFloat(point.style.getPropertyValue('--uav-c')), mid = r.left + r.width * (Number.isFinite(c) ? c : 0.5);
  if (floats) {
    // On the screen, a little in from its edge.
    const above = r.top - h - 2;
    tip.style.setProperty('left', Math.max(4, Math.min(mid - w / 2, document.documentElement.clientWidth - w - 4)) + 'px');
    tip.style.setProperty('top', (above >= 4 ? above : r.bottom + 2) + 'px');
    return;
  }
  // Without a top layer: always inside the view, over its top where it is too small for above or below, because whatever
  // holds a view may clip at its edge. Rects are in the page's px and the readout is placed in the figure's own: under a
  // transform the two differ, by kx and ky.
  const W = fig.offsetWidth, H = fig.offsetHeight, kx = W > 0 && f.width > 0 ? W / f.width : 1, ky = H > 0 && f.height > 0 ? H / f.height : 1;
  const x = (mid - f.left) * kx - w / 2, above = (r.top - f.top) * ky - h - 2, below = (r.bottom - f.top) * ky + 2;
  tip.style.setProperty('left', Math.max(0, Math.min(x, f.width * kx - w)) + 'px');
  tip.style.setProperty('top', (above >= 0 ? above : below + h <= f.height * ky ? below : 0) + 'px');
}

/** The interaction of one view. It listens on the body, which outlives every paint, so nothing is bound per point. */
export class Keys {
  #host: HTMLElement; #fig: HTMLElement; #body: HTMLElement; #tip: HTMLElement;
  #keys: string[] = []; #rows: Row[][] = []; #says: string[] = [];
  #at: string | null = null;
  // The series of a split plot, the one chosen at the point, and what a readout of one needs.
  #order: string[] = []; #series: string | null = null; #split: string | undefined; #q: Query | null = null; #catalog: Catalog | null = null; #layers: Layer[] = [];
  // A touch that has only just chosen a point shows its readout. The next one activates it.
  #fresh = false;
  // How the chosen point was chosen. Each has its own look, and a paint keeps the one it found.
  #how: 'keys' | 'pointer' = 'pointer';
  // What a crosshair says at each row of a plot of lines, the dimension on x, and the crosshair once one is drawn.
  #cross = new Map<string, CrossMark[]>(); #x: string | undefined; #crossEl: HTMLElement | null = null;

  constructor(host: HTMLElement, fig: HTMLElement, body: HTMLElement) {
    this.#host = host; this.#fig = fig; this.#body = body;
    this.#tip = readoutOf(fig);
    this.#tip.setAttribute('aria-hidden', 'true'); this.#tip.hidden = true;
    const row = (e: Event) => { const k = (e.target as Element).closest?.('[data-row]')?.getAttribute('data-row'); return k != null && this.#keys.includes(k) ? k : null; };
    body.addEventListener('pointerover', (e) => {
      const k = row(e);
      if (k == null) return;
      this.#fresh = e.pointerType !== 'mouse' && k !== this.#at;
      this.#show(k, null, 'pointer');
    });
    // As version 4: the point goes with the mouse, focus or none, and the next arrow starts from nothing. A touch has
    // no leaving to speak of.
    body.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.#show(null); });
    body.addEventListener('focusout', () => this.#show(null));
    // A touch that turns into a scroll chose its point on the way down. The browser cancels it, and it lets go.
    body.addEventListener('pointercancel', () => this.#show(null));
    body.addEventListener('click', (e) => { if (row(e) !== this.#at) return; if (this.#fresh) this.#fresh = false; else this.#activate(); });
    body.addEventListener('keydown', (e) => {
      const box = this.#box();
      if (!box || e.target !== box) return;
      // Version 4 takes Escape only when a point is chosen, so the first Escape of a dialog around it is not swallowed.
      if (e.key === 'Escape') { if (this.#at != null) { e.preventDefault(); this.#show(null); } return; }
      const points = this.#points(box), at = points.findIndex((el) => el.getAttribute('data-row') === this.#at);
      if (e.key === 'Enter' || e.key === ' ') { if (at >= 0) { e.preventDefault(); this.#activate(); } return; }
      // Points in two dimensions: an arrow goes to the nearest point that way (layouts/points.ts). A proposal, not version 4's.
      if (box.dataset.hits === 'xy') {
        const near = nearest(e.key, at, points.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
        if (near != null) { e.preventDefault(); this.#show(points[near]!.getAttribute('data-row'), null, 'keys'); }
        return;
      }
      const series = at >= 0 && box.dataset.hits === 'x' ? stepSeries(e.key, this.#order.indexOf(this.#series ?? ''), this.#order.length) : null;
      if (series != null) { e.preventDefault(); this.#show(this.#at, this.#order[series] ?? null, 'keys'); return; }
      // A plot's points run from the left whatever the page, as its whole frame does (cartesian.ts), and a band's the way the page reads.
      const to = step(e.key, at, points.length, box.dataset.hits === 'y', box.dataset.hits === 'x' && getComputedStyle(box).direction === 'rtl');
      if (to == null) return;
      e.preventDefault();
      this.#show(points[to]!.getAttribute('data-row'), this.#series, 'keys');
    });
  }

  /** After each paint: name the points the layout made, and keep the chosen one if it is still there. */
  paint(scene: Scene, q: Query, result: Result, catalog: Catalog, layers: Layer[]): void {
    const { rows, x, split } = rowsAt(scene, q, result), totals = (x != null && split != null && result.totalsBy?.[x]) || [];
    this.#keys = scene.rows ?? []; this.#rows = rows; this.#order = split == null ? [] : scene.series ?? scene.detail ?? []; this.#split = split; this.#q = q; this.#catalog = catalog; this.#layers = layers;
    this.#x = x; this.#cross = crossMarks(scene, layers, rows, catalog, split);
    this.#says = this.#keys.map((k, i) => (split == null ? readout(rows[i]![0] ?? {}, q, catalog, layers) : readoutAt(rows[i]!, totals.find((t) => String(t[x!]) === k), q, catalog, x!, split, !scene.series)));
    const box = this.#box();
    if (box) {
      attr(box, 'role', 'listbox'); attr(box, 'tabindex', this.#keys.length ? 0 : null);
      attr(box, 'aria-label', catalog.dimensions[x!]?.label); attr(box, 'aria-orientation', box.dataset.hits === 'y' ? 'vertical' : 'horizontal');
      for (const el of Array.from(box.children)) {
        const i = this.#keys.indexOf(el.getAttribute('data-row') ?? '');
        attr(el, 'role', 'option'); attr(el, 'id', 'hit-' + i); attr(el, 'aria-label', this.#says[i]);
      }
    }
    // Held by the keyboard, or by a mouse still over the view: no pointerover follows for an element that was kept, so a
    // point let go here would take the readout, and the next click, with it.
    const at = this.#at, held = at != null && this.#keys.includes(at) && !!box && (box.matches(':focus') || this.#body.matches(':hover'));
    this.#show(held ? at : null, held && this.#series != null && this.#order.includes(this.#series) ? this.#series : null);
  }

  #box(): HTMLElement | null { return this.#body.querySelector<HTMLElement>('[data-hits]'); }
  /** The points on show, in the order of the result. One a fit rule or a height limit has taken away is passed over. */
  #points(box: HTMLElement): HTMLElement[] {
    const c = box.getBoundingClientRect(), by = new Map(Array.from(box.children, (el) => [el.getAttribute('data-row'), el as HTMLElement]));
    return this.#keys.flatMap((k) => by.get(k) ?? []).filter((el) => { const r = el.getBoundingClientRect(); return el.getClientRects().length > 0 && r.left < c.right && r.top < c.bottom; });
  }

  /** Choose a row, or none, and with it one series there, or all. Everything drawn from the row is marked, and so is
   * what is drawn from the series: its mark at the row, its line, its name. The readout is set by the row's point. */
  #show(key: string | null, series: string | null = null, how = this.#how): void {
    this.#at = key; this.#series = series = key == null ? null : series; this.#how = how;
    const box = this.#box(), tip = this.#tip;
    let point: Element | null = null;
    this.#body.querySelectorAll('[data-row], [data-series]').forEach((el) => {
      const row = el.getAttribute('data-row'), of = el.getAttribute('data-series'), on = key != null && row === key;
      if (row != null) attr(el, 'data-active', on ? how : null);
      if (of != null) el.toggleAttribute('data-chosen', of === series && (row == null || on));
      if (on && el.parentElement === box) point = el;
    });
    if (box) attr(box, 'aria-activedescendant', (point as Element | null)?.id);
    const marks = point ? this.#crossAt(key!, series) : [];
    if (!point || marks.length) hideReadout(tip);
    this.#drawCross(point, marks, how);
    if (!point) return;
    const i = this.#keys.indexOf(key!), pair = this.#pair(i);
    const says = pair ? readout(pair, this.#q!, this.#catalog!, this.#layers) : this.#says[i] ?? '';
    // The option is named by what is read out, so a series chosen inside it is announced as it is shown.
    // ponytail: the name of the option in focus changes under it. Whether a screen reader says so is not checked.
    if (this.#order.length) for (const el of Array.from(box!.children)) attr(el, 'aria-label', el === point ? says : this.#says[this.#keys.indexOf(el.getAttribute('data-row') ?? '')]);
    if (marks.length) return;
    // A row that has every value in writing is its own readout. The option's name above still says it to a screen reader.
    const row = pair ?? (this.#order.length ? undefined : this.#rows[i]?.[0]);
    if (row && (point as Element).classList?.contains('uav-row') && written((point as Element).textContent ?? '', row, this.#q!, this.#catalog!, this.#layers)) { hideReadout(tip); return; }
    tip.textContent = says;
    placeReadout(tip, this.#fig, point as HTMLElement);
  }

  /** What the crosshair says at a row, or nothing where the readout says it instead: where an axis is not on show
   * to read a value against, where a bar or a dot at the point wears the outline, and at the whole of a point of a
   * split plot, whose series the readout names one by one. A series chosen there has the crosshair to itself. */
  #crossAt(key: string, series: string | null): CrossMark[] {
    const marks = this.#cross.get(key) ?? [], body = this.#body;
    if (!marks.length) return [];
    const shown = (sel: string) => (body.querySelector(sel)?.getClientRects().length ?? 0) > 0;
    if (!shown('.uav-x-axis') || !shown('.uav-y-axis') || body.querySelector(':is(.uav-bars, .uav-dots) > [data-active]')) return [];
    return this.#order.length ? marks.filter((m) => series != null && m.series === series) : marks;
  }

  /** Draw the crosshair at a point, or take it away. The rules lie where the scene set each value. The words are
   * placed once, as the readout is: the point's name under it and inside the view, and each value on its axis, a
   * line clear of the next (measure.ts), with the one there is no room for left out.
   * ponytail: placed in the page's px over the plot's own, so under a transform the words are off by its scale. */
  #drawCross(point: Element | null, marks: CrossMark[], how: 'keys' | 'pointer'): void {
    if (!point || !marks.length) { if (this.#crossEl?.isConnected) this.#crossEl.replaceChildren(); this.#crossEl = null; return; }
    const plot = point.closest<HTMLElement>('.uav-plot')!, cross = this.#crossEl = ensure(plot, 'div', 'uav-cross');
    const add = <K extends 'i' | 'span'>(tag: K, cls: string) => { const el = cross.appendChild(document.createElement(tag)); if (cls) el.className = cls; return el; };
    attr(cross, 'data-active', how); cross.setAttribute('aria-hidden', 'true'); cross.replaceChildren();
    for (const m of marks) prop(add('i', ''), '--uav-t', m.t);
    const p = plot.getBoundingClientRect(), b = this.#body.getBoundingClientRect(), r = point.getBoundingClientRect();
    // How far the body runs to either side of the plot: the gutters the axes are in.
    const before = p.left - b.left, after = b.right - p.right, far = this.#body.querySelector('.uav-y-axis-2')?.getBoundingClientRect().width ?? 0;
    const row = this.#rows[this.#keys.indexOf(point.getAttribute('data-row') ?? '')]?.[0], dim = this.#x == null ? undefined : this.#catalog!.dimensions[this.#x];
    if (row && dim) {
      const name = add('span', 'uav-cross-x'), c = parseFloat((point as HTMLElement).style.getPropertyValue('--uav-c'));
      name.textContent = formatDimension(row[this.#x!], dim);
      const w = name.offsetWidth, x = r.left + r.width * (Number.isFinite(c) ? c : 0.5) - p.left;
      prop(name, 'left', Math.max(-before, Math.min(x - w / 2, p.width + after - w)) + 'px');
    }
    for (const side of [0, 1] as const) {
      const at = marks.filter((m) => m.side === side), gutter = side ? far : before;
      const says = at.map((m) => { const el = add('span', 'uav-cross-y'); el.textContent = m.text; attr(el, 'data-role', m.role); attr(el, 'data-side', side); return el; });
      if (!says.length) continue;
      // Over its axis from the edge of the view, at least as wide as the gutter, and into the plot where it is wider.
      for (const el of says) { prop(el, side ? 'inset-inline-end' : 'inset-inline-start', -gutter + 'px'); prop(el, 'min-inline-size', Math.max(0, gutter - 3) + 'px'); }
      apart(at.map((m) => (1 - m.t) * p.height), says[0]!.offsetHeight + 1, p.height).forEach((y, i) => { says[i]!.toggleAttribute('data-thin', y == null); prop(says[i]!, 'top', y == null ? null : y + 'px'); });
    }
  }

  /** The row of the chosen series at a point, when one is chosen and has a row there. */
  #pair(i: number): Row | undefined {
    return this.#series == null ? undefined : this.#rows[i]?.find((r) => String(r[this.#split!]) === this.#series);
  }

  /** `row` is the chosen series' at the point, or the point's first. `rows` is every row at the point. */
  #activate(): void {
    const i = this.#keys.indexOf(this.#at!), rows = this.#rows[i] ?? [], row = this.#pair(i) ?? rows[0];
    if (row) this.#host.dispatchEvent(new CustomEvent('ua-activate', { bubbles: true, composed: true, detail: { row, rows } }));
  }
}
