import type { Catalog, ContainerRules, FitRule, Layer, Layout, Query, Result, Room, Scene } from '@unified-analytics/core';

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

/** The swap of a band's legends in a box, which a circle of arcs has too: the full legend while the body's height
 * (100cqb) is at least --uav-legend-block, and the one line under it, with the full one's gap gone as well. A clamp
 * does it, since that need depends on the data. Declarations for `.uav-legend` and `.uav-legend-top`. */
export const LEGEND_SWAP = {
  full: 'overflow: hidden; max-block-size: max(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999);\n    margin-block-start: clamp(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999, 10px);',
  top: 'display: block; overflow: hidden; max-block-size: max(0px, (var(--uav-legend-block) - 100cqb) * 999999);',
};
