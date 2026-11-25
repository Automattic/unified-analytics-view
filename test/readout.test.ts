import { describe, expect, it } from 'vitest';
import { buildScene, expand, explain, facets, resolve, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, samples } from '@unified-analytics/fixtures';
import { companions, crossMarks, readout, rowsAt, saidOf, written } from '../packages/dom/src/keys.ts';
import { err, validView } from './helpers.ts';

// A field that is read out and that no mark draws (reference, Decided 70). A metric is one by being in the query. A
// companion is one by being named in the spec's `readout`. That the element shows them is checked in a browser.
const dumbbell = moreSamples.dumbbell!.spec, ranked: Spec = { ...dumbbell, readout: ['pageviews@rank'] };
const said = (spec: Spec, i = 1) => { const q = expand(spec).query, result = runQuery(q), plan = resolve(spec, result, catalog); return { q, result, plan, row: result.rows[i]!, says: readout(result.rows[i]!, q, catalog, plan.layers, undefined, plan.readout) }; };

describe('a metric that no mark draws', () => {
  const spec: Spec = { ...samples.trend!.spec, query: { ...samples.trend!.spec.query, metrics: ['visitors', 'signups'] } };
  it('is read out as any other is, from the catalog, by being one of the query\'s', () => {
    const { plan, says, row } = said(spec);
    expect(plan.layers.some((l) => Object.values(l.encode ?? {}).includes('signups'))).toBe(false);
    expect(says).toMatch(new RegExp('; Sign-ups ' + row.signups + ', previous period \\d+$'));
    expect(plan.readout).toBeUndefined();
  });
  it('and where the view has a crosshair, which says its lines alone, the readout stands with it', () => {
    const count = (s: Spec) => {
      const q = expand(s).query, result = runQuery(q), plan = resolve(s, result, catalog), scene = buildScene(plan, q, result, catalog), at = rowsAt(scene, q, result);
      return [q.metrics.flatMap((m) => saidOf(m, at.rows[1]![0]!, q, plan.layers, plan.readout)).length, crossMarks(scene, plan.layers, at.rows, catalog).get(scene.rows![1]!)!.length];
    };
    expect(count(samples.trend!.spec)).toEqual([2, 2]);      // each line is said on its axis, and there is no more
    expect(count(spec)).toEqual([4, 2]);                    // the sign-ups, and theirs of the period before
    expect(count(moreSamples.fan!.spec)).toEqual([5, 1]);    // the interval's ends, which an area draws and no axis says, and the two read out
  });
});

describe('a companion the spec reads out', () => {
  it('is on the plan, each once, and a spec that names none has no list', () => {
    expect(said(ranked).plan.readout).toEqual(['pageviews@rank']);
    expect(said({ ...dumbbell, readout: ['pageviews@rank', 'pageviews@rank'] }).plan.readout).toEqual(['pageviews@rank']);
    expect(said(dumbbell).plan.readout).toBeUndefined();
    expect(said({ ...dumbbell, readout: [] }).plan.readout).toBeUndefined();
  });
  it('is said after its metric as one a mark draws is, and the table lists by the same', () => {
    const { says, row, q, plan } = said(ranked);
    expect(said(dumbbell).says).toBe('/pricing: Page views 2,960, previous period 2,310');
    expect(says).toBe('/pricing: Page views 2,960, previous period 2,310, rank 2');
    expect(companions('pageviews', row, plan.layers, plan.readout)).toEqual(['pageviews@rank']);
    expect(companions('pageviews', row, plan.layers)).toEqual([]);
    // A row that writes its value and not its rank has not said everything, so its readout shows.
    const seventh = { page: '/a', pageviews: 300, 'pageviews@previous': 400, 'pageviews@rank': 7 };
    expect(written('/a300400', seventh, q, catalog, plan.layers)).toBe(true);
    expect(written('/a300400', seventh, q, catalog, plan.layers, undefined, plan.readout)).toBe(false);
  });
  it('is in what a view says of why it is as it is', () => {
    const entry = explain(ranked, runQuery(ranked.query), catalog).entries.find((e) => e.from === 'readout');
    expect(entry?.what).toBe('read out: pageviews@rank');
    expect(explain(dumbbell, runQuery(dumbbell.query), catalog).entries.some((e) => e.from === 'readout')).toBe(false);
  });
  it('goes with the spec to each view of a facet', () => {
    const q = moreSamples.slopegraph!.spec.query, spec: Spec = { spec: 'view/0', layers: [{ mark: 'line', encode: { x: 'date.week', y: 'visitors' } }], query: q, facet: 'channel', readout: ['visitors@rank'] };
    const views = facets(spec, runQuery(q), catalog);
    expect(views.length).toBeGreaterThan(1);
    for (const v of views) expect(resolve(v.spec, v.result, catalog).readout).toEqual(['visitors@rank']);
  });
  it('is a list of strings to the schema', () => {
    expect(validView(ranked)).toBe(true);
    expect(validView({ ...dumbbell, readout: 'pageviews@rank' })).toBe(false);
    expect(validView({ ...dumbbell, readout: [{ field: 'pageviews@rank', format: '0.0' }] })).toBe(false);
  });
});

describe('what a spec\'s readout cannot name is refused, with where it is said from', () => {
  const no = (readout: unknown, query = dumbbell.query) => err({ ...dumbbell, query, readout } as Spec);
  it('what is no list', () => expect(no('pageviews@rank')).toBe('The spec\'s "readout" is "pageviews@rank", and it is a list of fields, as ["pageviews@rank"] is. Write the fields in a list, or remove "readout".'));
  it('a metric of the query, which is read out already', () => expect(no(['pageviews'])).toBe('The spec\'s "readout" names "pageviews", which is one of the query\'s metrics, and every one of those is read out already, whether or not a mark draws it. Remove it from "readout".'));
  it('a metric the query does not ask for', () => expect(no(['visitors'])).toBe('The spec\'s "readout" names "visitors", and a read-out field is a companion the result returns with one of the query\'s metrics (pageviews), as "pageviews@rank" is. A metric is read out once the query asks for it: add "visitors" to query.metrics, and remove it from "readout".'));
  it('a companion of one', () => expect(no(['visitors@rank'])).toMatch(/add "visitors" to query\.metrics\.$/));
  it('a dimension, or what came with one', () => { for (const f of ['page', 'page@kind', 'nothing']) expect(no([f])).toMatch(/a read-out field is a companion the result returns with one of the query's metrics \(pageviews\), as "pageviews@rank" is\. Name one of those, or remove it from "readout"\.$/); });
  it('the period before, which the query asks for', () => {
    expect(no(['pageviews@previous'])).toMatch(/which is the period before, and that is read out wherever the query compares\. Remove it from "readout"\.$/);
    const { compare: _compare, ...alone } = dumbbell.query;
    expect(err({ spec: 'view/0', use: 'bar-list', query: alone, readout: ['pageviews@previous'] })).toMatch(/Write "compare": "previous" in the query, and remove it from "readout"\.$/);
  });
  it('a companion the result does not return', () => expect(no(['pageviews@p99'])).toBe('The spec\'s "readout" names "pageviews@p99", which the result does not return. With "pageviews" it returns: pageviews@previous, pageviews@rank.'));
  it('and an empty result, which has no row to look in, refuses none', () => {
    const q = dumbbell.query;
    expect(err({ ...dumbbell, readout: ['pageviews@p99'] }, runQuery(q, 'empty'))).toBeUndefined();
  });
});
