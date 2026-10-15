import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { PRESETS, buildScene, declutter, customMarks, customPresets, expand, makeContainer, place, resolve, type PainterName, type PathNode, type RectNode, type Result, type Spec, type TextNode } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { LINK_RULES, NODE } from '@unified-analytics/flow';
import { linkPainter } from '@unified-analytics/flow/dom';

// Step 8 of docs/uncommon-coverage-plan.md: the `link` mark, a custom mark the fixtures register, and the Sankey of one
// step it draws. No prototype knows it, so it is held to a sweep, facts and golden scenes of its own.
const sankey = moreSamples.sankey!.spec;
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', result: Result = runQuery(spec.query, scenario)) => {
  const container = makeContainer(w, h, painter, 8), plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);
const ribbons = (ratio: { nodes: unknown[] }) => (ratio.nodes as PathNode[]).filter((n) => n.part === 'plot' && n.kind === 'path');
const rects = (ratio: { nodes: unknown[] }) => (ratio.nodes as RectNode[]).filter((n) => n.part === 'plot' && n.kind === 'rect');
const labels = (ratio: { nodes: unknown[] }) => (ratio.nodes as TextNode[]).filter((n) => n.part === 'labels');
const layered = (encode: Record<string, string | number>, query = sankey.query): Spec => ({ query, layers: [{ mark: 'link', encode }] });
const GAP = 0.02, ROOM = 1 - GAP * 5;      // six sources, so five gaps: what is left of the plot's height is the nodes'

describe('the sweep', () => {
  it('sankey: unique keys, no NaN, nothing taller than the container allows, and everything inside the box', () => {
    for (const sc of scenarios) for (const p of ['svg', 'dots'] as PainterName[]) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
      const at = [sc, p, w, h].join(' '), { plan, ratio, scene } = run(sankey, w, h, sc, p);
      const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
      expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
      expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
      expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
      if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
      expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
      if (plan.layout !== 'link') continue;
      for (const n of rects(ratio)) expect(n.y! >= 0 && n.h! > 0 && n.y! + n.h! <= 1 + 1e-9 && (n.x === 0 || n.x === 1), 'node: ' + at + ' ' + n.key).toBe(true);
      for (const n of scene.nodes) {
        if (n.kind === 'rect') expect(n.x >= 0 && n.x + n.w <= w && n.y >= 0 && n.y + n.h <= scene.height + 0.01, 'outside: ' + at + ' ' + n.key).toBe(true);
        if (n.kind === 'text') expect(n.y >= 7 && n.y <= scene.height - 7, 'label outside: ' + at + ' ' + n.key).toBe(true);
        if (n.kind === 'path') for (const [, x, y] of n.d!.matchAll(/([\d.]+),([\d.]+)/g)) expect(+x! >= NODE && +x! <= w - NODE + 0.01 && +y! <= scene.height + 0.01, 'ribbon outside: ' + at + ' ' + n.key).toBe(true);
      }
    }
  });
  it('one spec is a Sankey with room, gives up its labels, and then is the grid of the same pairs: then the number, then the prose', () => {
    expect(view(sankey), JSON.stringify(view.errors)).toBe(true);
    const fell = 'the link marks (drawn as "heatmap")';
    for (const sc of scenarios) {
      const at = (w: number, h: number | null = null) => { const { plan, ratio, scene } = run(sankey, w, h, sc); return [plan.layout, ratio.parts.join(' '), plan.dropped.join('; '), scene.nodes.filter((n) => n.key.startsWith('label:')).length > 0]; };
      if (sc === 'empty') { expect([346, 250, 120, 10].map((w) => at(w)[0])).toEqual(['notice', 'notice', 'none', 'prose']); continue; }
      expect(at(700)).toEqual(['link', 'plot labels', '', true]);
      expect(at(346)).toEqual(['link', 'plot labels', '', true]);       // dashboard width
      // Core asks a custom mark's `guides` rule only for a ramp or a key to sizes, so the plan does not say the labels
      // went: place() leaves them out by the rule, as the stylesheet does.
      expect(at(319)).toEqual(['link', 'plot labels', '', false]);
      expect(at(346, 139)).toEqual(['link', 'plot labels', '', false]);
      expect(at(280)).toEqual(['link', 'plot labels', '', false]);
      expect(at(279)).toEqual(['matrix', 'y-axis plot x-axis ramp', fell, false]);
      expect(at(250)).toEqual(['matrix', 'y-axis plot x-axis ramp', fell, false]);      // sidebar width
      expect(at(346, 119)[0]).toBe('matrix');
      expect(at(120)).toEqual(['none', 'number', fell + '; the colour ramp; all marks (kept the number)', false]);
      expect(at(10)[0]).toBe('prose');
    }
  });
  it('the grid it becomes is the heatmap of the same query, to the node, with the sources down the side and the targets across', () => {
    const grid: Spec = { spec: 'view/0', title: sankey.title, use: 'heatmap', query: sankey.query };
    for (const [w, h] of [[250, null], [170, null], [346, 100], [80, null]] as [number, number | null][]) {
      expect(run(sankey, w, h).scene, w + ' ' + h).toEqual(run(grid, w, h).scene);
      expect(run(sankey, w, h).plan.preset).toBe('heatmap');
    }
    const { ratio, result } = run(sankey, 250);
    expect(ratio.ys).toEqual(result.totalsBy!.channel!.map((r) => r.channel));
    expect(ratio.rows).toEqual(result.totalsBy!.landing!.map((r) => r.landing));
    // `keep` switches the rule off, so there is no grid, and the Sankey stays where it has the room.
    expect(run({ ...sankey, keep: ['marks'] }, 346).plan).toMatchObject({ layout: 'link', preset: 'sankey', dropped: [] });
  });
});

describe('golden scenes', () => {
  for (const [w, h] of [[346, null], [300, null], [250, null]] as [number, number | null][]) it(`sankey at ${w} by ${h ?? 'any'}`, () => expect(run(sankey, w, h).scene).toMatchSnapshot());
});

describe('the fixture: visitors from channel to landing', () => {
  it('answers with a row for each pair, source by source, and the engine\'s total for each value of both', () => {
    const { rows, totals, totalsBy } = runQuery(sankey.query);
    expect([rows.length, totalsBy!.channel!.length, totalsBy!.landing!.length]).toEqual([30, 6, 5]);
    expect(rows.slice(0, 2).map((r) => [r.channel, r.landing])).toEqual([['Search', 'Home'], ['Search', 'Blog']]);
    for (const t of totalsBy!.channel!) expect(rows.filter((r) => r.channel === t.channel).reduce((s, r) => s + (r.visitors as number), 0), String(t.channel)).toBe(t.visitors);
    expect(Math.abs(totalsBy!.channel!.reduce((s, r) => s + (r.visitors as number), 0) - totals.visitors!)).toBeLessThanOrEqual(6);
    expect(runQuery(sankey.query, 'no-prior')).toEqual(runQuery(sankey.query));
    expect(runQuery(sankey.query, 'empty')).toMatchObject({ rows: [], totalsBy: { channel: [], landing: [] }, meta: { empty: true } });
  });
});

describe('link: two columns of nodes and a ribbon for each row', () => {
  const { ratio, result, plan } = run(sankey, 346), total = result.totals.visitors!;
  it('is a custom mark, laid out under its own name, with its preset registered beside it', () => {
    expect(customMarks().has('link')).toBe(true);
    expect([plan.layout, ratio.layout, plan.preset]).toEqual(['link', 'link', 'sankey']);
    expect(customPresets().has('sankey')).toBe(true);
    expect(PRESETS).not.toHaveProperty('sankey');
    expect(expand(sankey).layers).toEqual([{ mark: 'link', encode: { x: 'channel', y: 'landing', size: 'visitors' } }]);
    const written: Spec = { ...sankey, use: undefined, layers: expand(sankey).layers };
    for (const w of [346, 300, 250, 120]) expect(run(sankey, w).scene, String(w)).toEqual(run(written, w).scene);
    expect(err(() => expand({ ...sankey, query: { metrics: ['visitors'], by: ['channel'] } }))).toBe('The "sankey" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  });
  it('a node for each value, in the engine\'s order, as tall as the engine\'s total for it and never a sum of the rows', () => {
    const nodes = rects(ratio);
    expect(nodes.map((n) => n.key)).toEqual([...result.totalsBy!.channel!.map((r) => 'node:channel:' + r.channel), ...result.totalsBy!.landing!.map((r) => 'node:landing:' + r.landing)]);
    for (const [d, x] of [['channel', 0], ['landing', 1]] as const) {
      let y = 0;
      for (const t of result.totalsBy![d]!) {
        const n = nodes.find((r) => r.key === 'node:' + d + ':' + t[d])!;
        expect([n.x, n.y, n.h].map((v) => +v!.toFixed(9)), n.key).toEqual([x, +y.toFixed(9), +((t.visitors as number) / total * ROOM).toFixed(9)]);
        y += n.h! + GAP;
      }
    }
    // The rows a view receives may stop short of the whole. The nodes do not change with them.
    const fewer = { ...result, rows: result.rows.slice(0, 7) };
    expect(rects(run(sankey, 346, null, 'typical', 'svg', fewer).ratio)).toEqual(nodes);
    expect(ribbons(run(sankey, 346, null, 'typical', 'svg', fewer).ratio).length).toBe(7);
  });
  it('a ribbon for each row, as wide at each end as the row\'s share of the node it meets, lying in the other column\'s order', () => {
    const paths = ribbons(ratio), nodes = rects(ratio);
    expect(paths.map((n) => n.key)).toEqual(result.rows.map((r) => 'primary:link:' + r.channel + ':' + r.landing));
    expect(ratio.rows).toEqual(result.rows.map((r) => r.channel + ':' + r.landing));
    expect(paths.every((n) => n.row === n.key.slice('primary:link:'.length) && n.fill && n.layer === 'data' && n.role === 'primary')).toBe(true);
    const ends = (n: PathNode) => { const [a, , , c, d, , , b] = [...n.d!.matchAll(/[\d.]+,([\d.]+)/g)].map((m) => +m[1]!); return { y0: a!, w0: b! - a!, y1: c!, w1: d! - c! }; };
    result.rows.forEach((r, i) => {
      const s = nodes.find((n) => n.key === 'node:channel:' + r.channel)!, t = nodes.find((n) => n.key === 'node:landing:' + r.landing)!, e = ends(paths[i]!);
      const of = (d: 'channel' | 'landing') => result.totalsBy![d]!.find((x) => x[d] === r[d])!.visitors as number;
      expect(e.w0, paths[i]!.key).toBeCloseTo((r.visitors as number) / of('channel') * s.h! * 100, 1);
      expect(e.w1, paths[i]!.key).toBeCloseTo((r.visitors as number) / of('landing') * t.h! * 100, 1);
    });
    // The first source's ribbons fill its node from the top, one under the other, in the targets' order.
    const first = paths.slice(0, 5).map(ends);
    expect(first[0]!.y0).toBe(0);
    first.slice(1).forEach((e, i) => expect(e.y0).toBeCloseTo(first[i]!.y0 + first[i]!.w0, 1));
    expect(first[4]!.y0 + first[4]!.w0).toBeCloseTo(nodes[0]!.h! * 100, 1);
  });
  it('a pair with no value, or a value of zero, draws no ribbon, and is still a row of the result', () => {
    const holed = { ...result, rows: result.rows.map((r, i) => (i === 1 ? { ...r, visitors: null } : i === 2 ? { ...r, visitors: 0 } : r)) }, scene = run(sankey, 346, null, 'typical', 'svg', holed).ratio;
    expect(ribbons(scene).length).toBe(28);
    expect(scene.nodes.some((n) => n.key === 'primary:link:Search:Blog' || n.key === 'primary:link:Search:Docs')).toBe(false);
    expect(scene.rows!.slice(0, 3)).toEqual(['Search:Home', 'Search:Blog', 'Search:Docs']);
    expect(rects(scene)).toEqual(rects(ratio));
  });
  it('a pair the result says twice has a key and a ribbon for each', () => {
    const twice = { ...result, rows: [...result.rows, { ...result.rows[0]!, visitors: 5 }] }, scene = run(sankey, 346, null, 'typical', 'svg', twice).ratio;
    expect(scene.rows!.slice(-1)).toEqual(['Search#2:Home']);
    expect(new Set(scene.nodes.map((n) => n.key)).size).toBe(scene.nodes.length);
  });
  it('paint follows the source: a series colour for each, its ribbons in that colour as a tint, and a neutral target. Never a colour', () => {
    const order = result.totalsBy!.channel!.map((r) => r.channel);
    for (const n of rects(ratio)) expect(n.paint, n.key).toBe(n.x ? 'ink.muted' : 'series.' + (order.indexOf(n.key.slice('node:channel:'.length)) + 1));
    for (const n of ribbons(ratio)) expect([n.paint, n.tone], n.key).toEqual(['series.' + (order.indexOf(n.row!.split(':')[0]!) + 1), 'soft']);
    expect(ratio.nodes.every((n) => /^(series\.[1-6]|ink(\.muted)?)$/.test(n.paint))).toBe(true);
    expect(JSON.stringify(run(sankey, 346).scene)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
  it('with a limit the totals still cover what it left out, so a column stops short of the foot and a node of its ribbons', () => {
    const spec: Spec = { ...sankey, query: { ...sankey.query, limit: 3 } }, { ratio: cut, result: r } = run(spec, 346);
    expect([r.totalsBy!.channel!.length, r.totalsBy!.landing!.length, r.rows.length]).toEqual([3, 3, 9]);
    const last = rects(cut).filter((n) => n.x === 0).pop()!;
    expect(last.y! + last.h!).toBeLessThan(0.9);
    expect(rects(cut).find((n) => n.key === 'node:channel:Search')!.h).toBeCloseTo((r.totalsBy!.channel![0]!.visitors as number) / r.totals.visitors! * (1 - GAP * 2), 9);
  });
  it('where the engine gives no total the plot is as tall as the taller column, and no value is made of that', () => {
    const none = { ...result, totals: { visitors: null } }, scene = run(sankey, 346, null, 'typical', 'svg', none).ratio, left = rects(scene).filter((n) => n.x === 0);
    expect(left.reduce((s, n) => s + n.h!, 0)).toBeCloseTo(ROOM, 9);
    expect(ribbons(scene).length).toBe(30);
  });
  it('a label for each node, ranked by its size, and place() sets each inside its column and leaves out one that would meet a larger node\'s', () => {
    expect(labels(ratio).map((n) => [n.text, n.x, n.anchor, n.rank])).toEqual([
      ['Search', 0, 'start', 1], ['Direct', 0, 'start', 2], ['Social', 0, 'start', 3], ['AI assistants', 0, 'start', 4], ['Email', 0, 'start', 5], ['Other', 0, 'start', 6],
      ['Home', 1, 'end', 1], ['Blog', 1, 'end', 2], ['Docs', 1, 'end', 3], ['Pricing', 1, 'end', 4], ['Changelog', 1, 'end', 5]]);
    const { scene } = run(sankey, 346), placed = scene.nodes.filter((n) => n.kind === 'text');
    expect(placed.map((n) => n.text)).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Home', 'Blog', 'Docs', 'Pricing', 'Changelog']);
    expect(placed.map((n) => n.x)).toEqual([...Array(5).fill(NODE + 6), ...Array(5).fill(346 - NODE - 6)]);
    expect([scene.height, scene.plot]).toEqual([184, { w: 346, h: 184 }]);
    expect(run(sankey, 346, 160).scene.height).toBe(160);
    // A column's labels a line of 14 apart about their middles, by rank: core's declutter in one dimension.
    expect(declutter([10, 20, 34, 40].map((at, i) => ({ x: 0, w: 1, y: at - 7, h: 14, rank: [2, 1, 3, 4][i] })), 0)).toEqual([true, false, false, true]);
  });
});

describe('prose and errors', () => {
  it('says what a query by two dimensions says: who leads each, as a share of the engine\'s total. Core gives a custom mark no sentence of its own', () => {
    expect(run(sankey, 346).plan.text).toBe('Search is the largest channel at 41% of visitors, and Home the largest landing at 30%.');
    expect(run(sankey, 250).plan.text).toBe('Most visitors at Search, Home (1,378) in the last 28 days. Search is the busiest channel at 41% of visitors, and Home the busiest landing at 30%.');
    expect(run(sankey, 346, null, 'empty').plan.text).toBe('Visitors: nothing recorded in the last 28 days.');
  });
  it('errors name the fix: a wrong encoding, no totals from the engine, too many sources, a second layer, and x2', () => {
    const result = runQuery(sankey.query), at = (spec: Spec, r: Result = result) => err(() => resolve(spec, r, makeContainer(346), catalog));
    expect(at(layered({ x: 'channel', y: 'visitors', size: 'visitors' }))).toBe('The query is by "landing", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
    expect(at({ ...layered({ x: 'channel', y: 'landing', color: 'visitors' }) })).toBe('A "link" layer needs the metric each ribbon is as wide as on size, and this one has undefined there. Encode one of the query\'s metrics: visitors.');
    expect(at({ query: sankey.query, layers: [{ mark: 'link', encode: { x: 'channel', color: 'landing', size: 'visitors' } }] })).toBe('A "link" layer runs from the values of one dimension to the values of another, the source on x and the target on y, and this one has "channel" on x and undefined on y. Encode "channel" on x and "landing" on y.');
    const one = { metrics: ['visitors'], by: ['channel'] };
    expect(at(layered({ x: 'channel', size: 'visitors' }, one), runQuery(one))).toBe('A "link" layer runs from the values of one dimension to the values of another, the source on x and the target on y, and this one has "channel" on x and undefined on y. Make query.by two dimensions, the source and then the target, and encode the first on x and the second on y.');
    expect(at(sankey, { ...result, totalsBy: undefined })).toBe('A "link" layer makes each node as tall as the engine\'s total for its value, and this result has no totalsBy for "channel". Return it from the query layer: a row for each value of "channel", holding its total of "visitors".');
    expect(at(sankey, { ...result, totalsBy: { channel: result.totalsBy!.channel! } })).toMatch(/no totalsBy for "landing"/);
    const many: Spec = { ...sankey, query: { ...sankey.query, by: ['weekday', 'landing'] } };
    expect(at(many, runQuery(many.query))).toBe('Running from "weekday" makes 7 sources, and there are 6 series colours. Add "limit": 6 to the query, or less.');
    expect(at({ ...many, query: { ...many.query, limit: 6 } }, runQuery({ ...many.query, limit: 6 }))).toBeUndefined();
    const enc = { x: 'channel', y: 'landing', size: 'visitors' };
    expect(at({ query: sankey.query, layers: [{ mark: 'link', encode: enc }, { mark: 'link', encode: enc }] })).toBe('A Sankey draws one "link" layer, and this view has 2. Keep one, with the source on x, the target on y and the metric on size.');
    expect(at({ query: sankey.query, layers: [{ mark: 'link', encode: enc }, { mark: 'bar', encode: { x: 'channel', y: 'visitors', color: 'landing' } }] })).toMatch(/^The "link" mark is laid out by its own code, and layer 2 is a "bar"/);
    // The plan gave the target x2. Core keeps that for a mark that runs from one value to another, and says so.
    expect(at(layered({ x: 'channel', x2: 'landing', size: 'visitors' }))).toBe('Layer 1 is a "link" with "x2", and only a bar, a rule or an area runs from one value to another. Use one of those, or remove "x2".');
  });
});

describe('the painter\'s half, as strings', () => {
  it('is the layout of the mark\'s name, whose rules are the mark\'s alone, and reads no colour but a node\'s paint', () => {
    expect([linkPainter.layout, linkPainter.rules]).toEqual(['link', undefined]);
    expect(linkPainter.css).toContain('.uav[data-layout="link"] .uav-plot svg { inset-inline: 8px; inline-size: calc(100% - 16px); }');
    expect(linkPainter.css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
  });
  it('its rules compile to the labels going, and then to the swap for the grid, by width and by height', () => {
    const css = compileFitRules(LINK_RULES);
    expect(css).toContain('@container uav-view (inline-size < 319.5px) {\n  .uav[data-layout="link"]:not([data-keep~="guides"]) .uav-labels { display: none; }');
    expect(css).toContain('@container uav-view (inline-size < 279.5px) {\n  .uav[data-layout="link"]:not([data-keep~="marks"]):has(~ .uav-fallback[data-rule="marks"]) { display: none; }\n  .uav[data-layout="link"]:not([data-keep~="marks"]) ~ .uav-fallback[data-rule="marks"] { display: block; }');
    expect(css).toContain('@container uav-view (block-size < 119.5px)');
    expect(LINK_RULES.map((r) => [r.id, r.fallback])).toEqual([['guides', undefined], ['marks', 'heatmap']]);
  });
});
