import { describe, expect, it } from 'vitest';
import { buildScene, pathD, resolve, unboundedContainer, type PathNode } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, samples } from '@unified-analytics/fixtures';
import { MOTION_CSS, mix, resample } from '../packages/dom/src/motion.ts';

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

describe('steps over bins', () => {
  const steps = (range: string) => { const spec = { ...moreSamples.density!.spec, query: { ...moreSamples.density!.spec.query, range } }, result = runQuery(spec.query); return buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog).nodes.filter((n): n is PathNode => n.kind === 'path'); };
  it('a path is flat across each point\'s width and upright between two, with no curve: the bins\' own edges', () => {
    expect(pathD([{ x: 0.25, v: 0.5, w: 0.5 }, { x: 0.75, v: 1, w: 0.5 }], 'step')).toBe('M0,50L50,50L50,0L100,0');
    expect(pathD([{ x: 0.25, v: 0.5, w: 0.5 }, { x: 0.75, v: 1, w: 0.5 }], 'step', true)).toBe('M0,50L50,50L50,0L100,0L100,100L50,100L50,100L0,100Z');
    // A bin apart from the one before it is joined to it across the gap, at no height of its own.
    expect(pathD([{ x: 0.1, v: 0.5, w: 0.2 }, { x: 0.9, v: 1, w: 0.2 }], 'step')).toBe('M0,50L20,50L80,0L100,0');
  });
  it('a morph keeps every step as wide as the new shape has it, so each frame is steps and the last is the scene\'s own path', () => {
    const [, from] = steps('28d'), [, to] = steps('7d');
    expect([from!.curve, to!.curve]).toEqual(['step', 'step']);
    const half = mix(resample(from!.points, to!.points), to!.points, 0.5);
    expect(half.map((p) => p.w)).toEqual(to!.points.map((p) => p.w));
    expect(pathD(half, to!.curve)).toMatch(/^M[\d.]+,[\d.]+(L[\d.]+,[\d.]+){31}$/);
    expect(pathD(mix(resample(from!.points, to!.points), to!.points, 1), to!.curve)).toBe(to!.d);
  });
});

describe('a change\'s arrow', () => {
  it('is parted from its number by a margin of its own, and leaves the spaces between the words of its line alone', () => {
    // Tightening the line's word spacing by what suits a fixed-width face ran the words of any other face together.
    expect(MOTION_CSS).not.toContain('word-spacing');
    expect(MOTION_CSS).toMatch(/\.uav-trend \{[^}]*margin-inline-end: 0\.5ch;/);
  });
});
