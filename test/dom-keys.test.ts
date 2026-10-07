import { describe, expect, it } from 'vitest';
import { buildScene, expand, resolve, unboundedContainer } from '@universal-analytics/core';
import { catalog, runQuery, samples, type Scenario } from '@universal-analytics/fixtures';
import { hitNodes, readout, step } from '../packages/dom/src/keys.ts';

// Which point a key moves to, what the readout says and where a plot's hit targets lie are plain functions, held
// here with no DOM. Focus, hover and the event are checked in a browser on the bench.

const of = (sample: string, scenario: Scenario = 'typical') => {
  const spec = samples[sample]!.spec, result = runQuery(spec.query, scenario), q = expand(spec).query;
  const scene = buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog);
  return { result, scene, says: result.rows.map((r) => readout(r, q, catalog)) };
};

describe('step', () => {
  it('moves left and right and stops at the ends, as version 4 does', () => {
    expect(step('ArrowRight', -1, 5)).toBe(0);
    expect(step('ArrowLeft', -1, 5)).toBe(0);
    expect(step('ArrowRight', 2, 5)).toBe(3);
    expect(step('ArrowRight', 4, 5)).toBe(4);
    expect(step('ArrowLeft', 0, 5)).toBe(0);
  });
  it('takes up and down only where the points run down the page', () => {
    expect(step('ArrowDown', 1, 5)).toBeNull();
    expect(step('ArrowDown', 1, 5, true)).toBe(2);
    expect(step('ArrowUp', 1, 5, true)).toBe(0);
  });
  it('leaves every other key, and a view with no points, alone', () => {
    for (const k of ['Tab', 'Home', 'End', 'a']) expect(step(k, 1, 5, true)).toBeNull();
    expect(step('ArrowRight', -1, 0)).toBeNull();
  });
});

describe('readout', () => {
  it('says the dimension value, the metric, and the comparison when the row has one', () => {
    const { result, says } = of('trend'), r = result.rows[0]!;
    expect(says[0]).toBe(r['date.day'] + ': Visitors ' + (r.visitors as number).toLocaleString('en-US') + ', previous period ' + (r['visitors@previous'] as number).toLocaleString('en-US'));
    expect(says).toHaveLength(28);
  });
  it('leaves the comparison out when there is no prior period', () => {
    const { says } = of('trend', 'no-prior');
    for (const s of says) expect(s).toMatch(/^\d{4}-\d\d-\d\d: Visitors [\d,]+$/);
  });
  it('reads a ranked list and a share the same way', () => {
    expect(of('pages').says[0]).toMatch(/^\/.*: Page views [\d,]+$/);
    expect(of('mix').says[0]).toMatch(/^\w+: Visitors [\d,]+$/);
  });
});

describe('hitNodes', () => {
  it.each(['trend', 'layers'])('gives %s one target per row, tiling the plot, each holding its own x', (sample) => {
    const { scene } = of(sample), hits = hitNodes(scene);
    expect(hits.map((h) => h.row)).toEqual(scene.rows);
    expect(new Set(hits.map((h) => h.key)).size).toBe(hits.length);
    expect(hits[0]!.x).toBe(0);
    hits.forEach((h, i) => {
      expect(h.x! + h.w!).toBeCloseTo(hits[i + 1]?.x ?? 1, 9);
      expect(h.c).toBeGreaterThanOrEqual(0); expect(h.c).toBeLessThanOrEqual(1);
    });
  });
  it('puts a line\'s first and last points at the edges of their targets', () => {
    const hits = hitNodes(of('trend').scene);
    expect(hits[0]!.c).toBe(0);
    expect(hits[hits.length - 1]!.c).toBe(1);
  });
});
