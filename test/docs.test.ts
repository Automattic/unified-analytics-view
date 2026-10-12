import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { PRESETS } from '@unified-analytics/core';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';

/* An agent writes specs from the reference and the schema alone, so a preset neither names is one it cannot find. */
it('every preset is named in the reference and in the schema', () => {
  const reference = readFileSync(new URL('../docs/view-grammar-reference.md', import.meta.url), 'utf8'), use = viewSchema.properties.use.description;
  for (const name of Object.keys(PRESETS)) {
    expect(reference, 'docs/view-grammar-reference.md, section 9, has no row for "' + name + '"').toContain('| `' + name + '` |');
    expect(use.split(/[ ,.:]+/), 'view.schema.json: the description of "use" does not list "' + name + '"').toContain(name);
  }
});
