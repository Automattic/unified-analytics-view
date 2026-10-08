import { delta, fmt, fmtPct, formatValue, rangeLabel } from './format.ts';
import type { Catalog, Query, Result, Row } from './types.ts';

/** The row for the value of a dimension that has the most of a metric: from the engine's totals by dimension where the
 * result has them, and otherwise the first row, which the engine ranks. A comparison of the engine's numbers, never a sum. */
export function leader(result: Result, dim: string, m: string): Row | undefined {
  const by = result.totalsBy && result.totalsBy[dim];
  return by ? by.reduce<Row | undefined>((top, r) => (!top || (r[m] as number) > (top[m] as number) ? r : top), undefined) : result.rows[0];
}

/** The tldr prose: the text sibling of a view, derived from the query and the transforms, not from a named chart type. */
export function tldrProse(q: Query, result: Result, share: boolean, catalog: Catalog): string {
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
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
    const label = catalog.dimensions[by]!.label.toLowerCase();
    if (share && rows.length > 1) {
      const tot = t[m] || 1;
      return rows[0]![by] + ' is the largest ' + label + ' at ' + fmtPct((rows[0]![m] as number) / tot) + ' of ' + name + ', followed by ' + rows[1]![by] + ' at ' + fmtPct((rows[1]![m] as number) / tot) + '.';
    }
    // Several metrics by one dimension: the ranking is by the first, and the rest are said once, as the engine's totals. A metric it gives no total for is left out.
    const rest = q.metrics.slice(1).filter((x) => t[x] != null).map((x) => catalog.metrics[x]!.label.toLowerCase() + ' ' + formatValue(t[x], catalog.metrics[x]!));
    return 'Top ' + label + 's by ' + name + ', ' + range + ': ' + rows.slice(0, 3).map((r) => r[by] + ' (' + fmt(r[m] as number) + ')').join(', ') + '.' + (rest.length ? ' Overall, ' + rest.join(' and ') + '.' : '');
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
    s += '.';
    if (M.rangeTotal === 'sum of daily') s += ' This is a sum of daily counts, not unique people.';
    return s;
  }).join(' ');
}

/** What follows a value from the unfinished bucket, as in "Visitors 175 so far". Empty for a finished one, so it also answers whether the row is partial. */
export function partialNote(row: Row): string {
  return row.partial ? 'so far' : '';
}
