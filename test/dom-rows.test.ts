import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { rows } from '../packages/dom/src/layouts/rows.ts';

// String work only: there is no DOM here. What the browser makes of the rows is checked on the bench.
describe('the rows layout', () => {
  it('gives up its body with its marks, so the number stands alone', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'marks'), { rows: rows.fit! });
    const fig = '.uav[data-layout="rows"]:not([data-keep~="marks"])';
    expect(css.split('\n').slice(0, 8)).toEqual([
      '/* rows marks */', '@container uav-view (inline-size < 89.5px) {',
      '  ' + fig + ' :is(.uav-rows, .uav-columns, .uav-legend, .uav-legend-top, .uav-unit-key) { display: none; }', '  ' + fig + ' .uav-number { display: block; }',
      '  ' + fig + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig + ' .uav-body { display: none; }', '  ' + fig + ' .uav-number { align-self: start; margin: 0; }',
      '}',
    ]);
  });

  it('keeps its headers in a short box: no rule takes them but the ones that take the rows, and the rows under them are clipped to whole rows', () => {
    expect(compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && !r.hide.includes('rows')), { rows: rows.fit! })).not.toContain('.uav-columns');
    expect(rows.css).toContain('.uav-rows { max-block-size: calc(round(down, 100% + var(--uav-row-gap), var(--uav-row-block) + var(--uav-row-gap)) - var(--uav-row-gap)); }');
  });

  it('sets no column\'s width: the headers and the rows are subgrids, and a ranked column goes by a need written on its cell', () => {
    expect(rows.css).toContain('grid-template-columns: subgrid');
    expect(rows.css).toContain('> [data-rank] { max-inline-size: max(0px, (100cqi - var(--uav-need) + 0.01px) * 999999);');
    expect(rows.css).not.toMatch(/\bch\b/);
  });

  it('gives up the list for the number in a box shorter than one row, by the same rule', () => {
    const [wide, tall] = compileFitRules(FIT_RULES.filter((r) => r.layout === 'rows' && r.id === 'marks'), { rows: rows.fit! }).split('/* rows marks */\n').filter(Boolean).map((block) => block.trim().split('\n'));
    expect([wide![0], tall![0]]).toEqual(['@container uav-view (inline-size < 89.5px) {', '@container uav-view (block-size < ' + (CONTAINER_RULES.rows.rowHeight - 0.5) + 'px) {']);
    expect(tall!.slice(1)).toEqual(wide!.slice(1));
  });

  it('takes its row height and gap from the rule set, never from its stylesheet', () => {
    expect(rows.css).toContain('block-size: var(--uav-row-block)');
    expect(rows.css).toContain('gap: var(--uav-row-gap)');
    expect(rows.css).not.toMatch(/\b(28|4)px/);
  });
});
