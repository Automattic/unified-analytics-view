import type { Channel, Layer, PresetLibrary, Spec } from './types.ts';

/* A preset is a saved fragment of a spec. It expands into ordinary layers
 * before the grammar runs, and nothing downstream knows its name.
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
};

export function expand(spec: Spec, presets: PresetLibrary = PRESETS): Spec {
  if (!spec.use) return spec;
  const p = presets[spec.use];
  if (!p) throw new Error('Unknown preset "' + spec.use + '". The library has: ' + Object.keys(presets).join(', ') + '.');
  const q = spec.query || {}, by = (q.by || [])[0], m = (q.metrics || [])[0];
  if (!by) throw new Error('The "' + spec.use + '" preset needs a dimension in query.by.');
  const { use: _use, ...out } = spec;
  if (spec.layers) return out;                               // layers written in the spec win over the preset
  out.layers = p.layers.filter((l) => l.series !== 'previous' || q.compare === 'previous').map((l) => {
    const c: Layer = JSON.parse(JSON.stringify(l));
    const enc = c.encode || {};
    (Object.keys(enc) as Channel[]).forEach((ch) => { enc[ch] = enc[ch] === '$by' ? by : enc[ch] === '$metric' ? m : enc[ch]; });
    return c;
  });
  return out;
}
