import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, PRESETS, buildScene, customMarks, customPresets, expand, fallbackRule, fills, makeContainer, place, resolve, type PainterName, type RectNode, type Result, type Spec, type TextNode } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { compileFitRules } from '@unified-analytics/dom';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { PARTITION_RULES, boxNames, squarify, type Box } from '@unified-analytics/partition';
import { nameFits, partitionPainter, stepBox } from '@unified-analytics/partition/dom';

// Step 9 of docs/uncommon-coverage-plan.md: the `partition` mark, a custom mark that draws a treemap. No prototype
// knows it, so it is held to a sweep, facts and golden scenes of its own.
const treemap = moreSamples.treemap!.spec, tiles = moreSamples.treemap1!.spec;
const limited: Spec = { ...treemap, query: { ...treemap.query, limit: 3 } };
const ramped: Spec = { spec: 'view/0', query: { metrics: ['pageviews', 'visitors'], by: ['section', 'page'], range: '28d' }, layers: [{ mark: 'partition', encode: { x: 'section', detail: 'page', size: 'pageviews', color: 'visitors' } }] };
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', result: Result = runQuery(spec.query, scenario)) => {
  const container = makeContainer(w, h, painter, 8), plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);
const rects = (s: { nodes: unknown[] }) => (s.nodes as RectNode[]).filter((n) => n.part === 'plot' && n.kind === 'rect');
const parents = (s: { nodes: unknown[] }) => rects(s).filter((n) => !n.pair), kids = (s: { nodes: unknown[] }, of?: string) => rects(s).filter((n) => n.pair && (of == null || n.pair[0] === of));
const names = (s: { nodes: unknown[] }) => (s.nodes as TextNode[]).filter((n) => n.part === 'plot' && n.kind === 'text');
const ASPECT = 1.6, area = (b: Box) => b.w * b.h;

describe('squarify', () => {
  const paper = [6, 6, 4, 3, 2, 2, 1];      // the example the method was published with, in a box 6 by 4
  it('gives each value a box whose area is its share, and fills the whole box', () => {
    const boxes = squarify(paper, 6, 4);
    boxes.forEach((b, i) => expect(area(b)).toBeCloseTo(paper[i]!, 9));
    expect(boxes.reduce((s, b) => s + area(b), 0)).toBeCloseTo(24, 9);
    for (const b of boxes) expect(b.x >= 0 && b.y >= 0 && b.x + b.w <= 6 + 1e-9 && b.y + b.h <= 4 + 1e-9).toBe(true);
    // No two overlap: the areas add up to the box and every box is inside it, so it is enough that no two share a middle.
    boxes.forEach((a, i) => boxes.forEach((b, j) => { if (i < j) expect(a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9, i + ' over ' + j).toBe(false); }));
  });
  it('keeps the boxes near square: the paper\'s own layout, and far better than slices side by side', () => {
    const shape = (b: Box) => Math.max(b.w / b.h, b.h / b.w), boxes = squarify(paper, 6, 4);
    expect(boxes.slice(0, 2)).toEqual([{ x: 0, y: 0, w: 3, h: 2 }, { x: 0, y: 2, w: 3, h: 2 }]);
    expect(Math.max(...boxes.map(shape))).toBeLessThan(3);
    expect(boxes.filter((b) => shape(b) <= 1.5).length).toBe(5);
    expect(Math.max(...paper.map((v) => shape({ x: 0, y: 0, w: v / 4, h: 4 })))).toBeGreaterThan(15);
  });
  it('is the same for the same input, and keeps the order it was given', () => {
    expect(squarify(paper, 6, 4)).toEqual(squarify(paper.slice(), 6, 4));
    const turned = squarify(paper.slice().reverse(), 6, 4);
    turned.forEach((b, i) => expect(area(b)).toBeCloseTo(paper[paper.length - 1 - i]!, 9));
  });
  it('leaves the room for the rest of a total empty, after the last box, and never leaves the box', () => {
    const boxes = squarify([6, 6], 6, 4, 24);
    expect(boxes.map(area)).toEqual([6, 6]);
    expect(Math.max(...boxes.map((b) => b.x + b.w))).toBeLessThanOrEqual(3);
    // Values that hold more than the total they were given are fitted to what they hold.
    expect(squarify([6, 6], 6, 4, 6).reduce((s, b) => s + area(b), 0)).toBeCloseTo(24, 9);
    expect(squarify([], 6, 4, 10)).toEqual([]);
    expect(JSON.stringify(squarify([1, 2], 0, 0))).not.toMatch(/NaN|null/);
  });
});

describe('the sweep', () => {
  for (const [name, spec] of Object.entries({ treemap, tiles, limited, ramped })) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, every box inside the one it is set in, and a part that holds its shape', () => {
      for (const sc of scenarios) for (const p of ['svg', 'dots'] as PainterName[]) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
        if (plan.layout !== 'partition') continue;
        for (const n of rects(ratio)) expect(n.x! >= 0 && n.y! >= 0 && n.x! + n.w! <= 1.0001 && n.y! + n.h! <= 1.0001, 'box: ' + at + ' ' + n.key).toBe(true);
        expect(ratio.nodes.every((n) => n.row == null), 'no node is a row: ' + at).toBe(true);
        expect(ratio.aspect).toBe(ASPECT);
        expect(scene.plot!.w / scene.plot!.h, 'shape: ' + at).toBeCloseTo(ASPECT, 9);
        expect(scene.plot!.w, 'width: ' + at).toBeLessThanOrEqual(Math.min(w, 480));
        for (const n of scene.nodes) if (n.kind === 'rect' && !n.key.startsWith('ramp:')) expect(n.x >= 0 && n.y >= 0 && n.x + n.w <= w + 1e-6 && n.y + n.h <= scene.plot!.h + 1e-6, 'outside: ' + at + ' ' + n.key).toBe(true);
      }
    });
  }
  it('one spec is a treemap with room and a list of its query without: then the number, then the prose', () => {
    for (const [spec, list] of [[treemap, 'pair-list'], [tiles, 'bar-list']] as [Spec, string][]) {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      const fell = 'the partition marks (drawn as "' + list + '")';
      for (const sc of scenarios) {
        const at = (w: number, h: number | null = null) => { const { plan, ratio } = run(spec, w, h, sc); return [plan.layout, ratio.parts.join(' '), plan.dropped[0] ?? '']; };
        if (sc === 'empty') { expect([346, 250, 120, 10].map((w) => at(w)[0])).toEqual(['notice', 'notice', 'none', 'prose']); continue; }
        expect(at(700)).toEqual(['partition', 'plot', '']);
        expect(at(346)).toEqual(['partition', 'plot', '']);       // dashboard width
        expect(at(280)).toEqual(['partition', 'plot', '']);
        expect(at(346, 120)).toEqual(['partition', 'plot', '']);
        expect(at(279)).toEqual(['rows', 'rows', fell]);
        expect(at(250)).toEqual(['rows', 'rows', fell]);          // sidebar width
        expect(at(346, 119)).toEqual(['rows', 'rows', fell]);
        expect(at(120)).toEqual(['none', 'number', fell]);
        expect(at(10)[0]).toBe('prose');
      }
    }
  });
  it('the list it becomes is that preset of the same query, to the node, and a spec that keeps its marks does not become one', () => {
    for (const [spec, use] of [[treemap, 'pair-list'], [tiles, 'bar-list'], [limited, 'pair-list']] as [Spec, string][]) {
      const { layers: _layers, ...rest } = spec, list: Spec = { ...rest, use };
      for (const [w, h] of [[250, null], [170, null], [346, 100], [80, null]] as [number, number | null][]) {
        expect(run(spec, w, h).scene, use + ' ' + w + ' ' + h).toEqual(run(list, w, h).scene);
        expect(run(spec, w, h).plan.preset).toBe(use);
      }
    }
    expect(run({ ...treemap, keep: ['marks'] }, 250).plan).toMatchObject({ layout: 'prose', preset: 'treemap' });
    expect(run({ ...treemap, keep: ['marks'] }, 346).plan).toMatchObject({ layout: 'partition', preset: 'treemap', dropped: [] });
  });
});

describe('golden scenes', () => {
  for (const [w, h] of [[346, null], [500, null], [346, 160]] as [number, number | null][]) it(`treemap at ${w} by ${h ?? 'any'}`, () => expect(run(treemap, w, h).scene).toMatchSnapshot());
  for (const [w, h] of [[346, null], [500, null], [346, 160]] as [number, number | null][]) it(`tiles at ${w} by ${h ?? 'any'}`, () => expect(run(tiles, w, h).scene).toMatchSnapshot());
  it('treemap in ratios', () => expect(run(treemap, 346).ratio).toMatchSnapshot());
  it('painted by a second metric, at 346 by any', () => expect(run(ramped, 346).scene).toMatchSnapshot());
});

describe('the fixture: page views by section, and by page in each', () => {
  it('answers with a row for each page under its own section, the engine\'s total for each section and each page, and a whole they divide', () => {
    const { rows, totals, totalsBy } = runQuery(treemap.query);
    expect([rows.length, totalsBy!.section!.length, totalsBy!.page!.length]).toEqual([16, 4, 16]);
    expect(totalsBy!.section!.map((r) => r.section)).toEqual(['Marketing', 'Blog', 'Docs', 'Changelog']);
    expect(new Set(rows.map((r) => r.page)).size).toBe(16);
    expect(rows.filter((r) => r.section === 'Changelog').map((r) => r.page)).toEqual(['/changelog', '/changelog/2026']);
    for (const s of totalsBy!.section!) expect(rows.filter((r) => r.section === s.section).reduce((n, r) => n + (r.pageviews as number), 0), String(s.section)).toBe(s.pageviews);
    expect(Math.abs(totalsBy!.section!.reduce((n, r) => n + (r.pageviews as number), 0) - totals.pageviews!)).toBeLessThanOrEqual(4);
  });
  it('answers no-prior and empty, keeps the first of each dimension under a limit with totals that cover the rest, and refuses the pair the other way round', () => {
    expect(runQuery(treemap.query, 'no-prior').rows.length).toBe(16);
    expect(runQuery(treemap.query, 'empty')).toMatchObject({ rows: [], totalsBy: { section: [], page: [] }, meta: { empty: true } });
    const { rows, totalsBy, totals } = runQuery(limited.query), whole = runQuery(treemap.query);
    expect(rows.map((r) => [r.section, r.page])).toEqual([['Marketing', '/'], ['Marketing', '/pricing'], ['Blog', '/blog/launch-notes']]);
    expect(totalsBy!.section).toEqual(whole.totalsBy!.section!.slice(0, 3));
    expect(totals).toEqual(whole.totals);
    expect(err(() => runQuery({ metrics: ['pageviews'], by: ['page', 'section'] }))).toBe('The fixture has pages inside sections. Query by section and then page: ["section", "page"].');
  });
});

describe('partition, two levels', () => {
  const { ratio, result, plan } = run(treemap, 346), total = result.totals.pageviews!;
  it('is a custom mark, laid out under its own name, and its preset is the layer written out', () => {
    expect(customMarks().has('partition')).toBe(true);
    expect([plan.layout, ratio.layout, plan.preset, ratio.parts]).toEqual(['partition', 'partition', 'treemap', ['plot']]);
    expect([...customPresets().keys()]).toEqual(expect.arrayContaining(['treemap', 'pair-list']));
    expect(PRESETS).not.toHaveProperty('treemap');
    expect(expand(treemap).layers).toEqual([{ mark: 'partition', encode: { x: 'section', detail: 'page', size: 'pageviews' } }]);
    const { use: _use, ...rest } = treemap, written: Spec = { ...rest, layers: expand(treemap).layers };
    for (const [w, h] of [[346, null], [250, null], [346, 100]] as [number, number | null][]) expect(run(treemap, w, h).scene).toEqual(run(written, w, h).scene);
    expect(err(() => expand({ ...treemap, query: { metrics: ['pageviews'], by: ['section'] } }))).toBe('The "treemap" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  });
  it('gives each parent a box by the engine\'s total for it, as a share of the engine\'s total, in the engine\'s order', () => {
    expect(parents(ratio).map((n) => n.key)).toEqual(result.totalsBy!.section!.map((r) => 'primary:partition:' + r.section));
    parents(ratio).forEach((n, i) => expect(n.w! * n.h!, n.key).toBeCloseTo((result.totalsBy!.section![i]!.pageviews as number) / total, 4));
    // The whole box is the total: the parents fill it, to the rounding of the engine's own rows.
    expect(parents(ratio).reduce((s, n) => s + n.w! * n.h!, 0)).toBeCloseTo(1, 3);
  });
  it('gives each child a box in its parent\'s, by its value against the parent\'s total, and the pair of values it came from', () => {
    expect(kids(ratio).length).toBe(16);
    for (const top of result.totalsBy!.section!) {
      const mine = kids(ratio, String(top.section)), rows = result.rows.filter((r) => r.section === top.section);
      expect(mine.map((n) => n.pair![1])).toEqual(rows.map((r) => r.page));
      mine.forEach((n, i) => expect(n.w! * n.h!, n.key).toBeCloseTo((rows[i]!.pageviews as number) / (top.pageviews as number), 4));
      expect(mine.reduce((s, n) => s + n.w! * n.h!, 0)).toBeCloseTo(1, 4);
    }
    // A parent's children come after it, before the next parent.
    expect(rects(ratio).slice(0, 7).map((n) => n.key.replace('primary:partition:', ''))).toEqual(['Marketing', 'Marketing:/', 'Marketing:/pricing', 'Marketing:/about', 'Marketing:/customers', 'Marketing:/contact', 'Blog']);
  });
  it('paints a series colour for each parent, its children in that colour, and the parent as the tint they stand on: tokens, never colours', () => {
    expect(parents(ratio).map((n) => [n.paint, n.tone, n.opacity, n.layer])).toEqual([1, 2, 3, 4].map((i) => ['series.' + i, 'soft', 0.14, 'data']));
    for (const [i, top] of result.totalsBy!.section!.entries()) expect(kids(ratio, String(top.section)).every((n) => n.paint === 'series.' + (i + 1) && n.tone == null && n.role === 'primary')).toBe(true);
    expect(ratio.nodes.filter((n) => n.part === 'plot').every((n) => /^(series\.\d|ink|background)$/.test(n.paint))).toBe(true);
  });
  it('names every box after it, ranked by area with the largest first: a parent in its own colour, a child in the colour of the ground', () => {
    const boxes = rects(ratio), labels = names(ratio);
    expect(labels.length).toBe(boxes.length);
    ratio.nodes.filter((n) => n.part === 'plot').forEach((n, i, all) => { if (n.kind === 'rect') expect(all[i + 1]).toMatchObject({ kind: 'text', key: n.key + ':label' }); });
    expect(labels.map((n) => n.rank).sort((a, b) => a! - b!)).toEqual(labels.map((_, i) => i));
    expect(labels.filter((n) => n.rank! < 5).sort((a, b) => a.rank! - b.rank!).map((n) => n.text)).toEqual(['Marketing', 'Blog', 'Docs', '/', '/pricing']);
    expect(labels.find((n) => n.text === 'Blog')).toMatchObject({ paint: 'series.2', font: 'tick', layer: 'guide' });
    expect(labels.find((n) => n.text === '/pricing')).toMatchObject({ paint: 'background', font: 'tick', layer: 'guide' });
    expect(labels.some((n) => n.halo)).toBe(false);
  });
  it('its rows are the result\'s, in the result\'s order', () => {
    expect(ratio.rows).toEqual(result.rows.map((r) => r.section));
  });
  it('draws no box for a value that is null or zero, and none at all where the engine gives no total', () => {
    const holed = { ...result, rows: result.rows.map((r) => (r.page === '/pricing' ? { ...r, pageviews: null } : r.page === '/about' ? { ...r, pageviews: 0 } : r)),
      totalsBy: { ...result.totalsBy, section: result.totalsBy!.section!.map((r) => (r.section === 'Docs' ? { ...r, pageviews: 0 } : r)) } };
    const scene = run(treemap, 346, null, 'typical', 'svg', holed).ratio;
    expect(parents(scene).map((n) => n.key)).toEqual(['primary:partition:Marketing', 'primary:partition:Blog', 'primary:partition:Changelog']);
    expect(parents(scene).map((n) => n.paint)).toEqual(['series.1', 'series.2', 'series.3']);
    expect(kids(scene, 'Marketing').map((n) => n.pair![1])).toEqual(['/', '/customers', '/contact']);
    expect(kids(scene, 'Docs')).toEqual([]);
    for (const none of [null, 0]) expect(rects(run(treemap, 346, null, 'typical', 'svg', { ...result, totals: { pageviews: none } }).ratio)).toEqual([]);
  });
  it('with a limit the boxes stop short: the parents left out leave the end of the box unpainted, and the children left out the end of their parent\'s', () => {
    const { ratio: short, result: r } = run(limited, 346);
    expect(parents(short).map((n) => n.key)).toEqual(['primary:partition:Marketing', 'primary:partition:Blog', 'primary:partition:Docs']);
    // The parents are where they were with every row: a limit moves nothing that is still drawn.
    expect(parents(short)).toEqual(parents(ratio).slice(0, 3));
    expect(parents(short).reduce((s, n) => s + n.w! * n.h!, 0)).toBeCloseTo(1 - 2506 / r.totals.pageviews!, 3);
    expect(kids(short, 'Marketing').reduce((s, n) => s + n.w! * n.h!, 0)).toBeCloseTo((5181 + 3282) / 10526, 4);
    expect(kids(short, 'Marketing')).toEqual(kids(ratio, 'Marketing').slice(0, 2));
    expect(kids(short, 'Docs')).toEqual([]);
  });
  it('two dimensions with no totalsBy is an error, and so is a row whose parent has no total', () => {
    const { totalsBy: _totalsBy, ...bare } = result;
    expect(err(() => run(treemap, 346, null, 'typical', 'svg', bare))).toBe('A "partition" layer divided by "section" and then "page" sizes each "section" by the engine\'s total for it, and this result has no totalsBy["section"]. Return totalsBy from the query layer, or remove "page" from detail and from query.by, for one level.');
    const orphan = { ...result, rows: [...result.rows, { section: 'Shop', page: '/shop', pageviews: 9 }] };
    expect(err(() => run(treemap, 346, null, 'typical', 'svg', orphan))).toBe('The result has a row for the "section" "Shop", and totalsBy["section"] has no total for it, so there is no box to put it in. Return a total for every "section" the rows hold.');
  });
  it('keys stay unique where two rows say one value, or a value holds the separator', () => {
    const odd = { ...result, rows: [...result.rows, { section: 'Blog', page: '/blog', pageviews: 5 }, { section: 'Blog', page: '/blog:label', pageviews: 5 }] };
    const all = run(treemap, 346, null, 'typical', 'svg', odd).ratio.nodes.map((n) => n.key);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('primary:partition:Blog:/blog#2');
  });
});

describe('partition, one level', () => {
  const { ratio, result, plan } = run(tiles, 346), total = result.totals.visitors!;
  it('with one dimension and no detail, each row is a box by its own value against the engine\'s total, in a series colour', () => {
    expect([plan.layout, plan.preset, kids(ratio).length]).toEqual(['partition', null, 0]);
    expect(parents(ratio).map((n) => n.key)).toEqual(result.rows.map((r) => 'primary:partition:' + r.channel));
    parents(ratio).forEach((n, i) => expect(n.w! * n.h!).toBeCloseTo((result.rows[i]!.visitors as number) / total, 4));
    expect(parents(ratio).map((n) => [n.paint, n.tone, n.layer])).toEqual([1, 2, 3, 4, 5, 6].map((i) => ['series.' + i, undefined, 'data']));
    expect(names(ratio).map((n) => [n.text, n.paint])).toEqual(result.rows.map((r) => [r.channel, 'background']));
  });
  it('more than six boxes is an error that names the fix, and a metric on color spends no series colour', () => {
    const pages: Spec = { query: { metrics: ['pageviews', 'visitors'], by: ['page'] }, layers: [{ mark: 'partition', encode: { x: 'page', size: 'pageviews' } }] };
    expect(err(() => run(pages, 346))).toBe('Dividing by "page" makes 8 boxes, and there are 6 series colours. Add "limit": 6 to the query, or less, or encode a metric on color to paint every box by the ramp.');
    expect(parents(run({ ...pages, query: { ...pages.query, limit: 6 } }, 346).ratio).length).toBe(6);
    const by = run({ ...pages, layers: [{ mark: 'partition', encode: { x: 'page', size: 'pageviews', color: 'visitors' } }] }, 346).ratio;
    expect([parents(by).length, parents(by).every((n) => /^seq\.\d+$/.test(n.paint)), by.parts]).toEqual([8, true, ['plot', 'ramp']]);
  });
});

describe('partition, painted by a second metric', () => {
  const { ratio, result } = run(ramped, 346);
  it('paints every child a step of the ramp between the least and the most of them, and the parents as the ground of no value', () => {
    const vals = result.rows.map((r) => r.visitors as number), lo = Math.min(...vals), hi = Math.max(...vals);
    for (const n of kids(ratio)) { const v = result.rows.find((r) => r.page === n.pair![1])!.visitors as number; expect(n.paint, n.key).toBe('seq.' + Math.min(10, 1 + Math.floor(((v - lo) / (hi - lo)) * 10))); }
    expect(parents(ratio).every((n) => n.paint === 'seq.none' && n.layer === 'guide' && n.role === 'context' && n.tone == null)).toBe(true);
    // The boxes are where they are without it: the colour changes no area.
    const plain = run({ ...ramped, layers: [{ mark: 'partition', encode: { x: 'section', detail: 'page', size: 'pageviews' } }] }, 346).ratio;
    expect(rects(ratio).map(({ x, y, w, h }) => [x, y, w, h])).toEqual(rects(plain).map(({ x, y, w, h }) => [x, y, w, h]));
  });
  it('has the ramp a grid has, as a guide that goes first, and its names are in ink with a halo', () => {
    expect(ratio.parts).toEqual(['plot', 'ramp']);
    expect(ratio.nodes.filter((n) => n.part === 'ramp').map((n) => n.key)).toEqual(['ramp:low', ...Array.from({ length: 10 }, (_, i) => 'ramp:' + (i + 1)), 'ramp:high']);
    expect(names(ratio).filter((n) => n.key.split(':').length > 4).every((n) => n.paint === 'ink' && n.halo)).toBe(true);
    expect(names(ratio).find((n) => n.text === 'Docs')).toMatchObject({ paint: 'ink.muted' });
    expect([run(ramped, 319).ratio.parts, run(ramped, 319).plan.dropped]).toEqual([['plot'], ['the colour ramp']]);
    expect(run(ramped, 346).scene.nodes.find((n) => n.key === 'ramp:1')).toMatchObject({ ty: 346 / ASPECT });
  });
  it('takes the diverging ramp where the metric on color crosses zero, as a grid does, with zero said in its middle', () => {
    const mid = result.rows.map((r) => r.visitors as number).sort((a, b) => a - b)[result.rows.length >> 1]!;
    const signed = run(ramped, 346, null, 'typical', 'svg', { ...result, rows: result.rows.map((r) => ({ ...r, visitors: (r.visitors as number) - mid })) });
    expect(kids(signed.ratio).every((n) => /^div\.[1-9]$/.test(n.paint))).toBe(true);
    expect(signed.ratio.nodes.filter((n) => n.part === 'ramp').map((n) => n.key)).toEqual(['ramp:low', 'ramp:1', 'ramp:2', 'ramp:3', 'ramp:4', 'ramp:5', 'ramp:zero', 'ramp:6', 'ramp:7', 'ramp:8', 'ramp:9', 'ramp:high']);
    expect(signed.scene.nodes.some((n) => n.key === 'ramp:zero')).toBe(true);
  });
});

describe('place()', () => {
  it('fits a box of the part\'s shape inside the room, in the middle, with parents 2 px apart and children 1 px', () => {
    const wide = run(treemap, 346).scene, boxed = run(treemap, 346, 160).scene, most = run(treemap, 700).scene;
    expect([wide.plot, wide.height]).toEqual([{ w: 346, h: 346 / ASPECT }, Math.ceil(346 / ASPECT)]);
    expect([boxed.plot!.h, boxed.height, most.plot!.w]).toEqual([160, 160, 480]);
    const at = (s: typeof wide, k: string) => s.nodes.find((n) => n.key === 'primary:partition:' + k) as unknown as Box & { rx: number };
    const node = parents(run(treemap, 346).ratio)[0]!;
    expect(at(wide, 'Marketing')).toMatchObject({ x: 1, y: 1, w: node.w! * 346 - 2, h: 346 / ASPECT - 2 });
    expect([at(most, 'Marketing').x, at(boxed, 'Marketing').x]).toEqual([111, (346 - 160 * ASPECT) / 2 + 1]);
    // A child is set in the room under its parent's name, a line of 16 px.
    expect(at(wide, 'Marketing:/')).toMatchObject({ x: 1, y: 17, w: node.w! * 346 - 2 });
    const one = run(tiles, 346).scene.nodes.filter((n) => n.kind === 'rect') as unknown as Box[];
    expect(one[0]).toMatchObject({ x: 1, y: 1 });
  });
  it('sets a name only where it fits its box, by its length, and a child\'s only where its parent\'s is set', () => {
    const shown = (w: number, h: number | null = null, spec = treemap) => run(spec, w, h).scene.nodes.filter((n) => n.kind === 'text').map((n) => (n as { text: string }).text);
    expect(shown(346)).toEqual(['Marketing', '/', '/pricing', '/about', 'Blog', '/blog', 'Docs', '/docs/api', 'Changelog']);
    expect(shown(500).length).toBeGreaterThan(shown(346).length);
    expect(shown(346, 120).length).toBeLessThan(shown(346).length);
    // Every name set is inside the box it names.
    const { scene } = run(treemap, 500), rs = scene.nodes.filter((n) => n.kind === 'rect') as unknown as (Box & { key: string })[];
    for (const n of scene.nodes) if (n.kind === 'text') { const b = rs.find((r) => r.key + ':label' === n.key)!; expect(n.x >= b.x && n.x + n.text.length * 6 <= b.x + b.w && n.y >= b.y && n.y <= b.y + b.h, n.key).toBe(true); }
    // A parent too narrow for its name takes its children's names with it.
    const narrow = { ...runQuery(treemap.query) };
    narrow.totalsBy = { ...narrow.totalsBy, section: narrow.totalsBy!.section!.map((r) => (r.section === 'Marketing' ? { ...r, section: 'Marketing and everything else on the site' } : r)) };
    narrow.rows = narrow.rows.map((r) => (r.section === 'Marketing' ? { ...r, section: 'Marketing and everything else on the site' } : r));
    const texts = run(treemap, 346, null, 'typical', 'svg', narrow).scene.nodes.filter((n) => n.kind === 'text').map((n) => (n as { text: string }).text);
    expect(texts).toEqual(['Blog', '/blog', 'Docs', '/docs/api', 'Changelog']);
    expect(shown(346, null, tiles)).toEqual(['Search', 'Direct', 'Social', 'Email', 'Other']);
  });
});

describe('names, prose and errors', () => {
  it('every box says its value: a parent the engine\'s total for it, a child its own under its parent\'s name', () => {
    const result = runQuery(treemap.query), said = boxNames({ layers: expand(treemap).layers!, query: treemap.query, result, catalog });
    expect(said.size).toBe(20);
    expect(said.get('primary:partition:Marketing')).toEqual({ says: 'Marketing: Page views 10.5k', row: result.totalsBy!.section![0], rows: result.rows.slice(0, 5) });
    expect(said.get('primary:partition:Marketing:/pricing')).toEqual({ says: 'Marketing, /pricing: Page views 3,282', row: result.rows[1], rows: [result.rows[1]] });
    expect([...said.keys()]).toEqual(rects(run(treemap, 346).ratio).map((n) => n.key));
    const both = runQuery(ramped.query);
    expect(boxNames({ layers: ramped.layers!, query: ramped.query, result: both, catalog }).get('primary:partition:Docs:/docs/api')!.says).toMatch(/^Docs, \/docs\/api: Page views [\d,]+; Visitors [\d,]+$/);
    expect(boxNames({ layers: tiles.layers!, query: tiles.query, result: runQuery(tiles.query), catalog }).get('primary:partition:Search')!.says).toBe('Search: Visitors 4,318');
  });
  it('the prose names the largest parent and its share of the engine\'s total, and with one dimension it is the ranked sentence', () => {
    expect(run(treemap, 346).plan.text).toBe('Marketing is the largest section at 42% of page views, and / the largest page at 21%.');
    expect(run(treemap, 250).plan.text).toBe(run(treemap, 346).plan.text);
    expect(run(tiles, 346).plan.text).toBe('Top channels by visitors, last 28 days: Search (4,318), Direct (2,949), Social (1,474).');
    expect(run(treemap, 346, null, 'empty').plan.text).toBe('Page views: nothing recorded in the last 28 days.');
  });
  it('errors name the fix', () => {
    const q = treemap.query, drawn = expand(treemap).layers!, of = (layers: Spec['layers'], query = q) => err(() => run({ spec: 'view/0', query, layers }, 346));
    expect(of([{ mark: 'partition', encode: { detail: 'page', size: 'pageviews' } }])).toBe('The query is by "section", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, for a colour and a legend entry each, or on detail, for a series each in one paint, or remove it from query.by.');
    expect(of([{ mark: 'partition', encode: { size: 'pageviews' } }], { metrics: ['pageviews'], by: ['section'] })).toBe('A "partition" layer needs the dimension to divide the box by on x, and this one has undefined there. Encode one of the query\'s dimensions on x: section.');
    expect(of([{ mark: 'partition', encode: { x: 'section', detail: 'page' } }])).toBe('A "partition" layer needs a metric on size, which each box\'s area is a share of, and this one has undefined there. Encode one of the query\'s metrics on size: pageviews.');
    expect(of([{ mark: 'partition', encode: { x: 'section', size: 'page' } }])).toMatch(/^Layer 1 encodes "page" on size, and a size is a quantity\./);
    expect(of([{ mark: 'partition', encode: { x: 'section', size: 'pageviews' } }])).toMatch(/^The query is by "page", and no layer encodes it/);
    expect(of([{ mark: 'partition', encode: { x: 'section', detail: 'section', size: 'pageviews', color: 'page' } }])).toMatch(/^Layer 1 encodes "page" on color and "section" on detail, and a layer is split into series once/);
    expect(of([{ mark: 'partition', encode: { x: 'page', detail: 'page', size: 'pageviews' } }], { metrics: ['pageviews'], by: ['page'], limit: 6 })).toBe('A "partition" layer divides by the dimension on x and then by the one on detail, and this one has "page" on both. Remove "detail", for one level.');
    expect(of([{ mark: 'partition', encode: { x: 'page', size: 'pageviews', color: 'page' } }], { metrics: ['pageviews'], by: ['page'], limit: 6 })).toBe('A "partition" layer takes a metric on color, to paint every box by the ramp, and this one has "page" there. Encode one of the query\'s metrics on color, or remove it: each "page" then has a series colour.');
    expect(of([{ mark: 'partition', encode: { x: 'section', detail: 'country', size: 'pageviews' } }])).toMatch(/^Layer 1 encodes "country" on detail, and detail splits a layer by one of the query's dimensions: section, page\./);
    expect(of([...drawn, ...drawn])).toBe('A treemap draws one "partition" layer, and this view has 2. Put the dimension to divide by on x, the one to divide each part by on detail, and the metric on size, in one layer.');
    expect(of([...drawn, { mark: 'bar', encode: { x: 'section', y: 'pageviews' } }])).toBe('The "partition" mark is laid out by its own code, and layer 2 is a "bar". Keep the "partition" layers alone, and draw the others as a view of their own.');
  });
});

describe('a layout with a fallback for each shape of query', () => {
  it('a preset is one the query can fill when it has a field for every slot the preset names', () => {
    const one = { metrics: ['pageviews'], by: ['section'] }, two = { metrics: ['pageviews'], by: ['section', 'page'] };
    expect([fills('pair-list', two), fills('pair-list', one), fills('bar-list', one), fills('bar-list', two), fills('heatmap', one), fills('funnel', one), fills('funnel', { ...one, metrics: ['a', 'b'] }), fills('bar-list', { metrics: ['a'] }), fills('gauge', { metrics: ['a'] })])
      .toEqual([true, false, true, true, false, false, true, false, true]);
    // A name nobody has is not answered here: expand() refuses it, by name.
    expect(fills('no-such-preset', one)).toBe(true);
  });
  it('the rule that applies is the first whose preset the query can fill, and with nothing asked it is the first, as it was', () => {
    const rule = (q: Spec['query']) => fallbackRule(PARTITION_RULES, 'partition', [], [], { marks: ['partition'], fills: (use) => fills(use, q) })?.fallback;
    expect([rule(treemap.query), rule(tiles.query)]).toEqual(['pair-list', 'bar-list']);
    expect(fallbackRule(PARTITION_RULES, 'partition')?.fallback).toBe('pair-list');
    expect(fallbackRule(PARTITION_RULES, 'partition', ['marks'], [], { marks: ['partition'], fills: () => true })).toBeUndefined();
  });
  it('the list of pairs is rows in the engine\'s order, each named by both dimensions, and it needs both', () => {
    const { ratio, result, plan } = run({ ...treemap, use: 'pair-list' }, 346);
    expect([plan.layout, ratio.rows!.length]).toEqual(['rows', 16]);
    const texts = (ratio.nodes as TextNode[]).filter((n) => n.part === 'rows' && n.kind === 'text').slice(0, 3).map((n) => n.text);
    expect(texts).toEqual(['Marketing', '/', '5,181']);
    expect(result.rows[0]).toMatchObject({ section: 'Marketing', page: '/' });
    expect(err(() => expand({ ...tiles, layers: undefined, use: 'pair-list' }))).toBe('The "pair-list" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  });
});

describe('the painter\'s half, as strings and plain functions', () => {
  it('is the layout of the mark\'s name, whose rules are the mark\'s alone, and its part holds the scene\'s aspect', () => {
    expect([partitionPainter.layout, partitionPainter.rules]).toEqual(['partition', undefined]);
    expect(partitionPainter.css).toContain('.uav[data-layout="partition"] .uav-plot { flex: none; align-self: center; inline-size: min(100%, 480px); aspect-ratio: var(--uav-aspect, 1.6);');
    expect(partitionPainter.css).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
  it('its rules compile to the ramp going, and then to the swap for the list, by width and by height', () => {
    const css = compileFitRules(PARTITION_RULES, { partition: partitionPainter.fit ?? {} }), fig = (keep: string) => '.uav[data-layout="partition"]:not([data-keep~="' + keep + '"])';
    expect(css).toContain('@container uav-view (inline-size < 319.5px) {\n  ' + fig('guides') + ' :is(.uav-ramp, .uav-size) { display: none; }\n}');
    const swap = '  ' + fig('marks') + ':has(~ .uav-fallback[data-rule="marks"]) { display: none; }\n  ' + fig('marks') + ' ~ .uav-fallback[data-rule="marks"] { display: block; }\n}';
    expect(css).toContain('@container uav-view (inline-size < 279.5px) {\n' + swap);
    expect(css).toContain('@container uav-view (block-size < 119.5px) {\n' + swap);
  });
  it('a name fits where its box is as wide and as tall as it is', () => {
    expect([nameFits({ width: 40, height: 14 }, { width: 40.2, height: 16 }), nameFits({ width: 41, height: 14 }, { width: 40, height: 16 }), nameFits({ width: 30, height: 14 }, { width: 40, height: 9 })]).toEqual([true, false, false]);
  });
  it('the keys: left and right among the parents, down into a parent and left and right among its children, up and out', () => {
    const parent = { at: 1, count: 4, depth: 0 as const, kids: 5 }, child = { at: 0, count: 5, depth: 1 as const, kids: 0 };
    expect(stepBox('ArrowRight', null)).toEqual({ to: 'first', at: 0 });
    expect(stepBox('ArrowDown', null)).toEqual({ to: 'first', at: 0 });
    expect([stepBox('ArrowRight', parent), stepBox('ArrowLeft', parent), stepBox('ArrowRight', { ...parent, at: 3 }), stepBox('ArrowLeft', { ...parent, at: 0 })]).toEqual([{ to: 'sibling', at: 2 }, { to: 'sibling', at: 0 }, { to: 'sibling', at: 3 }, { to: 'sibling', at: 0 }]);
    expect([stepBox('ArrowDown', parent), stepBox('ArrowDown', { ...parent, kids: 0 }), stepBox('ArrowUp', parent)]).toEqual([{ to: 'child', at: 0 }, null, null]);
    expect([stepBox('ArrowRight', child), stepBox('ArrowLeft', child), stepBox('ArrowUp', child), stepBox('ArrowDown', child)]).toEqual([{ to: 'sibling', at: 1 }, { to: 'sibling', at: 0 }, { to: 'parent', at: 0 }, null]);
    expect([stepBox('Enter', parent), stepBox('a', null)]).toEqual([null, null]);
  });
});
