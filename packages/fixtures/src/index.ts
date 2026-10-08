import type { Catalog, Query, Result, Row, Spec } from '@universal-analytics/core';
import { registerGeo, type Shapes } from '@universal-analytics/geo';
import shapes from './countries.json';

/** Boundary shapes for the `geo` mark: 123 countries, each with its name as its id, which is the value the `country`
 * dimension has for it. Natural Earth's 1:110m countries, by way of world-atlas 2.0.2, cut down for a fixture: borders
 * simplified to within 1.5 degrees, islands and countries under 6 square degrees left out, and Antarctica. Not for a product. */
export const countries: Shapes = shapes;
// Handed to the mark here, as a product would at startup, so every sample resolves wherever the fixtures are loaded.
registerGeo(countries);

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
    country:    { label: 'Country', type: 'categorical' },
    visitor_country: { label: 'Country', type: 'categorical' },
  },
};

function seeded(seed: number) {
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
    return { iso: new Date(t).toISOString().slice(0, 10), visitors, pageviews, net_subscribers, revenue, signups, response_time, times, partial };
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
// Where visitors are, by the name the boundary shapes know each country by.
MIX.country = [['United States', 0.31, 0.33], ['India', 0.12, 0.1], ['United Kingdom', 0.09, 0.1], ['Germany', 0.08, 0.08], ['Brazil', 0.07, 0.06], ['Canada', 0.06, 0.06], ['France', 0.05, 0.05],
  ['Australia', 0.045, 0.05], ['Japan', 0.04, 0.04], ['Spain', 0.035, 0.035], ['Mexico', 0.03, 0.03], ['Indonesia', 0.025, 0.02], ['Nigeria', 0.02, 0.015], ['South Africa', 0.015, 0.015], ['Sweden', 0.01, 0.015]];
// Every country the tracker saw, as real data has them: small ones the fixture's shapes leave out, and one it could not
// place, which arrives as an empty string.
MIX.visitor_country = [...MIX.country, ['Singapore', 0.012, 0.01], ['Malta', 0.006, 0.006], ['Bahrain', 0.004, 0.004], ['', 0.008, 0.008]];
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
type Cell = [now: number, before: number | null];
const TABLES: Record<string, { fields: string[]; ranked: boolean; rows: [string, ...Cell[]][]; totals: Record<string, Cell> }> = {
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
};
const LIVE = [{ page: '/', present: 3 }, { page: '/pricing', present: 2 }, { page: '/blog/launch-notes', present: 1 }, { page: '/docs/getting-started', present: 1 }];

export type Scenario = 'typical' | 'no-prior' | 'empty';
export const scenarios: Scenario[] = ['typical', 'no-prior', 'empty'];
type M = keyof Counts;
type D = keyof Daily;

/** `total` divided among weights in whole numbers that add up to it: the largest remainders take what rounding down leaves. */
function apportion(total: number, weights: number[]): number[] {
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
  const days = Math.min(28, parseInt(q.range || '') || 28), mix = seeded(days), vary = () => (days === 28 ? 1 : 0.5 + mix());
  const cur = DAILY.slice(56 - days), prev = DAILY.slice(56 - 2 * days, 56 - days);
  // A table's counts follow the range. A rate does not.
  const table = TABLES[by || ''], held = (m: string, n: number | null) => (n == null || catalog.metrics[m]!.unit === 'ratio' ? n : Math.round(n * days / 28));
  const elsewhere = metrics.find((m) => m !== 'page_conversion' && !(m in DAILY[0]!) && !(table && table.fields.indexOf(m) >= 0));
  if (elsewhere) throw new Error('The fixture has "' + elsewhere + '" by ' + Object.keys(TABLES).filter((d) => TABLES[d]!.fields.indexOf(elsewhere) >= 0).join(' or ') + ' only. Query it by that.');
  if (table && dims.length > 1) throw new Error('The fixture has "' + by + '" on its own, and not with a second dimension. Remove "' + dims[1] + '" from by.');
  metrics.forEach((m) => {
    const rate = m === 'page_conversion';
    const [now, before] = table && table.totals[m] ? table.totals[m]!.map((n) => held(m, n)) : rate ? [RATE, RATE - 0.2] : m === 'response_time' ? TIME : [sum(cur, m), sum(prev, m)];
    totals[m] = now!;
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
    if (table) {
      const missing = metrics.find((m) => table.fields.indexOf(m) < 0);
      if (missing) throw new Error('The fixture has "' + dim + '" with ' + table.fields.join(', ') + ', and not "' + missing + '". Query one of those.');
      return table.rows.map(([name, ...cells]) => {
        const r: Row = { [dim]: name };
        metrics.forEach((m) => { const [now, before] = cells[table.fields.indexOf(m)]!; r[m] = held(m, now); if (wantPrev) r[m + '@previous'] = hasPrev ? held(m, before) : null; });
        return r;
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
  if (table && !table.ranked) return { rows: rowsBy(by!).slice(0, q.limit || undefined), totals, meta };
  if (dims.length < 2) return { rows: !by ? rows : catalog.dimensions[by]!.type !== 'categorical' ? rowsBy(by) : ranked(top(rowsBy(by))), totals, meta };

  // Two dimensions: one row per pair. Each value of the outer one is divided among the inner one's, unevenly from one
  // to the next, so every pair adds up to the outer row it came from. Time, when it is there, is the outer one.
  // ponytail: a total by the inner dimension is the sum of its pairs, and is not held to what a query by it alone returns.
  const [outer, inner] = dims[1] === 'date.day' ? [dims[1], dims[0]!] : [dims[0]!, dims[1]!];
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
  const innerRows = values.map(([name]) => {
    const r: Row = { [inner]: name }, mine = pairs.filter((p) => p[inner] === name);
    fields.forEach((f) => { r[f] = mine.some((p) => p[f] != null) ? mine.reduce((s, p) => s + ((p[f] as number) || 0), 0) : null; });
    return r;
  });
  // `limit` keeps the first values of each categorical dimension. A total still covers what the limit left out of the other.
  const kept = (rs: Row[], dim: string) => { const names = dim === 'date.day' ? null : top(rs).map((r) => r[dim]); return names ? rs.filter((r) => names.indexOf(r[dim]) >= 0) : rs; };
  const totalsBy = { [outer]: kept(outerRows, outer), [inner]: kept(innerRows, inner) };
  const order = outer === 'date.day' ? outerRows : top(outerRows), within = totalsBy[inner]!.map((r) => r[inner]);
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
  map:     { label: 'A map: visitors by country', spec: { spec: 'view/0', title: 'Visitors by country', query: { metrics: ['visitors'], by: ['country'], range: '28d' },
            layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors' } }] } },
  symbols: { label: 'Symbols on a map: page views by country', spec: { spec: 'view/0', title: 'Page views by country', query: { metrics: ['pageviews'], by: ['country'], range: '28d' },
            layers: [{ mark: 'geo', encode: { x: 'country', size: 'pageviews' } }] } },
  unmapped: { label: 'A map with rows it has no shape for: visitors by every country seen', spec: { spec: 'view/0', title: 'Visitors by country, all of them', query: { metrics: ['visitors'], by: ['visitor_country'], range: '28d' },
            layers: [{ mark: 'geo', encode: { x: 'visitor_country', color: 'visitors' } }] } },
};
