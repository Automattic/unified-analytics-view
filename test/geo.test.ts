import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, PRESETS, buildScene, customMarks, customPresets, expand, makeContainer, notShownNote, place, registerMark, resolve, type CircleNode, type PainterName, type PathNode, type Result, type Spec } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, countries, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { GEO_RULES, geoMark, type Shapes } from '@unified-analytics/geo';
import { geoPainter, zoomBox } from '@unified-analytics/geo/dom';
import world from '@unified-analytics/geo/countries-110m.json';
import { errOf as err, run, shapes, validView as view } from './helpers.ts';

// Step 8 of docs/chart-coverage-plan.md: the `geo` mark, which is a custom mark, registered by the fixtures with their
// boundary shapes. No prototype knows it, so it is held to a sweep, facts and golden scenes of its own. The registry
// and `fallback` are in test/registry.test.ts.
const map = moreSamples.map!.spec, symbols = moreSamples.symbols!.spec, unmapped = moreSamples.unmapped!.spec;
const both: Spec = { ...map, query: { ...map.query, metrics: ['visitors', 'pageviews'] }, layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors', size: 'pageviews' } }] };
const dots = (ratio: { nodes: unknown[] }) => (ratio.nodes as CircleNode[]).filter((n) => n.part === 'points' && n.kind === 'circle');
const ASPECT = 2.029;   // Equal Earth, fitted to the fixture's shapes

describe('the sweep', () => {
  for (const [name, spec] of Object.entries({ map, symbols, both, unmapped })) {
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
    expect(run({ ...map, keep: ['marks'] }, 250).plan).toMatchObject({ layout: 'prose', preset: 'choropleth' });
    expect(run({ ...map, keep: ['marks'] }, 346).plan).toMatchObject({ layout: 'geo', preset: 'choropleth', dropped: [] });
  });
});

describe('golden scenes', () => {
  for (const [w, h] of [[346, null], [300, null], [250, null]] as [number, number | null][]) it(`map at ${w} by ${h ?? 'any'}`, () => expect(run(map, w, h).scene).toMatchSnapshot());
  for (const [w, h] of [[346, null], [250, 100]] as [number, number | null][]) it(`symbols at ${w} by ${h ?? 'any'}`, () => expect(run(symbols, w, h).scene).toMatchSnapshot());
  it('unmapped at 346 by any', () => expect(run(unmapped, 346).scene).toMatchSnapshot());
});

describe('the fixture: visitors by country', () => {
  it('answers with a row per country, ranked, and every one of them is the id of a boundary shape', () => {
    const { rows, totals } = runQuery(map.query), ids = countries.features.map((f) => f.id);
    expect(rows.length).toBe(15);
    expect(rows.slice(0, 3).map((r) => r.country)).toEqual(['US', 'IN', 'GB']);
    expect(rows.every((r) => ids.includes(r.country as string))).toBe(true);
    expect(Math.abs(rows.reduce((s, r) => s + (r.visitors as number), 0) - totals.visitors!)).toBeLessThanOrEqual(8);
  });
  it('the shapes are a small fixture, keyed on ISO 3166-1 alpha-2 in capitals with each name beside its code, and the file is not a large one', () => {
    expect(countries.features.length).toBe(123);
    const coded = countries.features.filter((f) => f.id != null);
    expect([coded.length, new Set(coded.map((f) => f.id)).size, coded.every((f) => /^[A-Z]{2}$/.test(String(f.id)))]).toEqual([122, 122, true]);
    expect(new Set(countries.features.map((f) => f.properties!.name)).size).toBe(123);
    expect(Object.fromEntries(['US', 'GB', 'EH', 'CD', 'CG', 'KP', 'KR', 'SS', 'RS', 'CI'].map((id) => [id, coded.find((f) => f.id === id)!.properties!.name])))
      .toEqual({ US: 'United States', GB: 'United Kingdom', EH: 'W. Sahara', CD: 'Dem. Rep. Congo', CG: 'Congo', KP: 'North Korea', KR: 'South Korea', SS: 'S. Sudan', RS: 'Serbia', CI: 'Côte d\'Ivoire' });
    // The one shape with no code of its own has no id: it is drawn, and no row is its.
    expect(countries.features.filter((f) => f.id == null).map((f) => f.properties!.name)).toEqual(['Somaliland']);
    // Borders as Natural Earth's 1:110m has them, to a tenth of a degree: about 9,000 points.
    expect(JSON.stringify(countries).length).toBeLessThan(130000);
  });
});

describe('geo, filled by a metric', () => {
  const { ratio, result, plan } = run(map, 346);
  it('is a custom mark, laid out under its own name, and core knows it only through the registry', () => {
    expect(customMarks().has('geo')).toBe(true);
    expect([plan.layout, ratio.layout, plan.preset]).toEqual(['geo', 'geo', 'choropleth']);
  });
  it('its presets are registered with it, since core cannot name it: a view that uses one is the layers written out, to the node', () => {
    expect([...customPresets().keys()]).toEqual(['choropleth', 'symbol-map', 'sankey', 'tile-grid-map', 'hex-tile-map', 'treemap', 'pair-list']);
    expect(PRESETS).not.toHaveProperty('choropleth');
    expect(map.layers ?? symbols.layers).toBeUndefined();
    expect(expand(map).layers).toEqual([{ mark: 'geo', encode: { x: 'country', color: 'visitors' } }]);
    expect(expand(symbols).layers).toEqual([{ mark: 'geo', encode: { x: 'country', size: 'pageviews' } }]);
    for (const spec of [map, symbols]) {
      const { use: _use, ...rest } = spec, written: Spec = { ...rest, layers: expand(spec).layers };
      for (const [w, h] of [[346, null], [300, null], [250, null], [346, 100], [120, null]] as [number, number | null][]) expect(run(spec, w, h).scene, spec.use + ' ' + w + ' ' + h).toEqual(run(written, w, h).scene);
      expect(run(written, 346).plan.preset).toBeNull();
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
    }
    expect(run(symbols, 346).plan).toMatchObject({ layout: 'geo', preset: 'symbol-map' });
    expect(err(() => expand({ ...map, query: { metrics: ['visitors'] } }))).toBe('The "choropleth" preset needs a dimension in query.by.');
  });
  it('draws every shape handed in, in the shapes\' order whatever the ranking, each a path in a box 100 wide', () => {
    expect(shapes(ratio).map((n) => n.key)).toEqual(countries.features.map((f) => 'primary:geo:' + (f.id ?? f.properties!.name)));
    expect(shapes(ratio).every((n) => n.fill && n.layer === 'data' && n.role === 'primary' && /^M[\d.,LMZ]+Z$/.test(n.d!))).toBe(true);
    const xs = shapes(ratio).flatMap((n) => n.d!.match(/[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 0)), ys = shapes(ratio).flatMap((n) => n.d!.match(/[\d.]+/g)!.map(Number).filter((_, i) => i % 2 === 1));
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys)]).toEqual([0, 100, 0]);
    expect(Math.max(...ys)).toBeCloseTo(100 / ASPECT, 1);
    const turned = { ...result, rows: result.rows.slice().reverse() };
    expect(shapes(run(map, 346, null, 'typical', 'svg', { result: turned }).ratio)).toEqual(shapes(ratio));
  });
  it('quantizes each region to the ten steps of the ramp, between the least and the most of the regions drawn, and never carries a colour', () => {
    const value = (n: PathNode) => result.rows.find((r) => r.country === n.row)!.visitors as number, drawn = shapes(ratio).filter((n) => n.row != null);
    const vals = drawn.map(value), lo = Math.min(...vals), hi = Math.max(...vals);
    expect(drawn.length).toBe(15);
    for (const n of drawn) expect(n.paint, n.key).toBe('seq.' + Math.min(10, 1 + Math.floor(((value(n) - lo) / (hi - lo)) * 10)));
    expect(shapes(ratio).every((n) => /^seq\.(\d+|none)$/.test(n.paint))).toBe(true);
  });
  it('paints a region the result has no row for seq.none, and it has no row to be chosen by', () => {
    const none = shapes(ratio).filter((n) => n.paint === 'seq.none');
    expect(none.length).toBe(123 - 15);
    expect(none.every((n) => n.row == null)).toBe(true);
    const nulled = { ...result, rows: result.rows.map((r) => (r.country === 'IN' ? { ...r, visitors: null } : r)) };
    expect(shapes(run(map, 346, null, 'typical', 'svg', { result: nulled }).ratio).find((n) => n.key === 'primary:geo:IN')).toMatchObject({ paint: 'seq.none', row: 'IN' });
  });
  it('its rows are the result\'s, in the result\'s order, which is the list a reader steps through', () => {
    expect(ratio.rows).toEqual(result.rows.map((r) => r.country));
    // A value no shape has is still a row, and in the table. It is not on the map.
    const more = { ...result, rows: [...result.rows, { country: 'Atlantis', visitors: 12 }] }, scene = run(map, 346, null, 'typical', 'svg', { result: more }).ratio;
    expect(scene.rows!.slice(-1)).toEqual(['Atlantis']);
    expect(scene.nodes.some((n) => n.key.includes('Atlantis'))).toBe(false);
  });
  it('has the ramp a grid has: the low value, a swatch for each step, the high value, and no data', () => {
    expect(ratio.nodes.filter((n) => n.part === 'ramp').map((n) => n.key)).toEqual(['ramp:low', ...Array.from({ length: 10 }, (_, i) => 'ramp:' + (i + 1)), 'ramp:high', 'ramp:none', 'ramp:none:label']);
    expect((ratio.nodes.filter((n) => n.part === 'ramp' && n.kind === 'text') as { text: string }[]).map((n) => n.text)).toEqual(['105', '3.3k', 'No data']);
    // The scene holds it whether or not the plan shows it.
    expect(run(map, 300).ratio.nodes.filter((n) => n.part === 'ramp').length).toBe(14);
  });
  // The colour scale is the grid's, in one place (seqScale), so a map of signed values is diverging about zero as a grid is.
  it('fills regions whose values cross zero on the diverging ramp, with zero the neutral step, and a region with no row still seq.none', () => {
    const typical = runQuery(map.query), mid = typical.rows[7]!.visitors as number;
    const signed: Result = { ...typical, rows: typical.rows.map((r) => ({ ...r, visitors: (r.visitors as number) - mid })) }, at = (r: Result['rows'][number]) => r.visitors as number;
    const scene = run(map, 346, null, 'typical', 'svg', { result: signed }).ratio, far = Math.max(...signed.rows.map((r) => Math.abs(at(r))));
    const fill = (id: string) => shapes(scene).find((n) => n.key === 'primary:geo:' + id)!.paint;
    for (const r of signed.rows) expect(fill(r.country as string), r.country as string).toBe('div.' + Math.min(9, 1 + Math.floor(((at(r) + far) / (2 * far)) * 9)));
    expect([fill(typical.rows[0]!.country as string), fill(typical.rows[7]!.country as string)]).toEqual(['div.9', 'div.5']);
    expect(shapes(scene).filter((n) => n.row == null).every((n) => n.paint === 'seq.none')).toBe(true);
    expect(scene.nodes.filter((n) => n.part === 'ramp').map((n) => n.key)).toEqual(['ramp:low', 'ramp:1', 'ramp:2', 'ramp:3', 'ramp:4', 'ramp:5', 'ramp:zero', 'ramp:6', 'ramp:7', 'ramp:8', 'ramp:9', 'ramp:high', 'ramp:none', 'ramp:none:label']);
    expect((scene.nodes.filter((n) => n.part === 'ramp' && n.kind === 'text') as { text: string }[]).map((n) => n.text)).toEqual(['-2.8k', '0', '2.8k', 'No data']);
  });
  it('place() fits a box of the shapes\' aspect inside the room, in the middle, and sets the ramp under it', () => {
    const wide = run(map, 346).scene, boxed = run(map, 346, 160).scene, most = run(map, 700).scene;
    expect([wide.plot!.w, wide.height]).toEqual([346, Math.ceil(346 / ASPECT + 24)]);
    expect([boxed.plot!.h, boxed.height, boxed.nodes.some((n) => n.key.startsWith('ramp:'))]).toEqual([160, 160, false]);
    expect(most.plot!.w).toBe(480);
    const us = (s: typeof wide) => s.nodes.find((n) => n.key === 'primary:geo:US') as unknown as { d: string; tx?: number; fill: boolean };
    expect([us(wide).tx, us(most).tx, us(boxed).tx]).toEqual([undefined, 110, (346 - 160 * ASPECT) / 2]);
    // The same path, at 3.46 times the size.
    const at = (d: string) => d.match(/[\d.]+/g)!.map(Number), d0 = at(shapes(run(map, 346).ratio).find((n) => n.row === 'US')!.d!);
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
    expect(dots(ratio).find((n) => n.row === 'US')).toMatchObject({ key: 'primary:geo:US:symbol', size: 4, paint: 'series.1', opacity: 0.7, layer: 'data', role: 'primary' });
    // Brazil is south of the equator and west of Greenwich; Australia is east of both.
    const at = (k: string) => dots(ratio).find((n) => n.row === k)!;
    expect(at('BR').x! < 0.5 && at('BR').t! < 0.5 && at('AU').x! > 0.5 && at('AU').t! < at('BR').t! + 0.2).toBe(true);
  });
  it('the regions are the ground they stand on: every shape in the tone of no value, as context', () => {
    expect(shapes(ratio).length).toBe(123);
    expect(shapes(ratio).every((n) => n.paint === 'seq.none' && n.layer === 'guide' && n.role === 'context')).toBe(true);
    expect(shapes(ratio).filter((n) => n.row != null).length).toBe(15);
  });
  it('has the key to sizes a plot has, and place() sets a symbol by its step', () => {
    expect((ratio.nodes.filter((n) => n.part === 'size' && n.kind === 'text') as { text: string }[]).map((n) => n.text)).toEqual(['Page views', '486', '1.9k', '4.4k', '7.8k']);
    const { scene } = run(symbols, 346), us = scene.nodes.find((n) => n.key === 'primary:geo:US:symbol') as unknown as { cx: number; cy: number; r: number };
    const node = dots(ratio).find((n) => n.row === 'US')!;
    expect(us.r).toBe(12);
    expect([us.cx, us.cy].map((n) => +n.toFixed(9))).toEqual([node.x! * 346, (1 - node.t!) * 346 / ASPECT].map((n) => +n.toFixed(9)));
    expect(scene.height).toBe(Math.ceil(346 / ASPECT + 28));
  });
  it('one layer may fill by one metric and size by another, and then it has both keys', () => {
    const { ratio, plan } = run(both, 346);
    expect(ratio.parts).toEqual(['plot', 'points', 'ramp', 'size']);
    expect([shapes(ratio).filter((n) => /seq\.\d+/.test(n.paint)).length, dots(ratio).length]).toEqual([15, 15]);
    expect(plan.dropped).toEqual([]);
    const narrow = run(both, 300);
    expect(narrow.ratio.parts).toEqual(['plot', 'points']);
    expect(narrow.plan.dropped).toEqual(['the colour ramp and the key to sizes']);
  });
});

describe('rows the map has no shape for', () => {
  const note = (s: { nodes: { key: string }[] }) => (s.nodes.find((n) => n.key === 'note:not-shown') as { text: string } | undefined)?.text;
  const withRows = (rows: Result['rows']) => { const result = runQuery(map.query); return run(map, 346, null, 'typical', 'svg', { result: { ...result, rows: [...result.rows, ...rows] } }); };
  it('the wording is core\'s, by the dimension\'s label: one, several, and nothing to say of none', () => {
    expect([notShownNote(1, 'Country'), notShownNote(12, 'Country'), notShownNote(3, 'Page'), notShownNote(0, 'Country')]).toEqual(['1 country not shown', '12 countries not shown', '3 pages not shown', '']);
  });
  it('counts the rows whose value is no shape\'s id, an empty one and a null among them, and says so under the map', () => {
    const { ratio, scene, result } = run(unmapped, 346);
    expect(result.rows.filter((r) => !countries.features.some((f) => f.id === r.visitor_country)).map((r) => r.visitor_country)).toEqual(['SG', '', 'MT', 'BH']);
    expect(ratio.nodes.find((n) => n.key === 'note:not-shown')).toEqual({ key: 'note:not-shown', part: 'note', kind: 'text', text: '4 countries not shown', anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    expect(ratio.parts).toEqual(['plot', 'note', 'ramp']);
    expect([note(withRows([{ country: 'Atlantis', visitors: 12 }]).ratio), note(withRows([{ country: '', visitors: 12 }, { country: null, visitors: 3 }]).ratio)]).toEqual(['1 country not shown', '2 countries not shown']);
    // The match is on the id as it is written. A code in small letters, one with a space, a name, and the name of a
    // shape that has no id are each a row with no shape.
    const loose = withRows([{ country: 'cn', visitors: 9 }, { country: ' CN', visitors: 9 }, { country: 'China', visitors: 9 }, { country: 'Somaliland', visitors: 9 }]).ratio;
    expect([note(loose), shapes(loose).find((n) => n.key === 'primary:geo:CN')!.row, shapes(loose).find((n) => n.key === 'primary:geo:Somaliland')!.row]).toEqual(['4 countries not shown', undefined, undefined]);
    // Every row is still a row: the table's, and the list's a reader steps through. The shapes drawn are the same.
    expect(ratio.rows!.length).toBe(19);
    expect(shapes(ratio).filter((n) => n.row != null).length).toBe(15);
    // In pixels it is a line under the map, at the start of the width, and the ramp is under it.
    expect(scene.nodes.find((n) => n.key === 'note:not-shown')).toMatchObject({ kind: 'text', text: '4 countries not shown', x: 0, y: 346 / ASPECT + 11, paint: 'ink.muted' });
    expect([scene.plot!.w, scene.height]).toEqual([346, Math.ceil(346 / ASPECT + 18 + 24)]);
    expect(scene.nodes.find((n) => n.key === 'ramp:1')).toMatchObject({ ty: 346 / ASPECT + 18 });
  });
  it('says nothing when every row has a shape', () => {
    for (const spec of [map, symbols, both]) { const { ratio, scene } = run(spec, 346); expect([note(ratio), note(scene), ratio.parts.includes('note')]).toEqual([undefined, undefined, false]); }
  });
  it('the note goes with the keys, so it takes no room from a small map, and is never beside the list, which has every row', () => {
    const at = (w: number, h: number | null = null) => { const { plan, ratio, scene } = run(unmapped, w, h); return [plan.layout, ratio.parts.join(' '), note(scene)]; };
    expect(at(700)).toEqual(['geo', 'plot note ramp', '4 countries not shown']);
    expect(at(320)).toEqual(['geo', 'plot note ramp', '4 countries not shown']);
    expect(at(346, 170)).toEqual(['geo', 'plot note ramp', '4 countries not shown']);
    expect(run(unmapped, 346, 170).scene.plot!.h).toBe(170 - 18 - 24);
    expect(at(319)).toEqual(['geo', 'plot', undefined]);
    expect(at(346, 169)).toEqual(['geo', 'plot', undefined]);
    expect(at(279)).toEqual(['rows', 'rows', undefined]);
    // The list it becomes holds the rows the map could not draw.
    expect(run(unmapped, 250).ratio.rows).toEqual(run(unmapped, 346).result.rows.map((r) => r.visitor_country));
    // With symbols it is the same note, over the key to sizes.
    const sym: Spec = { ...unmapped, layers: [{ mark: 'geo', encode: { x: 'visitor_country', size: 'visitors' } }] };
    expect([run(sym, 346).ratio.parts, note(run(sym, 346).scene)]).toEqual([['plot', 'points', 'note', 'size'], '4 countries not shown']);
  });
  it('a result of rows with no value alone is a map with a note, and not the error for shapes that are the wrong ones', () => {
    const result = runQuery(map.query), { ratio } = run(map, 346, null, 'typical', 'svg', { result: { ...result, rows: [{ country: '', visitors: 40 }] } });
    expect([note(ratio), shapes(ratio).every((n) => n.paint === 'seq.none' && n.row == null)]).toEqual(['1 country not shown', true]);
  });
});

describe('prose, the number and errors', () => {
  it('says what the ranked list says: the top regions by the metric', () => {
    expect(run(map, 346).plan.text).toBe('Top countries by visitors, last 28 days: United States (3,265), India (1,264), United Kingdom (948).');
    expect(run(map, 250).plan.text).toBe(run(map, 346).plan.text);
    expect(run(map, 346, null, 'empty').plan.text).toBe('Visitors: nothing recorded in the last 28 days.');
    expect((run(map, 120).ratio.nodes.find((n) => n.key === 'sub') as { text: string }).text).toBe('Top: United States');
  });
  it('errors name the fix: no dimension on x, no metric to draw by, more than one layer, and values that join to no shape', () => {
    const q = map.query, drawn = expand(map).layers!, of = (layers: Spec['layers'], query = q) => err(() => run({ spec: 'view/0', query, layers }, 346));
    expect(of([{ mark: 'geo', encode: { color: 'visitors' } }])).toBe('A "geo" layer needs the dimension whose values are region keys on x, and this one has undefined there. Encode one of the query\'s dimensions on x: country.');
    expect(of([{ mark: 'geo', encode: { x: 'country' } }])).toBe('A "geo" layer needs a metric on color, to fill each region by, or on size, for a symbol on each, and this one has undefined on color and undefined on size. Encode one of the query\'s metrics: visitors.');
    expect(of([{ mark: 'geo', encode: { x: 'country', color: 'country' } }])).toMatch(/^A "geo" layer needs a metric on color/);
    // A companion is a metric to the map, as it is to the treemap: one filled by a share the engine sends with visitors.
    const shared = geoMark(countries).scene({ layers: [{ mark: 'geo', encode: { x: 'country', color: 'visitors@share' } }], guides: {}, query: q, result: { rows: [{ country: 'FR', visitors: 3, 'visitors@share': 0.5 }], totals: { visitors: 3 }, meta: runQuery(q).meta }, catalog });
    expect(shared.nodes.find((n) => n.key === 'primary:geo:FR')!.paint).not.toBe('seq.none');
    expect(of([{ mark: 'geo', encode: { x: 'country', size: 'country' } }])).toMatch(/^Layer 1 encodes "country" on size, and a size is a quantity\./);
    expect(of([...drawn, ...drawn])).toBe('A map draws one "geo" layer, and this view has 2. Put the metric to fill by on color and the metric for symbols on size, in one layer.');
    expect(of([...drawn, { mark: 'bar', encode: { x: 'country', y: 'visitors' } }])).toBe('The "geo" mark is laid out by its own code, and layer 2 is a "bar". Keep the "geo" layers alone, and draw the others as a view of their own.');
    expect(of([{ mark: 'geo', encode: { x: 'page', color: 'pageviews' } }], { metrics: ['pageviews'], by: ['page'] }))
      .toBe('None of the 8 values of "page" is the id of a boundary shape. The first is "/", and the shapes are keyed on ISO 3166-1 alpha-2 codes, in capitals: "TZ", "EH" and 120 more. Have the engine send those ids for "page", or hand geoMark() shapes whose ids are its values.');
  });
  it('the shapes are an input: a mark made from other shapes draws those, and shapes that are not shapes are an error', () => {
    const two: Shapes = { type: 'FeatureCollection', features: countries.features.filter((f) => f.id === 'BR' || f.id === 'AR') };
    registerMark('south', geoMark(two, { name: 'south' }));
    const spec: Spec = { ...map, layers: [{ mark: 'south', encode: { x: 'country', color: 'visitors' } }] }, result = runQuery(spec.query);
    const scene = buildScene(resolve(spec, result, makeContainer(700), catalog), spec.query, result, catalog);
    expect(shapes(scene).map((n) => [n.key, n.paint])).toEqual([['primary:south:AR', 'seq.none'], ['primary:south:BR', 'seq.10']]);
    expect(scene.aspect).toBeLessThan(1);
    const bad = 'The geo mark needs boundary shapes: a GeoJSON FeatureCollection in which every feature has an "id", the value the region\'s dimension has for it, or where no value stands for it a "properties.name". Hand one to geoMark() or registerGeo().';
    expect(err(() => geoMark({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: null }] }))).toBe(bad);
    expect(err(() => geoMark({ type: 'Topology', features: [] }))).toBe(bad);
  });
});

describe('the painter\'s half, as strings', () => {
  it('is the layout of the mark\'s name, whose rules are the mark\'s alone, and its part holds the scene\'s aspect', () => {
    expect([geoPainter.layout, geoPainter.rules]).toEqual(['geo', undefined]);
    expect(geoPainter.css).toContain('.uav[data-layout="geo"] .uav-plot { flex: none; align-self: center; inline-size: min(100%, 480px); aspect-ratio: var(--uav-aspect, 2);');
  });
  it('its rules compile to the keys going, and then to the swap for the ranked list, by width and by height', () => {
    const css = compileFitRules(GEO_RULES, { geo: geoPainter.fit ?? {} }), fig = (keep: string) => '.uav[data-layout="geo"]:not([data-keep~="' + keep + '"])';
    expect(css).toContain('@container uav-view (inline-size < 319.5px) {\n  ' + fig('guides') + ' :is(.uav-ramp, .uav-size, .uav-note) { display: none; }\n}');
    expect(css).toContain('@container uav-view (block-size < 169.5px) {\n  ' + fig('guides') + ' :is(.uav-ramp, .uav-size, .uav-note) { display: none; }\n}');
    const swap = '  ' + fig('marks') + ':has(~ .uav-fallback[data-rule="marks"]) { display: none; }\n  ' + fig('marks') + ' ~ .uav-fallback[data-rule="marks"] { display: block; }\n}';
    expect(css).toContain('@container uav-view (inline-size < 279.5px) {\n' + swap);
    expect(css).toContain('@container uav-view (block-size < 119.5px) {\n' + swap);
  });
});

describe('a map brought in to a region', () => {
  const home = [0, 0, 100, 50];
  it('shows the region with room around it, in the map\'s own shape', () => {
    const [x, y, w, h] = zoomBox({ x: 40, y: 20, width: 20, height: 6 }, home) as [number, number, number, number];
    expect([w, h]).toEqual([30, 15]);
    expect([x + w / 2, y + h / 2]).toEqual([50, 23]);
    // A tall region is fitted by its height.
    expect(zoomBox({ x: 40, y: 10, width: 4, height: 20 }, home).slice(2)).toEqual([60, 30]);
  });
  it('stays inside the map, is never closer than a small country can bear, and never wider than the map', () => {
    expect(zoomBox({ x: 1, y: 1, width: 10, height: 4 }, home).slice(0, 2)).toEqual([0, 0]);
    expect(zoomBox({ x: 95, y: 46, width: 4, height: 3 }, home)).toEqual([86, 43, 14, 7]);
    expect(zoomBox({ x: 50, y: 25, width: 0.5, height: 0.5 }, home).slice(2)).toEqual([14, 7]);
    expect(zoomBox({ x: 5, y: 5, width: 90, height: 40 }, home)).toEqual(home);
  });
});

// The world, for a page that hands the mark every country: packages/geo/scripts/countries.mjs writes it.
describe('the shapes of every country (countries-110m)', () => {
  const shapes: Shapes = world, ids = shapes.features.flatMap((f) => (f.id == null ? [] : [String(f.id)]));
  it('names each by its ISO alpha-2 code, once, and draws the two it has no code for with no id', () => {
    expect(shapes.features.length).toBe(176);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[A-Z]{2}$/.test(id))).toBe(true);
    expect(shapes.features.filter((f) => f.id == null).map((f) => f.properties!.name)).toEqual(['Northern Cyprus', 'Somaliland']);
  });
  it('has the countries the fixtures leave out, and every one they have, drawn as they draw it', () => {
    for (const id of ['NL', 'BE', 'CH', 'PT', 'DK', 'IE', 'IL', 'TW', 'XK']) expect(ids, id).toContain(id);
    const drawn = new Map(shapes.features.map((f) => [f.id, f.geometry]));
    for (const f of countries.features) if (f.id != null) expect(drawn.get(f.id), String(f.id)).toEqual(f.geometry);
  });
  it('is named as a code is written, has no Antarctica, and is small enough to send', () => {
    expect(shapes.features.find((f) => f.id === 'US')!.properties!.name).toBe('United States');
    expect(ids).not.toContain('AQ');
    expect(JSON.stringify(world).length).toBeLessThan(145000);
  });
  it('draws: a row for each of its codes is on the map, with nothing left out', () => {
    registerMark('world', geoMark(shapes, { name: 'world' }));
    const spec: Spec = { ...map, layers: [{ mark: 'world', encode: { x: 'country', color: 'visitors' } }] }, was = runQuery(spec.query);
    const result = { ...was, rows: ids.map((country, i) => ({ country, visitors: i + 1 })) };
    const scene = buildScene(resolve(spec, result, makeContainer(700), catalog), spec.query, result, catalog);
    expect(scene.nodes.some((n) => n.part === 'note')).toBe(false);
    expect(scene.nodes.filter((n) => n.part === 'plot' && n.kind === 'path').length).toBe(176);
  });
});
