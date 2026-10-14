import type { Scene, TextNode } from '@unified-analytics/core';
import { attr, ensure, keyed, pageWay, paintVar, prop, text } from '../dom.ts';
import { token } from '../tokens.ts';

/* The legend: what each colour is. One component, in the two forms a scene asks for, told apart by its nodes.
 *
 * Where an entry has a value, a whole split by colour, it is a grid: a swatch, a name and the value to a line, the
 * swatch an element of its own in the first column. A band and a circle of arcs have it.
 * Where an entry is a name alone, a plot or a row split into series, it is a row that wraps (`data-names`): the name
 * holds its own swatch, drawn before it from the scene's swatch node, so a wrap cannot part the two. That is why the
 * two forms are not one markup: a swatch that is its own element is a grid's cell, and in a wrapping row it would be
 * left at a line's end with its name on the next.
 *
 * Beside it, `.uav-legend-top`: the one line that stands in for the whole legend where a rule swaps them.
 * A line is 20 px where a label is 13 px, and follows the label's face from there (--uav-legend-line, view.ts).
 * A layout says where the two stand in its body, and what they do in a box. keys.ts marks the chosen entry. */
export const LEGEND_CSS = `
.uav-legend { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; grid-auto-rows: var(--uav-legend-line); gap: 4px 8px; align-items: center; margin-block-start: 10px; }
.uav-legend i { grid-column: 1; block-size: 12px; border-radius: ${token('border-radius-swatch')}; background: var(--uav-paint); }
.uav-legend span, .uav-legend-top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--uav-paint); }
.uav-legend .uav-f-label { grid-column: 2; }
.uav-legend .uav-f-value { grid-column: 3; justify-self: end; }
.uav-legend-top { display: none; }
.uav-legend-top span { display: block; padding-block-start: 3px; line-height: calc(21 / 13); }
/* The plan names the legend, or the view has none. */
.uav:not([data-parts~="legend"]) .uav-legend { display: none; }
.uav-legend[data-names] { display: flex; flex-wrap: wrap; gap: 0 14px; margin-block-start: 6px; }
.uav-legend[data-names] span { line-height: var(--uav-legend-line); }
.uav-legend[data-names] span::before { content: ""; display: inline-block; inline-size: 12px; block-size: 12px; margin-inline-end: 6px; border-radius: ${token('border-radius-swatch')}; vertical-align: -1px; background: var(--uav-swatch); }`;

/** Both legends, after whatever the body holds already: the full one in the form its nodes ask for, and the one line.
 * Each is there, empty, where the scene has none, and reads the way the page does whichever way the body is set. */
export function paintLegend(body: HTMLElement, scene: Scene): void {
  const legend = ensure(body, 'div', 'uav-legend'), top = ensure(body, 'div', 'uav-legend-top');
  pageWay(legend, body); pageWay(top, body);
  const nodes = scene.nodes.filter((n) => n.part === 'legend'), names = nodes.length > 0 && !nodes.some((n) => n.kind === 'text' && n.font === 'value');
  attr(legend, 'data-names', names ? '' : null);
  const swatch = new Map(nodes.filter((n) => n.kind === 'rect').map((n) => [n.series, n.paint]));
  keyed(legend, names ? nodes.filter((n) => n.kind === 'text') : nodes, (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => {
    if (n.kind !== 'text') return;
    text(el, n); prop(el, '--uav-swatch', names ? paintVar(swatch.get(n.series) ?? n.paint) : null);
  });
  keyed(top, scene.nodes.filter((n): n is TextNode => n.part === 'legend-top' && n.kind === 'text'), () => 'span', text);
}

/** For the measured pass of a layout whose legends a box clips to nothing rather than hides (band, radial): the one
 * with no height left is taken from assistive technology too, so a reader hears the legend that shows, and only it. */
export function hideCutLegends(body: HTMLElement): void {
  for (const el of body.querySelectorAll<HTMLElement>(':scope > :is(.uav-legend, .uav-legend-top)')) attr(el, 'aria-hidden', el.getBoundingClientRect().height < 1 ? 'true' : null);
}
