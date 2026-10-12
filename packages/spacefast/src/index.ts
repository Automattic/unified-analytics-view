import type { Catalog, MetricDef, Polarity, Query, Result, Row, Unit } from '@unified-analytics/core';

/* Spacefast's analytics query API, as its contract has it (spacefast/monorepo, packages/common/src/contracts/analytics-query.ts,
 * read at b1e28cc). One answer of `POST /v1/spaces/{spaceId}/analytics/query` becomes what a view takes: a query, a
 * result and the catalog for them. The answer repeats its columns' metadata, so nothing else is asked of the API. */

type Cell = number | string | boolean | null | { amountMinor: number; currency: string }[];
type ApiRow = Record<string, Cell>;
export type ApiColumn =
  | { kind: 'time'; id: 'bucket'; label: string }
  | { kind: 'dimension'; id: string; label: string; valueType: string }
  | { kind: 'metric'; id: string; label: string; definition: string; unit: string; type: string; additive: boolean; bots: 'excluded' | 'only'; wholeDays: boolean; polarity: string };
interface ApiPeriod { since: string; until: string; rows: ApiRow[]; totals: ApiRow; truncated: boolean; other: ApiRow | null }
export interface ApiResult extends ApiPeriod { id: string; timezone: string; granularity: 'none' | 'hour' | 'day'; columns: ApiColumn[]; previous?: ApiPeriod | undefined }

export interface AdaptOptions {
  /** The metric the rows were ordered by, largest first, when it was not the first one. Its rank is the row's place. */
  rankedBy?: string;
}
export interface Adapted { query: Query; result: Result; catalog: Catalog }

const UNITS: Record<string, Unit> = { count: 'count', ms: 'ms', percent_points: 'percent' };
type Money = { amountMinor: number; currency: string }[];
const DAY = 86_400_000;
const POLARITY: Record<string, Polarity> = { up_is_good: 'up', down_is_good: 'down', neutral: 'none' };
// The digits of a currency's minor unit where they are not two, as ISO 4217 has them. The tracker's own table
// (LIVE_CURRENCY_DIGITS in spacefast's live-analytics-limits.ts), and not Intl's: Chrome gives 0 for seventeen codes that
// ISO gives 2 or 3, so an amount would mean one thing in Chrome and another in Safari.
const DIGITS: Record<string, number> = { bif: 0, clp: 0, djf: 0, gnf: 0, isk: 0, jpy: 0, kmf: 0, krw: 0, pyg: 0, rwf: 0, ugx: 0, uyi: 0, vnd: 0, vuv: 0, xaf: 0, xof: 0, xpf: 0,
  bhd: 3, iqd: 3, jod: 3, kwd: 3, lyd: 3, omr: 3, tnd: 3, clf: 4, uyw: 4 };
// An amount in its currency's own units, from its minor ones: cents to dollars, and yen as they are.
const major = (amount: number, currency: string) => amount / 10 ** (DIGITS[currency] ?? 2);
// The API takes any three letters as a currency, so a typo arrives as one. Core writes only the ones there are.
const WRITTEN = new Set(Intl.supportedValuesOf('currency').map((c) => c.toLowerCase()));

/** One answer as a view's query, result and catalog.
 * - The bucket is the time dimension `bucket`, and a row is `partial` where its bucket is not `complete`: the last while it is
 *   still filling, and the first or last of a range that starts or ends inside one. A range is kept as it was asked.
 * - `previous` is laid beside each row as `<metric>@previous`: bucket for bucket in a series, and by the breakdown's value in
 *   a list, null where the value was not there before.
 * - Time with a breakdown is refused: a view of two dimensions needs each one's totals over the other, which the API has not defined.
 * - A list's rows carry their place as `<metric>@rank`, since the API says rank is row order.
 * - A scroll bucket is a `number` dimension, ten points wide.
 * - A rise is good, bad or neither as the answer's column says, and a metric's definition is the column's.
 * - Totals are the API's own. `other` and `truncated` have no place in a result and are left behind.
 * - Money is a metric for each currency, `revenue.usd` and `revenue.eur`: the API never adds currencies together, and a view
 *   has one unit a metric. Its unit is the currency, its values are in the currency's own units, and a row with no amount in a
 *   currency has null there. Currencies come in the order of the totals. A code that is no currency is left out, and a note says so.
 */
export function adapt(api: ApiResult, options: AdaptOptions = {}): Adapted {
  if (!api || !Array.isArray(api.columns) || !Array.isArray(api.rows)) throw new Error('adapt() takes one answer of the analytics query API, with its `columns` and `rows`. A failed query has a `problem` and no rows: show that, or ask again.');
  const time = api.columns.some((c) => c.kind === 'time'), dim = api.columns.find((c) => c.kind === 'dimension');
  const all = api.columns.filter((c) => c.kind === 'metric'), periods = [api, ...(api.previous ? [api.previous] : [])];
  const amounts = (r: ApiRow | null | undefined, id: string) => (Array.isArray(r?.[id]) ? (r![id] as Money) : []);
  // Each column a view can draw: a metric as it is, and a money metric once for each currency any cell of it holds.
  let metrics = all.flatMap((c) => (c.type !== 'money' ? [{ ...c, of: c.id, name: c.label, currency: '' }]
    : [...new Set(periods.flatMap((p) => [p.totals, ...p.rows, p.other]).flatMap((r) => amounts(r, c.id).map((a) => a.currency)))]
      .map((currency) => ({ ...c, of: c.id, name: c.label, id: c.id + '.' + currency, label: c.label + ' (' + currency.toUpperCase() + ')', unit: currency, currency }))));
  const typos = metrics.filter((c) => c.currency && !WRITTEN.has(c.currency));
  metrics = metrics.filter((c) => !typos.includes(c));
  const bare = all.filter((c) => c.type === 'money' && !metrics.some((m) => m.of === c.id) && !typos.some((m) => m.of === c.id));
  if (time && dim) throw new Error('This answer is bucketed by time and broken down by "' + dim.id + '", which is not adapted: a view needs each one\'s totals over the other, and the API does not send them. Ask for the series and the breakdown as two queries in the batch.');
  const strange = metrics.find((c) => !c.currency && !UNITS[c.unit]), odd = metrics.find((c) => !POLARITY[c.polarity]);
  if (odd) throw new Error('The metric "' + odd.id + '" has the polarity "' + odd.polarity + '", and this adapter knows ' + Object.keys(POLARITY).join(', ') + '. Add it to POLARITY in packages/spacefast, with whether a rise is good.');
  if (strange) throw new Error('The metric "' + strange.id + '" is in "' + strange.unit + '", a unit this adapter has no match for. Add it to UNITS in packages/spacefast, with the core unit its values are written in.');
  if (!metrics.length) throw new Error('This answer has no metric a view can draw' + (bare.length ? ': "' + bare[0]!.id + '" has no amount in any currency over this range. Ask for a count beside it, or a longer range.' : typos.length ? ': "' + typos[0]!.currency + '" is not a currency. Ask for a count beside it, and correct the code where the event is tracked.' : '. Ask for at least one metric.'));

  const catalog: Catalog = { metrics: {}, dimensions: {} };
  for (const c of metrics) {
    const def: MetricDef = { label: c.label, unit: c.currency || UNITS[c.unit]!, polarity: POLARITY[c.polarity]!, ...(c.definition ? { definition: c.definition } : {}) };
    if (c.currency) def.rangeTotal = 'sum';
    if (c.id === 'visitor_days') def.rangeTotal = 'sum of daily';
    catalog.metrics[c.id] = def;
  }
  if (time) catalog.dimensions.bucket = { label: api.granularity === 'hour' ? 'Hour' : 'Day', type: 'time' };
  const bins = dim?.valueType === 'scroll_bucket';
  if (dim) catalog.dimensions[dim.id] = { label: dim.label, type: bins ? 'number' : 'categorical', ...(dim.valueType === 'country' ? { values: 'country' as const } : {}) };

  // A metric's value in a row: the number, or the amount in the metric's currency. Null where there is none.
  const value = (r: ApiRow | undefined, c: (typeof metrics)[number]): number | null => {
    if (!c.currency) return typeof r?.[c.id] === 'number' ? (r[c.id] as number) : null;
    const a = amounts(r, c.of).find((m) => m.currency === c.currency);
    return a ? major(a.amountMinor, c.currency) : null;
  };
  const before = api.previous, ranked = dim && !bins ? options.rankedBy ?? metrics[0]!.id : null;
  const was = (r: ApiRow, i: number) => (!before ? undefined : dim ? before.rows.find((p) => p[dim.id] === r[dim.id]) : before.rows[i]);
  const rows = api.rows.map((r, i): Row => {
    const row: Row = {}, prev = was(r, i);
    if (time) { row.bucket = r.bucket as string; row.partial = r.complete === false; }
    if (dim) {
      const v = r[dim.id] as string | null;
      row[dim.id] = bins && v != null ? Number(v) : v;
      if (bins) row[dim.id + '@end'] = v == null ? null : Number(v) + 10;
    }
    for (const c of metrics) {
      row[c.id] = value(r, c);
      if (before) row[c.id + '@previous'] = value(prev, c);
    }
    if (ranked) row[ranked + '@rank'] = i + 1;
    return row;
  });
  const totals: Result['totals'] = {};
  for (const c of metrics) {
    totals[c.id] = value(api.totals, c);
    if (before) totals[c.id + '@previous'] = value(before.totals, c);
  }

  const days = Math.max(1, Math.round((Date.parse(api.until) - Date.parse(api.since)) / DAY));
  const empty = [...api.rows, api.totals].every((r) => metrics.every((c) => !value(r, c)));
  const notes = [...bare.map((c) => c.label + ' has no amount in any currency over this range.'), ...typos.map((c) => c.name + ' in "' + c.currency + '" is left out: that is not a currency.')];
  if (time && api.rows.at(-1)?.complete === false) notes.push((api.granularity === 'hour' ? 'This hour' : 'Today') + ' is still in progress.');
  const query: Query = { metrics: metrics.map((c) => c.id), range: days + 'd' };
  const by = [...(time ? ['bucket'] : []), ...(dim ? [dim.id] : [])];
  if (by.length) query.by = by;
  if (before) query.compare = 'previous';
  return { query, catalog, result: { rows, totals, meta: { range: days + 'd', compare: before ? 'previous' : null, notes, ...(empty ? { empty } : {}) } } };
}
