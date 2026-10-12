import { delta, fmtPct, formatDimension, formatValue, rangeLabel } from './format.ts';
import type { Catalog, MetricDef, Query, Result, Row } from './types.ts';

/* What a view says of a metric with nothing to show, and of one that is read now. Each is made of the catalog's label
 * and nothing else, so it holds for a metric that counts no visits and for a host with no pages: core knows no name.
 * ponytail: English, set here. A table of strings would be read here, and by the notes at the foot of this file. */
/** Beside the value of an instant metric, under the number and in the prose: it has no range to name. */
export const NOW = 'right now';
/** An empty range, after the metric's label as the catalog writes it. The label leads and is not made a noun of, so
 * one that is a phrase reads too: "Came back: nothing recorded in the last 28 days." */
const nothing = (metric: MetricDef, rest: string) => metric.label + ': nothing ' + rest;
/** An empty range, under its zero: "Revenue: nothing yet". In place of the marks, with `period`: "Revenue: nothing in this period yet". */
export function emptyNote(metric: MetricDef, period = false): string {
  return nothing(metric, (period ? 'in this period ' : '') + 'yet');
}
/** The range an answer is over, after what it is said of: " in the last 28 days". Empty where the answer names none, as
 * a query may: the sentence reads without it, and no period is made up. A range it does not know is said as written. */
const over = (result: Result, lead = ' in the ') => (result.meta.range ? lead + rangeLabel(result.meta.range) : '');
/** A value of a dimension as a row or a legend writes it: a country's name for its code, a dash for no value. */
const say = (catalog: Catalog, d: string, r: Row) => formatDimension(r[d], catalog.dimensions[d]!);

/** The row for the value of a dimension that has the most of a metric: from the engine's totals by dimension where the
 * result has them, and otherwise the first row, which the engine ranks. A comparison of the engine's numbers, never a sum. */
export function leader(result: Result, dim: string, m: string): Row | undefined {
  const by = result.totalsBy && result.totalsBy[dim];
  return by ? by.reduce<Row | undefined>((top, r) => (!top || (r[m] as number) > (top[m] as number) ? r : top), undefined) : result.rows[0];
}

/** More than one of a dimension's values, by its label: "pages", "countries". */
const plural = (label: string) => label.replace(/([^aeiou])y$/, '$1ie') + 's';

/** The tldr prose: the text sibling of a view, derived from the query and the transforms, not from a named chart type. */
export function tldrProse(q: Query, result: Result, share: boolean, catalog: Catalog, points = false): string {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, rows = result.rows, dims = q.by || [], by = dims[0];
  const range = over(result), name = M.label.toLowerCase();
  if (M.instant) {
    // The count now, and the value of the query's dimension that holds the most of it: the first row, which the engine ranks.
    return M.label + ': ' + formatValue(t[m] || 0, M) + ' ' + NOW + (by && rows[0] ? '; the top ' + catalog.dimensions[by]!.label.toLowerCase() + ' is ' + say(catalog, by, rows[0]) + ' (' + formatValue(rows[0][m] as number, M) + ').' : '.');
  }
  if (result.meta.empty) return nothing(M, 'recorded' + range + '.');
  if (dims.length === 2 && result.totalsBy && rows.length) {
    // Two dimensions: who leads each, as a share of the engine's total. Over time, also on how many of the days.
    const label = (d: string) => catalog.dimensions[d]!.label.toLowerCase(), time = dims.find((d) => catalog.dimensions[d]!.type === 'time');
    const largest = (d: string) => { const top = leader(result, d, m)!; return say(catalog, d, top) + ' the largest ' + label(d) + ' at ' + fmtPct((top[m] as number) / (t[m] || 1)); };
    if (!time) return largest(by!).replace(' the ', ' is the ') + ' of ' + name + ', and ' + largest(dims[1]!) + '.';
    const split = dims.find((d) => d !== time)!, top = leader(result, split, m)![split], days = [...new Set(rows.map((r) => r[time]))];
    const led = days.filter((d) => { const at = rows.filter((r) => r[time] === d), mine = at.find((r) => r[split] === top); return !!mine && at.every((r) => r === mine || (r[m] as number) < (mine[m] as number)); }).length;
    return largest(split).replace(' the ', ' is the ') + ' of ' + name + range + ', and leads on ' + (led === days.length ? 'all ' + led : led + ' of ' + days.length) + ' ' + label(time) + 's.';
  }
  if (points && by && q.metrics.length > 1 && rows.length) {
    // Two metrics set against each other, a point for each value of a dimension: how far each runs, and which point is
    // furthest out on each. ponytail: "outliers" here are the two extremes, found by comparing rows. A test of how far
    // out a point is would be a statistic, and those are the engine's.
    const two = q.metrics.slice(0, 2), label = (f: string) => catalog.metrics[f]!.label.toLowerCase(), of = (f: string) => rows.map((r) => r[f] as number);
    const top = two.map((f) => say(catalog, by, rows.reduce((a, r) => ((r[f] as number) > (a[f] as number) ? r : a))));
    return 'Across ' + rows.length + ' ' + plural(catalog.dimensions[by]!.label.toLowerCase()) + range + ', ' + 'the range of ' + two.map((f) => label(f) + ' is ' + formatValue(Math.min(...of(f)), catalog.metrics[f]!) + ' to ' + formatValue(Math.max(...of(f)), catalog.metrics[f]!)).join(' and of ') + '. '
      + (top[0] === top[1] ? top[0] + ' is highest on both.' : top[0] + ' is highest on ' + label(two[0]!) + ' and ' + top[1] + ' on ' + label(two[1]!) + '.');
  }
  if (by && catalog.dimensions[by]!.type === 'number' && rows.length) {
    // A numeric dimension: the total, and the bin that holds the most of it.
    const top = rows.reduce((a, r) => ((r[m] as number) > (a[m] as number) ? r : a)), end = top[by + '@end'];
    return M.label + ': ' + formatValue(t[m], M) + range + '. The most, ' + formatValue(top[m] as number, M) + ', at a ' + catalog.dimensions[by]!.label.toLowerCase() + ' of ' + top[by] + (end == null ? '' : ' to ' + end) + '.';
  }
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
    const label = catalog.dimensions[by]!.label.toLowerCase();
    if (share && rows.length > 1) {
      const tot = t[m] || 1;
      return say(catalog, by, rows[0]!) + ' is the largest ' + label + ' at ' + fmtPct((rows[0]![m] as number) / tot) + ' of ' + name + ', followed by ' + say(catalog, by, rows[1]!) + ' at ' + fmtPct((rows[1]![m] as number) / tot) + '.';
    }
    // Several metrics by one dimension: the ranking is by the first, and the rest are said once, as the engine's totals. A metric it gives no total for is left out.
    const rest = q.metrics.slice(1).filter((x) => t[x] != null).map((x) => catalog.metrics[x]!.label.toLowerCase() + ' ' + formatValue(t[x], catalog.metrics[x]!));
    return 'Top ' + plural(label) + ' by ' + name + over(result, ', ') + ': ' + rows.slice(0, 3).map((r) => say(catalog, by, r) + ' (' + formatValue(r[m] as number, M) + ')').join(', ') + '.' + (rest.length ? ' Overall, ' + rest.join(' and ') + '.' : '');
  }
  // Each metric the query asks for, the first with the range.
  return q.metrics.map((m, i) => {
    const M = catalog.metrics[m]!;
    let s = M.label + ': ' + formatValue(t[m], M) + (i ? '' : range);
    if (q.compare === 'previous') {
      const d = delta(t[m] as number, t[m + '@previous'], M.polarity);
      s += d.pct != null ? ', ' + (d.pct > 0 ? 'up ' : 'down ') + fmtPct(Math.abs(d.pct)) + ' on the previous period'
         : d.state === 'flat' ? ', level with the previous period' : ', with no prior period to compare';
    }
    // Against its target, where the catalog gives it one: what a gauge shows.
    if (M.target && t[m] != null) s += ', ' + fmtPct(t[m]! / M.target) + ' of its target of ' + formatValue(M.target, M);
    s += '.';
    if (M.rangeTotal === 'sum of daily') s += ' This is a sum of daily counts, not a unique count.';
    return s;
  }).join(' ');
}

/** What a view with a range says after its own sentence: the least and the most the range holds over the rows.
 * `ends` are the two fields a row's range runs between. A comparison of the engine's numbers, as the leader is: nothing
 * is worked out. Empty where no row has an end. */
export function rangeProse(q: Query, result: Result, catalog: Catalog, ends: [string, string]): string {
  const by = (q.by || [])[0], rows = result.rows, vals = rows.flatMap((r) => ends.map((f) => r[f])).filter((v): v is number => typeof v === 'number');
  if (!by || !vals.length) return '';
  const M = catalog.metrics[ends[0].split('@')[0]!] || catalog.metrics[q.metrics[0]!]!;      // the metric the ends are companions of
  return ' Between ' + formatValue(Math.min(...vals), M) + ' and ' + formatValue(Math.max(...vals), M) + ' across ' + rows.length + ' ' + catalog.dimensions[by]!.label.toLowerCase() + (rows.length === 1 ? '' : 's') + '.';
}

/** The tldr prose for a metric by two dimensions on a grid: the cell that holds the most, and the busiest value of each
 * dimension as a share of the engine's total. The peak is a comparison of the engine's rows and the rest are its totals
 * by dimension: nothing is summed. Null where there is nothing to say it of, and the query's own sentence stands. */
export function gridProse(q: Query, result: Result, catalog: Catalog): string | null {
  const m = q.metrics[0]!, [a, b] = q.by || [], rows = result.rows.filter((r) => r[m] != null);
  if (result.meta.empty || !a || !b || !result.totalsBy || !rows.length) return null;
  const peak = rows.reduce((top, r) => ((r[m] as number) > (top[m] as number) ? r : top)), name = catalog.metrics[m]!.label.toLowerCase();
  const busiest = (d: string, is: string) => { const top = leader(result, d, m)!; return say(catalog, d, top) + is + ' the busiest ' + catalog.dimensions[d]!.label.toLowerCase() + ' at ' + fmtPct((top[m] as number) / (result.totals[m] || 1)); };
  return 'Most ' + name + ' at ' + say(catalog, a, peak) + ', ' + say(catalog, b, peak) + ' (' + formatValue(peak[m] as number, catalog.metrics[m]!) + ')' + over(result) + '. ' + busiest(a, ' is') + ' of ' + name + ', and ' + busiest(b, '') + '.';
}

/** What follows a value from the unfinished bucket, as in "Visitors 175 so far". Empty for a finished one, so it also answers whether the row is partial. */
export function partialNote(row: Row): string {
  return row.partial ? 'so far' : '';
}

/** What a view says of the rows it has no place to draw, by the label of their dimension: "12 countries not shown".
 * The table still lists them. Empty when there are none, so it also answers whether there is anything to say. */
export function notShownNote(count: number, label: string): string {
  const name = label.toLowerCase();
  return count ? count + ' ' + (count === 1 ? name : plural(name)) + ' not shown' : '';
}
