import type { Layer, Spec } from '@universal-analytics/core';
import { UaView, defineUaView, surfaceSheet } from '@universal-analytics/dom';
import type { Scenario } from '@universal-analytics/fixtures';
import { catalog, runQuery, sections } from './sidebar-data.ts';

/* The sidebar: a mock-up of the panel a browser opens beside a page, rebuilt from the grammar. The page here is
 * the surface. It owns the chrome, the range, each card's comparison and the titles; every picture is a <ua-view>
 * handed a spec and a result. */
defineUaView();
document.adoptedStyleSheets.push(surfaceSheet());

const root = document.documentElement;
const controls = document.querySelector<HTMLFormElement>('#controls')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
/** A button that is on or off, or one of a set. */
function toggle(parent: Element, text: string, pressed: boolean, cls = ''): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button'; b.setAttribute('aria-pressed', String(pressed));
  parent.append(b);
  return b;
}
/** A set of buttons of which one is pressed. */
function choice(parent: Element, cls: string, options: string[], initial: string, locked: string[] = []): () => string {
  const group = el('div', cls); group.setAttribute('role', 'group');
  let value = initial;
  for (const o of options) {
    const b = toggle(group, o, o === value);
    if (locked.includes(o)) { b.disabled = true; b.title = 'Not in this plan'; continue; }
    b.addEventListener('click', () => { value = o; for (const c of group.children) c.setAttribute('aria-pressed', String(c === b)); update(); });
  }
  parent.append(group);
  return () => value;
}

const line = (title: string, metric: string): Spec => ({ spec: 'view/0', title, use: 'line', query: { metrics: [metric], by: ['date.day'] } });
/** A tile's trend: the `line` preset written out, with the line and its fill painted by which way the metric went. */
const trend = (title: string, metric: string): Spec => {
  const encode = { x: 'date.day', y: metric };
  return { spec: 'view/0', title, query: { metrics: [metric], by: ['date.day'] }, layers: [{ mark: 'area', encode, role: 'context', paint: 'delta' },
    { mark: 'line', encode, series: 'previous', role: 'comparison' }, { mark: 'line', encode, paint: 'delta' }] };
};
/** A ranked list, written as layers: `color` paints its rows by a field, and with a comparison each row says its change. */
const list = (title: string, metric: string, by: string, color?: string) => (compare: boolean): Spec => {
  const text = (extra: Partial<Layer> = {}): Layer => ({ mark: 'text', encode: { y: by, text: metric }, align: 'end', ...extra });
  return { spec: 'view/0', title, query: { metrics: [metric], by: [by] }, layers: [{ mark: 'bar', encode: { y: by, x: metric, ...(color && { color }) } }, { mark: 'text', encode: { y: by, text: by } }, text(), ...(compare ? [text({ series: 'delta' })] : [])] };
};
/** How far down the page readers get: the share still reading at each depth, with a rule where each part of the page starts. */
const depth = (): Spec => ({ spec: 'view/0', title: 'How far people read', query: { metrics: ['reached'], by: ['depth'] }, layers: [
  { mark: 'area', encode: { x: 'depth', y: 'reached' }, role: 'context' }, { mark: 'line', encode: { x: 'depth', y: 'reached' }, series: 'previous', role: 'comparison' }, { mark: 'line', encode: { x: 'depth', y: 'reached' } },
  ...sections().slice(1, -1).map(({ name, at }): Layer => ({ mark: 'rule', encode: { x: at }, label: name, role: 'reference' }))] });

/* Every view in the panel: its spec, given whether its card compares, and that card's switch. */
const mounted: { view: UaView; spec: (compare: boolean) => Spec; compare: () => boolean }[] = [];
function card(parent: Element, title: string, spec: (compare: boolean) => Spec, compare: boolean | (() => boolean), cls = 'ua-stack'): void {
  const box = el('article', 'card'), head = el('header'), body = el('div', cls), view = new UaView();
  head.append(el('h3', '', title));
  let on = compare;
  if (typeof compare === 'boolean') {
    const chip = toggle(head, 'previous period', compare, 'chip');
    chip.addEventListener('click', () => { on = chip.getAttribute('aria-pressed') !== 'true'; chip.setAttribute('aria-pressed', String(on)); update(); });
  }
  view.catalog = catalog;
  body.append(view); box.append(head, body); parent.append(box);
  mounted.push({ view, spec, compare: () => (typeof on === 'function' ? on() : on) });
}

const panel = document.getElementById('panel')!, head = el('header', 'top');
head.append(el('b', '', 'Analytics'));
// ponytail: the scope and the tab are the chrome's shape only. The fixture is one page's trends, so neither changes a query.
choice(head, 'segmented', ['This page', 'Whole site'], 'This page');
panel.append(head);
choice(panel, 'tabs', ['Now', 'Trends'], 'Trends');
const days = choice(panel, 'chips', ['7 days', '30 days', '90 days'], '30 days', ['90 days']);

const bar = el('div', 'bar'), tilesChip = toggle(bar, 'previous period', true, 'chip');
tilesChip.addEventListener('click', () => { tilesChip.setAttribute('aria-pressed', String(tilesChip.getAttribute('aria-pressed') !== 'true')); update(); });
const tiles = el('div', 'tiles');
panel.append(bar, tiles);
for (const [metric, def] of Object.entries(catalog.metrics).filter(([m]) => m !== 'views' && m !== 'reached'))
  card(tiles, def.label, () => trend(def.label, metric), () => tilesChip.getAttribute('aria-pressed') === 'true', 'ua-row');

// Written by whoever writes the summary, an editor or an agent. It is the surface's, and no view made it.
const changed = el('article', 'card');
changed.append(el('h3', '', 'What changed'), Object.assign(el('p'), { innerHTML: 'Visits are up <b>12%</b>, mostly from Google after the <b>July</b> update. Fewer people finish the page: drop-off moved to "Where to stay", which got longer on <b>Sept 20</b>.' }));
panel.append(changed);

card(panel, 'Views per day', () => line('Views per day', 'views'), true);
card(panel, 'How far people read', depth, false);
card(panel, 'Where readers come from', list('Where readers come from', 'visitors', 'source', 'source@kind'), false);
card(panel, 'Subscribers came from', list('Subscribers came from', 'new_subscribers', 'origin'), false);

const state = () => { const f = new FormData(controls); return { scenario: f.get('scenario') as Scenario, theme: String(f.get('theme')) }; };
function update() {
  const s = state(), range = parseInt(days()) + 'd';
  if (s.theme) root.dataset.theme = s.theme; else delete root.dataset.theme;
  for (const m of mounted) {
    const spec = m.spec(m.compare()), query = { ...spec.query, range, ...(m.compare() ? { compare: 'previous' as const } : {}) };
    m.view.spec = { ...spec, query }; m.view.result = runQuery(query, s.scenario);
  }
}
controls.addEventListener('change', update);
update();
