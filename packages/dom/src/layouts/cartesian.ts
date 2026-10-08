import type { LineNode, PathNode, RectNode, SceneNode, TextNode } from '@universal-analytics/core';
import { ensure, ensureSvg, keyed, prop, text } from '../dom.ts';
import { hitNodes } from '../keys.ts';
import type { LayoutPainter } from '../layout.ts';
import { thin } from '../measure.ts';
import { morph } from '../motion.ts';

/* A dimension on x, a metric on y. The y axis is a column sized by its labels, the x axis a row under the plot,
 * and the plot a size container, so rules about roles can ask how much room the marks have.
 * Bars are HTML, so corners stay true at any size. Lines and areas are one stretched SVG. Text is never in it. */
const css = `
.vg[data-layout="cartesian"] { --vg-body-block: var(--vg-axes-height, 184px); }
.vg[data-layout="cartesian"] .vg-body { display: grid; grid-template: "y plot" minmax(0, 1fr) ". x" auto / auto minmax(0, 1fr); column-gap: 6px; padding-block-start: 10px; }
.vg-y-axis, .vg-x-axis { display: grid; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vg-y-axis { grid-area: y; }
/* Labels share one cell and are moved by a percentage inset, so the column is still sized by the widest. */
.vg-y-axis span { grid-area: 1 / 1; align-self: start; justify-self: end; position: relative; inset-block-start: calc((1 - var(--vg-t)) * 100%); translate: 0 -50%; color: var(--a8c-charts-color-label-axis, var(--vg-paint)); }
.vg-x-axis { grid-area: x; box-sizing: border-box; block-size: 22px; padding-block-start: 5px; }
/* ponytail: physical translate, so not right for right-to-left. Logical anchors when a surface needs it. */
.vg-x-axis span { grid-area: 1 / 1; justify-self: start; position: relative; inset-inline-start: calc(var(--vg-x) * 100%); translate: -50%; color: var(--a8c-charts-color-label-axis, var(--vg-paint)); }
.vg-x-axis [data-anchor="start"] { translate: 0; }
.vg-x-axis [data-anchor="end"] { translate: -100%; }
/* A label the measured pass gave up keeps its box, so the next measurement reads the same. */
.vg-x-axis [data-thin] { visibility: hidden; }
.vg-plot { grid-area: plot; position: relative; container: plot / size; }
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
  css,
  fit: {
    // Without its axes the plot is a sparkline beside the number, which takes its short forms and gives up its note.
    // A number the measured pass has set carries data-fit and is left to it: that is the number alone, under `marks`.
    axes: {
      '': '--vg-body-block: var(--vg-bare-height, 46px); grid-template: "number body" minmax(0, 1fr) / auto minmax(0, 1fr); column-gap: 12px;',
      '.vg-body': 'grid-template: "plot" minmax(0, 1fr) / minmax(0, 1fr); padding-block: 3px;',
      '.vg-number': 'align-self: center; margin: 0;',
      '.vg-number:not([data-fit]) .vg-f-display': 'font-size: 26px; line-height: 24px;',
      '.vg-number:not([data-fit]) :is(.vg-full, [data-rank])': 'display: none;',
      '.vg-number:not([data-fit]) .vg-short': 'display: inline;',
    },
    // The number alone. The body goes whole, so kept axes do not stand with no plot between them.
    marks: { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.vg-body': 'display: none;', '.vg-number': 'margin: 0;' },
  },
  // ponytail: no rule in core carries the 120 px under which place() drops ranked y ticks, and the y axis sits outside the
  // plot container, so this asks the view: 120 for the plot, 10 above it and 22 for the x axis. Wrong when the number
  // is above the plot. A `plot` rule in core, and the y axis inside that container, would say it properly.
  rules: [{ id: 'y-ticks', layout: 'cartesian', container: 'view', needs: { block: 152 }, hide: ['y-tick.ranked'] }],

  // X labels that would collide, by their real widths. One a fit rule has hidden has no box and is passed over, and
  // so is one that is leaving. Each is placed from its ratio, not read where it stands: a label may be on its way.
  measure(body) {
    const labels = Array.from(body.querySelectorAll<HTMLElement>('.vg-x-axis > span:not([data-exit])')).filter((el) => el.getClientRects().length);
    const room = body.querySelector('.vg-x-axis')!.getBoundingClientRect().width;
    const gone = thin(labels.map((el) => {
      const w = el.getBoundingClientRect().width, lo = Number(el.style.getPropertyValue('--vg-x')) * room - (el.dataset.anchor === 'start' ? 0 : el.dataset.anchor === 'end' ? w : w / 2);
      return { lo, hi: lo + w, rank: Number(el.dataset.rank) || 0 };
    }));
    labels.forEach((el, i) => el.toggleAttribute('data-thin', gone[i]));
  },

  paint(body, scene) {
    body.dataset.scale = scene.scale;
    const yAxis = ensure(body, 'div', 'vg-y-axis'), plot = ensure(body, 'div', 'vg-plot'), xAxis = ensure(body, 'div', 'vg-x-axis');
    // ponytail: paint order is fixed at grid, bars, paths, then rules and labels, whatever the layer order.
    // One SVG per run of paths if a spec ever draws an area over bars.
    const grid = ensure(plot, 'div', 'vg-grid'), bars = ensure(plot, 'div', 'vg-bars'), svg = ensureSvg(plot), refs = ensure(plot, 'div', 'vg-refs');
    yAxis.setAttribute('aria-hidden', 'true'); xAxis.setAttribute('aria-hidden', 'true');
    const nodes = scene.nodes, texts = (part: string) => nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text');
    const line = (el: HTMLElement | SVGElement, n: LineNode) => {
      const [on, off] = (n.dash || '').split(' ');
      el.classList.add('vg-line'); el.toggleAttribute('data-dash', !!n.dash);
      prop(el, '--vg-t', n.t); prop(el, '--vg-stroke', n.width && n.width + 'px'); prop(el, '--vg-dash', on && on + 'px'); prop(el, '--vg-gap', on && (off || on) + 'px');
    };

    keyed(yAxis, texts('y-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--vg-t', n.t); });
    keyed(xAxis, texts('x-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--vg-x', n.x); el.setAttribute('data-anchor', n.anchor); });
    keyed(grid, nodes.filter((n): n is LineNode => inPlot(n) && n.kind === 'line' && n.layer === 'guide'), () => 'i', line);
    keyed(bars, nodes.filter((n): n is RectNode => inPlot(n) && n.kind === 'rect'), () => 'i', (el, n) => { prop(el, '--vg-x', n.x); prop(el, '--vg-w', n.w); prop(el, '--vg-v', n.v); prop(el, '--vg-v0', n.v0); });
    keyed(svg, nodes.filter((n): n is PathNode => inPlot(n) && n.kind === 'path'), () => 'path', (el, n) => {
      morph(el as SVGElement, n); el.toggleAttribute('data-fill', !!n.fill);
      prop(el, 'stroke-width', n.fill ? null : n.width || 2); prop(el, 'stroke-dasharray', n.dash);
    });
    keyed(refs, nodes.filter((n): n is LineNode | TextNode => inPlot(n) && ((n.kind === 'line' && n.layer === 'data') || n.kind === 'text')), (n) => (n.kind === 'line' ? 'i' : 'span'), (el, n) => {
      if (n.kind === 'line') return line(el, n);
      text(el, n); prop(el, '--vg-t', n.t); el.toggleAttribute('data-halo', !!n.halo);
    });
    // A line is one path, so the points to hover and step through are a layer of their own, above the marks.
    const hits = ensure(plot, 'div', 'vg-hits');
    hits.setAttribute('data-hits', 'x');
    keyed(hits, hitNodes(scene), () => 'i', (el, n) => { prop(el, '--vg-x', n.x); prop(el, '--vg-w', n.w); prop(el, '--vg-c', n.c); });
  },
};
