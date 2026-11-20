import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { READS, customMarks, makeContainer, resolve, type Reads, type Spec } from '@unified-analytics/core';
import { catalog, runQuery } from '@unified-analytics/fixtures';       // registers the `geo`, `link` and `partition` marks
import { err, errOf, ofUnbounded } from './helpers.ts';

/* What each mark reads is data (packages/core/src/reads.ts), and an encoding that is not in it is refused by name.
 * Before it was, each of the first four specs here drew: without the colour, without the size, without the text. */
const byDay = { metrics: ['visitors'], by: ['date.day'], range: '7d' }, byPage = { metrics: ['pageviews', 'visitors'], by: ['page'], limit: 3 };
const sized: Spec = { query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', size: 'visitors' } }] };
const SIZED = 'Layer 1 encodes "visitors" on size, and the "line" mark in a "cartesian" layout reads no size. It reads: x (a dimension or a metric), y (a metric), color (a dimension), detail (a dimension). Remove "size", or use a mark that reads it there: bar or dot.';

describe('what each mark reads', () => {
  it('refuses a channel the mark does not read in its layout, and names the marks there that do', () => {
    expect(err(sized)).toBe(SIZED);
    expect(err({ query: byPage, layers: [{ mark: 'text', encode: { y: 'page', x: 'pageviews', text: 'pageviews' } }] }))
      .toBe('Layer 1 encodes "pageviews" on x, and the "text" mark in a "rows" layout reads no x. It reads: y (a dimension), text (a dimension, a metric or a companion of a dimension). Remove "x", or use a mark that reads it there: bar, rule, tick, dot or unit.');
  });

  it('refuses what a channel holds where the mark takes no account of it, and says where that is read', () => {
    expect(err({ query: byPage, layers: [{ mark: 'bar', encode: { x: 'page', y: 'pageviews', color: 'visitors' } }] }))
      .toMatch(/^Layer 1 encodes "visitors", a metric, on color, and the "bar" mark in a "cartesian" layout takes a dimension there\. Encode one, or remove "color"\. On color, a metric is read by: cell in matrix, dot in matrix, "geo", .*"partition"\.$/);
    expect(err({ query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 1000 } }, { mark: 'bar', encode: { x: 'date.day', y: 'visitors' } }] }))
      .toBe('Layer 1 encodes 1000, a number, on y, and the "line" mark in a "cartesian" layout takes a metric there. Encode one, or remove "y". On y, a number is read by: bar in cartesian, rule in cartesian.');
  });

  it('refuses a mark its layout does not draw, and says why the layout is that one', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'bar', encode: { x: 'visitors', color: 'channel' }, stack: 'normalize' }, { mark: 'text', encode: { text: 'channel' } }] }))
      .toBe('Layer 2 has the mark "text", and these layers are laid out as "band" (a dimension on color), which draws bar or unit. Use one of those, or change what the layers put on x, y and color: the "text" mark is drawn in cartesian or rows.');
    // An arc with nothing on angle is laid out as a band, whose builder breaks on it: what is unread is said in place of the break.
    expect(err({ query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'arc', encode: { radius: 'channel', color: 'channel' } }] }))
      .toBe('Layer 1 has the mark "arc", and these layers are laid out as "band" (a dimension on color), which draws bar or unit. Use one of those, or change what the layers put on x, y and color: the "arc" mark is drawn in radial.');
  });

  it('holds a custom mark to what it says it reads', () => {
    for (const [name, mark] of customMarks()) expect(mark.reads, 'the "' + name + '" mark says what it reads').toBeDefined();
    expect(err({ query: { metrics: ['visitors'], by: ['country'] }, layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors', detail: 'country' } }] }))
      .toBe('Layer 1 encodes "country" on detail, and the "geo" mark reads no detail. It reads: x (a dimension), color (a metric), size (a metric). Remove "detail".');
  });

  it('refuses the same spec whatever the data and the room: with nothing recorded, with no comparison, and where the view gives way to another', () => {
    expect(err(sized, runQuery(byDay, 'empty'))).toBe(SIZED);
    // A layer of the period before is left out where the query does not compare. It is still the spec's.
    expect(err({ query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }, { ...sized.layers![0]!, series: 'previous' }] })).toBe(SIZED.replace('Layer 1', 'Layer 2'));
    const glyphs: Spec = { query: byPage, layers: [{ mark: 'unit', encode: { x: 'page', y: 'pageviews', size: 'pageviews' } }] };
    expect(errOf(() => resolve(glyphs, runQuery(byPage), makeContainer(200), catalog))).toMatch(/^Layer 1 encodes "pageviews" on size, and the "unit" mark in a "cartesian" layout reads no size\./);
  });

  it('leaves the scene its say first: what it refuses of a form, it refuses in its own words', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['age', 'sex'] }, layers: [{ mark: 'bar', encode: { y: 'age', x: 'visitors', detail: 'sex' } }] })).toContain('Use "dot" or "tick" for a mark at each value');
  });

  it('is true of detail: every mark of a plot it is listed for is split into a series for each value', () => {
    const q = { metrics: ['visitors'], by: ['date.day', 'country'], range: '7d' }, countries = new Set(runQuery(q).rows.map((r) => r.country)).size;
    for (const [mark, reads] of Object.entries(READS.cartesian!)) {
      if (!reads.detail || mark === 'unit') continue;
      const { scene } = ofUnbounded({ query: q, layers: [{ mark, encode: { x: 'date.day', y: 'visitors', detail: 'country', ...(mark === 'text' && { text: 'visitors' }) } }] });
      expect(new Set(scene.nodes.filter((n) => n.series != null).map((n) => n.series)).size, mark).toBe(countries);
    }
  });
});

/* An agent writes specs from the reference, so the reference lists the table as it is: a row for each mark in each
 * layout, and for each custom mark registered, written as `row` writes it. */
it('the reference lists what each mark reads, and nothing else', () => {
  const row = (layout: string, mark: string, reads: Reads) => '| `' + layout + '` | `' + mark + '` | ' + Object.entries(reads).map(([ch, takes]) => '`' + ch + '` ' + takes.join(', ')).join('; ') + ' |';
  const rows = [...Object.entries(READS).flatMap(([layout, marks]) => Object.entries(marks).map(([mark, reads]) => row(layout, mark, reads))),
    ...[...customMarks()].map(([mark, { reads }]) => row(mark, mark, reads!))];
  const reference = readFileSync(new URL('../docs/view-grammar-reference.md', import.meta.url), 'utf8');
  const section = reference.slice(reference.indexOf('\n### What each mark reads'), reference.indexOf('\n### Transforms'));
  expect(section.split('\n').filter((line) => line.startsWith('| `')), 'docs/view-grammar-reference.md, section 7, "What each mark reads": the rows of READS, as this test writes them').toEqual(rows);
});
