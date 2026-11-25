import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, EM, FIT_RULES, applies, explain, fitTo, hasOf, needAt, type FitRule } from '@unified-analytics/core';
import { catalog, moreSamples, samples, scenarios } from '@unified-analytics/fixtures';
import { heights, run, shown, specs, trend, widths } from './helpers.ts';

/* How a view gives way when room is short is data, the fit rules, and one function reads them at a room with no
 * browser: fitTo(). A stylesheet compiled from the same rules reads them the same way (test/dom-compile.test.ts), and
 * the bench's check holds real frames to them. What follows holds the reader to the rules, and the rules to what they
 * promise of every sample at every room. */
const rule = (layout: string, id: string) => FIT_RULES.find((r) => r.layout === layout && r.id === id)!;

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

/* A need is in em, the size of the view's type, so it follows that type: a surface says the size of its label face
 * with the room, and the element asks the same in em (test/dom-compile.test.ts). */
describe('a need follows the type', () => {
  const axes = rule('cartesian', 'axes'), secondary = rule('cartesian', 'secondary'), near = (need: FitRule['needs'], px: [number, number]) => { expect(need.inline).toBeCloseTo(px[0], 6); expect(need.block).toBeCloseTo(px[1], 6); };
  it('is in em, and is so many px where a surface says no size: on a page of 16 px type', () => {
    expect([axes.needs, EM]).toEqual([{ inline: 21, block: 9 }, 16 * 5 / 6]);
    near(needAt(axes), [280, 120]);
    expect(applies(axes, { view: { inline: 280, block: 120 }, em: EM })).toBe(false);
  });
  it('grows and shrinks with it, whole, on the view and on its plot alike', () => {
    near(needAt(axes, 20), [420, 180]); near(needAt(secondary, 20), [270, 135]);
    expect(applies(axes, { view: { inline: 400, block: 300 }, em: 20 })).toBe(true);
    expect(applies(axes, { view: { inline: 420, block: 300 }, em: 20 })).toBe(false);
    expect(applies(axes, { view: { inline: 240, block: 110 }, em: 11 })).toBe(false);    // 231 by 99 at 11
    expect(applies(secondary, { view: { inline: 700 }, plot: { inline: 180, block: 90 }, em: 20 })).toBe(true);
  });
  it('is read half a px under, as a compiled query reads it, so a room of exactly the need fits whatever a float makes of it', () => {
    expect([279.4, 279.6, 280].map((inline) => applies(axes, { view: { inline } }))).toEqual([true, false, false]);
  });
  it('is what fitTo reads, and what explain says the room is short of', () => {
    const { ratio: scene, plan, result } = run(trend, 400), marks = plan.layers.map((l) => l.mark);
    expect(fitTo(scene, { view: { inline: 400 } }, FIT_RULES, { marks }).parts).toContain('x-axis');
    expect(fitTo(scene, { view: { inline: 400 }, em: 20 }, FIT_RULES, { marks }).parts).not.toContain('x-axis');
    const because = explain(trend, result, catalog, { inline: 400, em: 20 }).entries.find((b) => b.rule === 'axes')!;
    expect(because.why).toContain('needs 420 px wide');
    expect(because.lever).toBe('give the view 420 px wide');
  });
});

describe('fitTo: a view at a room, read off its rules', () => {
  // A scene of four parts, with the number and a second form of the legend there to be shown, and rules of its own.
  const scene = { layout: 'toy', parts: ['plot', 'axis', 'legend'], nodes: ['number', 'plot', 'axis', 'legend', 'legend-top'].map((part) => ({ part })) };
  const R = (id: string, needs: FitRule['needs'], more: Partial<FitRule> = {}): FitRule => ({ id, layout: 'toy', container: 'view', needs, hide: [], ...more });
  // An em of one px, so that a toy rule's need reads as the px its room is given in.
  const at = (inline: number, rules: FitRule[], view = {}, plot?: { inline: number; block: number } | null) => fitTo(scene, { view: { inline }, ...(plot !== undefined && { plot }), em: 1 }, rules, view);

  it('every rule short of its need holds, each on its own: it hides, shows in its place and sets', () => {
    const rules = [R('axis', { inline: 300 }, { hide: ['axis', 'grid'], set: { arrange: 'side' } }), R('legend', { inline: 200 }, { hide: ['legend'], show: ['legend-top'] })];
    expect(at(300, rules)).toEqual({ parts: ['plot', 'axis', 'legend'], hidden: [], set: {}, held: [] });
    expect(at(299, rules)).toMatchObject({ parts: ['plot', 'legend'], hidden: ['axis', 'grid'], set: { arrange: 'side' } });
    expect(at(199, rules)).toMatchObject({ parts: ['plot', 'legend-top'], hidden: ['axis', 'grid', 'legend'] });
    expect(at(199, rules).held.map((h) => [h.rule.id, h.hid, h.showed])).toEqual([['axis', ['axis'], []], ['legend', ['legend'], ['legend-top']]]);
  });
  it('the number leads where a rule shows it, and a part the scene has nothing for is not shown', () => {
    const rules = [R('marks', { inline: 100 }, { hide: ['plot', 'axis', 'legend'], show: ['number', 'note'] })];
    expect(at(99, rules).parts).toEqual(['number']);
    expect(at(99, [R('side', { inline: 100 }, { show: ['number'] })]).parts).toEqual(['number', 'plot', 'axis', 'legend']);
  });
  it('where two rules say otherwise of one part, the later one wins, as in a stylesheet', () => {
    const swap = R('legend', { inline: 200 }, { hide: ['legend'], show: ['legend-top'] }), take = R('top', { inline: 150 }, { hide: ['legend', 'legend-top'] });
    expect(at(149, [swap, take]).parts).toEqual(['plot', 'axis']);
    expect(at(149, [take, swap]).parts).toEqual(['plot', 'axis', 'legend-top']);
    expect(at(149, [R('a', { inline: 200 }, { set: { key: 'short' } }), R('b', { inline: 150 }, { set: { key: 'gone' } })]).set).toEqual({ key: 'gone' });
  });
  it('a rule for a mark is asked of a view that holds it, and one for a kind of view of that kind', () => {
    const forLine = R('ends', { inline: 300 }, { hide: ['legend'], mark: 'line' }), forTrack = R('track', { inline: 300 }, { hide: ['plot'], has: 'track' }), forLegend = R('key', { inline: 300 }, { hide: ['axis'], has: 'legend' });
    expect([at(200, [forLine], { marks: ['bar'] }).parts, at(200, [forLine], { marks: ['bar', 'line'] }).parts]).toEqual([['plot', 'axis', 'legend'], ['plot', 'axis']]);
    expect(at(200, [forTrack, forLegend]).parts).toEqual(['plot', 'legend']);
    expect(fitTo({ ...scene, track: 'beside' }, { view: { inline: 200 }, em: 1 }, [forTrack]).parts).toEqual(['axis', 'legend']);
    expect([hasOf(scene), hasOf({ ...scene, track: 'beside' })]).toEqual([['plot', 'axis', 'legend'], ['plot', 'axis', 'legend', 'track']]);
  });
  it('a rule on the plot is asked of a plot that was measured, holds where there is none, and is passed over where nobody said', () => {
    const inside = R('inside', { inline: 120 }, { container: 'plot', hide: ['legend'] });
    expect(at(700, [inside]).parts).toContain('legend');
    expect(at(700, [inside], {}, { inline: 119, block: 80 }).parts).not.toContain('legend');
    expect(at(700, [inside], {}, { inline: 120, block: 80 }).parts).toContain('legend');
    expect(at(700, [inside], {}, null).parts).not.toContain('legend');
    // A plot an earlier rule took has nothing left in it.
    expect(at(99, [R('marks', { inline: 100 }, { hide: ['plot'] }), inside]).parts).toEqual(['axis']);
  });
  it('a fallback takes the whole view: the first that the query can fill', () => {
    const list = R('list', { inline: 300 }, { fallback: 'bar-list' }), bar = R('bar', { inline: 300 }, { fallback: 'share-bar' });
    expect(at(299, [list, bar], { fills: () => true })).toMatchObject({ parts: [], fallback: list });
    expect(at(299, [list, bar], { fills: (use: string) => use === 'share-bar' }).fallback).toBe(bar);
    expect(at(300, [list, bar], { fills: () => true }).fallback).toBeUndefined();
  });
});

describe('the rule set', () => {
  it('has one rule per id in a layout', () => {
    const ids = FIT_RULES.map((r) => r.layout + '/' + r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('has one ladder for a legend, in a list, a band and a circle: the least of its marks is what differs', () => {
    const ladder = (layout: string) => ['legend', 'legend-top'].map((id) => { const { layout: _, needs, ...what } = rule(layout, id); return [what, needs.inline]; });
    expect(ladder('band')).toEqual(ladder('rows'));
    expect(ladder('radial')).toEqual(ladder('rows'));
    // The one line goes where the least of the marks has no room over it: two rows, a bar, the least circle.
    expect(['rows', 'band', 'radial'].map((l) => +rule(l, 'legend-top').needs.block!.toFixed(4))).toEqual([6.3, 3.6, 6.6]);
    // A band's bar goes at that same height, so a band is never drawn in one paint.
    expect(rule('band', 'marks').needs.block).toBe(rule('band', 'legend-top').needs.block);
    expect(shown(run(specs.mix!, 346, 40)).parts).toEqual(['number']);
  });
  it('is the container\'s to replace', () => {
    const swap = (id: string, needs: FitRule['needs']) => ({ ...CONTAINER_RULES, fit: FIT_RULES.map((r) => (r.id === id ? { ...r, needs } : r)) });
    const at = (rules = CONTAINER_RULES, w = 250, h: number | null = null, sc: (typeof scenarios)[number] = 'typical') => shown(run(trend, w, h, sc, { rules }));
    expect(at().parts).toEqual(['number', 'plot']);
    expect(at({ ...CONTAINER_RULES, fit: FIT_RULES.map((r) => (r.layout === 'cartesian' && r.id === 'axes' ? { ...r, needs: { inline: 15 } } : r)) }).parts).toEqual(['y-axis', 'plot', 'x-axis']);
    // A part with no rule needs no room, so it is never given up.
    expect(at({ ...CONTAINER_RULES, fit: [] }, 20, 10)).toEqual({ parts: ['y-axis', 'plot', 'x-axis'], set: {}, hidden: [], rules: [] });
    // A context that moves a rule moves what it takes: the middle date, and the room a notice has.
    expect([at(CONTAINER_RULES, 346).hidden, at(swap('mid-tick', { inline: 22.5 }), 346).hidden]).toEqual([['x-tick.mid'], []]);
    expect([at(CONTAINER_RULES, 346, 30, 'empty').parts, at(swap('notice', { inline: 11.25, block: 1.5 }), 346, 30, 'empty').parts]).toEqual([['number'], ['notice']]);
  });
});

describe('what the rules promise, of every sample at every room', () => {
  const all = { ...specs, ...Object.fromEntries(Object.entries(moreSamples).map(([k, s]) => [k, s.spec])) };
  const DATA = ['plot', 'rows', 'band', 'radial', 'notice'];
  /** Every sample, in every data state, at every room of the sweep: what `run` gives there, and the parts its scene shows with all its room. */
  const sweep = (each: (r: ReturnType<typeof run>, at: string, full: string[]) => void) => {
    for (const [name, spec] of Object.entries(all)) for (const sc of scenarios) for (const h of heights) for (const w of widths) { const r = run(spec, w, h, sc); each(r, [name, sc, w, h].join(' '), r.ratio.parts); }
  };
  it('covers the six samples and the rest', () => expect(Object.keys(all).length).toBeGreaterThan(Object.keys(samples).length + 40));

  it('a view always shows something, and only parts its scene has', { timeout: 60000 }, () => {
    const wrong: string[] = [];
    sweep((r, at) => { if (!r.fit.parts.length || r.fit.parts.some((p) => !r.ratio.nodes.some((n) => n.part === p))) wrong.push(at + ': ' + r.fit.parts.join(' ')); });
    expect(wrong).toEqual([]);
  });
  // A reader with no browser has no nesting to go by, so a rule that takes the marks names all that stands with them.
  it('where a rule takes its marks, a view is its number alone', { timeout: 60000 }, () => {
    const wrong: string[] = [];
    sweep((r, at, full) => { const marks = full.find((p) => DATA.includes(p)); if (marks && !r.fit.parts.includes(marks) && r.fit.parts.join() !== 'number') wrong.push(at + ': ' + r.fit.parts.join(' ')); });
    expect(wrong).toEqual([]);
  });
  // The reader's account of test/guides.test.ts: a key leaves no sooner than the marks it keys, at any room, in any sample.
  it('no key goes while its marks stay, unless a shorter form stands in or the marks give up what it was the key to', { timeout: 60000 }, () => {
    const wrong: string[] = [];
    sweep((r, at, full) => {
      const { parts, set, hidden } = r.fit, gone = (key: string) => full.includes(key) && !parts.includes(key), marks = full.find((p) => DATA.includes(p));
      if (!marks || !parts.includes(marks)) return;
      const left = [
        gone('legend') && !parts.includes('labels') && !parts.includes('legend-top') && set.split !== 'plain' && 'legend',
        gone('size') && set.dots !== 'one' && 'size', gone('y-axis-2') && !hidden.includes('axis:2') && 'y-axis-2',
        gone('ramp') && set.split !== 'plain' && 'ramp',                   // a plot's bars and dots are then in one paint, as a legend's series are
        ...['unit-key', 'columns', 'rim'].map((key) => gone(key) && key),
      ].filter(Boolean);
      if (left.length) wrong.push(at + ': ' + left.join(' '));
    });
    expect(wrong).toEqual([]);
  });
});
