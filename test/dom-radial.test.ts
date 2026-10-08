import { describe, expect, it } from 'vitest';
import { FIT_RULES } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { LAYOUTS } from '../packages/dom/src/layouts/index.ts';
import { radial } from '../packages/dom/src/layouts/radial.ts';

// String work only, as in dom-band.test.ts. What the browser makes of it is checked on the bench.
const fig = (keep: string) => '.vg[data-layout="radial"]:not([data-keep~="' + keep + '"])';
const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'radial'), { radial: radial.fit! });

describe('the radial layout', () => {
  it('is registered, holds its shape, and is the plot container the hole rule asks about', () => {
    expect(LAYOUTS.radial).toBe(radial);
    expect(radial.css).toContain('aspect-ratio: var(--vg-aspect, 1); container: plot / inline-size;');
    expect(css).toContain('@container plot (inline-size < 120px) {\n  .vg[data-layout="radial"] .vg-hole { display: none; }\n}');
  });
  it('steps the legend down as the band does, then to nothing, then to the number alone, in that order', () => {
    expect(css).toContain(['@container view (inline-size < 170px) {', '  ' + fig('guides') + ' { --vg-legend: top; }',
      '  ' + fig('guides') + ' .vg-legend { display: none; }', '  ' + fig('guides') + ' .vg-legend-top { display: block; max-block-size: none; }', '}'].join('\n'));
    expect(css).toContain('@container view (block-size < 88px) {\n  ' + fig('guides') + ' :is(.vg-legend, .vg-legend-top) { display: none; }\n}');
    const alone = ['  ' + fig('marks') + ' :is(.vg-radial, .vg-legend, .vg-legend-top) { display: none; }', '  ' + fig('marks') + ' .vg-number { display: block; }',
      '  ' + fig('marks') + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig('marks') + ' .vg-body { display: none; }', '  ' + fig('marks') + ' .vg-number { margin: 0; }', '}'].join('\n');
    expect(css).toContain('@container view (inline-size < 72px) {\n' + alone);
    expect(css).toContain('@container view (block-size < 64px) {\n' + alone);
    const at = ['inline-size < 170px', 'block-size < 88px', 'inline-size < 120px', 'inline-size < 72px'].map((s) => css.indexOf(s));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });
});
