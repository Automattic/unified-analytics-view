import { arc, area, curveMonotoneX, line } from 'd3-shape';

/** A place worked out with a sine or a cosine, to a millionth of its box. Those functions differ in their last digits
 * from one machine to the next, where sums and products do not, and a scene is the same wherever it is built: its
 * golden scenes are held to the digit, on a laptop and in CI. A millionth of a box is far under a px. */
export const steady = (n: number): number => Math.round(n * 1e6) / 1e6;

/** Where a point falls in the box a path is drawn in. */
export interface PathBox<P> { x(p: P): number; y(v: number): number }
// The scene's box: 100 by 100, y down, for a painter to stretch.
const BOX: PathBox<{ x: number }> = { x: (p) => 100 * p.x, y: (v) => 100 * (1 - v) };

/** The path through `points`: a line, or with `fill` an area down to the baseline, or to each point's `y2` where it
 * has one. `curve` is `monotone`, smoothed and never past the values it joins, `step`, or none for straight segments. Each point has its `x` across and its value `y` up, both 0 to 1. This is the one place a path string is made: the scene's `d` is
 * `pathD(points, curve, fill)`, so a painter that moves the points between two scenes draws the scene's own `d` at rest.
 * A surface with a size of its own passes its box as `to`. Null when there are no points.
 * With `radial` the points are about a centre: `x` is the place round the circle, in turns clockwise from the top, and
 * `y` how far out from the middle, with the rim at 1. The path runs straight from each to the next and closes, and is
 * drawn about the origin at a radius of 50, as an arc is (arcD), whatever `to` says. */
export function pathD<P extends { x: number; y: number; y2?: number; w?: number }>(points: P[], curve?: 'monotone' | 'step' | 'radial', fill?: boolean, to: PathBox<P> = BOX): string | null {
  if (curve === 'radial') {
    const at = (n: number) => String(Math.round(n * 1000) / 1000), turn = 2 * Math.PI;
    return points.length ? 'M' + points.map((p) => at(50 * p.y * Math.sin(p.x * turn)) + ',' + at(-50 * p.y * Math.cos(p.x * turn))).join('L') + 'Z' : null;
  }
  const y = (p: P) => to.y(p.y);
  const d = fill ? area<P>().x(to.x).y0((p) => to.y(p.y2 || 0)).y1(y) : line<P>().x(to.x).y(y);
  if (curve === 'monotone') d.curve(curveMonotoneX);
  // Steps: each point is a flat run across its own width, `w` about its `x`, so a bin is drawn from where it starts to
  // where it ends, as its bar is, and the line steps where one bin meets the next.
  return d(curve === 'step' ? points.flatMap((p) => [{ ...p, x: p.x - (p.w || 0) / 2 }, { ...p, x: p.x + (p.w || 0) / 2 }]) : points);
}

/** The path of an arc about the origin: `a0` to `a1` in turns, clockwise from the top, between `r0` and `r1` as ratios
 * of `radius`. The scene's `d` is drawn at a radius of 50, in a box from -50 to 50, as a line's is drawn in 100 by 100.
 * A surface with a size of its own passes its radius and moves the origin to the centre. */
export function arcD(a: { a0: number; a1: number; r0: number; r1: number }, radius = 50): string {
  const turn = 2 * Math.PI;
  return arc()({ startAngle: a.a0 * turn, endAngle: a.a1 * turn, innerRadius: a.r0 * radius, outerRadius: a.r1 * radius }) ?? '';
}
