import { declutter, type PathNode, type RectNode, type TextNode } from '@unified-analytics/core';
import { ensure, ensureSvg, keyed, prop, registerPainter, text, thinLabels, token, type LayoutPainter } from '@unified-analytics/dom';
import { LABEL, NODE } from './index.ts';

/* The `link` mark's half for the DOM: the painter of its layout, for registerPainter().
 *
 * The part is as tall as a plot with axes is, and fills a box it is handed. The ribbons are one stretched SVG between
 * the two columns, as a plot's lines are, and a ribbon is a fill, so stretching costs it nothing. The nodes are HTML at
 * the part's two edges, placed by ratios and a fixed width across. The labels lie over the part, each inside its column.
 *
 *   .uav-plot
 *     svg[data-hits]         a ribbon for each row of the result that has one: the list a reader steps through
 *     .uav-nodes             a node for each value, the sources at the left edge and the targets at the right
 *   .uav-labels              a name for each node
 *
 * The keyboard is the element's own (keys.ts), on the list of ribbons: one tab stop, and every arrow steps along the
 * result's rows, which the engine sends source by source. Each ribbon is named by its readout, which says its source,
 * its target and its value, so no flow is told by colour alone. A node is not a stop: its total is in the table, which
 * is the query's own pivot with the engine's totals at its edges.
 * ponytail: a list, not the two columns. Up and down a column's nodes and across into a node's ribbons, with the
 * node's total said, if a reader at the keys needs the totals without the table.
 * Below the room a Sankey needs, the `marks` rule's `fallback` shows the same query as a grid in its place. That is
 * the element's doing (view.ts), and nothing here knows of it. */
const css = `
.uav[data-layout="link"] { --uav-body-block: var(--uav-axes-height, 184px); }
.uav[data-layout="link"] .uav-body { display: grid; grid-template: "plot" minmax(0, 1fr) / minmax(0, 1fr); }
.uav[data-layout="link"] .uav-plot svg { inset-inline: ${NODE}px; inline-size: calc(100% - ${2 * NODE}px); }
/* Ribbons lie over one another, and an SVG has no order but its children's, which is the list's. So the chosen one is
 * told by the rest standing back, as a chosen series is in a plot, as well as by its edge. */
.uav[data-layout="link"] svg:has(path[data-active]) path:not([data-active]) { opacity: ${token('opacity-dim')}; }
.uav-nodes i { position: absolute; inset-block-start: calc(var(--uav-y) * 100%); block-size: calc(var(--uav-h) * 100%); inset-inline-start: calc(var(--uav-x) * (100% - ${NODE}px)); inline-size: ${NODE}px; background: var(--uav-paint); }
/* The labels are set from the left whichever way the page reads, as the plot they lie over is. One near the top or the
 * foot stays inside the part, and one the measured pass found no room for keeps its box and is not seen. */
.uav[data-layout="link"] .uav-labels { grid-area: plot; display: grid; direction: ltr; pointer-events: none; }
.uav[data-layout="link"] .uav-labels span { inset-block-start: clamp(0.7em, var(--uav-y) * 100%, 100% - 0.7em); translate: 0 -50%; max-inline-size: 45%; padding-inline: ${NODE + LABEL}px; }
.uav[data-layout="link"] .uav-labels span[data-anchor="end"] { justify-self: end; }`;

export const linkPainter: LayoutPainter = {
  layout: 'link',
  css,

  // Labels that would meet, by their real sizes, in each column: the larger node's stands, as place() decides it by a line.
  measure(body) {
    for (const side of ['start', 'end']) {
      thinLabels(body, '.uav-labels > span[data-anchor="' + side + '"]:not([data-exit])', (els) =>
        declutter(els.map((el) => { const b = el.getBoundingClientRect(); return { x: 0, w: 1, y: b.top, h: b.height, rank: Number(el.dataset.rank) }; }), 0));
    }
  },

  paint(body, scene) {
    const plot = ensure(body, 'div', 'uav-plot');
    const svg = ensureSvg(plot, { hits: 'y' });
    keyed(svg, scene.nodes.filter((n): n is PathNode => n.part === 'plot' && n.kind === 'path'), () => 'path', (el, n) => { el.setAttribute('d', n.d ?? ''); el.setAttribute('data-fill', ''); });
    // The nodes and their names say again what each ribbon's name says whole.
    const nodes = ensure(plot, 'div', 'uav-nodes'), labels = ensure(body, 'div', 'uav-labels');
    for (const el of [nodes, labels]) el.setAttribute('aria-hidden', 'true');
    keyed(nodes, scene.nodes.filter((n): n is RectNode => n.part === 'plot' && n.kind === 'rect'), () => 'i', (el, n) => { prop(el, '--uav-x', n.x); prop(el, '--uav-y', n.y); prop(el, '--uav-h', n.h); });
    keyed(labels, scene.nodes.filter((n): n is TextNode => n.part === 'labels' && n.kind === 'text'), () => 'span', (el, n) => { text(el, n); prop(el, '--uav-y', 1 - n.t!); el.setAttribute('data-anchor', n.anchor); });
  },
};

/** Register the `link` mark's painter. */
export const registerLinkPainter = (): void => registerPainter(linkPainter);
