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
  by?: string[];
  range?: string;
  compare?: 'previous';
  limit?: number;
}
export type Row = Record<string, string | number | boolean | null | undefined>;
export interface Result {
  rows: Row[];
  totals: Record<string, number | null>;
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
  series?: 'previous';
  role?: Role;
  stack?: 'normalize';
  label?: string;
  align?: 'end';
  paint?: string;
}
export interface Guides {
  x?: boolean;
  y?: boolean;
  grid?: boolean;
  legend?: 'full' | 'top';
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
  axes: { minWidth: number; minHeight: number; height: number };
  secondary: { minPlotWidth: number; minPlotHeight: number };
  bare: { minPlotWidth: number; height: number };
  rows: { rowHeight: number; gap: number; minLabelWidth: number };
  band: { minWidth: number; minWidthWithLegend: number };
  notice: { minWidth: number };
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

/* Scene: a flat list of positioned shapes with stable keys and paint tokens. */
interface NodeBase {
  key: string;
  paint: string;
  layer: 'data' | 'guide';
  opacity?: number;
  tx?: number;
  ty?: number;
  note?: string;
}
export interface RectNode extends NodeBase { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number }
export interface PathNode extends NodeBase { kind: 'path'; d: string | null; fill?: boolean; width?: number; dash?: string | null }
export interface LineNode extends NodeBase { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width?: number; dash?: string }
export interface CircleNode extends NodeBase { kind: 'circle'; cx: number; cy: number; r: number; pulse: boolean }
export interface TextNode extends NodeBase {
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
export type SceneNode = RectNode | PathNode | LineNode | CircleNode | TextNode;
export interface Scene {
  width: number;
  height: number;
  nodes: SceneNode[];
  plot?: { w: number; h: number };
  text?: string;
}
