import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES, fallbackRule, fills, gaveWay, viewAt } from '@unified-analytics/core';
import type { FitRule, Spec } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';
import { errOf as err, shown } from './helpers.ts';
import { useExamples } from './examples.ts';

useExamples();   // the presets the library no longer ships, which these cases still write `use` with

// Step 8 of docs/archive/chart-coverage-plan.md, part 3: `fallback` on a fit rule, the preset a view becomes below the rule's
// need. No default rule names one, so a context hands the samples a rule that does. A custom mark with a fallback of
// its own is in test/registry.test.ts and test/geo.test.ts.
const pages = samples.pages!.spec, mix = samples.mix!.spec;
const swap: FitRule = { id: 'swap', layout: 'band', container: 'view', needs: { inline: 15, block: 4.5 }, hide: [], fallback: 'bar-list' };
/** A view at a room, in a context whose rules are the defaults and `more`: the view it settles as, and what it gave way from. */
const run = (spec: Spec, w: number, more: FitRule[] = [], h: number | null = null, scenario: 'typical' | 'empty' = 'typical') => {
  const at = viewAt(spec, runQuery(spec.query, scenario), catalog, { view: { inline: w, block: h } }, { ...CONTAINER_RULES, fit: [...FIT_RULES, ...more] });
  return { plan: at.plan, ratio: at.scene, fit: at.fit, gave: at.gave };
};

describe('fallback on a fit rule', () => {
  it('under the rule\'s need the view is the preset it names, planned again from the same query', () => {
    const list: Spec = { ...mix, use: 'bar-list' };
    expect(run(mix, 200, [swap])).toMatchObject({ plan: { layout: 'band', preset: 'share-bar' }, gave: [] });
    expect(run(mix, 199, [swap])).toMatchObject({ plan: { layout: 'rows', preset: 'bar-list' }, gave: ['band'] });
    expect(run(mix, 346, [swap], 59).plan).toMatchObject({ layout: 'rows', preset: 'bar-list' });
    // It is the bar list a spec that asked for one would get, to the node, and it gives way at that room as that one does.
    for (const [w, h] of [[199, null], [346, 59], [89, null]] as [number, number | null][]) {
      const fell = run(mix, w, [swap], h), asked = run(list, w, [], h);
      expect([fell.ratio, shown(fell)], w + ' ' + h).toEqual([asked.ratio, shown(asked)]);
    }
    expect(run(mix, 89, [swap])).toMatchObject({ fit: { parts: ['number'] }, gave: ['band'] });
  });
  it('an empty result has nothing to fall back from', () => {
    expect(run(mix, 199, [swap], null, 'empty')).toMatchObject({ plan: { layout: 'notice', preset: 'share-bar' }, gave: [] });
  });
  it('no default rule names one but those of one mark, so nothing changes for a view that does not hold it', () => {
    expect(FIT_RULES.filter((r) => r.fallback).every((r) => r.mark != null)).toBe(true);
    expect(run(mix, 120)).toMatchObject({ plan: { layout: 'band' }, gave: [] });
  });
  it('a fallback that names its own layout, or leads back to one, is an error that names the fix', () => {
    const self: FitRule = { id: 'swap', layout: 'rows', container: 'view', needs: { inline: 75 }, hide: [], fallback: 'bar-list' };
    expect(err(() => run(pages, 346, [self])))
      .toBe('A fit rule\'s "fallback" leads back to the "rows" layout (rows, then rows), so the view would never settle. Name a preset that is laid out another way, or remove "fallback" from the rule.');
    const back: FitRule = { ...self, fallback: 'share-bar' }, forth: FitRule = { ...self, layout: 'band' };
    expect(err(() => run(pages, 346, [back, forth]))).toMatch(/leads back to the "rows" layout \(rows, then band, then rows\)/);
    // A preset the library does not have is expand()'s error.
    expect(err(() => run(pages, 346, [{ ...self, fallback: 'nope' }]))).toMatch(/^Unknown preset "nope"\. The library has: /);
  });
  it('fallbackRule finds the rule a layout gives way under', () => {
    expect(fallbackRule([...FIT_RULES, swap], 'band')).toBe(swap);
    expect(fallbackRule([...FIT_RULES, swap], 'band', [])).toBe(swap);
    expect(fallbackRule([...FIT_RULES, swap], 'cartesian')).toBeUndefined();
    expect(err(() => fallbackRule([swap], 'band', ['band']))).toMatch(/^A fit rule's "fallback" leads back to the "band" layout \(band, then band\)/);
  });
  it('compiles to the swap: under the need the figure goes and the view beside it shows, ', () => {
    // Only where the view beside it is there and is this rule's: a rule for one mark leaves the layout's other views as they are.
    const fig = '.uav[data-layout="band"]', beside = '.uav-fallback[data-rule="swap"]', body = '  ' + fig + ':has(~ ' + beside + ') { display: none; }\n  ' + fig + ' ~ ' + beside + ' { display: block; }\n}';
    expect(compileFitRules([swap])).toBe('/* band swap */\n@container uav-view (inline-size < calc(15em - 0.5px)) {\n' + body + '\n/* band swap */\n@container uav-view (block-size < calc(4.5em - 0.5px)) {\n' + body);
  });
  it('a rule for one mark is for a view that holds it, so a built-in layout can give way to a preset of the same layout', () => {
    // The pages as rows of dots give way to the ranked list, which is rows too, and the list gives way to nothing.
    const dots: Spec = { query: pages.query, layers: [{ mark: 'dot', encode: { y: 'page', x: 'pageviews' } }, { mark: 'text', encode: { y: 'page', text: 'page' } }] };
    const forDots: FitRule = { id: 'dots', layout: 'rows', mark: 'dot', container: 'view', needs: { inline: 22.5 }, hide: [], fallback: 'bar-list' };
    expect(run(dots, 300, [forDots])).toMatchObject({ plan: { layout: 'rows', preset: null }, gave: [] });
    expect(run(dots, 299, [forDots])).toMatchObject({ plan: { layout: 'rows', preset: 'bar-list' }, gave: ['rows (dot)'] });
    expect(run(dots, 299, [forDots]).ratio).toEqual(run(pages, 299).ratio);
    expect(run(pages, 299, [forDots])).toMatchObject({ plan: { preset: 'bar-list' }, gave: [] });
    const view = (marks: string[]) => ({ marks, fills: () => true });
    expect(fallbackRule([forDots], 'rows', [], view(['dot', 'text']))).toBe(forDots);
    expect(fallbackRule([forDots], 'rows', [], view(['bar', 'text']))).toBeUndefined();
    // What it gave up is the layout with that mark, so a rule of the layout's own may still follow it, and a rule that leads back to itself is still refused.
    expect(gaveWay(forDots)).toBe('rows (dot)');
    expect(run(dots, 199, [forDots, { ...swap, layout: 'rows', fallback: 'share-bar' }])).toMatchObject({ plan: { layout: 'band', preset: 'share-bar' }, gave: ['rows (dot)', 'rows'] });
    const round: FitRule = { ...forDots, fallback: 'dumbbell' };
    expect(err(() => run(dots, 299, [round]))).toMatch(/leads back to the "rows \(dot\)" layout \(rows \(dot\), then rows \(dot\)\)/);
  });
  it('a fallback the query cannot fill is passed over, for the next of the layout\'s that it can', () => {
    // No dimension: the share bar has nothing to divide by, and the gauge reads the same metric against its range.
    const signups: Spec = { query: { metrics: ['signups'], range: '28d' }, layers: [{ mark: 'arc', encode: { angle: 'signups', radius: 0.2 } }] };
    const split: FitRule = { id: 'split', layout: 'radial', container: 'view', needs: { inline: 22.5 }, hide: [], fallback: 'bar-list' }, alone: FitRule = { ...split, id: 'alone', layout: 'radial', mark: 'arc' };
    expect(fills('bar-list', signups.query)).toBe(false);
    expect(fills('gauge', signups.query)).toBe(true);
    expect(fills('bar-list', pages.query)).toBe(true);
    expect(run(signups, 299, [split])).toMatchObject({ plan: { layout: 'radial', preset: null }, gave: [] });
    expect(err(() => run(signups, 299, [split, { ...alone, fallback: 'gauge' }]))).toMatch(/leads back to the "radial \(arc\)" layout/);
    // A name no preset has is still expand()'s to refuse.
    expect(fills('nope', signups.query)).toBe(true);
  });
});
