import { declutter, type CircleNode, type Scene, type SceneNode, type TextNode } from '@universal-analytics/core';
import { attr, ensure, keyed, paintVar, prop, text } from '../dom.ts';

/* What a plot gains with `dot`, with `text` on its points, and with a metric on x: dots, the labels on them, the key
 * to their sizes, and a rule that stands at a value on x. It is the cartesian layout's, kept in a file of its own:
 * cartesian.ts adds POINTS_CSS and POINTS_FIT to its own and calls paintPoints and measurePoints.
 *
 * Dots are HTML placed by custom properties, as bars are. A dot's size is a step in the scene. How big a step is, in
 * pixels, is here and nowhere else: 9 px across at the first and 5 more with each, and 6 for a dot with no size.
 *
 *   .vg-plot
 *     .vg-dots              dots on a time or category axis. The plot's own hit targets step through them
 *     .vg-points            dots at two metrics. They are their own targets, in two dimensions: data-hits="xy"
 *     .vg-point-labels      a label on each point. The measured pass hides the ones that collide
 *   .vg-size                the key to sizes, under the plot */
const DOT = 'calc(4px + var(--vg-size, 0.4) * 5px)';
export const POINTS_CSS = `
.vg-dots, .vg-points, .vg-point-labels { position: absolute; inset: 0; }
.vg-body[data-scale="point"] :is(.vg-dots, .vg-point-labels) { inset-inline: 2px; }
.vg-dots, .vg-point-labels { pointer-events: none; }
/* ponytail: physical translate, as the x axis has, so not right for right-to-left. */
:is(.vg-dots, .vg-points) i { position: absolute; inset-inline-start: calc(var(--vg-x) * 100%); inset-block-start: calc((1 - var(--vg-t)) * 100%); translate: -50% -50%;
  inline-size: ${DOT}; block-size: ${DOT}; border-radius: 50%; background: var(--vg-paint); }
.vg-points [data-active] { outline: 2px solid ${paintVar('ink')}; outline-offset: 1px; }
/* A label sits above its point, clear of the dot. --vg-nudge is the measured pass's: what keeps it inside the plot. */
.vg-point-labels span { position: absolute; inset-inline-start: calc(var(--vg-x) * 100%); inset-block-start: calc((1 - var(--vg-t)) * 100%);
  translate: calc(-50% + var(--vg-nudge, 0px)) calc(-100% - 2px - ${DOT} / 2); max-inline-size: 14ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--vg-paint); }
.vg-point-labels [data-halo] { -webkit-text-stroke: 3px var(--a8c-charts-color-background, Canvas); paint-order: stroke fill; }
/* A label the measured pass gave up keeps its box, so the next measurement reads the same. */
.vg-point-labels [data-thin] { visibility: hidden; }
/* A rule at a value on x stands the height of the plot, and its label sits beside it at the top. */
.vg-line[data-upright] { inset-block: 0; inset-inline: calc(var(--vg-x) * 100%) auto; inline-size: var(--vg-stroke, 1px); block-size: auto; translate: -50%; }
.vg-line[data-upright][data-dash] { background: repeating-linear-gradient(0deg, var(--vg-paint) 0 var(--vg-dash), transparent 0 calc(var(--vg-dash) + var(--vg-gap))); }
.vg-refs span[data-upright] { inset-inline: calc(var(--vg-x) * 100%) auto; translate: 4px 0; padding: 0; }
/* The key to sizes takes a row of its own under whatever else the body holds, and the view is that much taller for it. */
.vg[data-layout="cartesian"][data-parts~="size"] { --vg-body-block: calc(var(--vg-axes-height, 184px) + 28px); }
.vg-size { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 4px; block-size: 24px; margin-block-start: 4px; overflow: hidden; white-space: nowrap; }
.vg-size:empty { display: none; }
.vg-size i { flex: none; inline-size: ${DOT}; block-size: ${DOT}; border-radius: 50%; background: var(--vg-paint); }
.vg-size span { margin-inline-end: 6px; color: var(--vg-paint); }`;

/* A plot of points has no sparkline form. Under its `points` rule the body goes whole, and the number that the rule
 * shows stands alone, as it does under `marks`. Both ask for dots in `.vg-points`, so no other plot is touched. */
export const POINTS_FIT: Record<string, Record<string, string>> = {
  points: { '.vg-body:has(.vg-points > i)': 'display: none;', '.vg-number:has(~ .vg-body .vg-points > i)': 'margin: 0;' },
};

/** Where an arrow key moves to among points in two dimensions, from `at` (-1 when none is chosen): the nearest point
 * on the side the arrow points to, where a point off to one side counts as twice as far. It stops where there is
 * none, as a step along one axis stops at its end. From nothing, any arrow takes the first point. Null when the key
 * is not an arrow. `y` runs down the page.
 * A proposal. Version 4 of @automattic/charts has no keyboard model for points in two dimensions, and this one is
 * not confirmed (chart-coverage-plan, section 6, still open). */
export function nearest(key: string, at: number, points: { x: number; y: number }[]): number | null {
  const d = ({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as Record<string, [number, number]>)[key];
  if (!d || !points.length) return null;
  const from = points[at];
  if (!from) return 0;
  let best = at, least = Infinity;
  points.forEach((p, i) => {
    const dx = p.x - from.x, dy = p.y - from.y, across = Math.abs(dx * d[1] + dy * d[0]);
    // Points in one place are told apart by their order, so each can still be reached.
    const along = dx || dy ? dx * d[0] + dy * d[1] : (i - at) * (d[0] + d[1]) * Number.EPSILON;
    if (along > 0 && along + 2 * across < least) { least = along + 2 * across; best = i; }
  });
  return best;
}

const num = (el: HTMLElement, name: string) => Number(el.style.getPropertyValue(name));

/** Its share of the measured pass: each label is kept inside the plot, and where two would collide the one of lower
 * rank is hidden. Each is placed from its ratios, not read where it stands: a label may be on its way.
 * ponytail: a label avoids other labels only, and never moves up or down to make room. A first cut, and not the
 * answer to label collision (reference, Open 5). */
export function measurePoints(body: HTMLElement): void {
  const holder = body.querySelector<HTMLElement>('.vg-point-labels');
  if (!holder) return;
  const labels = Array.from(holder.querySelectorAll<HTMLElement>(':scope > span:not([data-exit])')).filter((el) => el.getClientRects().length);
  const room = holder.getBoundingClientRect();
  const gone = declutter(labels.map((el) => {
    const r = el.getBoundingClientRect(), mid = num(el, '--vg-x') * room.width - r.width / 2, x = Math.max(0, Math.min(mid, room.width - r.width));
    prop(el, '--vg-nudge', x - mid + 'px');
    return { x, y: (1 - num(el, '--vg-t')) * room.height - 2 - (4 + (num(el, '--vg-size') || 0.4) * 5) / 2 - r.height, w: r.width, h: r.height, rank: Number(el.dataset.rank) || 0 };
  }));
  labels.forEach((el, i) => el.toggleAttribute('data-thin', gone[i]));
}

/** Paint them, after the plot's own parts. `plot` is the cartesian layout's `.vg-plot`. */
export function paintPoints(body: HTMLElement, plot: HTMLElement, scene: Scene): void {
  const nodes = scene.nodes, dots = (part: string) => nodes.filter((n): n is CircleNode => n.part === part && n.kind === 'circle');
  const dot = (el: HTMLElement | SVGElement, n: CircleNode) => { prop(el, '--vg-x', n.x); prop(el, '--vg-t', n.t); prop(el, '--vg-size', n.size); };
  const points = dots('points'), sizes = new Map(points.concat(dots('plot')).map((n) => [n.row, n.size]));
  keyed(ensure(plot, 'div', 'vg-dots'), dots('plot'), () => 'i', dot);
  // Points at two metrics are their own hit targets. The plot's layer of them, which tiles it along x, stands down.
  const holder = ensure(plot, 'div', 'vg-points');
  keyed(holder, points, () => 'i', dot);
  attr(holder, 'data-hits', points.length ? 'xy' : null);
  if (points.length) plot.querySelector(':scope > .vg-hits')?.removeAttribute('data-hits');

  const labels = ensure(plot, 'div', 'vg-point-labels');
  labels.setAttribute('aria-hidden', 'true');
  keyed(labels, nodes.filter((n): n is TextNode => n.part === 'point-labels' && n.kind === 'text'), () => 'span', (el, n) => {
    text(el, n); prop(el, '--vg-x', n.x); prop(el, '--vg-t', n.t); prop(el, '--vg-size', sizes.get(n.row)); el.toggleAttribute('data-halo', !!n.halo);
  });

  const key = ensure(body, 'div', 'vg-size');
  key.setAttribute('aria-hidden', 'true');
  keyed(key, nodes.filter((n): n is CircleNode | TextNode => n.part === 'size' && (n.kind === 'circle' || n.kind === 'text')), (n) => (n.kind === 'circle' ? 'i' : 'span'), (el, n) => {
    if (n.kind === 'text') text(el, n); else prop(el, '--vg-size', n.size);
  });

  // The layout painted every rule as a line across the plot. One at a value on x is stood up, and its label with it.
  const upright = new Map(nodes.filter((n: SceneNode) => n.part === 'plot' && (n.kind === 'line' || n.kind === 'text') && n.x != null).map((n) => [n.key, (n as TextNode).x]));
  for (const el of plot.querySelectorAll<HTMLElement>('.vg-refs > [data-key]')) {
    const x = upright.get(el.dataset.key!);
    el.toggleAttribute('data-upright', x != null); prop(el, '--vg-x', x);
  }
}
