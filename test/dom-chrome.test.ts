import { describe, expect, it } from 'vitest';
import { CHROME_CSS } from '../packages/dom/src/chrome/index.ts';
import { RAMP_CSS } from '../packages/dom/src/chrome/ramp.ts';
import { SIZE_CSS } from '../packages/dom/src/chrome/size.ts';
import { LAYOUTS } from '../packages/dom/src/layouts/index.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

// The chrome: what a view has beside its marks, painted by one module each and styled from one place. String work:
// what a browser makes of it is checked on the bench.
describe('chrome', () => {
  it('joins the base sheet once, so every layout has it, a custom mark\'s among them', () => {
    expect(BASE_CSS.split(CHROME_CSS)).toHaveLength(2);
  });
  it('styles the ramp in its own sheet, and no layout\'s sheet styles it again', () => {
    expect(CHROME_CSS).toContain(RAMP_CSS);
    expect(RAMP_CSS).toContain('.uav-ramp { display: flex;');
    for (const p of Object.values(LAYOUTS)) expect(p.css).not.toMatch(/(^|\n)\.uav-ramp\b/);
    // Where it stands is the layout's.
    expect(LAYOUTS.matrix!.css).toContain('.uav[data-layout="matrix"] .uav-ramp { grid-area: ramp; }');
  });
  it('styles the key to sizes in its own sheet, with a plot\'s dot, and a layout says only where it stands', () => {
    expect(CHROME_CSS).toContain(SIZE_CSS);
    expect(SIZE_CSS).toContain('.uav-size i { flex: none; inline-size: calc(4px + var(--uav-size, 0.4) * 5px);');
    for (const p of Object.values(LAYOUTS)) expect(p.css).not.toMatch(/(^|\n)\.uav-size\b/);
    expect(LAYOUTS.cartesian!.css).toContain('.uav[data-layout="cartesian"] .uav-size { grid-column: 1 / -1; }');
    expect(LAYOUTS.matrix!.css).toContain('.uav[data-layout="matrix"] .uav-size { grid-area: size; }');
  });
});
