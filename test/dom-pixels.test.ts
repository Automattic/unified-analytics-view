import { describe, expect, it } from 'vitest';
import { PIXELS_CSS } from '../packages/dom/src/pixels.ts';
import { TOKENS } from '../packages/dom/src/tokens.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

describe('guides on whole px', () => {
  it('sets a grid line of 1 px on a whole px, and moves a tick\'s label by whole px', () => {
    expect(BASE_CSS).toContain(PIXELS_CSS);
    expect(PIXELS_CSS).toContain('.uav-line { inset-block-start: round(calc((1 - var(--uav-t)) * 100%), 1px); }');
    expect(PIXELS_CSS).toContain('.uav-grid .uav-line { block-size: 1px; }');
    expect(PIXELS_CSS).toContain(':is(.uav-y-axis, .uav-y-axis-2) span { inset-block-start: round(calc((1 - var(--uav-t)) * 100%), 1px); translate: 0 round(-50%, 1px); }');
    expect(PIXELS_CSS).toContain('.uav-x-axis span { inset-inline-start: round(calc(var(--uav-x) * 100%), 1px); translate: round(-50%, 1px); }');
    // A label that stands from its start or to its end still does.
    expect(PIXELS_CSS).toContain('.uav-x-axis [data-anchor="end"] { translate: -100%; }');
  });
  it('moves the plot and its axes together, by what the element finds is left over', () => {
    expect(PIXELS_CSS).toContain(':is(.uav-plot, .uav-y-axis, .uav-y-axis-2, .uav-x-axis, .uav-labels) { translate: var(--uav-nx, 0px) var(--uav-ny, 0px); }');
  });
  it('leaves the marks as vector: there is no square to draw them in', () => {
    expect(Object.keys(TOKENS)).not.toContain('size-pixel');
    expect(BASE_CSS).not.toMatch(/canvas|image-rendering|data-px/);
  });
});
