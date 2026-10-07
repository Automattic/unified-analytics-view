import { describe, it, expect } from 'vitest';
import {
  generateTypographyTokens,
  generateStaticTypographyTokens,
  calculateSpaces,
  allSpaceEntries,
  generateSpacingTokens,
  generateStaticSpacingTokens,
  generateSizeTokens,
  generateStaticSizeTokens,
  mergeTokens,
} from '../packages/tokens/src/utopia.ts';
import type { UtopiaConfig } from '../packages/tokens/src/utopia.ts';

const baseConfig: UtopiaConfig = {
  viewport: { min: 320, max: 1240 },
  typeScale: {
    minFontSize: 16,
    maxFontSize: 20,
    minRatio: 1.2,
    maxRatio: 1.333,
    positiveSteps: 3,
    negativeSteps: 2,
  },
  spaceScale: {
    positiveSteps: [1.5, 2, 3],
    negativeSteps: [0.75, 0.5],
    customPairs: [],
  },
  sizeScale: { steps: { sm: 1.5, md: 2 } },
};

// ── generateTypographyTokens ─────────────────────────────────────────

describe('generateTypographyTokens', () => {
  it('produces a font.size group with $type dimension', () => {
    const tokens = generateTypographyTokens(baseConfig);
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    expect(fontSize.$type).toBe('dimension');
  });

  it('maps step 0 to "base" name', () => {
    const tokens = generateTypographyTokens(baseConfig);
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    expect(fontSize).toHaveProperty('base');
  });

  it('maps negative steps to semantic names (sm, xs, etc.)', () => {
    const tokens = generateTypographyTokens(baseConfig);
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    expect(fontSize).toHaveProperty('sm');
    expect(fontSize).toHaveProperty('xs');
  });

  it('maps positive steps to semantic names (lg, xl, etc.)', () => {
    const tokens = generateTypographyTokens(baseConfig);
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    expect(fontSize).toHaveProperty('lg');
    expect(fontSize).toHaveProperty('xl');
    expect(fontSize).toHaveProperty('2xl');
  });

  it('produces clamp() strings as $value', () => {
    const tokens = generateTypographyTokens(baseConfig);
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    const baseToken = fontSize.base as Record<string, unknown>;
    expect(typeof baseToken.$value).toBe('string');
    expect((baseToken.$value as string).startsWith('clamp(')).toBe(true);
  });

  it('includes $description with min→max px range', () => {
    const tokens = generateTypographyTokens(baseConfig);
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    const baseToken = fontSize.base as Record<string, unknown>;
    expect(baseToken.$description).toMatch(/\d+\.\d+px → \d+\.\d+px/);
  });
});

// ── generateStaticTypographyTokens ───────────────────────────────────

describe('generateStaticTypographyTokens', () => {
  it('produces {value, unit} dimension objects for min viewport', () => {
    const tokens = generateStaticTypographyTokens(baseConfig, 'min');
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    const baseToken = fontSize.base as Record<string, unknown>;
    const value = baseToken.$value as { value: number; unit: string };
    expect(value).toHaveProperty('value');
    expect(value).toHaveProperty('unit', 'px');
    expect(typeof value.value).toBe('number');
  });

  it('produces {value, unit} dimension objects for max viewport', () => {
    const tokens = generateStaticTypographyTokens(baseConfig, 'max');
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    const baseToken = fontSize.base as Record<string, unknown>;
    const value = baseToken.$value as { value: number; unit: string };
    expect(value.value).toBeGreaterThanOrEqual(baseConfig.typeScale.maxFontSize);
  });

  it('includes $description with px at viewport', () => {
    const tokens = generateStaticTypographyTokens(baseConfig, 'min');
    const fontSize = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;
    const baseToken = fontSize.base as Record<string, unknown>;
    expect(baseToken.$description).toContain(`${baseConfig.viewport.min}px viewport`);
  });
});

// ── calculateSpaces / allSpaceEntries ────────────────────────────────

describe('calculateSpaces', () => {
  it('returns an object with sizes, oneUpPairs, and customPairs', () => {
    const result = calculateSpaces(baseConfig);
    expect(result).toHaveProperty('sizes');
    expect(result).toHaveProperty('oneUpPairs');
    expect(result).toHaveProperty('customPairs');
  });
});

describe('allSpaceEntries', () => {
  it('combines sizes, oneUpPairs, and customPairs', () => {
    const spaceScale = calculateSpaces(baseConfig);
    const entries = allSpaceEntries(spaceScale);
    const totalExpected =
      (spaceScale.sizes as unknown[]).length +
      (spaceScale.oneUpPairs as unknown[]).length +
      (spaceScale.customPairs as unknown[]).length;
    expect(entries).toHaveLength(totalExpected);
  });

  it('each entry has label, minSize, maxSize, and clamp', () => {
    const spaceScale = calculateSpaces(baseConfig);
    const entries = allSpaceEntries(spaceScale);
    for (const entry of entries) {
      expect(entry).toHaveProperty('label');
      expect(entry).toHaveProperty('minSize');
      expect(entry).toHaveProperty('maxSize');
      expect(entry).toHaveProperty('clamp');
    }
  });
});

// ── generateSpacingTokens ────────────────────────────────────────────

describe('generateSpacingTokens', () => {
  it('produces a space group with $type dimension', () => {
    const tokens = generateSpacingTokens(baseConfig);
    const space = tokens.space as Record<string, unknown>;
    expect(space.$type).toBe('dimension');
  });

  it('produces clamp() strings as $value', () => {
    const tokens = generateSpacingTokens(baseConfig);
    const space = tokens.space as Record<string, unknown>;
    // Find first non-meta key
    const firstKey = Object.keys(space).find((k) => !k.startsWith('$'));
    expect(firstKey).toBeDefined();
    const token = space[firstKey!] as Record<string, unknown>;
    expect(typeof token.$value).toBe('string');
    expect((token.$value as string).startsWith('clamp(')).toBe(true);
  });

  it('labels tokens from space scale', () => {
    const tokens = generateSpacingTokens(baseConfig);
    const space = tokens.space as Record<string, unknown>;
    const keys = Object.keys(space).filter((k) => !k.startsWith('$'));
    expect(keys.length).toBeGreaterThan(0);
  });
});

// ── generateStaticSpacingTokens ──────────────────────────────────────

describe('generateStaticSpacingTokens', () => {
  it('produces {value, unit} dimension objects for min viewport', () => {
    const tokens = generateStaticSpacingTokens(baseConfig, 'min');
    const space = tokens.space as Record<string, unknown>;
    const firstKey = Object.keys(space).find((k) => !k.startsWith('$'));
    const token = space[firstKey!] as Record<string, unknown>;
    const value = token.$value as { value: number; unit: string };
    expect(value).toHaveProperty('value');
    expect(value).toHaveProperty('unit', 'px');
  });

  it('produces {value, unit} dimension objects for max viewport', () => {
    const tokens = generateStaticSpacingTokens(baseConfig, 'max');
    const space = tokens.space as Record<string, unknown>;
    const firstKey = Object.keys(space).find((k) => !k.startsWith('$'));
    const token = space[firstKey!] as Record<string, unknown>;
    const value = token.$value as { value: number; unit: string };
    expect(value.unit).toBe('px');
    expect(typeof value.value).toBe('number');
  });
});

// ── mergeTokens ──────────────────────────────────────────────────────

describe('mergeTokens', () => {
  it('merges multiple token objects', () => {
    const a = { color: { primary: '#f00' } };
    const b = { space: { sm: '8px' } };
    const result = mergeTokens(a, b);
    expect(result).toEqual({ color: { primary: '#f00' }, space: { sm: '8px' } });
  });

  it('later objects override earlier ones', () => {
    const a = { font: { size: 16 } };
    const b = { font: { size: 20 } };
    const result = mergeTokens(a, b);
    expect(result).toEqual({ font: { size: 20 } });
  });

  it('returns empty object with no arguments', () => {
    const result = mergeTokens();
    expect(result).toEqual({});
  });
});

// ── size scale ───────────────────────────────────────────────────────

type Steps = Record<string, Record<string, unknown>>;

describe('generateSizeTokens', () => {
  it('produces a size group of fluid dimension steps scoped to width/height', () => {
    const size = generateSizeTokens(baseConfig).size as Steps;
    expect(size.$type).toBe('dimension');
    expect(size.sm.$value).toMatch(/^clamp\(/);
    expect(size.sm.$extensions).toEqual({ 'com.figma.scopes': ['WIDTH_HEIGHT'] });
  });

  it('is the base font size times the multiplier at each viewport', () => {
    const min = generateStaticSizeTokens(baseConfig, 'min').size as Steps;
    const max = generateStaticSizeTokens(baseConfig, 'max').size as Steps;
    expect(min.md.$value).toEqual({ value: 32, unit: 'px' });
    expect(max.md.$value).toEqual({ value: 40, unit: 'px' });
  });

  it('refuses a step under the WCAG pointer target at the narrowest viewport', () => {
    const config = { ...baseConfig, sizeScale: { steps: { xs: 1.25 } } };
    expect(() => generateSizeTokens(config)).toThrow(/20px.*24px WCAG/);
  });
});
