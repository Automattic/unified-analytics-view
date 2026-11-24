import { describe, expect, it } from 'vitest';
import { customMarks, customPresets, expand, type CircleNode, type Spec } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { countries, moreSamples, scenarios, tiles } from '@unified-analytics/fixtures';
import { GEO_RULES, geoMark, geoNames, geoRules, registerGeo } from '@unified-analytics/geo';
import { geoPainter, geoPainterAs, registerGeoPainters } from '@unified-analytics/geo/dom';
import { painterOf } from '../packages/dom/src/layouts/index.ts';
import { run, shapes, shown, validView as view } from './helpers.ts';

// Step 10 of docs/archive/uncommon-coverage-plan.md: tile maps. No new mark: the `geo` mark, registered again by the fixtures
// under a name for each of two files of tiles. The mark itself is held in test/geo.test.ts, and what is held here is
// what tiles add: shapes on a flat sheet, a mark under another name, and the two samples.
const grid = moreSamples.tiles!.spec, hex = moreSamples.hexes!.spec, map = moreSamples.map!.spec;
/** The corners of a path of moves and lines. It is closed by a Z, so the first is not said again. */
const corners = (d: string) => { const n = d.match(/-?[\d.]+/g)!.map(Number); return Array.from({ length: n.length / 2 }, (_, i) => [n[i * 2]!, n[i * 2 + 1]!] as const); };
const sides = (d: string) => corners(d).map(([x, y], i, all) => Math.hypot(x - all[(i + 1) % all.length]![0], y - all[(i + 1) % all.length]![1]));
const ASPECT = { tiles: 22 / 13, hexes: 22.5 / (13 * Math.sqrt(3) / 2 + 2 / Math.sqrt(3)) };   // the sheets the script lays out
const LAYOUT = { tiles: 'geo-tiles', hexes: 'geo-hexes' };

describe('the sweep', () => {
  for (const [name, spec] of Object.entries({ tiles: grid, hexes: hex })) {
    it(name + ': unique keys, no NaN, a sheet of its own shape, and at every room parts the scene has', () => {
      for (const sc of scenarios) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
        const at = [name, sc, w, h].join(' ');
        const { plan, ratio, fit } = run(spec, w, h, sc);
        const all = ratio.nodes.map((n) => n.key);
        expect(new Set(all).size, 'duplicate keys: ' + at).toBe(all.length);
        expect(JSON.stringify(ratio, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), 'parts with nothing in them: ' + at).toEqual([]);
        if (plan.layout !== LAYOUT[name as 'tiles']) continue;
        expect(ratio.aspect, at).toBeCloseTo(ASPECT[name as 'tiles'], 2);
      }
    });
  }
  it('one spec is a tile map with room and the ranked list of its query without, at the widths and heights a map of countries turns at', () => {
    for (const [spec, layout] of [[grid, 'geo-tiles'], [hex, 'geo-hexes']] as [Spec, string][]) {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) {
        // The layout drawn, the parts that show, the ramp's form, and what the view gave way from to be drawn so.
        const at = (w: number, h: number | null = null) => { const r = run(spec, w, h, sc), f = shown(r); return [r.plan.layout, f.parts.join(' '), f.set.ramp ?? 'whole', r.gave.join()]; };
        if (sc === 'empty') { expect([346, 250, 120].map((w) => at(w).slice(0, 2))).toEqual([['notice', 'notice'], ['notice', 'notice'], ['notice', 'number']]); continue; }
        expect(at(700)).toEqual([layout, 'plot ramp', 'whole', '']);
        expect(at(346)).toEqual([layout, 'plot ramp', 'whole', '']);         // dashboard width
        expect(at(319)).toEqual([layout, 'plot ramp', 'strip', '']);
        expect(at(280)).toEqual([layout, 'plot ramp', 'strip', '']);
        expect(at(279)).toEqual(['rows', 'rows', 'whole', layout]);
        expect(at(250)).toEqual(['rows', 'rows', 'whole', layout]);          // sidebar width
        expect(at(346, 119)).toEqual(['rows', 'rows', 'whole', layout]);
        // The list it became gives way to the number by its own rule.
        expect(at(89)).toEqual(['rows', 'number', 'whole', layout]);
      }
    }
  });
  it('the list it becomes is the bar-list of the same query, to the node: the one the map of countries becomes', () => {
    const list: Spec = { spec: 'view/0', title: grid.title, use: 'bar-list', query: grid.query }, of = (spec: Spec, w: number, h: number | null) => { const r = run(spec, w, h); return [r.ratio, shown(r)]; };
    for (const spec of [grid, hex]) for (const [w, h] of [[250, null], [170, null], [346, 100], [80, null]] as [number, number | null][]) {
      expect(of(spec, w, h), w + ' ' + h).toEqual(of(list, w, h));
      expect(of(spec, w, h)).toEqual(of(map, w, h));
    }
    expect(run(grid, 346).plan.text).toBe(run(map, 346).plan.text);
  });
});

describe('golden scenes', () => {
  const rooms = { tiles: [[346, null], [300, null], [250, null]], hexes: [[346, null], [346, 160]] } as Record<string, [number, number | null][]>;
  for (const [name, spec] of Object.entries({ tiles: grid, hexes: hex })) {
    it(name, () => expect(run(spec, 346).ratio).toMatchSnapshot());
    it(name + ', at each room', () => expect(rooms[name]!.map(([w, h]) => [w, h, shown(run(spec, w, h))])).toMatchSnapshot());
  }
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
  it('a square is a square and every one the same size, in the box', () => {
    const { ratio } = run(grid, 346), side = 100 / 22;
    expect(shapes(ratio).length).toBe(122);
    for (const n of shapes(ratio)) { expect(corners(n.d!).length, n.key).toBe(4); for (const s of sides(n.d!).slice(0, 4)) expect(s, n.key).toBeCloseTo(side, 1); }
    // Greenland's tile is the sixth along the top row of the sheet, and it is where the file puts it.
    expect(corners(shapes(ratio).find((n) => n.key === 'primary:geo-tiles:GL')!.d!)[0]!.map((v) => +(v / side).toFixed(2))).toEqual((tiles.square.features.find((f) => f.id === 'GL')!.geometry!.coordinates as number[][][])[0]![0]);
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
  it('its presets are the ones the page names: the fixtures name none, and a tile map is written as its layer', () => {
    expect([...customPresets().keys()]).toEqual(['choropleth', 'sankey', 'treemap', 'pair-list']);
    expect(grid.layers).toEqual([{ mark: 'geo-tiles', encode: { x: 'country', color: 'visitors' } }]);
    expect(hex.layers).toEqual([{ mark: 'geo-hexes', encode: { x: 'country', color: 'visitors' } }]);
    expect([run(grid, 346).plan.preset, run(hex, 346).plan.preset]).toEqual([null, null]);
    // Under a name of its own it registers only the presets it is given: none, or either.
    registerGeo(tiles.square, { name: 'bare-tiles' });
    registerGeo(tiles.square, { name: 'sized-tiles', presets: { size: 'tile-symbols' } });
    expect([...customPresets().keys()].slice(4)).toEqual(['tile-symbols']);
    expect(expand({ query: grid.query, use: 'tile-symbols' }).layers).toEqual([{ mark: 'sized-tiles', encode: { x: 'country', size: 'visitors' } }]);
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
  it('the painter is the map\'s, as the layout of that name, one for each name the fixtures registered: its sheet says the name, and nothing of `geo`', () => {
    const painter = geoPainterAs('geo-tiles');
    expect([painter.layout, painter.paint]).toEqual(['geo-tiles', geoPainter.paint]);
    expect([...geoNames()].slice(0, 3)).toEqual(['geo', 'geo-tiles', 'geo-hexes']);
    expect(painter.css).toBe(geoPainter.css.split('[data-layout="geo"]').join('[data-layout="geo-tiles"]'));
    expect(painter.css).not.toContain('"geo"');
    expect(geoPainterAs('geo').css).toBe(geoPainter.css);
    const css = compileFitRules(geoRules('geo-tiles'), { 'geo-tiles': painter.fit ?? {} }), fig = '.uav[data-layout="geo-tiles"]:not([data-keep~="marks"])';
    expect(css).toContain('@container uav-view (inline-size < 279.5px) {\n  ' + fig + ':has(~ .uav-fallback[data-rule="marks"]) { display: none; }\n  ' + fig + ' ~ .uav-fallback[data-rule="marks"] { display: block; }\n}');
  });
});

describe('the painters of the names', () => {
  it('come with the name, for shapes registered after registerGeoPainters() as before it', () => {
    registerGeoPainters();
    expect(painterOf('geo-tiles')!.css).toBe(geoPainterAs('geo-tiles').css);
    registerGeo(tiles.square, { name: 'geo-later' });
    expect(painterOf('geo-later')!.css).toBe(geoPainterAs('geo-later').css);
  });
});

describe('what a tile could hold, and does not', () => {
  // Symbols by size, with the layers written out: there is no preset for it.
  const spec: Spec = { ...grid, use: undefined, layers: [{ mark: 'geo-tiles', encode: { x: 'country', size: 'visitors' } }] };
  it('a symbol stands in the middle of its tile', () => {
    const { ratio } = run(spec, 346), dots = (ratio.nodes as CircleNode[]).filter((n) => n.part === 'points' && n.kind === 'circle');
    expect([ratio.parts, dots.length]).toEqual([['plot', 'points', 'size'], 15]);
    for (const n of dots) {
      const c = corners(shapes(ratio).find((s) => s.row === n.row)!.d!).slice(0, 4);
      [n.x! * 100, (1 - n.y!) * 100 / ratio.aspect!].forEach((v, i) => expect(v, n.key).toBeCloseTo(c.reduce((s, p) => s + p[i]!, 0) / 4, 1));
    }
  });
  it('no node names a region: a tile has no label', () => {
    expect(run(grid, 700).ratio.nodes.some((n) => n.kind === 'text' && /^[A-Z]{2}$/.test((n as { text: string }).text))).toBe(false);
  });
});
