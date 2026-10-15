import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRESETS, customPresets } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import '@unified-analytics/fixtures';       // registers the `geo`, `link` and `partition` marks, and with each the presets that draw it

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
