import { describe, expect, it } from 'vitest';
import { FIT_RULES, buildScene, columnRooms, expand, formatValue, hasOf, pathD, resolve, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';
import { at, err, ofUnbounded, run, shown, validView as view } from './helpers.ts';

// Rows as tracks (docs/chart-coverage-plan.md, step 2): columns of values, a change per row, a signed track and the
// funnel. The sweep and the golden scenes of these samples are in test/coverage.test.ts, with the rest of `moreSamples`.
const conversions = moreSamples.conversions!.spec, league = moreSamples.league!.spec, funnel = moreSamples.funnel!.spec;
const texts = (nodes: { key: string }[], key: RegExp) => nodes.filter((n) => key.test(n.key)).map((n) => (n as unknown as { text: string }).text);

describe('the fixture: events and steps', () => {
  it('a rate comes from the engine, row by row and over the whole, and is not the sum of its rows', () => {
    const { rows, totals } = runQuery(conversions.query);
    expect(rows.map((r) => r.event)).toEqual(['Add to cart', 'Newsletter signup', 'Checkout started', 'Purchase', 'Trial started', 'Contact form']);
    expect(rows[0]).toEqual({ event: 'Add to cart', conversions: 1310, conversion_rate: 0.124, conversion_value: 48200 });
    expect(totals).toEqual({ conversions: 3513, conversion_rate: 0.212, conversion_value: 134720 });
    expect(rows.reduce((s, r) => s + (r.conversion_rate as number), 0)).not.toBeCloseTo(0.212, 2);
    expect(formatValue(0.124, catalog.metrics.conversion_rate!)).toBe('12%');
    expect([formatValue(0.039, catalog.metrics.conversion_rate!, 'exact'), formatValue(null, catalog.metrics.conversion_rate!)]).toEqual(['3.9%', '–']);
  });
  it('counts follow the range and a rate does not; a row with nothing before it has no previous', () => {
    const week = runQuery({ ...conversions.query, range: '7d', compare: 'previous' });
    expect(week.rows[0]).toEqual({ event: 'Add to cart', conversions: 328, 'conversions@previous': 295, conversion_rate: 0.124, 'conversion_rate@previous': 0.125, conversion_value: 12050, 'conversion_value@previous': 10775 });
    expect(week.rows.find((r) => r.event === 'Trial started')!['conversions@previous']).toBe(null);
    expect(runQuery({ ...conversions.query, compare: 'previous' }, 'no-prior').totals['conversions@previous']).toBe(null);
    expect(runQuery(conversions.query, 'empty')).toMatchObject({ rows: [], totals: { conversions: 0 }, meta: { empty: true } });
  });
  it('steps come back in their own order, whatever the first metric says, and a limit keeps the first of them', () => {
    const q = { metrics: ['conversion_rate', 'visitors'], by: ['step'] };
    expect(runQuery(q).rows.map((r) => r.step)).toEqual(['Visited the site', 'Viewed pricing', 'Started checkout', 'Purchased']);
    expect(runQuery({ ...q, limit: 2 }).rows.length).toBe(2);
    expect(runQuery(funnel.query).totals).toEqual({ visitors: 10531, conversion_rate: 0.039 });
  });
  it('errors name the fix', () => {
    expect(() => runQuery({ metrics: ['conversions'], by: ['page'] })).toThrow('The fixture has "conversions" by event only. Query it by that.');
    expect(() => runQuery({ metrics: ['conversion_rate'] })).toThrow('The fixture has "conversion_rate" by event or step only. Query it by that.');
    expect(() => runQuery({ metrics: ['pageviews'], by: ['event'] })).toThrow('The fixture has "event" with conversions, conversion_rate, conversion_value, and not "pageviews". Query one of those.');
    expect(() => runQuery({ metrics: ['conversions'], by: ['event', 'device'] })).toThrow('The fixture has "event" on its own, and not with a second dimension. Remove "device" from by.');
  });
});

describe('columns', () => {
  it('each text layer that shows a metric is a column, in layer order: the first stays and the rest are ranked', () => {
    const { ratio, plan } = run(conversions, 346), mine = ratio.nodes.filter((n) => n.row === 'Purchase');
    expect(plan).toMatchObject({ layout: 'rows', guides: { columns: true }, dropped: [] });
    expect(ratio.parts).toEqual(['columns', 'rows']);
    expect(mine.map((n) => [n.key, n.kind, (n as { text?: string }).text, n.rank])).toEqual([
      ['row:Purchase', 'row', undefined, undefined], ['primary:bar:Purchase', 'rect', undefined, undefined], ['primary:text:Purchase', 'text', 'Purchase', undefined],
      ['primary:text#2:Purchase', 'text', '412', undefined], ['primary:text#3:Purchase', 'text', '3.9%', 1], ['primary:text#4:Purchase', 'text', '$31.7k', 2],
    ]);
    expect(mine.slice(2).map((n) => (n as { font: string }).font)).toEqual(['label', 'value', 'value', 'value']);
  });
  it('a `columns` part holds a header for each, as a guide, with its column\'s rank', () => {
    const heads = run(conversions, 346).ratio.nodes.filter((n) => n.part === 'columns');
    // The first is over the labels: the name of what the rows are.
    expect(heads.map((n) => [n.key, (n as { text: string }).text, n.rank, n.layer])).toEqual([
      ['column:event', 'Event', undefined, 'guide'],
      ['column:primary:text#2', 'Conversions', undefined, 'guide'], ['column:primary:text#3', 'Conversion rate', 1, 'guide'], ['column:primary:text#4', 'Value', 2, 'guide'],
    ]);
  });
  it('one column of values has no header and no rank: the bar list is what it was', () => {
    const { ratio, plan } = run(samples.pages!.spec, 346);
    expect(plan.guides).toEqual({});
    expect(ratio.parts).toEqual(['rows']);
    expect(ratio.nodes.some((n) => n.part === 'columns' || (n.part === 'rows' && n.rank != null))).toBe(false);
  });
  it('a row short of room is its number, in every data state: its columns go by their own widths, which a surface measures', () => {
    for (const sc of ['typical', 'no-prior'] as const) {
      expect(shown(run(conversions, 700, null, sc)).parts, sc).toEqual(['columns', 'rows']);
      // The label needs 90 px, by the `marks` rule, and the headers go with the rows they stand over.
      expect([90, 89].map((w) => shown(run(conversions, w, null, sc)).parts), sc).toEqual([['columns', 'rows'], ['number']]);
    }
    expect([700, 250, 120].map((w) => shown(run(conversions, w, null, 'empty')).parts)).toEqual([['notice'], ['notice'], ['number']]);
  });
  it('each column asks for the room of its widest text, a header among them', () => {
    expect(columnRooms(run(conversions, 346).ratio).map((n) => +n.toFixed(1))).toEqual([77.8, 101, 53.6]);
  });
  it('headers are a key to the columns under them: no rule takes them but the one that takes the rows', () => {
    expect(shown(run(conversions, 346, 79)).parts).toEqual(['columns', 'rows']);
    expect(FIT_RULES.filter((r) => r.layout === 'rows' && r.hide.includes('columns')).every((r) => r.hide.includes('rows'))).toBe(true);
  });
});

describe('a delta per row', () => {
  it('says the row\'s change as the tldr value\'s delta does, painted by the metric\'s polarity', () => {
    const { ratio, plan } = run(league, 346), cells = ratio.nodes.filter((n) => /^primary:text#3:/.test(n.key)) as unknown as { text: string; paint: string; rank: number; font: string }[];
    expect(plan.dropped).toEqual([]);
    expect(cells.map((n) => n.text)).toEqual(['▲ 9.3%', '▲ 28%', '▲ 229%', '▼ 4%', '▼ 6.9%', '▲ 5.2%', '–', '▼ 6.5%']);
    expect(cells.map((n) => n.paint)).toEqual(['delta.good', 'delta.good', 'delta.good', 'delta.bad', 'delta.bad', 'delta.good', 'ink.muted', 'delta.bad']);
    expect(cells.every((n) => n.rank === 1 && n.font === 'value')).toBe(true);
    expect(texts(ratio.nodes, /^column:/)).toEqual(['Page', 'Page views', 'Change']);
    // A metric that is better when it falls turns the paint, and one with no better way has none.
    const down = { ...catalog, metrics: { ...catalog.metrics, pageviews: { ...catalog.metrics.pageviews!, polarity: 'down' as const } } }, result = runQuery(league.query);
    const turned = buildScene(resolve(league, result, down), league.query, result, down);
    expect(at<{ paint: string }>(turned.nodes, 'primary:text#3:/').paint).toBe('delta.bad');
  });
  it('is left out when the query has no compare, and dropped when there is nothing to compare with', () => {
    // The rank goes with the compare too: the fixture returns it only then (test/ranges.test.ts).
    const none: Spec = { ...league, layers: league.layers!.slice(1), query: { ...league.query, compare: undefined } };
    expect(run(none, 346).plan).toMatchObject({ guides: {}, dropped: ['the change on the previous period (the query has no "compare")'] });
    expect(run(league, 346, null, 'no-prior').plan).toMatchObject({ guides: {}, dropped: ['the change on the previous period (no prior data)'] });
    expect(run(league, 346, null, 'no-prior').ratio.nodes.filter((n) => n.row === '/').map((n) => n.key)).toEqual(['row:/', 'context:text:/', 'primary:text:/', 'primary:text#2:/']);
    // A preset leaves it out on expansion, as it does a previous layer.
    const presets = { table: { layers: [{ mark: 'text' as const, encode: { y: '$by', text: '$by' } }, { mark: 'text' as const, encode: { y: '$by', text: '$metric' }, series: 'delta' as const }] } };
    expect(expand({ use: 'table', query: league.query }, presets).layers!.length).toBe(2);
    expect(expand({ use: 'table', query: none.query }, presets).layers!.length).toBe(1);
  });
  it('is counted after the other layers for its key, so the columns before and after it keep theirs when it goes', () => {
    const mixed: Spec = { ...league, layers: [league.layers![1]!, league.layers![3]!, league.layers![2]!] };
    const keys = (sc: (typeof scenarios)[number]) => run(mixed, 346, null, sc).ratio.nodes.filter((n) => n.row === '/').map((n) => n.key);
    expect(keys('typical')).toEqual(['row:/', 'primary:text:/', 'primary:text#3:/', 'primary:text#2:/']);
    expect(keys('no-prior')).toEqual(['row:/', 'primary:text:/', 'primary:text#2:/']);
  });
  it('the schema takes it, and an error names the fix where it is not a row\'s text', () => {
    expect(view(league), JSON.stringify(view.errors)).toBe(true);
    expect(view({ ...league, layers: [{ ...league.layers![3]!, series: 'rank' }] })).toBe(false);
    expect(err({ query: { metrics: ['visitors'], by: ['date.day'], compare: 'previous' }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' }, series: 'delta' }] }))
      .toBe('Layer 1 has series: "delta", which is a row\'s change in a metric. Make it a text layer with the dimension on y and the metric on text.');
  });
});

describe('the track', () => {
  const bars: Spec = { query: { metrics: ['net_subscribers'], by: ['channel'] }, layers: [{ mark: 'bar', encode: { y: 'channel', x: 'net_subscribers' } }, { mark: 'text', encode: { y: 'channel', text: 'channel' } }] };
  it('is a linear scale that holds zero: bars with nothing below it start at the track\'s start, and carry no v0', () => {
    const rects = run(bars, 346).ratio.nodes.filter((n) => n.kind === 'rect') as { x: number; x2?: number }[];
    expect(rects[0]).toMatchObject({ x: 1 });
    expect(rects.every((n) => n.x2 === undefined && n.x >= 0 && n.x <= 1)).toBe(true);
  });
  it('covers what is below zero: every bar starts at zero, and one below it lies to the left of there', () => {
    const result = runQuery(bars.query), signed = { ...result, rows: result.rows.map((r, i) => ({ ...r, net_subscribers: [60, 30, -20, -40, 10, 0][i]! })) };
    const { ratio } = run(bars, 346, null, 'typical', { result: signed }), rects = ratio.nodes.filter((n) => n.kind === 'rect') as { x: number; x2: number }[];
    expect(rects.map((n) => n.x2)).toEqual(Array(6).fill(0.4));
    expect(rects.map((n) => n.x)).toEqual([1, 0.7, 0.2, 0, 0.5, 0.4]);
    // Nothing but values below zero, and the scale ends there.
    const down = { ...result, rows: result.rows.map((r, i) => ({ ...r, net_subscribers: -10 * (i + 1) })) };
    expect((run(bars, 346, null, 'typical', { result: down }).ratio.nodes.filter((n) => n.kind === 'rect') as { x2: number }[]).every((n) => n.x2 === 1)).toBe(true);
  });
  it('errors name the fix: marks in two units, and a mark the track has no rule for', () => {
    const two: Spec = { query: conversions.query, layers: [...conversions.layers!, { mark: 'bar', encode: { y: 'event', x: 'conversion_value' } }] };
    expect(err(two)).toBe('These rows have marks that measure in 2 units (count, usd), and a row has one track. Keep the marks of one unit, and show the other metric as a text layer.');
    expect(err({ query: conversions.query, layers: [{ mark: 'arc', encode: { y: 'event', x: 'conversions' } }] })).toBe('The "arc" mark has no rule for rows yet. Use bar, rule, tick, dot, unit, line, area or text.');
  });

  // Step 3 of the refinement plan, stage 2 (reference, Decided 44): a list draws the plot's `line` and `area`, by the
  // plot's own function, on their side. A row's place down the list is what a plot has along x, and the track's scale
  // what it has up y.
  const profile = moreSamples.profile!.spec;
  it('a line runs down the list from each row\'s value to the next: the plot\'s own path, in the track', () => {
    const { ratio, plan, result } = run(profile, 500), line = ratio.nodes.find((n) => n.part === 'track') as any;
    expect(plan.layout).toBe('rows');
    expect(ratio).toMatchObject({ parts: ['rows', 'track'], track: 'beside' });
    expect(hasOf(ratio)).toEqual(['rows', 'track']);
    expect(ratio.nodes.filter((n) => n.part === 'track').map((n) => [n.key, n.kind])).toEqual([['comparison:line', 'path']]);
    expect(line).toMatchObject({ curve: 'monotone', paint: 'compare', width: 1.5, dash: '3 3', layer: 'data', role: 'comparison' });
    // A point for each row, at the middle of the row's place down the list and at its value along the track, on the scale the bars are on.
    const rows = ratio.rows!, bars = ratio.nodes.filter((n) => n.kind === 'rect') as any[], top = Math.max(...result.rows.flatMap((r) => [r.pageviews as number, (r['pageviews@previous'] as number | null) ?? 0]));
    const before = result.rows.map((r, i) => ({ k: rows[i]!, at: (i + 0.5) / rows.length, was: r['pageviews@previous'] as number | null })).filter((r) => r.was != null);
    expect(before.length).toBeGreaterThan(5);                               // a row with no period before has no point, and the line passes it by
    expect(line.points.map((p: any) => [p.row, p.x])).toEqual(before.map((r) => [r.k, r.at]));
    line.points.forEach((p: any, i: number) => expect(p.y, p.row).toBeCloseTo(before[i]!.was! / top, 12));
    bars.forEach((b, i) => expect(b.x, b.key).toBeCloseTo((result.rows[i]!.pageviews as number) / top, 12));
    // It is the path a plot draws of the same points: one function, and a surface turns it.
    expect(line.d).toBe(pathD(line.points, 'monotone'));
    // With no period before there is no line, and no part for one.
    expect(run(profile, 500, null, 'no-prior').ratio.parts).toEqual(['rows']);
  });
  it('an area fills back to where the track has nothing, and both go where the rows go', () => {
    const area: Spec = { query: profile.query, layers: [{ mark: 'area', encode: { y: 'page', x: 'pageviews' } }, { mark: 'text', encode: { y: 'page', text: 'page' } }] };
    const filled = run(area, 500).ratio.nodes.find((n) => n.part === 'track') as any;
    expect(filled).toMatchObject({ key: 'primary:area', kind: 'path', fill: true, paint: 'series.1', opacity: 0.14 });
    expect(filled.points.every((p: any) => p.y2 === undefined)).toBe(true);
    // Read by where its marks are, such a list stands its track beside its labels, and under the room that needs it is its number.
    expect([160, 159].map((w) => shown(run(area, w)).parts)).toEqual([['rows', 'track'], ['number']]);
    expect(shown(run(profile, 346, 20)).parts).toEqual(['number']);
    expect(FIT_RULES.filter((r) => r.layout === 'rows' && r.hide.includes('rows')).every((r) => r.hide.includes('track'))).toBe(true);
  });
  it('errors name the fix: a line in another unit, one that is split, and one with nothing to run through', () => {
    const line = (encode: Record<string, string>): Spec => ({ query: conversions.query, layers: [...conversions.layers!, { mark: 'line', encode: { y: 'event', ...encode } }] });
    expect(err(line({ x: 'conversion_value' }))).toBe('These rows have marks that measure in 2 units (count, usd), and a row has one track. Keep the marks of one unit, and show the other metric as a text layer.');
    expect(err(line({ x: 'conversions', color: 'event' }))).toBe('Layer 6 encodes "event" on color, and the "line" mark in a "rows" layout reads no color. It reads: y (a dimension), x (a metric). Remove "color", or use a mark that reads it there: bar, dot or unit.');
    expect(err(line({}))).toBe('Layer 6 has the mark "line" and nothing on x, and the "line" mark in a "rows" layout is not drawn without it. Encode a metric on x.');
  });
});

describe('the funnel preset', () => {
  it('is rows in the query\'s order: a bar, the count, and the engine\'s rate', () => {
    expect(expand(funnel).layers).toEqual([
      { mark: 'bar', encode: { y: 'step', x: 'visitors' } }, { mark: 'text', encode: { y: 'step', text: 'step' } },
      { mark: 'text', encode: { y: 'step', text: 'visitors' }, align: 'end' }, { mark: 'text', encode: { y: 'step', text: 'conversion_rate' }, align: 'end' },
    ]);
    const { ratio, plan, result } = run(funnel, 346);
    expect(plan).toMatchObject({ preset: 'funnel', layout: 'rows', guides: { columns: true } });
    expect(ratio.rows).toEqual(['Visited the site', 'Viewed pricing', 'Started checkout', 'Purchased']);
    expect(texts(ratio.nodes, /^primary:text#3:/)).toEqual(['100%', '16%', '6.2%', '3.9%']);
    // The rate shown is the row's own field. Nothing here divides one count by another.
    const told = { ...result, rows: result.rows.map((r) => ({ ...r, conversion_rate: 0.5 })) };
    expect(texts(run(funnel, 346, null, 'typical', { result: told }).ratio.nodes, /^primary:text#3:/)).toEqual(['50%', '50%', '50%', '50%']);
    expect((ratio.nodes.filter((n) => n.kind === 'rect') as { x: number }[]).map((n) => +n.x.toFixed(3))).toEqual([1, 0.162, 0.062, 0.039]);
  });
  it('needs a second metric, and says so', () => {
    expect(err({ use: 'funnel', query: { metrics: ['visitors'], by: ['step'] } })).toBe('The "funnel" preset needs two metrics in query.metrics, and this query has one. Add the second: a funnel\'s is the rate the engine returns for its count, and a connected scatter\'s is the metric on y.');
    expect(view(funnel), JSON.stringify(view.errors)).toBe(true);
  });
});

describe('tldr prose for several metrics by one dimension', () => {
  const text = (spec: Spec, sc?: (typeof scenarios)[number]) => run(spec, 346, null, sc).plan.text;
  it('says each metric once, as the engine\'s totals, and the leader by the first', () => {
    expect(text(conversions)).toBe('Conversions: 3,513 in the last 28 days. Conversion rate: 21%. Value: $134.7k. The top event is Add to cart.');
    expect(text(funnel)).toBe('Visitors: 10.5k in the last 28 days. This is a sum of daily counts, not a unique count. Conversion rate: 3.9%. The top step is Visited the site.');
    expect(text(league)).toBe('Page views: 25.1k in the last 28 days, up 14% on the previous period. The top page is /.');
    expect(text(conversions, 'empty')).toBe('Conversions: nothing recorded in the last 28 days.');
  });
});

describe('with no size', () => {
  it('a plan for a container with no limits drops nothing, and its scene has every column', () => {
    for (const spec of [conversions, league, funnel]) {
      const { plan, scene: ratio } = ofUnbounded(spec);
      expect(plan.dropped).toEqual([]);
      expect(ratio.parts).toEqual(['columns', 'rows']);
      expect(ratio.nodes.filter((n) => n.kind === 'row').map((n) => n.row)).toEqual(ratio.rows);
    }
  });
});
