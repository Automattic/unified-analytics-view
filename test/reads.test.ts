import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FIELDS, NEEDS, READS, customMarks, expand, isDim, isMetric, layerKeys, layoutOf, resolve, type Layer, type Reads, type Result, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, samples } from '@unified-analytics/fixtures';       // registers the `geo`, `link` and `partition` marks
import { err, errOf, ofUnbounded } from './helpers.ts';

/* What each mark reads is data (packages/core/src/reads.ts), and what a layer says that is not in it is refused by
 * name. Before it was, each spec refused here drew: without the colour, without the size, without the text, or as nothing. */
const byDay = { metrics: ['visitors'], by: ['date.day'], range: '7d' }, byPage = { metrics: ['pageviews', 'visitors'], by: ['page'], limit: 4 };
const byChannel = { metrics: ['visitors'], by: ['channel'] }, bars: Layer = { mark: 'bar', encode: { x: 'page', y: 'pageviews' } }, row: Layer = { mark: 'bar', encode: { y: 'page', x: 'pageviews' } };
const sized: Spec = { query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', size: 'visitors' } }] };
const SIZED = 'Layer 1 encodes "visitors" on size, and the "line" mark in a "cartesian" layout reads no size. It reads: x (a dimension or a metric), y (a metric), color (a dimension), detail (a dimension). Remove "size", or use a mark that reads it there: bar or dot.';

describe('what each mark reads', () => {
  it('refuses a channel the mark does not read in its layout, and names the marks there that do', () => {
    expect(err(sized)).toBe(SIZED);
    expect(err({ query: byPage, layers: [{ mark: 'text', encode: { y: 'page', x: 'pageviews', text: 'pageviews' } }] }))
      .toBe('Layer 1 encodes "pageviews" on x, and the "text" mark in a "rows" layout reads no x. It reads: y (a dimension), text (a dimension, a metric or a companion of a dimension). Remove "x", or use a mark that reads it there: bar, rule, tick, dot, unit, line or area.');
  });

  it('refuses what a channel holds where the mark takes no account of it, and says where that is read', () => {
    expect(err({ query: byPage, layers: [{ mark: 'line', encode: { x: 'page', y: 'pageviews', color: 'visitors' } }] }))
      .toMatch(/^Layer 1 encodes "visitors", a metric, on color, and the "line" mark in a "cartesian" layout takes a dimension there\. Encode one, or remove "color"\. On color, a metric is read by: bar in cartesian, dot in cartesian, cell in matrix, dot in matrix, "geo", .*"partition"\.$/);
    expect(err({ query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 1000 } }, { mark: 'bar', encode: { x: 'date.day', y: 'visitors' } }] }))
      .toBe('Layer 1 encodes 1000, a number, on y, and the "line" mark in a "cartesian" layout takes a metric there. Encode one, or remove "y". On y, a number is read by: bar in cartesian, rule in cartesian.');
  });

  it('refuses a mark its layout does not draw, and says why the layout is that one', () => {
    expect(err({ query: byChannel, layers: [{ mark: 'bar', encode: { x: 'visitors', color: 'channel' }, stack: 'normalize' }, { mark: 'text', encode: { text: 'channel' } }] }))
      .toBe('Layer 2 has the mark "text", and these layers are laid out as "band" (a dimension on color), which draws bar or unit. Use one of those, or change what the layers put on x, y and color: the "text" mark is drawn in cartesian, rows or matrix.');
    // An arc with nothing on angle is laid out as a band, whose builder breaks on it: what is unread is said in place of the break.
    expect(err({ query: byChannel, layers: [{ mark: 'arc', encode: { radius: 'channel', color: 'channel' } }] }))
      .toBe('Layer 1 has the mark "arc", and these layers are laid out as "band" (a dimension on color), which draws bar or unit. Use one of those, or change what the layers put on x, y and color: the "arc" mark is drawn in radial.');
  });

  it('refuses a mark with nothing on a channel it is not drawn without: once it was drawn as nothing, as "undefined", or broke its builder', () => {
    expect(err({ query: byPage, layers: [{ mark: 'bar', encode: { x: 'page' } }] })).toBe('Layer 1 has the mark "bar" and nothing on y, and the "bar" mark in a "cartesian" layout is not drawn without it. Encode a metric or a number on y.');
    expect(err({ query: byPage, layers: [row, { mark: 'text', encode: { y: 'page' } }] })).toBe('Layer 2 has the mark "text" and nothing on text, and the "text" mark in a "rows" layout is not drawn without it. Encode a dimension, a metric or a companion of a dimension on text.');
    expect(err({ query: byPage, layers: [row, { mark: 'dot', encode: { y: 'page' } }] })).toBe('Layer 2 has the mark "dot" and nothing on x, and the "dot" mark in a "rows" layout is not drawn without it. Encode a metric or a number on x.');
    expect(err({ query: byChannel, layers: [{ mark: 'bar', encode: { color: 'channel' } }] })).toBe('Layer 1 has the mark "bar" and nothing on x, and the "bar" mark in a "band" layout is not drawn without it. Encode a metric on x.');
    // A tick needs a value on y unless it is a rug, which the table cannot say: its builder does.
    expect(err({ query: byPage, layers: [{ mark: 'tick', encode: { x: 'page' } }] })).toBe('Layer 1 is a tick with nothing on y, so there is no value to stand it at. Encode a metric on y, for a stroke across each "page" at its value. With no y a tick is a rug, along the foot of a plot whose x is a metric.');
  });

  it('refuses a label, an align or a sweep on a mark that has no use for it', () => {
    expect(err({ query: byPage, layers: [{ ...bars, align: 'end' }] })).toBe('Layer 1 has "align", and the "bar" mark in a "cartesian" layout reads none. Remove it. It is read by: tick in cartesian, text in rows, tick in rows.');
    expect(err({ query: byPage, layers: [{ mark: 'rule', encode: { y: 'page', x: 'pageviews' }, label: 'Target' }] })).toBe('Layer 1 has "label", and the "rule" mark in a "rows" layout reads none. Remove it. It is read by: rule in cartesian.');
    expect(err({ query: { metrics: ['visitors'], by: ['country'] }, layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors' }, sweep: 'half' }] })).toBe('Layer 1 has "sweep", and the "geo" mark reads none. Remove it. It is read by: arc in radial, unit in radial.');
    // In a plot a label is a line's at a number. A rule for each row has no place for one, and its builder says so.
    expect(err({ query: byPage, layers: [bars, { mark: 'rule', encode: { x: 'page', y: 'pageviews' }, label: 'Hello' }] })).toBe('A rule for each row has no place for its label yet. Remove "label", and name what the strokes are in the view\'s title.');
  });

  it('refuses the dimension a plot has a mark for each of on color, and beside itself on detail: it splits nothing and paints nothing', () => {
    expect(err({ query: byPage, layers: [{ mark: 'bar', encode: { x: 'page', y: 'pageviews', color: 'page' } }] }))
      .toBe('Layer 1 encodes "page" on color, and this plot has a mark for each "page" already, so it splits the layer no further and no mark is painted by it. Remove "color". For a colour each, put "page" on y and the metric on x: a row is painted by its own dimension.');
    expect(err({ query: byPage, layers: [{ mark: 'bar', encode: { x: 'page', y: 'pageviews', detail: 'page' } }] })).toMatch(/^Layer 1 encodes "page" on detail, and this plot has a mark for each "page" already, .* Remove "detail"\.$/);
    expect(err({ query: byPage, layers: [{ mark: 'dot', encode: { x: 'pageviews', y: 'visitors', color: 'page' } }] })).toMatch(/^Layer 1 encodes "page" on color, and this plot has a mark for each "page" already, .* Remove "color"\.$/);
    // In rows the same encoding is read: a colour for each row.
    expect(err({ query: byPage, layers: [{ mark: 'bar', encode: { y: 'page', x: 'pageviews', color: 'page' } }] })).toBeUndefined();
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
    expect(errOf(() => resolve(glyphs, runQuery(byPage), catalog))).toMatch(/^Layer 1 encodes "pageviews" on size, and the "unit" mark in a "cartesian" layout reads no size\./);
  });

  it('leaves the scene its say first: what it refuses of a form, it refuses in its own words', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['age', 'sex'] }, layers: [{ mark: 'bar', encode: { y: 'age', x: 'visitors', detail: 'sex' } }] })).toContain('Use "dot" or "tick" for a mark at each value');
  });

  it('a mark at a number alone stands on a row\'s track: it has no unit, and was once refused as a second one', () => {
    const { scene } = ofUnbounded({ query: byPage, layers: [row, { mark: 'tick', encode: { y: 'page', x: 3000 } }] });
    const ticks = scene.nodes.filter((n) => n.kind === 'line');
    expect(ticks).toHaveLength(scene.rows!.length);
    expect(new Set(ticks.map((n) => n.kind === 'line' && n.x)).size).toBe(1);
  });

  it('the tables agree: what a mark needs is among what it reads, and a field is of a mark its layout draws', () => {
    for (const [layout, marks] of Object.entries(NEEDS)) for (const [mark, needs] of Object.entries(marks)) for (const ch of needs) expect(READS[layout]?.[mark]?.[ch], layout + ' ' + mark + ' ' + ch).toBeDefined();
    for (const [layout, marks] of Object.entries(FIELDS)) for (const mark of Object.keys(marks)) expect(READS[layout]?.[mark], layout + ' ' + mark).toBeDefined();
  });
});

/* The table is true only if every cell is. A cell is a layout, a mark, a channel and what it holds, and each is one a
 * sample draws, or one a probe here shows the mark to read: written another way, the scene is not the same. So a cell
 * added to READS with neither fails here, and so does one that is listed and not read. */
describe('every cell of the table is read', () => {
  const cellsOf = (spec: Spec): string[] => {
    const layers = expand(spec).layers || [];
    if (!layers.length) return [];
    const layout = layoutOf(catalog, layers).layout;
    return layers.flatMap((l) => Object.entries(l.encode || {}).map(([ch, f]) => [layout, l.mark, ch, typeof f === 'number' ? 'number' : isDim(catalog, f) ? 'dimension' : isMetric(catalog, f) ? 'metric' : 'companion'].join(' ')));
  };
  // A companion the engine returns with a dimension, which the fixtures have none of: the kind each page is of.
  const kinds = (): Result => { const r = runQuery(byPage); return { ...r, rows: r.rows.map((x, i) => ({ ...x, 'page@kind': i % 2 ? 'post' : 'page' })) }; };
  const byDayCountry = { metrics: ['visitors'], by: ['date.day', 'country'], range: '7d' }, byDayChannel = { metrics: ['pageviews'], by: ['date.day', 'channel'], range: '7d' }, byAgeSex = { metrics: ['visitors'], by: ['age', 'sex'] };
  const one = (query: Spec['query'], ...layers: Layer[]): Spec => ({ query, layers });
  const series = (n: number) => (spec: Spec) => new Set(ofUnbounded(spec).scene.nodes.filter((x) => x.series != null).map((x) => x.series)).size === n;
  const countries = new Set(runQuery(byDayCountry).rows.map((r) => r.country)).size;
  const dots: Layer = { mark: 'dot', encode: { x: 'pageviews', y: 'visitors' } };
  /** The cell, the spec that has it, and the same spec with that channel written another way, or what its scene must hold. */
  const probes: [cell: string, a: Spec, b: Spec | ((a: Spec) => boolean), result?: Result][] = [
    ['cartesian area y2 number', one(byDay, { mark: 'area', encode: { x: 'date.day', y: 'visitors', y2: 100 } }), one(byDay, { mark: 'area', encode: { x: 'date.day', y: 'visitors', y2: 300 } })],
    ['cartesian bar y number', one(byDay, { mark: 'bar', encode: { x: 'date.day', y: 0, y2: 'visitors' } }), one(byDay, { mark: 'bar', encode: { x: 'date.day', y: 100, y2: 'visitors' } })],
    ['cartesian bar y2 number', one(byDay, { mark: 'bar', encode: { x: 'date.day', y: 'visitors', y2: 0 } }), one(byDay, { mark: 'bar', encode: { x: 'date.day', y: 'visitors', y2: 100 } })],
    ['cartesian rule x metric', one(byPage, dots, { mark: 'rule', encode: { x: 'pageviews', y: 'visitors', x2: 0, y2: 0 } }), one(byPage, dots, { mark: 'rule', encode: { x: 0, y: 'visitors', x2: 0, y2: 0 } })],
    ['cartesian rule x2 metric', one(byPage, dots, { mark: 'rule', encode: { x: 0, y: 0, x2: 'pageviews', y2: 'visitors' } }), one(byPage, dots, { mark: 'rule', encode: { x: 0, y: 0, x2: 5000, y2: 'visitors' } })],
    ['cartesian dot x dimension', one(byDayCountry, { mark: 'dot', encode: { x: 'date.day', y: 'visitors', detail: 'country' } }), one(byDayCountry, { mark: 'dot', encode: { x: 'country', y: 'visitors', detail: 'date.day' } })],
    ['cartesian dot color metric', one(byPage, { mark: 'dot', encode: { x: 'page', y: 'pageviews', color: 'visitors' } }), one(byPage, { mark: 'dot', encode: { x: 'page', y: 'pageviews' } })],
    ['cartesian dot color dimension', one(byDayChannel, { mark: 'dot', encode: { x: 'date.day', y: 'pageviews', color: 'channel' } }), one(byDayChannel, { mark: 'dot', encode: { x: 'date.day', y: 'pageviews', detail: 'channel' } })],
    ['cartesian text x dimension', one(byDayCountry, { mark: 'text', encode: { x: 'date.day', y: 'visitors', text: 'visitors', detail: 'country' } }), one(byDayCountry, { mark: 'text', encode: { x: 'country', y: 'visitors', text: 'visitors', detail: 'date.day' } })],
    ['cartesian text text metric', one(byPage, bars, { mark: 'text', encode: { x: 'page', y: 'pageviews', text: 'pageviews' } }), one(byPage, bars, { mark: 'text', encode: { x: 'page', y: 'pageviews', text: 'page' } })],
    ['cartesian text text companion', one(byPage, bars, { mark: 'text', encode: { x: 'page', y: 'pageviews', text: 'page@kind' } }), one(byPage, bars, { mark: 'text', encode: { x: 'page', y: 'pageviews', text: 'page' } }), kinds()],
    // Split by detail, each mark of a plot has a series for each value.
    ...(['area', 'bar', 'rule', 'dot', 'tick', 'text'] as const).map((mark): [string, Spec, (a: Spec) => boolean] =>
      ['cartesian ' + mark + ' detail dimension', one(byDayCountry, { mark, encode: { x: 'date.day', y: 'visitors', detail: 'country', ...(mark === 'text' && { text: 'visitors' }) } }), series(countries)]),
    ['rows bar x2 number', one(byPage, { mark: 'bar', encode: { y: 'page', x: 'pageviews', x2: 1000 } }), one(byPage, { mark: 'bar', encode: { y: 'page', x: 'pageviews', x2: 2000 } })],
    ['rows bar color companion', one(byPage, { mark: 'bar', encode: { y: 'page', x: 'pageviews', color: 'page@kind' } }), one(byPage, row), kinds()],
    ['rows rule x number', one(byPage, { mark: 'rule', encode: { y: 'page', x: 1000, x2: 'pageviews' } }), one(byPage, { mark: 'rule', encode: { y: 'page', x: 2000, x2: 'pageviews' } })],
    ['rows rule x2 number', one(byPage, { mark: 'rule', encode: { y: 'page', x: 'pageviews', x2: 1000 } }), one(byPage, { mark: 'rule', encode: { y: 'page', x: 'pageviews', x2: 2000 } })],
    ['rows tick x number', one(byPage, row, { mark: 'tick', encode: { y: 'page', x: 1000 } }), one(byPage, row, { mark: 'tick', encode: { y: 'page', x: 2000 } })],
    ['rows tick detail dimension', one(byAgeSex, { mark: 'text', encode: { y: 'age', text: 'age' } }, { mark: 'tick', encode: { y: 'age', x: 'visitors', detail: 'sex' } }), series(2)],
    ['rows dot x number', one(byPage, row, { mark: 'dot', encode: { y: 'page', x: 1000 } }), one(byPage, row, { mark: 'dot', encode: { y: 'page', x: 2000 } })],
    ['rows dot color dimension', one(byPage, { mark: 'dot', encode: { y: 'page', x: 'pageviews', color: 'page' } }), one(byPage, { mark: 'dot', encode: { y: 'page', x: 'pageviews' } })],
    ['rows dot color companion', one(byPage, { mark: 'dot', encode: { y: 'page', x: 'pageviews', color: 'page@kind' } }), one(byPage, { mark: 'dot', encode: { y: 'page', x: 'pageviews' } }), kinds()],
    ['rows unit color dimension', one(byPage, { mark: 'unit', encode: { y: 'page', x: 'pageviews', color: 'page' } }), one(byPage, { mark: 'unit', encode: { y: 'page', x: 'pageviews' } })],
    ['rows unit color companion', one(byPage, { mark: 'unit', encode: { y: 'page', x: 'pageviews', color: 'page@kind' } }), one(byPage, { mark: 'unit', encode: { y: 'page', x: 'pageviews' } }), kinds()],
    // A list draws the plot's `line` and `area`, on their side: a path in the list's `track`, the area's filled.
    ...(['y dimension', 'x metric'] as const).map((cell): [string, Spec, (a: Spec) => boolean] =>
      ['rows area ' + cell, one(byPage, row, { mark: 'area', encode: { y: 'page', x: 'pageviews' } }), (a) => ofUnbounded(a).scene.nodes.some((n) => n.part === 'track' && n.kind === 'path' && n.fill === true)]),
    // A grid draws the plot's `text`, and what it says may be a dimension or a companion of one, as in a plot.
    ['matrix text text dimension', one(byDayCountry, { mark: 'cell', encode: { x: 'date.day', y: 'country', color: 'visitors' } }, { mark: 'text', encode: { x: 'date.day', y: 'country', text: 'country' } }),
      one(byDayCountry, { mark: 'cell', encode: { x: 'date.day', y: 'country', color: 'visitors' } }, { mark: 'text', encode: { x: 'date.day', y: 'country', text: 'visitors' } })],
    ['matrix text text companion', one(byPage, { mark: 'cell', encode: { y: 'page', color: 'pageviews' } }, { mark: 'text', encode: { y: 'page', text: 'page@kind' } }),
      one(byPage, { mark: 'cell', encode: { y: 'page', color: 'pageviews' } }, { mark: 'text', encode: { y: 'page', text: 'page' } }), kinds()],
    ['radial arc angle number', one({ metrics: ['signups'], range: '28d' }, { mark: 'arc', encode: { angle: 100, radius: 0.7 }, sweep: 'half' }), one({ metrics: ['signups'], range: '28d' }, { mark: 'arc', encode: { angle: 300, radius: 0.7 }, sweep: 'half' })],
  ];

  it.each(probes)('%s', (cell, a, b, result) => {
    expect(cellsOf(a), 'the probe has the cell it is for').toContain(cell);
    const drawn = (spec: Spec) => JSON.stringify(ofUnbounded(spec, result ?? runQuery(spec.query)).scene.nodes);
    if (typeof b === 'function') expect(b(a)).toBe(true); else expect(drawn(a)).not.toBe(drawn(b));
  });

  it('a sample draws it, or a probe shows it', () => {
    const shown = new Set([...Object.values({ ...samples, ...moreSamples }).flatMap((s) => cellsOf(s.spec)), ...probes.map(([cell]) => cell)]);
    const cells = Object.entries(READS).flatMap(([layout, marks]) => Object.entries(marks).flatMap(([mark, reads]) => Object.entries(reads).flatMap(([ch, takes]) => takes.map((h) => [layout, mark, ch, h].join(' ')))));
    expect(cells.filter((c) => !shown.has(c)), 'cells of READS that no sample draws and no probe here shows').toEqual([]);
  });
});

/* `paint`, `series` and `stack` are in the table as `label`, `align`, `sweep` and `at` are (docs/focus-plan.md, step 4).
 * Until they were, each could be written on a mark with no use for it and the view drawn as if it had not been. */
describe('paint, series and stack', () => {
  const byWeek = { metrics: ['visitors'], by: ['weekday', 'hour'] }, compared = { ...byPage, compare: 'previous' as const }, byDayChannel = { metrics: ['visitors'], by: ['date.day', 'channel'], range: '7d' };
  it('are refused on a mark with no use for one, by name, with the marks of that layout that read it', () => {
    expect(err({ query: byPage, layers: [row, { mark: 'text', encode: { y: 'page', text: 'page' }, paint: 'ink.muted' }] }))
      .toBe('Layer 2 has "paint", and the "text" mark in a "rows" layout reads none. Remove it. In a "rows" layout it is read by: bar, rule, tick, dot, unit, line or area.');
    expect(err({ query: compared, layers: [bars, { mark: 'tick', encode: { x: 'page', y: 'pageviews' }, series: 'previous' }] }))
      .toBe('Layer 2 has "series", and the "tick" mark in a "cartesian" layout reads none. Remove it. In a "cartesian" layout it is read by: line, area, bar, rule or dot.');
    expect(err({ query: byWeek, layers: [{ mark: 'cell', encode: { y: 'weekday', x: 'hour', color: 'visitors' }, paint: 'series.2' }] }))
      .toBe('Layer 1 has "paint", and the "cell" mark in a "matrix" layout reads none. Remove it. In a "matrix" layout it is read by: dot.');
    // No mark about a centre is stacked: a circle is divided by share as it is.
    expect(err({ query: byChannel, layers: [{ mark: 'arc', encode: { angle: 'visitors', color: 'channel' }, stack: 'zero' }] }))
      .toBe('Layer 1 has "stack", and the "arc" mark in a "radial" layout reads none. Remove it. It is read by: line in cartesian, area in cartesian, bar in cartesian, bar in rows, bar in band, unit in band.');
  });
  it('a custom mark says the fields it reads, and is held to them', () => {
    const sankey = moreSamples.sankey!.spec.query, byCountry = { metrics: ['visitors'], by: ['country'], compare: 'previous' as const };
    expect(err({ query: sankey, layers: [{ mark: 'link', encode: { x: 'channel', y: 'landing', size: 'visitors' }, paint: 'series.2' }] })).toBe('Layer 1 has "paint", and the "link" mark reads none. Remove it. It draws in paints of its own.');
    expect(err({ query: byCountry, layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors' }, series: 'previous' }] })).toBe('Layer 1 has "series", and the "geo" mark reads none. Remove it. Of such fields it reads: paint.');
    expect(err({ query: byCountry, layers: [{ mark: 'geo', encode: { x: 'country', size: 'visitors' }, paint: 'series.2' }] })).toBeUndefined();
  });
  it('are refused in a form that has no use for one, in that form\'s words', () => {
    expect(err({ query: { ...byDay, compare: 'previous' }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'rule', encode: { y: 300 }, series: 'previous' }] }))
      .toBe('Layer 2 has series: "previous" and encodes no metric, so there is no period before to draw. Encode the metric it is the period before of, or remove "series".');
    expect(err({ query: byDayChannel, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'channel' }, paint: 'series.3' }] }))
      .toBe('Layer 1 has the paint "series.3" and encodes "channel" on color, and a mark has one paint: the one stated, or a colour for each "channel". Remove one of the two, or put "channel" on detail to split the layer and draw every series in that paint.');
    expect(err({ query: byPage, layers: [{ mark: 'bar', encode: { y: 'page', x: 'pageviews', color: 'page' }, paint: 'series.3' }] }))
      .toBe('Layer 1 has the paint "series.3" and encodes "page" on color, and a mark has one paint: the one stated, or a colour for each "page". Remove one of the two.');
  });
  it('a band is one layer, divided by share: a second was dropped, and a bar was divided by share whatever its stack said', () => {
    const band: Layer = { mark: 'bar', encode: { x: 'visitors', color: 'channel' }, stack: 'normalize' };
    expect(err({ query: byChannel, layers: [band, { mark: 'bar', encode: { x: 'visitors', color: 'channel' } }] }))
      .toBe('These layers are laid out as a band (a dimension on color), which draws one layer, and there are 2. Keep one, or put a dimension on x or on y to lay them out as a plot or a list.');
    expect(err({ query: byChannel, layers: [{ ...band, stack: 'zero' }] })).toBe('Layer 1 is a bar in a band with stack: "zero", and a band is one bar divided by share. Write stack: "normalize", or remove "stack".');
  });
  it('bars of several layers on one x sit side by side, as the bars of a split do: one over another hid it', () => {
    const { scene } = ofUnbounded({ query: byPage, layers: [bars, { mark: 'bar', encode: { x: 'page', y: 'visitors' } }] });
    const at = (key: string) => scene.nodes.find((n) => n.key === key) as { x: number; w: number; paint: string };
    const [a, b] = [at('primary:bar:/'), at('primary:bar#2:/')];
    expect(b.x).toBeCloseTo(a.x + a.w, 10);
    expect([a.w, a.paint, b.paint]).toEqual([b.w, 'series.1', 'series.2']);
    expect(scene.parts).toContain('legend');
    // A bar with two ends floats, and is laid over what it belongs to: it takes the whole of its band, as one bar does.
    const over = ofUnbounded({ query: byPage, layers: [bars, { mark: 'bar', encode: { x: 'page', y: 'visitors', y2: 0 } }] }).scene.nodes.filter((n) => n.kind === 'rect' && n.part === 'plot' && n.row === '/') as { x: number; w: number }[];
    expect(new Set(over.map((n) => n.x + ' ' + n.w)).size).toBe(1);
  });

  /* The table is true only if every cell is, as for the channels above: a field is read where writing it another way
   * draws another scene. Another paint; a stack put on, taken off or changed; and for a series, what the layer itself
   * draws with it and without, since the period before is not this one. A sample shows it, or one of the specs here does. */
  const FIELDS3 = ['paint', 'series', 'stack'] as const;
  const more: Spec[] = [
    { query: compared, layers: [row, { mark: 'area', encode: { y: 'page', x: 'pageviews' } }] },                    // an area down a list, which no sample has
    { query: byWeek, layers: [{ mark: 'dot', encode: { x: 'hour', y: 'weekday', size: 'visitors' } }] },             // dots in a grid by size alone: with a metric on color they are painted off the ramp
  ];
  const specs = [...Object.values({ ...samples, ...moreSamples }).map((s) => ({ ...expand(s.spec), use: undefined }) as Spec), ...more].filter((s) => s.layers?.length);
  const drawn = (spec: Spec, result?: Result) => { try { return JSON.stringify(ofUnbounded(spec, result ?? runQuery(spec.query)).scene.nodes); } catch { return null; } };
  const withLayer = (spec: Spec, i: number, change: Partial<Layer>, query = spec.query): Spec => ({ ...spec, query, layers: spec.layers!.map((l, j) => (j === i ? { ...l, ...change } : l)) });
  /** What one layer draws, whatever its key: its nodes, in order, less the names that say which layer and role they are of. */
  const ofLayer = (spec: Spec, i: number, result: Result) => {
    try {
      const { plan, scene } = ofUnbounded(spec, result), l = spec.layers![i]!, k = plan.layers.findIndex((p) => p.mark === l.mark && p.series === l.series && JSON.stringify(p.encode) === JSON.stringify(l.encode));
      if (k < 0) return null;                                                // left out: the answer has no period before
      const id = layerKeys(plan.layers)[k]!;
      return JSON.stringify(scene.nodes.filter((n) => n.key === id || n.key.startsWith(id + ':')).map(({ key: _key, role: _role, ...n }) => n));
    } catch { return null; }
  };
  const reads: Record<(typeof FIELDS3)[number], (spec: Spec, i: number) => boolean> = {
    paint: (spec, i) => { const [a, b] = ['series.3', 'series.4'].map((paint) => drawn(withLayer(spec, i, { paint }))); return a != null && b != null && a !== b; },
    stack: (spec, i) => { const a = drawn(spec); return a != null && ([undefined, 'zero', 'normalize'] as const).some((stack) => { const b = drawn(withLayer(spec, i, { stack })); return b != null && a !== b; }); },
    series: (spec, i) => {
      const q = { ...spec.query, compare: 'previous' as const }; let r: Result; try { r = runQuery(q); } catch { return false; }
      const [a, b] = [spec.layers![i]!.series ?? 'previous', undefined].map((series) => ofLayer(withLayer(spec, i, { series }, q), i, r));
      return a != null && b != null && a !== b;
    },
  };
  const cells = (spec: Spec) => { let layout: string; try { layout = layoutOf(catalog, spec.layers!).layout; } catch { return []; } return spec.layers!.map((l, i) => ({ layout, mark: l.mark, i })); };
  it('every field of the table is read: a sample shows it, or a spec here', () => {
    const shown = new Set<string>();
    for (const spec of specs) for (const { layout, mark, i } of cells(spec)) for (const f of FIELDS3) if ((FIELDS[layout]?.[mark] as readonly string[] | undefined)?.includes(f) && !shown.has([layout, mark, f].join(' ')) && reads[f](spec, i)) shown.add([layout, mark, f].join(' '));
    const listed = Object.entries(FIELDS).flatMap(([layout, marks]) => Object.entries(marks).flatMap(([mark, fs]) => fs.filter((f) => (FIELDS3 as readonly string[]).includes(f)).map((f) => [layout, mark, f].join(' '))));
    // A grid of glyphs divided by colour is shares of the whole as it is. "normalize" there says what is so, and is taken: nothing else is.
    expect(listed.filter((c) => !shown.has(c) && c !== 'band unit stack'), 'fields of FIELDS that no sample and no spec here shows to be read').toEqual([]);
  });
  it('and one that is not in the table is refused wherever a sample or a spec here would write it', () => {
    const change = { paint: { paint: 'series.3' }, series: { series: 'previous' as const }, stack: { stack: 'zero' as const } };
    const drew: string[] = [];
    for (const spec of specs) for (const { layout, mark, i } of cells(spec)) for (const f of FIELDS3) {
      if (!READS[layout]?.[mark] || (FIELDS[layout]?.[mark] as readonly string[] | undefined)?.includes(f) || spec.layers![i]![f] != null) continue;
      const q = f === 'series' ? { ...spec.query, compare: 'previous' as const } : spec.query; let r: Result; try { r = runQuery(q); } catch { continue; }
      if (errOf(() => resolve(withLayer(spec, i, change[f], q), r, catalog)) === undefined) drew.push([layout, mark, f].join(' '));
    }
    expect([...new Set(drew)], 'a field written on a mark with no use for it, and drawn all the same').toEqual([]);
  });
});

/* An agent writes specs from the reference, so the reference lists the tables as they are: a row for each mark in
 * each layout, and for each custom mark registered, written as `line` writes it. */
it('the reference lists what each mark reads, needs and takes as fields, and nothing else', () => {
  const line = (layout: string, mark: string, reads: Reads) => '| `' + layout + '` | `' + mark + '` | '
    + Object.entries(reads).map(([ch, takes]) => (NEEDS[layout]?.[mark]?.includes(ch as 'x') ? '**`' + ch + '`**' : '`' + ch + '`') + ' ' + takes.join(', ')).join('; ')
    + ' | ' + (layout === mark ? customMarks().get(mark)?.fields ?? [] : FIELDS[layout]?.[mark] ?? []).map((f) => '`' + f + '`').join(', ') + ' |';
  const lines = [...Object.entries(READS).flatMap(([layout, marks]) => Object.entries(marks).map(([mark, reads]) => line(layout, mark, reads))),
    ...[...customMarks()].map(([mark, { reads }]) => line(mark, mark, reads!))];
  const reference = readFileSync(new URL('../docs/view-grammar-reference.md', import.meta.url), 'utf8');
  const section = reference.slice(reference.indexOf('\n### What each mark reads'), reference.indexOf('\n### Transforms'));
  expect(section.split('\n').filter((l) => l.startsWith('| `')), 'docs/view-grammar-reference.md, section 7, "What each mark reads": the rows of READS, NEEDS and FIELDS, as this test writes them').toEqual(lines);
});
