import type { Channel, Layer, PresetLibrary, Spec } from './types.ts';

/* A preset is a saved fragment of a spec, with slots filled from the query: `$metric`, `$by`, for a second
 * dimension `$split`, and for a second metric `$metric2`. It expands into ordinary layers before the grammar runs, and nothing downstream knows its name.
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
  // With a second metric in the query, `$metric2`. A funnel is rows in the query's order: a bar, the count, and the rate
  // the engine gives for each step. Nothing here divides one row by another. A working name, as those above are.
  'funnel': { layers: [
    { mark: 'bar',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' },
    { mark: 'text', encode: { y: '$by', text: '$metric2' }, align: 'end' } ] },
};

export function expand(spec: Spec, presets: PresetLibrary = PRESETS): Spec {
  if (!spec.use) return spec;
  const p = presets[spec.use];
  if (!p) throw new Error('Unknown preset "' + spec.use + '". The library has: ' + Object.keys(presets).join(', ') + '.');
  const q = spec.query || {}, [by, split] = q.by || [], [m, m2] = q.metrics || [];
  if (!by) throw new Error('The "' + spec.use + '" preset needs a dimension in query.by.');
  if (!split && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$split') >= 0)) throw new Error('The "' + spec.use + '" preset needs two dimensions in query.by: the one on the axis, then the one to split by.');
  if (!m2 && p.layers.some((l) => Object.values(l.encode || {}).indexOf('$metric2') >= 0)) throw new Error('The "' + spec.use + '" preset needs two metrics in query.metrics: the count, then the rate the engine returns for it.');
  const { use: _use, ...out } = spec;
  if (spec.layers) return out;                               // layers written in the spec win over the preset
  out.layers = p.layers.filter((l) => !l.series || q.compare === 'previous').map((l) => {
    const c: Layer = JSON.parse(JSON.stringify(l));
    const enc = c.encode || {};
    (Object.keys(enc) as Channel[]).forEach((ch) => { enc[ch] = enc[ch] === '$by' ? by : enc[ch] === '$split' ? split : enc[ch] === '$metric' ? m : enc[ch] === '$metric2' ? m2 : enc[ch]; });
    return c;
  });
  return out;
}
