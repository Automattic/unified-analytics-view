import { DRAWN, FROM_TOP } from '../layout.ts';
import type { Scene, TextNode } from '@unified-analytics/core';
import { attr, ensure, keyed, prop, text } from '../dom.ts';
import { thin, thinLabels } from '../measure.ts';
import { ANCHOR, label } from './label.ts';

/* The axes about a plot: the labels down its near side, along its foot, and down its far side for a second unit. A
 * plot and a grid of cells have the same ones, from the same nodes (core's axisTick).
 *
 * An axis is a grid of one cell that every label shares, each moved by a percentage inset, so a column is still sized
 * by its widest label and a row by its tallest. The x axis is 22 px tall where a tick is 11 px, and follows the tick's
 * face from there (--uav-x-axis-block, view.ts). pixels.ts sets each label on a whole px, after this sheet.
 * A label's words run their own way, in a box placed from the left: the frame an axis stands in does not turn with
 * the page (cartesian.ts), which is the layout's to say, as is where each axis sits in its body. */
/** The x axis: the space above its labels, and its height at the tick face's own size (core's gutter under a plot),
 * in px. The view works its height out from the face (X_AXIS_FACE). */
export const X_AXIS_PAD = 5;
export const X_AXIS_BLOCK = 22;
/** The x axis's height at the face the view has: the pad, and the line the labels take, scaled from the token's own size. */
export const X_AXIS_FACE = `calc(${X_AXIS_PAD}px + var(--uav-font-tick) * ${X_AXIS_BLOCK - X_AXIS_PAD} / ${DRAWN.tick})`;
export const AXES_CSS = `
.uav-y-axis, .uav-y-axis-2, .uav-x-axis { display: grid; white-space: nowrap; font-variant-numeric: tabular-nums; }
:is(.uav-y-axis, .uav-y-axis-2) span { grid-area: 1 / 1; align-self: start; justify-self: end; position: relative; inset-block-start: ${FROM_TOP}; translate: 0 -50%; padding-inline-end: 6px; ${label({ tone: 'axis' })} }
.uav-y-axis-2 span { justify-self: start; padding-inline: 6px 0; }
.uav-x-axis { box-sizing: border-box; block-size: var(--uav-x-axis-block); padding-block-start: ${X_AXIS_PAD}px; }
.uav-x-axis span { grid-area: 1 / 1; justify-self: start; position: relative; inset-inline-start: calc(var(--uav-x) * 100%); translate: ${ANCHOR.middle}; ${label({ tone: 'axis' })} }
.uav-x-axis [data-anchor="start"] { translate: ${ANCHOR.start}; }
.uav-x-axis [data-anchor="end"] { translate: ${ANCHOR.end}; }
:is(.uav-x-axis, .uav-y-axis, .uav-y-axis-2) > span { unicode-bidi: plaintext; }`;

/** The axes, and between them the plot they stand about, which is made here only so that it keeps that place among
 * the body's children and is handed back for the layout to fill. `far` makes the second y axis as well, for a layout
 * that has a column for it. The labels say again what each mark's name says whole, so they are hidden from assistive
 * technology. */
export function paintAxes(body: HTMLElement, scene: Scene, far = false): HTMLElement {
  const yAxis = ensure(body, 'div', 'uav-y-axis'), plot = ensure(body, 'div', 'uav-plot'), xAxis = ensure(body, 'div', 'uav-x-axis');
  const texts = (part: string) => scene.nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text');
  const tick = (el: HTMLElement | SVGElement, n: TextNode) => { text(el, n); prop(el, '--uav-t', n.t); };
  for (const el of [yAxis, xAxis]) el.setAttribute('aria-hidden', 'true');
  keyed(yAxis, texts('y-axis'), () => 'span', tick);
  if (far) { const yAxis2 = ensure(body, 'div', 'uav-y-axis-2'); yAxis2.setAttribute('aria-hidden', 'true'); keyed(yAxis2, texts('y-axis-2'), () => 'span', tick); }
  // A label under a column of a width of its own (a row's, on a linear x) is ranked by that width, for the measured pass
  // alone: the rule that gives up a middle date is not its, so it carries its rank under another name.
  keyed(xAxis, texts('x-axis'), () => 'span', (el, n) => {
    text(el, n); prop(el, '--uav-x', n.x); el.setAttribute('data-anchor', n.anchor);
    const own = scene.scale === 'linear' && n.row != null;
    attr(el, 'data-order', own ? n.rank ?? 0 : null); if (own) el.removeAttribute('data-rank');
  });
  return plot;
}

/** An axis's share of the measured pass: labels that would meet, by their real sizes, are given up, the ranked first,
 * in thin()'s order, no two standing closer than `gap`. One a fit rule has hidden has no box and is passed over, and
 * so is one that is leaving. Each is placed from its ratio, not read where it stands: a label may be on its way.
 * `inside` gives up a label that would run past the axis's far edge before the rest are thinned, for a layout whose
 * labels are not anchored to stay in: whatever holds the view may clip there. */
export function thinAxis(body: HTMLElement, axis: 'x' | 'y', { gap = 6, inside = false } = {}): void {
  const box = body.querySelector<HTMLElement>(axis === 'x' ? '.uav-x-axis' : '.uav-y-axis');
  if (!box) return;
  const at = axis === 'x' ? '--uav-x' : '--uav-t', size = axis === 'x' ? 'width' : 'height';
  thinLabels(box, ':scope > span:not([data-exit])', (all) => {
    const room = box.getBoundingClientRect()[size];
    const spans = all.map((el) => {
      // A label stands about its ratio, or from it or up to it where it is anchored at an end.
      const s = el.getBoundingClientRect()[size], lo = Number(el.style.getPropertyValue(at)) * room - s * ({ start: 0, end: 1 }[el.dataset.anchor ?? ''] ?? 0.5);
      return { lo, hi: lo + s, rank: Number(el.dataset.rank ?? el.dataset.order) || 0 };
    });
    const fits = spans.map((s) => !inside || s.hi <= room + 1), gone = thin(spans.filter((_, i) => fits[i]), gap);
    return all.map((_, i) => !fits[i] || !!gone[fits.slice(0, i).filter(Boolean).length]);
  });
}
