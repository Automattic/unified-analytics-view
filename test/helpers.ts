import Ajv from 'ajv';
import { CONTAINER_RULES, buildScene, makeContainer, place, resolve, unboundedContainer, type Catalog, type ContainerRules, type PainterName, type PathNode, type RectNode, type Result, type Spec } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, runQuery, samples, scenarios } from '@unified-analytics/fixtures';

/* What the suites share. Not a test file: vitest takes only *.test.ts. */

// The sweep's cases, shared by core.test.ts (held to the prototype) and fit.test.ts (the fit rules held to resolve()).
export const ALWAYS = { ...CONTAINER_RULES, tldrValue: { above: 'always' as const } };
export const trend = samples.trend!.spec;
export const specs: Record<string, Spec> = {
  ...Object.fromEntries(Object.entries(samples).map(([k, s]) => [k, s.spec])),
  headed: trend,                         // swept in the ALWAYS context
  kept: { ...trend, keep: ['guides'] },
};
export const painters: PainterName[] = ['svg', 'dots'];
export const heights = [null, 300, 160, 100, 60, 40];
export const widths = [54, 80, 120, 170, 250, 290, 346, 500, 700];

/** One view planned, scened and placed in a container `w` by `h`, on the fixture engine's answer unless `result` is given.
 *  The cell is 8 px, which only the dots painter reads. */
export const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', result: Result = runQuery(spec.query, scenario), cat: Catalog = catalog, rules: ContainerRules = CONTAINER_RULES) => {
  const container = { ...makeContainer(w, h, painter, 8), rules };
  const plan = resolve(spec, result, container, cat);
  const ratio = buildScene(plan, spec.query, result, cat);
  return { plan, ratio, scene: place(ratio, container), result };
};

/** The message `f` throws, or undefined. */
export const errOf = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
/** The message resolve() refuses `s` with, at 346 wide, or undefined. */
export const err = (s: Spec, result: Result = runQuery(s.query), cat: Catalog = catalog) => errOf(() => resolve(s, result, makeContainer(346), cat));

/** The view schema, compiled. */
export const validView = new Ajv({ allowUnionTypes: true }).compile(viewSchema);

/** The plan and ratio scene of `spec` with no limits, as `<ua-view>` makes them. */
export const ofUnbounded = (spec: Spec, result: Result = runQuery(spec.query), query = spec.query, cat: Catalog = catalog) => {
  const plan = resolve(spec, result, unboundedContainer(), cat);
  return { plan, scene: buildScene(plan, query, result, cat) };
};

// Scene helpers.
export const round = (n: number) => Math.round(n * 1000) / 1000;
export const at = <T = any>(nodes: { key: string }[], key: string) => nodes.find((n) => n.key === key) as unknown as T;
export const startingWith = <T = any>(nodes: { key: string }[], start: string) => nodes.filter((n) => n.key.startsWith(start)) as unknown as T[];
export const rects = (ratio: { nodes: unknown[] }) => (ratio.nodes as RectNode[]).filter((n) => n.part === 'plot' && n.kind === 'rect');
export const shapes = (ratio: { nodes: unknown[] }) => (ratio.nodes as PathNode[]).filter((n) => n.part === 'plot' && n.kind === 'path');
