import type { LineNode, Scene } from '@universal-analytics/core';
import { ensure, keyed, prop } from '../dom.ts';

/* What a plot gains with a second end and with `tick`: a segment for each row. A rule from one of the row's values
 * to another stands at its x, and a tick lies across its band. It is the cartesian layout's, kept in a file of its
 * own as points.ts is: cartesian.ts adds RANGES_CSS to its own and calls paintRanges.
 *
 * A bar with two ends is a bar like any other, from `v0` to `v`, and an area with two is a path. Neither is here.
 *
 *   .vg-plot
 *     .vg-ranges            a segment per row, placed by custom properties as bars are
 *
 * A segment is HTML, so its stroke stays true at any size. It runs from (x, t) to (x2, t2), is never thinner than
 * its stroke, and is centred on its line. */
const span = (a: string, b: string) => `calc(max(var(${a}) - var(${b}), var(${b}) - var(${a})) * 100%)`;
export const RANGES_CSS = `
.vg-ranges { position: absolute; inset: 0; pointer-events: none; }
.vg-body[data-scale="point"] .vg-ranges { inset-inline: 2px; }
.vg-ranges i { position: absolute; background: var(--vg-paint);
  inset-inline-start: calc(min(var(--vg-x), var(--vg-x2)) * 100%); inline-size: max(var(--vg-stroke, 1px), ${span('--vg-x2', '--vg-x')});
  inset-block-end: calc(min(var(--vg-t), var(--vg-t2)) * 100%); block-size: max(var(--vg-stroke, 1px), ${span('--vg-t2', '--vg-t')}); }
/* ponytail: physical translate, as the x axis has, so not right for right-to-left. */
.vg-ranges i[data-upright] { translate: -50%; }
.vg-ranges i:not([data-upright]) { translate: 0 50%; }
/* One the scene sets before the bars lies under them, as it does where the scene is painted in order: a whisker
 * behind its box. The plot is a container, so this is under its bars and no further. */
.vg-ranges i[data-under] { z-index: -1; }`;

/** Paint them, after the plot's own parts. `plot` is the cartesian layout's `.vg-plot`. */
export function paintRanges(plot: HTMLElement, scene: Scene): void {
  const nodes = scene.nodes, bar = nodes.findIndex((n) => n.part === 'plot' && n.kind === 'rect');
  keyed(ensure(plot, 'div', 'vg-ranges'), nodes.filter((n): n is LineNode => n.part === 'plot' && n.kind === 'line' && n.row != null), () => 'i', (el, n) => {
    prop(el, '--vg-x', n.x); prop(el, '--vg-x2', n.x2); prop(el, '--vg-t', n.t); prop(el, '--vg-t2', n.t2 ?? n.t); prop(el, '--vg-stroke', n.width && n.width + 'px');
    el.toggleAttribute('data-upright', n.x === n.x2); el.toggleAttribute('data-under', nodes.indexOf(n) < bar);
  });
}
