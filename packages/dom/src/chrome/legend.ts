import { lineOf } from '../layout.ts';
import type { Scene, TextNode } from '@unified-analytics/core';
import { attr, ensure, keyed, pageWay, paintVar, prop, text } from '../dom.ts';
import { swatch as asSwatch } from './swatch.ts';

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
/** A line of the legend, in px where a label is drawn at DRAWN.label: it follows the face from there. */
export const LEGEND_LINE = 20;
/** The full legend's space above it and between its lines, in px. */
export const LEGEND_MARGIN = 10, LEGEND_GAP = 4;
export const LEGEND_CSS = `
.uav-legend { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; grid-auto-rows: var(--uav-legend-line); gap: ${LEGEND_GAP}px 8px; align-items: center; margin-block-start: ${LEGEND_MARGIN}px; }
.uav-legend i { grid-column: 1; }
.uav-legend span, .uav-legend-top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--uav-paint); }
.uav-legend .uav-f-label { grid-column: 2; }
.uav-legend .uav-f-value { grid-column: 3; justify-self: end; }
.uav-legend-top { display: none; }
.uav-legend-top span { display: block; padding-block-start: 3px; line-height: ${lineOf('label', 21)}; }
/* The plan names the legend, or the view has none. */
.uav:not([data-parts~="legend"]) .uav-legend { display: none; }
.uav-legend[data-names] { display: flex; flex-wrap: wrap; gap: 0 14px; margin-block-start: 6px; }
.uav-legend[data-names] span { line-height: var(--uav-legend-line); }
.uav-legend[data-names] span::before { margin-inline-end: 6px; vertical-align: -1px; }`;

/** Both legends, after whatever the body holds already: the full one in the form its nodes ask for, and the one line.
 * Each is there, empty, where the scene has none, and reads the way the page does whichever way the body is set. */
export function paintLegend(body: HTMLElement, scene: Scene): void {
  const legend = ensure(body, 'div', 'uav-legend'), top = ensure(body, 'div', 'uav-legend-top');
  pageWay(legend, body); pageWay(top, body);
  const nodes = scene.nodes.filter((n) => n.part === 'legend'), names = nodes.length > 0 && !nodes.some((n) => n.kind === 'text' && n.font === 'value');
  attr(legend, 'data-names', names ? '' : null);
  const swatch = new Map(nodes.filter((n) => n.kind === 'rect').map((n) => [n.series, n.paint]));
  keyed(legend, names ? nodes.filter((n) => n.kind === 'text') : nodes, (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => {
    if (n.kind !== 'text') { asSwatch(el, '12'); return; }
    asSwatch(el, names ? '12' : null, true); text(el, n); prop(el, '--uav-swatch', names ? paintVar(swatch.get(n.series) ?? n.paint) : null);
  });
  keyed(top, scene.nodes.filter((n): n is TextNode => n.part === 'legend-top' && n.kind === 'text'), () => 'span', text);
}

/** The swap of a band's legends in a box, which a circle of arcs has too: the full legend while the body's height
 * (100cqb) is at least --uav-legend-block, and the one line under it, with the full one's gap gone as well. A clamp
 * does it, since that need depends on the data. Declarations for `.uav-legend` and `.uav-legend-top`. */
export const LEGEND_SWAP = {
  full: `overflow: hidden; max-block-size: max(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999);\n    margin-block-start: clamp(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999, ${LEGEND_MARGIN}px);`,
  top: 'display: block; overflow: hidden; max-block-size: max(0px, (var(--uav-legend-block) - 100cqb) * 999999);',
};
/** The same swap under the `legend` rule, for a layout's `fit`: the rule's data only sets a switch, and this is the
 * swap, whatever the box's height says. */
export const LEGEND_FIT: Record<string, string> = { '.uav-legend': 'display: none;', '.uav-legend-top': 'display: block; max-block-size: none;' };
/** The height the full legend needs in a box, as --uav-legend-block: `least` px for what stands over it, the legend's
 * margin, and a line and its gap for each of --uav-rows, less the last gap. */
export const legendBlock = (least: number): string => `calc(${least + LEGEND_MARGIN - LEGEND_GAP}px + var(--uav-rows, 1) * (var(--uav-legend-line) + ${LEGEND_GAP}px))`;
/** The one-line legend, where the plan names it in place of the full one, in a layout that has both. */
export const legendTop = (layout: string): string => `.uav[data-layout="${layout}"][data-parts~="legend-top"] .uav-legend-top { display: block; }`;

/** For the measured pass of a layout whose legends a box clips to nothing rather than hides (band, radial): the one
 * with no height left is taken from assistive technology too, so a reader hears the legend that shows, and only it. */
export function hideCutLegends(body: HTMLElement): void {
  for (const el of body.querySelectorAll<HTMLElement>(':scope > :is(.uav-legend, .uav-legend-top)')) attr(el, 'aria-hidden', el.getBoundingClientRect().height < 1 ? 'true' : null);
}
