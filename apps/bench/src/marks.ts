import type { Catalog, Spec } from '@unified-analytics/core';
import { UaView } from '@unified-analytics/dom';
import { catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { declared, el } from './page.ts';
import { register, samples } from './setup.ts';

/* The marks: each one on its own, at a size where nothing has been given up, for tuning how it looks. A mark is
 * shown in each of the six series colours, on each of the three surfaces, and in the states it has. Every specimen
 * is a <ua-view> on the fixtures, so what is here is the real painter. "Both" sets the page beside itself, in each theme. */
register();

// Both themes side by side is this page's own; the theme itself is the bench's (theme.ts).
const params = new URLSearchParams(location.search), both = params.has('both');
const controls = document.querySelector<HTMLFormElement>('#controls')!, main = document.querySelector('main')!;

// The series colours, in order, by the hue each is aliased to in the token stylesheet.
const SERIES = [...declared()].filter(([name]) => /^--ua-charts-color-series-\d+$/.test(name)).map(([, value]) => value.replace(/^var\(--ua-mark-(.+)\)$/, '$1'));
const SURFACES = ['page', 'card', 'raised', 'screen', 'frost', 'crystal'];
const by = (metric: string, dim: string, compare = false) => ({ metrics: [metric], by: [dim], range: '28d', ...(compare && { compare: 'previous' as const }) });
const S = (name: string) => samples[name]!.spec;
/** A metric that fell where a fall is bad: the fixtures' visitors, read the other way. */
const worse: Catalog = { ...catalog, metrics: { ...catalog.metrics, visitors: { ...catalog.metrics.visitors!, polarity: 'down' } } };

interface State { label: string; spec: Spec; scenario?: Scenario; catalog?: Catalog; active?: boolean }
interface Mark { name: string; note: string; spec: Spec; /** Painted by the first series colour, so it is shown in all six. */ series?: boolean; states?: State[] }
const line: Spec = { query: by('visitors', 'date.day'), layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }] };
const area: Spec = { query: by('visitors', 'date.day'), layers: [{ mark: 'area', encode: { x: 'date.day', y: 'visitors' }, role: 'context' }, { mark: 'line', encode: { x: 'date.day', y: 'visitors' } }] };
const bars: Spec = { query: by('pageviews', 'date.day'), layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'pageviews' } }] };
const rows: Spec = { use: 'bar-list', query: { ...by('pageviews', 'page'), limit: 6 } };
const delta = (catalog?: Catalog): State => ({ label: 'painted by its change: ' + (catalog ? 'bad' : 'good'), catalog,
  spec: { query: by('visitors', 'date.day', true), layers: [{ mark: 'area', encode: { x: 'date.day', y: 'visitors' }, role: 'context', paint: 'delta' }, { mark: 'line', encode: { x: 'date.day', y: 'visitors' }, paint: 'delta' }] } });

const MARKS: Mark[] = [
  { name: 'line', note: 'The last day is part done, so its tail is dashed.', spec: line, series: true, states: [
    { label: 'a point chosen', spec: line, active: true }, { label: 'with the period before', spec: S('trend') }, delta(), delta(worse), { label: 'no data', spec: line, scenario: 'empty' },
    { label: 'steps over bins', spec: S('ecdf') }, { label: 'joining points, day by day', spec: S('connected') }, { label: 'joining points, with no dots', spec: { ...S('connected'), use: undefined, layers: [{ mark: 'line', encode: { x: 'visitors', y: 'signups' } }] } },
    { label: 'by rank, first at the top', spec: S('bump') }, { label: 'a line each, in one paint', spec: S('spaghetti') }] },
  { name: 'area', note: 'The fill under a line is a tint.', spec: area, series: true, states: [{ label: 'a point chosen', spec: area, active: true }, { label: 'stacked, a colour each', spec: S('area') },
    { label: 'steps over bins', spec: S('density') }, { label: 'about the middle, with no value axis', spec: S('streamgraph') }, { label: 'between two ends, by direction', spec: S('difference') },
    { label: 'by direction, where a fall is good', spec: S('difference'), catalog: { ...catalog, metrics: { ...catalog.metrics, revenue: { ...catalog.metrics.revenue!, polarity: 'down' } } } }] },
  { name: 'bar', note: 'On a time axis. The last day is part done, so its bar is faded.', spec: bars, series: true, states: [
    { label: 'a bar chosen', spec: bars, active: true }, { label: 'below zero', spec: S('diverging') }, { label: 'stacked', spec: S('stacked') }, { label: 'side by side', spec: S('grouped') }, { label: 'floating, by direction', spec: S('waterfall') },
    { label: 'floating, with no paint stated', spec: { query: S('waterfall').query, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'net_subscribers@before', y2: 'net_subscribers@running' } }] } }, { label: 'as wide as its share', spec: S('marimekko') }] },
  { name: 'bar in rows', note: 'Behind its label a bar is a tint.', spec: rows, series: true, states: [
    { label: 'a row chosen', spec: rows, active: true }, { label: 'a colour for each row', spec: { query: rows.query, layers: [{ mark: 'bar', encode: { y: 'page', x: 'pageviews', color: 'page' } }, { mark: 'text', encode: { y: 'page', text: 'page' } }, { mark: 'text', encode: { y: 'page', text: 'pageviews' }, align: 'end' }] } },
    { label: 'with columns', spec: S('conversions') }, { label: 'with each row\'s change', spec: S('league') }, { label: 'divided about zero', spec: S('pyramid') }, { label: 'five answers about zero', spec: S('likert') }] },
  { name: 'rule', note: 'A reference line and its label, over bars.', spec: S('layers'), series: true, states: [{ label: 'on both axes', spec: S('quadrant') }, { label: 'across a plot', spec: S('qq') }, { label: 'a stem to a dot', spec: S('lollipop') }] },
  { name: 'dot', note: 'A point for each row, at two metrics.', spec: { query: { metrics: ['visitors', 'page_conversion'], by: ['page'], range: '28d' }, layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'page_conversion' } }] }, series: true, states: [
    { label: 'labelled', spec: S('scatter') }, { label: 'sized', spec: S('bubble') }, { label: 'in rows, then and now', spec: S('dumbbell') }, { label: 'several to a row', spec: S('strip') }] },
  { name: 'tick', note: 'The middle of a box, with the range as a rule and the quartiles as a bar.', spec: S('box'), series: true, states: [{ label: 'a target in rows', spec: S('bullet') }, { label: 'with an interval', spec: S('errors') }, { label: 'a band and a line', spec: S('fan') }, { label: 'half a tick to each side', spec: S('ohlc') }, { label: 'along the foot of a plot', spec: S('rug') }] },
  { name: 'arc', note: 'A colour for each value.', spec: S('donut'), states: [{ label: 'a pie', spec: S('pie') }, { label: 'a half', spec: S('half') }, { label: 'against a target', spec: S('gauge') }] },
  { name: 'band', note: 'One bar divided, a colour for each value.', spec: S('mix') },
  { name: 'cell', note: 'Filled by the sequential ramp, or by the diverging one where its values cross zero.', spec: S('heatmap'), states: [{ label: 'signed, on the diverging ramp', spec: S('correlogram') }, { label: 'one row', spec: S('stripes') }, { label: 'two binned quantities', spec: S('bins2d') },
    { label: 'dots in place of cells', spec: S('circles') }, { label: 'dots over cells, sized by another metric', spec: { query: { metrics: ['pageviews', 'visitors'], by: ['page', 'next_page'], range: '28d' },
      layers: [{ mark: 'cell', encode: { y: 'page', x: 'next_page', color: 'pageviews' } }, { mark: 'dot', encode: { y: 'page', x: 'next_page', size: 'visitors' }, paint: 'ink' }] } }] },
  { name: 'unit', note: 'A value as counted glyphs: a stack up from the axis, and what one is worth under it.', spec: S('units'), series: true, states: [
    { label: 'a group chosen', spec: S('units'), active: true }, { label: 'on bins: a Wilkinson dot plot', spec: S('wilkinson') }, { label: 'a run along a row', spec: S('isotype') },
    { label: 'a hundred cells, by share', spec: S('waffle') }, { label: 'seats round a half circle', spec: S('parliament') }, { label: 'against the metric\'s range', spec: S('icons') }, { label: 'no data', spec: S('units'), scenario: 'empty' }] },
  { name: 'geo', note: 'Filled by the sequential ramp, or the diverging one where its values cross zero, or a symbol on each region.', spec: S('map'), states: [{ label: 'symbols', spec: S('symbols') }, { label: 'square tiles', spec: S('tiles') }, { label: 'hex tiles', spec: S('hexes') }] },
  { name: 'link', note: 'A ribbon for each pair, in its source\'s colour as a tint. A node is as tall as the engine\'s total.', spec: S('sankey'), states: [{ label: 'a ribbon chosen', spec: S('sankey'), active: true }] },
  { name: 'partition', note: 'A box divided by area, and each part divided again. A colour for each parent.', spec: S('treemap'), states: [
    { label: 'one level', spec: S('treemap1') },
    { label: 'painted by a second metric', spec: { query: { metrics: ['pageviews', 'visitors'], by: ['section', 'page'], range: '28d' }, layers: [{ mark: 'partition', encode: { x: 'section', detail: 'page', size: 'pageviews', color: 'visitors' } }] } },
    { label: 'short of the whole, by a limit', spec: { ...S('treemap'), query: { ...S('treemap').query, limit: 3 } } }] },
];

/** A view on a surface, with what it is under it. `series` paints it with that series colour in place of the first. */
function specimen(parent: Element, label: string, state: Omit<State, 'label'>, surface = 'card', series = 1): void {
  const cell = el('figure', 'specimen'), box = el('div', 'surface ua-stack'), view = new UaView();
  box.style.setProperty('--surface', `var(--ua-surface-${surface})`);
  // A screen and frosted glass are more than a colour: material.css. Glass has no colour of its own, and is set over something to blur.
  if (surface === 'screen') box.classList.add('ua-screen');
  if (surface === 'crystal') { box.classList.add('ua-crystal-surface'); box.style.setProperty('--surface', 'var(--ua-surface-card)'); }   // crystal goes over any fill: the card's here
  if (surface === 'frost') { box.classList.add('ua-frost'); box.style.setProperty('--surface', 'var(--ua-frost-fill)'); cell.classList.add('backdrop'); }
  if (series > 1) for (const part of ['', '-text', '-soft']) view.style.setProperty('--ua-charts-color-series-1' + part, `var(--ua-charts-color-series-${series}${part})`);
  view.catalog = state.catalog ?? catalog; view.spec = state.spec;
  try { view.result = runQuery(state.spec.query, state.scenario); } catch (e) { box.append(el('p', 'meta error', (e as Error).message)); }
  box.append(view); cell.append(box, el('figcaption', '', label)); parent.append(cell);
  // A state held open: the pointer is said to be over a row in the middle, and nothing says it has left.
  // ponytail: reaches into the view's shadow root, after its first paint. A real pointer passing over lets it go.
  if (state.active) setTimeout(() => { const hits = view.shadowRoot!.querySelectorAll('.uav-body [data-row]'); hits[Math.floor(hits.length / 2)]?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); }, 200);
}

if (both) {
  // The page beside itself: each half is this page with one theme, and no chrome of its own. A half is as tall as
  // what it holds, so neither scrolls and this page scrolls them together.
  main.className = 'both';
  for (const t of ['light', 'dark']) {
    const frame = el('iframe');
    frame.src = '?theme=' + t + '&embed=1'; frame.title = t;
    frame.addEventListener('load', () => { const root = frame.contentDocument!.documentElement; new ResizeObserver(() => { frame.style.blockSize = root.scrollHeight + 'px'; }).observe(root); });
    main.append(frame);
  }
} else {
  for (const m of MARKS) {
    const section = el('section');
    section.append(el('h2', '', m.name + ' '), el('p', 'note', m.note));
    const group = (title: string) => { const grid = el('div', 'specimens'); section.append(el('h3', '', title), grid); return grid; };
    if (m.series) { const colours = group('In each series colour'); SERIES.forEach((name, i) => specimen(colours, (i + 1) + ' · ' + name, m, 'card', i + 1)); }
    const surfaces = group('On each surface');
    for (const s of SURFACES) specimen(surfaces, s, m, s);
    if (m.states) { const states = group('States and forms'); for (const s of m.states) specimen(states, s.label, s); }
    main.append(section);
  }
}
if (params.has('embed')) document.body.classList.add('embed');
controls.querySelector<HTMLInputElement>('[name="both"]')!.checked = both;
controls.addEventListener('change', () => { location.search = new FormData(controls).has('both') ? '?both' : ''; });
