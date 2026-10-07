/**
 * Leonardo Token Generator
 *
 * Loads color definitions from a JS module and generates W3C DTCG color tokens.
 */

import { Color, BackgroundColor, Theme, contrast, type CssColor } from '@adobe/leonardo-contrast-colors';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

// All supported Leonardo interpolation colorspaces
type InterpolationColorspace =
  | 'RGB'
  | 'HSL'
  | 'HSV'
  | 'HSLuv'
  | 'LAB'
  | 'LCH'
  | 'OKLAB'
  | 'OKLCH'
  | 'CAM02'
  | 'CAM02p';

type ContrastFormula = 'wcag2' | 'wcag3';

interface ThemeSettings {
  lightness?: number;
  contrast?: number;
  saturation?: number;
  backgroundColor?: string;
}

interface PastedTheme {
  backgroundColor?: string;
  colors?: string[];
  lightness?: number;
  contrast?: number;
  saturation?: number;
  formula?: string;
}

interface ColorsModuleExport {
  colors: ColorDefinition[];
  theme?: PastedTheme;
}

/** A set of swatches picked for text ON a color rather than the color on the page. */
interface SurfaceConfig {
  /** Hex of the text the swatches must carry. */
  text: string;
  /** APCA Lc targets, lightest first. Emitted as steps 100, 200, … */
  lc: number[];
}

interface LeonardoConfig {
  colors: string;
  formula?: ContrastFormula;
  themes: {
    light: ThemeSettings;
    dark: ThemeSettings;
  };
  /** Keyed by normalized color name (e.g. `brand`). Output group is `color.<name>-surface`. */
  surfaces?: Record<string, SurfaceConfig>;
}

export interface ColorDefinition {
  name: string;
  colorKeys: string[];
  ratios: number[];
  colorspace: string;
  smooth: boolean;
}

interface LeonardoColorValue {
  value: string;
  contrast?: number;
}

interface LeonardoColorGroup {
  name?: string;
  background?: string;
  values?: Array<LeonardoColorValue | string>;
}

export interface DTCGColorValue {
  colorSpace: 'srgb';
  components: [number, number, number];
  alpha: number;
  hex: `#${string}`;
}

interface DTCGColorToken {
  $value: DTCGColorValue;
  $description?: string;
}

/**
 * Build Leonardo Color objects from color definitions.
 * The background color is identified by name (from the pasted Theme block).
 * Falls back to the first definition if no name is provided.
 */
export function buildColorObjects(colorDefs: ColorDefinition[], backgroundName?: string): {
  fgColors: Color[];
  bgColor: BackgroundColor;
  colorNames: string[];
} {
  // Find which definition is the background color
  const normalize = (n: string) => n.toLowerCase().replace(/\s+/g, '-');
  const bgIndex = backgroundName
    ? colorDefs.findIndex((d) => normalize(d.name) === normalize(backgroundName))
    : 0;
  const bgDef = colorDefs[bgIndex >= 0 ? bgIndex : 0];

  const bgColor = new BackgroundColor({
    name: bgDef.name,
    colorKeys: bgDef.colorKeys as CssColor[],
    ratios: bgDef.ratios,
    colorspace: bgDef.colorspace as InterpolationColorspace,
    smooth: bgDef.smooth,
  });

  // Remaining definitions are foreground Colors.
  const fgColors: Color[] = colorDefs
    .filter((_, i) => i !== (bgIndex >= 0 ? bgIndex : 0))
    .map(
      (def) =>
        new Color({
          name: def.name,
          colorKeys: def.colorKeys as CssColor[],
          ratios: def.ratios,
          colorspace: def.colorspace as InterpolationColorspace,
          smooth: def.smooth,
        }),
    );

  const colorNames = colorDefs.map((c) => normalize(c.name));

  return { fgColors, bgColor, colorNames };
}

/**
 * Build a Leonardo Theme with resolved settings.
 */
export function buildTheme(
  fgColors: Color[],
  bgColor: BackgroundColor,
  settings: Required<ThemeSettings>,
  formula: ContrastFormula,
): Theme {
  // Clamp lightness to 0-99: Leonardo's backgroundColorScale has indices 0-99,
  // so lightness=100 causes an out-of-bounds access in chroma-js.
  const lightness = Math.min(Math.max(settings.lightness, 0), 99);

  // Allow overriding the background color used for contrast calculations.
  // When provided, a separate BackgroundColor is created from the given hex.
  // The original bgColor is kept as a foreground Color so its scale is still generated.
  let effectiveBg = bgColor;
  if (settings.backgroundColor) {
    effectiveBg = new BackgroundColor({
      name: 'Background',
      colorKeys: [settings.backgroundColor as CssColor],
      ratios: [],
      colorspace: 'OKLAB' as InterpolationColorspace,
      smooth: false,
    });
  }

  // Leonardo requires the BackgroundColor in the colors array for proper
  // contrast calculations (especially with APCA's polarity-aware formula).
  // When backgroundColor is overridden, include the original bgColor as a
  // foreground Color so its scale is still generated.
  const colors: Array<Color | BackgroundColor> = settings.backgroundColor
    ? [effectiveBg, bgColor, ...fgColors]
    : [effectiveBg, ...fgColors];

  return new Theme({
    colors,
    backgroundColor: effectiveBg,
    lightness,
    contrast: settings.contrast,
    saturation: settings.saturation,
    output: 'HEX',
    formula,
  });
}

/**
 * First swatch on a Color's key-color scale (light to dark) where `text`
 * reaches `lc` APCA contrast ON the swatch.
 *
 * Leonardo's ramps measure each swatch as text on the page, so a step flips
 * lightness between themes. A surface carrying white text needs the opposite
 * polarity, and that number does not depend on the theme because the text
 * does not, so the same hex serves both.
 */
export function findSurfaceColor(color: Color, text: string, lc: number): string {
  const hexToRgb = (hex: string): [number, number, number] =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const textRgb = hexToRgb(text);
  // Leonardo samples its scale at 3000 swatches (see Color._generateColorScale).
  const swatches = 3000;
  const scale = color.colorScale as unknown as (i: number) => string | { hex(): string };
  for (let i = 0; i <= swatches; i++) {
    const swatch = scale(i);
    const hex = typeof swatch === 'string' ? swatch : swatch.hex();
    if (Math.abs(contrast(textRgb, hexToRgb(hex), undefined, 'wcag3')) >= lc) return hex;
  }
  throw new Error(`${color.name}: no swatch reaches APCA Lc ${lc} under ${text} text`);
}

/**
 * Convert a hex color string to a DTCG color value object.
 * Parses #rrggbb (or #rgb) into sRGB components in the 0–1 range.
 */
export function hexToDTCGColor(hex: string): DTCGColorValue {
  // Normalize: strip # and expand shorthand (#abc → aabbcc)
  let h = hex.replace(/^#/, '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }

  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;

  // Round to 4 decimal places to keep files readable
  const round = (n: number) => Math.round(n * 10000) / 10000;

  return {
    colorSpace: 'srgb',
    components: [round(r), round(g), round(b)],
    alpha: 1,
    hex: hex as `#${string}`,
  };
}

/**
 * Extract hex value from Leonardo color value
 */
export function getHexValue(colorValue: LeonardoColorValue | string): string {
  return typeof colorValue === 'string' ? colorValue : colorValue.value;
}

/**
 * Get contrast value from Leonardo color value
 */
export function getContrastValue(colorValue: LeonardoColorValue | string): number | undefined {
  return typeof colorValue === 'object' ? colorValue.contrast : undefined;
}

/**
 * Generate W3C DTCG tokens from Leonardo theme
 */
function generateDTCGTokens(theme: Theme, colorDefs: ColorDefinition[], formula: ContrastFormula): Record<string, unknown> {
  const tokens: Record<string, unknown> = {
    color: {
      $type: 'color',
      $description: 'Color base tokens generated from Leonardo',
    },
  };

  const contrastColors = theme.contrastColors as LeonardoColorGroup[];

  if (!contrastColors || !Array.isArray(contrastColors)) {
    console.warn('Leonardo theme has no contrastColors');
    return tokens;
  }

  // Find ratios from color definitions for descriptions
  const ratiosByName: Record<string, number[]> = {};
  for (const color of colorDefs) {
    ratiosByName[color.name.toLowerCase().replace(/\s+/g, '-')] = color.ratios;
  }

  for (const colorGroup of contrastColors) {
    if (!colorGroup.name || colorGroup.name === 'background') {
      // Skip the background entry — it's Leonardo's internal value used for
      // contrast calculations, not a common semantic token. Common semantic background
      // aliases are defined in config/common.tokens.json instead.
      continue;
    }

    const colorName = colorGroup.name.toLowerCase().replace(/\s+/g, '-');
    const values = colorGroup.values;
    const ratios = ratiosByName[colorName] || [];

    if (!values || !Array.isArray(values)) continue;

    const colorTokens: Record<string, DTCGColorToken> = {};

    values.forEach((colorValue, index) => {
      const hexValue = getHexValue(colorValue);
      const contrast = getContrastValue(colorValue) || ratios[index];

      if (hexValue) {
        const scaleKey = String((index + 1) * 100);
        colorTokens[scaleKey] = {
          $value: hexToDTCGColor(hexValue),
          $description: contrast
            ? formula === 'wcag3'
              ? `APCA Lc: ${Math.round(contrast)}`
              : `Contrast ratio: ${contrast.toFixed(2)}`
            : undefined,
        };
      }
    });

    (tokens.color as Record<string, unknown>)[colorName] = colorTokens;
  }

  return tokens;
}

/**
 * Main generation function
 *
 * Returns token data without writing files — the orchestrator handles output.
 */
export async function generateLeonardoTokens(
  configPath: string,
): Promise<{
  light: Record<string, unknown>;
  dark: Record<string, unknown>;
  colorNames: string[];
}> {
  // Read config (now plain JSON — no embedded JS strings)
  const config: LeonardoConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Dynamically import color definitions from the referenced JS module.
  // Cache-bust with a timestamp so watch mode picks up edits.
  const configDir = path.dirname(configPath);
  const colorsPath = path.resolve(configDir, config.colors);
  const colorsModule = await import(`${pathToFileURL(colorsPath).href}?t=${Date.now()}`);
  const moduleExport: ColorsModuleExport = colorsModule.default;
  const colorDefs = moduleExport.colors;
  const pastedTheme = moduleExport.theme;

  if (!colorDefs || colorDefs.length === 0) {
    throw new Error('No colors found. Check config/leonardo.colors.js');
  }

  console.log(
    `  Found ${colorDefs.length} colors: ${colorDefs.map((c) => c.name).join(', ')}`,
  );

  // Build color objects — use pasted Theme's backgroundColor to identify which
  // color is the background (falls back to first definition if not specified).
  const { fgColors, bgColor, colorNames } = buildColorObjects(colorDefs, pastedTheme?.backgroundColor);

  // Resolve formula: JSON config > pasted theme > default
  const formula: ContrastFormula =
    config.formula ?? (pastedTheme?.formula as ContrastFormula) ?? 'wcag2';

  // Merge theme settings: pasted theme provides defaults, JSON config overrides.
  const pastedDefaults = {
    lightness: pastedTheme?.lightness ?? 100,
    contrast: pastedTheme?.contrast ?? 1,
    saturation: pastedTheme?.saturation ?? 100,
  };
  const lightSettings = {
    ...pastedDefaults,
    ...config.themes.light,
  } as Required<ThemeSettings>;
  const darkSettings = {
    ...pastedDefaults,
    ...config.themes.dark,
  } as Required<ThemeSettings>;

  // Generate light theme tokens
  const lightTheme = buildTheme(fgColors, bgColor, lightSettings, formula);
  const lightTokens = generateDTCGTokens(lightTheme, colorDefs, formula);

  // Generate dark theme tokens
  const darkTheme = buildTheme(fgColors, bgColor, darkSettings, formula);
  const darkTokens = generateDTCGTokens(darkTheme, colorDefs, formula);

  // Surfaces: same swatches in both themes (see findSurfaceColor).
  for (const [name, surface] of Object.entries(config.surfaces ?? {})) {
    const source = fgColors.find((c) => c.name.toLowerCase().replace(/\s+/g, '-') === name);
    if (!source) throw new Error(`surfaces.${name}: no color named "${name}" in ${config.colors}`);
    // No group-level $description: ramps have none, and the token stories type
    // a colour group as a plain step map.
    const group: Record<string, unknown> = {};
    surface.lc.forEach((lc, index) => {
      group[String((index + 1) * 100)] = {
        $value: hexToDTCGColor(findSurfaceColor(source, surface.text, lc)),
        $description: `APCA Lc ${lc} under ${surface.text} text`,
        // Ramp steps get these from config/figma-variables.json once ingested;
        // surfaces carry them inline so a fresh swatch is scoped before that.
        $extensions: { 'com.figma.scopes': ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'] },
      };
    });
    for (const tokens of [lightTokens, darkTokens]) {
      (tokens.color as Record<string, unknown>)[`${name}-surface`] = structuredClone(group);
    }
    console.log(`  Surface ${name}-surface: ${surface.lc.map((lc) => `Lc ${lc}`).join(', ')} under ${surface.text}`);
  }

  return { light: lightTokens, dark: darkTokens, colorNames };
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = path.resolve(process.cwd(), 'config/leonardo.json');

  generateLeonardoTokens(configPath)
    .then(({ colorNames }) => console.log(`Leonardo tokens generated: ${colorNames.join(', ')}`))
    .catch((err) => {
      console.error('Failed to generate Leonardo tokens:', err);
      process.exit(1);
    });
}
