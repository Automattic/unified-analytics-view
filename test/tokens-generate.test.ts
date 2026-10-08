import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast } from '@adobe/leonardo-contrast-colors';
import { buildCSS, contrastRatio, primitives, ROOT } from '../packages/tokens/src/generate.ts';

const generated = (name: string) => readFileSync(join(ROOT, 'generated', name), 'utf-8');

describe('token output', () => {
  // Style Dictionary throws on an alias that points at nothing, so building is also the check on the mapping.
  it('is what the config generates: rerun the generate script if this fails', async () => {
    for (const [name, tree] of Object.entries(await primitives())) expect(JSON.parse(generated(`${name}.tokens.json`))).toEqual(tree);
    expect(await buildCSS()).toBe(generated('tokens.css'));
  });

  it('aliases the common tier to the ramps, per theme where the step differs', () => {
    const [light, dark] = generated('tokens.css').split('@media');
    expect(light).toContain('--ua-color-muted: var(--ua-color-neutral-300);');
    expect(dark).toContain('--ua-color-muted: var(--ua-color-neutral-500);');
    // A surface is one name in the common tier; the surface set holds its value per theme.
    expect(light).toContain('--ua-color-surface-card: var(--ua-color-neutral-100);');
    expect(dark).toContain('--ua-color-surface-card: var(--ua-color-neutral-300);');
    expect(dark).toContain('--ua-color-card: var(--ua-color-surface-card);');
    // The sequential ramp is named by step number; no data is a neutral of its own, not the lowest step.
    // A chart's colours name one step in both themes: the primitives are what differ.
    for (const theme of [light, dark]) {
      for (const n of [1, 5, 10]) expect(theme).toContain(`--ua-color-seq-${n}: var(--ua-color-seq-${n * 100});`);
      expect(theme).toContain('--ua-color-constant-chartreuse: var(--ua-color-constant-lime);');
      expect(theme).toContain('--ua-color-constant-grass: #45d289;');
    }
    // Step 100 of the sequential ramp is the end nearest the page: chartreuse in light, indigo in dark.
    expect(light).toContain('--ua-color-seq-100: #cbed00;'); expect(dark).toContain('--ua-color-seq-100: #3c3764;');
    expect(light).toContain('--ua-color-seq-none: var(--ua-color-neutral-400);');
    expect(dark).toContain('--ua-color-seq-none: var(--ua-color-neutral-500);');
    expect(light).toContain('--ua-spacing-4: var(--ua-space-s);');
    expect(dark).not.toContain('--ua-spacing-4');
  });

  // The sequential ramp is chosen by hand, so what is held here is its order: a cell is read as more or less by how light it is.
  // A qualitative ramp has the three steps a chart needs and no more, each at its contrast against the theme's page.
  it('makes qualitative ramps of a tint, a mark and a text step, at 1.35, 3 and 5 to 1', () => {
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    for (const [theme, page] of [['light', '#f7f5ef'], ['dark', '#0c0c0c']] as const) {
      const color = JSON.parse(generated(`color.${theme}.tokens.json`)).color;
      for (const hue of ['chartreuse', 'grass', 'teal', 'steel', 'rose', 'orange']) {
        expect(Object.keys(color['qual-' + hue])).toEqual(['100', '200', '300']);
        [1.35, 3, 5].forEach((ratio, i) => expect(Math.abs(contrast(rgb(color['qual-' + hue][(i + 1) * 100].$value.hex), rgb(page))), `${theme} ${hue} ${ratio}`).toBeGreaterThan(ratio - 0.15));
      }
    }
  });

  // A mark is its hue's constant wherever that holds the contrast, and the ramp's step where it does not.
  it('paints a mark with its constant where that clears 3 to 1 on every surface, and its text where that clears 4.5', () => {
    const [light, dark] = ['light', 'dark'].map((theme) => JSON.parse(generated(`color.${theme}.tokens.json`)).color.mark);
    const of = (mark: Record<string, { $value: string }>, name: string) => mark[name]!.$value;
    // Chartreuse is too light for a light page and steel too dark for a dark one. Rose holds a mark's contrast in both, and text's in neither.
    expect([of(light, 'chartreuse'), of(dark, 'chartreuse'), of(dark, 'chartreuse-text')]).toEqual(['{color.qual-chartreuse.200}', '{color.constant.chartreuse}', '{color.constant.chartreuse}']);
    expect([of(light, 'steel'), of(light, 'steel-text'), of(dark, 'steel')]).toEqual(['{color.constant.steel}', '{color.constant.steel}', '{color.qual-steel.200}']);
    expect([of(light, 'rose'), of(light, 'rose-text'), of(dark, 'rose'), of(dark, 'rose-text')]).toEqual(['{color.constant.rose}', '{color.qual-rose.300}', '{color.constant.rose}', '{color.qual-rose.300}']);
    // A tint is the ramp's in both.
    for (const mark of [light, dark]) expect(of(mark, 'grass-soft')).toBe('{color.qual-grass.100}');
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });

  it('has a sequential ramp of ten steps, each lighter than the last', () => {
    const seq = JSON.parse(generated('color.dark.tokens.json')).color.seq;
    const steps = Array.from({ length: 10 }, (_, i) => seq[(i + 1) * 100].$value.hex as string);
    expect(steps).toEqual(JSON.parse(readFileSync(join(ROOT, 'config/sequential.json'), 'utf-8')).steps);
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    expect(steps[0]).toBe('#3c3764'); expect(steps[9]).toBe('#cbed00');
    // Leonardo's contrast is above 1 where the first colour is the lighter of the two.
    steps.slice(1).forEach((step, i) => expect(Math.abs(contrast(rgb(step), rgb(steps[i]!))), step).toBeGreaterThan(1.1));
    steps.slice(1).forEach((step, i) => expect(seq[(i + 2) * 100].$value.components[1], step).toBeGreaterThan(seq[(i + 1) * 100].$value.components[1]));
  });
});
