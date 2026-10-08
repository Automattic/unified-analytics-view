import { formatDimension, formatValue, partialNote, type Catalog, Query, RectNode, Result, Row, Scene } from '@universal-analytics/core';
import { attr, ensure, paintVar } from './dom.ts';
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
 * down again to the whole. Left and right keep the series. Version 4 was not read for this; it is ours until it is. */

/** What the readout says for one row of the result, in the catalog's formats: the dimension value, each metric
 * (marked when its bucket is unfinished), its comparison if the row has one, and each companion the engine returned
 * with it, under its suffix: what a range or a tick is drawn from is said as well as shown. */
export function readout(row: Row, q: Query, catalog: Catalog): string {
  const dims = (q.by || []).map((d) => formatDimension(row[d], catalog.dimensions[d]!)).join(', '), partial = partialNote(row);
  const values = q.metrics.map((m) => {
    const def = catalog.metrics[m]!, prev = q.compare === 'previous' ? row[m + '@previous'] : null;
    const more = Object.keys(row).filter((f) => f.startsWith(m + '@') && f !== m + '@previous' && row[f] != null).map((f) => ', ' + f.slice(m.length + 1) + ' ' + formatValue(row[f] as number, def)).join('');
    return def.label + ' ' + formatValue(row[m] as number | null, def) + (partial && ' ' + partial) + (prev == null ? '' : ', previous period ' + formatValue(prev as number, def)) + more;
  }).join('; ');
  return dims ? dims + ': ' + values : values;
}

/** What the readout says for one point of a split plot, from the rows there: the x value, each metric with the
 * engine's total for that x when the result has one, and the value of every series. */
export function readoutAt(rows: Row[], total: Row | undefined, q: Query, catalog: Catalog, x: string, split: string): string {
  const first = rows[0] ?? {}, partial = partialNote(first);
  return formatDimension(first[x], catalog.dimensions[x]!) + ': ' + q.metrics.map((m) => {
    const def = catalog.metrics[m]!;
    return def.label + (total ? ' ' + formatValue(total[m] as number | null, def) + (partial && ' ' + partial) : '')
      + ' (' + rows.map((r) => formatDimension(r[split], catalog.dimensions[split]!) + ' ' + formatValue(r[m] as number | null, def)).join(', ') + ')';
  }).join('; ');
}

/** The rows of the result at each point of the scene. One each, in step, unless the plot is split into series:
 * then `x` and `split` name the two dimensions, and a point has a row per series, in the series' order. */
export function rowsAt(scene: Scene, q: Query, result: Result): { rows: Row[][]; x?: string; split?: string } {
  const keys = scene.rows ?? [], by = q.by || [], order = scene.series ?? [];
  // ponytail: scene.rows and result.rows are taken to run in step, as every scene builder with no split makes them.
  if (!order.length || by.length !== 2) return { rows: keys.map((_, i) => (result.rows[i] ? [result.rows[i]!] : [])), x: by[0] };
  const x = by.find((d) => result.rows.length > 0 && keys.includes(String(result.rows[0]![d]))) ?? by[0]!, split = by.find((d) => d !== x)!;
  const rank = (r: Row) => order.indexOf(String(r[split]));
  return { rows: keys.map((k) => result.rows.filter((r) => String(r[x]) === k).sort((a, b) => rank(a) - rank(b))), x, split };
}

/** Where up and down move to among the series at one point, from `at` (-1 when the whole point is chosen). Null
 * when the key is not such a step. It stops at the last series, and at the whole point on the way back. */
export function stepSeries(key: string, at: number, count: number): number | null {
  const d = key === 'ArrowUp' ? 1 : key === 'ArrowDown' ? -1 : 0;
  return d && count ? Math.min(Math.max(at + d, -1), count - 1) : null;
}

/** Where a key moves to among `count` points, from `at` (-1 when none is chosen). Null when the key is not a step.
 * Up and down step only where the points run down the page. */
export function step(key: string, at: number, count: number, vertical = false): number | null {
  const d = key === 'ArrowRight' || (vertical && key === 'ArrowDown') ? 1 : key === 'ArrowLeft' || (vertical && key === 'ArrowUp') ? -1 : 0;
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
 * an outline, an underline or a rule. The focus ring is the browser's own, drawn inside the box, because whatever
 * holds a view may clip at its edge. */
export const KEYS_CSS = `
[data-hits]:focus-visible { outline-offset: -2px; }
.vg-readout { position: absolute; z-index: 1; left: 0; top: 0; box-sizing: border-box; inline-size: max-content; max-inline-size: 100%; padding: 2px 6px; border-radius: 2px;
  pointer-events: none; font-size: 11px; font-variant-numeric: tabular-nums;
  color: var(--a8c-charts-color-label-inverse, Canvas); background: var(--a8c-charts-color-tooltip-surface, CanvasText); }
.vg-hits { position: absolute; inset: 0; }
.vg-body[data-scale="point"] .vg-hits { inset-inline: 2px; }
.vg-hits i { position: absolute; inset-block: 0; inset-inline-start: calc(var(--vg-x) * 100%); inline-size: calc(var(--vg-w) * 100%); }
/* Hit targets are not marks. On a data change they take their new places at once, and one whose row has gone
 * goes at once: motion.ts keeps a leaving node only while --vg-leaving is set. */
.vg[data-moving] .vg-hits [data-key] { transition: none; }
.vg[data-moving] .vg-plot .vg-hits [data-exit] { --vg-leaving: initial; transition: none; }
.vg-hits [data-active]::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: calc(var(--vg-c) * 100% - 0.5px); inline-size: 1px; background: var(--vg-paint); }
.vg-row[data-active] { outline: 1px solid ${paintVar('rule')}; outline-offset: -1px; }
.vg-band [data-active] { outline: 2px solid ${paintVar('ink')}; outline-offset: 1px; }
.vg-legend span[data-active] { text-decoration: underline; }
/* A series chosen at a point: the rest of the plot stands back, and its name is marked wherever it is written. */
.vg-plot:has([data-chosen]) :is(.vg-bars i, path):not([data-chosen]) { opacity: 0.3 !important; }
:is(.vg-legend, .vg-labels) span[data-chosen] { text-decoration: underline; }`;

/** The interaction of one view. It listens on the body, which outlives every paint, so nothing is bound per point. */
export class Keys {
  #host: HTMLElement; #fig: HTMLElement; #body: HTMLElement; #tip: HTMLElement;
  #keys: string[] = []; #rows: Row[][] = []; #says: string[] = [];
  #at: string | null = null;
  // The series of a split plot, the one chosen at the point, and what a readout of one needs.
  #order: string[] = []; #series: string | null = null; #split: string | undefined; #q: Query | null = null; #catalog: Catalog | null = null;
  // A touch that has only just chosen a point shows its readout. The next one activates it.
  #fresh = false;

  constructor(host: HTMLElement, fig: HTMLElement, body: HTMLElement) {
    this.#host = host; this.#fig = fig; this.#body = body;
    this.#tip = ensure(fig, 'div', 'vg-readout');
    this.#tip.setAttribute('aria-hidden', 'true'); this.#tip.hidden = true;
    const row = (e: Event) => { const k = (e.target as Element).closest?.('[data-row]')?.getAttribute('data-row'); return k != null && this.#keys.includes(k) ? k : null; };
    body.addEventListener('pointerover', (e) => {
      const k = row(e);
      if (k == null) return;
      this.#fresh = e.pointerType !== 'mouse' && k !== this.#at;
      this.#show(k);
    });
    // As version 4: the point goes with the mouse, focus or none, and the next arrow starts from nothing. A touch has
    // no leaving to speak of.
    body.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.#show(null); });
    body.addEventListener('focusout', () => this.#show(null));
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
        if (near != null) { e.preventDefault(); this.#show(points[near]!.getAttribute('data-row')); }
        return;
      }
      const series = at >= 0 && box.dataset.hits === 'x' ? stepSeries(e.key, this.#order.indexOf(this.#series ?? ''), this.#order.length) : null;
      if (series != null) { e.preventDefault(); this.#show(this.#at, this.#order[series] ?? null); return; }
      const to = step(e.key, at, points.length, box.dataset.hits === 'y');
      if (to == null) return;
      e.preventDefault();
      this.#show(points[to]!.getAttribute('data-row'), this.#series);
    });
  }

  /** After each paint: name the points the layout made, and keep the chosen one if it is still there. */
  paint(scene: Scene, q: Query, result: Result, catalog: Catalog): void {
    const { rows, x, split } = rowsAt(scene, q, result), totals = (x != null && split != null && result.totalsBy?.[x]) || [];
    this.#keys = scene.rows ?? []; this.#rows = rows; this.#order = split == null ? [] : scene.series ?? []; this.#split = split; this.#q = q; this.#catalog = catalog;
    this.#says = this.#keys.map((k, i) => (split == null ? readout(rows[i]![0] ?? {}, q, catalog) : readoutAt(rows[i]!, totals.find((t) => String(t[x!]) === k), q, catalog, x!, split)));
    const box = this.#box();
    if (box) {
      attr(box, 'role', 'listbox'); attr(box, 'tabindex', this.#keys.length ? 0 : null);
      attr(box, 'aria-label', catalog.dimensions[x!]?.label); attr(box, 'aria-orientation', box.dataset.hits === 'y' ? 'vertical' : 'horizontal');
      for (const el of Array.from(box.children)) {
        const i = this.#keys.indexOf(el.getAttribute('data-row') ?? '');
        attr(el, 'role', 'option'); attr(el, 'id', 'hit-' + i); attr(el, 'aria-label', this.#says[i]);
      }
    }
    this.#show(box?.matches(':focus') && this.#at != null && this.#keys.includes(this.#at) ? this.#at : null, this.#series != null && this.#order.includes(this.#series) ? this.#series : null);
  }

  #box(): HTMLElement | null { return this.#body.querySelector<HTMLElement>('[data-hits]'); }
  /** The points on show, in the order of the result. One a fit rule or a height limit has taken away is passed over. */
  #points(box: HTMLElement): HTMLElement[] {
    const c = box.getBoundingClientRect(), by = new Map(Array.from(box.children, (el) => [el.getAttribute('data-row'), el as HTMLElement]));
    return this.#keys.flatMap((k) => by.get(k) ?? []).filter((el) => { const r = el.getBoundingClientRect(); return el.getClientRects().length > 0 && r.left < c.right && r.top < c.bottom; });
  }

  /** Choose a row, or none, and with it one series there, or all. Everything drawn from the row is marked, and so is
   * what is drawn from the series: its mark at the row, its line, its name. The readout is set by the row's point. */
  #show(key: string | null, series: string | null = null): void {
    this.#at = key; this.#series = series = key == null ? null : series;
    const box = this.#box(), tip = this.#tip;
    let point: Element | null = null;
    this.#body.querySelectorAll('[data-row], [data-series]').forEach((el) => {
      const row = el.getAttribute('data-row'), of = el.getAttribute('data-series'), on = key != null && row === key;
      if (row != null) el.toggleAttribute('data-active', on);
      if (of != null) el.toggleAttribute('data-chosen', of === series && (row == null || on));
      if (on && el.parentElement === box) point = el;
    });
    if (box) attr(box, 'aria-activedescendant', (point as Element | null)?.id);
    tip.hidden = !point;
    if (!point) return;
    const i = this.#keys.indexOf(key!), pair = this.#pair(i);
    const says = pair ? readout(pair, this.#q!, this.#catalog!) : this.#says[i] ?? '';
    // The option is named by what is read out, so a series chosen inside it is announced as it is shown.
    // ponytail: the name of the option in focus changes under it. Whether a screen reader says so is not checked.
    if (this.#order.length) for (const el of Array.from(box!.children)) attr(el, 'aria-label', el === point ? says : this.#says[this.#keys.indexOf(el.getAttribute('data-row') ?? '')]);
    tip.textContent = says;
    // Above the point, or below it, or over the top of a view too small for either: always inside the view, because
    // whatever holds a view may clip at its edge.
    // ponytail: placed once, when chosen. It does not follow a resize or a scroll inside the view.
    const f = this.#fig.getBoundingClientRect(), r = (point as HTMLElement).getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const c = parseFloat((point as HTMLElement).style.getPropertyValue('--vg-c')), x = r.left + r.width * (Number.isFinite(c) ? c : 0.5) - f.left - w / 2;
    const above = r.top - f.top - h - 2, below = r.bottom - f.top + 2;
    tip.style.setProperty('left', Math.max(0, Math.min(x, f.width - w)) + 'px');
    tip.style.setProperty('top', (above >= 0 ? above : below + h <= f.height ? below : 0) + 'px');
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
