import { sum } from 'd3-array';
import { delta, fmt, fmtPct, rangeLabel } from './format.ts';
import type { Catalog, Query, Result } from './types.ts';

/** The text sibling of a view, derived from the query and the transforms, not from a named chart type. */
export function tldrProse(q: Query, result: Result, share: boolean, catalog: Catalog): string {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, rows = result.rows, by = (q.by || [])[0];
  const range = rangeLabel(result.meta.range), name = M.label.toLowerCase();
  if (M.instant) {
    const n = t[m] || 0;
    if (!n) return 'Nobody is on the site right now.';
    return n + (n === 1 ? ' person is' : ' people are') + ' on the site right now' + (rows[0] ? '; the busiest page is ' + rows[0].page + ' (' + rows[0][m] + ').' : '.');
  }
  if (result.meta.empty) return 'No ' + name + ' recorded in the ' + range + '.';
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
    const label = catalog.dimensions[by]!.label.toLowerCase();
    if (share && rows.length > 1) {
      const tot = sum(rows, (r) => r[m] as number) || 1;
      return rows[0]![by] + ' is the largest ' + label + ' at ' + fmtPct((rows[0]![m] as number) / tot) + ' of ' + name + ', followed by ' + rows[1]![by] + ' at ' + fmtPct((rows[1]![m] as number) / tot) + '.';
    }
    return 'Top ' + label + 's by ' + name + ', ' + range + ': ' + rows.slice(0, 3).map((r) => r[by] + ' (' + fmt(r[m] as number) + ')').join(', ') + '.';
  }
  let s = M.label + ': ' + fmt(t[m]) + ' in the ' + range;
  if (q.compare === 'previous') {
    const d = delta(t[m] as number, t[m + '@previous'], M.polarity);
    s += d.pct != null ? ', ' + (d.pct > 0 ? 'up ' : 'down ') + fmtPct(Math.abs(d.pct)) + ' on the previous period'
       : d.state === 'flat' ? ', level with the previous period' : ', with no prior period to compare';
  }
  s += '.';
  if (M.rangeTotal === 'sum of daily') s += ' This is a sum of daily counts, not unique people.';
  return s;
}
