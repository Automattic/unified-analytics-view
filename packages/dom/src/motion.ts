import { pathD, type PathNode } from '@unified-analytics/core';
import { FACES, token } from './tokens.ts';

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

const TOKEN = (kind: string) => token('motion-duration-' + kind) + ' ' + token('motion-easing-' + kind);
const UPDATE = TOKEN('update'), EXIT = TOKEN('exit');
/** The ratios, and `--uav-p`, which a path's morph is timed by. */
const MOVED = ['--uav-x', '--uav-w', '--uav-v', '--uav-v0', '--uav-t', '--uav-p', '--uav-x2', '--uav-t2'];

let registered = false;
/** Register them as numbers, which is what lets them animate. `@property` is ignored in a shadow root, so this is
 * on the document, which is why they carry a prefix. Where it fails, values still apply and nothing moves.
 * The faces are registered with them, as lengths that inherit: a face is then worked out where it is set, against
 * the view, and handed down as a size (view.ts). Where that fails each part works the token out for itself. */
export function register(): void {
  const add = (name: string, syntax: string, inherits: boolean, initialValue: string) => {
    try { CSS.registerProperty({ name, syntax, inherits, initialValue }); return true; }
    catch (e) { return (e as Error).name === 'InvalidModificationError'; }           // registered already
  };
  registered = MOVED.every((name) => add(name, '<number>', false, '0'));
  for (const face of FACES) add('--uav-font-' + face, '<length>', true, '0px');
  // How far a number in dots has run along its screen (dots.ts). A number, so that it moves and does not jump.
  add('--uav-s', '<number>', true, '0');
  add('--uav-e', '<number>', true, '0');
}

/** It joins the base sheet inside `@layer uav`. With reduced motion none of it applies, so nothing moves. */
export const MOTION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .uav[data-moving] [data-key] { transition: ${MOVED.map((p) => p + ' ' + UPDATE).join(', ')}, opacity ${TOKEN('entrance')}; }
  /* Inline values are the end state, so the start has to outrank them. A bar grows from where it starts, a segment from nothing. */
  @starting-style {
    .uav[data-moving] [data-key] { opacity: 0 !important; }
    .uav[data-moving] :is(.uav-bars, .uav-band, .uav-row) > i { --uav-v: var(--uav-v0, 0) !important; }
  }
  /* Leaving. Only what is placed by a ratio is kept to fade: --uav-leaving says so, and settle() reads it. */
  .uav[data-moving] :is(.uav-plot, .uav-x-axis, .uav-y-axis, .uav-band) [data-exit] { --uav-leaving: 1; opacity: 0 !important; pointer-events: none; transition: opacity ${EXIT}, --uav-v ${EXIT}; }
  .uav[data-moving] :is(.uav-bars, .uav-band) [data-exit] { --uav-v: var(--uav-v0, 0) !important; }
  /* A y label sizes its column, so one that is leaving is taken out of the flow and the column is the new labels'. */
  .uav-y-axis { position: relative; }
  .uav[data-moving] .uav-y-axis [data-exit] { position: absolute; inset-inline-end: 0; }
  /* A change's arrow, every so often, goes the way it points: out of its box and in again from the other side, in
   * steps as the face's pixels are. Most of the time it stands still. */
  .uav-trend > b { animation: uav-beat-up 9s steps(6) var(--uav-beat, 0s) infinite; }
  .uav-trend[data-dir="down"] > b { animation-name: uav-beat-down; }
}
/* Half a space parts the arrow from its number: a whole one of a fixed-width face is a gap. It is half a figure's
 * width, which in such a face is half a space and in any other about a whole one, and the space that is written
 * after the arrow is in the box with it (dom.ts), at the end of its line, where it takes no room. */
.uav-trend { display: inline-block; overflow: hidden; block-size: 1lh; vertical-align: bottom; font-style: normal; margin-inline-end: 0.5ch; }
.uav-trend > b { display: block; font-weight: inherit; }
@keyframes uav-beat-up { 0%, 88% { translate: 0 0; } 94% { translate: 0 -100%; } 94.001% { translate: 0 100%; } 100% { translate: 0 0; } }
@keyframes uav-beat-down { 0%, 88% { translate: 0 0; } 94% { translate: 0 100%; } 94.001% { translate: 0 -100%; } 100% { translate: 0 0; } }`;

/** A point of a path: where it is, for an area where it starts when that is not the bottom, and over bins how wide its step is. */
export interface XV { x: number; v: number; v0?: number; w?: number }

/** `from`, read at each x of `to`. A morph moves values and never x, so the two sets need not share their rows:
 * when they do, this is `from` itself. */
export function resample(from: XV[], to: XV[]): XV[] {
  const based = from.some((p) => p.v0 != null);
  return to.map(({ x }) => {
    const i = from.findIndex((p) => p.x >= x), a = from[i - 1], b = from[i] ?? from[from.length - 1];
    const at = (of: (p: XV) => number) => (!b ? 0 : !a || b.x <= x ? of(b) : of(a) + (of(b) - of(a)) * (x - a.x) / (b.x - a.x));
    return { x, v: at((p) => p.v), ...(based && { v0: at((p) => p.v0 || 0) }) };
  });
}
/** The points `p` of the way from one set to the other, x taken from `to`, and with it how wide a step is: a morph
 * moves values, and a bin stays where the new shape has it. Where either has a start, that moves too:
 * a stacked area's floor is the series under it, which is on its way as well.
 * `free` is for a line that joins the points of two metrics: a point there has a value on x as well, so it moves across too. */
export function mix(from: XV[], to: XV[], p: number, free = false): XV[] {
  return to.map((t, i) => {
    const f = from[i]!, f0 = f.v0 || 0, t0 = t.v0 || 0;
    return { x: free ? f.x + (t.x - f.x) * p : t.x, v: f.v + (t.v - f.v) * p, ...((f0 || t0) && { v0: f0 + (t0 - f0) * p }), ...(t.w != null && { w: t.w }) };
  });
}
/** `from` for a line that joins the points of two metrics: point for point in the order of the rows, which is the
 * line's own. It runs in no order along x, so there is no reading it at an x. A row the old line had none for starts
 * where the old line ended. */
export function pairUp(from: XV[], to: XV[]): XV[] {
  return to.map((t, i) => from[i] ?? from[from.length - 1] ?? t);
}

let turn = 0;

/** Before a paint. Only a data change within the same layout moves: not the first paint, not a change of layout. */
export function begin(fig: HTMLElement, moving: boolean): void {
  if (moving && registered) fig.dataset.moving = String(++turn); else delete fig.dataset.moving;
}

/** A node whose key has gone. Where nothing moves it goes now. Otherwise it is marked, and settle() says when. */
export function leave(el: Element): void {
  if (el.closest('.uav[data-moving]')) el.setAttribute('data-exit', ''); else el.remove();
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
  const leaving = Array.from(fig.querySelectorAll('[data-exit]'), (el) => [el, getComputedStyle(el).getPropertyValue('--uav-leaving') ? fades.get(el) ?? [] : []] as const);
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

/** For an animation that plays once: a line drawing in when its plot loads, a character of the number rolling to
 * the next. The element carries attributes the stylesheet animates by, and they come off when what they started is
 * over, or at once where nothing started: a part a fit rule has hidden, reduced motion, no frames. So a part that
 * a resize brings back later stands as it is and does not play again. */
export function once(el: Element, attrs: string[]): void {
  const done = () => { for (const a of attrs) el.removeAttribute(a); };
  if (typeof requestAnimationFrame !== 'function') { done(); return; }
  if (!onces.length) requestAnimationFrame(playOnce);
  onces.push([el, done]);
}
// Every element asked about in a frame is read before any is written: a removal between two reads lays the page out
// again for each, and on a page of many views that is a layout of the whole page for every number and every line.
const onces: [Element, () => void][] = [];
function playOnce(): void {
  const batch = onces.splice(0), playing = batch.map(([el]) => el.getAnimations({ subtree: true }).filter((a) => a instanceof CSSAnimation));
  batch.forEach(([, done], i) => { if (playing[i]!.length) over(playing[i]!).then(done); else done(); });
}

interface Morph { now: XV[]; from: XV[]; to: PathNode; frame: number; clock?: Animation | null | undefined }
/** Whether a path joins the points of two metrics, and so moves across as well as up and down. */
const free = (n: PathNode) => n.part === 'points';
const morphs = new WeakMap<Element, Morph>();

/** Set a path's shape. A new path, or one in a view that is not moving, takes it at once. A kept one goes there
 * from wherever it is now: `--uav-p` is given a new value, the stylesheet's transition on it is the clock, and each
 * frame draws the points that far along. With no transition (reduced motion, no registered property, a path a
 * rule has hidden) the first frame is the last. At rest `d` is core's own string. */
export function morph(el: SVGElement, n: PathNode): void {
  const m = morphs.get(el);
  if (!m || !el.closest('.uav[data-moving]')) {
    if (m?.frame) cancelAnimationFrame(m.frame);
    el.setAttribute('d', n.d ?? '');
    morphs.set(el, { now: n.points, from: n.points, to: n, frame: 0 });
    return;
  }
  if (!m.frame && n.d === m.to.d) { m.to = n; return; }                  // at rest on this shape already: the same data again
  m.from = free(n) ? pairUp(m.now, n.points) : resample(m.now, n.points); m.to = n; m.clock = undefined;
  el.style.setProperty('--uav-p', String(++turn));
  m.frame ||= requestAnimationFrame(() => step(el, m));
}
function step(el: SVGElement, m: Morph): void {
  // The clock is found once for a morph. Asking each frame flushes style after the path before has been redrawn.
  if (m.clock === undefined) m.clock = transitions(el).find((t) => (t as CSSTransition).transitionProperty === '--uav-p') ?? null;
  const p = m.clock?.effect?.getComputedTiming().progress ?? 1;
  m.now = mix(m.from, m.to.points, p, free(m.to));
  el.setAttribute('d', (p < 1 ? pathD(m.now, m.to.curve, m.to.fill) : m.to.d) ?? '');
  m.frame = p < 1 ? requestAnimationFrame(() => step(el, m)) : 0;
}
