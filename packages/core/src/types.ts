import type { FitRule } from './fit.ts';

/* Catalog: the slice of the semantic model the front end needs. */
export type Polarity = 'up' | 'down' | 'none';
export interface MetricDef {
  label: string;
  unit: string;
  polarity: Polarity;
  rangeTotal?: 'sum' | 'sum of daily';
  instant?: boolean;
}
export interface DimensionDef {
  label: string;
  type: 'time' | 'categorical';
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
  meta: { range: string; compare: string | null; notes: string[]; empty?: boolean };
}

/* The view spec. */
export type Mark = 'line' | 'area' | 'bar' | 'rule' | 'text';
export type Channel = 'x' | 'y' | 'color' | 'text';
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
  label?: string;
  align?: 'end';
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
  /** The headers over a row's columns, where it has more than one column of values. */
  columns?: boolean;
}
export interface Spec {
  spec?: string;
  title?: string;
  query: Query;
  use?: string;
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
export type Layout = 'cartesian' | 'rows' | 'band' | 'none' | 'notice' | 'prose';
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
export type Part = 'number' | 'plot' | 'x-axis' | 'y-axis' | 'y-axis-2' | 'labels' | 'columns' | 'rows' | 'band' | 'legend' | 'legend-top' | 'notice';
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
  note?: string;
}
/** A bar in the plot (`x` and `w` across, and up the plot from `v0` to `v`), a row's bar (across its track from `v0` to `v`), a band segment (`v` is its share) or a legend swatch.
 * `v0` is absent where a bar starts at the bottom of the plot, or at the start of the track. A bar that hangs below its start has `v` under `v0`. */
export interface RectNode extends NodeBase { kind: 'rect'; x?: number; w?: number; v?: number; v0?: number }
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
/** A line across the plot at height `t`. The one at zero is painted `axis`, and sits above the bottom of the plot where values go below zero. */
export interface LineNode extends NodeBase { kind: 'line'; t: number; width?: number; dash?: string }
export interface CircleNode extends NodeBase { kind: 'circle'; pulse: boolean }
/** One row of the `rows` part: the thing a painter keys and a reader chooses. It draws nothing itself, and place() leaves it out. */
export interface RowNode extends NodeBase { kind: 'row'; row: string }
/** Text in the number, rows, legend and notice parts is set in order and carries no position. In `labels` it sits beside the plot at height `t`.
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
export type SceneNode = RectNode | PathNode | LineNode | CircleNode | TextNode | RowNode;
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
  /** How x is shared among the rows of a plot. With `point`, marks sit 2 px inside each edge; that inset is the painter's. */
  scale?: 'band' | 'point';
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
  cell?: number;
  halo?: boolean;
}
export type PlacedNode = PlacedRect | PlacedPath | PlacedLine | PlacedCircle | PlacedText;
export interface PlacedScene {
  width: number;
  height: number;
  nodes: PlacedNode[];
  plot?: { w: number; h: number };
  text?: string;
}
