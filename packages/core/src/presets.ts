import type { Channel, Layer, PresetLibrary, Spec } from './types.ts';

/* A preset is a saved fragment of a spec, with slots filled from the query: `$metric`, `$by`, for a second
 * dimension `$split`, and for a second metric `$metric2`. A slot may be followed by a suffix, `$metric@p50`, for a
 * companion the engine returns with the field. It expands into ordinary layers before the grammar runs, and nothing downstream knows its name.
 * Names follow the @automattic/charts component they replace, where one exists. */
export const PRESETS: PresetLibrary = {
  'line': { layers: [
    { mark: 'area', encode: { x: '$by', y: '$metric' }, role: 'context' },
    { mark: 'line', encode: { x: '$by', y: '$metric' }, series: 'previous', role: 'comparison' },
    { mark: 'line', encode: { x: '$by', y: '$metric' }, role: 'primary' } ] },
  'bar-list': { layers: [
    { mark: 'bar',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  'share-bar': { layers: [
    { mark: 'bar', encode: { x: '$metric', color: '$by' }, stack: 'normalize' } ] },
  // With a second dimension in the query, `$split`. Working names: check each against @automattic/charts before it ships.
  'grouped-bar': { layers: [
    { mark: 'bar', encode: { x: '$by', y: '$metric', color: '$split' } } ] },
  'stacked-bar': { layers: [
    { mark: 'bar', encode: { x: '$by', y: '$metric', color: '$split' }, stack: 'zero' } ] },
  'stacked-area': { layers: [
    { mark: 'area', encode: { x: '$by', y: '$metric', color: '$split' }, stack: 'zero' } ] },
  // Arcs about one centre. `pie` and `pie-semi-circle` follow PieChart and PieSemiCircleChart. `donut` and `gauge` are working names.
  'pie': { layers: [
    { mark: 'arc', encode: { angle: '$metric', color: '$by' } } ] },
  'donut': { layers: [
    { mark: 'arc', encode: { angle: '$metric', color: '$by', radius: 0.6 } } ] },
  'pie-semi-circle': { layers: [
    { mark: 'arc', encode: { angle: '$metric', color: '$by', radius: 0.6 }, sweep: 'half' } ] },
  // No dimension: the metric against its catalog domain. The range, the value swept to, and the target marked.
  'gauge': { layers: [
    { mark: 'arc', encode: { radius: 0.7 }, sweep: 'half', role: 'context' },
    { mark: 'arc', encode: { angle: '$metric', radius: 0.7 }, sweep: 'half' },
    { mark: 'arc', encode: { angle: '$metric', radius: 0.7 }, sweep: 'half', role: 'reference' } ] },
  // As a pivot table reads: the first dimension down the side, the second across.
  'heatmap': { layers: [
    { mark: 'cell', encode: { y: '$by', x: '$split', color: '$metric' } } ] },
  // With a second metric in the query, `$metric2`. A funnel is rows in the query's order: a bar, the count, and the rate
  // the engine gives for each step. Nothing here divides one row by another. A working name, as those above are.
  'funnel': { layers: [
    { mark: 'bar',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' },
    { mark: 'text', encode: { y: '$by', text: '$metric2' }, align: 'end' } ] },
  // Ranges, from the companions the engine returns with a metric. What supports the central mark is `context`, so it
  // goes first and the central mark stays. Working names, as those above are.
  // The box states its paint: a bar with two ends is painted by which way it goes, and a box goes no way.
  'box-plot': { layers: [
    { mark: 'rule', encode: { x: '$by', y: '$metric@min', y2: '$metric@max' }, role: 'context' },
    { mark: 'bar',  encode: { x: '$by', y: '$metric@p25', y2: '$metric@p75' }, role: 'context', paint: 'series.1' },
    { mark: 'tick', encode: { x: '$by', y: '$metric@p50' } } ] },
  'error-bars': { layers: [
    { mark: 'bar',  encode: { x: '$by', y: '$metric' } },
    { mark: 'rule', encode: { x: '$by', y: '$metric@lower', y2: '$metric@upper' }, role: 'context' } ] },
  'waterfall': { layers: [
    { mark: 'bar',  encode: { x: '$by', y: '$metric@before', y2: '$metric@running' } } ] },
  'candlestick': { layers: [
    { mark: 'rule', encode: { x: '$by', y: '$metric@min', y2: '$metric@max' }, role: 'context' },
    { mark: 'bar',  encode: { x: '$by', y: '$metric@open', y2: '$metric@close' } } ] },
  'fan': { layers: [
    { mark: 'area', encode: { x: '$by', y: '$metric@lower', y2: '$metric@upper' }, role: 'context' },
    { mark: 'line', encode: { x: '$by', y: '$metric' } } ] },
  // Rows whose track is read by position. A dumbbell sets this period against the one before; with no `compare` in
  // the query it is a dot for each row. A bullet's tick stands at the metric's catalog `target`.
  'dumbbell': { layers: [
    { mark: 'rule', encode: { y: '$by', x: '$metric@previous', x2: '$metric' }, role: 'context' },
    { mark: 'dot',  encode: { y: '$by', x: '$metric' }, series: 'previous', role: 'comparison' },
    { mark: 'dot',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  'bullet': { layers: [
    { mark: 'bar',  encode: { y: '$by', x: '$metric' } },
    { mark: 'tick', encode: { y: '$by', x: '$metric' }, role: 'reference' },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
};

/** Whether a layer draws from the period before: the previous series, a row's change on it, or a field of it by name. Such a layer goes where there is no such period. */
export function usesPrevious(l: Layer): boolean {
  return !!l.series || Object.values(l.encode || {}).some((f) => typeof f === 'string' && f.endsWith('@previous'));
}

/* Presets a custom mark's package brings. Core cannot name a custom mark, so it cannot write the preset that draws
 * one: the package that registers the mark (marks.ts) registers its presets here, in the same slots as those above.
 * A map and two functions, as the marks' registry is. Do not let it grow into a plugin system. */
const REGISTERED = new Map<string, PresetLibrary[string]>();

/** Register a preset under a name, or replace the one registered under it. */
export function registerPreset(name: string, preset: PresetLibrary[string]): void {
  if (!/^[\w-]+$/.test(name)) throw new Error('A preset cannot be named ' + JSON.stringify(name) + ': the name is written into specs. Use letters, digits, "_" and "-" only.');
  if (Object.hasOwn(PRESETS, name)) throw new Error('A preset cannot be named "' + name + '", which core has already. Register it under another name.');
  if (!Array.isArray(preset?.layers) || !preset.layers.length) throw new Error('The preset "' + name + '" has no layers, so a view that uses it would have nothing to draw. Hand registerPreset() { layers: [...] } with one layer at least.');
  REGISTERED.set(name, preset);
}
/** The presets registered, by name. */
export function customPresets(): ReadonlyMap<string, PresetLibrary[string]> {
  return REGISTERED;
}
/** Every name a spec may `use`: the library's, then the registered ones it does not have. */
export const presetNames = (presets: PresetLibrary = PRESETS): string[] => Object.keys(presets).concat([...REGISTERED.keys()].filter((n) => !Object.hasOwn(presets, n)));

export function expand(spec: Spec, presets: PresetLibrary = PRESETS): Spec {
  if (!spec.use) return spec;
  // The library handed in first, by its own keys, so "constructor" is no preset. Then the registry.
  const p = Object.hasOwn(presets, spec.use) ? presets[spec.use] : REGISTERED.get(spec.use);
  if (!p) throw new Error('Unknown preset "' + spec.use + '". The library has: ' + (Object.keys(presets).join(', ') || 'none') + '. Registered: ' + ([...REGISTERED.keys()].join(', ') || 'none') + '. Use one of those, or register it with registerPreset(' + JSON.stringify(spec.use) + ', …) before the view is resolved.');
  const q = spec.query || {}, [by, split] = q.by || [], [m, m2] = q.metrics || [];
  if (!by && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$by') >= 0)) throw new Error('The "' + spec.use + '" preset needs a dimension in query.by.');
  if (!split && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$split') >= 0)) throw new Error('The "' + spec.use + '" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  if (!m2 && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$metric2') >= 0)) throw new Error('The "' + spec.use + '" preset needs two metrics in query.metrics: the count, then the rate the engine returns for it.');
  const { use: _use, ...out } = spec;
  if (spec.layers) return out;                               // layers written in the spec win over the preset
  const slots: Record<string, string | undefined> = { $by: by, $split: split, $metric: m, $metric2: m2 };
  out.layers = p.layers.filter((l) => !usesPrevious(l) || q.compare === 'previous').map((l) => {
    const c: Layer = JSON.parse(JSON.stringify(l));
    const enc = c.encode || {};
    (Object.keys(enc) as Channel[]).forEach((ch) => {
      // A slot, and after it the suffix of a companion, which stays as it is written.
      const f = enc[ch], [slot, ...suffix] = typeof f === 'string' ? f.split('@') : [];
      if (slot != null && slot in slots) enc[ch] = suffix.length ? [slots[slot], ...suffix].join('@') : slots[slot]!;
    });
    return c;
  });
  return out;
}
