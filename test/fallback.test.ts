import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES, buildScene, fallbackRule, fills, gaveWay, makeContainer, place, resolve } from '@unified-analytics/core';
import type { Container, FitRule, Spec } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';
import { errOf as err } from './helpers.ts';

// Step 8 of docs/chart-coverage-plan.md, part 3: `fallback` on a fit rule, the preset a view becomes below the rule's
// need. No default rule names one, so a context hands the samples a rule that does. A custom mark with a fallback of
// its own is in test/registry.test.ts and test/geo.test.ts.
const pages = samples.pages!.spec, mix = samples.mix!.spec;
const swap: FitRule = { id: 'swap', layout: 'band', container: 'view', needs: { inline: 200, block: 60 }, hide: [], fallback: 'bar-list', keep: 'marks' };
const context = (w: number, more: FitRule[], h: number | null = null): Container => ({ ...makeContainer(w, h), rules: { ...CONTAINER_RULES, fit: [...FIT_RULES, ...more] } });
const run = (spec: Spec, container: Container, scenario: 'typical' | 'empty' = 'typical') => {
  const result = runQuery(spec.query, scenario), plan = resolve(spec, result, container, catalog);
  return { plan, scene: place(buildScene(plan, spec.query, result, catalog), container) };
};

describe('fallback on a fit rule', () => {
  it('under the rule\'s need the view is the preset it names, planned again from the same query', () => {
    const list: Spec = { ...mix, use: 'bar-list' };
    expect(run(mix, context(200, [swap])).plan).toMatchObject({ layout: 'band', preset: 'share-bar', dropped: [] });
    expect(run(mix, context(199, [swap])).plan).toMatchObject({ layout: 'rows', preset: 'bar-list', dropped: ['the band marks (drawn as "bar-list")'] });
    expect(run(mix, context(346, [swap], 59)).plan).toMatchObject({ layout: 'rows', preset: 'bar-list' });
    // It is the bar list a spec that asked for one would get, to the node, and what that gives up is reported after it.
    for (const [w, h] of [[199, null], [346, 59], [100, null]] as [number, number | null][]) expect(run(mix, context(w, [swap], h)).scene, w + ' ' + h).toEqual(run(list, makeContainer(w, h)).scene);
    expect(run(mix, context(100, [swap])).plan).toMatchObject({ layout: 'none', dropped: ['the band marks (drawn as "bar-list")', 'all marks (kept the number)'] });
  });
  it('a spec that keeps the rule\'s part does not fall back, and an empty result has nothing to fall back from', () => {
    expect(run({ ...mix, keep: ['marks'] }, context(199, [swap])).plan).toMatchObject({ layout: 'band', preset: 'share-bar' });
    expect(run(mix, context(199, [swap]), 'empty').plan).toMatchObject({ layout: 'notice', preset: 'share-bar', dropped: [] });
  });
  it('no default rule names one but those of one mark, so nothing changes for a view that does not hold it', () => {
    expect(FIT_RULES.filter((r) => r.fallback).every((r) => r.mark != null)).toBe(true);
    expect(run(mix, makeContainer(120)).plan.layout).toBe('band');
  });
  it('a fallback that names its own layout, or leads back to one, is an error that names the fix', () => {
    const self: FitRule = { id: 'swap', layout: 'rows', container: 'view', needs: { inline: 1000 }, hide: [], fallback: 'bar-list' };
    expect(err(() => run(pages, context(346, [self]))))
      .toBe('A fit rule\'s "fallback" leads back to the "rows" layout (rows, then rows), so the view would never settle. Name a preset that is laid out another way, or remove "fallback" from the rule.');
    const back: FitRule = { ...self, fallback: 'share-bar' }, forth: FitRule = { ...self, layout: 'band' };
    expect(err(() => run(pages, context(346, [back, forth])))).toMatch(/leads back to the "rows" layout \(rows, then band, then rows\)/);
    // A preset the library does not have is expand()'s error.
    expect(err(() => run(pages, context(346, [{ ...self, fallback: 'nope' }])))).toMatch(/^Unknown preset "nope"\. The library has: /);
  });
  it('fallbackRule finds the rule a spec\'s keep leaves on', () => {
    expect(fallbackRule([...FIT_RULES, swap], 'band')).toBe(swap);
    expect(fallbackRule([...FIT_RULES, swap], 'band', ['marks'])).toBeUndefined();
    expect(fallbackRule([...FIT_RULES, swap], 'band', ['guides'])).toBe(swap);
    expect(fallbackRule([...FIT_RULES, swap], 'cartesian')).toBeUndefined();
    expect(err(() => fallbackRule([swap], 'band', [], ['band']))).toMatch(/^A fit rule's "fallback" leads back to the "band" layout \(band, then band\)/);
  });
  it('compiles to the swap: under the need the figure goes and the view beside it shows, unless the spec keeps the marks', () => {
    // Only where the view beside it is there and is this rule's: a rule for one mark leaves the layout's other views as they are.
    const fig = '.uav[data-layout="band"]:not([data-keep~="marks"])', beside = '.uav-fallback[data-rule="swap"]', body = '  ' + fig + ':has(~ ' + beside + ') { display: none; }\n  ' + fig + ' ~ ' + beside + ' { display: block; }\n}';
    expect(compileFitRules([swap])).toBe('/* band swap */\n@container uav-view (inline-size < 199.5px) {\n' + body + '\n/* band swap */\n@container uav-view (block-size < 59.5px) {\n' + body);
  });
  it('a rule for one mark is for a view that holds it, so a built-in layout can give way to a preset of the same layout', () => {
    // The pages as rows of dots give way to the ranked list, which is rows too, and the list gives way to nothing.
    const dots: Spec = { query: pages.query, layers: [{ mark: 'dot', encode: { y: 'page', x: 'pageviews' } }, { mark: 'text', encode: { y: 'page', text: 'page' } }] };
    const forDots: FitRule = { id: 'dots', layout: 'rows', mark: 'dot', container: 'view', needs: { inline: 300 }, hide: [], fallback: 'bar-list', keep: 'marks' };
    expect(run(dots, context(300, [forDots])).plan).toMatchObject({ layout: 'rows', preset: null, dropped: [] });
    expect(run(dots, context(299, [forDots])).plan).toMatchObject({ layout: 'rows', preset: 'bar-list', dropped: ['the rows marks (drawn as "bar-list")'] });
    expect(run(dots, context(299, [forDots])).scene).toEqual(run(pages, makeContainer(299)).scene);
    expect(run(pages, context(299, [forDots])).plan).toMatchObject({ preset: 'bar-list', dropped: [] });
    const view = (marks: string[]) => ({ marks, fills: () => true });
    expect(fallbackRule([forDots], 'rows', [], [], view(['dot', 'text']))).toBe(forDots);
    expect(fallbackRule([forDots], 'rows', [], [], view(['bar', 'text']))).toBeUndefined();
    // What it gave up is the layout with that mark, so a rule of the layout's own may still follow it, and a rule that leads back to itself is still refused.
    expect(gaveWay(forDots)).toBe('rows (dot)');
    expect(run(dots, context(199, [forDots, { ...swap, layout: 'rows', fallback: 'share-bar' }])).plan).toMatchObject({ layout: 'band', preset: 'share-bar' });
    const round: FitRule = { ...forDots, fallback: 'dumbbell' };
    expect(err(() => run(dots, context(299, [round])))).toMatch(/leads back to the "rows \(dot\)" layout \(rows \(dot\), then rows \(dot\)\)/);
  });
  it('a fallback the query cannot fill is passed over, for the next of the layout\'s that it can', () => {
    // No dimension: the share bar has nothing to divide by, and the gauge reads the same metric against its range.
    const signups: Spec = { query: { metrics: ['signups'], range: '28d' }, layers: [{ mark: 'arc', encode: { angle: 'signups', radius: 0.2 } }] };
    const split: FitRule = { id: 'split', layout: 'radial', container: 'view', needs: { inline: 300 }, hide: [], fallback: 'bar-list' }, alone: FitRule = { ...split, id: 'alone', layout: 'radial', mark: 'arc', keep: 'marks' };
    expect(fills('bar-list', signups.query)).toBe(false);
    expect(fills('gauge', signups.query)).toBe(true);
    expect(fills('bar-list', pages.query)).toBe(true);
    expect(run(signups, context(299, [split])).plan).toMatchObject({ layout: 'radial', preset: null });
    expect(err(() => run(signups, context(299, [split, { ...alone, fallback: 'gauge' }])))).toMatch(/leads back to the "radial \(arc\)" layout/);
    // A name no preset has is still expand()'s to refuse.
    expect(fills('nope', signups.query)).toBe(true);
  });
});
