import { POINT_INSET, formatBin, formatDimension, formatValue, layerKeys, many, metricOf, most, partialNote, rowKeys, unitsOf, type Catalog, type Layer, type Query, type RectNode, type Result, type Row, type Scene } from '@unified-analytics/core';
import { attr, ensure, paintVar, prop } from './dom.ts';
import { centred, say, tip as chip } from './chrome/tip.ts';
import { apart } from './measure.ts';
import { FOCUS, HOVER, token } from './tokens.ts';
import { SWATCH, swatch as swatchOf } from './chrome/swatch.ts';
import { nearest } from './layouts/points.ts';
import { rove, type How } from './rove.ts';
import { FROM_TOP } from './layout.ts';

/* Hit targets, the keyboard and the readout. A layout marks the element that holds its points with `data-hits`
 * ("x" where they run across, "y" where they run down), and each point is a child carrying `data-row`. Bars in a
 * list and segments of a band are their own targets. A plot has no element per point, so it gets a layer of them.
 *
 * The keyboard is version 4's, read from `useKeyboardNavigation` on Jetpack trunk: one tab stop, nothing chosen on
 * focus, left and right step and stop at the ends, Enter or Space activates the chosen point, Escape lets go of it
 * and Tab moves on. To assistive technology the holder is a listbox and each point an option named by its readout,
 * so the words on screen and the words announced are one string.
 *
 * Points at two metrics have no order along either axis. Loose, an arrow goes to the nearest point that way
 * (layouts/points.ts). Joined by a line they have the line's order, which is the rows': left and right step back and
 * on along it, as along any line, wherever on the plot that takes the reader, and up and down do nothing.
 *
 * A plot split into series has several values at each point. The point's readout says them all, and up and down
 * step through the series there: up from the whole point to the first series, which is the foot of a stack, and
 * down again to the whole. Left and right keep the series. Version 4 was not read for this; it is ours until it is.
 *
 * A list whose rows are divided into series has them along each row, so there left and right step through the series
 * of the chosen row, in their order: on from the whole row to its first series, and back again to the whole. Up and
 * down step from row to row and keep the series. Only the series the row has are stepped through: by `detail` a row
 * may hold a few of many.
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

/** What a companion is called beside its metric's value: its own label where the catalog has an entry for it ("rank"),
 * and its suffix where it has none ("p25"). Its value is written in its own unit either way (core's metricOf). */
export function companionLabel(f: string, catalog: Catalog): string {
  return Object.hasOwn(catalog.metrics, f) ? catalog.metrics[f]!.label.toLowerCase() : f.slice(f.indexOf('@') + 1);
}

/** A row's value of a dimension, as the readout and a table name it: a bin by both its ends, as its label on an axis is. */
export function dimName(row: Row, d: string, catalog: Catalog): string {
  return row[d + '@end'] == null ? formatDimension(row[d], catalog.dimensions[d]!) : formatBin(row[d], row[d + '@end']);
}

/** What the readout says for one row of the result, in the catalog's formats: the dimension value, each metric
 * (marked when its bucket is unfinished), its comparison if the row has one, and each companion of it that a layer
 * encodes, under its suffix: what a range or a tick is drawn from is said as well as shown. */
export function readout(row: Row, q: Query, catalog: Catalog, layers: Layer[]): string {
  // Two bins are each named by their dimension as well: two bare ranges do not say which is which.
  const both = (q.by || []).filter((d) => row[d + '@end'] != null).length > 1;
  const dims = (q.by || []).map((d) => (both && row[d + '@end'] != null ? catalog.dimensions[d]!.label + ' ' : '') + dimName(row, d, catalog)).join(', '), partial = partialNote(row);
  // Never a row of dashes: a row with nothing to say, no value, no period before and no companion, says so in words.
  const said = (m: string) => row[m] != null || (q.compare === 'previous' && row[m + '@previous'] != null) || companions(m, row, layers).some((f) => row[f] != null);
  if (!q.metrics.some(said)) return (dims ? dims + ': ' : '') + 'No data';
  const values = q.metrics.map((m) => {
    const def = catalog.metrics[m]!, prev = q.compare === 'previous' ? row[m + '@previous'] : null;
    const more = companions(m, row, layers).filter((f) => row[f] != null).map((f) => ', ' + companionLabel(f, catalog) + ' ' + formatValue(row[f] as number, metricOf(catalog, f)!)).join('');
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
    return [m, ...also, ...companions(m, row, layers).filter((f) => row[f] != null)].every((f) => shown.includes(formatValue(row[f] as number | null, metricOf(catalog, f) ?? def)));
  });
}

/** What the readout says for one point of a split plot, from the rows there: the x value, each metric with the
 * engine's total for that x when the result has one, and the value of every series. With `mass`, where the series
 * are in one paint and may be many, it says how many there are and the one with the most there, by name: a comparison
 * of the engine's rows, as the prose's leader is. */
export function readoutAt(rows: Row[], total: Row | undefined, q: Query, catalog: Catalog, x: string, split: string, mass = false): string {
  const of = catalog.dimensions[split]!, { name, metrics } = headAt(rows, total, q, catalog, x);
  return name + ': ' + q.metrics.map((m, i) => {
    const def = catalog.metrics[m]!, said = (r: Row) => formatDimension(r[split], of) + ' ' + formatValue(r[m] as number | null, def);
    const top = most(rows.filter((r) => r[m] != null), m);
    return metrics[i] + ' (' + (mass ? rows.length + ' ' + many(rows.length, of.label.toLowerCase()) + (top ? ', the most ' + said(top) : '') : rows.map(said).join(', ')) + ')';
  }).join('; ');
}

/** What a point of a split plot is called, and each metric there with the engine's total for the point where the result
 * has one: the head of its readout, in words (readoutAt) and as drawn (readoutLines). */
function headAt(rows: Row[], total: Row | undefined, q: Query, catalog: Catalog, x: string): { name: string; metrics: string[] } {
  const first = rows[0] ?? {}, partial = partialNote(first);
  return {
    name: formatDimension(first[x], catalog.dimensions[x]!),
    metrics: q.metrics.map((m) => { const def = catalog.metrics[m]!; return def.label + (total ? ' ' + formatValue(total[m] as number | null, def) + (partial && ' ' + partial) : ''); }),
  };
}

/** The readout of a point of a split plot as it is drawn: a head that says the x and each metric with the engine's
 * total there, and a line to each series, its name and its value, which the readout sets beside a swatch of the
 * series' paint. readoutAt() says the same in words, for the point's name. More than one metric: each line has
 * their values in the head's order. */
export function readoutLines(rows: Row[], total: Row | undefined, q: Query, catalog: Catalog, x: string, split: string): { head: string; lines: { series: string; name: string; value: string }[] } {
  const of = catalog.dimensions[split]!, { name, metrics } = headAt(rows, total, q, catalog, x), head = name + ': ' + metrics.join('; ');
  return { head, lines: rows.map((r) => ({ series: String(r[split]), name: formatDimension(r[split], of), value: q.metrics.map((m) => formatValue(r[m] as number | null, catalog.metrics[m]!)).join(', ') })) };
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
    const y = l.encode?.y, def = metricOf(catalog, y);
    if (l.mark !== 'line' || typeof y !== 'string' || !def) return;
    const prev = l.series === 'previous', field = prev ? y + '@previous' : y, side = units.indexOf(unitsOf(catalog, [l])[0]!) > 0 ? 1 : 0;
    for (const n of scene.nodes) {
      // A line's unfinished tail, and an unfinished lead, are paths of their own, and the row where two meet is in both.
      if (n.kind !== 'path' || n.fill || n.part !== 'plot' || n.key.replace(/:partial(:lead)?$/, '') !== (n.series == null ? ids[li] : ids[li] + ':' + n.series)) continue;
      for (const p of n.points) {
        if (p.row == null) continue;                                       // where an area's ends cross, which is no row's
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
 * when the key is not such a step. It stops at the last series, and at the whole point on the way back.
 * `along` is a list's: its series lie along the row, so the keys are right and left, or left and right where the page reads from the right. */
export function stepSeries(key: string, at: number, count: number, along = false, rtl = false): number | null {
  // Along a row the series run the way the page reads, and an arrow moves the way it points.
  const on = along ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowUp', back = along ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowDown';
  const d = key === on ? 1 : key === back ? -1 : 0;
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
    else if (n.kind === 'path') { for (const p of n.points) if (p.row != null) cx.set(p.row, p.x); }
    else if (n.kind === 'circle' && n.row != null && n.x != null) cx.set(n.row, n.x);       // a dot on a time or category axis
    // A row's rule, or its tick. Half a tick is to one side of its band's middle, so it gives way to a mark that stands at the middle.
    else if (n.kind === 'line' && n.row != null && n.x != null && (!cx.has(n.row) || n.x === n.x2)) cx.set(n.row, (n.x + (n.x2 ?? n.x)) / 2);
  }
  bars.forEach(([lo, hi], row) => cx.set(row, lo + (hi - lo) / 2));
  const at = (scene.rows ?? []).filter((r) => cx.has(r)).map((r) => [r, cx.get(r)!] as const);
  // Columns of widths of their own meet where one's bars end and the next one's begin, which is not half way between their middles.
  const own = scene.scale === 'linear' && at.every(([r]) => bars.has(r)), edge = (a: string, b: string) => (bars.get(a)![1] + bars.get(b)![0]) / 2;
  return at.map(([row, x], i) => {
    const lo = i ? (own ? edge(at[i - 1]![0], row) : (at[i - 1]![1] + x) / 2) : 0, hi = i < at.length - 1 ? (own ? edge(row, at[i + 1]![0]) : (x + at[i + 1]![1]) / 2) : 1;
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
/* The readout is a tooltip chip at a point (chrome/tip.ts), as wide as its words up to a width of its own. */
.uav-readout { z-index: 1; left: 0; top: 0; inline-size: max-content; max-inline-size: min(320px, 100%); }
/* At a point of a split plot it is a head and a line to each series: a swatch of its paint, its name, and its value at the end. */
.uav-readout[data-lines] { display: grid; grid-template-columns: ${SWATCH.readout}px minmax(0, 1fr) auto; column-gap: 4px; align-items: center; min-inline-size: min(160px, 100%); }
.uav-readout[data-lines] > b { grid-column: 1 / -1; font-weight: inherit; }
.uav-readout[data-lines] > span:nth-of-type(2n) { text-align: end; }
/* In the top layer it is placed on the screen, over whatever holds the view, and is as wide as its words up to a width of its own. */
.uav-readout[popover] { position: fixed; inset: auto; margin: 0; border: 0; overflow: visible; max-inline-size: min(320px, 100vw - 8px); }
/* A line is read against the axes, so at a point of one the readout is a crosshair: the rule that stands at the point,
 * one that lies at each line's value there, and that value said on the axis it is read from, with the point's own
 * name on the x axis. It is drawn in the plot's box and its words stand over the tick labels they are among. A value
 * wider than its axis's gutter grows into the plot and never out of the view. The second line of a comparison is
 * said more quietly, on the secondary surface. Each of its words is a tooltip chip on an axis (chrome/tip.ts). */
/* The crosshair's words hang past the plot, over the axes. The plot is a layer of its own, so it is the plot that is
 * raised while it has a crosshair, or the axis labels after it would be drawn over them. */
.uav-plot:has(> .uav-cross) { z-index: 2; }
.uav-cross { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.uav-cross i { position: absolute; inset-inline: 0; inset-block-start: calc(${FROM_TOP} - var(--uav-rule) / 2); block-size: var(--uav-rule); background: var(--uav-rule-paint); }
.uav-cross-x { inset-block-start: calc(100% + 3px); unicode-bidi: plaintext; }
.uav-cross-y { translate: 0 -50%; text-align: end; }
.uav-cross-y[data-side="1"] { text-align: start; }
/* A row that says its own value has told the reader what the readout would, so there the readout waits, as a tooltip
 * does, and is not in the way of the list. A mark that is read against an axis, a ramp or a legend says no number, so
 * its readout comes at once. It waits only to appear: once it is up it follows the pointer or the keys from row to
 * row, and it is hidden again by leaving. The words a screen reader is given do not wait.
 * The readout is taken out with \`hidden\`, so its first style is where the wait starts from. */
.uav:has(.uav-row > .uav-f-value) > .uav-readout { transition: visibility 0s ${token('motion-delay-tooltip')}; }
@starting-style { .uav:has(.uav-row > .uav-f-value) > .uav-readout { visibility: hidden; } }
.uav-hits { position: absolute; inset: 0; }
.uav-body[data-scale="point"] .uav-hits { inset-inline: ${POINT_INSET}px; }
.uav-hits i { position: absolute; inset-block: 0; inset-inline-start: calc(var(--uav-x) * 100%); inline-size: calc(var(--uav-w) * 100%); }
/* Hit targets are not marks. On a data change they take their new places at once, and one whose row has gone
 * goes at once: motion.ts keeps a leaving node only while --uav-leaving is set. */
.uav[data-moving] .uav-hits [data-key] { transition: none; }
.uav[data-moving] .uav-plot .uav-hits [data-exit] { --uav-leaving: initial; transition: none; }
.uav-hits [data-active]::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: calc(var(--uav-c) * 100% - var(--uav-rule) / 2); inline-size: var(--uav-rule); background: var(--uav-rule-paint); }
.uav-plot:has(:is(.uav-bars, .uav-dots) > [data-active]) .uav-hits [data-active]::before { display: none; }
/* A series chosen at a point: the rest of the plot stands back, and its name is marked wherever it is written. */
.uav-plot:has([data-chosen]) :is(.uav-bars i, path):not([data-chosen]) { opacity: ${token('opacity-dim')} !important; }
/* In a plot split by detail every line is drawn light, so that many together read darker. The one chosen is drawn whole. */
.uav-body[data-mass] .uav-plot path[data-chosen] { opacity: 1 !important; }
/* A series chosen in a row of a list: the rest of that row's stand back, and a dot of many is drawn whole. */
.uav-row:has(> [data-chosen]) > i[data-series]:not([data-chosen]) { opacity: ${token('opacity-dim')} !important; }
.uav-row > i[data-chosen] { opacity: 1 !important; }
/* A chosen entry of a legend, and a chosen series' name wherever it is written, are underlined. */
.uav-legend span[data-active], :is(.uav-legend, .uav-legend-top, .uav-labels) span[data-chosen] { text-decoration: underline; }`;

/** A view's readout: one element, the figure's own, which every layout that says what is under the pointer sets.
 * In the top layer where there is one, so nothing that holds the view can clip it: a card, a scrolling panel. */
export function readoutOf(fig: HTMLElement): HTMLElement {
  const tip = chip(ensure(fig, 'div', 'uav-readout'), 'point');
  if (typeof tip.showPopover === 'function') tip.setAttribute('popover', 'manual');
  return tip;
}
/** An element of the readout's, with its words. */
function el(tag: string, words: string): HTMLElement { const e = document.createElement(tag); e.textContent = words; return e; }
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
 * ponytail: placed once, when chosen. A scroll or a resize of the window takes it away; a view resized alone leaves it. */
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
    // A resize moves the point out from under it as surely.
    addEventListener('resize', () => hideReadout(tip), heard);
  }
  const f = fig.getBoundingClientRect(), r = point.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const c = parseFloat(point.style.getPropertyValue('--uav-c')), mid = r.left + r.width * (Number.isFinite(c) ? c : 0.5);
  if (floats) {
    // On the screen, a little in from its edge.
    const above = r.top - h - 2;
    tip.style.setProperty('left', centred(mid, w, 4, document.documentElement.clientWidth - 4) + 'px');
    tip.style.setProperty('top', (above >= 4 ? above : r.bottom + 2) + 'px');
    return;
  }
  // Without a top layer: always inside the view, over its top where it is too small for above or below, because whatever
  // holds a view may clip at its edge. Rects are in the page's px and the readout is placed in the figure's own: under a
  // transform the two differ, by kx and ky.
  const W = fig.offsetWidth, H = fig.offsetHeight, kx = W > 0 && f.width > 0 ? W / f.width : 1, ky = H > 0 && f.height > 0 ? H / f.height : 1;
  const above = (r.top - f.top) * ky - h - 2, below = (r.bottom - f.top) * ky + 2;
  tip.style.setProperty('left', centred((mid - f.left) * kx, w, 0, f.width * kx) + 'px');
  tip.style.setProperty('top', (above >= 0 ? above : below + h <= f.height * ky ? below : 0) + 'px');
}

/** The interaction of one view. It listens on the body, which outlives every paint, so nothing is bound per point. */
export class Keys {
  #host: HTMLElement; #fig: HTMLElement; #body: HTMLElement; #tip: HTMLElement;
  #keys: string[] = []; #rows: Row[][] = []; #says: string[] = [];
  // At each point of a plot split into series painted apart, the readout's lines, and the paint of each series.
  #lines: (ReturnType<typeof readoutLines> | null)[] = []; #paints = new Map<string, string>();
  #at: string | null = null;
  // The series of a split plot, the one chosen at the point, and what a readout of one needs.
  #order: string[] = []; #series: string | null = null; #split: string | undefined; #q: Query | null = null; #catalog: Catalog | null = null; #layers: Layer[] = [];
  // How the chosen point was chosen. Each has its own look, and a paint keeps the one it found.
  #how: 'keys' | 'pointer' = 'pointer';
  // What a crosshair says at each row of a plot of lines, the dimension on x, and the crosshair once one is drawn.
  #cross = new Map<string, CrossMark[]>(); #x: string | undefined; #crossEl: HTMLElement | null = null;

  constructor(host: HTMLElement, fig: HTMLElement, body: HTMLElement) {
    this.#host = host; this.#fig = fig; this.#body = body;
    this.#tip = readoutOf(fig);
    this.#tip.setAttribute('aria-hidden', 'true'); this.#tip.hidden = true;
    const row = (e: Event) => { const k = (e.target as Element).closest?.('[data-row]')?.getAttribute('data-row'); return k != null && this.#keys.includes(k) ? k : null; };
    rove<{ row: string; series: string | null }>(body, {
      hit: (e) => {
        const k = row(e);
        if (k == null) return null;
        // An arc of a circle's second ring is a target of its own: the pointer chooses it there, as up and down do (layouts/radial.ts).
        const of = (e.target as Element).closest?.('.uav-under [data-series]')?.getAttribute('data-series');
        return { row: k, series: of != null && this.#order.includes(of) ? of : null };
      },
      chosen: () => (this.#at == null ? null : { row: this.#at, series: this.#series }),
      same: (a, b) => a.row === b.row && a.series === b.series,
      choose: (t, how) => this.#show(t?.row ?? null, t?.series ?? null, how),
      activate: () => this.#activate(),
      holder: () => this.#box(),
      step: (e) => {
        const box = this.#box()!, points = this.#points(box), at = points.findIndex((el) => el.getAttribute('data-row') === this.#at);
        // Points in two dimensions: an arrow goes to the nearest point that way (layouts/points.ts). A proposal, not version 4's.
        if (box.dataset.hits === 'xy') {
          const near = nearest(e.key, at, points.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
          return near == null ? null : { row: points[near]!.getAttribute('data-row')!, series: null };
        }
        // In a list the series lie along the chosen row, and are the ones that row has.
        const list = box.dataset.hits === 'y' && this.#order.length > 0, here = list ? (this.#rows[this.#keys.indexOf(this.#at ?? '')] ?? []).map((r) => String(r[this.#split!])) : this.#order;
        const series = at >= 0 && (list || box.dataset.hits === 'x') ? stepSeries(e.key, here.indexOf(this.#series ?? ''), here.length, list, getComputedStyle(box).direction === 'rtl') : null;
        if (series != null) return { row: this.#at!, series: here[series] ?? null };
        // A plot's points run from the left whatever the page, as its whole frame does (cartesian.ts), and a band's the way the page reads.
        const to = step(e.key, at, points.length, box.dataset.hits === 'y', box.dataset.hits === 'x' && getComputedStyle(box).direction === 'rtl');
        return to == null ? null : { row: points[to]!.getAttribute('data-row')!, series: this.#series };
      },
    });
  }

  /** After each paint: name the points the layout made, and keep the chosen one if it is still there. */
  paint(scene: Scene, q: Query, result: Result, catalog: Catalog, layers: Layer[]): void {
    // A point of a plot of points is one row whatever colours it, so it is read as a row, and has no series to step through.
    const found = rowsAt(scene, q, result), { rows, x } = found, split = scene.parts?.includes('points') ? undefined : found.split, totals = (x != null && split != null && result.totalsBy?.[x]) || [];
    this.#keys = scene.rows ?? []; this.#rows = rows; this.#order = split == null ? [] : scene.series ?? scene.detail ?? []; this.#split = split; this.#q = q; this.#catalog = catalog; this.#layers = layers;
    this.#x = x; this.#cross = crossMarks(scene, layers, rows, catalog, split);
    this.#says = this.#keys.map((k, i) => (split == null ? readout(rows[i]![0] ?? {}, q, catalog, layers) : readoutAt(rows[i]!, totals.find((t) => String(t[x!]) === k), q, catalog, x!, split, !scene.series)));
    // A mass is in one paint, so it is said in words alone (readoutAt). Series painted apart each have a line and a swatch.
    this.#lines = this.#keys.map((k, i) => (split == null || !scene.series ? null : readoutLines(rows[i]!, totals.find((t) => String(t[x!]) === k), q, catalog, x!, split)));
    this.#paints = split == null || !scene.series ? new Map() : new Map(scene.nodes.filter((n) => n.series != null && n.layer === 'data').reverse().map((n) => [n.series!, n.paint]));
    const box = this.#box();
    if (box) {
      attr(box, 'role', 'listbox'); attr(box, 'aria-label', catalog.dimensions[x!]?.label);
      // Points in two dimensions have no one orientation, and the attribute has no value for both.
      attr(box, 'aria-orientation', box.dataset.hits === 'y' ? 'vertical' : box.dataset.hits === 'xy' ? null : 'horizontal');
    }
    // The options are named by name(), which reads what shows, so the view calls it once every view queued with it has painted.
    // Held by the keyboard, or by a mouse still over the view: no pointerover follows for an element that was kept, so a
    // point let go here would take the readout, and the next click, with it.
    const at = this.#at, held = at != null && this.#keys.includes(at) && !!box && (box.matches(':focus') || this.#body.matches(':hover'));
    this.#show(held ? at : null, held && this.#series != null && this.#order.includes(this.#series) ? this.#series : null);
  }

  /** Name the options: after each paint, and after the measured pass, which can take points away. A point is an option
   * only while it is on show (#points), so a list cut by a height limit counts the rows it shows, one leaving is no
   * option, and a list with none on show is no tab stop. Where a group of glyphs share a row, a unit's cells or its
   * seats, the first of them is the group's option and the rest are its picture, as are the glyphs that are no row's. */
  name(): void {
    const box = this.#box();
    if (!box) return;
    const shown = new Set(this.#points(box));
    attr(box, 'tabindex', shown.size ? 0 : null);
    for (const el of Array.from(box.children)) {
      const on = shown.has(el as HTMLElement), i = on ? this.#keys.indexOf(el.getAttribute('data-row')!) : -1;
      attr(el, 'role', on ? 'option' : 'presentation'); attr(el, 'id', on ? 'hit-' + i : null); attr(el, 'aria-label', on ? this.#says[i] : null);
    }
  }

  #box(): HTMLElement | null { return this.#body.querySelector<HTMLElement>('[data-hits]'); }
  /** The points on show, in the order of the result. One a fit rule or a height limit has taken away is passed over. */
  #points(box: HTMLElement): HTMLElement[] {
    // One to a row: the first of a group of glyphs that share one.
    const c = box.getBoundingClientRect(), by = new Map<string | null, HTMLElement>();
    for (const el of Array.from(box.children) as HTMLElement[]) if (!by.has(el.getAttribute('data-row'))) by.set(el.getAttribute('data-row'), el);
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
      if (on && el.parentElement === box) point ??= el;                       // the first of a group of glyphs is its point
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
    const lines = pair ? null : this.#lines[i];
    say(tip, !lines ? says : [el('b', lines.head), ...lines.lines.flatMap((l) => {
      const swatch = document.createElement('i'); swatchOf(swatch, String(SWATCH.readout));
      prop(swatch, '--uav-paint', paintVar(this.#paints.get(l.series) ?? 'series.1'));
      return [swatch, el('span', l.name), el('span', l.value)];
    })]);
    // Over the arc of a second ring where one is chosen, and else over the row's point.
    placeReadout(tip, this.#fig, (series != null && this.#body.querySelector<HTMLElement>('.uav-under [data-chosen]')) || (point as HTMLElement));
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
      const name = chip(add('span', 'uav-cross-x'), 'axis'), c = parseFloat((point as HTMLElement).style.getPropertyValue('--uav-c'));
      say(name, formatDimension(row[this.#x!], dim));
      prop(name, 'left', centred(r.left + r.width * (Number.isFinite(c) ? c : 0.5) - p.left, name.offsetWidth, -before, p.width + after) + 'px');
    }
    for (const side of [0, 1] as const) {
      const at = marks.filter((m) => m.side === side), gutter = side ? far : before;
      const says = at.map((m) => { const el = chip(add('span', 'uav-cross-y'), 'axis', m.role === 'comparison' ? 'secondary' : 'primary'); say(el, m.text); attr(el, 'data-role', m.role); attr(el, 'data-side', side); return el; });
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

  /** `row` is the chosen series' at the point, or the point's first. `rows` is every row at the point. False where no
   * point on show is chosen. */
  #activate(): boolean {
    const box = this.#box();
    if (!box || !this.#points(box).some((el) => el.getAttribute('data-row') === this.#at)) return false;
    const i = this.#keys.indexOf(this.#at!), rows = this.#rows[i] ?? [], row = this.#pair(i) ?? rows[0];
    if (row) this.#host.dispatchEvent(new CustomEvent('ua-activate', { bubbles: true, composed: true, detail: { row, rows } }));
    return true;
  }
}

/** Take from an element what the keyboard set on it as a holder of points (Keys.paint and name()), for one that holds
 * none any longer. */
export function unlist(el: Element): void {
  for (const name of ['role', 'tabindex', 'aria-label', 'aria-orientation', 'aria-activedescendant']) el.removeAttribute(name);
}

/** Choose an element of a holder of them, or none, and say how, as the element's points are chosen. The readout is
 * the element's own name, and is the view's one readout, shown and placed as a point's is. */
export function chooseItem(holder: HTMLElement, el: HTMLElement | null, how: How = 'pointer'): void {
  holder.querySelector('[data-active]')?.removeAttribute('data-active');
  el?.setAttribute('data-active', how);
  attr(holder, 'aria-activedescendant', el?.id);
  const fig = holder.closest<HTMLElement>('.uav')!, tip = readoutOf(fig);
  if (!el) { hideReadout(tip); return; }
  say(tip, el.getAttribute('aria-label') ?? '');
  placeReadout(tip, fig, el);
}

/** rove() for a holder whose things are its own elements, each named by its readout: a grid's cells, a treemap's
 * boxes, a custom mark's. `item` selects them, and `step` says where a key goes from the chosen one, or from none.
 * `detail` is what the chosen one activates with, if it has anything to. Bind it once, to a holder that outlives
 * every paint; a paint that lets go of the chosen one, or keeps it, says so with chooseItem(). */
export function roveItems(holder: HTMLElement, item: string, step: (e: KeyboardEvent, on: HTMLElement | null) => HTMLElement | null, detail: (el: HTMLElement) => object | undefined): void {
  const chosen = () => holder.querySelector<HTMLElement>(item + '[data-active]');
  rove<HTMLElement>(holder, {
    hit: (e) => (e.target as Element).closest?.<HTMLElement>(item) ?? null,
    chosen,
    choose: (el, how) => chooseItem(holder, el, how),
    activate: () => {
      const on = chosen(), d = on && detail(on);
      if (d) (holder.getRootNode() as ShadowRoot).host.dispatchEvent(new CustomEvent('ua-activate', { bubbles: true, composed: true, detail: d }));
      return !!on;
    },
    step: (e) => step(e, chosen()),
  });
}
