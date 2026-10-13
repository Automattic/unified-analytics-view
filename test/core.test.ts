import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import Ajv from 'ajv';
import * as d3array from 'd3-array';
import * as d3scale from 'd3-scale';
import * as d3shape from 'd3-shape';
import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, UNITS, buildScene, expand, formatDimension, formatValue, makeContainer, partialNote, pathD, place, resolve, unboundedContainer, type PainterName, type Spec, type Unit } from '@unified-analytics/core';
import catalogSchema from '@unified-analytics/core/schema/catalog.schema.json';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples, scenarios } from '@unified-analytics/fixtures';
import { CHAR_W, clip, delta } from '../packages/core/src/format.ts';

// The prototype, loaded as the reference the port is held to.
(globalThis as any).d3 = { ...d3array, ...d3scale, ...d3shape };
vm.runInThisContext(readFileSync(new URL('../prototype/prototype-bench.js', import.meta.url), 'utf8'));
const proto = (globalThis as any).VGB;
// A context that always sets the tldr value above the marks.
const ALWAYS = { ...CONTAINER_RULES, tldrValue: { above: 'always' as const } };
// The prototype is read-only and keeps its own names. The deliberate differences are mapped here and nowhere else:
// it calls the `line` preset `trend`; its spec asks for the number with `headline`, which is now a container rule;
// and its plan says `headline` and `sentence` where ours says `tldrValue` and `prose`.
const toProto = (s: Spec, rules = CONTAINER_RULES): object => ({
  ...s, ...(s.use === 'line' && { use: 'trend' }),
  ...((rules.tldrValue.above === 'always' || catalog.metrics[s.query.metrics[0]!]!.instant) && { headline: true }),
});
// The words: a deliberate departure from the prototype (review of October 12). The prototype says "visits", "people",
// "the site" and "page" whatever the metric is, and reads `rows[0].page` whatever the query is by: an empty revenue view
// says "No visits yet", and a count by another dimension says its busiest page is undefined. Core knows no name, so ours
// are made of the catalog's label and the query's dimension. The label leads an empty range and is not made a noun of:
// the prototype's "No visitors recorded" would be "No came back recorded" of a label that is a phrase. This maps the prototype's words to ours, here and nowhere
// else: its prose where it says them, and its two notes, each cut to the room the prototype cut its own to. Nothing but
// `text` is touched. Ours are asserted for themselves in the describe below, and for another catalog in words.test.ts.
const PROSE: [string, string][] = [
  [' not unique people.', ' not a unique count.'],
  ['7 people are on the site right now; the busiest page is / (3).', 'Present now: 7 right now; the top page is / (3).'],
  ['Nobody is on the site right now.', 'Present now: 0 right now.'],
];
const ourProse = (s: string) => PROSE.reduce((t, [theirs, ours]) => t.replace(theirs, ours), s)
  .replace(/^No (.+) recorded in the /, (_, name: string) => Object.values(catalog.metrics).find((M) => M.label.toLowerCase() === name)!.label + ': nothing recorded in the ');
const ourNotes = (scene0: any, q: Spec['query']) => {
  const label = catalog.metrics[q.metrics[0]!]!.label;
  const notes: Record<string, [number, [string, string][]]> = {
    sub: [CHAR_W - 0.8, [['on the site right now', 'right now'], ['Nobody is here right now', 'right now'], ['No visits yet', label + ': nothing yet']]],
    notice: [CHAR_W, [['No visits in this period yet', label + ': nothing in this period yet']]],
  };
  return scene0.nodes.map((n: any) => {
    const [advance, words] = notes[n.key] ?? [0, []], room = Math.floor(scene0.width / advance), mine = words.find(([theirs]) => n.text === clip(theirs, room));
    return mine ? { ...n, text: clip(mine[1], room) } : n;
  });
};
const fromProto = ({ headline, ...p }: any) => ({
  ...p, text: ourProse(p.text), tldrValue: headline, layout: p.layout === 'sentence' ? 'prose' : p.layout,
  reductions: p.reductions.map((r: any) => (r.id === 'sentence' ? { ...r, id: 'prose' } : r)),
});
// Layer keys: a deliberate departure from the prototype (feedback, decision 1 of October 7; transitions finding 1).
// The prototype's keys count layers, `L<index>:<mark>`, so when a layer drops the next one takes its key and a painter
// that reconciles by key morphs one layer into another. Ours name the layer by role and mark, with `#n` for the nth of
// a role and mark. This maps the prototype's keys to ours, here and nowhere else. Nothing but `key` is touched, so
// geometry, paint and order are still compared exactly.
// The one-line legend's key: a second deliberate departure (feedback, review of October 7, finding 3). The prototype's
// is `legend:top`, which is also the key of the legend entry of a segment called "top". Ours is `legend-top`, which no
// segment can make. It changes the key in every band case of the sweep, and is mapped here with the layer keys.
const ourKeys = (scene0: any, layers: { role: string; mark: string }[]) => {
  const seen: Record<string, number> = {};
  const names = layers.map((l) => { const base = l.role + ':' + l.mark, n = (seen[base] = (seen[base] || 0) + 1); return n > 1 ? base + '#' + n : base; });
  return { ...scene0, nodes: scene0.nodes.map((n: any) => ({ ...n, key: n.key === 'legend:top' ? 'legend-top' : n.key.replace(/^L(\d+):[a-z]+/, (_: string, i: string) => names[+i]) })) };
};
/** The prototype's scene as plain data, its layer keys mapped to ours. */
const protoScene = (plan0: any, q: Spec['query'], res0: unknown, host0: unknown) => {
  const scene0 = ourKeys(plain(proto.buildScene(plan0, q, res0, host0)), plan0.layers);
  return { ...scene0, ...(scene0.text != null && { text: ourProse(scene0.text) }), nodes: ourNotes(scene0, q) };
};

// The row node: a deliberate addition (chart-coverage-plan, step 2, part 6; feedback, rows, finding 5). A `rows` scene
// holds a node per row, of kind `row`, for a painter to key. place() leaves it out, so no placed scene has one and the
// sweep against the prototype does not meet it. The ratio scenes recorded before it are held to what they were by
// leaving it out, here and nowhere else.
const lessRows = <S extends { nodes: { kind: string }[] }>(scene: S): S => ({ ...scene, nodes: scene.nodes.filter((n) => n.kind !== 'row') });

const trend = samples.trend!.spec;
const specs: Record<string, Spec> = {
  ...Object.fromEntries(Object.entries(samples).map(([k, s]) => [k, s.spec])),
  headed: trend,                         // swept in the ALWAYS context
  kept: { ...trend, keep: ['guides'] },
};
const invalid: Record<string, Spec> = {
  'unknown preset': { spec: 'view/0', use: 'treemap', query: { metrics: ['visitors'], by: ['channel'] } },
  'dimension, no layers': { spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'] } },
  'preset, no dimension': { spec: 'view/0', use: 'line', query: { metrics: ['visitors'] } },
};
const painters: PainterName[] = ['svg', 'dots'];
const heights = [null, 300, 160, 100, 60, 40];
const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
// The note is given up before prose: a deliberate departure from the prototype (feedback, decision 6 of October 7).
// These are the swept cases it changes, and all of them: the prototype falls to prose, and ours keeps the number alone
// without its note. The sweep passes over them and holds every other case to the prototype. They have their own describe below.
const NOTE_FIRST = new Set((<[string[], PainterName, number[], number][]>[
  [['trend', 'headed'], 'svg', [120], 60], [['trend', 'headed'], 'dots', [120, 170], 60],
  [['kept'], 'svg', [120, 170, 250, 290, 346, 500, 700], 60], [['kept'], 'dots', [120, 170], 60],
  [['pages'], 'dots', [120], 40], [['mix'], 'dots', [120, 170], 40],
]).flatMap(([names, p, ws, h]) => names.flatMap((name) => ['typical', 'no-prior'].flatMap((sc) => ws.map((w) => [name, sc, p, w, h].join(' '))))));
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', rules = CONTAINER_RULES) => {
  const container = { ...makeContainer(w, h, painter, 8), rules }, result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};

describe('the sweep', () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': matches the prototype, with unique keys, no NaN and nothing taller than the container allows', () => {
    const rules = name === 'headed' ? ALWAYS : CONTAINER_RULES;
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, scene } = run(spec, w, h, sc, p, rules);
        const keys = scene.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(JSON.stringify(scene, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);

        if (NOTE_FIRST.has(at)) continue;
        const host0 = proto.makeHost(w, h, p, 8), res0 = proto.runQuery(spec.query, sc), plan0 = proto.resolve(toProto(spec, rules), res0, host0);
        expect(plain(runQuery(spec.query, sc)), 'result: ' + at).toEqual(plain(res0));
        expect(plain(plan), 'plan: ' + at).toEqual({ ...fromProto(plain(plan0)), preset: plan.preset });
        expect(plain(scene), 'scene: ' + at).toEqual(protoScene(plan0, spec.query, res0, host0));
      }
    });
  }
});

describe('fixture facts', () => {
  const total = (m: string) => runQuery({ metrics: [m], range: '28d', compare: 'previous' }).totals;
  it('visitors and page views', () => {
    expect(total('visitors')).toEqual({ visitors: 10531, 'visitors@previous': 9437 });
    expect(total('pageviews')).toEqual({ pageviews: 25061, 'pageviews@previous': 21974 });
  });
  it('28 daily rows, the last one partial', () => {
    const rows = runQuery(trend.query).rows;
    expect(rows.length).toBe(28);
    expect(rows.map((r) => r.partial).lastIndexOf(true)).toBe(27);
    expect(rows.filter((r) => r.partial).length).toBe(1);
  });
  it('channel shares', () => {
    const { rows, totals } = runQuery(samples.mix!.spec.query);
    expect(rows.map((r) => Math.round(((r.visitors as number) / totals.visitors!) * 100))).toEqual([41, 28, 14, 8, 6, 3]);
  });
  it('7 people present across 4 pages', () => {
    const { rows, totals } = runQuery(samples.live!.spec.query);
    expect(totals.present).toBe(7);
    expect(rows.length).toBe(4);
  });
});

describe('tldr prose', () => {
  const text = (name: string, sc?: (typeof scenarios)[number]) => run(specs[name]!, 346, null, sc).plan.text;
  it('is derived from the query', () => {
    expect(text('trend')).toBe('Visitors: 10.5k in the last 28 days, up 12% on the previous period. This is a sum of daily counts, not a unique count.');
    expect(text('pages')).toBe('Top pages by page views, last 28 days: / (4,820), /pricing (2,960), /blog/launch-notes (2,105).');
    expect(text('mix')).toBe('Search is the largest channel at 41% of visitors, followed by Direct at 28%.');
    expect(text('total')).toBe('Page views: 25.1k in the last 28 days, up 14% on the previous period.');
    expect(text('live')).toBe('Present now: 7 right now; the top page is / (3).');
    expect(text('trend', 'empty')).toBe('Visitors: nothing recorded in the last 28 days.');
  });
});

describe('what a painter says with: values and dimensions in catalog format', () => {
  it('a metric by its entry, a day as a date, a category as itself, and the unfinished bucket marked', () => {
    const V = catalog.metrics.visitors!, rows = runQuery(trend.query).rows, last = rows[rows.length - 1]!;
    expect([formatValue(1234, V), formatValue(10531, V), formatValue(1234, V, 'compact'), formatValue(10531, V, 'exact'), formatValue(null, V), formatValue(null, V, 'exact')]).toEqual(['1,234', '10.5k', '1.2k', '10,531', '–', '–']);
    expect(formatDimension('2026-09-08', catalog.dimensions['date.day']!)).toBe('Sep 8');
    // A bucket arrives as a bare date or as a full ISO datetime, and is said as it is written either way. One on an hour of the day says the hour.
    const time = (v: string) => formatDimension(v, catalog.dimensions['date.day']!);
    expect(['2026-09-08T00:00:00.000Z', '2026-09-08T00:00:00Z', '2026-09-08T15:00:00.000Z', '2026-09-08T15:00:00', '2026-09-08T23:00:00.000Z'].map(time)).toEqual(['Sep 8', 'Sep 8', 'Sep 8, 3 PM', 'Sep 8, 3 PM', 'Sep 8, 11 PM']);
    expect(() => time('yesterday')).toThrow('The time "yesterday" is not in a form a view reads.');
    expect(formatDimension('/pricing', catalog.dimensions.page!)).toBe('/pricing');
    expect(formatDimension(null, catalog.dimensions.page!)).toBe('–');
    // A country arrives as its code and is said by name. An empty code is no value; what is not a code is said as it came.
    const country = (v: string) => formatDimension(v, catalog.dimensions.country!);
    expect([country('US'), country('DE'), country(''), country('us'), country('China')]).toEqual(['United States', 'Germany', '–', 'us', 'China']);
    expect([partialNote(rows[0]!), partialNote(last)]).toEqual(['', 'so far']);
  });
  it('a value in each unit the catalog may give: as a readout says it, short, and exact', () => {
    const say = (unit: Unit, v: number) => ([undefined, 'compact', 'exact'] as const).map((form) => formatValue(v, { label: '', unit, polarity: 'none' }, form));
    // Money is in dollars, not cents, and each currency is a unit of its own, written its own way.
    expect([say('eur', 49.5), say('gbp', 63512), say('jpy', 5000)]).toEqual([['€49.50', '€49.5', '€49.50'], ['£63.5k', '£63.5k', '£63,512.00'], ['¥5,000', '¥5k', '¥5,000']]);
    expect([49, 49.5, 63512, -5].map((v) => say('usd', v))).toEqual([['$49', '$49', '$49.00'], ['$49.50', '$49.5', '$49.50'], ['$63.5k', '$63.5k', '$63,512.00'], ['-$5', '-$5', '-$5.00']]);
    // A rate from 0 to 1 and one in percent points read the same.
    expect([say('ratio', 0.1244), say('percent', 12.44), say('percent', 2.4)]).toEqual([['12%', '12%', '12.44%'], ['12%', '12%', '12.44%'], ['2.4%', '2.4%', '2.4%']]);
    expect([4.26, 340, 1234, 125000, 3900000].map((v) => say('ms', v)[0])).toEqual(['4.3ms', '340ms', '1.2s', '2m 05s', '1h 05m']);
    expect([0.34, 1.2, 125].map((v) => say('s', v))).toEqual([['340ms', '340ms', '0.34 s'], ['1.2s', '1.2s', '1.2 s'], ['2m 05s', '2m 05s', '125 s']]);
    expect(say('ms', 1234)[2]).toBe('1,234 ms');
    expect([512, 1234567, 5e12].map((v) => say('bytes', v))).toEqual([['512 B', '512 B', '512 B'], ['1.2 MB', '1.2 MB', '1,234,567 B'], ['5 TB', '5 TB', '5,000,000,000,000 B']]);
    expect(UNITS.map((u) => formatValue(null, { label: '', unit: u, polarity: 'none' }))).toEqual(UNITS.map(() => '–'));
  });
  it('a unit with no format is an error that names the units there are', () => {
    expect(() => formatValue(1, { label: '', unit: 'sec' as Unit, polarity: 'none' })).toThrow(/The unit "sec" has no format\. Give the metric one of count, ratio, percent, ms, s, bytes, rank in the catalog, or a currency's ISO 4217 code in lower case/);
  });
});

describe('pathD: the one place a path string is made', () => {
  it('is the scene\'s own `d` from the scene\'s points, and place()\'s in a pixel box', () => {
    const { ratio, scene } = run(trend, 346), drawn = ratio.nodes.filter((n) => n.kind === 'path');
    expect(drawn.length).toBe(4);
    for (const n of drawn) expect(pathD(n.points, n.curve, n.fill), n.key).toBe(n.d);
    // The trend at 346 px: x from 38 to 338 and y from 162 up to 10. A ratio and d3's point scale can differ in the last bit, so place() passes its own scale.
    const line = drawn.find((n) => n.key === 'primary:line')!, px = pathD(line.points, line.curve, line.fill, { x: (p) => 38 + p.x * 300, y: (v) => 162 - v * 152 })!;
    const nums = (d: string) => d.split(/[A-Z,]/).filter(Boolean).map(Number), placed = nums((scene.nodes.find((n) => n.key === line.key) as { d: string }).d);
    nums(px).forEach((v, i) => expect(v).toBeCloseTo(placed[i]!, 2));
  });
  it('draws one point, a straight line, an area to the baseline, and nothing from no points', () => {
    expect(pathD([{ x: 0.5, v: 0.25 }], 'monotone')).toBe('M50,75Z');
    expect(pathD([{ x: 0, v: 0 }, { x: 1, v: 1 }])).toBe('M0,100L100,0');
    expect(pathD([{ x: 0, v: 0.5 }, { x: 1, v: 1 }], undefined, true)).toBe('M0,50L100,0L100,100L0,100Z');
    expect(pathD([])).toBe(null);
  });
});

describe('fitting the container (reference section 10.1)', () => {
  const applied = (name: string, w: number, h: number | null = null) => run(specs[name]!, w, h).plan;
  const state = (plan: ReturnType<typeof applied>, id: string) => plan.reductions.find((r) => r.id === id)!.state;

  it('a trend steps from chart, to tldr value beside sparkline, to tldr value, to tldr prose', () => {
    const full = applied('trend', 346);
    expect(full).toMatchObject({ layout: 'cartesian', side: false, guides: { x: true, y: true, grid: true } });
    expect(full.layers.map((l) => l.role)).toEqual(['context', 'comparison', 'primary']);
    expect(full.reductions.every((r) => r.state === 'not needed')).toBe(true);

    const spark = applied('trend', 250);
    expect(spark).toMatchObject({ layout: 'cartesian', side: true, tldrValue: true, guides: { x: false, y: false, grid: false } });
    expect(spark.layers.map((l) => l.role)).toEqual(['primary']);

    expect(applied('trend', 120)).toMatchObject({ layout: 'none', tldrValue: true });
    expect(applied('trend', 54).layout).toBe('prose');
  });
  it('the comparison drops on legibility, not width alone', () => {
    expect(applied('trend', 346, 100).layers.map((l) => l.role)).not.toContain('comparison');
  });
  it('bars with a target become a bar sparkline', () => {
    const p = applied('layers', 250);
    expect(p).toMatchObject({ layout: 'cartesian', side: true });
    expect(p.layers.map((l) => l.mark)).toEqual(['bar']);
  });
  it('a bar list trims rows only under a height limit', () => {
    expect(applied('pages', 346).rowLimit).toBe(null);
    const p = applied('pages', 346, 100);
    expect(p.rowLimit).toBe(3);
    expect(p.dropped).toContain('rows 4 to 8');
  });
  it('a share bar gives up its legend before its marks', () => {
    expect(applied('mix', 346).guides.legend).toBe('full');
    expect(applied('mix', 150)).toMatchObject({ layout: 'band', guides: { legend: 'top' } });
  });
  it('keep stops a step from being applied', () => {
    const p = applied('kept', 250);
    expect(state(p, 'drop-guides')).toBe('kept by the spec');
    expect(p.side).toBe(false);
    const marks = run({ ...trend, keep: ['marks'] }, 120).plan;
    expect(state(marks, 'collapse')).toBe('kept by the spec');
  });
  it('the tldr value sits above the marks for an instant metric, or wherever the context says always', () => {
    expect(applied('live', 346)).toMatchObject({ layout: 'rows', tldrValue: true });
    expect(applied('pages', 346).tldrValue).toBe(false);
    expect(run(trend, 346, null, 'typical', 'svg', ALWAYS).plan).toMatchObject({ layout: 'cartesian', side: false, tldrValue: true });
  });
  it('reports a comparison it could not draw', () => {
    expect(run(trend, 346, null, 'no-prior').plan.dropped).toContain('comparison series (no prior data)');
  });
});

describe('validation', () => {
  it('names the fix', () => {
    const err = (s: Spec) => { try { resolve(s, runQuery(s.query), makeContainer(346), catalog); } catch (e) { return (e as Error).message; } };
    expect(err(invalid['unknown preset']!)).toBe('Unknown preset "treemap". The library has: line, bar-list, share-bar, grouped-bar, stacked-bar, stacked-area, pie, donut, pie-semi-circle, gauge, heatmap, funnel, box-plot, error-bars, waterfall, candlestick, fan, dumbbell, bullet. Registered: choropleth, symbol-map, tile-grid-map, hex-tile-map. Use one of those, or register it with registerPreset("treemap", …) before the view is resolved.');
    expect(err(invalid['dimension, no layers']!)).toBe('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: line, bar-list, share-bar, grouped-bar, stacked-bar, stacked-area, pie, donut, pie-semi-circle, gauge, heatmap, funnel, box-plot, error-bars, waterfall, candlestick, fan, dumbbell, bullet, choropleth, symbol-map, tile-grid-map, hex-tile-map.');
    expect(err(invalid['preset, no dimension']!)).toBe('The "line" preset needs a dimension in query.by.');
    expect(err({ query: { metrics: ['pageviews'], by: ['page'] }, layers: [{ mark: 'bar', encode: { y: 'page', x: 'visitors' } }] }))
      .toBe('Layer 1 encodes "visitors" on x, which the query does not return. It returns: page, pageviews.');
  });
  it('a preset expands into layers, without the comparison when the query has none', () => {
    expect(run(trend, 346).plan.preset).toBe('line');
    expect(expand(trend).layers!.map((l) => l.series)).toEqual([undefined, 'previous', undefined]);
    expect(expand({ ...trend, query: { ...trend.query, compare: undefined } }).layers!.length).toBe(2);
  });
});

describe('schemas', () => {
  const ajv = new Ajv();
  const view = ajv.compile(viewSchema), cat = ajv.compile(catalogSchema);
  it('accept the six samples and the fixture catalog', () => {
    for (const s of Object.values(samples)) expect(view(s.spec), JSON.stringify(view.errors)).toBe(true);
    expect(cat(catalog), JSON.stringify(cat.errors)).toBe(true);
  });
  it('reject a dimension with nothing to draw it, and a preset with no dimension', () => {
    expect(view(invalid['dimension, no layers'])).toBe(false);
    expect(view(invalid['preset, no dimension'])).toBe(false);
    expect(view({ ...trend, width: 346 })).toBe(false);
  });
  it('reject presentation in a spec: the tldr value and the guides are the container\'s to decide', () => {
    expect(view({ ...trend, headline: true })).toBe(false);
    expect(view({ ...trend, guides: { x: false } })).toBe(false);
  });
  it('the catalog\'s units are the ones the formatter has, and no other', () => {
    expect((catalogSchema as any).properties.metrics.additionalProperties.properties.unit.anyOf[0].enum).toEqual(UNITS);
    expect(cat({ metrics: { m: { label: 'M', unit: 'eur', polarity: 'up' } }, dimensions: {} })).toBe(true);     // a currency's code
    expect(cat({ metrics: { m: { label: 'M', unit: 'furlongs', polarity: 'up' } }, dimensions: {} })).toBe(false);
  });
});

describe('the ratio scene (dom-painter-plan section 3)', () => {
  const PARTS: Record<string, string[]> = {
    cartesian: ['number', 'plot', 'x-axis', 'y-axis'], rows: ['number', 'rows'], band: ['number', 'band', 'legend', 'legend-top'],
    none: ['number'], notice: ['number', 'notice'], prose: [],
  };
  const unbounded = (spec: Spec) => {
    const result = runQuery(spec.query), plan = resolve(spec, result, unboundedContainer(), catalog);
    return { plan, ratio: buildScene(plan, spec.query, result, catalog) };
  };
  const numbers = (d: string) => (d.match(/-?[\d.]+/g) || []).map(Number);

  it('has a part on every node, ratios from 0 to 1, unique keys, and the keys place() keeps', () => {
    for (const [name, spec] of Object.entries(specs)) for (const sc of scenarios) for (const h of heights) for (const w of widths) {
      const at = [name, sc, w, h].join(' '), { ratio, scene } = run(spec, w, h, sc), keys = ratio.nodes.map((n) => n.key);
      expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
      expect(ratio.parts.every((p) => PARTS[ratio.layout]!.includes(p)), 'parts: ' + at).toBe(true);
      for (const n of ratio.nodes as any[]) {
        expect(PARTS[ratio.layout], 'part: ' + at + ' ' + n.key).toContain(n.part);
        for (const f of ['x', 'w', 'v', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
      }
      // Placing changes no key and no order. It only leaves out what the size has no room for.
      const placed = scene.nodes.map((n) => n.key);
      expect(keys.filter((k) => placed.includes(k)), 'placed keys: ' + at).toEqual(placed);
    }
  });
  it('needs no size: a plan for a container with no limits drops nothing', () => {
    for (const name of Object.keys(samples)) expect(unbounded(specs[name]!).plan.dropped, name).toEqual([]);
    const { ratio } = unbounded(trend);
    expect(ratio).toMatchObject({ layout: 'cartesian', parts: ['y-axis', 'plot', 'x-axis'], scale: 'point' });
    expect(ratio.nodes.filter((n) => n.rank).map((n) => n.key)).toEqual(['sub', 'xtick:2026-09-21']);
    expect(unbounded(specs.layers!).ratio.nodes.filter((n) => n.rank).map((n) => n.key)).toEqual(['grid:500', 'ytick:500', 'grid:1500', 'ytick:1500', 'xtick:2026-09-21']);
    expect(ratio.nodes.filter((n) => n.role).map((n) => n.key + ' ' + n.role)).toEqual(['context:area context', 'comparison:line comparison', 'primary:line primary', 'primary:line:partial primary']);
    // The number is there to be shown in compensation, though this plan does not show it.
    expect(ratio.nodes.filter((n) => n.part === 'number').map((n) => n.key)).toEqual(['value', 'delta', 'sub']);
  });
  it('the unbounded container is one of no width limit and no height, and the convention it names still works', () => {
    expect(unboundedContainer()).toMatchObject({ width: Infinity, height: null, painter: 'svg' });
    expect(resolve(trend, runQuery(trend.query), makeContainer(Infinity), catalog)).toEqual(unbounded(trend).plan);
  });
  it('agrees with the placed pixels: a ratio times its part is where place() puts it', () => {
    // Bars at 346 px. With axes the plot is x 36 to 340 and y 162 down to 10.
    const bars = run(specs.layers!, 346);
    for (const n of bars.ratio.nodes as any[]) {
      const px = bars.scene.nodes.find((m) => m.key === n.key) as any;
      if (n.kind === 'rect') { expect(px.x).toBeCloseTo(36 + n.x * 304, 9); expect(px.w).toBeCloseTo(n.w * 304, 9); expect(px.h).toBeCloseTo(n.v * 152, 9); }
      if (n.part === 'y-axis') expect(px.y).toBeCloseTo(162 - n.t * 152, 9);
    }
    // Lines sit 2 px inside each edge. The 100 by 100 path, stretched to that box, is the placed path to well within a pixel.
    const lines = run(trend, 346);
    for (const n of lines.ratio.nodes) if (n.kind === 'path') {
      const px = numbers((lines.scene.nodes.find((m) => m.key === n.key) as any).d);
      numbers(n.d!).forEach((v, i) => expect(Math.abs((i % 2 ? 10 + v * 1.52 : 38 + v * 3) - px[i]!), n.key).toBeLessThan(0.01));
    }
  });
  it('a band carries both legends, each in its own part, and `parts` names the one the plan shows', () => {
    for (const [w, part] of [[346, 'legend'], [150, 'legend-top']] as const) {
      const { ratio, scene } = run(specs.mix!, w);
      expect(ratio.parts).toEqual(['band', part]);
      expect(ratio.nodes.filter((n) => n.part === 'legend').length).toBe(18);
      expect(ratio.nodes.filter((n) => n.part === 'legend-top').map((n) => n.key)).toEqual(['legend-top']);
      // place() draws one of them, as before.
      expect(scene.nodes.filter((n) => /^(legend|swatch|share):|^legend-top$/.test(n.key)).length).toBe(part === 'legend' ? 18 : 1);
    }
  });
  for (const name of Object.keys(samples)) it(`${name}, with no size`, () => expect(lessRows(unbounded(specs[name]!).ratio)).toMatchSnapshot());
  it('a `rows` scene has a node for each row, ahead of what is drawn in it, and place() leaves it out', () => {
    const { ratio, scene } = run(specs.pages!, 346), mine = ratio.nodes.filter((n) => n.row === '/blog/launch-notes').map((n) => n.key);
    expect(ratio.nodes.filter((n) => n.kind === 'row').map((n) => n.key)).toEqual(ratio.rows!.map((k) => 'row:' + k));
    expect(mine).toEqual(['row:/blog/launch-notes', 'primary:bar:/blog/launch-notes', 'primary:text:/blog/launch-notes', 'primary:text#2:/blog/launch-notes']);
    expect(scene.nodes.some((n) => n.key.startsWith('row:'))).toBe(false);
  });
});

describe('layer keys: a deliberate departure from the prototype (feedback, decision 1 of October 7)', () => {
  const layerKeys = (spec: Spec, sc: (typeof scenarios)[number] = 'typical') => [...new Set(run(spec, 346, null, sc).ratio.nodes.filter((n) => n.role).map((n) => n.key.replace(/:(partial|label)$/, '')))];
  it('a layer keeps its key when another drops: the prototype hands the primary line the comparison\'s', () => {
    expect(layerKeys(trend)).toEqual(['context:area', 'comparison:line', 'primary:line']);
    expect(layerKeys(trend, 'no-prior')).toEqual(['context:area', 'primary:line']);
    const host0 = proto.makeHost(346, null, 'svg', 8), keys0 = (sc: string) => {
      const res0 = proto.runQuery(trend.query, sc);
      return proto.buildScene(proto.resolve(toProto(trend), res0, host0), trend.query, res0, host0).nodes.map((n: any) => n.key);
    };
    expect(keys0('typical')).toContain('L2:line');
    expect(keys0('no-prior')).not.toContain('L2:line');
  });
  it('two layers of one role and mark are counted among themselves, the previous series last', () => {
    const y = { x: 'date.day', y: 'visitors' };
    // An odd spec on purpose: a previous series given the primary role, ahead of the current one.
    const two: Spec = { query: trend.query, layers: [{ mark: 'line', encode: y, series: 'previous', role: 'primary' }, { mark: 'line', encode: y }, { mark: 'rule', encode: { y: 300 } }, { mark: 'rule', encode: { y: 400 } }] };
    expect(layerKeys(two)).toEqual(['primary:line#2', 'primary:line', 'reference:rule', 'reference:rule#2']);
    expect(layerKeys(two, 'no-prior')).toEqual(['primary:line', 'reference:rule', 'reference:rule#2']);
    expect(lessRows(run(specs.pages!, 346).ratio).nodes.filter((n) => n.row === '/').map((n) => n.key)).toEqual(['primary:bar:/', 'primary:text:/', 'primary:text#2:/']);
  });
});

describe('the note is given up before prose: a deliberate departure from the prototype (feedback, decision 6 of October 7)', () => {
  // The prototype goes to prose as soon as the number, its delta and its note are taller than the box. Narrower, the note
  // stops fitting by width, the number fits again, and then prose returns. Ours gives up the note first, and goes to
  // prose only if the number without it is still too tall. The DOM's measured pass has the same rule.
  it('in each such case the prototype is prose; ours is the prototype\'s number in a box 16 px taller, less the note', () => {
    expect(NOTE_FIRST.size).toBe(36);
    let held = 0;
    for (const at of NOTE_FIRST) {
      const [name, sc, p, w, h] = at.split(' ') as [string, (typeof scenarios)[number], PainterName, string, string];
      const spec = specs[name!]!, rules = name === 'headed' ? ALWAYS : CONTAINER_RULES, { plan, scene } = run(spec, +w, +h, sc, p, rules);
      const res0 = proto.runQuery(spec.query, sc), at0 = (height: number) => { const host0 = proto.makeHost(+w, height, p, 8), plan0 = proto.resolve(toProto(spec, rules), res0, host0); return { plan0, scene0: protoScene(plan0, spec.query, res0, host0) }; };
      expect(at0(+h).plan0.layout, at).toBe('sentence');
      expect(plan, at).toMatchObject({ layout: 'none', tldrValue: true });
      expect(plan.dropped[plan.dropped.length - 1], at).toBe('the note under the number');
      expect(plan.reductions.find((r) => r.id === 'prose')!.state, at).toBe('not needed');
      expect(scene.nodes.map((n) => n.key).filter((k) => k === 'value' || k === 'sub'), at).toEqual(['value']);
      expect(scene.height, at).toBeLessThanOrEqual(+h);
      // 16 px is the note's line. With room for it the prototype shows the number alone, and that is ours but for the note.
      const { plan0, scene0 } = at0(+h + 16), with0 = fromProto(plain(plan0));
      if (plan0.layout !== 'none') continue;
      expect(scene0.nodes.map((n: any) => n.key), at).toContain('sub');
      expect(plain(scene), at).toEqual({ ...scene0, height: scene0.height - 16, nodes: scene0.nodes.filter((n: any) => n.key !== 'sub') });
      expect(plain(plan), at).toEqual({ ...with0, preset: plan.preset, dropped: [...with0.dropped, 'the note under the number'], needs: { ...with0.needs, height: scene.height } });
      held++;
    }
    // The share bar's four cases have no such twin: 16 px taller the band has room, so the prototype never shows that number alone.
    expect(held).toBe(32);
  });
  it('narrowing a 60 px box no longer passes through prose and back', () => {
    const layouts = (h: number) => [170, 120, 80, 54].map((w) => run(trend, w, h).plan.layout);
    expect(layouts(60)).toEqual(['cartesian', 'none', 'none', 'prose']);
    // Still prose where the number without its note is too tall.
    expect(layouts(40)).toEqual(['prose', 'prose', 'prose', 'prose']);
    expect(run(trend, 120, 40).plan.dropped).not.toContain('the note under the number');
  });
});

describe('y ticks: a deliberate departure from the prototype (dom-painter-plan section 8, decision 3)', () => {
  // The prototype rounds the y scale to 2 ticks when the plot is under 120 px tall, so its domain changes with the size.
  // A scene with no size cannot. We always round to 4, rank the ticks, and place() thins them on a short plot.
  // Under the default rules a plot with axes is never under 120 px, so the sweep does not meet this. A context that allows shorter plots does.
  const rules = { ...CONTAINER_RULES, fit: CONTAINER_RULES.fit.map((r) => (r.layout === 'cartesian' && r.id === 'axes' ? { ...r, needs: { ...r.needs, block: 80 } } : r)) };
  const ticks = (scene: { nodes: { key: string }[] }) => scene.nodes.map((n) => n.key).filter((k) => /^(ytick|grid):/.test(k));
  const short = (spec: Spec) => {
    const ours = run(spec, 346, 100, 'typical', 'svg', rules);
    const host0 = { ...proto.makeHost(346, 100, 'svg', 8), rules: { ...proto.HOST_RULES, axes: { ...proto.HOST_RULES.axes, minHeight: 80 } } }, res0 = proto.runQuery(spec.query, 'typical');
    const plan0 = proto.resolve(toProto(spec), res0, host0);
    expect(ours.scene.plot).toEqual({ w: 346, h: 100 });
    expect(plain(ours.plan), 'the plan is still the prototype\'s').toEqual({ ...fromProto(plain(plan0)), preset: ours.plan.preset });
    return { ...ours, scene0: protoScene(plan0, spec.query, res0, host0) };
  };
  it('on a 100 px plot the prototype draws bars against another scale; ours is the tall plot\'s, thinned', () => {
    const { ratio, scene, scene0 } = short(specs.layers!), tall = run(specs.layers!, 346);
    expect(ticks(scene0)).toEqual(['grid:0', 'ytick:0', 'grid:1000', 'ytick:1000', 'grid:2000', 'ytick:2000']);
    expect(ticks(scene)).toEqual(['grid:0', 'ytick:0', 'grid:1000', 'ytick:1000']);
    expect(ticks(tall.scene)).toEqual(['grid:0', 'ytick:0', 'grid:500', 'ytick:500', 'grid:1000', 'ytick:1000', 'grid:1500', 'ytick:1500']);
    expect(ratio).toEqual(tall.ratio);
    // Nothing off the y scale departs: every placed node with no y in it is the prototype's.
    const off = (s: any) => s.nodes.filter((n: any) => n.key.startsWith('xtick:'));
    expect(off(plain(scene))).toEqual(off(scene0));
  });
  it('where rounding to 2 and to 4 give one scale, the short plot is still the prototype\'s', () => {
    const { scene, scene0 } = short(trend);
    expect(plain(scene)).toEqual(scene0);
  });
  it('where a count of 2 and of 4 share only zero, every other tick stays: a short plot never shows zero alone', () => {
    // A top of 800: four ticks step by 200 and two by 500.
    const spec: Spec = { query: trend.query, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }] }, result = runQuery(spec.query);
    result.rows.forEach((r, i) => { r.visitors = 420 + i * 10; });
    const yticks = buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog).nodes.filter((n) => n.part === 'y-axis');
    expect(yticks.map((n) => n.key)).toEqual(['ytick:0', 'ytick:200', 'ytick:400', 'ytick:600', 'ytick:800']);
    expect(yticks.filter((n) => !n.rank).map((n) => n.key)).toEqual(['ytick:0', 'ytick:400', 'ytick:800']);
  });
});

describe('one row on a time axis: a deliberate departure from the prototype (feedback, Bugs 1)', () => {
  // The prototype labels the first and the last row of a time axis. With one row they are the same row, so it emits two
  // `xtick` nodes under one key. Keys are unique here, so ours emits one. No fixture query returns one row, so the sweep does not meet this.
  const one = runQuery(trend.query), day = one.rows[0]![trend.query.by![0]!] as string;
  one.rows = one.rows.slice(0, 1);
  const xticks = (scene: { nodes: { key: string }[] }) => scene.nodes.map((n) => n.key).filter((k) => k.startsWith('xtick:'));
  it('the prototype repeats the tick; ours has it once, and nothing else differs', () => {
    const container = makeContainer(346), plan = resolve(trend, one, container, catalog);
    const ratio = buildScene(plan, trend.query, one, catalog), scene = plain(place(ratio, container));
    const host0 = proto.makeHost(346, null, 'svg', 8), plan0 = proto.resolve(toProto(trend), one, host0), scene0 = protoScene(plan0, trend.query, one, host0);
    expect(xticks(scene0)).toEqual(['xtick:' + day, 'xtick:' + day]);
    expect(xticks(ratio)).toEqual(['xtick:' + day]);
    expect(xticks(scene)).toEqual(['xtick:' + day]);
    expect(plain(plan)).toEqual({ ...fromProto(plain(plan0)), preset: plan.preset });
    // The prototype's first copy is ours. Its second, anchored at the end, is the one dropped.
    const second = scene0.nodes.findIndex((n: any, i: number) => n.key === 'xtick:' + day && scene0.nodes[i - 1].key === n.key);
    expect(scene.nodes).toEqual(scene0.nodes.filter((_: unknown, i: number) => i !== second));
  });
  it('two rows still have two ticks, and three have three', () => {
    for (const n of [2, 3]) {
      const some = { ...runQuery(trend.query), rows: runQuery(trend.query).rows.slice(0, n) };
      expect(xticks(buildScene(resolve(trend, some, unboundedContainer(), catalog), trend.query, some, catalog)).length).toBe(n);
    }
  });
});

describe('a time dimension on rows and on a band: a deliberate departure from the prototype (feedback, review of October 7, finding 5)', () => {
  // The prototype writes a row's label and a segment's name as the result holds them, "2026-09-29", where its own x axis
  // and our readout say "Sep 29". Ours says the dimension as the catalog sets it, wherever it is written. No sample puts a
  // time dimension on rows or on a band, so the sweep does not meet this. The prototype's texts are mapped here and nowhere else.
  const day = /^\d{4}-\d{2}-\d{2}/, said = (text: string) => text.replace(day, (iso) => formatDimension(iso, catalog.dimensions['date.day']!));
  const ourDays = (scene0: any) => ({ ...scene0, nodes: scene0.nodes.map((n: any) => (n.kind === 'text' ? { ...n, text: said(n.text) } : n)) });
  const byDay: Record<string, Spec> = {
    rows: { spec: 'view/0', title: 'Page views by day', use: 'bar-list', query: { metrics: ['pageviews'], by: ['date.day'], range: '28d', limit: 8 } },
    band: { spec: 'view/0', title: 'Visitors by day', use: 'share-bar', query: { metrics: ['visitors'], by: ['date.day'], range: '28d', limit: 6 } },
  };
  for (const [name, spec] of Object.entries(byDay)) for (const w of [700, 346, 150]) {
    it(name + ' at ' + w + ': the prototype says the date raw; ours says the day, and nothing else differs', () => {
      const { plan, scene, result } = run(spec, w);
      const host0 = proto.makeHost(w, null, 'svg', 8), res0 = proto.runQuery(spec.query, 'typical'), plan0 = proto.resolve(toProto(spec), res0, host0), scene0 = protoScene(plan0, spec.query, res0, host0);
      const texts = (sc: any): string[] => sc.nodes.filter((n: any) => n.kind === 'text').map((n: any) => n.text);
      expect(plain(result)).toEqual(plain(res0));
      expect(plain(plan)).toEqual({ ...fromProto(plain(plan0)), preset: plan.preset });
      expect(texts(scene0).some((t) => day.test(t))).toBe(true);
      expect(texts(scene).some((t) => day.test(t))).toBe(false);
      expect(texts(scene).some((t) => /^[A-Z][a-z]{2} \d/.test(t))).toBe(true);
      expect(plain(scene)).toEqual(ourDays(scene0));
    });
  }
});

describe('the one-line legend\'s key: a deliberate departure from the prototype (feedback, review of October 7, finding 3)', () => {
  // A channel called "top", which no fixture has.
  const mix = samples.mix!.spec, named = runQuery(mix.query);
  named.rows = named.rows.map((r, i) => (i ? r : { ...r, channel: 'top' }));
  it('a segment called "top" has its legend entry and the one-line legend has its own: every key is unique, in both scenes and at every form of the legend', () => {
    for (const w of [346, 150]) {
      const container = makeContainer(w), plan = resolve(mix, named, container, catalog), ratio = buildScene(plan, mix.query, named, catalog);
      for (const scene of [ratio, place(ratio, container)]) { const keys = scene.nodes.map((n) => n.key); expect(new Set(keys).size, 'duplicate keys at ' + w).toBe(keys.length); }
      expect(ratio.nodes.filter((n) => n.key === 'legend:top' || n.key === 'legend-top').map((n) => [n.key, n.part, (n as { text: string }).text])).toEqual([['legend:top', 'legend', 'top'], ['legend-top', 'legend-top', 'top 41%']]);
    }
  });
  it('the prototype gives the two one key', () => {
    const host0 = proto.makeHost(346, null, 'svg', 8), full = plain(proto.buildScene(proto.resolve(toProto(mix), named, host0), mix.query, named, host0));
    const host1 = proto.makeHost(150, null, 'svg', 8), line = plain(proto.buildScene(proto.resolve(toProto(mix), named, host1), mix.query, named, host1));
    expect([full, line].map((s) => s.nodes.filter((n: any) => n.key === 'legend:top').map((n: any) => n.text))).toEqual([['top'], ['top 41%']]);
  });
});

describe('the words: a deliberate departure from the prototype (review of October 12)', () => {
  // The prototype's words are literals: visits, people, the site, and `rows[0].page`. Ours are the catalog's label and the
  // query's dimension, so a view of page views that is empty says so of page views. The sweep maps one to the other.
  const texts = (name: string, sc: (typeof scenarios)[number], w = 346) => { const { plan, scene } = run(specs[name]!, w, null, sc); return [plan.text, ...scene.nodes.flatMap((n) => (n.key === 'sub' || n.key === 'notice' ? [(n as { text: string }).text] : []))]; };
  const texts0 = (name: string, sc: string) => { const host0 = proto.makeHost(346, null, 'svg', 8), res0 = proto.runQuery(specs[name]!.query, sc), plan0 = proto.resolve(toProto(specs[name]!), res0, host0); return [plan0.text, ...proto.buildScene(plan0, specs[name]!.query, res0, host0).nodes.filter((n: any) => n.key === 'sub' || n.key === 'notice').map((n: any) => n.text)]; };
  it('an empty range is said of its metric, the label first; the prototype calls page views visits', () => {
    expect(texts0('total', 'empty')).toEqual(['No page views recorded in the last 28 days.', 'No visits yet']);
    expect(texts('total', 'empty')).toEqual(['Page views: nothing recorded in the last 28 days.', 'Page views: nothing yet']);
    expect(texts0('pages', 'empty')[1]).toBe('No visits in this period yet');
    expect(texts('pages', 'empty')[1]).toBe('Page views: nothing in this period yet');
    expect(texts('trend', 'empty')[1]).toBe('Visitors: nothing in this period yet');
    expect(texts('trend', 'empty', 150)[1]).toBe('Visitors: nothing in …');      // cut to its room, as the prototype's is: the label stays and the end goes
  });
  it('an instant metric is said by its label and the query\'s dimension; the prototype says people, the site and a page', () => {
    expect(texts0('live', 'typical')).toEqual(['7 people are on the site right now; the busiest page is / (3).', 'on the site right now']);
    expect(texts('live', 'typical')).toEqual(['Present now: 7 right now; the top page is / (3).', 'right now']);
    expect(texts0('live', 'empty')).toEqual(['Nobody is on the site right now.', 'Nobody is here right now']);
    expect(texts('live', 'empty')).toEqual(['Present now: 0 right now.', 'right now']);
  });
  it('a sum of daily counts is not called a count of people', () => {
    expect(texts0('trend', 'typical')[0]).toMatch(/ This is a sum of daily counts, not unique people\.$/);
    expect(texts('trend', 'typical')[0]).toMatch(/ This is a sum of daily counts, not a unique count\.$/);
  });
});

describe('the delta at zero and below it: a deliberate departure from the prototype', () => {
  // The prototype divides by the previous value as it stands, so a rise from below zero reads as a fall and is painted
  // as one, and it says "New" of a zero that stayed zero. Ours measures the change against the size of the previous value,
  // and nothing changed where the two are equal. No fixture has a total at zero or below, so the sweep does not meet it.
  const total = samples.total!.spec, m = total.query.metrics[0]!;
  const at = (cur: number, prev: number) => { const r = runQuery(total.query); return { ...r, totals: { ...r.totals, [m]: cur, [m + '@previous']: prev } }; };
  it('says the direction the value went, and paints it by the metric\'s polarity', () => {
    const cases: [prev: number, cur: number, text: string, where: 'up' | 'down' | 'none', pct?: number][] = [
      [0, 0, 'No change', 'none'], [0, 5, 'New', 'none'], [5, 0, '▼ 100%', 'down', -1],
      [-10, -5, '▲ 50%', 'up', 0.5], [-5, -10, '▼ 100%', 'down', -1], [-10, 10, '▲ 200%', 'up', 2], [10, -10, '▼ 200%', 'down', -2],
      [7, 7, 'No change', 'none'], [-7, -7, 'No change', 'none'], [10, 15, '▲ 50%', 'up', 0.5], [10, 5, '▼ 50%', 'down', -0.5],
    ];
    for (const [prev, cur, text, where, pct] of cases) {
      const say = prev + ' to ' + cur, paint = (good: 'up' | 'down') => (where === 'none' ? 'ink.muted' : where === good ? 'delta.good' : 'delta.bad');
      expect(delta(cur, prev, 'up'), say).toMatchObject({ text, paint: paint('up') });
      expect(delta(cur, prev, 'down'), say).toMatchObject({ text, paint: paint('down') });
      expect(delta(cur, prev, 'none'), say).toMatchObject({ text, paint: 'ink.muted' });
      expect(delta(cur, prev, 'up').pct, say).toBe(pct);
    }
    expect(delta(5, null, 'up')).toEqual({ state: 'none', text: 'No prior period', paint: 'ink.muted' });
    expect([delta(0, 0, 'up').state, delta(5, 0, 'up').state, delta(-5, -10, 'up').state, delta(-10, -5, 'up').state]).toEqual(['flat', 'new', 'up', 'down']);
  });
  it('the scene and the prose say it too', () => {
    const res = at(-5, -10), plan = resolve(total, res, makeContainer(346), catalog), node = buildScene(plan, total.query, res, catalog).nodes.find((n) => n.key === 'delta') as any;
    expect([node.short, node.paint]).toEqual(['▲ 50%', 'delta.good']);
    expect(plan.text).toContain(', up 50% on the previous period');
    expect(resolve(total, at(0, 0), makeContainer(346), catalog).text).toContain(', level with the previous period');
  });
  it('the prototype says a rise from below zero is a fall', () => {
    const res = at(-5, -10), host0 = proto.makeHost(346, null, 'svg', 8), plan0 = proto.resolve(toProto(total), res, host0);
    expect(plain(proto.buildScene(plan0, total.query, res, host0)).nodes.find((n: any) => n.key === 'delta').paint).toBe('delta.bad');
    expect(plan0.text).toContain(', down 50% on the previous period');
  });
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [234, null], [346, 100]];
  for (const name of Object.keys(samples)) for (const [w, h] of sizes) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
});
