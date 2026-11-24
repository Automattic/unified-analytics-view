import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { boardSelect, boardViews, holds, resolve, whereOf, type Board } from '@unified-analytics/core';
import boardSchema from '@unified-analytics/core/schema/board.schema.json';
import viewSchema from '@unified-analytics/core/schema/view.schema.json';
import { boardSamples, catalog, runQuery, scenarios } from '@unified-analytics/fixtures';
import { errOf } from './helpers.ts';

// A board is views and the part of the query they share (reference, Decided 49). It has no layout and no state apart
// from itself: its query is its params as they stand, and a selection is a filter one of its views proposes.
const { board } = boardSamples.traffic!;
const of = (b: Board) => Object.fromEntries(boardViews(b, catalog).map((v) => [v.key, v]));

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
    const picked = boardSelect(boardSelect(board, 'Channels', { channel: 'Search' }), 'Devices', { device: 'Mobile' });
    for (const b of [board, boardSelect(board, 'Channels', { channel: 'Search' }), picked, boardSelect(board, 'Visitors by day', { 'date.day': '2026-09-21' })])
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
  it('is a filter a view proposes: it joins the board\'s where, one value of a dimension at a time', () => {
    const one = boardSelect(board, 'Channels', { channel: 'Search' });
    expect(one.query).toEqual({ range: '28d', compare: 'previous', where: { channel: 'Search' } });
    expect(board.query).toEqual({ range: '28d', compare: 'previous' });                         // the board given is not changed
    expect(boardSelect(one, 'Channels', { channel: 'Direct' }).query!.where).toEqual({ channel: 'Direct' });
    expect(boardSelect(one, 'Devices', { device: 'Mobile' }).query!.where).toEqual({ channel: 'Search', device: 'Mobile' });
  });
  it('is let go by the view that made it: null takes every dimension that view draws, and no other', () => {
    const two = boardSelect(boardSelect(board, 'Channels', { channel: 'Search' }), 'Devices', { device: 'Mobile' });
    expect(boardSelect(two, 'Channels', null).query!.where).toEqual({ device: 'Mobile' });
    expect(boardSelect(boardSelect(two, 'Channels', null), 'Devices', null).query).toEqual({ range: '28d', compare: 'previous' });
    expect(boardSelect(two, 'Visitors', null).query!.where).toEqual({ channel: 'Search', device: 'Mobile' });   // a number draws no dimension
    expect(errOf(() => boardSelect(board, 'Chanels', null))).toMatch(/The board has no view titled "Chanels"\. It has: "Visitors", .*Name one of them\./);
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
    expect(valid(boardSelect(board, 'Channels', { channel: 'Search' })), JSON.stringify(valid.errors)).toBe(true);
    for (const bad of [{ ...board, views: [] }, { ...board, query: { metrics: ['visitors'] } }, { ...board, layout: 'grid' }, { ...board, views: [{ spec: 'view/0', query: { metrics: ['visitors'] } }] }, { ...board, query: { where: { channel: [] } } }])
      expect(valid(bad), JSON.stringify(bad).slice(0, 120)).toBe(false);
  });
});
