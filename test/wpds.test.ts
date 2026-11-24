import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { NAMED, TOKENS } from '../packages/dom/src/tokens.ts';

/* The alias sheet for a page themed by the WordPress Design System (packages/tokens/wpds.css) is a draft, and what
 * can be held of it here is its left side: every property it sets is a public token of the view, and every value is
 * one WordPress token and nothing else, so a pair that is wrong leaves the view unthemed and never broken. Whether
 * each pair is the right one is read by eye on a WordPress page, and is not held anywhere. */
const sheet = readFileSync(new URL('../packages/tokens/wpds.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const pairs = [...sheet.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => [m[1]!, m[2]!] as const);

it('every property the WordPress alias sheet sets is a public token of the view, set once, to one WordPress token', () => {
  expect(pairs.length).toBeGreaterThan(20);
  expect(pairs.map(([name]) => name).map((name) => name.replace('--ua-charts-', '')).filter((name) => !(name in TOKENS) && !NAMED.test(name)), 'not a token <ua-view> reads').toEqual([]);
  expect(new Set(pairs.map(([name]) => name)).size, 'a token set twice').toBe(pairs.length);
  expect(pairs.filter(([, value]) => !/^var\(--wpds-[a-z0-9-]+\)$/.test(value)).map(([name]) => name), 'a value that is not one --wpds- token').toEqual([]);
});
