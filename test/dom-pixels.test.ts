import { describe, expect, it } from 'vitest';
import { PATTERNS, PIXELS_CSS, brush, pattern } from '../packages/dom/src/pixels.ts';
import { token } from '../packages/dom/src/tokens.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

describe('the pixel look of the marks', () => {
  it('is a square the token sets, 1 px where a page sets none', () => {
    expect(token('size-pixel')).toBe('var(--ua-charts-size-pixel, 1px)');
    expect(PIXELS_CSS).toContain('.uav { --uav-px: var(--ua-charts-size-pixel, 1px); }');
    expect(BASE_CSS).toContain(PIXELS_CSS);
  });
  it('shows a canvas in place of a plot\'s SVG, scaled up without smoothing, and only once it is drawn', () => {
    expect(PIXELS_CSS).toContain('.uav-pixels { position: absolute; image-rendering: pixelated; pointer-events: none; }');
    expect(PIXELS_CSS).toContain('.uav[data-px] svg[data-pixels] { opacity: 0; }');
    // The canvas draws in as the SVG did.
    expect(PIXELS_CSS).toContain('.uav-plot svg[data-draw] + .uav-pixels { animation: uav-draw');
  });
  it('says a paint\'s opacity with a pattern, as the prototype does: a square is on or off', () => {
    expect(pattern(1)).toBe('solid');
    expect(pattern(0.75)).toBe('solid');                                       // the dash to a day still filling
    expect(pattern(0.4)).toBe('checker');
    expect(pattern(0.14)).toBe('sparse');                                      // an area's tint
    const on = (name: keyof typeof PATTERNS) => [0, 1, 2, 3].flatMap((y) => [0, 1, 2, 3].map((x) => PATTERNS[name](x, y))).filter(Boolean).length;
    expect([on('solid'), on('checker'), on('sparse')]).toEqual([16, 8, 4]);
  });
  it('draws a line with a square brush of its own width, and of two squares at the least, as a calculator plots one', () => {
    expect(brush(2, 2)).toBe(2);
    expect(brush(1.5, 2)).toBe(2);
    expect(brush(6, 2)).toBe(3);
  });
  it('cuts a bar to the same squares, with square corners, and takes its near edge from its far one so a stack has no seam', () => {
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-bars i { border-radius: 0;');
    // Less the gap that parts it from the next in its stack, where it is in one.
    expect(PIXELS_CSS).toContain('block-size: max(0px, calc(round(calc(max(var(--uav-v0, 0), var(--uav-v)) * 100%), var(--uav-px)) - round(calc(min(var(--uav-v0, 0), var(--uav-v)) * 100%), var(--uav-px)) - var(--uav-gap-y, 0px)));');
    // A track's marks are placed by the track, and are not a bar from the row's start.
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-body:not([data-track]) .uav-row > i { border-radius: 0;');
    // A bar that is part transparent is every other square of itself, at full strength.
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-bars i[style*="opacity"] { opacity: 1 !important; mask: conic-gradient(');
  });
  it('sets the guides on the same squares: a grid line of 1 px on a whole square, and a tick\'s label moved by whole px', () => {
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-line { inset-block-start: round(calc((1 - var(--uav-t)) * 100%), var(--uav-px)); }');
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-grid .uav-line { block-size: 1px; }');
    expect(PIXELS_CSS).toContain('.uav[data-px] :is(.uav-y-axis, .uav-y-axis-2) span { inset-block-start: round(calc((1 - var(--uav-t)) * 100%), var(--uav-px)); translate: 0 round(-50%, 1px); }');
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-x-axis span { inset-inline-start: round(calc(var(--uav-x) * 100%), var(--uav-px)); translate: round(-50%, 1px); }');
    // A label that stands from its start or to its end still does.
    expect(PIXELS_CSS).toContain('.uav[data-px] .uav-x-axis [data-anchor="end"] { translate: -100%; }');
  });
  it('does nothing until the element says the look is on', () => {
    const rules = PIXELS_CSS.trim().split('\n').filter((line) => /^[.@]/.test(line)).map((line) => line.slice(0, line.indexOf('{')).trim());
    expect(rules.filter((selector) => !/\[data-px\]|svg\[data-draw\] \+ \.uav-pixels/.test(selector))).toEqual(['.uav', '.uav-pixel', '.uav-pixels', '@media (prefers-reduced-motion: no-preference)']);
  });
});
