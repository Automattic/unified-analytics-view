import { describe, expect, it } from 'vitest';
import { CHROME_CSS } from '../packages/dom/src/chrome/index.ts';
import { AXES_CSS } from '../packages/dom/src/chrome/axes.ts';
import { LABEL_CSS, label } from '../packages/dom/src/chrome/label.ts';
import { KEYS_CSS } from '../packages/dom/src/keys.ts';
import { linkPainter } from '../packages/flow/src/dom.ts';
import { partitionPainter } from '../packages/partition/src/dom.ts';
import { LEGEND_CSS, hideCutLegends } from '../packages/dom/src/chrome/legend.ts';
import { RAMP_CSS } from '../packages/dom/src/chrome/ramp.ts';
import { SIZE_CSS } from '../packages/dom/src/chrome/size.ts';
import { SWATCH_CSS } from '../packages/dom/src/chrome/swatch.ts';
import { LAYOUTS } from '../packages/dom/src/layouts/index.ts';
import { PIXELS_CSS } from '../packages/dom/src/pixels.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

// The chrome: what a view has beside its marks, painted by one module each and styled from one place. String work:
// what a browser makes of it is checked on the bench.
describe('chrome', () => {
  it('joins the base sheet once, so every layout has it, a custom mark\'s among them', () => {
    expect(BASE_CSS.split(CHROME_CSS)).toHaveLength(2);
  });
  it('styles the axes in its own sheet, before the sheet that sets their labels on whole px, and a plot and a grid say only where each stands', () => {
    expect(CHROME_CSS).toContain(AXES_CSS);
    expect(BASE_CSS.indexOf(AXES_CSS)).toBeLessThan(BASE_CSS.indexOf(PIXELS_CSS));
    for (const p of Object.values(LAYOUTS)) expect(p.css).not.toMatch(/(^|\n)(:is\()?\.uav-[xy]-axis\b/);
    for (const layout of ['cartesian', 'matrix']) for (const [axis, area] of [['x', 'x'], ['y', 'y']]) expect(LAYOUTS[layout]!.css).toContain(`.uav[data-layout="${layout}"] .uav-${axis}-axis { grid-area: ${area}; }`);
  });
  it('sets every plot label from one rule set: its tone, its cut, its halo and, given up, its box kept, said once for every view', () => {
    expect(CHROME_CSS).toContain(LABEL_CSS);
    expect(LABEL_CSS).toContain('.uav [data-thin] { visibility: hidden; }');
    expect(LABEL_CSS).toContain('.uav [data-halo] { -webkit-text-stroke: 3px var(--ua-charts-color-background');
    expect(AXES_CSS).toContain(label({ tone: 'axis' }));
    expect(label({ truncate: true })).toBe('white-space: nowrap; color: var(--uav-paint); max-inline-size: 14ch; overflow: hidden; text-overflow: ellipsis;');
    for (const css of [...Object.values(LAYOUTS).map((p) => p.css), linkPainter.css, partitionPainter.css, AXES_CSS, KEYS_CSS]) expect(css).not.toMatch(/\[data-(thin|halo)\] \{|-webkit-text-stroke/);
  });
  it('styles both forms of the legend in its own sheet, and a layout says only where it stands and what it does in a box', () => {
    expect(CHROME_CSS).toContain(LEGEND_CSS);
    for (const p of Object.values(LAYOUTS)) expect(p.css).not.toMatch(/(^|\n)\.uav-legend\b|\.uav-legend span|flex-wrap: wrap; gap: 0 14px/);
    // What keys.ts marks the chosen entry by is a span in either form.
    expect(LEGEND_CSS).toContain('.uav-legend[data-names] span::before {');
    expect(LEGEND_CSS).toContain('.uav-legend span, .uav-legend-top span {');
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
    expect(SWATCH_CSS).toContain('[data-swatch~="dot"] { --uav-swatch-i: calc(4px + var(--uav-size, 0.4) * 5px);');
    for (const p of Object.values(LAYOUTS)) expect(p.css).not.toMatch(/(^|\n)\.uav-size\b/);
    expect(LAYOUTS.cartesian!.css).toContain('.uav[data-layout="cartesian"] .uav-size { grid-column: 1 / -1; }');
    expect(LAYOUTS.matrix!.css).toContain('.uav[data-layout="matrix"] .uav-size { grid-area: size; }');
  });
});

describe('the legends a box clips', () => {
  it('are taken from assistive technology while they have no height, and given back when they have', () => {
    const legend = (height: number) => {
      const a = new Map<string, string>();
      const el = { height, getBoundingClientRect: () => ({ height: el.height }), getAttribute: (k: string) => a.get(k) ?? null, setAttribute: (k: string, v: string) => void a.set(k, v), removeAttribute: (k: string) => void a.delete(k) };
      return el;
    };
    const full = legend(0), top = legend(20), body = { querySelectorAll: () => [full, top] } as unknown as HTMLElement;
    hideCutLegends(body);
    expect([full.getAttribute('aria-hidden'), top.getAttribute('aria-hidden')]).toEqual(['true', null]);
    full.height = 60; top.height = 0;
    hideCutLegends(body);
    expect([full.getAttribute('aria-hidden'), top.getAttribute('aria-hidden')]).toEqual([null, 'true']);
  });
});
