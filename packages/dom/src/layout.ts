import { CONTAINER_RULES, type Catalog, type ContainerRules, type FitRule, type Layer, type Layout, type Query, type Result, type Room, type Scene } from '@unified-analytics/core';

/* The seam between <ua-view> and a layout. A layout is one module in layouts/, exporting one LayoutPainter.
 *
 * What the element owns, and a layout leaves alone:
 *   figure.uav[data-layout][data-keep][data-parts]      a grid: "number" above "body", or beside it
 *     figcaption.uav-prose                              the tldr prose
 *     div.uav-number                                    the number part, painted by the element
 *     div.uav-body                                      the layout's own
 *     table.uav-table
 *
 * What a layout is handed: `body`, the same element on every data change while the layout stays the same, and
 * empty the first time. It paints the scene's other parts into it, reconciling by key (`ensure` and `keyed` in
 * dom.ts), and gives each part's element the class `uav-<part>`, because that is what a fit rule's `hide` and
 * `show` compile to. It runs once per data change and never on resize.
 *
 * The element that holds its points carries `data-hits` ("x" across, "y" down), and each point is a child with
 * `data-row`. That is all the keyboard, hover and the readout ask of a layout (keys.ts).
 *
 * What a stylesheet cannot see is the measured pass's (measure.ts). The element runs it after each paint and when
 * the view's room changes, and owns the number and the prose rung. A layout joins it with `measure`. */
/** What a view was planned from, for a layout that names its own points or lays out its own table: the plan's layers,
 * the query with its preset expanded, and the result and catalog as they were given. */
export interface ViewData { layers: Layer[]; query: Query; result: Result; catalog: Catalog }

export interface LayoutPainter {
  layout: Layout;
  /** Its stylesheet text. It joins the base sheet inside `@layer uav`, so every compiled fit rule beats it whatever
   * the specificity. Begin selectors with `.uav[data-layout="…"]`. For a natural height other than its content's,
   * set `--uav-body-block` on the figure; a view handed a box ignores it and the body fills what is left. A body
   * whose content has a height of its own states the height of the part that has none (cartesian.ts). */
  css: string;
  /** What else changes when one of its fit rules applies, by rule id: a selector inside the figure ('' is the
   * figure itself), then declarations. They are written under the rule's own condition and `keep`. */
  fit?: Record<string, Record<string, string>>;
  /** Fit rules of its own, for what the context's set does not carry yet. Compiled after the context's. It is handed
   * the context's rule set, so a need that is one of its sizes is written from it. */
  rules?(context: ContainerRules): FitRule[];
  paint(body: HTMLElement, scene: Scene, rules: ContainerRules, data: ViewData): void;
  /** The table alternative, where the element's own, a row of the table per row of the result, is not this layout's. */
  table?(table: HTMLTableElement, title: string | undefined, scene: Scene, data: ViewData): void;
  /** Its share of the measured pass, if it has one: labels that collide, how many rows fit. `room` is the view's
   * width, and its height when it was handed a box. Read sizes inside `body`, then write attributes there for
   * `css` to answer. Nothing written may change a size that is read, here or by the element, or the pass will not
   * settle: hide with `visibility`, never `display`. It is not called while the view shows only its prose. */
  measure?(body: HTMLElement, room: Room): void;
}

/** The condition that holds exactly when a layout has handed the view a box: only a size container answers a
 * block-size query. For a stylesheet's `@container` block. */
export const IN_BOX = '@container uav-view (block-size >= 0px)';
/** How far down its box a thing stands that is --uav-t of the way up it: a scene's ratios run from the foot. */
export const FROM_TOP = 'calc((1 - var(--uav-t)) * 100%)';

/** The faces core lays a view out for, in px (place.ts measures its characters and lines at these). A line set in a
 * face is so many px at this size, and grows and shrinks with the face from there: a line-height is that line over
 * this. They are not the tokens' fallbacks, which a theme moves: a line-height stays a ratio of whatever face is set. */
export const DRAWN = { tick: 11, label: 13, display: 37, 'display-small': 26 } as const;
/** A line-height: a line `px` tall in `face` at the size it is drawn at. */
export const lineOf = (face: keyof typeof DRAWN, px: number): string => `calc(${px} / ${DRAWN[face]})`;
/** The number's value on its line, in its face and in the smaller one, in px at DRAWN. */
export const DISPLAY_LINE = 34, DISPLAY_SMALL_LINE = 24;
/** The number in its smaller face: declarations. */
export const NUMBER_SMALL = `font-size: var(--uav-font-display-small); line-height: ${lineOf('display-small', DISPLAY_SMALL_LINE)};`;
/** Rules that set the text under each selector in its shorter form, where it has one (dom.ts text()). */
export const shortForm = (...sel: string[]): string =>
  `${sel.map((s) => s + ' > .uav-full').join(', ')} { display: none; }\n${sel.map((s) => s + ' > .uav-short').join(', ')} { display: inline; }`;

/** Words kept for assistive technology and out of sight, and the same words brought back into the flow: declarations. */
export const VISUALLY_HIDDEN = 'position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;';
export const SHOWN = 'position: static; inline-size: auto; block-size: auto; overflow: visible; clip-path: none;';

/** A plot's natural height with its axes, and without them beside the number: the context's, which the element sets on
 * the figure, and else core's defaults. */
export const AXES_HEIGHT = `var(--uav-axes-height, ${CONTAINER_RULES.axes.height}px)`;
export const BARE_HEIGHT = `var(--uav-bare-height, ${CONTAINER_RULES.bare.height}px)`;

/** What changes with a rule that leaves the number alone: the figure's grid is the number's row, the body goes whole
 * so that its row holds no gap, and the number gives up the margin that stood between them. For a layout's `fit`. */
export const NUMBER_ALONE: Record<string, string> = { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.uav-body': 'display: none;', '.uav-number': 'align-self: start; margin: 0;' };

/** A part that holds its shape, as a circle of arcs, a unit's grid, a map and a treemap do: `part` is as wide as the
 * view up to `most` and as tall as `aspect` (width over height) makes it, in the middle of a column. In a box, `box`
 * has it give way to the height, down to nothing, and its width follows. Both are declarations, for a painter's own
 * selectors; the body must be a flex column, and in a box a size container. */
export function holdShape(most: string, aspect: string | number): { part: string; box: string } {
  return {
    part: `flex: none; align-self: center; inline-size: min(100%, ${most}); aspect-ratio: ${aspect};`,
    box: `flex: 0 1 calc(min(100cqi, ${most}) / ${aspect}); min-block-size: 0; inline-size: auto; max-inline-size: 100%;`,
  };
}

