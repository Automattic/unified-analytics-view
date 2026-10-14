import type { Catalog, Query, Result, Row } from '@unified-analytics/core';
import { apportion, seeded, type Scenario } from '@unified-analytics/fixtures';

/* The engine behind the sidebar test case: one page of a travel blog, as the mock-up has it. Its own catalog and
 * its own numbers, so the fixtures the tests sweep stay as they are. Every figure is stated for 30 days and the
 * days before them; another range takes the same share of it. */
/** The parts of the page and where each starts, for a surface to mark on a view by depth. */
export const sections = () => TABLES.section!.rows.map(([name], i) => ({ name, at: AT[i]! }));
export const catalog: Catalog = {
  metrics: {
    visitors:        { label: 'Visitors',        unit: 'count',   polarity: 'up' },
    views:           { label: 'Views',           unit: 'count',   polarity: 'up', rangeTotal: 'sum' },
    engaged_time:    { label: 'Engaged time',    unit: 's', polarity: 'up' },
    read_through:    { label: 'Read to the end', unit: 'ratio',   polarity: 'up' },
    new_subscribers: { label: 'New subscribers', unit: 'count',   polarity: 'up', rangeTotal: 'sum' },
    reached:         { label: 'Reached',         unit: 'ratio',   polarity: 'up' },
  },
  dimensions: {
    'date.day': { label: 'Day',              type: 'time' },
    section:    { label: 'Part of the page', type: 'categorical' },
    source:     { label: 'Source',           type: 'categorical' },
    origin:     { label: 'Page',             type: 'categorical' },
    depth:      { label: 'Depth, % of the page', type: 'number' },
  },
};

type Cell = [now: number, before: number];
/** Over 30 days. A count is a sum and is divided among the days; a time and a rate are the engine's own mean. */
const TOTALS: Record<string, Cell> = { visitors: [8412, 7511], views: [9640, 8720], engaged_time: [228, 209], read_through: [0.38, 0.396], new_subscribers: [57, 46] };
/** A dimension the fixture has one metric by, in the engine's order, which is not always by size. */
const TABLES: Record<string, { metric: string; rows: [string, ...Cell][] }> = {
  source:  { metric: 'visitors', rows: [['Search', 4210, 3600], ['Pinterest', 1630, 1500], ['AI assistants', 840, 410], ['Direct', 1010, 1050], ['Email', 520, 540], ['Facebook', 202, 411]] },
  origin:  { metric: 'new_subscribers', rows: [['This page', 21, 15], ['Olympic guide', 12, 11], ['Homepage', 9, 8], ['All 63 parks', 8, 7], ['Other', 7, 5]] },
  section: { metric: 'reached', rows: [['Opened', 1, 1], ['"When to go"', 0.82, 0.84], ['The middle', 0.61, 0.64], ['The Subscribe box', 0.47, 0.5], ['The end', 0.38, 0.396]] },
};

/** Which sources go together, as the engine says it with each row: the one this page is watching, and the rest. */
const KIND: Record<string, string> = { 'AI assistants': 'Watched' };
/** Where each part of the page starts, in percent of its length. Between them the share still reading falls evenly. */
const AT = [0, 28, 52, 71, 100], BIN = 5;
/** The share who reached a depth, and the share a period before. */
const reachedAt = (depth: number, col: 1 | 2) => {
  const i = Math.max(1, AT.findIndex((a) => a >= depth)), rows = TABLES.section!.rows, t = (depth - AT[i - 1]!) / (AT[i]! - AT[i - 1]!);
  return Math.round((rows[i - 1]![col] + (rows[i]![col] - rows[i - 1]![col]) * t) * 1000) / 1000;
};

const DAY = 86400000, TODAY = Date.UTC(2026, 9, 5), SPAN = 180;
const isCount = (m: string) => catalog.metrics[m]!.unit === 'count';
/** How each day stands to the average one, per metric: the week's rhythm, a slow climb and some noise. The last day is today, part done. */
const SHAPES = Object.fromEntries(Object.keys(TOTALS).map((m, k) => {
  const rand = seeded(101 + k);
  return [m, Array.from({ length: SPAN }, (_, i) => {
    const dow = new Date(TODAY - (SPAN - 1 - i) * DAY).getUTCDay(), noise = 0.8 + rand() * 0.4;
    return isCount(m) ? [0.8, 1.05, 1.1, 1.08, 1.02, 0.95, 0.85][dow]! * (0.9 + i / SPAN * 0.2) * noise * (i === SPAN - 1 ? 0.42 : 1) : 0.9 + (noise - 0.8) / 2;
  })];
}));

export function runQuery(q: Query, scenario: Scenario = 'typical'): Result {
  const metrics = q.metrics, by = q.by?.[0];
  const days = Math.min(90, parseInt(q.range || '') || 30), wantPrev = q.compare === 'previous', hasPrev = wantPrev && scenario !== 'no-prior';
  const meta: Result['meta'] = { range: days + 'd', compare: q.compare || null, notes: [] }, totals: Result['totals'] = {};
  const table = by && by !== 'date.day' && by !== 'depth' ? TABLES[by] : undefined;
  if (by && by !== 'date.day' && by !== 'depth' && !table) throw new Error('Unknown dimension "' + by + '". This page has: date.day, depth, ' + Object.keys(TABLES).join(', ') + '.');
  for (const m of metrics) {
    if (!catalog.metrics[m]) throw new Error('Unknown metric "' + m + '". This page has: ' + Object.keys(catalog.metrics).join(', ') + '.');
    if (by === 'depth' ? m !== 'reached' : table ? table.metric !== m : !TOTALS[m]) throw new Error('This page has "' + m + '" by ' + (Object.keys(TABLES).find((d) => TABLES[d]!.metric === m) ?? 'date.day') + ' only. Query it by that.');
  }
  if (scenario === 'empty') {
    for (const m of metrics) { totals[m] = 0; if (wantPrev) totals[m + '@previous'] = null; }
    return { rows: [], totals, meta: { ...meta, empty: true } };
  }
  const held = (m: string, n: number) => (isCount(m) ? Math.round(n * days / 30) : n);
  // The share who reached a part of the page has one figure for the whole page: the share who reached its end.
  for (const m of metrics) { const [now, before] = TOTALS[m] ?? TOTALS.read_through!; totals[m] = held(m, now); if (wantPrev) totals[m + '@previous'] = hasPrev ? held(m, before) : null; }
  if (!by) return { rows: [], totals, meta };
  // Bins are the engine's: each row says where its bin starts and ends, and the share who reached its start.
  if (by === 'depth') return { rows: Array.from({ length: 100 / BIN + 1 }, (_, i): Row => ({ depth: i * BIN, 'depth@end': (i + 1) * BIN, reached: reachedAt(i * BIN, 1), ...(wantPrev ? { 'reached@previous': hasPrev ? reachedAt(i * BIN, 2) : null } : {}) })), totals, meta };
  if (table) {
    const now = table.rows.map((r) => r[1]), before = table.rows.map((r) => r[2]), m = table.metric;
    const parts = isCount(m) ? [apportion(totals[m]!, now), apportion(held(m, TOTALS[m]![1]), before)] : [now, before];
    const rows = table.rows.map(([name], i): Row => ({ [by]: name, ...(by === 'source' ? { 'source@kind': KIND[name] ?? 'Other' } : {}), [m]: parts[0]![i]!, ...(wantPrev ? { [m + '@previous']: hasPrev ? parts[1]![i]! : null } : {}) }));
    return { rows: rows.slice(0, q.limit || undefined), totals, meta };
  }
  meta.notes.push('Today is still in progress.');
  const rows: Row[] = Array.from({ length: days }, (_, i) => ({ 'date.day': new Date(TODAY - (days - 1 - i) * DAY).toISOString().slice(0, 10), partial: i === days - 1 }));
  for (const m of metrics) {
    const shape = SHAPES[m]!, window = (end: number, total: number) => {
      const w = shape.slice(end - days, end);
      return isCount(m) ? apportion(total, w) : w.map((x) => Math.round(total * x * 1000) / 1000);
    };
    const now = window(SPAN, totals[m]!), before = window(SPAN - days, held(m, TOTALS[m]![1]));
    rows.forEach((r, i) => { r[m] = now[i]!; if (wantPrev) r[m + '@previous'] = hasPrev ? before[i]! : null; });
  }
  return { rows, totals, meta };
}
