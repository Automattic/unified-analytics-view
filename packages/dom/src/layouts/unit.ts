import type { CircleNode, Scene, TextNode } from '@unified-analytics/core';
import { ensure, keyed, pageWay, prop, text } from '../dom.ts';

/* What the four layouts gain with `unit`, the mark that draws a value as counted glyphs. Each layout lays its own
 * glyphs out, in its own module, and this file holds what they share: the key that says what a glyph is worth, and
 * how a round glyph takes its size. There is little here, because a glyph is an element the layout already has: a dot
 * in a plot, a mark in a row's track, a segment of the band, a dot over the arcs. Its styles join the base sheet once (view.ts).
 *
 * A glyph holds its shape. The scene gives a dot the room it has, `w` across and `h` up, as ratios of two different
 * lengths, so it cannot say that the dot is round: the stylesheet does, by taking the lesser of the two in pixels for
 * the width and an aspect ratio of one for the height. Where the part itself holds a shape, the half circle of seats,
 * the two are one length and the width alone says it. A hairline parts a glyph from the next, as place() parts them.
 *
 *   .uav-plot .uav-dots i[data-unit]      a stack's dot: its band's width, or its share of the plot's height
 *   .uav-row > i[data-mark="unit"]        a run's dot: its share of the track, or the row's height less 8 px (track.ts)
 *   .uav-band[data-unit] > i              a grid's cell: one of ten columns of a square (band.ts)
 *   .uav-radial .uav-dots i[data-unit]    a seat: its share of the half circle's width (radial.ts)
 *   .uav-unit-key                         "Each is 500", in a line under the glyphs
 *
 * Keys step by group and never by glyph. In a plot the hit targets are a row's, as for bars, and in a list the row is
 * the target. In the band and round the half circle every glyph of a group carries its row, the first of them is the
 * group's option, and all of them wear the outline together (keys.ts). */
const DOT = (room: string) => `max(1px, calc(${room} - 1px))`;
export const UNIT_CSS = `
.uav-dots i[data-unit] { inline-size: ${DOT('var(--uav-w) * 100cqi')}; block-size: auto; aspect-ratio: 1; }
.uav-plot .uav-dots i[data-unit] { inline-size: ${DOT('min(var(--uav-w) * 100cqi, var(--uav-h) * 100cqb)')}; }
/* The key takes a line of its own under whatever the body holds, and the view is that much taller for it, as place()
 * makes it: 20 px where a tick is 11 px, and with the tick's face from there. In a list it is the row after the rows. */
.uav-unit-key { display: none; grid-column: 1 / -1; flex: none; padding-block-start: 4px; overflow: hidden; white-space: nowrap; }
.uav[data-parts~="unit-key"] .uav-unit-key { display: block; }
.uav-unit-key span { display: block; overflow: hidden; text-overflow: ellipsis; line-height: calc(16 / 11); color: var(--uav-paint); }
.uav[data-layout="rows"] .uav-unit-key { grid-row: 3; padding-inline: 8px; }`;

/** The key to a unit's glyphs, after whatever the body holds already. Every layout that draws the mark has the
 * element, empty where the scene has no key, so it stands in the same place whenever a later scene has one. */
export function paintUnitKey(body: HTMLElement, scene: Scene): void {
  const key = ensure(body, 'div', 'uav-unit-key');
  pageWay(key, body);
  keyed(key, scene.nodes.filter((n): n is TextNode => n.part === 'unit-key' && n.kind === 'text'), () => 'span', text);
}

/** A dot that is a unit's glyph says so, and carries the room it has. Any other dot is left as it was. */
export function unitDot(el: HTMLElement | SVGElement, n: CircleNode): void {
  el.toggleAttribute('data-unit', n.w != null);
  prop(el, '--uav-w', n.w); prop(el, '--uav-h', n.h);
}
