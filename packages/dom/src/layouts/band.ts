import type { RectNode, Scene, TextNode } from '@universal-analytics/core';
import { ensure, keyed, prop, text } from '../dom.ts';
import { NUMBER_ALONE, type LayoutPainter } from '../layout.ts';

/* One band, split by colour, and its legend. Segments are flex items that grow by their share, so the band needs no
 * width. The scene holds both legends: the full one is a grid of swatch, label and share, the one-line one a line of
 * text. The stylesheet shows one of them. Sizes are the pixel painter's: a 24 px bar and 24 px to a legend row. */
const css = `
.uav-band { display: flex; gap: 2px; block-size: 24px; }
.uav-band i { flex: var(--uav-v) 1 0px; min-inline-size: 0; background: var(--uav-paint); border-radius: var(--a8c-charts-border-radius-bar, 2px); }
.uav-legend { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; grid-auto-rows: 20px; gap: 4px 8px; align-items: center; margin-block-start: 10px; }
.uav-legend i { grid-column: 1; block-size: 12px; border-radius: 2px; background: var(--uav-paint); }
.uav-legend span, .uav-legend-top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--uav-paint); }
.uav-legend .uav-f-label { grid-column: 2; }
.uav-legend .uav-f-value { grid-column: 3; justify-self: end; }
.uav-legend-top { display: none; }
.uav-legend-top span { display: block; padding-block-start: 3px; line-height: 21px; }
/* The plan names one legend, and with no limits it is the full one. */
.uav[data-layout="band"]:not([data-parts~="legend"]) .uav-legend { display: none; }
.uav[data-layout="band"][data-parts~="legend-top"] .uav-legend-top { display: block; }
/* In a box the body is a size container, so cqb is the room the band and its legend have. The full legend needs the
 * bar, 10 px and 24 px a row less the last gap: a height that depends on the data, which a container query cannot
 * hold, so paint() states the row count and a clamp does the swap. The legend that goes gives up its gap as well, or
 * the one-line legend would stand 10 px low and be cut. A box too short for either clips. */
@container uav-view (block-size >= 0px) {
  .uav[data-layout="band"] .uav-body { container-type: size; overflow: hidden; --uav-legend-block: calc(30px + var(--uav-rows, 1) * 24px); }
  .uav[data-layout="band"]:not([data-keep~="guides"]) .uav-legend { overflow: hidden; max-block-size: max(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999);
    margin-block-start: clamp(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999, 10px); }
  .uav[data-layout="band"]:not([data-keep~="guides"]) .uav-legend-top { display: block; overflow: hidden; max-block-size: max(0px, (var(--uav-legend-block) - 100cqb) * 999999); }
}`;

export const band: LayoutPainter = {
  layout: 'band',
  css,
  fit: {
    // The rule's data only sets a switch. This is the swap, whatever the box's height says.
    legend: { '.uav-legend': 'display: none;', '.uav-legend-top': 'display: block; max-block-size: none;' },
    // The number alone. The body goes whole, the one-line legend with it, and so does its grid row.
    marks: NUMBER_ALONE,
    'marks-block': NUMBER_ALONE,
  },
  // ponytail: core's `marks` rule for a band has no block need, so this holds the bar and the one-line legend, 24 px
  // each. Wrong when the number is above the band. A block need on core's rule would say it properly.
  rules: () => [{ id: 'marks-block', layout: 'band', container: 'view', needs: { block: 48 }, hide: ['band', 'legend'], show: ['number'], keep: 'marks' }],

  paint(body, scene) {
    const rows = scene.rows ?? [], nodes = (part: string) => scene.nodes.filter((n) => n.part === part);
    const segs = ensure(body, 'div', 'uav-band');
    segs.setAttribute('data-hits', 'x');                                     // each segment is its own hit target
    prop(body, '--uav-rows', rows.length);
    keyed(segs, nodes('band').filter((n): n is RectNode => n.kind === 'rect'), () => 'i', (el, n) => prop(el, '--uav-v', n.v));
    paintLegend(body, scene);
  },
};

/** Both legends of a whole split by colour, after whatever the body holds already. A circle of arcs has the same two. */
export function paintLegend(body: HTMLElement, scene: Scene): void {
  const nodes = (part: string) => scene.nodes.filter((n) => n.part === part);
  keyed(ensure(body, 'div', 'uav-legend'), nodes('legend'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); });
  keyed(ensure(body, 'div', 'uav-legend-top'), nodes('legend-top').filter((n): n is TextNode => n.kind === 'text'), () => 'span', text);
}
