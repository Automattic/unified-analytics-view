import { orList } from './format.ts';
import { customMarks } from './marks.ts';
import { isDim, isMetric } from './scene.ts';
import type { Catalog, Channel, Layer, Layout } from './types.ts';

/* What each mark reads: for each layout, the marks it draws, and for each of those the channels it reads and what a
 * channel may hold there. It is data, and it is the list. An encoding that is not here is one no code looks at, so
 * resolve() refuses it by name (checkReads), where it was once dropped and the view drawn without it.
 *
 * It says what one channel may hold. What a mark asks of several together (a second end needs a first, a size on a
 * bar needs a plot of shares) is still said where the mark is drawn, and those errors come first.
 *
 * A mark or a channel that is built is added here in the same change: the scene builders are what this describes
 * (scene.ts), and section 7 of the reference is held to it (test/reads.test.ts). */

/** What a channel holds. A companion the engine returns with a metric (`visitors@p25`) is a quantity, as its metric
 * is, and is a `metric` here. A `companion` is one returned with a dimension (`source@kind`). */
export type Held = 'dimension' | 'metric' | 'number' | 'companion';
/** The channels a mark reads, and what each may hold. */
export type Reads = Partial<Record<Channel, readonly Held[]>>;

const D = 'dimension', M = 'metric', N = 'number', C = 'companion';
export const READS: Record<string, Record<string, Reads>> = {
  cartesian: {
    line: { x: [D, M],    y: [M],    color: [D], detail: [D] },
    area: { x: [D],       y: [M],    y2: [M, N], color: [D], detail: [D] },
    bar:  { x: [D],       y: [M, N], y2: [M, N], color: [D], detail: [D], size: [M] },
    rule: { x: [D, M, N], y: [M, N], x2: [M, N], y2: [M, N], detail: [D] },
    dot:  { x: [D, M],    y: [M],    color: [D], detail: [D], size: [M] },
    tick: { x: [D, M],    y: [M],    detail: [D] },
    text: { x: [D, M],    y: [M],    text: [D, M, C], detail: [D] },
    unit: { x: [D],       y: [M] },
  },
  rows: {
    bar:  { y: [D], x: [M, N], x2: [M, N], color: [D, C] },
    rule: { y: [D], x: [M, N], x2: [M, N] },
    tick: { y: [D], x: [M, N], detail: [D] },
    dot:  { y: [D], x: [M, N], color: [D, C], detail: [D] },
    unit: { y: [D], x: [M],    color: [D, C] },
    text: { y: [D], text: [D, M, C] },
    line: { y: [D], x: [M] },
    area: { y: [D], x: [M] },
  },
  band: {
    bar:  { x: [M], color: [D] },
    unit: { x: [M], color: [D] },
  },
  radial: {
    arc:  { angle: [D, M, N], radius: [D, M, N], color: [D], detail: [D] },
    unit: { angle: [M], color: [D] },
    line: { angle: [D], radius: [M] },
    area: { angle: [D], radius: [M] },
    dot:  { angle: [D], radius: [M] },
  },
  matrix: {
    cell: { x: [D], y: [D], color: [M] },
    dot:  { x: [D], y: [D], color: [M], size: [M] },
    text: { x: [D], y: [D], text: [D, M, C] },
  },
};

/** The channels a mark is not drawn without, where it has any. With one missing it was drawn as nothing, or as
 * "undefined", or it broke its builder. Where a mark needs one of two (a rule, a number on x or on y) its builder says so. */
export const NEEDS: Record<string, Record<string, readonly Channel[]>> = {
  cartesian: { line: ['y'], area: ['y'], bar: ['y'], dot: ['y'], text: ['y', 'text'], unit: ['y'] },
  rows:      { rule: ['x'], tick: ['x'], dot: ['x'], unit: ['x'], text: ['text'], line: ['x'], area: ['x'] },
  band:      { bar: ['x', 'color'], unit: ['x'] },
  radial:    { unit: ['angle', 'color'], line: ['angle', 'radius'], area: ['angle', 'radius'], dot: ['angle', 'radius'] },
  matrix:    { cell: ['color'], dot: ['x', 'y', 'size'], text: ['text'] },
};

/** The layer fields that only some marks read, and where. On any other mark one was dropped. `role` is read of every
 * layer, and `paint`, `series` and `stack` are refused where they are drawn, form by form: they are not here. */
export const FIELDS: Record<string, Record<string, readonly ('label' | 'align' | 'sweep')[]>> = {
  cartesian: { rule: ['label'], tick: ['align'] },
  rows:      { text: ['align'], tick: ['align'] },
  radial:    { arc: ['sweep'], unit: ['sweep'] },
};

const A: Record<Held, string> = { dimension: 'a dimension', metric: 'a metric', number: 'a number', companion: 'a companion of a dimension' };
const heldOf = (catalog: Catalog, f: string | number): Held => (typeof f === 'number' ? N : isDim(catalog, f) ? D : isMetric(catalog, f) ? M : C);
const said = (reads: Reads) => Object.entries(reads).map(([ch, takes]) => ch + ' (' + orList(takes.map((h) => A[h])) + ')').join(', ');
/** Every mark that says what it reads, with where it is drawn: core's by layout, and a custom mark in the layout that is its own. */
const every = () => [
  ...Object.entries(READS).flatMap(([layout, marks]) => Object.entries(marks).map(([mark, reads]) => ({ mark, layout, reads }))),
  ...[...customMarks()].flatMap(([mark, { reads }]) => (reads ? [{ mark, layout: mark, reads }] : [])),
];

/** Refuse what a layer says and nothing reads: a mark its layout does not draw, a channel its mark does not read
 * there, a channel holding what the mark takes no account of, or a field of the layer the mark has no use for. And
 * what it does not say that the mark is not drawn without. `why` is how the layout was chosen (layoutOf).
 * A custom mark is held to what it says it reads, and one that says nothing is not asked. */
export function checkReads(layout: Layout, why: string, layers: Layer[], catalog: Catalog): void {
  const own = customMarks().get(layout)?.reads, marks = own ? { [layout]: own } : READS[layout];
  if (!marks) return;
  layers.forEach((l, i) => {
    const reads = marks[l.mark], n = 'Layer ' + (i + 1), there = 'the "' + l.mark + '" mark' + (own ? '' : ' in a "' + layout + '" layout');
    if (!reads) {
      const drawn = Object.keys(READS).filter((lay) => READS[lay]![l.mark]);
      throw new Error(n + ' has the mark "' + l.mark + '", and these layers are laid out as "' + layout + '" (' + why + '), which draws ' + orList(Object.keys(marks)) + '. Use one of those, or change what the layers put on x, y and color'
        + (drawn.length ? ': the "' + l.mark + '" mark is drawn in ' + orList(drawn) : '') + '.');
    }
    for (const [ch, f] of Object.entries(l.encode || {}) as [Channel, string | number][]) {
      const takes = reads[ch], held = heldOf(catalog, f);
      if (!takes) {
        const others = Object.keys(marks).filter((m) => marks[m]![ch]);
        throw new Error(n + ' encodes ' + JSON.stringify(f) + ' on ' + ch + ', and ' + there + ' reads no ' + ch + '. It reads: ' + said(reads) + '. Remove "' + ch + '"' + (others.length ? ', or use a mark that reads it there: ' + orList(others) : '') + '.');
      }
      if (!takes.includes(held)) {
        const where = every().filter((e) => e.reads[ch]?.includes(held)).map((e) => (e.mark === e.layout ? '"' + e.mark + '"' : e.mark + ' in ' + e.layout));
        throw new Error(n + ' encodes ' + JSON.stringify(f) + ', ' + A[held] + ', on ' + ch + ', and ' + there + ' takes ' + orList(takes.map((h) => A[h])) + ' there. Encode ' + (takes.length > 1 ? 'one of those' : 'one') + ', or remove "' + ch + '".'
          + (where.length ? ' On ' + ch + ', ' + A[held] + ' is read by: ' + where.join(', ') + '.' : ''));
      }
    }
    const missing = (own ? [] : NEEDS[layout]?.[l.mark] ?? []).find((ch) => l.encode?.[ch] == null);
    if (missing) throw new Error(n + ' has the mark "' + l.mark + '" and nothing on ' + missing + ', and ' + there + ' is not drawn without it. Encode ' + orList(reads[missing]!.map((h) => A[h])) + ' on ' + missing + '.');
    for (const field of ['label', 'align', 'sweep'] as const) {
      if (l[field] == null || (!own && FIELDS[layout]?.[l.mark]?.includes(field))) continue;
      const where = Object.entries(FIELDS).flatMap(([lay, ms]) => Object.keys(ms).filter((m) => ms[m]!.includes(field)).map((m) => m + ' in ' + lay));
      throw new Error(n + ' has "' + field + '", and ' + there + ' reads none. Remove it. It is read by: ' + where.join(', ') + '.');
    }
  });
}
