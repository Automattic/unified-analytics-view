import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, customMarks, makeContainer, place, registerMark, resolve, seqScale } from '@unified-analytics/core';
import type { CustomMark, FitRule, Part, RectNode, Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';

// Step 8 of docs/chart-coverage-plan.md, part 1: the registry of custom marks. Held here with a mark made for the
// test, so nothing in it depends on a map. The `geo` mark is in test/geo.test.ts, and `fallback` in test/fallback.test.ts.
const RULES: FitRule[] = [
  { id: 'guides', layout: 'toy', container: 'view', needs: { inline: 200 }, hide: ['ramp'], keep: 'guides' },
  { id: 'marks', layout: 'toy', container: 'view', needs: { inline: 150, block: 50 }, hide: [], fallback: 'bar-list', keep: 'marks' },
];
// A strip of tiles, one for each row, filled by a metric. It reads its encodings and nothing else.
const toy: CustomMark = {
  rules: RULES,
  scene({ layers, guides, result }) {
    const { x, color } = layers[0]!.encode as { x: string; color: string }, rows = result.rows, seq = seqScale(rows.map((r) => r[color] as number));
    const tiles = rows.map((r, i): RectNode => ({ key: 'primary:toy:' + r[x], part: 'plot', kind: 'rect', x: i / rows.length, w: 1 / rows.length, row: String(r[x]), paint: seq.paint(r[color] as number), layer: 'data', role: 'primary' }));
    const parts: Part[] = guides.ramp ? ['plot', 'ramp'] : ['plot'];
    return { nodes: [...tiles, ...seq.ramp(false)], rows: rows.map((r) => String(r[x])), parts };
  },
  place: (scene, W) => ({ height: 40, nodes: scene.nodes.filter((n): n is RectNode => n.part === 'plot' && n.kind === 'rect').map((n) => ({ key: n.key, kind: 'rect', x: n.x! * W, y: 0, w: n.w! * W, h: 40, rx: 0, paint: n.paint, layer: n.layer })) }),
};
registerMark('toy', toy);

const tiles: Spec = { spec: 'view/0', title: 'Tiles', query: { metrics: ['pageviews'], by: ['page'], range: '28d', limit: 8 }, layers: [{ mark: 'toy', encode: { x: 'page', color: 'pageviews' } }] };
const run = (spec: Spec, w: number, h: number | null = null) => {
  const container = makeContainer(w, h), result = runQuery(spec.query), plan = resolve(spec, result, container, catalog), ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container) };
};
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);

describe('the registry', () => {
  it('is a map and two functions: a mark is registered under a name, and found by it', () => {
    expect(customMarks().get('toy')).toBe(toy);
    expect([...customMarks().keys()]).toContain('toy');
  });
  it('refuses a name core has, as a mark or as a layout, and one that is not a name', () => {
    expect(err(() => registerMark('bar', toy))).toBe('A custom mark cannot be named "bar", which core has already. Register it under another name.');
    expect(err(() => registerMark('rows', toy))).toBe('A custom mark cannot be named "rows", which core has already. Register it under another name.');
    expect(err(() => registerMark('my mark', toy))).toBe('A custom mark cannot be named "my mark": the name is written into specs and selectors. Use letters, digits, "_" and "-" only.');
    expect(customMarks().has('bar')).toBe(false);
  });
  it('the schema takes any name for a mark, and resolve() checks it: an unknown one is an error that lists the marks there are', () => {
    expect(view(tiles), JSON.stringify(view.errors)).toBe(true);
    expect(view({ ...tiles, layers: [{ mark: 'nope' }] })).toBe(true);
    expect(view({ ...tiles, layers: [{ mark: 'not a name' }] })).toBe(false);
    const says = err(() => run({ ...tiles, layers: [{ mark: 'nope', encode: { x: 'page' } }] }, 346))!;
    expect(says).toMatch(/^Layer 1 has the mark "nope", which is not built in and is not registered\. Built in: line, area, bar, rule, dot, text, .*arc, cell\. Registered: .*toy.*\. Use one of those, or register it with registerMark\("nope", …\) before the view is resolved\.$/);
  });
});

describe('a custom mark in a view', () => {
  it('is a layout of its own, under its own name: its scene is its builder\'s, with the number core gives every view', () => {
    const { plan, ratio } = run(tiles, 346);
    expect(plan).toMatchObject({ layout: 'toy', preset: null, dropped: [], guides: { ramp: true, size: true } });
    expect(ratio).toMatchObject({ layout: 'toy', parts: ['plot', 'ramp'] });
    expect(ratio.rows).toEqual(runQuery(tiles.query).rows.map((r) => r.page));
    expect(ratio.nodes.filter((n) => n.part === 'plot').map((n) => n.paint)).toEqual(['seq.10', 'seq.6', 'seq.5', 'seq.4', 'seq.2', 'seq.1', 'seq.1', 'seq.1']);
    expect(ratio.nodes.filter((n) => n.part === 'number').map((n) => n.key)).toEqual(['value', 'sub']);
    expect(plan.text).toBe('Top pages by page views, last 28 days: / (4,820), /pricing (2,960), /blog/launch-notes (2,105).');
  });
  it('place() asks the mark for its own parts, and sets its ramp under them', () => {
    const { scene } = run(tiles, 346), at = (k: string) => scene.nodes.find((n) => n.key === k) as unknown as Record<string, number>;
    expect(scene.height).toBe(40 + 24);
    expect(at('primary:toy:/pricing')).toMatchObject({ x: 346 / 8, w: 346 / 8, h: 40 });
    expect(at('ramp:1')).toMatchObject({ ty: 40, y: 8 });
    expect(run({ ...tiles, layers: tiles.layers }, 180).scene.height).toBe(40);
  });
  it('gives up its guides under its `guides` rule, or where the scene is too tall with them', () => {
    const at = (w: number, h: number | null = null, keep?: Spec['keep']) => { const { plan, ratio } = run({ ...tiles, keep }, w, h); return [plan.layout, ratio.parts.join(' '), plan.dropped.join('; ')]; };
    expect(at(200)).toEqual(['toy', 'plot ramp', '']);
    expect(at(199)).toEqual(['toy', 'plot', 'the colour ramp']);
    expect(at(199, null, ['guides'])).toEqual(['toy', 'plot ramp', '']);
    // Kept marks do not fall back. Under their need the steps that are left are tried, as for any layout.
    expect(at(149, null, ['marks'])).toEqual(['prose', '', 'the colour ramp; the number (kept the sentence)']);
    // No rule says how tall its keys are: the scene is measured, as every layout's is.
    expect(at(346, 60)).toEqual(['toy', 'plot', 'the colour ramp']);
  });
  it('draws its layers alone', () => {
    expect(err(() => run({ ...tiles, layers: [...tiles.layers!, { mark: 'text', encode: { y: 'page', text: 'page' } }] }, 346)))
      .toBe('The "toy" mark is laid out by its own code, and layer 2 is a "text". Keep the "toy" layers alone, and draw the others as a view of their own.');
  });
});

describe('a custom mark whose rule names a fallback', () => {
  it('under the rule\'s need the view is that preset, planned again from the same query: the bar list a spec that asked for one would get, to the node', () => {
    const wide = run(tiles, 150), narrow = run(tiles, 149), pages = run(samples.pages!.spec, 149);
    expect(wide.plan.layout).toBe('toy');
    expect(narrow.plan).toMatchObject({ layout: 'rows', preset: 'bar-list', dropped: ['the toy marks (drawn as "bar-list")'] });
    expect(narrow.scene).toEqual(pages.scene);
    expect(narrow.plan.layers).toEqual(pages.plan.layers);
    expect(run(tiles, 346, 49).plan).toMatchObject({ layout: 'rows', preset: 'bar-list' });
  });
});
