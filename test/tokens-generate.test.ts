import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrast } from '@adobe/leonardo-contrast-colors';
import { buildCSS, primitives, ROOT } from '../packages/tokens/src/generate.ts';

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
    // Step 1 is the end nearest the page: the bright end in light, the dark end in dark.
    for (const n of [1, 5, 10]) { expect(light).toContain(`--ua-color-seq-${n}: var(--ua-color-seq-${(11 - n) * 100});`); expect(dark).toContain(`--ua-color-seq-${n}: var(--ua-color-seq-${n * 100});`); }
    expect(light).toContain('--ua-color-seq-none: var(--ua-color-neutral-400);');
    expect(dark).toContain('--ua-color-seq-none: var(--ua-color-neutral-500);');
    expect(light).toContain('--ua-spacing-4: var(--ua-space-s);');
    expect(dark).not.toContain('--ua-spacing-4');
  });

  // The sequential ramp is chosen by hand, so what is held here is its order: a cell is read as more or less by how light it is.
  it('has a sequential ramp of ten steps, each lighter than the last', () => {
    const seq = JSON.parse(readFileSync(join(ROOT, 'config/base.tokens.json'), 'utf-8')).color.seq;
    const steps = Array.from({ length: 10 }, (_, i) => seq[(i + 1) * 100].$value.hex as string);
    const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    expect(steps[0]).toBe('#3c3764'); expect(steps[9]).toBe('#cbed00');
    // Leonardo's contrast is above 1 where the first colour is the lighter of the two.
    steps.slice(1).forEach((step, i) => expect(Math.abs(contrast(rgb(step), rgb(steps[i]!))), step).toBeGreaterThan(1.1));
    steps.slice(1).forEach((step, i) => expect(seq[(i + 2) * 100].$value.components[1], step).toBeGreaterThan(seq[(i + 1) * 100].$value.components[1]));
  });
});
