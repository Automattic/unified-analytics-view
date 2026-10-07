import type { ContainerRules, FitRule, Layout, Scene } from '@universal-analytics/core';
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
 * `show` compile to. It runs once per data change and never on resize. */
export interface LayoutPainter {
  layout: Layout;
  /** Its stylesheet text. It joins the base sheet inside `@layer vg`, so every compiled fit rule beats it whatever
   * the specificity. Begin selectors with `.vg[data-layout="…"]`. For a natural height other than its content's,
   * set `--vg-body-block` on the figure; a view handed a box ignores it and the body fills what is left. */
  css: string;
  /** What else changes when one of its fit rules applies, by rule id: a selector inside the figure ('' is the
   * figure itself), then declarations. They are written under the rule's own condition and `keep`. */
  fit?: Record<string, Record<string, string>>;
  /** Fit rules of its own, for what the context's set does not carry yet. Compiled after the context's. */
  rules?: FitRule[];
  paint(body: HTMLElement, scene: Scene, rules: ContainerRules): void;
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
