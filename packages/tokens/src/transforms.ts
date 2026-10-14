/* Style Dictionary transforms for the DTCG value shapes this pipeline emits.
 * Taken from the storybook repo's style-dictionary.transforms.js, cut down to
 * the types we have. Add the others from there as base tokens need them. */
import StyleDictionary from 'style-dictionary';

type Token = { $type?: string; $value?: unknown; value?: unknown };
const valueOf = (token: Token) => token.$value ?? token.value;

// Fluid tokens store clamp() strings as $value, an intentional deviation from
// the DTCG dimension type, so CSS can use them directly.
StyleDictionary.registerTransform({
  name: 'value/clamp', type: 'value', transitive: true,
  filter: (token: Token) => { const v = valueOf(token); return typeof v === 'string' && v.startsWith('clamp('); },
  transform: (token: Token) => valueOf(token),
});

StyleDictionary.registerTransform({
  name: 'dimension/css', type: 'value', transitive: true,
  filter: (token: Token) => { const v = valueOf(token); return (token.$type === 'dimension' || token.$type === 'duration') && typeof v === 'object' && v !== null && 'value' in v; },
  transform: (token: Token) => { const v = valueOf(token) as { value: number; unit: string }; return `${v.value}${v.unit}`; },
});

StyleDictionary.registerTransform({
  name: 'color/dtcg-css', type: 'value', transitive: true,
  filter: (token: Token) => { const v = valueOf(token); return token.$type === 'color' && typeof v === 'object' && v !== null && 'hex' in v; },
  transform: (token: Token) => (valueOf(token) as { hex: string }).hex,
});

StyleDictionary.registerTransform({
  name: 'cubic-bezier/css', type: 'value', transitive: true,
  filter: (token: Token) => token.$type === 'cubicBezier' && Array.isArray(valueOf(token)),
  transform: (token: Token) => `cubic-bezier(${(valueOf(token) as number[]).join(', ')})`,
});

// An opacity is written in percent, as Figma writes it, so the one value serves color-mix() and opacity alike.
StyleDictionary.registerTransform({
  name: 'opacity/percent', type: 'value', transitive: true,
  filter: (token: Token & { path?: string[] }) => token.$type === 'number' && !!token.path?.includes('opacity') && typeof valueOf(token) === 'number',
  transform: (token: Token) => `${valueOf(token)}%`,
});

export const transforms = ['attribute/cti', 'name/kebab', 'value/clamp', 'dimension/css', 'cubic-bezier/css', 'color/dtcg-css', 'opacity/percent'];
