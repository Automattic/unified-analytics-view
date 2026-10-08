import { describe, expect, it } from 'vitest';
import { buildScene, pathD, resolve, unboundedContainer, type PathNode, type RectNode } from '@universal-analytics/core';
import { catalog, moreSamples, runQuery, type Scenario } from '@universal-analytics/fixtures';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { mix, resample } from '../packages/dom/src/motion.ts';

// What <ua-view> adds for a plot split into series, a stack, a signed scale and a second unit, where it is a plain
// function or a string. That they draw, fit and move is checked in a browser on the bench.

const of = (sample: string, scenario: Scenario = 'typical', range = '28d') => {
  const spec = { ...moreSamples[sample]!.spec, query: { ...moreSamples[sample]!.spec.query, range } }, result = runQuery(spec.query, scenario);
  return { spec, result, scene: buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog) };
};
const names = Object.keys(moreSamples);

describe('bars', () => {
  it('run from where they start to their value, whichever is the higher', () => {
    expect(cartesian.css).toContain('inset-block-end: calc(min(var(--vg-v0, 0), var(--vg-v)) * 100%);');
    expect(cartesian.css).toContain('block-size: calc(max(var(--vg-v) - var(--vg-v0, 0), var(--vg-v0, 0) - var(--vg-v)) * 100%);');
  });
  it('have a start to read in a stack and below zero, and none in a group', () => {
    const rects = (sample: string) => of(sample).scene.nodes.filter((n): n is RectNode => n.part === 'plot' && n.kind === 'rect');
    expect(rects('stacked').filter((n) => n.series !== 'Desktop').every((n) => n.v0! > 0 && n.v! >= n.v0!)).toBe(true);
    expect(rects('diverging').some((n) => n.v! < n.v0!)).toBe(true);
    expect(rects('grouped').every((n) => n.v0 == null)).toBe(true);
  });
});

describe('a split path', () => {
  const areas = (range: string) => of('area', 'typical', range).scene.nodes.filter((n): n is PathNode => n.kind === 'path');

  it.each(names)('has a key of its own in %s, so a morph holds to its series', (sample) => {
    const keys = of(sample).scene.nodes.map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('keeps its key when the rows change', () => {
    expect(areas('7d').map((n) => n.key)).toEqual(areas('28d').map((n) => n.key));
  });
  it('morphs where it starts as well as where it ends, and lands on the shape core drew', () => {
    const from = areas('28d')[1]!, to = areas('7d')[1]!, old = resample(from.points, to.points);
    expect(old.every((p) => p.v0! > 0 && p.v0! < p.v)).toBe(true);
    const half = mix(old, to.points, 0.5);
    half.forEach((p, i) => expect(p.v0).toBeCloseTo((old[i]!.v0! + to.points[i]!.v0!) / 2, 9));
    expect(pathD(mix(old, to.points, 1), to.curve, to.fill)).toBe(to.d);
  });
  it('gains a start when it had none, and loses one', () => {
    expect(mix([{ x: 0, v: 0.4 }], [{ x: 0, v: 0.8, v0: 0.2 }], 0.5)).toEqual([{ x: 0, v: 0.6000000000000001, v0: 0.1 }]);
    expect(mix([{ x: 0, v: 0.8, v0: 0.2 }], [{ x: 0, v: 0.4 }], 1)).toEqual([{ x: 0, v: 0.4, v0: 0 }]);
  });
});
