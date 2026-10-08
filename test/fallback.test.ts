import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES, buildScene, fallbackRule, makeContainer, place, resolve } from '@universal-analytics/core';
import type { Container, FitRule, Spec } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { catalog, runQuery, samples } from '@universal-analytics/fixtures';

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
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };

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
  it('no default rule names one, so nothing changes for a view whose context does not', () => {
    expect(FIT_RULES.some((r) => r.fallback)).toBe(false);
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
    const fig = '.vg[data-layout="band"]:not([data-keep~="marks"])', body = '  ' + fig + ' { display: none; }\n  ' + fig + ' ~ .vg-fallback { display: block; }\n}';
    expect(compileFitRules([swap])).toBe('/* band swap */\n@container view (inline-size < 199.5px) {\n' + body + '\n/* band swap */\n@container view (block-size < 59.5px) {\n' + body);
  });
});
