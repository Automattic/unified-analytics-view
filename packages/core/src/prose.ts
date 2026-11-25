import { formats, orList, type Formats } from './format.ts';
import type { Catalog, MetricDef, Query, Result, Row, Where } from './types.ts';

/* What a view says of a metric with nothing to show, and of one that is read now. Each is made of the catalog's label
 * and nothing else, so it holds for a metric that counts no visits and for a host with no pages: core knows no name.
 * ponytail: English, set here. A table of strings would be read here, and by the notes at the foot of this file. */
/** Beside the value of an instant metric, under the number and in the prose: it has no range to name. */
export const NOW = 'right now';
/** In the sentence, in place of a total the engine does not give. */
const NO_FIGURE = 'no figure';
/** An empty range, after the metric's label as the catalog writes it. The label leads and is not made a noun of, so
 * one that is a phrase reads too: "Came back: nothing recorded in the last 28 days." */
const nothing = (metric: MetricDef, rest: string) => metric.label + ': nothing ' + rest;
/** An empty range, under its zero: "Revenue: nothing yet". In place of the marks, with `period`: "Revenue: nothing in this period yet". */
export function emptyNote(metric: MetricDef, period = false): string {
  return nothing(metric, (period ? 'in this period ' : '') + 'yet');
}
/** The range an answer is over, after what it is said of: " in the last 28 days". Empty where the answer names none, as
 * a query may: the sentence reads without it, and no period is made up. A range it cannot say is refused in resolve(). */
const over = (result: Result, F: Formats) => (result.meta.range ? ' in the ' + F.range(result.meta.range) : '');

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

/** More than one of a dimension's values, by its label: "pages", "countries". */
export const plural = (label: string) => label.replace(/([^aeiou])y$/, '$1ie') + 's';
/** A label for `n` of a thing: itself for one, its plural for any other number. */
export const many = (n: number, label: string) => (n === 1 ? label : plural(label));

/** The tldr prose: the number block in words (reference, section 16). It says what the number says and nothing that a
 * kind of view adds, so every view's sentence is of one shape: each metric's total from the engine, with its change
 * and its target where it has them; then, where the query's first dimension is categorical, the value that leads it,
 * as the number's note names it, with its share where the view is of shares (`share`). What an answer is filtered to
 * is said after it, by the plan. It is derived, because a view's data is live and a sentence an author wrote is not.
 * Its numbers and dates are in the locale of `F`, and in English where none is handed in. */
export function tldrProse(q: Query, result: Result, share: boolean, catalog: Catalog, F: Formats = formats()): string {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, by = (q.by || [])[0];
  if (M.instant) return M.label + ': ' + F.value(t[m] || 0, M) + ' ' + NOW + '.';
  if (result.meta.empty) return nothing(M, 'recorded' + over(result, F) + '.');
  // Each metric the query asks for, the first with the range.
  const said = q.metrics.map((m, i) => {
    const M = catalog.metrics[m]!;
    // A total the engine has no figure for is said so. Under the number it is a dash, which a voice cannot say.
    let s = M.label + ': ' + (t[m] == null ? NO_FIGURE : F.value(t[m], M)) + (i ? '' : over(result, F));
    if (q.compare === 'previous') {
      const d = F.delta(t[m] as number, t[m + '@previous'], M.polarity);
      s += d.pct != null ? ', ' + (d.pct > 0 ? 'up ' : 'down ') + F.pct(Math.abs(d.pct)) + ' on the previous period'
         : d.state === 'flat' ? ', level with the previous period' : d.text ? ', with no prior period to compare' : '';   // no figure, so no change is claimed
    }
    // Against its target, where the catalog gives it one: what a gauge shows.
    if (M.target && t[m] != null) s += ', ' + F.pct(t[m]! / M.target) + ' of its target of ' + F.value(M.target, M);
    s += '.';
    if (M.rangeTotal === 'sum of daily') s += ' This is a sum of daily counts, not a unique count.';
    return s;
  }).join(' ');
  // The leader, on the terms the number's note has it (`sceneNumber`): the engine's, and none where it has no figure.
  const dim = by ? catalog.dimensions[by]! : undefined, top = dim?.type === 'categorical' && result.rows.length ? leader(result, by!, m) : undefined;
  const pct = share && t[m] ? t[m]! : 0;
  if (!top || (!pct && top[m] == null) || top[by!] == null || top[by!] === '') return said;   // and none that has no name to say
  return said + ' The top ' + dim!.label.toLowerCase() + ' is ' + F.dimension(top[by!], dim!) + (pct ? ', at ' + F.pct(((top[m] as number) || 0) / pct) : '') + '.';
}

/** What a filter holds each dimension to, in words: "channel Search or Social, and day from Sep 1 to Sep 7". A view
 * says it after its sentence ("Filtered to …") and of itself (`explain`), read off the answer as its range is, so it
 * says what it holds. Empty for an answer of everything. */
export function filterSaid(where: Where | undefined, catalog: Catalog, F: Formats = formats()): string {
  return Object.entries(where || {}).map(([d, held]) => {
    const dim = catalog.dimensions[d]!, v = (x: string | number) => F.dimension(x, dim), label = dim.label.toLowerCase();
    if (Array.isArray(held) || typeof held !== 'object') return label + ' ' + orList([held].flat().map(v));
    return label + (held.from != null ? ' from ' + v(held.from) : '') + (held.to != null ? (held.from != null ? ' to ' : ' up to ') + v(held.to) : '');
  }).join(', and ');
}

/** What follows a value from the unfinished bucket, as in "Visitors 175 so far". Empty for a finished one, so it also answers whether the row is partial. */
export function partialNote(row: Row): string {
  return row.partial ? 'so far' : '';
}
/** The note an answer carries where its last bucket is unfinished, by the granularity of its buckets: "Today is still in progress." */
export function inProgressNote(granularity: string): string {
  return (granularity === 'hour' ? 'This hour' : 'Today') + ' is still in progress.';
}

/** What a view says of the rows it has no place to draw, by the label of their dimension: "12 countries not shown".
 * The table still lists them. Empty when there are none, so it also answers whether there is anything to say. */
export function notShownNote(count: number, label: string, F: Formats = formats()): string {
  const name = label.toLowerCase();
  return count ? F.count(count) + ' ' + many(count, name) + ' not shown' : '';
}
