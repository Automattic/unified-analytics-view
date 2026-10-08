import { area, curveMonotoneX, line } from 'd3-shape';

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
