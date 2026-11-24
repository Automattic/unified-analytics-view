import { FROM_TOP } from './layout.ts';
import { ANCHOR } from './chrome/label.ts';
/* Guides on whole px. A view's small type is a pixel face where a page gives it one, and a face like that is sharp
 * only where it sits on the screen's own px, as a hairline is. So a grid line, the axis and a rule sit on a whole px
 * and a grid line is 1 px, and a tick's label is moved by whole px. The marks are vector, and are left as they are.
 *
 * That is the stylesheet's. What it cannot do is put the plot itself on a whole px: whatever is above and beside a
 * view leaves its plot at a fraction of one, and then nothing in it is sharp however whole its own places are. The
 * element reads where the plot is, after each paint, when its room changes and when anything it stands in changes
 * size, which is how a view learns that what is above it has moved it, and moves it by what is left over.
 * ponytail: a view moved with no change of size in anything it stands in is not told, and keeps the move it had: a
 * sibling that grows straight inside a box of fixed height, or a scroll that stops on a fraction of a px. An
 * IntersectionObserver framed on the view would say, if that is ever seen. */
const whole = (length: string) => `round(${length}, 1px)`;

/** It joins the base sheet inside `@layer uav`. `--uav-nx` and `--uav-ny` are what the plot is moved by, set on the figure. */
export const PIXELS_CSS = `
.uav-line { inset-block-start: ${whole(FROM_TOP)}; }
.uav-grid .uav-line { block-size: 1px; }
:is(.uav-y-axis, .uav-y-axis-2) span { inset-block-start: ${whole(FROM_TOP)}; translate: 0 ${whole(ANCHOR.middle)}; }
.uav-x-axis span { inset-inline-start: ${whole('calc(var(--uav-x) * 100%)')}; translate: ${whole(ANCHOR.middle)}; }
.uav-x-axis [data-anchor="start"] { translate: ${ANCHOR.start}; }
.uav-x-axis [data-anchor="end"] { translate: ${ANCHOR.end}; }
:is(.uav-plot, .uav-y-axis, .uav-y-axis-2, .uav-x-axis, .uav-labels) { translate: var(--uav-nx, 0px) var(--uav-ny, 0px); }`;

/** Set a view's plot on whole device px of the screen: the plot and its axes are moved together, which changes no
 * size. Where the plot would be unmoved is where it is, less the move. */
export function pixels(fig: HTMLElement): void {
  const plot = fig.querySelector('.uav-plot'), was = ['--uav-nx', '--uav-ny'].map((name) => parseFloat(fig.style.getPropertyValue(name)) || 0);
  if (!plot) { fig.style.removeProperty('--uav-nx'); fig.style.removeProperty('--uav-ny'); return; }
  const box = plot.getBoundingClientRect(), dpr = fig.ownerDocument.defaultView?.devicePixelRatio || 1;
  [box.left - was[0]!, box.top - was[1]!].forEach((at, i) => {
    // To the nearest device px, and one that lies half way between two goes to the one before it, nearer the top and
    // the start. Half way is a place a box often
    // stands at, a quarter of a px on a screen of two to one, and what is read back of a box that was moved is a hair
    // off, so plain rounding sent the same plot up on one load and down on the next. The line is drawn just past the
    // half, where no box stands: a box is on sixty-fourths of a px.
    const move = Math.floor(at * dpr + 0.49) / dpr - at;
    if (Math.abs(move - was[i]!) > 0.005) fig.style.setProperty(i ? '--uav-ny' : '--uav-nx', move.toFixed(3) + 'px');
  });
}
