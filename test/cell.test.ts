import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, expand, makeContainer, place, resolve, sizeStep, type CircleNode, type PainterName, type RectNode, type Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';

// The `cell` mark and the grid it is laid out in (docs/chart-coverage-plan.md, step 5). No prototype knows it, so it
// is held to a sweep, facts and golden scenes of its own, as test/coverage.test.ts holds step 1.
const heatmap = moreSamples.heatmap!.spec;
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', result = runQuery(spec.query, scenario)) => {
  const container = makeContainer(w, h, painter, 8), plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
const err = (s: Spec) => { try { resolve(s, runQuery(s.query), makeContainer(346), catalog); } catch (e) { return (e as Error).message; } };
const view = new Ajv().compile(viewSchema);
const cells = (ratio: { nodes: unknown[] }) => (ratio.nodes as RectNode[]).filter((n) => n.part === 'plot' && n.kind === 'rect');
const dots = (ratio: { nodes: unknown[] }) => (ratio.nodes as CircleNode[]).filter((n) => n.part === 'plot' && n.kind === 'circle');
const texts = (scene: { nodes: unknown[] }, prefix: string) => (scene.nodes as { key: string; kind: string; text: string }[]).filter((n) => n.kind === 'text' && n.key.startsWith(prefix)).map((n) => n.text);

describe('the sweep', () => {
  it('unique keys, no NaN, nothing taller than the container allows, and ratios from 0 to 1', () => {
    for (const sc of scenarios) for (const p of ['svg', 'dots'] as PainterName[]) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
      const at = [sc, p, w, h].join(' ');
      const { plan, ratio, scene } = run(heatmap, w, h, sc, p);
      const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
      expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
      expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
      expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
      if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
      for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'y', 'h', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
      for (const n of scene.nodes as any[]) if (n.kind === 'rect') expect(n.x >= 0 && n.x + n.w <= w + 1e-9 && n.y >= 0, 'outside: ' + at + ' ' + n.key).toBe(true);
      expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
    }
  });
  it('resolves in every data state, and steps down: the ramp goes, then the grid for the number, then the prose', () => {
    expect(view(heatmap), JSON.stringify(view.errors)).toBe(true);
    for (const sc of scenarios) {
      const at = (w: number, h: number | null = null) => { const { plan, ratio } = run(heatmap, w, h, sc); return [plan.layout, ratio.parts.join(' '), plan.dropped.join('; ')]; };
      if (sc === 'empty') { expect([346, 234, 120, 10].map((w) => at(w)[0])).toEqual(['notice', 'notice', 'none', 'prose']); continue; }
      expect(at(700)).toEqual(['matrix', 'y-axis plot x-axis ramp', '']);
      expect(at(346)).toEqual(['matrix', 'y-axis plot x-axis ramp', '']);
      expect(at(234)).toEqual(['matrix', 'y-axis plot x-axis', 'the colour ramp']);
      expect(at(346, 149)).toEqual(['matrix', 'y-axis plot x-axis', 'the colour ramp']);
      // A grid has no bare form beside the number: under its `marks` need it is the number alone.
      expect(at(149)).toEqual(['none', 'number', 'the colour ramp; all marks (kept the number)']);
      expect(at(346, 89)[0]).toBe('none');
      expect(at(10)[0]).toBe('prose');
      // A ramp the spec keeps stays, and the grid with it, down to the grid's own need.
      expect([234, 150, 149].map((w) => run({ ...heatmap, keep: ['guides'] }, w, null, sc).ratio.parts.join(' '))).toEqual(['y-axis plot x-axis ramp', 'y-axis plot x-axis ramp', 'number']);
    }
  });
});

describe('golden scenes', () => {
  for (const [w, h] of [[346, null], [234, null], [346, 100]] as [number, number | null][]) {
    it(`heatmap at ${w} by ${h ?? 'any'}`, () => expect(run(heatmap, w, h).scene).toMatchSnapshot());
  }
});

// The grids step 0 of docs/uncommon-coverage-plan.md added: a calendar, a strip of days and a square of pages. And
// step 5's: a correlation matrix and its circles, and a count by two binned quantities.
describe('the grids of the Uncommon types', () => {
  const grids = Object.fromEntries(['calendar', 'stripes', 'adjacency', 'correlogram', 'circles', 'bins2d'].map((k) => [k, moreSamples[k]!.spec]));
  for (const [name, spec] of Object.entries(grids)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, ratios from 0 to 1, and every data state', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) for (const p of ['svg', 'dots'] as PainterName[]) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'y', 'h', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
        for (const n of scene.nodes as any[]) if (n.kind === 'rect') expect(n.x >= 0 && n.x + n.w <= w + 1e-9 && n.y >= 0, 'outside: ' + at + ' ' + n.key).toBe(true);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
      }
      for (const sc of scenarios) expect([346, 234, 120, 10].map((w) => run(spec, w, null, sc).plan.layout), sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'none', 'prose'] : ['matrix', 'matrix', 'none', 'prose']);
    });
    for (const [w, h] of [[346, null], [234, null], [346, 100]] as [number, number | null][]) {
      it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(spec, w, h).scene).toMatchSnapshot());
    }
  }
  it('a calendar is a row for each weekday and a column for each whole week, said as the Monday it starts on', () => {
    const { ratio, plan } = run(grids.calendar!, 700);
    expect(ratio).toMatchObject({ layout: 'matrix', ys: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], rows: ['2026-W37', '2026-W38', '2026-W39', '2026-W40'] });
    expect(texts(ratio, 'xtick:')).toEqual(['Sep 7', 'Sep 14', 'Sep 21', 'Sep 28']);
    expect(cells(ratio).length).toBe(28);
    expect(cells(ratio).every((n) => n.paint !== 'seq.none')).toBe(true);
    expect(plan.text).toMatch(/^Most visitors at \w+, Sep \d+ \(\d+\) in the last 28 days\. \w+ is the busiest weekday at \d+% of visitors, and Sep \d+ the busiest week at \d+%\.$/);
  });
  it('a strip of signed days is one row of cells on the diverging ramp: zero is its neutral middle, and a loss is as many steps below it as a gain as large is above', () => {
    const { ratio, result } = run(grids.stripes!, 700), days = cells(ratio);
    expect([ratio.ys, days.length, new Set(days.map((n) => n.h)).size, days[0]!.h]).toEqual([[''], 28, 1, 1]);
    const signed = result.rows.map((r) => r.net_subscribers as number), least = Math.min(...signed), most = Math.max(...signed);
    expect([least, most]).toEqual([-18, 20]);
    // Both arms are measured by the end farther from zero, which the ramp says at both ends, with zero between them.
    expect(texts(ratio, 'ramp:')).toEqual(['-20', '0', '20']);
    expect(ratio.nodes.filter((n) => n.part === 'ramp').map((n) => n.key)).toEqual(['ramp:low', 'ramp:1', 'ramp:2', 'ramp:3', 'ramp:4', 'ramp:5', 'ramp:zero', 'ramp:6', 'ramp:7', 'ramp:8', 'ramp:9', 'ramp:high']);
    expect(ratio.nodes.filter((n) => n.part === 'ramp' && n.kind === 'rect').map((n) => n.paint)).toEqual(Array.from({ length: 9 }, (_, i) => 'div.' + (i + 1)));
    expect([least, most].map((n) => days[signed.indexOf(n)]!.paint)).toEqual(['div.1', 'div.9']);
    // The middle step is a ninth of the scale, so days within 2.2 of no change are neutral, whichever way they went.
    expect([-2, 1].map((n) => days[signed.indexOf(n)]!.paint)).toEqual(['div.5', 'div.5']);
    days.forEach((n, i) => expect(n.paint, n.key).toBe('div.' + Math.min(9, 1 + Math.floor(((signed[i]! + 20) / 40) * 9))));
    for (const n of [3, 7, 12, 16]) if (signed.includes(n) && signed.includes(-n)) expect(Number(days[signed.indexOf(n)]!.paint.slice(4)) - 5, String(n)).toBe(5 - Number(days[signed.indexOf(-n)]!.paint.slice(4)));
  });
  it('a colour scale is diverging only where its values, or the domain the catalog states, cross zero', () => {
    const { result } = run(grids.stripes!, 700), with_ = (f: (v: number) => number, cat = catalog) => { const r = { ...result, rows: result.rows.map((row) => ({ ...row, net_subscribers: f(row.net_subscribers as number) })) }; return buildScene(resolve(grids.stripes!, r, makeContainer(700), cat), grids.stripes!.query, r, cat); };
    // All at or above zero, and all at or below it, are sequential, as they were.
    expect(cells(with_((v) => Math.abs(v))).every((n) => n.paint.startsWith('seq.'))).toBe(true);
    expect(cells(with_((v) => -Math.abs(v))).every((n) => n.paint.startsWith('seq.'))).toBe(true);
    expect(texts(with_((v) => -Math.abs(v)), 'ramp:')).toEqual(['-20', '-1']);
    // A stated domain that crosses zero is diverging whatever the values, and its farther end measures both arms.
    const stated = { ...catalog, metrics: { ...catalog.metrics, net_subscribers: { ...catalog.metrics.net_subscribers!, domain: [-10, 40] as [number, number] } } };
    expect(texts(with_((v) => Math.abs(v), stated), 'ramp:')).toEqual(['-40', '0', '40']);
    expect(new Set(cells(with_((v) => Math.abs(v), stated)).map((n) => n.paint))).toEqual(new Set(['div.5', 'div.6', 'div.7']));
    // No value is the same token on either ramp: it is not zero.
    const holed = { ...result, rows: result.rows.map((r, i) => (i ? r : { ...r, net_subscribers: null })) }, scene = buildScene(resolve(grids.stripes!, holed, makeContainer(700), catalog), grids.stripes!.query, holed, catalog);
    expect(cells(scene)[0]!.paint).toBe('seq.none');
    expect(scene.nodes.filter((n) => n.part === 'ramp').slice(-2).map((n) => [n.key, n.paint])).toEqual([['ramp:none', 'seq.none'], ['ramp:none:label', 'ink.muted']]);
  });
  it('a correlation matrix is on the diverging ramp by the domain its catalog states, and its prose says how far it runs each way, and between which two', () => {
    const { ratio, plan, result } = run(grids.correlogram!, 700), value = (n: RectNode) => result.rows.find((r) => r.other_factor === n.pair![0] && r.factor === n.pair![1])!.correlation as number;
    expect(catalog.metrics.correlation!.domain).toEqual([-1, 1]);
    expect(ratio.ys).toEqual(ratio.rows);
    expect(texts(ratio, 'ramp:')).toEqual(['-1', '0', '1']);
    // The values run from -0.56 to 1, and are measured from -1: the deepest step below zero is not reached.
    for (const n of cells(ratio)) expect(n.paint, n.key).toBe('div.' + Math.min(9, 1 + Math.floor(((value(n) + 1) / 2) * 9)));
    expect([...new Set(cells(ratio).map((n) => n.paint))].sort()).toEqual(['div.2', 'div.3', 'div.4', 'div.5', 'div.6', 'div.7', 'div.8', 'div.9']);
    expect(cells(ratio).filter((n) => n.pair![0] === n.pair![1]).every((n) => n.paint === 'div.9')).toBe(true);
    // A factor with itself is 1, which is no finding: the prose passes it over. There is no total, so no share and no top factor.
    expect(plan.text).toBe('Correlation runs from -0.56 (Conversion rate and Churn) to 0.81 (Traffic and Ad spend) in the last 28 days.');
    expect(result.totals.correlation).toBeNull();
    expect(texts(run(grids.correlogram!, 120).ratio, 'value')).toEqual(['–']);
    expect(run(grids.correlogram!, 120).ratio.nodes.some((n) => n.key === 'sub')).toBe(false);
  });
  it('a count by two binned quantities is drawn as a plot reads: each in number order, the least bin at the foot, labelled by its bin down the side and by its edges along the foot', () => {
    const { ratio, plan, result } = run(grids.bins2d!, 700);
    expect(result.rows[1]).toEqual({ load_time: 0, 'load_time@end': 0.5, page_weight: 0.5, 'page_weight@end': 1, pageviews: 46 });
    expect(result.rows.length).toBe(16 * 8);
    expect(result.rows.reduce((s, r) => s + (r.pageviews as number), 0)).toBe(result.totals.pageviews);
    expect(ratio.ys).toEqual(['3.5', '3', '2.5', '2', '1.5', '1', '0.5', '0']);
    expect(ratio.rows).toEqual(Array.from({ length: 16 }, (_, i) => String(i / 2)));
    expect(texts(ratio, 'ytick:')).toEqual(['3.5–4', '3–3.5', '2.5–3', '2–2.5', '1.5–2', '1–1.5', '0.5–1', '0–0.5']);
    expect(texts(ratio, 'xtick:')).toEqual(Array.from({ length: 17 }, (_, i) => String(i / 2)));
    // The bottom left cell is the least of both, and the engine's order does not move it.
    const corner = cells(ratio).find((n) => n.pair![0] === '0' && n.pair![1] === '0')!;
    expect(corner).toMatchObject({ key: 'primary:cell:0:0', x: 0, y: 7 / 8 });
    expect(cells(run(grids.bins2d!, 700, null, 'typical', 'svg', { ...result, rows: result.rows.slice().reverse() }).ratio)).toEqual(cells(ratio));
    // A pair nothing fell in is a count of none, a step of the ramp, and not no value.
    expect(result.rows.some((r) => r.pageviews === 0)).toBe(true);
    expect(cells(ratio).every((n) => /^seq\.\d+$/.test(n.paint))).toBe(true);
    expect(plan.text).toBe('Most page views at page weight 1–1.5, load time 1.5–2 (1,770) in the last 28 days. 1.5–2 is the busiest page weight at 32% of page views, and 2–2.5 the busiest load time at 19%.');
  });
  it('a dot stands in each pair of a grid in place of its cell, sized by how far its value is from zero and painted by the same scale a cell is', () => {
    const { ratio, plan, result, scene } = run(grids.circles!, 700), value = (n: CircleNode) => result.rows.find((r) => r.other_factor === n.pair![0] && r.factor === n.pair![1])!.correlation as number;
    expect(ratio).toMatchObject({ layout: 'matrix', parts: ['y-axis', 'plot', 'x-axis', 'ramp', 'size'] });
    expect([cells(ratio).length, dots(ratio).length]).toEqual([0, 36]);
    // In the middle of its pair, in the grid's reading order, keyed by the pair as a cell is.
    expect(dots(ratio)[7]).toMatchObject({ key: 'primary:dot:Traffic:Traffic', pair: ['Traffic', 'Traffic'], x: 1.5 / 6, t: 1 - 1.5 / 6, size: 4, paint: 'div.9', layer: 'data', role: 'primary' });
    expect(dots(ratio).every((n) => n.row == null)).toBe(true);
    // The size steps are a plot's, by area, of the magnitude: the most is the farther end of the stated domain, 1.
    for (const n of dots(ratio)) expect([n.size, n.paint], n.key).toEqual([sizeStep(Math.abs(value(n)), 1), 'div.' + Math.min(9, 1 + Math.floor(((value(n) + 1) / 2) * 9))]);
    const of = (a: string, b: string) => dots(ratio).find((n) => n.pair![0] === a && n.pair![1] === b)!;
    expect([of('Churn', 'Conversion rate'), of('Ad spend', 'Traffic'), of('Ad spend', 'Refund rate')].map((n) => [n.size, n.paint])).toEqual([[3, 'div.2'], [4, 'div.9'], [1, 'div.5']]);
    // Its keys are the ramp and a plot's key to sizes, in the steps' own values where a count is too few to round.
    expect(texts(ratio, 'ramp:')).toEqual(['-1', '0', '1']);
    expect(texts(ratio, 'size:')).toEqual(['Correlation', '0.1', '0.3', '0.6', '1']);
    expect(plan.text).toBe(run(grids.correlogram!, 700).plan.text);
    // place() sets each no wider than its cell, the ramp under the grid and the key to sizes under the ramp.
    const placed = scene.nodes.filter((n) => n.kind === 'circle' && /^primary:dot:/.test(n.key)) as unknown as { cx: number; cy: number; r: number }[];
    expect(placed.length).toBe(36);
    expect(Math.max(...placed.map((n) => n.r))).toBe(12);
    expect(scene.height).toBe(184 + 24 + 28);
    expect(scene.nodes.find((n) => n.key === 'size:title')).toMatchObject({ y: 14, ty: 184 + 24 });
    // The two keys go together where there is no room, and the grid stays.
    expect([run(grids.circles!, 234).ratio.parts.join(' '), run(grids.circles!, 234).plan.dropped]).toEqual(['y-axis plot x-axis', ['the colour ramp and the key to sizes']]);
  });
  it('a dot over a cell is sized by its own metric in its own paint, shrinks to its cell, and a pair with no value has the least dot in the paint of no value', () => {
    const over: Spec = { spec: 'view/0', query: { metrics: ['visitors', 'pageviews'], by: ['weekday', 'hour'], range: '28d' },
      layers: [{ mark: 'cell', encode: { y: 'weekday', x: 'hour', color: 'visitors' } }, { mark: 'dot', encode: { y: 'weekday', x: 'hour', size: 'pageviews' }, paint: 'ink' }] };
    expect(view(over), JSON.stringify(view.errors)).toBe(true);
    const { ratio, scene, result } = run(over, 700), most = Math.max(...result.rows.map((r) => (r.pageviews as number) ?? 0));
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'x-axis', 'ramp', 'size']);
    expect([cells(ratio).length, dots(ratio).length]).toEqual([168, 168]);
    expect(cells(ratio)).toEqual(cells(run(heatmap, 700).ratio).map((n) => ({ ...n, key: n.key.replace('primary:cell', 'primary:cell') })));
    const none = dots(ratio).filter((n) => n.size == null);
    expect(none.map((n) => [n.key, n.paint])).toEqual([['primary:dot:3am:Wed', 'seq.none'], ['primary:dot:4am:Wed', 'seq.none'], ['primary:dot:5am:Wed', 'seq.none']]);
    expect(dots(ratio).filter((n) => n.size != null).every((n) => n.paint === 'ink')).toBe(true);
    expect(dots(ratio).find((n) => n.pair!.join() === '11am,Wed')!.size).toBe(sizeStep(result.rows.find((r) => r.weekday === 'Wed' && r.hour === '11am')!.pageviews as number, most));
    // Twenty-four columns in 700 px are narrower than a plot's largest dot, so each step is its share of the cell.
    const cellW = (700 - (3 * 6.6 + 14)) / 24, placed = scene.nodes.filter((n) => n.kind === 'circle' && /^primary:dot:/.test(n.key)) as unknown as { r: number }[];
    expect(Math.max(...placed.map((n) => n.r))).toBeCloseTo(Math.min(cellW, (184 - 22) / 7) / 2 - 0.5, 9);
    // Every key is unique in both scenes, and the sweep holds: nothing taller than its box.
    for (const [w, h] of [[346, null], [346, 160], [250, 100], [120, null]] as [number, number | null][]) { const s = run(over, w, h); expect(new Set(s.scene.nodes.map((n) => n.key)).size).toBe(s.scene.nodes.length); if (h != null && s.plan.layout !== 'prose') expect(s.scene.height).toBeLessThanOrEqual(h); }
  });
  it('a square of pages has the same values down the side as across', () => {
    const { ratio } = run(grids.adjacency!, 700);
    expect(ratio.ys).toEqual(ratio.rows);
    expect(cells(ratio).length).toBe(64);
  });
});

describe('the fixture: visitors by weekday and hour', () => {
  it('answers with a row per pair, each dimension in its own order in totalsBy, and no count where the collector was down', () => {
    const { rows, totals, totalsBy } = runQuery(heatmap.query);
    expect(rows.length).toBe(7 * 24);
    expect(totalsBy!.weekday!.map((r) => r.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(totalsBy!.hour!.map((r) => r.hour).filter((_, i) => i % 6 === 0)).toEqual(['12am', '6am', '12pm', '6pm']);
    expect(rows.filter((r) => r.visitors == null).map((r) => r.weekday + ' ' + r.hour)).toEqual(['Wed 3am', 'Wed 4am', 'Wed 5am']);
    expect(Math.abs(totalsBy!.weekday!.reduce((s, r) => s + (r.visitors as number), 0) - totals.visitors!)).toBeLessThanOrEqual(3);
  });
});

describe('cell', () => {
  const { ratio, result } = run(heatmap, 700);
  it('is a grid: a dimension on x, another on y, each in its own order whatever the rows\' order', () => {
    expect(ratio).toMatchObject({ layout: 'matrix', parts: ['y-axis', 'plot', 'x-axis', 'ramp'], ys: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] });
    expect(ratio.rows!.length).toBe(24);
    expect(cells(ratio).length).toBe(7 * 24);
    // A row of the grid at a time, from the top. Cells meet: the gap is the painter's.
    expect(cells(ratio)[25]).toMatchObject({ key: 'primary:cell:1am:Tue', pair: ['1am', 'Tue'], x: 1 / 24, w: 1 / 24, y: 1 / 7, h: 1 / 7, layer: 'data', role: 'primary' });
    expect(cells(ratio).every((n) => n.row == null)).toBe(true);
    const turned = { ...result, rows: result.rows.slice().reverse() };
    expect(cells(run(heatmap, 700, null, 'typical', 'svg', turned).ratio)).toEqual(cells(ratio));
    // An engine that sends no totals by dimension leaves only the rows to order by, and it ranks them: Saturday is the quietest.
    expect(run(heatmap, 700, null, 'typical', 'svg', { ...turned, totalsBy: undefined }).ratio.ys![0]).toBe('Sat');
  });
  it('quantizes its value to the ten steps of the ramp, between the least and the most of the cells drawn', () => {
    const value = (n: RectNode) => result.rows.find((r) => r.hour === n.pair![0] && r.weekday === n.pair![1])!.visitors as number | null;
    const drawn = cells(ratio).filter((n) => value(n) != null), vals = drawn.map(value) as number[], lo = Math.min(...vals), hi = Math.max(...vals);
    expect([lo, hi]).toEqual([10, 158]);
    for (const n of drawn) expect(n.paint, n.key).toBe('seq.' + Math.min(10, 1 + Math.floor(((value(n)! - lo) / (hi - lo)) * 10)));
    expect(new Set(drawn.map((n) => n.paint)).size).toBe(10);
    // A scene carries tokens and never a colour.
    expect(cells(ratio).every((n) => /^seq\.(\d+|none)$/.test(n.paint))).toBe(true);
  });
  it('paints a cell with no value seq.none, not the lowest step, and so a pair the result has no row for', () => {
    const none = cells(ratio).filter((n) => n.paint === 'seq.none').map((n) => n.key);
    expect(none).toEqual(['primary:cell:3am:Wed', 'primary:cell:4am:Wed', 'primary:cell:5am:Wed']);
    const holed = { ...result, rows: result.rows.filter((r) => !(r.weekday === 'Mon' && r.hour === '12am')) };
    expect(cells(run(heatmap, 700, null, 'typical', 'svg', holed).ratio)[0]).toMatchObject({ key: 'primary:cell:12am:Mon', paint: 'seq.none' });
  });
  it('measures from zero where every cell holds one value, and takes a domain the catalog states', () => {
    const flat = (v: number) => run(heatmap, 700, null, 'typical', 'svg', { ...result, rows: result.rows.map((r) => ({ ...r, visitors: v })) }).ratio;
    expect([new Set(cells(flat(40)).map((n) => n.paint)), texts(flat(40), 'ramp:')]).toEqual([new Set(['seq.10']), ['0', '40']]);
    expect([new Set(cells(flat(0)).map((n) => n.paint)), texts(flat(0), 'ramp:')]).toEqual([new Set(['seq.1']), ['0', '1']]);
    const stated = { ...catalog, metrics: { ...catalog.metrics, visitors: { ...catalog.metrics.visitors!, domain: [0, 1000] as [number, number] } } };
    const scene = buildScene(resolve(heatmap, result, makeContainer(700), stated), heatmap.query, result, stated);
    expect(texts(scene, 'ramp:')).toEqual(['0', '1k', 'No data']);
    expect(new Set(cells(scene).map((n) => n.paint))).toEqual(new Set(['seq.1', 'seq.2', 'seq.none']));
  });
});

describe('the ramp, and the labels', () => {
  it('the ramp is the low value, a swatch per step, the high value, and the swatch for no value where a cell has none', () => {
    const { ratio, result } = run(heatmap, 700), ramp = ratio.nodes.filter((n) => n.part === 'ramp');
    expect(ramp.map((n) => n.key)).toEqual(['ramp:low', ...Array.from({ length: 10 }, (_, i) => 'ramp:' + (i + 1)), 'ramp:high', 'ramp:none', 'ramp:none:label']);
    expect(ramp.filter((n) => n.kind === 'rect').map((n) => n.paint)).toEqual([...Array.from({ length: 10 }, (_, i) => 'seq.' + (i + 1)), 'seq.none']);
    expect(texts(ratio, 'ramp:')).toEqual(['10', '158', 'No data']);
    const whole = { ...result, rows: result.rows.map((r) => ({ ...r, visitors: r.visitors ?? 12 })) };
    expect(run(heatmap, 700, null, 'typical', 'svg', whole).ratio.nodes.some((n) => n.key.startsWith('ramp:none'))).toBe(false);
  });
  it('the scene holds the ramp whether or not the plan shows it, and place() draws it under the grid only when it does', () => {
    const wide = run(heatmap, 346), narrow = run(heatmap, 234);
    expect(narrow.ratio.nodes.filter((n) => n.part === 'ramp').length).toBe(14);
    expect([wide.scene.height, narrow.scene.height]).toEqual([184 + 24, 184]);
    expect(narrow.scene.nodes.some((n) => n.key.startsWith('ramp:'))).toBe(false);
    const swatches = wide.scene.nodes.filter((n) => /^ramp:\d+$/.test(n.key)) as unknown as { x: number; y: number; ty: number; w: number }[];
    expect(swatches.map((n) => n.x)).toEqual(Array.from({ length: 10 }, (_, i) => 2 * 6.6 + 6 + i * 15));
    expect(swatches[0]).toMatchObject({ y: 8, ty: 184, w: 14 });
  });
  it('every label is in the scene, ranked, and place() thins them by rank where they would meet', () => {
    const { ratio } = run(heatmap, 700), rank = (prefix: string) => ratio.nodes.filter((n) => n.key.startsWith(prefix)).map((n) => n.rank ?? 0);
    expect(texts(ratio, 'ytick:')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(rank('ytick:')).toEqual([0, 2, 2, 1, 2, 2, 0]);
    expect(rank('xtick:').slice(0, 7)).toEqual([0, 2, 2, 1, 2, 2, 0]);
    expect(texts(run(heatmap, 1000).scene, 'xtick:').length).toBe(24);
    expect(texts(run(heatmap, 346).scene, 'xtick:')).toEqual(['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm']);
    expect(texts(run(heatmap, 234).scene, 'xtick:')).toEqual(['12am', '6am', '12pm', '6pm']);
    expect(texts(run(heatmap, 346).scene, 'ytick:').length).toBe(7);
    expect(texts(run(heatmap, 346, 100).scene, 'ytick:')).toEqual(['Mon', 'Thu', 'Sun']);
  });
  it('place() sets the cells a hairline apart, beside a gutter as wide as the longest row label', () => {
    const { scene } = run(heatmap, 346), at = (k: string) => scene.nodes.find((n) => n.key === k) as unknown as { x: number; y: number; w: number; h: number };
    const ml = 3 * 6.6 + 14, pw = (346 - ml) / 24, ph = (184 - 22) / 7, first = at('primary:cell:12am:Mon'), next = at('primary:cell:1am:Tue');
    expect(first).toMatchObject({ x: ml, y: 0, rx: 1 });
    [[first.w, pw - 1], [first.h, ph - 1], [next.x, ml + pw], [next.y, ph]].forEach(([px, want]) => expect(px).toBeCloseTo(want!, 9));
    expect(at('ytick:Mon')).toMatchObject({ x: ml - 6, anchor: 'end', baseline: 'middle' });
    expect(at('ytick:Mon').y).toBeCloseTo(ph / 2, 9);
    expect(at('xtick:12am')).toMatchObject({ x: ml + pw / 2, y: 184 - 5, anchor: 'middle' });
  });
});

describe('prose, the preset and errors', () => {
  it('says the peak cell, and the busiest value of each dimension as a share of the engine\'s total', () => {
    expect(run(heatmap, 346).plan.text).toBe('Most visitors at Wed, 11am (158) in the last 28 days. Tue is the busiest weekday at 17% of visitors, and 11am the busiest hour at 8.1%.');
    expect(run(heatmap, 346, null, 'empty').plan.text).toBe('Visitors: nothing recorded in the last 28 days.');
    expect((run(heatmap, 120).ratio.nodes.find((n) => n.key === 'sub') as { text: string }).text).toBe('Top: Tue');
  });
  it('the heatmap preset reads as a pivot table: the first dimension down the side, the second across', () => {
    expect(expand(heatmap).layers).toEqual([{ mark: 'cell', encode: { y: 'weekday', x: 'hour', color: 'visitors' } }]);
    expect(run(heatmap, 346).plan.preset).toBe('heatmap');
    expect(err({ use: 'heatmap', query: { metrics: ['visitors'], by: ['weekday'] } })).toBe('The "heatmap" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  });
  it('errors name the fix: a grid of anything but one cell layer, a cell with no metric on color, and a cell on a plot', () => {
    const q = { metrics: ['visitors'], by: ['weekday', 'hour'] }, grid = 'A dimension on both x and y makes a grid, and a grid draws a "cell" with a metric on color, a "dot" with a metric on size, or the two together on the same x and y. Write { "mark": "cell", "encode": { "x": "hour", "y": "weekday", "color": a metric } }, or { "mark": "dot", "encode": { "x": "hour", "y": "weekday", "size": a metric } }, which may have a metric on color where no cell has one. Leave x or y out of a cell alone for one column or one row, or move a dimension off an axis.';
    expect(err({ query: q, layers: [{ mark: 'bar', encode: { x: 'hour', y: 'weekday', color: 'visitors' } }] })).toBe(grid);
    expect(err({ query: q, layers: [{ mark: 'cell', encode: { x: 'hour', y: 'weekday' } }] })).toBe(grid);
    expect(err({ query: q, layers: [...expand(heatmap).layers!, { mark: 'rule', encode: { y: 3 } }] })).toBe(grid);
    // A dot with no metric on size, one on other dimensions than the cell's, a second colour scale, and two of either mark.
    const dot = (encode: Record<string, string>) => ({ mark: 'dot' as const, encode: { x: 'hour', y: 'weekday', ...encode } });
    expect(err({ query: q, layers: [dot({})] })).toBe(grid);
    expect(err({ query: q, layers: [dot({ size: 'visitors', color: 'weekday' })] })).toBe(grid);
    expect(err({ query: q, layers: [...expand(heatmap).layers!, dot({ size: 'visitors', color: 'visitors' })] })).toBe(grid);
    expect(err({ query: q, layers: [...expand(heatmap).layers!, { mark: 'dot', encode: { x: 'weekday', y: 'hour', size: 'visitors' } }] })).toBe(grid);
    expect(err({ query: q, layers: [dot({ size: 'visitors' }), dot({ size: 'visitors' })] })).toBe(grid);
    expect(err({ query: q, layers: [dot({ size: 'visitors' })] })).toBeUndefined();
    expect(err({ query: { metrics: ['visitors'], by: ['weekday'] }, layers: [{ mark: 'cell', encode: { x: 'weekday', y: 'visitors' } }] })).toBe('The "cell" mark has no rule for a time or category axis yet. Use line, area, bar, rule, dot, text, tick or unit.');
    expect(err({ query: q, layers: [{} as never] })).toBe('Layer 1 has no "mark". Use one of: line, area, bar, rule, text, arc, cell, dot, tick, unit.');
    expect(view({ spec: 'view/0', query: heatmap.query, layers: expand(heatmap).layers }), JSON.stringify(view.errors)).toBe(true);
  });
});
