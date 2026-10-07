export * from './types.ts';
export { CONTAINER_RULES, makeContainer, unboundedContainer } from './container.ts';
export { FIT_RULES, applies, type FitRule, type Room } from './fit.ts';
export { PRESETS, expand } from './presets.ts';
export { resolve } from './plan.ts';
export { buildScene, roleOf } from './scene.ts';
export { place } from './place.ts';
export { partialNote, tldrProse } from './prose.ts';
export { formatDimension, formatValue, rangeLabel } from './format.ts';
