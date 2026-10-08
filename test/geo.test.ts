import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, customMarks, makeContainer, place, registerMark, resolve, type CircleNode, type PainterName, type PathNode, type Result, type Spec } from '@universal-analytics/core';
import viewSchema from '@universal-analytics/core/schema/view.schema.json';
import { compileFitRules } from '@universal-analytics/dom';
import { catalog, countries, moreSamples, runQuery, scenarios } from '@universal-analytics/fixtures';
import { GEO_RULES, geoMark, type Shapes } from '@universal-analytics/geo';
import { geoPainter } from '@universal-analytics/geo/dom';

// Step 8 of docs/chart-coverage-plan.md: the `geo` mark, which is a custom mark, registered by the fixtures with their
// boundary shapes. No prototype knows it, so it is held to a sweep, facts and golden scenes of its own. The registry
// and `fallback` are in test/registry.test.ts.
const map = moreSamples.map!.spec, symbols = moreSamples.symbols!.spec;
const both: Spec = { ...map, query: { ...map.query, metrics: ['visitors', 'pageviews'] }, layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors', size: 'pageviews' } }] };
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', result: Result = runQuery(spec.query, scenario)) => {
  const container = makeContainer(w, h, painter, 8), plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);
const shapes = (ratio: { nodes: unknown[] }) => (ratio.nodes as PathNode[]).filter((n) => n.part === 'plot' && n.kind === 'path');
const dots = (ratio: { nodes: unknown[] }) => (ratio.nodes as CircleNode[]).filter((n) => n.part === 'points' && n.kind === 'circle');
const ASPECT = 1.886;   // Equal Earth, fitted to the fixture's shapes

describe('the sweep', () => {
  for (const [name, spec] of Object.entries({ map, symbols, both })) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, symbols inside the box, and a part that holds its shape', () => {
      for (const sc of scenarios) for (const p of ['svg', 'dots'] as PainterName[]) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
        for (const n of dots(ratio)) expect(n.x! >= 0 && n.x! <= 1 && n.t! >= 0 && n.t! <= 1 && n.size! >= 1 && n.size! <= 4, 'symbol: ' + at + ' ' + n.key).toBe(true);
        if (plan.layout !== 'geo') continue;
        expect(ratio.aspect, at).toBe(ASPECT);
        expect(scene.plot!.w / scene.plot!.h, 'shape: ' + at).toBeCloseTo(ASPECT, 9);
        expect(scene.plot!.w, 'width: ' + at).toBeLessThanOrEqual(Math.min(w, 480));
        for (const n of scene.nodes) if (n.kind === 'circle') expect(n.cx >= 0 && n.cx <= w && n.cy >= 0 && n.cy <= scene.height, 'outside: ' + at + ' ' + n.key).toBe(true);
      }
    });
  }
  it('one spec is a map with room and the ranked list of its query without: then the number, then the prose', () => {
    for (const [spec, key, lost] of [[map, 'ramp', 'the colour ramp'], [symbols, 'points size', 'the key to sizes']] as [Spec, string, string][]) {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      const drawn = key === 'ramp' ? 'plot' : 'plot points', fell = 'the geo marks (drawn as "bar-list")';
      for (const sc of scenarios) {
        const at = (w: number, h: number | null = null) => { const { plan, ratio } = run(spec, w, h, sc); return [plan.layout, ratio.parts.join(' '), plan.dropped.join('; ')]; };
        if (sc === 'empty') { expect([346, 250, 120, 10].map((w) => at(w)[0])).toEqual(['notice', 'notice', 'none', 'prose']); continue; }
        expect(at(700)).toEqual(['geo', 'plot ' + key, '']);
        expect(at(346)).toEqual(['geo', 'plot ' + key, '']);        // dashboard width
        expect(at(319)).toEqual(['geo', drawn, lost]);
        expect(at(346, 169)).toEqual(['geo', drawn, lost]);
        expect(at(280)).toEqual(['geo', drawn, lost]);
        expect(at(279)).toEqual(['rows', 'rows', fell]);
        expect(at(250)).toEqual(['rows', 'rows', fell]);            // sidebar width
        expect(at(346, 119)).toEqual(['rows', 'rows', fell + '; rows 4 to 15']);
        expect(at(120)).toEqual(['none', 'number', fell + '; all marks (kept the number)']);
        expect(at(10)[0]).toBe('prose');
      }
    }
  });
  it('the list it becomes is the bar-list of the same query, to the node, and a spec that keeps its marks does not become one', () => {
    const list: Spec = { spec: 'view/0', title: map.title, use: 'bar-list', query: map.query };
    for (const [w, h] of [[250, null], [170, null], [346, 100], [80, null]] as [number, number | null][]) {
      expect(run(map, w, h).scene, w + ' ' + h).toEqual(run(list, w, h).scene);
      expect(run(map, w, h).plan.preset).toBe('bar-list');
    }
    // `keep` switches the rule off, so there is no list. What resolve() does then is what it does for any layout whose
    // kept marks are short of room: it tries the steps that are left, and ends at the prose (dom-painter-plan, section 2, to settle).
    expect(run({ ...map, keep: ['marks'] }, 250).plan).toMatchObject({ layout: 'prose', preset: null });
    expect(run({ ...map, keep: ['marks'] }, 346).plan).toMatchObject({ layout: 'geo', preset: null, dropped: [] });
  });
});

describe('golden scenes', () => {
  for (const [w, h] of [[346, null], [300, null], [250, null]] as [number, number | null][]) it(`map at ${w} by ${h ?? 'any'}`, () => expect(run(map, w, h).scene).toMatchSnapshot());
  for (const [w, h] of [[346, null], [250, 100]] as [number, number | null][]) it(`symbols at ${w} by ${h ?? 'any'}`, () => expect(run(symbols, w, h).scene).toMatchSnapshot());
});

describe('the fixture: visitors by country', () => {
  it('answers with a row per country, ranked, and every one of them is the id of a boundary shape', () => {
    const { rows, totals } = runQuery(map.query), ids = countries.features.map((f) => f.id);
    expect(rows.length).toBe(15);
    expect(rows.slice(0, 3).map((r) => r.country)).toEqual(['United States', 'India', 'United Kingdom']);
    expect(rows.every((r) => ids.includes(r.country as string))).toBe(true);
    expect(Math.abs(rows.reduce((s, r) => s + (r.visitors as number), 0) - totals.visitors!)).toBeLessThanOrEqual(8);
  });
  it('the shapes are a small fixture: every feature has an id, and the file is not a large one', () => {
    expect(countries.features.length).toBe(123);
    expect(new Set(countries.features.map((f) => f.id)).size).toBe(123);
    expect(JSON.stringify(countries).length).toBeLessThan(30000);
  });
});

describe('geo, filled by a metric', () => {
  const { ratio, result, plan } = run(map, 346);
  it('is a custom mark, laid out under its own name, and core knows it only through the registry', () => {
    expect(customMarks().has('geo')).toBe(true);
    expect([plan.layout, ratio.layout, plan.preset]).toEqual(['geo', 'geo', null]);
  });
  it('draws every shape handed in, in the shapes\' order whatever the ranking, each a path in a box 100 wide', () => {
    expect(shapes(ratio).map((n) => n.key)).toEqual(countries.features.map((f) => 'primary:geo:' + f.id));
    expect(shapes(ratio).every((n) => n.fill && n.layer === 'data' && n.role === 'primary' && /^M[\d.,LMZ]+Z$/.test(n.d!))).toBe(true);
    const xs = shapes(ratio).flatMap((n) => n.d!.match(/[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 0)), ys = shapes(ratio).flatMap((n) => n.d!.match(/[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 1));
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys)]).toEqual([0, 100, 0]);
    expect(Math.max(...ys)).toBeCloseTo(100 / ASPECT, 1);
    const turned = { ...result, rows: result.rows.slice().reverse() };
    expect(shapes(run(map, 346, null, 'typical', 'svg', turned).ratio)).toEqual(shapes(ratio));
  });
  it('quantizes each region to the seven steps of the ramp, between the least and the most of the regions drawn, and never carries a colour', () => {
    const value = (n: PathNode) => result.rows.find((r) => r.country === n.row)!.visitors as number, drawn = shapes(ratio).filter((n) => n.row != null);
    const vals = drawn.map(value), lo = Math.min(...vals), hi = Math.max(...vals);
    expect(drawn.length).toBe(15);
    for (const n of drawn) expect(n.paint, n.key).toBe('seq.' + Math.min(7, 1 + Math.floor(((value(n) - lo) / (hi - lo)) * 7)));
    expect(shapes(ratio).every((n) => /^seq\.([1-7]|none)$/.test(n.paint))).toBe(true);
  });
  it('paints a region the result has no row for seq.none, and it has no row to be chosen by', () => {
    const none = shapes(ratio).filter((n) => n.paint === 'seq.none');
    expect(none.length).toBe(123 - 15);
    expect(none.every((n) => n.row == null)).toBe(true);
    const nulled = { ...result, rows: result.rows.map((r) => (r.country === 'India' ? { ...r, visitors: null } : r)) };
    expect(shapes(run(map, 346, null, 'typical', 'svg', nulled).ratio).find((n) => n.key === 'primary:geo:India')).toMatchObject({ paint: 'seq.none', row: 'India' });
  });
  it('its rows are the result\'s, in the result\'s order, which is the list a reader steps through', () => {
    expect(ratio.rows).toEqual(result.rows.map((r) => r.country));
    // A value no shape has is still a row, and in the table. It is not on the map.
    const more = { ...result, rows: [...result.rows, { country: 'Atlantis', visitors: 12 }] }, scene = run(map, 346, null, 'typical', 'svg', more).ratio;
    expect(scene.rows!.slice(-1)).toEqual(['Atlantis']);
    expect(scene.nodes.some((n) => n.key.includes('Atlantis'))).toBe(false);
  });
  it('has the ramp a grid has: the low value, a swatch for each step, the high value, and no data', () => {
    expect(ratio.nodes.filter((n) => n.part === 'ramp').map((n) => n.key)).toEqual(['ramp:low', 'ramp:1', 'ramp:2', 'ramp:3', 'ramp:4', 'ramp:5', 'ramp:6', 'ramp:7', 'ramp:high', 'ramp:none', 'ramp:none:label']);
    expect((ratio.nodes.filter((n) => n.part === 'ramp' && n.kind === 'text') as { text: string }[]).map((n) => n.text)).toEqual(['105', '3.3k', 'No data']);
    // The scene holds it whether or not the plan shows it.
    expect(run(map, 300).ratio.nodes.filter((n) => n.part === 'ramp').length).toBe(11);
  });
  it('place() fits a box of the shapes\' aspect inside the room, in the middle, and sets the ramp under it', () => {
    const wide = run(map, 346).scene, boxed = run(map, 346, 160).scene, most = run(map, 700).scene;
    expect([wide.plot!.w, wide.height]).toEqual([346, Math.ceil(346 / ASPECT + 24)]);
    expect([boxed.plot!.h, boxed.height, boxed.nodes.some((n) => n.key.startsWith('ramp:'))]).toEqual([160, 160, false]);
    expect(most.plot!.w).toBe(480);
    const us = (s: typeof wide) => s.nodes.find((n) => n.key === 'primary:geo:United States') as unknown as { d: string; tx?: number; fill: boolean };
    expect([us(wide).tx, us(most).tx, us(boxed).tx]).toEqual([undefined, 110, (346 - 160 * ASPECT) / 2]);
    // The same path, at 3.46 times the size.
    const at = (d: string) => d.match(/[\d.]+/g)!.map(Number), d0 = at(shapes(run(map, 346).ratio).find((n) => n.row === 'United States')!.d!);
    at(us(wide).d).forEach((n, i) => expect(n).toBeCloseTo(d0[i]! * 3.46, 1));
    expect(wide.nodes.find((n) => n.key === 'ramp:1')).toMatchObject({ ty: 346 / ASPECT, y: 8 });
  });
});

describe('geo, with a symbol for each region', () => {
  const { ratio, result } = run(symbols, 346);
  it('stands a symbol at the centroid of each region the result has a row for, in a dot\'s four size steps, by area', () => {
    const top = Math.max(...result.rows.map((r) => r.pageviews as number));
    expect(dots(ratio).length).toBe(15);
    for (const n of dots(ratio)) expect(n.size, n.key).toBe(Math.min(4, Math.max(1, Math.ceil(Math.sqrt((result.rows.find((r) => r.country === n.row)!.pageviews as number) / top) * 4))));
    expect(dots(ratio).find((n) => n.row === 'United States')).toMatchObject({ key: 'primary:geo:United States:symbol', size: 4, paint: 'series.1', opacity: 0.7, layer: 'data', role: 'primary' });
    // Brazil is south of the equator and west of Greenwich; Australia is east of both.
    const at = (k: string) => dots(ratio).find((n) => n.row === k)!;
    expect(at('Brazil').x! < 0.5 && at('Brazil').t! < 0.5 && at('Australia').x! > 0.5 && at('Australia').t! < at('Brazil').t! + 0.2).toBe(true);
  });
  it('the regions are the ground they stand on: every shape in the tone of no value, as context', () => {
    expect(shapes(ratio).length).toBe(123);
    expect(shapes(ratio).every((n) => n.paint === 'seq.none' && n.layer === 'guide' && n.role === 'context')).toBe(true);
    expect(shapes(ratio).filter((n) => n.row != null).length).toBe(15);
  });
  it('has the key to sizes a plot has, and place() sets a symbol by its step', () => {
    expect((ratio.nodes.filter((n) => n.part === 'size' && n.kind === 'text') as { text: string }[]).map((n) => n.text)).toEqual(['Page views', '486', '1.9k', '4.4k', '7.8k']);
    const { scene } = run(symbols, 346), us = scene.nodes.find((n) => n.key === 'primary:geo:United States:symbol') as unknown as { cx: number; cy: number; r: number };
    const node = dots(ratio).find((n) => n.row === 'United States')!;
    expect(us).toMatchObject({ r: 12, cx: node.x! * 346, cy: (1 - node.t!) * 346 / ASPECT });
    expect(scene.height).toBe(Math.ceil(346 / ASPECT + 28));
  });
  it('one layer may fill by one metric and size by another, and then it has both keys', () => {
    const { ratio, plan } = run(both, 346);
    expect(ratio.parts).toEqual(['plot', 'points', 'ramp', 'size']);
    expect([shapes(ratio).filter((n) => /seq\.[1-7]/.test(n.paint)).length, dots(ratio).length]).toEqual([15, 15]);
    expect(plan.dropped).toEqual([]);
    expect(run(both, 300).ratio.parts).toEqual(['plot', 'points']);
  });
});

describe('prose, the number and errors', () => {
  it('says what the ranked list says: the top regions by the metric', () => {
    expect(run(map, 346).plan.text).toBe('Top countries by visitors, last 28 days: United States (3,265), India (1,264), United Kingdom (948).');
    expect(run(map, 250).plan.text).toBe(run(map, 346).plan.text);
    expect(run(map, 346, null, 'empty').plan.text).toBe('No visitors recorded in the last 28 days.');
    expect((run(map, 120).ratio.nodes.find((n) => n.key === 'sub') as { text: string }).text).toBe('Top: United States');
  });
  it('errors name the fix: no dimension on x, no metric to draw by, more than one layer, and values that join to no shape', () => {
    const q = map.query, of = (layers: Spec['layers'], query = q) => err(() => run({ spec: 'view/0', query, layers }, 346));
    expect(of([{ mark: 'geo', encode: { color: 'visitors' } }])).toBe('A "geo" layer needs the dimension whose values are region keys on x, and this one has undefined there. Encode one of the query\'s dimensions on x: country.');
    expect(of([{ mark: 'geo', encode: { x: 'country' } }])).toBe('A "geo" layer needs a metric on color, to fill each region by, or on size, for a symbol on each, and this one has undefined on color and undefined on size. Encode one of the query\'s metrics: visitors.');
    expect(of([{ mark: 'geo', encode: { x: 'country', color: 'country' } }])).toMatch(/^A "geo" layer needs a metric on color/);
    expect(of([{ mark: 'geo', encode: { x: 'country', size: 'country' } }])).toMatch(/^Layer 1 encodes "country" on size, and a size is a quantity\./);
    expect(of([...map.layers!, ...map.layers!])).toBe('A map draws one "geo" layer, and this view has 2. Put the metric to fill by on color and the metric for symbols on size, in one layer.');
    expect(of([...map.layers!, { mark: 'bar', encode: { x: 'country', y: 'visitors' } }])).toBe('The "geo" mark is laid out by its own code, and layer 2 is a "bar". Keep the "geo" layers alone, and draw the others as a view of their own.');
    expect(of([{ mark: 'geo', encode: { x: 'page', color: 'pageviews' } }], { metrics: ['pageviews'], by: ['page'] }))
      .toBe('None of the 8 values of "page" is the id of a boundary shape. The first is "/", and the shapes have "Tanzania", "W. Sahara", "Canada" and 120 more. Hand geoMark() shapes whose ids are the values of the dimension.');
  });
  it('the shapes are an input: a mark made from other shapes draws those, and shapes that are not shapes are an error', () => {
    const two: Shapes = { type: 'FeatureCollection', features: countries.features.filter((f) => f.id === 'Brazil' || f.id === 'Argentina') };
    registerMark('south', geoMark(two));
    const spec: Spec = { ...map, layers: [{ mark: 'south', encode: { x: 'country', color: 'visitors' } }] }, result = runQuery(spec.query);
    const scene = buildScene(resolve(spec, result, makeContainer(700), catalog), spec.query, result, catalog);
    expect(shapes(scene).map((n) => [n.key, n.paint])).toEqual([['primary:south:Argentina', 'seq.none'], ['primary:south:Brazil', 'seq.7']]);
    expect(scene.aspect).toBeLessThan(1);
    const bad = 'The geo mark needs boundary shapes: a GeoJSON FeatureCollection in which every feature has an "id", the value the region\'s dimension has for it. Hand one to geoMark() or registerGeo().';
    expect(err(() => geoMark({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null }] }))).toBe(bad);
    expect(err(() => geoMark({ type: 'Topology', features: [] }))).toBe(bad);
  });
});

describe('the painter\'s half, as strings', () => {
  it('is the layout of the mark\'s name, with the mark\'s own rules, and its part holds the scene\'s aspect', () => {
    expect([geoPainter.layout, geoPainter.rules]).toEqual(['geo', GEO_RULES]);
    expect(geoPainter.css).toContain('.vg[data-layout="geo"] .vg-plot { flex: none; align-self: center; inline-size: min(100%, 480px); aspect-ratio: var(--vg-aspect, 2);');
  });
  it('its rules compile to the keys going, and then to the swap for the ranked list, by width and by height', () => {
    const css = compileFitRules(GEO_RULES, { geo: geoPainter.fit ?? {} }), fig = (keep: string) => '.vg[data-layout="geo"]:not([data-keep~="' + keep + '"])';
    expect(css).toContain('@container view (inline-size < 320px) {\n  ' + fig('guides') + ' :is(.vg-ramp, .vg-size) { display: none; }\n}');
    expect(css).toContain('@container view (block-size < 170px) {\n  ' + fig('guides') + ' :is(.vg-ramp, .vg-size) { display: none; }\n}');
    const swap = '  ' + fig('marks') + ' { display: none; }\n  ' + fig('marks') + ' ~ .vg-fallback { display: block; }\n}';
    expect(css).toContain('@container view (inline-size < 280px) {\n' + swap);
    expect(css).toContain('@container view (block-size < 120px) {\n' + swap);
  });
});
