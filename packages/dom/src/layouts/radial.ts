import { CONTAINER_RULES, SEATS_LEAST, arcD, declutter, ruleFor, type ArcNode, type CircleNode, type TextNode } from '@unified-analytics/core';
import { LEGEND_FIT, LEGEND_SWAP, hideCutLegends, legendBlock, legendTop, paintLegend } from '../chrome/legend.ts';
import { attr, ensure, hits, keyed, svg, paintVar, prop, text } from '../dom.ts';
import { FROM_TOP, IN_BOX, NUMBER_ALONE, holdShape, type LayoutPainter } from '../layout.ts';
import { FOCUS, HOVER, token } from '../tokens.ts';
import { paintUnitKey, unitDot } from '../chrome/unit.ts';
import { label } from '../chrome/label.ts';
import { thinLabels } from '../measure.ts';

/* Arcs about one centre, and under them the legend a band has. The part holds its shape: it is as wide as the view up
 * to 160 px and its height follows from the scene's aspect, 1 for a circle and 2 for the top half of one. Its SVG has
 * a view box of that shape and the default preserveAspectRatio, so where a box leaves the part some other shape the
 * arcs sit in the middle of it and are not stretched. Paths are core's, drawn about the origin at a radius of 50.
 * The part is the `plot` container, which is what the `hole` rule asks about: the number sits over the hole of a
 * donut, and at the foot of a half circle. Sizes are the pixel painter's.
 *
 * A circle's points are one arc for each of its rows, in the SVG that carries `data-hits`. Arcs that are no point of
 * their own lie in a second SVG under it, \`.uav-under\`: the whole ring behind a ring's value, and the arcs of a second
 * ring. Each still says its row, so the pointer over it chooses that row, and one of a second ring says its own value
 * as its series, which the pointer and the up and down keys choose (keys.ts).
 *
 * Labels round the rim are HTML over the part, each set outside the point of the rim the scene gave it. The circle
 * gives up 14 px all round to them, a line's height, and those to either side run out of the part into the view's
 * width: the \`rim\` rule holds that wide enough, and gives the circle its margin back when it takes them away. */
/** The least circle of arcs, in px: the height core's `marks` rule for it needs. */
const ARCS_LEAST = ruleFor(CONTAINER_RULES.fit, 'radial', 'marks')!.needs.block!;
const shape = holdShape('var(--uav-radial-most, 160px)', 'var(--uav-aspect, 1)');
const css = `
.uav[data-layout="radial"] .uav-body { display: flex; flex-direction: column; }
.uav-radial { position: relative; box-sizing: border-box; padding: var(--uav-rim, 0px); ${shape.part} container: uav-plot / inline-size; }
/* A unit's seats are dots over the part's box, placed across and up it as a plot's are, from the left whichever way
 * the page reads. They are their own hit targets. A hundred of them are small, so the part is given 240 px. */
.uav-radial > .uav-dots { direction: ltr; }
.uav-radial > .uav-dots i { pointer-events: auto; }
/* The arcs run clockwise whichever way the page reads, and the keys step the way they run (keys.ts). */
.uav-radial svg { position: relative; display: block; inline-size: 100%; block-size: 100%; overflow: visible; direction: ltr; }
/* Two SVGs lie one on the other, so neither takes the pointer for its empty box: only an arc does. */
.uav-radial svg { pointer-events: none; }
.uav-radial svg path { pointer-events: auto; }
.uav-radial svg.uav-under { position: absolute; inset: var(--uav-rim, 0px); inline-size: auto; block-size: auto; }
/* An arc of a second ring that is chosen wears the outline, and its segment, chosen with it, gives its own up. */
.uav-radial .uav-under path[data-chosen][data-active="keys"] { ${FOCUS.stroke} }
.uav-radial .uav-under path[data-chosen][data-active="pointer"] { ${HOVER.stroke} }
.uav-radial:has(.uav-under [data-chosen]) svg[data-hits] path:is([data-active="keys"], [data-active="pointer"]) { stroke: ${token('color-background')}; stroke-width: calc(${token('stroke-width-rule')} * 2); }
/* Labels round the rim. Each is set from the point the scene gave it: to the right of one on the right, to the left of
 * one on the left, over one at the top and under one at the foot, and by degrees between. */
.uav[data-layout="radial"][data-parts~="rim"] .uav-radial { --uav-rim: 14px; }
.uav-rim { position: absolute; inset: calc(var(--uav-rim, 0px) - 3px); pointer-events: none; direction: ltr; }
.uav-rim span { position: absolute; left: calc(var(--uav-x) * 100%); top: ${FROM_TOP}; translate: calc((var(--uav-x) - 1) * 100%) calc(var(--uav-t) * -100%);
  line-height: 1; ${label()} }
.uav[data-layout="radial"]:not([data-parts~="rim"]) .uav-rim { display: none; }
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
${legendTop('radial')}
/* In a box the part gives way to the height, down to nothing, and its width follows; it is no taller than the body's
 * width allows its shape, which cqi is here, the part being a container itself. The legends swap as a band's do:
 * the full one needs the least circle of 64 px, 10 px and a line and its 4 px gap for each row, less the last gap. Under the one-line legend's
 * need the \`legend-top\` rule takes both away. */
${IN_BOX} {
  .uav[data-layout="radial"] .uav-body { container-type: size; overflow: hidden; --uav-legend-block: ${legendBlock(ARCS_LEAST)}; }
  .uav[data-layout="radial"] .uav-radial { ${shape.box} }
  .uav[data-layout="radial"] :is(.uav-legend, .uav-legend-top) { flex: none; }
  .uav[data-layout="radial"]:not([data-keep~="guides"]) .uav-legend { ${LEGEND_SWAP.full} }
  .uav[data-layout="radial"][data-parts~="legend"]:not([data-keep~="guides"]) .uav-legend-top { ${LEGEND_SWAP.top} }
  /* Seats keep 80 px of height under the full legend, the least place() builds them to, where arcs keep 64. */
  .uav[data-layout="radial"] .uav-body:has(.uav-dots > [data-unit]) { --uav-legend-block: ${legendBlock(SEATS_LEAST / 2)}; }
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
    legend: LEGEND_FIT,
    // The circle takes back the margin it gave the labels.
    rim: { '.uav-radial': '--uav-rim: 0px;' },
    // The number alone. The body goes whole, and so does its grid row.
    marks: NUMBER_ALONE,
  },

  paint(body, scene) {
    const part = ensure(body, 'div', 'uav-radial'), aspect = scene.aspect ?? 1, rows = scene.rows ?? [];
    const arcs = scene.nodes.filter((n): n is ArcNode => n.kind === 'arc'), box = '-50 -50 100 ' + 100 / aspect;
    // What lies under the points: an arc of a row that is not the row's own mark.
    const under = arcs.filter((n) => n.row != null && (n.series != null || n.role !== 'primary'));
    let own = part.querySelector<SVGSVGElement>(':scope > svg:not(.uav-under)');
    if (!own) own = part.appendChild(svg('svg'));
    own.setAttribute('viewBox', box);
    let below = part.querySelector<SVGSVGElement>(':scope > svg.uav-under');
    if (!below && under.length) { below = part.insertBefore(svg('svg'), own); below.setAttribute('class', 'uav-under'); below.setAttribute('aria-hidden', 'true'); }
    if (below) { below.setAttribute('viewBox', box); keyed(below, under, () => 'path', (el, n) => turn(el as SVGElement, n)); }
    const seats = scene.nodes.filter((n): n is CircleNode => n.part === 'radial' && n.kind === 'circle');
    // Each segment is its own hit target. Arcs that read one value against a range have no row to step to, and
    // where a unit's seats stand there are no arcs: the seats are the targets, a group of them to a row (keys.ts).
    hits(own, rows.length && !seats.length ? 'x' : null);
    part.toggleAttribute('data-half', aspect !== 1);
    prop(part, '--uav-aspect', aspect); prop(body, '--uav-rows', rows.length); prop(part, '--uav-radial-most', seats.length ? '240px' : null);
    keyed(own, arcs.filter((n) => !under.includes(n)), () => 'path', (el, n) => turn(el as SVGElement, n));
    const dots = ensure(part, 'div', 'uav-dots');
    attr(dots, 'data-hits', seats.length ? 'x' : null);
    keyed(dots, seats, () => 'i', (el, n) => { prop(el, '--uav-x', n.x); prop(el, '--uav-t', n.t); unitDot(el, n); });
    const hole = ensure(part, 'b', 'uav-hole'), number = scene.nodes.find((n) => n.part === 'hole');
    if (number?.kind === 'text') { text(hole, number); prop(hole, '--uav-paint', paintVar(number.paint)); } else hole.textContent = '';
    const rim = ensure(part, 'div', 'uav-rim');
    rim.setAttribute('aria-hidden', 'true');                                 // each slice is named by its readout, which says this and its value
    keyed(rim, scene.nodes.filter((n): n is TextNode => n.part === 'rim' && n.kind === 'text'), () => 'span', (el, n) => { text(el, n); prop(el, '--uav-x', n.x); prop(el, '--uav-t', n.t); });
    paintUnitKey(body, scene);
    paintLegend(body, scene);
  },

  // Labels round the rim that would meet: the one of higher rank is hidden, and keeps its box. Read where they stand:
  // a label moves only when the slices change, and the pass runs again when they have.
  measure(body) {
    thinLabels(body, '.uav-rim > span:not([data-exit])', (labels) => declutter(labels.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, rank: Number(el.dataset.rank) || 0 }; })));
    hideCutLegends(body);
  },
};
