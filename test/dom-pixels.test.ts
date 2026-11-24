import { describe, expect, it } from 'vitest';
import { PIXELS_CSS, pixels } from '../packages/dom/src/pixels.ts';
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
  it('sets a plot that lies half way between two device px on the one before it, every time, whatever it was moved by before', () => {
    // A figure whose plot stands at `top`, already moved by `was`, on a screen of two device px to one.
    const moved = (top: number, was = 0) => {
      const props = new Map<string, string>(was ? [['--uav-ny', was + 'px']] : []);
      const fig = { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: top + was }) }), ownerDocument: { defaultView: { devicePixelRatio: 2 } },
        style: { getPropertyValue: (n: string) => props.get(n) ?? '', setProperty: (n: string, v: string) => void props.set(n, v), removeProperty: (n: string) => void props.delete(n) } };
      pixels(fig as unknown as HTMLElement);
      return parseFloat(props.get('--uav-ny') ?? '0');
    };
    // 1005.75 is half way between two device px. Read back after an earlier move it is a hair to one side or the other,
    // and plain rounding would send those two apart by a whole device px: that was a view drawn a px off from one load to the next.
    expect(moved(1005.75)).toBe(-0.25);
    expect(moved(1005.75 + 3e-6, -0.234)).toBe(-0.25);
    expect(moved(1005.75 - 3e-6, -0.234)).toBe(-0.25);
    expect(moved(1005.75 + 3e-6, 0.25)).toBe(-0.25);
    // Anywhere else it goes to the nearer one, and a plot on a device px is left where it is.
    expect(moved(1005.6)).toBeCloseTo(-0.1, 9);
    expect(moved(1005.9)).toBeCloseTo(0.1, 9);
    expect(moved(1005.5)).toBe(0);
  });
  it('leaves the marks as vector: there is no square to draw them in', () => {
    expect(Object.keys(TOKENS)).not.toContain('size-pixel');
    expect(BASE_CSS).not.toMatch(/canvas|image-rendering|data-px/);
  });
});
