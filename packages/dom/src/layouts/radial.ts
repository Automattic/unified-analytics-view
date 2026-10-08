import { arcD, type ArcNode } from '@universal-analytics/core';
import { ensure, keyed, paintVar, prop, text } from '../dom.ts';
import type { LayoutPainter } from '../layout.ts';
import { paintLegend } from './band.ts';

/* Arcs about one centre, and under them the legend a band has. The part holds its shape: it is as wide as the view up
 * to 160 px and its height follows from the scene's aspect, 1 for a circle and 2 for the top half of one. Its SVG has
 * a view box of that shape and the default preserveAspectRatio, so where a box leaves the part some other shape the
 * arcs sit in the middle of it and are not stretched. Paths are core's, drawn about the origin at a radius of 50.
 * The part is the `plot` container, which is what the `hole` rule asks about: the number sits over the hole of a
 * donut, and at the foot of a half circle. Sizes are the pixel painter's. */
const css = `
.vg[data-layout="radial"] .vg-body { display: flex; flex-direction: column; }
.vg-radial { position: relative; flex: none; align-self: center; inline-size: min(100%, 160px); aspect-ratio: var(--vg-aspect, 1); container: plot / inline-size; }
.vg-radial svg { display: block; inline-size: 100%; block-size: 100%; overflow: visible; }
.vg-radial path { fill: var(--vg-paint); }
.vg-radial path[data-active] { stroke: ${paintVar('ink')}; stroke-width: 2px; vector-effect: non-scaling-stroke; }
.vg-hole { position: absolute; inset: 0; display: none; place-items: center; overflow: hidden; pointer-events: none; color: var(--vg-paint); }
/* The small face of the number, and smaller with the circle: there is no measuring the hole from a stylesheet. */
.vg-hole.vg-f-display { font-size: clamp(14px, 18cqi, 26px); line-height: 0.92; }
.vg-radial[data-half] .vg-hole { place-items: end center; }
.vg[data-layout="radial"][data-parts~="hole"] .vg-hole { display: grid; }
/* The plan names one legend, as it does for a band, or neither. */
.vg[data-layout="radial"]:not([data-parts~="legend"]) .vg-legend { display: none; }
.vg[data-layout="radial"][data-parts~="legend-top"] .vg-legend-top { display: block; }
/* In a box the part gives way to the height, down to nothing, and its width follows; it is no taller than the body's
 * width allows its shape, which cqi is here, the part being a container itself. The legends swap as a band's do:
 * the full one needs the least circle of 64 px, 10 px and 24 px a row less the last gap. Under the one-line legend's
 * need the \`legend-top\` rule takes both away. */
@container view (block-size >= 0px) {
  .vg[data-layout="radial"] .vg-body { container-type: size; overflow: hidden; --vg-legend-block: calc(70px + var(--vg-rows, 1) * 24px); }
  .vg[data-layout="radial"] .vg-radial { flex: 0 1 calc(160px / var(--vg-aspect, 1)); min-block-size: 0; max-block-size: calc(100cqi / var(--vg-aspect, 1)); inline-size: auto; max-inline-size: 100%; }
  .vg[data-layout="radial"] :is(.vg-legend, .vg-legend-top) { flex: none; }
  .vg[data-layout="radial"]:not([data-keep~="guides"]) .vg-legend { overflow: hidden; max-block-size: max(0px, (100cqb - var(--vg-legend-block) + 0.01px) * 999999);
    margin-block-start: clamp(0px, (100cqb - var(--vg-legend-block) + 0.01px) * 999999, 10px); }
  .vg[data-layout="radial"][data-parts~="legend"]:not([data-keep~="guides"]) .vg-legend-top { display: block; overflow: hidden; max-block-size: max(0px, (var(--vg-legend-block) - 100cqb) * 999999); }
}`;

type Arc = Pick<ArcNode, 'a0' | 'a1' | 'r0' | 'r1'>;
interface Turn { now: Arc; from: Arc; to: ArcNode; frame: number }
const turns = new WeakMap<Element, Turn>();
let tick = 0;

/* Set an arc's shape. A new one, or one in a view that is not moving, takes it at once. A kept one goes there from
 * wherever it is now, on the clock motion.ts gives a line: a new value of --vg-p, whose transition is read each frame.
 * ponytail: morph() in motion.ts has the same clock for points. One clock for both if a third shape needs it. */
function turn(el: SVGElement, to: ArcNode): void {
  const m = turns.get(el);
  if (!m || !el.closest('.vg[data-moving]')) {
    if (m) cancelAnimationFrame(m.frame);
    el.setAttribute('d', to.d);
    turns.set(el, { now: to, from: to, to, frame: 0 });
    return;
  }
  m.from = m.now; m.to = to;
  el.style.setProperty('--vg-p', String(++tick));
  m.frame ||= requestAnimationFrame(() => step(el, m));
}
function step(el: SVGElement, m: Turn): void {
  const clock = el.getAnimations().find((t) => t instanceof CSSTransition && t.transitionProperty === '--vg-p');
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
    legend: { '.vg-legend': 'display: none;', '.vg-legend-top': 'display: block; max-block-size: none;' },
    // The number alone. The body goes whole, and so does its grid row.
    marks: { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.vg-body': 'display: none;', '.vg-number': 'margin: 0;' },
  },

  paint(body, scene) {
    const part = ensure(body, 'div', 'vg-radial'), aspect = scene.aspect ?? 1, rows = scene.rows ?? [];
    let svg = part.querySelector<SVGSVGElement>(':scope > svg');
    if (!svg) svg = part.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    svg.setAttribute('viewBox', '-50 -50 100 ' + 100 / aspect);
    // Each segment is its own hit target. Arcs that read one value against a range have no row to step to.
    if (rows.length) { svg.setAttribute('data-hits', 'x'); svg.removeAttribute('aria-hidden'); } else { svg.removeAttribute('data-hits'); svg.setAttribute('aria-hidden', 'true'); }
    part.toggleAttribute('data-half', aspect !== 1);
    prop(part, '--vg-aspect', aspect); prop(body, '--vg-rows', rows.length);
    keyed(svg, scene.nodes.filter((n): n is ArcNode => n.kind === 'arc'), () => 'path', (el, n) => turn(el as SVGElement, n));
    const hole = ensure(part, 'b', 'vg-hole'), number = scene.nodes.find((n) => n.part === 'hole');
    if (number?.kind === 'text') { text(hole, number); prop(hole, '--vg-paint', paintVar(number.paint)); } else hole.textContent = '';
    paintLegend(body, scene);
  },
};
