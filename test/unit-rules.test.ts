import { describe, expect, it } from 'vitest';
import { UNIT_CELLS, UNIT_MOST, UNIT_SEATS, unitCount, unitSeats, unitShares, unitWorth } from '@unified-analytics/core';

// Step 6 of docs/uncommon-coverage-plan.md: the arithmetic of the `unit` mark, each rule tested where it is written
// (packages/core/src/unit.ts). None of it takes a size: a scene is in ratios, so a glyph's worth comes from the data.
const sum = (ns: number[]) => ns.reduce((s, n) => s + n, 0);

describe('what a glyph is worth', () => {
  it('is the least of 1, 2 and 5 times a power of ten at which the largest value is ten glyphs or fewer', () => {
    expect([UNIT_MOST, UNIT_CELLS, UNIT_SEATS]).toEqual([10, 100, 100]);
    expect([7, 10, 11, 20, 21, 50, 51, 100, 101, 999, 1000, 1001, 4820, 25100, 1e6].map((n) => unitWorth(n))).toEqual([1, 1, 2, 2, 5, 5, 10, 10, 20, 100, 100, 200, 500, 5000, 100000]);
    // So the largest value is drawn as more than four glyphs and no more than ten, whatever it is.
    for (const most of [11, 37, 250, 251, 1234, 99999, 123456789]) { const n = most / unitWorth(most); expect(n > 4 && n <= 10, String(most)).toBe(true); }
  });
  it('is under one for a metric that is, and never for a count: half a visitor is not drawn', () => {
    expect([0.039, 0.5, 1, 3.4, 8].map((n) => unitWorth(n))).toEqual([0.005, 0.05, 0.1, 0.5, 1]);
    expect([0.039, 0.5, 1, 3.4, 8].map((n) => unitWorth(n, 10, true))).toEqual([1, 1, 1, 1, 1]);
  });
  it('takes the cap it is handed: a hundred seats where a stack has ten glyphs', () => {
    expect([7, 100, 101, 250, 10531, 650].map((n) => unitWorth(n, UNIT_SEATS, true))).toEqual([1, 1, 2, 5, 200, 10]);
  });
  it('is one where there is nothing to draw, and never NaN', () => {
    expect([0, -5, NaN, Infinity].map((n) => unitWorth(n))).toEqual([1, 1, 1, 1]);
  });
});

describe('the glyphs a value is drawn as', () => {
  it('are whole: rounded to the nearest, and one at least for a value above nothing', () => {
    expect([4820, 4749, 4750, 2610, 500, 251, 249, 120, 1, 0].map((v) => unitCount(v, 500, 'It'))).toEqual([10, 9, 10, 5, 1, 1, 1, 1, 1, 0]);
  });
  it('are never fewer than none: a value below zero is refused, and the error names the value and the fix', () => {
    expect(() => unitCount(-3, 1, 'The value of "net" for "Mon"')).toThrow('The value of "net" for "Mon" is -3, and a "unit" draws a value as a count of glyphs, which cannot be fewer than none. Use "bar" for a metric that falls below zero: its bar hangs from the zero line.');
  });
});

describe('a hundred cells, shared out by largest remainder', () => {
  it('sum to a hundred where the values make up the total, whatever their shares round to', () => {
    expect(unitShares([52, 41, 7], 100)).toEqual([52, 41, 7]);
    expect(unitShares([1, 1, 1], 3)).toEqual([34, 33, 33]);                   // the first of equal remainders takes the cell
    expect(unitShares([5476, 4318, 737], 10531)).toEqual([52, 41, 7]);
    expect(unitShares([415, 415, 170], 1000)).toEqual([42, 41, 17]);          // 41.5, 41.5 and 17: one of the halves is rounded down
    for (const values of [[1, 2, 3, 4, 5, 6, 7], [998, 1, 1], [33.3, 33.3, 33.4], [0.5, 0.25, 0.25]]) expect(sum(unitShares(values, sum(values))), String(values)).toBe(100);
  });
  it('divide by the total it is handed, so the rows past a limit leave cells that are no value\'s', () => {
    // Two of six channels: 41% and 28% of the engine's total, and 31 cells that are the rest's.
    expect(unitShares([4318, 2949], 10531)).toEqual([41, 28]);
    // The rest takes its share of the remainders too: 33.4 and 33.4 leave 33.2, and the hundredth cell goes to the first.
    expect(unitShares([334, 334], 1000)).toEqual([34, 33]);
  });
  it('a value of nothing has no cell, and one too small for a cell has none either', () => {
    expect(unitShares([997, 3, 0], 1000)).toEqual([100, 0, 0]);
  });
  it('with no total, or one of zero, nothing is a share: no value has a cell, and the values are never summed to make one', () => {
    expect(unitShares([12, 5], null)).toEqual([0, 0]);
    expect(unitShares([12, 5], undefined)).toEqual([0, 0]);
    expect(unitShares([12, 5], 0)).toEqual([0, 0]);
  });
  it('shares any number of cells, which is how seats are shared among rings', () => {
    expect(unitShares([9, 13, 16, 19], 57, 53)).toEqual([8, 12, 15, 18]);
    expect(sum(unitShares([9, 13, 16, 19], 57, 53))).toBe(53);
  });
});

describe('seats round a half circle', () => {
  const far = (a: { a: number; r: number }, b: { a: number; r: number }) => Math.hypot(a.r * Math.cos(Math.PI * a.a) - b.r * Math.cos(Math.PI * b.a), a.r * Math.sin(Math.PI * a.a) - b.r * Math.sin(Math.PI * b.a));
  it('stand in as few rings as hold them, so a seat is as large as the count allows', () => {
    expect([1, 3, 4, 13, 14, 53, 100, 150].map((n) => Math.round(0.6 / unitSeats(n).pitch))).toEqual([1, 1, 2, 2, 3, 4, 6, 7]);
    for (const n of [0, 1, 2, 5, 53, 100, 150, 400]) expect(unitSeats(n).seats.length, String(n)).toBe(n);
  });
  it('run from the left end to the right, inside the half ring, and no two in each other\'s room', () => {
    for (const n of [1, 2, 5, 13, 53, 100, 150, 400]) {
      const { seats, pitch } = unitSeats(n);
      expect(seats.map((s) => s.a), String(n)).toEqual(seats.map((s) => s.a).sort((a, b) => a - b));
      for (const s of seats) expect(s.a > 0 && s.a < 1 && s.r - pitch / 2 >= 0.4 - 1e-9 && s.r + pitch / 2 <= 1 + 1e-9, n + ' ' + JSON.stringify(s)).toBe(true);
      // A chord is a little shorter than its arc, so two seats of the innermost ring are a hair nearer than a pitch.
      for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length; j++) expect(far(seats[i]!, seats[j]!), n + ': ' + i + ' and ' + j).toBeGreaterThan(pitch * 0.9);
      // No seat hangs below the foot of the half circle by more than a hair.
      for (const s of seats) expect(s.r * Math.sin(Math.PI * s.a), n + ' ' + JSON.stringify(s)).toBeGreaterThan(pitch * 0.45);
    }
  });
  it('a ring has seats by its length, and the same count always stands the same way', () => {
    const rings = (n: number) => { const by = new Map<number, number>(); for (const s of unitSeats(n).seats) by.set(s.r, (by.get(s.r) ?? 0) + 1); return [...by].sort((a, b) => a[0] - b[0]).map(([, c]) => c); };
    expect(rings(53)).toEqual([8, 12, 15, 18]);
    expect(rings(100)).toEqual([11, 13, 16, 18, 20, 22]);
    expect(unitSeats(53)).toEqual(unitSeats(53));
  });
});
