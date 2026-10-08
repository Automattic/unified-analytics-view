import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES, applies, buildScene, makeContainer, place, resolve, unboundedContainer, type FitRule, type PainterName, type Plan, type Spec } from '@universal-analytics/core';
import { catalog, runQuery, samples, scenarios } from '@universal-analytics/fixtures';

// The sweep of core.test.ts, run again to hold the fit rules to what resolve() does.
const ALWAYS = { ...CONTAINER_RULES, tldrValue: { above: 'always' as const } };
const trend = samples.trend!.spec;
const specs: Record<string, Spec> = {
  ...Object.fromEntries(Object.entries(samples).map(([k, s]) => [k, s.spec])),
  headed: trend,                         // swept in the ALWAYS context
  kept: { ...trend, keep: ['guides'] },
};
const painters: PainterName[] = ['svg', 'dots'];
const heights = [300, 160, 100, 60, 40];
const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];
const run = (spec: Spec, w: number, h: number | null = null, sc: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', rules = CONTAINER_RULES) => {
  const container = { ...makeContainer(w, h, painter, 8), rules }, result = runQuery(spec.query, sc);
  const plan = resolve(spec, result, container, catalog);
  return { plan, scene: place(buildScene(plan, spec.query, result, catalog), container) };
};
const rule = (layout: string, id: string) => FIT_RULES.find((r) => r.layout === layout && r.id === id)!;

/** Whether resolve() gave up what the rule hides. `null` where the plan cannot say: the part was already gone with its parent. */
function gaveUp(r: FitRule, plan: Plan, unbounded: Plan): boolean | null {
  const here = plan.layout === r.layout;
  if (r.id === 'axes') return !(here && plan.guides.x);
  // A plot has a legend, and labels at its line ends, only where it is split into series.
  if (r.id === 'legend') return unbounded.guides.legend ? !(here && plan.guides.legend === 'full') : null;
  if (r.id === 'labels') return unbounded.guides.legend ? !(here && !!plan.guides.legend) : null;
  if (r.id === 'mid-tick') return here && plan.guides.x ? plan.dropped.includes('the middle date label') : null;
  if (r.id === 'secondary') return here && unbounded.layers.some((l) => l.role !== 'primary') ? plan.layers.every((l) => l.role === 'primary') : null;
  return !here;
}

/** Every case in the sweep, with each rule of the view's layout. */
interface Case { name: string; spec: Spec; w: number; h: number | null; r: FitRule; says: boolean; did: boolean; wide: boolean }
const cases: Case[] = [];
function sweep(each: (c: Case) => void): void {
  if (cases.length) return cases.forEach(each);
  for (const [name, spec] of Object.entries(specs)) for (const sc of scenarios) for (const p of painters) {
    const rules = name === 'headed' ? ALWAYS : CONTAINER_RULES;
    const unbounded = resolve(spec, runQuery(spec.query, sc), { ...unboundedContainer(p, 8), rules }, catalog);
    const timeAxis = catalog.dimensions[(spec.query.by || [])[0]!]?.type === 'time';
    for (const r of FIT_RULES.filter((r) => r.layout === unbounded.layout && (r.id !== 'mid-tick' || timeAxis))) for (const w of widths) {
      const wide = gaveUp(r, run(spec, w, null, sc, p, rules).plan, unbounded);
      for (const h of [null, ...heights]) {
        const { plan, scene } = run(spec, w, h, sc, p, rules), did = gaveUp(r, plan, unbounded);
        if (did == null || wide == null) continue;
        const kept = !!r.keep && (spec.keep || []).includes(r.keep);
        const says = !kept && applies(r, { view: { inline: w, block: h }, plot: scene.plot && { inline: scene.plot.w, block: scene.plot.h } });
        cases.push({ name, spec, w, h, r, says, did, wide });
      }
    }
  }
  cases.forEach(each);
}

describe('applies', () => {
  const axes = rule('cartesian', 'axes'), secondary = rule('cartesian', 'secondary');
  it('is true when the container is short in either direction', () => {
    expect(applies(axes, { view: { inline: 280, block: 120 } })).toBe(false);
    expect(applies(axes, { view: { inline: 279, block: 120 } })).toBe(true);
    expect(applies(axes, { view: { inline: 280, block: 119 } })).toBe(true);
  });
  it('never matches on a size the container does not have', () => {
    expect(applies(axes, { view: { inline: 280 } })).toBe(false);
    expect(applies(axes, { view: { inline: 280, block: null } })).toBe(false);
    expect(applies(secondary, { view: { inline: 100 } })).toBe(false);
  });
  it('reads the container the rule names', () => {
    expect(applies(secondary, { view: { inline: 700 }, plot: { inline: 179, block: 184 } })).toBe(true);
    expect(applies(secondary, { view: { inline: 100 }, plot: { inline: 180, block: 90 } })).toBe(false);
  });
});

describe('the rule set', () => {
  it('has one rule per id in a layout', () => {
    const ids = FIT_RULES.map((r) => r.layout + '/' + r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('is the container\'s to replace', () => {
    const fit = FIT_RULES.map((r) => (r.layout === 'cartesian' && r.id === 'axes' ? { ...r, needs: { inline: 200 } } : r));
    expect(run(trend, 250).plan.guides.x).toBe(false);
    expect(run(trend, 250, null, 'typical', 'svg', { ...CONTAINER_RULES, fit }).plan.guides.x).toBe(true);
    // A part with no rule needs no room, so it is never given up for width.
    const none = run(trend, 250, null, 'typical', 'svg', { ...CONTAINER_RULES, fit: [] }).plan;
    expect(none).toMatchObject({ layout: 'cartesian', side: false, dropped: [] });
  });
});

describe('the rules are what place() builds to', () => {
  const swap = (id: string, needs: FitRule['needs']) => ({ ...CONTAINER_RULES, fit: FIT_RULES.map((r) => (r.id === id ? { ...r, needs } : r)) });
  it('a context that moves the mid-tick rule moves what is drawn, as well as what is reported', () => {
    const mid = (rules = CONTAINER_RULES) => { const { plan, scene } = run(trend, 346, null, 'typical', 'svg', rules); return [scene.nodes.some((n) => n.key === 'xtick:2026-09-21'), plan.dropped]; };
    expect(mid()).toEqual([false, ['the middle date label']]);
    expect(mid(swap('mid-tick', { inline: 300 }))).toEqual([true, []]);
  });
  it('the notice is as short as its rule allows', () => {
    const at30 = (rules = CONTAINER_RULES) => { const { plan, scene } = run(trend, 346, 30, 'empty', 'svg', rules); return [plan.layout, scene.height]; };
    expect(at30()[0]).toBe('prose');                                   // under 40 px the notice goes, and the number is too tall as well
    expect(at30(swap('notice', { inline: 150, block: 20 }))).toEqual(['notice', 30]);
  });
  it('the number beside a bare plot is as narrow as the context says', () => {
    const plot = (numberWidth: number) => run(trend, 170, null, 'typical', 'svg', { ...CONTAINER_RULES, bare: { ...CONTAINER_RULES.bare, numberWidth } }).scene.plot;
    expect(plot(76)).toEqual({ w: 82, h: 50 });
    expect(plot(100)).toEqual({ w: 58, h: 50 });
  });
});

describe('the rules against resolve(), over the sweep', () => {
  it('a rule never hides what resolve() keeps', () => {
    const wrong: string[] = [];
    sweep(({ name, w, h, r, says, did }) => { if (says && !did) wrong.push([name, r.id, w, h].join(' ')); });
    expect(wrong).toEqual([]);
  });
  it('the secondary and mid-tick rules say exactly what resolve() does', () => {
    const wrong: string[] = [];
    sweep(({ name, w, h, r, says, did }) => { if ((r.id === 'secondary' || r.id === 'mid-tick') && says !== did) wrong.push([name, r.id, w, h].join(' ')); });
    expect(wrong).toEqual([]);
  });

  // The plan asks whether the view's block needs (120 px with axes, 46 px bare) reproduce resolve() under its height limits.
  // The test: a part is given up at a height exactly when it is given up at that width with no limit, or the height is under the need.
  it('the block needs on the view reproduce the height limits, but for the cases listed', () => {
    const differs: Record<string, Set<number>> = {};
    sweep(({ name, w, h, r, did, wide, spec }) => {
      if (h == null || r.container !== 'view' || r.needs.block == null) return;
      const kept = !!r.keep && (spec.keep || []).includes(r.keep);
      if (did !== (wide || (!kept && h < r.needs.block))) (differs[`${name}: ${r.id} at ${h}`] ||= new Set()).add(w);
    });
    // Every width with room for the axes. These are known differences, listed so that a change shows. Do not tune the needs to clear them.
    const roomy = [290, 346, 500, 700];
    expect(Object.fromEntries(Object.entries(differs).map(([k, v]) => [k, [...v]]))).toEqual({
      // The number sits above the plot and takes 92 px of the view (114 in the dot face), so the axes need 212 px, not 120. resolve() drops them; the rule keeps them.
      'headed: axes at 160': roomy,
      // The spec keeps its guides, so resolve() cannot drop the axes under 120 px and gives up the marks instead. The rules, each on its own, keep both.
      'kept: axes at 100': roomy, 'kept: axes at 60': roomy, 'kept: axes at 40': roomy,
      'kept: marks at 100': roomy, 'kept: marks at 60': roomy,
    });
  });
});
