import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, declutter, makeContainer, place, resolve, type Spec } from '@unified-analytics/core';
import catalogSchema from '@unified-analytics/core/schema/catalog.schema.json';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { hitNodes } from '../packages/dom/src/keys.ts';
import { nearest } from '../packages/dom/src/layouts/points.ts';

// A metric on both axes, `dot`, `size`, labels on points, a rule on x, and a numeric dimension
// (docs/chart-coverage-plan.md, step 4). The samples are swept and have golden scenes in coverage.test.ts.
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical') => {
  const container = makeContainer(w, h), result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (s: Spec, result = runQuery(s.query)) => { try { resolve(s, result, makeContainer(346), catalog); } catch (e) { return (e as Error).message; } };
const { scatter, bubble, quadrant, histogram, density } = Object.fromEntries(Object.entries(moreSamples).map(([k, s]) => [k, s.spec])) as Record<string, Spec>;
const texts = (ratio: { nodes: any[] }, part: string) => ratio.nodes.filter((n) => n.part === part && n.kind === 'text').map((n) => n.text);

describe('the fixture engine', () => {
  it('has a rate page by page, which does not add up, and refuses it by anything else', () => {
    const { rows, totals } = runQuery(scatter!.query);
    expect(rows.length).toBe(8);
    expect(rows[0]).toEqual({ page: '/', visitors: 2610, page_conversion: 2.1 });
    expect(totals).toEqual({ visitors: 10531, page_conversion: 2.6 });
    expect(() => runQuery({ metrics: ['page_conversion'], by: ['date.day'] })).toThrow('The fixture has "page_conversion" page by page, and not by anything else. Query it by page alone.');
  });
  it('bins a numeric dimension itself: each row has its bin\'s two ends, in order, and the bins divide the total', () => {
    const { rows, totals } = runQuery(histogram!.query);
    expect(rows.length).toBe(16);
    expect(rows.slice(0, 2).map((r) => [r.load_time, r['load_time@end']])).toEqual([[0, 0.5], [0.5, 1]]);
    expect(rows.reduce((s, r) => s + (r.pageviews as number), 0)).toBe(totals.pageviews);
    // A density is a share of the whole per second, so over the bins it comes to one.
    expect(rows.reduce((s, r) => s + (r['pageviews@density'] as number) * 0.5, 0)).toBeCloseTo(1, 3);
    expect(() => runQuery({ metrics: ['pageviews'], by: ['load_time', 'device'] })).toThrow('The fixture bins a count by "load_time" and nothing more. Query a count by it alone.');
    expect(runQuery(histogram!.query, 'empty')).toMatchObject({ rows: [], meta: { empty: true } });
  });
  it('the catalog and the samples are valid', () => {
    const ajv = new Ajv();
    expect(ajv.validate(catalogSchema, catalog), JSON.stringify(ajv.errors)).toBe(true);
    for (const s of [scatter, bubble, quadrant, histogram, density]) expect(ajv.validate(viewSchema, s), JSON.stringify(ajv.errors)).toBe(true);
    expect(ajv.validate(viewSchema, { ...scatter, layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'page_conversion', radius: 4 } }] })).toBe(false);
  });
});

describe('a metric on x', () => {
  it('is a plot, with a linear x whose ticks are derived as y\'s are and ranked between the ends', () => {
    const { plan, ratio } = run(scatter!, 700);
    expect(plan.layout).toBe('cartesian');
    expect(ratio).toMatchObject({ scale: 'linear', parts: ['y-axis', 'plot', 'points', 'point-labels', 'x-axis'] });
    expect(ratio.rows!.slice(0, 2)).toEqual(['/', '/pricing']);
    const ticks = ratio.nodes.filter((n) => n.part === 'x-axis') as any[];
    expect(ticks.map((n) => [n.key, n.text, n.x, n.anchor, n.rank])).toEqual([
      ['xtick:0', '0', 0, 'start', undefined], ['xtick:1000', '1k', 1 / 3, 'middle', 1], ['xtick:2000', '2k', 2 / 3, 'middle', 1], ['xtick:3000', '3k', 1, 'end', undefined]]);
    expect(texts(ratio, 'y-axis')).toEqual(['0%', '2%', '4%', '6%']);
  });
  it('place() gives up the ranked x ticks where the middle date goes', () => {
    const at = (w: number) => run(scatter!, w).scene.nodes.filter((n) => n.key.startsWith('xtick:')).map((n) => (n as any).text);
    expect(at(700)).toEqual(['0', '1k', '2k', '3k']);
    expect(at(346)).toEqual(['0', '3k']);
  });
  it('a dot is a circle at its two values, keyed by its row, in a part of its own', () => {
    const { ratio, scene, result } = run(scatter!, 346), dots = ratio.nodes.filter((n) => n.kind === 'circle') as any[];
    expect(dots.length).toBe(8);
    expect(dots[1]).toEqual({ key: 'primary:dot:/pricing', part: 'points', kind: 'circle', pulse: false, x: 1705 / 3000, t: 5.8 / 6, row: '/pricing', paint: 'series.1', layer: 'data', role: 'primary' });
    // In pixels: the plot runs from 36 to 340 across and from 162 up to 10, and a dot with no size has the painter's one radius.
    const px = scene.nodes.find((n) => n.key === 'primary:dot:/pricing') as any;
    expect(px).toMatchObject({ kind: 'circle', r: 3, pulse: false });
    expect(px.cx).toBeCloseTo(36 + 304 * 1705 / 3000, 9);
    expect(px.cy).toBeCloseTo(162 - 152 * 5.8 / 6, 9);
    expect(result.rows[1]!.page).toBe('/pricing');
  });
  it('has no bare plot: under the room its axes need it is the number alone, in every data state', () => {
    for (const spec of [scatter!, bubble!, quadrant!]) {
      expect([346, 280, 279, 152, 10].map((w) => run(spec, w).plan.layout)).toEqual(['cartesian', 'cartesian', 'none', 'none', 'prose']);
      expect([200, 120, 119, 30].map((h) => run(spec, 346, h).plan.layout)).toEqual(['cartesian', 'cartesian', 'none', 'prose']);
      expect(run(spec, 279).plan).toMatchObject({ side: false, tldrValue: true });
      expect(run(spec, 279).plan.dropped.pop()).toBe('all marks (kept the number)');
      expect(run(spec, 279).plan.reductions[0]).toEqual({ id: 'drop-guides', state: 'nothing to drop' });
      expect([346, 120].map((w) => run(spec, w, null, 'empty').plan.layout)).toEqual(['notice', 'none']);
      expect(run(spec, 346, null, 'no-prior').plan.layout).toBe('cartesian');
    }
    // A dot on a time axis is a plot like any other, and keeps its sparkline. Its dots are in the plot, and the plot's hit targets step through them.
    const byDay: Spec = { query: { metrics: ['visitors'], by: ['date.day'] }, layers: [{ mark: 'dot', encode: { x: 'date.day', y: 'visitors' } }] };
    expect(run(byDay, 250).plan).toMatchObject({ layout: 'cartesian', side: true });
    expect(run(byDay, 346).ratio.nodes.find((n) => n.kind === 'circle' && n.part !== 'number')).toMatchObject({ key: 'primary:dot:2026-09-08', part: 'plot' });
    expect(hitNodes(run(byDay, 700).ratio).length).toBe(28);
    expect(hitNodes(run(scatter!, 700).ratio)).toEqual([]);
  });
});

describe('size', () => {
  it('is one of four steps, by area, and a sized dot lets what is under it show', () => {
    const { ratio, result, scene } = run(bubble!, 346), dots = ratio.nodes.filter((n) => n.part === 'points') as any[];
    const top = Math.max(...result.rows.map((r) => r.pageviews as number));
    result.rows.forEach((r, i) => expect(dots[i].size, String(r.page)).toBe(Math.max(1, Math.ceil(Math.sqrt((r.pageviews as number) / top) * 4))));
    expect(dots.map((n) => n.size)).toEqual([4, 4, 3, 3, 2, 2, 2, 1]);
    expect(new Set(dots.map((n) => n.opacity))).toEqual(new Set([0.7]));
    // The radius is the painter's: place() has 2 px and 2.5 a step.
    expect((scene.nodes.find((n) => n.key === 'primary:dot:/') as any).r).toBe(12);
    expect((scene.nodes.find((n) => n.key === 'primary:dot:/contact') as any).r).toBe(4.5);
  });
  it('has a key, as a guide: the metric, then each step with the most it stands for', () => {
    const { ratio, scene, plan } = run(bubble!, 346);
    expect(plan.guides.size).toBe(true);
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis', 'size']);
    expect(ratio.nodes.filter((n) => n.part === 'size').map((n) => n.key)).toEqual(['size:title', 'size:1', 'size:1:label', 'size:2', 'size:2:label', 'size:3', 'size:3:label', 'size:4', 'size:4:label']);
    expect(texts(ratio, 'size')).toEqual(['Page views', '301', '1.2k', '2.7k', '4.8k']);
    expect(ratio.nodes.filter((n) => n.part === 'size').every((n) => n.layer === 'guide')).toBe(true);
    // It sits under the plot, and the view is that much taller.
    expect(scene.height).toBe(184 + 28);
    expect(scene.nodes.find((n) => n.key === 'size:4')).toMatchObject({ kind: 'circle', r: 12, cy: 14, ty: 184 });
  });
  it('the key goes before the axes do, by its rule, and the dots keep their sizes', () => {
    expect(run(bubble!, 319).plan).toMatchObject({ layout: 'cartesian', dropped: ['the key to sizes'] });
    expect(run(bubble!, 319).ratio.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis']);
    expect(run(bubble!, 319).scene.nodes.some((n) => n.key.startsWith('size:'))).toBe(false);
    expect(run(bubble!, 346, 159).plan.guides.size).toBe(undefined);
    expect(run({ ...bubble!, keep: ['guides'] }, 319).plan.guides.size).toBe(true);
    expect((run(bubble!, 319).scene.nodes.find((n) => n.key === 'primary:dot:/') as any).r).toBe(12);
  });
  it('takes a metric, and the error names the fix', () => {
    expect(err({ ...bubble!, layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'page_conversion', size: 'page' } }] }))
      .toBe('Layer 1 encodes "page" on size, and a size is a quantity. Encode one of the query\'s metrics: visitors, page_conversion, pageviews.');
  });
});

describe('text in the plot', () => {
  it('is a label on each point, ranked by its y, or by the size of the dots where they have one', () => {
    const labels = (spec: Spec) => run(spec, 700).ratio.nodes.filter((n) => n.part === 'point-labels') as any[];
    const byY = labels(scatter!);
    expect(byY[1]).toMatchObject({ key: 'primary:text:/pricing', kind: 'text', text: '/pricing', x: 1705 / 3000, t: 5.8 / 6, row: '/pricing', rank: 1, anchor: 'middle', layer: 'guide' });
    expect(byY.slice().sort((a, b) => a.rank - b.rank).map((n) => n.text).slice(0, 3)).toEqual(['/pricing', '/contact', '/docs/getting-started']);
    const bySize = labels({ ...bubble!, layers: [...bubble!.layers!, scatter!.layers![1]!] });
    expect(bySize.slice().sort((a, b) => a.rank - b.rank).map((n) => n.text).slice(0, 3)).toEqual(['/', '/pricing', '/blog/launch-notes']);
  });
  it('declutter gives up the label of lower rank where two would meet, and never an unranked one first', () => {
    const box = (x: number, rank?: number) => ({ x, y: 0, w: 40, h: 12, rank });
    expect(declutter([box(0, 2), box(30, 1), box(80, 3)])).toEqual([true, false, false]);
    expect(declutter([box(0, 1), box(41, 2)])).toEqual([false, true]);          // closer than the gap
    expect(declutter([box(0, 1), box(42, 2)])).toEqual([false, false]);
    expect(declutter([box(0, 1), box(10)])).toEqual([true, false]);
    expect(declutter([{ ...box(0, 1) }, { ...box(0, 2), y: 14 }])).toEqual([false, false]);
  });
  it('place() sets each above its point, clipped and inside the plot, and leaves out the ones that collide, lowest rank first', () => {
    const { scene } = run(scatter!, 346), at = (k: string) => scene.nodes.find((n) => n.key === k) as any;
    expect(scene.nodes.filter((n) => n.key.startsWith('primary:text:')).length).toBe(8);
    expect(at('primary:text:/about')).toMatchObject({ text: '/about', anchor: 'middle', x: at('primary:dot:/about').cx, y: at('primary:dot:/about').cy - 7 });
    expect(at('primary:text:/blog/analytics-without-cookies').text).toBe('/blog/analyti…');
    // The same pages with their points pulled together: the top label by rank stays, and what it covers goes.
    const result = runQuery(scatter!.query), close = { ...result, rows: result.rows.map((r, i) => ({ ...r, visitors: 1200 + i * 30, page_conversion: 3 + i * 0.05 })) };
    const container = makeContainer(346), crowded = place(buildScene(resolve(scatter!, close, container, catalog), scatter!.query, close, catalog), container);
    const shown = crowded.nodes.filter((n) => n.key.startsWith('primary:text:')).map((n) => (n as any).text);
    expect(shown[shown.length - 1]).toBe('/contact');                               // the highest y, so the first in rank
    expect(shown.length).toBeLessThan(8);
    expect(crowded.nodes.filter((n) => n.kind === 'circle').length).toBe(8);
  });
  it('the labels go first, by their rule, and the plan says so', () => {
    expect(run(scatter!, 346).plan).toMatchObject({ guides: { pointLabels: true }, dropped: [] });
    expect(run(scatter!, 339).plan).toMatchObject({ layout: 'cartesian', dropped: ['the labels on the points'] });
    expect(run(scatter!, 339).ratio.parts).toEqual(['y-axis', 'plot', 'points', 'x-axis']);
    expect(run(scatter!, 339).scene.nodes.some((n) => n.key.startsWith('primary:text:'))).toBe(false);
    expect(run(scatter!, 346, 179).plan.dropped).toEqual(['the labels on the points']);
    // The scene carries them either way, for a rule to hide.
    expect(run(scatter!, 339).ratio.nodes.filter((n) => n.part === 'point-labels').length).toBe(8);
  });
  it('errors name the fix: a text layer with nothing to say', () => {
    expect(err({ ...scatter!, layers: [{ mark: 'text', encode: { x: 'visitors', y: 'page_conversion' } }] }))
      .toBe('A "text" layer in a plot needs a field on y, for where each label sits, and one on text, for what it says: for example { "x": "<a metric>", "y": "<a metric>", "text": "<the dimension>" }.');
  });
});

describe('a rule at a constant on x', () => {
  it('stands the height of the plot, with its label beside it, and one on y lies as it did', () => {
    const { ratio, scene } = run(quadrant!, 346), node = (k: string) => ratio.nodes.find((n) => n.key === k) as any, px = (k: string) => scene.nodes.find((n) => n.key === k) as any;
    expect(node('reference:rule')).toMatchObject({ kind: 'line', part: 'plot', x: 1 / 3, x2: 1 / 3, t: 0, t2: 1, paint: 'rule', role: 'reference' });
    expect(node('reference:rule:label')).toMatchObject({ kind: 'text', x: 1 / 3, t: 1, text: '1,000 visitors', anchor: 'start' });
    expect(node('reference:rule#2')).toMatchObject({ kind: 'line', t: 0.5 });
    expect(node('reference:rule#2').x).toBe(undefined);
    expect(px('reference:rule')).toMatchObject({ x1: 36 + 304 / 3, x2: 36 + 304 / 3, y1: 162, y2: 10 });
    expect(px('reference:rule#2')).toMatchObject({ x1: 36, x2: 340, y1: 86, y2: 86 });
    expect(px('reference:rule:label')).toMatchObject({ x: 36 + 304 / 3 + 4, y: 19 });
  });
  it('is held by the scale, as one on y is', () => {
    const far: Spec = { ...quadrant!, layers: [{ mark: 'rule', encode: { x: 5000 } }, { mark: 'rule', encode: { y: 9 } }, quadrant!.layers![2]!] };
    const { ratio } = run(far, 700);
    expect(texts(ratio, 'x-axis').pop()).toBe('5k');
    expect(texts(ratio, 'y-axis').pop()).toBe('10%');
  });
  it('errors name the fix: no scale on x to measure along, and a rule at no number', () => {
    const byDay = { metrics: ['visitors'], by: ['date.day'] };
    expect(err({ query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'rule', encode: { x: 5 } }] }))
      .toBe('A rule at x: 5 needs a scale to be measured on, and this plot has a time or a category on x. Put the rule on y, or a metric or a number dimension on x.');
    expect(err({ query: byDay, layers: [{ mark: 'line', encode: { x: 'date.day', y: 'visitors' } }, { mark: 'rule' }] }))
      .toBe('A rule is drawn at a number, and this one has none on x or on y. Encode one, for example { "y": 1000 }.');
  });
});

describe('a numeric dimension', () => {
  it('draws bars across the engine\'s bins, with no gap between them and none at the edges', () => {
    const { ratio, scene, plan } = run(histogram!, 346), bars = ratio.nodes.filter((n) => n.kind === 'rect') as any[];
    expect(plan.layout).toBe('cartesian');
    expect(ratio.scale).toBe('linear');
    expect(bars.length).toBe(16);
    expect(bars[0]).toMatchObject({ key: 'primary:bar:0', row: '0', x: 0, w: 1 / 16 });
    bars.forEach((b, i) => { if (i) expect(b.x).toBeCloseTo(bars[i - 1].x + bars[i - 1].w, 12); });
    expect(bars[15].x + bars[15].w).toBe(1);
    expect(texts(ratio, 'x-axis')).toEqual(['0', '2', '4', '6', '8']);
    const px = scene.nodes.filter((n) => n.kind === 'rect') as any[];
    expect(px[0].x).toBe(36);
    expect(px[15].x + px[15].w).toBeCloseTo(340, 9);
    px.forEach((b, i) => { if (i) expect(b.x).toBeCloseTo(px[i - 1].x + px[i - 1].w, 9); });
  });
  it('a density is an area along it, from the engine\'s companion field, a point at the middle of each bin', () => {
    const { ratio, result } = run(density!, 346), [area, line] = ratio.nodes.filter((n) => n.kind === 'path') as any[];
    expect([area.key, area.fill, line.key]).toEqual(['context:area', true, 'primary:line']);
    expect(line.points.length).toBe(16);
    expect(line.points[0]).toEqual({ row: '0', x: 0.25 / 8, v: (result.rows[0]!['pageviews@density'] as number) / 0.4 });
    expect(texts(ratio, 'y-axis')).toEqual(['0', '0.1', '0.2', '0.3', '0.4']);
    expect(hitNodes(ratio).length).toBe(16);
  });
  it('keeps its sparkline, and the number under it is the total and not the first bin', () => {
    for (const spec of [histogram!, density!]) for (const sc of scenarios) {
      expect([346, 250, 120, 10].map((w) => run(spec, w, null, sc).plan.layout), sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'none', 'prose'] : ['cartesian', 'cartesian', 'none', 'prose']);
    }
    expect(run(histogram!, 120).ratio.nodes.filter((n) => n.part === 'number').map((n) => n.key)).toEqual(['value']);
  });
  it('errors name the fix: a companion the result lacks, bars with no bins, and a bar on a metric', () => {
    expect(err({ ...density!, layers: [{ mark: 'line', encode: { x: 'load_time', y: 'pageviews@p99' } }] }))
      .toBe('Layer 1 encodes "pageviews@p99" on y, which the result does not return. With "pageviews" it returns: pageviews@density.');
    expect(err({ ...density!, layers: [{ mark: 'line', encode: { x: 'load_time', y: 'visitors@density' } }] }))
      .toBe('Layer 1 encodes "visitors@density" on y, which the query does not return. It returns: load_time, pageviews.');
    const result = runQuery(histogram!.query), raw = { ...result, rows: result.rows.map(({ 'load_time@end': _end, ...r }) => r) };
    expect(err(histogram!, raw)).toBe('Bars on the number dimension "load_time" need its bins, and this result has no "load_time@end". Return where each bin ends from the query layer, or use line or dot.');
    expect(err({ ...scatter!, layers: [{ mark: 'bar', encode: { x: 'visitors', y: 'page_conversion' } }] }))
      .toBe('Layer 1 is a bar with the metric "visitors" on x, and a bar needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
    expect(err({ query: { metrics: ['visitors', 'pageviews'] }, layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'pageviews' } }] }))
      .toBe('These layers set one metric against another, and the query has no dimension, so there is no row to draw a point for. Add one to query.by, for example ["page"].');
  });
});

describe('tldr prose', () => {
  const text = (spec: Spec, sc?: (typeof scenarios)[number]) => run(spec, 346, null, sc).plan.text;
  it('for two metrics set against each other: the range of each, and the point furthest out on each by name', () => {
    expect(text(scatter!)).toBe('Across 8 pages in the last 28 days, the range of visitors is 244 to 2,610 and of conversion rate is 0.9% to 5.8%. / is highest on visitors and /pricing on conversion rate.');
    expect(text(bubble!)).toBe(text(scatter!));
    expect(text(scatter!, 'empty')).toBe('Visitors: nothing recorded in the last 28 days.');
    const flipped: Spec = { ...scatter!, query: { ...scatter!.query, metrics: ['visitors', 'pageviews'] }, layers: [{ mark: 'dot', encode: { x: 'visitors', y: 'pageviews' } }] };
    expect(text(flipped)).toBe('Across 8 pages in the last 28 days, the range of visitors is 244 to 2,610 and of page views is 290 to 4,820. / is highest on both.');
  });
  it('for a numeric dimension: the total, and the bin that holds the most', () => {
    expect(text(histogram!)).toBe('Page views: 25.1k in the last 28 days. The most, 4,758, at a load time of 1.5 to 2.');
    expect(text(density!)).toBe(text(histogram!));
  });
});

describe('the keyboard over points in two dimensions (a proposal: nearest neighbour by arrow direction)', () => {
  //  0 . 1
  //  . 2 .      y runs down the page
  //  3 . 4
  const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 20 }, { x: 20, y: 20 }];
  it('an arrow goes to the nearest point on that side, and one off to the side counts as twice as far', () => {
    expect(nearest('ArrowRight', 0, pts)).toBe(1);
    expect(nearest('ArrowDown', 0, pts)).toBe(3);
    expect(nearest('ArrowRight', 2, pts)).toBe(1);        // 1 and 4 are as near: the first found stays
    expect(nearest('ArrowLeft', 4, pts)).toBe(3);
    expect(nearest('ArrowUp', 4, pts)).toBe(1);
  });
  it('stops where there is no point further that way, and starts at the first point', () => {
    expect(nearest('ArrowLeft', 0, pts)).toBe(0);
    expect(nearest('ArrowUp', 1, pts)).toBe(1);
    expect(nearest('ArrowRight', -1, pts)).toBe(0);
    expect(nearest('ArrowUp', -1, pts)).toBe(0);
  });
  it('reaches every point, even two in one place, and leaves other keys alone', () => {
    const twin = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }];
    expect([nearest('ArrowRight', 0, twin), nearest('ArrowRight', 1, twin), nearest('ArrowLeft', 2, twin), nearest('ArrowLeft', 1, twin)]).toEqual([1, 2, 0, 0]);
    for (const k of ['Tab', 'Home', 'a']) expect(nearest(k, 1, pts)).toBeNull();
    expect(nearest('ArrowRight', -1, [])).toBeNull();
  });
});
