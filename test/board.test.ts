import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { boardSelect, boardViews, holds, resolve, select, selectedBecause, whereOf, type Board, type Gesture, type Where } from '@unified-analytics/core';
import boardSchema from '@unified-analytics/core/schema/board.schema.json';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { boardSamples, catalog, runQuery, scenarios } from '@unified-analytics/fixtures';
import { errOf } from './helpers.ts';

// A board is views and the part of the query they share (reference, Decided 49). It has no layout and no state apart
// from itself: its query is its params as they stand, and a selection is a filter one of its views proposes.
const { board } = boardSamples.traffic!;
const of = (b: Board) => Object.fromEntries(boardViews(b, catalog).map((v) => [v.key, v]));
const pick = (b: Board, where: Where, how?: Gesture) => boardSelect(b, { where, how }, catalog);

describe('the views of a board', () => {
  it('each has the board\'s range and compare under its own query, and its title for a key', () => {
    const views = boardViews(board, catalog);
    expect(views.map((v) => v.key)).toEqual(['Visitors', 'Visitors by day', 'Channels', 'Devices', 'Top pages']);
    for (const v of views) { expect(v.spec.query).toMatchObject({ range: '28d', compare: 'previous' }); expect(v.spec.query.where).toBeUndefined(); expect(v.selected).toBeNull(); }
    expect(views[4]!.spec.query).toEqual({ range: '28d', compare: 'previous', metrics: ['visitors'], by: ['page'], limit: 5 });
    // A view that states its own keeps it.
    const own = of({ ...board, views: [{ ...board.views[1]!, query: { ...board.views[1]!.query, range: '7d' } }] });
    expect(own['Visitors by day']!.spec.query.range).toBe('7d');
  });
  it('is filtered by every dimension of the board\'s where but the ones it draws, which it is told to mark', () => {
    const v = of({ ...board, query: { ...board.query, where: { channel: 'Search', device: 'Mobile' } } });
    expect(v.Visitors).toMatchObject({ spec: { query: { where: { channel: 'Search', device: 'Mobile' } } }, selected: null });
    expect(v.Channels).toMatchObject({ spec: { query: { where: { device: 'Mobile' } } }, selected: { channel: 'Search' } });
    expect(v.Devices).toMatchObject({ spec: { query: { where: { channel: 'Search' } } }, selected: { device: 'Mobile' } });
    // A view's own where is its own, and wins.
    const own = of({ ...board, query: { where: { channel: 'Search' } }, views: [{ ...board.views[0]!, query: { metrics: ['visitors'], where: { channel: 'Direct' } } }] });
    expect(own.Visitors!.spec.query.where).toEqual({ channel: 'Direct' });
  });
  it('every one draws, in every data state, with one selection and with two', () => {
    const picked = pick(pick(board, { channel: 'Search' }), { device: 'Mobile' });
    for (const b of [board, pick(board, { channel: 'Search' }), picked, pick(board, { 'date.day': '2026-09-21' }), pick(picked, { channel: 'Social' }, 'toggle'), pick(pick(board, { 'date.day': '2026-09-21' }), { 'date.day': '2026-09-27' }, 'extend')])
      for (const sc of scenarios) for (const v of boardViews(b, catalog)) expect(() => resolve(v.spec, runQuery(v.spec.query, sc), catalog), v.key + ' ' + sc + ' ' + JSON.stringify(b.query)).not.toThrow();
    // What a filtered view says is the filter the engine applied, and the list that made the selection is not filtered by it.
    const v = of(picked), text = (key: string) => resolve(v[key]!.spec, runQuery(v[key]!.spec.query), catalog).text;
    expect(text('Visitors by day')).toMatch(/ Filtered to channel Search, and device Mobile\.$/);
    expect(text('Channels')).toMatch(/ Filtered to device Mobile\.$/);
    expect(runQuery(v.Channels!.spec.query).rows.length).toBe(6);
  });
  it('is refused where no surface could draw it, and the fix is named', () => {
    expect(errOf(() => boardViews({ views: [] }, catalog))).toMatch(/A board needs "views": a list of view specs/);
    expect(errOf(() => boardViews({ ...board, query: { metrics: ['visitors'] } as never }, catalog))).toMatch(/holds what its views share: range, compare, where\. It has "metrics", which is each view's own: move it into the views' queries\./);
    expect(errOf(() => boardViews({ ...board, query: { where: { chanel: 'Search' } } }, catalog))).toMatch(/The catalog has no dimension "chanel"\..*correct the name in the board's query\.where\./);
    expect(errOf(() => boardViews({ views: [{ query: { metrics: ['visitors'] } }] }, catalog))).toMatch(/View 1 of the board has no "title"\..*give it one\./);
    expect(errOf(() => boardViews({ views: [board.views[0]!, board.views[1]!, board.views[0]!] }, catalog))).toMatch(/Views 1 and 3 of the board are both titled "Visitors"\..*give each its own\./);
  });
});

describe('a selection in a board', () => {
  it('is a proposal folded into the board\'s where, whichever view made it', () => {
    const one = pick(board, { channel: 'Search' });
    expect(one.query).toEqual({ range: '28d', compare: 'previous', where: { channel: 'Search' } });
    expect(board.query).toEqual({ range: '28d', compare: 'previous' });                         // the board given is not changed
    expect(pick(one, { channel: 'Direct' }).query!.where).toEqual({ channel: 'Direct' });
    expect(pick(one, { device: 'Mobile' }).query!.where).toEqual({ channel: 'Search', device: 'Mobile' });
    // Picked again it is let go, and with nothing left the board has no where.
    expect(pick(pick(one, { device: 'Mobile' }), { channel: 'Search' }).query!.where).toEqual({ device: 'Mobile' });
    expect(pick(one, { channel: 'Search' }).query).toEqual({ range: '28d', compare: 'previous' });
  });
});

describe('a proposal folded into the filter held', () => {
  const fold = (held: Where | null, where: Where, how?: Gesture) => select(held, { where, how }, catalog);
  it('pick: the datum alone, and again lets it go', () => {
    expect(fold(null, { channel: 'Search' })).toEqual({ channel: 'Search' });
    expect(fold({ channel: ['Search', 'Social'] }, { channel: 'Search' })).toEqual({ channel: 'Search' });     // one of several picked alone is that one
    expect(fold({ channel: 'Search', device: 'Mobile' }, { channel: 'Search' })).toEqual({ device: 'Mobile' });
    expect(fold({ channel: 'Search' }, { channel: 'Search' })).toBeNull();
    // A cell is two dimensions: let go where both are held to it, and picked where either is not.
    expect(fold({ weekday: 'Mon', hour: '9am' }, { weekday: 'Mon', hour: '9am' })).toBeNull();
    expect(fold({ weekday: 'Mon', hour: '9am' }, { weekday: 'Mon', hour: '10am' })).toEqual({ weekday: 'Mon', hour: '10am' });
    expect(fold({ channel: 'Search' }, {})).toEqual({ channel: 'Search' });                                    // a datum of no dimension proposes nothing
  });
  it('toggle: the value joins those held, or leaves them', () => {
    const two = fold({ channel: 'Search' }, { channel: 'Social' }, 'toggle');
    expect(two).toEqual({ channel: ['Search', 'Social'] });
    expect(fold(two, { channel: 'Search' }, 'toggle')).toEqual({ channel: 'Social' });                         // a list of one is written as the value
    expect(fold({ channel: 'Social' }, { channel: 'Social' }, 'toggle')).toBeNull();
    expect(fold({ 'date.day': { from: '2026-09-21', to: '2026-09-27' } }, { 'date.day': '2026-09-30' }, 'toggle')).toEqual({ 'date.day': '2026-09-30' });   // a run gives way
    // Two cells toggled are their columns and their rows: dimensions are joined by "and".
    expect(fold({ weekday: 'Mon', hour: '9am' }, { weekday: 'Tue', hour: '10am' }, 'toggle')).toEqual({ weekday: ['Mon', 'Tue'], hour: ['9am', '10am'] });
  });
  it('extend: a run on a time or a number, which grows to take the value in, and whose end a value inside it becomes', () => {
    const day = (d: number) => '2026-09-' + d, run = fold({ 'date.day': day(21) }, { 'date.day': day(27) }, 'extend');
    expect(run).toEqual({ 'date.day': { from: day(21), to: day(27) } });
    expect(fold({ 'date.day': day(21) }, { 'date.day': day(14) }, 'extend')).toEqual({ 'date.day': { from: day(14), to: day(21) } });
    expect(fold(run, { 'date.day': day(29) }, 'extend')).toEqual({ 'date.day': { from: day(21), to: day(29) } });
    expect(fold(run, { 'date.day': day(14) }, 'extend')).toEqual({ 'date.day': { from: day(14), to: day(27) } });
    expect(fold(run, { 'date.day': day(24) }, 'extend')).toEqual({ 'date.day': { from: day(21), to: day(24) } });
    expect(fold(run, { 'date.day': day(21) }, 'extend')).toEqual({ 'date.day': day(21) });                     // a run of one value is the value
    expect(fold({ load_time: [1, 2.5] }, { load_time: 4 }, 'extend')).toEqual({ load_time: { from: 1, to: 4 } });   // from those listed
    expect(fold({ device: 'Mobile' }, { 'date.day': day(21) }, 'extend')).toEqual({ device: 'Mobile', 'date.day': day(21) });   // with nothing held, a pick
  });
  it('extend on a categorical dimension is a toggle: the order it is drawn in is no order of its values', () => {
    expect(fold({ channel: 'Search' }, { channel: 'Email' }, 'extend')).toEqual({ channel: ['Search', 'Email'] });
  });
  it('and every filter it makes is one a query may hold', () => {
    const made = [fold({ channel: 'Search' }, { channel: 'Social' }, 'toggle')!, fold({ 'date.day': '2026-09-21' }, { 'date.day': '2026-09-27' }, 'extend')!];
    for (const where of made) expect(() => runQuery({ metrics: ['visitors'], where })).not.toThrow();
  });
});

describe('what a view says of a selection set on it', () => {
  it('is what it marks, which is what the selection says of the dimensions it draws, and that it is not filtered by it', () => {
    const v = of(pick(pick(board, { channel: 'Search' }), { device: 'Mobile' })), said = (key: string) => selectedBecause(v[key]!.selected, v[key]!.spec.query.by ?? [], catalog);
    expect(said('Channels')).toMatchObject({ what: 'marked as selected: channel Search', from: 'selected' });
    expect(said('Channels')!.why).toMatch(/marks what it draws of a selection and is not filtered by it/);
    expect(said('Visitors')).toBeNull();
    // A selection of a dimension the view does not draw, or that the catalog lacks, marks nothing and is not said.
    expect(selectedBecause({ device: 'Mobile', nope: 'x' }, ['channel', 'nope'], catalog)).toBeNull();
    expect(selectedBecause({ channel: ['Search', 'Social'], 'date.day': { from: '2026-09-21', to: '2026-09-27' } }, ['channel', 'date.day'], catalog)!.what).toBe('marked as selected: channel Search or Social, and day from Sep 21 to Sep 27');
    expect(selectedBecause(null, ['channel'], catalog)).toBeNull();
  });
});

describe('a filter read against a row', () => {
  it('holds for a value, any of a list, and a run with both ends in', () => {
    const row = { channel: 'Search', 'date.day': '2026-09-21', load_time: 1.5 };
    expect(holds(row, { channel: 'Search' })).toBe(true);
    expect(holds(row, { channel: ['Direct', 'Search'], 'date.day': { from: '2026-09-21', to: '2026-09-21' } })).toBe(true);
    expect(holds(row, { load_time: { from: 1.5 } })).toBe(true);
    expect(holds(row, { load_time: { to: 1 } })).toBe(false);
    expect(holds(row, { channel: 'Search', device: 'Mobile' })).toBe(false);                     // a dimension the row lacks holds nothing
    expect(holds(row, {})).toBe(true);
  });
  it('and a datum is the filter of its own values', () => {
    expect(whereOf({ channel: 'Search', device: 'Mobile', visitors: 3, partial: false }, ['channel', undefined, 'device', 'page'])).toEqual({ channel: 'Search', device: 'Mobile' });
  });
});

describe('the board schema', () => {
  const valid = new Ajv({ allowUnionTypes: true }).addSchema(viewSchema).compile(boardSchema);
  it('holds the sample, a board after a selection, and the form of each part', () => {
    expect(valid(board), JSON.stringify(valid.errors)).toBe(true);
    expect(valid(pick(board, { channel: 'Search' })), JSON.stringify(valid.errors)).toBe(true);
    expect(valid(pick(pick(board, { channel: 'Search' }), { channel: 'Social' }, 'toggle')), JSON.stringify(valid.errors)).toBe(true);
    for (const bad of [{ ...board, views: [] }, { ...board, query: { metrics: ['visitors'] } }, { ...board, layout: 'grid' }, { ...board, views: [{ spec: 'view/0', query: { metrics: ['visitors'] } }] }, { ...board, query: { where: { channel: [] } } }])
      expect(valid(bad), JSON.stringify(bad).slice(0, 120)).toBe(false);
  });
});
