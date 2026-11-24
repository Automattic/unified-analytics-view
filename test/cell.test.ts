import { describe, expect, it } from 'vitest';
import { buildScene, expand, formatValue, resolve, sizeStep, type CircleNode, type RectNode, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, scenarios } from '@unified-analytics/fixtures';
import { err, run, shown, validView as view } from './helpers.ts';

// The `cell` mark and the grid it is laid out in (docs/chart-coverage-plan.md, step 5). No prototype knows it, so it
// is held to a sweep, facts and golden scenes of its own, as test/coverage.test.ts holds step 1.
const heatmap = moreSamples.heatmap!.spec;
const cells = (ratio: { nodes: unknown[] }) => (ratio.nodes as RectNode[]).filter((n) => n.part === 'plot' && n.kind === 'rect');
const dots = (ratio: { nodes: unknown[] }) => (ratio.nodes as CircleNode[]).filter((n) => n.part === 'plot' && n.kind === 'circle');
const texts = (scene: { nodes: unknown[] }, prefix: string) => (scene.nodes as { key: string; kind: string; text: string }[]).filter((n) => n.kind === 'text' && n.key.startsWith(prefix)).map((n) => n.text);

const nan = (_: string, v: unknown) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v);
const sizes: [number, number | null][] = [[346, null], [234, null], [346, 100]];

describe('the sweep', () => {
  it('unique keys, no NaN, ratios from 0 to 1, and at every room parts the scene has', () => {
    for (const sc of scenarios) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
      const at = [sc, w, h].join(' ');
      const { ratio, fit } = run(heatmap, w, h, sc);
      const all = ratio.nodes.map((n) => n.key);
      expect(new Set(all).size, 'duplicate keys: ' + at).toBe(all.length);
      expect(JSON.stringify(ratio, nan), 'NaN: ' + at).not.toMatch(/NaN/);
      expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), 'parts with nothing in them: ' + at).toEqual([]);
      for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'y', 'h', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
    }
  });
  it('resolves in every data state, and steps down: the ramp to a thin strip, then the grid for the number', () => {
    expect(view(heatmap), JSON.stringify(view.errors)).toBe(true);
    for (const sc of scenarios) {
      const at = (w: number, h: number | null = null, spec: Spec = heatmap) => { const { plan, ...r } = run(spec, w, h, sc), f = shown(r); return [plan.layout, f.parts.join(' '), f.set.ramp ?? 'whole']; };
      if (sc === 'empty') { expect([346, 234, 120].map((w) => at(w).slice(0, 2))).toEqual([['notice', 'notice'], ['notice', 'notice'], ['notice', 'number']]); continue; }
      expect(at(700)).toEqual(['matrix', 'y-axis plot x-axis ramp', 'whole']);
      expect(at(346)).toEqual(['matrix', 'y-axis plot x-axis ramp', 'whole']);
      expect(run(heatmap, 346, null, sc).fit.held).toEqual([]);
      // The ramp is the key to the colours, so it stays as long as the grid: under its own need as a strip.
      expect(at(234)).toEqual(['matrix', 'y-axis plot x-axis ramp', 'strip']);
      expect(at(346, 149)).toEqual(['matrix', 'y-axis plot x-axis ramp', 'strip']);
      expect(at(346, 90)).toEqual(['matrix', 'y-axis plot x-axis ramp', 'strip']);
      // A grid has no bare form beside the number: under its `marks` need it is the number alone.
      expect(at(149).slice(0, 2)).toEqual(['matrix', 'number']);
      expect(at(346, 89)[1]).toBe('number');
      // A ramp the spec keeps stays whole, and the grid with it, down to the grid's own need.
      expect([234, 150, 149].map((w) => at(w, null, { ...heatmap, keep: ['guides'] }).slice(1))).toEqual([['y-axis plot x-axis ramp', 'whole'], ['y-axis plot x-axis ramp', 'whole'], ['number', 'whole']]);
    }
  });
});

describe('golden scenes', () => {
  it('heatmap', () => expect(run(heatmap, 346).ratio).toMatchSnapshot());
  it('heatmap, at each room', () => expect(sizes.map(([w, h]) => [w, h, shown(run(heatmap, w, h))])).toMatchSnapshot());
});

// The grids step 0 of docs/uncommon-coverage-plan.md added: a calendar, a strip of days and a square of pages. And
// step 5's: a correlation matrix and its circles, and a count by two binned quantities.
describe('the grids of the Uncommon types', () => {
  const grids = Object.fromEntries(['calendar', 'stripes', 'adjacency', 'correlogram', 'highlight', 'circles', 'bins2d'].map((k) => [k, moreSamples[k]!.spec]));
  for (const [name, spec] of Object.entries(grids)) {
    it(name + ': unique keys, no NaN, ratios from 0 to 1, parts the scene has at every room, and every data state', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      for (const sc of scenarios) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
        const at = [name, sc, w, h].join(' ');
        const { ratio, fit } = run(spec, w, h, sc);
        const all = ratio.nodes.map((n) => n.key);
        expect(new Set(all).size, 'duplicate keys: ' + at).toBe(all.length);
        expect(JSON.stringify(ratio, nan), 'NaN: ' + at).not.toMatch(/NaN/);
        expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), 'parts with nothing in them: ' + at).toEqual([]);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'y', 'h', 't']) if (n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
      }
      // Under the room its marks need a grid is its number, and so is a notice under its own.
      for (const sc of scenarios) expect([346, 234, 120].map((w) => { const { plan, fit } = run(spec, w, null, sc); return fit.parts.join() === 'number' ? 'number' : plan.layout; }), sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'number'] : ['matrix', 'matrix', 'number']);
    });
    it(name, () => expect(run(spec, 346).ratio).toMatchSnapshot());
    it(name + ', at each room', () => expect(sizes.map(([w, h]) => [w, h, shown(run(spec, w, h))])).toMatchSnapshot());
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
    const { result } = run(grids.stripes!, 700), with_ = (f: (v: number) => number, cat = catalog) => { const r = { ...result, rows: result.rows.map((row) => ({ ...row, net_subscribers: f(row.net_subscribers as number) })) }; return buildScene(resolve(grids.stripes!, r, cat), grids.stripes!.query, r, cat); };
    // All at or above zero, and all at or below it, are sequential, as they were.
    expect(cells(with_((v) => Math.abs(v))).every((n) => n.paint.startsWith('seq.'))).toBe(true);
    expect(cells(with_((v) => -Math.abs(v))).every((n) => n.paint.startsWith('seq.'))).toBe(true);
    expect(texts(with_((v) => -Math.abs(v)), 'ramp:')).toEqual(['-20', '-1']);
    // A stated domain that crosses zero is diverging whatever the values, and its farther end measures both arms.
    const stated = { ...catalog, metrics: { ...catalog.metrics, net_subscribers: { ...catalog.metrics.net_subscribers!, domain: [-10, 40] as [number, number] } } };
    expect(texts(with_((v) => Math.abs(v), stated), 'ramp:')).toEqual(['-40', '0', '40']);
    expect(new Set(cells(with_((v) => Math.abs(v), stated)).map((n) => n.paint))).toEqual(new Set(['div.5', 'div.6', 'div.7']));
    // No value is the same token on either ramp: it is not zero.
    const holed = { ...result, rows: result.rows.map((r, i) => (i ? r : { ...r, net_subscribers: null })) }, scene = buildScene(resolve(grids.stripes!, holed, catalog), grids.stripes!.query, holed, catalog);
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
    expect(cells(run(grids.bins2d!, 700, null, 'typical', { result: { ...result, rows: result.rows.slice().reverse() } }).ratio)).toEqual(cells(ratio));
    // A pair nothing fell in is a count of none, a step of the ramp, and not no value.
    expect(result.rows.some((r) => r.pageviews === 0)).toBe(true);
    expect(cells(ratio).every((n) => /^seq\.\d+$/.test(n.paint))).toBe(true);
    expect(plan.text).toBe('Most page views at page weight 1–1.5, load time 1.5–2 (1,770) in the last 28 days. 1.5–2 is the busiest page weight at 32% of page views, and 2–2.5 the busiest load time at 19%.');
  });
  it('a dot stands in each pair of a grid in place of its cell, sized by how far its value is from zero and painted by the same scale a cell is', () => {
    const { ratio, plan, result } = run(grids.circles!, 700), value = (n: CircleNode) => result.rows.find((r) => r.other_factor === n.pair![0] && r.factor === n.pair![1])!.correlation as number;
    expect(ratio).toMatchObject({ layout: 'matrix', parts: ['y-axis', 'plot', 'x-axis', 'ramp', 'size'] });
    expect([cells(ratio).length, dots(ratio).length]).toEqual([0, 36]);
    // In the middle of its pair, in the grid's reading order, keyed by the pair as a cell is.
    expect(dots(ratio)[7]).toMatchObject({ key: 'primary:dot:Traffic:Traffic', pair: ['Traffic', 'Traffic'], x: 1.5 / 6, y: 1 - 1.5 / 6, size: 4, paint: 'div.9', layer: 'data', role: 'primary' });
    expect(dots(ratio).every((n) => n.row == null)).toBe(true);
    // The size steps are a plot's, by area, of the magnitude: the most is the farther end of the stated domain, 1.
    for (const n of dots(ratio)) expect([n.size, n.paint], n.key).toEqual([sizeStep(Math.abs(value(n)), 1), 'div.' + Math.min(9, 1 + Math.floor(((value(n) + 1) / 2) * 9))]);
    const of = (a: string, b: string) => dots(ratio).find((n) => n.pair![0] === a && n.pair![1] === b)!;
    expect([of('Churn', 'Conversion rate'), of('Ad spend', 'Traffic'), of('Ad spend', 'Refund rate')].map((n) => [n.size, n.paint])).toEqual([[3, 'div.2'], [4, 'div.9'], [1, 'div.5']]);
    // Its keys are the ramp and a plot's key to sizes, in the steps' own values where a count is too few to round.
    expect(texts(ratio, 'ramp:')).toEqual(['-1', '0', '1']);
    expect(texts(ratio, 'size:')).toEqual(['Correlation', '0.1', '0.3', '0.6', '1']);
    expect(plan.text).toBe(run(grids.correlogram!, 700).plan.text);
    // The two keys step down together where there is no room, and stay as long as the grid: a strip, and the largest step alone.
    expect(shown(run(grids.circles!, 234))).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'ramp', 'size'], set: { ramp: 'strip', 'size-key': 'most' }, rules: ['ramp'] });
    expect(shown(run(grids.circles!, 346))).toMatchObject({ parts: ['y-axis', 'plot', 'x-axis', 'ramp', 'size'], set: {}, rules: [] });
  });
  // Step 3 of the refinement plan, stage 1 (reference, Open 21): a grid is a plot whose two axes are both lists, and it
  // draws the plot's own `text`, by the plot's function, handed the grid's places.
  it('a text says each pair\'s value in the middle of its place: the plot\'s own label, over the cells', () => {
    const { ratio, plan, result } = run(grids.highlight!, 700), labels = ratio.nodes.filter((n) => n.part === 'point-labels') as any[];
    expect(plan).toMatchObject({ layout: 'matrix', guides: { x: true, y: true, ramp: true, pointLabels: true } });
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'point-labels', 'x-axis', 'ramp']);
    // Under them the grid is the correlogram's, node for node.
    expect(ratio.nodes.filter((n) => n.part !== 'point-labels').map((n) => ({ ...n, key: n.key.replace('primary:cell', 'cell') }))).toEqual(run(grids.correlogram!, 700).ratio.nodes.map((n) => ({ ...n, key: n.key.replace('primary:cell', 'cell') })));
    // One for each pair that has a value, keyed by the pair as its cell is, and no row's: a grid's marks are of pairs.
    expect(labels.length).toBe(result.rows.length);
    expect(labels.find((n) => n.pair[0] === 'Traffic' && n.pair[1] === 'Ad spend')).toMatchObject({ key: 'primary:text:Traffic:Ad spend', kind: 'text', text: '0.81', anchor: 'middle', font: 'tick', paint: 'ink', halo: true, layer: 'guide', role: 'primary' });
    expect(labels.every((n) => n.row == null)).toBe(true);
    // In the middle of the pair's place on each axis, which is where its cell's middle is.
    const cellOf = (n: any) => cells(ratio).find((c) => c.pair!.join() === n.pair.join())!;
    for (const n of labels) { const c = cellOf(n); expect(n.x, n.key).toBeCloseTo(c.x! + c.w! / 2, 12); expect(n.y, n.key).toBeCloseTo(1 - (c.y! + c.h! / 2), 12); }
    // What it says is the metric as the catalog writes it, and it is ranked by it, the largest first.
    expect(labels.map((n) => n.text)).toEqual(result.rows.map((r) => formatValue(r.correlation as number, catalog.metrics.correlation!)));
    expect([...labels].sort((a, b) => a.rank - b.rank).map((n) => n.text).slice(0, 6)).toEqual(Array(6).fill('1'));
    expect(new Set(labels.map((n) => n.rank)).size).toBe(labels.length);
  });
  it('a pair with no value says nothing, a dot may be what it stands over, and the labels go with the grid', () => {
    const q = moreSamples.highlight!.spec.query, text = { mark: 'text' as const, encode: { y: 'factor', x: 'other_factor', text: 'correlation' } };
    const holes = { ...runQuery(q), rows: runQuery(q).rows.map((r, i) => (i % 5 ? r : { ...r, correlation: null })) };
    const said = (spec: Spec, result = runQuery(spec.query)) => run(spec, 700, null, 'typical', { result }).ratio.nodes.filter((n) => n.part === 'point-labels').length;
    expect(said(grids.highlight!, holes)).toBe(holes.rows.filter((r) => r.correlation != null).length);
    expect(said({ query: q, layers: [...grids.circles!.layers!, text] })).toBe(36);
    // It may say a dimension, or a companion of one, as a plot's label may.
    expect((run({ query: q, layers: [grids.highlight!.layers![0]!, { ...text, encode: { ...text.encode, text: 'factor' } }] }, 700).ratio.nodes.find((n) => n.part === 'point-labels') as any).text).toBe('Conversion rate');
    // No rule takes the labels alone: where they do not fit their cells a surface gives them all up, which is measured. They go with the grid.
    expect(shown(run(grids.highlight!, 346)).parts).toEqual(['y-axis', 'plot', 'point-labels', 'x-axis', 'ramp']);
    expect(shown(run(grids.highlight!, 120)).parts).toEqual(['number']);
  });
  it('errors name the fix: a text with nothing under it, on other axes, twice, or with nothing to say', () => {
    const q = moreSamples.highlight!.spec.query, [cell, text] = grids.highlight!.layers!, at = '"x": "other_factor", "y": "factor"';
    expect(err({ query: q, layers: [text!] })).toBe('Layer 1 is a "text" in a grid with no cell or dot under it, and it is the cells and dots that a reader steps through. Add { "mark": "cell", "encode": { ' + at + ', "color": a metric } } before it, or a "dot" with a metric on size.');
    expect(err({ query: q, layers: [cell!, { mark: 'text', encode: { x: 'factor', y: 'other_factor', text: 'correlation' } }] })).toBe('Layer 2 is a "text" in a grid whose axes are not the grid\'s. Encode { ' + at + ' } on it, as the cell does.');
    expect(err({ query: q, layers: [cell!, text!, text!] })).toBe('Layer 3 is a "text" in a grid, and layer 2 is one already: a pair has room for one. Remove one of the two.');
    expect(err({ query: q, layers: [cell!, { mark: 'text', encode: { y: 'factor', x: 'other_factor' } }] })).toBe('Layer 2 is a "text" in a grid with nothing on text, so it has nothing to say. Encode what each pair should say there, for example { ' + at + ', "text": "correlation" }.');
    // What needs a quantity to stand at has no place between two lists, and the grid says what it does draw.
    expect(err({ query: q, layers: [cell!, { mark: 'tick', encode: { y: 'factor', x: 'other_factor' } }] })).toMatch(/^A dimension on both x and y makes a grid, .* A "text" on the same x and y says a value over either\./);
  });
  it('a dot over a cell is sized by its own metric in its own paint, shrinks to its cell, and a pair with no value has the least dot in the paint of no value', () => {
    const over: Spec = { spec: 'view/0', query: { metrics: ['visitors', 'pageviews'], by: ['weekday', 'hour'], range: '28d' },
      layers: [{ mark: 'cell', encode: { y: 'weekday', x: 'hour', color: 'visitors' } }, { mark: 'dot', encode: { y: 'weekday', x: 'hour', size: 'pageviews' }, paint: 'ink' }] };
    expect(view(over), JSON.stringify(view.errors)).toBe(true);
    const { ratio, result } = run(over, 700), most = Math.max(...result.rows.map((r) => (r.pageviews as number) ?? 0));
    expect(ratio.parts).toEqual(['y-axis', 'plot', 'x-axis', 'ramp', 'size']);
    expect([cells(ratio).length, dots(ratio).length]).toEqual([168, 168]);
    expect(cells(ratio)).toEqual(cells(run(heatmap, 700).ratio).map((n) => ({ ...n, key: n.key.replace('primary:cell', 'primary:cell') })));
    const none = dots(ratio).filter((n) => n.size == null);
    expect(none.map((n) => [n.key, n.paint])).toEqual([['primary:dot:3am:Wed', 'seq.none'], ['primary:dot:4am:Wed', 'seq.none'], ['primary:dot:5am:Wed', 'seq.none']]);
    expect(dots(ratio).filter((n) => n.size != null).every((n) => n.paint === 'ink')).toBe(true);
    expect(dots(ratio).find((n) => n.pair!.join() === '11am,Wed')!.size).toBe(sizeStep(result.rows.find((r) => r.weekday === 'Wed' && r.hour === '11am')!.pageviews as number, most));
    // Every key is unique, with a cell and a dot in each pair.
    expect(new Set(ratio.nodes.map((n) => n.key)).size).toBe(ratio.nodes.length);
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
    expect(cells(run(heatmap, 700, null, 'typical', { result: turned }).ratio)).toEqual(cells(ratio));
    // An engine that sends no totals by dimension leaves only the rows to order by, and it ranks them: Saturday is the quietest.
    expect(run(heatmap, 700, null, 'typical', { result: { ...turned, totalsBy: undefined } }).ratio.ys![0]).toBe('Sat');
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
    expect(cells(run(heatmap, 700, null, 'typical', { result: holed }).ratio)[0]).toMatchObject({ key: 'primary:cell:12am:Mon', paint: 'seq.none' });
  });
  it('measures from zero where every cell holds one value, and takes a domain the catalog states', () => {
    const flat = (v: number) => run(heatmap, 700, null, 'typical', { result: { ...result, rows: result.rows.map((r) => ({ ...r, visitors: v })) } }).ratio;
    expect([new Set(cells(flat(40)).map((n) => n.paint)), texts(flat(40), 'ramp:')]).toEqual([new Set(['seq.10']), ['0', '40']]);
    expect([new Set(cells(flat(0)).map((n) => n.paint)), texts(flat(0), 'ramp:')]).toEqual([new Set(['seq.1']), ['0', '1']]);
    const stated = { ...catalog, metrics: { ...catalog.metrics, visitors: { ...catalog.metrics.visitors!, domain: [0, 1000] as [number, number] } } };
    const scene = buildScene(resolve(heatmap, result, stated), heatmap.query, result, stated);
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
    expect(run(heatmap, 700, null, 'typical', { result: whole }).ratio.nodes.some((n) => n.key.startsWith('ramp:none'))).toBe(false);
  });
  it('the scene holds every step of the ramp at any room, and under the ramp\'s need the rules set it as a strip', () => {
    const wide = run(heatmap, 346), narrow = run(heatmap, 234);
    expect(narrow.ratio.nodes.filter((n) => n.part === 'ramp').length).toBe(14);
    expect([wide.fit.set.ramp, narrow.fit.set.ramp]).toEqual([undefined, 'strip']);
  });
  it('every label is in the scene, ranked, for a surface to thin where they would meet', () => {
    const { ratio } = run(heatmap, 700), rank = (prefix: string) => ratio.nodes.filter((n) => n.key.startsWith(prefix)).map((n) => n.rank ?? 0);
    expect(texts(ratio, 'ytick:')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(rank('ytick:')).toEqual([0, 2, 2, 1, 2, 2, 0]);
    expect(rank('xtick:').slice(0, 7)).toEqual([0, 2, 2, 1, 2, 2, 0]);
    expect(texts(ratio, 'xtick:').length).toBe(24);
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
    const q = { metrics: ['visitors'], by: ['weekday', 'hour'] }, grid = 'A dimension on both x and y makes a grid, and a grid draws a "cell" with a metric on color, a "dot" with a metric on size, or the two together on the same x and y. Write { "mark": "cell", "encode": { "x": "hour", "y": "weekday", "color": a metric } }, or { "mark": "dot", "encode": { "x": "hour", "y": "weekday", "size": a metric } }, which may have a metric on color where no cell has one. A "text" on the same x and y says a value over either. Leave x or y out of a cell alone for one column or one row, or move a dimension off an axis.';
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
