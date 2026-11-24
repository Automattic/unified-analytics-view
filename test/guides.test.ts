import { describe, expect, it } from 'vitest';
import { FIT_RULES, GUIDES, customMarks, guidesOf, type FitRule, type Layer } from '@unified-analytics/core';
import { catalog } from '@unified-analytics/fixtures';       // registers the `geo`, `link` and `partition` marks

/* A guide is read off a scale, so a view has one because of what its layers encode (packages/core/src/guides.ts). */
describe('the guides a view has', () => {
  const of = (layout: string, ...layers: Layer[]) => Object.keys(guidesOf(layout, layers, catalog)).sort();
  it('come from what its layers encode, whatever the layout', () => {
    expect(of('cartesian', { mark: 'line', encode: { x: 'date.day', y: 'visitors' } })).toEqual(['grid', 'x', 'y']);
    // A dimension on color is a legend, in a plot, a band, a circle and a row that is divided by it.
    expect(of('cartesian', { mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'channel' } })).toContain('legend');
    expect(of('band', { mark: 'bar', encode: { x: 'visitors', color: 'channel' } })).toEqual(['legend']);
    expect(of('radial', { mark: 'arc', encode: { angle: 'visitors', color: 'channel' } })).toEqual(['legend']);
    expect(of('rows', { mark: 'bar', encode: { y: 'age', x: 'visitors', color: 'sex' }, stack: 'zero' })).toEqual(['legend']);
    // Not where it is the rows' own: each row's label says which it is.
    expect(of('rows', { mark: 'bar', encode: { y: 'page', x: 'pageviews', color: 'page' } })).toEqual([]);
    // A metric on color is a ramp, a metric on size a key to sizes, and a bar's size neither: it is its column's width.
    expect(of('matrix', { mark: 'cell', encode: { x: 'hour', y: 'weekday', color: 'visitors' } })).toEqual(['ramp', 'x', 'y']);
    expect(of('matrix', { mark: 'dot', encode: { x: 'hour', y: 'weekday', size: 'visitors' } })).toEqual(['size', 'x', 'y']);
    expect(of('cartesian', { mark: 'bar', encode: { x: 'channel', y: 'visitors', color: 'device', size: 'visitors' }, stack: 'normalize' })).not.toContain('size');
    expect(of('radial', { mark: 'arc', encode: { angle: 'hour', radius: 'visitors' } })).toEqual(['rim']);
    expect(of('rows', { mark: 'unit', encode: { y: 'page', x: 'pageviews' } })).toEqual(['unitKey']);
    // A custom mark is asked nothing: its two keys start on, and its scene says which it has.
    expect(of('geo', { mark: 'geo', encode: { x: 'country', color: 'visitors' } })).toEqual(['ramp', 'size']);
  });
});

/* A key says what an encoding means, so the marks it keys cannot be read without it. A fit rule that takes a key while
 * those marks are still drawn leaves a window of sizes where a colour, a size, a glyph or a second scale is on screen
 * with nothing to say what it is (docs/visual-audit, F2). There were eighteen such windows, and there are none: a rule
 * that opens one fails here, and names it. A key has three honest answers, and every rule gives one of them: the key
 * stays as long as its marks, a shorter form of it does, or the marks give up the encoding when the key goes.
 *
 * So a rule passes where it puts a shorter form of the same guide in the key's place (the legend's one line, a label
 * at each line's end), where it takes the marks too (`marks` in GUIDES), or where it has the marks drawn without the
 * encoding (`plain` in GUIDES: dots of one size, series in one paint). A key cut down in place (the ramp as a strip,
 * the key to sizes as its largest step, a rim thinned by rank) is never hidden, so no rule that does it is asked. */
describe('a key leaves no sooner than the marks it keys', () => {
  const DATA = ['plot', 'points', 'rows', 'band', 'radial'];
  const keyOf = (part: string) => Object.values(GUIDES).find((g) => g.key && (g.parts as string[]).includes(part));
  const size = (needs: FitRule['needs']) => (needs.inline ?? 0) + ' × ' + (needs.block ?? 0);
  const windows = (rules: FitRule[]): string[] => [...new Set(rules.map((r) => r.layout))].flatMap((layout) => {
    const own = rules.filter((r) => r.layout === layout);
    return own.flatMap((r) => {
      const keys = r.hide.filter((p) => keyOf(p)), shorter = (r.show ?? []).some((p) => keys.some((k) => keyOf(k) === keyOf(p))) || r.set?.legend === 'top';
      // A rule that takes the marks takes their keys with good reason: all of a view's marks, or the ones a key is for.
      // So does one that has the marks drawn without the encoding: dots of one size, series in one paint.
      const settled = (k: string) => { const g = keyOf(k)!; return r.hide.includes(g.marks ?? '') || (!!g.plain && r.set?.[g.plain[0]] === g.plain[1]); };
      if (!keys.length || shorter || r.fallback || r.hide.some((p) => DATA.includes(p)) || keys.every(settled)) return [];
      // What takes the marks these key: the rules that hide a part of marks, or for a glyph's worth the rule its glyphs give way under.
      const glyphs = keys.includes('unit-key'), takes = own.filter((m) => (glyphs ? m.mark === 'unit' : !m.mark && (m.fallback || m.hide.some((p) => DATA.includes(p)))));
      const least = { inline: Math.min(...takes.map((m) => m.needs.inline ?? 0), Infinity), block: Math.min(...takes.map((m) => m.needs.block ?? 0), Infinity) };
      const stay = { inline: takes.length ? least.inline : 0, block: takes.length ? least.block : 0 };
      return (r.needs.inline ?? 0) > stay.inline || (r.needs.block ?? 0) > stay.block ? [layout + ' ' + r.id + ': ' + keys.join(', ') + ' under ' + size(r.needs) + ', marks to ' + size(stay)] : [];
    });
  });

  it('in core: no rule opens a window', () => {
    expect(windows(FIT_RULES)).toEqual([]);
  });

  it('and one that did would be named, with its window', () => {
    const bare = { id: 'bare', layout: 'cartesian', container: 'view', needs: { inline: 400 }, hide: ['legend'], keep: 'guides' } as FitRule;
    expect(windows([...FIT_RULES, bare])).toEqual(['cartesian bare: legend under 400 × 0, marks to 152 × 46']);
    // The same rule is honest once it says the marks are then one paint.
    expect(windows([...FIT_RULES, { ...bare, set: { split: 'plain' } }])).toEqual([]);
  });

  it('in the custom marks registered: the same', () => {
    expect(windows([...customMarks().values()].flatMap((m) => m.rules))).toEqual([]);
  });
});
