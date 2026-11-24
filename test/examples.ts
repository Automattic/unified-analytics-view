import { registerPreset, type PresetLibrary, type Spec } from '@unified-analytics/core';

/* Presets the library no longer ships (docs/focus-plan.md, step 3): the forms the bench's samples are now written
 * out in, kept here as slots. They are what the suites exercise the preset mechanism with: a second dimension, a
 * second metric, a companion's suffix, a layer of the period before left out where the query does not compare.
 * Not a test file: vitest takes only *.test.ts. A suite that writes `use` with one of these calls `useExamples()`. */
export const EXAMPLES: PresetLibrary = {
  // An arc that reads data on angle and radius (docs/archive/uncommon-coverage-plan.md, step 2). Working names, all three:
  // check each against @automattic/charts before it ships.
  // A slice for each value, equal in width and reaching out to its value: a Nightingale rose, and with hours a clock.
  'rose': { layers: [
    { mark: 'arc', encode: { angle: '$by', radius: '$metric' } } ] },
  // A ring for each value, in a colour of its own: the whole ring, faint, and the arc swept to its value on it.
  'radial-bar': { layers: [
    { mark: 'arc', encode: { radius: '$by', color: '$by' }, role: 'context' },
    { mark: 'arc', encode: { angle: '$metric', radius: '$by', color: '$by' } } ] },
  // With a second dimension in the query: a segment for each value of the first, and round it a ring divided by the second.
  'sunburst': { layers: [
    { mark: 'arc', encode: { angle: '$metric', color: '$by', detail: '$split' } } ] },
  // Ranges, from the companions the engine returns with a metric. What supports the central mark is `context`, so it
  // goes first and the central mark stays. Working names, as those above are.
  // A bar with two ends is in its layer's own paint, as a box is, unless the layer says `paint: "direction"`: then it is
  // a gain or a loss by which way it runs, as a waterfall's step and a candle's body are.
  'box-plot': { layers: [
    { mark: 'rule', encode: { x: '$by', y: '$metric@min', y2: '$metric@max' }, role: 'context' },
    { mark: 'bar',  encode: { x: '$by', y: '$metric@p25', y2: '$metric@p75' }, role: 'context' },
    { mark: 'tick', encode: { x: '$by', y: '$metric@p50' } } ] },
  'error-bars': { layers: [
    { mark: 'bar',  encode: { x: '$by', y: '$metric' } },
    { mark: 'rule', encode: { x: '$by', y: '$metric@lower', y2: '$metric@upper' }, role: 'context' } ] },
  'waterfall': { layers: [
    { mark: 'bar',  encode: { x: '$by', y: '$metric@before', y2: '$metric@running' }, paint: 'direction' } ] },
  'candlestick': { layers: [
    { mark: 'rule', encode: { x: '$by', y: '$metric@min', y2: '$metric@max' }, role: 'context' },
    { mark: 'bar',  encode: { x: '$by', y: '$metric@open', y2: '$metric@close' }, paint: 'direction' } ] },
  'fan': { layers: [
    { mark: 'area', encode: { x: '$by', y: '$metric@lower', y2: '$metric@upper' }, role: 'context' },
    { mark: 'line', encode: { x: '$by', y: '$metric' } } ] },
  // Rows whose track is read by position. A dumbbell sets this period against the one before; with no `compare` in
  // the query it is a dot for each row. A bullet's tick stands at the metric's catalog `target`, and the bar with
  // nothing on x is the metric's catalog `domain` behind them, divided at its `bands`.
  'dumbbell': { layers: [
    { mark: 'rule', encode: { y: '$by', x: '$metric@previous', x2: '$metric' }, role: 'context' },
    { mark: 'dot',  encode: { y: '$by', x: '$metric' }, series: 'previous', role: 'comparison' },
    { mark: 'dot',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  'bullet': { layers: [
    { mark: 'bar',  encode: { y: '$by' }, role: 'context' },
    { mark: 'bar',  encode: { y: '$by', x: '$metric' } },
    { mark: 'tick', encode: { y: '$by', x: '$metric' }, role: 'reference' },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  // The `unit` mark: a value drawn as counted glyphs, in each of its forms. Working names, as those above are: check
  // each against @automattic/charts before it ships. A waffle divides a grid of a hundred by share; a unit chart stacks
  // glyphs up from the axis, and on a binned number dimension is the Wilkinson dot plot; an isotype runs them along a
  // row; a parliament seats them round a half circle; an icon array has no dimension, and fills the grid to the
  // metric's place in its catalog domain, as the gauge sweeps to it.
  'waffle': { layers: [
    { mark: 'unit', encode: { x: '$metric', color: '$by' } } ] },
  'unit-chart': { layers: [
    { mark: 'unit', encode: { x: '$by', y: '$metric' } } ] },
  'isotype': { layers: [
    { mark: 'unit', encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  'parliament': { layers: [
    { mark: 'unit', encode: { angle: '$metric', color: '$by' }, sweep: 'half' } ] },
  'icon-array': { layers: [
    { mark: 'unit', encode: { x: '$metric' } } ] },
  // Lines and areas beyond the trend (docs/archive/uncommon-coverage-plan.md, step 3). Working names, all five: check each
  // against @automattic/charts before it ships.
  // A bump chart: each value of the split by its place, first at the top. The engine returns the place, as `$metric@rank`,
  // and the catalog says that companion's unit is `rank`.
  'bump': { layers: [
    { mark: 'line', encode: { x: '$by', y: '$metric@rank', color: '$split' } } ] },
  // A line for each value of the split, all in one paint, with no legend: many lines read as a mass.
  'spaghetti': { layers: [
    { mark: 'line', encode: { x: '$by', y: '$metric', detail: '$split' } } ] },
  // The surplus and the deficit: the area between the metric and the period before, a gain where it is ahead and a loss
  // where it is behind. With no `compare` in the query it is the line alone.
  'difference': { layers: [
    { mark: 'area', encode: { x: '$by', y: '$metric@previous', y2: '$metric' }, paint: 'direction', role: 'context' },
    { mark: 'line', encode: { x: '$by', y: '$metric' }, series: 'previous', role: 'comparison' },
    { mark: 'line', encode: { x: '$by', y: '$metric' } } ] },
  // One metric against another, a point for each value of the dimension, joined in the engine's order: by a time
  // dimension, the path the two took together.
  'connected-scatter': { layers: [
    { mark: 'line', encode: { x: '$metric', y: '$metric2' } },
    { mark: 'dot',  encode: { x: '$metric', y: '$metric2' } } ] },
  // The share of the whole held up to each value of a number dimension, which the engine returns as `$metric@cumulative`.
  // Over bins the line is steps.
  'ecdf': { layers: [
    { mark: 'line', encode: { x: '$by', y: '$metric@cumulative' } } ] },
  // What rows, bars, ticks and rules took in step 4 of the Uncommon plan (docs/archive/uncommon-coverage-plan.md). Working
  // names, all five: check each against @automattic/charts before it ships.
  // A stem from zero to a dot, for each row.
  'lollipop': { layers: [
    { mark: 'rule', encode: { y: '$by', x: '$metric' }, role: 'context' },
    { mark: 'dot',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  // With a second dimension in the query, `$split`. A row's bar divided about zero: the first half of the split's values
  // to one side and the second half to the other. Two values are a population pyramid, and five a Likert chart, which
  // is why there is no `likert`: it would be these layers under another name.
  'pyramid': { layers: [
    { mark: 'bar',  encode: { y: '$by', x: '$metric', color: '$split' }, stack: 'diverge' },
    { mark: 'text', encode: { y: '$by', text: '$by' } } ] },
  // A dot for each value of the split, on its row's track, all in one paint.
  'strip': { layers: [
    { mark: 'dot',  encode: { y: '$by', x: '$metric', detail: '$split' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } } ] },
  // Columns as wide as their share of the whole, each divided by share.
  'marimekko': { layers: [
    { mark: 'bar', encode: { x: '$by', y: '$metric', color: '$split', size: '$metric' }, stack: 'normalize' } ] },
  // From the least to the most, with the opening to the start and the close to the end. The stroke is the central mark here, as a candlestick's body is.
  'ohlc': { layers: [
    { mark: 'rule', encode: { x: '$by', y: '$metric@min', y2: '$metric@max' }, role: 'primary' },
    { mark: 'tick', encode: { x: '$by', y: '$metric@open' }, align: 'start' },
    { mark: 'tick', encode: { x: '$by', y: '$metric@close' }, align: 'end' } ] },
};

/** Register every example, for the suite that calls it: vitest gives each file a registry of its own. */
export const useExamples = (): void => Object.entries(EXAMPLES).forEach(([name, preset]) => registerPreset(name, preset));

/** The samples that were written with one of these, by the sample's name. Each is the preset's layers written out now. */
const WRITTEN_WITH: Record<string, string> = { box: 'box-plot', errors: 'error-bars', waterfall: 'waterfall', candlestick: 'candlestick', fan: 'fan', dumbbell: 'dumbbell', bullet: 'bullet', symbols: 'symbol-map', spaghetti: 'spaghetti', tiles: 'tile-grid-map', hexes: 'hex-tile-map', rose: 'rose', rings: 'radial-bar', sunburst: 'sunburst', waffle: 'waffle', units: 'unit-chart', isotype: 'isotype', parliament: 'parliament', icons: 'icon-array', cleveland: 'dumbbell', lollipop: 'lollipop', connected: 'connected-scatter', ecdf: 'ecdf', bump: 'bump', difference: 'difference', pyramid: 'pyramid', likert: 'pyramid', strip: 'strip', marimekko: 'marimekko', ohlc: 'ohlc', roses: 'rose' };
/** Samples as they were written before the cut: `use` in place of the layers it expands to, so that a case may change
 * a sample's query and have the slots filled again. test/coverage.test.ts sweeps the samples as they are written. */
export const inUse = <T extends Record<string, { spec: Spec }>>(samples: T): T =>
  Object.fromEntries(Object.entries(samples).map(([name, s]) => { const { layers: _layers, ...spec } = s.spec; return [name, WRITTEN_WITH[name] ? { ...s, spec: { ...spec, use: WRITTEN_WITH[name] } } : s]; })) as T;
