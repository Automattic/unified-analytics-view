import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { customMarks, expand, formats, type Spec } from '@unified-analytics/core';
import sceneSchema from '@unified-analytics/core/schema/scene.schema.json';
import { catalog, moreSamples, samples, scenarios } from '@unified-analytics/fixtures';       // registers the custom marks
import { heights, run, widths } from './helpers.ts';

/* A custom mark is a candidate for the system, and not a way round it (docs/focus-plan.md, step 9; reference, section
 * 7). So it is held to what a core mark is held to, from the day it is registered, and this is where: one suite, run
 * for every mark there is. One that is registered and does not pass is not admitted, whoever wrote it.
 *
 * What is not here, because nothing in this run can see it: that its scales go through `common`, which is read in its
 * code and held for the ones that have a facet (test/facet.test.ts); and that it paints, which the bench's capture
 * and check hold frame by frame. That no key of its leaves before its marks is held in test/guides.test.ts. */
const valid = new Ajv({ allowUnionTypes: true }).compile(sceneSchema);
/** The samples that draw a mark: the bench keeps one of each form, and a mark with none is not seen by anyone. */
const drawing = (name: string): [string, Spec][] => Object.entries({ ...samples, ...moreSamples }).flatMap(([k, s]): [string, Spec][] => ((expand(s.spec).layers ?? []).some((l) => l.mark === name) ? [[k, s.spec]] : []));

describe.each([...customMarks().keys()])('the custom mark "%s" is held to what a core mark is', (name) => {
  const mark = customMarks().get(name)!, mine = drawing(name);
  it('says the channels it reads, and the fields: what a layer writes that it does not read is then refused', () => {
    expect(mark.reads, 'reads').toBeDefined();
    expect(Array.isArray(mark.fields), 'fields, which may be none: []').toBe(true);
  });
  it('is drawn by a sample', () => expect(mine.length, 'a sample in packages/fixtures whose layers hold the mark').toBeGreaterThan(0));
  it('builds a scene that is valid against scene/0 in every data state: paint tokens, unique keys, no field of its own', () => {
    for (const [k, spec] of mine) for (const sc of scenarios) {
      const { ratio } = run(spec, 700, null, sc), keys = ratio.nodes.map((n) => n.key);
      expect(valid(ratio), k + ' ' + sc + ': ' + JSON.stringify((valid.errors ?? []).slice(0, 2))).toBe(true);
      expect(new Set(keys).size, k + ' ' + sc + ': duplicate keys').toBe(keys.length);
      expect(JSON.stringify(ratio, (_, v) => (typeof v === 'number' && isNaN(v) ? 'NaN' : v)), k + ' ' + sc).not.toMatch(/NaN/);
    }
  });
  it('shows something at every room, and only parts its scene has', () => {
    for (const [k, spec] of mine) for (const sc of scenarios) for (const h of heights) for (const w of widths) {
      const { ratio, fit } = run(spec, w, h, sc), at = [k, sc, w, h].join(' ');
      expect(fit.parts.length, at + ': shows nothing').toBeGreaterThan(0);
      expect(fit.parts.filter((p) => !ratio.nodes.some((n) => n.part === p)), at).toEqual([]);
    }
  });
  it('gives way: in the least room it is its number, or the view it gave way to is', () => {
    for (const [k, spec] of mine) expect(run(spec, 54, 40).fit.parts, k).toEqual(['number']);
    // And it has a rule under which it gives way to something drawn with less room, or one that takes its marks.
    expect(mark.rules.some((r) => r.fallback || (r.show ?? []).includes('number')), 'a fit rule with a fallback, or one that leaves the number').toBe(true);
  });
  it('offers places that are in its box, where it offers any', () => {
    if (!mark.places) return;
    for (const [k, spec] of mine) {
      const { plan, ratio, result } = run(spec, 700), place = mark.places({ layers: plan.layers, guides: {}, query: expand(spec).query, result, catalog, formats: formats() });
      for (const row of ratio.rows ?? []) { const at = place(row); if (at) expect([at.x >= 0 && at.x <= 1, at.y >= 0 && at.y <= 1], k + ' ' + row).toEqual([true, true]); }
    }
  });
});
