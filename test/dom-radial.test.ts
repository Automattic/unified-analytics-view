import { describe, expect, it } from 'vitest';
import { FIT_RULES } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { LAYOUTS } from '../packages/dom/src/layouts/index.ts';
import { radial } from '../packages/dom/src/layouts/radial.ts';

// String work only, as in dom-band.test.ts. What the browser makes of it is checked on the bench.
const fig = (keep: string) => '.uav[data-layout="radial"]:not([data-keep~="' + keep + '"])';
const css = compileFitRules(FIT_RULES.filter((r) => r.layout === 'radial'), { radial: radial.fit! });

describe('the radial layout', () => {
  it('is registered, holds its shape, and is the plot container the hole rule asks about', () => {
    expect(LAYOUTS.radial).toBe(radial);
    expect(radial.css).toContain('aspect-ratio: var(--uav-aspect, 1); container: uav-plot / inline-size;');
    expect(css).toContain('@container uav-plot (inline-size < 119.5px) {\n  .uav[data-layout="radial"] .uav-hole { display: none; }\n}');
  });
  it('steps the legend down as the band does, then to nothing, then to the number alone, in that order', () => {
    expect(css).toContain(['@container uav-view (inline-size < 169.5px) {', '  ' + fig('guides') + ' { --uav-legend: top; }',
      '  ' + fig('guides') + ' .uav-legend { display: none; }', '  ' + fig('guides') + ' .uav-legend-top { display: block; max-block-size: none; }', '}'].join('\n'));
    expect(css).toContain('@container uav-view (block-size < 87.5px) {\n  ' + fig('guides') + ' :is(.uav-legend, .uav-legend-top) { display: none; }\n}');
    const alone = ['  ' + fig('marks') + ' :is(.uav-radial, .uav-legend, .uav-legend-top) { display: none; }', '  ' + fig('marks') + ' .uav-number { display: block; }',
      '  ' + fig('marks') + ' { grid-template: "number" auto / minmax(0, 1fr); }', '  ' + fig('marks') + ' .uav-body { display: none; }', '  ' + fig('marks') + ' .uav-number { margin: 0; }', '}'].join('\n');
    expect(css).toContain('@container uav-view (inline-size < 71.5px) {\n' + alone);
    expect(css).toContain('@container uav-view (block-size < 63.5px) {\n' + alone);
    const at = ['inline-size < 169.5px', 'block-size < 87.5px', 'inline-size < 119.5px', 'inline-size < 71.5px'].map((s) => css.indexOf(s));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });
});
