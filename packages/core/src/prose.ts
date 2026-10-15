import { delta, fmtPct, formatBin, formatDimension, formatUnit, formatValue, rangeLabel } from './format.ts';
import { baseOf, type Catalog, type MetricDef, type Query, type Result, type Row } from './types.ts';

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
 * a query may: the sentence reads without it, and no period is made up. A range it cannot say is refused in resolve(). */
const over = (result: Result, lead = ' in the ') => (result.meta.range ? lead + rangeLabel(result.meta.range) : '');
/** A value of a dimension as a row or a legend writes it: a country's name for its code, a dash for no value. */
const say = (catalog: Catalog, d: string, r: Row) => formatDimension(r[d], catalog.dimensions[d]!);

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
/** The metric a companion field came with: "visitors" for "visitors@rank". Its own name for a field that is no companion. */
const companionOf = (catalog: Catalog, f: string): MetricDef | undefined => catalog.metrics[baseOf(f)];
/** The row with the most of a field, the first of equals. A comparison, never a sum. */
export const most = (rows: Row[], f: string): Row | undefined => rows.reduce<Row | undefined>((top, r) => (!top || (r[f] as number) > (top[f] as number) ? r : top), undefined);
/** Rows from the most of a metric to the least. Rows the engine ranked stay as they are; rows in a dimension's own order are ranked here, by comparing them. */
const ranked = (rows: Row[], m: string) => rows.slice().sort((a, b) => ((b[m] as number) || 0) - ((a[m] as number) || 0));

/** A value as its share of the engine's total. With no total, or a total of zero, there is no share to say, so the
 * value is said itself: a share is never worked out of the rows. */
export const portion = (v: number, total: number | null | undefined, metric: MetricDef) => (total ? fmtPct(v / total) : formatValue(v, metric));
/** The same after a name in a sentence: " at 68% of visitors", or the value in brackets where there is no share. */
const at = (v: number, total: number | null | undefined, metric: MetricDef, of = '') => (total ? ' at ' + fmtPct(v / total) + of : ' (' + formatValue(v, metric) + ')');

/** More than one of a dimension's values, by its label: "pages", "countries". */
export const plural = (label: string) => label.replace(/([^aeiou])y$/, '$1ie') + 's';
/** A label for `n` of a thing: itself for one, its plural for any other number. */
export const many = (n: number, label: string) => (n === 1 ? label : plural(label));
/** How many of a whole: "all 5" where it is all of them, "3 of 5" where it is not. */
const allOrSome = (n: number, of: number) => (n === of ? 'all ' + n : n + ' of ' + of);
/** Which value is highest on each of two metrics, by their labels: one sentence for both where it is the same value. */
const highest = (top: string[], on: string[]) => (top[0] === top[1] ? top[0] + ' is highest on both.' : top[0] + ' is highest on ' + on[0] + ' and ' + top[1] + ' on ' + on[1] + '.');

/** The tldr prose: the text sibling of a view, derived from the query and the transforms, not from a named chart type.
 * `points` says the view sets one metric against another, a point for each value of a dimension: that dimension's name,
 * or `true` for the query's first. `path` says a line joins those points in the rows' order. */
export function tldrProse(q: Query, result: Result, share: boolean, catalog: Catalog, points: boolean | string | undefined = false, path = false): string {
  const m = q.metrics[0]!, M = catalog.metrics[m]!, t = result.totals, rows = result.rows, dims = q.by || [], by = dims[0];
  const range = over(result), name = M.label.toLowerCase();
  if (M.instant) {
    // The count now, and the value of the query's dimension that holds the most of it: the first row, which the engine ranks.
    return M.label + ': ' + formatValue(t[m] || 0, M) + ' ' + NOW + (by && rows[0] ? '; the top ' + catalog.dimensions[by]!.label.toLowerCase() + ' is ' + say(catalog, by, rows[0]) + ' (' + formatValue(rows[0][m] as number, M) + ').' : '.');
  }
  if (result.meta.empty) return nothing(M, 'recorded' + range + '.');
  // Points come before two dimensions: a second one there only colours the points, and has no total to lead with.
  if (points && by && q.metrics.length > 1 && rows.length) {
    // Two metrics set against each other, a point for each value of a dimension: how far each runs, and which point is
    // furthest out on each. ponytail: "outliers" here are the two extremes, found by comparing rows. A test of how far
    // out a point is would be a statistic, and those are the engine's.
    const of = typeof points === 'string' ? points : by, two = q.metrics.slice(0, 2), label = (f: string) => catalog.metrics[f]!.label.toLowerCase(), vals = (f: string) => rows.map((r) => r[f] as number);
    const top = two.map((f) => say(catalog, of, most(rows, f)!)), tops = highest(top, two.map(label));
    // Joined through time, the points are a path: where it set out and where it has got to, by the first and the last
    // finished bucket, since the unfinished one is not yet anywhere.
    const whole = rows.filter((r) => !r.partial), [a, b] = [whole[0], whole[whole.length - 1]];
    if (path && catalog.dimensions[of]!.type === 'time' && a && b && a !== b)
      return 'From ' + say(catalog, of, a) + ' to ' + say(catalog, of, b) + ', ' + two.map((f, i) => label(f) + (i ? ' from ' : ' went from ') + formatValue(a[f] as number, catalog.metrics[f]!) + ' to ' + formatValue(b[f] as number, catalog.metrics[f]!)).join(' and ') + '. '
        + tops;
    return 'Across ' + rows.length + ' ' + plural(catalog.dimensions[of]!.label.toLowerCase()) + range + ', ' + 'the range of ' + two.map((f) => label(f) + ' is ' + formatValue(Math.min(...vals(f)), catalog.metrics[f]!) + ' to ' + formatValue(Math.max(...vals(f)), catalog.metrics[f]!)).join(' and of ') + '. '
      + tops;
  }
  if (dims.length === 2 && result.totalsBy && rows.length) {
    // Two dimensions: who leads each, as a share of the engine's total. Over time, also on how many of the days.
    const label = (d: string) => catalog.dimensions[d]!.label.toLowerCase(), time = dims.find((d) => catalog.dimensions[d]!.type === 'time');
    const largest = (d: string, of = '') => { const top = leader(result, d, m)!; return say(catalog, d, top) + ' the largest ' + label(d) + at(top[m] as number, t[m], M, of); };
    if (!time) return largest(by!, ' of ' + name).replace(' the ', ' is the ') + ', and ' + largest(dims[1]!) + '.';
    const split = dims.find((d) => d !== time)!, top = leader(result, split, m)![split], days = [...new Set(rows.map((r) => r[time]))];
    const led = days.filter((d) => { const at = rows.filter((r) => r[time] === d), mine = at.find((r) => r[split] === top); return !!mine && at.every((r) => r === mine || (r[m] as number) < (mine[m] as number)); }).length;
    return largest(split, ' of ' + name).replace(' the ', ' is the ') + range + ', and leads on ' + allOrSome(led, days.length) + ' ' + plural(label(time)) + '.';
  }
  if (by && catalog.dimensions[by]!.type === 'number' && rows.length) {
    // A numeric dimension: the total, and the bin that holds the most of it.
    const top = most(rows, m)!, end = top[by + '@end'];
    return M.label + ': ' + formatValue(t[m], M) + range + '. The most, ' + formatValue(top[m] as number, M) + ', at a ' + catalog.dimensions[by]!.label.toLowerCase() + ' of ' + top[by] + (end == null ? '' : ' to ' + end) + '.';
  }
  if (by && catalog.dimensions[by]!.type !== 'time' && rows.length) {
    const label = catalog.dimensions[by]!.label.toLowerCase(), rows = ranked(result.rows, m);
    if (share && rows.length > 1 && t[m]) {                                  // with no total there is no share: the ranking is said, by value
      const tot = t[m]!;
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
         : d.state === 'flat' ? ', level with the previous period' : d.text ? ', with no prior period to compare' : '';   // no figure, so no change is claimed
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
  const M = companionOf(catalog, ends[0]) || catalog.metrics[q.metrics[0]!]!;      // the metric the ends are companions of
  return ' Between ' + formatValue(Math.min(...vals), M) + ' and ' + formatValue(Math.max(...vals), M) + ' across ' + rows.length + ' ' + many(rows.length, catalog.dimensions[by]!.label.toLowerCase()) + '.';
}

/** What a view of ranks says: which value of the split is first, and on how many of the values along x, and then who
 * rose or fell the furthest from the first of those to the last. `field` holds each row's rank, 1 the first, as the
 * engine returned it. Every clause is a comparison of those ranks, as the leader is: none is worked out here.
 * Null where there is nothing to say it of, and the query's own sentence stands. */
export function rankProse(q: Query, result: Result, catalog: Catalog, field: string, x: string): string | null {
  const split = (q.by || []).find((d) => d !== x), rows = result.rows.filter((r) => r[field] != null);
  if (result.meta.empty || !split || !rows.length) return null;
  const xs = [...new Set(rows.map((r) => r[x]))], names = [...new Set(rows.map((r) => r[split]))], rank = (r: Row) => r[field] as number, place = (n: number) => formatUnit(n, 'rank');
  const of = (name: Row[string]) => rows.filter((r) => r[split] === name), firsts = (name: Row[string]) => of(name).filter((r) => rank(r) === 1).length;
  const top = names.reduce((a, n) => (firsts(n) > firsts(a) ? n : a)), n = firsts(top), dim = catalog.dimensions[x]!.label.toLowerCase(), what = catalog.dimensions[split]!.label.toLowerCase();
  // A companion's rank is by the metric it came with. A metric that is itself a rank is by nothing else.
  const of_ = field.includes('@') ? companionOf(catalog, field) : undefined, by = of_ ? ' by ' + of_.label.toLowerCase() : '';
  const said = (name: Row[string]) => say(catalog, split, { [split]: name });
  let s = (result.meta.range ? 'In the ' + rangeLabel(result.meta.range) + ', ' : '') + said(top) + ' is first' + by + ' on ' + allOrSome(n, xs.length) + ' ' + many(xs.length, dim) + '.';
  if (xs.length < 2) return s;
  // From the first value along x to the last: the furthest rise, the furthest fall. A lower rank is a rise.
  const moved = names.map((name) => { const at = of(name); return { name, from: rank(at[0]!), to: rank(at[at.length - 1]!) }; }).filter((m) => m.from !== m.to);
  const rose = moved.filter((m) => m.to < m.from).sort((a, b) => (b.from - b.to) - (a.from - a.to))[0], fell = moved.filter((m) => m.to > m.from).sort((a, b) => (b.to - b.from) - (a.to - a.from))[0];
  const went = (m: { name: Row[string]; from: number; to: number }, verb: string) => said(m.name) + ' ' + verb + ' from ' + place(m.from) + ' to ' + place(m.to);
  if (rose || fell) s += ' ' + [rose && went(rose, 'rose'), fell && went(fell, 'fell')].filter(Boolean).join(', and ') + '.';
  else s += names.some((name) => new Set(of(name).map(rank)).size > 1) ? ' Places changed along the way, and each ' + what + ' ended where it began.' : ' No ' + what + ' changed place.';
  return s;
}

/** What a view says after its own sentence where an area between two ends is painted by direction: on how many of
 * the finished rows the second end is above the first, and on how many below. `ends` are the two fields. A count of
 * comparisons between the engine's numbers, row by row, and no sum. Empty where no finished row has both. */
export function differenceProse(q: Query, result: Result, catalog: Catalog, ends: [string, string | number]): string {
  const by = (q.by || [])[0], [from, to] = ends, at = (r: Row, f: string | number) => (typeof f === 'number' ? f : (r[f] as number | null | undefined));
  const rows = result.rows.filter((r) => !r.partial && at(r, from) != null && at(r, to) != null);
  if (!by || !rows.length) return '';
  const above = rows.filter((r) => at(r, to)! > at(r, from)!).length, below = rows.filter((r) => at(r, to)! < at(r, from)!).length, dim = catalog.dimensions[by]!.label.toLowerCase();
  // What the first end is called: the period before, a companion by its own label or its suffix, a metric by its label.
  const M = catalog.metrics[from], name = from.endsWith('@previous') ? 'the previous period' : M ? M.label.toLowerCase() : from.slice(from.indexOf('@') + 1);
  return ' Above ' + name + ' on ' + above + ' of ' + rows.length + ' ' + many(rows.length, dim) + (below ? ', and below it on ' + below : '') + '.';
}

/** The tldr prose for a metric by two dimensions on a grid: the cell that holds the most, and the busiest value of each
 * dimension as a share of the engine's total. The peak is a comparison of the engine's rows and the rest are its totals
 * by dimension: nothing is summed. Null where there is nothing to say it of, and the query's own sentence stands. */
export function gridProse(q: Query, result: Result, catalog: Catalog): string | null {
  const m = q.metrics[0]!, [a, b] = q.by || [], rows = result.rows.filter((r) => r[m] != null);
  if (result.meta.empty || !a || !b || !result.totalsBy || !rows.length) return null;
  const peak = most(rows, m)!, name = catalog.metrics[m]!.label.toLowerCase();
  // A bin is said by both its ends, as its row label is, and in a pair by its dimension too: two bare ranges do not say which is which.
  const say = (_: Catalog, d: string, r: Row, pair = false) => (r[d + '@end'] == null ? formatDimension(r[d], catalog.dimensions[d]!) : (pair ? catalog.dimensions[d]!.label.toLowerCase() + ' ' : '') + formatBin(r[d], r[d + '@end']));
  // Signed values have no busiest and no share: what is said is how far they run each way, and where. A value set
  // against itself is passed over where there is any other pair, since what it holds is no finding.
  const M = catalog.metrics[m]!;
  if (crossesZero(endsOf(rows.map((r) => r[m] as number), M))) {
    const apart = rows.filter((r) => r[a] !== r[b]), of = apart.length ? apart : rows, end = (way: 1 | -1) => of.reduce((top, r) => (way * (r[m] as number) > way * (top[m] as number) ? r : top));
    const said = (r: Row) => formatValue(r[m] as number, M) + ' (' + say(catalog, a, r, true) + ' and ' + say(catalog, b, r, true) + ')';
    return M.label + ' runs from ' + said(end(-1)) + ' to ' + said(end(1)) + over(result) + '.';
  }
  const busiest = (d: string, is: string, of = '') => { const top = leader(result, d, m)!; return say(catalog, d, top) + is + ' the busiest ' + catalog.dimensions[d]!.label.toLowerCase() + at(top[m] as number, result.totals[m], catalog.metrics[m]!, of); };
  return 'Most ' + name + ' at ' + say(catalog, a, peak, true) + ', ' + say(catalog, b, peak, true) + ' (' + formatValue(peak[m] as number, catalog.metrics[m]!) + ')' + over(result) + '. ' + busiest(a, ' is', ' of ' + name) + ', and ' + busiest(b, '') + '.';
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
export function notShownNote(count: number, label: string): string {
  const name = label.toLowerCase();
  return count ? count + ' ' + many(count, name) + ' not shown' : '';
}
