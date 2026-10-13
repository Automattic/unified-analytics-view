import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { PRESETS, buildScene, customMarks, customPresets, expand, makeContainer, place, registerMark, registerPreset, resolve, seqScale } from '@unified-analytics/core';
import type { CustomMark, FitRule, Part, PresetLibrary, RectNode, Spec } from '@unified-analytics/core';
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

// Step 7 of docs/uncommon-coverage-plan.md: the registry of presets, beside the one for marks. Core cannot name a
// custom mark, so the package that registers one registers the presets that draw it. Held here with the toy mark.
const strip: PresetLibrary[string] = { layers: [{ mark: 'toy', encode: { x: '$by', color: '$metric' } }] };
const registered = () => [...customPresets().keys()].join(', ');

describe('the registry of presets', () => {
  it('is a map and two functions: a preset is registered under a name, found by it, and replaced by the next under that name', () => {
    const first: PresetLibrary[string] = { layers: [{ mark: 'bar', encode: { y: '$by', x: '$metric' } }] };
    registerPreset('toy-strip', first);
    expect(customPresets().get('toy-strip')).toBe(first);
    expect(expand({ use: 'toy-strip', query: tiles.query }).layers).toEqual([{ mark: 'bar', encode: { y: 'page', x: 'pageviews' } }]);
    registerPreset('toy-strip', strip);
    expect(customPresets().get('toy-strip')).toBe(strip);
    expect([...customPresets().keys()].filter((n) => n === 'toy-strip')).toEqual(['toy-strip']);
    expect(expand({ use: 'toy-strip', query: tiles.query }).layers).toEqual(tiles.layers);
  });
  it('refuses a name that is not a name, a name core\'s library has, and a preset with no layers, and each error names the fix', () => {
    expect(err(() => registerPreset('my preset', strip))).toBe('A preset cannot be named "my preset": the name is written into specs. Use letters, digits, "_" and "-" only.');
    expect(err(() => registerPreset('', strip))).toBe('A preset cannot be named "": the name is written into specs. Use letters, digits, "_" and "-" only.');
    expect(err(() => registerPreset('bar-list', strip))).toBe('A preset cannot be named "bar-list", which core has already. Register it under another name.');
    const none = 'The preset "toy-none" has no layers, so a view that uses it would have nothing to draw. Hand registerPreset() { layers: [...] } with one layer at least.';
    for (const p of [{ layers: [] }, {}, null, undefined, { layers: 'bar' }]) expect(err(() => registerPreset('toy-none', p as unknown as PresetLibrary[string]))).toBe(none);
    for (const n of ['my preset', '', 'toy-none']) expect(customPresets().has(n)).toBe(false);
    expect(PRESETS['bar-list']!.layers.length).toBe(3);
    // A name on Object.prototype is no preset of core's, so it is free, and unknown until it is registered.
    expect(err(() => expand({ use: 'constructor', query: tiles.query }))).toMatch(/^Unknown preset "constructor"\./);
  });
  it('a registered preset expands as the library\'s do: every slot, a companion\'s suffix, and no layer of the period before unless the query compares', () => {
    const slots: PresetLibrary[string] = { layers: [
      { mark: 'bar', encode: { x: '$by', y: '$metric@p50', color: '$split', size: '$metric2', y2: 7 } },
      { mark: 'line', encode: { x: '$by', y: '$metric' }, series: 'previous', role: 'comparison' },
      { mark: 'rule', encode: { x: '$by', y: '$metric@previous', y2: '$metric2@a@b' } } ] };
    registerPreset('toy-slots', slots);
    const q = { metrics: ['m', 'n'], by: ['d', 'e'] }, bar = { mark: 'bar', encode: { x: 'd', y: 'm@p50', color: 'e', size: 'n', y2: 7 } };
    expect(expand({ use: 'toy-slots', query: q }).layers).toEqual([bar]);
    expect(expand({ use: 'toy-slots', query: { ...q, compare: 'previous' } }).layers).toEqual([bar,
      { mark: 'line', encode: { x: 'd', y: 'm' }, series: 'previous', role: 'comparison' }, { mark: 'rule', encode: { x: 'd', y: 'm@previous', y2: 'n@a@b' } }]);
    expect(expand({ use: 'toy-slots', query: q })).not.toHaveProperty('use');
    // What is registered is never written to, and layers written in the spec win, as they do over the library's.
    expect(slots.layers[0]!.encode).toEqual({ x: '$by', y: '$metric@p50', color: '$split', size: '$metric2', y2: 7 });
    expect(expand({ use: 'toy-slots', query: q, layers: tiles.layers }).layers).toBe(tiles.layers);
    expect(err(() => expand({ use: 'toy-slots', query: { metrics: ['m', 'n'] } }))).toBe('The "toy-slots" preset needs a dimension in query.by.');
    expect(err(() => expand({ use: 'toy-slots', query: { metrics: ['m', 'n'], by: ['d'] } }))).toBe('The "toy-slots" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
    expect(err(() => expand({ use: 'toy-slots', query: { metrics: ['m'], by: ['d', 'e'] } }))).toBe('The "toy-slots" preset needs two metrics in query.metrics: the count, then the rate the engine returns for it.');
  });
  it('the library handed in comes first, and the registry is asked for what it does not have', () => {
    registerPreset('toy-strip', strip);
    const own: PresetLibrary = { 'toy-strip': { layers: [{ mark: 'text', encode: { y: '$by', text: '$by' } }] } }, spec: Spec = { use: 'toy-strip', query: tiles.query };
    expect(expand(spec, own).layers).toEqual([{ mark: 'text', encode: { y: 'page', text: 'page' } }]);
    expect(expand(spec, {}).layers).toEqual(tiles.layers);
    expect(resolve(spec, runQuery(spec.query), makeContainer(346), catalog, own).layout).toBe('rows');
    expect(resolve(spec, runQuery(spec.query), makeContainer(346), catalog, {}).layout).toBe('toy');
  });
  it('an unknown name is an error that lists the library and the registry, and how to add to it', () => {
    registerPreset('toy-strip', strip);
    const core = Object.keys(PRESETS).join(', '), fix = '. Use one of those, or register it with registerPreset("nope", …) before the view is resolved.';
    expect(registered()).toContain('toy-strip');
    expect(err(() => expand({ use: 'nope', query: tiles.query }))).toBe('Unknown preset "nope". The library has: ' + core + '. Registered: ' + registered() + fix);
    expect(err(() => run({ ...tiles, layers: undefined, use: 'nope' }, 346))).toBe('Unknown preset "nope". The library has: ' + core + '. Registered: ' + registered() + fix);
    expect(err(() => expand({ use: 'nope', query: tiles.query }, {}))).toBe('Unknown preset "nope". The library has: none. Registered: ' + registered() + fix);
    // A spec with a dimension and nothing to draw it with is told every name it may use: the library's, then the registered ones it does not have.
    const bare = (presets?: PresetLibrary) => err(() => resolve({ query: tiles.query }, runQuery(tiles.query), makeContainer(346), catalog, presets));
    expect(bare()).toBe('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: ' + core + ', ' + registered() + '.');
    expect(bare({ 'toy-strip': strip, mine: strip })).toBe('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: ' + ['toy-strip', 'mine', ...[...customPresets().keys()].filter((n) => n !== 'toy-strip')].join(', ') + '.');
  });
});

describe('a registered preset in a view', () => {
  const { layers: _layers, ...rest } = tiles, used: Spec = { ...rest, use: 'toy-strip' };
  it('is the view its layers written out would be, to the node, and the plan says which preset it came from', () => {
    registerPreset('toy-strip', strip);
    for (const [w, h] of [[346, null], [199, null], [346, 60], [149, null], [80, null]] as [number, number | null][]) expect(run(used, w, h).scene, w + ' ' + h).toEqual(run(tiles, w, h).scene);
    expect(run(used, 346).plan).toMatchObject({ layout: 'toy', preset: 'toy-strip', layers: [{ mark: 'toy', encode: { x: 'page', color: 'pageviews' } }] });
    // Its mark's own fallback is still asked: the registered name gives way to the library's.
    expect(run(used, 149).plan).toMatchObject({ layout: 'rows', preset: 'bar-list', dropped: ['the toy marks (drawn as "bar-list")'] });
  });
  it('the schema takes its name, as it takes any: resolve() checks it', () => {
    expect(view(used), JSON.stringify(view.errors)).toBe(true);
    expect(view({ ...used, use: 'nope' })).toBe(true);
  });
  it('a rule\'s fallback may name one: the view is planned again through the registry, from either kind of spec', () => {
    // A second toy, whose marks give way to a registered list of a bar and a label, which no preset of core's is.
    const list: PresetLibrary[string] = { layers: [{ mark: 'bar', encode: { y: '$by', x: '$metric' } }, { mark: 'text', encode: { y: '$by', text: '$by' } }] };
    registerMark('toy-2', { ...toy, rules: [{ id: 'marks', layout: 'toy-2', container: 'view', needs: { inline: 150 }, hide: [], fallback: 'toy-list', keep: 'marks' }] });
    registerPreset('toy-list', list);
    registerPreset('toy-strip-2', { layers: [{ mark: 'toy-2', encode: { x: '$by', color: '$metric' } }] });
    const written: Spec = { ...tiles, layers: [{ mark: 'toy-2', encode: { x: 'page', color: 'pageviews' } }] }, asked: Spec = { ...rest, use: 'toy-list' };
    expect(run(written, 150).plan).toMatchObject({ layout: 'toy-2', preset: null });
    for (const spec of [written, { ...rest, use: 'toy-strip-2' }]) {
      const { plan, scene } = run(spec, 149);
      expect(plan).toMatchObject({ layout: 'rows', preset: 'toy-list', dropped: ['the toy-2 marks (drawn as "toy-list")'] });
      expect(plan.layers.map((l) => l.mark)).toEqual(['bar', 'text']);
      expect(scene).toEqual(run(asked, 149).scene);
    }
    // A fallback no one registered is expand()'s error, with the registry in it.
    registerMark('toy-3', { ...toy, rules: [{ id: 'marks', layout: 'toy-3', container: 'view', needs: { inline: 150 }, hide: [], fallback: 'toy-gone', keep: 'marks' }] });
    expect(err(() => run({ ...tiles, layers: [{ mark: 'toy-3', encode: { x: 'page', color: 'pageviews' } }] }, 149))).toMatch(/^Unknown preset "toy-gone"\. The library has: .*\. Registered: .*toy-list.*\. Use one of those, or register it with registerPreset\("toy-gone", …\)/);
  });
});
