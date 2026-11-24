import { describe, expect, it } from 'vitest';
import { buildScene, expand, explain, facetColumns, facets, resolve, viewAt, FACET_GAP, FACET_LEAST, type ArcNode, type Facet, type RectNode, type Spec } from '@unified-analytics/core';
import { catalog, facetSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { FACET_CSS } from '../packages/dom/src/view.ts';
import { errOf, validView as view } from './helpers.ts';
import { useExamples } from './examples.ts';

useExamples();   // the presets the library no longer ships, which these cases still write `use` with

// A facet is a small board (reference, Decided 26 and 45): a view for each value of one of the query's dimensions,
// every one on the same scales. Core gives the views; where they stand is the surface's.
const trend: Spec = { spec: 'view/0', title: 'Visitors by channel', use: 'line', facet: 'channel', query: { metrics: ['visitors'], by: ['date.day', 'channel'], range: '28d', compare: 'previous' } };
const lists: Spec = { spec: 'view/0', use: 'bar-list', facet: 'device', query: { metrics: ['visitors'], by: ['page', 'device'], range: '28d', limit: 5 } };
const roses: Spec = { spec: 'view/0', use: 'rose', facet: 'device', query: { metrics: ['visitors'], by: ['channel', 'device'], range: '28d' } };
const numbers: Spec = { spec: 'view/0', facet: 'channel', query: { metrics: ['visitors'], by: ['channel'], range: '28d', compare: 'previous' } };
const of = (spec: Spec) => { const result = runQuery(spec.query); return { result, views: facets(spec, result, catalog) }; };
const sceneOf = (v: Facet, alone = false) => { const result = alone ? { ...v.result, domains: undefined } : v.result; return buildScene(resolve(v.spec, result, catalog), expand(v.spec).query, result, catalog); };
const said = (scene: { nodes: unknown[] }, part: string) => (scene.nodes as { part: string; kind: string; text: string }[]).filter((n) => n.part === part && n.kind === 'text').map((n) => n.text);

describe('the views of a facet', () => {
  it('is one for each value, in the engine\'s order, each the spec without the facet on that value\'s rows', () => {
    const { result, views } = of(trend), order = result.totalsBy!.channel!.map((r) => String(r.channel));
    expect(views.map((v) => v.key)).toEqual(order);
    for (const v of views) {
      expect(v.spec).toMatchObject({ use: 'line', title: v.label, query: { metrics: ['visitors'], by: ['date.day'], compare: 'previous' } });
      expect(v.spec.facet).toBeUndefined();
      expect(v.result.rows.length).toBe(28);
      expect(v.result.rows.every((r) => r.channel === v.key)).toBe(true);
      expect(view(v.spec), JSON.stringify(view.errors)).toBe(true);
    }
    expect(view(trend), JSON.stringify(view.errors)).toBe(true);
  });

  it('gives each view the engine\'s totals for its value, and sums nothing', () => {
    const { result, views } = of(trend);
    for (const v of views) {
      const whole = result.totalsBy!.channel!.find((r) => r.channel === v.key)!;
      expect(v.result.totals).toEqual({ visitors: whole.visitors, 'visitors@previous': whole['visitors@previous'] });
    }
    // With no totalsBy the engine has not said a value's total, so a view has none: its number is not made up from its rows.
    const bare = facets(trend, { ...result, totalsBy: undefined }, catalog);
    expect(bare.length).toBe(views.length);
    expect(bare[0]!.result.totals).toEqual({ visitors: null, 'visitors@previous': null });
  });

  it('with the facet as the only dimension is a number for each value, which is the value\'s own row', () => {
    const { result, views } = of(numbers);
    expect(views.length).toBe(result.rows.length);
    for (const v of views) {
      const row = result.rows.find((r) => r.channel === v.key)!, scene = sceneOf(v);
      expect(v.spec.query.by).toEqual([]);
      expect(v.result.totals.visitors).toBe(row.visitors);
      expect(scene.parts).toEqual(['number']);
    }
  });

  it('a value the result has no rows for is a view that says it is empty', () => {
    const result = runQuery(trend.query), last = String(result.totalsBy!.channel!.at(-1)!.channel);
    const views = facets(trend, { ...result, rows: result.rows.filter((r) => r.channel !== last) }, catalog), none = views.at(-1)!;
    expect(none.key).toBe(last);
    expect(sceneOf(none).layout).toBe('notice');
    expect(sceneOf(views[0]!).layout).toBe('cartesian');
  });

  it('with no value of the dimension is one view, of the whole', () => {
    const empty = runQuery(trend.query, 'empty'), views = facets(trend, empty, catalog);
    expect(views.length).toBe(1);
    expect(views[0]!.spec.query.by).toEqual(['date.day']);
    expect(sceneOf(views[0]!).nodes.length).toBeGreaterThan(0);
  });

  it('is read at a room as any view is', () => {
    const { views } = of(trend), wide = viewAt(views[0]!.spec, views[0]!.result, catalog, { view: { inline: 346, block: null } }), small = viewAt(views[0]!.spec, views[0]!.result, catalog, { view: { inline: 80, block: null } });
    expect(wide.fit.parts).toContain('plot');
    expect(small.fit.parts).not.toContain('y-axis');
  });
});

describe('the scales a facet\'s views share', () => {
  it('a plot: every view has the same ticks, and only the largest reaches the top', () => {
    const { views } = of(trend), scenes = views.map((v) => sceneOf(v)), ticks = scenes.map((s) => said(s, 'y-axis').join(' '));
    expect(new Set(ticks).size).toBe(1);
    expect(views[0]!.result.domains).toBe(views[1]!.result.domains);
    // Alone, the least of them is drawn to its own top and counts in its own steps.
    const last = views[views.length - 1]!;
    expect(said(sceneOf(last, true), 'y-axis').join(' ')).not.toBe(ticks[0]);
  });

  it('a list: a bar is as long as its value against the longest bar of any view', () => {
    const { result, views } = of(lists), most = Math.max(...result.rows.map((r) => r.visitors as number));
    expect(views[0]!.result.domains).toEqual({ track: [0, most] });
    for (const v of views) {
      const bars = (sceneOf(v).nodes as RectNode[]).filter((n) => n.part === 'rows' && n.kind === 'rect' && n.role === 'primary');
      expect(bars.length).toBe(v.result.rows.length);
      bars.forEach((b) => expect(b.x).toBeCloseTo((v.result.rows.find((r) => r.page === b.row)!.visitors as number) / most));
    }
  });

  it('a circle: a slice reaches as far as its value against the largest of any view', () => {
    const { views } = of(roses), reach = views.map((v) => Math.max(...(sceneOf(v).nodes as ArcNode[]).filter((n) => n.kind === 'arc').map((n) => n.r1)));
    expect(reach[0]).toBe(1);
    expect(reach[reach.length - 1]).toBeLessThan(0.5);
    expect(Math.max(...(sceneOf(views[views.length - 1]!, true).nodes as ArcNode[]).filter((n) => n.kind === 'arc').map((n) => n.r1))).toBe(1);
  });

  it('a whole is its own: the shares of a donut are of its own view', () => {
    const donuts = of({ ...roses, use: 'donut' }).views;
    for (const v of donuts) expect((sceneOf(v).nodes as ArcNode[]).filter((n) => n.kind === 'arc').reduce((sum, n) => sum + (n.a1 - n.a0), 0)).toBeGreaterThan(0.9);
  });
});

describe('a facet that cannot be drawn names the fix', () => {
  const result = runQuery(trend.query);
  it('a facet the query does not have', () => {
    expect(errOf(() => facets({ ...trend, facet: 'device' }, result, catalog))).toMatch(/"facet" is "device", and a facet is one of the query's dimensions: "date\.day" or "channel"\. Name one of them, or remove "facet"\./);
    expect(errOf(() => facets({ ...trend, facet: 'channel', query: { metrics: ['visitors'] } }, result, catalog))).toMatch(/it has none in "by"\. Add the dimension to query\.by and name it/);
  });
  it('a layer that draws the facet\'s own dimension', () => {
    const spec: Spec = { ...trend, use: undefined, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors', color: 'channel' } }] };
    expect(errOf(() => facets(spec, result, catalog))).toMatch(/Layer 1 encodes "channel" on color, and "channel" is the facet: each view holds one value of it\. Take it off the layer, or remove "facet"/);
  });
  it('a plan asked of the facet itself', () => {
    expect(errOf(() => resolve(trend, result, catalog))).toMatch(/has "facet": "channel", so it is a view for each value of that dimension and has no one plan\. Ask facets\(spec, result, catalog\)/);
  });
});

describe('every sample with a facet', () => {
  const rooms = [80, 170, 200, 346, 700].flatMap((inline) => [null, 160, 60].map((block) => ({ view: { inline, block } })));
  it('is valid, and each of its views draws something at every room, in every data state', () => {
    for (const [name, { spec }] of Object.entries(facetSamples)) {
      expect(view(spec), name + ' ' + JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) for (const v of facets(spec, runQuery(spec.query, sc), catalog)) for (const room of rooms) {
        const { scene, fit } = viewAt(v.spec, v.result, catalog, room), at = [name, sc, v.key, room.view.inline, room.view.block].join(' ');
        expect(fit.parts.length, at).toBeGreaterThan(0);
        expect(scene.nodes.some((n) => fit.parts.includes(n.part)), at).toBe(true);
      }
    }
  });
  it('says of itself how many views it is, and then what the first is', () => {
    const { spec } = facetSamples.multiples!, e = explain(spec, runQuery(spec.query), catalog, { inline: 346 });
    expect(e.entries[0]).toMatchObject({ what: 'drawn as 6 views, one for each channel', from: 'facet', lever: 'remove "facet" to draw them as one view' });
    expect(e.entries[1]!.what).toBe('the layout is cartesian');
  });
});

describe('how many of a facet\'s views stand side by side', () => {
  it('as many as have FACET_LEAST each with FACET_GAP between, one at least, and no more than there are', () => {
    const two = 2 * FACET_LEAST + FACET_GAP;
    expect(facetColumns(100, 6)).toBe(1);
    expect(facetColumns(two - 1, 6)).toBe(1);
    expect(facetColumns(two, 6)).toBe(2);
    expect(facetColumns(5000, 6)).toBe(6);
    expect(facetColumns(5000, 1)).toBe(1);
  });
  it('and the element\'s grid is that sum, in CSS', () => {
    expect(FACET_CSS).toContain('grid-template-columns: repeat(auto-fit, minmax(min(100%, ' + FACET_LEAST + 'px), 1fr)); gap: ' + FACET_GAP + 'px;');
  });
});

it('what a facet is for is said once, of its views together: no view of it carries the description', () => {
  const about = 'Where visitors came from, channel by channel.', views = facets({ ...trend, description: about }, runQuery(trend.query), catalog);
  expect(views.length).toBeGreaterThan(1);
  expect(views.every((v) => v.spec.description === undefined)).toBe(true);
});

