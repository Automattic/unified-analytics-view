import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, customMarks, customPresets, expand, makeContainer, place, resolve, type CircleNode, type PainterName, type PathNode, type Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, countries, moreSamples, runQuery, scenarios, tiles } from '@unified-analytics/fixtures';
import { GEO_RULES, geoMark, geoRules, registerGeo } from '@unified-analytics/geo';
import { geoPainter, geoPainterAs } from '@unified-analytics/geo/dom';

// Step 10 of docs/uncommon-coverage-plan.md: tile maps. No new mark: the `geo` mark, registered again by the fixtures
// under a name for each of two files of tiles. The mark itself is held in test/geo.test.ts, and what is held here is
// what tiles add: shapes on a flat sheet, a mark under another name, and the two samples.
const grid = moreSamples.tiles!.spec, hex = moreSamples.hexes!.spec, map = moreSamples.map!.spec;
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg') => {
  const result = runQuery(spec.query, scenario), container = makeContainer(w, h, painter, 8), plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const view = new Ajv().compile(viewSchema);
const shapes = (ratio: { nodes: unknown[] }) => (ratio.nodes as PathNode[]).filter((n) => n.part === 'plot' && n.kind === 'path');
/** The corners of a path of moves and lines. It is closed by a Z, so the first is not said again. */
const corners = (d: string) => { const n = d.match(/-?[\d.]+/g)!.map(Number); return Array.from({ length: n.length / 2 }, (_, i) => [n[i * 2]!, n[i * 2 + 1]!] as const); };
const sides = (d: string) => corners(d).map(([x, y], i, all) => Math.hypot(x - all[(i + 1) % all.length]![0], y - all[(i + 1) % all.length]![1]));
const ASPECT = { tiles: 22 / 13, hexes: 22.5 / (13 * Math.sqrt(3) / 2 + 2 / Math.sqrt(3)) };   // the sheets the script lays out
const LAYOUT = { tiles: 'geo-tiles', hexes: 'geo-hexes' };

describe('the sweep', () => {
  for (const [name, spec] of Object.entries({ tiles: grid, hexes: hex })) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, and a part that holds its shape', () => {
      for (const sc of scenarios) for (const p of ['svg', 'dots'] as PainterName[]) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        if (plan.layout !== LAYOUT[name as 'tiles']) continue;
        expect(ratio.aspect, at).toBeCloseTo(ASPECT[name as 'tiles'], 2);
        expect(scene.plot!.w / scene.plot!.h, 'shape: ' + at).toBeCloseTo(ratio.aspect!, 9);
        expect(scene.plot!.w, 'width: ' + at).toBeLessThanOrEqual(Math.min(w, 480));
      }
    });
  }
  it('one spec is a tile map with room and the ranked list of its query without, at the widths and heights a map of countries turns at', () => {
    for (const [spec, layout] of [[grid, 'geo-tiles'], [hex, 'geo-hexes']] as [Spec, string][]) {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      const fell = 'the ' + layout + ' marks (drawn as "bar-list")';
      for (const sc of scenarios) {
        const at = (w: number, h: number | null = null) => { const { plan, ratio } = run(spec, w, h, sc); return [plan.layout, ratio.parts.join(' '), plan.dropped.join('; ')]; };
        if (sc === 'empty') { expect([346, 250, 120, 10].map((w) => at(w)[0])).toEqual(['notice', 'notice', 'none', 'prose']); continue; }
        expect(at(700)).toEqual([layout, 'plot ramp', '']);
        expect(at(346)).toEqual([layout, 'plot ramp', '']);         // dashboard width
        expect(at(319)).toEqual([layout, 'plot', 'the colour ramp']);
        expect(at(280)).toEqual([layout, 'plot', 'the colour ramp']);
        expect(at(279)).toEqual(['rows', 'rows', fell]);
        expect(at(250)).toEqual(['rows', 'rows', fell]);            // sidebar width
        expect(at(346, 119)).toEqual(['rows', 'rows', fell + '; rows 4 to 15']);
        expect(at(120)).toEqual(['none', 'number', fell + '; all marks (kept the number)']);
        expect(at(10)[0]).toBe('prose');
      }
    }
  });
  it('the list it becomes is the bar-list of the same query, to the node: the one the map of countries becomes', () => {
    const list: Spec = { spec: 'view/0', title: grid.title, use: 'bar-list', query: grid.query };
    for (const spec of [grid, hex]) for (const [w, h] of [[250, null], [170, null], [346, 100], [80, null]] as [number, number | null][]) {
      expect(run(spec, w, h).scene, w + ' ' + h).toEqual(run(list, w, h).scene);
      expect(run(spec, w, h).scene).toEqual(run(map, w, h).scene);
    }
    expect(run(grid, 346).plan.text).toBe(run(map, 346).plan.text);
  });
});

describe('golden scenes', () => {
  for (const [w, h] of [[346, null], [300, null], [250, null]] as [number, number | null][]) it(`tiles at ${w} by ${h ?? 'any'}`, () => expect(run(grid, w, h).scene).toMatchSnapshot());
  for (const [w, h] of [[346, null], [346, 160]] as [number, number | null][]) it(`hexes at ${w} by ${h ?? 'any'}`, () => expect(run(hex, w, h).scene).toMatchSnapshot());
});

describe('the fixture: the countries as tiles', () => {
  const coded = countries.features.filter((f) => f.id != null);
  it('has a tile for every country that has a code, under the same id and name, and none for the one that has not', () => {
    for (const set of [tiles.square, tiles.hex]) {
      expect(set.features.length).toBe(122);
      expect(new Map(set.features.map((f) => [f.id, f.properties!.name]))).toEqual(new Map(coded.map((f) => [f.id, f.properties!.name])));
      expect([set.planar, set.keys]).toEqual([true, countries.keys]);
    }
    expect(countries.planar).toBeUndefined();
  });
  it('every row of the country fixture has a tile, so nothing is left out and no note is drawn', () => {
    for (const spec of [grid, hex]) {
      const { ratio, result } = run(spec, 346);
      expect(shapes(ratio).filter((n) => n.row != null).map((n) => n.row).sort()).toEqual(result.rows.map((r) => r.country as string).sort());
      expect(ratio.nodes.some((n) => n.part === 'note')).toBe(false);
    }
  });
  it('no two tiles are in one place, and the files are small', () => {
    for (const set of [tiles.square, tiles.hex]) expect(new Set(set.features.map((f) => JSON.stringify(f.geometry!.coordinates))).size).toBe(122);
    expect([JSON.stringify(tiles.square).length < 18000, JSON.stringify(tiles.hex).length < 24000]).toEqual([true, true]);
  });
  it('a country is near its place: North America in the west, Europe over Africa, and Australia in the south-east', () => {
    for (const set of [tiles.square, tiles.hex]) {
      const at = (id: string) => (set.features.find((f) => f.id === id)!.geometry!.coordinates as number[][][])[0]![0]!;
      const west = (a: string, b: string) => at(a)[0]! < at(b)[0]!, north = (a: string, b: string) => at(a)[1]! < at(b)[1]!;
      expect([west('US', 'GB'), west('GB', 'IN'), west('IN', 'JP'), north('CA', 'US'), north('US', 'MX'), north('FR', 'NG'), north('NG', 'ZA'), north('JP', 'AU'), west('BR', 'ZA'), north('BR', 'AR')]).toEqual(Array(10).fill(true));
    }
  });
});

describe('tiles are drawn as they are, with no map projection', () => {
  it('a square is a square and every one the same size, in the box and in pixels', () => {
    const { ratio, scene } = run(grid, 346), side = 100 / 22;
    expect(shapes(ratio).length).toBe(122);
    for (const n of shapes(ratio)) { expect(corners(n.d!).length, n.key).toBe(4); for (const s of sides(n.d!).slice(0, 4)) expect(s, n.key).toBeCloseTo(side, 1); }
    // Greenland's tile is the sixth along the top row of the sheet, and it is where the file puts it.
    expect(corners(shapes(ratio).find((n) => n.key === 'primary:geo-tiles:GL')!.d!)[0]!.map((v) => +(v / side).toFixed(2))).toEqual((tiles.square.features.find((f) => f.id === 'GL')!.geometry!.coordinates as number[][][])[0]![0]);
    const placed = scene.nodes.filter((n) => n.kind === 'path') as unknown as { d: string }[];
    for (const n of placed) for (const s of sides(n.d).slice(0, 4)) expect(s).toBeCloseTo(346 / 22, 1);
  });
  it('a hexagon is regular: six sides of one length, and as wide as a square tile is', () => {
    const { ratio } = run(hex, 346), across = 100 / 22.5;
    for (const n of shapes(ratio)) {
      const c = corners(n.d!).slice(0, 6), xs = c.map((p) => p[0]);
      expect(corners(n.d!).length, n.key).toBe(6);
      for (const s of sides(n.d!).slice(0, 6)) expect(s, n.key).toBeCloseTo(across / Math.sqrt(3), 1);
      expect(Math.max(...xs) - Math.min(...xs), n.key).toBeCloseTo(across, 1);
    }
  });
  it('the box is the sheet\'s own shape, and place() never stretches it', () => {
    for (const [spec, name] of [[grid, 'tiles'], [hex, 'hexes']] as [Spec, 'tiles' | 'hexes'][]) for (const [w, h] of [[346, null], [700, null], [346, 160], [500, 200]] as [number, number | null][]) {
      const { scene } = run(spec, w, h);
      expect(scene.plot!.w / scene.plot!.h, name + ' ' + w + ' ' + h).toBeCloseTo(ASPECT[name], 2);
    }
    expect(run(grid, 700).scene.plot!.w).toBe(480);
  });
  it('is filled as a map is: the ten steps of the ramp, a ramp under it, tokens and never a colour', () => {
    for (const spec of [grid, hex]) {
      const { ratio } = run(spec, 346), filled = shapes(run(map, 346).ratio).filter((n) => n.row != null);
      expect(shapes(ratio).every((n) => /^seq\.(\d+|none)$/.test(n.paint))).toBe(true);
      // A country is the step it is on the map of countries.
      expect(new Map(shapes(ratio).filter((n) => n.row != null).map((n) => [n.row, n.paint]))).toEqual(new Map(filled.map((n) => [n.row, n.paint])));
      expect(shapes(ratio).filter((n) => n.paint === 'seq.none').length).toBe(122 - 15);
      expect(ratio.parts).toEqual(['plot', 'ramp']);
    }
  });
});

describe('the same mark under another name', () => {
  it('is a custom mark for each set of shapes, and the map of countries is still `geo`', () => {
    expect([...customMarks().keys()].filter((k) => k.startsWith('geo'))).toEqual(['geo', 'geo-tiles', 'geo-hexes']);
    expect([run(grid, 346).plan.layout, run(hex, 346).plan.layout, run(map, 346).plan.layout]).toEqual(['geo-tiles', 'geo-hexes', 'geo']);
    expect(shapes(run(map, 346).ratio).length).toBe(123);
  });
  it('its presets are the ones the page names, and each is the layers written out', () => {
    expect([...customPresets().keys()]).toEqual(['choropleth', 'symbol-map', 'sankey', 'tile-grid-map', 'hex-tile-map', 'treemap', 'pair-list']);
    expect(expand(grid).layers).toEqual([{ mark: 'geo-tiles', encode: { x: 'country', color: 'visitors' } }]);
    expect(expand(hex).layers).toEqual([{ mark: 'geo-hexes', encode: { x: 'country', color: 'visitors' } }]);
    expect([run(grid, 346).plan.preset, run(hex, 346).plan.preset]).toEqual(['tile-grid-map', 'hex-tile-map']);
    // Under a name of its own it registers only the presets it is given: none, or either.
    registerGeo(tiles.square, { name: 'bare-tiles' });
    registerGeo(tiles.square, { name: 'sized-tiles', presets: { size: 'tile-symbols' } });
    expect([...customPresets().keys()].slice(7)).toEqual(['tile-symbols']);
    expect(expand({ ...grid, use: 'tile-symbols' }).layers).toEqual([{ mark: 'sized-tiles', encode: { x: 'country', size: 'visitors' } }]);
  });
  it('its rules name its own layout, which is what makes it fall back, and the rules of `geo` are as they were', () => {
    expect(customMarks().get('geo-tiles')!.rules).toEqual(geoRules('geo-tiles'));
    expect(geoRules('geo')).toEqual(GEO_RULES);
    expect(geoRules('geo-tiles').map((r) => [r.id, r.layout, r.fallback])).toEqual([['guides', 'geo-tiles', undefined], ['marks', 'geo-tiles', 'bar-list']]);
    expect(geoMark(tiles.square).rules).toEqual(GEO_RULES);
    expect(() => registerGeo(tiles.square, { name: 'tile map' })).toThrow('A custom mark cannot be named "tile map"');
  });
  it('its errors say the name the spec wrote', () => {
    const of = (layers: Spec['layers']) => { try { run({ spec: 'view/0', query: grid.query, layers }, 346); } catch (e) { return (e as Error).message; } };
    expect(of([{ mark: 'geo-tiles', encode: { x: 'country' } }])).toMatch(/^A "geo-tiles" layer needs a metric on color/);
    expect(of([...expand(grid).layers!, ...expand(grid).layers!])).toMatch(/^A map draws one "geo-tiles" layer, and this view has 2\./);
  });
  it('the painter is the map\'s, as the layout of that name: its sheet and its rules say the name, and nothing of `geo`', () => {
    const painter = geoPainterAs('geo-tiles');
    expect([painter.layout, painter.paint, painter.rules!({} as never)]).toEqual(['geo-tiles', geoPainter.paint, geoRules('geo-tiles')]);
    expect(painter.css).toBe(geoPainter.css.split('[data-layout="geo"]').join('[data-layout="geo-tiles"]'));
    expect(painter.css).not.toContain('"geo"');
    expect(geoPainterAs('geo').css).toBe(geoPainter.css);
    const css = compileFitRules(geoRules('geo-tiles'), { 'geo-tiles': painter.fit ?? {} }), fig = '.uav[data-layout="geo-tiles"]:not([data-keep~="marks"])';
    expect(css).toContain('@container uav-view (inline-size < 279.5px) {\n  ' + fig + ' { display: none; }\n  ' + fig + ' ~ .uav-fallback { display: block; }\n}');
  });
});

describe('what a tile could hold, and does not', () => {
  // Symbols by size, with the layers written out: there is no preset for it.
  const spec: Spec = { ...grid, use: undefined, layers: [{ mark: 'geo-tiles', encode: { x: 'country', size: 'visitors' } }] };
  it('a symbol stands in the middle of its tile, and the largest is wider than the tile it stands on', () => {
    const { ratio, scene } = run(spec, 346), dots = (ratio.nodes as CircleNode[]).filter((n) => n.part === 'points' && n.kind === 'circle');
    expect([ratio.parts, dots.length]).toEqual([['plot', 'points', 'size'], 15]);
    for (const n of dots) {
      const c = corners(shapes(ratio).find((s) => s.row === n.row)!.d!).slice(0, 4);
      [n.x! * 100, (1 - n.t!) * 100 / ratio.aspect!].forEach((v, i) => expect(v, n.key).toBeCloseTo(c.reduce((s, p) => s + p[i]!, 0) / 4, 1));
    }
    const us = scene.nodes.find((n) => n.key === 'primary:geo-tiles:US:symbol') as unknown as { r: number };
    expect([us.r * 2, +(346 / 22).toFixed(1)]).toEqual([24, 15.7]);
  });
  it('no node names a region: a tile has no label', () => {
    expect(run(grid, 700).ratio.nodes.some((n) => n.kind === 'text' && /^[A-Z]{2}$/.test((n as { text: string }).text))).toBe(false);
  });
});
