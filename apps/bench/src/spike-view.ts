import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';

/* THROWAWAY. The trend view built by hand, to prove docs/dom-painter-plan.md section 7 before
 * packages/dom exists. It follows the structure in section 4 and the authoring rules in
 * docs/shell-plan.md section 3: createElement, style.setProperty, an adopted constructed sheet.
 * Nothing here reads packages/core; the real painter takes a ratio scene, this takes rows. */

type Row = Record<string, string | number | boolean | null | undefined>;
export interface TrendData { title: string; metric: string; days: number; rows: Row[]; total: number; previous: number | null }

const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const fmt = (v: number) => CF.format(v).replace('K', 'k');
const day = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Always rounded to 4, as section 3 agrees. */
export function yScale(d: TrendData) {
  const vals = d.rows.flatMap((r) => [r[d.metric], r[d.metric + '@previous']]).filter((v): v is number => typeof v === 'number');
  return scaleLinear().domain([0, Math.max(1, ...vals)]).nice(4);
}

export const PATHS = ['L0:area', 'L1:line', 'L2:line', 'L2:line:partial'] as const;
const ROLES = { 'L0:area': 'context', 'L1:line': 'comparison', 'L2:line': 'primary', 'L2:line:partial': 'primary' };

/** The four paths in whatever box `x` and `y` map into: 100 by 100 for the painter, pixels for the check in item 5. */
export function shapes(d: TrendData, x: (i: number) => number, y: (v: number) => number): Record<(typeof PATHS)[number], string | null> {
  const m = d.metric, p = m + '@previous', at = (r: Row) => x(d.rows.indexOf(r)), val = (f: string) => (r: Row) => y(r[f] as number);
  const whole = d.rows.filter((r) => !r.partial), tail = d.rows.filter((r) => r.partial), prev = d.rows.filter((r) => r[p] != null);
  return {
    'L0:area': area<Row>().x(at).y0(y(0)).y1(val(m)).curve(curveMonotoneX)(whole),
    'L1:line': prev.length ? line<Row>().x(at).y(val(p)).curve(curveMonotoneX)(prev) : null,
    'L2:line': line<Row>().x(at).y(val(m)).curve(curveMonotoneX)(whole),
    'L2:line:partial': tail.length ? line<Row>().x(at).y(val(m))([whole[whole.length - 1]!, ...tail]) : null,
  };
}

/* CHANGED from section 2, which compiles a rule's two needs into one query, `(inline-size < 280px) or (block-size < 120px)`.
 * A query is answered by the nearest container that supports EVERY feature it names. A view at its natural height is an
 * inline-size container, so it is passed over for the whole query, the inline half included, and the rule never applies.
 * (Seen in Chrome 155 and WebKit 26.4.) So each need gets its own @container block, and the block one is simply inert
 * until a layout makes the view a size container. */
const unless = (container: string, needs: { inline?: number; block?: number }, body: string) =>
  Object.entries(needs).map(([axis, px]) => `@container ${container} (${axis}-size < ${px}px) {${body}}`).join('\n');
const GUIDES = '.vg[data-layout="cartesian"]:not([data-keep~="guides"])', MARKS = '.vg[data-layout="cartesian"]:not([data-keep~="marks"])';

/* The base sheet, then the four cartesian fit rules of section 2 compiled by hand.
 * Where this departs from the plan's text it says CHANGED; the report lists each one. */
const CSS_TEXT = `
:host { display: block; container: view / inline-size; font: 11px/1.3 system-ui, sans-serif; color: var(--a8c-charts-color-label); }
.vg { position: relative; box-sizing: border-box; block-size: 100%; margin: 0; padding-block-start: 8px; display: grid; column-gap: 6px;
  grid-template: "y plot" minmax(0, 1fr) ". x" auto / auto minmax(0, 1fr); --vg-plot-block: var(--vg-axes-height, 184px); }
.vg-prose { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.vg-number { display: none; grid-area: number; align-self: center; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vg-number b { display: block; font-size: 24px; line-height: 1.1; font-weight: 600; letter-spacing: -0.01em; }
.vg-number [data-judge="good"] { color: var(--a8c-charts-color-delta-good); }
.vg-number [data-judge="bad"] { color: var(--a8c-charts-color-delta-bad); }
.vg-y-axis, .vg-x-axis { display: grid; color: var(--a8c-charts-color-label-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; }
.vg-y-axis { grid-area: y; }
.vg-y-axis span { grid-area: 1 / 1; align-self: start; justify-self: end; position: relative; inset-block-start: calc((1 - var(--vg-t)) * 100%); translate: 0 -50%; }
.vg-x-axis { grid-area: x; margin-inline: 2px; padding-block-start: 4px; }
/* ponytail: physical translate, so not right for RTL; the painter wants anchor classes that flip. */
.vg-x-axis span { grid-area: 1 / 1; justify-self: start; position: relative; inset-inline-start: calc(var(--vg-x) * 100%); translate: -50%; }
.vg-x-axis .start { translate: 0; }
.vg-x-axis .end { translate: -100%; }
/* The height has to be a stated block-size. Chrome 155 answers no block-size query on a plot whose height comes from
 * contain-intrinsic-block-size or min-block-size through a stretched grid row, though it lays it out at that height. */
.vg-plot { grid-area: plot; position: relative; container: plot / size; block-size: var(--vg-plot-block); }
.vg-grid i { position: absolute; inset-inline: 0; inset-block-start: calc((1 - var(--vg-t)) * 100%); border-block-start: 1px solid var(--a8c-charts-color-grid); }
.vg-grid i[data-key="grid:0"] { border-color: var(--a8c-charts-color-axis-x); }
.vg-grid i, .vg-y-axis span { transition: --vg-t 600ms linear; }
svg { position: absolute; inset-block-start: 0; inset-inline-start: 2px; inline-size: calc(100% - 4px); block-size: 100%; overflow: visible; }
path { fill: none; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke: var(--a8c-charts-color-series-1); stroke-width: 2; }
[data-role="context"] { fill: var(--a8c-charts-color-series-1); stroke: none; opacity: 0.14; }
[data-role="comparison"] { stroke: var(--a8c-charts-color-comparison); stroke-width: 1.5; stroke-dasharray: 3 3; }
[data-key$=":partial"] { stroke-dasharray: 2 4; opacity: 0.75; }

/* axes */
${unless('view', { inline: 280, block: 120 }, `
  ${GUIDES} :is(.vg-x-axis, .vg-y-axis, .vg-grid) { display: none; }
  ${GUIDES} .vg-number { display: block; }
  /* CHANGED: the plan sets only grid-template-columns. The areas, the gap, the padding and the bare height have to switch too. */
  ${GUIDES} { --vg-arrange: side; grid-template: "number plot" minmax(0, 1fr) / auto minmax(0, 1fr); column-gap: 12px; padding-block-start: 0; --vg-plot-block: var(--vg-bare-height, 46px); }
`)}
/* mid-tick */
${unless('view', { inline: 380 }, `
  .vg[data-layout="cartesian"] .vg-x-axis .mid { display: none; }
`)}
/* secondary: as the plan writes it. The plot is always a size container, so here one query with "or" is answered. */
@container plot (inline-size < 180px) or (block-size < 90px) {
  .vg:not([data-keep~="secondary"]) :is([data-role="comparison"], [data-role="reference"], [data-role="context"]) { display: none; }
}
/* marks */
${unless('view', { inline: 152, block: 46 }, `
  ${MARKS} .vg-plot { display: none; }
  ${MARKS} .vg-number { display: block; }
  ${MARKS} { grid-template: "number" auto / minmax(0, 1fr); }
`)}
/* ADDED, for item 6. Only a size container answers a block-size query, so this matches exactly when a layout has
 * handed the view a box, and the plot then takes the height left over. No attribute on the view. */
@container view (block-size >= 0px) {
  .vg-plot { block-size: auto; }
}`;

const SVG = 'http://www.w3.org/2000/svg';
function make<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: Node) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return parent.appendChild(e);
}
/** Reconcile children by data-key. A kept element is never re-inserted, because that would cancel its transition. */
function keyed<E extends Element>(parent: Element, keys: string[], create: () => E, each: (el: E, i: number) => void) {
  const old = new Map(Array.from(parent.children, (c) => [c.getAttribute('data-key'), c as E]));
  keys.forEach((k, i) => {
    let el = old.get(k);
    if (el) old.delete(k); else { el = create(); el.setAttribute('data-key', k); parent.appendChild(el); }
    each(el, i);
  });
  old.forEach((c) => c.remove());
}

export class SpikeView extends HTMLElement {
  static sheet: CSSStyleSheet;
  #prose; #value; #delta; #yAxis; #grid; #xAxis;
  #paths = new Map<string, SVGPathElement>();

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [SpikeView.sheet];
    const fig = make('figure', 'vg', root);
    fig.dataset.layout = 'cartesian'; fig.dataset.keep = '';
    this.#prose = make('figcaption', 'vg-prose', fig);
    this.#prose.id = 's'; fig.setAttribute('aria-describedby', 's');
    const number = make('div', 'vg-number', fig);
    this.#value = make('b', '', number); this.#delta = make('span', '', number);
    this.#yAxis = make('div', 'vg-y-axis', fig);
    const plot = make('div', 'vg-plot', fig);
    this.#grid = make('div', 'vg-grid', plot);
    const svg = plot.appendChild(document.createElementNS(SVG, 'svg'));
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    for (const key of PATHS) {
      const p = svg.appendChild(document.createElementNS(SVG, 'path'));
      p.dataset.key = key; p.dataset.role = ROLES[key];
      this.#paths.set(key, p);
    }
    this.#xAxis = make('div', 'vg-x-axis', fig);
  }

  set data(d: TrendData) {
    const y = yScale(d), top = y.domain()[1]!, ticks = y.ticks(4), last = d.rows.length - 1;
    const pct = d.previous ? (d.total - d.previous) / d.previous : null;
    this.#value.textContent = fmt(d.total);
    this.#delta.textContent = pct == null ? 'No prior period' : (pct > 0 ? '▲ ' : '▼ ') + Math.round(Math.abs(pct) * 100) + '%';
    this.#delta.dataset.judge = pct == null ? '' : pct > 0 ? 'good' : 'bad';
    this.#prose.textContent = d.title + ': ' + fmt(d.total) + ' in the last ' + d.days + ' days' + (pct == null ? '.' : ', ' + (pct > 0 ? 'up ' : 'down ') + Math.round(Math.abs(pct) * 100) + '% on the ' + d.days + ' before.');

    const t = (el: HTMLElement, i: number) => el.style.setProperty('--vg-t', String(ticks[i]! / top));
    keyed(this.#yAxis, ticks.map((v) => 'ytick:' + v), () => document.createElement('span'), (el, i) => { el.textContent = fmt(ticks[i]!); t(el, i); });
    keyed(this.#grid, ticks.map((v) => 'grid:' + v), () => document.createElement('i'), t);
    const at = last < 2 ? [0, last] : [0, Math.floor(last / 2), last];
    keyed(this.#xAxis, at.map((i) => 'xtick:' + d.rows[i]!['date.day']), () => document.createElement('span'), (el, j) => {
      el.textContent = day(d.rows[at[j]!]!['date.day'] as string);
      el.className = j === 0 ? 'start' : j === at.length - 1 ? 'end' : 'mid';
      el.style.setProperty('--vg-x', String(at[j]! / last));
    });
    const s = shapes(d, (i) => (100 * i) / last, (v) => 100 * (1 - v / top));
    for (const key of PATHS) this.#paths.get(key)!.setAttribute('d', s[key] ?? '');
  }
}

/** Called by the page, not at import, so the page's violation listener is in place before any of this runs. */
export function defineSpikeView() {
  SpikeView.sheet = new CSSStyleSheet();
  SpikeView.sheet.replaceSync(CSS_TEXT);
  // @property is ignored in a shadow root, so these go on the document. Where it fails, values still apply and nothing animates.
  for (const name of ['--vg-x', '--vg-w', '--vg-v', '--vg-t']) {
    try { CSS.registerProperty({ name, syntax: '<number>', inherits: false, initialValue: '0' }); } catch { /* registered already, or unsupported */ }
  }
  customElements.define('ua-spike-view', SpikeView);
}
