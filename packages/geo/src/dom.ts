import type { CircleNode, PathNode, TextNode } from '@universal-analytics/core';
import { FOCUS, HOVER, attr, ensure, keyed, prop, text, token, type LayoutPainter } from '@universal-analytics/dom';
import { GEO_RULES } from './index.ts';

/* The `geo` mark's half for the DOM: the painter of its layout, for registerPainter().
 *
 * The part holds its shape: it is as wide as the view up to 480 px and its height follows from the scene's aspect. Its
 * SVG has a view box of that shape, so the regions are never stretched, and the symbols are HTML over it, placed by
 * ratios of the same box and sized in pixels, as a plot's dots are. Under it, the ramp a grid has and the key to
 * sizes a plot has, in their own styles.
 *
 *   .uav-plot
 *     svg
 *       g.uav-land           regions the result has no row for, and every region where symbols stand on them
 *       g.uav-regions        regions with a row: the list a reader steps through
 *     .uav-points            a symbol for each region with a row, and then these are the list
 *   .uav-note                how many rows have no shape, where there are any
 *   .uav-ramp, .uav-size
 *
 * Never colour alone: each region in the list is named by its readout, which says its value (keys.ts), and the table
 * is the query's own. The list runs in the result's order, and every arrow steps along it: there is no moving about
 * the map by direction.
 * Below the room a map needs, the `marks` rule's `fallback` shows the same query as a ranked list in its place. That
 * is the element's doing (view.ts), and nothing here knows of it. */
const SVG = 'http://www.w3.org/2000/svg';
const css = `
.uav[data-layout="geo"] .uav-body { display: flex; flex-direction: column; }
.uav[data-layout="geo"] .uav-plot { flex: none; align-self: center; inline-size: min(100%, 480px); aspect-ratio: var(--uav-aspect, 2); container-type: inline-size; }
.uav[data-layout="geo"] .uav-plot path { fill: var(--uav-paint); stroke: ${token('color-background')}; stroke-width: 0.5px; }
/* A region is a shape, so the outline of the chosen one is its edge, the keyboard's or the pointer's. The list of regions is a group of the SVG, which
 * has no box of its own to outline, so the part wears the holder's for it. */
.uav[data-layout="geo"] .uav-plot path[data-active="keys"] { ${FOCUS.stroke} }
.uav[data-layout="geo"] .uav-plot path[data-active="pointer"] { ${HOVER.stroke} }
.uav[data-layout="geo"] .uav-regions:focus-visible { outline: none; }
.uav[data-layout="geo"] .uav-plot:has(.uav-regions:focus-visible) { ${FOCUS.inside} }
/* The symbols' holder lies over the regions, and only a symbol takes the pointer from them. */
.uav[data-layout="geo"] .uav-points { pointer-events: none; }
.uav[data-layout="geo"] .uav-points i { pointer-events: auto; }
.uav[data-layout="geo"] .uav-ramp:empty { display: none; }
.uav[data-layout="geo"] .uav-note { block-size: calc(var(--uav-font-tick) * 18 / 11); line-height: calc(18 / 11); overflow: hidden; white-space: nowrap; }
.uav[data-layout="geo"] .uav-note span { color: var(--uav-paint); }
.uav[data-layout="geo"] .uav-note:empty { display: none; }
/* In a box the part gives way to the height and its width follows, as a circle of arcs does. */
@container uav-view (block-size >= 0px) {
  .uav[data-layout="geo"] .uav-body { container-type: size; overflow: hidden; }
  .uav[data-layout="geo"] .uav-plot { flex: 0 1 calc(min(100cqi, 480px) / var(--uav-aspect, 2)); min-block-size: 0; inline-size: auto; max-inline-size: 100%; }
  .uav[data-layout="geo"] :is(.uav-note, .uav-ramp, .uav-size) { flex: none; }
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
    const part = ensure(body, 'div', 'uav-plot'), aspect = scene.aspect ?? 2;
    let svg = part.querySelector<SVGSVGElement>(':scope > svg');
    if (!svg) svg = part.appendChild(document.createElementNS(SVG, 'svg'));
    svg.setAttribute('viewBox', '0 0 100 ' + 100 / aspect);
    prop(part, '--uav-aspect', aspect);
    const shapes = scene.nodes.filter((n): n is PathNode => n.part === 'plot' && n.kind === 'path');
    const symbols = scene.nodes.filter((n): n is CircleNode => n.part === 'points' && n.kind === 'circle');
    // A region is in the list when the result has a row for it, unless a symbol stands on it and is.
    const listed = (n: PathNode) => n.row != null && !symbols.length;
    const land = group(svg, 'uav-land'), regions = group(svg, 'uav-regions'), points = ensure(part, 'div', 'uav-points');
    land.setAttribute('aria-hidden', 'true');
    const shape = (el: HTMLElement | SVGElement, n: PathNode) => el.setAttribute('d', n.d ?? '');
    keyed(land, shapes.filter((n) => !listed(n)), () => 'path', shape);
    keyed(regions, shapes.filter(listed), () => 'path', shape);
    keyed(points, symbols, () => 'i', (el, n) => { prop(el, '--uav-x', n.x); prop(el, '--uav-t', n.t); prop(el, '--uav-size', n.size); });
    list(regions, shapes.some(listed)); list(points, symbols.length > 0);

    // The note is read: it says what the map does not. It is made whether or not there is one, so it stays above the keys.
    keyed(ensure(body, 'div', 'uav-note'), scene.nodes.filter((n): n is TextNode => n.part === 'note' && n.kind === 'text'), () => 'span', text);
    const ramp = ensure(body, 'div', 'uav-ramp'), sizes = ensure(body, 'div', 'uav-size');
    // The keys say again what each region's name says whole.
    for (const el of [ramp, sizes]) el.setAttribute('aria-hidden', 'true');
    keyed(ramp, scene.nodes.filter((n) => n.part === 'ramp'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); });
    keyed(sizes, scene.nodes.filter((n) => n.part === 'size'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); else if (n.kind === 'circle') prop(el, '--uav-size', n.size); });
  },
};
