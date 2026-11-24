import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES, applies, arcD, buildScene, expand, pathD, resolve, type ArcNode, type Room, type Spec } from '@unified-analytics/core';
import catalogSchema from '@unified-analytics/core/schema/catalog.schema.json';
import { catalog, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';
import { err, round, run, shown, validView as view } from './helpers.ts';

// Step 6 of docs/chart-coverage-plan.md: the `arc` mark and the `radial` layout. It
// is held to its own sweep, facts and golden scenes, as test/coverage.test.ts holds the plots.
const specs = Object.fromEntries(['donut', 'pie', 'half', 'gauge', 'radar'].map((k) => [k, moreSamples[k]!.spec]));
const { donut, pie, half, gauge } = specs as Record<string, Spec>;
const arcs = (spec: Spec, w = 346) => run(spec, w).ratio.nodes.filter((n): n is ArcNode => n.kind === 'arc');

describe('the sweep, about a centre', () => {
  const heights = [null, 300, 160, 100, 60, 40], widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, arcs inside their sweep, and at every room parts the scene has', () => {
      const [from, to] = name === 'half' || name === 'gauge' ? [-0.25, 0.25] : [0, 1];
      for (const sc of scenarios) for (const h of heights) for (const w of widths) {
        const at = [name, sc, w, h].join(' ');
        const { ratio, fit } = run(spec, w, h, sc);
        const all = ratio.nodes.map((n) => n.key);
        expect(new Set(all).size, 'duplicate keys: ' + at).toBe(all.length);
        expect(JSON.stringify(ratio, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), 'parts with nothing in them: ' + at).toEqual([]);
        for (const n of ratio.nodes) if (n.kind === 'arc') {
          expect(n.a0 >= from && n.a0 <= n.a1 && n.a1 <= to && n.r0 >= 0 && n.r0 < n.r1 && n.r1 <= 1, 'arc: ' + at + ' ' + n.key).toBe(true);
          expect(n.d, at).toBe(arcD(n));
        }
      }
    });
    it(name + ': resolves in every data state, and steps down to the number', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) {
        expect(run(spec, 346, null, sc).plan.layout, sc).toBe(sc === 'empty' ? 'notice' : 'radial');
        // Under the room its marks need a circle is its number, and so is a notice under its own.
        expect(run(spec, 346, 60, sc).fit.parts, sc).toEqual(sc === 'empty' ? ['notice'] : ['number']);
        if (sc === 'empty') expect(run(spec, 120, null, sc).fit.parts, sc).toEqual(['number']);
        expect(run(spec, 700, null, sc).fit.held, sc).toEqual([]);
      }
    });
  }
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [150, null], [346, 100]];
  it('the donut\'s ratio scene', () => expect(run(donut!, 346).ratio).toMatchSnapshot());
  for (const name of Object.keys(specs)) {
    if (name !== 'donut') it(name, () => expect(run(specs[name]!, 346).ratio).toMatchSnapshot());
    it(name + ', at each room', () => expect(sizes.map(([w, h]) => [w, h, shown(run(specs[name]!, w, h))])).toMatchSnapshot());
  }
});

describe('arcs', () => {
  it('a segment per row, keyed by its row and painted in order, each its share of the engine\'s total', () => {
    const { ratio, result } = run(donut!, 346), segs = arcs(donut!);
    expect(ratio).toMatchObject({ layout: 'radial', aspect: 1, rows: ['Desktop', 'Mobile', 'Tablet'], parts: ['radial', 'hole', 'legend'] });
    expect(segs.map((n) => [n.key, n.row, n.paint, n.role])).toEqual([
      ['primary:arc:Desktop', 'Desktop', 'series.1', 'primary'], ['primary:arc:Mobile', 'Mobile', 'series.2', 'primary'], ['primary:arc:Tablet', 'Tablet', 'series.3', 'primary']]);
    // Each starts where the one before it ends, and stops a hair short of the next.
    const shares = result.rows.map((r) => (r.visitors as number) / result.totals.visitors!);
    expect(segs.map((n) => round(n.a0))).toEqual([0, round(shares[0]!), round(shares[0]! + shares[1]!)]);
    expect(segs.map((n) => round(n.a1 - n.a0 + 0.004))).toEqual(shares.map(round));
    expect(segs.every((n) => n.r0 === 0.6 && n.r1 === 1)).toBe(true);
  });
  it('with a limit the circle stops short of closing, as the band stops short of its end', () => {
    const top3: Spec = { ...pie!, query: { ...pie!.query, limit: 3 } }, { ratio, plan } = run(top3, 346);
    expect(Math.round(arcs(top3).pop()!.a1 * 100)).toBe(83);                // 41 + 28 + 14, less the gap
    expect((ratio.nodes.find((n) => n.key === 'legend-top') as { text: string }).text).toBe('Search 41%');
    expect(plan.text).toBe('Visitors: 10.5k in the last 28 days. This is a sum of daily counts, not a unique count. The top channel is Search, at 41%.');
  });
  it('the legend is the band\'s, node for node', () => {
    const legend = (spec: Spec) => run(spec, 346).ratio.nodes.filter((n) => n.part === 'legend' || n.part === 'legend-top');
    expect(legend(pie!)).toEqual(legend(samples.mix!.spec));
  });
  it('sweep: "half" runs over the top, from the left to the right, in a part twice as wide as it is tall', () => {
    const segs = arcs(half!);
    expect(run(half!, 346).ratio.aspect).toBe(2);
    expect([segs[0]!.a0, round(segs[2]!.a1)]).toEqual([-0.25, 0.246]);
  });
  it('a gauge: the range, the value swept to against the catalog\'s domain, and the target marked', () => {
    const { ratio, result, plan } = run(gauge!, 346), total = result.totals.signups!, at = (v: number) => -0.25 + (v / 500) * 0.5;
    expect(total).toBe(303);
    expect(arcs(gauge!).map((n) => [n.key, n.role, n.paint, round(n.a0), round(n.a1), n.r0])).toEqual([
      ['context:arc', 'context', 'series.1', -0.25, 0.25, 0.7],
      ['primary:arc', 'primary', 'series.1', -0.25, round(at(total)), 0.7],
      ['reference:arc', 'reference', 'rule', round(at(400) - 0.004), round(at(400) + 0.004), 0.7],
    ]);
    expect(ratio).toMatchObject({ aspect: 2, parts: ['radial', 'hole'] });
    expect(ratio.rows).toBeUndefined();
    expect(plan.text).toBe('Sign-ups: 303 in the last 28 days, 76% of its target of 400.');
    expect((ratio.nodes.find((n) => n.key === 'sub') as { text: string }).text).toBe('Target 400');
    // A value past the end of the domain stops at it.
    const tight = { ...catalog, metrics: { ...catalog.metrics, signups: { ...catalog.metrics.signups!, domain: [0, 100] as [number, number] } } };
    const over = buildScene(resolve(gauge!, result, tight), gauge!.query, result, tight).nodes.filter((n): n is ArcNode => n.kind === 'arc');
    expect([over[1]!.a1, over[2]!.a1]).toEqual([0.25, 0.25]);
  });
});

// Step 3 of the refinement plan, stage 4 (reference, Decided 44): the circle is the bend. It draws the plot's `line`,
// `area` and `dot` by the plot's own functions: a place round the circle is what a plot has along x, and how far out
// from the middle what it has up y.
describe('the plot\'s marks about a centre', () => {
  const radar = moreSamples.radar!.spec, q = radar.query, at = { angle: 'weekday', radius: 'visitors' };
  const of = (...layers: NonNullable<Spec['layers']>) => run({ query: q, layers }, 346);
  it('a line runs round from each place to the next and closes, an area fills in from it, and a dot stands at each place', () => {
    const { ratio, plan, result } = run(radar, 346), n = result.rows.length, top = Math.max(...result.rows.flatMap((r) => [r.visitors as number, r['visitors@previous'] as number]));
    expect(plan.layout).toBe('radial');
    expect(ratio).toMatchObject({ parts: ['radial', 'rim'], aspect: 1, rows: result.rows.map((r) => r.weekday) });
    const marks = ratio.nodes.filter((m) => m.part === 'radial') as any[], line = marks.find((m) => m.key === 'primary:line'), dots = marks.filter((m) => m.kind === 'circle');
    expect(marks.filter((m) => m.kind === 'path').map((m) => [m.key, m.curve, m.paint, m.fill ?? false, m.dash ?? null])).toEqual([
      ['context:area', 'radial', 'series.1', true, null], ['comparison:line', 'radial', 'compare', false, '3 3'], ['primary:line', 'radial', 'series.1', false, null]]);
    expect(marks.find((m) => m.key === 'context:area')).toMatchObject({ opacity: 0.14, role: 'context' });
    // A point for each row: its place round the circle, at the middle of its share, and its reach, by distance, on a scale from nothing at the middle to the most of all the layers at the rim.
    expect(line.points.map((p: any) => [p.row, p.x])).toEqual(result.rows.map((r, j) => [r.weekday, (j + 0.5) / n]));
    line.points.forEach((p: any, j: number) => expect(p.y, p.row).toBeCloseTo((result.rows[j]!.visitors as number) / top, 12));
    // It is the path the one place a path is made draws of them, about the origin at a radius of 50, as an arc is: straight, and closed.
    expect(line.d).toBe(pathD(line.points, 'radial'));
    expect(line.d).toMatch(new RegExp('^M-?[\\d.]+,-?[\\d.]+(L-?[\\d.]+,-?[\\d.]+){' + (n - 1) + '}Z$'));
    // A dot is where its place and its reach put it in the part's box, as a seat is: on the line's own corner.
    expect(dots.map((d) => d.key)).toEqual(result.rows.map((r) => 'primary:dot:' + r.weekday));
    const corners = line.d.slice(1, -1).split('L').map((c: string) => c.split(',').map(Number));
    dots.forEach((d, j) => { expect(100 * (d.x - 0.5), d.key).toBeCloseTo(corners[j][0], 2); expect(-100 * (d.y - 0.5), d.key).toBeCloseTo(corners[j][1], 2); });
    // The names round the rim are said once, whatever the number of layers, and the rows are the places, for the keys to step through.
    expect(ratio.nodes.filter((m) => m.part === 'rim').map((m) => (m as any).text)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    // With no period before there is no line of it.
    expect(run(radar, 346, null, 'no-prior').ratio.nodes.some((m) => m.key === 'comparison:line')).toBe(false);
  });
  it('is on the circle\'s one scale out: by distance where only lines and dots reach, and by area under a rose\'s slices, which it then meets', () => {
    const rose = { mark: 'arc' as const, encode: at }, line = { mark: 'line' as const, encode: at };
    const reaches = (r: ReturnType<typeof of>) => (r.ratio.nodes.find((m) => m.key === 'primary:line') as any).points.map((p: any) => p.y);
    const alone = of(line), top = Math.max(...alone.result.rows.map((r) => r.visitors as number));
    alone.result.rows.forEach((r, j) => expect(reaches(alone)[j]).toBeCloseTo((r.visitors as number) / top, 12));
    for (const both of [of(rose, line), of(line, rose)]) {
      const arcs = both.ratio.nodes.filter((m) => m.kind === 'arc') as any[];
      expect(arcs.length).toBe(7);
      both.result.rows.forEach((r, j) => { expect(reaches(both)[j]).toBeCloseTo(Math.sqrt((r.visitors as number) / top), 12); expect(arcs[j].r1).toBeCloseTo(reaches(both)[j], 12); });
      expect(both.ratio.nodes.filter((m) => m.part === 'rim').length).toBe(7);
    }
    // The slices alone are as they were: the rose's scene has not moved for it.
    expect((of(rose).ratio.nodes.filter((m) => m.kind === 'arc') as any[]).map((a) => a.r1)).toEqual((of(rose, line).ratio.nodes.filter((m) => m.kind === 'arc') as any[]).map((a) => a.r1));
  });
  it('gives way as a rose does: the names thin, and under the room the circle needs it is its number', () => {
    expect(shown(run(radar, 346))).toEqual({ parts: ['radial', 'rim'], set: {}, hidden: [], rules: [] });
    expect(shown(run(radar, 200))).toMatchObject({ parts: ['radial', 'rim'], hidden: ['rim.ranked'], rules: ['rim'] });
    expect(shown(run(radar, 346, 60)).parts).toEqual(['number']);
  });
  it('errors name the fix: what is on the two channels, a second metric, a second division, and a mark with no place', () => {
    const e = (layers: NonNullable<Spec['layers']>, query = q) => err({ query, layers });
    const what = (mark: string) => 'Layer 1 is a "' + mark + '" about a centre, which stands at each value of a dimension round the circle and reaches out to its value, and it has ';
    expect(e([{ mark: 'line', encode: { angle: 'visitors' } }])).toBe(what('line') + '"visitors" on angle and nothing on radius. Put a dimension on angle and a metric on radius.');
    expect(e([{ mark: 'dot', encode: { angle: 'weekday', radius: 'weekday' } }])).toBe(what('dot') + '"weekday" on angle and "weekday" on radius. Put a dimension on angle and a metric on radius.');
    expect(e([{ mark: 'line', encode: at }, { mark: 'line', encode: { angle: 'weekday', radius: 'pageviews' } }], { ...q, metrics: ['visitors', 'pageviews'] }))
      .toBe('These layers reach out from the centre by 2 metrics (visitors, pageviews), and a circle has one scale out from its middle. Keep the layers of one metric, or draw the other in a view of its own.');
    expect(e([{ mark: 'arc', encode: at }, { mark: 'arc', encode: at }])).toBe('Layer 2 divides the circle again, by "weekday", and a circle is divided once. Remove one of the layers that divide it.');
    expect(e([{ mark: 'line', encode: { ...at, color: 'weekday' } }])).toBe('Layer 1 encodes "weekday" on color, and the "line" mark in a "radial" layout reads no color. It reads: angle (a dimension), radius (a metric). Remove "color", or use a mark that reads it there: arc or unit.');
    expect(e([{ mark: 'tick', encode: at }])).toBe('The "tick" mark has no rule about a centre yet. Use arc, unit, line, area or dot, or take "angle" off the other layers.');
  });
});

describe('fit rules', () => {
  const rule = (id: string) => FIT_RULES.find((r) => r.layout === 'radial' && r.id === id)!;
  const at = (spec: Spec, w: number, h: number | null = null, plot?: Room) => shown(run(spec, w, h, 'typical', { plot }));
  it('the legend steps down as the band\'s does, and then to arcs of one colour', () => {
    const steps = (spec: Spec, sizes: [number, number | null][]) => sizes.map(([w, h]) => { const f = at(spec, w, h); return !f.parts.some((p) => p === 'radial' || p === 'band') ? 'number' : !f.parts.includes('legend') ? 'none' : f.set.legend ?? 'full'; });
    expect(steps(donut!, [[346, null], [169, null], [346, 100], [346, 87], [346, 63]])).toEqual(['full', 'top', 'full', 'none', 'number']);
    // The share bar at the same widths, which has no step with no legend.
    expect(steps(samples.mix!.spec, [[346, null], [169, null]])).toEqual(['full', 'top']);
    expect(at(donut!, 169)).toMatchObject({ set: { legend: 'top' }, rules: ['legend'] });
    // With no key the arcs are one colour: the gaps between them still say how the whole divides.
    expect(at(pie!, 346, 87)).toMatchObject({ parts: ['radial'], set: { split: 'plain' } });
    expect(at(pie!, 346, 100).set.split).toBeUndefined();
  });
  it('in a donut the number sits in the hole, by the `hole` rule and no field of the spec', () => {
    expect(expand(donut!).layers).toEqual([{ mark: 'arc', encode: { angle: 'visitors', color: 'device', radius: 0.6 } }]);
    expect(run(donut!, 346).ratio.nodes.find((n) => n.key === 'hole')).toMatchObject({ kind: 'text', text: '10.5k', anchor: 'middle', font: 'display' });
    // The rule is on the circle's own box, which a surface measures: under 120 px across the number is out of the hole.
    expect([120, 119].map((w) => at(gauge!, w, null, { inline: w, block: w / 2 }).parts.includes('hole'))).toEqual([true, false]);
    expect(applies(rule('hole'), { view: { inline: 119 }, plot: { inline: 119, block: 60 } })).toBe(true);
    // A box nobody measured is asked nothing.
    expect(at(gauge!, 119).parts).toContain('hole');
    // A pie has no hole, and a number above the circle is not said twice.
    expect(at(pie!, 346)).toMatchObject({ parts: ['radial', 'legend'], rules: [] });
    const result = runQuery(donut!.query);
    expect(buildScene(resolve(donut!, result, catalog, { ...CONTAINER_RULES, tldrValue: { above: 'always' } }), donut!.query, result, catalog).parts).toEqual(['number', 'radial', 'legend']);
  });
  it('below the room the marks need, the number alone', () => {
    expect(at(donut!, 346, 63)).toMatchObject({ parts: ['number'], set: { split: 'plain' } });
    expect(at(donut!, 71, 200).parts).toEqual(['number']);
    // The spec's `keep` holds the legend's rules off, and the marks' own rule is no rule of the guides.
    expect(at({ ...donut!, keep: ['guides'] }, 346, 63)).toMatchObject({ parts: ['number'], rules: ['kept:legend-top', 'marks'] });
  });
});

describe('validation', () => {
  const cat = new Ajv().compile(catalogSchema);
  const arc = (encode: Record<string, string | number>, more = {}): Spec => ({ spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'arc', encode, ...more }] });
  it('the schemas take the arc, its channels, the sweep, and a metric\'s domain, target and bands', () => {
    expect(view(arc({ angle: 'visitors', color: 'channel', radius: 0.6 }, { sweep: 'half' })), JSON.stringify(view.errors)).toBe(true);
    expect(view(arc({ angle: 'visitors', color: 'channel' }, { sweep: 'quarter' }))).toBe(false);
    expect(view(arc({ angle: 'visitors', color: 'channel', radius: 1 }))).toBe(false);
    // Which presets take no dimension is resolve()'s to say: the schema cannot know a library's, or the registry's.
    expect(view({ ...gauge!, use: 'line' })).toBe(true);
    expect(err({ ...gauge!, use: 'line' })).toBe('The "line" preset needs a dimension in query.by.');
    expect(cat(catalog), JSON.stringify(cat.errors)).toBe(true);
    expect(catalog.metrics.signups).toMatchObject({ domain: [0, 500], target: 400, bands: [200, 400] });
    expect(cat({ ...catalog, metrics: { signups: { ...catalog.metrics.signups, domain: [0] } } })).toBe(false);
  });
  it('errors name the fix', () => {
    expect(err(arc({ angle: 'visitors', color: 'channel', radius: 1.2 }))).toBe('Layer 1 has 1.2 on radius. It takes a number from 0 up to 1, the inner radius as a share of the outer (0.6 makes a donut); a metric, with a dimension on angle, for how far each slice reaches; or a dimension, with a metric on angle, for a ring each.');
    expect(err({ ...arc({ angle: 'visitors', color: 'channel' }), layers: [{ mark: 'arc', encode: { angle: 'visitors', color: 'channel' } }, { mark: 'bar', encode: { x: 'visitors' } }] }))
      .toBe('The "bar" mark has no rule about a centre yet. Use arc, unit, line, area or dot, or take "angle" off the other layers.');
    expect(err({ ...arc({ angle: 'visitors', color: 'page' }), query: { metrics: ['visitors'], by: ['page'] } }))
      .toBe('Splitting by "page" makes 8 segments, and there are 6 series colours. Add "limit": 6 to the query, or less.');
    expect(err({ spec: 'view/0', query: { metrics: ['visitors'] }, layers: [{ mark: 'arc', encode: { angle: 'visitors' } }] }))
      .toBe('Layer 1 reads "visitors" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the circle by it.');
    expect(err(arc({ angle: 'channel', color: 'channel' }))).toBe('Layer 1 has a slice for each "channel" and nothing on radius. Every slice is as wide as the next, so a metric on radius says how far each reaches: put one there. For a share each, put the metric on angle and "channel" on color.');
    expect(err(arc({ angle: 0.5, color: 'channel' }))).toBe('Layer 1 splits by "channel" with 0.5 on angle. Put a metric on angle: each segment is its share of that metric\'s total.');
    expect(err({ spec: 'view/0', use: 'pie', query: { metrics: ['visitors'] } })).toBe('The "pie" preset needs a dimension in query.by.');
    expect(err({ spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'arc', encode: { x: 'channel', y: 'visitors' } }] }))
      .toBe('The "arc" mark has no rule for a time or category axis yet. Use line, area, bar, rule, dot, text, tick or unit.');
  });
});
