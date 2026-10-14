import { CONTAINER_RULES, buildScene, makeContainer, place, resolve, type PainterName, type Spec } from '@unified-analytics/core';
import { catalog, runQuery, samples, scenarios } from '@unified-analytics/fixtures';

/* The sweep's cases and its one run, shared by core.test.ts (held to the prototype) and fit.test.ts (the fit rules held to resolve()). */
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
export const run = (spec: Spec, w: number, h: number | null = null, scenario: (typeof scenarios)[number] = 'typical', painter: PainterName = 'svg', rules = CONTAINER_RULES) => {
  const container = { ...makeContainer(w, h, painter, 8), rules }, result = runQuery(spec.query, scenario);
  const plan = resolve(spec, result, container, catalog);
  const ratio = buildScene(plan, spec.query, result, catalog);
  return { plan, ratio, scene: place(ratio, container), result };
};
