import type { ContainerRules, FitRule, Layout, Room, Scene } from '@universal-analytics/core';
import { ensure } from './dom.ts';

/* The seam between <ua-view> and a layout. A layout is one module in layouts/, exporting one LayoutPainter.
 *
 * What the element owns, and a layout leaves alone:
 *   figure.vg[data-layout][data-keep][data-parts]      a grid: "number" above "body", or beside it
 *     figcaption.vg-prose                              the tldr prose
 *     div.vg-number                                    the number part, painted by the element
 *     div.vg-body                                      the layout's own
 *     table.vg-table
 *
 * What a layout is handed: `body`, the same element on every data change while the layout stays the same, and
 * empty the first time. It paints the scene's other parts into it, reconciling by key (`ensure` and `keyed` in
 * dom.ts), and gives each part's element the class `vg-<part>`, because that is what a fit rule's `hide` and
 * `show` compile to. It runs once per data change and never on resize.
 *
 * The element that holds its points carries `data-hits` ("x" across, "y" down), and each point is a child with
 * `data-row`. That is all the keyboard, hover and the readout ask of a layout (keys.ts).
 *
 * What a stylesheet cannot see is the measured pass's (measure.ts). The element runs it after each paint and when
 * the view's room changes, and owns the number and the prose rung. A layout joins it with `measure`. */
export interface LayoutPainter {
  layout: Layout;
  /** Its stylesheet text. It joins the base sheet inside `@layer vg`, so every compiled fit rule beats it whatever
   * the specificity. Begin selectors with `.vg[data-layout="…"]`. For a natural height other than its content's,
   * set `--vg-body-block` on the figure; a view handed a box ignores it and the body fills what is left. A body
   * whose content has a height of its own states the height of the part that has none (cartesian.ts). */
  css: string;
  /** What else changes when one of its fit rules applies, by rule id: a selector inside the figure ('' is the
   * figure itself), then declarations. They are written under the rule's own condition and `keep`. */
  fit?: Record<string, Record<string, string>>;
  /** Fit rules of its own, for what the context's set does not carry yet. Compiled after the context's. */
  rules?: FitRule[];
  paint(body: HTMLElement, scene: Scene, rules: ContainerRules): void;
  /** Its share of the measured pass, if it has one: labels that collide, how many rows fit. `room` is the view's
   * width, and its height when it was handed a box. Read sizes inside `body`, then write attributes there for
   * `css` to answer. Nothing written may change a size that is read, here or by the element, or the pass will not
   * settle: hide with `visibility`, never `display`. It is not called while the view shows only its prose. */
  measure?(body: HTMLElement, room: Room): void;
}

/** A layout nobody has built: the number and the prose, and a line that says so. */
export function unbuilt(layout: Layout): LayoutPainter {
  return {
    layout,
    css: `
.vg:has(.vg-todo) .vg-number { display: block; }
.vg:has(.vg-todo) .vg-prose { position: static; inline-size: auto; block-size: auto; clip-path: none; white-space: normal; }
.vg-todo { margin: 0; font-style: italic; }`,
    paint(body) { ensure(body, 'p', 'vg-todo').textContent = 'The "' + layout + '" layout is not built in <ua-view> yet.'; },
  };
}
