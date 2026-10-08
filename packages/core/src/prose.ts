import { delta, fmt, fmtPct, formatDimension, formatValue, rangeLabel } from './format.ts';
import type { Catalog, Query, Result, Row } from './types.ts';

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
  const range = rangeLabel(result.meta.range), name = M.label.toLowerCase();
  if (M.instant) {
    const n = t[m] || 0;
    if (!n) return 'Nobody is on the site right now.';
    return n + (n === 1 ? ' person is' : ' people are') + ' on the site right now' + (rows[0] ? '; the busiest page is ' + rows[0].page + ' (' + rows[0][m] + ').' : '.');
  }
  if (result.meta.empty) return 'No ' + name + ' recorded in the ' + range + '.';
  if (dims.length === 2 && result.totalsBy && rows.length) {
    // Two dimensions: who leads each, as a share of the engine's total. Over time, also on how many of the days.
    const label = (d: string) => catalog.dimensions[d]!.label.toLowerCase(), time = dims.find((d) => catalog.dimensions[d]!.type === 'time');
    const largest = (d: string) => { const top = leader(result, d, m)!; return top[d] + ' the largest ' + label(d) + ' at ' + fmtPct((top[m] as number) / (t[m] || 1)); };
    if (!time) return largest(by!).replace(' the ', ' is the ') + ' of ' + name + ', and ' + largest(dims[1]!) + '.';
    const split = dims.find((d) => d !== time)!, top = leader(result, split, m)![split], days = [...new Set(rows.map((r) => r[time]))];
    const led = days.filter((d) => { const at = rows.filter((r) => r[time] === d), mine = at.find((r) => r[split] === top); return !!mine && at.every((r) => r === mine || (r[m] as number) < (mine[m] as number)); }).length;
    return largest(split).replace(' the ', ' is the ') + ' of ' + name + ' in the ' + range + ', and leads on ' + (led === days.length ? 'all ' + led : led + ' of ' + days.length) + ' ' + label(time) + 's.';
  }
  if (points && by && q.metrics.length > 1 && rows.length) {
    // Two metrics set against each other, a point for each value of a dimension: how far each runs, and which point is
    // furthest out on each. ponytail: "outliers" here are the two extremes, found by comparing rows. A test of how far
    // out a point is would be a statistic, and those are the engine's.
    const two = q.metrics.slice(0, 2), label = (f: string) => catalog.metrics[f]!.label.toLowerCase(), of = (f: string) => rows.map((r) => r[f] as number);
    const top = two.map((f) => rows.reduce((a, r) => ((r[f] as number) > (a[f] as number) ? r : a))[by]);
    return 'Across ' + rows.length + ' ' + plural(catalog.dimensions[by]!.label.toLowerCase()) + ' in the ' + range + ', ' + 'the range of ' + two.map((f) => label(f) + ' is ' + fmt(Math.min(...of(f))) + ' to ' + fmt(Math.max(...of(f)))).join(' and of ') + '. '
      + (top[0] === top[1] ? top[0] + ' is highest on both.' : top[0] + ' is highest on ' + label(two[0]!) + ' and ' + top[1] + ' on ' + label(two[1]!) + '.');
  }
  if (by && catalog.dimensions[by]!.type === 'number' && rows.length) {
    // A numeric dimension: the total, and the bin that holds the most of it.
    const top = rows.reduce((a, r) => ((r[m] as number) > (a[m] as number) ? r : a)), end = top[by + '@end'];
    return M.label + ': ' + fmt(t[m]) + ' in the ' + range + '. The most, ' + fmt(top[m] as number) + ', at a ' + catalog.dimensions[by]!.label.toLowerCase() + ' of ' + top[by] + (end == null ? '' : ' to ' + end) + '.';
  }
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
    const label = catalog.dimensions[by]!.label.toLowerCase();
    if (share && rows.length > 1) {
      const tot = t[m] || 1;
      return rows[0]![by] + ' is the largest ' + label + ' at ' + fmtPct((rows[0]![m] as number) / tot) + ' of ' + name + ', followed by ' + rows[1]![by] + ' at ' + fmtPct((rows[1]![m] as number) / tot) + '.';
    }
    // Several metrics by one dimension: the ranking is by the first, and the rest are said once, as the engine's totals. A metric it gives no total for is left out.
    const rest = q.metrics.slice(1).filter((x) => t[x] != null).map((x) => catalog.metrics[x]!.label.toLowerCase() + ' ' + formatValue(t[x], catalog.metrics[x]!));
    return 'Top ' + plural(label) + ' by ' + name + ', ' + range + ': ' + rows.slice(0, 3).map((r) => r[by] + ' (' + fmt(r[m] as number) + ')').join(', ') + '.' + (rest.length ? ' Overall, ' + rest.join(' and ') + '.' : '');
  }
  // Each metric the query asks for, the first with the range.
  return q.metrics.map((m, i) => {
    const M = catalog.metrics[m]!;
    let s = M.label + ': ' + fmt(t[m]) + (i ? '' : ' in the ' + range);
    if (q.compare === 'previous') {
      const d = delta(t[m] as number, t[m + '@previous'], M.polarity);
      s += d.pct != null ? ', ' + (d.pct > 0 ? 'up ' : 'down ') + fmtPct(Math.abs(d.pct)) + ' on the previous period'
         : d.state === 'flat' ? ', level with the previous period' : ', with no prior period to compare';
    }
    // Against its target, where the catalog gives it one: what a gauge shows.
    if (M.target && t[m] != null) s += ', ' + fmtPct(t[m]! / M.target) + ' of its target of ' + fmt(M.target);
    s += '.';
    if (M.rangeTotal === 'sum of daily') s += ' This is a sum of daily counts, not unique people.';
    return s;
  }).join(' ');
}

/** What a view with a range says after its own sentence: the least and the most the range holds over the rows.
 * `ends` are the two fields a row's range runs between. A comparison of the engine's numbers, as the leader is: nothing
 * is worked out. Empty where no row has an end. */
export function rangeProse(q: Query, result: Result, catalog: Catalog, ends: [string, string]): string {
  const by = (q.by || [])[0], rows = result.rows, vals = rows.flatMap((r) => ends.map((f) => r[f])).filter((v): v is number => typeof v === 'number');
  if (!by || !vals.length) return '';
  return ' Between ' + fmt(Math.min(...vals)) + ' and ' + fmt(Math.max(...vals)) + ' across ' + rows.length + ' ' + catalog.dimensions[by]!.label.toLowerCase() + (rows.length === 1 ? '' : 's') + '.';
}

/** The tldr prose for a metric by two dimensions on a grid: the cell that holds the most, and the busiest value of each
 * dimension as a share of the engine's total. The peak is a comparison of the engine's rows and the rest are its totals
 * by dimension: nothing is summed. Null where there is nothing to say it of, and the query's own sentence stands. */
export function gridProse(q: Query, result: Result, catalog: Catalog): string | null {
  const m = q.metrics[0]!, [a, b] = q.by || [], rows = result.rows.filter((r) => r[m] != null);
  if (result.meta.empty || !a || !b || !result.totalsBy || !rows.length) return null;
  const peak = rows.reduce((top, r) => ((r[m] as number) > (top[m] as number) ? r : top)), name = catalog.metrics[m]!.label.toLowerCase();
  const say = (d: string, r: Row) => formatDimension(r[d], catalog.dimensions[d]!);
  const busiest = (d: string, is: string) => { const top = leader(result, d, m)!; return say(d, top) + is + ' the busiest ' + catalog.dimensions[d]!.label.toLowerCase() + ' at ' + fmtPct((top[m] as number) / (result.totals[m] || 1)); };
  return 'Most ' + name + ' at ' + say(a, peak) + ', ' + say(b, peak) + ' (' + fmt(peak[m] as number) + ') in the ' + rangeLabel(result.meta.range) + '. ' + busiest(a, ' is') + ' of ' + name + ', and ' + busiest(b, '') + '.';
}

/** What follows a value from the unfinished bucket, as in "Visitors 175 so far". Empty for a finished one, so it also answers whether the row is partial. */
export function partialNote(row: Row): string {
  return row.partial ? 'so far' : '';
}
