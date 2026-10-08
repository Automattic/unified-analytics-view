import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { buildScene, expand, makeContainer, place, resolve, type PainterName, type RectNode, type Spec } from '@universal-analytics/core';
import viewSchema from '@universal-analytics/core/schema/view.schema.json';
import { catalog, moreSamples, runQuery, scenarios } from '@universal-analytics/fixtures';

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
    expect(run(heatmap, 346, null, 'empty').plan.text).toBe('No visitors recorded in the last 28 days.');
    expect((run(heatmap, 120).ratio.nodes.find((n) => n.key === 'sub') as { text: string }).text).toBe('Top: Tue');
  });
  it('the heatmap preset reads as a pivot table: the first dimension down the side, the second across', () => {
    expect(expand(heatmap).layers).toEqual([{ mark: 'cell', encode: { y: 'weekday', x: 'hour', color: 'visitors' } }]);
    expect(run(heatmap, 346).plan.preset).toBe('heatmap');
    expect(err({ use: 'heatmap', query: { metrics: ['visitors'], by: ['weekday'] } })).toBe('The "heatmap" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  });
  it('errors name the fix: a grid of anything but one cell layer, a cell with no metric on color, and a cell on a plot', () => {
    const q = { metrics: ['visitors'], by: ['weekday', 'hour'] }, grid = 'A dimension on both x and y makes a grid, and a grid draws one layer: a "cell" with a metric on color. Write { "mark": "cell", "encode": { "x": "hour", "y": "weekday", "color": a metric } } alone, or move a dimension off an axis.';
    expect(err({ query: q, layers: [{ mark: 'bar', encode: { x: 'hour', y: 'weekday', color: 'visitors' } }] })).toBe(grid);
    expect(err({ query: q, layers: [{ mark: 'cell', encode: { x: 'hour', y: 'weekday' } }] })).toBe(grid);
    expect(err({ query: q, layers: [...expand(heatmap).layers!, { mark: 'rule', encode: { y: 3 } }] })).toBe(grid);
    expect(err({ query: { metrics: ['visitors'], by: ['weekday'] }, layers: [{ mark: 'cell', encode: { x: 'weekday', y: 'visitors' } }] })).toBe('The "cell" mark has no rule for a time or category axis yet. Use line, area, bar, rule, dot, text or tick.');
    expect(err({ query: q, layers: [{} as never] })).toBe('Layer 1 has no "mark". Use one of: line, area, bar, rule, text, arc, cell, dot, tick.');
    expect(view({ spec: 'view/0', query: heatmap.query, layers: expand(heatmap).layers }), JSON.stringify(view.errors)).toBe(true);
  });
});
