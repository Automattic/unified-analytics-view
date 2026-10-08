import type { LineNode, PathNode, RectNode, SceneNode, TextNode } from '@universal-analytics/core';
import { ensure, ensureSvg, keyed, paintVar, prop, text } from '../dom.ts';
import { hitNodes } from '../keys.ts';
import { NUMBER_ALONE, type LayoutPainter } from '../layout.ts';
import { apart, thin } from '../measure.ts';
import { morph } from '../motion.ts';
import { POINTS_CSS, POINTS_FIT, measurePoints, paintPoints } from './points.ts';
import { RANGES_CSS, paintRanges } from './ranges.ts';

/* A dimension on x, a metric on y. The y axis is a column sized by its labels, the x axis a row under the plot,
 * and the plot a size container, so rules about roles can ask how much room the marks have.
 * Bars are HTML, so corners stay true at any size. Lines and areas are one stretched SVG. Text is never in it.
 * A second unit's axis and the labels at the line ends are columns on the far side, each as wide as its content and
 * no wider than nothing when it is empty or hidden. The legend of a split plot is a row under it all.
 * The height stated is the plot's and not the body's (--vg-plot-block, not --vg-body-block), so a legend adds its own
 * lines to a view of natural height, as place() adds them. 32 px is the 10 above the plot and the 22 of the x axis.
 * In a box the plot takes what is left, and the legend's lines come out of it. */
const css = `
.vg[data-layout="cartesian"] { --vg-plot-block: calc(var(--vg-axes-height, 184px) - 32px); }
.vg[data-layout="cartesian"] .vg-body { display: grid; padding-block-start: 10px;
  grid-template: "y plot y2 labels" var(--vg-plot-block) ". x . ." auto "legend legend legend legend" auto / auto minmax(0, 1fr) auto auto; }
/* On the body, where it outranks whatever a fit rule sets on the figure. */
@container vg-view (block-size >= 0px) { .vg[data-layout="cartesian"] .vg-body { --vg-plot-block: minmax(0, 1fr); } }
.vg-y-axis, .vg-y-axis-2, .vg-x-axis, .vg-labels { display: grid; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vg-y-axis { grid-area: y; }
.vg-y-axis-2 { grid-area: y2; }
/* Labels share one cell and are moved by a percentage inset, so the column is still sized by the widest. */
:is(.vg-y-axis, .vg-y-axis-2) span { grid-area: 1 / 1; align-self: start; justify-self: end; position: relative; inset-block-start: calc((1 - var(--vg-t)) * 100%); translate: 0 -50%; padding-inline-end: 6px; color: var(--a8c-charts-color-label-axis, var(--vg-paint)); }
.vg-y-axis-2 span { justify-self: start; padding-inline: 6px 0; }
/* The label at a line's end, in its series' colour. The plan names the legend, so these wait for the rule that swaps them in.
 * --vg-dy is the measured pass's: how far a label is moved to stand a line from the next. One with no room keeps its box. */
.vg-labels { grid-area: labels; display: none; }
.vg-labels span { grid-area: 1 / 1; align-self: start; justify-self: start; position: relative; inset-block-start: calc((1 - var(--vg-t)) * 100%); translate: 0 calc(var(--vg-dy, 0px) - 50%);
  box-sizing: border-box; max-inline-size: 14ch; padding-inline-start: 6px; overflow: hidden; text-overflow: ellipsis; color: var(--vg-paint); }
.vg-labels [data-thin] { visibility: hidden; }
/* The legend of a split plot: a swatch and a name per series, in a row that wraps. The band's legend is a grid of
 * rows with a share in each, under the same class; this one says what differs. A name holds its own swatch, so a
 * wrap cannot part them. */
.vg[data-layout="cartesian"] .vg-legend { grid-area: legend; display: flex; flex-wrap: wrap; gap: 0 14px; margin-block-start: 6px; }
.vg[data-layout="cartesian"]:not([data-parts~="legend"]) .vg-legend { display: none; }
.vg[data-layout="cartesian"] .vg-legend span { line-height: 20px; }
.vg[data-layout="cartesian"] .vg-legend span::before { content: ""; display: inline-block; inline-size: 12px; block-size: 12px; margin-inline-end: 6px; border-radius: 2px; vertical-align: -1px; background: var(--vg-swatch); }
.vg-x-axis { grid-area: x; box-sizing: border-box; block-size: 22px; padding-block-start: 5px; }
/* ponytail: physical translate, so not right for right-to-left. Logical anchors when a surface needs it. */
.vg-x-axis span { grid-area: 1 / 1; justify-self: start; position: relative; inset-inline-start: calc(var(--vg-x) * 100%); translate: -50%; color: var(--a8c-charts-color-label-axis, var(--vg-paint)); }
.vg-x-axis [data-anchor="start"] { translate: 0; }
.vg-x-axis [data-anchor="end"] { translate: -100%; }
/* A label the measured pass gave up keeps its box, so the next measurement reads the same. */
.vg-x-axis [data-thin] { visibility: hidden; }
.vg-plot { grid-area: plot; position: relative; container: vg-plot / size; }
.vg-grid, .vg-bars, .vg-refs { position: absolute; inset: 0; }
.vg-line { position: absolute; inset-inline: 0; inset-block-start: calc((1 - var(--vg-t)) * 100%); block-size: var(--vg-stroke, 1px); background: var(--vg-paint); }
.vg-line[data-dash] { background: repeating-linear-gradient(90deg, var(--vg-paint) 0 var(--vg-dash), transparent 0 calc(var(--vg-dash) + var(--vg-gap))); }
/* A bar runs from where it starts to its value, whichever is the higher: a stack's segment starts on the one under
 * it, and a value below zero hangs from the zero line. With no start it rises from the bottom. */
.vg-bars i { position: absolute; inset-inline-start: calc(var(--vg-x) * 100%); inline-size: calc(var(--vg-w) * 100%);
  inset-block-end: calc(min(var(--vg-v0, 0), var(--vg-v)) * 100%); block-size: calc(max(var(--vg-v) - var(--vg-v0, 0), var(--vg-v0, 0) - var(--vg-v)) * 100%);
  background: var(--vg-paint); border-radius: var(--a8c-charts-border-radius-bar, 2px); }
.vg-plot svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; overflow: visible; }
/* A point scale puts its first and last marks 2 px inside the plot. */
.vg-body[data-scale="point"] svg { inset-inline-start: 2px; inline-size: calc(100% - 4px); }
.vg-body[data-scale="point"] .vg-x-axis { margin-inline: 2px; }
.vg-plot path { fill: none; stroke: var(--vg-paint); vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.vg-plot path[data-fill] { fill: var(--vg-paint); stroke: none; }
/* ponytail: a label in the plot is set above its line at the inline end, the one anchor a scene asks for today. */
.vg-refs span { position: absolute; inset-inline-end: 0; inset-block-start: calc((1 - var(--vg-t)) * 100%); translate: 0 -100%; padding-block-end: 2px; white-space: nowrap; color: var(--vg-paint); }
.vg-refs [data-halo] { -webkit-text-stroke: 3px var(--a8c-charts-color-background, Canvas); paint-order: stroke fill; }`;

const inPlot = (n: SceneNode) => n.part === 'plot';

export const cartesian: LayoutPainter = {
  layout: 'cartesian',
  css: css + POINTS_CSS + RANGES_CSS,
  fit: {
    // Without its axes the plot is a sparkline beside the number, which takes its short forms and gives up its note.
    // A number the measured pass has set carries data-fit and is left to it: that is the number alone, under `marks`.
    axes: {
      '': '--vg-plot-block: calc(var(--vg-bare-height, 46px) - 6px); grid-template: "number body" minmax(0, 1fr) / auto minmax(0, 1fr); column-gap: 12px;',
      '.vg-body': 'grid-template: "plot" var(--vg-plot-block) / minmax(0, 1fr); padding-block: 3px;',
      // Its own rule asks only for width, so in a short box it would stand with no column to stand in.
      '.vg-y-axis-2': 'display: none;',
      '.vg-number': 'align-self: center; margin: 0;',
      '.vg-number:not([data-fit]) .vg-f-display': 'font-size: 26px; line-height: 24px;',
      '.vg-number:not([data-fit]) :is(.vg-full, [data-rank])': 'display: none;',
      '.vg-number:not([data-fit]) .vg-short': 'display: inline;',
    },
    // `show` compiles to a block, and the labels are a grid, as the axes are.
    legend: { '.vg-labels': 'display: grid;' },
    'y-ticks': { '.vg-y-axis-2 [data-rank]': 'display: none;' },
    // The number alone. The body goes whole, so kept axes do not stand with no plot between them.
    marks: NUMBER_ALONE,
    ...POINTS_FIT,
  },
  // ponytail: no rule in core carries the 120 px under which place() drops ranked y ticks, and the y axis sits outside the
  // plot container, so this asks the view: 120 for the plot, 10 above it and 22 for the x axis. Wrong when the number
  // is above the plot. A `plot` rule in core, and the y axis inside that container, would say it properly.
  rules: () => [{ id: 'y-ticks', layout: 'cartesian', container: 'view', needs: { block: 152 }, hide: ['y-tick.ranked'] }],

  // X labels that would collide, by their real widths. One a fit rule has hidden has no box and is passed over, and
  // so is one that is leaving. Each is placed from its ratio, not read where it stands: a label may be on its way.
  // ponytail: a label at a line's end is set from where it is going, at once, while its line morphs there.
  measure(body) {
    const labels = Array.from(body.querySelectorAll<HTMLElement>('.vg-x-axis > span:not([data-exit])')).filter((el) => el.getClientRects().length);
    const room = body.querySelector('.vg-x-axis')!.getBoundingClientRect().width;
    const gone = thin(labels.map((el) => {
      const w = el.getBoundingClientRect().width, lo = Number(el.style.getPropertyValue('--vg-x')) * room - (el.dataset.anchor === 'start' ? 0 : el.dataset.anchor === 'end' ? w : w / 2);
      return { lo, hi: lo + w, rank: Number(el.dataset.rank) || 0 };
    }));
    labels.forEach((el, i) => el.toggleAttribute('data-thin', gone[i]));
    measurePoints(body);
    // Labels at the line ends, set a line apart. They are moved by a translate, which changes no size that is read.
    const ends = Array.from(body.querySelectorAll<HTMLElement>('.vg-labels > span')).filter((el) => el.getClientRects().length);
    if (!ends.length) return;
    const block = body.querySelector('.vg-labels')!.getBoundingClientRect().height, own = ends.map((el) => (1 - Number(el.style.getPropertyValue('--vg-t'))) * block);
    apart(own, ends[0]!.getBoundingClientRect().height, block).forEach((y, i) => {
      ends[i]!.toggleAttribute('data-thin', y == null);
      prop(ends[i]!, '--vg-dy', y == null ? null : y - own[i]! + 'px');
    });
  },

  paint(body, scene) {
    body.dataset.scale = scene.scale;
    const yAxis = ensure(body, 'div', 'vg-y-axis'), plot = ensure(body, 'div', 'vg-plot'), xAxis = ensure(body, 'div', 'vg-x-axis');
    const yAxis2 = ensure(body, 'div', 'vg-y-axis-2'), labels = ensure(body, 'div', 'vg-labels'), legend = ensure(body, 'div', 'vg-legend');
    // ponytail: paint order is fixed at grid, bars, paths, then rules and labels, whatever the layer order.
    // One SVG per run of paths if a spec ever draws an area over bars.
    const grid = ensure(plot, 'div', 'vg-grid'), bars = ensure(plot, 'div', 'vg-bars'), svg = ensureSvg(plot), refs = ensure(plot, 'div', 'vg-refs');
    for (const el of [yAxis, yAxis2, xAxis, labels]) el.setAttribute('aria-hidden', 'true');
    const nodes = scene.nodes, texts = (part: string) => nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text');
    const line = (el: HTMLElement | SVGElement, n: LineNode) => {
      const [on, off] = (n.dash || '').split(' ');
      el.classList.add('vg-line'); el.toggleAttribute('data-dash', !!n.dash);
      prop(el, '--vg-t', n.t); prop(el, '--vg-stroke', n.width && n.width + 'px'); prop(el, '--vg-dash', on && on + 'px'); prop(el, '--vg-gap', on && (off || on) + 'px');
    };

    const tick = (el: HTMLElement | SVGElement, n: TextNode) => { text(el, n); prop(el, '--vg-t', n.t); };
    keyed(yAxis, texts('y-axis'), () => 'span', tick);
    keyed(yAxis2, texts('y-axis-2'), () => 'span', tick);
    keyed(labels, texts('labels'), () => 'span', tick);
    // The swatch is the name's own, painted from the scene's swatch node.
    const swatch = new Map(nodes.filter((n) => n.part === 'legend' && n.kind === 'rect').map((n) => [n.series, n.paint]));
    keyed(legend, texts('legend'), () => 'span', (el, n) => { text(el, n); prop(el, '--vg-swatch', paintVar(swatch.get(n.series) ?? n.paint)); });
    keyed(xAxis, texts('x-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--vg-x', n.x); el.setAttribute('data-anchor', n.anchor); });
    keyed(grid, nodes.filter((n): n is LineNode => inPlot(n) && n.kind === 'line' && n.layer === 'guide'), () => 'i', line);
    keyed(bars, nodes.filter((n): n is RectNode => inPlot(n) && n.kind === 'rect'), () => 'i', (el, n) => { prop(el, '--vg-x', n.x); prop(el, '--vg-w', n.w); prop(el, '--vg-v', n.v); prop(el, '--vg-v0', n.v0); });
    keyed(svg, nodes.filter((n): n is PathNode => inPlot(n) && n.kind === 'path'), () => 'path', (el, n) => {
      morph(el as SVGElement, n); el.toggleAttribute('data-fill', !!n.fill);
      prop(el, 'stroke-width', n.fill ? null : n.width || 2); prop(el, 'stroke-dasharray', n.dash);
    });
    keyed(refs, nodes.filter((n): n is LineNode | TextNode => inPlot(n) && ((n.kind === 'line' && n.layer === 'data' && n.row == null) || n.kind === 'text')), (n) => (n.kind === 'line' ? 'i' : 'span'), (el, n) => {
      if (n.kind === 'line') return line(el, n);
      text(el, n); prop(el, '--vg-t', n.t); el.toggleAttribute('data-halo', !!n.halo);
    });
    // A line is one path, so the points to hover and step through are a layer of their own, above the marks.
    const hits = ensure(plot, 'div', 'vg-hits');
    hits.setAttribute('data-hits', 'x');
    keyed(hits, hitNodes(scene), () => 'i', (el, n) => { prop(el, '--vg-x', n.x); prop(el, '--vg-w', n.w); prop(el, '--vg-c', n.c); });
    paintPoints(body, plot, scene);
    paintRanges(plot, scene);
  },
};
