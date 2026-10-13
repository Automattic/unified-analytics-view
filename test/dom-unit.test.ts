import { describe, expect, it } from 'vitest';
import { FIT_RULES } from '@unified-analytics/core';
import { compileFitRules } from '@unified-analytics/dom';
import { band } from '../packages/dom/src/layouts/band.ts';
import { radial } from '../packages/dom/src/layouts/radial.ts';
import { rows } from '../packages/dom/src/layouts/rows.ts';
import { UNIT_CSS } from '../packages/dom/src/chrome/unit.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

// String work only, as in dom-band.test.ts. What the browser makes of it is checked on the bench: the glyphs were
// measured there and are square at every size looked at.
describe('a unit\'s glyphs in the DOM', () => {
  it('hold their shape: a dot is as wide as the lesser of its room across and up, and as tall as it is wide', () => {
    expect(UNIT_CSS).toContain('.uav-plot .uav-dots i[data-unit] { inline-size: max(1px, calc(min(var(--uav-w) * 100cqi, var(--uav-h) * 100cqb) - 1px)); }');
    expect(UNIT_CSS).toContain('.uav-dots i[data-unit] { inline-size: max(1px, calc(var(--uav-w) * 100cqi - 1px)); block-size: auto; aspect-ratio: 1; }');
    expect(rows.css).toMatch(/i\[data-mark="unit"\] \{ inset-block: 0; margin-block: auto; inline-size: max\(1px, calc\(min\(var\(--uav-w\) \* [^;]+, var\(--uav-row-block\) - 8px\) - 1px\)\); block-size: auto; aspect-ratio: 1; border-radius: 50%;/);
    expect(band.css).toContain('.uav-band[data-unit] { display: grid; grid-template: repeat(10, minmax(0, 1fr)) / repeat(10, minmax(0, 1fr)); gap: 1px; block-size: auto; inline-size: min(100%, 160px); aspect-ratio: 1; margin-inline: auto; }');
    expect(radial.css).toContain('inline-size: min(100%, var(--uav-radial-most, 160px)); aspect-ratio: var(--uav-aspect, 1); container: uav-plot / inline-size;');
  });
  it('the shared styles join the base sheet once, and the key shows only where the plan names it', () => {
    expect(BASE_CSS.split(UNIT_CSS)).toHaveLength(2);
    expect(UNIT_CSS).toContain('.uav-unit-key { display: none;');
    expect(UNIT_CSS).toContain('.uav[data-parts~="unit-key"] .uav-unit-key { display: block; }');
  });
  it('the rules compile to the key going by height, and to the swap for the rule\'s own view beside the figure', () => {
    const css = compileFitRules(FIT_RULES.filter((r) => r.id.startsWith('unit')));
    expect(css).toContain('/* cartesian unit-key */\n@container uav-view (block-size < 159.5px) {\n  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) .uav-unit-key { display: none; }\n}');
    const fig = '.uav[data-layout="band"]:not([data-keep~="marks"])', swap = (id: string) => '  ' + fig + ':has(~ .uav-fallback[data-rule="' + id + '"]) { display: none; }\n  ' + fig + ' ~ .uav-fallback[data-rule="' + id + '"] { display: block; }\n}';
    expect(css).toContain('/* band unit */\n@container uav-view (inline-size < 279.5px) {\n' + swap('unit'));
    expect(css).toContain('/* band unit-alone */\n@container uav-view (block-size < 179.5px) {\n' + swap('unit-alone'));
  });
});
