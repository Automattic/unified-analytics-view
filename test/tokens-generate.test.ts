import { describe, expect, it } from 'vitest';
import { qualitative, toCustomProperties } from '../packages/tokens/src/generate.ts';

describe('token output', () => {
  const ramps = { $type: 'color', blue: { 500: { $value: { hex: '#123456' } } } };

  it('writes colours as hex, dimensions as given and aliases as var()', () => {
    const set = { color: { qualitative: qualitative(['blue'], 500, ramps) } };
    expect(toCustomProperties({ color: ramps, ...{ space: { s: { $value: 'clamp(1rem, 2cqi, 3rem)' } } } })).toEqual([
      '--ua-color-blue-500: #123456;', '--ua-space-s: clamp(1rem, 2cqi, 3rem);',
    ]);
    expect(toCustomProperties(set)).toEqual(['--ua-color-qualitative-1: var(--ua-color-blue-500);']);
  });

  it('names the ramps to choose from when a series points at none', () => {
    expect(() => qualitative(['teal'], 500, ramps)).toThrow(/Use one of: blue/);
  });
});
