import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildScene, makeContainer, place, resolve, rowKeys, unboundedContainer, type Catalog, type Spec } from '@unified-analytics/core';
import { catalog, runQuery, samples, type Scenario } from '@unified-analytics/fixtures';
import { TIP_CSS, centred } from '../packages/dom/src/chrome/tip.ts';
import { Keys, crossMarks, hitNodes, readout, rowsAt, step, written } from '../packages/dom/src/keys.ts';

// Which point a key moves to, what the readout says and where a plot's hit targets lie are plain functions, held
// here with no DOM. Focus, hover and the event are checked in a browser on the bench. What the mouse leaving does
// is held here too, against stand-ins for the few elements it touches.

const of = (sample: string, scenario: Scenario = 'typical') => {
  const spec = samples[sample]!.spec, result = runQuery(spec.query, scenario), q = spec.query;
  const plan = resolve(spec, result, unboundedContainer(), catalog), scene = buildScene(plan, spec.query, result, catalog);
  return { result, scene, says: result.rows.map((r) => readout(r, q, catalog, plan.layers)) };
};

describe('written', () => {
  const cat = { metrics: { views: { label: 'Page views', unit: 'count' as const, polarity: 'up' as const }, time: { label: 'Engaged time', unit: 'ms' as const, polarity: 'up' as const } }, dimensions: { path: { label: 'Page', type: 'categorical' as const } } };
  const row = { path: '/a', views: 1113, time: 25100, 'views@previous': 999 };
  it('is a row whose words already say every value its readout would', () => {
    expect(written('/a1,11325.1s', row, { metrics: ['views', 'time'], by: ['path'] }, cat, [])).toBe(true);
    expect(written('/a1,113', row, { metrics: ['views', 'time'], by: ['path'] }, cat, [])).toBe(false);
  });
  it('is not one that leaves the period before unsaid', () => {
    expect(written('/a1,113', row, { metrics: ['views'], by: ['path'], compare: 'previous' }, cat, [])).toBe(false);
    expect(written('/a1,113999', row, { metrics: ['views'], by: ['path'], compare: 'previous' }, cat, [])).toBe(true);
  });
});

describe('step', () => {
  it('moves left and right and stops at the ends, as version 4 does', () => {
    expect(step('ArrowRight', -1, 5)).toBe(0);
    expect(step('ArrowLeft', -1, 5)).toBe(0);
    expect(step('ArrowRight', 2, 5)).toBe(3);
    expect(step('ArrowRight', 4, 5)).toBe(4);
    expect(step('ArrowLeft', 0, 5)).toBe(0);
  });
  it('takes up and down only where the points run down the page', () => {
    expect(step('ArrowDown', 1, 5)).toBeNull();
    expect(step('ArrowDown', 1, 5, true)).toBe(2);
    expect(step('ArrowUp', 1, 5, true)).toBe(0);
  });
  it('goes on with left where the points run from the right, and back with right', () => {
    expect(step('ArrowLeft', 2, 5, false, true)).toBe(3);
    expect(step('ArrowRight', 2, 5, false, true)).toBe(1);
    expect(step('ArrowRight', 0, 5, false, true)).toBe(0);
    expect(step('ArrowDown', 1, 5, true, true)).toBe(2);
  });
  it('leaves every other key, and a view with no points, alone', () => {
    for (const k of ['Tab', 'Home', 'End', 'a']) expect(step(k, 1, 5, true)).toBeNull();
    expect(step('ArrowRight', -1, 0)).toBeNull();
  });
});

describe('readout', () => {
  it('says the dimension value, the metric, and the comparison when the row has one', () => {
    const { says } = of('trend');
    expect(says[0]).toBe('Sep 8: Visitors 416, previous period 370');
    expect(says).toHaveLength(28);
  });
  it('marks the unfinished day, in core\'s words', () => {
    const { result, says } = of('trend');
    expect(result.rows[27]!.partial).toBe(true);
    expect(says[27]).toBe('Oct 5: Visitors 175 so far, previous period 405');
    expect(says.filter((s) => s.includes('so far'))).toHaveLength(1);
  });
  it('leaves the comparison out when there is no prior period', () => {
    const { says } = of('trend', 'no-prior');
    for (const s of says) expect(s).toMatch(/^[A-Z][a-z]{2} \d+: Visitors [\d,]+( so far)?$/);
  });
  it('reads a ranked list and a share the same way', () => {
    expect(of('pages').says[0]).toMatch(/^\/.*: Page views [\d,]+$/);
    expect(of('mix').says[0]).toMatch(/^\w+: Visitors [\d,]+$/);
  });
});

// A line is read against the axes, so at a point of one the readout is a crosshair, and these are what it says on them.
describe('crossMarks', () => {
  const marks = (sample: string, scenario: Scenario = 'typical') => {
    const spec = samples[sample]!.spec, result = runQuery(spec.query, scenario), plan = resolve(spec, result, unboundedContainer(), catalog);
    const scene = buildScene(plan, spec.query, result, catalog), { rows, split } = rowsAt(scene, spec.query, result);
    return { scene, result, at: crossMarks(scene, plan.layers, rows, catalog, split) };
  };
  it('says a line\'s value at each of its rows, where the scene set it, and the comparison\'s after it', () => {
    const { scene, result, at } = marks('trend'), line = scene.nodes.find((n) => n.kind === 'path' && n.key === 'primary:line');
    expect([...at.keys()]).toEqual(scene.rows);
    const first = at.get(scene.rows![0]!)!, row = result.rows[0]!, own = first.find((m) => m.role === 'primary')!;
    expect(first.map((m) => m.role).sort()).toEqual(['comparison', 'primary']);
    expect(own.text).toBe(String(row.visitors));
    expect(own.t).toBe(line!.kind === 'path' ? line!.points[0]!.v : NaN);
    expect(first.find((m) => m.role === 'comparison')!.text).toBe(String(row['visitors@previous']));
    expect(first.every((m) => m.side === 0)).toBe(true);
  });
  it('says the unfinished day once, in core\'s words, though two paths meet the day before it', () => {
    const { scene, at } = marks('trend'), last = at.get(scene.rows!.at(-1)!)!, before = at.get(scene.rows!.at(-2)!)!;
    expect(last.find((m) => m.role === 'primary')!.text).toMatch(/ so far$/);
    expect(before.filter((m) => m.role === 'primary')).toHaveLength(1);
  });
  it('has no comparison where there is no prior period, and nothing for a view that is not a plot of lines', () => {
    expect(marks('trend', 'no-prior').at.get(marks('trend', 'no-prior').scene.rows![0]!)!.map((m) => m.role)).toEqual(['primary']);
    for (const sample of ['pages', 'mix']) expect(marks(sample).at.size).toBe(0);
  });
});

describe('hitNodes', () => {
  it.each(['trend', 'layers'])('gives %s one target per row, tiling the plot, each holding its own x', (sample) => {
    const { scene } = of(sample), hits = hitNodes(scene);
    expect(hits.map((h) => h.row)).toEqual(scene.rows);
    expect(new Set(hits.map((h) => h.key)).size).toBe(hits.length);
    expect(hits[0]!.x).toBe(0);
    hits.forEach((h, i) => {
      expect(h.x! + h.w!).toBeCloseTo(hits[i + 1]?.x ?? 1, 9);
      expect(h.c).toBeGreaterThanOrEqual(0); expect(h.c).toBeLessThanOrEqual(1);
    });
  });
  it('puts a line\'s first and last points at the edges of their targets', () => {
    const hits = hitNodes(of('trend').scene);
    expect(hits[0]!.c).toBe(0);
    expect(hits[hits.length - 1]!.c).toBe(1);
  });
});

describe('row keys', () => {
  // A result may hold numbers where a dimension's values go. A painter writes them into data-row, and the keyboard
  // and hover find a row by that attribute, so the scene's keys are strings whatever the result held.
  it('are strings for a dimension whose values are numbers, in every layout', () => {
    const hours: Catalog = { metrics: { hits: { label: 'Hits', unit: 'count', polarity: 'none' } }, dimensions: { hour: { label: 'Hour', type: 'categorical' } } };
    const result = { rows: [{ hour: 9, hits: 12 }, { hour: 10, hits: 30 }, { hour: 11, hits: 7 }], totals: { hits: 49 }, meta: { range: '28d', compare: null, notes: [] } };
    const query = { metrics: ['hits'], by: ['hour'] }, bars: Spec = { query, layers: [{ mark: 'bar', encode: { x: 'hour', y: 'hits' } }] };
    for (const spec of [bars, { query, use: 'bar-list' }, { query, use: 'share-bar' }] as Spec[]) {
      const scene = buildScene(resolve(spec, result, unboundedContainer(), hours), spec.query, result, hours);
      expect(scene.rows, scene.layout).toEqual(['9', '10', '11']);
      expect(scene.nodes.filter((n) => n.row != null).every((n) => typeof n.row === 'string'), scene.layout).toBe(true);
    }
    expect(hitNodes(buildScene(resolve(bars, result, unboundedContainer(), hours), query, result, hours)).map((h) => h.row)).toEqual(['9', '10', '11']);
  });
});

// A host that hands over labels where it had ids sends two rows of one value. Each is still a row: it has a key, a
// mark, a place and a point of its own, and what is written on it is the value, not the key.
describe('two rows of one value', () => {
  const sources: Catalog = { metrics: { v: { label: 'Visitors', unit: 'count', polarity: 'up' } }, dimensions: { src: { label: 'Source', type: 'categorical' }, dev: { label: 'Device', type: 'categorical' } } };
  const meta = { range: '28d', compare: null, notes: [] }, query = { metrics: ['v'], by: ['src'] };
  const result = { rows: [{ src: 'Google', v: 50 }, { src: 'Google', v: 30 }, { src: 'Bing', v: 20 }, { src: 'Duck', v: 10 }], totals: { v: 110 }, meta };
  const specs: Record<string, Spec> = {
    bars: { query, layers: [{ mark: 'bar', encode: { x: 'src', y: 'v' } }] }, line: { query, layers: [{ mark: 'line', encode: { x: 'src', y: 'v' } }] },
    list: { query, use: 'bar-list' }, band: { query, use: 'share-bar' }, donut: { query, use: 'donut' },
  };
  const sceneOf = (spec: Spec, res: typeof result) => { const plan = resolve(spec, res, unboundedContainer(), sources); return { plan, scene: buildScene(plan, spec.query, res, sources) }; };

  it('counts the second (`Google#2`), and leaves a value said once as it is', () => {
    expect([...rowKeys(result.rows, 'src').values()]).toEqual(['Google', 'Google#2', 'Bing', 'Duck']);
    // A value that is already another's key does not take it.
    expect([...rowKeys([{ s: 'a' }, { s: 'a' }, { s: 'a#2' }, { s: 'a' }], 's').values()]).toEqual(['a', 'a#2', 'a#2#2', 'a#3']);
  });
  it.each(Object.keys(specs))('gives each row of %s a key, a point and a readout of its own', (name) => {
    const spec = specs[name]!, { plan, scene } = sceneOf(spec, result), keys = scene.nodes.map((n) => n.key);
    expect(scene.rows).toEqual(['Google', 'Google#2', 'Bing', 'Duck']);
    expect(new Set(keys).size, 'duplicate keys').toBe(keys.length);
    const placed = place(scene, makeContainer(400)).nodes.map((n) => n.key);
    expect(new Set(placed).size, 'duplicate keys, placed').toBe(placed.length);
    // The point of each row holds that row and no other, so its name, its readout and the event it sends are its own.
    const at = rowsAt(scene, spec.query, result);
    expect(at.rows).toEqual(result.rows.map((r) => [r]));
    expect(at.rows.map((rs) => readout(rs[0]!, spec.query, sources, plan.layers))).toEqual(['Google: Visitors 50', 'Google: Visitors 30', 'Bing: Visitors 20', 'Duck: Visitors 10']);
    // A row with no value says so in words, as a grid's empty cell does.
    expect(readout({ ...result.rows[0]!, v: null }, spec.query, sources, plan.layers)).toBe('Google: No data');
    // Each has its own mark, and nothing written says the key.
    for (const row of scene.rows!) expect(scene.nodes.some((n) => n.row === row && n.kind !== 'text' && n.layer === 'data') || scene.nodes.some((n) => n.kind === 'path' && n.points.some((p) => p.row === row)), row).toBe(true);
    expect(scene.nodes.filter((n) => n.kind === 'text' && n.text.includes('#'))).toEqual([]);
    if (scene.layout === 'cartesian') expect(hitNodes(scene).map((h) => h.row)).toEqual(scene.rows);
  });
  it('tells the rows of a split plot apart by their series, and repeats only a pair said twice', () => {
    const q = { metrics: ['v'], by: ['src', 'dev'] }, spec: Spec = { query: q, use: 'stacked-bar' };
    const rows = [['A', 'Desktop', 5], ['A', 'Desktop', 7], ['A', 'Mobile', 3], ['B', 'Desktop', 8], ['B', 'Mobile', 2]].map(([src, dev, v]) => ({ src, dev, v })) as typeof result.rows;
    const res = { rows, totals: { v: 25 }, totalsBy: { src: [{ src: 'A', v: 15 }, { src: 'B', v: 10 }], dev: [{ dev: 'Desktop', v: 20 }, { dev: 'Mobile', v: 5 }] }, meta };
    const { scene } = sceneOf(spec, res), keys = scene.nodes.map((n) => n.key);
    expect(scene.rows).toEqual(['A', 'A#2', 'B']);
    expect(new Set(keys).size, 'duplicate keys').toBe(keys.length);
    expect(rowsAt(scene, q, res).rows).toEqual([[rows[0], rows[2]], [rows[1]], [rows[3], rows[4]]]);
    expect(scene.nodes.filter((n) => n.part === 'x-axis' && n.kind === 'text').map((n) => n.kind === 'text' && n.text)).toEqual(['A', 'A', 'B']);
  });
  it('changes nothing where no value is said twice', () => {
    for (const { spec } of Object.values(samples)) {
      const res = runQuery(spec.query), scene = buildScene(resolve(spec, res, unboundedContainer(), catalog), spec.query, res, catalog);
      expect(scene.nodes.filter((n) => /#\d+$/.test(n.row ?? ''))).toEqual([]);
    }
  });
});

describe('the mouse leaving', () => {
  // Just enough of an element for Keys: attributes, a box, and a parent.
  const el = (extra: object = {}) => {
    const attrs = new Map<string, string>();
    return Object.assign(new EventTarget(), {
      getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k),
      hasAttribute: (k: string) => attrs.has(k), toggleAttribute: (k: string, on: boolean) => void (on ? attrs.set(k, '') : attrs.delete(k)),
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }), getClientRects: () => [1],
      style: { setProperty() {}, getPropertyValue: () => '' }, offsetWidth: 10, offsetHeight: 10, hidden: false, textContent: '',
    }, extra);
  };
  // The way the holder of the points reads, which is what its stylesheet set: a plot's from the left, whatever the page.
  let direction = 'ltr';
  afterEach(() => { direction = 'ltr'; vi.unstubAllGlobals(); });
  const view = (focused: boolean, hovered = false) => {
    vi.stubGlobal('getComputedStyle', () => ({ direction }));
    const tip = el({ classList: { contains: () => true, add: () => {} } }), fig = el({ querySelector: () => tip, children: [tip] }), host = el();
    // The body stands in for the holder of the points as well, so an event sent to it is one on the holder.
    const points: ReturnType<typeof el>[] = [], body = el({ dataset: { hits: 'x' }, children: points, matches: (sel: string) => (sel === ':hover' ? hovered : focused), querySelector: () => body, querySelectorAll: () => points, closest: () => points[1] });
    for (const row of ['a', 'b', 'c']) { const p = el({ parentElement: body }); p.setAttribute('data-row', row); points.push(p); }
    const keys = new Keys(host as unknown as HTMLElement, fig as unknown as HTMLElement, body as unknown as HTMLElement);
    const paint = () => keys.paint({ rows: ['a', 'b', 'c'] } as never, { metrics: [], by: [] } as never, { rows: [{}, {}, {}] } as never, { metrics: {}, dimensions: {} } as never, []);
    paint();
    let activated = 0; host.addEventListener('ua-activate', () => activated++);
    const send = (type: string, init: object) => body.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), init));
    return { tip, send, paint, keys, body, points, activated: () => activated, chosen: () => points.filter((p) => p.hasAttribute('data-active')).map((p) => p.getAttribute('data-row')) };
  };

  it.each([false, true])('clears the chosen point and the readout, as version 4 does (view focused: %s)', (focused) => {
    const v = view(focused);
    v.send('pointerover', { pointerType: 'mouse' });
    expect(v.chosen()).toEqual(['b']); expect(v.tip.hidden).toBe(false);
    v.send('pointerleave', { pointerType: 'mouse' });
    expect(v.chosen()).toEqual([]); expect(v.tip.hidden).toBe(true);
    // The next arrow starts from the first point, as from nothing.
    v.send('keydown', { key: 'ArrowRight' });
    expect(v.chosen()).toEqual(['a']);
  });
  it('keeps a point the mouse still holds through a paint, and the click that follows activates it', () => {
    // New data under a resting mouse sends no pointerover: the element under it was kept.
    const v = view(false, true);
    v.send('pointerover', { pointerType: 'mouse' }); v.paint();
    expect(v.chosen()).toEqual(['b']); expect(v.tip.hidden).toBe(false);
    v.send('click', {});
    expect(v.activated()).toBe(1);
    // With the mouse gone and no focus, a paint lets the point go, as before.
    const gone = view(false, false);
    gone.send('pointerover', { pointerType: 'mouse' }); gone.paint();
    expect(gone.chosen()).toEqual([]);
  });
  it('steps the way the arrow points where the holder reads from the right, as a band does on such a page', () => {
    const v = view(true);
    direction = 'rtl';
    v.send('keydown', { key: 'ArrowLeft' }); v.send('keydown', { key: 'ArrowLeft' });
    expect(v.chosen()).toEqual(['b']);
    v.send('keydown', { key: 'ArrowRight' });
    expect(v.chosen()).toEqual(['a']);
    direction = 'ltr';
    v.send('keydown', { key: 'ArrowRight' });
    expect(v.chosen()).toEqual(['b']);
  });
  it('leaves a point chosen by touch alone', () => {
    const v = view(false);
    v.send('pointerover', { pointerType: 'touch' }); v.send('pointerleave', { pointerType: 'touch' });
    expect(v.chosen()).toEqual(['b']);
  });
  it('lets a hovering pen go as a mouse, and keeps a pressed one for its click, as a touch', () => {
    const hover = view(false);
    hover.send('pointerover', { pointerType: 'pen', buttons: 0 }); hover.send('pointerleave', { pointerType: 'pen' });
    expect(hover.chosen()).toEqual([]);
    const press = view(false);
    press.send('pointerover', { pointerType: 'pen', buttons: 1 }); press.send('pointerleave', { pointerType: 'pen' });
    expect(press.chosen()).toEqual(['b']);
    press.send('click', {});
    expect(press.activated()).toBe(0);                                    // the first press only chose it
  });
  it('makes options of the points on show alone, and no tab stop of a list with none', () => {
    const v = view(false), past = { left: 0, top: 120, right: 100, bottom: 140, width: 100, height: 20 };
    v.points[2]!.getBoundingClientRect = () => past;                   // cut off by a height limit
    v.keys.name();
    expect(v.points.map((p) => p.getAttribute('role'))).toEqual(['option', 'option', 'presentation']);
    expect(v.points[2]!.getAttribute('id')).toBe(null);
    expect(v.body.getAttribute('tabindex')).toBe('0');
    for (const p of v.points) p.getBoundingClientRect = () => past;
    v.keys.name();
    expect(v.body.getAttribute('tabindex')).toBe(null);
  });
});

describe('the tooltip chip', () => {
  it('is centred on its point, inside its room, and at its start where it is wider', () => {
    expect(centred(50, 20, 0, 100)).toBe(40);
    expect(centred(5, 20, 0, 100)).toBe(0);
    expect(centred(95, 20, 0, 100)).toBe(80);
    expect(centred(50, 200, -10, 100)).toBe(-10);
  });
  it('is set closer and kept to one line on an axis, and on the secondary surface in that tone', () => {
    expect(TIP_CSS).toContain('.uav-tip[data-anchor="axis"] { padding: 1px 5px; white-space: nowrap; }');
    expect(TIP_CSS).toContain('.uav-tip[data-tone="secondary"] { background: var(--ua-charts-color-tooltip-surface-secondary');
  });
});
