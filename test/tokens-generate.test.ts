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
    for (const n of [1, 2, 3, 4, 5, 6, 7]) expect(light).toContain(`--ua-color-seq-${n}: var(--ua-color-seq-${n}00);`);
    expect(light).toContain('--ua-color-seq-none: var(--ua-color-neutral-400);');
    expect(dark).toContain('--ua-color-seq-none: var(--ua-color-neutral-500);');
    expect(light).toContain('--ua-spacing-4: var(--ua-space-s);');
    expect(dark).not.toContain('--ua-spacing-4');
  });

  // The sequential ramp is read by telling a cell from the one beside it, so its steps are held apart here.
  it('makes a sequential ramp of seven steps, each apart from its neighbours and from every surface', () => {
    const base = JSON.parse(readFileSync(join(ROOT, 'config/base.tokens.json'), 'utf-8')).color;
    for (const theme of ['light', 'dark']) {
      const color = { ...base, ...JSON.parse(generated(`color.${theme}.tokens.json`)).color };
      const hex = (ref: string): string => {
        const v = ref.slice(1, -1).split('.').slice(1).reduce((node, key) => node[key], color).$value;
        return typeof v === 'string' ? hex(v) : v.hex;
      };
      const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
      const apart = (a: string, b: string) => { const c = Math.abs(contrast(rgb(hex(a)), rgb(hex(b)))); return Math.max(c, 1 / c); };
      const steps = [100, 200, 300, 400, 500, 600, 700].map((n) => `{color.seq.${n}}`);
      expect(Object.keys(color.seq)).toHaveLength(7);
      steps.slice(1).forEach((step, i) => expect(apart(step, steps[i]!), `${theme} ${step}`).toBeGreaterThan(1.35));
      for (const surface of ['page', 'card', 'raised']) expect(apart(steps[0]!, `{color.surface.${surface}}`), `${theme} ${surface}`).toBeGreaterThan(1.4);
    }
  });
});
