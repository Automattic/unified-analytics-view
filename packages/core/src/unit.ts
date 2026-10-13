/* The `unit` mark's arithmetic: what one glyph is worth, how many a value is drawn as, how a hundred cells are shared
 * out, and where seats stand round a half circle. All of it is worked out from the data. A scene is in ratios and has
 * no size, so nothing here asks how big a glyph is, or how many would fit. */

/** The glyphs the largest value of a stack or a run is drawn as, at most. */
export const UNIT_MOST = 10;
/** The cells of a share grid: ten rows of ten, so a cell is a hundredth. */
export const UNIT_CELLS = 100;
/** The seats a half circle holds before a seat stands for more than one: up to here a seat is one of the metric. */
export const UNIT_SEATS = 100;

/** What one glyph is worth: the least round number, 1, 2 or 5 times a power of ten, at which `most` is `cap` glyphs or
 * fewer. `most` is the largest value of a stack or a run, or the engine's total for seats. With `whole`, for a count, a
 * glyph is never worth less than one: half a visitor is not drawn. Nothing to draw is worth one. */
export function unitWorth(most: number, cap: number = UNIT_MOST, whole = false): number {
  if (!(most > 0) || !Number.isFinite(most)) return 1;
  for (let p = Math.floor(Math.log10(most / cap)) - 1; ; p++) for (const m of [1, 2, 5]) {
    const worth = p < 0 ? m / 10 ** -p : m * 10 ** p;                       // divided, so 0.2 is 0.2 and not 0.2000…04
    if ((!whole || worth >= 1) && most / worth <= cap + 1e-9) return worth;
  }
}

/** The whole glyphs a value is drawn as: rounded to the nearest, and one at least for any value above nothing. A count
 * of glyphs cannot be less than none, so a value below zero is refused. `what` names the value in that error. */
export function unitCount(value: number, worth: number, what: string): number {
  if (value < 0) throw new Error(what + ' is ' + value + ', and a "unit" draws a value as a count of glyphs, which cannot be fewer than none. Use "bar" for a metric that falls below zero: its bar hangs from the zero line.');
  return value > 0 ? Math.max(1, Math.round(value / worth)) : 0;
}

/** `cells` shared out among values in whole cells, each by its share of `total`: the largest-remainder rule. Each takes
 * the whole cells of its share, and the cells that leaves go one each to the largest remainders. What the values leave
 * of the total has a share as well, the rest's, and takes its cells in the same way without being returned: so values
 * that make up the total sum to `cells` exactly, and under a `limit` the cells left over are the rows past it.
 * `total` is the engine's. With none, or one of zero, nothing is a share and no value has a cell. */
export function unitShares(values: number[], total: number | null | undefined, cells: number = UNIT_CELLS): number[] {
  if (!total || !(total > 0)) return values.map(() => 0);
  const exact = values.map((v) => Math.max(0, v) / total * cells), rest = Math.max(0, cells - exact.reduce((s, x) => s + x, 0));
  const out = exact.map(Math.floor), left = cells - out.reduce((s, n) => s + n, 0) - Math.floor(rest);
  // The first of two equal remainders takes the cell, so the same values always share out the same way.
  exact.concat(rest).map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, Math.max(0, left)).forEach(([, i]) => { if (i < out.length) out[i]!++; });
  return out;
}

/** Where `count` seats stand round a half circle, from its left end to its right: `a` is how far round a seat is, from
 * 0 to 1, and `r` how far out, as a share of the radius. They stand in rings between `inner` and the rim, in as few
 * rings as hold them all, so a seat is as large as the count allows. `pitch` is the room a seat has each way, as a
 * share of the radius. A ring has seats by its length, shared out by largest remainder, and spread evenly along it.
 * The order is by angle and then outward, so seats taken in order from the left are a wedge. */
export function unitSeats(count: number, inner = 0.4): { seats: { a: number; r: number }[]; pitch: number } {
  for (let rings = 1; ; rings++) {
    const pitch = (1 - inner) / rings, radii = Array.from({ length: rings }, (_, j) => inner + (j + 0.5) * pitch);
    const room = radii.map((r) => Math.floor(Math.PI * r / pitch)), all = room.reduce((s, n) => s + n, 0);
    if (all < count) continue;
    const per = unitShares(room, all, count);
    const seats = radii.flatMap((r, j) => Array.from({ length: per[j]! }, (_, k) => ({ a: (k + 0.5) / per[j]!, r })));
    return { seats: seats.sort((p, q) => p.a - q.a || p.r - q.r), pitch };
  }
}
