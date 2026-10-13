import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { FIT_RULES, applies, arcD, buildScene, expand, makeContainer, place, resolve, type ArcNode, type PainterName, type Spec } from '@unified-analytics/core';
import catalogSchema from '@unified-analytics/core/schema/catalog.schema.json';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';

// Step 6 of docs/chart-coverage-plan.md: the `arc` mark and the `radial` layout. It has no prototype to match, so it
// is held to its own sweep, facts and golden scenes, as test/coverage.test.ts holds the plots.
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg') => {
  const container = makeContainer(w, h, painter, 8), result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (s: Spec, c = catalog) => { try { resolve(s, runQuery(s.query), makeContainer(346), c); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);
const specs = Object.fromEntries(['donut', 'pie', 'half', 'gauge'].map((k) => [k, moreSamples[k]!.spec]));
const { donut, pie, half, gauge } = specs as Record<string, Spec>;
const arcs = (spec: Spec, w = 346) => run(spec, w).ratio.nodes.filter((n): n is ArcNode => n.kind === 'arc');
const round = (n: number) => Math.round(n * 1000) / 1000;

describe('the sweep, about a centre', () => {
  const painters: PainterName[] = ['svg', 'dots'], heights = [null, 300, 160, 100, 60, 40], widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, arcs inside their sweep, and a part that holds its shape', () => {
      const [from, to] = name === 'half' || name === 'gauge' ? [-0.25, 0.25] : [0, 1];
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
        for (const n of ratio.nodes) if (n.kind === 'arc') {
          expect(n.a0 >= from && n.a0 <= n.a1 && n.a1 <= to && n.r0 >= 0 && n.r0 < n.r1 && n.r1 <= 1, 'arc: ' + at + ' ' + n.key).toBe(true);
          expect(n.d, at).toBe(arcD(n));
        }
        if (plan.layout !== 'radial') continue;
        // A square, or half of one, inside the width and never stretched to it.
        expect(scene.plot!.w / scene.plot!.h, 'shape: ' + at).toBe(ratio.aspect);
        expect(scene.plot!.w, 'width: ' + at).toBeLessThanOrEqual(Math.min(w, 160));
      }
    });
    it(name + ': resolves in every data state, and steps down to the number and then the prose', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) {
        // 10 px is narrower than any number, "0" included.
        expect([346, 120, 10].map((w) => run(spec, w, null, sc).plan.layout), sc).toEqual(sc === 'empty' ? ['notice', 'none', 'prose'] : ['radial', 'radial', 'prose']);
        if (sc !== 'empty') expect(run(spec, 346, 60, sc).plan, sc).toMatchObject({ layout: 'none', tldrValue: true });
        expect(run(spec, 700, null, sc).plan.dropped, sc).toEqual([]);
      }
    });
  }
});

describe('golden scenes', () => {
  const sizes: [number, number | null][] = [[346, null], [150, null], [346, 100]];
  for (const name of Object.keys(specs)) for (const [w, h] of sizes) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
  it('the donut\'s ratio scene', () => expect(run(donut!, 346).ratio).toMatchSnapshot());
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
    expect(plan.text).toBe('Search is the largest channel at 41% of visitors, followed by Direct at 28%.');
  });
  it('the legend is the band\'s, node for node', () => {
    const legend = (spec: Spec) => run(spec, 346).ratio.nodes.filter((n) => n.part === 'legend' || n.part === 'legend-top');
    expect(legend(pie!)).toEqual(legend(samples.mix!.spec));
  });
  it('sweep: "half" runs over the top, from the left to the right, in a part twice as wide as it is tall', () => {
    const segs = arcs(half!);
    expect(run(half!, 346).ratio.aspect).toBe(2);
    expect([segs[0]!.a0, round(segs[2]!.a1)]).toEqual([-0.25, 0.246]);
    expect(run(half!, 346).scene.plot).toEqual({ w: 160, h: 80 });
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
    const over = buildScene(resolve(gauge!, result, makeContainer(346), tight), gauge!.query, result, tight).nodes.filter((n): n is ArcNode => n.kind === 'arc');
    expect([over[1]!.a1, over[2]!.a1]).toEqual([0.25, 0.25]);
  });
  it('place() draws each arc at its own radius about the middle of the part', () => {
    const { scene, ratio } = run(donut!, 250), seg = scene.nodes.find((n) => n.key === 'primary:arc:Desktop')!;
    expect(seg).toMatchObject({ kind: 'path', fill: true, tx: 125, ty: 80, paint: 'series.1', d: arcD(ratio.nodes.find((n): n is ArcNode => n.key === 'primary:arc:Desktop')!, 80) });
  });
});

describe('fit rules', () => {
  const rule = (id: string) => FIT_RULES.find((r) => r.layout === 'radial' && r.id === id)!;
  const at = (spec: Spec, w: number, h: number | null = null) => { const { plan, ratio, scene } = run(spec, w, h); return { layout: plan.layout, parts: ratio.parts, dropped: plan.dropped, hole: scene.nodes.some((n) => n.key === 'hole'), plot: scene.plot }; };
  it('the legend steps down as the band\'s does, and then to nothing', () => {
    const steps = (spec: Spec, sizes: [number, number | null][]) => sizes.map(([w, h]) => { const g = run(spec, w, h).plan; return g.layout === 'radial' || g.layout === 'band' ? g.guides.legend ?? 'none' : g.layout; });
    expect(steps(donut!, [[346, null], [169, null], [346, 100], [346, 87], [346, 63]])).toEqual(['full', 'top', 'top', 'none', 'none']);
    // The share bar at the same widths, which has no step with no legend.
    expect(steps(samples.mix!.spec, [[346, null], [169, null]])).toEqual(['full', 'top']);
    expect(at(donut!, 169).dropped).toEqual(['the legend, except the largest segment']);
    expect(at(pie!, 346, 87)).toMatchObject({ parts: ['radial'], dropped: ['the legend'], plot: { w: 87, h: 87 } });
    for (const [w, h] of [[346, null], [169, null], [346, 100], [346, 87], [100, 70]] as [number, number | null][]) {
      const { parts } = at(donut!, w, h);
      expect(parts.includes('legend') && applies(rule('legend'), { view: { inline: w, block: h } }), 'legend ' + w + ' ' + h).toBe(false);
      expect(parts.some((p) => p.startsWith('legend')) && applies(rule('legend-top'), { view: { inline: w, block: h } }), 'legend-top ' + w + ' ' + h).toBe(false);
    }
  });
  it('in a donut the number sits in the hole, by the `hole` rule and no field of the spec', () => {
    expect(expand(donut!).layers).toEqual([{ mark: 'arc', encode: { angle: 'visitors', color: 'device', radius: 0.6 } }]);
    const hole = run(donut!, 346).scene.nodes.find((n) => n.key === 'hole')!;
    expect(hole).toMatchObject({ kind: 'text', text: '10.5k', anchor: 'middle', font: 'display', x: 173, y: 68, h: 24 });
    // Five digits of the small face are 73 px wide, and their corners are inside the hole from 129 px across.
    expect(at(donut!, 129)).toMatchObject({ hole: true, dropped: ['the legend, except the largest segment'] });
    expect(at(donut!, 128)).toMatchObject({ hole: false, parts: ['radial', 'hole', 'legend-top'], dropped: ['the legend, except the largest segment', 'the number in the hole'] });
    // Three are inside it sooner, and the rule is then what takes the number out.
    expect([120, 119].map((w) => at(gauge!, w).hole)).toEqual([true, false]);
    expect(applies(rule('hole'), { view: { inline: 119 }, plot: { inline: 119, block: 60 } })).toBe(true);
    // A pie has no hole, and a number above the circle is not said twice.
    expect(at(pie!, 346)).toMatchObject({ hole: false, parts: ['radial', 'legend'], dropped: [] });
    const always = { ...makeContainer(346), rules: { ...makeContainer(346).rules, tldrValue: { above: 'always' as const } } }, result = runQuery(donut!.query);
    expect(buildScene(resolve(donut!, result, always, catalog), donut!.query, result, catalog).parts).toEqual(['number', 'radial', 'legend']);
    // In the dot face the number is wider than the hole, so it is left out by its own width.
    expect(run(donut!, 346, null, 'typical', 'dots').scene.nodes.some((n) => n.key === 'hole')).toBe(false);
  });
  it('below the marks need the number alone, and then the prose', () => {
    expect(at(donut!, 346, 63)).toMatchObject({ layout: 'none', dropped: ['the legend', 'all marks (kept the number)'] });
    expect(at(donut!, 71, 200).layout).not.toBe('radial');
    expect(at(donut!, 10).layout).toBe('prose');
    expect(at({ ...donut!, keep: ['guides'] }, 346, 100).layout).toBe('none');   // the legend is kept, so the marks go with it
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
    expect(err(arc({ angle: 'visitors', color: 'channel', radius: 1.2 }))).toBe('Layer 1 has 1.2 on radius. It takes a number from 0 up to 1: the inner radius, as a share of the outer. 0.6 makes a donut.');
    expect(err({ ...arc({ angle: 'visitors', color: 'channel' }), layers: [{ mark: 'arc', encode: { angle: 'visitors', color: 'channel' } }, { mark: 'bar', encode: { x: 'visitors' } }] }))
      .toBe('The "bar" mark has no rule about a centre yet. Use arc or unit, or take "angle" off the other layers.');
    expect(err({ ...arc({ angle: 'visitors', color: 'page' }), query: { metrics: ['visitors'], by: ['page'] } }))
      .toBe('Splitting by "page" makes 8 segments, and there are 6 series colours. Add "limit": 6 to the query, or less.');
    expect(err({ spec: 'view/0', query: { metrics: ['visitors'] }, layers: [{ mark: 'arc', encode: { angle: 'visitors' } }] }))
      .toBe('Layer 1 reads "visitors" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the circle by it.');
    expect(err(arc({ angle: 'channel', color: 'channel' }))).toBe('Layer 1 splits by "channel" with "channel" on angle. Put a metric on angle: each segment is its share of that metric\'s total.');
    expect(err({ spec: 'view/0', use: 'pie', query: { metrics: ['visitors'] } })).toBe('The "pie" preset needs a dimension in query.by.');
    expect(err({ spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'] }, layers: [{ mark: 'arc', encode: { x: 'channel', y: 'visitors' } }] }))
      .toBe('The "arc" mark has no rule for a time or category axis yet. Use line, area, bar, rule, dot, text, tick or unit.');
  });
});
