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
 * with nothing to say what it is (docs/visual-audit, F2). Each rule that does is listed here, with its window. The list
 * is what is owed: a rule that closes its window comes off it, and a new rule that opens one fails here. Closing one is
 * a decision about that key, which has two honest answers: the key stays as long as its marks, or the marks give up
 * the encoding when the key goes.
 *
 * A rule is not listed where it puts a shorter form of the same guide in the key's place (the legend's one line, a
 * label at each line's end), or where it takes the marks too. What a rule cannot see is not here either: a label at a
 * line's end is no key to bars, which have no ends. */
describe('a key leaves no sooner than the marks it keys', () => {
  const DATA = ['plot', 'points', 'rows', 'band', 'radial'];
  const keyOf = (part: string) => Object.values(GUIDES).find((g) => g.key && (g.parts as string[]).includes(part));
  const size = (needs: FitRule['needs']) => (needs.inline ?? 0) + ' × ' + (needs.block ?? 0);
  const windows = (rules: FitRule[]): string[] => [...new Set(rules.map((r) => r.layout))].flatMap((layout) => {
    const own = rules.filter((r) => r.layout === layout);
    return own.flatMap((r) => {
      const keys = r.hide.filter((p) => keyOf(p)), shorter = (r.show ?? []).some((p) => keys.some((k) => keyOf(k) === keyOf(p))) || r.set?.legend === 'top';
      if (!keys.length || shorter || r.fallback || r.hide.some((p) => DATA.includes(p))) return [];
      // What takes the marks these key: the rules that hide a part of marks, or for a glyph's worth the rule its glyphs give way under.
      const glyphs = keys.includes('unit-key'), takes = own.filter((m) => (glyphs ? m.mark === 'unit' : !m.mark && (m.fallback || m.hide.some((p) => DATA.includes(p)))));
      const least = { inline: Math.min(...takes.map((m) => m.needs.inline ?? 0), Infinity), block: Math.min(...takes.map((m) => m.needs.block ?? 0), Infinity) };
      const stay = { inline: takes.length ? least.inline : 0, block: takes.length ? least.block : 0 };
      return (r.needs.inline ?? 0) > stay.inline || (r.needs.block ?? 0) > stay.block ? [layout + ' ' + r.id + ': ' + keys.join(', ') + ' under ' + size(r.needs) + ', marks to ' + size(stay)] : [];
    });
  });

  it('in core: the windows that are owed, and no other', () => {
    expect(windows(FIT_RULES)).toEqual([
      'cartesian axes: y-axis-2 under 280 × 120, marks to 152 × 46',                 // a second unit's line, in the bare plot beside the number
      'cartesian axis-2: y-axis-2 under 340 × 0, marks to 152 × 46',                // and beside the first axis, which it is then read against
      'cartesian labels: labels under 280 × 120, marks to 152 × 46',                // series colours in the bare plot
      'cartesian size: size under 320 × 160, marks to 152 × 46',                    // sized dots
      'cartesian unit-key: unit-key under 0 × 160, marks to 280 × 120',             // glyphs worth more than one, with nothing to say how much
      'rows columns: columns under 0 × 80, marks to 90 × 0',                        // columns of values with no header
      'rows legend-top: legend, legend-top under 0 × 84, marks to 90 × 0',          // a divided row's colours
      'rows unit-key: unit-key under 0 × 120, marks to 280 × 0',
      'band unit-key: unit-key under 0 × 220, marks to 280 × 180',
      'radial legend-top: legend, legend-top under 0 × 88, marks to 72 × 64',       // a circle's colours
      'radial rim: rim under 230 × 120, marks to 72 × 64',                          // slices with no names
      'radial unit-key: unit-key under 0 × 200, marks to 280 × 160',
      'matrix ramp: ramp, size under 240 × 150, marks to 150 × 90',                 // a grid's colours, and its dots' sizes
    ]);
  });

  it('in the custom marks registered: the same', () => {
    expect(windows([...customMarks().values()].flatMap((m) => m.rules))).toEqual([
      'geo guides: ramp, size under 320 × 170, marks to 280 × 120',                 // a map's fills and symbols
      'link guides: labels under 320 × 140, marks to 280 × 120',                    // a Sankey's nodes with no names
      'geo-tiles guides: ramp, size under 320 × 170, marks to 280 × 120',
      'geo-hexes guides: ramp, size under 320 × 170, marks to 280 × 120',
      'partition guides: ramp, size under 320 × 170, marks to 280 × 120',           // a treemap painted by a metric
    ]);
  });
});
