import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES, type FitRule, type Spec } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';
import { GEO_RULES } from '@unified-analytics/geo';
import { geoPainter } from '@unified-analytics/geo/dom';
import { LAYOUTS, painterOf } from '../packages/dom/src/layouts/index.ts';
import { BASE_CSS, FALLBACK_CSS, check, rulesOver } from '../packages/dom/src/view.ts';

// The compiler is string work, so it is held here with no DOM. What the browser makes of the CSS is checked on the bench.
const only = (layout: string, id: string) => FIT_RULES.filter((r) => r.layout === layout && r.id === id);

describe('compileFitRules', () => {
  it('writes one @container block per need, never an "or" across both axes', () => {
    const css = compileFitRules(only('cartesian', 'axes'));
    expect(css).toBe([
      '/* cartesian axes */',
      '@container uav-view (inline-size < 279.5px) {',
      '  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) :is(.uav-x-axis, .uav-y-axis, .uav-grid) { display: none; }',
      '  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) .uav-number { display: block; }',
      '  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) { --uav-arrange: side; }',
      '}',
      '/* cartesian axes */',
      '@container uav-view (block-size < 119.5px) {',
      '  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) :is(.uav-x-axis, .uav-y-axis, .uav-grid) { display: none; }',
      '  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) .uav-number { display: block; }',
      '  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) { --uav-arrange: side; }',
      '}',
    ].join('\n'));
    expect(compileFitRules(FIT_RULES)).not.toMatch(/\bor\b/);
  });

  it('maps roles to data-role, on the plot container', () => {
    expect(compileFitRules(only('cartesian', 'secondary'))).toContain(
      '@container uav-plot (block-size < 89.5px) {\n  .uav[data-layout="cartesian"]:not([data-keep~="secondary"]) :is([data-role="comparison"], [data-role="reference"], [data-role="context"]) { display: none; }\n}');
  });

  it('maps the middle tick to the ranked x label, and a rule with no keep to a bare figure', () => {
    expect(compileFitRules(only('cartesian', 'mid-tick'))).toBe(
      '/* cartesian mid-tick */\n@container uav-view (inline-size < 379.5px) {\n  .uav[data-layout="cartesian"] .uav-x-axis [data-rank] { display: none; }\n}');
  });

  it('writes a set with nothing hidden, as the band legend has', () => {
    expect(compileFitRules(only('band', 'legend'))).toBe(
      '/* band legend */\n@container uav-view (inline-size < 169.5px) {\n  .uav[data-layout="band"]:not([data-keep~="guides"]) { --uav-legend: top; }\n}');
  });

  it('adds what a layout says changes with a rule, under the same condition and keep', () => {
    const css = compileFitRules(only('cartesian', 'marks'), { cartesian: { marks: { '': 'grid-template: none;', '.uav-body': 'display: none;' } } });
    const fig = '.uav[data-layout="cartesian"]:not([data-keep~="marks"])';
    expect(css.split('\n').slice(0, 6)).toEqual([
      '/* cartesian marks */', '@container uav-view (inline-size < 151.5px) {',
      '  ' + fig + ' .uav-plot { display: none; }', '  ' + fig + ' .uav-number { display: block; }',
      '  ' + fig + ' { grid-template: none; }', '  ' + fig + ' .uav-body { display: none; }',
    ]);
  });

  // A page may name a container of its own "view" or "plot". Ours are `uav-view` and `uav-plot`, so its does not answer our queries.
  it('names its containers uav-view and uav-plot wherever one is declared or queried', () => {
    const painters = [...Object.values(LAYOUTS).filter((p) => p.layout !== 'geo'), geoPainter];
    const compiled = compileFitRules([...FIT_RULES, ...GEO_RULES, ...painters.flatMap((p) => (p === geoPainter ? [] : p.rules?.(CONTAINER_RULES) ?? []))], Object.fromEntries(painters.map((p) => [p.layout, p.fit ?? {}])));
    const css = [BASE_CSS, FALLBACK_CSS, ...painters.map((p) => p.css), compiled].join('\n');
    expect(css).toContain(':host { display: block; container: uav-view / inline-size;');
    expect(css).toContain('container: uav-plot / size;');
    expect(compiled).toContain('@container uav-plot (');
    expect(css.match(/@container (?!uav-(view|plot) \()[^{]*/g)).toBeNull();
    expect(css.match(/container(-name)?:\s*(?!\s|uav-(view|plot)\b)[^;]*/g)).toBeNull();
  });
  it('handles every default rule, in order, one block per need', () => {
    const css = compileFitRules(FIT_RULES);
    const needs = FIT_RULES.reduce((n, r) => n + Object.keys(r.needs).length, 0);
    expect(css.match(/@container /g)).toHaveLength(needs);
    expect(css.match(/\/\* (\w+ [\w-]+) \*\//g)!.filter((c, i, a) => c !== a[i - 1])).toEqual(FIT_RULES.map((r) => '/* ' + r.layout + ' ' + r.id + ' */'));
    for (const r of FIT_RULES) for (const part of r.show ?? []) expect(css).toContain('.uav-' + part + ' { display: block; }');
  });

  it('refuses a name that would escape its selector, and says what a name is', () => {
    const bad: FitRule = { id: 'x', layout: 'cartesian', container: 'view', needs: { inline: 100 }, hide: ['plot } :host { display: none'] };
    expect(() => compileFitRules([bad])).toThrow(/not a name\. Use letters, digits/);
    expect(() => compileFitRules([{ ...bad, hide: [], needs: { inline: '1px) or (x' as unknown as number } }])).toThrow(/as a number of px/);
  });

  it('says how to write a list given as a bare value, and a rule with no needs', () => {
    const axes = FIT_RULES[0]!;
    expect(() => compileFitRules([{ ...axes, hide: 'x-axis' as unknown as string[] }])).toThrow(/gives "hide" as "x-axis"\. It is a list: write \["x-axis"\]/);
    expect(() => compileFitRules([{ ...axes, needs: undefined as unknown as FitRule['needs'] }])).toThrow(/has no "needs"\. Give the room its part needs/);
  });
});

// The element's own checks are plain functions, so they are held here too. The element itself is checked on the bench.
describe('what <ua-view> checks before it paints', () => {
  const trend = samples.trend!.spec, result = runQuery(trend.query);
  it('says how to write a list that a spec gives as a bare value', () => {
    expect(() => check(trend, result, catalog)).not.toThrow();
    expect(() => check({ ...trend, keep: 'guides' } as unknown as Spec, result, catalog)).toThrow(/gives "keep" as "guides"\. It is a list: write \["guides"\]/);
    expect(() => check({ ...trend, query: { ...trend.query, by: 'date.day' } } as unknown as Spec, result, catalog)).toThrow(/"query\.by" as "date\.day"\. It is a list/);
    expect(() => check({ ...trend, query: { ...trend.query, metrics: 'visitors' } } as unknown as Spec, result, catalog)).toThrow(/"query\.metrics" as "visitors"/);
  });
  it('takes only the catalog\'s own names for a metric or a dimension', () => {
    expect(() => check({ query: { metrics: ['constructor'] } }, result, catalog)).toThrow(/no metric "constructor"\. It has: visitors, pageviews, present/);
    expect(() => check({ ...trend, query: { ...trend.query, by: ['toString'] } }, result, catalog)).toThrow(/no dimension "toString"/);
  });
  it('says how to register the painter a custom mark has none of, and asks none of the layouts with no body', () => {
    expect(() => painterOf('blob')).toThrow('No painter is registered for the "blob" layout. Call registerPainter({ layout: "blob", css, paint }) before the view paints.');
    expect(painterOf('cartesian')).toBe(LAYOUTS.cartesian);
    for (const layout of ['none', 'prose']) expect(painterOf(layout), layout).toBeUndefined();
  });
  it('lays a context\'s rules over the defaults one level down, so a size it leaves out is still the default', () => {
    expect(rulesOver({ rows: { rowHeight: 20 } } as never).rows).toEqual({ rowHeight: 20, gap: CONTAINER_RULES.rows.gap });
    expect(rulesOver({ axes: {} } as never).axes).toEqual(CONTAINER_RULES.axes);
    expect(rulesOver({ bare: null } as never).bare).toEqual(CONTAINER_RULES.bare);
    expect(rulesOver()).toEqual(CONTAINER_RULES);
  });
});
