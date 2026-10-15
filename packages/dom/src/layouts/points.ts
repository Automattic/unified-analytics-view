import { AXES_HEIGHT, FROM_TOP } from '../layout.ts';
import { SIZE_KEY_BLOCK } from '../chrome/size.ts';
import { POINT_INSET, declutter, type CircleNode, type PathNode, type Scene, type SceneNode, type TextNode } from '@unified-analytics/core';
import { attr, ensure, keyed, prop, text } from '../dom.ts';
import { token } from '../tokens.ts';
import { RULE } from '../chrome/rule.ts';
import { thinLabels } from '../measure.ts';
import { ANCHOR, label } from '../chrome/label.ts';
import { unitDot } from '../chrome/unit.ts';

/* What a plot gains with `dot`, with `text` on its points, and with a metric on x: dots, the labels on them, the key
 * to their sizes (the chrome's), and a rule that stands at a value on x. It is the cartesian layout's, kept in a file of its own:
 * cartesian.ts adds POINTS_CSS and POINTS_FIT to its own and calls paintPoints, the key's painter and measurePoints.
 *
 * Dots are HTML placed by custom properties, as bars are. A dot's size is a step in the scene. How big a step is, in
 * pixels, is here and nowhere else: 9 px across at the first and 5 more with each, and 6 for a dot with no size.
 *
 *   .uav-plot
 *     .uav-dots              dots on a time or category axis. The plot's own hit targets step through them
 *     .uav-points            dots at two metrics. They are their own targets, in two dimensions: data-hits="xy".
 *                            Where a line joins them they are stepped through in its order: data-hits="path"
 *     .uav-point-labels      a label on each point. The measured pass hides the ones that collide
 *   .uav-size                the key to sizes, under the plot (chrome/size.ts) */
export const DOT = 'calc(4px + var(--uav-size, 0.4) * 5px)';
export const POINTS_CSS = `
.uav-dots, .uav-points, .uav-point-labels { position: absolute; inset: 0; }
.uav-body[data-scale="point"] :is(.uav-dots, .uav-point-labels) { inset-inline: ${POINT_INSET}px; }
/* The holder of points lies over the plot's own hit targets, so only its dots take the pointer. */
.uav-dots, .uav-points, .uav-point-labels { pointer-events: none; }
.uav-points i { pointer-events: auto; }
/* A point of a line that has no dot drawn on it: there to be pointed at and stepped to, and it wears only the outline. */
.uav-points i[data-bare] { background: none; }
:is(.uav-dots, .uav-points) i { position: absolute; inset-inline-start: calc(var(--uav-x) * 100%); inset-block-start: ${FROM_TOP}; translate: -50% -50%;
  inline-size: ${DOT}; block-size: ${DOT}; border-radius: 50%; background: var(--uav-paint); }
/* A label sits above its point, clear of the dot. --uav-nudge is the measured pass's: what keeps it inside the plot. */
.uav-point-labels span { position: absolute; inset-inline-start: calc(var(--uav-x) * 100%); inset-block-start: ${FROM_TOP};
  translate: calc(${ANCHOR.middle} + var(--uav-nudge, 0px)) calc(-100% - 2px - ${DOT} / 2); ${label({ truncate: true })} }
/* A rule at a value on x stands the height of the plot, and its label sits beside it at the top. */
.uav-line[data-upright] { inset-block: 0; inset-inline: calc(var(--uav-x) * 100%) auto; inline-size: ${RULE}; block-size: auto; translate: -50%; --uav-rule-way: 0deg; }
.uav-refs span[data-upright] { inset-inline: calc(var(--uav-x) * 100%) auto; translate: 4px 0; padding: 0; }
.uav-refs span[data-upright][data-anchor="end"] { translate: calc(${ANCHOR.end} - 4px) 0; }
/* The key to sizes takes a row of its own under whatever else the body holds, and the view is that much taller for it. */
.uav[data-layout="cartesian"][data-parts~="size"] { --uav-body-block: calc(${AXES_HEIGHT} + ${SIZE_KEY_BLOCK}px); }
.uav[data-layout="cartesian"] .uav-size { grid-column: 1 / -1; }`;

/* A plot of points has no sparkline form. Under its `points` rule the body goes whole, and the number that the rule
 * shows stands alone, as it does under `marks`. Both ask for dots in `.uav-points`, so no other plot is touched. */
export const POINTS_FIT: Record<string, Record<string, string>> = {
  points: { '.uav-body:has(.uav-points > i)': 'display: none;', '.uav-number:has(~ .uav-body .uav-points > i)': 'margin: 0;' },
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
  const holder = body.querySelector<HTMLElement>('.uav-point-labels');
  if (!holder) return;
  thinLabels(holder, ':scope > span:not([data-exit])', (labels) => {
    const room = holder.getBoundingClientRect();
    return declutter(labels.map((el) => {
      const r = el.getBoundingClientRect(), mid = num(el, '--uav-x') * room.width - r.width / 2, x = Math.max(0, Math.min(mid, room.width - r.width));
      prop(el, '--uav-nudge', x - mid + 'px');
      return { x, y: (1 - num(el, '--uav-t')) * room.height - 2 - (4 + (num(el, '--uav-size') || 0.4) * 5) / 2 - r.height, w: r.width, h: r.height, rank: Number(el.dataset.rank) || 0 };
    }));
  });
}

/** A target for each row a joining line passes through, once, where it has a row: what stands in for dots that no layer drew. */
export function pathTargets(paths: PathNode[]): CircleNode[] {
  const at = new Map<string, CircleNode>();
  for (const n of paths) for (const p of n.points) if (p.row != null && !at.has(p.row)) at.set(p.row, { key: 'at:' + p.row, part: 'points', kind: 'circle', pulse: false, x: p.x, t: p.v, row: p.row, ...(n.series != null && { series: n.series }), paint: n.paint, layer: 'guide' });
  return [...at.values()];
}

/** Paint them, after the plot's own parts. `plot` is the cartesian layout's `.uav-plot`. */
export function paintPoints(plot: HTMLElement, scene: Scene): void {
  const nodes = scene.nodes, dots = (part: string) => nodes.filter((n): n is CircleNode => n.part === part && n.kind === 'circle');
  const dot = (el: HTMLElement | SVGElement, n: CircleNode) => { prop(el, '--uav-x', n.x); prop(el, '--uav-t', n.t); prop(el, '--uav-size', n.size); unitDot(el, n); };
  const drawn = dots('points'), sizes = new Map(drawn.concat(dots('plot')).map((n) => [n.row, n.size]));
  keyed(ensure(plot, 'div', 'uav-dots'), dots('plot'), () => 'i', dot);
  // A line that joins the points of two metrics (core puts its path in their part). Where no layer draws a dot on them,
  // each point of the line is a target all the same, with nothing painted: there is still a point to step to and read.
  const joined = nodes.filter((n): n is PathNode => n.part === 'points' && n.kind === 'path'), bare = drawn.length ? [] : pathTargets(joined);
  const points = drawn.concat(bare);
  // Points at two metrics are their own hit targets. The plot's layer of them, which tiles it along x, stands down.
  // Joined by a line they are stepped through in the line's order, which is the rows'. Loose, by which is nearest (keys.ts).
  const holder = ensure(plot, 'div', 'uav-points');
  keyed(holder, points, () => 'i', (el, n) => { dot(el, n); el.toggleAttribute('data-bare', bare.includes(n)); });
  attr(holder, 'data-hits', points.length ? (joined.length ? 'path' : 'xy') : null);
  if (points.length) plot.querySelector(':scope > .uav-hits')?.removeAttribute('data-hits');

  const labels = ensure(plot, 'div', 'uav-point-labels');
  labels.setAttribute('aria-hidden', 'true');
  keyed(labels, nodes.filter((n): n is TextNode => n.part === 'point-labels' && n.kind === 'text'), () => 'span', (el, n) => {
    text(el, n); prop(el, '--uav-x', n.x); prop(el, '--uav-t', n.t); prop(el, '--uav-size', sizes.get(n.row)); el.toggleAttribute('data-halo', !!n.halo);
  });

  // The layout painted every rule as a line across the plot. One at a value on x is stood up, and its label with it.
  const upright = new Map(nodes.filter((n: SceneNode) => n.part === 'plot' && (n.kind === 'line' || n.kind === 'text') && n.x != null).map((n) => [n.key, n as TextNode]));
  for (const el of plot.querySelectorAll<HTMLElement>('.uav-refs > [data-key]')) {
    const n = upright.get(el.dataset.key!);
    el.toggleAttribute('data-upright', n != null); prop(el, '--uav-x', n?.x); attr(el, 'data-anchor', n?.kind === 'text' ? n.anchor : null);
  }
}
