import type { Catalog, Query, Result, Row, Spec } from '@universal-analytics/core';

/* Stands in for the query layer and the engines. Totals come from the
 * "engine", never from summing the rows a view happens to receive. */
export const catalog: Catalog = {
  metrics: {
    visitors:  { label: 'Visitors',    unit: 'count', polarity: 'up',   rangeTotal: 'sum of daily' },
    pageviews: { label: 'Page views',  unit: 'count', polarity: 'up',   rangeTotal: 'sum' },
    present:   { label: 'Present now', unit: 'count', polarity: 'none', instant: true },
  },
  dimensions: {
    'date.day': { label: 'Day',     type: 'time' },
    page:       { label: 'Page',    type: 'categorical' },
    channel:    { label: 'Channel', type: 'categorical' },
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
const DAY = 86400000, TODAY = Date.UTC(2026, 9, 5);
const DAILY = (function () {
  const rand = seeded(11);
  return Array.from({ length: 56 }, function (_, i) {
    const t = TODAY - (55 - i) * DAY, dow = new Date(t).getUTCDay();
    const season = [0.72, 1.06, 1.12, 1.1, 1.04, 0.96, 0.7][dow]!;
    const launch = i === 45 ? 1.55 : i === 46 ? 1.25 : 1;
    let visitors = Math.round((330 + i * 1.6) * season * launch * (0.92 + rand() * 0.16));
    let pageviews = Math.round(visitors * (2.1 + rand() * 0.5));
    const partial = i === 55;
    if (partial) { visitors = Math.round(visitors * 0.42); pageviews = Math.round(pageviews * 0.42); }
    return { iso: new Date(t).toISOString().slice(0, 10), visitors, pageviews, partial };
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
const LIVE = [{ page: '/', present: 3 }, { page: '/pricing', present: 2 }, { page: '/blog/launch-notes', present: 1 }, { page: '/docs/getting-started', present: 1 }];

export type Scenario = 'typical' | 'no-prior' | 'empty';
export const scenarios: Scenario[] = ['typical', 'no-prior', 'empty'];
type M = keyof Counts;

export function runQuery(q: Query, scenario: Scenario = 'typical'): Result {
  const metrics = q.metrics || [], by = (q.by || [])[0] || null;
  metrics.forEach((m) => { if (!catalog.metrics[m]) throw new Error('Unknown metric "' + m + '". The catalog has: ' + Object.keys(catalog.metrics).join(', ') + '.'); });
  if (by && !catalog.dimensions[by]) throw new Error('Unknown dimension "' + by + '". The catalog has: ' + Object.keys(catalog.dimensions).join(', ') + '.');
  const wantPrev = q.compare === 'previous', hasPrev = wantPrev && scenario !== 'no-prior';
  const meta: Result['meta'] = { range: q.range || '28d', compare: q.compare || null, notes: [] };
  const totals: Result['totals'] = {}; let rows: Row[] = [];
  const live = metrics.indexOf('present') >= 0;
  if (live && (metrics.length > 1 || (by && by !== 'page'))) throw new Error('"present" is an instantaneous count. Query it alone, optionally by page.');

  if (scenario === 'empty') {
    metrics.forEach((m) => { totals[m] = 0; if (wantPrev) totals[m + '@previous'] = null; });
    meta.empty = true;
    return { rows, totals, meta };
  }
  if (live) {
    totals.present = LIVE.reduce((s, d) => s + d.present, 0);
    meta.range = 'now';
    return { rows: by ? LIVE.map((d) => ({ ...d })) : [], totals, meta };
  }
  const sum = (ds: Counts[], m: string) => ds.reduce((s, d) => s + d[m as M], 0);
  // A shorter range is the last days of the same series, and a mix of its own. 28 days is the fixture as it always was.
  const days = Math.min(28, parseInt(q.range || '') || 28), mix = seeded(days), vary = () => (days === 28 ? 1 : 0.5 + mix());
  const cur = DAILY.slice(56 - days), prev = DAILY.slice(56 - 2 * days, 56 - days);
  metrics.forEach((m) => {
    totals[m] = sum(cur, m);
    if (wantPrev) totals[m + '@previous'] = hasPrev ? sum(prev, m) : null;
  });
  if (by === 'date.day') {
    rows = cur.map((d, i) => {
      const r: Row = { 'date.day': d.iso, partial: d.partial };
      metrics.forEach((m) => { r[m] = d[m as M]; if (wantPrev) r[m + '@previous'] = hasPrev ? prev[i]![m as M] : null; });
      return r;
    });
    meta.notes.push('Today is still in progress.');
  } else if (by === 'page') {
    rows = PAGES.map((p) => {
      const r: Row = { page: p.page };
      metrics.forEach((m) => { r[m] = Math.round(p[m as M] * days / 28 * vary()); if (wantPrev) r[m + '@previous'] = hasPrev && p.prev ? p.prev[m as M] : null; });
      return r;
    });
  } else if (by === 'channel') {
    rows = CHANNELS.map((c) => {
      const r: Row = { channel: c[0] };
      metrics.forEach((m) => { r[m] = Math.round(totals[m]! * c[1] * vary()); if (wantPrev) r[m + '@previous'] = hasPrev ? Math.round(totals[m + '@previous']! * c[2]) : null; });
      return r;
    });
  }
  if (by && by !== 'date.day') {
    const m0 = metrics[0]!;
    rows.sort((a, b) => (b[m0] as number) - (a[m0] as number));
    if (q.limit) rows = rows.slice(0, q.limit);
  }
  return { rows, totals, meta };
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
