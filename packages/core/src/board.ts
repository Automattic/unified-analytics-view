import type { Catalog, Held, Query, Row, Spec, Where } from './types.ts';

/* A board: views, and the part of the query they share (reference, Decided 45, 48 and 49). It holds no layout, since
 * where each view stands is the surface's, and no state apart from itself: its `query` is its params at their values
 * now, so a surface that changes one holds a new board. Nothing here fetches. A surface asks for the views, runs each
 * one's query with the function it was handed, and draws each as it draws any view. */

/** Whether a row holds what a filter says of each dimension it names: one of its values, any of a list, or a run from
 * one to another, both included, by the order the values are written in (a day's, where a bin starts). It is how a
 * view finds the marks to call selected, and how an engine with rows to hand may filter them. Core sums nothing by it. */
export const holds = (r: Row, where: Where): boolean => Object.entries(where).every(([d, h]) => {
  const v = r[d] as string | number;
  return Array.isArray(h) || typeof h !== 'object' ? [h].flat().some((x) => String(x) === String(v)) : (h.from == null || v >= h.from) && (h.to == null || v <= h.to);
});
/** The filter one datum is: its value of each of `dims`, where it has one. What a view proposes when a datum is activated. */
export const whereOf = (row: Row, dims: readonly (string | undefined)[]): Where =>
  Object.fromEntries(dims.flatMap((d) => (d != null && row[d] != null && typeof row[d] !== 'boolean' ? [[d, row[d] as string | number]] : [])));

const none = (w: Where) => (Object.keys(w).length ? w : null);

/** How a datum was activated, which is what its filter does to the one held: `pick` is this one alone, and again lets
 * it go; `toggle` adds its value to those held, or takes it out; `extend` runs from the last one picked to this one. */
export type Gesture = 'pick' | 'toggle' | 'extend';
/** What a view proposes when a datum is activated (`ua-select`): the filter the datum is, and how it was activated. */
export interface Proposal { where: Where; how?: Gesture }

const same = (a: unknown, b: unknown) => String(a) === String(b);
const isRun = (h: Held | undefined): h is { from?: string | number; to?: string | number } => !!h && typeof h === 'object' && !Array.isArray(h);
/** What a dimension is held to, as the values it lists: none for a run, which lists none, and for a dimension not held. */
const listed = (h: Held | undefined): (string | number)[] => (h == null || isRun(h) ? [] : [h].flat());

/** The filter held after a proposal is folded into it, or null where nothing is left. It is the whole of what picking
 * means, and no view decides any of it: a view says what was activated and how, and a host folds that into what it
 * keeps (a board's `where`, or a lone view's `selected`).
 * - `pick`: each dimension is held to the datum's value alone. Where it already was, the datum is let go.
 * - `toggle`: the value joins those the dimension is held to, or leaves them. A run gives way to the value.
 * - `extend`: on a time or a number, a run from what is held to the value: it grows to take the value in, and a value
 *   inside it becomes its end. With nothing held it is a pick. On a categorical dimension it is a toggle, since the
 *   order its values are drawn in is no order of theirs.
 * A proposal of two dimensions, a grid's cell, is folded one dimension at a time: dimensions are joined by "and", so
 * two cells toggled are their columns and their rows. */
export function select(held: Where | null | undefined, { where, how = 'pick' }: Proposal, catalog: Catalog): Where | null {
  const next: Where = { ...held }, dims = Object.keys(where), value = (d: string) => where[d] as string | number;
  if (how === 'pick') {
    const was = dims.length > 0 && dims.every((d) => { const l = listed(next[d]); return l.length === 1 && same(l[0], value(d)); });
    for (const d of dims) { if (was) delete next[d]; else next[d] = value(d); }
    return none(next);
  }
  for (const d of dims) {
    const v = value(d), h = next[d], ordered = catalog.dimensions[d]?.type === 'time' || catalog.dimensions[d]?.type === 'number';
    if (how === 'extend' && ordered && h != null) {
      const l = listed(h), from = isRun(h) ? h.from ?? v : l.reduce((a, b) => (b < a ? b : a)), to = isRun(h) ? h.to ?? v : l.reduce((a, b) => (b > a ? b : a));
      const run = v < from ? { from: v, to } : { from, to: v };
      next[d] = same(run.from, run.to) ? run.from : run;
    } else if (how === 'extend' && ordered) next[d] = v;
    else {
      const l = listed(h), kept = l.some((x) => same(x, v)) ? l.filter((x) => !same(x, v)) : [...l, v];
      if (!kept.length) delete next[d]; else next[d] = kept.length === 1 ? kept[0]! : kept;
    }
  }
  return none(next);
}

/** What a board's views share: each is a part of a query, and is laid under every view's own. */
export type Shared = Pick<Query, 'range' | 'compare' | 'where'>;
const SHARED = ['range', 'compare', 'where'];
export interface Board { spec?: string; title?: string; query?: Shared; views: Spec[] }
/** One view of a board: its key, which is its title; the spec to run and draw, with the board's query under its own;
 * and what the view is to mark as selected, which is what the board's filter says of the dimensions the view draws. */
export interface BoardView { key: string; spec: Spec; selected: Where | null }


/** The views of a board, each with the query to run. The board's `range` and `compare` stand where a view states none.
 * Its `where` filters every view by each dimension the view does not draw (its `by`): on one it does draw, the view
 * keeps every value and is told which to mark (`selected`), so a list shows what was picked among the rest. That is
 * the one rule views are combined by, and no field changes it. A view's own `where` is its own, and wins.
 * Throws, with a message that names the fix, for a board no surface could draw. */
export function boardViews(board: Board, catalog: Catalog): BoardView[] {
  if (!board || !Array.isArray(board.views) || !board.views.length) throw new Error('A board needs "views": a list of view specs, each with a "title" and a "query". Add at least one.');
  const shared = board.query || {}, mine = Object.keys(shared).find((k) => SHARED.indexOf(k) < 0);
  if (mine) throw new Error('A board\'s query holds what its views share: ' + SHARED.join(', ') + '. It has "' + mine + '", which is each view\'s own: move it into the views\' queries.');
  const all = shared.where || {}, lost = Object.keys(all).find((d) => !Object.hasOwn(catalog.dimensions, d));
  if (lost) throw new Error('The catalog has no dimension "' + lost + '". It has: ' + (Object.keys(catalog.dimensions).join(', ') || 'none') + '. Add it to the catalog passed in, or correct the name in the board\'s query.where.');
  return board.views.map((view, i) => {
    if (!view || typeof view.title !== 'string' || !view.title) throw new Error('View ' + (i + 1) + ' of the board has no "title". A board\'s views are told apart by their titles, and a surface sets each over its view: give it one.');
    const twin = board.views.findIndex((v) => v && v.title === view.title);
    if (twin < i) throw new Error('Views ' + (twin + 1) + ' and ' + (i + 1) + ' of the board are both titled "' + view.title + '". A board\'s views are told apart by their titles: give each its own.');
    const own = view.query || ({} as Query), by = own.by || [], drawn = (d: string) => by.indexOf(d) >= 0;
    const where = { ...Object.fromEntries(Object.entries(all).filter(([d]) => !drawn(d))), ...own.where };
    const { where: _, ...rest } = { ...shared, ...own };
    return { key: view.title, spec: { ...view, query: none(where) ? { ...rest, where } : rest }, selected: none(Object.fromEntries(Object.entries(all).filter(([d]) => drawn(d)))) };
  });
}

/** The board after one of its views proposes a selection (`ua-select`): the proposal folded into the board's `where`
 * (`select`). Which view proposed it does not matter, since a datum's filter is of the dimensions its view draws.
 * The board given is not changed. */
export function boardSelect(board: Board, proposal: Proposal, catalog: Catalog): Board {
  const { where: old, ...rest } = board.query || {}, next = select(old, proposal, catalog);
  return { ...board, query: next ? { ...rest, where: next } : rest };
}
