import type { Channel, Layer, PresetLibrary, Spec } from './types.ts';

/* A preset is a saved fragment of a spec, with three slots filled from the query: `$metric`, `$by` and, for a second
 * dimension, `$split`. It expands into ordinary layers before the grammar runs, and nothing downstream knows its name.
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
};

export function expand(spec: Spec, presets: PresetLibrary = PRESETS): Spec {
  if (!spec.use) return spec;
  const p = presets[spec.use];
  if (!p) throw new Error('Unknown preset "' + spec.use + '". The library has: ' + Object.keys(presets).join(', ') + '.');
  const q = spec.query || {}, [by, split] = q.by || [], m = (q.metrics || [])[0];
  if (!by && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$by') >= 0)) throw new Error('The "' + spec.use + '" preset needs a dimension in query.by.');
  if (!split && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$split') >= 0)) throw new Error('The "' + spec.use + '" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  const { use: _use, ...out } = spec;
  if (spec.layers) return out;                               // layers written in the spec win over the preset
  out.layers = p.layers.filter((l) => l.series !== 'previous' || q.compare === 'previous').map((l) => {
    const c: Layer = JSON.parse(JSON.stringify(l));
    const enc = c.encode || {};
    (Object.keys(enc) as Channel[]).forEach((ch) => { enc[ch] = enc[ch] === '$by' ? by : enc[ch] === '$split' ? split : enc[ch] === '$metric' ? m : enc[ch]; });
    return c;
  });
  return out;
}
