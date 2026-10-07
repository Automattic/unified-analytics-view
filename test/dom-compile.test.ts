import { describe, expect, it } from 'vitest';
import { FIT_RULES, type FitRule } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';

// The compiler is string work, so it is held here with no DOM. What the browser makes of the CSS is checked on the bench.
const only = (layout: string, id: string) => FIT_RULES.filter((r) => r.layout === layout && r.id === id);

describe('compileFitRules', () => {
  it('writes one @container block per need, never an "or" across both axes', () => {
    const css = compileFitRules(only('cartesian', 'axes'));
    expect(css).toBe([
      '/* cartesian axes */',
      '@container view (inline-size < 280px) {',
      '  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) :is(.vg-x-axis, .vg-y-axis, .vg-grid) { display: none; }',
      '  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) .vg-number { display: block; }',
      '  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) { --vg-arrange: side; }',
      '}',
      '/* cartesian axes */',
      '@container view (block-size < 120px) {',
      '  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) :is(.vg-x-axis, .vg-y-axis, .vg-grid) { display: none; }',
      '  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) .vg-number { display: block; }',
      '  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) { --vg-arrange: side; }',
      '}',
    ].join('\n'));
    expect(compileFitRules(FIT_RULES)).not.toMatch(/\bor\b/);
  });

  it('maps roles to data-role, on the plot container', () => {
    expect(compileFitRules(only('cartesian', 'secondary'))).toContain(
      '@container plot (block-size < 90px) {\n  .vg[data-layout="cartesian"]:not([data-keep~="secondary"]) :is([data-role="comparison"], [data-role="reference"], [data-role="context"]) { display: none; }\n}');
  });

  it('maps the middle tick to the ranked x label, and a rule with no keep to a bare figure', () => {
    expect(compileFitRules(only('cartesian', 'mid-tick'))).toBe(
      '/* cartesian mid-tick */\n@container view (inline-size < 380px) {\n  .vg[data-layout="cartesian"] .vg-x-axis [data-rank] { display: none; }\n}');
  });

  it('writes a set with nothing hidden, as the band legend has', () => {
    expect(compileFitRules(only('band', 'legend'))).toBe(
      '/* band legend */\n@container view (inline-size < 170px) {\n  .vg[data-layout="band"]:not([data-keep~="guides"]) { --vg-legend: top; }\n}');
  });

  it('adds what a layout says changes with a rule, under the same condition and keep', () => {
    const css = compileFitRules(only('cartesian', 'marks'), { cartesian: { marks: { '': 'grid-template: none;', '.vg-body': 'display: none;' } } });
    const fig = '.vg[data-layout="cartesian"]:not([data-keep~="marks"])';
    expect(css.split('\n').slice(0, 6)).toEqual([
      '/* cartesian marks */', '@container view (inline-size < 152px) {',
      '  ' + fig + ' .vg-plot { display: none; }', '  ' + fig + ' .vg-number { display: block; }',
      '  ' + fig + ' { grid-template: none; }', '  ' + fig + ' .vg-body { display: none; }',
    ]);
  });

  it('handles every default rule, in order, one block per need', () => {
    const css = compileFitRules(FIT_RULES);
    const needs = FIT_RULES.reduce((n, r) => n + Object.keys(r.needs).length, 0);
    expect(css.match(/@container /g)).toHaveLength(needs);
    expect(css.match(/\/\* (\w+ [\w-]+) \*\//g)!.filter((c, i, a) => c !== a[i - 1])).toEqual(FIT_RULES.map((r) => '/* ' + r.layout + ' ' + r.id + ' */'));
    for (const r of FIT_RULES) for (const part of r.show ?? []) expect(css).toContain('.vg-' + part + ' { display: block; }');
  });

  it('refuses a name that would escape its selector, and says what a name is', () => {
    const bad: FitRule = { id: 'x', layout: 'cartesian', container: 'view', needs: { inline: 100 }, hide: ['plot } :host { display: none'] };
    expect(() => compileFitRules([bad])).toThrow(/not a name\. Use letters, digits/);
    expect(() => compileFitRules([{ ...bad, hide: [], needs: { inline: '1px) or (x' as unknown as number } }])).toThrow(/as a number of px/);
  });
});
