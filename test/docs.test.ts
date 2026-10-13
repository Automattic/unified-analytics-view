import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRESETS, customPresets } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import '@unified-analytics/fixtures';       // registers the `geo` and `link` marks, and with each the presets that draw it

/* An agent writes specs from the reference and the schema alone, so a preset neither names is one it cannot find.
 * That holds for one a custom mark's package registers as it does for the library's. */
it('every preset is named in the reference and in the schema', () => {
  const reference = readFileSync(new URL('../docs/view-grammar-reference.md', import.meta.url), 'utf8'), use = viewSchema.properties.use.description;
  expect([...customPresets().keys()]).toEqual(['choropleth', 'symbol-map', 'sankey', 'tile-grid-map', 'hex-tile-map']);
  for (const name of [...Object.keys(PRESETS), ...customPresets().keys()]) {
    expect(reference, 'docs/view-grammar-reference.md, section 9, has no row for "' + name + '"').toContain('| `' + name + '` |');
    expect(use.split(/[ ,.:]+/), 'view.schema.json: the description of "use" does not list "' + name + '"').toContain(name);
  }
});
