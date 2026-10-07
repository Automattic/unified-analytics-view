/**
 * Utopia Token Generator
 *
 * Generates W3C DTCG tokens for fluid typography and spacing using utopia-core.
 */

import { calculateTypeScale, calculateSpaceScale, calculateClamp } from 'utopia-core';
import * as fs from 'fs';
import * as path from 'path';

export interface UtopiaConfig {
  viewport: {
    min: number;
    max: number;
    /** What the clamp tracks. A view is sized by its host, so this repo uses `container` (cqi). */
    relativeTo?: 'viewport' | 'container';
  };
  typeScale: {
    minFontSize: number;
    maxFontSize: number;
    minRatio: number;
    maxRatio: number;
    positiveSteps: number;
    negativeSteps: number;
  };
  spaceScale: {
    positiveSteps: number[];
    negativeSteps: number[];
    customPairs: string[];
  };
  /** Control heights as multiples of the base font size (fluid, like space). */
  sizeScale: {
    description?: string;
    steps: Record<string, number>;
  };
}

interface TypeStep {
  step: number;
  minFontSize: number;
  maxFontSize: number;
  clamp: string;
  wcagViolation?: {
    from: number;
    to: number;
  };
}

interface SpaceSize {
  label: string;
  minSize: number;
  maxSize: number;
  clamp: string;
}

interface SizeStep extends SpaceSize {
  multiplier: number;
}

/** WCAG 2.5.8: no control step may fall under the 24px pointer target at any viewport. */
export const WCAG_TARGET_PX = 24;

/** DTCG dimension value: { value: number, unit: "px" } */
interface DTCGDimensionValue {
  value: number;
  unit: 'px';
}

/** Round to 2 decimal places */
const round2 = (n: number) => Math.round(n * 100) / 100;

// Map step numbers to common semantic names
const typeStepNames: Record<number, string> = {
  [-5]: '4xs',
  [-4]: '3xs',
  [-3]: '2xs',
  [-2]: 'xs',
  [-1]: 'sm',
  [0]: 'base',
  [1]: 'lg',
  [2]: 'xl',
  [3]: '2xl',
  [4]: '3xl',
  [5]: '4xl',
  [6]: '5xl',
};

/**
 * Generate typography tokens in W3C DTCG format (fluid clamp values)
 */
export function generateTypographyTokens(config: UtopiaConfig): Record<string, unknown> {
  const typeScale = calculateTypeScale({
    minWidth: config.viewport.min,
    maxWidth: config.viewport.max,
    relativeTo: config.viewport.relativeTo,
    minFontSize: config.typeScale.minFontSize,
    maxFontSize: config.typeScale.maxFontSize,
    minTypeScale: config.typeScale.minRatio,
    maxTypeScale: config.typeScale.maxRatio,
    positiveSteps: config.typeScale.positiveSteps,
    negativeSteps: config.typeScale.negativeSteps,
  }) as TypeStep[];

  const tokens: Record<string, unknown> = {
    font: {
      size: {
        $type: 'dimension',
        $description: `Fluid type scale (${config.viewport.min}px → ${config.viewport.max}px)`,
      },
    },
  };

  const sizeTokens = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;

  for (const step of typeScale) {
    const name = typeStepNames[step.step] || `step-${step.step}`;
    const description = `${step.minFontSize.toFixed(2)}px → ${step.maxFontSize.toFixed(2)}px`;

    const token: Record<string, unknown> = {
      $value: step.clamp,
      $description: description,
    };

    if (step.wcagViolation) {
      token.$extensions = {
        'com.utopia': {
          wcagViolation: {
            from: step.wcagViolation.from,
            to: step.wcagViolation.to,
          },
        },
      };
    }

    sizeTokens[name] = token;
  }

  return tokens;
}

/**
 * Generate static typography tokens at a specific viewport (min or max)
 */
export function generateStaticTypographyTokens(
  config: UtopiaConfig,
  viewport: 'min' | 'max',
): Record<string, unknown> {
  const typeScale = calculateTypeScale({
    minWidth: config.viewport.min,
    maxWidth: config.viewport.max,
    relativeTo: config.viewport.relativeTo,
    minFontSize: config.typeScale.minFontSize,
    maxFontSize: config.typeScale.maxFontSize,
    minTypeScale: config.typeScale.minRatio,
    maxTypeScale: config.typeScale.maxRatio,
    positiveSteps: config.typeScale.positiveSteps,
    negativeSteps: config.typeScale.negativeSteps,
  }) as TypeStep[];

  const viewportWidth = config.viewport[viewport];

  const tokens: Record<string, unknown> = {
    font: {
      size: {
        $type: 'dimension',
        $description: `Static type scale at ${viewportWidth}px viewport`,
      },
    },
  };

  const sizeTokens = (tokens.font as Record<string, unknown>).size as Record<string, unknown>;

  for (const step of typeScale) {
    const name = typeStepNames[step.step] || `step-${step.step}`;
    const pxValue = viewport === 'min' ? step.minFontSize : step.maxFontSize;

    sizeTokens[name] = {
      $value: { value: round2(pxValue), unit: 'px' } as DTCGDimensionValue,
      $description: `${round2(pxValue)}px at ${viewportWidth}px viewport`,
    };
  }

  return tokens;
}

/**
 * Calculate the space scale from config (shared by fluid and static generators)
 */
export function calculateSpaces(config: UtopiaConfig) {
  return calculateSpaceScale({
    minWidth: config.viewport.min,
    maxWidth: config.viewport.max,
    relativeTo: config.viewport.relativeTo,
    minSize: config.typeScale.minFontSize, // Base matches type scale for harmony
    maxSize: config.typeScale.maxFontSize,
    positiveSteps: config.spaceScale.positiveSteps,
    negativeSteps: config.spaceScale.negativeSteps,
    customSizes: config.spaceScale.customPairs,
  });
}

/**
 * All space entries (sizes + oneUpPairs + customPairs) from a space scale
 */
export function allSpaceEntries(spaceScale: ReturnType<typeof calculateSpaces>): SpaceSize[] {
  return [
    ...(spaceScale.sizes as SpaceSize[]),
    ...(spaceScale.oneUpPairs as SpaceSize[]),
    ...(spaceScale.customPairs as SpaceSize[]),
  ];
}

/**
 * Generate spacing tokens in W3C DTCG format (fluid clamp values)
 */
export function generateSpacingTokens(config: UtopiaConfig): Record<string, unknown> {
  const spaceScale = calculateSpaces(config);

  const tokens: Record<string, unknown> = {
    space: {
      $type: 'dimension',
      $description: `Fluid space scale (${config.viewport.min}px → ${config.viewport.max}px)`,
    },
  };

  const spaceTokens = tokens.space as Record<string, unknown>;

  for (const entry of allSpaceEntries(spaceScale)) {
    spaceTokens[entry.label] = {
      $value: entry.clamp,
      $description: `${entry.minSize.toFixed(2)}px → ${entry.maxSize.toFixed(2)}px`,
    };
  }

  return tokens;
}

/**
 * Generate static spacing tokens at a specific viewport (min or max)
 */
export function generateStaticSpacingTokens(
  config: UtopiaConfig,
  viewport: 'min' | 'max',
): Record<string, unknown> {
  const spaceScale = calculateSpaces(config);
  const viewportWidth = config.viewport[viewport];

  const tokens: Record<string, unknown> = {
    space: {
      $type: 'dimension',
      $description: `Static space scale at ${viewportWidth}px viewport`,
    },
  };

  const spaceTokens = tokens.space as Record<string, unknown>;

  for (const entry of allSpaceEntries(spaceScale)) {
    const pxValue = viewport === 'min' ? entry.minSize : entry.maxSize;

    spaceTokens[entry.label] = {
      $value: { value: round2(pxValue), unit: 'px' } as DTCGDimensionValue,
      $description: `${round2(pxValue)}px at ${viewportWidth}px viewport`,
    };
  }

  return tokens;
}

/**
 * Calculate the control size scale: each step is a multiple of the type-scale
 * base, run through Utopia's clamp like a space step. Throws if a step's
 * narrowest value is under the WCAG pointer target.
 */
export function calculateSizes(config: UtopiaConfig): SizeStep[] {
  const { min: minWidth, max: maxWidth } = config.viewport;
  const { minFontSize, maxFontSize } = config.typeScale;
  return Object.entries(config.sizeScale.steps).map(([label, multiplier]) => {
    const minSize = round2(minFontSize * multiplier);
    const maxSize = round2(maxFontSize * multiplier);
    if (minSize < WCAG_TARGET_PX) {
      throw new Error(
        `sizeScale.${label} is ${minSize}px at the narrowest viewport, under the ${WCAG_TARGET_PX}px WCAG 2.5.8 pointer target`,
      );
    }
    return {
      label,
      multiplier,
      minSize,
      maxSize,
      clamp: calculateClamp({ minWidth, maxWidth, minSize, maxSize, relativeTo: config.viewport.relativeTo }),
    };
  });
}

/** Figma scope for a size step: it is only ever a width or height. */
const sizeExtensions = { 'com.figma.scopes': ['WIDTH_HEIGHT'] };

/**
 * Generate control size tokens in W3C DTCG format (fluid clamp values)
 */
export function generateSizeTokens(config: UtopiaConfig): Record<string, unknown> {
  const size: Record<string, unknown> = {
    $type: 'dimension',
    $description: `Fluid control size scale (${config.viewport.min}px → ${config.viewport.max}px): multiples of the base font size, so a control scales with the type beside it`,
  };
  for (const step of calculateSizes(config)) {
    size[step.label] = {
      $value: step.clamp,
      $description: `${step.multiplier}× base font: ${step.minSize.toFixed(2)}px → ${step.maxSize.toFixed(2)}px`,
      $extensions: sizeExtensions,
    };
  }
  return { size };
}

/**
 * Generate static control size tokens at a specific viewport (min or max)
 */
export function generateStaticSizeTokens(
  config: UtopiaConfig,
  viewport: 'min' | 'max',
): Record<string, unknown> {
  const viewportWidth = config.viewport[viewport];
  const size: Record<string, unknown> = {
    $type: 'dimension',
    $description: `Static control size scale at ${viewportWidth}px viewport`,
  };
  for (const step of calculateSizes(config)) {
    const pxValue = viewport === 'min' ? step.minSize : step.maxSize;
    size[step.label] = {
      $value: { value: pxValue, unit: 'px' } as DTCGDimensionValue,
      $description: `${pxValue}px at ${viewportWidth}px viewport`,
      $extensions: sizeExtensions,
    };
  }
  return { size };
}

/**
 * Merge multiple token objects into one (shallow spread of top-level keys)
 */
export function mergeTokens(...objects: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const obj of objects) {
    Object.assign(merged, obj);
  }
  return merged;
}

/**
 * Main generation function
 *
 * Returns token data without writing files — the orchestrator handles output.
 */
export async function generateUtopiaTokens(configPath: string): Promise<{
  fluid: Record<string, unknown>;
  min: Record<string, unknown>;
  max: Record<string, unknown>;
}> {
  // Read config
  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config: UtopiaConfig = JSON.parse(configContent);

  console.log(`  Viewport: ${config.viewport.min}px → ${config.viewport.max}px`);
  console.log(`  Type scale: ${config.typeScale.minRatio} → ${config.typeScale.maxRatio}`);

  // Fluid tokens (clamp values for production CSS)
  const fluid = mergeTokens(
    generateTypographyTokens(config),
    generateSpacingTokens(config),
    generateSizeTokens(config),
  );

  // Static tokens at min viewport (for Figma/design tools)
  const min = mergeTokens(
    generateStaticTypographyTokens(config, 'min'),
    generateStaticSpacingTokens(config, 'min'),
    generateStaticSizeTokens(config, 'min'),
  );

  // Static tokens at max viewport (for Figma/design tools)
  const max = mergeTokens(
    generateStaticTypographyTokens(config, 'max'),
    generateStaticSpacingTokens(config, 'max'),
    generateStaticSizeTokens(config, 'max'),
  );

  return { fluid, min, max };
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = path.resolve(process.cwd(), 'config/utopia.json');

  generateUtopiaTokens(configPath)
    .then(() => console.log('Utopia tokens generated successfully'))
    .catch((err) => {
      console.error('Failed to generate Utopia tokens:', err);
      process.exit(1);
    });
}
