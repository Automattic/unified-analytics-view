import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, expand, makeContainer, place, resolve, unboundedContainer, type Catalog, type PainterName, type Result, type Spec } from '@universal-analytics/core';
import viewSchema from '@universal-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, scenarios } from '@universal-analytics/fixtures';
import { hitNodes } from '../packages/dom/src/keys.ts';

// Ranges and `tick` (docs/chart-coverage-plan.md, step 3): companion fields, a second end on a bar, a rule and an
// area, a rule with fields, the tick, dots in a row's track, and paint by direction. Nothing here has a prototype to
// match, so it is held to its own sweep, facts and golden scenes.
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', cat: Catalog = catalog, result: Result = runQuery(spec.query, scenario)) => {
  const container = makeContainer(w, h, painter, 8), plan = resolve(spec, result, container, cat);
  const ratio = buildScene(plan, spec.query, result, cat);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (s: Spec, q = s.query) => { try { resolve(s, runQuery(q), makeContainer(346), catalog); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);
const names = ['box', 'errors', 'waterfall', 'candlestick', 'fan', 'dumbbell', 'bullet'];
const specs = Object.fromEntries(names.map((k) => [k, moreSamples[k]!.spec]));
const { box, errors, waterfall, candlestick, fan, dumbbell, bullet } = specs as Record<string, Spec>;
const league = moreSamples.league!.spec;
const at = <T = any>(nodes: { key: string }[], key: string) => nodes.find((n) => n.key === key) as unknown as T;
const marks = (nodes: any[]) => nodes.filter((n) => n.layer === 'data' && n.part !== 'number' && n.kind !== 'row' && n.kind !== 'text');
const painters: PainterName[] = ['svg', 'dots'];
const heights = [null, 300, 160, 100, 60, 40];
const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];

describe('the fixture engine: companions', () => {
  it('returns a page\'s quantiles and the interval of its mean with the metric, as it states them', () => {
    const { rows, totals } = runQuery(box!.query);
    expect(rows[0]).toEqual({ page: '/blog/analytics-without-cookies', response_time: 720, 'response_time@min': 210, 'response_time@p25': 470, 'response_time@p50': 640,
      'response_time@p75': 890, 'response_time@max': 2600, 'response_time@lower': 648, 'response_time@upper': 792 });
    expect(rows.length).toBe(8);
    // The total is the engine's own, and no sum of its rows.
    expect(totals).toEqual({ response_time: 436 });
    for (const r of rows) expect(['@min', '@p25', '@p50', '@p75', '@max'].map((f) => r['response_time' + f] as number)).toEqual(['@min', '@p25', '@p50', '@p75', '@max'].map((f) => r['response_time' + f] as number).sort((a, b) => a - b));
  });
  it('returns a day\'s open and close, its least and most, and its interval', () => {
    const { rows } = runQuery(candlestick!.query), r = rows[0]!, f = (s: string) => r['response_time@' + s] as number;
    expect(Object.keys(r)).toEqual(['date.day', 'partial', 'response_time', 'response_time@open', 'response_time@close', 'response_time@min', 'response_time@max', 'response_time@lower', 'response_time@upper']);
    for (const d of rows) { const g = (s: string) => d['response_time@' + s] as number; expect(g('min') < Math.min(g('open'), g('close')) && g('max') > Math.max(g('open'), g('close')) && g('lower') < (d.response_time as number) && (d.response_time as number) < g('upper')).toBe(true); }
    expect(f('lower')).toBeLessThan(f('upper'));
    expect(runQuery({ ...candlestick!.query, range: '7d' }).rows).toEqual(rows.slice(21));
  });
  it('returns a running total on either side of each day, from the start of the range', () => {
    for (const range of ['28d', '7d']) {
      const { rows, totals } = runQuery({ ...waterfall!.query, range });
      let run = 0;
      for (const r of rows) { expect(r['net_subscribers@before']).toBe(run); run += r.net_subscribers as number; expect(r['net_subscribers@running']).toBe(run); }
      expect(run).toBe(totals.net_subscribers);
    }
    // With a second dimension a row is a pair, and has no running total of its own.
    expect(runQuery({ metrics: ['net_subscribers'], by: ['date.day', 'device'] }).rows[0]).not.toHaveProperty('net_subscribers@running');
  });
  it('returns a page\'s rank by page views, counted before the limit, and only with a query that compares', () => {
    expect(runQuery(league.query).rows.map((r) => r['pageviews@rank'])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(runQuery({ ...league.query, limit: 3 }).rows.map((r) => r['pageviews@rank'])).toEqual([1, 2, 3]);
    expect(runQuery(league.query, 'no-prior').rows[0]!['pageviews@rank']).toBe(1);
    expect(runQuery({ ...league.query, compare: undefined }).rows[0]).toEqual({ page: '/', pageviews: 4820 });
  });
  it('errors name the fix, and an empty result has no rows', () => {
    expect(() => runQuery({ metrics: ['response_time'], by: ['channel'] })).toThrow('The fixture has "response_time" by day or page by page, and not by anything else. Query it by date.day or by page alone.');
    for (const s of Object.values(specs)) expect(runQuery(s.query, 'empty')).toMatchObject({ rows: [], meta: { empty: true } });
  });
});

describe('companion fields, and the checks on a second end', () => {
  it('a companion the result returns is taken on any channel, and one it lacks is an error that lists those there are', () => {
    const q = box!.query, layer = (encode: Record<string, string | number>, mark = 'bar') => ({ query: q, layers: [{ mark, encode }] }) as Spec;
    for (const encode of [{ x: 'page', y: 'response_time@p50' }, { x: 'page', y: 'response_time@p25', y2: 'response_time@p75' }, { y: 'page', x: 'response_time@min', x2: 'response_time@max' }] as Record<string, string>[]) expect(err(layer(encode)), JSON.stringify(encode)).toBe(undefined);
    expect(err(layer({ x: 'page', y: 'response_time', size: 'response_time@max' }, 'dot'))).toBe(undefined);
    expect(err(layer({ y: 'page', text: 'response_time@p50' }, 'text'))).toBe(undefined);
    expect(err(layer({ x: 'page', y: 'response_time@p99' })))
      .toBe('Layer 1 encodes "response_time@p99" on y, which the result does not return. With "response_time" it returns: response_time@min, response_time@p25, response_time@p50, response_time@p75, response_time@max, response_time@lower, response_time@upper.');
    expect(err(layer({ x: 'page', y: 'response_time@p25', y2: 'response_time@p76' })))
      .toBe('Layer 1 encodes "response_time@p76" on y2, which the result does not return. With "response_time" it returns: response_time@min, response_time@p25, response_time@p50, response_time@p75, response_time@max, response_time@lower, response_time@upper.');
    expect(err(layer({ x: 'page', y: 'pageviews@rank' }))).toBe('Layer 1 encodes "pageviews@rank" on y, which the query does not return. It returns: page, response_time.');
  });
  it('a second end is a bar\'s, a rule\'s or an area\'s, and needs a first end to run from', () => {
    const q = box!.query;
    expect(err({ query: q, layers: [{ mark: 'dot', encode: { x: 'page', y: 'response_time@min', y2: 'response_time@max' } }] }))
      .toBe('Layer 1 is a "dot" with "y2", and only a bar, a rule or an area runs from one value to another. Use one of those, or remove "y2".');
    expect(err({ query: q, layers: [{ mark: 'bar', encode: { x: 'page', y2: 'response_time@max' } }] }))
      .toBe('Layer 1 has "y2" and no value on y to run from. Encode where it starts on y: a metric, or a companion the result returns with one.');
    expect(err({ query: q, layers: [{ mark: 'bar', encode: { y: 'page', x: 'page', x2: 'response_time@max' } }] }))
      .toBe('Layer 1 has "x2" and no value on x to run from. Encode where it starts on x: a metric, or a companion the result returns with one.');
  });
  it('the schema takes the tick and the two channels, and the samples are valid', () => {
    for (const [name, s] of Object.entries(specs)) expect(view(s), name + JSON.stringify(view.errors)).toBe(true);
    expect(view({ spec: 'view/0', query: box!.query, layers: expand(box!).layers }), JSON.stringify(view.errors)).toBe(true);
    expect(view({ spec: 'view/0', query: dumbbell!.query, layers: expand(dumbbell!).layers }), JSON.stringify(view.errors)).toBe(true);
    expect(view({ spec: 'view/0', query: box!.query, layers: [{ mark: 'bar', encode: { x: 'page', y: 'response_time', y3: 'response_time@max' } }] })).toBe(false);
    expect(view({ spec: 'view/0', query: box!.query, layers: [{ mark: 'a stroke', encode: { x: 'page', y: 'response_time' } }] })).toBe(false);   // a name that could be a custom mark's is resolve()'s to check
  });
});

describe('presets', () => {
  it('a slot may be followed by a suffix, which names a companion of what fills it', () => {
    expect(expand(box!).layers).toEqual([
      { mark: 'rule', encode: { x: 'page', y: 'response_time@min', y2: 'response_time@max' }, role: 'context' },
      { mark: 'bar', encode: { x: 'page', y: 'response_time@p25', y2: 'response_time@p75' }, role: 'context', paint: 'series.1' },
      { mark: 'tick', encode: { x: 'page', y: 'response_time@p50' } },
    ]);
    const presets = { odd: { layers: [{ mark: 'bar' as const, encode: { x: '$by@end', y: '$metric2@a@b', color: '$split', size: '$other@p50', y2: 7 } }] } };
    expect(expand({ use: 'odd', query: { metrics: ['m', 'n'], by: ['d', 'e'] } }, presets).layers![0]!.encode).toEqual({ x: 'd@end', y: 'n@a@b', color: 'e', size: '$other@p50', y2: 7 });
  });
  it('each resolves as its preset, in its layout', () => {
    expect(names.map((n) => { const p = run(specs[n]!, 700).plan; return [p.preset, p.layout, p.layers.map((l) => l.role + ':' + l.mark).join(' ')]; })).toEqual([
      ['box-plot', 'cartesian', 'context:rule context:bar primary:tick'],
      ['error-bars', 'cartesian', 'primary:bar context:rule'],
      ['waterfall', 'cartesian', 'primary:bar'],
      ['candlestick', 'cartesian', 'context:rule primary:bar'],
      ['fan', 'cartesian', 'context:area primary:line'],
      ['dumbbell', 'rows', 'context:rule comparison:dot primary:dot primary:text primary:text'],
      ['bullet', 'rows', 'primary:bar reference:tick primary:text primary:text'],
    ]);
  });
  it('a dumbbell with no compare in the query is a dot for each row: its rule and its previous dot are left out on expansion', () => {
    const dots: Spec = { ...dumbbell!, query: { ...dumbbell!.query, compare: undefined } };
    expect(expand(dots).layers!.map((l) => l.mark)).toEqual(['dot', 'text', 'text']);
    const { plan, ratio } = run(dots, 346);
    expect(plan.dropped).toEqual([]);
    expect(marks(ratio.nodes).map((n) => n.kind)).toEqual(Array(8).fill('circle'));
    expect(ratio.track).toBe('beside');
  });
});

describe('the sweep', () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, and ratios from 0 to 1', () => {
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const where = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + where).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + where).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + where).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + where).toBeLessThanOrEqual(h);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'x2', 'w', 'v', 'v0', 't', 't2']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + where + ' ' + n.key).toBe(true);
        // Placing changes no key and no order. It only leaves out what the size has no room for.
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + where).toEqual(keys);
        // Nothing is placed outside the view.
        for (const n of scene.nodes as any[]) for (const f of ['x', 'x1', 'x2', 'cx']) if (n[f] != null && n.kind !== 'text') expect(n[f] + (n.tx || 0) >= -0.001 && n[f] + (n.tx || 0) <= w + 0.001, f + ' outside: ' + where + ' ' + n.key).toBe(true);
      }
    });
    it(name + ': resolves in every data state, and steps down to the number and then the prose', () => {
      for (const sc of scenarios) {
        const layouts = [346, 250, 120, 10].map((w) => run(spec, w, null, sc).plan.layout), marks = run(spec, 700).plan.layout;
        expect(layouts, sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'none', 'prose'] : [marks, marks, 'none', 'prose']);
        if (marks === 'cartesian') expect(run(spec, 250, null, sc).plan.dropped[0], sc).toBe(sc === 'empty' ? undefined : 'axes and grid (added the number to make up for them)');
        // With room for everything, all that is missing is what there is no prior period to say.
        expect(run(spec, 700, null, sc).plan.dropped, sc).toEqual(sc === 'no-prior' && spec.query.compare ? ['comparison series (no prior data)'] : []);
        const result = runQuery(spec.query, sc);
        expect(resolve(spec, result, unboundedContainer(), catalog).dropped, sc).toEqual(sc === 'no-prior' && spec.query.compare ? ['comparison series (no prior data)'] : []);
      }
    });
  }
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [234, null], [346, 100]];
  for (const name of names) for (const [w, h] of sizes) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
});

describe('a second end in the plot', () => {
  it('a bar runs from one of the engine\'s values to another, and the scale holds both', () => {
    const { ratio, scene, result } = run(box!, 346), r = result.rows[1]!, bar = at(ratio.nodes, 'context:bar:/blog/launch-notes');
    // The most of any row is 2,600, so the scale is rounded to 3,000.
    expect(bar).toMatchObject({ kind: 'rect', part: 'plot', v0: (r['response_time@p25'] as number) / 3000, v: (r['response_time@p75'] as number) / 3000, row: '/blog/launch-notes', role: 'context' });
    // In pixels the plot runs from 162 up to 10.
    const px = at(scene.nodes, 'context:bar:/blog/launch-notes');
    expect(px.y).toBeCloseTo(162 - 152 * 800 / 3000, 9);
    expect(px.h).toBeCloseTo(152 * (800 - 430) / 3000, 9);
  });
  it('a rule with fields is a segment for each row, standing at the middle of its band', () => {
    const { ratio, scene } = run(box!, 346), rule = at(ratio.nodes, 'context:rule:/blog/launch-notes'), bar = at(ratio.nodes, 'context:bar:/blog/launch-notes');
    expect(rule).toMatchObject({ kind: 'line', part: 'plot', t: 180 / 3000, t2: 2350 / 3000, row: '/blog/launch-notes', paint: 'ink', layer: 'data', role: 'context' });
    expect(rule.x).toBeCloseTo(bar.x + bar.w / 2, 12);
    expect(rule.x2).toBe(rule.x);
    expect(rule.dash).toBe(undefined);
    const px = at(scene.nodes, 'context:rule:/blog/launch-notes'), pb = at(scene.nodes, 'context:bar:/blog/launch-notes');
    expect(px.x1).toBeCloseTo(pb.x + pb.w / 2, 9);
    expect([px.x2, px.y1, px.y2].map((n) => +n.toFixed(6))).toEqual([+px.x1.toFixed(6), +(162 - 152 * 180 / 3000).toFixed(6), +(162 - 152 * 2350 / 3000).toFixed(6)]);
    // With one end it stands up from zero: the stem of a lollipop.
    const stem = run({ query: box!.query, layers: [{ mark: 'rule', encode: { x: 'page', y: 'response_time' } }, { mark: 'dot', encode: { x: 'page', y: 'response_time' } }] }, 346).ratio;
    expect(at(stem.nodes, 'reference:rule:/')).toMatchObject({ t: 0, t2: 412 / 800 });
    // A rule at a constant is what it was.
    expect(at(run(moreSamples.quadrant!.spec, 346).ratio.nodes, 'reference:rule#2')).toMatchObject({ t: 0.5, paint: 'rule', dash: '5 3' });
  });
  it('an area with two ends is a band: each point starts at the first', () => {
    const { ratio, result } = run(fan!, 346), [area, line] = ratio.nodes.filter((n) => n.kind === 'path') as any[];
    expect([area.key, area.fill, area.opacity, area.role, line.key]).toEqual(['context:area', true, 0.14, 'context', 'primary:line']);
    expect(area.points.length).toBe(27);                                          // the unfinished day is the line's to say
    area.points.forEach((p: any, i: number) => { const r = result.rows[i]!; expect([p.v0, p.v]).toEqual([(r['response_time@lower'] as number) / 600, (r['response_time@upper'] as number) / 600]); });
    expect(area.d).toMatch(/Z$/);
  });
  it('a row with either end missing has no mark', () => {
    const result = runQuery(box!.query), holed = { ...result, rows: result.rows.map((r, i) => (i === 1 ? { ...r, 'response_time@max': null } : i === 2 ? { ...r, 'response_time@p25': null } : r)) };
    const { ratio } = run(box!, 346, null, 'typical', 'svg', catalog, holed);
    expect(ratio.nodes.filter((n) => n.key.startsWith('context:rule:')).length).toBe(7);
    expect(ratio.nodes.filter((n) => n.key.startsWith('context:bar:')).length).toBe(7);
    expect(ratio.nodes.filter((n) => n.key.startsWith('primary:tick:')).length).toBe(8);
  });
});

describe('tick', () => {
  it('is a short stroke across its band at a value, and gives a plot a band scale as a bar does', () => {
    const { ratio, scene } = run(box!, 346), tick = at(ratio.nodes, 'primary:tick:/blog/launch-notes'), bar = at(ratio.nodes, 'context:bar:/blog/launch-notes');
    expect(tick).toMatchObject({ kind: 'line', part: 'plot', t: 590 / 3000, t2: 590 / 3000, width: 2, paint: 'ink', row: '/blog/launch-notes', role: 'primary' });
    expect([tick.x, tick.x2 - tick.x]).toEqual([bar.x, bar.w]);
    const px = at(scene.nodes, 'primary:tick:/blog/launch-notes'), pb = at(scene.nodes, 'context:bar:/blog/launch-notes');
    expect([px.x1, px.x2, px.y1, px.y2].map((n) => +n.toFixed(6))).toEqual([pb.x, pb.x + pb.w, 162 - 152 * 590 / 3000, 162 - 152 * 590 / 3000].map((n) => +n.toFixed(6)));
    const alone = run({ query: box!.query, layers: [{ mark: 'tick', encode: { x: 'page', y: 'response_time@p50' } }] }, 346);
    expect(alone.ratio.scale).toBe('band');
    expect(hitNodes(alone.ratio).length).toBe(8);
  });
  it('errors name the fix: a tick with a metric on x has no band to lie across', () => {
    expect(err({ query: { metrics: ['visitors', 'pageviews'], by: ['page'] }, layers: [{ mark: 'tick', encode: { x: 'visitors', y: 'pageviews' } }] }))
      .toBe('Layer 1 is a tick with the metric "visitors" on x, and a tick needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
  });
});

describe('paint by direction and polarity', () => {
  const paints = (spec: Spec, cat: Catalog = catalog) => { const { ratio, result } = run(spec, 700, null, 'typical', 'svg', cat); return { result, paints: ratio.nodes.filter((n) => n.kind === 'rect' && n.part === 'plot').map((n) => n.paint) }; };
  const turned = (m: string, polarity: 'up' | 'down' | 'none'): Catalog => ({ ...catalog, metrics: { ...catalog.metrics, [m]: { ...catalog.metrics[m]!, polarity } } });
  it('a bar whose end is below its start is bad and any other good, for a metric that is better when it rises', () => {
    const { result, paints: got } = paints(waterfall!);
    expect(got).toEqual(result.rows.map((r) => ((r['net_subscribers@running'] as number) < (r['net_subscribers@before'] as number) ? 'delta.bad' : 'delta.good')));
    expect(new Set(got)).toEqual(new Set(['delta.good', 'delta.bad']));
  });
  it('is turned by a metric that is better when it falls, and is the series\' own paint where neither is better', () => {
    const { result, paints: got } = paints(candlestick!);
    expect(catalog.metrics.response_time!.polarity).toBe('down');
    expect(got).toEqual(result.rows.map((r) => ((r['response_time@close'] as number) < (r['response_time@open'] as number) ? 'delta.good' : 'delta.bad')));
    expect(paints(candlestick!, turned('response_time', 'up')).paints).toEqual(got.map((p) => (p === 'delta.good' ? 'delta.bad' : 'delta.good')));
    expect(new Set(paints(candlestick!, turned('response_time', 'none')).paints)).toEqual(new Set(['series.1']));
  });
  it('is no spec field: a layer that states its paint keeps it, and a bar with one end is never toned', () => {
    expect(new Set(paints(box!).paints)).toEqual(new Set(['series.1']));
    expect(new Set(paints({ ...waterfall!, layers: [{ ...expand(waterfall!).layers![0]!, paint: 'series.3' }] }).paints)).toEqual(new Set(['series.3']));
    expect(new Set(paints(moreSamples.diverging!.spec).paints)).toEqual(new Set(['series.1']));
    expect(view({ spec: 'view/0', query: waterfall!.query, layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'net_subscribers' }, direction: 'up' }] })).toBe(false);
  });
  it('a waterfall\'s bars each start where the one before ended', () => {
    const bars = run(waterfall!, 700).ratio.nodes.filter((n) => n.kind === 'rect') as any[];
    expect(bars.length).toBe(28);
    bars.forEach((b, i) => { if (i) expect(b.v0 ?? 0).toBeCloseTo(bars[i - 1].v, 12); });
  });
});

describe('fit rules', () => {
  it('ranges are context and go with the secondary rule: a box plot at 180 px wide is its medians alone', () => {
    for (const sc of ['typical', 'no-prior'] as const) {
      const { plan, ratio, scene } = run(box!, 180, null, sc);
      expect(plan).toMatchObject({ layout: 'cartesian', side: true, dropped: ['axes and grid (added the number to make up for them)', 'context fill'] });
      expect(plan.layers.map((l) => l.mark)).toEqual(['tick']);
      expect(marks(ratio.nodes).map((n) => n.key)).toEqual(ratio.rows!.map((r) => 'primary:tick:' + r));
      expect(marks(scene.nodes).every((n) => n.kind === 'line' && n.y1 === n.y2 && n.x2 > n.x1)).toBe(true);
      expect(marks(scene.nodes).length).toBe(8);
    }
    expect(run(box!, 180, null, 'empty').plan.layout).toBe('notice');
  });
  it('the central mark stays in each: the bar of an error bar and of a candlestick, the line of a fan', () => {
    expect([errors!, candlestick!, fan!, waterfall!].map((s) => run(s, 180).plan.layers.map((l) => l.mark))).toEqual([['bar'], ['bar'], ['line'], ['bar']]);
    // The plot is 180 px wide from 346 down to 280, where the axes go.
    expect(run(box!, 280).plan.layers.length).toBe(3);
  });
  it('a track beside its label has a rule of its own: the label\'s room and the track\'s, and the value\'s as it is measured', () => {
    // 160 px by the rule, and 47 for the widest value, "4,820", and its 14 px.
    expect([208, 207, 206].map((w) => run(dumbbell!, w).plan.layout)).toEqual(['rows', 'rows', 'none']);
    expect(run(dumbbell!, 206).plan.needs.width).toBeCloseTo(73, 9);
    expect(run(dumbbell!, 207).plan.needs.width).toBeCloseTo(160 + 5 * 6.6 + 14, 9);
    // The bar list is behind its label, and needs what it did.
    expect(run(moreSamples.funnel!.spec, 346).ratio.track).toBe(undefined);
  });
  it('rows give nothing up by role: a short box trims rows, and each keeps its rule and both dots', () => {
    const { plan, ratio } = run(dumbbell!, 346, 100);
    expect(plan).toMatchObject({ layout: 'rows', rowLimit: 3, dropped: ['rows 4 to 8'] });
    expect(plan.reductions.find((r) => r.id === 'drop-secondary')).toEqual({ id: 'drop-secondary', state: 'nothing to drop' });
    expect(marks(ratio.nodes).map((n) => n.key.split(':').slice(0, 2).join(':'))).toEqual(Array(3).fill(['context:rule', 'comparison:dot', 'primary:dot']).flat());
  });
});

describe('a row\'s track', () => {
  it('draws a rule from one of the row\'s values to another and a dot at each, on a scale that holds every end', () => {
    const { ratio, result } = run(dumbbell!, 346), r = result.rows[2]!, top = 4820;
    expect(r).toMatchObject({ page: '/blog/launch-notes', pageviews: 2105, 'pageviews@previous': 640 });
    expect(ratio.nodes.filter((n) => n.row === r.page).map((n) => n.key)).toEqual(['row:/blog/launch-notes', 'context:rule:/blog/launch-notes', 'comparison:dot:/blog/launch-notes', 'primary:dot:/blog/launch-notes', 'primary:text:/blog/launch-notes', 'primary:text#2:/blog/launch-notes']);
    expect(at(ratio.nodes, 'context:rule:/blog/launch-notes')).toEqual({ key: 'context:rule:/blog/launch-notes', part: 'rows', kind: 'line', x: 640 / top, x2: 2105 / top, t: 0.5, row: '/blog/launch-notes', paint: 'ink', layer: 'data', role: 'context' });
    expect(at(ratio.nodes, 'comparison:dot:/blog/launch-notes')).toEqual({ key: 'comparison:dot:/blog/launch-notes', part: 'rows', kind: 'circle', pulse: false, x: 640 / top, t: 0.5, row: '/blog/launch-notes', paint: 'compare', layer: 'data', role: 'comparison' });
    expect(at(ratio.nodes, 'primary:dot:/blog/launch-notes')).toMatchObject({ x: 2105 / top, paint: 'series.1', role: 'primary' });
    // The scale holds the second end and the previous period, not only the first metric: a row that fell from further out is inside it.
    const far = { ...result, rows: result.rows.map((row, i) => (i === 7 ? { ...row, 'pageviews@previous': 9640 } : row)) };
    expect(at(run(dumbbell!, 346, null, 'typical', 'svg', catalog, far).ratio.nodes, 'comparison:dot:/contact').x).toBe(1);
    expect(at(run(dumbbell!, 346, null, 'typical', 'svg', catalog, far).ratio.nodes, 'primary:dot:/').x).toBe(0.5);
  });
  it('a row with no value before has its dot alone, and with no prior period every row has', () => {
    const { ratio } = run(dumbbell!, 346);
    expect(marks(ratio.nodes).filter((n) => n.row === '/blog/analytics-without-cookies').map((n) => n.key)).toEqual(['primary:dot:/blog/analytics-without-cookies']);
    const none = run(dumbbell!, 346, null, 'no-prior');
    expect(none.plan.dropped).toEqual(['comparison series (no prior data)']);
    expect(none.plan.layers.map((l) => l.mark)).toEqual(['dot', 'text', 'text']);
    expect(marks(none.ratio.nodes).length).toBe(8);
  });
  it('stands beside the label where its marks are read by their place, and place() sets it between the label and the value', () => {
    const { ratio, scene } = run(dumbbell!, 346), px = (k: string) => at(scene.nodes, k);
    expect(ratio.track).toBe('beside');
    // The label has 14 characters at most, and the value's column 47 px. A mark keeps 4 px inside each end of the track.
    const from = 8 + 14 * 6.6 + 12, to = 346 - 47 - 4;
    expect(px('primary:dot:/')).toMatchObject({ kind: 'circle', r: 3, cy: 14 });
    expect(px('primary:dot:/').cx).toBeCloseTo(to, 9);
    expect(px('context:rule:/pricing')).toMatchObject({ kind: 'line', y1: 46, y2: 46 });
    expect(px('context:rule:/pricing').x1).toBeCloseTo(from + (to - from) * 2310 / 4820, 9);
    expect(px('context:rule:/pricing').x2).toBeCloseTo(from + (to - from) * 2960 / 4820, 9);
    expect(px('primary:text:/blog/analytics-without-cookies')).toMatchObject({ x: 8, text: '/blog/analyti…' });
    expect(px('primary:text#2:/')).toMatchObject({ x: 338, anchor: 'end' });
    expect(scene.height).toBe(8 * 28 + 7 * 4);
    // No mark lies under a label or a value.
    for (const n of marks(scene.nodes)) expect(Math.min(n.cx ?? n.x1, n.x2 ?? Infinity)).toBeGreaterThanOrEqual(from - 0.001);
  });
  it('a bar takes a second end, runs from one to the other and is painted by which way it goes', () => {
    const moved: Spec = { query: dumbbell!.query, layers: [{ mark: 'bar', encode: { y: 'page', x: 'pageviews@previous', x2: 'pageviews' } }, { mark: 'text', encode: { y: 'page', text: 'page' } }] };
    const { ratio, scene } = run(moved, 346), bars = ratio.nodes.filter((n) => n.kind === 'rect') as any[];
    expect(bars.length).toBe(7);
    expect(bars[1]).toEqual({ key: 'primary:bar:/pricing', part: 'rows', kind: 'rect', v: 2960 / 4820, v0: 2310 / 4820, row: '/pricing', paint: 'delta.good', layer: 'data', role: 'primary' });
    expect(bars.map((b) => b.paint)).toEqual(['delta.good', 'delta.good', 'delta.good', 'delta.bad', 'delta.bad', 'delta.good', 'delta.bad']);
    // Beside its label a bar is a band through the middle of the row, and nothing is behind it to tint for.
    expect(at(scene.nodes, 'primary:bar:/pricing')).toMatchObject({ y: 32 + 8, h: 12 });
    expect(bars.every((b) => b.opacity === undefined)).toBe(true);
  });
  it('a tick stands across the row at its value, and one that is a reference at the metric\'s catalog target', () => {
    const { ratio, scene, result } = run(bullet!, 346), top = catalog.metrics.signups!.target!;
    expect(result.rows.map((r) => r.signups)).toEqual([158, 124, 21]);
    expect(at(ratio.nodes, 'reference:tick:Mobile')).toEqual({ key: 'reference:tick:Mobile', part: 'rows', kind: 'line', x: 1, x2: 1, t: 0, t2: 1, row: 'Mobile', paint: 'ink', width: 2, layer: 'data', role: 'reference' });
    expect(at(ratio.nodes, 'primary:bar:Mobile')).toMatchObject({ v: 124 / top, paint: 'series.1' });
    expect(at(scene.nodes, 'reference:tick:Mobile')).toMatchObject({ kind: 'line', y1: 32 + 28, y2: 32 });
    // A tick of its own value, and a metric with no target: no mark, and no error.
    const own: Spec = { query: bullet!.query, layers: [{ mark: 'tick', encode: { y: 'device', x: 'signups' } }, { mark: 'text', encode: { y: 'device', text: 'device' } }] };
    expect(marks(run(own, 346).ratio.nodes).map((n) => n.x)).toEqual([1, 124 / 158, 21 / 158]);
    const bare: Catalog = { ...catalog, metrics: { ...catalog.metrics, signups: { label: 'Sign-ups', unit: 'count', polarity: 'up' } } };
    expect(marks(run(bullet!, 346, null, 'typical', 'svg', bare).ratio.nodes).map((n) => n.kind)).toEqual(['rect', 'rect', 'rect']);
  });
  it('the catalog\'s bands are not drawn: there is no paint for them', () => {
    expect(catalog.metrics.signups!.bands).toEqual([200, 400]);
    expect(marks(run(bullet!, 346).ratio.nodes).length).toBe(6);
  });
  it('in the plot a reference tick stands at the target too', () => {
    const { ratio } = run({ query: { metrics: ['signups'], by: ['device'] }, layers: [{ mark: 'bar', encode: { x: 'device', y: 'signups' } }, { mark: 'tick', encode: { x: 'device', y: 'signups' }, role: 'reference' }] }, 346);
    expect(ratio.nodes.filter((n) => n.key.startsWith('reference:tick:')).map((n) => (n as any).t)).toEqual([1, 1, 1]);
  });
});

describe('the league table\'s rank', () => {
  it('is a column from the engine\'s companion, set before the label', () => {
    const { ratio, scene, plan } = run(league, 346);
    expect(plan.dropped).toEqual([]);
    expect(ratio.nodes.filter((n) => n.key.startsWith('context:text:')).map((n) => (n as any).text)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(at(ratio.nodes, 'context:text:/pricing')).toMatchObject({ part: 'rows', font: 'label', anchor: 'start', role: 'context' });
    expect(at(ratio.nodes, 'context:text:/pricing').rank).toBe(undefined);
    // The rank takes one character and 8 px, and the label starts after it.
    expect(at(scene.nodes, 'context:text:/pricing')).toMatchObject({ x: 8, text: '2' });
    expect(at(scene.nodes, 'primary:text:/pricing')).toMatchObject({ x: 8 + 6.6 + 8, text: '/pricing' });
    expect(ratio.track).toBe(undefined);
    // It stays in a short box, where rows are trimmed, and with no prior period.
    expect(run(league, 346, 100).ratio.nodes.filter((n) => n.key.startsWith('context:text:')).length).toBe(2);
    expect(run(league, 346, null, 'no-prior').ratio.nodes.filter((n) => n.key.startsWith('context:text:')).length).toBe(8);
  });
  it('is the engine\'s to give: with no compare the fixture returns none, and the error says so', () => {
    expect(err({ ...league, query: { ...league.query, compare: undefined } })).toBe('Layer 1 encodes "pageviews@rank" on text, which the result does not return. With "pageviews" it returns: nothing.');
  });
});

describe('tldr prose for a metric with a range', () => {
  const text = (spec: Spec, sc?: (typeof scenarios)[number]) => run(spec, 346, null, sc).plan.text;
  it('says the least and the most of the range, after the query\'s own sentence', () => {
    expect(text(box!)).toBe('Top pages by response time, last 28 days: /blog/analytics-without-cookies (720ms), /blog/launch-notes (655ms), /docs/getting-started (530ms). Between 100ms and 2.6s across 8 pages.');
    expect(text(errors!)).toBe('Top pages by response time, last 28 days: /blog/analytics-without-cookies (720ms), /blog/launch-notes (655ms), /docs/getting-started (530ms). Between 266ms and 792ms across 8 pages.');
    expect(text(fan!)).toMatch(/^Response time: 436ms in the last 28 days\. Between \d+ms and \d+ms across 28 days\.$/);
    expect(text(candlestick!)).toMatch(/^Response time: 436ms in the last 28 days\. Between \d+ms and \d+ms across 28 days\.$/);
  });
  it('is the range of a context layer: a waterfall has none, a dumbbell\'s is its comparison, and an empty result has no rows', () => {
    expect(text(waterfall!)).toBe('Net subscribers: 180 in the last 28 days.');
    expect(text(dumbbell!)).toBe('Top pages by page views, last 28 days: / (4,820), /pricing (2,960), /blog/launch-notes (2,105).');
    expect(text(box!, 'empty')).toBe('No response time recorded in the last 28 days.');
    expect(run(box!, 10).plan).toMatchObject({ layout: 'prose', text: text(box!) });
  });
});
