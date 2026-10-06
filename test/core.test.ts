import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import Ajv from 'ajv';
import * as d3array from 'd3-array';
import * as d3scale from 'd3-scale';
import * as d3shape from 'd3-shape';
import { describe, expect, it } from 'vitest';
import { buildScene, expand, makeHost, resolve, type PainterName, type Spec } from '@universal-analytics/core';
import catalogSchema from '@universal-analytics/core/schema/catalog.schema.json';
import viewSchema from '@universal-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples, scenarios } from '@universal-analytics/fixtures';

// The prototype, loaded as the reference the port is held to.
(globalThis as any).d3 = { ...d3array, ...d3scale, ...d3shape };
vm.runInThisContext(readFileSync(new URL('../prototype/prototype-bench.js', import.meta.url), 'utf8'));
const proto = (globalThis as any).VGB;
// The prototype calls the `line` preset `trend`. That rename is the one deliberate difference.
const toProto = (s: Spec): Spec => (s.use === 'line' ? { ...s, use: 'trend' } : s);

const trend = samples.trend!.spec;
const specs: Record<string, Spec> = {
  ...Object.fromEntries(Object.entries(samples).map(([k, s]) => [k, s.spec])),
  headed: { ...trend, headline: true },
  kept: { ...trend, keep: ['guides'] },
};
const invalid: Record<string, Spec> = {
  'unknown preset': { spec: 'view/0', use: 'donut', query: { metrics: ['visitors'], by: ['channel'] } },
  'dimension, no layers': { spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'] } },
  'preset, no dimension': { spec: 'view/0', use: 'line', query: { metrics: ['visitors'] } },
};
const painters: PainterName[] = ['svg', 'dots'];
const heights = [null, 300, 160, 100, 60, 40];
const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));
const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg') => {
  const host = makeHost(w, h, painter, 8), result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, host, catalog);
  return { plan, scene: buildScene(plan, spec.query, result, host, catalog), result };
};

describe('the sweep', () => {
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': matches the prototype, with unique keys, no NaN and nothing taller than the host allows', () => {
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(JSON.stringify(scene, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'sentence') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);

        const host0 = proto.makeHost(w, h, p, 8), res0 = proto.runQuery(spec.query, sc), plan0 = proto.resolve(toProto(spec), res0, host0);
        expect(plain(runQuery(spec.query, sc)), 'result: ' + at).toEqual(plain(res0));
        expect(plain(plan), 'plan: ' + at).toEqual({ ...plain(plan0), preset: plan.preset });
        expect(plain(scene), 'scene: ' + at).toEqual(plain(proto.buildScene(plan0, spec.query, res0, host0)));
      }
    });
  }
});

describe('fixture facts', () => {
  const total = (m: string) => runQuery({ metrics: [m], range: '28d', compare: 'previous' }).totals;
  it('visitors and page views', () => {
    expect(total('visitors')).toEqual({ visitors: 10531, 'visitors@previous': 9437 });
    expect(total('pageviews')).toEqual({ pageviews: 25061, 'pageviews@previous': 21974 });
  });
  it('28 daily rows, the last one partial', () => {
    const rows = runQuery(trend.query).rows;
    expect(rows.length).toBe(28);
    expect(rows.map((r) => r.partial).lastIndexOf(true)).toBe(27);
    expect(rows.filter((r) => r.partial).length).toBe(1);
  });
  it('channel shares', () => {
    const { rows, totals } = runQuery(samples.mix!.spec.query);
    expect(rows.map((r) => Math.round(((r.visitors as number) / totals.visitors!) * 100))).toEqual([41, 28, 14, 8, 6, 3]);
  });
  it('7 people present across 4 pages', () => {
    const { rows, totals } = runQuery(samples.live!.spec.query);
    expect(totals.present).toBe(7);
    expect(rows.length).toBe(4);
  });
});

describe('sentences', () => {
  const text = (name: string, sc?: (typeof scenarios)[number]) => run(specs[name]!, 346, null, sc).plan.text;
  it('are derived from the query', () => {
    expect(text('trend')).toBe('Visitors: 10.5k in the last 28 days, up 12% on the previous period. This is a sum of daily counts, not unique people.');
    expect(text('pages')).toBe('Top pages by page views, last 28 days: / (4,820), /pricing (2,960), /blog/launch-notes (2,105).');
    expect(text('mix')).toBe('Search is the largest channel at 41% of visitors, followed by Direct at 28%.');
    expect(text('total')).toBe('Page views: 25.1k in the last 28 days, up 14% on the previous period.');
    expect(text('live')).toBe('7 people are on the site right now; the busiest page is / (3).');
    expect(text('trend', 'empty')).toBe('No visitors recorded in the last 28 days.');
  });
});

describe('fitting the host (reference section 10.1)', () => {
  const applied = (name: string, w: number, h: number | null = null) => run(specs[name]!, w, h).plan;
  const state = (plan: ReturnType<typeof applied>, id: string) => plan.reductions.find((r) => r.id === id)!.state;

  it('a trend steps from chart, to number beside sparkline, to number, to sentence', () => {
    const full = applied('trend', 346);
    expect(full).toMatchObject({ layout: 'cartesian', side: false, guides: { x: true, y: true, grid: true } });
    expect(full.layers.map((l) => l.role)).toEqual(['context', 'comparison', 'primary']);
    expect(full.reductions.every((r) => r.state === 'not needed')).toBe(true);

    const spark = applied('trend', 250);
    expect(spark).toMatchObject({ layout: 'cartesian', side: true, headline: true, guides: { x: false, y: false, grid: false } });
    expect(spark.layers.map((l) => l.role)).toEqual(['primary']);

    expect(applied('trend', 120)).toMatchObject({ layout: 'none', headline: true });
    expect(applied('trend', 54).layout).toBe('sentence');
  });
  it('the comparison drops on legibility, not width alone', () => {
    expect(applied('trend', 346, 100).layers.map((l) => l.role)).not.toContain('comparison');
  });
  it('bars with a target become a bar sparkline', () => {
    const p = applied('layers', 250);
    expect(p).toMatchObject({ layout: 'cartesian', side: true });
    expect(p.layers.map((l) => l.mark)).toEqual(['bar']);
  });
  it('a bar list trims rows only under a height limit', () => {
    expect(applied('pages', 346).rowLimit).toBe(null);
    const p = applied('pages', 346, 100);
    expect(p.rowLimit).toBe(3);
    expect(p.dropped).toContain('rows 4 to 8');
  });
  it('a share bar gives up its legend before its marks', () => {
    expect(applied('mix', 346).guides.legend).toBe('full');
    expect(applied('mix', 150)).toMatchObject({ layout: 'band', guides: { legend: 'top' } });
  });
  it('keep stops a step from being applied', () => {
    const p = applied('kept', 250);
    expect(state(p, 'drop-guides')).toBe('kept by the spec');
    expect(p.side).toBe(false);
    const marks = run({ ...trend, keep: ['marks'] }, 120).plan;
    expect(state(marks, 'collapse')).toBe('kept by the spec');
  });
  it('reports a comparison it could not draw', () => {
    expect(run(trend, 346, null, 'no-prior').plan.dropped).toContain('comparison series (no prior data)');
  });
});

describe('validation', () => {
  it('names the fix', () => {
    const err = (s: Spec) => { try { resolve(s, runQuery(s.query), makeHost(346), catalog); } catch (e) { return (e as Error).message; } };
    expect(err(invalid['unknown preset']!)).toBe('Unknown preset "donut". The library has: line, bar-list, share-bar.');
    expect(err(invalid['dimension, no layers']!)).toBe('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: line, bar-list, share-bar.');
    expect(err(invalid['preset, no dimension']!)).toBe('The "line" preset needs a dimension in query.by.');
    expect(err({ query: { metrics: ['pageviews'], by: ['page'] }, layers: [{ mark: 'bar', encode: { y: 'page', x: 'visitors' } }] }))
      .toBe('Layer 1 encodes "visitors" on x, which the query does not return. It returns: page, pageviews.');
  });
  it('a preset expands into layers, without the comparison when the query has none', () => {
    expect(run(trend, 346).plan.preset).toBe('line');
    expect(expand(trend).layers!.map((l) => l.series)).toEqual([undefined, 'previous', undefined]);
    expect(expand({ ...trend, query: { ...trend.query, compare: undefined } }).layers!.length).toBe(2);
  });
});

describe('schemas', () => {
  const ajv = new Ajv();
  const view = ajv.compile(viewSchema), cat = ajv.compile(catalogSchema);
  it('accept the six samples and the fixture catalog', () => {
    for (const s of Object.values(samples)) expect(view(s.spec), JSON.stringify(view.errors)).toBe(true);
    expect(cat(catalog), JSON.stringify(cat.errors)).toBe(true);
  });
  it('reject a dimension with nothing to draw it, and a preset with no dimension', () => {
    expect(view(invalid['dimension, no layers'])).toBe(false);
    expect(view(invalid['preset, no dimension'])).toBe(false);
    expect(view({ ...trend, width: 346 })).toBe(false);
  });
});

describe('golden scenes', () => {
  const hosts: [number, number | null][] = [[346, null], [234, null], [346, 100]];
  for (const name of Object.keys(samples)) for (const [w, h] of hosts) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
});
