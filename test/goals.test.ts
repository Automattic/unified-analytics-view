import { describe, expect, it } from 'vitest';
import { buildScene, resolve, unboundedContainer } from '@unified-analytics/core';
import { scenarios } from '@unified-analytics/fixtures';   // registers the geo mark, as the page's import does
import { SITES, catalog, runQuery } from '../apps/bench/src/goals-data.ts';
import { GOALS, METRICS } from '../apps/bench/src/goals-views.ts';

/* The goals page is specs and an engine, so it is swept with no DOM: every view of every goal's dashboard is planned
 * and built into a scene, in each data state and range. A spec the grammar refuses fails here with the error it gives. */
describe('the goals page', () => {
  it('has a site and views for every goal', () => {
    for (const g of GOALS) {
      expect(SITES[g.id], g.id).toBeDefined();
      for (const m of [...g.headline, ...g.also]) expect(METRICS[m], g.id + ': ' + m).toBeDefined();
    }
  });
  for (const g of GOALS) it(g.id + ': every view plans and builds', () => {
    for (const name of [...g.headline, ...g.also]) for (const { spec } of METRICS[name]!.cards) for (const scenario of scenarios) for (const range of ['28d', '7d']) {
      const query = spec.query.range ? { ...spec.query, range } : spec.query, at = [g.id, name, spec.title, scenario, range].join(' / ');
      try {
        const result = runQuery(query, scenario, SITES[g.id]), plan = resolve({ ...spec, query }, result, unboundedContainer(), catalog);
        expect(buildScene(plan, query, result, catalog).nodes.length, at).toBeGreaterThan(0);
      } catch (e) { throw new Error(at + ': ' + (e as Error).message); }
    }
  });
  it('divides a count among a dimension\'s values and loses none of it', () => {
    const r = runQuery({ metrics: ['visitors'], by: ['channel'], range: '28d' }, 'typical', SITES.sell);
    expect(r.rows.reduce((s, row) => s + (row.visitors as number), 0)).toBe(r.totals.visitors);
    const two = runQuery({ metrics: ['visitors'], by: ['date.day', 'device'], range: '28d' }, 'typical', SITES.sell);
    expect(two.rows.reduce((s, row) => s + (row.visitors as number), 0)).toBe(two.totals.visitors);
  });
});
