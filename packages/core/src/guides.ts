import { customMarks } from './marks.ts';
import { columnsOf, isDim, isMetric, measuresOf, unitsOf } from './scene.ts';
import type { Catalog, Channel, Guides, Layer, Layout, Part } from './types.ts';

/* Guides: the axes, the grid, the legend, the ramp and the keys. None is authored (reference, section 8). Each is read
 * off a scale, so a view has one because of what its layers encode and for no other reason, and this table is where
 * that is said, once: the parts a guide is painted in, the channel whose scale it is read off, and what a view's
 * layers must encode for it to have one.
 *
 * It says that a view has a guide. Which form the guide takes at a size, and when it goes, is the fit rules' to say
 * (fit.ts), which fitTo() reads. A guide that is built is added here, and the plan, explain() and the check on the
 * fit rules have it from here. */

export interface GuideView { layout: Layout; layers: Layer[]; catalog: Catalog }
export interface Guide {
  /** The parts it is painted in. A legend has three forms, each a part of its own. A grid is lines in the plot. */
  parts: Part[];
  /** The channel whose scale it is read off, where it is one channel's. */
  channel?: Channel;
  /** A key says what an encoding means: which colour is which, what a size or a glyph stands for, which scale a mark
   * is on, which column or slice is which. Its marks cannot be read without it, where an axis or a grid frames marks
   * that still read by their shape. So no fit rule may take a key while the marks it keys are drawn: the rules that
   * do are listed, and held to that list, in test/guides.test.ts. */
  key?: true;
  /** For a key to some of a view's marks and not all: the fit target of those marks. A rule that takes the key takes them. */
  marks?: string;
  /** For a key whose marks can be drawn without the encoding it keys: the switch a rule sets where it takes the key,
   * and its value (fit.ts, `set`). Dots are then of one size, and series in one paint. */
  plain?: [string, string];
  /** Whether a view has it. */
  from(view: GuideView): boolean;
}

/** The layouts whose positions are read against axes: a plot's, and a grid's. */
const FRAMED: Layout[] = ['cartesian', 'matrix'];
const some = ({ layers }: GuideView, test: (l: Layer) => boolean) => layers.some(test);

export const GUIDES: Record<keyof Guides, Guide> = {
  x:           { parts: ['x-axis'], channel: 'x', from: (v) => FRAMED.includes(v.layout) },
  y:           { parts: ['y-axis'], channel: 'y', from: (v) => FRAMED.includes(v.layout) },
  grid:        { parts: [], channel: 'y', from: (v) => v.layout === 'cartesian' },
  // Layers that measure in two units have a y scale each, and the second has its axis on the far side. It is the key
  // to the marks drawn on that scale, and to no others.
  y2:          { parts: ['y-axis-2'], channel: 'y', key: true, marks: 'axis:2', from: (v) => v.layout === 'cartesian' && unitsOf(v.catalog, v.layers).length > 1 },
  // The colour scale, where it tells things apart: the values of a dimension on color, or in a plot the metrics its
  // layers measure, where they measure several. All of it, one line of it, or a label at the end of each line.
  // Not where the dimension is the rows' own, which a row's label says already.
  legend:      { parts: ['legend', 'legend-top', 'labels'], channel: 'color', key: true, plain: ['split', 'plain'],
                 from: (v) => some(v, (l) => isDim(v.catalog, l.encode?.color) && l.encode!.color !== l.encode!.y) || (v.layout === 'cartesian' && measuresOf(v.catalog, v.layers).length > 1) },
  // The colour scale, where its values are a metric's.
  ramp:        { parts: ['ramp'], channel: 'color', key: true, from: (v) => some(v, (l) => isMetric(v.catalog, l.encode?.color)) },
  // On a bar a size is its column's width, which the axis under it says.
  size:        { parts: ['size'], channel: 'size', key: true, plain: ['dots', 'one'], from: (v) => some(v, (l) => l.mark !== 'bar' && l.encode?.size != null) },
  // Labels on the points of a plot are a layer of marks, and go as a guide goes. They key nothing.
  pointLabels: { parts: ['point-labels'], channel: 'text', from: (v) => (v.layout === 'cartesian' || v.layout === 'matrix') && some(v, (l) => l.mark === 'text') },
  columns:     { parts: ['columns'], key: true, from: (v) => v.layout === 'rows' && columnsOf(v.catalog, v.layers).length > 1 },
  rim:         { parts: ['rim'], channel: 'angle', key: true, from: (v) => some(v, (l) => isDim(v.catalog, l.encode?.angle)) },
  unitKey:     { parts: ['unit-key'], key: true, from: (v) => some(v, (l) => l.mark === 'unit') },
};

/** The guides a view has, by what its layers encode: each on, and the legend whole. A custom mark is asked nothing:
 * its two keys start on together, and its scene says which of them it has (marks.ts). */
export function guidesOf(layout: Layout, layers: Layer[], catalog: Catalog): Guides {
  if (customMarks().has(layout)) return { ramp: true, size: true, ...(layers.some((l) => l.mark === 'text') && { pointLabels: true }) };
  const view = { layout, layers, catalog }, out: Record<string, unknown> = {};
  for (const [name, guide] of Object.entries(GUIDES)) if (guide.from(view)) out[name] = true;
  return out as Guides;
}

/** The channel each guide part is read off: where explain() says a part came from. */
export const GUIDE_CHANNEL: Record<string, Channel> = Object.fromEntries(Object.values(GUIDES).flatMap((g) => (g.channel ? g.parts.map((p) => [p, g.channel!]) : [])));
