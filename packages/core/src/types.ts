import type { FitRule } from './fit.ts';

/* Catalog: the slice of the semantic model the front end needs.
 * Each `as const` list here is the one source of a union below and of the enum the schemas give it (test/core.test.ts compares them). */
export const POLARITIES = ['up', 'down', 'none'] as const;
export type Polarity = (typeof POLARITIES)[number];
export const RANGE_TOTALS = ['sum', 'sum of daily'] as const;
export const DIMENSION_TYPES = ['time', 'categorical', 'number'] as const;
export const DIMENSION_VALUES = ['country'] as const;
/** A currency is its ISO 4217 code in lower case, `usd` or `eur`: each is a unit of its own, so two currencies never share an axis. */
export type Unit = 'count' | 'ratio' | 'percent' | 'ms' | 's' | 'bytes' | 'rank' | (string & {});
export interface MetricDef {
  label: string;
  /** What the metric is measured in, which is how its values are written (format.ts). `ratio` is a rate from 0 to 1 and
   * `percent` one from 0 to 100; money is in its currency's own units, dollars and not cents; `ms` and `s` are lengths of time.
   * `rank` is a place in an order, 1 the first: its scale runs from 1 at the top, and it is written "1st". */
  unit: Unit;
  polarity: Polarity;
  /** What the number counts, caveats included, in a sentence or two. Carried on the tldr value as its `note`, so the
   * caveat travels with the number: a painter shows it when the number is pointed at. It is too long to stand under the number. */
  definition?: string;
  rangeTotal?: (typeof RANGE_TOTALS)[number];
  instant?: boolean;
  /** The range a value is read against, where it has one: the two ends of a gauge. Proposed to the API's owners, as the
   * next two are (chart-coverage-plan, section 3.5). */
  domain?: [number, number];
  /** The value to reach. */
  target?: number;
  /** Where the domain is divided, in ascending order: each is where one band ends and the next begins. Drawn behind a
   * row's marks by a `bar` with nothing on x, in the paints `band.1` to `band.3`, the least first. */
  bands?: number[];
}
export interface DimensionDef {
  label: string;
  /** `number` is a quantity the engine has cut into bins, or sampled along. Each row holds where its bin starts, and where it
   * ends as `<dimension>@end`. Proposed to the API's owners (chart-coverage-plan, section 3.5). */
  type: (typeof DIMENSION_TYPES)[number];
  /** What the values are codes of, when the engine sends codes: `country` is ISO 3166-1 alpha-2, in capitals, and is
   * written as the country's name. */
  values?: (typeof DIMENSION_VALUES)[number];
}
export interface Catalog {
  /** By name. A companion the engine returns with a metric (`pageviews@rank`) may have an entry of its own, under its
   * whole name, where it is not in its metric's unit: its unit, label and polarity are then read from there. One with
   * no entry is in its metric's. */
  metrics: Record<string, MetricDef>;
  dimensions: Record<string, DimensionDef>;
}
/** The field a companion came with: `pageviews` of `pageviews@rank`, and a field with no suffix itself. */
export const baseOf = (f: string): string => f.split('@')[0]!;

/* Query and result. */
export interface Query {
  metrics: string[];
  /** One dimension or two. With two, rows come back long: one per pair. */
  by?: string[];
  range?: string;
  compare?: 'previous';
  limit?: number;
}
export type Row = Record<string, string | number | boolean | null | undefined>;
export interface Result {
  rows: Row[];
  totals: Record<string, number | null>;
  /** With two dimensions in `by`: for each one, a row per value holding the metrics' totals over the other, in the
   * dimension's own order. A total covers the rows past `limit`. Proposed to the API's owners (chart-coverage-plan, section 3.5). */
  totalsBy?: Record<string, Row[]>;
  /** The domain each scale takes, by the scale's name, where this result is one view's of a facet: the widest any of
   * the facet's views would take alone, so they are read against one another. `facets` sets it; an engine does not send it. */
  domains?: Domains;
  meta: { range?: string; compare: string | null; notes: string[]; empty?: boolean };
}
export type Domains = Record<string, [number, number]>;

/* The view spec. */
/** The marks core draws, and the name of any custom mark registered in code (marks.ts).
 * `unit` draws a value as counted glyphs, one for so many, where a `bar` or an `arc` would draw it as a length. Its
 * form is what is on its channels: a dimension on x and a metric on y is a stack up from the axis, a dimension on y and
 * a metric on x a run along a row's track, a metric on x and a dimension on `color` a grid of a hundred divided by
 * share, a metric on x alone that grid filled to the metric's place in its catalog `domain`, and a metric on `angle`
 * with a dimension on `color` and `sweep: "half"` seats round a half circle. What a glyph is worth comes from the data (unit.ts). */
export const MARKS = ['line', 'area', 'bar', 'rule', 'text', 'arc', 'cell', 'dot', 'tick', 'unit'] as const;
export type Mark = (typeof MARKS)[number] | (string & {});
/** `x2` and `y2` are the second end of a `bar`, a `rule` or an `area`: it runs from the value on `x` or `y` to the one there.
 * A `rule` may start at a number, and with all four it is a line across a plot of points, from (`x`, `y`) to (`x2`, `y2`).
 * `detail` is a dimension that splits a layer into series as one on `color` does, and paints none of them apart:
 * every series is in the layer's own paint, with no legend, and as many as the result holds.
 * On an `arc`, `angle` and `radius` take data between them, and which holds what is the form (scene.ts, sceneRadial):
 * a metric on `angle` and a dimension on `color` is a share each, and `detail` beside them a second ring; a dimension on
 * `angle` and a metric on `radius` is a slice each that reaches to its value; a dimension on `radius` and a metric on
 * `angle` is a ring each. A number on `radius` is the inner radius. */
export const CHANNELS = ['x', 'y', 'color', 'detail', 'text', 'angle', 'radius', 'size', 'x2', 'y2'] as const;
export type Channel = (typeof CHANNELS)[number];
export const ROLES = ['primary', 'comparison', 'reference', 'context'] as const;
export type Role = (typeof ROLES)[number];
export const KEEP_PARTS = ['guides', 'secondary', 'rows', 'marks'] as const;
export type KeepPart = (typeof KEEP_PARTS)[number];
export const LAYER_SERIES = ['previous', 'delta'] as const;
export const STACKS = ['zero', 'normalize', 'center', 'diverge'] as const;
export const ALIGNS = ['start', 'end'] as const;
export interface Layer {
  mark: Mark;
  encode?: Partial<Record<Channel, string | number>>;
  /** `previous` draws the metric's comparison companion. On a `text` layer in rows, `delta` says the row's change on it instead, painted by the metric's polarity. */
  series?: (typeof LAYER_SERIES)[number];
  role?: Role;
  /** On a layer split by `color`, and not by `detail`: each series starts where the one under it ends. `normalize` makes each a share of the whole,
   * and `center` sets each stack half on either side of zero. `diverge` sets the first half of the series below zero and the second
   * half above it, in their order, and with an odd count the middle one half on each side. In rows it is what lets a bar's `color` be the query's second
   * dimension: each row's bar is divided into a series for each of its values. */
  stack?: (typeof STACKS)[number];
  /** On an `arc`: the arcs run over the top half of the circle, from left to right, and not all the way round. On a
   * `unit` about a centre: its seats sit round that half, which is the one way they are drawn.
   * The one layer field that is neither data nor role. */
  sweep?: 'half';
  label?: string;
  /** On a `text` layer in rows, `end` sets it as a column of values. On a `tick`, the half of it to that side of its band's middle. */
  align?: (typeof ALIGNS)[number];
  /** A paint token in place of the layer's own. `delta` is the paint of its metric's change over the range: good or bad by
   * the metric's polarity, and the layer's own where there is no change to judge. `direction`, on a `bar` or an `area`
   * with two ends, paints each mark by which way it runs from the first end to the second: `delta.good` or `delta.bad`
   * by the metric's polarity, and the layer's own where the polarity is `none`. An area is cut where its ends cross. */
  paint?: string;
}
export interface Guides {
  x?: boolean;
  y?: boolean;
  /** The second y axis, on the far side, where the layers measure in two units. */
  y2?: boolean;
  grid?: boolean;
  /** The key to a view's series. Its shorter forms are a fit rule's to choose at a room: a label at the end of each
   * line of a split plot, the one line that names the largest of a band, a circle or a divided row. */
  legend?: boolean;
  /** Under a grid of cells: the steps of the colour scale, with its low and its high value. */
  ramp?: boolean;
  /** The labels a `text` layer sets on the points of a plot. */
  pointLabels?: boolean;
  /** The key to the sizes of a plot's dots. */
  size?: boolean;
  /** The headers over a row's columns, where it has more than one column of values. */
  columns?: boolean;
  /** The labels round a circle that a dimension on `angle` divides: which slice is which. */
  rim?: boolean;
  /** Under a `unit`'s glyphs: what one of them is worth. A scene has none where that is one. */
  unitKey?: boolean;
}
export interface Spec {
  spec?: string;
  title?: string;
  query: Query;
  use?: string | undefined;
  layers?: Layer[];
  keep?: KeepPart[];
  /** One of the query's dimensions. The spec is then a view for each of its values, every one on the same scales, and
   * the surface lays them out: a facet is a small board (reference, Decided 26 and 45). `facets` gives the views. */
  facet?: string;
}
export type PresetLibrary = Record<string, { layers: Layer[] }>;

/* The rules a context hands to every container it holds: the durable behaviour of the views in it. A container owns
 * its own size, and no plan is told it. */
export interface ContainerRules {
  /** The room each part needs, and what is given up without it. */
  fit: FitRule[];
  /* The natural heights a surface builds a plot and a row to, in px. */
  axes: { height: number };
  bare: { height: number; numberWidth: number };
  rows: { rowHeight: number; gap: number };
  /** When the tldr value sits above the marks while there is room for both. */
  tldrValue: { above: 'instant' | 'always' };
}

/* Plan: what a spec asks to have drawn, with no size. */
/** The layouts core builds. A custom mark is laid out by its own code, under its own name, which so cannot be one of these. */
export const LAYOUTS = ['cartesian', 'rows', 'band', 'radial', 'matrix', 'none', 'notice', 'prose'] as const;
export type Layout = (typeof LAYOUTS)[number] | (string & {});
/** The part of a plan the scene builders read. */
export interface PlanShape {
  layout: Layout;
  layers: Layer[];
  guides: Guides;
  tldrValue: boolean;
  share: boolean;
  text: string;
}
export interface Plan extends PlanShape {
  preset: string | null;
  layers: (Layer & { role: Role })[];
  /** What the spec asked for and the result has no data to draw: a comparison with no period before. */
  dropped: string[];
}

/* Scene: a flat list of shapes with stable keys and paint tokens, in ratios.
 * Every node names its part, and its coordinates run 0 to 1 within that part's
 * box. A scene needs no size to exist. */
export type Part = 'number' | 'plot' | 'x-axis' | 'y-axis' | 'y-axis-2' | 'labels' | 'columns' | 'rows' | 'band' | 'legend' | 'legend-top' | 'radial' | 'hole' | 'ramp' | 'notice'
  /* `points` holds the dots of a plot that sets one metric against another, and `point-labels` the labels on a plot's
   * points. Both lie over the plot and share its box. `size` is the key to the sizes of its dots. */
  | 'points' | 'point-labels' | 'size'
  /* `track` holds what runs down a list from row to row: a line or an area, which are the plot's marks on their side.
   * Its box lies over the tracks of all the rows. A node in it is as the plot's is, with the two axes exchanged: its
   * `x` is its place down the rows, from the top of the first at 0 to the foot of the last at 1, and its `v` is its
   * value along the track. A surface turns it so. A row's own marks are in `rows`. */
  | 'track'
  /* `rim` holds the labels round a circle of slices. It shares the `radial` part's box, and the circle gives up a margin to it. */
  | 'rim'
  /* `note` is a line of text under a custom mark's own parts, saying what they could not draw. It goes with the guides. */
  | 'note'
  /* `unit-key` is a line of text under a `unit`'s glyphs, saying what one of them is worth: "Each is 500". It goes with the guides. */
  | 'unit-key';
interface NodeBase {
  key: string;
  part: Part;
  paint: string;
  layer: 'data' | 'guide';
  role?: Role;
  /** Its paint is one of a legend's: a series colour that only the legend says the meaning of. Where a view's legend
   * goes with nothing in its place, a mark that has this is drawn in its layer's own paint, as a split by `detail` is:
   * the scene builders do so for a plan with no legend, and a fit rule that sets `split: plain` does in a stylesheet. */
  legend?: true;
  /** The y scale a mark is drawn on, where that is a plot's second: its layer measures in the second of two units.
   * It is read against the second y axis and nothing else, so a rule that takes that axis takes it too (`axis:2`). */
  axis?: 2;
  /** The dimension value the node came from. */
  row?: string;
  /** The value it came from of the dimension on `color` or on `detail`, where a layer is split into series. */
  series?: string;
  /** Absent stays. Ranked nodes are given up when room is short. */
  rank?: number;
  opacity?: number;
  /** A fill that tints and does not mark: the fill under a line, a row's bar behind its label, the range behind a gauge.
   * A painter with a lighter colour for the paint uses that, whole. One without draws the paint at `opacity`. */
  tone?: 'soft';
  note?: string;
}
/** A bar in the plot (`x` and `w` across, and up the plot from `v0` to `v`), a row's bar (across its track from `v0` to `v`), a band segment (`v` is its share), a legend swatch,
 * or in `band` a cell of a `unit`'s grid, with `x`, `w`, `y` and `h` as a cell of a grid of cells has them.
 * In `rows`, one whose `layer` is `guide` is a part of the range behind the row's marks, as tall as the row.
 * `v0` is absent where a bar starts at the bottom of the plot, or at the start of the track. A bar that hangs below its start has `v` under `v0`.
 * A bar with a second end runs from the first, `v0`, to it, `v`, and is painted by which way it goes. */
export interface RectNode extends NodeBase {
  kind: 'rect'; x?: number; w?: number; v?: number; v0?: number;
  /** A cell of a grid: `y` and `h` down the plot from its top, as `x` and `w` run across it. */
  y?: number; h?: number;
  /** The two dimension values a cell came from: the one on x, then the one on y. A cell has no `row`. */
  pair?: [x: string, y: string];
}
/** `d` is drawn in a 100 by 100 box, for the painter to stretch. `points` are what it was drawn from. An area's point has `v0` where it starts above the bottom of the plot.
 * A point with no `row` is where the two ends of an area cross, between two rows. With `curve: "step"` a point is a flat run `w` wide about its `x`: its bin.
 * A path in `points` joins the points of two metrics in the order of their rows, straight from each to the next, and has no `curve`.
 * With `curve: "radial"` it is about a centre, in a circle's part: a point's `x` is its place round the circle, in turns from the top, and its `v` how far out it
 * reaches, and `d` is drawn about the origin at a radius of 50, closed, as an arc's is. */
export interface PathNode extends NodeBase {
  kind: 'path';
  d: string | null;
  points: { row?: string; x: number; v: number; v0?: number; w?: number }[];
  curve?: 'monotone' | 'step' | 'radial';
  fill?: boolean;
  width?: number;
  dash?: string | null;
}
/** A line across the plot at height `t`. The one at zero is painted `axis`, and sits above the bottom of the plot where values go below zero.
 * With `x`, `x2` and `t2` it is the segment from (`x`, `t`) to (`x2`, `t2`): a rule at a value on x stands from 0 to 1 at one `x`.
 * One with a `row` is that row's own: a rule from one of its values to another, or a tick across its band at one. In `rows` it is in the row's
 * track: `x` and `x2` run along the track and `t` up the row, so a rule lies at 0.5 and a tick stands from 0 to 1. */
export interface LineNode extends NodeBase { kind: 'line'; t: number; x?: number; x2?: number; t2?: number; width?: number; dash?: string }
/** The pulse beside the number, or a dot at `x` and `t`: in `plot` on a time or category axis, in `points` where x is a metric too, and in `rows` along a row's track, half way up it. `size` is a step from 1 up, not a radius: how big a step is, in pixels, is the painter's.
 * A glyph of a `unit` states the room it has, as a cell states its own: `w` across and `h` up, as ratios of its part's
 * box, with `x` and `t` at the middle of it. A scene cannot say that it is round, since the two ratios are of different
 * lengths, so a painter draws the largest circle that room holds, by the lesser of the two in pixels: in a plot a glyph
 * is as wide as its band where the plot is tall enough, and where it is not, as tall as its share of the height.
 * In `radial` it is a seat, and `x` and `t` are across and up the part's box, as a point's are in a plot. */
export interface CircleNode extends NodeBase { kind: 'circle'; pulse: boolean; x?: number; t?: number; size?: number; w?: number; h?: number;
  /** A dot of a grid: the two dimension values it stands at, as a cell's. It has no `row`. */
  pair?: [x: string, y: string];
}
/** One row of the `rows` part: the thing a painter keys and a reader chooses. It draws nothing itself. */
export interface RowNode extends NodeBase { kind: 'row'; row: string }
/** Text in the number, rows, legend and notice parts is set in order and carries no position. In `labels` it sits beside the plot at height `t`.
 * In `point-labels` it sits on the point at `x` and `t`, and its `rank` is its place among them, the largest point first.
 * In `rows`, text in the `value` face is a column: the first has no `rank`, and each one after it has its place among them as its rank,
 * so the last is given up first. A header in `columns` has the rank of the column it is over.
 * In `rim` it names a slice of a circle: `x` and `t` are where the middle of the slice meets the rim, as ratios of the
 * `radial` part's box, and a painter sets it outside that point. The ranked ones are given up where they would meet. */
export interface TextNode extends NodeBase {
  kind: 'text';
  text: string;
  /** A shorter form, for when room is short. */
  short?: string;
  x?: number;
  t?: number;
  anchor: 'start' | 'middle' | 'end';
  baseline?: 'middle';
  font: 'tick' | 'label' | 'value' | 'display';
  halo?: boolean;
}
/** An arc about the centre of the `radial` part. `a0` and `a1` are in turns, clockwise from the top, and below zero to the
 * left of it. `r0` and `r1` are ratios of the part's radius. `d` is drawn about the origin at a radius of 50, so the
 * part's box runs from -50 to 50: `arcD(node)`. A painter with a size draws `arcD(node, radius)`.
 * In a second ring an arc has its parent's `row` and its own value as `series`. */
export interface ArcNode extends NodeBase { kind: 'arc'; a0: number; a1: number; r0: number; r1: number; d: string }
export type SceneNode = RectNode | PathNode | LineNode | CircleNode | TextNode | ArcNode | RowNode;
export interface Scene {
  layout: Layout;
  /** The parts the plan shows, with all the room they ask for. The number's nodes are in the scene either way, so a fit
   * rule can show it in compensation. So are both forms of a band's legend, `legend` and `legend-top`, and of a split
   * plot's, `legend` and `labels`, so a rule can swap them. Which of them show at a room is `fitTo`'s to say. */
  parts: Part[];
  /** Dimension values in order: the x domain, the rows or the segments. Of a circle: its segments, slices or rings. */
  rows?: string[];
  /** The colour dimension's values in its own order, where a plot is split into series. A series' paint is its place here. */
  series?: string[];
  /** The values of the dimension on `detail`, in its own order, where a plot is split into series that are not painted
   * apart: each is the `series` of its nodes, all in one paint, and there is no legend. Absent where `series` is given.
   * Of a circle with a second ring: the values that ring divides each segment into, each in its segment's paint. */
  detail?: string[];
  /** In a grid, the y dimension's values in order, from the top. `rows` are then its columns. */
  ys?: string[];
  /** How x is shared among the rows of a plot. With `point`, marks sit 2 px inside each edge; that inset is the painter's.
   * With `linear`, x is a metric or a numeric dimension, and every node in the plot carries its own `x`. */
  scale?: 'band' | 'point' | 'linear';
  /** In `rows`: the track stands beside the label and the values, and not behind them, because its marks are read by where they are: a dot, a rule, a tick, or a bar with two ends. */
  track?: 'beside';
  /** Where a part holds its shape, its width over its height: 1 for a circle of arcs, 2 for the top half of one, 1 for a `unit`'s grid in `band`.
   * A painter fits a box of that shape inside the room the part has, and never stretches it. */
  aspect?: number;
  nodes: SceneNode[];
  text?: string;
}
