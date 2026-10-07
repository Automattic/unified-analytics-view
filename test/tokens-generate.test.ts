import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCSS, primitives, qualitative, ROOT } from '../packages/tokens/src/generate.ts';

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
    expect(light).toContain('--ua-spacing-4: var(--ua-space-s);');
    expect(dark).not.toContain('--ua-spacing-4');
  });

  it('names the ramps to choose from when a series points at none', () => {
    const ramps = { $type: 'color', blue: { 500: { $value: { hex: '#123456' } } } };
    expect(() => qualitative(['teal'], 500, ramps)).toThrow(/Use one of: blue/);
  });
});
