import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { FIT_RULES, arcD, buildScene, expand, makeContainer, place, resolve, tldrProse, type ArcNode, type PainterName, type Result, type Spec, type TextNode } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { radial } from '../packages/dom/src/layouts/radial.ts';

// Step 2 of docs/uncommon-coverage-plan.md: an `arc` that reads data on `angle` and `radius`, and a second ring by
// `detail`. Held to its own sweep, facts and golden scenes, as test/radial.test.ts holds the circle divided by colour.
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg') => {
  const container = makeContainer(w, h, painter, 8), result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (s: Spec, result: Result = runQuery(s.query)) => { try { resolve(s, result, makeContainer(346), catalog); } catch (e) { return (e as Error).message; } };
const view = new Ajv({ allowUnionTypes: true }).compile(viewSchema);
const specs = Object.fromEntries(['rose', 'rings', 'sunburst'].map((k) => [k, moreSamples[k]!.spec])) as Record<string, Spec>;
const { rose, rings, sunburst } = specs;
const arcs = (spec: Spec, w = 346) => run(spec, w).ratio.nodes.filter((n): n is ArcNode => n.kind === 'arc');
const round = (n: number) => Math.round(n * 1000) / 1000;
const arc = (encode: Record<string, string | number>, by = ['channel'], more = {}): Spec => ({ spec: 'view/0', query: { metrics: ['visitors'], by }, layers: [{ mark: 'arc', encode, ...more }] });

describe('the sweep, with data on angle and radius', () => {
  const painters: PainterName[] = ['svg', 'dots'], heights = [null, 300, 160, 100, 60, 40], widths = [54, 80, 120, 170, 229, 250, 290, 346, 500, 700];
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, arcs inside the circle, and a part that holds its shape', () => {
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec!, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
        for (const n of ratio.nodes) if (n.kind === 'arc') {
          expect(n.a0 >= 0 && n.a0 <= n.a1 && n.a1 <= 1 && n.r0 >= 0 && n.r0 < n.r1 && n.r1 <= 1, 'arc: ' + at + ' ' + n.key).toBe(true);
          expect(n.d, at).toBe(arcD(n));
        }
        if (plan.layout !== 'radial') continue;
        expect(scene.plot!.w / scene.plot!.h, 'shape: ' + at).toBe(1);
        expect(scene.plot!.w, 'width: ' + at).toBeLessThanOrEqual(Math.min(w, 160));
      }
    });
    it(name + ': resolves in every data state, and steps down to the number and then the prose, as a donut does', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      expect(view(expand(spec!)), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) {
        expect([346, 120, 10].map((w) => run(spec!, w, null, sc).plan.layout), sc).toEqual(sc === 'empty' ? ['notice', 'none', 'prose'] : ['radial', 'radial', 'prose']);
        if (sc !== 'empty') expect(run(spec!, 346, 60, sc).plan, sc).toMatchObject({ layout: 'none', tldrValue: true });
        expect(run(spec!, 700, null, sc).plan.dropped, sc).toEqual([]);
      }
    });
  }
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [150, null], [346, 100]];
  for (const name of Object.keys(specs)) for (const [w, h] of sizes) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
  for (const name of Object.keys(specs)) it('the ratio scene of ' + name, () => expect(run(specs[name]!, 346).ratio).toMatchSnapshot());
});

describe('a rose: a dimension on angle and a metric on radius', () => {
  it('the engine answers an hour and a weekday in their own order, and a limit keeps the first of them', () => {
    const hours = runQuery(rose!.query).rows.map((r) => r.hour);
    expect(hours.slice(0, 3).concat(hours.slice(-2))).toEqual(['12am', '1am', '2am', '10pm', '11pm']);
    expect(runQuery({ metrics: ['visitors'], by: ['weekday'], limit: 3 }).rows.map((r) => r.weekday)).toEqual(['Mon', 'Tue', 'Wed']);
  });
  it('an equal slice for each row, in the engine\'s order, reaching out by the square root of its value, from the centre and in one paint', () => {
    const { ratio, result } = run(rose!, 346), segs = arcs(rose!), top = Math.max(...result.rows.map((r) => r.visitors as number));
    expect(ratio).toMatchObject({ layout: 'radial', aspect: 1, parts: ['radial', 'rim'] });
    expect(ratio.rows).toEqual(result.rows.map((r) => r.hour));
    expect(ratio.series).toBeUndefined();
    expect(segs.map((n) => n.key)).toEqual(result.rows.map((r) => 'primary:arc:' + r.hour));
    expect(segs.map((n) => round(n.a0))).toEqual(result.rows.map((_, j) => round(j / 24)));
    expect(segs.map((n) => round(n.a1 - n.a0 + 0.004))).toEqual(result.rows.map(() => round(1 / 24)));
    expect(segs.map((n) => n.r1)).toEqual(result.rows.map((r) => Math.sqrt((r.visitors as number) / top)));
    expect(segs.every((n) => n.r0 === 0 && n.paint === 'series.1' && n.role === 'primary')).toBe(true);
    // No number in a hole: radius holds the metric, so there is none.
    expect(ratio.nodes.some((n) => n.part === 'hole' || n.part === 'legend')).toBe(false);
  });
  it('a row with no value, or none above zero, has no slice and keeps its place and its label', () => {
    const result = runQuery(rose!.query);
    result.rows[1]!.visitors = null; result.rows[2]!.visitors = 0;
    const ratio = buildScene(resolve(rose!, result, makeContainer(346), catalog), rose!.query, result, catalog);
    expect(ratio.nodes.filter((n) => n.kind === 'arc').map((n) => n.row).slice(0, 2)).toEqual(['12am', '3am']);
    expect(ratio.rows!.slice(0, 4)).toEqual(['12am', '1am', '2am', '3am']);
    expect(ratio.nodes.filter((n) => n.part === 'rim')).toHaveLength(24);
  });
  it('a label for each slice round the rim, where the middle of the slice meets it, ranked so they thin evenly', () => {
    const labels = run(rose!, 346).ratio.nodes.filter((n): n is TextNode => n.part === 'rim' && n.kind === 'text');
    expect(labels.map((n) => n.text).slice(0, 3)).toEqual(['12am', '1am', '2am']);
    expect(labels.filter((n) => !n.rank).map((n) => n.text)).toEqual(['12am', '6am', '12pm', '6pm']);
    expect(labels.filter((n) => n.rank === 1).map((n) => n.text)).toEqual(['3am', '9am', '3pm', '9pm']);
    expect(labels.filter((n) => n.rank === 2)).toHaveLength(16);
    // The sixth hour starts at a quarter turn, so its middle is a little past the right of the circle.
    expect([round(labels[6]!.x!), round(labels[6]!.t!), labels[6]!.anchor]).toEqual([round(0.5 + Math.sin(Math.PI * 13 / 24) / 2), round(0.5 + Math.cos(Math.PI * 13 / 24) / 2), 'start']);
    // Seven values: four stay and the three between them go first.
    const week = buildScene(resolve({ ...rose!, query: { metrics: ['visitors'], by: ['weekday'] } }, runQuery({ metrics: ['visitors'], by: ['weekday'] }), makeContainer(346), catalog), { metrics: ['visitors'], by: ['weekday'] }, runQuery({ metrics: ['visitors'], by: ['weekday'] }), catalog);
    expect(week.nodes.filter((n) => n.part === 'rim').map((n) => n.rank ?? 0)).toEqual([0, 1, 0, 1, 0, 1, 0]);
  });
  it('the ranked sentence, and the note under the number, are true of rows that came in clock order', () => {
    const { plan, ratio } = run(rose!, 346);
    expect(plan.text).toBe('Top hours by visitors, last 28 days: 11am (864), 10am (824), 12pm (824).');
    expect((ratio.nodes.find((n) => n.key === 'sub') as TextNode).text).toBe('Top: 11am');
    expect(plan.share).toBe(false);
  });
  it('the labels are a guide: the `rim` rule gives them up, the circle takes its margin back, and place() thins the ones that would meet', () => {
    const rule = FIT_RULES.find((r) => r.layout === 'radial' && r.id === 'rim')!;
    expect(rule).toMatchObject({ needs: { inline: 230, block: 120 }, hide: ['rim'], keep: 'guides' });
    const wide = run(rose!, 346), narrow = run(rose!, 229), seg = (r: typeof wide) => r.scene.nodes.find((n) => n.key === 'primary:arc:11am')!, node = wide.ratio.nodes.find((n): n is ArcNode => n.key === 'primary:arc:11am')!;
    expect(wide.plan).toMatchObject({ guides: { rim: true }, dropped: [], needs: { width: 230 } });
    expect(seg(wide)).toMatchObject({ kind: 'path', tx: 173, ty: 80, d: arcD(node, 66) });
    expect(narrow.plan).toMatchObject({ guides: {}, dropped: ['the labels round the rim'] });
    expect(narrow.ratio.parts).toEqual(['radial']);
    expect(seg(narrow)).toMatchObject({ tx: 114.5, ty: 80, d: arcD(node, 80) });
    expect(run(rose!, 346, 119).plan.dropped).toEqual(['the labels round the rim']);
    expect(run({ ...rose!, keep: ['guides'] }, 229).plan.layout).toBe('none');
    // The four that are not ranked always stand, and no two that stand are closer than a label is wide.
    const placed = wide.scene.nodes.filter((n) => n.key.startsWith('rim:')).map((n) => n.key.slice(4));
    expect(placed).toEqual(expect.arrayContaining(['12am', '6am', '12pm', '6pm']));
    expect(placed.length).toBeGreaterThan(4);
    expect(placed.length).toBeLessThan(24);
  });
});

describe('a radial bar: a dimension on radius and a metric on angle', () => {
  it('a ring for each row, the first outermost, each swept against the largest, with the whole ring faint behind it', () => {
    const { ratio, result, plan } = run(rings!, 346), segs = arcs(rings!), top = result.rows[0]!.visitors as number;
    expect(expand(rings!).layers).toEqual([{ mark: 'arc', encode: { radius: 'channel', color: 'channel' }, role: 'context' }, { mark: 'arc', encode: { angle: 'visitors', radius: 'channel', color: 'channel' } }]);
    expect(ratio).toMatchObject({ layout: 'radial', aspect: 1, parts: ['radial', 'legend'], rows: ['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other'] });
    const behind = segs.slice(0, 6), value = segs.slice(6);
    expect(behind.map((n) => [n.key, n.role, n.a0, n.a1, n.tone, n.opacity])).toEqual(result.rows.map((r) => ['context:arc:' + r.channel, 'context', 0, 1, 'soft', 0.14]));
    expect(value.map((n) => [n.key, n.row, n.role, n.paint, n.a0])).toEqual(result.rows.map((r, j) => ['primary:arc:' + r.channel, r.channel, 'primary', 'series.' + (j + 1), 0]));
    expect(value.map((n) => n.a1)).toEqual(result.rows.map((r) => (r.visitors as number) / top));
    // Six rings share the radius from 0.3 out, and each is parted from the next.
    expect(value.map((n) => round(n.r1))).toEqual([1, 0.883, 0.767, 0.65, 0.533, 0.417]);
    expect(value.every((n, j) => n.r0 === behind[j]!.r0 && n.r1 === behind[j]!.r1 && round(n.r1 - n.r0) === 0.096)).toBe(true);
    expect(plan.share).toBe(false);
    expect(plan.text).toBe('Top channels by visitors, last 28 days: Search (4,318), Direct (2,949), Social (1,474).');
  });
  it('the legend says each ring\'s value, since a ring is no share of a whole, and steps down as a donut\'s does', () => {
    const { ratio } = run(rings!, 346), says = (key: string) => (ratio.nodes.find((n) => n.key === key) as TextNode).text;
    expect([says('legend:Direct'), says('share:Direct'), says('legend-top')]).toEqual(['Direct', '2,949', 'Search 4,318']);
    expect(ratio.nodes.find((n) => n.key === 'swatch:Direct')!.paint).toBe('series.2');
    expect([[346, null], [169, null], [346, 87]].map(([w, h]) => run(rings!, w!, h).plan.guides.legend ?? 'none')).toEqual(['full', 'top', 'none']);
  });
  it('against the catalog domain where the metric has one, and in one paint with no legend where nothing is on color', () => {
    const spec: Spec = { spec: 'view/0', query: { metrics: ['signups'], by: ['device'] }, layers: [{ mark: 'arc', encode: { angle: 'signups', radius: 'device' } }] };
    const { ratio, result, plan } = run(spec, 346), segs = ratio.nodes.filter((n): n is ArcNode => n.kind === 'arc');
    expect(segs.map((n) => n.a1)).toEqual(result.rows.map((r) => (r.signups as number) / 500));
    expect(segs.every((n) => n.paint === 'series.1')).toBe(true);
    expect(plan.guides).toEqual({});
    expect(ratio.nodes.some((n) => n.part === 'legend')).toBe(false);
  });
});

describe('a sunburst: detail on an arc split by color', () => {
  it('a segment for each value of the first dimension, from the engine\'s totals by it, and round each its part of a second ring', () => {
    const { ratio, result } = run(sunburst!, 346), segs = arcs(sunburst!), total = result.totals.visitors!, by = result.totalsBy!.device!;
    expect(ratio).toMatchObject({ layout: 'radial', aspect: 1, parts: ['radial', 'legend'], rows: ['Desktop', 'Mobile', 'Tablet'], detail: ['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other'] });
    expect(ratio.series).toBeUndefined();
    const first = segs.filter((n) => n.series == null), second = segs.filter((n) => n.series != null);
    expect(first.map((n) => [n.key, n.paint, n.r0, n.r1, n.opacity])).toEqual([['primary:arc:Desktop', 'series.1', 0, 0.6, undefined], ['primary:arc:Mobile', 'series.2', 0, 0.6, undefined], ['primary:arc:Tablet', 'series.3', 0, 0.6, undefined]]);
    const shares = by.map((r) => (r.visitors as number) / total);
    expect(first.map((n) => round(n.a1 - n.a0 + 0.004))).toEqual(shares.map(round));
    // Each arc of the second ring has its segment's row and paint, its own value as its series, and no legend entry.
    expect(second).toHaveLength(18);
    expect(second.slice(0, 2).map((n) => [n.key, n.row, n.series, n.paint, n.opacity, n.r0, n.r1])).toEqual([
      ['primary:arc:Desktop:Search', 'Desktop', 'Search', 'series.1', 0.6, 0.6, 1], ['primary:arc:Desktop:Direct', 'Desktop', 'Direct', 'series.1', 0.6, 0.6, 1]]);
    for (const p of first) {
      const mine = second.filter((n) => n.row === p.row), rows = result.rows.filter((r) => r.device === p.row);
      expect(mine[0]!.a0, p.row).toBe(p.a0);
      expect(mine.every((n) => n.paint === p.paint && n.a1 <= p.a1 + 0.004 + 1e-9), p.row).toBe(true);
      expect(mine.slice(0, 3).map((n) => round(n.a1 - n.a0 + 0.004)), p.row).toEqual(rows.slice(0, 3).map((r) => round((r.visitors as number) / total)));
    }
    expect(ratio.nodes.filter((n) => n.part === 'legend' && n.kind === 'text' && n.font === 'label').map((n) => (n as TextNode).text)).toEqual(['Desktop', 'Mobile', 'Tablet']);
  });
  it('a segment\'s span is the engine\'s, never the sum of the rows received', () => {
    const result = runQuery(sunburst!.query), cut = { ...result, rows: result.rows.filter((r) => r.channel !== 'Search') };
    const of = (r: Result) => buildScene(resolve(sunburst!, r, makeContainer(346), catalog), sunburst!.query, r, catalog).nodes.filter((n): n is ArcNode => n.kind === 'arc');
    expect(of(cut).filter((n) => n.series == null)).toEqual(of(result).filter((n) => n.series == null));
    // The second ring then stops short of its segment's end, as a circle with a `limit` stops short of closing.
    const short = of(cut).filter((n) => n.row === 'Desktop' && n.series != null), whole = of(result).find((n) => n.key === 'primary:arc:Desktop')!;
    expect(short.map((n) => n.series)).toEqual(['Direct', 'Social', 'AI assistants', 'Email', 'Other']);
    expect(short.at(-1)!.a1).toBeLessThan(whole.a1 - 0.1);
  });
  it('the share sentence, and a hole where the layer has an inner radius', () => {
    expect(run(sunburst!, 346).plan).toMatchObject({ share: true, text: 'Desktop is the largest device at 52% of visitors, and Search the largest channel at 42%.' });
    const holed = run(arc({ angle: 'visitors', color: 'device', detail: 'channel', radius: 0.5 }, ['device', 'channel']), 346);
    expect(holed.ratio.parts).toEqual(['radial', 'hole', 'legend']);
    expect(holed.ratio.nodes.filter((n): n is ArcNode => n.kind === 'arc').slice(0, 2).map((n) => [n.r0, n.r1])).toEqual([[0.5, 0.8], [0.8, 1]]);
  });
});

describe('errors name the fix', () => {
  it('for each new way to be wrong', () => {
    expect(err(arc({ angle: 'visitors', radius: 'visitors' })))
      .toBe('Layer 1 has the metric "visitors" on radius and no dimension on angle, so there is no slice for it to set the reach of. Put a dimension on angle, for a slice each, or a number from 0 up to 1 on radius for the inner radius.');
    expect(err(arc({ angle: 'channel', radius: 'channel' })))
      .toBe('Layer 1 has a dimension on both angle ("channel") and radius ("channel"), and an arc is laid out by one. Keep the dimension on angle and put a metric on radius, for a slice each, or keep it on radius and put a metric on angle, for a ring each.');
    expect(err(arc({ angle: 'channel' })))
      .toBe('Layer 1 has a slice for each "channel" and nothing on radius. Every slice is as wide as the next, so a metric on radius says how far each reaches: put one there. For a share each, put the metric on angle and "channel" on color.');
    expect(err(arc({ angle: 'channel', radius: 0.6 }))).toContain('Layer 1 has a slice for each "channel" and 0.6 on radius.');
    expect(err(arc({ angle: 'channel', radius: 'visitors' }, ['channel'], { sweep: 'half' })))
      .toBe('Layer 1 has sweep: "half" and a slice for each "channel", which goes all the way round. Remove "sweep": it is for a circle divided by color, and for a gauge.');
    expect(err(arc({ angle: 'visitors', radius: 'channel' }, ['channel'], { sweep: 'half' }))).toContain('Layer 1 has sweep: "half" and a ring for each "channel"');
    expect(err(arc({ angle: 'channel', radius: 'visitors', color: 'channel' })))
      .toBe('Layer 1 encodes "channel" on color and has a slice for each "channel", and the slices are drawn in one paint. Remove "color", or set the layer\'s "paint".');
    expect(err(arc({ angle: 'visitors', radius: 'channel', color: 'device' }, ['channel', 'device'])))
      .toBe('Layer 1 has a ring for each "channel" and encodes "device" on color. A ring is painted by its own dimension, for a colour and a legend entry each: encode "channel" on color, or remove it.');
    expect(err(arc({ angle: 0.5, radius: 'channel' })))
      .toBe('Layer 1 has a ring for each "channel" and 0.5 on angle. Put a metric on angle, which each ring\'s arc sweeps to, or leave angle out for the whole ring.');
    expect(err(arc({ angle: 'visitors', radius: 'page' }, ['page'])))
      .toBe('A ring for each "page" makes 8 rings, and a circle has room for 6. Add "limit": 6 to the query, or less.');
    expect(err({ ...arc({ angle: 'channel', radius: 'visitors' }), layers: [{ mark: 'arc', encode: { angle: 'channel', radius: 'visitors' } }, { mark: 'arc', encode: { angle: 'visitors', radius: 'channel' } }] }))
      .toBe('Layer 2 divides the circle again, by "channel", and a circle is divided once. Remove one of the layers that divide it.');
    expect(err(arc({ angle: 'visitors', radius: 1.2 })))
      .toBe('Layer 1 has 1.2 on radius. It takes a number from 0 up to 1, the inner radius as a share of the outer (0.6 makes a donut); a metric, with a dimension on angle, for how far each slice reaches; or a dimension, with a metric on angle, for a ring each.');
  });
  it('for a second ring with nothing to be the ring of', () => {
    const two = ['device', 'channel'];
    expect(err({ ...arc({ angle: 'visitors', detail: 'channel' }, two), layers: [{ mark: 'arc', encode: { angle: 'visitors', detail: 'channel' } }, { mark: 'arc', encode: { angle: 'visitors', color: 'device' } }] }))
      .toBe('Layer 1 encodes "channel" on detail and no dimension on color. A second ring divides the segments of a circle that color has divided: encode the query\'s other dimension on color, or remove "detail".');
    expect(err(arc({ angle: 'device', radius: 'visitors', detail: 'channel' }, two)))
      .toBe('Layer 1 encodes "channel" on detail and has a slice for each "device". A second ring divides the segments of a circle that color has divided: put the metric on angle, "device" on color and "channel" on detail, or remove "detail".');
    const { totalsBy: _totalsBy, ...bare } = runQuery(sunburst!.query);
    expect(err(sunburst!, bare))
      .toBe('Layer 1 divides each "device" by "channel", and a segment\'s span is the engine\'s total for it: this result has no totalsBy. Return it from the query layer, or remove "detail".');
    expect(err(arc({ angle: 'visitors', color: 'device', detail: 'device' }, ['device']))).toContain('a layer is split into series once');
    expect(err({ spec: 'view/0', use: 'sunburst', query: { metrics: ['visitors'], by: ['device'] } })).toBe('The "sunburst" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
    expect(err({ spec: 'view/0', use: 'rose', query: { metrics: ['visitors'] } })).toBe('The "rose" preset needs a dimension in query.by.');
  });
  it('the schema takes a field on radius, and still no number from 1 up', () => {
    expect(view(arc({ angle: 'channel', radius: 'visitors' })), JSON.stringify(view.errors)).toBe(true);
    expect(view(arc({ angle: 'visitors', radius: 'channel' }))).toBe(true);
    expect(view(arc({ angle: 'visitors', color: 'channel', radius: 1 }))).toBe(false);
    expect(view(arc({ angle: 'visitors', color: 'device', detail: 3 }))).toBe(false);
  });
});

describe('the prose ranks rows by comparing them, whatever order they came in', () => {
  it('says the same of rows the engine ranked, and the truth of rows it did not', () => {
    const q = { metrics: ['visitors'], by: ['channel'] }, result = runQuery(q), turned = { ...result, rows: result.rows.slice().reverse() };
    for (const share of [true, false]) expect(tldrProse(q, turned, share, catalog)).toBe(tldrProse(q, result, share, catalog));
    expect(tldrProse(q, turned, true, catalog)).toBe('Search is the largest channel at 41% of visitors, followed by Direct at 28%.');
  });
});

// String work only, as test/dom-radial.test.ts. What the browser makes of it is checked on the bench.
describe('the radial layout paints the new forms', () => {
  const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'radial'), { radial: radial.fit! }), fig = '.uav[data-layout="radial"]:not([data-keep~="guides"])';
  it('the `rim` rule takes the labels away and gives the circle its margin back, before the legend steps down', () => {
    for (const need of ['inline-size < 229.5px', 'block-size < 119.5px'])
      expect(css).toContain('@container uav-view (' + need + ') {\n  ' + fig + ' .uav-rim { display: none; }\n  ' + fig + ' .uav-radial { --uav-rim: 0px; }\n}');
    expect(css.indexOf('inline-size < 229.5px')).toBeLessThan(css.indexOf('inline-size < 71.5px'));
  });
  it('the circle gives up a margin to the labels only where the plan shows them, and has a measured pass to thin them', () => {
    expect(radial.css).toContain('.uav[data-layout="radial"][data-parts~="rim"] .uav-radial { --uav-rim: 14px; }');
    expect(radial.css).toContain('.uav[data-layout="radial"]:not([data-parts~="rim"]) .uav-rim { display: none; }');
    expect(radial.css).toContain('.uav-rim [data-thin] { visibility: hidden; }');
    expect(typeof radial.measure).toBe('function');
  });
  it('arcs that are no point of their own lie in a layer under the points, and one of a second ring wears the outline when chosen', () => {
    expect(radial.css).toContain('.uav-radial svg.uav-under { position: absolute;');
    expect(radial.css).toContain('.uav-radial .uav-under path[data-chosen][data-active="keys"] {');
  });
});
