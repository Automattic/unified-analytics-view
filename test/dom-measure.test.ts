import { describe, expect, it } from 'vitest';
import { fitNumber, thin, type NumberSizes } from '../packages/dom/src/measure.ts';

// The measured pass's decisions are functions of sizes, so they are held here with no DOM. The reading of the
// sizes, and that the pass settles at every width and height, is checked in a browser on the bench.

// About what a browser gives "10,482" and "10.5k" with a delta and a note.
const sizes: NumberSizes = {
  forms: [{ fit: '', inline: 130, block: 52 }, { fit: 'short', inline: 105, block: 52 }, { fit: 'small short', inline: 74, block: 42 }],
  delta: 190, note: { inline: 100, block: 16 },
};
const at = (inline: number, block: number | null = null) => fitNumber({ inline, block }, sizes);

describe('fitNumber', () => {
  it('takes the fullest form whose value fits, and falls to prose when none does', () => {
    expect(at(346)).toBe('');
    expect(at(170)).toBe('delta-short');
    expect(at(120)).toBe('short delta-short');
    expect(at(104)).toBe('small short delta-short');
    expect(at(80)).toBe('small short delta-short no-note');
    expect(at(73)).toBeNull();
  });

  it('keeps the note only while it fits whole, and the long delta likewise', () => {
    expect(at(100)).not.toContain('no-note');
    expect(at(99)).toContain('no-note');
    expect(at(190)).toBe('');
    expect(at(189)).toBe('delta-short');
  });

  it('gives up the note before the number when a box it was handed is too short, and never at natural height', () => {
    expect(at(346, 68)).toBe('');
    expect(at(346, 67)).toBe('no-note');               // 52 and a 16 px note
    expect(at(346, 52)).toBe('no-note');
    expect(at(346, 51)).toBeNull();
    expect(at(120, 60)).toBe('short delta-short no-note');
    expect(at(104, 58)).toBe('small short delta-short');
    expect(at(104, 57)).toBe('small short delta-short no-note');
    expect(at(80, 60)).toBe('small short delta-short no-note');
    expect(at(80, 41)).toBeNull();
  });

  it('once it has gone to prose while narrowing in a 60 or a 40 px box, stays there', () => {
    for (const block of [60, 40]) {
      let prose = false;
      for (let w = 420; w >= 40; w--) { const fit = at(w, block); if (prose) expect(fit).toBeNull(); prose = fit == null; }
      expect(prose).toBe(true);
    }
    expect(at(420, 40)).toBeNull();
    expect(at(74, 60)).not.toBeNull();
  });

  it('says nothing of a delta or a note the number does not have', () => {
    expect(fitNumber({ inline: 20 }, { forms: [{ fit: '', inline: 20, block: 34 }], delta: null, note: null })).toBe('');
  });

  it('is the same whichever way the size was reached', () => {
    for (const block of [null, 60, 40]) {
      const down: (string | null)[] = [], up: (string | null)[] = [];
      for (let w = 420; w >= 40; w--) down.push(at(w, block));
      for (let w = 40; w <= 420; w++) up.push(at(w, block));
      expect(up.reverse()).toEqual(down);
    }
  });
});

describe('thin', () => {
  const row = (width: number, ...centres: number[]) => centres.map((c) => ({ lo: c - width / 2, hi: c + width / 2 }));

  it('gives up nothing while the labels stand clear', () => {
    expect(thin(row(30, 0, 50, 100))).toEqual([false, false, false]);
    expect(thin([])).toEqual([]);
  });

  it('gives up a ranked label before an unranked one', () => {
    const [a, b, c] = row(40, 0, 40, 80);
    expect(thin([a!, { ...b!, rank: 1 }, c!])).toEqual([false, true, false]);
    expect(thin([{ ...a!, rank: 1 }, b!, { ...c!, rank: 1 }])).toEqual([true, false, true]);
  });

  it('keeps both ends, then every label that clears the ones kept', () => {
    expect(thin(row(30, 0, 20, 40, 60, 80, 100))).toEqual([false, true, false, true, true, false]);
  });

  it('counts a gap narrower than the least as a collision', () => {
    expect(thin(row(30, 0, 35))).toEqual([false, true]);
    expect(thin(row(30, 0, 36))).toEqual([false, false]);
  });
});
