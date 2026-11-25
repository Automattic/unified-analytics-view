import { formats, type Formats } from './format.ts';
import type { Catalog, MetricDef, Query, Result, Row, Where } from './types.ts';

/* What a view says in words. Each is made of the catalog's labels, the engine's figures and the view's own words
 * (words.ts), so it holds for a metric that counts no visits and for a host with no pages: core knows no name. The
 * words are `F`'s, which are its container's where it hands any, and English where a caller hands none. */
/** An empty range, under its zero: "Revenue: nothing yet". In place of the marks, with `period`: "Revenue: nothing in
 * this period yet". The label leads and is not made a noun of, so one that is a phrase reads too. */
export function emptyNote(metric: MetricDef, period = false, F: Formats = formats()): string {
  return F.say(period ? 'nothingInPeriod' : 'nothingYet', { metric: metric.label });
}
/** The range an answer is over, after what it is said of: " in the last 28 days". Empty where the answer names none, as
 * a query may: the sentence reads without it, and no period is made up. A range it cannot say is refused in resolve(). */
const over = (result: Result, F: Formats) => (result.meta.range ? F.say('over', { range: F.range(result.meta.range) }) : '');

/** The ends a colour scale is measured between: the domain the catalog states for the metric, or the least and the
 * most of the values. Where they cross zero the values are signed: read as below and above it, and never as shares. */
export function endsOf(vals: number[], metric?: MetricDef): [lo: number, hi: number] {
  return (metric && metric.domain) || [vals.length ? Math.min(...vals) : 0, vals.length ? Math.max(...vals) : 0];
}
export const crossesZero = ([lo, hi]: [number, number]) => lo < 0 && hi > 0;

/** The row for the value of a dimension that has the most of a metric: from the engine's totals by dimension where the
 * result has them, and otherwise from its rows, the first of equals. An engine that ranks its rows sends that one first;
 * one that answers in the dimension's own order, an hour or a weekday, does not. A comparison of the engine's numbers, never a sum. */
export function leader(result: Result, dim: string, m: string): Row | undefined {
  return most((result.totalsBy && result.totalsBy[dim]) || result.rows, m);
}
/** The row with the most of a field, the first of equals. A row with no figure only where none has one, and none only
 * where there are no rows. A comparison, never a sum. */
export const most = (rows: Row[], f: string): Row | undefined =>
  rows.reduce<Row | undefined>((top, r) => (!top || (r[f] != null && (top[f] == null || (r[f] as number) > (top[f] as number))) ? r : top), undefined);

/** A value as its share of the engine's total. With no total, or a total of zero, there is no share to say, so the
 * value is said itself: a share is never worked out of the rows. */
export const portion = (F: Formats, v: number, total: number | null | undefined, metric: MetricDef) => (total ? F.pct(v / total) : F.value(v, metric));

/** The tldr prose: the number block in words (reference, section 16). It says what the number says and nothing that a
 * kind of view adds, so every view's sentence is of one shape: each metric's total from the engine, with its change
 * and its target where it has them; then, where the query's first dimension is categorical, the value that leads it,
 * as the number's note names it, with its share where the view is of shares (`share`). What an answer is filtered to
 * is said after it, by the plan. It is derived, because a view's data is live and a sentence an author wrote is not.
 * Its numbers and dates are in the locale of `F`, and in English where none is handed in. */
export function tldrProse(q: Query, result: Result, share: boolean, catalog: Catalog, F: Formats = formats()): string {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, by = (q.by || [])[0];
  if (M.instant) return F.say('saidNow', { metric: M.label, value: F.value(t[m] || 0, M) });
  if (result.meta.empty) return F.say('nothingRecorded', { metric: M.label, over: over(result, F) });
  // Each metric the query asks for, the first with the range.
  const said = q.metrics.map((m, i) => {
    const M = catalog.metrics[m]!;
    // A total the engine has no figure for is said so. Under the number it is a dash, which a voice cannot say.
    let s = F.say('said', { metric: M.label, value: t[m] == null ? F.say('noFigure') : F.value(t[m], M), over: i ? '' : over(result, F) });
    if (q.compare === 'previous') {
      const d = F.delta(t[m] as number, t[m + '@previous'], M.polarity);
      s += d.pct != null ? F.say(d.pct > 0 ? 'saidUp' : 'saidDown', { change: F.pct(Math.abs(d.pct)) })
         : d.state === 'flat' ? F.say('saidLevel') : d.text ? F.say('saidNoPrior') : '';   // no figure, so no change is claimed
    }
    // Against its target, where the catalog gives it one: what a gauge shows.
    if (M.target && t[m] != null) s += F.say('saidTarget', { share: F.pct(t[m]! / M.target), target: F.value(M.target, M) });
    s = F.say('sentence', { clauses: s });
    if (M.rangeTotal === 'sum of daily') s += ' ' + F.say('saidSumOfDaily');
    return s;
  }).join(' ');
  // The leader, on the terms the number's note has it (`sceneNumber`): the engine's, and none where it has no figure.
  const dim = by ? catalog.dimensions[by]! : undefined, top = dim?.type === 'categorical' && result.rows.length ? leader(result, by!, m) : undefined;
  const pct = share && t[m] ? t[m]! : 0;
  if (!top || (!pct && top[m] == null) || top[by!] == null || top[by!] === '') return said;   // and none that has no name to say
  return said + ' ' + F.say(pct ? 'topSaidAt' : 'topSaid', { dimension: dim!.label, name: F.dimension(top[by!], dim!), share: pct ? F.pct(((top[m] as number) || 0) / pct) : '' });
}

/** What a filter holds each dimension to, in words: "channel Search or Social, and day from Sep 1 to Sep 7". A view
 * says it after its sentence ("Filtered to …") and of itself (`explain`), read off the answer as its range is, so it
 * says what it holds. Empty for an answer of everything. */
export function filterSaid(where: Where | undefined, catalog: Catalog, F: Formats = formats()): string {
  return Object.entries(where || {}).map(([d, held]) => {
    const dim = catalog.dimensions[d]!, v = (x: string | number) => F.dimension(x, dim), dimension = dim.label;
    // "a, b or c", in the view's words.
    const list = (items: string[]) => (items.length < 2 ? items.join('') : items.slice(0, -1).join(F.say('comma')) + F.say('or') + items[items.length - 1]);
    if (Array.isArray(held) || typeof held !== 'object') return F.say('held', { dimension, values: list([held].flat().map(v)) });
    const from = held.from != null ? v(held.from) : '', to = held.to != null ? v(held.to) : '';
    return held.to == null ? (held.from == null ? dimension.toLowerCase() : F.say('heldFrom', { dimension, from })) : F.say(held.from != null ? 'heldFromTo' : 'heldUpTo', { dimension, from, to });
  }).join(F.say('and'));
}

/** What follows a value from the unfinished bucket, as in "Visitors 175 so far". Empty for a finished one, so it also answers whether the row is partial. */
export function partialNote(row: Row, F: Formats = formats()): string {
  return row.partial ? F.say('soFar') : '';
}
/** The note an answer carries where its last bucket is unfinished, by the granularity of its buckets: "Today is still in progress." */
export function inProgressNote(granularity: string): string {
  return (granularity === 'hour' ? 'This hour' : 'Today') + ' is still in progress.';
}

/** What a view says of the rows it has no place to draw, by the label of their dimension: "12 countries not shown".
 * The table still lists them. Empty when there are none, so it also answers whether there is anything to say. */
export function notShownNote(count: number, label: string, F: Formats = formats()): string {
  return count ? F.say('notShown', { count: F.count(count), dimension: label }, count) : '';
}
