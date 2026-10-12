import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOTS_CSS } from '../packages/dom/src/dots.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { radial } from '../packages/dom/src/layouts/radial.ts';
import { rows } from '../packages/dom/src/layouts/rows.ts';
import { readNumber } from '../packages/dom/src/measure.ts';

// A page that reads from the right. Time and a plot's x still run from the left, and all about the plot follows the
// page. String work and one reading of boxes: what a browser makes of it is checked there, in both engines.
describe('right to left', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sets the plot and its x axis from the left, where the SVG draws its paths whatever it is told', () => {
    expect(cartesian.css).toContain('.uav-plot, .uav-x-axis { direction: ltr; }');
    // So what is placed in them may be moved by a physical translate, and is placed from the start, which is the left.
    expect(cartesian.css).toContain('.uav-bars i { position: absolute; inset-inline-start: calc(var(--uav-x) * 100%);');
    expect(cartesian.css).toContain('.uav-x-axis [data-anchor="end"] { translate: -100%; }');
  });
  it('lets a label in the plot run the way its own words do', () => {
    expect(cartesian.css).toContain('.uav-x-axis > span, :is(.uav-refs, .uav-point-labels) > span { unicode-bidi: plaintext; }');
  });
  it('leaves the y axes, the legend and the rows to the page: nothing else states a direction', () => {
    expect((cartesian.css + rows.css).match(/direction: ltr/g)).toHaveLength(1);
    // A row's track reads from the page's start, so a mark on it is set back by half its width and not moved there.
    expect(rows.css).not.toMatch(/\.uav-row[^{]*\{[^}]*translate/);
    expect(rows.css).toContain('[data-mark="dot"] { inset-block: calc(50% - 3px); inline-size: 6px; border-radius: 50%; inset-inline-start: calc(calc(var(--uav-row-gap) + var(--uav-x) * (100% - 2 * var(--uav-row-gap))) - 3px); }');
  });
  it('runs a circle clockwise and a number from its first character, whichever way the page reads', () => {
    expect(radial.css).toMatch(/\.uav-radial svg \{[^}]*direction: ltr;/);
    expect(DOTS_CSS).toMatch(/\.uav-glyphs \{[^}]*direction: ltr;/);
  });

  // The ruler's number: 60 wide after a pulse and its margins, 20 in all, on a line 200 wide that its delta fills.
  it('reads the number from where its line starts, so it is as wide read from the right as from the left', () => {
    const box = (left: number, width: number) => ({ left, right: left + width, width, top: 0, bottom: 40, height: 40 });
    const ruler = (value: ReturnType<typeof box>) => [{ dataset: { fit: '' }, getBoundingClientRect: () => box(0, 200),
      querySelector: (sel: string) => (sel.endsWith('uav-f-display') ? { getBoundingClientRect: () => value } : null) }] as unknown as HTMLElement[];
    vi.stubGlobal('getComputedStyle', () => ({ direction: 'ltr' }));
    expect(readNumber(ruler(box(20, 60))).forms).toEqual([{ fit: '', inline: 100, block: 40 }]);
    vi.stubGlobal('getComputedStyle', () => ({ direction: 'rtl' }));
    expect(readNumber(ruler(box(120, 60))).forms).toEqual([{ fit: '', inline: 100, block: 40 }]);
  });
});
