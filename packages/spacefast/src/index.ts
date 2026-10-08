import type { Catalog, MetricDef, Polarity, Query, Result, Row, Unit } from '@universal-analytics/core';

/* Spacefast's analytics query API, as its contract has it (spacefast/monorepo, packages/common/src/contracts/analytics-query.ts,
 * read at afd8faa, a draft). One answer of `POST /v1/spaces/{spaceId}/analytics/query` becomes what a view takes: a query, a
 * result and the catalog for them. The answer repeats its columns' metadata, so nothing else is asked of the API. */

type Cell = number | string | boolean | null | { amountMinor: number; currency: string }[];
type ApiRow = Record<string, Cell>;
export type ApiColumn =
  | { kind: 'time'; id: 'bucket'; label: string }
  | { kind: 'dimension'; id: string; label: string; valueType: string }
  | { kind: 'metric'; id: string; label: string; unit: string; type: string; additive: boolean; bots: 'excluded' | 'only'; wholeDays: boolean };
interface ApiPeriod { since: string; until: string; rows: ApiRow[]; totals: ApiRow; truncated: boolean; other: ApiRow | null }
export interface ApiResult extends ApiPeriod { id: string; timezone: string; granularity: 'none' | 'hour' | 'day'; columns: ApiColumn[]; previous?: ApiPeriod }

export interface AdaptOptions {
  /** Whether a rise is good, by metric id: the API's catalog does not say. Without one a metric is `up`, and a count of bots `none`. */
  polarity?: Record<string, Polarity>;
  /** The metric the rows were ordered by, largest first, when it was not the first one. Its rank is the row's place. */
  rankedBy?: string;
}
export interface Adapted { query: Query; result: Result; catalog: Catalog }

const UNITS: Record<string, Unit> = { count: 'count', ms: 'ms', percent_points: 'percent' };
type Money = { amountMinor: number; currency: string }[];
// An amount in its currency's own units, from its minor ones: cents to dollars, and yen as they are.
// ponytail: the exponent is ISO 4217's, as Intl has it. The API has not said whether Sell's table differs; if it does, it goes here.
const major = (amount: number, currency: string) => amount / 10 ** (new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2);
const DAY = 86_400_000;


/** One answer as a view's query, result and catalog.
 * - The bucket is the time dimension `bucket`, and a row of the bucket still filling is `partial`.
 * - `previous` is laid beside each row as `<metric>@previous`: bucket for bucket in a series, and by the breakdown's value in
 *   a list, null where the value was not there before.
 * - Time with a breakdown is refused: a view of two dimensions needs each one's totals over the other, which the API has not defined.
 * - A list's rows carry their place as `<metric>@rank`, since the API says rank is row order.
 * - A scroll bucket is a `number` dimension, ten points wide.
 * - Totals are the API's own. `other` and `truncated` have no place in a result and are left behind.
 * - Money is a metric for each currency, `revenue.usd` and `revenue.eur`: the API never adds currencies together, and a view
 *   has one unit a metric. Its unit is the currency, its values are in the currency's own units, and a row with no amount in a
 *   currency has null there. Currencies come in the order of the totals.
 */
export function adapt(api: ApiResult, options: AdaptOptions = {}): Adapted {
  if (!api || !Array.isArray(api.columns) || !Array.isArray(api.rows)) throw new Error('adapt() takes one answer of the analytics query API, with its `columns` and `rows`. A failed query has a `problem` and no rows: show that, or ask again.');
  const time = api.columns.some((c) => c.kind === 'time'), dim = api.columns.find((c) => c.kind === 'dimension');
  const all = api.columns.filter((c) => c.kind === 'metric'), periods = [api, ...(api.previous ? [api.previous] : [])];
  const amounts = (r: ApiRow | null | undefined, id: string) => (Array.isArray(r?.[id]) ? (r![id] as Money) : []);
  // Each column a view can draw: a metric as it is, and a money metric once for each currency any cell of it holds.
  const metrics = all.flatMap((c) => (c.type !== 'money' ? [{ ...c, of: c.id, currency: '' }]
    : [...new Set(periods.flatMap((p) => [p.totals, ...p.rows, p.other]).flatMap((r) => amounts(r, c.id).map((a) => a.currency)))]
      .map((currency) => ({ ...c, of: c.id, id: c.id + '.' + currency, label: c.label + ' (' + currency.toUpperCase() + ')', unit: currency, currency }))));
  const bare = all.filter((c) => c.type === 'money' && !metrics.some((m) => m.of === c.id));
  if (time && dim) throw new Error('This answer is bucketed by time and broken down by "' + dim.id + '", which is not adapted: a view needs each one\'s totals over the other, and the API does not send them. Ask for the series and the breakdown as two queries in the batch.');
  const strange = metrics.find((c) => !c.currency && !UNITS[c.unit]);
  if (strange) throw new Error('The metric "' + strange.id + '" is in "' + strange.unit + '", a unit this adapter has no match for. Add it to UNITS in packages/spacefast, with the core unit its values are written in.');
  if (!metrics.length) throw new Error('This answer has no metric a view can draw' + (bare.length ? ': "' + bare[0]!.id + '" has no amount in any currency over this range. Ask for a count beside it, or a longer range.' : '. Ask for at least one metric.'));

  const catalog: Catalog = { metrics: {}, dimensions: {} };
  for (const c of metrics) {
    const def: MetricDef = { label: c.label, unit: c.currency || UNITS[c.unit]!, polarity: options.polarity?.[c.id] ?? options.polarity?.[c.of] ?? (c.bots === 'only' ? 'none' : 'up') };
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
  const notes = bare.map((c) => c.label + ' has no amount in any currency over this range.');
  if (time && api.rows.some((r) => r.complete === false)) notes.push((api.granularity === 'hour' ? 'This hour' : 'Today') + ' is still in progress.');
  const query: Query = { metrics: metrics.map((c) => c.id), range: days + 'd' };
  const by = [...(time ? ['bucket'] : []), ...(dim ? [dim.id] : [])];
  if (by.length) query.by = by;
  if (before) query.compare = 'previous';
  return { query, catalog, result: { rows, totals, meta: { range: days + 'd', compare: before ? 'previous' : null, notes, ...(empty ? { empty } : {}) } } };
}
