import Ajv from 'ajv';
import { expect, it } from 'vitest';
import { boardViews, buildScene, facets, resolve, type Result, type Spec } from '@unified-analytics/core';
import sceneSchema from '@unified-analytics/core/schema/scene.schema.json';
import { boardSamples, catalog, facetSamples, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';   // registers the custom marks

/* The scene has a schema, `scene/0`, a draft (docs/focus-plan.md, step 5). It is true only if every scene that is
 * built is valid against it: every sample's, in every data state, a custom mark's among them, each view of a facet
 * and of a board. A field a builder adds without the schema fails here. */
const valid = new Ajv({ allowUnionTypes: true }).compile(sceneSchema);
const check = (at: string, spec: Spec, result: Result) => {
  const scene = buildScene(resolve(spec, result, catalog), spec.query, result, catalog);
  expect(valid(scene), at + ': ' + JSON.stringify((valid.errors ?? []).slice(0, 3))).toBe(true);
  return scene.nodes.length;
};

it('every scene a sample builds is valid against scene/0, in every data state', () => {
  let scenes = 0, nodes = 0;
  const one = (at: string, spec: Spec, result: Result) => { scenes++; nodes += check(at, spec, result); };
  for (const [name, { spec }] of Object.entries({ ...samples, ...moreSamples })) for (const sc of scenarios) one(name + ' ' + sc, spec, runQuery(spec.query, sc));
  for (const [name, { spec }] of Object.entries(facetSamples)) for (const sc of scenarios) for (const v of facets(spec, runQuery(spec.query, sc), catalog)) one(name + ' ' + sc + ' ' + v.key, v.spec, v.result);
  for (const [name, { board }] of Object.entries(boardSamples)) for (const v of boardViews(board, catalog)) one(name + ' ' + v.key, v.spec, runQuery(v.spec.query));
  expect([scenes > 250, nodes > 9000]).toEqual([true, true]);
});

it('a scene with a colour for a paint, or a node of no kind, is not valid', () => {
  const spec = samples.trend!.spec, result = runQuery(spec.query), scene = buildScene(resolve(spec, result, catalog), spec.query, result, catalog);
  expect(valid({ ...scene, nodes: [{ ...scene.nodes[0]!, paint: '#ff0000' }] })).toBe(false);
  expect(valid({ ...scene, nodes: [{ key: 'k', part: 'plot', paint: 'ink', layer: 'data', kind: 'blob' }] })).toBe(false);
  expect(valid({ ...scene, nodes: [{ ...scene.nodes[0]!, left: 12 }] })).toBe(false);
});
