import type { Catalog, Query, Result, Row, Spec } from '@universal-analytics/core';

/* Stands in for the query layer and the engines. Totals come from the
 * "engine", never from summing the rows a view happens to receive. */
export const catalog: Catalog = {
  metrics: {
    visitors:  { label: 'Visitors',    unit: 'count', polarity: 'up',   rangeTotal: 'sum of daily' },
    pageviews: { label: 'Page views',  unit: 'count', polarity: 'up',   rangeTotal: 'sum' },
    present:   { label: 'Present now', unit: 'count', polarity: 'none', instant: true },
    net_subscribers: { label: 'Net subscribers', unit: 'count', polarity: 'up', rangeTotal: 'sum' },
  },
  dimensions: {
    'date.day': { label: 'Day',     type: 'time' },
    page:       { label: 'Page',    type: 'categorical' },
    channel:    { label: 'Channel', type: 'categorical' },
    device:     { label: 'Device',  type: 'categorical' },
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
/** What a day has and a page does not: sign-ups less cancellations, which falls below zero. */
type Daily = Counts & { net_subscribers: number };
const DAY = 86400000, TODAY = Date.UTC(2026, 9, 5);
const DAILY = (function () {
  // The first is the prototype's, drawn from in its order. What the prototype does not know draws from the second.
  const rand = seeded(11), more = seeded(23);
  return Array.from({ length: 56 }, function (_, i) {
    const t = TODAY - (55 - i) * DAY, dow = new Date(t).getUTCDay();
    const season = [0.72, 1.06, 1.12, 1.1, 1.04, 0.96, 0.7][dow]!;
    const launch = i === 45 ? 1.55 : i === 46 ? 1.25 : 1;
    let visitors = Math.round((330 + i * 1.6) * season * launch * (0.92 + rand() * 0.16));
    let pageviews = Math.round(visitors * (2.1 + rand() * 0.5));
    const partial = i === 55;
    if (partial) { visitors = Math.round(visitors * 0.42); pageviews = Math.round(pageviews * 0.42); }
    const net_subscribers = Math.round((more() - 0.45) * 40 * (partial ? 0.42 : 1));
    return { iso: new Date(t).toISOString().slice(0, 10), visitors, pageviews, net_subscribers, partial };
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
// A dimension whose values divide a total: each value's share of it, now and in the period before.
const MIX: Record<string, [string, number, number][]> = { channel: CHANNELS, device: DEVICES };
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
  metrics.forEach((m) => {
    totals[m] = sum(cur, m);
    if (wantPrev) totals[m + '@previous'] = hasPrev ? sum(prev, m) : null;
  });
  // One row per value of a dimension, in the dimension's own order, before any sort or limit.
  function rowsBy(dim: string): Row[] {
    if (dim === 'date.day') return cur.map((d, i) => {
      const r: Row = { 'date.day': d.iso, partial: d.partial };
      metrics.forEach((m) => { r[m] = d[m as D]; if (wantPrev) r[m + '@previous'] = hasPrev ? prev[i]![m as D] : null; });
      return r;
    });
    const perPage = metrics.find((m) => !(m in PAGES[0]!));
    if (dim === 'page' && perPage) throw new Error('The fixture has "' + perPage + '" by day, channel or device, and not page by page. Query it by one of those.');
    if (dim === 'page') return PAGES.map((p) => {
      const r: Row = { page: p.page };
      metrics.forEach((m) => { r[m] = Math.round(p[m as M] * days / 28 * vary()); if (wantPrev) r[m + '@previous'] = hasPrev && p.prev ? p.prev[m as M] : null; });
      return r;
    });
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
  // A categorical dimension is ranked by the first metric, and `limit` keeps its first values.
  const top = (rs: Row[]) => { const ranked = rs.slice().sort((a, b) => (b[m0] as number) - (a[m0] as number)); return q.limit ? ranked.slice(0, q.limit) : ranked; };
  if (dims.length < 2) return { rows: !by ? rows : by === 'date.day' ? rowsBy(by) : top(rowsBy(by)), totals, meta };

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
  stacked: { label: 'Stacked bars: visitors by day and device', spec: { spec: 'view/0', title: 'Visitors by device', query: { metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'visitors', color: 'device' }, stack: 'zero' }] } },
  grouped: { label: 'Grouped bars: channels by device', spec: { spec: 'view/0', title: 'Channels by device', query: { metrics: ['visitors'], by: ['channel', 'device'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'channel', y: 'visitors', color: 'device' } }] } },
  diverging: { label: 'Diverging bars: net subscribers by day', spec: { spec: 'view/0', title: 'Net subscribers', query: { metrics: ['net_subscribers'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'net_subscribers' } }] } },
  area:    { label: 'Stacked areas: page views by day and channel', spec: { spec: 'view/0', title: 'Page views by channel', query: { metrics: ['pageviews'], by: ['date.day', 'channel'], range: '28d' },
            layers: [{ mark: 'area', encode: { x: 'date.day', y: 'pageviews', color: 'channel' }, stack: 'zero' }] } },
};
