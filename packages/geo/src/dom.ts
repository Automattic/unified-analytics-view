import type { CircleNode, PathNode } from '@universal-analytics/core';
import { attr, ensure, keyed, paintVar, prop, text, type LayoutPainter } from '@universal-analytics/dom';
import { GEO_RULES } from './index.ts';

/* The `geo` mark's half for the DOM: the painter of its layout, for registerPainter().
 *
 * The part holds its shape: it is as wide as the view up to 480 px and its height follows from the scene's aspect. Its
 * SVG has a view box of that shape, so the regions are never stretched, and the symbols are HTML over it, placed by
 * ratios of the same box and sized in pixels, as a plot's dots are. Under it, the ramp a grid has and the key to
 * sizes a plot has, in their own styles.
 *
 *   .vg-plot
 *     svg
 *       g.vg-land           regions the result has no row for, and every region where symbols stand on them
 *       g.vg-regions        regions with a row: the list a reader steps through
 *     .vg-points            a symbol for each region with a row, and then these are the list
 *   .vg-ramp, .vg-size
 *
 * Never colour alone: each region in the list is named by its readout, which says its value (keys.ts), and the table
 * is the query's own. The list runs in the result's order, and every arrow steps along it: there is no moving about
 * the map by direction.
 * Below the room a map needs, the `marks` rule's `fallback` shows the same query as a ranked list in its place. That
 * is the element's doing (view.ts), and nothing here knows of it. */
const SVG = 'http://www.w3.org/2000/svg';
const css = `
.vg[data-layout="geo"] .vg-body { display: flex; flex-direction: column; }
.vg[data-layout="geo"] .vg-plot { flex: none; align-self: center; inline-size: min(100%, 480px); aspect-ratio: var(--vg-aspect, 2); container-type: inline-size; }
.vg[data-layout="geo"] .vg-plot path { fill: var(--vg-paint); stroke: var(--a8c-charts-color-background, Canvas); stroke-width: 0.5px; }
.vg[data-layout="geo"] .vg-plot path[data-active] { stroke: ${paintVar('ink')}; stroke-width: 1.5px; }
.vg[data-layout="geo"] .vg-regions:focus-visible { outline: none; }
.vg[data-layout="geo"] .vg-plot:has(.vg-regions:focus-visible) { outline: auto; outline-offset: -2px; }
/* The symbols' holder lies over the regions, and only a symbol takes the pointer from them. */
.vg[data-layout="geo"] .vg-points { pointer-events: none; }
.vg[data-layout="geo"] .vg-points i { pointer-events: auto; }
.vg[data-layout="geo"] .vg-ramp:empty { display: none; }
/* In a box the part gives way to the height and its width follows, as a circle of arcs does. */
@container view (block-size >= 0px) {
  .vg[data-layout="geo"] .vg-body { container-type: size; overflow: hidden; }
  .vg[data-layout="geo"] .vg-plot { flex: 0 1 calc(min(100cqi, 480px) / var(--vg-aspect, 2)); min-block-size: 0; inline-size: auto; max-inline-size: 100%; }
  .vg[data-layout="geo"] :is(.vg-ramp, .vg-size) { flex: none; }
}`;

/** The group of the map's SVG with this class, made on first use. */
function group(svg: Element, cls: string): SVGElement {
  let g = svg.querySelector<SVGElement>(':scope > .' + cls);
  if (!g) { g = svg.appendChild(document.createElementNS(SVG, 'g')); g.setAttribute('class', cls); }
  return g;
}
/** Make an element the list a reader steps through, or take that from it. What the keyboard set on it goes with it. */
function list(el: Element, on: boolean): void {
  attr(el, 'data-hits', on ? 'y' : null);
  if (!on) for (const name of ['role', 'tabindex', 'aria-label', 'aria-orientation', 'aria-activedescendant']) el.removeAttribute(name);
}

export const geoPainter: LayoutPainter = {
  layout: 'geo',
  css,
  rules: () => GEO_RULES,

  paint(body, scene) {
    const part = ensure(body, 'div', 'vg-plot'), aspect = scene.aspect ?? 2;
    let svg = part.querySelector<SVGSVGElement>(':scope > svg');
    if (!svg) svg = part.appendChild(document.createElementNS(SVG, 'svg'));
    svg.setAttribute('viewBox', '0 0 100 ' + 100 / aspect);
    prop(part, '--vg-aspect', aspect);
    const shapes = scene.nodes.filter((n): n is PathNode => n.part === 'plot' && n.kind === 'path');
    const symbols = scene.nodes.filter((n): n is CircleNode => n.part === 'points' && n.kind === 'circle');
    // A region is in the list when the result has a row for it, unless a symbol stands on it and is.
    const listed = (n: PathNode) => n.row != null && !symbols.length;
    const land = group(svg, 'vg-land'), regions = group(svg, 'vg-regions'), points = ensure(part, 'div', 'vg-points');
    land.setAttribute('aria-hidden', 'true');
    const shape = (el: HTMLElement | SVGElement, n: PathNode) => el.setAttribute('d', n.d ?? '');
    keyed(land, shapes.filter((n) => !listed(n)), () => 'path', shape);
    keyed(regions, shapes.filter(listed), () => 'path', shape);
    keyed(points, symbols, () => 'i', (el, n) => { prop(el, '--vg-x', n.x); prop(el, '--vg-t', n.t); prop(el, '--vg-size', n.size); });
    list(regions, shapes.some(listed)); list(points, symbols.length > 0);

    const ramp = ensure(body, 'div', 'vg-ramp'), sizes = ensure(body, 'div', 'vg-size');
    // The keys say again what each region's name says whole.
    for (const el of [ramp, sizes]) el.setAttribute('aria-hidden', 'true');
    keyed(ramp, scene.nodes.filter((n) => n.part === 'ramp'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); });
    keyed(sizes, scene.nodes.filter((n) => n.part === 'size'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); else if (n.kind === 'circle') prop(el, '--vg-size', n.size); });
  },
};
