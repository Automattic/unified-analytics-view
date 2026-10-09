import { arcD, type ArcNode } from '@universal-analytics/core';
import { ensure, keyed, paintVar, prop, text } from '../dom.ts';
import type { LayoutPainter } from '../layout.ts';
import { token } from '../tokens.ts';
import { paintLegend } from './band.ts';

/* Arcs about one centre, and under them the legend a band has. The part holds its shape: it is as wide as the view up
 * to 160 px and its height follows from the scene's aspect, 1 for a circle and 2 for the top half of one. Its SVG has
 * a view box of that shape and the default preserveAspectRatio, so where a box leaves the part some other shape the
 * arcs sit in the middle of it and are not stretched. Paths are core's, drawn about the origin at a radius of 50.
 * The part is the `plot` container, which is what the `hole` rule asks about: the number sits over the hole of a
 * donut, and at the foot of a half circle. Sizes are the pixel painter's. */
const css = `
.uav[data-layout="radial"] .uav-body { display: flex; flex-direction: column; }
.uav-radial { position: relative; flex: none; align-self: center; inline-size: min(100%, 160px); aspect-ratio: var(--uav-aspect, 1); container: uav-plot / inline-size; }
.uav-radial svg { display: block; inline-size: 100%; block-size: 100%; overflow: visible; }
/* A segment is parted from the next by a line of one width from the rim to the middle: its own edge, drawn in the
 * colour of what the view is on. Two edges lie one on the other, so the line is as wide as either. It is two rules
 * wide: a hairline at a slant is smoothed to a different weight at every angle, and reads as uneven. The corners
 * are round, because a mitred one at the middle is a spike into the segment across from it. */
.uav-radial path { fill: var(--uav-paint); stroke: ${token('color-background')}; stroke-width: calc(${token('stroke-width-rule')} * 2); vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.uav-hole { position: absolute; inset: 0; display: none; place-items: center; overflow: hidden; pointer-events: none; color: var(--uav-paint); }
/* The small face of the number, and smaller with the circle: there is no measuring the hole from a stylesheet. */
.uav-hole.uav-f-display { font-size: clamp(14px, 18cqi, var(--uav-font-display-small)); line-height: 0.92; }
.uav-radial[data-half] .uav-hole { place-items: end center; }
.uav[data-layout="radial"][data-parts~="hole"] .uav-hole { display: grid; }
/* The plan names one legend, as it does for a band, or neither. */
.uav[data-layout="radial"]:not([data-parts~="legend"]) .uav-legend { display: none; }
.uav[data-layout="radial"][data-parts~="legend-top"] .uav-legend-top { display: block; }
/* In a box the part gives way to the height, down to nothing, and its width follows; it is no taller than the body's
 * width allows its shape, which cqi is here, the part being a container itself. The legends swap as a band's do:
 * the full one needs the least circle of 64 px, 10 px and a line and its 4 px gap for each row, less the last gap. Under the one-line legend's
 * need the \`legend-top\` rule takes both away. */
@container uav-view (block-size >= 0px) {
  .uav[data-layout="radial"] .uav-body { container-type: size; overflow: hidden; --uav-legend-block: calc(70px + var(--uav-rows, 1) * (var(--uav-legend-line) + 4px)); }
  .uav[data-layout="radial"] .uav-radial { flex: 0 1 calc(160px / var(--uav-aspect, 1)); min-block-size: 0; max-block-size: calc(100cqi / var(--uav-aspect, 1)); inline-size: auto; max-inline-size: 100%; }
  .uav[data-layout="radial"] :is(.uav-legend, .uav-legend-top) { flex: none; }
  .uav[data-layout="radial"]:not([data-keep~="guides"]) .uav-legend { overflow: hidden; max-block-size: max(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999);
    margin-block-start: clamp(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999, 10px); }
  .uav[data-layout="radial"][data-parts~="legend"]:not([data-keep~="guides"]) .uav-legend-top { display: block; overflow: hidden; max-block-size: max(0px, (var(--uav-legend-block) - 100cqb) * 999999); }
}`;

type Arc = Pick<ArcNode, 'a0' | 'a1' | 'r0' | 'r1'>;
interface Turn { now: Arc; from: Arc; to: ArcNode; frame: number }
const turns = new WeakMap<Element, Turn>();
let tick = 0;

/* Set an arc's shape. A new one, or one in a view that is not moving, takes it at once. A kept one goes there from
 * wherever it is now, on the clock motion.ts gives a line: a new value of --uav-p, whose transition is read each frame.
 * ponytail: morph() in motion.ts has the same clock for points. One clock for both if a third shape needs it. */
function turn(el: SVGElement, to: ArcNode): void {
  const m = turns.get(el);
  if (!m || !el.closest('.uav[data-moving]')) {
    if (m) cancelAnimationFrame(m.frame);
    el.setAttribute('d', to.d);
    turns.set(el, { now: to, from: to, to, frame: 0 });
    return;
  }
  m.from = m.now; m.to = to;
  el.style.setProperty('--uav-p', String(++tick));
  m.frame ||= requestAnimationFrame(() => step(el, m));
}
function step(el: SVGElement, m: Turn): void {
  const clock = el.getAnimations().find((t) => t instanceof CSSTransition && t.transitionProperty === '--uav-p');
  const p = clock?.effect?.getComputedTiming().progress ?? 1, at = (f: keyof Arc) => m.from[f] + (m.to[f] - m.from[f]) * p;
  m.now = { a0: at('a0'), a1: at('a1'), r0: at('r0'), r1: at('r1') };
  el.setAttribute('d', p < 1 ? arcD(m.now) : m.to.d);
  m.frame = p < 1 ? requestAnimationFrame(() => step(el, m)) : 0;
}

export const radial: LayoutPainter = {
  layout: 'radial',
  css,
  fit: {
    // As the band's: the rule's data only sets a switch, and this is the swap.
    legend: { '.uav-legend': 'display: none;', '.uav-legend-top': 'display: block; max-block-size: none;' },
    // The number alone. The body goes whole, and so does its grid row.
    marks: { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.uav-body': 'display: none;', '.uav-number': 'align-self: start; margin: 0;' },
  },

  paint(body, scene) {
    const part = ensure(body, 'div', 'uav-radial'), aspect = scene.aspect ?? 1, rows = scene.rows ?? [];
    let svg = part.querySelector<SVGSVGElement>(':scope > svg');
    if (!svg) svg = part.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    svg.setAttribute('viewBox', '-50 -50 100 ' + 100 / aspect);
    // Each segment is its own hit target. Arcs that read one value against a range have no row to step to.
    if (rows.length) { svg.setAttribute('data-hits', 'x'); svg.removeAttribute('aria-hidden'); } else { svg.removeAttribute('data-hits'); svg.setAttribute('aria-hidden', 'true'); }
    part.toggleAttribute('data-half', aspect !== 1);
    prop(part, '--uav-aspect', aspect); prop(body, '--uav-rows', rows.length);
    keyed(svg, scene.nodes.filter((n): n is ArcNode => n.kind === 'arc'), () => 'path', (el, n) => turn(el as SVGElement, n));
    const hole = ensure(part, 'b', 'uav-hole'), number = scene.nodes.find((n) => n.part === 'hole');
    if (number?.kind === 'text') { text(hole, number); prop(hole, '--uav-paint', paintVar(number.paint)); } else hole.textContent = '';
    paintLegend(body, scene);
  },
};
