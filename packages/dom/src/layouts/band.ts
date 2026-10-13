import type { RectNode } from '@unified-analytics/core';
import { paintLegend } from '../chrome/legend.ts';
import { attr, ensure, keyed, prop } from '../dom.ts';
import { token } from '../tokens.ts';
import { NUMBER_ALONE, type LayoutPainter } from '../layout.ts';
import { paintUnitKey } from '../chrome/unit.ts';

/* One band, split by colour, and its legend. Segments are flex items that grow by their share, so the band needs no
 * width. The scene holds both legends: the full one is a grid of swatch, label and share, the one-line one a line of
 * text (chrome/legend.ts). The stylesheet here shows one of them. Sizes are the pixel painter's: a 24 px bar and 24 px
 * to a legend row, of which 20 are the line's where a label is 13 px. */
const css = `
.uav-band { display: flex; gap: 2px; block-size: 24px; }
.uav-band i { flex: var(--uav-v) 1 0px; min-inline-size: 0; background: var(--uav-paint); border-radius: ${token('border-radius-bar')}; }
/* The plan names one legend, and with no limits it is the full one. */
.uav[data-layout="band"][data-parts~="legend-top"] .uav-legend-top { display: block; }
/* In a box the body is a size container, so cqb is the room the band and its legend have. The full legend needs the
 * bar, 10 px and a line and its 4 px gap for each row, less the last gap: a height that depends on the data, which a container query cannot
 * hold, so paint() states the row count and a clamp does the swap. The legend that goes gives up its gap as well, or
 * the one-line legend would stand 10 px low and be cut. A box too short for either clips. */
/* A unit's grid in the band's place: a hundred cells, ten to a line, set in the order they come, which is reading
 * order, so nothing here places one. The part holds its shape, as a circle of arcs does: a square as wide as the view
 * up to 160 px, in the middle of the width, with a hairline between cells. */
.uav-band[data-unit] { display: grid; grid-template: repeat(10, minmax(0, 1fr)) / repeat(10, minmax(0, 1fr)); gap: 1px; block-size: auto; inline-size: min(100%, 160px); aspect-ratio: 1; margin-inline: auto; }
.uav-band[data-unit] i { border-radius: 1px; }
@container uav-view (block-size >= 0px) {
  .uav[data-layout="band"] .uav-body { container-type: size; overflow: hidden; --uav-legend-block: calc(30px + var(--uav-rows, 1) * (var(--uav-legend-line) + 4px)); }
  .uav[data-layout="band"]:not([data-keep~="guides"]) .uav-legend { overflow: hidden; max-block-size: max(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999);
    margin-block-start: clamp(0px, (100cqb - var(--uav-legend-block) + 0.01px) * 999999, 10px); }
  .uav[data-layout="band"]:not([data-keep~="guides"]) .uav-legend-top { display: block; overflow: hidden; max-block-size: max(0px, (var(--uav-legend-block) - 100cqb) * 999999); }
  /* In a box the grid gives way to the height, down to nothing, and its width follows, as a circle of arcs does. The
   * full legend stays while the grid has 100 px under it, which is the least place() builds it to. */
  .uav[data-layout="band"] .uav-body:has(> .uav-band[data-unit]) { display: flex; flex-direction: column; --uav-legend-block: calc(106px + var(--uav-rows, 1) * (var(--uav-legend-line) + 4px)); }
  .uav-band[data-unit] { flex: 0 1 160px; align-self: center; min-block-size: 0; max-block-size: 100cqi; inline-size: auto; max-inline-size: 100%; margin-inline: 0; }
  .uav[data-layout="band"] .uav-body:has(> .uav-band[data-unit]) > :is(.uav-legend, .uav-legend-top) { flex: none; }
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
    // Each segment is its own hit target, and a unit's cells are their group's (keys.ts). A grid that reads one value
    // against a range has no row to step to.
    if (rows.length) { segs.setAttribute('data-hits', 'x'); segs.removeAttribute('aria-hidden'); } else { segs.removeAttribute('data-hits'); segs.setAttribute('aria-hidden', 'true'); }
    attr(segs, 'data-unit', scene.aspect ? '' : null);
    prop(body, '--uav-rows', rows.length);
    keyed(segs, nodes('band').filter((n): n is RectNode => n.kind === 'rect'), () => 'i', (el, n) => prop(el, '--uav-v', n.v));
    paintUnitKey(body, scene);
    paintLegend(body, scene);
  },
};
