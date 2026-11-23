import Ajv, { type ValidateFunction } from 'ajv';
import { CONTAINER_RULES, buildScene, resolve, viewAt, type Catalog, type ContainerRules, type Fit, type PathNode, type RectNode, type Result, type Room, type Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples, scenarios } from '@unified-analytics/fixtures';

/* What the suites share. Not a test file: vitest takes only *.test.ts. */

// The sweep's cases, shared by core.test.ts and fit.test.ts.
export const ALWAYS = { ...CONTAINER_RULES, tldrValue: { above: 'always' as const } };
export const trend = samples.trend!.spec;
export const specs: Record<string, Spec> = {
  ...Object.fromEntries(Object.entries(samples).map(([k, s]) => [k, s.spec])),
  headed: trend,                         // swept in the ALWAYS context
  kept: { ...trend, keep: ['guides'] },
};
export const heights = [null, 300, 160, 100, 60, 40];
export const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];

/** One view at a room `w` by `h`, with no browser: its plan and scene, which take no size, and what the fit rules make of
 *  them there (`viewAt`). Where a rule's fallback holds, they are those of the view it gives way to, and `gave` says from what.
 *  On the fixture engine's answer unless `result` is given, in the fixtures' catalog and the default rules unless others are.
 *  `plot` is the plot's room, for the rules that ask about it: nothing measures one here. */
export const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical',
  { result = runQuery(spec.query, scenario), catalog: cat = catalog, rules = CONTAINER_RULES, plot }: { result?: Result; catalog?: Catalog; rules?: ContainerRules; plot?: Room | null } = {}) => {
  const at = viewAt(spec, result, cat, { view: { inline: w, block: h }, ...(plot !== undefined && { plot }) }, rules);
  return { plan: at.plan, ratio: at.scene, fit: at.fit, gave: at.gave, result };
};

/** What the fit rules make of a view at a room, in short, from what `run` gives: the parts that show, the switches set,
 *  the ids of the rules that hold (`kept:` before one the spec's `keep` held off), and what else is hidden that is no
 *  part: marks of a role or on an axis, the grid, a part's ranked labels, the middle date. A fit names every rule that
 *  holds, every target it hides and every switch it sets. This leaves out the ones with nothing in this view to act
 *  on: a legend's one line where there is no legend, the ranked names of a rim there is none of. */
export const shown = ({ fit: f, ratio }: { fit: Fit; ratio: { scale?: string | undefined; nodes: unknown[] } }) => {
  const nodes = ratio.nodes as { key: string; part: string; role?: string; axis?: number; rank?: number; row?: string }[], drawn = (part: string) => nodes.some((n) => n.part === part);
  const there = (t: string) => (t.startsWith('role:') ? nodes.some((n) => n.role === t.slice(5)) : t.startsWith('axis:') ? nodes.some((n) => String(n.axis) === t.slice(5))
    : t === 'y-tick.ranked' ? nodes.some((n) => n.part === 'y-axis' && n.rank) : t.endsWith('.ranked') ? nodes.some((n) => n.part === t.slice(0, -7) && n.rank) : t === 'grid' ? nodes.some((n) => n.key.startsWith('grid:'))
    // The middle date of an axis: a ranked tick, though not the label of a column of its own width, which is ranked for the measured pass alone.
    : t === 'x-tick.mid' && nodes.some((n) => n.part === 'x-axis' && n.rank && !(ratio.scale === 'linear' && n.row != null)));
  // What each switch is for. One that is for nothing a view has changes nothing in it.
  const FOR: Record<string, string[]> = { legend: ['legend'], ramp: ['ramp'], 'size-key': ['size'], dots: ['size'], split: ['legend', 'labels', 'legend-top'] };
  const sets = (k: string) => !FOR[k] || FOR[k].some(drawn);
  const acts = (h: Fit['held'][number]) => h.hid.length || h.showed.length || Object.keys(h.rule.set ?? {}).some(sets) || h.rule.fallback || h.rule.hide.some((t) => there(t) || (h.kept && f.parts.includes(t)));
  return { parts: f.parts, set: Object.fromEntries(Object.entries(f.set).filter(([k]) => sets(k))), hidden: f.hidden.filter(there), rules: f.held.filter(acts).map((h) => (h.kept ? 'kept:' : '') + h.rule.id), ...(f.fallback && { fallback: f.fallback.fallback }) };
};

/** The message `f` throws, or undefined. */
export const errOf = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
/** The message resolve() refuses `s` with, or undefined. */
export const err = (s: Spec, result: Result = runQuery(s.query), cat: Catalog = catalog) => errOf(() => resolve(s, result, cat));

/** The view schema, compiled the first time a suite asks, so the suites that never do pay nothing for it. */
let compiled: ValidateFunction | undefined;
export const validView = Object.assign((v: unknown) => { compiled ??= new Ajv({ allowUnionTypes: true }).compile(viewSchema); const ok = compiled(v); validView.errors = compiled.errors; return ok; }, { errors: null as ValidateFunction['errors'] });

/** The plan and scene of `spec`, as `<ua-view>` makes them. */
export const ofUnbounded = (spec: Spec, result: Result = runQuery(spec.query), query = spec.query, cat: Catalog = catalog) => {
  const plan = resolve(spec, result, cat);
  return { plan, scene: buildScene(plan, query, result, cat) };
};

// Scene helpers.
export const round = (n: number) => Math.round(n * 1000) / 1000;
export const at = <T = any>(nodes: { key: string }[], key: string) => nodes.find((n) => n.key === key) as unknown as T;
export const startingWith = <T = any>(nodes: { key: string }[], start: string) => nodes.filter((n) => n.key.startsWith(start)) as unknown as T[];
export const rects = (ratio: { nodes: unknown[] }) => (ratio.nodes as RectNode[]).filter((n) => n.part === 'plot' && n.kind === 'rect');
export const shapes = (ratio: { nodes: unknown[] }) => (ratio.nodes as PathNode[]).filter((n) => n.part === 'plot' && n.kind === 'path');
