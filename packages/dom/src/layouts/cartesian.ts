import type { LineNode, PathNode, RectNode, SceneNode, TextNode } from '@universal-analytics/core';
import { ensure, ensureSvg, keyed, paintVar, prop, text } from '../dom.ts';
import { token } from '../tokens.ts';
import { hitNodes } from '../keys.ts';
import { NUMBER_ALONE, type LayoutPainter } from '../layout.ts';
import { apart, thin } from '../measure.ts';
import { morph, once } from '../motion.ts';
import { POINTS_CSS, POINTS_FIT, measurePoints, paintPoints } from './points.ts';
import { RANGES_CSS, paintRanges } from './ranges.ts';

/* A dimension on x, a metric on y. The y axis is a column sized by its labels, the x axis a row under the plot,
 * and the plot a size container, so rules about roles can ask how much room the marks have.
 * Bars are HTML, so corners stay true at any size. Lines and areas are one stretched SVG. Text is never in it.
 * A second unit's axis and the labels at the line ends are columns on the far side, each as wide as its content and
 * no wider than nothing when it is empty or hidden. The legend of a split plot is a row under it all.
 * The height stated is the plot's and not the body's (--uav-plot-block, not --uav-body-block), so a legend adds its own
 * lines to a view of natural height, as place() adds them. What comes off it is the 10 px above the plot and the x axis,
 * which is 22 px where a tick is 11 px and follows the tick's face from there (--uav-x-axis-block, view.ts).
 * In a box the plot takes what is left, and the legend's lines come out of it. */
const css = `
.uav[data-layout="cartesian"] { --uav-plot-block: calc(var(--uav-axes-height, 184px) - 10px - var(--uav-x-axis-block)); }
.uav[data-layout="cartesian"] .uav-body { display: grid; padding-block-start: 10px;
  grid-template: "y plot y2 labels" var(--uav-plot-block) ". x . ." auto "legend legend legend legend" auto / auto minmax(0, 1fr) auto auto; }
/* On the body, where it outranks whatever a fit rule sets on the figure. */
@container uav-view (block-size >= 0px) { .uav[data-layout="cartesian"] .uav-body { --uav-plot-block: minmax(0, 1fr); } }
.uav-y-axis, .uav-y-axis-2, .uav-x-axis, .uav-labels { display: grid; white-space: nowrap; font-variant-numeric: tabular-nums; }
.uav-y-axis { grid-area: y; }
.uav-y-axis-2 { grid-area: y2; }
/* Labels share one cell and are moved by a percentage inset, so the column is still sized by the widest. */
:is(.uav-y-axis, .uav-y-axis-2) span { grid-area: 1 / 1; align-self: start; justify-self: end; position: relative; inset-block-start: calc((1 - var(--uav-t)) * 100%); translate: 0 -50%; padding-inline-end: 6px; color: ${token('color-label-axis')}; }
.uav-y-axis-2 span { justify-self: start; padding-inline: 6px 0; }
/* The label at a line's end, in its series' colour. The plan names the legend, so these wait for the rule that swaps them in.
 * --uav-dy is the measured pass's: how far a label is moved to stand a line from the next. One with no room keeps its box. */
.uav-labels { grid-area: labels; display: none; }
.uav-labels span { grid-area: 1 / 1; align-self: start; justify-self: start; position: relative; inset-block-start: calc((1 - var(--uav-t)) * 100%); translate: 0 calc(var(--uav-dy, 0px) - 50%);
  box-sizing: border-box; max-inline-size: 14ch; padding-inline-start: 6px; overflow: hidden; text-overflow: ellipsis; color: var(--uav-paint); }
.uav-labels [data-thin] { visibility: hidden; }
/* The legend of a split plot: a swatch and a name per series, in a row that wraps. The band's legend is a grid of
 * rows with a share in each, under the same class; this one says what differs. A name holds its own swatch, so a
 * wrap cannot part them. */
.uav[data-layout="cartesian"] .uav-legend { grid-area: legend; display: flex; flex-wrap: wrap; gap: 0 14px; margin-block-start: 6px; }
.uav[data-layout="cartesian"]:not([data-parts~="legend"]) .uav-legend { display: none; }
.uav[data-layout="cartesian"] .uav-legend span { line-height: var(--uav-legend-line); }
.uav[data-layout="cartesian"] .uav-legend span::before { content: ""; display: inline-block; inline-size: 12px; block-size: 12px; margin-inline-end: 6px; border-radius: ${token('border-radius-swatch')}; vertical-align: -1px; background: var(--uav-swatch); }
.uav-x-axis { grid-area: x; box-sizing: border-box; block-size: var(--uav-x-axis-block); padding-block-start: 5px; }
/* ponytail: physical translate, so not right for right-to-left. Logical anchors when a surface needs it. */
.uav-x-axis span { grid-area: 1 / 1; justify-self: start; position: relative; inset-inline-start: calc(var(--uav-x) * 100%); translate: -50%; color: ${token('color-label-axis')}; }
.uav-x-axis [data-anchor="start"] { translate: 0; }
.uav-x-axis [data-anchor="end"] { translate: -100%; }
/* A label the measured pass gave up keeps its box, so the next measurement reads the same. */
.uav-x-axis [data-thin] { visibility: hidden; }
.uav-plot { grid-area: plot; position: relative; container: uav-plot / size; }
.uav-grid, .uav-bars, .uav-refs { position: absolute; inset: 0; }
.uav-line { position: absolute; inset-inline: 0; inset-block-start: calc((1 - var(--uav-t)) * 100%); block-size: var(--uav-stroke, ${token('stroke-width-rule')}); background: var(--uav-paint); }
.uav-line[data-dash] { background: repeating-linear-gradient(90deg, var(--uav-paint) 0 var(--uav-dash), transparent 0 calc(var(--uav-dash) + var(--uav-gap))); }
/* A bar runs from where it starts to its value, whichever is the higher: a stack's segment starts on the one under
 * it, and a value below zero hangs from the zero line. With no start it rises from the bottom. */
.uav-bars i { position: absolute; inset-inline-start: calc(var(--uav-x) * 100%); inline-size: calc(var(--uav-w) * 100% - var(--uav-gap-x, 0px));
  inset-block-end: calc(min(var(--uav-v0, 0), var(--uav-v)) * 100%); block-size: max(0px, calc(max(var(--uav-v) - var(--uav-v0, 0), var(--uav-v0, 0) - var(--uav-v)) * 100% - var(--uav-gap-y, 0px)));
  background: var(--uav-paint); border-radius: ${token('border-radius-bar')}; }
/* Bars that share a row are parted by a line's width, as a pie's segments are: the ones side by side give it up at
 * their far edge, and the ones in a stack at their top. The scene sets them edge to edge, and the gap is px, so it is here. */
.uav-bars i[data-beside] { --uav-gap-x: ${token('stroke-width-rule')}; }
.uav-bars i[data-stacked] { --uav-gap-y: ${token('stroke-width-rule')}; }
.uav-plot svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; overflow: visible; }
/* A point scale puts its first and last marks 2 px inside the plot. */
.uav-body[data-scale="point"] svg { inset-inline-start: 2px; inline-size: calc(100% - 4px); }
.uav-body[data-scale="point"] .uav-x-axis { margin-inline: 2px; }
.uav-plot path { fill: none; stroke: var(--uav-paint); stroke-width: ${token('stroke-width-line')}; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
.uav-plot path[data-fill] { fill: var(--uav-paint); stroke: none; }
/* When a plot first shows, its lines and the fills under them draw in from the start of x to its end, as the readout
 * sketch's curve does. Only then: paint() marks the SVG it has just made, and the mark comes off when the drawing is
 * done (motion.ts). A change of data moves the line that is there, and does not draw it again.
 * ponytail: from the left, so not right for right-to-left, as the x axis is not. */
@media (prefers-reduced-motion: no-preference) { .uav-plot svg[data-draw] { animation: uav-draw ${token('motion-duration-draw')} linear both; } }
@keyframes uav-draw { from { clip-path: inset(-8px 100% -8px -8px); } to { clip-path: inset(-8px); } }
/* ponytail: a label in the plot is set above its line at the inline end, the one anchor a scene asks for today. */
.uav-refs span { position: absolute; inset-inline-end: 0; inset-block-start: calc((1 - var(--uav-t)) * 100%); translate: 0 -100%; padding-block-end: 2px; white-space: nowrap; color: var(--uav-paint); }
.uav-refs [data-halo] { -webkit-text-stroke: 3px ${token('color-background')}; paint-order: stroke fill; }`;

const inPlot = (n: SceneNode) => n.part === 'plot';

export const cartesian: LayoutPainter = {
  layout: 'cartesian',
  css: css + POINTS_CSS + RANGES_CSS,
  fit: {
    // Without its axes the plot is a sparkline beside the number, which takes its short forms and gives up its note.
    // A number the measured pass has set carries data-fit and is left to it: that is the number alone, under `marks`.
    axes: {
      '': '--uav-plot-block: calc(var(--uav-bare-height, 46px) - 6px); grid-template: "number body" minmax(0, 1fr) / auto minmax(0, 1fr); column-gap: 12px;',
      '.uav-body': 'grid-template: "plot" var(--uav-plot-block) / minmax(0, 1fr); padding-block: 3px;',
      // Its own rule asks only for width, so in a short box it would stand with no column to stand in.
      '.uav-y-axis-2': 'display: none;',
      '.uav-number': 'align-self: center; margin: 0;',
      '.uav-number:not([data-fit]) .uav-f-display': 'font-size: var(--uav-font-display-small); line-height: calc(24 / 26);',
      '.uav-number:not([data-fit]) :is(.uav-full, [data-rank])': 'display: none;',
      '.uav-number:not([data-fit]) .uav-short': 'display: inline;',
    },
    // `show` compiles to a block, and the labels are a grid, as the axes are.
    legend: { '.uav-labels': 'display: grid;' },
    'y-ticks': { '.uav-y-axis-2 [data-rank]': 'display: none;' },
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
    const labels = Array.from(body.querySelectorAll<HTMLElement>('.uav-x-axis > span:not([data-exit])')).filter((el) => el.getClientRects().length);
    const room = body.querySelector('.uav-x-axis')!.getBoundingClientRect().width;
    const gone = thin(labels.map((el) => {
      const w = el.getBoundingClientRect().width, lo = Number(el.style.getPropertyValue('--uav-x')) * room - (el.dataset.anchor === 'start' ? 0 : el.dataset.anchor === 'end' ? w : w / 2);
      return { lo, hi: lo + w, rank: Number(el.dataset.rank) || 0 };
    }));
    labels.forEach((el, i) => el.toggleAttribute('data-thin', gone[i]));
    measurePoints(body);
    // Labels at the line ends, set a line apart. They are moved by a translate, which changes no size that is read.
    const ends = Array.from(body.querySelectorAll<HTMLElement>('.uav-labels > span')).filter((el) => el.getClientRects().length);
    if (!ends.length) return;
    const block = body.querySelector('.uav-labels')!.getBoundingClientRect().height, own = ends.map((el) => (1 - Number(el.style.getPropertyValue('--uav-t'))) * block);
    apart(own, ends[0]!.getBoundingClientRect().height, block).forEach((y, i) => {
      ends[i]!.toggleAttribute('data-thin', y == null);
      prop(ends[i]!, '--uav-dy', y == null ? null : y - own[i]! + 'px');
    });
  },

  paint(body, scene) {
    body.dataset.scale = scene.scale;
    const yAxis = ensure(body, 'div', 'uav-y-axis'), plot = ensure(body, 'div', 'uav-plot'), xAxis = ensure(body, 'div', 'uav-x-axis');
    const yAxis2 = ensure(body, 'div', 'uav-y-axis-2'), labels = ensure(body, 'div', 'uav-labels'), legend = ensure(body, 'div', 'uav-legend');
    // ponytail: paint order is fixed at grid, bars, paths, then rules and labels, whatever the layer order.
    // One SVG per run of paths if a spec ever draws an area over bars.
    const loads = !plot.querySelector(':scope > svg');
    const grid = ensure(plot, 'div', 'uav-grid'), bars = ensure(plot, 'div', 'uav-bars'), svg = ensureSvg(plot), refs = ensure(plot, 'div', 'uav-refs');
    if (loads) { svg.setAttribute('data-draw', ''); once(svg, ['data-draw']); }
    for (const el of [yAxis, yAxis2, xAxis, labels]) el.setAttribute('aria-hidden', 'true');
    const nodes = scene.nodes, texts = (part: string) => nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text');
    const line = (el: HTMLElement | SVGElement, n: LineNode) => {
      const [on, off] = (n.dash || '').split(' ');
      el.classList.add('uav-line'); el.toggleAttribute('data-dash', !!n.dash);
      prop(el, '--uav-t', n.t); prop(el, '--uav-stroke', n.width && n.width + 'px'); prop(el, '--uav-dash', on && on + 'px'); prop(el, '--uav-gap', on && (off || on) + 'px');
    };

    const tick = (el: HTMLElement | SVGElement, n: TextNode) => { text(el, n); prop(el, '--uav-t', n.t); };
    keyed(yAxis, texts('y-axis'), () => 'span', tick);
    keyed(yAxis2, texts('y-axis-2'), () => 'span', tick);
    keyed(labels, texts('labels'), () => 'span', tick);
    // The swatch is the name's own, painted from the scene's swatch node.
    const swatch = new Map(nodes.filter((n) => n.part === 'legend' && n.kind === 'rect').map((n) => [n.series, n.paint]));
    keyed(legend, texts('legend'), () => 'span', (el, n) => { text(el, n); prop(el, '--uav-swatch', paintVar(swatch.get(n.series) ?? n.paint)); });
    keyed(xAxis, texts('x-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--uav-x', n.x); el.setAttribute('data-anchor', n.anchor); });
    keyed(grid, nodes.filter((n): n is LineNode => inPlot(n) && n.kind === 'line' && n.layer === 'guide'), () => 'i', line);
    // Which rows hold bars side by side, and which hold a stack: more than one bar, at different places along x or at one.
    const rects = nodes.filter((n): n is RectNode => inPlot(n) && n.kind === 'rect'), places = new Map<string, Set<number>>(), counts = new Map<string, number>();
    for (const n of rects) { const row = n.row ?? ''; places.set(row, (places.get(row) ?? new Set()).add(n.x ?? 0)); counts.set(row, (counts.get(row) ?? 0) + 1); }
    keyed(bars, rects, () => 'i', (el, n) => {
      prop(el, '--uav-x', n.x); prop(el, '--uav-w', n.w); prop(el, '--uav-v', n.v); prop(el, '--uav-v0', n.v0);
      const here = places.get(n.row ?? '')!.size, all = counts.get(n.row ?? '')!;
      el.toggleAttribute('data-beside', here > 1); el.toggleAttribute('data-stacked', all > here);
    });
    keyed(svg, nodes.filter((n): n is PathNode => inPlot(n) && n.kind === 'path'), () => 'path', (el, n) => {
      morph(el as SVGElement, n); el.toggleAttribute('data-fill', !!n.fill);
      // A scene's width is a weight, against the 2 it gives a line of the data: the line token is that line's width here,
      // and a comparison's or a rule's is the same share of it.
      prop(el, 'stroke-width', n.fill || !n.width ? null : `calc(${token('stroke-width-line')} * ${n.width / 2})`); prop(el, 'stroke-dasharray', n.dash);
    });
    keyed(refs, nodes.filter((n): n is LineNode | TextNode => inPlot(n) && ((n.kind === 'line' && n.layer === 'data' && n.row == null) || n.kind === 'text')), (n) => (n.kind === 'line' ? 'i' : 'span'), (el, n) => {
      if (n.kind === 'line') return line(el, n);
      text(el, n); prop(el, '--uav-t', n.t); el.toggleAttribute('data-halo', !!n.halo);
    });
    // A line is one path, so the points to hover and step through are a layer of their own, above the marks.
    const hits = ensure(plot, 'div', 'uav-hits');
    hits.setAttribute('data-hits', 'x');
    keyed(hits, hitNodes(scene), () => 'i', (el, n) => { prop(el, '--uav-x', n.x); prop(el, '--uav-w', n.w); prop(el, '--uav-c', n.c); });
    paintPoints(body, plot, scene);
    paintRanges(plot, scene);
  },
};
