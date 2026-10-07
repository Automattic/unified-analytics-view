import type { Catalog, Query, RectNode, Result, Row, Scene } from '@universal-analytics/core';
import { attr, ensure, paintVar } from './dom.ts';

/* Hit targets, the keyboard and the readout. A layout marks the element that holds its points with `data-hits`
 * ("x" where they run across, "y" where they run down), and each point is a child carrying `data-row`. Bars in a
 * list and segments of a band are their own targets. A plot has no element per point, so it gets a layer of them.
 *
 * The keyboard is version 4's, read from `useKeyboardNavigation` on Jetpack trunk: one tab stop, nothing chosen on
 * focus, left and right step and stop at the ends, Enter or Space activates the chosen point, Escape lets go of it
 * and Tab moves on. To assistive technology the holder is a listbox and each point an option named by its readout,
 * so the words on screen and the words announced are one string. */

const NF = new Intl.NumberFormat('en-US');
/** A value as the table sets it, which the readout shares. ponytail: core's `fmt` is not exported, and a date stays as it came. */
export const cell = (v: unknown) => (v == null ? '–' : typeof v === 'number' ? NF.format(v) : String(v));

/** What the readout says for one row of the result: the dimension value, each metric, and its comparison if the row has one. */
export function readout(row: Row, q: Query, catalog: Catalog): string {
  const dims = (q.by || []).map((d) => cell(row[d])).join(', ');
  const values = q.metrics.map((m) => {
    const prev = q.compare === 'previous' ? row[m + '@previous'] : null;
    return catalog.metrics[m]!.label + ' ' + cell(row[m]) + (prev == null ? '' : ', previous period ' + cell(prev));
  }).join('; ');
  return dims ? dims + ': ' + values : values;
}

/** Where a key moves to among `count` points, from `at` (-1 when none is chosen). Null when the key is not a step.
 * Up and down step only where the points run down the page. */
export function step(key: string, at: number, count: number, vertical = false): number | null {
  const d = key === 'ArrowRight' || (vertical && key === 'ArrowDown') ? 1 : key === 'ArrowLeft' || (vertical && key === 'ArrowUp') ? -1 : 0;
  return d && count ? Math.min(Math.max(at + d, 0), count - 1) : null;
}

/** The hit targets of a plot: one per row that drew a mark, tiling the plot from edge to edge, each reaching half
 * way to its neighbours. `c` is where the row's own x falls inside its target, for the rule that marks it. */
export function hitNodes(scene: Scene): (RectNode & { c: number })[] {
  const cx = new Map<string, number>();
  for (const n of scene.nodes) {
    if (n.part !== 'plot') continue;
    if (n.kind === 'rect' && n.row != null && n.x != null) cx.set(n.row, n.x + (n.w || 0) / 2);
    else if (n.kind === 'path') for (const p of n.points) cx.set(p.row, p.x);
  }
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
.vg-legend span[data-active] { text-decoration: underline; }`;

/** The interaction of one view. It listens on the body, which outlives every paint, so nothing is bound per point. */
export class Keys {
  #host: HTMLElement; #fig: HTMLElement; #body: HTMLElement; #tip: HTMLElement;
  #keys: string[] = []; #rows: Row[] = []; #says: string[] = [];
  #at: string | null = null;
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
    // A point chosen while the view has focus is the keyboard's too, and stays. A touch has no leaving to speak of.
    body.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this.#box()?.matches(':focus')) this.#show(null); });
    body.addEventListener('focusout', () => this.#show(null));
    body.addEventListener('click', (e) => { if (row(e) !== this.#at) return; if (this.#fresh) this.#fresh = false; else this.#activate(); });
    body.addEventListener('keydown', (e) => {
      const box = this.#box();
      if (!box || e.target !== box) return;
      // Version 4 takes Escape only when a point is chosen, so the first Escape of a dialog around it is not swallowed.
      if (e.key === 'Escape') { if (this.#at != null) { e.preventDefault(); this.#show(null); } return; }
      const points = this.#points(box), at = points.findIndex((el) => el.getAttribute('data-row') === this.#at);
      if (e.key === 'Enter' || e.key === ' ') { if (at >= 0) { e.preventDefault(); this.#activate(); } return; }
      const to = step(e.key, at, points.length, box.dataset.hits === 'y');
      if (to == null) return;
      e.preventDefault();
      this.#show(points[to]!.getAttribute('data-row'));
    });
  }

  /** After each paint: name the points the layout made, and keep the chosen one if it is still there. */
  paint(scene: Scene, q: Query, result: Result, catalog: Catalog): void {
    // ponytail: scene.rows and result.rows are taken to run in step, as every scene builder makes them.
    this.#keys = scene.rows ?? []; this.#rows = result.rows;
    this.#says = this.#keys.map((_, i) => readout(result.rows[i] ?? {}, q, catalog));
    const box = this.#box();
    if (box) {
      attr(box, 'role', 'listbox'); attr(box, 'tabindex', this.#keys.length ? 0 : null);
      attr(box, 'aria-label', catalog.dimensions[(q.by || [])[0]!]?.label); attr(box, 'aria-orientation', box.dataset.hits === 'y' ? 'vertical' : 'horizontal');
      for (const el of Array.from(box.children)) {
        const i = this.#keys.indexOf(el.getAttribute('data-row') ?? '');
        attr(el, 'role', 'option'); attr(el, 'id', 'hit-' + i); attr(el, 'aria-label', this.#says[i]);
      }
    }
    this.#show(box?.matches(':focus') && this.#at != null && this.#keys.includes(this.#at) ? this.#at : null);
  }

  #box(): HTMLElement | null { return this.#body.querySelector<HTMLElement>('[data-hits]'); }
  /** The points on show, in the order of the result. One a fit rule or a height limit has taken away is passed over. */
  #points(box: HTMLElement): HTMLElement[] {
    const c = box.getBoundingClientRect(), by = new Map(Array.from(box.children, (el) => [el.getAttribute('data-row'), el as HTMLElement]));
    return this.#keys.flatMap((k) => by.get(k) ?? []).filter((el) => { const r = el.getBoundingClientRect(); return el.getClientRects().length > 0 && r.left < c.right && r.top < c.bottom; });
  }

  /** Choose a row, or none. Everything drawn from the row is marked, and the readout is set by its point. */
  #show(key: string | null): void {
    this.#at = key;
    const box = this.#box(), tip = this.#tip;
    let point: Element | null = null;
    this.#body.querySelectorAll('[data-row]').forEach((el) => {
      const on = key != null && el.getAttribute('data-row') === key;
      el.toggleAttribute('data-active', on);
      if (on && el.parentElement === box) point = el;
    });
    if (box) attr(box, 'aria-activedescendant', (point as Element | null)?.id);
    tip.hidden = !point;
    if (!point) return;
    tip.textContent = this.#says[this.#keys.indexOf(key!)] ?? '';
    // Above the point, or below it, or over the top of a view too small for either: always inside the view, because
    // whatever holds a view may clip at its edge.
    // ponytail: placed once, when chosen. It does not follow a resize or a scroll inside the view.
    const f = this.#fig.getBoundingClientRect(), r = (point as HTMLElement).getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const c = parseFloat((point as HTMLElement).style.getPropertyValue('--vg-c')), x = r.left + r.width * (Number.isFinite(c) ? c : 0.5) - f.left - w / 2;
    const above = r.top - f.top - h - 2, below = r.bottom - f.top + 2;
    tip.style.setProperty('left', Math.max(0, Math.min(x, f.width - w)) + 'px');
    tip.style.setProperty('top', (above >= 0 ? above : below + h <= f.height ? below : 0) + 'px');
  }

  #activate(): void {
    const row = this.#rows[this.#keys.indexOf(this.#at!)];
    if (row) this.#host.dispatchEvent(new CustomEvent('ua-activate', { bubbles: true, composed: true, detail: { row } }));
  }
}
