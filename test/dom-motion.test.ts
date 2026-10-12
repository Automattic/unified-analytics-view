import { describe, expect, it } from 'vitest';
import { buildScene, resolve, unboundedContainer, type PathNode } from '@unified-analytics/core';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';
import { mix, resample } from '../packages/dom/src/motion.ts';

// A path's morph is points in and a string out, so it is held here with no DOM. That it runs, and what a
// stylesheet moves, is checked in a browser on the bench.

function paths(range: string, scenario: 'typical' | 'no-prior' = 'typical'): PathNode[] {
  const spec = { ...samples.trend!.spec, query: { ...samples.trend!.spec.query, range } }, result = runQuery(spec.query, scenario);
  return buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog).nodes.filter((n): n is PathNode => n.kind === 'path');
}

describe('resample and mix', () => {
  const [, , line] = paths('28d'), [, , week] = paths('7d');

  it('leaves a set alone when the rows are the same, so a morph starts and ends on the two drawn shapes', () => {
    // With no previous period the comparison layer goes. Core's keys name the layer, so the primary line keeps its own.
    const to = paths('28d', 'no-prior').find((n) => n.role === 'primary')!;
    expect(to.key).toBe(line!.key);
    const from = resample(line!.points, to.points);
    expect(from).toEqual(line!.points.map(({ x, v }) => ({ x, v })));
    expect(mix(from, to.points, 0)).toEqual(from);
    expect(mix(from, to.points, 1)).toEqual(to.points.map(({ x, v }) => ({ x, v })));
  });

  it('reads the old shape at the new rows when they differ, and holds the ends past the old ones', () => {
    const from = resample(line!.points, week!.points);
    expect(from.map((p) => p.x)).toEqual(week!.points.map((p) => p.x));
    expect(from[0]!.v).toBe(line!.points[0]!.v);
    const lo = Math.min(...line!.points.map((p) => p.v)), hi = Math.max(...line!.points.map((p) => p.v));
    from.forEach((p) => { expect(p.v).toBeGreaterThanOrEqual(lo); expect(p.v).toBeLessThanOrEqual(hi); });
    expect(resample([], week!.points).every((p) => p.v === 0)).toBe(true);
    expect(resample([{ x: 0.2, v: 0.5 }, { x: 0.4, v: 0.7 }], [{ x: 0, v: 0 }, { x: 0.3, v: 0 }, { x: 1, v: 0 }]).map((p) => p.v)).toEqual([0.5, 0.6, 0.7]);
  });

  it('is half way at a half', () => {
    expect(mix([{ x: 0, v: 0.2 }], [{ x: 0.5, v: 0.6 }], 0.5)).toEqual([{ x: 0.5, v: 0.4 }]);
  });
});
