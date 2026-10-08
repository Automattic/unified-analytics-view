import { CONTAINER_RULES, buildScene, expand, formatDimension, formatValue, resolve, unboundedContainer } from '@universal-analytics/core';
import type { Catalog, ContainerRules, Layout, Query, Result, Row, SceneNode, Spec } from '@universal-analytics/core';
import { compileFitRules, type FitExtras } from './compile.ts';
import { attr, ensure, keyed, paintVar, text } from './dom.ts';
import { KEYS_CSS, Keys } from './keys.ts';
import { LAYOUTS } from './layouts/index.ts';
import { NUMBER_FITS, fitNumber, readNumber } from './measure.ts';
import { MOTION_CSS, begin, register, settle } from './motion.ts';

/* <ua-view>: one view, in whatever room it is handed. It plans once per data change, for a container with no
 * limits, builds the ratio scene and paints it. The stylesheet fits it. On resize only the measured pass runs
 * (measure.ts), a frame later, for what a stylesheet cannot see. Where there is no ResizeObserver, or no
 * requestAnimationFrame, the stylesheet stands alone.
 * The host is the `view` container. By default it fills the width and takes its natural height; a surface
 * layout that hands out a box makes it `container-type: size`, and the body fills what is left. */

const painters = Object.values(LAYOUTS);

/* Everything the element owns, in one layer, so a compiled fit rule beats it whatever the specificity. */
const BASE_CSS = `@layer vg {
:host { display: block; container: view / inline-size; font-size: 11px; line-height: 1.3; color: ${paintVar('ink')}; }
:host([hidden]), [hidden] { display: none !important; }
.vg { position: relative; box-sizing: border-box; block-size: 100%; margin: 0; display: grid; grid-template: "number" auto "body" minmax(0, 1fr) / minmax(0, 1fr); }
.vg-prose { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.vg-body { grid-area: body; box-sizing: border-box; min-inline-size: 0; block-size: var(--vg-body-block, auto); }
.vg-error { margin: 0; font-size: 13px; overflow-wrap: anywhere; color: ${paintVar('delta.bad')}; }

.vg-f-tick { font-size: 11px; }
.vg-f-label { font-size: 13px; }
.vg-f-value { font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; }
.vg-f-display { font-size: 37px; line-height: 34px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

/* The number: a value, then a delta and a note, each on its own line. It is in every scene and shows when the
 * plan names it or a fit rule brings it in. */
.vg-number { grid-area: number; display: none; white-space: nowrap; }
.vg[data-parts~="number"] .vg-number { display: block; }
.vg[data-parts~="number"]:not([data-layout="none"]) .vg-number { margin-block-end: 16px; }
.vg-number > * { color: var(--vg-paint); }
.vg-number > b { display: inline-block; vertical-align: middle; }
.vg-number > span { display: block; line-height: 18px; overflow: hidden; text-overflow: ellipsis; }
.vg-number > .vg-f-tick { line-height: 16px; }
.vg-pulse { display: inline-block; vertical-align: middle; inline-size: 10px; block-size: 10px; margin-inline: 2px 8px; border-radius: 50%; background: var(--vg-paint); }
.vg-short { display: none; }
/* What the measured pass found, as data-fit on the number: its size, its forms, and whether its note fits. */
.vg-number[data-fit~="short"] > .vg-f-display > .vg-full, .vg-number[data-fit~="delta-short"] > .vg-f-value > .vg-full { display: none; }
.vg-number[data-fit~="short"] > .vg-f-display > .vg-short, .vg-number[data-fit~="delta-short"] > .vg-f-value > .vg-short { display: inline; }
.vg-number[data-fit~="small"] > .vg-f-display { font-size: 26px; line-height: 24px; }
.vg-number[data-fit~="no-note"] > .vg-f-tick { display: none; }
/* A number the pass has not set carries no data-fit: one beside a bare plot, which its layout sets, or any number
 * where the pass does not run. For that one the widths at which place() takes the shorter forms stand in. */
@container view (inline-size < 200px) { .vg-number:not([data-fit]) > .vg-f-value > .vg-full { display: none; } .vg-number:not([data-fit]) > .vg-f-value > .vg-short { display: inline; } }
@container view (inline-size < 160px) {
  .vg-number:not([data-fit]) > .vg-f-display > .vg-full { display: none; } .vg-number:not([data-fit]) > .vg-f-display > .vg-short { display: inline; }
  .vg-number:not([data-fit]) > .vg-f-display { font-size: 26px; line-height: 24px; }
}
@container view (inline-size < 120px) { .vg-number:not([data-fit]) > .vg-f-tick { display: none; } }

/* What the measured pass reads. The room takes the view's width, and its height only when the view was handed a
 * box, so nothing the pass writes can resize it. The ruler holds the number set in each of its forms, clipped to
 * nothing so that it adds no overflow, and outside the figure so that no fit rule reaches it. */
.vg-room { position: absolute; inset-inline: 0; inset-block-start: 0; block-size: 0; visibility: hidden; pointer-events: none; }
@container view (block-size >= 0px) { .vg-room { block-size: 100%; } }
.vg-ruler { position: absolute; inline-size: 0; block-size: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.vg-ruler > .vg-number { display: block; position: absolute; inline-size: max-content; }
.vg-ruler > .vg-number > span { inline-size: max-content; }

${painters.map((p) => p.css).join('\n')}
${MOTION_CSS}
${KEYS_CSS}

/* Only a size container answers a block-size query, so this matches exactly when a layout has handed the view a
 * box. The body then takes the height left over. No attribute on the view. */
@container view (block-size >= 0px) { .vg-body { block-size: auto; } }

/* The prose alone: the last rung, set by the plan or, when the number itself does not fit, by the measured pass. */
.vg:is([data-layout="prose"], [data-fit="prose"]) > :not(.vg-prose, .vg-room) { display: none !important; }
.vg:is([data-layout="prose"], [data-fit="prose"]) > .vg-prose { position: static; inline-size: auto; block-size: auto; clip-path: none; white-space: normal; font-size: 13px; }

/* The same result as a table, in place of the marks. The switch is public: the surface that offers it is outside the shadow root. */
.vg-table { display: none; inline-size: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
.vg-table :is(th, td) { padding: 2px 8px 2px 0; text-align: start; font-weight: 400; border-block-end: 1px solid ${paintVar('grid')}; }
.vg-table :is(thead th, tfoot td, tfoot th) { font-weight: 600; }
.vg-table [data-num] { text-align: end; padding-inline: 8px 0; }
:host([table]) .vg > :not(.vg-table, .vg-prose, .vg-room) { display: none !important; }
:host([table]) .vg { display: block; overflow: auto; }
:host([table]) .vg-table { display: table; }
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
const sheets = new Map<string, CSSStyleSheet>();
function sheet(css: string): CSSStyleSheet {
  let s = sheets.get(css);
  if (!s) { s = new CSSStyleSheet(); s.replaceSync(css); sheets.set(css, s); }
  return s;
}

const INPUTS = ['spec', 'result', 'catalog', 'rules'] as const;
type Input = (typeof INPUTS)[number];
const SHAPE: Record<Input, string> = {
  spec: 'an object with a "query"', result: 'an object with "rows", "totals" and "meta"',
  catalog: 'an object with "metrics" and "dimensions"', rules: 'an object like CONTAINER_RULES',
};
const how = (name: Input) => 'Set the ' + name + ' property, or put <script type="application/json" data-for="' + name + '"> inside the element.';
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/* The input is checked here because resolve() trusts its catalog and result, and its failures would not name a fix. */
function check(spec: Spec, result: Result, catalog: Catalog): void {
  if (!isObject(spec.query)) throw new Error('The spec has no "query". Add one, for example { "metrics": ["visitors"], "by": ["date.day"] }.');
  if (!Array.isArray(result.rows) || !isObject(result.totals) || !isObject(result.meta)) throw new Error('The result needs "rows" (an array), "totals" and "meta". Pass what the query returned, whole.');
  if (!isObject(catalog.metrics) || !isObject(catalog.dimensions)) throw new Error('The catalog needs "metrics" and "dimensions". Pass the catalog the query was run against.');
  const q = spec.query;
  (Array.isArray(q.metrics) ? q.metrics : []).forEach((m) => { if (!catalog.metrics[m]) throw new Error('The catalog has no metric "' + m + '". It has: ' + (Object.keys(catalog.metrics).join(', ') || 'none') + '. Pass the catalog the query was run against.'); });
  (Array.isArray(q.by) ? q.by : []).forEach((d) => { if (!catalog.dimensions[d]) throw new Error('The catalog has no dimension "' + d + '". It has: ' + (Object.keys(catalog.dimensions).join(', ') || 'none') + '. Pass the catalog the query was run against.'); });
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
function paintTable(table: HTMLTableElement, title: string | undefined, q: Query, result: Result, catalog: Catalog): void {
  const by = q.by || [], prev = q.compare === 'previous';
  // A companion the engine returned with a metric has a column after it, under its suffix. With two dimensions the table is a pivot, and has none.
  const more = (m: string) => (by.length === 2 ? [] : Object.keys(result.rows[0] ?? {}).filter((f) => f.startsWith(m + '@') && f !== m + '@previous'));
  const fields = q.metrics.flatMap((m) => [m, ...(prev ? [m + '@previous'] : []), ...more(m)]);
  const label = (f: string) => { const [m, of] = f.split('@'); return catalog.metrics[m!]!.label + (of == null ? '' : ', ' + (of === 'previous' ? 'previous period' : of)); };
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
  const value = (v: Row[string], f: string) => formatValue(v as number | null, catalog.metrics[f.split('@')[0]!]!, 'exact');
  const body = table.createTBody(), totals = fields.map((f): [string, 'td', boolean] => [value(result.totals[f], f), 'td', true]);
  for (const r of result.rows) row(body, [...by.map((d): [string, 'th'] => [formatDimension(r[d], catalog.dimensions[d]!), 'th']), ...fields.map((f): [string, 'td', boolean] => [value(r[f], f), 'td', true])]);
  if (!by.length) row(body, totals);
  else row(table.createTFoot(), [['Total', 'th'], ...by.slice(1).map((): [string, 'td'] => ['', 'td']), ...totals]);
}

function paintNumber(el: HTMLElement, nodes: SceneNode[]): void {
  keyed(el, nodes, (n) => (n.kind === 'circle' ? 'i' : n.kind === 'text' && n.font === 'display' ? 'b' : 'span'), (c, n) => {
    if (n.kind === 'text') text(c, n); else c.classList.add('vg-pulse');
  });
}

// Importing this where there is no document, as a test or a server template does, must not throw.
const Base = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

export class UaView extends Base {
  #given: Partial<Record<Input, unknown>> = {};
  #queued = false;
  #layout: Layout | null = null;
  #root: ShadowRoot; #fig: HTMLElement; #prose: HTMLElement; #number: HTMLElement; #body: HTMLElement; #table: HTMLTableElement; #error: HTMLElement;
  #room: HTMLElement; #ruler: HTMLElement[]; #seen = '';
  #keys: Keys;
  #frame = 0;
  // The one observer of the measured pass. It watches the room and the ruler, whose sizes nothing it writes can change.
  // It only asks for a frame. A write in its callback can resize something the page observes, and the browser then
  // reports a "ResizeObserver loop" error to the page's window. So a view that crosses a threshold paints one frame
  // in the old state. However many callbacks come before the frame, it reads once, then, and writes once.
  #sizes = globalThis.ResizeObserver && typeof requestAnimationFrame === 'function'
    ? new ResizeObserver(() => { this.#frame ||= requestAnimationFrame(() => { this.#frame = 0; this.#measure(false); }); }) : null;
  // Markup can arrive after the element does, when a parser is still streaming its children.
  #children = new MutationObserver(() => this.#queue());

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#fig = ensure(this.#root as unknown as Element, 'figure', 'vg');
    this.#prose = ensure(this.#fig, 'figcaption', 'vg-prose');
    this.#prose.id = 'prose'; this.#fig.setAttribute('aria-describedby', 'prose');
    this.#number = ensure(this.#fig, 'div', 'vg-number');
    this.#body = ensure(this.#fig, 'div', 'vg-body');
    this.#table = ensure(this.#fig, 'table', 'vg-table');
    this.#keys = new Keys(this, this.#fig, this.#body);
    this.#error = ensure(this.#root as unknown as Element, 'p', 'vg-error');
    this.#error.setAttribute('role', 'alert'); this.#error.hidden = true;
    this.#room = ensure(this.#fig, 'div', 'vg-room');
    const ruler = ensure(this.#root as unknown as Element, 'div', 'vg-ruler');
    ruler.setAttribute('aria-hidden', 'true');
    this.#ruler = NUMBER_FITS.map((fit) => { const el = ruler.appendChild(document.createElement('div')); el.className = 'vg-number'; el.dataset.fit = fit; return el; });
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

  connectedCallback(): void {
    // A property set before the element was defined sits on the instance and hides the accessor.
    for (const name of INPUTS) if (Object.hasOwn(this, name)) { const v = this[name]; delete this[name]; this.#set(name, v); }
    this.#children.observe(this, { childList: true, characterData: true, subtree: true });
    for (const el of [this.#room, ...this.#ruler]) this.#sizes?.observe(el);
    this.#queue();
  }
  disconnectedCallback(): void {
    this.#children.disconnect(); this.#sizes?.disconnect();
    if (this.#frame) { cancelAnimationFrame(this.#frame); this.#frame = 0; }
  }

  #set(name: Input, v: unknown): void { this.#given[name] = v ?? undefined; this.#queue(); }
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
    try {
      const spec = this.#input('spec', true) as Spec, result = this.#input('result', true) as Result, catalog = this.#input('catalog', true) as Catalog;
      const rules: ContainerRules = { ...CONTAINER_RULES, ...(this.#input('rules', false) as Partial<ContainerRules> | undefined) };
      check(spec, result, catalog);
      if (!Array.isArray(rules.fit)) throw new Error('The rules need "fit", an array of fit rules. Leave it out to use the defaults.');
      const fit = sheet(compileFitRules([...rules.fit, ...painters.flatMap((p) => p.rules ?? [])], EXTRAS));
      const plan = resolve(spec, result, { ...unboundedContainer(), rules }, catalog);
      const scene = buildScene(plan, spec.query, result, catalog), fig = this.#fig;

      this.#root.adoptedStyleSheets = [sheet(BASE_CSS), fit];
      fig.dataset.layout = scene.layout; fig.dataset.keep = (spec.keep || []).join(' '); fig.dataset.parts = scene.parts.join(' ');
      if (spec.title) fig.setAttribute('aria-label', spec.title); else fig.removeAttribute('aria-label');
      // The plot's natural heights are the context's, read by the stylesheet. The painter hard-codes neither.
      fig.style.setProperty('--vg-axes-height', rules.axes.height + 'px'); fig.style.setProperty('--vg-bare-height', rules.bare.height + 'px');
      begin(fig, this.#layout === scene.layout);
      this.#prose.textContent = plan.text;
      for (const el of [this.#number, ...this.#ruler]) paintNumber(el, scene.nodes.filter((n) => n.part === 'number'));
      if (this.#layout !== scene.layout) { this.#body.replaceChildren(); this.#body.removeAttribute('data-scale'); this.#layout = scene.layout; }
      const painter = LAYOUTS[scene.layout], data = { layers: plan.layers, query: expand(spec).query, result, catalog };
      painter?.paint(this.#body, scene, rules, data);
      if (painter?.table) painter.table(this.#table, spec.title, scene, data); else paintTable(this.#table, spec.title, data.query, result, catalog);
      this.#keys.paint(scene, expand(spec).query, result, catalog);
      fig.hidden = false; this.#error.hidden = true;
      settle(fig);
      // At once, not a frame later: new data is never shown unfitted. This is not an observer's callback, so nothing
      // it writes is reported as a loop. A frame already asked for reads the same sizes after it and writes nothing.
      if (this.#sizes) this.#measure(true);
    } catch (e) {
      // Never out of a lifecycle callback: the view says what is wrong where it would have drawn.
      this.#root.adoptedStyleSheets = [sheet(BASE_CSS)];
      this.#error.textContent = e instanceof Error ? e.message : String(e);
      this.#fig.hidden = true; this.#error.hidden = false;
    }
  }

  /* The measured pass: after each paint, and in the frame after the room or the ruler changes size. It reads sizes
   * and writes data-fit, on the number for its size and forms and on the figure for the prose rung, then hands the
   * body to its layout. Nothing it reads depends on what it writes, so one run settles it. */
  #measure(painted: boolean): void {
    const box = this.#room.getBoundingClientRect(), room = { inline: box.width, block: box.height || null }, sizes = readNumber(this.#ruler);
    const seen = JSON.stringify([room, sizes]);
    if (!painted && seen === this.#seen) return;
    this.#seen = seen;
    const fig = this.#fig, number = this.#number, body = this.#body;
    // Whether the number shows, and where, is the stylesheet's to say, and under the prose it has no box to read.
    // ponytail: so a view that is prose is laid out twice in a run. Keep both in the flow, hidden, if that ever costs.
    fig.removeAttribute('data-fit');
    const note = number.querySelector<HTMLElement>(':scope > .vg-f-tick');
    if (note) note.hidden = false;
    let fit: string | null = null, prose = false;
    if (number.getClientRects().length) {
      const beside = body.getClientRects().length > 0 && body.offsetTop < number.offsetTop + number.offsetHeight;
      if (beside) {
        // Beside the marks the layout's own rules set the number, so it is measured as it stands. A note that
        // makes it taller than the box is given up before the number is, as fitNumber does for a number alone.
        number.removeAttribute('data-fit');
        const tall = () => room.block != null && number.offsetHeight > room.block;
        if (note && tall()) note.hidden = true;
        prose = number.offsetWidth > room.inline || tall();
      } else { fit = fitNumber(room, sizes); prose = fit == null; }
    }
    attr(number, 'data-fit', fit);
    if (prose) fig.setAttribute('data-fit', 'prose'); else if (this.#layout) LAYOUTS[this.#layout]?.measure?.(body, room);
  }
}

/** Define <ua-view>, once. Called by the page, not at import, so a page can be ready for it first. */
export function defineUaView(): void {
  if (customElements.get('ua-view')) return;
  register();
  customElements.define('ua-view', UaView);
}
