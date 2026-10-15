import type { CircleNode, PathNode, TextNode } from '@unified-analytics/core';
import { DRAWN, FOCUS, HOVER, IN_BOX, attr, ensure, holdShape, keyed, lineOf, paintRamp, paintSize, prop, registerPainter, svg as svgOf, text, token, unlist, type LayoutPainter } from '@unified-analytics/dom';
import { MAP, NOTE, eachGeoName } from './index.ts';

/* The `geo` mark's half for the DOM: the painter of its layout, for registerPainter().
 *
 * The part holds its shape: it is as wide as the view up to 480 px and its height follows from the scene's aspect. Its
 * SVG has a view box of that shape, so the regions are never stretched, and the symbols are HTML over it, placed by
 * ratios of the same box and sized in pixels, as a plot's dots are. Under it, the ramp a grid has and the key to
 * sizes a plot has, in their own styles (the element's chrome).
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
const shape = holdShape(MAP + 'px', 'var(--uav-aspect, 2)');
const css = `
.uav[data-layout="geo"] .uav-body { display: flex; flex-direction: column; }
.uav[data-layout="geo"] .uav-plot { ${shape.part} container-type: inline-size; }
.uav[data-layout="geo"] .uav-plot path { fill: var(--uav-paint); stroke: ${token('color-background')}; stroke-width: ${token('stroke-width-rule')}; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
/* A region in the list is clicked to bring the map in to it, and clicked again, or the land about it, to take the map
 * back out. A border is one width at any size of map, in or out. What is outside the map's box is cut off, by the
 * part and not the SVG, so that it is cut the same when the marks are drawn in squares on a canvas beside it. */
.uav[data-layout="geo"] .uav-plot { overflow: hidden; }
/* The chosen region's edge is drawn again over every region, since its neighbours, drawn after it, lie on half of it. */
.uav[data-layout="geo"] .uav-plot .uav-over path { fill: none; pointer-events: none; }
.uav[data-layout="geo"] .uav-regions[data-hits] path { cursor: zoom-in; }
.uav[data-layout="geo"] svg[data-zoom] path { cursor: zoom-out; }
/* A region is a shape, so the outline of the chosen one is its edge, the keyboard's or the pointer's. The list of regions is a group of the SVG, which
 * has no box of its own to outline, so the part wears the holder's for it. */
.uav[data-layout="geo"] .uav-plot path[data-active="keys"] { ${FOCUS.stroke} }
.uav[data-layout="geo"] .uav-plot path[data-active="pointer"] { ${HOVER.stroke} }
/* Nothing inside the SVG wears an outline of its own, the browser's ring among them: an outline there is drawn in
 * the SVG's units, which the map's box stretches, and comes out many times its width. */
.uav[data-layout="geo"] .uav-plot svg, .uav[data-layout="geo"] .uav-plot svg * { outline: none; }
.uav[data-layout="geo"] .uav-plot:has(.uav-regions:focus-visible) { ${FOCUS.inside} }
/* The symbols' holder lies over the regions, and only a symbol takes the pointer from them. */
.uav[data-layout="geo"] .uav-points { pointer-events: none; }
.uav[data-layout="geo"] .uav-points i { pointer-events: auto; }
.uav[data-layout="geo"] .uav-ramp:empty { display: none; }
.uav[data-layout="geo"] .uav-note { block-size: calc(var(--uav-font-tick) * ${NOTE} / ${DRAWN.tick}); line-height: ${lineOf('tick', NOTE)}; overflow: hidden; white-space: nowrap; }
.uav[data-layout="geo"] .uav-note span { color: var(--uav-paint); }
.uav[data-layout="geo"] .uav-note:empty { display: none; }
/* In a box the part gives way to the height and its width follows, as a circle of arcs does. */
${IN_BOX} {
  .uav[data-layout="geo"] .uav-body { container-type: size; overflow: hidden; }
  .uav[data-layout="geo"] .uav-plot { ${shape.box} }
  .uav[data-layout="geo"] :is(.uav-note, .uav-ramp, .uav-size) { flex: none; }
}`;

/* Zoom. The map is one picture in a box 100 wide, and what shows of it is the SVG's viewBox: the whole of it, or the
 * box about one region. A click on a listed region goes in to it, and a click on it again, on anything else, or Escape
 * comes back out. Only a map whose regions are its list: on a map of symbols they are HTML over the picture, set by
 * its whole box, and would not follow.
 * ponytail: the pointer's and Escape's alone. A reader at the keys has the list, which says every region whole. */
interface Zoom { home: number[]; at: SVGGraphicsElement | null; frame: number }
const zooms = new WeakMap<SVGSVGElement, Zoom>();
const MOVE = 300;     // ms the map takes to go in or out
const LEAST = 14;     // the least of the picture's 100 a zoomed map is across, so a small country is not a blot

/** The box a map shows when it is brought in to a region: about the region's own box `b`, with room around it, in the
 * map's own shape and inside the map. */
export function zoomBox(b: { x: number; y: number; width: number; height: number }, [, , W, H]: number[]): number[] {
  const w = Math.min(W!, Math.max(LEAST, b.width * 1.5, b.height * 1.5 * (W! / H!))), h = w * H! / W!;
  const x = Math.max(0, Math.min(b.x + b.width / 2 - w / 2, W! - w)), y = Math.max(0, Math.min(b.y + b.height / 2 - h / 2, H! - h));
  return [x, y, w, h];
}
/** Take the map to a region, or back out, over a moment: at once with reduced motion, or when `now`. */
function zoomTo(svg: SVGSVGElement, at: SVGGraphicsElement | null, now = false): void {
  const z = zooms.get(svg);
  if (!z) return;
  z.at = at;
  cancelAnimationFrame(z.frame);
  if (at) svg.setAttribute('data-zoom', ''); else svg.removeAttribute('data-zoom');
  const v = svg.viewBox.baseVal, from = [v.x, v.y, v.width, v.height], to = at ? zoomBox(at.getBBox(), z.home) : z.home, began = performance.now();
  const still = now || !from[2] || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => {
    const t = still ? 1 : Math.min(1, (performance.now() - began) / MOVE), e = 1 - (1 - t) ** 3;
    svg.setAttribute('viewBox', from.map((f, i) => +(f + (to[i]! - f) * e).toFixed(3)).join(' '));
    z.frame = t < 1 ? requestAnimationFrame(step) : 0;
  };
  step();
}
/** Listen on a map's SVG, once: the SVG outlives every paint. */
function zoomable(svg: SVGSVGElement): Zoom {
  let z = zooms.get(svg);
  if (z) return z;
  zooms.set(svg, z = { home: [0, 0, 100, 50], at: null, frame: 0 });
  svg.addEventListener('click', (e) => {
    const region = (e.target as Element).closest<SVGGraphicsElement>('.uav-regions[data-hits] > path');
    zoomTo(svg, region && region !== z!.at ? region : null);
  });
  svg.addEventListener('keydown', (e) => { if (e.key === 'Escape' && z!.at) zoomTo(svg, null); });
  return z;
}

/** Keep the chosen region's shape in the group that is drawn last, wearing the outline the region wears. An SVG has
 * no order but its children's, and the regions keep theirs, which is the list's. Bound once: the SVG outlives every paint. */
const outlined = new WeakSet<SVGSVGElement>();
function outline(svg: SVGSVGElement, over: SVGElement): void {
  if (outlined.has(svg)) return;
  outlined.add(svg);
  const copy = over.appendChild(svgOf('path'));
  const follow = () => {
    const on = svg.querySelector(':scope > :not(.uav-over) > path[data-active]'), d = on?.getAttribute('d') ?? null, how = on?.getAttribute('data-active') ?? null;
    if (copy.getAttribute('d') !== d) attr(copy, 'd', d);
    if (copy.getAttribute('data-active') !== how) attr(copy, 'data-active', how);
  };
  new MutationObserver(follow).observe(svg, { subtree: true, attributes: true, attributeFilter: ['data-active', 'd'] });
  follow();
}

/** The group of the map's SVG with this class, made on first use. */
function group(svg: Element, cls: string): SVGElement {
  let g = svg.querySelector<SVGElement>(':scope > .' + cls);
  if (!g) { g = svg.appendChild(svgOf('g')); g.setAttribute('class', cls); }
  return g;
}
/** Make an element the list a reader steps through, or take that from it. What the keyboard set on it goes with it. */
function list(el: Element, on: boolean): void {
  attr(el, 'data-hits', on ? 'y' : null);
  if (!on) unlist(el);
}

export const geoPainter: LayoutPainter = {
  layout: 'geo',
  css,

  paint(body, scene) {
    const part = ensure(body, 'div', 'uav-plot'), aspect = scene.aspect ?? 2;
    let svg = part.querySelector<SVGSVGElement>(':scope > svg');
    if (!svg) svg = part.appendChild(svgOf('svg'));
    const zoom = zoomable(svg);
    zoom.home = [0, 0, 100, 100 / aspect];
    prop(part, '--uav-aspect', aspect);
    const shapes = scene.nodes.filter((n): n is PathNode => n.part === 'plot' && n.kind === 'path');
    const symbols = scene.nodes.filter((n): n is CircleNode => n.part === 'points' && n.kind === 'circle');
    // A region is in the list when the result has a row for it, unless a symbol stands on it and is.
    const listed = (n: PathNode) => n.row != null && !symbols.length;
    const land = group(svg, 'uav-land'), regions = group(svg, 'uav-regions'), over = group(svg, 'uav-over'), points = ensure(part, 'div', 'uav-points');
    land.setAttribute('aria-hidden', 'true'); over.setAttribute('aria-hidden', 'true');
    outline(svg, over);
    const shape = (el: HTMLElement | SVGElement, n: PathNode) => el.setAttribute('d', n.d ?? '');
    keyed(land, shapes.filter((n) => !listed(n)), () => 'path', shape);
    keyed(regions, shapes.filter(listed), () => 'path', shape);
    keyed(points, symbols, () => 'i', (el, n) => { prop(el, '--uav-x', n.x); prop(el, '--uav-t', n.t); prop(el, '--uav-size', n.size); });
    list(regions, shapes.some(listed)); list(points, symbols.length > 0);
    // The map stays where it was brought in to while its region is still in the list, and is whole otherwise.
    zoomTo(svg, zoom.at?.isConnected && zoom.at.closest('.uav-regions[data-hits]') ? zoom.at : null, true);

    // The note is read: it says what the map does not. It is made whether or not there is one, so it stays above the keys.
    keyed(ensure(body, 'div', 'uav-note'), scene.nodes.filter((n): n is TextNode => n.part === 'note' && n.kind === 'text'), () => 'span', text);
    paintRamp(body, scene); paintSize(body, scene);
  },
};

/** The painter of the mark registered under another name (`registerGeo(shapes, { name })`): the same painter, as the
 * layout of that name. Its fit rules are the mark's, which the element compiles itself.
 * ponytail: the stylesheet is written out again for each name. One sheet with a list of names if a page has many. */
export const geoPainterAs = (name: string): LayoutPainter => ({ ...geoPainter, layout: name, css: css.replaceAll('[data-layout="geo"]', '[data-layout="' + name + '"]') });

/** Register a painter for every name the mark is registered under (`registerGeo`): those so far, and each one after. */
export function registerGeoPainters(): void {
  eachGeoName((name) => registerPainter(name === 'geo' ? geoPainter : geoPainterAs(name)));
}
