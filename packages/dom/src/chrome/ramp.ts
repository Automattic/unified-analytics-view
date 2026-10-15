import type { Scene } from '@unified-analytics/core';
import { ensure, keyed, pageWay, text } from '../dom.ts';
import { swatch } from './swatch.ts';

/* The colour ramp: the key to a metric on colour, wherever a view has one. Under a grid of cells, a map and a treemap
 * it is the same line: the least value, a swatch for each step, the most, and a swatch for no value where there is one.
 * A layout says only where it stands (matrix.ts gives it a grid area) and what it does in a box. */
export const RAMP_CSS = `
.uav-ramp { display: flex; align-items: center; gap: 1px; block-size: 24px; overflow: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }
.uav-ramp span { color: var(--uav-paint); margin-inline: 5px; }
.uav-ramp span:first-child { margin-inline-start: 0; }
.uav-ramp [data-key="ramp:none"] { margin-inline-start: 5px; }
/* Zero is said beside its own swatch, the neutral one, which stands a little clear of the arm before it. */
.uav-ramp i:has(+ [data-key="ramp:zero"]) { margin-inline-start: 4px; }`;

/** The ramp, after whatever the body holds already. It says again what each mark's name says whole, so it is hidden
 * from assistive technology, and it is a legend, so it reads the way the page does. */
export function paintRamp(body: HTMLElement, scene: Scene): void {
  const ramp = ensure(body, 'div', 'uav-ramp');
  ramp.setAttribute('aria-hidden', 'true'); pageWay(ramp, body);
  keyed(ramp, scene.nodes.filter((n) => n.part === 'ramp'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); else swatch(el, 'cell'); });
}
