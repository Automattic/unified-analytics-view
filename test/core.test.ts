import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { ALIGNS, CHANNELS, CONTAINER_RULES, DIMENSION_TYPES, DIMENSION_VALUES, LAYER_FIELDS, LAYER_SERIES, MARKS, POLARITIES, QUERY_FIELDS, RANGE_TOTALS, ROLES, SERIES, SPEC_FIELDS, STACKS, UNITS, buildScene, expand, formatDimension, formatValue, partialNote, pathD, resolve, type Spec, type Unit } from '@unified-analytics/core';
import catalogSchema from '@unified-analytics/core/schema/catalog.schema.json';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples, scenarios } from '@unified-analytics/fixtures';
import { delta } from '../packages/core/src/format.ts';
import { ALWAYS, err, heights, ofUnbounded, run, shown, specs, trend, validView, widths } from './helpers.ts';

// The row node (chart-coverage-plan, step 2, part 6; feedback, rows, finding 5). A `rows` scene holds a node per row, of
// kind `row`, for a painter to key. The golden scenes recorded before it are held to what they were by leaving it out.
const lessRows = <S extends { nodes: { kind: string }[] }>(scene: S): S => ({ ...scene, nodes: scene.nodes.filter((n) => n.kind !== 'row') });

const invalid: Record<string, Spec> = {
  'unknown preset': { spec: 'view/0', use: 'no-such-preset', query: { metrics: ['visitors'], by: ['channel'] } },
  'dimension, no layers': { spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'] } },
  'preset, no dimension': { spec: 'view/0', use: 'line', query: { metrics: ['visitors'] } },
};

// What every sample holds in every data state, whatever its room. How a view gives way at a room is the fit rules',
// which test/fit.test.ts holds.
describe('the sweep', () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys and no NaN, in every data state', () => {
      const rules = name === 'headed' ? ALWAYS : CONTAINER_RULES;
      for (const sc of scenarios) {
        const at = name + ' ' + sc, result = runQuery(spec.query, sc), ratio = buildScene(resolve(spec, result, catalog, rules), spec.query, result, catalog);
        const keys = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(JSON.stringify(ratio, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
      }
    });
    it(name + ': at every room its parts are ones the scene has', () => {
      for (const sc of scenarios) for (const h of heights) for (const w of widths) {
        const { ratio, fit } = run(spec, w, h, sc, { rules: name === 'headed' ? ALWAYS : CONTAINER_RULES });
        expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), [name, sc, w, h].join(' ')).toEqual([]);
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
    expect(text('pages')).toBe('Page views: 25.1k in the last 28 days. The top page is /.');
    expect(text('mix')).toBe('Visitors: 10.5k in the last 28 days. This is a sum of daily counts, not a unique count. The top channel is Search, at 41%.');
    expect(text('total')).toBe('Page views: 25.1k in the last 28 days, up 14% on the previous period.');
    expect(text('live')).toBe('Present now: 7 right now.');
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
  it('is the scene\'s own `d` from the scene\'s points', () => {
    const drawn = run(trend, 346).ratio.nodes.filter((n) => n.kind === 'path');
    expect(drawn.length).toBe(4);
    for (const n of drawn) expect(pathD(n.points, n.curve, n.fill), n.key).toBe(n.d);
  });
  it('draws one point, a straight line, an area to the baseline, and nothing from no points', () => {
    expect(pathD([{ x: 0.5, y: 0.25 }], 'monotone')).toBe('M50,75Z');
    expect(pathD([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe('M0,100L100,0');
    expect(pathD([{ x: 0, y: 0.5 }, { x: 1, y: 1 }], undefined, true)).toBe('M0,50L100,0L100,100L0,100Z');
    expect(pathD([])).toBe(null);
  });
  it('draws points about a centre: round from the top, out from the middle, straight and closed, in the box an arc is drawn in', () => {
    // A quarter turn each, at the rim, half way out, the rim and the middle: right, down, left, and the origin.
    expect(pathD([{ x: 0, y: 1 }, { x: 0.25, y: 0.5 }, { x: 0.5, y: 1 }, { x: 0.75, y: 0 }], 'radial')).toBe('M0,-50L25,0L0,50L0,0Z');
    expect(pathD([{ x: 0, y: 1 }, { x: 0.25, y: 1 }], 'radial', true)).toBe('M0,-50L50,0Z');
    expect(pathD([], 'radial')).toBe(null);
  });
});

describe('fitting the container (reference section 10.1)', () => {
  const at = (name: string, w: number, h: number | null = null, plot?: { inline: number; block: number }) => shown(run(specs[name]!, w, h, 'typical', { plot }));

  it('a trend steps from chart, to tldr value beside sparkline, to tldr value', () => {
    const full = run(trend, 346);
    expect(full.plan).toMatchObject({ layout: 'cartesian', tldrValue: false, guides: { x: true, y: true, grid: true } });
    expect(full.plan.layers.map((l) => l.role)).toEqual(['context', 'comparison', 'primary']);
    // At 346 the one thing a rule takes is the middle date.
    expect(shown(full)).toEqual({ parts: ['y-axis', 'plot', 'x-axis'], set: {}, hidden: ['x-tick.mid'], rules: ['mid-tick'] });
    expect(shown(run(trend, 380)).rules).toEqual([]);

    expect(at('trend', 250)).toMatchObject({ parts: ['number', 'plot'], set: { arrange: 'side' } });
    expect(at('trend', 120).parts).toEqual(['number']);
  });
  it('the comparison drops on legibility, not width alone: the rule is on the plot, which a surface measures', () => {
    expect(at('trend', 346, null, { inline: 346, block: 152 }).hidden).not.toContain('role:comparison');
    expect(at('trend', 346, null, { inline: 346, block: 89 }).hidden).toEqual(expect.arrayContaining(['role:comparison', 'role:context']));
    expect(at('trend', 250, null, { inline: 162, block: 46 }).hidden).toEqual(expect.arrayContaining(['role:comparison', 'role:context']));
    // A plot nobody measured is asked nothing.
    expect(at('trend', 250).hidden).not.toContain('role:comparison');
  });
  it('bars with a target become a bar sparkline', () => {
    expect(at('layers', 250, null, { inline: 162, block: 46 })).toMatchObject({ parts: ['number', 'plot'], set: { arrange: 'side' }, hidden: expect.arrayContaining(['role:reference']) });
  });
  it('a share bar gives up its legend before its marks', () => {
    expect(at('mix', 346)).toMatchObject({ parts: ['band', 'legend'], set: {} });
    expect(at('mix', 150)).toMatchObject({ parts: ['band', 'legend'], set: { legend: 'top' } });
    expect(at('mix', 100).parts).toEqual(['number']);
  });
  it('the tldr value sits above the marks for an instant metric, or wherever the context says always', () => {
    expect(run(specs.live!, 346).plan).toMatchObject({ layout: 'rows', tldrValue: true });
    expect(run(specs.pages!, 346).plan.tldrValue).toBe(false);
    expect(run(trend, 346, null, 'typical', { rules: ALWAYS })).toMatchObject({ plan: { layout: 'cartesian', tldrValue: true }, fit: { parts: ['number', 'y-axis', 'plot', 'x-axis'] } });
  });
  it('reports a comparison it could not draw', () => {
    expect(run(trend, 346, null, 'no-prior').plan.dropped).toContain('comparison series (no prior data)');
  });
});

describe('validation', () => {
  it('names the fix', () => {
    expect(err(invalid['unknown preset']!)).toBe('Unknown preset "no-such-preset". The library has: line, bar-list, share-bar, bar, grouped-bar, stacked-bar, stacked-area, pie, donut, pie-semi-circle, gauge, heatmap, funnel. Registered: choropleth, sankey, treemap, pair-list. Use one of those, or register it with registerPreset("no-such-preset", …) before the view is resolved.');
    expect(err(invalid['dimension, no layers']!)).toBe('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: line, bar-list, share-bar, bar, grouped-bar, stacked-bar, stacked-area, pie, donut, pie-semi-circle, gauge, heatmap, funnel, choropleth, sankey, treemap, pair-list.');
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
  const view = validView, cat = new Ajv().compile(catalogSchema);
  it('accept the six samples and the fixture catalog', () => {
    for (const s of Object.values(samples)) expect(view(s.spec), JSON.stringify(view.errors)).toBe(true);
    expect(cat(catalog), JSON.stringify(cat.errors)).toBe(true);
  });
  it('reject a dimension with nothing to draw it, and leave a preset with no dimension to resolve(), which knows which presets take none', () => {
    expect(view(invalid['dimension, no layers'])).toBe(false);
    expect(view(invalid['preset, no dimension'])).toBe(true);
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
  it('every other enum is the list in types.ts its union is made from, and no other', () => {
    const metric = (catalogSchema as any).properties.metrics.additionalProperties.properties, dim = (catalogSchema as any).properties.dimensions.additionalProperties.properties;
    const layer = (viewSchema as any).definitions.layer.properties;
    expect(metric.polarity.enum).toEqual(POLARITIES);
    expect(metric.rangeTotal.enum).toEqual(RANGE_TOTALS);
    expect(dim.type.enum).toEqual(DIMENSION_TYPES);
    expect(dim.values.enum).toEqual(DIMENSION_VALUES);
    expect(layer.mark.anyOf[0].enum).toEqual(MARKS);
    expect(Object.keys(layer.encode.properties)).toEqual(CHANNELS);
    expect(layer.series.enum).toEqual(LAYER_SERIES);
    expect(layer.role.enum).toEqual(ROLES);
    expect(layer.stack.enum).toEqual(STACKS);
    expect(layer.align.enum).toEqual(ALIGNS);
    // The fields a spec, a query and a layer take: resolve() refuses any other by name, as the schema does.
    expect([Object.keys((viewSchema as any).properties), Object.keys((viewSchema as any).definitions.query.properties), Object.keys(layer)]).toEqual([SPEC_FIELDS, QUERY_FIELDS, LAYER_FIELDS]);
    // A description cannot be derived, so it is held to the count it states.
    expect(layer.paint.description).toContain('series.1 to series.' + SERIES + ',');
  });
});

describe('the ratio scene (dom-painter-plan section 3)', () => {
  const PARTS: Record<string, string[]> = {
    cartesian: ['number', 'plot', 'x-axis', 'y-axis'], rows: ['number', 'rows'], band: ['number', 'band', 'legend', 'legend-top'],
    none: ['number'], notice: ['number', 'notice'], prose: [],
  };
  const unbounded = (spec: Spec) => { const { plan, scene } = ofUnbounded(spec); return { plan, ratio: scene }; };
  const numbers = (d: string) => (d.match(/-?[\d.]+/g) || []).map(Number);

  it('has a part on every node, ratios from 0 to 1 and unique keys', () => {
    for (const [name, spec] of Object.entries(specs)) for (const sc of scenarios) {
      const at = [name, sc].join(' '), { ratio } = run(spec, 346, null, sc), keys = ratio.nodes.map((n) => n.key);
      expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
      expect(ratio.parts.every((p) => PARTS[ratio.layout]!.includes(p)), 'parts: ' + at).toBe(true);
      for (const n of ratio.nodes as any[]) {
        expect(PARTS[ratio.layout], 'part: ' + at + ' ' + n.key).toContain(n.part);
        for (const f of ['x', 'w', 'v', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
      }
    }
  });
  it('needs no size, and drops nothing', () => {
    for (const name of Object.keys(samples)) expect(unbounded(specs[name]!).plan.dropped, name).toEqual([]);
    const { ratio } = unbounded(trend);
    expect(ratio).toMatchObject({ layout: 'cartesian', parts: ['y-axis', 'plot', 'x-axis'], scale: 'point' });
    expect(ratio.nodes.filter((n) => n.rank).map((n) => n.key)).toEqual(['sub', 'xtick:2026-09-21']);
    expect(unbounded(specs.layers!).ratio.nodes.filter((n) => n.rank).map((n) => n.key)).toEqual(['grid:500', 'ytick:500', 'grid:1500', 'ytick:1500', 'xtick:2026-09-21']);
    expect(ratio.nodes.filter((n) => n.role).map((n) => n.key + ' ' + n.role)).toEqual(['context:area context', 'comparison:line comparison', 'primary:line primary', 'primary:line:partial primary']);
    // The number is there to be shown in compensation, though this plan does not show it.
    expect(ratio.nodes.filter((n) => n.part === 'number').map((n) => n.key)).toEqual(['value', 'delta', 'sub']);
  });
  it('a band carries both legends, each in its own part: `parts` names the whole one, and a rule sets the one line', () => {
    for (const [w, legend] of [[346, undefined], [150, 'top']] as const) {
      const { ratio, fit } = run(specs.mix!, w);
      expect([ratio.parts, fit.parts, fit.set.legend]).toEqual([['band', 'legend'], ['band', 'legend'], legend]);
      expect(ratio.nodes.filter((n) => n.part === 'legend').length).toBe(18);
      expect(ratio.nodes.filter((n) => n.part === 'legend-top').map((n) => n.key)).toEqual(['legend-top']);
    }
  });
  for (const name of Object.keys(samples)) it(`${name}, with no size`, () => expect(lessRows(unbounded(specs[name]!).ratio)).toMatchSnapshot());
  it('a `rows` scene has a node for each row, ahead of what is drawn in it', () => {
    const { ratio } = run(specs.pages!, 346), mine = ratio.nodes.filter((n) => n.row === '/blog/launch-notes').map((n) => n.key);
    expect(ratio.nodes.filter((n) => n.kind === 'row').map((n) => n.key)).toEqual(ratio.rows!.map((k) => 'row:' + k));
    expect(mine).toEqual(['row:/blog/launch-notes', 'primary:bar:/blog/launch-notes', 'primary:text:/blog/launch-notes', 'primary:text#2:/blog/launch-notes']);
  });
});

describe('layer keys (feedback, decision 1 of October 7)', () => {
  const layerKeys = (spec: Spec, sc: (typeof scenarios)[number] = 'typical') => [...new Set(run(spec, 346, null, sc).ratio.nodes.filter((n) => n.role).map((n) => n.key.replace(/:(partial|label)$/, '')))];
  it('a layer keeps its key when another drops', () => {
    expect(layerKeys(trend)).toEqual(['context:area', 'comparison:line', 'primary:line']);
    expect(layerKeys(trend, 'no-prior')).toEqual(['context:area', 'primary:line']);
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

describe('y ticks (dom-painter-plan section 8, decision 3)', () => {
  // A scene with no size cannot choose its tick count by height. The y scale always rounds to 4 and ranks the ticks,
  // and a surface thins them on a short plot.
  const ticks = (scene: { nodes: { key: string; rank?: number }[] }, ranked = true) => scene.nodes.filter((n) => ranked || !n.rank).map((n) => n.key).filter((k) => /^(ytick|grid):/.test(k));
  it('one scale at any height, with the ticks a short plot gives up ranked', () => {
    const { ratio } = run(specs.layers!, 346, 100);
    expect(ticks(ratio)).toEqual(['grid:0', 'ytick:0', 'grid:500', 'ytick:500', 'grid:1000', 'ytick:1000', 'grid:1500', 'ytick:1500']);
    expect(ticks(ratio, false)).toEqual(['grid:0', 'ytick:0', 'grid:1000', 'ytick:1000']);
  });
  it('where a count of 2 and of 4 share only zero, every other tick stays: a short plot never shows zero alone', () => {
    // A top of 800: four ticks step by 200 and two by 500.
    const spec: Spec = { query: trend.query, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }] }, result = runQuery(spec.query);
    result.rows.forEach((r, i) => { r.visitors = 420 + i * 10; });
    const yticks = buildScene(resolve(spec, result, catalog), spec.query, result, catalog).nodes.filter((n) => n.part === 'y-axis');
    expect(yticks.map((n) => n.key)).toEqual(['ytick:0', 'ytick:200', 'ytick:400', 'ytick:600', 'ytick:800']);
    expect(yticks.filter((n) => !n.rank).map((n) => n.key)).toEqual(['ytick:0', 'ytick:400', 'ytick:800']);
  });
});

describe('one row on a time axis', () => {
  // A time axis labels its first and its last row. With one row they are the same row, and it has one tick: keys are
  // unique. No fixture query returns one row, so the sweep does not meet this.
  const one = runQuery(trend.query), day = one.rows[0]![trend.query.by![0]!] as string;
  one.rows = one.rows.slice(0, 1);
  const xticks = (scene: { nodes: { key: string }[] }) => scene.nodes.map((n) => n.key).filter((k) => k.startsWith('xtick:'));
  it('has the tick once', () => {
    expect(xticks(buildScene(resolve(trend, one, catalog), trend.query, one, catalog))).toEqual(['xtick:' + day]);
  });
  it('two rows still have two ticks, and three have three', () => {
    for (const n of [2, 3]) {
      const some = { ...runQuery(trend.query), rows: runQuery(trend.query).rows.slice(0, n) };
      expect(xticks(buildScene(resolve(trend, some, catalog), trend.query, some, catalog)).length).toBe(n);
    }
  });
});

describe('a time dimension on rows and on a band', () => {
  // A row's label and a segment's name say the dimension as the catalog sets it, "Sep 29", wherever it is written, and
  // never as the result holds it, "2026-09-29". No sample puts a time dimension on rows or on a band.
  const day = /^\d{4}-\d{2}-\d{2}/;
  const byDay: Record<string, Spec> = {
    rows: { spec: 'view/0', title: 'Page views by day', use: 'bar-list', query: { metrics: ['pageviews'], by: ['date.day'], range: '28d', limit: 8 } },
    band: { spec: 'view/0', title: 'Visitors by day', use: 'share-bar', query: { metrics: ['visitors'], by: ['date.day'], range: '28d', limit: 6 } },
  };
  for (const [name, spec] of Object.entries(byDay)) {
    it(name + ': says the day, and not the date as the result holds it', () => {
      const texts = run(spec, 700).ratio.nodes.flatMap((n) => (n.kind === 'text' ? [n.text] : []));
      expect(texts.some((t) => day.test(t))).toBe(false);
      expect(texts.some((t) => /^[A-Z][a-z]{2} \d/.test(t))).toBe(true);
    });
  }
});

describe('the one-line legend\'s key', () => {
  // A channel called "top", which no fixture has.
  const mix = samples.mix!.spec, named = runQuery(mix.query);
  named.rows = named.rows.map((r, i) => (i ? r : { ...r, channel: 'top' }));
  it('a segment called "top" has its legend entry and the one-line legend has its own: every key is unique, with both forms of the legend in the scene', () => {
    const ratio = buildScene(resolve(mix, named, catalog), mix.query, named, catalog), keys = ratio.nodes.map((n) => n.key);
    expect(new Set(keys).size, 'duplicate keys').toBe(keys.length);
    expect(ratio.nodes.filter((n) => n.key === 'legend:top' || n.key === 'legend-top').map((n) => [n.key, n.part, (n as { text: string }).text])).toEqual([['legend:top', 'legend', 'top'], ['legend-top', 'legend-top', 'top 41%']]);
  });
});

describe('the words are the catalog\'s label and the query\'s dimension', () => {
  // Core knows no name, so a view of page views that is empty says so of page views, and never of visits or people.
  const texts = (name: string, sc: (typeof scenarios)[number]) => { const { plan, ratio: scene } = run(specs[name]!, 346, null, sc); return [plan.text, ...scene.nodes.filter((n) => scene.parts.includes(n.part)).flatMap((n) => (n.key === 'sub' || n.key === 'notice' ? [(n as { text: string }).text] : []))]; };
  it('an empty range is said of its metric, the label first', () => {
    expect(texts('total', 'empty')).toEqual(['Page views: nothing recorded in the last 28 days.', 'Page views: nothing yet']);
    expect(texts('pages', 'empty')[1]).toBe('Page views: nothing in this period yet');
    expect(texts('trend', 'empty')[1]).toBe('Visitors: nothing in this period yet');
  });
  it('an instant metric is said by its label and the query\'s dimension', () => {
    expect(texts('live', 'typical')).toEqual(['Present now: 7 right now.', 'right now']);
    expect(texts('live', 'empty')).toEqual(['Present now: 0 right now.', 'right now']);
  });
  it('a sum of daily counts is not called a count of people', () => {
    expect(texts('trend', 'typical')[0]).toMatch(/ This is a sum of daily counts, not a unique count\.$/);
  });
});

describe('the delta at zero and below it', () => {
  // The change is measured against the size of the previous value, so a rise from below zero is a rise, and nothing
  // changed where the two are equal: a zero that stayed zero is not "New". No fixture has a total at zero or below.
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
    const res = at(-5, -10), plan = resolve(total, res, catalog), node = buildScene(plan, total.query, res, catalog).nodes.find((n) => n.key === 'delta') as any;
    expect([node.short, node.paint]).toEqual(['▲ 50%', 'delta.good']);
    expect(plan.text).toContain(', up 50% on the previous period');
    expect(resolve(total, at(0, 0), catalog).text).toContain(', level with the previous period');
  });
});

describe('golden scenes', () => {
  // The scenes themselves are above, with no size. These are what the fit rules make of each at three rooms.
  const sizes: [number, number | null][] = [[346, null], [234, null], [346, 100]];
  for (const name of Object.keys(samples)) it(name + ', at each room', () => expect(sizes.map(([w, h]) => [w, h, shown(run(specs[name]!, w, h))])).toMatchSnapshot());
});
