/* Token generation. Reads config/, writes generated/:
 *   *.tokens.json  W3C DTCG primitives: the ramps and surface set per theme, the scales
 *   tokens.css     primitives, the common tier and the charts tier as custom properties, light and dark
 * config/ is the source of truth. Never edit generated/ by hand.
 *
 * Three tiers, as in the storybook repo. Base: Leonardo ramps, Utopia scales and
 * config/base.tokens.json. Common: config/common.tokens.json, names that alias
 * base. Component: config/charts.tokens.json, the names <ua-view> reads, as aliases
 * into the other two.
 *
 * Run: pnpm --filter @universal-analytics/tokens generate */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import StyleDictionary from 'style-dictionary';
import { generateLeonardoTokens, hexToDTCGColor } from './leonardo.ts';
import { transforms } from './transforms.ts';
import { generateUtopiaTokens } from './utopia.ts';

type Tree = Record<string, unknown>;

export const ROOT = join(import.meta.dirname, '..');

/** Primitives are namespaced so they cannot collide with a host page's own. */
export const PREFIX = 'ua';

/** A mark's three colours: its name's suffix, the contrast it needs against the surface it is on, and the step of its
 * hue's ramp that has that contrast against the page. WCAG AA: 3 to 1 for a graphic, 4.5 to 1 for text. */
const MARK_PARTS: [part: string, needs: number | null, step: number][] = [['', 3, 200], ['-text', 4.5, 300], ['-soft', null, 100]];
const MARK_DESCRIPTION = 'What a chart paints each hue with: a mark, text in its colour, and a tint. A mark and its text are the hue\'s constant where that holds the contrast needed (3 to 1, and 4.5 to 1) against the page, the card and the raised surface of this theme, and the step of its ramp where it does not. A tint is the ramp\'s.';

/** WCAG's contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number {
  const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i]!, 0);
  const [lo, hi] = [lum(a), lum(b)].sort((x, y) => x - y);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Leonardo and Utopia output, keyed by the file each tree is written to. */
export async function primitives(root = ROOT): Promise<Record<string, Tree>> {
  const leonardo = await generateLeonardoTokens(join(root, 'config/leonardo.json'));
  const utopia = await generateUtopiaTokens(join(root, 'config/utopia.json'));
  const s = JSON.parse(readFileSync(join(root, 'config/surface.json'), 'utf-8')) as { description: string; set: Record<string, { light: string; dark: string }> };
  const seq = JSON.parse(readFileSync(join(root, 'config/sequential.json'), 'utf-8')) as { description: string; steps: string[] };
  for (const theme of ['light', 'dark'] as const) {
    const ramps = leonardo[theme].color as Tree;
    // Chosen by hand, and given to each theme in its own direction: step 100 is the end nearest the page.
    const steps = theme === 'dark' ? seq.steps : seq.steps.slice().reverse();
    ramps.seq = { $description: seq.description, ...Object.fromEntries(steps.map((hex, i) => [String((i + 1) * 100), { $value: hexToDTCGColor(hex) }])) };
    ramps.surface = { $description: s.description, ...Object.fromEntries(Object.entries(s.set).map(([name, value]) => [name, { $value: value[theme] }])) };
  }
  // What a chart paints a hue with, per theme: the hue's constant, its brightest, wherever that holds the contrast the
  // element needs against every surface of the theme, and the ramp's step for that contrast where it does not. A tint
  // is the ramp's always: a constant at full strength is not a tint.
  const base = JSON.parse(readFileSync(join(root, 'config/base.tokens.json'), 'utf-8')).color as Tree;
  for (const theme of ['light', 'dark'] as const) {
    const ramps = leonardo[theme].color as Record<string, Tree>;
    const hex = (ref: string): string => { const v = (ref.slice(1, -1).split('.').slice(1).reduce((node, key) => (node as Tree)[key], { ...base, ...ramps } as unknown) as { $value: string | { hex: string } }).$value; return typeof v === 'string' ? hex(v) : v.hex; };
    const surfaces = Object.keys(s.set).map((name) => hex(`{color.surface.${name}}`));
    const clears = (ref: string, needs: number) => surfaces.every((surface) => contrastRatio(hex(ref), surface) >= needs);
    const mark: Tree = { $description: MARK_DESCRIPTION };
    for (const hue of Object.keys(ramps).filter((name) => name.startsWith('qual-')).map((name) => name.slice(5))) {
      const constant = `{color.constant.${hue}}`;
      for (const [part, needs, step] of MARK_PARTS) mark[hue + part] = { $value: needs != null && clears(constant, needs) ? constant : `{color.qual-${hue}.${step}}` };
    }
    ramps.mark = mark;
  }
  return { 'color.light': leonardo.light, 'color.dark': leonardo.dark, 'scale.fluid': utopia.fluid, 'scale.min': utopia.min, 'scale.max': utopia.max };
}

/** One Style Dictionary pass over a list of token files. A broken alias throws here. */
async function css(source: string[], selector: string, colourOnly: boolean): Promise<string> {
  const sd = new StyleDictionary({
    source,
    // Later sources override earlier ones on purpose (the dark overrides), which Style Dictionary reports as collisions.
    log: { warnings: 'disabled', verbosity: 'silent' },
    platforms: { css: { prefix: PREFIX, transforms, files: [{
      destination: 'tokens.css', format: 'css/variables',
      filter: colourOnly ? (token) => token.$type === 'color' : undefined,
      options: { outputReferences: true, selector, showFileHeader: false },
    }] } },
  });
  const [file] = await sd.formatPlatform('css');
  return String(file!.output);
}

/** Compile generated/ and the hand-written tiers to CSS, with the theming pattern the prototypes use:
 *  device preference, overridable either way by data-theme. */
export async function buildCSS(root = ROOT): Promise<string> {
  const g = (name: string) => join(root, 'generated', `${name}.tokens.json`), c = (name: string) => join(root, 'config', `${name}.tokens.json`);
  const shared = [g('scale.fluid'), c('base'), c('common'), c('charts')];
  const light = await css([g('color.light'), ...shared], ':root', false);
  // Only colours differ by theme. The other sources are there so aliases resolve.
  const dark = await css([g('color.dark'), ...shared, c('common.dark')], ':root[data-theme="dark"]', true);
  return [
    '/* Generated by packages/tokens. Do not edit. */',
    light.trim(),
    `@media (prefers-color-scheme: dark) {\n${dark.replace(':root[data-theme="dark"]', ':root:not([data-theme="light"])').trim()}\n}`,
    dark.trim(),
  ].join('\n\n') + '\n';
}

if (import.meta.main) {
  const out = join(ROOT, 'generated'), files = await primitives();
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out);
  for (const [name, tree] of Object.entries(files)) writeFileSync(join(out, `${name}.tokens.json`), JSON.stringify(tree, null, 2) + '\n');
  writeFileSync(join(out, 'tokens.css'), await buildCSS());
  console.log(`Wrote ${Object.keys(files).length + 1} files to ${out}`);
}
