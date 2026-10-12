import { describe, expect, it } from 'vitest';
import { buildScene, resolve, unboundedContainer } from '@unified-analytics/core';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';
import { CELL, DOTS_CSS, FACE, FAMILY, amount, dotted, rolls, unit } from '../packages/dom/src/dots.ts';
import { NUMBER_FITS, SCREEN_LEAST, fitNumber } from '../packages/dom/src/measure.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { once } from '../packages/dom/src/motion.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

// The dot-matrix face is a font a page loads and a stylesheet that sets it, so the stylesheet is held here with no DOM. How a number
// looks in it is checked in a browser on the bench.
describe('the dot-matrix face', () => {
  it('is a pixel face a page loads, set at eight cells to the em so one of its pixels is one cell', () => {
    expect(FAMILY).toBe('Ans Mono Scroll');
    expect(DOTS_CSS).toContain('font: normal 400 calc(var(--uav-u) * 8) / 1 "Ans Mono Scroll", "Ans Mono", monospace;');
    // Its optical size is forced, to draw each pixel smaller than its cell: the size it is set at would fill it.
    expect(DOTS_CSS).toContain('font-optical-sizing: none;');
    expect(DOTS_CSS).toContain('font-variation-settings: "opsz" var(--ua-charts-font-optical-size-display, 72), "SCRL" 0;');
    for (const ch of '0123456789.,-') expect(FACE, ch).toContain(ch);
  });
  it('sets a value whole, or not at all: one character it has no glyph for and the value stays in the plain face', () => {
    expect(dotted('10.5k')).toEqual(['1', '0', '.', '5', 'k']);
    for (const s of ['$48.2k', '6.9%', '2m 05s', '340ms', '1.2 MB', '–', '1,234']) expect(dotted(s), s).not.toBeNull();
    for (const s of ['CA$5', 'New', '']) expect(dotted(s), s).toBeNull();
  });
  it('has every character of the number in each sample the bench shows', () => {
    for (const [name, { spec }] of Object.entries(samples)) for (const scenario of ['typical', 'no-prior', 'empty'] as const) {
      const result = runQuery(spec.query, scenario), scene = buildScene(resolve(spec, result, unboundedContainer(), catalog), spec.query, result, catalog);
      for (const n of scene.nodes) if (n.kind === 'text' && n.font === 'display') for (const s of [n.text, n.short ?? n.text]) expect(dotted(s), name + ': ' + s).not.toBeNull();
    }
  });
  it('sets a character in a slot six cells by seven, with no rule of its own: the slot says which it is', () => {
    expect(DOTS_CSS).toContain('.uav-glyph-run i::before { content: attr(data-ch); }');
    expect(DOTS_CSS).toContain('.uav-glyph-run i[data-roll]::after { content: attr(data-was); }');
    expect(DOTS_CSS).not.toContain('box-shadow');
    // A point advances by four cells, not six: the face sets it at the start of its own.
    expect(DOTS_CSS).toContain('.uav-glyph-run i[data-ch="."] { inline-size: calc(var(--uav-u) * 4); }');
  });
  it('keeps a cell the same whole number of px everywhere, and is in the element\'s base sheet', () => {
    expect(DOTS_CSS).toContain('--uav-u: 4px;');
    expect(DOTS_CSS.match(/--uav-u:/g)).toHaveLength(1);
    expect(CELL).toBe(4);
    expect(BASE_CSS).toContain(DOTS_CSS);
    expect(NUMBER_FITS.at(-1)).toBe('small short');
    // The words are still there where a shadow is not drawn.
    expect(DOTS_CSS).toMatch(/@media \(forced-colors: active\) \{\s+\.uav-glyphs \{ display: none; \}/);
  });

  // A screen fills its room. A number too wide for it keeps its cells and loses its end.
  it('is on a screen, which is as wide as its room at a whole cell and never shrinks a cell to fit', () => {
    expect(DOTS_CSS).toContain('overflow: hidden;');
    expect(DOTS_CSS).toContain(' inline-size: round(down, 100%, var(--uav-u));');
    // It has no surface of its own: the cells sit on what the view is on.
    // The one room it adds is a row of cells under the words that share a view's screen.
    expect(DOTS_CSS).not.toMatch(/color-screen|elevation-screen|radius-screen|padding(?!: var\(--uav-u\))/);
    expect(DOTS_CSS).not.toContain('tight');
  });
  it('sets a unit in type, in small capitals at the number\'s size, beside the cells', () => {
    expect(['k', 'M', '%', 's', '$', '€'].every(unit)).toBe(true);
    expect(Array.from('1,234.5 -–').some(unit)).toBe(false);
    expect(DOTS_CSS).toMatch(/\.uav-glyph-run sup \{[^}]*font: normal 400 calc\(var\(--uav-u\) \* 8\)[^}]*font-variant-caps: all-small-caps;/);
  });
  it('shares a view\'s screen with the change and the note under the number, each line a whole number of cells', () => {
    expect(DOTS_CSS).toContain('.uav-number:has(> b .uav-glyphs)::before { content: ""; position: absolute; z-index: -1;');
    expect(DOTS_CSS).toContain('inline-size: round(down, 100%, var(--uav-u)); block-size: round(down, 100%, var(--uav-u)); background: var(--uav-cells); }');
    // The value's own screen draws no cells there, or they would be drawn twice.
    expect(DOTS_CSS).toContain('.uav-number .uav-glyphs { background: none; }');
    expect(DOTS_CSS).toContain('.uav-number:has(> b .uav-glyphs) > span { line-height: calc(var(--uav-u) * 5); }');
    expect(DOTS_CSS).toContain('.uav-number:has(> b .uav-glyphs) > .uav-f-tick { line-height: calc(var(--uav-u) * 4); }');
    expect(DOTS_CSS).toContain('.uav-number:has(> b .uav-glyphs) > b + span { margin-block-start: var(--uav-u); }');
  });
  it('runs a number too wide for its screen past under the pointer, right to left and round again, and shows its end at once with reduced motion', () => {
    expect(DOTS_CSS).toContain('left: round(to-zero, calc(var(--uav-e, 0) * 100%), var(--uav-u)); translate: round(to-zero, calc(var(--uav-s, 0) * -100%), var(--uav-u)) 0; }');
    // It leaves by its own width, and comes in again from the screen's far edge.
    expect(DOTS_CSS).toContain('55% { --uav-s: 1; --uav-e: 0; } 55.001% { --uav-s: 0; --uav-e: 1; }');
    // One that fits does not move: only a screen the measured pass found too narrow runs.
    expect(DOTS_CSS).toContain('.uav-glyphs[data-over]:hover .uav-glyph-run { animation: uav-run 6s linear infinite; }');
    expect(DOTS_CSS).toContain('@media (prefers-reduced-motion: reduce) { .uav-glyphs[data-over]:hover .uav-glyph-run { animation: none; --uav-s: 1; --uav-e: 1; } }');
  });
  it('keeps a number on a screen where no form fits its room, down to the least a screen is, and gives up one in type', () => {
    const forms = [{ fit: '', inline: 130, block: 52 }, { fit: 'short', inline: 105, block: 52 }, { fit: 'small short', inline: 90, block: 42 }];
    expect(fitNumber({ inline: 80 }, { forms, delta: null, note: null, screen: true })).toBe('small short');
    expect(fitNumber({ inline: SCREEN_LEAST }, { forms, delta: null, note: null, screen: true })).toBe('small short');
    expect(fitNumber({ inline: SCREEN_LEAST - 1 }, { forms, delta: null, note: null, screen: true })).toBeNull();
    expect(fitNumber({ inline: 80 }, { forms, delta: null, note: null })).toBeNull();
    // Its height is still a reason to give it up: a screen is cut across, never down.
    expect(fitNumber({ inline: 80, block: 30 }, { forms, delta: null, note: null, screen: true })).toBeNull();
  });

  // The readout sketch's roll: only what changed moves, the last character first, up for a rise and down for a fall.
  it('rolls the characters that changed, by their place from the end, the last first', () => {
    expect(rolls(['1', '2', '3'], ['1', '2', '4'])).toEqual([null, null, { was: '3', wait: 0 }]);
    expect(rolls(['1', '9', '9'], ['2', '0', '0'])).toEqual([{ was: '1', wait: 2 }, { was: '9', wait: 1 }, { was: '9', wait: 0 }]);
    // A number that gains a character: the new place held a space, and the places are counted from the end.
    expect(rolls(['9', '9', '9'], ['1', ',', '0', '0', '0'])).toEqual([{ was: ' ', wait: 4 }, { was: ' ', wait: 3 }, { was: '9', wait: 2 }, { was: '9', wait: 1 }, { was: '9', wait: 0 }]);
    expect(rolls(['1', '0', '.', '5', 'k'], ['1', '0', '.', '7', 'k'])).toEqual([null, null, null, { was: '5', wait: 0 }, null]);
  });
  it('tells a rise from a fall by what a value comes to, suffix and all', () => {
    expect(amount('10.5k')).toBe(10500); expect(amount('$1,843')).toBe(1843); expect(amount('6.9%')).toBe(6.9); expect(amount('2m 05s')).toBe(2);
    expect(amount('1.2M')).toBe(1200000); expect(amount('-4')).toBe(-4); expect(amount('–')).toBeNull();
    expect(amount('999')! < amount('1.2k')!).toBe(true);
  });
  it('rolls on the face\'s own axis, a whole row a step, each character waiting its turn, and not at all with reduced motion', () => {
    expect(DOTS_CSS).toContain('animation: var(--ua-charts-motion-duration-roll, 384ms) steps(8) calc(var(--uav-wait, 0) * var(--ua-charts-motion-duration-roll, 384ms) / 8) both;');
    // The new character comes up from eight rows under, and the old one goes out over the top: down, the other way.
    expect(DOTS_CSS).toContain('@keyframes uav-roll-in-u { from { font-variation-settings: "opsz" var(--ua-charts-font-optical-size-display, 72), "SCRL" -8; } to { font-variation-settings: "opsz" var(--ua-charts-font-optical-size-display, 72), "SCRL" 0; } }');
    expect(DOTS_CSS).toContain('@keyframes uav-roll-out-d { from { font-variation-settings: "opsz" var(--ua-charts-font-optical-size-display, 72), "SCRL" 0; } to { font-variation-settings: "opsz" var(--ua-charts-font-optical-size-display, 72), "SCRL" -8; } }');
    // Outside the motion query the old character is not drawn, so the new one simply stands.
    expect(DOTS_CSS).toMatch(/\.uav-glyph-run i\[data-roll\]::after \{ display: none; \}\n@media \(prefers-reduced-motion: no-preference\)/);
  });

  // What plays once is taken off when it is over, so a part a resize brings back does not play again.
  it('draws a plot\'s lines in from the start when the plot first shows, and only then', () => {
    expect(cartesian.css).toContain('@media (prefers-reduced-motion: no-preference) { .uav-plot svg[data-draw] { animation: uav-draw var(--ua-charts-motion-duration-draw, 1400ms) linear both; } }');
    expect(cartesian.css).toContain('@keyframes uav-draw { from { clip-path: inset(-8px 100% -8px -8px); } to { clip-path: inset(-8px); } }');
    const off: string[] = [], el = { removeAttribute: (a: string) => void off.push(a) } as unknown as Element;
    // With no frames to play in, the marks come straight off.
    once(el, ['data-roll', 'data-was']);
    expect(off).toEqual(['data-roll', 'data-was']);
  });
});
