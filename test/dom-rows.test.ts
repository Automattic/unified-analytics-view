import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { rows } from '../packages/dom/src/layouts/rows.ts';

// String work only: there is no DOM here. What the browser makes of the rows is checked on the bench.
describe('the rows layout', () => {
  it('gives up its body with its marks, so the number stands alone', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'marks'), { rows: rows.fit! });
    const fig = '.uav[data-layout="rows"]:not([data-keep~="marks"])';
    expect(css.split('\n')).toEqual([
      '/* rows marks */', '@container uav-view (inline-size < 89.5px) {',
      '  ' + fig + ' .uav-rows { display: none; }', '  ' + fig + ' .uav-number { display: block; }',
      '  ' + fig + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig + ' .uav-body { display: none; }', '  ' + fig + ' .uav-number { align-self: start; margin: 0; }',
      '}',
    ]);
  });

  it('gives up its headers in a short box, unless the spec keeps its guides', () => {
    expect(compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'columns'), { rows: rows.fit! }))
      .toBe('/* rows columns */\n@container uav-view (block-size < 79.5px) {\n  .uav[data-layout="rows"]:not([data-keep~="guides"]) .uav-columns { display: none; }\n}');
  });

  it('sets no column\'s width: the headers and the rows are subgrids, and a ranked column goes by a need written on its cell', () => {
    expect(rows.css).toContain('grid-template-columns: subgrid');
    expect(rows.css).toContain('> [data-rank] { max-inline-size: max(0px, (100cqi - var(--uav-need) + 0.01px) * 999999);');
    expect(rows.css).not.toMatch(/\bch\b/);
  });

  it('gives up the list for the number in a box shorter than one row, at the context\'s row height', () => {
    const css = (rowHeight: number) => compileFitRules(rows.rules!({ ...CONTAINER_RULES, rows: { ...CONTAINER_RULES.rows, rowHeight } }), { rows: rows.fit! });
    const fig = '.uav[data-layout="rows"]:not([data-keep~="marks"])';
    expect(css(28).split('\n').slice(0, 5)).toEqual([
      '/* rows marks-block */', '@container uav-view (block-size < 27.5px) {',
      '  ' + fig + ' .uav-rows { display: none; }', '  ' + fig + ' .uav-number { display: block; }',
      '  ' + fig + ' { grid-template: "number" auto / minmax(0, 1fr); }',
    ]);
    expect(css(40)).toContain('@container uav-view (block-size < 39.5px) {');
  });

  it('takes its row height and gap from the rule set, never from its stylesheet', () => {
    expect(rows.css).toContain('block-size: var(--uav-row-block)');
    expect(rows.css).toContain('gap: var(--uav-row-gap)');
    expect(rows.css).not.toMatch(/\b(28|4)px/);
  });
});
