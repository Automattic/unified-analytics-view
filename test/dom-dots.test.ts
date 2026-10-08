import { describe, expect, it } from 'vitest';
import { buildScene, resolve, unboundedContainer } from '@universal-analytics/core';
import { catalog, runQuery, samples } from '@universal-analytics/fixtures';
import { CELL, DOTS_CSS, FONT, amount, dotted, rolls } from '../packages/dom/src/dots.ts';
import { NUMBER_FITS, SCREEN_LEAST, fitNumber } from '../packages/dom/src/measure.ts';
import { cartesian } from '../packages/dom/src/layouts/cartesian.ts';
import { once } from '../packages/dom/src/motion.ts';
import { BASE_CSS } from '../packages/dom/src/view.ts';

// The dot-matrix face is glyph data and a stylesheet made from it, so both are held here with no DOM. How a number
// looks in it is checked in a browser on the bench.
describe('the dot-matrix face', () => {
  it('has glyphs of five cells by seven, and the prototype\'s for the digits', () => {
    for (const [ch, rows] of Object.entries(FONT)) { expect(rows, ch).toHaveLength(7); for (const row of rows) expect(row, ch).toMatch(/^[01]{5}$/); }
    expect(FONT['0']).toEqual(['01110', '10001', '10011', '10101', '11001', '10001', '01110']);
    expect(FONT['7']).toEqual(['11111', '00001', '00010', '00100', '01000', '01000', '01000']);
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
  it('lights a glyph\'s cells as shadows a whole number of cells apart, one rule a character', () => {
    // The first column is a cell from where the shadows start, because a box hides a shadow under it.
    expect(DOTS_CSS).toContain('.uav-glyph-run i[data-ch="-"]::before, .uav-glyph-run i[data-was="-"]::after { box-shadow: calc(var(--uav-u) * 1) calc(var(--uav-u) * 3), calc(var(--uav-u) * 2) calc(var(--uav-u) * 3), calc(var(--uav-u) * 3) calc(var(--uav-u) * 3), calc(var(--uav-u) * 4) calc(var(--uav-u) * 3), calc(var(--uav-u) * 5) calc(var(--uav-u) * 3); }');
    // A point is set back a cell and advances by four.
    expect(DOTS_CSS).toContain('.uav-glyph-run i[data-ch="."]::before, .uav-glyph-run i[data-was="."]::after { box-shadow: calc(var(--uav-u) * 1) calc(var(--uav-u) * 5), calc(var(--uav-u) * 2) calc(var(--uav-u) * 5), calc(var(--uav-u) * 1) calc(var(--uav-u) * 6), calc(var(--uav-u) * 2) calc(var(--uav-u) * 6); }');
    expect(DOTS_CSS).toContain('.uav-glyph-run i[data-ch="."] { inline-size: calc(var(--uav-u) * 4); }');
    for (const ch of Object.keys(FONT)) if (ch !== ' ') expect(DOTS_CSS, ch).toContain(`.uav-glyph-run i[data-ch="${ch}"]::before, .uav-glyph-run i[data-was="${ch}"]::after { box-shadow:`);
    expect(DOTS_CSS).not.toContain('i[data-ch=" "]::before');
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
    expect(DOTS_CSS).not.toMatch(/color-screen|elevation-screen|radius-screen|padding/);
    expect(DOTS_CSS).not.toContain('tight');
  });
  it('runs the number along the screen under the pointer, a cell at a time, and shows its end at once with reduced motion', () => {
    expect(DOTS_CSS).toContain('.uav-glyph-run { display: flex; flex: none; min-inline-size: 100%; position: relative; left: round(to-zero, calc(var(--uav-s, 0) * 100%), var(--uav-u)); translate: round(to-zero, calc(var(--uav-s, 0) * -100%), var(--uav-u)) 0; }');
    expect(DOTS_CSS).toContain('.uav-glyphs:hover .uav-glyph-run { animation: uav-run');
    expect(DOTS_CSS).toContain('@media (prefers-reduced-motion: reduce) { .uav-glyphs:hover .uav-glyph-run { animation: none; --uav-s: 1; } }');
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
  it('moves the old glyph out and the new one in a whole cell a step, each waiting its turn, and not at all with reduced motion', () => {
    expect(DOTS_CSS).toContain('animation: var(--ua-charts-motion-duration-roll, 384ms) steps(8) calc(var(--uav-wait, 0) * var(--ua-charts-motion-duration-roll, 384ms) / 8) both;');
    expect(DOTS_CSS).toContain('@keyframes uav-roll-in-u { from { translate: 0 calc(var(--uav-u) * 8); } to { translate: 0 0; } }');
    expect(DOTS_CSS).toContain('@keyframes uav-roll-out-d { from { translate: 0 0; } to { translate: 0 calc(var(--uav-u) * 8); } }');
    // Outside the motion query the old glyph is not drawn, so the new one simply stands.
    expect(DOTS_CSS).toMatch(/\.uav-glyph-run i\[data-roll\]::after \{ display: none; \}\n@media \(prefers-reduced-motion: no-preference\)/);
    expect(DOTS_CSS).toContain('overflow: hidden; }');
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
