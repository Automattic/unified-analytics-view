import { pathD, type PathNode } from '@universal-analytics/core';

/* Motion: what a data change animates. A resize animates nothing, because nothing here runs on one and a ratio
 * does not change with the room.
 *
 * Positions are registered custom properties, so an update is a CSS transition on them. An entering node starts
 * from `@starting-style` and a leaving one is kept, marked `data-exit`, until it has faded. Both are the
 * stylesheet's, timed by tokens, and both are scoped to `data-moving` on the figure: the element sets it for a
 * data change and settle() lifts it when the last transition is over, so a part a container query brings back
 * later does not fade in. A path's shape is the one thing CSS cannot move, so morph() redraws it each frame.
 *
 * What takes room in the flow (the number's lines, a row, a legend entry) leaves at once. So nothing kept for a
 * fade can change a size the measured pass reads. */

const TOKEN = (kind: string, duration: string, easing: string) =>
  `var(--a8c-charts-motion-duration-${kind}, ${duration}) var(--a8c-charts-motion-easing-${kind}, ${easing})`;
const UPDATE = TOKEN('update', '300ms', 'cubic-bezier(0.4, 0, 0.2, 1)'), EXIT = TOKEN('exit', '150ms', 'cubic-bezier(0.4, 0, 1, 1)');
/** The ratios, and `--vg-p`, which a path's morph is timed by. */
const MOVED = ['--vg-x', '--vg-w', '--vg-v', '--vg-t', '--vg-p'];

let registered = false;
/** Register them as numbers, which is what lets them animate. `@property` is ignored in a shadow root, so this is
 * on the document, which is why they carry a prefix. Where it fails, values still apply and nothing moves. */
export function register(): void {
  registered = MOVED.every((name) => {
    try { CSS.registerProperty({ name, syntax: '<number>', inherits: false, initialValue: '0' }); return true; }
    catch (e) { return (e as Error).name === 'InvalidModificationError'; }           // registered already
  });
}

/** It joins the base sheet inside `@layer vg`. With reduced motion none of it applies, so nothing moves. */
export const MOTION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .vg[data-moving] [data-key] { transition: ${MOVED.map((p) => p + ' ' + UPDATE).join(', ')}, opacity ${TOKEN('entrance', '200ms', 'cubic-bezier(0, 0, 0.2, 1)')}; }
  /* Inline values are the end state, so the start has to outrank them. A bar grows from the baseline, a segment from nothing. */
  @starting-style {
    .vg[data-moving] [data-key] { opacity: 0 !important; }
    .vg[data-moving] :is(.vg-bars, .vg-band, .vg-row) > i { --vg-v: 0 !important; }
  }
  /* Leaving. Only what is placed by a ratio is kept to fade: --vg-leaving says so, and settle() reads it. */
  .vg[data-moving] :is(.vg-plot, .vg-x-axis, .vg-y-axis, .vg-band) [data-exit] { --vg-leaving: 1; opacity: 0 !important; pointer-events: none; transition: opacity ${EXIT}, --vg-v ${EXIT}; }
  .vg[data-moving] :is(.vg-bars, .vg-band) [data-exit] { --vg-v: 0 !important; }
  /* A y label sizes its column, so one that is leaving is taken out of the flow and the column is the new labels'. */
  .vg-y-axis { position: relative; }
  .vg[data-moving] .vg-y-axis [data-exit] { position: absolute; inset-inline-end: 0; }
}`;

export interface XV { x: number; v: number }

/** `from`, read at each x of `to`. A morph moves values and never x, so the two sets need not share their rows:
 * when they do, this is `from` itself. */
export function resample(from: XV[], to: XV[]): XV[] {
  return to.map(({ x }) => {
    const i = from.findIndex((p) => p.x >= x), a = from[i - 1], b = from[i] ?? from[from.length - 1];
    return { x, v: !b ? 0 : !a || b.x <= x ? b.v : a.v + (b.v - a.v) * (x - a.x) / (b.x - a.x) };
  });
}
/** The points `p` of the way from one set to the other, x taken from `to`. */
export function mix(from: XV[], to: XV[], p: number): XV[] {
  return to.map((t, i) => ({ x: t.x, v: from[i]!.v + (t.v - from[i]!.v) * p }));
}

let turn = 0;

/** Before a paint. Only a data change within the same layout moves: not the first paint, not a change of layout. */
export function begin(fig: HTMLElement, moving: boolean): void {
  if (moving && registered) fig.dataset.moving = String(++turn); else delete fig.dataset.moving;
}

/** A node whose key has gone. Where nothing moves it goes now. Otherwise it is marked, and settle() says when. */
export function leave(el: Element): void {
  if (el.closest('.vg[data-moving]')) el.setAttribute('data-exit', ''); else el.remove();
}

const transitions = (el: Element, subtree = false) => el.getAnimations({ subtree }).filter((a) => a instanceof CSSTransition);
const over = (a: Animation[]) => Promise.allSettled(a.map((t) => t.finished));

/** After a paint and before the measured pass. A leaving node the stylesheet does not fade goes here, so the pass
 * never reads one. The rest go when their fade ends or is cancelled, and `data-moving` when nothing moves. */
export function settle(fig: HTMLElement): void {
  const run = fig.dataset.moving;
  if (!run) return;
  // Every leaving node is read before any is removed, and the transitions are asked for once: a removal between two
  // reads lays the page out again for each node, and a node's own getAnimations() slows with every transition running.
  const fades = new Map<Element, Animation[]>();
  for (const t of transitions(fig, true)) { const e = t.effect as KeyframeEffect | null; if (e?.target && !e.pseudoElement) fades.set(e.target, (fades.get(e.target) ?? []).concat(t)); }
  const leaving = Array.from(fig.querySelectorAll('[data-exit]'), (el) => [el, getComputedStyle(el).getPropertyValue('--vg-leaving') ? fades.get(el) ?? [] : []] as const);
  for (const [el, fading] of leaving) {
    // A key that comes back takes its element back, and the mark with it.
    if (fading.length) over(fading).then(() => { if (el.hasAttribute('data-exit')) el.remove(); }); else el.remove();
  }
  // Again when they end: the measured pass can bring a part in after this.
  const rest = (): void => {
    if (fig.dataset.moving !== run) return;
    const moving = transitions(fig, true);
    if (moving.length) over(moving).then(rest); else delete fig.dataset.moving;
  };
  rest();
}

interface Morph { now: XV[]; from: XV[]; to: PathNode; frame: number; clock?: Animation | null }
const morphs = new WeakMap<Element, Morph>();

/** Set a path's shape. A new path, or one in a view that is not moving, takes it at once. A kept one goes there
 * from wherever it is now: `--vg-p` is given a new value, the stylesheet's transition on it is the clock, and each
 * frame draws the points that far along. With no transition (reduced motion, no registered property, a path a
 * rule has hidden) the first frame is the last. At rest `d` is core's own string. */
export function morph(el: SVGElement, n: PathNode): void {
  const m = morphs.get(el);
  if (!m || !el.closest('.vg[data-moving]')) {
    if (m?.frame) cancelAnimationFrame(m.frame);
    el.setAttribute('d', n.d ?? '');
    morphs.set(el, { now: n.points, from: n.points, to: n, frame: 0 });
    return;
  }
  if (!m.frame && n.d === m.to.d) { m.to = n; return; }                  // at rest on this shape already: the same data again
  m.from = resample(m.now, n.points); m.to = n; m.clock = undefined;
  el.style.setProperty('--vg-p', String(++turn));
  m.frame ||= requestAnimationFrame(() => step(el, m));
}
function step(el: SVGElement, m: Morph): void {
  // The clock is found once for a morph. Asking each frame flushes style after the path before has been redrawn.
  if (m.clock === undefined) m.clock = transitions(el).find((t) => (t as CSSTransition).transitionProperty === '--vg-p') ?? null;
  const p = m.clock?.effect?.getComputedTiming().progress ?? 1;
  m.now = mix(m.from, m.to.points, p);
  el.setAttribute('d', (p < 1 ? pathD(m.now, m.to.curve, m.to.fill) : m.to.d) ?? '');
  m.frame = p < 1 ? requestAnimationFrame(() => step(el, m)) : 0;
}
