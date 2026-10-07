import { describe, it, expect } from 'vitest';
import { contrast } from '@adobe/leonardo-contrast-colors';
import {
  hexToDTCGColor,
  getHexValue,
  getContrastValue,
  buildColorObjects,
  findSurfaceColor,
} from '../packages/tokens/src/leonardo.ts';

describe('hexToDTCGColor', () => {
  it('converts #000000 to DTCG with zero components', () => {
    const result = hexToDTCGColor('#000000');
    expect(result.colorSpace).toBe('srgb');
    expect(result.components).toEqual([0, 0, 0]);
    expect(result.alpha).toBe(1);
    expect(result.hex).toBe('#000000');
  });

  it('converts #ffffff to DTCG with 1.0 components', () => {
    const result = hexToDTCGColor('#ffffff');
    expect(result.components).toEqual([1, 1, 1]);
  });

  it('converts a color hex to normalized components', () => {
    const result = hexToDTCGColor('#ff8000');
    expect(result.components[0]).toBe(1);
    expect(result.components[1]).toBeCloseTo(0.502, 2);
    expect(result.components[2]).toBe(0);
  });

  it('expands 3-digit hex shorthand', () => {
    const result = hexToDTCGColor('#f80');
    expect(result.components[0]).toBe(1);
    expect(result.components[1]).toBeCloseTo(0.5333, 2);
    expect(result.components[2]).toBe(0);
    expect(result.hex).toBe('#f80');
  });

  it('rounds components to 4 decimal places', () => {
    const result = hexToDTCGColor('#123456');
    for (const c of result.components) {
      const decimals = c.toString().split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(4);
    }
  });

  it('always sets alpha to 1', () => {
    expect(hexToDTCGColor('#abcdef').alpha).toBe(1);
  });

  it('preserves original hex in output', () => {
    expect(hexToDTCGColor('#AABBCC').hex).toBe('#AABBCC');
  });
});

describe('getHexValue', () => {
  it('returns string input directly', () => {
    expect(getHexValue('#ff0000')).toBe('#ff0000');
  });

  it('returns .value from object input', () => {
    expect(getHexValue({ value: '#00ff00', contrast: 4.5 })).toBe('#00ff00');
  });
});

describe('getContrastValue', () => {
  it('returns undefined for string input', () => {
    expect(getContrastValue('#ff0000')).toBeUndefined();
  });

  it('returns .contrast from object input', () => {
    expect(getContrastValue({ value: '#ff0000', contrast: 4.5 })).toBe(4.5);
  });

  it('returns undefined when contrast is missing from object', () => {
    expect(getContrastValue({ value: '#ff0000' })).toBeUndefined();
  });
});

describe('buildColorObjects', () => {
  const colorDefs = [
    {
      name: 'Gray',
      colorKeys: ['#808080'],
      ratios: [1, 2, 3],
      colorspace: 'RGB',
      smooth: false,
    },
    {
      name: 'Brand Blue',
      colorKeys: ['#0000ff'],
      ratios: [3, 4.5],
      colorspace: 'OKLCH',
      smooth: true,
    },
  ];

  it('uses first definition as background when no name provided', () => {
    const result = buildColorObjects(colorDefs);
    expect(result.colorNames).toEqual(['gray', 'brand-blue']);
    expect(result.fgColors).toHaveLength(1);
  });

  it('identifies background color by name (case-insensitive)', () => {
    const result = buildColorObjects(colorDefs, 'Brand Blue');
    expect(result.fgColors).toHaveLength(1);
  });

  it('falls back to first definition when name not found', () => {
    const result = buildColorObjects(colorDefs, 'Nonexistent');
    expect(result.fgColors).toHaveLength(1);
  });

  it('normalizes color names to lowercase hyphenated', () => {
    const result = buildColorObjects(colorDefs);
    expect(result.colorNames).toContain('brand-blue');
    expect(result.colorNames).toContain('gray');
  });
});

describe('findSurfaceColor', () => {
  const { fgColors } = buildColorObjects(
    [
      { name: 'Neutral', colorKeys: ['#808080'], ratios: [1], colorspace: 'RGB', smooth: false },
      { name: 'Orange', colorKeys: ['#ff6a00'], ratios: [3], colorspace: 'OKLCH', smooth: true },
    ],
    'Neutral',
  );
  const orange = fgColors[0];
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const lcUnderWhite = (hex: string) =>
    Math.abs(contrast(rgb('#ffffff'), rgb(hex), undefined, 'wcag3'));

  it('returns the lightest swatch where the text reaches the target Lc', () => {
    const hex = findSurfaceColor(orange, '#ffffff', 75);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(lcUnderWhite(hex)).toBeGreaterThanOrEqual(75);
    // One swatch lighter falls short, so this is the first that qualifies.
    const scale = orange.colorScale as unknown as (i: number) => string;
    const i = Array.from({ length: 3001 }, (_, n) => scale(n)).indexOf(hex);
    expect(i).toBeGreaterThan(0);
    expect(lcUnderWhite(scale(i - 1))).toBeLessThan(75);
  });

  it('darkens as the target rises', () => {
    const at75 = findSurfaceColor(orange, '#ffffff', 75);
    const at85 = findSurfaceColor(orange, '#ffffff', 85);
    expect(lcUnderWhite(at85)).toBeGreaterThan(lcUnderWhite(at75));
  });

  it('throws when no swatch on the scale reaches the target', () => {
    expect(() => findSurfaceColor(orange, '#ff6a00', 90)).toThrow(/Lc 90/);
  });
});
