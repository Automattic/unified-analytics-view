import { describe, expect, it } from 'vitest';
import { FIT_RULES, buildScene, resolve, unboundedContainer } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { catalog, moreSamples, runQuery } from '@universal-analytics/fixtures';
import { hitNodes, readout } from '../packages/dom/src/keys.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { rows } from '../packages/dom/src/layouts/rows.ts';

// What <ua-view> adds for ranges, ticks and a row's track, where it is a plain function or a string. That they
// draw, fit and move is checked in a browser on the bench.
const of = (sample: string) => {
  const spec = moreSamples[sample]!.spec, result = runQuery(spec.query);
  return { spec, result, scene: buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog) };
};

describe('a row\'s segments in a plot', () => {
  it('are placed by their two ends, and one set before the bars lies under them', () => {
    expect(cartesian.css).toContain('.vg-ranges i { position: absolute;');
    expect(cartesian.css).toContain('inset-block-end: calc(min(var(--vg-t), var(--vg-t2)) * 100%);');
    expect(cartesian.css).toContain('.vg-ranges i[data-under] { z-index: -1; }');
  });
  it('every row of a box plot has one hit target, and of its medians alone', () => {
    const { scene } = of('box');
    expect(hitNodes(scene).map((n) => n.row)).toEqual(scene.rows);
    expect(hitNodes({ ...scene, nodes: scene.nodes.filter((n) => n.role !== 'context') }).map((n) => n.row)).toEqual(scene.rows);
  });
});

describe('the readout', () => {
  it('says each companion the engine returned with a metric, under its suffix, after the comparison', () => {
    const box = of('box'), league = of('league');
    expect(readout(box.result.rows[0]!, box.spec.query, catalog)).toBe('/blog/analytics-without-cookies: Response time 720, min 210, p25 470, p50 640, p75 890, max 2,600, lower 648, upper 792');
    expect(readout(league.result.rows[1]!, league.spec.query, catalog)).toBe('/pricing: Page views 2,960, previous period 2,310, rank 2');
  });
});

describe('a track beside its label', () => {
  it('gives up its body under its own rule, and only where the body says its track is beside', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'track'), { rows: rows.fit! });
    const fig = '.vg[data-layout="rows"]:not([data-keep~="marks"])';
    expect(css.split('\n')).toEqual([
      '/* rows track */', '@container view (inline-size < 160px) {',
      '  ' + fig + ' .vg-track { display: none; }',
      '  ' + fig + ' .vg-body[data-track] { display: none; }', '  ' + fig + ' .vg-number:has(~ .vg-body[data-track]) { display: block; margin: 0; }',
      '}',
    ]);
  });
  it('is said by the scene, for a dumbbell and a bullet and not for a list of bars', () => {
    expect(['dumbbell', 'bullet', 'funnel', 'league'].map((k) => of(k).scene.track)).toEqual(['beside', 'beside', undefined, undefined]);
  });
});
