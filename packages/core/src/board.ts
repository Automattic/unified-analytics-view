import type { Catalog, Query, Row, Spec, Where } from './types.ts';

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

/** What a board's views share: each is a part of a query, and is laid under every view's own. */
export type Shared = Pick<Query, 'range' | 'compare' | 'where'>;
const SHARED = ['range', 'compare', 'where'];
export interface Board { spec?: string; title?: string; query?: Shared; views: Spec[] }
/** One view of a board: its key, which is its title; the spec to run and draw, with the board's query under its own;
 * and what the view is to mark as selected, which is what the board's filter says of the dimensions the view draws. */
export interface BoardView { key: string; spec: Spec; selected: Where | null }

const none = (w: Where) => (Object.keys(w).length ? w : null);

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

/** The board after one of its views proposes a selection (`ua-select`): `where` is the filter the activated datum is,
 * and null lets go of what that view selects, which is every dimension it draws. One value of a dimension at a time:
 * a new one takes the place of the last. The board given is not changed. */
export function boardSelect(board: Board, key: string, where: Where | null): Board {
  const view = board.views.find((v) => v.title === key);
  if (!view) throw new Error('The board has no view titled "' + key + '". It has: ' + board.views.map((v) => '"' + v.title + '"').join(', ') + '. Name one of them.');
  const { where: old = {}, ...rest } = board.query || {}, by = (view.query && view.query.by) || [];
  const next = where ? { ...old, ...where } : Object.fromEntries(Object.entries(old).filter(([d]) => by.indexOf(d) < 0));
  return { ...board, query: none(next) ? { ...rest, where: next } : rest };
}
