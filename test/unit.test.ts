import { describe, expect, it } from 'vitest';
import { FIT_RULES, expand, glyphRadius, place, resolve, unitWorth } from '@unified-analytics/core';
import type { Catalog, CircleNode, Layer, PainterName, PlacedCircle, PlacedRect, RectNode, Result, Spec, TextNode } from '@unified-analytics/core';
import { catalog, moreSamples, scenarios } from '@unified-analytics/fixtures';
import { err as shared, run, validView as view } from './helpers.ts';

// Step 6 of docs/uncommon-coverage-plan.md: the `unit` mark, which draws a value as counted glyphs. It has no prototype
// to match, so it is held to its own sweep, facts and golden scenes, as test/radial.test.ts holds the arcs. The rules its
// counts come from are tested where they are written, in test/unit-rules.test.ts.
// Unlike the shared one, says so when there is no error.
const err = (s: Spec, result?: Result, c?: Catalog) => shared(s, result, c) ?? 'no error';
const NAMES = ['waffle', 'units', 'wilkinson', 'isotype', 'parliament', 'icons'];
const specs = Object.fromEntries(NAMES.map((k) => [k, moreSamples[k]!.spec])) as Record<string, Spec>;
const { waffle, units, wilkinson, isotype, parliament, icons } = specs as Record<string, Spec>;
/** The layout each form draws in, the preset it gives way to, and the layout that one draws in. */
const FORMS: Record<string, [layout: string, fallback: string, then: string]> = {
  waffle: ['band', 'share-bar', 'band'], units: ['cartesian', 'bar', 'cartesian'], wilkinson: ['cartesian', 'bar', 'cartesian'],
  isotype: ['rows', 'bar-list', 'rows'], parliament: ['radial', 'pie-semi-circle', 'radial'], icons: ['band', 'gauge', 'radial'],
};
const by = (m: string, d: string, layers: Layer[]): Spec => ({ spec: 'view/0', query: { metrics: [m], by: [d], range: '28d' }, layers });
const answer = (rows: Result['rows'], totals: Result['totals']): Result => ({ rows, totals, meta: { range: '28d', compare: null, notes: [] } });
const glyphs = (nodes: { key: string; part?: string }[]) => nodes.filter((n) => /^primary:unit[:#]/.test(n.key));
const count = <T>(of: T[]) => of.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<T, number>());
const keyOf = (ratio: { nodes: { part: string }[] }) => (ratio.nodes.filter((n) => n.part === 'unit-key') as TextNode[]).map((n) => n.text);

describe('the sweep, in glyphs', () => {
  const painters: PainterName[] = ['svg', 'dots'], heights = [null, 300, 200, 160, 100, 60, 40], widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
  for (const [name, spec] of Object.entries(specs)) {
    it(name + ': unique keys, no NaN, nothing taller than the container allows, ratios from 0 to 1, and a glyph for every key place() keeps', () => {
      for (const sc of scenarios) for (const p of painters) for (const h of heights) for (const w of widths) {
        const at = [name, sc, p, w, h].join(' ');
        const { plan, ratio, scene } = run(spec, w, h, sc, p);
        const keys = scene.nodes.map((n) => n.key), all = ratio.nodes.map((n) => n.key);
        expect(new Set(keys).size, 'duplicate keys: ' + at).toBe(keys.length);
        expect(new Set(all).size, 'duplicate keys in the ratio scene: ' + at).toBe(all.length);
        expect(JSON.stringify([scene, ratio], (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), 'NaN: ' + at).not.toMatch(/NaN/);
        if (h != null && plan.layout !== 'prose') expect(scene.height, 'too tall: ' + at).toBeLessThanOrEqual(h);
        for (const n of ratio.nodes as any[]) for (const f of ['x', 'w', 'y', 'h', 'v', 'v0', 't']) if (n.kind !== 'arc' && n[f] != null) expect(n[f] >= 0 && n[f] <= 1, f + ': ' + at + ' ' + n.key).toBe(true);
        expect(all.filter((k) => keys.includes(k)), 'placed keys: ' + at).toEqual(keys);
        // While the form is drawn every glyph is: a count is not thinned for room. Rows a height limit trims go whole.
        if (plan.layers.some((l) => l.mark === 'unit')) expect(glyphs(scene.nodes).length, 'glyphs: ' + at).toBe(glyphs(ratio.nodes).length);
        // A part that holds its shape is never stretched to its room.
        if (plan.layers.some((l) => l.mark === 'unit') && ratio.aspect) expect(scene.plot!.w / scene.plot!.h, 'shape: ' + at).toBeCloseTo(ratio.aspect, 9);
      }
    });
    it(name + ': resolves in every data state, gives way to the preset that needs less room, and steps down to the number and then the prose', () => {
      expect(view(spec), JSON.stringify(view.errors)).toBe(true);
      const [layout, fallback, then] = FORMS[name]!;
      for (const sc of scenarios) {
        // 346 has room for the glyphs and 250 has not. 10 px is narrower than any number, "0" included.
        const plans = [700, 346, 250, 10].map((w) => run(spec, w, null, sc).plan);
        expect(plans.map((p) => p.layout), sc).toEqual(sc === 'empty' ? ['notice', 'notice', 'notice', 'prose'] : [layout, layout, then, 'prose']);
        expect(plans.map((p) => p.layers.some((l) => l.mark === 'unit')), sc).toEqual(sc === 'empty' ? [false, false, false, false] : [true, true, false, false]);
        expect(plans[0]!.dropped, sc).toEqual([]);
        expect(plans[1]!.dropped, sc).toEqual([]);
        if (sc !== 'empty') expect(plans[2]!.dropped[0], sc).toBe('the ' + layout + ' marks (drawn as "' + fallback + '")');
      }
    });
  }
});

describe('golden scenes', () => {
  // With room for the glyphs, without it, and in a box.
  const sizes: [number, number | null][] = [[346, null], [250, null], [346, 200]];
  for (const name of NAMES) for (const [w, h] of sizes) {
    it(`${name} at ${w} by ${h ?? 'any'}`, () => expect(run(specs[name]!, w, h).scene).toMatchSnapshot());
  }
  it('the unit chart: the ratio scene', () => expect(run(units!, 346).ratio).toMatchSnapshot());
});

describe('a stack up from the axis', () => {
  it('a dot for each so-many of a row, keyed by its row and its place, in the layer\'s own paint, with the row on every one', () => {
    const { ratio, result } = run(units!, 346), dots = glyphs(ratio.nodes) as CircleNode[];
    expect(ratio).toMatchObject({ layout: 'cartesian', scale: 'band', parts: ['y-axis', 'plot', 'x-axis', 'unit-key'], rows: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] });   // a weekday in its own order, as the engine answers it
    // The largest weekday is 1,760: at 200 each it is nine dots, and at 100 it would be eighteen.
    const worth = unitWorth(Math.max(...result.rows.map((r) => r.visitors as number)), 10, true);
    expect([worth, keyOf(ratio)]).toEqual([200, ['Each is 200']]);
    expect([...count(dots.map((n) => n.row))]).toEqual(result.rows.map((r) => [r.weekday, Math.round((r.visitors as number) / worth)]));
    expect(dots.slice(0, 3).map((n) => n.key)).toEqual(['primary:unit:Mon:1', 'primary:unit:Mon:2', 'primary:unit:Mon:3']);
    expect(dots.every((n) => n.kind === 'circle' && n.part === 'plot' && n.paint === 'series.1' && n.role === 'primary' && n.layer === 'data' && n.row != null)).toBe(true);
  });
  it('is on the plot\'s own scale: a dot is its worth tall, the stack ends at its whole glyphs, and the axis reads true against it', () => {
    const { ratio } = run(units!, 346), dots = glyphs(ratio.nodes) as CircleNode[], tue = dots.filter((n) => n.row === 'Tue');
    // The scale is rounded to 2,000, so a dot of 200 has a tenth of the height, and the nine of Tuesday end at 1,800.
    expect(tue.map((n) => Math.round(n.t! * 1000) / 1000)).toEqual([0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85]);
    expect(new Set(dots.map((n) => Math.round(n.h! * 1e6) / 1e6))).toEqual(new Set([0.1]));
    expect(ratio.nodes.filter((n) => n.part === 'y-axis').map((n) => [(n as TextNode).text, (n as TextNode).t])).toEqual([['0', 0], ['500', 0.25], ['1k', 0.5], ['1.5k', 0.75], ['2k', 1]]);
    // Each has the width of its band, which is every row's alike.
    expect(new Set(dots.map((n) => n.w)).size).toBe(1);
    expect(tue.every((n) => n.x === tue[0]!.x)).toBe(true);
  });
  it('holds its shape: the painter draws the largest circle the room holds, by the lesser side in pixels, so a stack never overlaps and is never stretched', () => {
    for (const [w, h] of [[346, null], [700, null], [346, 150], [290, 130]] as [number, number | null][]) {
      const { scene, ratio } = run(units!, w, h), dots = glyphs(scene.nodes) as PlacedCircle[], tue = dots.filter((n) => n.key.startsWith('primary:unit:Tue:'));
      const pitch = tue[0]!.cy - tue[1]!.cy, band = (glyphs(ratio.nodes)[0] as CircleNode).w! * (scene.plot!.w - 42);
      expect(new Set(dots.map((n) => n.r)).size, w + ' ' + h).toBe(1);
      expect(tue[0]!.r, w + ' ' + h).toBeCloseTo(glyphRadius(band, pitch), 6);
      expect(2 * tue[0]!.r, w + ' ' + h).toBeLessThanOrEqual(Math.min(band, pitch));
    }
    expect(glyphRadius(30, 12)).toBe(5.5);
    expect(glyphRadius(8, 12)).toBe(3.5);
    expect(glyphRadius(0.4, 12)).toBe(0.5);                                   // never nothing
  });
  it('on a binned number dimension it is the Wilkinson dot plot: a column to a bin, as wide as the bin', () => {
    const { ratio, result, plan } = run(wilkinson!, 346), dots = glyphs(ratio.nodes) as CircleNode[];
    expect(ratio).toMatchObject({ layout: 'cartesian', scale: 'linear' });
    expect(plan.preset).toBeNull();
    expect(keyOf(ratio)).toEqual(['Each is 500']);
    expect(new Set(dots.map((n) => n.w))).toEqual(new Set([1 / 16]));
    expect(dots.filter((n) => n.row === '1.5').map((n) => n.x)).toEqual(Array(dots.filter((n) => n.row === '1.5').length).fill(3.5 / 16));
    expect([...count(dots.map((n) => n.row))]).toEqual(result.rows.map((r) => [String(r.load_time), Math.max(1, Math.round((r.pageviews as number) / 500))]));
  });
  it('a value above nothing has one glyph at least, a value of nothing has none, and a row with no value has no mark', () => {
    const spec = by('visitors', 'device', [{ mark: 'unit', encode: { x: 'device', y: 'visitors' } }]);
    const { ratio } = run(spec, 346, null, 'typical', 'svg', { result: answer([{ device: 'Desktop', visitors: 4820 }, { device: 'Mobile', visitors: 3 }, { device: 'Tablet', visitors: 0 }, { device: 'Watch', visitors: null }], { visitors: 4823 }) });
    expect([...count((glyphs(ratio.nodes) as CircleNode[]).map((n) => n.row))]).toEqual([['Desktop', 10], ['Mobile', 1]]);
    expect(keyOf(ratio)).toEqual(['Each is 500']);
  });
  it('stands beside other marks of a plot, on one scale, and takes a paint of its own', () => {
    const spec = by('visitors', 'weekday', [{ mark: 'unit', encode: { x: 'weekday', y: 'visitors' }, paint: 'series.3' }, { mark: 'rule', encode: { y: 1500 }, label: 'Target', role: 'reference' }]);
    const { ratio, plan } = run(spec, 346);
    expect(plan.layers.map((l) => [l.mark, l.role])).toEqual([['unit', 'primary'], ['rule', 'reference']]);
    expect(ratio.nodes.find((n) => n.key === 'reference:rule')).toMatchObject({ kind: 'line', t: 0.75 });
    expect((glyphs(ratio.nodes) as CircleNode[]).every((n) => n.paint === 'series.3')).toBe(true);
  });
  it('an unfinished day\'s glyphs are faded, as its bar is', () => {
    const { ratio } = run(by('pageviews', 'date.day', [{ mark: 'unit', encode: { x: 'date.day', y: 'pageviews' } }]), 700), dots = glyphs(ratio.nodes) as CircleNode[];
    expect(new Set(dots.filter((n) => n.row === '2026-10-05').map((n) => n.opacity))).toEqual(new Set([0.4]));
    expect(dots.filter((n) => n.row !== '2026-10-05').every((n) => n.opacity == null)).toBe(true);
  });
});

describe('a run along a row\'s track', () => {
  it('a dot for each so-many, from the start of a track that stands beside the label, with the label and the value as a bar list has them', () => {
    const { ratio, result } = run(isotype!, 346), dots = glyphs(ratio.nodes) as CircleNode[];
    expect(ratio).toMatchObject({ layout: 'rows', track: 'beside', parts: ['rows', 'unit-key'], rows: ['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other'] });
    expect(keyOf(ratio)).toEqual(['Each is 500']);
    expect([...count(dots.map((n) => n.row))]).toEqual(result.rows.map((r) => [r.channel, Math.max(1, Math.round((r.visitors as number) / 500))]));
    expect(dots.filter((n) => n.row === 'Direct').map((n) => n.key)).toEqual([1, 2, 3, 4, 5, 6].map((n) => 'primary:unit:Direct:' + n));
    // The track ends at the longest run, nine glyphs, so each has a ninth of it, and the first stands half of that in.
    expect(dots.filter((n) => n.row === 'Search').map((n) => Math.round(n.x! * 18))).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17]);
    expect(dots.every((n) => n.kind === 'circle' && n.part === 'rows' && n.t === 0.5 && n.h === 1 && Math.abs(n.w! - 1 / 9) < 1e-9 && n.paint === 'series.1')).toBe(true);
    expect(ratio.nodes.filter((n) => n.part === 'rows' && n.kind === 'text' && n.row === 'Search').map((n) => (n as TextNode).text)).toEqual(['Search', '4,318']);
  });
  it('placed, a run is round dots that touch at most, in a row\'s height', () => {
    for (const w of [346, 500, 700]) {
      const dots = glyphs(run(isotype!, w).scene.nodes) as PlacedCircle[], search = dots.filter((n) => n.key.startsWith('primary:unit:Search:'));
      expect(new Set(dots.map((n) => n.r)).size, String(w)).toBe(1);
      expect(2 * search[0]!.r, String(w)).toBeLessThanOrEqual(Math.min(search[1]!.cx - search[0]!.cx, 28 - 8));
      expect(new Set(search.map((n) => n.cy)).size, String(w)).toBe(1);
    }
  });
  it('what a glyph is worth holds when a height limit trims the rows: it is worked out from every row of the result', () => {
    const { plan, ratio } = run(isotype!, 346, 100);
    expect(plan).toMatchObject({ layout: 'rows', rowLimit: 3, dropped: ['rows 4 to 6', 'the key to what a glyph is worth'] });
    expect([...count((glyphs(ratio.nodes) as CircleNode[]).map((n) => n.row))]).toEqual([['Search', 9], ['Direct', 6], ['Social', 3]]);
    // Trimmed to the small rows alone, they would be counted finer were the worth theirs.
    const small = run({ ...isotype!, query: { ...isotype!.query, limit: 2 } }, 346).ratio;
    expect(keyOf(small)).toEqual(['Each is 500']);
  });
  it('a row is painted by its own dimension on color, as a bar in rows is', () => {
    const { ratio } = run(by('visitors', 'device', [{ mark: 'unit', encode: { y: 'device', x: 'visitors', color: 'device' } }, { mark: 'text', encode: { y: 'device', text: 'device' } }]), 346);
    expect([...new Set((glyphs(ratio.nodes) as CircleNode[]).map((n) => n.row + ' ' + n.paint))]).toEqual(['Desktop series.1', 'Mobile series.2', 'Tablet series.3']);
  });
});

describe('a grid of a hundred, divided by share', () => {
  it('a cell for each hundredth, ten rows of ten in reading order, a run of cells and a series colour for each value, and the band\'s legend', () => {
    const { ratio, plan } = run(waffle!, 346), cells = glyphs(ratio.nodes) as RectNode[];
    expect(ratio).toMatchObject({ layout: 'band', aspect: 1, parts: ['band', 'legend'], rows: ['Desktop', 'Mobile', 'Tablet'] });
    expect(plan).toMatchObject({ preset: 'waffle', share: true, tldrValue: false, guides: { legend: 'full' } });
    expect(cells).toHaveLength(100);
    expect([...count(cells.map((n) => n.row + ' ' + n.paint))]).toEqual([['Desktop series.1', 52], ['Mobile series.2', 41], ['Tablet series.3', 7]]);
    expect(cells.map((n) => [Math.round(n.x! * 10), Math.round(n.y! * 10)])).toEqual(Array.from({ length: 100 }, (_, i) => [i % 10, Math.floor(i / 10)]));
    expect(cells.every((n) => n.kind === 'rect' && n.part === 'band' && n.w === 0.1 && n.h === 0.1 && n.role === 'primary')).toBe(true);
    expect([cells[0]!.key, cells[51]!.key, cells[52]!.key, cells[99]!.key]).toEqual(['primary:unit:Desktop:1', 'primary:unit:Desktop:52', 'primary:unit:Mobile:1', 'primary:unit:Tablet:7']);
    // A cell is a hundredth, which wants no key. The legend says each share, as a share bar's does.
    expect(keyOf(ratio)).toEqual([]);
    expect(ratio.nodes.filter((n) => n.part === 'legend' && n.kind === 'text').map((n) => (n as TextNode).text)).toEqual(['Desktop', '52%', 'Mobile', '41%', 'Tablet', '7%']);
  });
  it('shares are of the engine\'s total, never of the rows received: with a limit the cells left over are the rest, painted as no value', () => {
    const top2: Spec = { ...waffle!, query: { metrics: ['visitors'], by: ['channel'], range: '28d', limit: 2 } };
    const { ratio, result } = run(top2, 346), cells = glyphs(ratio.nodes) as RectNode[];
    expect(result.rows.map((r) => r.channel)).toEqual(['Search', 'Direct']);
    expect([...count(cells.map((n) => (n.row ?? 'no row') + ' ' + n.paint))]).toEqual([['Search series.1', 41], ['Direct series.2', 28], ['no row seq.none', 31]]);
    expect(cells.slice(69, 71).map((n) => n.key)).toEqual(['primary:unit#rest:1', 'primary:unit#rest:2']);
    // The same rows against a total twice as large hold half the cells: nothing is worked out from their sum.
    const twice = run(top2, 346, null, 'typical', 'svg', { result: { ...result, totals: { visitors: result.totals.visitors! * 2 } } }).ratio;
    expect([...count((glyphs(twice.nodes) as RectNode[]).map((n) => n.row ?? 'no row'))]).toEqual([['Search', 21], ['Direct', 14], ['no row', 65]]);
  });
  it('with no total, or one of zero, no cell is any value\'s: the legend says each value, and the rows are never summed', () => {
    const { result } = run(waffle!, 346);
    for (const total of [null, 0]) {
      const { ratio } = run(waffle!, 346, null, 'typical', 'svg', { result: { ...result, totals: { visitors: total } } });
      expect([...count((glyphs(ratio.nodes) as RectNode[]).map((n) => n.paint))], String(total)).toEqual([['seq.none', 100]]);
      expect(ratio.nodes.filter((n) => n.part === 'legend' && n.kind === 'text' && n.font === 'value').map((n) => (n as TextNode).text), String(total)).toEqual(result.rows.map((r) => (r.visitors as number).toLocaleString('en-US')));
    }
  });
  it('rows that hold more than the total fill the grid and no more: a hundred cells, whatever is sent', () => {
    const { ratio } = run(waffle!, 346, null, 'typical', 'svg', { result: answer([{ device: 'Desktop', visitors: 80 }, { device: 'Mobile', visitors: 70 }], { visitors: 100 }) });
    expect([...count((glyphs(ratio.nodes) as RectNode[]).map((n) => n.row))]).toEqual([['Desktop', 80], ['Mobile', 20]]);
  });
  it('holds its shape: a square of square cells, in the middle of the width, and smaller in a box that is short', () => {
    for (const [w, h, side] of [[346, null, 160], [700, null, 160], [346, 300, 160], [346, 220, 142], [290, 190, 112]] as [number, number | null, number][]) {
      const { scene, plan } = run(waffle!, w, h), cells = glyphs(scene.nodes) as PlacedRect[];
      expect(plan.layers.some((l) => l.mark === 'unit'), w + ' ' + h).toBe(true);
      expect(scene.plot, w + ' ' + h).toEqual({ w: side, h: side });
      expect(cells.every((n) => Math.abs(n.w - n.h) < 1e-9 && Math.abs(n.w - (side / 10 - 1)) < 1e-9), w + ' ' + h).toBe(true);
      expect([cells[0]!.x, cells[0]!.y, cells[99]!.x + cells[99]!.w + 1], w + ' ' + h).toEqual([(w - side) / 2, 0, (w + side) / 2]);
    }
  });
  it('writing stack: "normalize" on it changes nothing: a grid divided by color is shares already', () => {
    const written = by('visitors', 'device', [{ mark: 'unit', encode: { x: 'visitors', color: 'device' }, stack: 'normalize' }]);
    expect(run(written, 346).ratio).toEqual(run({ ...waffle!, title: undefined, use: undefined, layers: expand(waffle!).layers } as Spec, 346).ratio);
  });
});

describe('a grid with no dimension, read against the metric\'s range', () => {
  it('a hundred cells keyed by their place, lit up to the value\'s place in its catalog domain, and the rest the same paint as a tint', () => {
    const { ratio, plan, result } = run(icons!, 346), cells = glyphs(ratio.nodes) as RectNode[];
    expect(ratio).toMatchObject({ layout: 'band', aspect: 1, parts: ['number', 'band', 'unit-key'] });
    expect(ratio.rows).toBeUndefined();
    // 303 of a range of 0 to 500 is 61 cells of 5.
    expect(result.totals.signups).toBe(303);
    expect(cells.map((n) => n.key)).toEqual(Array.from({ length: 100 }, (_, i) => 'primary:unit:' + (i + 1)));
    expect(cells.filter((n) => n.tone == null)).toHaveLength(61);
    expect(cells.slice(61).every((n) => n.tone === 'soft' && n.opacity === 0.14)).toBe(true);
    expect(cells.every((n) => n.paint === 'series.1' && n.row == null)).toBe(true);
    expect(keyOf(ratio)).toEqual(['Each is 5']);
    // What it shows is how far along its range the metric is, so the number stands above it.
    expect(plan).toMatchObject({ preset: 'icon-array', tldrValue: true, share: false, guides: { unitKey: true } });
  });
  it('a cell that stays lit keeps its key when the value moves, and the grid is full at the top of the range and empty at the foot of it', () => {
    const lit = (signups: number | null) => (glyphs(run(icons!, 346, null, 'typical', 'svg', { result: answer([], { signups }) }).ratio.nodes) as RectNode[]).filter((n) => n.tone == null).map((n) => n.key);
    expect(lit(100)).toEqual(lit(303).slice(0, 20));
    expect([lit(0), lit(null), lit(-20)].map((k) => k.length)).toEqual([0, 0, 0]);
    expect([lit(1), lit(2), lit(8), lit(500), lit(9000)].map((k) => k.length)).toEqual([1, 1, 2, 100, 100]);
  });
  it('a metric with no domain has no range to read it against, and the error names both fixes', () => {
    expect(err({ query: { metrics: ['visitors'], range: '28d' }, use: 'icon-array' }))
      .toBe('A "unit" with no dimension reads "visitors" against a range, and the catalog gives that metric no "domain". Add "domain": [least, most] to it in the catalog, or encode a dimension on color to divide the grid by it.');
  });
});

describe('seats round a half circle', () => {
  it('a seat for each so-many of the engine\'s total, a wedge and a series colour for each value, in the half circle\'s own box', () => {
    const { ratio, plan, result } = run(parliament!, 346), seats = glyphs(ratio.nodes) as CircleNode[];
    expect(ratio).toMatchObject({ layout: 'radial', aspect: 2, parts: ['radial', 'unit-key', 'legend'], rows: ['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other'] });
    expect(plan).toMatchObject({ preset: 'parliament', share: true, guides: { legend: 'full', unitKey: true } });
    // 10,531 visitors is more than a hundred seats of one: at 200 each it is 53.
    expect([result.totals.visitors, unitWorth(result.totals.visitors!, 100, true), keyOf(ratio)]).toEqual([10531, 200, ['Each is 200']]);
    expect([...count(seats.map((n) => n.row + ' ' + n.paint))]).toEqual(result.rows.map((r, i) => [r.channel + ' series.' + (i + 1), Math.round((r.visitors as number) / 200)]));
    expect(seats.slice(0, 2).map((n) => n.key)).toEqual(['primary:unit:Search:1', 'primary:unit:Search:2']);
    expect(seats.every((n) => n.kind === 'circle' && n.part === 'radial' && n.role === 'primary' && n.h === 2 * n.w!)).toBe(true);
    // From the left end to the right, so each value's seats are a wedge: no seat of a later value stands to the left of an earlier one's first.
    const first = result.rows.map((r) => Math.min(...seats.filter((n) => n.row === r.channel).map((n) => Math.atan2(n.t!, 0.5 - n.x!))));
    expect(first).toEqual([...first].sort((a, b) => a - b));
    expect(ratio.nodes.filter((n) => n.part === 'legend' && n.kind === 'text' && n.font === 'label').map((n) => (n as TextNode).text)).toEqual(['Search', 'Direct', 'Social', 'AI assistants', 'Email', 'Other']);
  });
  it('a seat is one of the metric while the total is a hundred or fewer, and then there is no key', () => {
    const house = by('signups', 'device', [{ mark: 'unit', encode: { angle: 'signups', color: 'device' }, sweep: 'half' }]);
    const { ratio } = run(house, 346, null, 'typical', 'svg', { result: answer([{ device: 'Desktop', signups: 48 }, { device: 'Mobile', signups: 37 }, { device: 'Tablet', signups: 15 }], { signups: 100 }) });
    expect([...count((glyphs(ratio.nodes) as CircleNode[]).map((n) => n.row))]).toEqual([['Desktop', 48], ['Mobile', 37], ['Tablet', 15]]);
    expect(keyOf(ratio)).toEqual([]);
    expect(ratio.parts).toEqual(['radial', 'legend']);
    // One more, and a seat is two.
    const more = run(house, 346, null, 'typical', 'svg', { result: answer([{ device: 'Desktop', signups: 49 }, { device: 'Mobile', signups: 37 }, { device: 'Tablet', signups: 15 }], { signups: 101 }) }).ratio;
    expect([keyOf(more), [...count((glyphs(more.nodes) as CircleNode[]).map((n) => n.row))]]).toEqual([['Each is 2'], [['Desktop', 25], ['Mobile', 19], ['Tablet', 8]]]);
  });
  it('with a limit, the seats of the rows past it are there and are no value\'s; with no total a seat\'s worth is the largest row\'s', () => {
    const top2: Spec = { ...parliament!, query: { ...parliament!.query, limit: 2 } };
    const { ratio, result } = run(top2, 346), seats = glyphs(ratio.nodes) as CircleNode[];
    expect([...count(seats.map((n) => (n.row ?? 'no row') + ' ' + n.paint))]).toEqual([['Search series.1', 22], ['Direct series.2', 15], ['no row seq.none', 16]]);
    expect(seats[37]!.key).toBe('primary:unit#rest:1');
    const none = run(top2, 346, null, 'typical', 'svg', { result: { ...result, totals: { visitors: null } } }).ratio;
    expect([keyOf(none), [...count((glyphs(none.nodes) as CircleNode[]).map((n) => n.row))]]).toEqual([['Each is 500'], [['Search', 9], ['Direct', 6]]]);
  });
  it('placed, the seats are round, of one size, inside the half circle, and no two overlap', () => {
    for (const [w, h, across] of [[346, null, 240], [700, null, 240], [300, null, 240], [346, 220, 240], [346, 160, 240]] as [number, number | null, number][]) {
      const { scene, plan } = run(parliament!, w, h), seats = glyphs(scene.nodes) as PlacedCircle[], r = seats[0]!.r;
      expect(plan.layers.some((l) => l.mark === 'unit'), w + ' ' + h).toBe(true);
      expect(scene.plot, w + ' ' + h).toEqual({ w: across, h: across / 2 });
      expect(seats.every((n) => n.r === r && n.cx - r >= (w - across) / 2 - 0.5 && n.cx + r <= (w + across) / 2 + 0.5 && n.cy - r >= -0.5 && n.cy + r <= across / 2 + 1), w + ' ' + h).toBe(true);
      for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) expect(Math.hypot(seats[i]!.cx - seats[j]!.cx, seats[i]!.cy - seats[j]!.cy), w + ' ' + h + ': ' + i + ' and ' + j).toBeGreaterThan(2 * r * 0.95);
    }
  });
  it('an arc may stand behind the seats, as a range stands behind a gauge', () => {
    const spec = by('visitors', 'device', [{ mark: 'arc', encode: { radius: 0.3 }, sweep: 'half', role: 'context' }, { mark: 'unit', encode: { angle: 'visitors', color: 'device' }, sweep: 'half' }]);
    const { ratio } = run(spec, 346);
    expect(ratio.nodes.filter((n) => n.part === 'radial').map((n) => n.kind).filter((k, i, a) => k !== a[i - 1])).toEqual(['arc', 'circle']);
  });
});

describe('the key to what a glyph is worth', () => {
  it('is a guide in a part of its own, in the metric\'s own format, and there is none where a glyph is worth one', () => {
    const key = run(units!, 346).ratio.nodes.find((n) => n.part === 'unit-key');
    expect(key).toEqual({ key: 'unit-key:primary:unit', part: 'unit-key', kind: 'text', text: 'Each is 200', anchor: 'start', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    const money = run(by('revenue', 'device', [{ mark: 'unit', encode: { x: 'device', y: 'revenue' } }]), 346).ratio;
    expect(keyOf(money)).toEqual(['Each is $5,000']);
    const few = run(by('visitors', 'device', [{ mark: 'unit', encode: { x: 'device', y: 'visitors' } }]), 346, null, 'typical', 'svg', { result: answer([{ device: 'Desktop', visitors: 9 }, { device: 'Mobile', visitors: 4 }], { visitors: 13 }) });
    expect([keyOf(few.ratio), few.ratio.parts, few.plan.guides.unitKey, few.plan.dropped]).toEqual([[], ['y-axis', 'plot', 'x-axis'], true, []]);
  });
  it('is placed in a line under the glyphs, and the view is that much taller for it', () => {
    const { scene } = run(units!, 346), key = scene.nodes.find((n) => n.key === 'unit-key:primary:unit');
    expect(key).toMatchObject({ kind: 'text', text: 'Each is 200', x: 0, y: 12, ty: 184 });
    expect(scene.height).toBe(184 + 20);
    for (const name of ['isotype', 'parliament', 'icons']) { const { scene } = run(specs[name]!, 346); expect(scene.nodes.some((n) => n.key === 'unit-key:primary:unit'), name).toBe(true); }
  });
  it('goes with the guides, before the glyphs do: by its own rule in a box that is short, and first of what a reduction drops', () => {
    expect(FIT_RULES.filter((r) => r.id === 'unit-key').map((r) => [r.layout, r.needs, r.hide, r.keep])).toEqual([
      ['cartesian', { block: 160 }, ['unit-key'], 'guides'], ['rows', { block: 120 }, ['unit-key'], 'guides'], ['band', { block: 220 }, ['unit-key'], 'guides'], ['radial', { block: 200 }, ['unit-key'], 'guides']]);
    expect(run(units!, 346, 160).plan).toMatchObject({ guides: { unitKey: true }, dropped: [] });
    expect(run(units!, 346, 159).plan).toMatchObject({ layout: 'cartesian', guides: { x: true }, dropped: ['the key to what a glyph is worth'] });
    expect(run(units!, 346, 159).ratio.parts).toEqual(['y-axis', 'plot', 'x-axis']);
    // A spec that keeps its guides keeps it.
    expect(run({ ...units!, keep: ['guides'] }, 346, 159).ratio.parts).toContain('unit-key');
    // Rows as tall as their rule asks, and not as tall as six of them and the line: the line goes, and then rows are trimmed.
    expect(run(isotype!, 346, 190).plan).toMatchObject({ rowLimit: null, guides: { unitKey: false }, dropped: ['the key to what a glyph is worth'] });
  });
});

describe('refusals, each naming its fix', () => {
  const visitors = (layers: Layer[]) => by('visitors', 'device', layers), split = (layers: Layer[]): Spec => ({ query: { metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' }, layers });
  const net = answer([{ device: 'Desktop', net_subscribers: 12 }, { device: 'Mobile', net_subscribers: -3 }], { net_subscribers: 9 });
  it('a second end: a count of glyphs runs from nothing', () => {
    expect(err(visitors([{ mark: 'unit', encode: { y: 'device', x: 'visitors', x2: 'visitors' } }]))).toBe('Layer 1 is a "unit" with "x2", and only a bar, a rule or an area runs from one value to another. Use one of those, or remove "x2".');
    expect(err(visitors([{ mark: 'unit', encode: { x: 'device', y: 'visitors', y2: 'visitors' } }]))).toBe('Layer 1 is a "unit" with "y2", and only a bar, a rule or an area runs from one value to another. Use one of those, or remove "y2".');
  });
  it('a stack, but "normalize" on the grid, which is shares already', () => {
    expect(err(split([{ mark: 'unit', encode: { x: 'date.day', y: 'visitors', color: 'device' }, stack: 'zero' }]))).toBe('Layer 1 is a "unit" with stack: "zero", and a unit\'s glyphs are counted from nothing, each group on its own. Remove "stack", or use "bar" to stack a second dimension.');
    for (const stack of ['zero', 'center'] as const) expect(err(visitors([{ mark: 'unit', encode: { x: 'visitors', color: 'device' }, stack }])))
      .toBe('Layer 1 is a "unit" with stack: "' + stack + '", and a unit\'s glyphs are counted from nothing, each group on its own. A grid divided by color is shares of the whole already: remove "stack", or write "normalize".');
    expect(err(visitors([{ mark: 'unit', encode: { x: 'visitors', color: 'device' }, stack: 'normalize' }]))).toBe('no error');
    expect(err(visitors([{ mark: 'unit', encode: { angle: 'visitors', color: 'device' }, sweep: 'half', stack: 'normalize' }]))).toMatch(/^Layer 1 is a "unit" with stack: "normalize", .* Remove "stack"/);
  });
  it('a second dimension on an axis, by color or by detail: glyphs of several series would lie over each other', () => {
    for (const ch of ['color', 'detail'] as const) expect(err(split([{ mark: 'unit', encode: { x: 'date.day', y: 'visitors', [ch]: 'device' } }])))
      .toBe('Layer 1 is a "unit" split by "device", and a unit on an axis counts one value for each row: glyphs of several series would lie over each other. Use "bar" with "stack" for a second dimension, or remove it from the layer and from query.by.');
  });
  it('the period before', () => {
    expect(err({ query: { metrics: ['visitors'], by: ['device'], range: '28d', compare: 'previous' }, layers: [{ mark: 'unit', encode: { x: 'device', y: 'visitors' }, series: 'previous' }] }))
      .toBe('Layer 1 is a "unit" with series: "previous", and a unit draws this period\'s value alone: glyphs of two periods would lie over each other. Remove "series", or use "bar" or "line" for the comparison.');
  });
  it('a value below zero, in every form: a count of glyphs cannot be fewer than none, and the fix is a bar', () => {
    const says = (key: string) => 'The value of "net_subscribers" for "' + key + '" is -3, and a "unit" draws a value as a count of glyphs, which cannot be fewer than none. Use "bar" for a metric that falls below zero: its bar hangs from the zero line.';
    expect(err(by('net_subscribers', 'date.day', [{ mark: 'unit', encode: { x: 'date.day', y: 'net_subscribers' } }]))).toBe(says('2026-09-08'));
    expect(err(by('net_subscribers', 'device', [{ mark: 'unit', encode: { x: 'device', y: 'net_subscribers' } }]), net)).toBe(says('Mobile'));
    expect(err(by('net_subscribers', 'device', [{ mark: 'unit', encode: { y: 'device', x: 'net_subscribers' } }]), net)).toBe(says('Mobile'));
    expect(err(by('net_subscribers', 'device', [{ mark: 'unit', encode: { x: 'net_subscribers', color: 'device' } }]), net)).toBe(says('Mobile'));
    expect(err(by('net_subscribers', 'device', [{ mark: 'unit', encode: { angle: 'net_subscribers', color: 'device' }, sweep: 'half' }]), net)).toBe(says('Mobile'));
  });
  it('seats with no sweep, with no dimension, or of more values than there are colours', () => {
    expect(err(visitors([{ mark: 'unit', encode: { angle: 'visitors', color: 'device' } }]))).toBe('Layer 1 is a "unit" with a metric on angle and no "sweep", and its seats sit round a half circle. Add "sweep": "half" to the layer.');
    expect(err({ query: { metrics: ['signups'], range: '28d' }, layers: [{ mark: 'unit', encode: { angle: 'signups' }, sweep: 'half' }] }))
      .toBe('Layer 1 is a "unit" about a centre, which is seats round a half circle, and has "signups" on angle and nothing on color. Put a metric on angle and a dimension on color. For a grid read against the metric\'s range, put the metric on x and nothing on angle.');
    expect(err(by('visitors', 'weekday', [{ mark: 'unit', encode: { angle: 'visitors', color: 'weekday' }, sweep: 'half' }]))).toBe('Splitting by "weekday" makes 7 groups of seats, and there are 6 series colours. Add "limit": 6 to the query, or less.');
  });
  it('no metric to count from, or a metric where a dimension has to stand', () => {
    expect(err(visitors([{ mark: 'unit', encode: { x: 'device' } }]))).toBe('A "unit" in a plot needs a metric on y to count its glyphs from, and this one has nothing there. Encode { "x": <the dimension>, "y": <a metric> }.');
    expect(err(visitors([{ mark: 'unit', encode: { x: 'device', y: 5 } }]))).toBe('A "unit" in a plot needs a metric on y to count its glyphs from, and this one has 5 there. Encode { "x": <the dimension>, "y": <a metric> }.');
    expect(err(visitors([{ mark: 'unit', encode: { y: 'device' } }, { mark: 'text', encode: { y: 'device', text: 'device' } }]))).toBe('A "unit" in rows needs a metric on x to count its glyphs from, and this one has nothing there. Encode { "y": "device", "x": <a metric> }.');
    expect(err({ query: { metrics: ['visitors', 'page_conversion'], by: ['page'], range: '28d' }, layers: [{ mark: 'unit', encode: { x: 'visitors', y: 'page_conversion' } }] }))
      .toBe('Layer 1 is a unit with the metric "visitors" on x, and a unit needs a dimension there to stand on. Use "dot" for a point at two metrics, or put a dimension on x.');
    expect(err({ query: { metrics: ['pageviews'], by: ['page'], range: '28d', compare: 'previous' }, layers: [{ mark: 'unit', encode: { x: 'pageviews@rank', color: 'page' } }] }))
      .toBe('A "unit" with no dimension on x or y is a grid of a hundred, and needs a metric on x to share it out by. This one has "pageviews@rank" there. Encode { "x": <a metric>, "color": <a dimension> }.');
  });
  it('a number dimension that came with no bins, and a grid with no dimension in a query that has one', () => {
    expect(err(by('pageviews', 'load_time', [{ mark: 'unit', encode: { x: 'load_time', y: 'pageviews' } }]), answer([{ load_time: 0, pageviews: 5 }, { load_time: 1, pageviews: 9 }], { pageviews: 14 })))
      .toBe('The glyphs of a unit on the number dimension "load_time" need its bins, and this result has no "load_time@end". Return where each bin ends from the query layer, or use line or dot.');
    expect(err(by('signups', 'device', [{ mark: 'unit', encode: { x: 'signups' } }])))
      .toBe('Layer 1 is a "unit" with no dimension, which reads "signups" over the whole range, and the query is by "device". Encode "device" on color to divide the grid by it, or remove it from query.by.');
  });
  it('the schema takes the mark and each of its forms, and resolve() is where a form is refused', () => {
    for (const name of NAMES) expect(view({ ...specs[name]!, use: undefined, layers: expand(specs[name]!).layers }), name + ' ' + JSON.stringify(view.errors)).toBe(true);
    expect(view(visitors([{ mark: 'unit', encode: { x: 'visitors', color: 'device' }, sweep: 'quarter' as 'half' }]))).toBe(false);
    // A preset that takes no dimension is not the schema's to know: it is resolve()'s.
    expect(view(icons)).toBe(true);
    expect(err({ ...icons!, use: 'waffle' })).toBe('The "waffle" preset needs a dimension in query.by.');
  });
});

describe('fallbacks: under the room its glyphs need, a form becomes the preset of the same query that needs less', () => {
  it('each form has a rule that names the mark and the preset, by the room a plot with axes needs across', () => {
    expect(FIT_RULES.filter((r) => r.fallback).map((r) => [r.layout, r.id, r.mark, r.fallback, r.needs, r.keep])).toEqual([
      ['cartesian', 'unit', 'unit', 'bar', { inline: 280, block: 120 }, 'marks'], ['rows', 'unit', 'unit', 'bar-list', { inline: 280 }, 'marks'],
      ['band', 'unit', 'unit', 'share-bar', { inline: 280, block: 180 }, 'marks'], ['band', 'unit-alone', 'unit', 'gauge', { inline: 280, block: 180 }, 'marks'],
      ['radial', 'unit', 'unit', 'pie-semi-circle', { inline: 280, block: 160 }, 'marks']]);
  });
  for (const name of NAMES) it(name + ': at 279 px it is that preset\'s scene to the node, and from there steps down by that preset\'s own rules', () => {
    const spec = specs[name]!, [layout, fallback] = FORMS[name]!, other: Spec = { ...spec, layers: undefined, use: fallback };
    expect(run(spec, 280).plan.layers.some((l) => l.mark === 'unit')).toBe(true);
    expect(run(spec, 280).plan.dropped).toEqual([]);
    // Rows have no height of their own to be short of: a list is trimmed, in glyphs as in bars.
    for (const [w, h] of ([[279, null], [250, null], [170, null], [120, null], [80, null], [346, 110], [346, 60]] as [number, number | null][]).filter(([, h]) => h == null || layout !== 'rows')) {
      const here = run(spec, w, h), there = run(other, w, h);
      expect(here.scene, w + ' ' + h).toEqual(there.scene);
      expect(here.plan.dropped, w + ' ' + h).toEqual(['the ' + layout + ' marks (drawn as "' + fallback + '")', ...there.plan.dropped]);
      expect(here.plan.preset, w + ' ' + h).toBe(fallback);
    }
  });
  it('a grid with no dimension passes over the share bar, which has nothing to divide by, for the gauge', () => {
    expect(run(icons!, 250).plan).toMatchObject({ layout: 'radial', preset: 'gauge' });
    expect(run(waffle!, 250).plan).toMatchObject({ layout: 'band', preset: 'share-bar' });
  });
  it('a spec that keeps its marks keeps its glyphs, and an empty range has nothing to give way from', () => {
    for (const name of NAMES) {
      expect(run({ ...specs[name]!, keep: ['marks'] }, 250).plan.layers.some((l) => l.mark === 'unit'), name).toBe(true);
      expect(run(specs[name]!, 250, null, 'empty').plan.dropped, name).toEqual([]);
    }
  });
  it('no other view of those layouts is asked: a share bar, a bar list, a half pie and bars are what they were', () => {
    for (const name of ['mix', 'pages']) expect(run({ spec: 'view/0', query: { metrics: ['visitors'], by: ['channel'], range: '28d' }, use: name === 'mix' ? 'share-bar' : 'bar-list' }, 250).plan.dropped, name).toEqual([]);
    expect(run(moreSamples.half!.spec, 250).plan).toMatchObject({ preset: 'pie-semi-circle', dropped: [] });
    expect(run(moreSamples.histogram!.spec, 250).plan.dropped).toEqual(['axes and grid (added the number to make up for them)']);
  });
});

describe('the prose is the query\'s, and names no glyph', () => {
  it('each form says what its fallback says: a bar, a ranked list, a share bar, a half pie, a gauge', () => {
    for (const name of NAMES) {
      const spec = specs[name]!, text = run(spec, 700).plan.text;
      expect(text, name).toBe(run({ ...spec, layers: undefined, use: FORMS[name]![1] }, 700).plan.text);
      expect(text, name).not.toMatch(/glyph|dot|cell|seat|square|icon|unit|grid|each is/i);
    }
  });
  it('and it is true', () => {
    expect(run(waffle!, 346).plan.text).toBe('Desktop is the largest device at 52% of visitors, followed by Mobile at 41%.');
    expect(run(units!, 346).plan.text).toBe('Top weekdays by visitors, last 28 days: Tue (1,760), Wed (1,729), Mon (1,666).');
    expect(run(wilkinson!, 346).plan.text).toBe('Page views: 25.1k in the last 28 days. The most, 4,758, at a load time of 1.5 to 2.');
    expect(run(isotype!, 346).plan.text).toBe('Top channels by visitors, last 28 days: Search (4,318), Direct (2,949), Social (1,474).');
    expect(run(parliament!, 346).plan.text).toBe('Search is the largest channel at 41% of visitors, followed by Direct at 28%.');
    expect(run(icons!, 346).plan.text).toBe('Sign-ups: 303 in the last 28 days, 76% of its target of 400.');
    // The sentence is the same at every size, the last rung among them.
    for (const name of NAMES) expect(run(specs[name]!, 10).ratio.text, name).toBe(run(specs[name]!, 700).plan.text);
  });
});
