import { arc, area, curveMonotoneX, line } from 'd3-shape';

/** Where a point falls in the box a path is drawn in. */
export interface PathBox<P> { x(p: P): number; y(v: number): number }
// The scene's box: 100 by 100, y down, for a painter to stretch.
const BOX: PathBox<{ x: number }> = { x: (p) => 100 * p.x, y: (v) => 100 * (1 - v) };

/** The path through `points`: a line, or with `fill` an area down to the baseline, or to each point's `v0` where it
 * has one. Each point has its `x` across and its value `v` up, both 0 to 1. This is the one place a path string is made: the scene's `d` is
 * `pathD(points, curve, fill)`, so a painter that moves the points between two scenes draws the scene's own `d` at rest.
 * place() passes its pixel box as `to`. Null when there are no points. */
export function pathD<P extends { x: number; v: number; v0?: number }>(points: P[], curve?: 'monotone', fill?: boolean, to: PathBox<P> = BOX): string | null {
  const y = (p: P) => to.y(p.v);
  const d = fill ? area<P>().x(to.x).y0((p) => to.y(p.v0 || 0)).y1(y) : line<P>().x(to.x).y(y);
  if (curve) d.curve(curveMonotoneX);
  return d(points);
}

/** The path of an arc about the origin: `a0` to `a1` in turns, clockwise from the top, between `r0` and `r1` as ratios
 * of `radius`. The scene's `d` is drawn at a radius of 50, in a box from -50 to 50, as a line's is drawn in 100 by 100.
 * A pixel painter passes its own radius and moves the origin to the centre. */
export function arcD(a: { a0: number; a1: number; r0: number; r1: number }, radius = 50): string {
  const turn = 2 * Math.PI;
  return arc()({ startAngle: a.a0 * turn, endAngle: a.a1 * turn, innerRadius: a.r0 * radius, outerRadius: a.r1 * radius }) ?? '';
}
