import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES } from '@universal-analytics/core';
import { compileFitRules } from '@universal-analytics/dom';
import { band } from '../packages/dom/src/layouts/band.ts';

// String work only, as in dom-compile.test.ts. What the browser makes of it is checked on the bench.
const fig = (keep: string) => '.uav[data-layout="band"]:not([data-keep~="' + keep + '"])';
const css = compileFitRules([...FIT_RULES.filter((r) => r.layout === 'band'), ...band.rules!(CONTAINER_RULES)], { band: band.fit! });

describe('the band layout', () => {
  it('hides the one-line legend until a rule or the plan asks for it', () => {
    expect(band.css).toContain('.uav-legend-top { display: none; }');
    expect(band.css).toContain('.uav[data-layout="band"][data-parts~="legend-top"] .uav-legend-top { display: block; }');
  });

  it('in a box, the full legend gives up its gap with its height, so the one-line legend is not pushed out', () => {
    expect(band.css).toMatch(/\.uav-legend \{ overflow: hidden; max-block-size: max\(0px, [^;]+;\s+margin-block-start: clamp\(0px, [^;]+, 10px\); \}/);
  });

  it('swaps the legends under the legend rule, which alone only sets a switch', () => {
    expect(css).toContain([
      '@container uav-view (inline-size < 169.5px) {',
      '  ' + fig('guides') + ' { --uav-legend: top; }',
      '  ' + fig('guides') + ' .uav-legend { display: none; }',
      '  ' + fig('guides') + ' .uav-legend-top { display: block; max-block-size: none; }',
      '}',
    ].join('\n'));
  });

  it('gives up the body and its grid row with the marks, by width and by height, after the swap', () => {
    const alone = [
      '  ' + fig('marks') + ' :is(.uav-band, .uav-legend) { display: none; }',
      '  ' + fig('marks') + ' .uav-number { display: block; }',
      '  ' + fig('marks') + ' { grid-template: "number" auto / minmax(0, 1fr); }',
      '  ' + fig('marks') + ' .uav-body { display: none; }',
      '  ' + fig('marks') + ' .uav-number { align-self: start; margin: 0; }',
      '}',
    ].join('\n');
    expect(css).toContain('@container uav-view (inline-size < 109.5px) {\n' + alone);
    expect(css).toContain('@container uav-view (block-size < 47.5px) {\n' + alone);
    expect(css.indexOf('inline-size < 169.5px')).toBeLessThan(css.indexOf('inline-size < 109.5px'));
  });
});
