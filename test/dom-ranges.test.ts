import { describe, expect, it } from 'vitest';
import { FIT_RULES, buildScene, resolve, unboundedContainer } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { catalog, moreSamples, runQuery } from '@universal-analytics/fixtures';
import { companions, hitNodes, readout } from '../packages/dom/src/keys.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { rows } from '../packages/dom/src/layouts/rows.ts';

// What <ua-view> adds for ranges, ticks and a row's track, where it is a plain function or a string. That they
// draw, fit and move is checked in a browser on the bench.
const of = (sample: string) => {
  const spec = moreSamples[sample]!.spec, result = runQuery(spec.query), plan = resolve(spec, result, unboundedContainer(), catalog);
  return { spec, result, layers: plan.layers, scene: buildScene(plan, spec.query, result, catalog) };
};

describe('a row\'s segments in a plot', () => {
  it('are placed by their two ends, and one set before the bars lies under them', () => {
    expect(cartesian.css).toContain('.uav-ranges i { position: absolute;');
    expect(cartesian.css).toContain('inset-block-end: calc(min(var(--uav-t), var(--uav-t2)) * 100%);');
    expect(cartesian.css).toContain('.uav-ranges i[data-under] { z-index: -1; }');
  });
  it('every row of a box plot has one hit target, and of its medians alone', () => {
    const { scene } = of('box');
    expect(hitNodes(scene).map((n) => n.row)).toEqual(scene.rows);
    expect(hitNodes({ ...scene, nodes: scene.nodes.filter((n) => n.role !== 'context') }).map((n) => n.row)).toEqual(scene.rows);
  });
});

describe('the readout', () => {
  it('says each companion of a metric that a layer encodes, under its suffix, after the comparison', () => {
    const box = of('box'), errors = of('errors'), league = of('league');
    expect(readout(box.result.rows[0]!, box.spec.query, catalog, box.layers)).toBe('/blog/analytics-without-cookies: Response time 720ms, min 210ms, p25 470ms, p50 640ms, p75 890ms, max 2.6s');
    expect(readout(errors.result.rows[0]!, errors.spec.query, catalog, errors.layers)).toBe('/blog/analytics-without-cookies: Response time 720ms, lower 648ms, upper 792ms');
    expect(readout(league.result.rows[1]!, league.spec.query, catalog, league.layers)).toBe('/pricing: Page views 2,960, previous period 2,310, rank 2');
  });
  it('leaves out a companion the result carries and no layer encodes', () => {
    // The fixture engine sends a page's rank with any compared query by page. The dumbbell draws nothing from it.
    const dumbbell = of('dumbbell'), row = dumbbell.result.rows[1]!;
    expect(row['pageviews@rank']).toBe(2);
    expect(readout(row, dumbbell.spec.query, catalog, dumbbell.layers)).toBe('/pricing: Page views 2,960, previous period 2,310');
    // A real result carries more than a view asks for. One that does is said as the one that does not.
    const league = of('league'), more = { ...league.result.rows[1]!, 'pageviews@p95': 9999, 'visitors@rank': 4 };
    expect(readout(more, league.spec.query, catalog, league.layers)).toBe('/pricing: Page views 2,960, previous period 2,310, rank 2');
    expect(readout(more, league.spec.query, catalog, [])).toBe('/pricing: Page views 2,960, previous period 2,310');
  });
  it('and the table has a column for the same ones: both list by companions()', () => {
    const box = of('box'), dumbbell = of('dumbbell'), league = of('league');
    expect(companions('response_time', box.result.rows[0], box.layers)).toEqual(['response_time@min', 'response_time@p25', 'response_time@p50', 'response_time@p75', 'response_time@max']);
    expect(companions('pageviews', dumbbell.result.rows[0], dumbbell.layers)).toEqual([]);
    expect(companions('pageviews', { ...league.result.rows[0]!, 'pageviews@p95': 1 }, league.layers)).toEqual(['pageviews@rank']);
    expect(companions('pageviews', undefined, league.layers)).toEqual([]);      // an empty result has no row, and the table no column
  });
});

describe('a track beside its label', () => {
  it('gives up its body under its own rule, and only where the body says its track is beside', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'track'), { rows: rows.fit! });
    const fig = '.uav[data-layout="rows"]:not([data-keep~="marks"])';
    expect(css.split('\n')).toEqual([
      '/* rows track */', '@container uav-view (inline-size < 159.5px) {',
      '  ' + fig + ' .uav-track { display: none; }',
      '  ' + fig + ' .uav-body[data-track] { display: none; }', '  ' + fig + ' .uav-number:has(~ .uav-body[data-track]) { display: block; margin: 0; }',
      '}',
    ]);
  });
  it('is said by the scene, for a dumbbell and a bullet and not for a list of bars', () => {
    expect(['dumbbell', 'bullet', 'funnel', 'league'].map((k) => of(k).scene.track)).toEqual(['beside', 'beside', undefined, undefined]);
  });
});
