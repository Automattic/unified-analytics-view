import type { FitRule } from './fit.ts';

/* Catalog: the slice of the semantic model the front end needs. */
export type Polarity = 'up' | 'down' | 'none';
/** A currency is its ISO 4217 code in lower case, `usd` or `eur`: each is a unit of its own, so two currencies never share an axis. */
export type Unit = 'count' | 'ratio' | 'percent' | 'ms' | 's' | 'bytes' | (string & {});
export interface MetricDef {
  label: string;
  /** What the metric is measured in, which is how its values are written (format.ts). `ratio` is a rate from 0 to 1 and
   * `percent` one from 0 to 100; money is in its currency's own units, dollars and not cents; `ms` and `s` are lengths of time. */
  unit: Unit;
  polarity: Polarity;
  /** What the number counts, caveats included, in a sentence or two. Carried on the tldr value as its `note`, so the
   * caveat travels with the number: a painter shows it when the number is pointed at. It is too long to stand under the number. */
  definition?: string;
  rangeTotal?: 'sum' | 'sum of daily';
  instant?: boolean;
  /** The range a value is read against, where it has one: the two ends of a gauge. Proposed to the API's owners, as the
   * next two are (chart-coverage-plan, section 3.5). */
  domain?: [number, number];
  /** The value to reach. */
  target?: number;
  /** Where the domain is divided, in ascending order: each is where one band ends and the next begins. */
  bands?: number[];
}
export interface DimensionDef {
  label: string;
  /** `number` is a quantity the engine has cut into bins, or sampled along. Each row holds where its bin starts, and where it
   * ends as `<dimension>@end`. Proposed to the API's owners (chart-coverage-plan, section 3.5). */
  type: 'time' | 'categorical' | 'number';
  /** What the values are codes of, when the engine sends codes: `country` is ISO 3166-1 alpha-2, in capitals, and is
   * written as the country's name. */
  values?: 'country';
}
export interface Catalog {
  metrics: Record<string, MetricDef>;
  dimensions: Record<string, DimensionDef>;
}

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
  meta: { range?: string; compare: string | null; notes: string[]; empty?: boolean };
}

/* The view spec. */
/** The marks core draws, and the name of any custom mark registered in code (marks.ts). */
export type Mark = 'line' | 'area' | 'bar' | 'rule' | 'text' | 'arc' | 'cell' | 'dot' | 'tick' | (string & {});
/** `x2` and `y2` are the second end of a `bar`, a `rule` or an `area`: it runs from the value on `x` or `y` to the one there. */
export type Channel = 'x' | 'y' | 'color' | 'text' | 'angle' | 'radius' | 'size' | 'x2' | 'y2';
export type Role = 'primary' | 'comparison' | 'reference' | 'context';
export type KeepPart = 'guides' | 'secondary' | 'rows' | 'marks';
export interface Layer {
  mark: Mark;
  encode?: Partial<Record<Channel, string | number>>;
  /** `previous` draws the metric's comparison companion. On a `text` layer in rows, `delta` says the row's change on it instead, painted by the metric's polarity. */
  series?: 'previous' | 'delta';
  role?: Role;
  /** On a layer split by `color`: each series starts where the one under it ends. `normalize` makes each a share of the whole,
   * and `center` sets each stack half on either side of zero. */
  stack?: 'zero' | 'normalize' | 'center';
  /** On an `arc`: the arcs run over the top half of the circle, from left to right, and not all the way round.
   * The one layer field that is neither data nor role. */
  sweep?: 'half';
  label?: string;
  align?: 'end';
  /** A paint token in place of the layer's own. `delta` is the paint of its metric's change over the range: good or bad by
   * the metric's polarity, and the layer's own where there is no change to judge. */
  paint?: string;
}
export interface Guides {
  x?: boolean;
  y?: boolean;
  /** The second y axis, on the far side, where the layers measure in two units. */
  y2?: boolean;
  grid?: boolean;
  /** On a band, `top` is the largest segment's label. On a split plot, `labels` is a label at the end of each line. */
  legend?: 'full' | 'top' | 'labels';
  /** Under a grid of cells: the steps of the colour scale, with its low and its high value. */
  ramp?: boolean;
  /** The labels a `text` layer sets on the points of a plot. */
  pointLabels?: boolean;
  /** The key to the sizes of a plot's dots. */
  size?: boolean;
  /** The headers over a row's columns, where it has more than one column of values. */
  columns?: boolean;
}
export interface Spec {
  spec?: string;
  title?: string;
  query: Query;
  use?: string | undefined;
  layers?: Layer[];
  keep?: KeepPart[];
}
export type PresetLibrary = Record<string, { layers: Layer[] }>;

/* Container: wherever a view renders. It owns sizes, and its rules are the
 * durable behaviour a context hands to every container it holds. */
export type ReductionId = 'drop-guides' | 'drop-secondary' | 'trim-rows' | 'collapse' | 'prose';
export interface ContainerRules {
  /** The room each part needs, and what is given up without it. */
  fit: FitRule[];
  /* Sizes the pixel scene is built to. */
  axes: { height: number };
  bare: { height: number; numberWidth: number };
  rows: { rowHeight: number; gap: number };
  /** When the tldr value sits above the marks while there is room for both. */
  tldrValue: { above: 'instant' | 'always' };
  order: ReductionId[];
}
export type PainterName = 'svg' | 'dots';
export interface Container {
  width: number;
  height: number | null;
  painter: PainterName;
  cell: number;
  rules: ContainerRules;
  /** Metrics of the tldr value's face at this length and available width. */
  display(len: number, avail: number, small?: boolean): { h: number; cell?: number };
  displayWidth(len: number): number;
}

/* Plan: what will be drawn at this size, and what was dropped. */
/** A custom mark is laid out by its own code, under its own name. */
export type Layout = 'cartesian' | 'rows' | 'band' | 'radial' | 'matrix' | 'none' | 'notice' | 'prose' | (string & {});
export interface Reduction {
  id: ReductionId;
  state: 'not needed' | 'applied' | 'kept by the spec' | 'nothing to drop';
}
/** The part of a plan the scene builders read. */
export interface PlanShape {
  layout: Layout;
  layers: Layer[];
  guides: Guides;
  tldrValue: boolean;
  side: boolean;
  rowLimit: number | null;
  share: boolean;
  text: string;
}
export interface Plan extends PlanShape {
  preset: string | null;
  layers: (Layer & { role: Role })[];
  reductions: Reduction[];
  dropped: string[];
  needs: { width: number; height: number };
}

/* Scene: a flat list of shapes with stable keys and paint tokens, in ratios.
 * Every node names its part, and its coordinates run 0 to 1 within that part's
 * box. A scene needs no size to exist. Pixel painters get theirs from place(). */
export type Part = 'number' | 'plot' | 'x-axis' | 'y-axis' | 'y-axis-2' | 'labels' | 'columns' | 'rows' | 'band' | 'legend' | 'legend-top' | 'radial' | 'hole' | 'ramp' | 'notice'
  /* `points` holds the dots of a plot that sets one metric against another, and `point-labels` the labels on a plot's
   * points. Both lie over the plot and share its box. `size` is the key to the sizes of its dots. */
  | 'points' | 'point-labels' | 'size'
  /* `note` is a line of text under a custom mark's own parts, saying what they could not draw. It goes with the guides. */
  | 'note';
interface NodeBase {
  key: string;
  part: Part;
  paint: string;
  layer: 'data' | 'guide';
  role?: Role;
  /** The dimension value the node came from. */
  row?: string;
  /** The value of the colour dimension it came from, where a layer is split into series. */
  series?: string;
  /** Absent stays. Ranked nodes are given up when room is short. */
  rank?: number;
  opacity?: number;
  /** A fill that tints and does not mark: the fill under a line, a row's bar behind its label, the range behind a gauge.
   * A painter with a lighter colour for the paint uses that, whole. One without draws the paint at `opacity`. */
  tone?: 'soft';
  note?: string;
}
/** A bar in the plot (`x` and `w` across, and up the plot from `v0` to `v`), a row's bar (across its track from `v0` to `v`), a band segment (`v` is its share) or a legend swatch.
 * `v0` is absent where a bar starts at the bottom of the plot, or at the start of the track. A bar that hangs below its start has `v` under `v0`.
 * A bar with a second end runs from the first, `v0`, to it, `v`, and is painted by which way it goes. */
export interface RectNode extends NodeBase {
  kind: 'rect'; x?: number; w?: number; v?: number; v0?: number;
  /** A cell of a grid: `y` and `h` down the plot from its top, as `x` and `w` run across it. */
  y?: number; h?: number;
  /** The two dimension values a cell came from: the one on x, then the one on y. A cell has no `row`. */
  pair?: [x: string, y: string];
}
/** `d` is drawn in a 100 by 100 box, for the painter to stretch. `points` are what it was drawn from. An area's point has `v0` where it starts above the bottom of the plot. */
export interface PathNode extends NodeBase {
  kind: 'path';
  d: string | null;
  points: { row: string; x: number; v: number; v0?: number }[];
  curve?: 'monotone';
  fill?: boolean;
  width?: number;
  dash?: string | null;
}
/** A line across the plot at height `t`. The one at zero is painted `axis`, and sits above the bottom of the plot where values go below zero.
 * With `x`, `x2` and `t2` it is the segment from (`x`, `t`) to (`x2`, `t2`): a rule at a value on x stands from 0 to 1 at one `x`.
 * One with a `row` is that row's own: a rule from one of its values to another, or a tick across its band at one. In `rows` it is in the row's
 * track: `x` and `x2` run along the track and `t` up the row, so a rule lies at 0.5 and a tick stands from 0 to 1. */
export interface LineNode extends NodeBase { kind: 'line'; t: number; x?: number; x2?: number; t2?: number; width?: number; dash?: string }
/** The pulse beside the number, or a dot at `x` and `t`: in `plot` on a time or category axis, in `points` where x is a metric too, and in `rows` along a row's track, half way up it. `size` is a step from 1 up, not a radius: how big a step is, in pixels, is the painter's. */
export interface CircleNode extends NodeBase { kind: 'circle'; pulse: boolean; x?: number; t?: number; size?: number }
/** One row of the `rows` part: the thing a painter keys and a reader chooses. It draws nothing itself, and place() leaves it out. */
export interface RowNode extends NodeBase { kind: 'row'; row: string }
/** Text in the number, rows, legend and notice parts is set in order and carries no position. In `labels` it sits beside the plot at height `t`.
 * In `point-labels` it sits on the point at `x` and `t`, and its `rank` is its place among them, the largest point first.
 * In `rows`, text in the `value` face is a column: the first has no `rank`, and each one after it has its place among them as its rank,
 * so the last is given up first. A header in `columns` has the rank of the column it is over. */
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
 * part's box runs from -50 to 50: `arcD(node)`. A painter with a size draws `arcD(node, radius)`. */
export interface ArcNode extends NodeBase { kind: 'arc'; a0: number; a1: number; r0: number; r1: number; d: string }
export type SceneNode = RectNode | PathNode | LineNode | CircleNode | TextNode | ArcNode | RowNode;
export interface Scene {
  layout: Layout;
  /** The parts the plan shows. The number's nodes are in the scene either way, so a fit rule can show it in compensation.
   * So are both forms of a band's legend, `legend` and `legend-top`, and of a split plot's, `legend` and `labels`, so a rule can swap them.
   * place() draws only the parts named here. */
  parts: Part[];
  /** The number sits beside a bare plot. */
  side?: boolean;
  /** Dimension values in order: the x domain, the rows or the segments. */
  rows?: string[];
  /** The colour dimension's values in its own order, where a plot is split into series. A series' paint is its place here. */
  series?: string[];
  /** In a grid, the y dimension's values in order, from the top. `rows` are then its columns. */
  ys?: string[];
  /** How x is shared among the rows of a plot. With `point`, marks sit 2 px inside each edge; that inset is the painter's.
   * With `linear`, x is a metric or a numeric dimension, and every node in the plot carries its own `x`. */
  scale?: 'band' | 'point' | 'linear';
  /** In `rows`: the track stands beside the label and the values, and not behind them, because its marks are read by where they are: a dot, a rule, a tick, or a bar with two ends. */
  track?: 'beside';
  /** Where a part holds its shape, its width over its height: 1 for a circle of arcs, 2 for the top half of one.
   * A painter fits a box of that shape inside the room the part has, and never stretches it. */
  aspect?: number;
  nodes: SceneNode[];
  text?: string;
}

/* Placed scene: the same nodes in pixels, for painters with no CSS. */
interface PlacedBase {
  key: string;
  paint: string;
  layer: 'data' | 'guide';
  opacity?: number;
  tx?: number;
  ty?: number;
  note?: string;
}
export interface PlacedRect extends PlacedBase { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number }
export interface PlacedPath extends PlacedBase { kind: 'path'; d: string | null; fill?: boolean; width?: number; dash?: string | null }
export interface PlacedLine extends PlacedBase { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width?: number; dash?: string }
export interface PlacedCircle extends PlacedBase { kind: 'circle'; cx: number; cy: number; r: number; pulse: boolean }
export interface PlacedText extends PlacedBase {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  baseline?: 'middle';
  font: 'tick' | 'label' | 'value' | 'display';
  h?: number;
  cell?: number | undefined;
  halo?: boolean;
}
export type PlacedNode = PlacedRect | PlacedPath | PlacedLine | PlacedCircle | PlacedText;
export interface PlacedScene {
  width: number;
  height: number;
  nodes: PlacedNode[];
  plot?: { w: number; h: number };
  text?: string | undefined;
}
