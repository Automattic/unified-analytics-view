import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRESETS, customPresets } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { catalog, runQuery } from '@unified-analytics/fixtures';       // which registers the `geo`, `link` and `partition` marks, and with each the presets that draw it
import { check } from '../packages/agent/src/index.ts';

/* An agent writes specs from the reference and the schema alone, so a preset neither names is one it cannot find,
 * and one they name that is not registered is one it will be refused. That holds for one a custom mark's package
 * registers as it does for the library's. */
it('every preset is named in the reference and in the schema, and they name no other', () => {
  const reference = readFileSync(new URL('../docs/view-grammar-reference.md', import.meta.url), 'utf8'), use = viewSchema.properties.use.description;
  const presets = [...Object.keys(PRESETS), ...customPresets().keys()];
  for (const name of presets) {
    expect(reference, 'docs/view-grammar-reference.md, section 9, has no row for "' + name + '"').toContain('| `' + name + '` |');
    expect(use.split(/[ ,.:]+/), 'view.schema.json: the description of "use" does not list "' + name + '"').toContain(name);
  }
  const section = reference.slice(reference.indexOf('\n## 9.'), reference.indexOf('\n## 10.'));
  const rows = [...section.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]!);
  expect(rows.sort(), 'docs/view-grammar-reference.md, section 9: one row for each preset registered, and no other').toEqual(presets.sort());
  const ships = /The library ships: ([^.]+)\./.exec(use)![1]!.split(', ');
  expect(ships, 'view.schema.json: the library the description of "use" lists is not PRESETS').toEqual(Object.keys(PRESETS));
});

// So is a spec the reference writes out: an example that is refused teaches an author a spec that does not draw.
it('every whole spec the reference writes is one the fixtures draw', () => {
  const reference = readFileSync(new URL('../docs/view-grammar-reference.md', import.meta.url), 'utf8'), drawn: string[] = [];
  for (const [, block] of reference.matchAll(/```json\n([\s\S]*?)```/g)) for (const text of [block!, ...block!.split(/\n(?=\{ ")/)]) {
    let spec; try { spec = JSON.parse(text); } catch { continue; }                 // a fragment, or several specs in one block
    if (!spec?.query?.metrics || spec.spec === 'board/0') continue;                // a catalog, a result, a query alone, a board
    const said = check({ spec, result: runQuery(spec.query), catalog });
    expect(said.ok ? '' : said.error, text).toBe('');
    drawn.push(text);
  }
  expect(new Set(drawn).size).toBeGreaterThan(8);
});

