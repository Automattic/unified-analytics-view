import { CONTAINER_RULES, buildScene, expand, fallbackRule, formatDimension, formatValue, metricOf, resolve, unboundedContainer } from '@unified-analytics/core';
import type { Catalog, ContainerRules, Layer, Layout, Query, Result, Row, SceneNode, Spec } from '@unified-analytics/core';
import { compileFitRules, type FitExtras } from './compile.ts';
import { attr, ensure, keyed, paintVar, text } from './dom.ts';
import { DOTS_CSS } from './dots.ts';
import { PIXELS_CSS, pixels } from './pixels.ts';
import { KEYS_CSS, Keys, companionLabel, companions, hideReadout, readoutOf } from './keys.ts';
import { LAYOUTS, painterOf } from './layouts/index.ts';
import { NUMBER_FITS, fitNumber, readNumber } from './measure.ts';
import { MOTION_CSS, begin, register, settle } from './motion.ts';
import { FACES, token } from './tokens.ts';

/* <ua-view>: one view, in whatever room it is handed. It plans once per data change, for a container with no
 * limits, builds the ratio scene and paints it. The stylesheet fits it. On resize only the measured pass runs
 * (measure.ts), a frame later, for what a stylesheet cannot see. Where there is no ResizeObserver, or no
 * requestAnimationFrame, the stylesheet stands alone.
 * The host is the `view` container. By default it fills the width and takes its natural height; a surface
 * layout that hands out a box makes it `container-type: size`, and the body fills what is left. */

const painters = Object.values(LAYOUTS);

/* Everything the element owns, in one layer, so a compiled fit rule beats it whatever the specificity. */
export const BASE_CSS = `@layer uav {
:host { display: block; container: uav-view / inline-size; line-height: 1.3; text-align: start; text-indent: 0; color: ${paintVar('ink')}; }
:host([hidden]), [hidden] { display: none !important; }
/* The faces, worked out here and nowhere else. A page's type tokens may be fluid, in cqi, and these are the view's
 * children: the view is their container, so a face is one size across the whole of it. Read inside the plot, which
 * is a container itself, the same token would give another. They are registered as lengths (motion.ts), which is what
 * makes each a size here and not a formula handed down. Where that fails a part reads the token for itself.
 * What follows from a face is written from it: a line of the legend, and the x axis, are as tall as their text needs. */
.uav, .uav-ruler, .uav-error { ${FACES.map((f) => `--uav-font-${f}: ${token('font-size-' + f)};`).join(' ')} font-size: var(--uav-font-tick);
  --uav-legend-line: calc(var(--uav-font-label) * 20 / 13); --uav-x-axis-block: calc(5px + var(--uav-font-tick) * 17 / 11); }
.uav { position: relative; box-sizing: border-box; block-size: 100%; margin: 0; display: grid; grid-template: "number" auto "body" minmax(0, 1fr) / minmax(0, 1fr); print-color-adjust: exact; }
/* A bar, a segment, a swatch and a rule are backgrounds. A printer leaves those out unless told, and forced colours
 * repaint them as the page, so both are told to leave a mark its paint. */
.uav-body i, .uav-pulse { forced-color-adjust: none; }
.uav-prose { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.uav-body { grid-area: body; box-sizing: border-box; min-inline-size: 0; block-size: var(--uav-body-block, auto); }
.uav-error { margin: 0; font-size: var(--uav-font-label); overflow-wrap: anywhere; color: ${paintVar('delta.bad')}; }

/* A line's height is a ratio of its face, so it follows a face that a token has moved. */
.uav-f-tick { font-size: var(--uav-font-tick); font-family: ${token('font-family-tick')}; }
.uav-f-label { font-size: var(--uav-font-label); }
.uav-f-value { font-size: var(--uav-font-value); font-family: ${token('font-family-value')}; font-weight: ${token('font-weight-value')}; font-variant-numeric: tabular-nums; }
/* Words set among the marks, a point's name or what a rule stands for, are read as words: in the page's own face,
 * whatever face the axis and the small numbers have. */
.uav-plot :is(.uav-f-tick, .uav-f-value) { font-family: inherit; }
/* Small type in a pixel face is set with every pixel whole: the optical size a browser would pick for it thins them unevenly. */
.uav-f-tick, .uav-f-value { font-optical-sizing: none; }
.uav-f-display { font-size: var(--uav-font-display); line-height: calc(34 / 37); font-weight: ${token('font-weight-display')}; font-variant-numeric: tabular-nums; letter-spacing: ${token('letter-spacing-display')}; }

/* The number: a value, then a delta and a note, each on its own line. It is in every scene and shows when the
 * plan names it or a fit rule brings it in. */
.uav-number { grid-area: number; display: none; white-space: nowrap; }
.uav[data-parts~="number"] .uav-number { display: block; }
.uav[data-parts~="number"]:not([data-layout="none"]) .uav-number { margin-block-end: 16px; }
.uav-number > * { color: var(--uav-paint); }
.uav-number > b { display: inline-block; vertical-align: middle; max-inline-size: 100%; }
/* A number in dots is a block, so its screen has the number's whole width to fill. The ruler's is as wide as its glyphs. */
:not(.uav-ruler) > .uav-number > b:has(.uav-glyphs) { display: block; }
/* Beside a pulse it is what the pulse and its margins leave. */
:not(.uav-ruler) > .uav-number > .uav-pulse + b:has(.uav-glyphs) { display: inline-block; inline-size: calc(100% - 20px); }
.uav-number > span { display: block; line-height: calc(18 / 13); overflow: hidden; text-overflow: ellipsis; }
.uav-number > .uav-f-tick { line-height: calc(16 / 11); }
.uav-pulse { display: inline-block; vertical-align: middle; inline-size: 10px; block-size: 10px; margin-inline: 2px 8px; border-radius: 50%; background: var(--uav-paint); }
.uav-short { display: none; }
/* What the measured pass found, as data-fit on the number: its size, its forms, and whether its note fits. */
.uav-number[data-fit~="short"] > .uav-f-display > .uav-full, .uav-number[data-fit~="delta-short"] > .uav-f-value > .uav-full { display: none; }
.uav-number[data-fit~="short"] > .uav-f-display > .uav-short, .uav-number[data-fit~="delta-short"] > .uav-f-value > .uav-short { display: inline; }
.uav-number[data-fit~="small"] > .uav-f-display { font-size: var(--uav-font-display-small); line-height: calc(24 / 26); }
.uav-number[data-fit~="no-note"] > .uav-f-tick { display: none; }
/* A number the pass has not set carries no data-fit: one beside a bare plot, which its layout sets, or any number
 * where the pass does not run. For that one the widths at which place() takes the shorter forms stand in. */
@container uav-view (inline-size < 200px) { .uav-number:not([data-fit]) > .uav-f-value > .uav-full { display: none; } .uav-number:not([data-fit]) > .uav-f-value > .uav-short { display: inline; } }
@container uav-view (inline-size < 160px) {
  .uav-number:not([data-fit]) > .uav-f-display > .uav-full { display: none; } .uav-number:not([data-fit]) > .uav-f-display > .uav-short { display: inline; }
  .uav-number:not([data-fit]) > .uav-f-display { font-size: var(--uav-font-display-small); line-height: calc(24 / 26); }
}
@container uav-view (inline-size < 120px) { .uav-number:not([data-fit]) > .uav-f-tick { display: none; } }

/* What the measured pass reads. The room takes the view's width, and its height only when the view was handed a
 * box, so nothing the pass writes can resize it. The ruler holds the number set in each of its forms, clipped to
 * nothing so that it adds no overflow, and outside the figure so that no fit rule reaches it. */
.uav-room { position: absolute; inset-inline: 0; inset-block-start: 0; block-size: 0; visibility: hidden; pointer-events: none; }
@container uav-view (block-size >= 0px) { .uav-room { block-size: 100%; } }
.uav-ruler { position: absolute; inline-size: 0; block-size: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.uav-ruler > .uav-number { display: block; position: absolute; inline-size: max-content; }
.uav-ruler > .uav-number > span { inline-size: max-content; }

${painters.map((p) => p.css).join('\n')}
${MOTION_CSS}
${KEYS_CSS}
${DOTS_CSS}
${PIXELS_CSS}

/* Only a size container answers a block-size query, so this matches exactly when a layout has handed the view a
 * box. The body then takes the height left over. No attribute on the view. */
@container uav-view (block-size >= 0px) { .uav-body { block-size: auto; } }

/* The prose alone: the last rung, set by the plan or, when the number itself does not fit, by the measured pass. */
.uav:is([data-layout="prose"], [data-fit="prose"]) > :not(.uav-prose, .uav-room) { display: none !important; }
.uav:is([data-layout="prose"], [data-fit="prose"]) > .uav-prose { position: static; inline-size: auto; block-size: auto; clip-path: none; white-space: normal; font-size: var(--uav-font-label); }

/* The same result as a table, in place of the marks. The switch is public: the surface that offers it is outside the shadow root. */
.uav-table { display: none; inline-size: 100%; border-collapse: collapse; font-size: var(--uav-font-tick); font-variant-numeric: tabular-nums; }
.uav-table :is(th, td) { padding: 2px 8px 2px 0; text-align: start; font-weight: 400; border-block-end: 1px solid ${paintVar('grid')}; }
.uav-table :is(thead th, tfoot td, tfoot th) { font-weight: ${token('font-weight-heading')}; }
.uav-table [data-num] { text-align: end; padding-inline: 8px 0; }
:host([table]) .uav > :not(.uav-table, .uav-prose, .uav-room) { display: none !important; }
:host([table]) .uav { display: block; overflow: auto; }
:host([table]) .uav-table { display: table; }
}`;

/** The two surface layouts of docs/dom-painter-plan.md section 4.2. The surface owns them; they are here so that a
 * surface which is itself a custom element can adopt them into its shadow root. */
export const SURFACE_CSS = `.ua-stack { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--ua-space-s, 12px); }
.ua-row { display: flex; gap: var(--ua-space-s, 12px); }
.ua-row > ua-view { flex: 1 1 0; min-inline-size: 0; block-size: 100%; container-type: size; }`;
export function surfaceSheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(SURFACE_CSS);
  return sheet;
}

const EXTRAS: FitExtras = Object.fromEntries(painters.map((p) => [p.layout, p.fit ?? {}]));

/* A layout whose rule names a `fallback` is painted twice: by this view, and as that preset by a view of its own
 * beside the figure, handed the same query, result, catalog and rules. That one is its own container, with its own
 * rules, keyboard and measured pass. The compiled rule shows one of the two, so nothing runs on resize. The table is
 * the same query's either way, so it is this view's. */
export const FALLBACK_CSS = `@layer uav {
.uav-fallback { display: none; }
@container uav-view (block-size >= 0px) { .uav-fallback { block-size: 100%; container-type: size; } }
:host([table]) .uav { display: block !important; }
:host([table]) .uav-fallback { display: none !important; }
}`;
// One sheet per text and per document: a constructed sheet cannot be adopted outside the document it was made for,
// and a view may be put into another one (a preview frame, a window opened from the page).
const sheets = new WeakMap<Document, Map<string, CSSStyleSheet>>();
function sheet(doc: Document, css: string): CSSStyleSheet {
  let own = sheets.get(doc);
  if (!own) sheets.set(doc, own = new Map());
  let s = own.get(css);
  if (!s) { s = new (doc.defaultView ?? globalThis).CSSStyleSheet(); s.replaceSync(css); own.set(css, s); }
  return s;
}

const INPUTS = ['spec', 'result', 'catalog', 'rules'] as const;
type Input = (typeof INPUTS)[number];
const SHAPE: Record<Input, string> = {
  spec: 'an object with a "query"', result: 'an object with "rows", "totals" and "meta"',
  catalog: 'an object with "metrics" and "dimensions"', rules: 'an object like CONTAINER_RULES',
};
const how = (name: Input) => 'Set the ' + name + ' property, or put <script type="application/json" data-for="' + name + '"> inside the element.';
/** What a view is handed. `rules` is the context's, and optional. */
export interface Inputs { spec?: Spec; result?: Result; catalog?: Catalog; rules?: Partial<ContainerRules> }
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/* The input is checked here because resolve() trusts its catalog and result, and its failures would not name a fix. */
export function check(spec: Spec, result: Result, catalog: Catalog): void {
  if (!isObject(spec.query)) throw new Error('The spec has no "query". Add one, for example { "metrics": ["visitors"], "by": ["date.day"] }.');
  // A list written as a bare value is the slip hand-written JSON makes, and core's failure for it names no fix.
  for (const [name, v] of [['query.metrics', spec.query.metrics], ['query.by', spec.query.by], ['layers', spec.layers], ['keep', spec.keep]] as const)
    if (v != null && !Array.isArray(v)) throw new Error('The spec gives "' + name + '" as ' + JSON.stringify(v) + '. It is a list: write ' + JSON.stringify([v]) + '.');
  if (!Array.isArray(result.rows) || !isObject(result.totals) || !isObject(result.meta)) throw new Error('The result needs "rows" (an array), "totals" and "meta". Pass what the query returned, whole.');
  if (!isObject(catalog.metrics) || !isObject(catalog.dimensions)) throw new Error('The catalog needs "metrics" and "dimensions". Pass the catalog the query was run against.');
  const q = spec.query;
  (q.metrics || []).forEach((m) => { if (!Object.hasOwn(catalog.metrics, m)) throw new Error('The catalog has no metric "' + m + '". It has: ' + (Object.keys(catalog.metrics).join(', ') || 'none') + '. Pass the catalog the query was run against.'); });
  (q.by || []).forEach((d) => { if (!Object.hasOwn(catalog.dimensions, d)) throw new Error('The catalog has no dimension "' + d + '". It has: ' + (Object.keys(catalog.dimensions).join(', ') || 'none') + '. Pass the catalog the query was run against.'); });
  // A spec set a task before its result is painted against the last one, as rows of dashes. Every row answers the same
  // query, so the first one tells. A result with no rows is a valid answer, and its totals still name the metrics.
  // Companions are not asked for: `metric@previous` is rightly missing where there is no prior period.
  const row = result.rows[0], lacks = (has: object, f: string, where: string) => {
    if (!Object.hasOwn(has, f)) throw new Error('The result does not carry the query\'s "' + f + '" field: its ' + where + ' ' + (Object.keys(has).join(', ') || 'nothing') + '. Pass what this spec\'s query returned, and where both change set them at once: view.inputs = { spec, result }.');
  };
  if (isObject(row)) for (const f of [...(q.by || []), ...(q.metrics || [])]) lacks(row, f, 'rows have');
  (q.metrics || []).forEach((m) => lacks(result.totals, m, 'totals have'));
}

/* A context's rule set over the defaults, one level down as well: one that gives only a row's height keeps the default gap. */
export function rulesOver(given: Partial<ContainerRules> = {}): ContainerRules {
  const d = CONTAINER_RULES;
  return { ...d, ...given, axes: { ...d.axes, ...given.axes }, bare: { ...d.bare, ...given.bare }, rows: { ...d.rows, ...given.rows }, tldrValue: { ...d.tldrValue, ...given.tldrValue } };
}

/** A result by two dimensions as a pivot: a row per value of the first, a column per value of the second for each
 * field, then the field over all of them. Totals are the engine's, per value of each dimension, so a cell is empty
 * where the result has none. The columns run in the engine's order, as the series of a plot do. */
export function pivot(q: Query, result: Result, fields: string[]): { cols: Row[string][]; rows: { key: Row[string]; cells: Row[string][] }[]; foot: Row[string][] } {
  const [a, b] = q.by as [string, string], uniq = (rows: Row[], d: string) => [...new Set(rows.map((r) => r[d]))];
  const of = (d: string, v: Row[string]) => result.totalsBy?.[d]?.find((t) => t[d] === v);
  const cols = uniq(result.totalsBy?.[b] ?? result.rows, b);
  return {
    cols,
    rows: uniq(result.rows, a).map((key) => {
      const at = result.rows.filter((r) => r[a] === key);
      return { key, cells: [...cols.flatMap((c) => fields.map((f) => at.find((r) => r[b] === c)?.[f])), ...fields.map((f) => of(a, key)?.[f])] };
    }),
    foot: [...cols.flatMap((c) => fields.map((f) => of(b, c)?.[f])), ...fields.map((f) => result.totals[f])],
  };
}

/* The table is rebuilt whole: nothing in it moves, so there is nothing to keep. Totals are the engine's, never a sum of the rows. */
function paintTable(table: HTMLTableElement, title: string | undefined, q: Query, result: Result, catalog: Catalog, layers: Layer[]): void {
  const by = q.by || [], prev = q.compare === 'previous';
  // A companion of a metric that a layer encodes has a column after it, under its suffix, or its own label where the catalog has an entry for it, as the readout says it, and in its own unit. With two dimensions the table is a pivot, and has none.
  const more = (m: string) => (by.length === 2 ? [] : companions(m, result.rows[0], layers));
  const fields = q.metrics.flatMap((m) => [m, ...(prev ? [m + '@previous'] : []), ...more(m)]);
  const label = (f: string) => { const [m, of] = f.split('@'); return catalog.metrics[m!]!.label + (of == null ? '' : ', ' + (of === 'previous' ? 'previous period' : companionLabel(f, catalog))); };
  const row = (parent: HTMLElement, cells: [text: string, tag: 'th' | 'td', num?: boolean][]) => {
    const tr = parent.appendChild(document.createElement('tr'));
    for (const [s, tag, num] of cells) { const c = tr.appendChild(document.createElement(tag)); c.textContent = s; if (num) c.setAttribute('data-num', ''); if (tag === 'th') c.scope = parent.tagName === 'THEAD' ? 'col' : 'row'; }
  };
  table.replaceChildren();
  if (title) table.createCaption().textContent = title;
  if (by.length === 2) {
    // Two dimensions: the first down the side, the second across, and each field once more for the whole row.
    const p = pivot(q, result, fields), per = (v: Row[string][]) => v.map((x, i): [string, 'td', boolean] => [x === undefined ? '' : cell(x, fields[i % fields.length]!), 'td', true]);
    const cell = (v: Row[string], f: string) => formatValue(v as number | null, catalog.metrics[f.replace('@previous', '')]!, 'exact'), dim = (i: number, v: Row[string]) => formatDimension(v, catalog.dimensions[by[i]!]!);
    row(table.createTHead(), [[catalog.dimensions[by[0]!]!.label, 'th'], ...p.cols.flatMap((c) => fields.map((f): [string, 'th', boolean] => [dim(1, c) + (fields.length > 1 ? ', ' + label(f) : ''), 'th', true])), ...fields.map((f): [string, 'th', boolean] => [label(f), 'th', true])]);
    const tbody = table.createTBody();
    for (const r of p.rows) row(tbody, [[dim(0, r.key), 'th'], ...per(r.cells)]);
    row(table.createTFoot(), [['Total', 'th'], ...per(p.foot)]);
    return;
  }
  row(table.createTHead(), [...by.map((d): [string, 'th'] => [catalog.dimensions[d]!.label, 'th']), ...fields.map((f): [string, 'th', boolean] => [label(f), 'th', true])]);
  const value = (v: Row[string], f: string) => formatValue(v as number | null, metricOf(catalog, f)!, 'exact');
  const body = table.createTBody(), totals = fields.map((f): [string, 'td', boolean] => [value(result.totals[f], f), 'td', true]);
  for (const r of result.rows) row(body, [...by.map((d): [string, 'th'] => [formatDimension(r[d], catalog.dimensions[d]!), 'th']), ...fields.map((f): [string, 'td', boolean] => [value(r[f], f), 'td', true])]);
  if (!by.length) row(body, totals);
  else row(table.createTFoot(), [['Total', 'th'], ...by.slice(1).map((): [string, 'td'] => ['', 'td']), ...totals]);
}

function paintNumber(el: HTMLElement, nodes: SceneNode[]): void {
  keyed(el, nodes, (n) => (n.kind === 'circle' ? 'i' : n.kind === 'text' && n.font === 'display' ? 'b' : 'span'), (c, n) => {
    if (n.kind === 'text') { text(c, n); (c as HTMLElement).title = n.note ?? ''; } else c.classList.add('uav-pulse');      // what the number counts, when it is pointed at
  });
}

// Importing this where there is no document, as a test or a server template does, must not throw.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export class UaView extends Base {
  // The table switch changes what shows and resizes neither the room nor the ruler, so no observer follows it: the view paints again.
  static observedAttributes = ['table'];
  #given: Partial<Record<Input, unknown>> = {};
  #queued = false;
  // Whether an input changed since the last paint. A view that is only moved in the page paints again, and nothing in it moves.
  #changed = false;
  #layout: Layout | null = null;
  #root: ShadowRoot; #fig: HTMLElement; #prose: HTMLElement; #number: HTMLElement; #body: HTMLElement; #table: HTMLTableElement; #error: HTMLElement;
  #room: HTMLElement; #ruler: HTMLElement[]; #seen = '';
  #keys: Keys;
  #fallback: UaView | null = null;
  #frame = 0;
  /** The layouts this view is the fallback of, set by the view that holds it. A fallback that leads back to one of them is an error. */
  via: Layout[] = [];
  // The one observer of the measured pass. It watches the room and the ruler, whose sizes nothing it writes can change.
  // It only asks for a frame. A write in its callback can resize something the page observes, and the browser then
  // reports a "ResizeObserver loop" error to the page's window. So a view that crosses a threshold paints one frame
  // in the old state. However many callbacks come before the frame, it reads once, then, and writes once.
  #sizes = globalThis.ResizeObserver && typeof requestAnimationFrame === 'function'
    ? new ResizeObserver(() => { this.#frame ||= requestAnimationFrame(() => { this.#frame = 0; this.#measure(false); }); }) : null;
  // Markup can arrive after the element does, when a parser is still streaming its children.
  #children = new MutationObserver(() => { this.#changed = true; this.#queue(); });

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#fig = ensure(this.#root as unknown as Element, 'figure', 'uav');
    this.#prose = ensure(this.#fig, 'figcaption', 'uav-prose');
    this.#prose.id = 'prose'; this.#fig.setAttribute('aria-describedby', 'prose');
    this.#number = ensure(this.#fig, 'div', 'uav-number');
    this.#body = ensure(this.#fig, 'div', 'uav-body');
    this.#table = ensure(this.#fig, 'table', 'uav-table');
    this.#keys = new Keys(this, this.#fig, this.#body);
    this.#error = ensure(this.#root as unknown as Element, 'p', 'uav-error');
    this.#error.setAttribute('role', 'alert'); this.#error.hidden = true;
    this.#room = ensure(this.#fig, 'div', 'uav-room');
    const ruler = ensure(this.#root as unknown as Element, 'div', 'uav-ruler');
    ruler.setAttribute('aria-hidden', 'true');
    this.#ruler = NUMBER_FITS.map((fit) => { const el = ruler.appendChild(document.createElement('div')); el.className = 'uav-number'; el.dataset.fit = fit; return el; });
  }

  /** The view spec. A property wins over the JSON in a child script. */
  get spec(): Spec | undefined { return this.#given.spec as Spec | undefined; }
  set spec(v: Spec | undefined) { this.#set('spec', v); }
  /** What the spec's query returned. */
  get result(): Result | undefined { return this.#given.result as Result | undefined; }
  set result(v: Result | undefined) { this.#set('result', v); }
  get catalog(): Catalog | undefined { return this.#given.catalog as Catalog | undefined; }
  set catalog(v: Catalog | undefined) { this.#set('catalog', v); }
  /** The rule set of the context this container is in. Missing fields fall back to CONTAINER_RULES. */
  get rules(): Partial<ContainerRules> | undefined { return this.#given.rules as Partial<ContainerRules> | undefined; }
  set rules(v: Partial<ContainerRules> | undefined) { this.#set('rules', v); }
  /** The inputs, as many as are named, set at once: a spec and its result that reach the view in one step are never
   * painted one without the other. An input left out keeps what it had. */
  get inputs(): Inputs { return { ...this.#given } as Inputs; }
  set inputs(v: Inputs) { for (const name of INPUTS) if (Object.hasOwn(v ?? {}, name)) this.#set(name, v[name]); }

  connectedCallback(): void {
    // A property set before the element was defined sits on the instance and hides the accessor.
    for (const name of INPUTS) if (Object.hasOwn(this, name)) { const v = this[name]; delete this[name]; this.#set(name, v); }
    if (Object.hasOwn(this, 'inputs')) { const v = this.inputs; delete (this as Partial<UaView>).inputs; this.inputs = v; }
    this.#children.observe(this, { childList: true, characterData: true, subtree: true });
    for (const el of [this.#room, ...this.#ruler]) this.#sizes?.observe(el);
    this.#queue();
  }
  disconnectedCallback(): void {
    this.#children.disconnect(); this.#sizes?.disconnect();
    if (this.#frame) { cancelAnimationFrame(this.#frame); this.#frame = 0; }
    // A readout left showing listens for a scroll on the window, and would hold the view there until one came.
    hideReadout(readoutOf(this.#fig));
  }
  // No input changed, so nothing moves. The paint builds or drops the table, and the measured pass that follows it reads what now shows.
  attributeChangedCallback(): void { this.#queue(); }

  #set(name: Input, v: unknown): void { this.#given[name] = v ?? undefined; this.#changed = true; this.#queue(); }
  // Inputs set one after another paint once.
  #queue(): void {
    if (this.#queued || !this.isConnected) return;
    this.#queued = true;
    queueMicrotask(() => { this.#queued = false; if (this.isConnected) this.#render(); });
  }

  #input(name: Input, required: boolean): unknown {
    let v = this.#given[name];
    if (v === undefined) {
      const script = this.querySelector(':scope > script[type="application/json"][data-for="' + name + '"]');
      if (script) try { v = JSON.parse(script.textContent || ''); } catch (e) {
        throw new Error('The JSON in <script data-for="' + name + '"> does not parse (' + (e as Error).message + '). Correct it, or set the ' + name + ' property.');
      }
    }
    if (v === undefined) { if (required) throw new Error('This view has no ' + name + '. ' + how(name)); return undefined; }
    if (!isObject(v)) throw new Error('The ' + name + ' must be ' + SHAPE[name] + '. ' + how(name));
    return v;
  }

  #render(): void {
    const changed = this.#changed;
    this.#changed = false;
    let painting = false;
    try {
      const spec = this.#input('spec', true) as Spec, result = this.#input('result', true) as Result, catalog = this.#input('catalog', true) as Catalog;
      const rules = rulesOver(this.#input('rules', false) as Partial<ContainerRules> | undefined);
      check(spec, result, catalog);
      if (!Array.isArray(rules.fit)) throw new Error('The rules need "fit", an array of fit rules. Leave it out to use the defaults.');
      if (!Array.isArray(rules.order)) throw new Error('The rules need "order", a list of reductions such as ["drop-guides", "prose"]. Leave it out to use the defaults.');
      // Painters registered since this module loaded, for custom marks: their styles, extras and rules join the rest.
      const doc = this.ownerDocument, more = Object.values(LAYOUTS).filter((p) => !painters.includes(p)), fits = [...rules.fit, ...painters.concat(more).flatMap((p) => p.rules?.(rules) ?? [])];
      const fit = sheet(doc, compileFitRules(fits, { ...EXTRAS, ...Object.fromEntries(more.map((p) => [p.layout, p.fit ?? {}])) }));
      const plan = resolve(spec, result, { ...unboundedContainer(), rules }, catalog);
      const scene = buildScene(plan, spec.query, result, catalog), fig = this.#fig;

      painting = true;
      this.#root.adoptedStyleSheets = [sheet(doc, BASE_CSS), sheet(doc, FALLBACK_CSS), ...more.map((p) => sheet(doc, '@layer uav {' + p.css + '}')), fit];
      fig.dataset.layout = scene.layout; fig.dataset.keep = (spec.keep || []).join(' '); fig.dataset.parts = scene.parts.join(' ');
      if (spec.title) fig.setAttribute('aria-label', spec.title); else fig.removeAttribute('aria-label');
      // The plot's natural heights are the context's, read by the stylesheet. The painter hard-codes neither.
      fig.style.setProperty('--uav-axes-height', rules.axes.height + 'px'); fig.style.setProperty('--uav-bare-height', rules.bare.height + 'px');
      begin(fig, changed && this.#layout === scene.layout);
      this.#prose.textContent = plan.text;
      for (const el of [this.#number, ...this.#ruler]) paintNumber(el, scene.nodes.filter((n) => n.part === 'number'));
      if (this.#layout !== scene.layout) { this.#body.replaceChildren(); this.#body.removeAttribute('data-scale'); this.#layout = scene.layout; }
      const painter = painterOf(scene.layout), data = { layers: plan.layers, query: expand(spec).query, result, catalog };
      painter?.paint(this.#body, scene, rules, data);
      pixels(fig);
      // Only while it shows: nothing reads a hidden table, and it is a row per row of the result.
      if (!this.hasAttribute('table')) this.#table.replaceChildren();
      else if (painter?.table) painter.table(this.#table, spec.title, scene, data); else paintTable(this.#table, spec.title, data.query, result, catalog, plan.layers);
      this.#keys.paint(scene, expand(spec).query, result, catalog, plan.layers);
      const swap = fallbackRule(fits, scene.layout, spec.keep, this.via), { layers: _layers, ...rest } = spec;
      if (swap) Object.assign(this.#fallback ??= this.#root.appendChild(Object.assign(document.createElement(this.localName) as UaView, { className: 'uav-fallback' })),
        { via: this.via.concat(scene.layout), spec: { ...rest, use: swap.fallback }, result, catalog, rules });
      else { this.#fallback?.remove(); this.#fallback = null; }
      fig.hidden = false; this.#error.hidden = true;
      settle(fig);
      // At once, not a frame later: new data is never shown unfitted. This is not an observer's callback, so nothing
      // it writes is reported as a loop. A frame already asked for reads the same sizes after it and writes nothing.
      if (this.#sizes) this.#measure(true);
    } catch (e) {
      // A parser still on the page has not handed over every child, so a missing or half-written one is not yet a mistake.
      const doc = this.ownerDocument;
      if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', () => this.#queue(), { once: true }); return; }
      // Never out of a lifecycle callback: the view says what is wrong where it would have drawn.
      // Inputs refused before anything was written leave the last view whole: it stays drawn, with what is wrong under it.
      const kept = !painting && this.#layout != null && !this.#fig.hidden;
      if (!kept) { this.#root.adoptedStyleSheets = [sheet(doc, BASE_CSS)]; this.#fallback?.remove(); this.#fallback = null; }
      this.#error.textContent = e instanceof Error ? e.message : String(e);
      this.#fig.hidden = !kept; this.#error.hidden = false;
    }
  }

  /* The measured pass: after each paint, and in the frame after the room or the ruler changes size. It reads sizes
   * and writes data-fit, on the number for its size and forms and on the figure for the prose rung, then hands the
   * body to its layout. Nothing it reads depends on what it writes, so one run settles it. */
  #measure(painted: boolean): void {
    pixels(this.#fig);
    const box = this.#room.getBoundingClientRect(), room = { inline: box.width, block: box.height || null }, sizes = readNumber(this.#ruler);
    const seen = JSON.stringify([room, sizes]);
    if (!painted && seen === this.#seen) return;
    this.#seen = seen;
    const fig = this.#fig, number = this.#number, body = this.#body;
    // Whether the number shows, and where, is the stylesheet's to say, and under the prose it has no box to read.
    // ponytail: so a view that is prose is laid out twice in a run. Keep both in the flow, hidden, if that ever costs.
    fig.removeAttribute('data-fit');
    const note = number.querySelector<HTMLElement>(':scope > .uav-f-tick');
    if (note) note.hidden = false;
    let fit: string | null = null, prose = false;
    if (number.getClientRects().length) {
      const beside = body.getClientRects().length > 0 && body.offsetTop < number.offsetTop + number.offsetHeight;
      if (beside) {
        // Beside the marks the layout's own rules set the number, so it is measured as it stands. A note that
        // makes it taller than the box is given up before the number is, as fitNumber does for a number alone.
        // It is read as the room is, in the page's px: offsetWidth is in the element's own, and under a transform the two differ.
        number.removeAttribute('data-fit');
        const size = () => number.getBoundingClientRect(), tall = () => room.block != null && size().height > room.block;
        if (note && tall()) note.hidden = true;
        prose = size().width > room.inline || tall();
      } else { fit = fitNumber(room, sizes); prose = fit == null; }
    }
    attr(number, 'data-fit', fit);
    // A number still wider than its screen in the form it stands in is one the pointer runs past (dots.ts).
    // The run's own box, and not what scrolls: the last slot's spare column hangs past the run and is no part of the number.
    for (const screen of number.querySelectorAll('.uav-glyphs')) screen.toggleAttribute('data-over', (screen.firstElementChild?.getBoundingClientRect().width ?? 0) > screen.getBoundingClientRect().width + 0.5);
    if (prose) fig.setAttribute('data-fit', 'prose'); else if (this.#layout) LAYOUTS[this.#layout]?.measure?.(body, room);
  }
}

/** Define <ua-view>, once. Called by the page, not at import, so a page can be ready for it first. */
export function defineUaView(): void {
  if (customElements.get('ua-view')) return;
  register();
  customElements.define('ua-view', UaView);
}
