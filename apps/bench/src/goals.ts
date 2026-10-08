import type { Spec } from '@universal-analytics/core';
import { UaView, defineUaView, registerPainter, surfaceSheet } from '@universal-analytics/dom';
import type { Scenario } from '@universal-analytics/fixtures';
import '@universal-analytics/fixtures';   // loading the fixtures hands the geo mark its boundary shapes
import { geoPainter } from '@universal-analytics/geo/dom';
import { SITES, catalog, runQuery } from './goals-data.ts';
import { GOALS, METRICS, type Card } from './goals-views.ts';

/* The goals page: a dashboard for each of the seventeen goals a plan can have, to see whether the grammar holds up
 * across real cases. The page is the surface: it owns the titles, the grid, the range and the data state. Every
 * picture is a <ua-view> handed a spec, a result and the catalog, and nothing else: no view is styled or reached into. */
defineUaView();
registerPainter(geoPainter);
document.adoptedStyleSheets.push(surfaceSheet());

const root = document.documentElement, main = document.getElementById('goal')!;
const controls = document.querySelector<HTMLFormElement>('#controls')!, picker = controls.querySelector('select')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
GOALS.forEach((g, i) => picker.append(new Option((i + 1) + '. ' + g.name, g.id)));
const params = new URLSearchParams(location.search);
for (const [k, v] of params) { const input = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`); if (input) input.checked = true; }
if (GOALS.some((g) => g.id === params.get('goal'))) picker.value = params.get('goal')!;
const state = () => { const f = new FormData(controls); return { goal: String(f.get('goal')), scenario: f.get('scenario') as Scenario, range: String(f.get('range')), theme: String(f.get('theme')), table: f.has('table'), config: f.has('config') }; };

/* Every view on the page, with its spec, where to say what went wrong with it, and where the spec is written out. */
let mounted: { view: UaView; spec: Spec; note: HTMLElement; config: HTMLElement }[] = [];
function mount(parent: Element, spec: Spec, layout: string): void {
  const body = el('div', layout), view = new UaView(), note = el('p', 'meta error'), config = el('pre', 'config');
  view.catalog = catalog;
  body.append(view); parent.append(body, note, config);
  mounted.push({ view, spec, note, config });
}
function card(parent: Element, metric: string, { spec, wide, gap }: Card): void {
  const box = el('article', 'card' + (wide ? ' wide' : '')), label = el('small');
  label.append(el('span', '', metric));
  if (METRICS[metric]!.later) label.append(el('span', 'later', 'later'));
  box.append(label, el('h3', '', spec.title));
  mount(box, spec, 'ua-stack');
  if (gap) box.append(el('p', 'gap', gap));
  parent.append(box);
}

/** The dashboard for one goal: the numbers that head it, its headline metrics, and what is also shown. */
function build(id: string): void {
  const goal = GOALS.find((g) => g.id === id)!, head = el('header'), tiles = el('div', 'tiles');
  mounted = [];
  head.append(el('h1', '', goal.name), el('p', '', goal.success + ' · ' + goal.kinds + ' · ' + SITES[id]!.name));
  // The dashboard's own config: the goal, as the plan's table has it. Each metric it names is the views below.
  head.append(el('pre', 'config', JSON.stringify(goal, null, 2)));
  main.replaceChildren(head, tiles);
  // A tile is a trend in a small box: the box leaves it the number and a sparkline. What is present now has no trend.
  for (const metric of new Set([...goal.headline, ...goal.also].map((m) => METRICS[m]!.tile).filter((m) => m != null))) {
    const box = el('article', 'card'), instant = catalog.metrics[metric]!.instant;
    box.append(el('h3', '', catalog.metrics[metric]!.label));
    mount(box, instant ? { spec: 'view/0', query: { metrics: [metric] } } : { spec: 'view/0', use: 'line', query: { metrics: [metric], by: ['date.day'], range: '28d', compare: 'previous' } }, 'ua-row');
    tiles.append(box);
  }
  for (const [title, metrics] of [['Headline metrics', goal.headline], ['Also shown', goal.also]] as const) {
    const board = el('div', 'board');
    main.append(el('h2', '', title), board);
    for (const m of metrics) for (const c of METRICS[m]!.cards) card(board, m, c);
  }
}

let built = '';
function update(): void {
  const s = state();
  if (s.theme) root.dataset.theme = s.theme; else delete root.dataset.theme;
  history.replaceState(null, '', '?' + new URLSearchParams({ goal: s.goal, scenario: s.scenario, range: s.range, theme: s.theme, ...(s.table ? { table: 'on' } : {}), ...(s.config ? { config: 'on' } : {}) }));
  main.classList.toggle('show-config', s.config);
  if (built !== s.goal) build(built = s.goal);
  for (const m of mounted) {
    const spec = m.spec.query.range ? { ...m.spec, query: { ...m.spec.query, range: s.range } } : m.spec;
    m.view.toggleAttribute('table', s.table);
    m.config.textContent = JSON.stringify(spec, null, 2);
    // A spec the grammar refuses is still handed over, and the engine's refusal is said under it: every error names its fix.
    try { m.note.textContent = ''; m.view.spec = spec; m.view.result = runQuery(spec.query, s.scenario, SITES[s.goal]); } catch (e) { m.note.textContent = (e as Error).message; }
  }
}
controls.addEventListener('change', update);
update();
