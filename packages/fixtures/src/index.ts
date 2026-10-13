import type { Catalog, Query, Result, Row, Spec } from '@unified-analytics/core';
import { registerLink } from '@unified-analytics/flow';
import { registerGeo, type Shapes } from '@unified-analytics/geo';
import shapes from './countries.json';
import hexes from './tiles-hex.json';
import squares from './tiles-square.json';

/** Boundary shapes for the `geo` mark: 123 countries. A shape's id is its ISO 3166-1 alpha-2 code in capitals, which is
 * the value the `country` dimension has for it, and its name is beside it in `properties.name`. Somaliland has no code
 * of its own, so it has a name and no id: it is drawn, and no row can be its. Natural Earth's 1:110m countries, by way of world-atlas 2.0.2, as they are
 * drawn there, islands and all, to a tenth of a degree (scripts/countries.mjs writes the file). Which countries is still a
 * fixture's choice: those under 6 square degrees are left out, and Antarctica, so a sample has rows with no shape. Not for a product. */
export const countries: Shapes = shapes;
// Handed to the mark here, as a product would at startup, so every sample resolves wherever the fixtures are loaded.
registerGeo(countries);
// The `link` mark is handed nothing. It is registered here for the same reason.
registerLink();

/** The same countries as equal tiles, squares and hexagons, each roughly where its country is: one for every country
 * above that has a code, under the same id and name, on a flat sheet (`planar`) and so drawn with no map projection.
 * scripts/tiles.mjs works out where each goes and writes both files. Nobody drew these grids, and one drawn by hand reads better. */
export const tiles: { square: Shapes; hex: Shapes } = { square: squares, hex: hexes };
// The same mark again, under a name for each set of shapes, since the registry holds one mark to a name and a spec may
// not say which shapes to draw. Each is a custom mark to the grammar's count. The preset names are working names.
registerGeo(tiles.square, { name: 'geo-tiles', presets: { color: 'tile-grid-map' } });
registerGeo(tiles.hex, { name: 'geo-hexes', presets: { color: 'hex-tile-map' } });

/* Stands in for the query layer and the engines. Totals come from the
 * "engine", never from summing the rows a view happens to receive. */
export const catalog: Catalog = {
  metrics: {
    visitors:  { label: 'Visitors',    unit: 'count', polarity: 'up',   rangeTotal: 'sum of daily' },
    pageviews: { label: 'Page views',  unit: 'count', polarity: 'up',   rangeTotal: 'sum' },
    present:   { label: 'Present now', unit: 'count', polarity: 'none', instant: true },
    net_subscribers: { label: 'Net subscribers', unit: 'count', polarity: 'up', rangeTotal: 'sum' },
    revenue:   { label: 'Revenue',     unit: 'usd',   polarity: 'up',   rangeTotal: 'sum' },
    signups:   { label: 'Sign-ups',    unit: 'count', polarity: 'up',   rangeTotal: 'sum', domain: [0, 500], target: 400, bands: [200, 400] },
    page_conversion: { label: 'Conversion rate', unit: 'percent', polarity: 'up' },
    conversions:      { label: 'Conversions',     unit: 'count', polarity: 'up', rangeTotal: 'sum' },
    conversion_rate:  { label: 'Conversion rate', unit: 'ratio', polarity: 'up' },
    conversion_value: { label: 'Value',           unit: 'usd',   polarity: 'up', rangeTotal: 'sum' },
    response_time:    { label: 'Response time',   unit: 'ms',    polarity: 'down' },
    // For the Uncommon types (docs/uncommon-coverage-plan.md, step 0). A share that runs up through the rows is a metric of
    // its own, in its own unit. An effect and a place in an embedding have no total: the engine sends null for each.
    errors:           { label: 'Errors',            unit: 'count', polarity: 'down', rangeTotal: 'sum' },
    errors_share:     { label: 'Cumulative share',  unit: 'ratio', polarity: 'none' },
    revenue_effect:   { label: 'Effect on revenue', unit: 'usd',   polarity: 'up' },
    embed_x:          { label: 'First component',   unit: 'count', polarity: 'none' },
    embed_y:          { label: 'Second component',  unit: 'count', polarity: 'none' },
    requests:         { label: 'Requests',          unit: 'count', polarity: 'none', rangeTotal: 'sum' },
  },
  dimensions: {
    'date.day': { label: 'Day',     type: 'time' },
    page:       { label: 'Page',    type: 'categorical' },
    channel:    { label: 'Channel', type: 'categorical' },
    device:     { label: 'Device',  type: 'categorical' },
    weekday:    { label: 'Weekday', type: 'categorical' },
    hour:       { label: 'Hour',    type: 'categorical' },
    load_time:  { label: 'Load time', type: 'number' },
    event:      { label: 'Event',   type: 'categorical' },
    step:       { label: 'Step',    type: 'categorical' },
    country:    { label: 'Country', type: 'categorical', values: 'country' },
    visitor_country: { label: 'Country', type: 'categorical', values: 'country' },
    'date.week': { label: 'Week',        type: 'time' },
    next_page:   { label: 'Next page',   type: 'categorical' },
    cause:       { label: 'Cause',       type: 'categorical' },
    factor:      { label: 'Factor',      type: 'categorical' },
    term:        { label: 'Search term', type: 'categorical' },
    intent:      { label: 'Intent',      type: 'categorical' },
    load_stem:   { label: 'Whole second', type: 'categorical' },
    section:    { label: 'Section', type: 'categorical' },
  },
};

export function seeded(seed: number) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Counts = { visitors: number; pageviews: number };
/** What a day has and a page does not: sign-ups less cancellations, which falls below zero, and takings, in another unit. */
type Daily = Counts & { net_subscribers: number; revenue: number; signups: number; response_time: number };
const DAY = 86400000, TODAY = Date.UTC(2026, 9, 5);
const DAILY = (function () {
  // The first is the prototype's, drawn from in its order. What the prototype does not know draws from the second.
  const rand = seeded(11), more = seeded(23), spend = seeded(37), join = seeded(41), slow = seeded(53);
  return Array.from({ length: 56 }, function (_, i) {
    const t = TODAY - (55 - i) * DAY, dow = new Date(t).getUTCDay();
    const season = [0.72, 1.06, 1.12, 1.1, 1.04, 0.96, 0.7][dow]!;
    const launch = i === 45 ? 1.55 : i === 46 ? 1.25 : 1;
    let visitors = Math.round((330 + i * 1.6) * season * launch * (0.92 + rand() * 0.16));
    let pageviews = Math.round(visitors * (2.1 + rand() * 0.5));
    const partial = i === 55;
    if (partial) { visitors = Math.round(visitors * 0.42); pageviews = Math.round(pageviews * 0.42); }
    const net_subscribers = Math.round((more() - 0.45) * 40 * (partial ? 0.42 : 1));
    const revenue = Math.round(visitors * (4 + spend() * 4));
    const signups = Math.round(visitors * (0.02 + join() * 0.02));
    // A response time is measured through the day, so a day has more to say of it than one number. The engine says
    // it all: where the day opened and closed, its least and its most, and the interval its mean is known to.
    const level = 400 + 50 * Math.sin(i / 4), open = Math.round(level + (slow() - 0.5) * 140), close = Math.round(level + (slow() - 0.5) * 140);
    const response_time = Math.round((open + close) / 2 + (slow() - 0.5) * 30), wide = Math.round(18 + slow() * 30);
    const times = { 'response_time@open': open, 'response_time@close': close, 'response_time@min': Math.min(open, close) - Math.round(30 + slow() * 90),
      'response_time@max': Math.max(open, close) + Math.round(40 + slow() * 160), 'response_time@lower': response_time - wide, 'response_time@upper': response_time + wide };
    // Its quartiles lie half way from the mean to each end, so a band of them is always inside the band of the least and the most.
    const quartiles = { 'response_time@p25': response_time - Math.round((response_time - times['response_time@min']) / 2), 'response_time@p75': response_time + Math.round((times['response_time@max'] - response_time) / 2) };
    return { iso: new Date(t).toISOString().slice(0, 10), visitors, pageviews, net_subscribers, revenue, signups, response_time, times: { ...times, ...quartiles }, partial };
  });
})();
const PAGES: (Counts & { page: string; prev: Counts | null })[] = [
  { page: '/',                                pageviews: 4820, visitors: 2610, prev: { pageviews: 4410, visitors: 2380 } },
  { page: '/pricing',                         pageviews: 2960, visitors: 1705, prev: { pageviews: 2310, visitors: 1390 } },
  { page: '/blog/launch-notes',               pageviews: 2105, visitors: 1622, prev: { pageviews: 640,  visitors: 488 } },
  { page: '/docs/getting-started',            pageviews: 1730, visitors: 901,  prev: { pageviews: 1802, visitors: 940 } },
  { page: '/changelog',                       pageviews: 940,  visitors: 612,  prev: { pageviews: 1010, visitors: 655 } },
  { page: '/about',                           pageviews: 610,  visitors: 498,  prev: { pageviews: 580,  visitors: 470 } },
  { page: '/blog/analytics-without-cookies',  pageviews: 455,  visitors: 371,  prev: null },
  { page: '/contact',                         pageviews: 290,  visitors: 244,  prev: { pageviews: 310,  visitors: 262 } },
];
const CHANNELS: [string, number, number][] = [['Search', 0.41, 0.44], ['Direct', 0.28, 0.29], ['Social', 0.14, 0.13], ['AI assistants', 0.08, 0.04], ['Email', 0.06, 0.07], ['Other', 0.03, 0.03]];
const DEVICES: [string, number, number][] = [['Desktop', 0.52, 0.55], ['Mobile', 0.41, 0.38], ['Tablet', 0.07, 0.07]];
// The week and the day, each in its own order: a quiet weekend, a working day that peaks before noon and an evening after it.
const shares = (names: string[], weights: number[]): [string, number, number][] => { const all = weights.reduce((s, w) => s + w, 0); return names.map((n, i) => [n, weights[i]! / all, weights[i]! / all]); };
const WEEKDAYS = shares(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], [1.06, 1.12, 1.1, 1.04, 0.96, 0.7, 0.72]);
const HOURS = shares(Array.from({ length: 24 }, (_, h) => (h % 12 || 12) + (h < 12 ? 'am' : 'pm')), Array.from({ length: 24 }, (_, h) => 0.15 + Math.exp(-((h - 11) ** 2) / 18) + 0.6 * Math.exp(-((h - 20) ** 2) / 8)));
// A dimension whose values divide a total: each value's share of it, now and in the period before.
const MIX: Record<string, [string, number, number][]> = { channel: CHANNELS, device: DEVICES, weekday: WEEKDAYS, hour: HOURS };
// Where visitors are, as the engine sends a country: its ISO 3166-1 alpha-2 code, in capitals.
MIX.country = [['US', 0.31, 0.33], ['IN', 0.12, 0.1], ['GB', 0.09, 0.1], ['DE', 0.08, 0.08], ['BR', 0.07, 0.06], ['CA', 0.06, 0.06], ['FR', 0.05, 0.05],
  ['AU', 0.045, 0.05], ['JP', 0.04, 0.04], ['ES', 0.035, 0.035], ['MX', 0.03, 0.03], ['ID', 0.025, 0.02], ['NG', 0.02, 0.015], ['ZA', 0.015, 0.015], ['SE', 0.01, 0.015]];
// Every country the tracker saw, as real data has them: small ones the fixture's shapes leave out (Singapore, Malta and
// Bahrain), and one it could not place, which arrives as an empty string.
MIX.visitor_country = [...MIX.country, ['SG', 0.012, 0.01], ['MT', 0.006, 0.006], ['BH', 0.004, 0.004], ['', 0.008, 0.008]];
// Where a visitor goes from a page: the same pages again, so the pairs make a square.
MIX.next_page = shares(PAGES.map((p) => p.page), PAGES.map((p) => p.visitors));
// The part of the site a visit lands in. With `channel` it is a flow: where visitors come from, and where they arrive.
MIX.section = [['Home', 0.3, 0.31], ['Blog', 0.26, 0.22], ['Docs', 0.2, 0.22], ['Pricing', 0.16, 0.17], ['Changelog', 0.08, 0.08]];
// What a page has and a day does not: the share of its visitors who convert, in percent. A rate is the engine's to work out, and does not add up.
const RATES: Record<string, number> = { '/': 2.1, '/pricing': 5.8, '/blog/launch-notes': 1.2, '/docs/getting-started': 3.4, '/changelog': 0.9, '/about': 1.6, '/blog/analytics-without-cookies': 2.7, '/contact': 4.4 };
const RATE = 2.6;
// A page's response time in milliseconds, as the engine states it: its mean, then each companion of it. The least, the
// quartiles and the most, and the interval the mean is known to. No view works out a quantile.
const TIME_FIELDS = ['', '@min', '@p25', '@p50', '@p75', '@max', '@lower', '@upper'];
const TIMES: Record<string, number[]> = {
  '/':                               [412, 120, 290, 380, 490, 1180, 396, 428],
  '/pricing':                        [468, 140, 320, 430, 560, 1420, 441, 495],
  '/blog/launch-notes':              [655, 180, 430, 590, 800, 2350, 612, 698],
  '/docs/getting-started':           [530, 150, 360, 480, 650, 1760, 492, 568],
  '/changelog':                      [345, 110, 250, 320, 410, 940,  318, 372],
  '/about':                          [298, 100, 220, 280, 350, 760,  266, 330],
  '/blog/analytics-without-cookies': [720, 210, 470, 640, 890, 2600, 648, 792],
  '/contact':                        [384, 130, 270, 350, 450, 1050, 331, 437],
};
const TIME: Cell = [436, 451];
// Load time in seconds, in bins half a second wide: the weight of each, with a long tail.
const LOAD = { width: 0.5, weights: [2, 9, 21, 30, 27, 20, 14, 10, 7, 5, 4, 3, 2, 2, 1, 1] };
// Dimensions held as a table: a row per value, each metric now and in the period before, and the engine's own totals.
// A rate is the engine's, row by row and over the whole: no view divides to get one, and it is not the sum of its rows.
// Events are ranked as pages are. Steps come back in their own order, which is what makes them a funnel.
// `also` is what the engine says of a row beside its metrics: companions of a metric or of the dimension itself, by the
// row's name. `split` is a second dimension the table may be asked by, and the value of it each row falls under.
type Cell = [now: number | null, before: number | null];
// Search terms set out in two components of an embedding, about the centre of the intent each falls under.
const INTENTS: [string, number, number, string[]][] = [
  ['Pricing', -0.55, 0.4,  ['pricing', 'plans', 'free trial', 'discount code', 'enterprise pricing', 'cost per seat', 'billing', 'refund policy']],
  ['How to',  0.5,   0.45, ['getting started', 'install snippet', 'api keys', 'export csv', 'custom events', 'webhooks', 'sso setup', 'data retention']],
  ['Privacy', 0.05,  -0.5, ['cookieless analytics', 'gdpr', 'consent banner', 'ip anonymisation', 'privacy policy', 'data residency', 'do not track', 'ccpa']],
];
const spread = seeded(71), near = (c: number) => Math.round((c + (spread() - 0.5) * 0.5) * 100) / 100;
const TERMS = INTENTS.flatMap(([intent, x, y, terms]) => terms.map((term) => ({ term, intent, x: near(x), y: near(y) })));
const TABLES: Record<string, { fields: string[]; ranked: boolean; rows: [string, ...Cell[]][]; totals: Record<string, Cell>; also?: Record<string, Row>; split?: [dim: string, of: Record<string, string>] }> = {
  event: { fields: ['conversions', 'conversion_rate', 'conversion_value'], ranked: true, rows: [
    ['Add to cart',       [1310, 1180], [0.124, 0.125], [48200, 43100]],
    ['Newsletter signup', [842, 610],   [0.08, 0.065],  [4210, 3050]],
    ['Checkout started',  [655, 690],   [0.062, 0.073], [39800, 41900]],
    ['Purchase',          [412, 371],   [0.039, 0.039], [31650, 27900]],
    ['Trial started',     [198, null],  [0.019, null],  [9900, null]],
    ['Contact form',      [96, 104],    [0.009, 0.011], [960, 1040]],
  ], totals: { conversions: [3513, 2955], conversion_rate: [0.212, 0.198], conversion_value: [134720, 116990] } },
  step: { fields: ['visitors', 'conversion_rate'], ranked: false, rows: [
    ['Visited the site',  [10531, 9437], [1, 1]],
    ['Viewed pricing',    [1705, 1390],  [0.162, 0.147]],
    ['Started checkout',  [655, 690],    [0.062, 0.073]],
    ['Purchased',         [412, 371],    [0.039, 0.039]],
  ], totals: { conversion_rate: [0.039, 0.039] } },
  // Errors from the most to the fewest, and the share of them all that the rows down to each one hold. The engine adds it up.
  cause: { fields: ['errors', 'errors_share'], ranked: false, rows: [
    ['Timeout',      [412, 380], [0.38, null]],
    ['Not found',    [268, 301], [0.627, null]],
    ['Server error', [171, 164], [0.785, null]],
    ['Bad gateway',  [98, 120],  [0.875, null]],
    ['Forbidden',    [61, 70],   [0.932, null]],
    ['Rate limited', [40, 52],   [0.969, null]],
    ['Other',        [34, 33],   [1, null]],
  ], totals: { errors: [1084, 1120], errors_share: [1, 1] } },
  // What revenue would gain or lose were each assumption at the low or the high end of its range, from the widest swing
  // to the narrowest. Signed, from the forecast as it stands. There is no total of them to give.
  factor: { fields: ['revenue_effect'], ranked: false, rows: [
    ['Conversion rate', [800, null]], ['Traffic', [250, null]], ['Average order', [250, null]], ['Refund rate', [-350, null]], ['Ad spend', [100, null]], ['Churn', [-150, null]],
  ], totals: { revenue_effect: [null, null] }, also: {
    'Conversion rate': { 'revenue_effect@low': -6200, 'revenue_effect@high': 7800 }, 'Traffic': { 'revenue_effect@low': -5100, 'revenue_effect@high': 5600 },
    'Average order': { 'revenue_effect@low': -3900, 'revenue_effect@high': 4400 }, 'Refund rate': { 'revenue_effect@low': -2600, 'revenue_effect@high': 1900 },
    'Ad spend': { 'revenue_effect@low': -1500, 'revenue_effect@high': 1700 }, 'Churn': { 'revenue_effect@low': -900, 'revenue_effect@high': 600 },
  } },
  term: { fields: ['embed_x', 'embed_y'], ranked: false, rows: TERMS.map((t) => [t.term, [t.x, null], [t.y, null]]), totals: { embed_x: [null, null], embed_y: [null, null] },
    split: ['intent', Object.fromEntries(TERMS.map((t) => [t.term, t.intent]))] },
  // Load times to a tenth of a second, as a stem-and-leaf display has them: the whole seconds are the dimension, and the
  // tenths of each request under it are a companion of the dimension, a string the engine wrote.
  // ponytail: the leaves are the 28 days' and do not follow the range, as the counts do.
  load_stem: { fields: ['requests'], ranked: false, rows: [['0', [5, 4]], ['1', [9, 8]], ['2', [12, 13]], ['3', [7, 9]], ['4', [4, 3]], ['5', [2, 2]], ['6', [1, 0]]],
    totals: { requests: [40, 39] }, also: { '0': { 'load_stem@leaves': '4 6 7 8 9' }, '1': { 'load_stem@leaves': '0 1 2 2 4 5 7 8 9' }, '2': { 'load_stem@leaves': '0 0 1 1 2 3 3 4 5 6 8 9' },
      '3': { 'load_stem@leaves': '0 1 3 4 6 7 9' }, '4': { 'load_stem@leaves': '1 2 5 8' }, '5': { 'load_stem@leaves': '3 7' }, '6': { 'load_stem@leaves': '2' } } },
};
/** The ISO week a day falls in, as the engine names a week: "2026-W37". A week is in the year its Thursday is in. */
const isoWeek = (t: number) => { const thu = t + (3 - (new Date(t).getUTCDay() + 6) % 7) * DAY, y = new Date(thu).getUTCFullYear(); return y + '-W' + String(1 + Math.floor((thu - Date.UTC(y, 0, 1)) / (7 * DAY))).padStart(2, '0'); };
const isTime = (d: string) => catalog.dimensions[d]!.type === 'time';
const LIVE = [{ page: '/', present: 3 }, { page: '/pricing', present: 2 }, { page: '/blog/launch-notes', present: 1 }, { page: '/docs/getting-started', present: 1 }];

export type Scenario = 'typical' | 'no-prior' | 'empty';
export const scenarios: Scenario[] = ['typical', 'no-prior', 'empty'];
type M = keyof Counts;
type D = keyof Daily;

/** `total` divided among weights in whole numbers that add up to it: the largest remainders take what rounding down leaves. */
export function apportion(total: number, weights: number[]): number[] {
  const all = weights.reduce((s, w) => s + w, 0), exact = weights.map((w) => Math.abs(total) * w / all), out = exact.map(Math.floor);
  const left = Math.abs(total) - out.reduce((s, n) => s + n, 0);
  exact.map((x, i) => [x - out[i]!, i] as const).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => { out[i]!++; });
  return total < 0 ? out.map((n) => (n ? -n : 0)) : out;
}

export function runQuery(q: Query, scenario: Scenario = 'typical'): Result {
  const metrics = q.metrics || [], dims = q.by || [], by = dims[0] || null;
  metrics.forEach((m) => { if (!catalog.metrics[m]) throw new Error('Unknown metric "' + m + '". The catalog has: ' + Object.keys(catalog.metrics).join(', ') + '.'); });
  dims.forEach((d) => { if (!catalog.dimensions[d]) throw new Error('Unknown dimension "' + d + '". The catalog has: ' + Object.keys(catalog.dimensions).join(', ') + '.'); });
  if (dims.length > 2 || (dims.length === 2 && dims[0] === dims[1])) throw new Error('A query is by one dimension or by two different ones. This one is by: ' + dims.join(', ') + '.');
  const wantPrev = q.compare === 'previous', hasPrev = wantPrev && scenario !== 'no-prior';
  const meta: Result['meta'] = { range: q.range || '28d', compare: q.compare || null, notes: [] };
  const totals: Result['totals'] = {}; let rows: Row[] = [];
  const live = metrics.indexOf('present') >= 0;
  if (metrics.indexOf('page_conversion') >= 0 && dims.length && (dims.length > 1 || by !== 'page')) throw new Error('The fixture has "page_conversion" page by page, and not by anything else. Query it by page alone.');
  if (dims.indexOf('load_time') >= 0 && (dims.length > 1 || live || metrics.indexOf('page_conversion') >= 0)) throw new Error('The fixture bins a count by "load_time" and nothing more. Query a count by it alone.');
  if (metrics.indexOf('response_time') >= 0 && (dims.length > 1 || (by && by !== 'page' && by !== 'date.day'))) throw new Error('The fixture has "response_time" by day or page by page, and not by anything else. Query it by date.day or by page alone.');
  if (live && (metrics.length > 1 || dims.length > 1 || (by && by !== 'page'))) throw new Error('"present" is an instantaneous count. Query it alone, optionally by page.');

  if (scenario === 'empty') {
    metrics.forEach((m) => { totals[m] = 0; if (wantPrev) totals[m + '@previous'] = null; });
    meta.empty = true;
    return dims.length === 2 ? { rows, totals, totalsBy: { [dims[0]!]: [], [dims[1]!]: [] }, meta } : { rows, totals, meta };
  }
  if (live) {
    totals.present = LIVE.reduce((s, d) => s + d.present, 0);
    meta.range = 'now';
    return { rows: by ? LIVE.map((d) => ({ ...d })) : [], totals, meta };
  }
  const sum = (ds: Daily[], m: string) => ds.reduce((s, d) => s + d[m as D], 0);
  // A shorter range is the last days of the same series, and a mix of its own. 28 days is the fixture as it always was.
  // By week the range is its whole weeks, the last of them the one before today's, so no week is ragged or unfinished.
  const weekly = dims.indexOf('date.week') >= 0, asked = Math.min(28, parseInt(q.range || '') || 28), days = weekly ? Math.max(7, asked - asked % 7) : asked, end = weekly ? 55 : 56;
  if (weekly && wantPrev) throw new Error('The fixture has whole weeks with no period before them: its days run out a day short of four more. Remove "compare" from the query, or query by date.day.');
  const mix = seeded(days), vary = () => (days === 28 ? 1 : 0.5 + mix());
  const cur = DAILY.slice(end - days, end), prev = DAILY.slice(end - 2 * days, end - days);
  // A table's counts follow the range. What does not add up over a range does not: a rate, an effect, a place.
  const table = TABLES[by || ''], held = (m: string, n: number | null) => (n == null || !catalog.metrics[m]!.rangeTotal ? n : Math.round(n * days / 28));
  const elsewhere = metrics.find((m) => m !== 'page_conversion' && !(m in DAILY[0]!) && !(table && table.fields.indexOf(m) >= 0));
  if (elsewhere) throw new Error('The fixture has "' + elsewhere + '" by ' + Object.keys(TABLES).filter((d) => TABLES[d]!.fields.indexOf(elsewhere) >= 0).join(' or ') + ' only. Query it by that.');
  if (table && dims.length > 1 && dims[1] !== table.split?.[0]) throw new Error('The fixture has "' + by + '" on its own, and not with a second dimension. Remove "' + dims[1] + '" from by.');
  metrics.forEach((m) => {
    const rate = m === 'page_conversion';
    const [now, before] = table && table.totals[m] ? table.totals[m]!.map((n) => held(m, n)) : rate ? [RATE, RATE - 0.2] : m === 'response_time' ? TIME : [sum(cur, m), sum(prev, m)];
    totals[m] = now ?? null;
    if (wantPrev) totals[m + '@previous'] = hasPrev ? before! : null;
  });
  // One row per value of a dimension, in the dimension's own order, before any sort or limit.
  function rowsBy(dim: string): Row[] {
    // Companions come with a query by one dimension. A running total is the engine's: what the range held before each
    // day, and what it holds after it.
    let run = 0;
    if (dim === 'date.day') return cur.map((d, i) => {
      const r: Row = { 'date.day': d.iso, partial: d.partial };
      metrics.forEach((m) => {
        r[m] = d[m as D]; if (wantPrev) r[m + '@previous'] = hasPrev ? prev[i]![m as D] : null;
        if (dims.length > 1) return;
        if (m === 'response_time') Object.assign(r, d.times);
        if (m === 'net_subscribers') { r[m + '@before'] = run; run += d.net_subscribers; r[m + '@running'] = run; }
      });
      return r;
    });
    if (dim === 'date.week') return Array.from({ length: days / 7 }, (_, w) => {
      const ds = cur.slice(w * 7, w * 7 + 7), r: Row = { 'date.week': isoWeek(Date.parse(ds[0]!.iso)) };
      metrics.forEach((m) => { r[m] = sum(ds, m); });
      return r;
    });
    if (table) {
      const missing = metrics.find((m) => table.fields.indexOf(m) < 0);
      if (missing) throw new Error('The fixture has "' + dim + '" with ' + table.fields.join(', ') + ', and not "' + missing + '". Query one of those.');
      return table.rows.map(([name, ...cells]) => {
        const r: Row = { [dim]: name, ...(dims[1] && { [dims[1]]: table.split![1][name]! }) };
        metrics.forEach((m) => { const [now, before] = cells[table.fields.indexOf(m)]!; r[m] = held(m, now); if (wantPrev) r[m + '@previous'] = hasPrev ? held(m, before) : null; });
        return Object.assign(r, table.also?.[name]);
      });
    }
    const perPage = metrics.find((m) => m !== 'page_conversion' && m !== 'response_time' && !(m in PAGES[0]!));
    if (dim === 'page' && perPage) throw new Error('The fixture has "' + perPage + '" by day, channel or device, and not page by page. Query it by one of those.');
    if (dim === 'page') return PAGES.map((p) => {
      const r: Row = { page: p.page };
      metrics.forEach((m) => {
        if (m === 'page_conversion') { r[m] = Math.round(RATES[p.page]! * vary() * 10) / 10; if (wantPrev) r[m + '@previous'] = null; return; }
        if (m === 'response_time') { TIME_FIELDS.forEach((f, j) => { r[m + f] = TIMES[p.page]![j]!; }); if (wantPrev) r[m + '@previous'] = null; return; }
        r[m] = Math.round(p[m as M] * days / 28 * vary()); if (wantPrev) r[m + '@previous'] = hasPrev && p.prev ? p.prev[m as M] : null;
      });
      return r;
    });
    // Bins are the engine's: each row says where its bin starts and ends, and the bins divide the whole of the total.
    // Density comes with them as a companion: the share of the total in each unit of the dimension.
    if (dim === 'load_time') {
      const weights = LOAD.weights.map((w) => w * vary()), parts = metrics.map((m) => apportion(totals[m]!, weights));
      const before = metrics.map((m) => (hasPrev ? apportion(totals[m + '@previous']!, LOAD.weights) : null));
      return weights.map((_, i) => {
        const r: Row = { load_time: i * LOAD.width, 'load_time@end': (i + 1) * LOAD.width };
        metrics.forEach((m, j) => { r[m] = parts[j]![i]!; r[m + '@density'] = Math.round(parts[j]![i]! / (totals[m] || 1) / LOAD.width * 1e4) / 1e4; if (wantPrev) r[m + '@previous'] = before[j] ? before[j]![i]! : null; });
        return r;
      });
    }
    // The mix moves with the range and still adds up to the engine's total: its values divide the whole of it.
    const values = MIX[dim]!, mixes = values.map((c) => metrics.map(() => c[1] * vary())), whole = metrics.map((_, j) => mixes.reduce((s, w) => s + w[j]!, 0));
    return values.map((c, i) => {
      const r: Row = { [dim]: c[0] };
      metrics.forEach((m, j) => { r[m] = Math.round(totals[m]! * mixes[i]![j]! / whole[j]!); if (wantPrev) r[m + '@previous'] = hasPrev ? Math.round(totals[m + '@previous']! * c[2]) : null; });
      return r;
    });
  }
  if (dims.indexOf('date.day') >= 0) meta.notes.push('Today is still in progress.');
  const m0 = metrics[0]!;
  // A categorical dimension is ranked by the first metric, and `limit` keeps its first values. Days and bins keep their own order.
  const top = (rs: Row[]) => { const ranked = rs.slice().sort((a, b) => (b[m0] as number) - (a[m0] as number)); return q.limit ? ranked.slice(0, q.limit) : ranked; };
  // A page's rank by page views is the engine's too, counted before any limit.
  // ponytail: it comes only with a query that compares. A query has no way to ask for a companion, and the prototype's
  // samples must come back as they were. When the contract can ask, this is asked for.
  const ranked = (rs: Row[]) => { if (by === 'page' && wantPrev && m0 === 'pageviews') rs.forEach((r, i) => { r['pageviews@rank'] = i + 1; }); return rs; };
  if (table && !table.ranked) {
    const kept = rowsBy(by!).slice(0, q.limit || undefined), split = dims[1];
    // Asked by its second dimension too, a row is still one value of the first: each falls under one value of the second, which has no total of these.
    return split ? { rows: kept, totals, totalsBy: { [by!]: kept, [split]: [...new Set(kept.map((r) => r[split]))].map((v) => ({ [split]: v, ...Object.fromEntries(metrics.map((m) => [m, null])) })) }, meta } : { rows: kept, totals, meta };
  }
  if (dims.length < 2) return { rows: !by ? rows : catalog.dimensions[by]!.type !== 'categorical' ? rowsBy(by) : ranked(top(rowsBy(by))), totals, meta };

  // Two dimensions: one row per pair. Each value of the outer one is divided among the inner one's, unevenly from one
  // to the next, so every pair adds up to the outer row it came from. Time, when it is there, is the outer one.
  // ponytail: a total by the inner dimension is the sum of its pairs, and is not held to what a query by it alone returns.
  const [outer, inner] = isTime(dims[1]!) ? [dims[1]!, dims[0]!] : [dims[0]!, dims[1]!];
  const fields = metrics.flatMap((m) => (wantPrev ? [m, m + '@previous'] : [m]));
  const values: [string, number][] = inner === 'page' ? PAGES.map((p) => [p.page, p.visitors]) : MIX[inner]!.map((c) => [c[0], c[1]]);
  const uneven = seeded(days + 97), outerRows = rowsBy(outer);
  const pairs = outerRows.flatMap((o) => {
    const weights = values.map(([, w]) => w * (0.8 + 0.4 * uneven()));
    const parts = fields.map((f) => (o[f] == null ? null : apportion(o[f] as number, weights)));
    return values.map(([name], j): Row => ({ ...o, [inner]: name, ...Object.fromEntries(fields.map((f, i) => [f, parts[i] ? parts[i]![j]! : null])) }));
  });
  // Where the collector was down there is no count, which is not a count of none: Wednesdays from 3am to 5am.
  pairs.forEach((p) => { if (p.weekday === 'Wed' && ['3am', '4am', '5am'].indexOf(p.hour as string) >= 0) fields.forEach((f) => { p[f] = null; }); });
  // Through time a pair has a running total too: what its value of the inner dimension has held since the range began.
  // ponytail: of sign-ups alone, as a page's rank comes only with one query. When a query can ask for a companion, this is asked for.
  if (isTime(outer) && metrics.indexOf('signups') >= 0) { const run: Record<string, number> = {}; pairs.forEach((p) => { const k = p[inner] as string; p['signups@running'] = run[k] = (run[k] || 0) + (p.signups as number); }); }
  const innerRows = values.map(([name]) => {
    const r: Row = { [inner]: name }, mine = pairs.filter((p) => p[inner] === name);
    fields.forEach((f) => { r[f] = mine.some((p) => p[f] != null) ? mine.reduce((s, p) => s + ((p[f] as number) || 0), 0) : null; });
    return r;
  });
  // `limit` keeps the first values of each categorical dimension. A total still covers what the limit left out of the other.
  const kept = (rs: Row[], dim: string) => { const names = isTime(dim) ? null : top(rs).map((r) => r[dim]); return names ? rs.filter((r) => names.indexOf(r[dim]) >= 0) : rs; };
  const totalsBy = { [outer]: kept(outerRows, outer), [inner]: kept(innerRows, inner) };
  const order = isTime(outer) ? outerRows : top(outerRows), within = totalsBy[inner]!.map((r) => r[inner]);
  rows = order.flatMap((o) => pairs.filter((p) => p[outer] === o[outer] && within.indexOf(p[inner]) >= 0));
  return { rows, totals, totalsBy, meta };
}

export const samples: Record<string, { label: string; spec: Spec }> = {
  trend:  { label: 'Visitors over time', spec: { spec: 'view/0', title: 'Visitors',    use: 'line',      query: { metrics: ['visitors'],  by: ['date.day'], range: '28d', compare: 'previous' } } },
  pages:  { label: 'Top pages',          spec: { spec: 'view/0', title: 'Top pages',   use: 'bar-list',  query: { metrics: ['pageviews'], by: ['page'],     range: '28d', limit: 8 } } },
  mix:    { label: 'Channel mix',        spec: { spec: 'view/0', title: 'Channels',    use: 'share-bar', query: { metrics: ['visitors'],  by: ['channel'],  range: '28d' } } },
  total:  { label: 'Page views total',   spec: { spec: 'view/0', title: 'Page views',  query: { metrics: ['pageviews'], range: '28d', compare: 'previous' } } },
  live:   { label: 'Present now',        spec: { spec: 'view/0', title: 'Present now', use: 'bar-list',  query: { metrics: ['present'], by: ['page'] } } },
  layers: { label: 'Written as layers: bars and a target', spec: { spec: 'view/0', title: 'Daily page views', query: { metrics: ['pageviews'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'pageviews' } }, { mark: 'rule', encode: { y: 1000 }, label: 'Target 1,000', role: 'reference' }] } },
};

/* Samples the prototype does not know (docs/chart-coverage-plan.md). The parity sweep is held to `samples` and never
 * meets these. They have a sweep and golden scenes of their own, in test/coverage.test.ts. */
export const moreSamples: Record<string, { label: string; spec: Spec }> = {
  series: { label: 'Three series: visitors by device', spec: { spec: 'view/0', title: 'Visitors by device', query: { metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' },
            layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'device' } }] } },
  stacked: { label: 'Stacked bars: visitors by day and device', spec: { spec: 'view/0', title: 'Visitors by device', use: 'stacked-bar', query: { metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' } } },
  grouped: { label: 'Grouped bars: channels by device', spec: { spec: 'view/0', title: 'Channels by device', use: 'grouped-bar', query: { metrics: ['visitors'], by: ['channel', 'device'], range: '28d' } } },
  diverging: { label: 'Diverging bars: net subscribers by day', spec: { spec: 'view/0', title: 'Net subscribers', query: { metrics: ['net_subscribers'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'net_subscribers' } }] } },
  dual:    { label: 'Two units: visitors and revenue by day', spec: { spec: 'view/0', title: 'Visitors and revenue', query: { metrics: ['visitors', 'revenue'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'line', encode: { x: 'date.day', y: 'revenue' }, paint: 'series.2' }] } },
  heatmap: { label: 'Heatmap: visitors by weekday and hour', spec: { spec: 'view/0', title: 'Visitors by weekday and hour', use: 'heatmap', query: { metrics: ['visitors'], by: ['weekday', 'hour'], range: '28d' } } },
  area:    { label: 'Stacked areas: page views by day and channel', spec: { spec: 'view/0', title: 'Page views by channel', use: 'stacked-area', query: { metrics: ['pageviews'], by: ['date.day', 'channel'], range: '28d' } } },
  donut:   { label: 'A donut: device share', spec: { spec: 'view/0', title: 'Devices', use: 'donut', query: { metrics: ['visitors'], by: ['device'], range: '28d' } } },
  pie:     { label: 'A pie: channel mix', spec: { spec: 'view/0', title: 'Channels', use: 'pie', query: { metrics: ['visitors'], by: ['channel'], range: '28d' } } },
  half:    { label: 'A half circle: page views by device', spec: { spec: 'view/0', title: 'Page views by device', use: 'pie-semi-circle', query: { metrics: ['pageviews'], by: ['device'], range: '28d' } } },
  gauge:   { label: 'A gauge: sign-ups against a target', spec: { spec: 'view/0', title: 'Sign-ups', use: 'gauge', query: { metrics: ['signups'], range: '28d' } } },
  scatter: { label: 'Scatter: traffic against conversion rate by page', spec: { spec: 'view/0', title: 'Traffic against conversion', query: { metrics: ['visitors', 'page_conversion'], by: ['page'], range: '28d' },
            layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'page_conversion' } }, { mark: 'text', encode: { x: 'visitors', y: 'page_conversion', text: 'page' } }] } },
  bubble:  { label: 'Bubbles: traffic against conversion rate, sized by page views', spec: { spec: 'view/0', title: 'Traffic, conversion and page views', query: { metrics: ['visitors', 'page_conversion', 'pageviews'], by: ['page'], range: '28d' },
            layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'page_conversion', size: 'pageviews' } }] } },
  quadrant: { label: 'Quadrants: traffic against conversion rate, with a rule on each axis', spec: { spec: 'view/0', title: 'Where to look', query: { metrics: ['visitors', 'page_conversion'], by: ['page'], range: '28d' },
            layers: [{ mark: 'rule', encode: { x: 1000 }, label: '1,000 visitors', role: 'reference' }, { mark: 'rule', encode: { y: 3 }, label: 'Converts at 3', role: 'reference' },
                     { mark: 'dot', encode: { x: 'visitors', y: 'page_conversion' } }, { mark: 'text', encode: { x: 'visitors', y: 'page_conversion', text: 'page' } }] } },
  histogram: { label: 'Histogram: page views by load time', spec: { spec: 'view/0', title: 'Load time', query: { metrics: ['pageviews'], by: ['load_time'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'load_time', y: 'pageviews' } }] } },
  density: { label: 'Density: page views along load time', spec: { spec: 'view/0', title: 'Load time, as a density', query: { metrics: ['pageviews'], by: ['load_time'], range: '28d' },
            layers: [{ mark: 'area', encode: { x: 'load_time', y: 'pageviews@density' }, role: 'context' }, { mark: 'line', encode: { x: 'load_time', y: 'pageviews@density' } }] } },
  league:  { label: 'League table: pages, with their change', spec: { spec: 'view/0', title: 'Top pages', query: { metrics: ['pageviews'], by: ['page'], range: '28d', compare: 'previous', limit: 8 },
            layers: [{ mark: 'text', encode: { y: 'page', text: 'pageviews@rank' }, role: 'context' }, { mark: 'text', encode: { y: 'page', text: 'page' } }, { mark: 'text', encode: { y: 'page', text: 'pageviews' }, align: 'end' }, { mark: 'text', encode: { y: 'page', text: 'pageviews' }, series: 'delta', align: 'end' }] } },
  conversions: { label: 'Columns: count, rate and value by event', spec: { spec: 'view/0', title: 'Conversions', query: { metrics: ['conversions', 'conversion_rate', 'conversion_value'], by: ['event'], range: '28d' },
            layers: [{ mark: 'bar', encode: { y: 'event', x: 'conversions' } }, { mark: 'text', encode: { y: 'event', text: 'event' } }, { mark: 'text', encode: { y: 'event', text: 'conversions' }, align: 'end' },
                     { mark: 'text', encode: { y: 'event', text: 'conversion_rate' }, align: 'end' }, { mark: 'text', encode: { y: 'event', text: 'conversion_value' }, align: 'end' }] } },
  funnel:  { label: 'Funnel: visitors by step, with the rate', spec: { spec: 'view/0', title: 'Checkout funnel', use: 'funnel', query: { metrics: ['visitors', 'conversion_rate'], by: ['step'], range: '28d' } } },
  // Ranges and ticks (step 3). They are swept, and have their golden scenes, in test/ranges.test.ts.
  box:     { label: 'Box plot: response time by page', spec: { spec: 'view/0', title: 'Response time by page', use: 'box-plot', query: { metrics: ['response_time'], by: ['page'], range: '28d', limit: 8 } } },
  errors:  { label: 'Error bars: response time by page, and the interval its mean is known to', spec: { spec: 'view/0', title: 'Mean response time', use: 'error-bars', query: { metrics: ['response_time'], by: ['page'], range: '28d', limit: 8 } } },
  waterfall: { label: 'Waterfall: net subscribers, day on day', spec: { spec: 'view/0', title: 'Net subscribers, running', use: 'waterfall', query: { metrics: ['net_subscribers'], by: ['date.day'], range: '28d' } } },
  candlestick: { label: 'Candlestick: response time by day', spec: { spec: 'view/0', title: 'Response time by day', use: 'candlestick', query: { metrics: ['response_time'], by: ['date.day'], range: '28d' } } },
  fan:     { label: 'Fan: response time by day, in the interval it is known to', spec: { spec: 'view/0', title: 'Response time', use: 'fan', query: { metrics: ['response_time'], by: ['date.day'], range: '28d' } } },
  dumbbell: { label: 'Dumbbell: page views by page, this period against the one before', spec: { spec: 'view/0', title: 'Page views, then and now', use: 'dumbbell', query: { metrics: ['pageviews'], by: ['page'], range: '28d', compare: 'previous', limit: 8 } } },
  bullet:  { label: 'Bullet: sign-ups by device, against the target', spec: { spec: 'view/0', title: 'Sign-ups against target', use: 'bullet', query: { metrics: ['signups'], by: ['device'], range: '28d' } } },
  map:     { label: 'A map: visitors by country', spec: { spec: 'view/0', title: 'Visitors by country', use: 'choropleth', query: { metrics: ['visitors'], by: ['country'], range: '28d' } } },
  symbols: { label: 'Symbols on a map: page views by country', spec: { spec: 'view/0', title: 'Page views by country', use: 'symbol-map', query: { metrics: ['pageviews'], by: ['country'], range: '28d' } } },
  // A split that spends no colour (docs/uncommon-coverage-plan.md, step 1): a line for each country, all in one paint.
  spaghetti: { label: 'Spaghetti: visitors by day, a line for each of fifteen countries', spec: { spec: 'view/0', title: 'Visitors by country, day by day', query: { metrics: ['visitors'], by: ['date.day', 'country'], range: '28d' },
            layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', detail: 'country' } }] } },
  tiles:   { label: 'A tile grid map: visitors by country, each an equal square', spec: { spec: 'view/0', title: 'Visitors by country', use: 'tile-grid-map', query: { metrics: ['visitors'], by: ['country'], range: '28d' } } },
  hexes:   { label: 'A hex tile map: visitors by country, each an equal hexagon', spec: { spec: 'view/0', title: 'Visitors by country', use: 'hex-tile-map', query: { metrics: ['visitors'], by: ['country'], range: '28d' } } },
  unmapped: { label: 'A map with rows it has no shape for: visitors by every country seen', spec: { spec: 'view/0', title: 'Visitors by country, all of them', query: { metrics: ['visitors'], by: ['visitor_country'], range: '28d' },
            layers: [{ mark: 'geo', encode: { x: 'visitor_country', color: 'visitors' } }] } },
  // The Uncommon types that today's marks already say (docs/uncommon-coverage-plan.md, step 0, and what it found in section 7).
  // `dumbbell`, `bullet` and `fan` above are three of them. Each is swept, and has its golden scenes, with the samples of its layout, and what each one is is in test/uncommon.test.ts.
  cleveland: { label: 'Cleveland dot plot: page views by page, ranked, so an ordered dot plot too', spec: { spec: 'view/0', title: 'Page views by page', use: 'dumbbell', query: { metrics: ['pageviews'], by: ['page'], range: '28d', limit: 8 } } },
  lollipop: { label: 'Lollipop: visitors by channel, a stem from zero to each dot', spec: { spec: 'view/0', title: 'Visitors by channel', query: { metrics: ['visitors'], by: ['channel'], range: '28d' },
            layers: [{ mark: 'rule', encode: { y: 'channel', x: 'visitors' }, role: 'context' }, { mark: 'dot', encode: { y: 'channel', x: 'visitors' } }, { mark: 'text', encode: { y: 'channel', text: 'channel' } }, { mark: 'text', encode: { y: 'channel', text: 'visitors' }, align: 'end' }] } },
  // Each bar states its paint: one with two ends is painted by which way it goes, and both of these go to zero.
  tornado: { label: 'Tornado: what each assumption could lose or gain of revenue, widest first', spec: { spec: 'view/0', title: 'What moves revenue', query: { metrics: ['revenue_effect'], by: ['factor'], range: '28d' },
            layers: [{ mark: 'bar', encode: { y: 'factor', x: 'revenue_effect@low', x2: 0 }, paint: 'delta.bad' }, { mark: 'bar', encode: { y: 'factor', x: 'revenue_effect@high', x2: 0 }, paint: 'delta.good' }, { mark: 'text', encode: { y: 'factor', text: 'factor' } }] } },
  pareto:  { label: 'Pareto: errors by cause, and the share the causes so far hold', spec: { spec: 'view/0', title: 'Errors by cause', query: { metrics: ['errors', 'errors_share'], by: ['cause'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'cause', y: 'errors' } }, { mark: 'line', encode: { x: 'cause', y: 'errors_share' }, paint: 'series.2' }] } },
  // A sparkline is not a spec's to ask for: it is what a line is where there is no room for its axes.
  sparkline: { label: 'Sparkline: one line, which a narrow container draws bare beside the number', spec: { spec: 'view/0', title: 'Visitors', query: { metrics: ['visitors'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }] } },
  fans:    { label: 'Fan, two bands: response time by day, inside its quartiles, inside its least and most', spec: { spec: 'view/0', title: 'Response time, and how far it ranged', query: { metrics: ['response_time'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'area', encode: { x: 'date.day', y: 'response_time@min', y2: 'response_time@max' }, role: 'context' }, { mark: 'area', encode: { x: 'date.day', y: 'response_time@p25', y2: 'response_time@p75' }, role: 'context' }, { mark: 'line', encode: { x: 'date.day', y: 'response_time' } }] } },
  streamgraph: { label: 'Streamgraph: page views by day and channel, stacked about the middle', spec: { spec: 'view/0', title: 'Page views by channel', query: { metrics: ['pageviews'], by: ['date.day', 'channel'], range: '28d' },
            layers: [{ mark: 'area', encode: { x: 'date.day', y: 'pageviews', color: 'channel' }, stack: 'center' }] } },
  slopegraph: { label: 'Slopegraph: visitors by channel, one whole week against the next', spec: { spec: 'view/0', title: 'Visitors by channel, week on week', query: { metrics: ['visitors'], by: ['date.week', 'channel'], range: '14d' },
            layers: [{ mark: 'line', encode: { x: 'date.week', y: 'visitors', color: 'channel' } }] } },
  cumulative: { label: 'Cumulative flow: sign-ups so far, by day and channel', spec: { spec: 'view/0', title: 'Sign-ups so far', query: { metrics: ['signups'], by: ['date.day', 'channel'], range: '28d' },
            layers: [{ mark: 'area', encode: { x: 'date.day', y: 'signups@running', color: 'channel' }, stack: 'zero' }] } },
  calendar: { label: 'Calendar heatmap: visitors by weekday and week', spec: { spec: 'view/0', title: 'Visitors, day by day', use: 'heatmap', query: { metrics: ['visitors'], by: ['weekday', 'date.week'], range: '28d' } } },
  stripes: { label: 'Stripes: net subscribers by day, one cell each. On the sequential ramp, so nothing is not neutral yet', spec: { spec: 'view/0', title: 'Net subscribers', query: { metrics: ['net_subscribers'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'cell', encode: { x: 'date.day', color: 'net_subscribers' } }] } },
  adjacency: { label: 'Adjacency matrix: page views by page and the page gone to next', spec: { spec: 'view/0', title: 'From page to page', use: 'heatmap', query: { metrics: ['pageviews'], by: ['page', 'next_page'], range: '28d' } } },
  embedding: { label: 'Embedding scatter: search terms, set out in two components', spec: { spec: 'view/0', title: 'Search terms', query: { metrics: ['embed_x', 'embed_y'], by: ['term'], range: '28d' },
            layers: [{ mark: 'dot', encode: { x: 'embed_x', y: 'embed_y' } }] } },
  stem:    { label: 'Stem-and-leaf: load times, the seconds and the tenths under each', spec: { spec: 'view/0', title: 'Load times', query: { metrics: ['requests'], by: ['load_stem'], range: '28d' },
            layers: [{ mark: 'text', encode: { y: 'load_stem', text: 'load_stem' } }, { mark: 'text', encode: { y: 'load_stem', text: 'load_stem@leaves' } }] } },
  // The `link` mark (step 8 of docs/uncommon-coverage-plan.md). Swept, with its golden scenes, in test/flow.test.ts.
  sankey:  { label: 'Sankey: visitors from channel to the section they land in', spec: { spec: 'view/0', title: 'Where visitors land', use: 'sankey', query: { metrics: ['visitors'], by: ['channel', 'section'], range: '28d' } } },
};
