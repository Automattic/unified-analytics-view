import type { Layer, Query, Spec } from '@unified-analytics/core';
import { UaView, defineUaView, surfaceSheet } from '@unified-analytics/dom';
import { adapt, type ApiResult } from '@unified-analytics/spacefast';

/* The analytics sidebar, on Spacefast's analytics query API: the prototype of the panel the tracking snippet opens on a
 * site. One batch of queries a range, each answer through `adapt` into a query, a result and a catalog, and every
 * picture a <ua-view> handed those and a spec. */
// ponytail: one space, open to anyone. A site's own space and its sign-in take this from the snippet.
const API = 'https://analytics-api-production-085e.up.railway.app/v1/spaces/seed/analytics/query';
defineUaView();
document.adoptedStyleSheets.push(surfaceSheet());

/** One query of a batch, in the API's own words. */
interface Ask { id: string; metrics: string[]; dimensions?: string[]; granularity?: 'hour' | 'day'; window?: string; limit?: number; compare?: 'previous'; filters?: object[] }
type Answer = ApiResult | { id: string; problem: { detail: string } };
/** A card's spec, from the query its answer was adapted to: the metrics and the breakdown are the answer's own names. */
type Make = (q: Query) => Omit<Spec, 'spec' | 'title'>;

// Visitors a day have no total over a range, so visitors are visitor-days: the same days, and their sum.
const ASKS: Ask[] = [
  { id: 'traffic', metrics: ['visitor_days', 'page_views', 'engaged_time'], granularity: 'day', compare: 'previous' },
  { id: 'pages', metrics: ['page_views', 'engaged_time', 'scroll_depth'], dimensions: ['path'], limit: 8, compare: 'previous' },
  { id: 'engaged', metrics: ['engaged_time'], dimensions: ['path'], limit: 8 },
  { id: 'referrers', metrics: ['page_views'], dimensions: ['source_host'], limit: 8, compare: 'previous' },
  { id: 'scroll', metrics: ['page_views'], dimensions: ['scroll_depth_bucket'], filters: [{ dimension: 'scroll_depth_bucket', op: 'not_in', values: [null] }] },
];

/** One of the answer's metrics, as a preset draws it. */
const one = (use: string, at = 0): Make => (q) => ({ use, query: { ...q, metrics: [q.metrics[at]!] } });
const text = (y: string, field: string, more: Partial<Layer> = {}): Layer => ({ mark: 'text', encode: { y, text: field }, ...more });
/** Rows with a column for each metric, and a bar for the first. */
const columns: Make = ({ compare: _, ...q }) => { const y = q.by![0]!; return { query: q, layers: [{ mark: 'bar', encode: { y, x: q.metrics[0]! } }, text(y, y), ...q.metrics.map((m) => text(y, m, { align: 'end' }))] }; };
/** Rows with each one's change on the period before. */
const changes: Make = (q) => { const y = q.by![0]!, m = q.metrics[0]!; return { query: q, layers: [{ mark: 'bar', encode: { y, x: m } }, text(y, y), text(y, m, { align: 'end' }), text(y, m, { series: 'delta', align: 'end' })] }; };
/** The numbers that head the panel: each a metric of the daily series, in a box that leaves it the number and a sparkline. */
const TILES = ['Visitors', 'Page views', 'Engaged time'];
const CARDS: { title: string; of: string; make: Make }[] = [
  { title: 'Page views', of: 'traffic', make: one('line', 1) },
  { title: 'Visitors', of: 'traffic', make: one('line') },
  { title: 'Engaged time', of: 'traffic', make: one('line', 2) },
  { title: 'Top pages', of: 'pages', make: columns },
  { title: 'Pages, then and now', of: 'pages', make: (q) => changes({ ...q, metrics: [q.metrics[0]!] }) },
  { title: 'Engaged time by page', of: 'engaged', make: one('bar-list') },
  { title: 'Where readers come from', of: 'referrers', make: changes },
  { title: 'How far people read', of: 'scroll', make: (q) => ({ query: q, layers: [{ mark: 'cell', encode: { y: 'scroll_depth_bucket', color: 'page_views' } }] }) },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** A batch, asked. What the API could not answer at all is thrown, in its own words. */
async function ask(queries: Ask[]): Promise<Answer[]> {
  const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ queries }) });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.data) throw new Error(body?.detail ?? 'Analytics could not be reached (' + res.status + '). Try again in a moment.');
  return body.data.results;
}

/** One answer as a card: its view, or what went wrong in place of it. */
function card(title: string, answer: Answer | undefined, make: Make, layout = 'ua-stack'): HTMLElement {
  const box = el('article', 'card'), head = el('header'), body = el('div', layout);
  head.append(el('h3', '', title));
  box.append(head, body);
  try {
    if (!answer || 'problem' in answer) throw new Error(answer ? answer.problem.detail : 'No answer came back for this. Try again in a moment.');
    const { query, result, catalog } = adapt(answer), view = new UaView();
    view.catalog = catalog; view.spec = { spec: 'view/0', title, ...make(query) } as Spec; view.result = result;
    body.append(view);
  } catch (e) { box.append(el('p', 'meta error', (e as Error).message)); }
  return box;
}

const panel = document.getElementById('panel')!, top = el('header', 'top'), chips = el('div', 'segmented'), content = el('div', 'content');
chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Range');
// The panel's own two switches: as wide as the page or back beside it, and away altogether, which leaves only the way back.
const ICONS = { expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7', collapse: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7', hide: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v18M8 9l3 3-3 3', show: 'M3 3v18h18M8 17v-5M13 17V7M18 17v-8' };
/** A button that is its icon, named for what pressing it does. */
const face = (b: HTMLButtonElement, icon: keyof typeof ICONS, name: string) => { b.type = 'button'; b.title = name; b.setAttribute('aria-label', name); b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[icon] + '"/></svg>'; };
const tools = el('div', 'tools'), expand = el('button'), hide = el('button'), launcher = el('button', 'ua-frost');
face(expand, 'expand', 'Expand to full screen'); face(hide, 'hide', 'Hide analytics'); face(launcher, 'show', 'Show analytics');
launcher.id = 'launcher'; launcher.dataset.elevation = '1';
expand.addEventListener('click', () => (panel.toggleAttribute('data-full') ? face(expand, 'collapse', 'Collapse to sidebar') : face(expand, 'expand', 'Expand to full screen')));
// Hidden, the panel is out of reach of the keyboard and of a screen reader, and focus goes to whichever button is left.
const shown = (on: boolean) => { panel.toggleAttribute('data-hidden', !on); panel.inert = !on; launcher.inert = on; (on ? hide : launcher).focus(); };
hide.addEventListener('click', () => shown(false));
launcher.addEventListener('click', () => shown(true));
launcher.inert = true;
panel.after(launcher);
tools.append(chips, expand, hide);
top.append(el('b', '', 'Analytics'), tools);
panel.append(top, content);

let turn = 0;
async function load(window: string): Promise<void> {
  const mine = ++turn;
  content.setAttribute('aria-busy', 'true');
  let answers: Answer[];
  try { answers = await ask(ASKS.map((a) => ({ window, ...a }))); } catch (e) { if (mine === turn) content.replaceChildren(el('p', 'meta error', (e as Error).message)); return; }
  if (mine !== turn) return;                                                    // a later range was asked for while this one was out
  const answer = (id: string) => answers.find((a) => a.id === id), tiles = el('div', 'tiles');
  TILES.forEach((title, i) => tiles.append(card(title, answer('traffic'), one('line', i), 'ua-row')));
  content.replaceChildren(tiles, ...CARDS.map((c) => card(c.title, answer(c.of), c.make)));
  content.removeAttribute('aria-busy');
}
for (const days of [7, 30, 90]) {
  const b = el('button', '', days + 'd');
  b.type = 'button'; b.title = 'Last ' + days + ' days'; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', String(days === 30));
  b.addEventListener('click', () => { for (const c of chips.children) c.setAttribute('aria-pressed', String(c === b)); void load(days + 'd'); });
  chips.append(b);
}
void load('30d');
