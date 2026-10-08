import { describe, expect, it } from 'vitest';
import { buildScene, resolve, unboundedContainer, type Catalog, type Spec } from '@universal-analytics/core';
import { catalog, runQuery, samples, type Scenario } from '@universal-analytics/fixtures';
import { Keys, hitNodes, readout, step } from '../packages/dom/src/keys.ts';

// Which point a key moves to, what the readout says and where a plot's hit targets lie are plain functions, held
// here with no DOM. Focus, hover and the event are checked in a browser on the bench. What the mouse leaving does
// is held here too, against stand-ins for the few elements it touches.

const of = (sample: string, scenario: Scenario = 'typical') => {
  const spec = samples[sample]!.spec, result = runQuery(spec.query, scenario), q = spec.query;
  const plan = resolve(spec, result, unboundedContainer(), catalog), scene = buildScene(plan, spec.query, result, catalog);
  return { result, scene, says: result.rows.map((r) => readout(r, q, catalog, plan.layers)) };
};

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
  const view = (focused: boolean, hovered = false) => {
    const tip = el(), fig = el({ querySelector: () => tip }), host = el();
    // The body stands in for the holder of the points as well, so an event sent to it is one on the holder.
    const points: ReturnType<typeof el>[] = [], body = el({ dataset: { hits: 'x' }, children: points, matches: (sel: string) => (sel === ':hover' ? hovered : focused), querySelector: () => body, querySelectorAll: () => points, closest: () => points[1] });
    for (const row of ['a', 'b', 'c']) { const p = el({ parentElement: body }); p.setAttribute('data-row', row); points.push(p); }
    const keys = new Keys(host as unknown as HTMLElement, fig as unknown as HTMLElement, body as unknown as HTMLElement);
    const paint = () => keys.paint({ rows: ['a', 'b', 'c'] } as never, { metrics: [], by: [] } as never, { rows: [{}, {}, {}] } as never, { metrics: {}, dimensions: {} } as never, []);
    paint();
    let activated = 0; host.addEventListener('ua-activate', () => activated++);
    const send = (type: string, init: object) => body.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), init));
    return { tip, send, paint, activated: () => activated, chosen: () => points.filter((p) => p.hasAttribute('data-active')).map((p) => p.getAttribute('data-row')) };
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
  it('leaves a point chosen by touch alone', () => {
    const v = view(false);
    v.send('pointerover', { pointerType: 'touch' }); v.send('pointerleave', { pointerType: 'touch' });
    expect(v.chosen()).toEqual(['b']);
  });
});
