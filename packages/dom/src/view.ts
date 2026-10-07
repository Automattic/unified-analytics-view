import { CONTAINER_RULES, buildScene, expand, resolve, unboundedContainer } from '@universal-analytics/core';
import type { Catalog, ContainerRules, Layout, Query, Result, SceneNode, Spec } from '@universal-analytics/core';
import { compileFitRules, type FitExtras } from './compile.ts';
import { ensure, keyed, paintVar, text } from './dom.ts';
import { LAYOUTS } from './layouts/index.ts';

/* <ua-view>: one view, in whatever room it is handed. It plans once per data change, for a container with no
 * limits, builds the ratio scene and paints it. Nothing here runs on resize: the stylesheet fits it.
 * The host is the `view` container. By default it fills the width and takes its natural height; a surface
 * layout that hands out a box makes it `container-type: size`, and the body fills what is left. */

const painters = Object.values(LAYOUTS);

/* Everything the element owns, in one layer, so a compiled fit rule beats it whatever the specificity. */
const BASE_CSS = `@layer vg {
:host { display: block; container: view / inline-size; font-size: 11px; line-height: 1.3; color: ${paintVar('ink')}; }
:host([hidden]), [hidden] { display: none !important; }
.vg { box-sizing: border-box; block-size: 100%; margin: 0; display: grid; grid-template: "number" auto "body" minmax(0, 1fr) / minmax(0, 1fr); }
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
/* ponytail: the widths at which place() takes the shorter forms. They stand in for measuring the number, which is the measured pass's job. */
@container view (inline-size < 200px) { .vg-f-value > .vg-full { display: none; } .vg-f-value > .vg-short { display: inline; } }
@container view (inline-size < 160px) {
  .vg-f-display > .vg-full { display: none; } .vg-f-display > .vg-short { display: inline; }
  .vg-number > .vg-f-display { font-size: 26px; line-height: 24px; }
}
@container view (inline-size < 120px) { .vg-number > .vg-f-tick { display: none; } }

${painters.map((p) => p.css).join('\n')}

/* Only a size container answers a block-size query, so this matches exactly when a layout has handed the view a
 * box. The body then takes the height left over. No attribute on the view. */
@container view (block-size >= 0px) { .vg-body { block-size: auto; } }

/* The prose alone: the last rung, set by the plan or, later, by the measured pass. */
.vg:is([data-layout="prose"], [data-fit="prose"]) > :not(.vg-prose) { display: none !important; }
.vg:is([data-layout="prose"], [data-fit="prose"]) > .vg-prose { position: static; inline-size: auto; block-size: auto; clip-path: none; white-space: normal; font-size: 13px; }

/* The same result as a table, in place of the marks. The switch is public: the surface that offers it is outside the shadow root. */
.vg-table { display: none; inline-size: 100%; border-collapse: collapse; font-size: 11px; font-variant-numeric: tabular-nums; }
.vg-table :is(th, td) { padding: 2px 8px 2px 0; text-align: start; font-weight: 400; border-block-end: 1px solid ${paintVar('grid')}; }
.vg-table :is(thead th, tfoot td, tfoot th) { font-weight: 600; }
.vg-table [data-num] { text-align: end; padding-inline: 8px 0; }
:host([table]) .vg > :not(.vg-table, .vg-prose) { display: none !important; }
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

const NF = new Intl.NumberFormat('en-US');
const cell = (v: unknown) => (v == null ? '–' : typeof v === 'number' ? NF.format(v) : String(v));
/* The table is rebuilt whole: nothing in it moves, so there is nothing to keep. Totals are the engine's, never a sum of the rows. */
function paintTable(table: HTMLTableElement, title: string | undefined, q: Query, result: Result, catalog: Catalog): void {
  const by = q.by || [], prev = q.compare === 'previous';
  const fields = q.metrics.flatMap((m) => (prev ? [m, m + '@previous'] : [m]));
  const label = (f: string) => { const m = f.replace('@previous', ''); return catalog.metrics[m]!.label + (f === m ? '' : ', previous period'); };
  const row = (parent: HTMLElement, cells: [text: string, tag: 'th' | 'td', num?: boolean][]) => {
    const tr = parent.appendChild(document.createElement('tr'));
    for (const [s, tag, num] of cells) { const c = tr.appendChild(document.createElement(tag)); c.textContent = s; if (num) c.setAttribute('data-num', ''); if (tag === 'th') c.scope = parent.tagName === 'THEAD' ? 'col' : 'row'; }
  };
  table.replaceChildren();
  if (title) table.createCaption().textContent = title;
  row(table.createTHead(), [...by.map((d): [string, 'th'] => [catalog.dimensions[d]!.label, 'th']), ...fields.map((f): [string, 'th', boolean] => [label(f), 'th', true])]);
  const body = table.createTBody(), totals = fields.map((f): [string, 'td', boolean] => [cell(result.totals[f]), 'td', true]);
  for (const r of result.rows) row(body, [...by.map((d): [string, 'th'] => [cell(r[d]), 'th']), ...fields.map((f): [string, 'td', boolean] => [cell(r[f]), 'td', true])]);
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
    this.#error = ensure(this.#root as unknown as Element, 'p', 'vg-error');
    this.#error.setAttribute('role', 'alert'); this.#error.hidden = true;
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
    this.#queue();
  }
  disconnectedCallback(): void { this.#children.disconnect(); }

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
      this.#prose.textContent = plan.text;
      paintNumber(this.#number, scene.nodes.filter((n) => n.part === 'number'));
      if (this.#layout !== scene.layout) { this.#body.replaceChildren(); this.#body.removeAttribute('data-scale'); this.#layout = scene.layout; }
      LAYOUTS[scene.layout]?.paint(this.#body, scene, rules);
      paintTable(this.#table, spec.title, expand(spec).query, result, catalog);
      fig.hidden = false; this.#error.hidden = true;
    } catch (e) {
      // Never out of a lifecycle callback: the view says what is wrong where it would have drawn.
      this.#root.adoptedStyleSheets = [sheet(BASE_CSS)];
      this.#error.textContent = e instanceof Error ? e.message : String(e);
      this.#fig.hidden = true; this.#error.hidden = false;
    }
  }
}

/** Define <ua-view>, once. Called by the page, not at import, so a page can be ready for it first. */
export function defineUaView(): void {
  if (customElements.get('ua-view')) return;
  // @property is ignored in a shadow root, so the ratios are registered on the document, which is why they carry a
  // prefix. Where this fails, values still apply and nothing animates.
  for (const name of ['--vg-x', '--vg-w', '--vg-v', '--vg-t']) {
    try { CSS.registerProperty({ name, syntax: '<number>', inherits: false, initialValue: '0' }); } catch { /* registered already, or unsupported */ }
  }
  customElements.define('ua-view', UaView);
}
