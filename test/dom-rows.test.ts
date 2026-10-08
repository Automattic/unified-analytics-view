import { describe, expect, it } from 'vitest';
import { FIT_RULES } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { rows } from '../packages/dom/src/layouts/rows.ts';

// String work only: there is no DOM here. What the browser makes of the rows is checked on the bench.
describe('the rows layout', () => {
  it('gives up its body with its marks, so the number stands alone', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'marks'), { rows: rows.fit! });
    const fig = '.vg[data-layout="rows"]:not([data-keep~="marks"])';
    expect(css.split('\n')).toEqual([
      '/* rows marks */', '@container view (inline-size < 90px) {',
      '  ' + fig + ' .vg-rows { display: none; }', '  ' + fig + ' .vg-number { display: block; }',
      '  ' + fig + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig + ' .vg-body { display: none; }', '  ' + fig + ' .vg-number { margin: 0; }',
      '}',
    ]);
  });

  it('gives up its headers in a short box, unless the spec keeps its guides', () => {
    expect(compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'columns'), { rows: rows.fit! }))
      .toBe('/* rows columns */\n@container view (block-size < 80px) {\n  .vg[data-layout="rows"]:not([data-keep~="guides"]) .vg-columns { display: none; }\n}');
  });

  it('sets no column\'s width: the headers and the rows are subgrids, and a ranked column goes by a need written on its cell', () => {
    expect(rows.css).toContain('grid-template-columns: subgrid');
    expect(rows.css).toContain('> [data-rank] { max-inline-size: max(0px, (100cqi - var(--vg-need) + 0.01px) * 999999);');
    expect(rows.css).not.toMatch(/\bch\b/);
  });

  it('takes its row height and gap from the rule set, never from its stylesheet', () => {
    expect(rows.css).toContain('block-size: var(--vg-row-block)');
    expect(rows.css).toContain('gap: var(--vg-row-gap)');
    expect(rows.css).not.toMatch(/\b(28|4)px/);
  });
});
