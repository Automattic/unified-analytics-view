import { resolve, unboundedContainer, type Spec } from '@universal-analytics/core';
import { UaView, defineUaView, surfaceSheet } from '@universal-analytics/dom';
import { catalog, runQuery, samples, type Scenario } from '@universal-analytics/fixtures';

/* The demo: one walk through what is built. Every view on the page is a <ua-view> handed a spec, a result and
 * the catalog. The page is the surface: it owns the range, the data state and the layout, and hands each view
 * its query, as a panel or a dashboard will. */
defineUaView();
document.adoptedStyleSheets.push(surfaceSheet());

const root = document.documentElement;
const controls = document.querySelector<HTMLFormElement>('#controls')!;
const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

const params = new URLSearchParams(location.search);
for (const [k, v] of params) { const input = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`); if (input) input.checked = true; }
const state = () => { const f = new FormData(controls); return { scenario: f.get('scenario') as Scenario, range: String(f.get('range')), theme: String(f.get('theme')), table: f.has('table') }; };

const S = (name: string) => samples[name]!.spec;
const VISITORS: Spec = { spec: 'view/0', title: 'Visitors', query: { metrics: ['visitors'], range: '28d', compare: 'previous' } };
const PAGEVIEWS: Spec = { spec: 'view/0', title: 'Page views', use: 'line', query: { metrics: ['pageviews'], by: ['date.day'], range: '28d', compare: 'previous' } };
/* A metric's colour is the surface's to give, keyed to the catalog's names and handed over as the first series
 * colour. No spec says it. A metric with none here takes the default, chartreuse, as visitors does. A view coloured
 * by its dimension, as a share bar is, keeps the whole set. */
const HUE: Record<string, string> = { pageviews: 'orange', present: 'grass' };
/** A view coloured by its rows, as a share bar and a ranked list are here, keeps the whole set. */
const hue = (spec: Spec) => (spec.use === 'share-bar' || spec.use === 'bar-list' ? undefined : HUE[spec.query?.metrics?.[0] ?? '']);

/* A ranked list with a colour per row. The scene gives every row the first series colour, at a fifth of its
 * strength, so this page reaches into each view's shadow root to say otherwise.
 * ponytail: a stopgap for the demo. The grammar's way is a `color` channel on the layer, which the scene would
 * turn into a series colour per row; nothing outside a view should be styling its insides. */
const rowColours = new CSSStyleSheet();
rowColours.replaceSync([1, 2, 3, 4, 5, 6].map((n) => `.uav-row:nth-child(6n+${n}) > i { --uav-paint: var(--a8c-charts-color-series-${n}) !important; }`).join('\n')
  + '\n.uav-row > i { opacity: var(--demo-row-opacity, .8) !important; }');

/** The surface's range goes into every query that has one. */
const ranged = (spec: Spec, range: string): Spec => (spec.query?.range ? { ...spec, query: { ...spec.query, range } } : spec);

/* Every view on the page, with where its spec comes from. */
const mounted: { view: UaView; spec: () => Spec }[] = [];
function mount(parent: Element, spec: Spec | (() => Spec)): UaView {
  const view = new UaView();
  view.catalog = catalog;
  parent.append(view);
  mounted.push({ view, spec: typeof spec === 'function' ? spec : () => spec });
  return view;
}

/* 1. The spec, edited in place. */
let hero: Spec = S('trend');
const editor = $<HTMLTextAreaElement>('spec'), note = $('spec-note'), picks = $('picks');
for (const [name, sample] of Object.entries(samples)) {
  const b = el('button', '', sample.label);
  b.type = 'button'; b.dataset.sample = name;
  b.addEventListener('click', () => { hero = sample.spec; editor.value = JSON.stringify(hero, null, 2); update(); });
  picks.append(b);
}
editor.value = JSON.stringify(hero, null, 2);
editor.addEventListener('input', () => {
  try { hero = JSON.parse(editor.value); } catch (e) { note.className = 'note error'; note.textContent = 'Not JSON yet: ' + (e as Error).message; return; }
  update();
});
mount($('hero'), () => hero);

/* 2. The same spec at five widths, and four views in a row. */
for (const w of [346, 250, 170, 120, 80]) {
  const cell = el('div', 'cell'), frame = el('div', 'frame ua-stack');
  frame.style.inlineSize = w + 'px';
  cell.append(frame, el('p', 'meta', w + ' px'));
  $('sizes').append(cell);
  mount(frame, () => hero);
}
for (const spec of [VISITORS, S('trend'), PAGEVIEWS, S('live')]) mount($('toolbar'), spec);

/* 3. Two surfaces over the same specs. The surface writes the titles: a view draws its body only. */
function tile(parent: Element, spec: Spec, cls = '') {
  const card = el('article', 'card ' + cls), row = el('div', 'ua-row');
  card.append(el('h3', '', spec.title), row);
  parent.append(card);
  mount(row, spec);
}
// A tile is a trend in a small space: the first two are line views, and the box leaves them the number and a sparkline.
tile($('board'), S('trend')); tile($('board'), PAGEVIEWS); tile($('board'), S('layers'));
tile($('board'), S('pages'), 'tall'); tile($('board'), S('mix'), 'tall'); tile($('board'), S('live'), 'tall');

const panel = $('panel'), head = el('header'), range = el('span');
head.append(el('b', '', 'Analytics'), range);
const tiles = el('div', 'ua-row tiles');
panel.append(head, tiles);
mount(tiles, VISITORS); mount(tiles, S('total'));
for (const name of ['trend', 'pages', 'mix', 'live']) {
  const section = el('section', 'ua-stack');
  section.append(el('h3', '', S(name).title));
  panel.append(section);
  mount(section, S(name));
}

for (const [metric, def] of Object.entries(catalog.metrics)) {
  const chip = el('span', 'hue', def.label + (HUE[metric] ? '' : ' (the default)'));
  chip.style.setProperty('--c', HUE[metric] ? `var(--ua-color-mark-${HUE[metric]})` : 'var(--a8c-charts-color-series-1)');
  $('hues').append(chip);
}

/* 4. What a view tells its surface when a point is activated. */
const log = $('log');
document.addEventListener('ua-activate', (e) => {
  const view = e.target as UaView, row = (e as CustomEvent<{ row: unknown }>).detail.row;
  if (log.dataset.used == null) { log.replaceChildren(); log.dataset.used = ''; }
  log.prepend(el('li', '', 'ua-activate from "' + (view.spec?.title ?? 'a view') + '": ' + JSON.stringify(row)));
  while (log.children.length > 3) log.lastElementChild!.remove();
});

/* 5. A view from markup alone: three JSON children and nothing else. It is a frozen result, so the controls do not reach it. */
{
  const spec = S('total'), result = runQuery(spec.query), cat = { metrics: { pageviews: catalog.metrics.pageviews }, dimensions: {} };
  const view = document.createElement('ua-view'), lines = ['<ua-view>'];
  for (const [name, value] of Object.entries({ spec, result, catalog: cat })) {
    const script = el('script');
    script.type = 'application/json'; script.dataset.for = name; script.textContent = JSON.stringify(value);
    view.append(script);
    lines.push(`  <script type="application/json" data-for="${name}">\n    ${JSON.stringify(value)}\n  </script>`);
  }
  lines.push('</ua-view>');
  $('markup').textContent = lines.join('\n');
  $('from-markup').append(el('h3', '', spec.title), view);
}

function update() {
  const s = state();
  if (s.theme) root.dataset.theme = s.theme; else delete root.dataset.theme;
  history.replaceState(null, '', '?' + new URLSearchParams({ scenario: s.scenario, range: s.range, theme: s.theme, ...(s.table ? { table: 'on' } : {}) }));
  range.textContent = 'Last ' + parseInt(s.range) + ' days';
  for (const m of mounted) {
    m.view.toggleAttribute('table', s.table);
    // A spec the editor has broken is still handed over: the view says what is wrong with it.
    try {
      const spec = ranged(m.spec(), s.range), h = hue(spec);
      for (const part of ['', '-text', '-soft']) { const name = '--a8c-charts-color-series-1' + part; if (h) m.view.style.setProperty(name, `var(--ua-color-mark-${h}${part})`); else m.view.style.removeProperty(name); }
      m.view.spec = spec; m.view.result = runQuery(spec.query, s.scenario);
    } catch { /* the note below says why */ }
  }
  for (const b of picks.children) b.setAttribute('aria-pressed', String(samples[(b as HTMLElement).dataset.sample!]!.spec === hero));
  try {
    const spec = ranged(hero, s.range), result = runQuery(spec.query, s.scenario);
    $('prose').textContent = resolve(spec, result, unboundedContainer(), catalog).text;
    note.className = 'note'; note.textContent = 'Valid. The range comes from the page, as it will from a panel.';
  } catch (e) {
    note.className = 'note error'; note.textContent = (e as Error).message;
  }
  // A view sets its own stylesheets when it first paints, a microtask from now, so the row colours go on after that.
  requestAnimationFrame(() => { for (const { view } of mounted) { const r = view.shadowRoot!; if (!r.adoptedStyleSheets.includes(rowColours)) r.adoptedStyleSheets = [...r.adoptedStyleSheets, rowColours]; } });
}
controls.addEventListener('change', update);
update();
