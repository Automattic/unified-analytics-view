import { describe, expect, it } from 'vitest';
import { buildScene, expand, makeContainer, place, resolve, type PathNode, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery } from '@unified-analytics/fixtures';

// Step 0 of docs/uncommon-coverage-plan.md: the Uncommon types that today's marks already say, each as a sample, and
// what running them found (section 7 of that note). The samples are swept, and have their golden scenes, with the
// others of their layout: test/coverage.test.ts, test/ranges.test.ts and test/cell.test.ts. Here is what each one is,
// and where the grammar stops short of it. A fact marked "for step N" is a hole that step is to close, held so that
// closing it is a change made on purpose.
const S = (name: string) => moreSamples[name]!.spec;
const run = (spec: Spec, w = 700, result = runQuery(spec.query)) => {
  const container = makeContainer(w, null, 'svg', 8), plan = resolve(spec, result, container, catalog), ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (spec: Spec, result = runQuery(spec.query)) => { try { run(spec, 700, result); } catch (e) { return (e as Error).message; } };
const of = <T = any>(nodes: { key: string }[], start: string) => nodes.filter((n) => n.key.startsWith(start)) as unknown as T[];
const paths = (nodes: { kind: string }[]) => nodes.filter((n): n is PathNode => n.kind === 'path');

describe('the fixture engine, for the Uncommon types', () => {
  it('answers by week with whole weeks, the last of them the one before today\'s, each the sum of its days', () => {
    const { rows, totals } = runQuery({ metrics: ['visitors'], by: ['date.week'], range: '28d' }), days = runQuery({ metrics: ['visitors'], by: ['date.day'], range: '28d' }).rows;
    expect(rows.map((r) => r['date.week'])).toEqual(['2026-W37', '2026-W38', '2026-W39', '2026-W40']);
    expect(rows.some((r) => 'partial' in r)).toBe(false);
    expect(rows.reduce((s, r) => s + (r.visitors as number), 0)).toBe(totals.visitors);
    // The last week ends the day before today, which a query by day ends on.
    expect(rows[3]!.visitors).toBe(days.slice(20, 27).reduce((s, r) => s + (r.visitors as number), 0));
    expect(runQuery({ metrics: ['visitors'], by: ['date.week'], range: '14d' }).rows.map((r) => r['date.week'])).toEqual(['2026-W39', '2026-W40']);
    expect(runQuery({ metrics: ['visitors'], by: ['date.week'], range: '3d' }).rows.length).toBe(1);
    expect(() => runQuery({ metrics: ['visitors'], by: ['date.week'], compare: 'previous' })).toThrow('The fixture has whole weeks with no period before them: its days run out a day short of four more. Remove "compare" from the query, or query by date.day.');
  });
  it('answers by week and a second dimension with a row per pair, time the outer one whichever way they are named', () => {
    const { rows, totalsBy } = runQuery(S('calendar').query), weeks = runQuery({ metrics: ['visitors'], by: ['date.week'], range: '28d' }).rows;
    expect(rows.length).toBe(4 * 7);
    expect(totalsBy!['date.week']).toEqual(weeks);
    for (const w of weeks) expect(rows.filter((r) => r['date.week'] === w['date.week']).reduce((s, r) => s + (r.visitors as number), 0)).toBe(w.visitors);
    expect(runQuery({ ...S('calendar').query, by: ['date.week', 'weekday'] }).rows).toEqual(rows);
  });
  it('returns a running total with each pair through time, of sign-ups alone', () => {
    const { rows, totalsBy } = runQuery(S('cumulative').query), run: Record<string, number> = {};
    for (const r of rows) { run[r.channel as string] = (run[r.channel as string] || 0) + (r.signups as number); expect(r['signups@running']).toBe(run[r.channel as string]); }
    for (const t of totalsBy!.channel!) expect(run[t.channel as string]).toBe(t.signups);
    expect(runQuery({ metrics: ['visitors'], by: ['date.day', 'channel'] }).rows[0]).not.toHaveProperty('visitors@running');
    expect(runQuery({ metrics: ['signups'], by: ['channel', 'device'] }).rows[0]).not.toHaveProperty('signups@running');
  });
  it('returns companions of a table\'s metric and of its dimension, and no total where there is none to give', () => {
    const tornado = runQuery(S('tornado').query), widths = tornado.rows.map((r) => (r['revenue_effect@high'] as number) - (r['revenue_effect@low'] as number));
    expect(tornado.rows[0]).toEqual({ factor: 'Conversion rate', revenue_effect: 800, 'revenue_effect@low': -6200, 'revenue_effect@high': 7800 });
    expect(widths).toEqual(widths.slice().sort((a, b) => b - a));
    expect(tornado.totals).toEqual({ revenue_effect: null });
    const stem = runQuery(S('stem').query);
    expect(stem.rows[2]).toEqual({ load_stem: '2', requests: 12, 'load_stem@leaves': '0 0 1 1 2 3 3 4 5 6 8 9' });
    // A leaf for each request, and the engine's total is the count of them all.
    for (const r of stem.rows) expect((r['load_stem@leaves'] as string).split(' ').length).toBe(r.requests);
    expect(stem.totals).toEqual({ requests: 40 });
    // What does not add up over a range is the same at any range: a place, a share, an effect.
    expect(runQuery({ ...S('embedding').query, range: '7d' }).rows).toEqual(runQuery(S('embedding').query).rows);
  });
  it('returns the share the causes so far hold as a metric of its own, from the most errors to the fewest', () => {
    const { rows, totals } = runQuery(S('pareto').query);
    let held = 0;
    for (const r of rows) { held += r.errors as number; expect(r.errors_share).toBeCloseTo(held / totals.errors!, 3); }
    expect(rows.map((r) => r.errors)).toEqual(rows.map((r) => r.errors as number).sort((a, b) => b - a));
  });
  it('answers a table by the second dimension it has, each row under one value of it, with no totals of those', () => {
    const q = { metrics: ['embed_x', 'embed_y'], by: ['term', 'intent'] }, { rows, totalsBy } = runQuery(q);
    expect(rows.length).toBe(24);
    expect(rows[0]).toMatchObject({ term: 'pricing', intent: 'Pricing' });
    expect(totalsBy!.intent).toEqual(['Pricing', 'How to', 'Privacy'].map((intent) => ({ intent, embed_x: null, embed_y: null })));
    expect(runQuery(q, 'empty')).toMatchObject({ rows: [], totalsBy: { term: [], intent: [] } });
    expect(() => runQuery({ metrics: ['embed_x'], by: ['term', 'device'] })).toThrow('The fixture has "term" on its own, and not with a second dimension. Remove "device" from by.');
  });
  it('has a square of pages: the same values on both dimensions', () => {
    const { totalsBy } = runQuery(S('adjacency').query);
    expect(totalsBy!.next_page!.map((r) => r.next_page).sort()).toEqual(totalsBy!.page!.map((r) => r.page).sort());
  });
});

describe('dots and stems in rows: Cleveland dot plot, ordered dot plot, lollipop', () => {
  it('a dumbbell with no compare is a dot for each row, in the engine\'s ranking: the Cleveland dot plot, and the ordered one', () => {
    const { ratio, result } = run(S('cleveland'));
    expect(expand(S('cleveland')).layers!.map((l) => l.mark)).toEqual(['dot', 'text', 'text']);
    const dots = of<{ x: number; row: string }>(ratio.nodes, 'primary:dot:');
    expect(dots.map((n) => n.row)).toEqual(result.rows.map((r) => r.page));
    expect(dots.map((n) => n.x)).toEqual(dots.map((n) => n.x).sort((a, b) => b - a));
    expect(ratio.track).toBe('beside');
  });
  it('a rule with one end is a stem from zero to the row\'s dot', () => {
    const { ratio } = run(S('lollipop')), stems = of<{ x: number; x2: number }>(ratio.nodes, 'context:rule:'), dots = of<{ x: number }>(ratio.nodes, 'primary:dot:');
    expect(stems.length).toBe(6);
    stems.forEach((s, i) => expect([s.x, s.x2]).toEqual([dots[i]!.x, 0]));
  });
  it('a stem runs between a number and the row\'s value, written from either end', () => {
    // The sample is written with the preset since step 4, so its layers are the expansion's.
    const lollipop = expand(S('lollipop')), [stem, ...rest] = lollipop.layers!, from = (encode: Record<string, string | number>): Spec => ({ ...lollipop, layers: [{ ...stem!, encode }, ...rest] });
    const { ratio } = run(from({ y: 'channel', x: 'visitors', x2: 1000 })), stems = of<{ x: number; x2: number }>(ratio.nodes, 'context:rule:'), dots = of<{ x: number }>(ratio.nodes, 'primary:dot:');
    // The track still holds zero, so 1,000 is that far along it.
    expect(new Set(stems.map((s) => s.x2)).size).toBe(1);
    expect(stems[0]!.x2).toBeCloseTo(1000 / 4318 * dots[0]!.x, 9);
    // Step 4: written from the number it is the same stroke, its two ends named the other way round. It was refused.
    const back = of<{ x: number; x2: number }>(run(from({ y: 'channel', x: 1000, x2: 'visitors' })).ratio.nodes, 'context:rule:');
    expect(back.map((s) => [s.x2, s.x])).toEqual(stems.map((s) => [s.x, s.x2]));
    expect(run(from({ y: 'channel', x: 1000, x2: 'visitors' })).scene.nodes.map((n) => ({ ...n, x1: 0, x2: 0 }))).toEqual(run(from({ y: 'channel', x: 'visitors', x2: 1000 })).scene.nodes.map((n) => ({ ...n, x1: 0, x2: 0 })));
  });
  it('the same marks stand on an axis: a stem up from zero under each dot', () => {
    const up: Spec = { query: S('lollipop').query, layers: [{ mark: 'rule', encode: { x: 'channel', y: 'visitors' }, role: 'context' }, { mark: 'dot', encode: { x: 'channel', y: 'visitors' } }] };
    const { ratio } = run(up), stems = of<{ x: number; t: number; t2: number }>(ratio.nodes, 'context:rule:'), dots = of<{ x: number; t: number }>(ratio.nodes, 'primary:dot:');
    stems.forEach((s, i) => expect([s.x, s.t, s.t2]).toEqual([dots[i]!.x, 0, dots[i]!.t]));
  });
});

describe('bars in rows: tornado, bullet', () => {
  it('a tornado is two bars a row that meet at zero, the loss to one side and the gain to the other', () => {
    const { ratio, scene, plan } = run(S('tornado'), 346), low = of<{ v: number; v0: number; paint: string }>(ratio.nodes, 'primary:bar:'), high = of<{ v: number; v0: number; paint: string }>(ratio.nodes, 'primary:bar#2:');
    const zero = 6200 / (6200 + 7800);
    expect(ratio.track).toBe('beside');
    for (const [i, n] of low.entries()) { expect(n.v).toBeCloseTo(zero, 12); expect(high[i]!.v).toBeCloseTo(zero, 12); expect(n.v0 ?? 0).toBeLessThan(zero); expect(high[i]!.v0).toBeGreaterThan(zero); }
    expect([low[0]!.v0 ?? 0, high[0]!.v0]).toEqual([0, 1]);
    expect([...new Set(low.map((n) => n.paint)), ...new Set(high.map((n) => n.paint))]).toEqual(['delta.bad', 'delta.good']);
    const px = (key: string) => scene.nodes.find((n) => n.key === key) as unknown as { x: number; w: number };
    expect(px('primary:bar:Traffic').x + px('primary:bar:Traffic').w).toBeCloseTo(px('primary:bar#2:Traffic').x, 9);
    // There is no total of effects, so the number is a dash.
    expect(plan.text).toBe('Top factors by effect on revenue, last 28 days: Conversion rate ($800), Traffic ($250), Average order ($250).');
    expect(run(S('tornado'), 100).scene.nodes.find((n) => n.key === 'value')).toMatchObject({ text: '–' });
  });
  it('a bar with two ends and no paint is in its layer\'s own: the rule that painted every such bar by direction is gone', () => {
    const plain: Spec = { ...S('tornado'), layers: S('tornado').layers!.map(({ paint: _paint, ...l }) => l) }, { ratio } = run(plain);
    expect([...new Set(of<{ paint: string }>(ratio.nodes, 'primary:bar').map((n) => n.paint))]).toEqual(['series.1']);
  });
  it('for step 4: asked for by paint: "direction", a bar to zero is still read from its field to the number, so a gain to zero is a loss', () => {
    // A bar's first end is a field and a number is its second, so a bar from zero to a gain is written from the gain to
    // zero, and runs down. The sample states delta.bad and delta.good for that reason. A number as the first end mends it.
    const asked: Spec = { ...S('tornado'), layers: S('tornado').layers!.map((l) => (l.mark === 'bar' ? { ...l, paint: 'direction' } : l)) }, { ratio } = run(asked);
    expect([of<{ paint: string }>(ratio.nodes, 'primary:bar:')[0]!.paint, of<{ paint: string }>(ratio.nodes, 'primary:bar#2:')[0]!.paint]).toEqual(['delta.good', 'delta.bad']);
  });
  it('from zero with no second end the two bars lie behind the label, as a bar list\'s do', () => {
    const behind: Spec = { ...S('tornado'), layers: S('tornado').layers!.map((l) => (l.mark === 'bar' ? { ...l, encode: { y: 'factor', x: l.encode!.x! } } : l)) }, { ratio } = run(behind);
    expect(ratio.track).toBe(undefined);
    expect(of<{ opacity: number }>(ratio.nodes, 'primary:bar').every((n) => n.opacity === 0.2)).toBe(true);
  });
  it('a bullet is a bar and a tick at the target, over the metric\'s range divided at the catalog\'s bands', () => {
    // Step 4 drew the bands: until then they were read nowhere, and this was a bar and a tick.
    const { ratio } = run(S('bullet'));
    expect(catalog.metrics.signups!.bands).toEqual([200, 400]);
    expect(ratio.nodes.filter((n) => n.part === 'rows').map((n) => n.key.split(':').slice(0, 2).join(':')).filter((k, i, a) => a.indexOf(k) === i)).toEqual(['row:Desktop', 'context:bar', 'primary:bar', 'reference:tick', 'primary:text', 'primary:text#2', 'row:Mobile', 'row:Tablet']);
    expect(of<{ v: number; v0?: number; paint: string }>(ratio.nodes, 'context:bar:Desktop:').map((n) => [n.v0 ?? 0, n.v, n.paint])).toEqual([[0, 0.4, 'band.1'], [0.4, 0.8, 'band.2'], [0.8, 1, 'band.3']]);
  });
});

describe('lines and areas: Pareto, sparkline, fan, streamgraph, slopegraph, cumulative flow', () => {
  it('a Pareto chart is bars and a line in a second unit, each on its own axis', () => {
    const { ratio, plan } = run(S('pareto'), 346), line = paths(ratio.nodes)[0]!;
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'y-axis-2', 'x-axis']);
    expect(of<{ text: string }>(ratio.nodes, 'ytick:ratio:').map((n) => n.text)).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
    expect(line.points.map((p) => p.v)).toEqual([0.38, 0.627, 0.785, 0.875, 0.932, 0.969, 1]);
    expect(of<{ v: number }>(ratio.nodes, 'primary:bar:')[0]!.v).toBeCloseTo(412 / 500, 12);
    expect(plan.text).toBe('Top causes by errors, last 28 days: Timeout (412), Not found (268), Server error (171). Overall, cumulative share 100%.');
  });
  it('the same share as a companion of the errors is drawn the same way: the catalog has an entry for it, which says its unit', () => {
    // Step 0 found a companion flat along the foot of the count's scale, for want of a unit. It has one now where the catalog gives it one.
    const pareto = S('pareto'), asCompanion: Spec = { ...pareto, query: { ...pareto.query, metrics: ['errors'] }, layers: [pareto.layers![0]!, { mark: 'line', encode: { x: 'cause', y: 'errors@share' }, paint: 'series.2' }] };
    const { ratio, plan, result } = run(asCompanion, 346), metric = run(pareto, 346).ratio;
    expect(catalog.metrics['errors@share']).toEqual({ label: 'Cumulative share', unit: 'ratio', polarity: 'none' });
    expect(result.rows.map((r) => r['errors@share'])).toEqual(runQuery(pareto.query).rows.map((r) => r.errors_share));
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'y-axis-2', 'x-axis']);
    expect(ratio.nodes).toEqual(metric.nodes);
    // A companion is no metric of the query, so the sentence has no total of it to say.
    expect(plan.text).toBe('Top causes by errors, last 28 days: Timeout (412), Not found (268), Server error (171).');
    // With no entry a companion is in its metric's unit, as a quantile is: a rank beside the count it ranks is still on the count's scale.
    const ranked: Spec = { query: { metrics: ['pageviews'], by: ['page'], range: '28d', compare: 'previous', limit: 8 }, layers: [{ mark: 'bar', encode: { x: 'page', y: 'pageviews' } }, { mark: 'line', encode: { x: 'page', y: 'pageviews@rank' }, paint: 'series.2' }] };
    expect(catalog.metrics['pageviews@rank']).toBe(undefined);
    expect(paths(run(ranked, 346).ratio.nodes)[0]!.points.map((p) => p.v)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => n / 5000));
  });
  it('a sparkline is a line where there is no room for its axes: bare, beside the number', () => {
    const wide = run(S('sparkline'), 346), narrow = run(S('sparkline'), 234);
    expect(wide.ratio.parts).toEqual(['y-axis', 'plot', 'x-axis']);
    expect([narrow.ratio.parts, narrow.ratio.side, narrow.scene.height]).toEqual([['number', 'plot'], true, 46]);
    expect(narrow.ratio.nodes.filter((n) => n.part === 'plot').map((n) => n.key)).toEqual(['primary:line', 'primary:line:partial']);
    expect(narrow.plan.dropped).toEqual(['axes and grid (added the number to make up for them)']);
  });
  it('a fan of two bands is two areas, one inside the other, about the line', () => {
    const { ratio, plan } = run(S('fans'), 346), [outer, inner, line] = paths(ratio.nodes) as [PathNode, PathNode, PathNode];
    expect([outer.key, inner.key, line.key]).toEqual(['context:area', 'context:area#2', 'primary:line']);
    inner.points.forEach((p, i) => { const o = outer.points[i]!, l = line.points[i]!; expect(o.v0! < p.v0! && p.v0! < l.v && l.v < p.v && p.v < o.v, p.row).toBe(true); });
    expect([outer.opacity, inner.opacity, outer.paint, inner.paint]).toEqual([0.14, 0.14, 'series.1', 'series.1']);
    // The sentence says the first range the layers give, which is the wider.
    expect(plan.text).toBe('Response time: 436ms in the last 28 days. Between 199ms and 631ms across 28 days.');
    expect(run(S('fans'), 234).plan.dropped).toEqual(['axes and grid (added the number to make up for them)', 'context fill']);
  });
  it('a streamgraph is areas stacked about the middle, read by how thick each is: it has no value axis and no grid', () => {
    const { ratio } = run(S('streamgraph'), 346), areas = paths(ratio.nodes), first = areas[0]!, last = areas[areas.length - 1]!;
    expect(areas.map((n) => n.series)).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other']);
    first.points.forEach((p, i) => expect(((p.v0 ?? 0) + last.points[i]!.v) / 2).toBeCloseTo(0.5, 12));
    areas.slice(1).forEach((a, j) => expect(a.points.map((p) => p.v0)).toEqual(areas[j]!.points.map((p) => p.v)));
    expect(areas.every((n) => n.opacity == null)).toBe(true);
    expect(ratio.nodes.filter((n) => n.key.startsWith('ytick:') || n.key.startsWith('grid:'))).toEqual([]);
    expect(ratio.parts).toEqual(['plot', 'x-axis', 'legend']);
    // With no scale to round, the thickest day takes the whole height of the plot.
    expect(Math.min(...first.points.map((p) => p.v0 ?? 0))).toBe(0);
    expect(Math.max(...last.points.map((p) => p.v))).toBe(1);
  });
  it('a slopegraph is a line for each series between two whole weeks, with a name at each line\'s end', () => {
    const { ratio, plan } = run(S('slopegraph'), 300), lines = paths(ratio.nodes);
    expect(lines.map((n) => [n.key, n.points.length])).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other'].map((s) => ['primary:line:' + s, 2]));
    expect(lines.every((n) => n.points[0]!.x === 0 && n.points[1]!.x === 1)).toBe(true);
    expect(of<{ text: string }>(ratio.nodes, 'xtick:').map((n) => n.text)).toEqual(['Sep 21', 'Sep 28']);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'labels', 'x-axis']);
    expect(of<{ text: string }>(ratio.nodes, 'label:').map((n) => n.text)).toEqual(lines.map((n) => n.series));
    expect(plan.text).toBe('Search is the largest channel at 43% of visitors in the last 14 days, and leads on all 2 weeks.');
    // Two points have no middle, and the plan says it gave one up.
    expect(plan.dropped).toEqual(['the legend (kept a label at the end of each line)', 'the middle date label']);
  });
  it('two days are no slopegraph: the range ends on the unfinished day, so each line is a point and a dashed stroke', () => {
    const days: Spec = { ...S('slopegraph'), query: { ...S('slopegraph').query, by: ['date.day', 'channel'], range: '2d' }, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'channel' } }] };
    expect(paths(run(days, 346).ratio.nodes).slice(0, 2).map((n) => [n.key, n.points.length, n.dash])).toEqual([['primary:line:Search', 1, null], ['primary:line:Search:partial', 2, '2 4']]);
  });
  it('a cumulative flow is areas stacked on a running total, so every edge only rises', () => {
    const { ratio, result } = run(S('cumulative'), 346), areas = paths(ratio.nodes);
    expect(areas.length).toBe(6);
    for (const a of areas) a.points.slice(1).forEach((p, i) => expect(p.v, a.key + ' ' + p.row).toBeGreaterThanOrEqual(a.points[i]!.v));
    // The top edge is everything so far. A stacked area stops at the last whole day.
    const top = areas[5]!.points, whole = result.totalsBy!['date.day']!.slice(0, -1).reduce((s, r) => s + (r.signups as number), 0), ticks = of<{ text: string }>(ratio.nodes, 'ytick:');
    expect(top.length).toBe(27);
    expect(top[26]!.v).toBeCloseTo(whole / Number(ticks[ticks.length - 1]!.text), 12);
  });
});

describe('what a line and an area take beyond the trend: connected scatterplot, ECDF, bump chart, difference, spaghetti', () => {
  it('the engine returns a pair\'s place among its week\'s values, and the share of page views held up to the end of each bin', () => {
    const { rows } = runQuery(S('bump').query), all = runQuery({ ...S('bump').query, limit: undefined }).rows;
    expect(rows.length).toBe(4 * 6);
    for (const r of rows) expect(r['visitors@rank'], r['date.week'] + ' ' + r.page).toBe(1 + all.filter((o) => o['date.week'] === r['date.week'] && (o.visitors as number) > (r.visitors as number)).length);
    expect(runQuery({ metrics: ['visitors'], by: ['date.day', 'page'] }).rows[0]).not.toHaveProperty('visitors@rank');
    const bins = runQuery(S('ecdf').query), held = bins.rows.map((r) => r['pageviews@cumulative'] as number);
    let sum = 0;
    for (const r of bins.rows) { sum += r.pageviews as number; expect(r['pageviews@cumulative']).toBeCloseTo(sum / bins.totals.pageviews!, 4); }
    expect(held).toEqual(held.slice().sort((a, b) => a - b));
    expect(held[held.length - 1]).toBe(1);
    expect(runQuery({ metrics: ['visitors'], by: ['load_time'] }).rows[0]).not.toHaveProperty('visitors@cumulative');
  });
  it('a connected scatterplot is the days as points at two metrics, joined in the order of the days', () => {
    const { ratio, plan, result } = run(S('connected'), 346), [line] = paths(ratio.nodes);
    expect(expand(S('connected')).layers).toEqual([{ mark: 'line', encode: { x: 'visitors', y: 'signups' } }, { mark: 'dot', encode: { x: 'visitors', y: 'signups' } }]);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis']);
    expect([line!.part, line!.curve, line!.points.length]).toEqual(['points', undefined, 27]);
    expect(line!.points.map((p) => p.row)).toEqual(result.rows.slice(0, 27).map((r) => r['date.day']));
    expect(ratio.nodes.filter((n) => n.kind === 'circle' && n.part === 'points').length).toBe(28);
    // The path through time: where it set out and where the last finished day left it.
    expect(plan.text).toBe('From Sep 8 to Oct 4, visitors went from 416 to 310 and sign-ups from 15 to 9. Sep 25 is highest on both.');
    // No bare form, as any plot of points: below the room its axes need it is the number.
    expect([run(S('connected'), 234).plan.layout, run(S('connected'), 234).plan.dropped]).toEqual(['none', ['all marks (kept the number)']]);
  });
  it('an ECDF is a line of the share held so far, stepped over the bins, on a scale that runs to the whole', () => {
    const { ratio, result } = run(S('ecdf'), 346), [line] = paths(ratio.nodes);
    expect(expand(S('ecdf')).layers).toEqual([{ mark: 'line', encode: { x: 'load_time', y: 'pageviews@cumulative' } }]);
    expect(line!.curve).toBe('step');
    expect(line!.points.map((p) => p.v)).toEqual(result.rows.map((r) => r['pageviews@cumulative']));
    expect(line!.points.every((p) => p.w === 1 / 16)).toBe(true);
    // Flat across each bin and upright at its edge: from the start of the first bin to the end of the last, where it is the whole.
    const at = line!.d!.slice(1).split('L').map((c) => c.split(',').map(Number));
    expect(at.length).toBe(32);
    expect([at[0]![0], at[31]]).toEqual([0, [100, 0]]);
    at.forEach((c, i) => { if (i) expect(c[0] === at[i - 1]![0] || c[1] === at[i - 1]![1], String(i)).toBe(true); });
    expect(of<{ text: string }>(ratio.nodes, 'ytick:').map((n) => n.text)).toEqual(['0%', '20%', '40%', '60%', '80%', '100%']);
    expect(run(S('ecdf'), 234).ratio.nodes.filter((n) => n.part === 'plot').map((n) => n.key)).toEqual(['primary:line']);
  });
  it('a bump chart is a line for each page by its place in each week, first at the top', () => {
    const { ratio, plan } = run(S('bump'), 346), lines = paths(ratio.nodes);
    expect(expand(S('bump')).layers).toEqual([{ mark: 'line', encode: { x: 'date.week', y: 'visitors@rank', color: 'page' } }]);
    expect(of<{ text: string; t: number }>(ratio.nodes, 'ytick:').map((n) => [n.text, n.t])).toEqual([['1', 1], ['2', 0.8], ['3', 0.6], ['4', 0.4], ['5', 0.2], ['6', 0]]);
    expect(lines.map((n) => [n.series, n.points.map((p) => Math.round(6 - p.v * 5))])).toEqual([['/', [1, 1, 1, 1]], ['/pricing', [2, 2, 3, 2]], ['/blog/launch-notes', [3, 3, 2, 3]], ['/docs/getting-started', [4, 4, 4, 4]], ['/changelog', [5, 5, 6, 5]], ['/about', [6, 6, 5, 6]]]);
    expect(ratio.series).toEqual(lines.map((n) => n.series));
    expect(plan.text).toBe('In the last 28 days, / is first by visitors on all 4 weeks. Places changed along the way, and each page ended where it began.');
    // Bare, the lines still cross where the places changed.
    expect(run(S('bump'), 234).ratio.parts).toEqual(['number', 'plot']);
  });
  it('a difference chart is the area between revenue and the period before, a gain where it is ahead and a loss where it is behind', () => {
    const { ratio, plan } = run(S('difference'), 700), areas = paths(ratio.nodes).filter((n) => n.fill);
    expect(expand(S('difference')).layers!.map((l) => [l.mark, l.encode!.y, l.encode!.y2, l.paint, l.series, l.role])).toEqual([['area', 'revenue@previous', 'revenue', 'direction', undefined, 'context'], ['line', 'revenue', undefined, undefined, 'previous', 'comparison'], ['line', 'revenue', undefined, undefined, undefined, undefined]]);
    expect(areas.length).toBe(15);
    expect(areas.map((n) => n.paint)).toEqual(areas.map((_, i) => (i % 2 ? 'delta.bad' : 'delta.good')));
    expect(paths(ratio.nodes).filter((n) => !n.fill).map((n) => n.key)).toEqual(['comparison:line', 'primary:line', 'primary:line:partial']);
    expect(plan.text).toBe('Revenue: $63.5k in the last 28 days, up 8.1% on the previous period. Above the previous period on 17 of 27 days, and below it on 10.');
    // With no period before it is the line, and says so. With no compare in the query the preset is the line alone.
    const alone = run(S('difference'), 700, runQuery(S('difference').query, 'no-prior'));
    expect([paths(alone.ratio.nodes).map((n) => n.key), alone.plan.dropped, alone.plan.text]).toEqual([['primary:line', 'primary:line:partial'], ['comparison series (no prior data)'], 'Revenue: $63.5k in the last 28 days, with no prior period to compare.']);
    expect(expand({ ...S('difference'), query: { ...S('difference').query, compare: undefined } }).layers!.map((l) => l.mark)).toEqual(['line']);
    // Short of room the fill and the period before go together, and the line is left beside the number.
    expect(run(S('difference'), 234).plan.dropped).toEqual(['axes and grid (added the number to make up for them)', 'context fill, comparison series']);
  });
  it('the spaghetti sample is its preset: a line for each value of the split, by detail', () => {
    expect(expand(S('spaghetti')).layers).toEqual([{ mark: 'line', encode: { x: 'date.day', y: 'visitors', detail: 'country' } }]);
    expect(run(S('spaghetti'), 346).plan.preset).toBe('spaghetti');
  });
  it('the presets that need what a query lacks say what to add', () => {
    expect(err({ spec: 'view/0', use: 'connected-scatter', query: { metrics: ['visitors'], by: ['date.day'] } })).toBe('The "connected-scatter" preset needs two metrics in query.metrics, and this query has one. Add the second: a funnel\'s is the rate the engine returns for its count, and a connected scatter\'s is the metric on y.');
    expect(err({ spec: 'view/0', use: 'bump', query: { metrics: ['visitors'], by: ['date.week'] } })).toBe('The "bump" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
    expect(err({ spec: 'view/0', use: 'bump', query: { metrics: ['visitors'], by: ['date.day', 'channel'] } })).toBe('Layer 1 encodes "visitors@rank" on y, which the result does not return. With "visitors" it returns: nothing.');
    expect(err({ spec: 'view/0', use: 'ecdf', query: { metrics: ['visitors'], by: ['load_time'] } })).toBe('Layer 1 encodes "visitors@cumulative" on y, which the result does not return. With "visitors" it returns: visitors@density.');
  });
});

describe('points and text: embedding scatter, stem-and-leaf', () => {
  it('an embedding is a point for each row at two metrics, about zero on both', () => {
    const { ratio, plan } = run(S('embedding'), 346);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis']);
    expect(ratio.nodes.filter((n) => n.part === 'points').length).toBe(24);
    expect(['xtick:', 'ytick:'].map((k) => of<{ text: string }>(ratio.nodes, k).map((n) => n.text))).toEqual([['-1', '-0.5', '0', '0.5', '1'], ['-1', '-0.5', '0', '0.5', '1']]);
    expect(plan.text).toBe('Across 24 search terms in the last 28 days, the range of first component is -0.7 to 0.73 and of second component is -0.64 to 0.65. getting started is highest on first component and sso setup on second component.');
    // A place has no total, so what is left where the plot has no room is a dash, over a note that calls the first row the top one.
    expect(run(S('embedding'), 234).scene.nodes.map((n) => [n.key, (n as { text?: string }).text])).toEqual([['value', '–'], ['sub', 'Top: getting started']]);
  });
  it('its points are coloured by a second dimension with that one on color and the points\' own on detail; with neither a text layer nor detail to name them, they are refused', () => {
    const q = { ...S('embedding').query, by: ['term', 'intent'] }, dot = { mark: 'dot' as const, encode: { x: 'embed_x', y: 'embed_y', color: 'intent' } };
    expect(err({ query: q, layers: [dot] })).toBe('The query is by "term", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
    // Step 4 ran what step 1 allowed: detail says the rows' own dimension, and nothing else changes (test/uncommon-rows.test.ts).
    const named = run({ query: q, layers: [{ ...dot, encode: { ...dot.encode, detail: 'term' } }] }, 346);
    expect([named.ratio.series, named.ratio.rows!.length, named.ratio.parts]).toEqual([['Pricing', 'How to', 'Privacy'], 24, ['y-axis', 'plot', 'points', 'x-axis', 'legend']]);
    expect(named.plan.text).toBe(run(S('embedding'), 346).plan.text);
    const { ratio } = run({ query: q, layers: [dot, { mark: 'text', encode: { x: 'embed_x', y: 'embed_y', text: 'term' } }] }, 346);
    expect(ratio.series).toEqual(['Pricing', 'How to', 'Privacy']);
    expect([1, 2, 3].map((j) => ratio.nodes.filter((n) => n.part === 'points' && n.paint === 'series.' + j).length)).toEqual([8, 8, 8]);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'points', 'point-labels', 'x-axis', 'legend']);
  });
  it('a stem-and-leaf display is two texts a row: the stem, and its leaves set from one place', () => {
    const { ratio, scene } = run(S('stem'), 346), leaves = of<{ x: number; text: string }>(scene.nodes, 'primary:text#2:');
    expect(ratio.parts).toEqual(['rows']);
    expect(of<{ text: string }>(scene.nodes, 'primary:text:').map((n) => n.text)).toEqual(['0', '1', '2', '3', '4', '5', '6']);
    expect(leaves.map((n) => n.text.split(' ').length)).toEqual([5, 9, 12, 7, 4, 2, 1]);
    expect(new Set(leaves.map((n) => n.x)).size).toBe(1);
    expect(leaves[0]!.x).toBeGreaterThan(8 + 6.6);
  });
  it('leaves are a companion of the dimension: as one of a metric a string is refused, and short of room they are cut', () => {
    const stem = S('stem'), result = runQuery(stem.query), wrong = { ...result, rows: result.rows.map((r) => ({ ...r, 'requests@leaves': r['load_stem@leaves']! })) };
    expect(err({ ...stem, layers: [stem.layers![0]!, { mark: 'text', encode: { y: 'load_stem', text: 'requests@leaves' } }] }, wrong))
      .toBe('The result has "requests@leaves": "4 6 7 8 9" in row 1, and a metric\'s value is a finite number or null. Send null from the query layer where there is no figure: it is drawn as a gap and written as a dash.');
    // For step 4: a row's last label is clipped to its room, and a leaf that is cut is a request not shown.
    const narrow = run(stem, 120);
    expect(narrow.plan.layout).toBe('rows');
    expect(of<{ text: string }>(narrow.scene.nodes, 'primary:text#2:').map((n) => n.text)[2]).toMatch(/…$/);
    // The sentence ranks rows that are in the dimension's own order.
    expect(narrow.plan.text).toBe('Top whole seconds by requests, last 28 days: 2 (12), 1 (9), 3 (7).');
  });
});
