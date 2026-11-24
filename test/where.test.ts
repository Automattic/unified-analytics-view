import { describe, expect, it } from 'vitest';
import { explain, facets, resolve, type Query, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery } from '@unified-analytics/fixtures';
import { errOf, validView as view } from './helpers.ts';

// A filter is part of the query (reference, Decided 48): `where` holds a dimension to a value, a list of them or a run,
// the engine applies it and says so on its answer, and core filters no row. A view says what its answer is filtered to.
const byDay: Query = { metrics: ['visitors'], by: ['date.day'], range: '28d', compare: 'previous' };
const trend: Spec = { spec: 'view/0', use: 'line', query: { ...byDay, where: { channel: 'Search' } } };
const text = (spec: Spec, result = runQuery(spec.query)) => resolve(spec, result, catalog).text;

describe('the fixture engine filters by the pairs it makes', () => {
  const pairs = runQuery({ ...byDay, by: ['date.day', 'channel'] });
  it('a value: the rows and the total are the ones the query by that dimension has for it', () => {
    const only = runQuery(trend.query), search = pairs.rows.filter((r) => r.channel === 'Search'), whole = pairs.totalsBy!.channel!.find((r) => r.channel === 'Search')!;
    expect(only.rows.length).toBe(28);
    only.rows.forEach((r, i) => expect(r).toEqual({ 'date.day': search[i]!['date.day'], partial: search[i]!.partial, visitors: search[i]!.visitors, 'visitors@previous': search[i]!['visitors@previous'] }));
    expect(only.totals).toEqual({ visitors: whole.visitors, 'visitors@previous': whole['visitors@previous'] });
    expect(only.meta.where).toEqual({ channel: 'Search' });
    expect(runQuery(byDay).meta.where).toBeUndefined();
  });
  it('a list is any of its values, and a run is every value from one to another, both included', () => {
    const one = (channel: string) => runQuery({ metrics: ['visitors'], where: { channel } }).totals.visitors!;
    expect(runQuery({ metrics: ['visitors'], where: { channel: ['Search', 'Social'] } }).totals.visitors).toBe(one('Search') + one('Social'));
    const days = runQuery(byDay).rows, week = days.slice(13, 20), run = { from: String(week[0]!['date.day']), to: String(week[6]!['date.day']) };
    expect(runQuery({ ...byDay, where: { 'date.day': run } }).rows.map((r) => r['date.day'])).toEqual(week.map((r) => r['date.day']));
    expect(runQuery({ metrics: ['visitors'], where: { 'date.day': run } }).totals.visitors).toBe(week.reduce((s, r) => s + (r.visitors as number), 0));
  });
  it('the filter comes before the ranking and the limit', () => {
    const all = runQuery({ metrics: ['pageviews'], by: ['page'] }).rows.map((r) => String(r.page)), last = all.slice(-3);
    const kept = runQuery({ metrics: ['pageviews'], by: ['page'], limit: 2, where: { page: last } });
    expect(kept.rows.map((r) => r.page)).toEqual(last.slice(0, 2));
    expect(kept.totals.pageviews).toBe(runQuery({ metrics: ['pageviews'], by: ['page'], where: { page: last } }).rows.reduce((s, r) => s + (r.pageviews as number), 0));
    // By a dimension the query is not by, the list is ranked again by what is left.
    const fromSearch = runQuery({ metrics: ['pageviews'], by: ['page'], where: { channel: 'Search' } }).rows.map((r) => r.pageviews as number);
    expect(fromSearch).toEqual([...fromSearch].sort((a, b) => b - a));
  });
  it('a filter that holds for nothing is an answer of nothing, which says its filter', () => {
    const none = runQuery({ ...byDay, where: { channel: 'Nope' } });
    expect(none).toMatchObject({ rows: [], totals: { visitors: 0 }, meta: { empty: true, where: { channel: 'Nope' } } });
    expect(text({ ...trend, query: { ...byDay, where: { channel: 'Nope' } } })).toBe('Visitors: nothing recorded in the last 28 days. Filtered to channel Nope.');
  });
  it('says what it cannot filter, and the fix', () => {
    expect(errOf(() => runQuery({ ...byDay, where: { channel: 'Search', device: 'Mobile' } }))).toMatch(/two dimensions at most, by and where together, and this query has 3: date\.day, channel, device\. Remove "device" from where\./);
    expect(errOf(() => runQuery({ metrics: ['page_conversion'], where: { page: '/' } }))).toMatch(/filters what adds up over rows, and "page_conversion" does not.*Query a count with "where", or remove "where"\./);
    expect(errOf(() => runQuery({ metrics: ['conversions'], by: ['event'], where: { channel: 'Search' } }))).toMatch(/cannot filter this query by "channel".*Remove "channel" from where\./);
  });
});

describe('a view of a filtered answer', () => {
  it('says the filter after its sentence, by the catalog\'s labels', () => {
    expect(text(trend)).toMatch(/^Visitors: [\d,]+ in the last 28 days, up [\d.]+% on the previous period\..* Filtered to channel Search\.$/);
    expect(text({ spec: 'view/0', query: { metrics: ['visitors'], where: { channel: ['Search', 'Social'], device: 'Mobile' } } })).toMatch(/ Filtered to channel Search or Social, and device Mobile\.$/);
    expect(text({ spec: 'view/0', use: 'bar-list', query: { metrics: ['visitors'], by: ['channel'], where: { 'date.day': { from: '2026-09-21', to: '2026-09-27' } } } })).toMatch(/ Filtered to day from Sep 21 to Sep 27\.$/);
    expect(text({ spec: 'view/0', query: { metrics: ['visitors'], where: { 'date.day': { to: '2026-09-27' } } } })).toMatch(/ Filtered to day up to Sep 27\.$/);
    expect(text({ ...trend, query: byDay })).not.toMatch(/Filtered/);
  });
  it('says of itself that it is filtered, where that came from and what changes it', () => {
    const e = explain(trend, runQuery(trend.query), catalog);
    expect(e.entries[1]).toMatchObject({ what: 'filtered to channel Search', from: 'query.where', lever: 'remove it from "where" to draw the whole' });
    expect(explain({ ...trend, query: byDay }, runQuery(byDay), catalog).entries.some((b) => b.from === 'query.where')).toBe(false);
  });
  it('is the sample, which is valid and draws a filtered trend', () => {
    const { spec } = moreSamples.filtered!;
    expect(view(spec), JSON.stringify(view.errors)).toBe(true);
    expect(resolve(spec, runQuery(spec.query), catalog)).toMatchObject({ layout: 'cartesian', preset: 'line' });
  });
  it('keeps its filter in every view of a facet', () => {
    const spec: Spec = { spec: 'view/0', use: 'line', facet: 'channel', query: { ...byDay, by: ['date.day', 'channel'], where: { channel: ['Search', 'Social'] } } };
    const views = facets(spec, runQuery(spec.query), catalog);
    expect(views.map((v) => v.key)).toEqual(['Search', 'Social']);
    for (const v of views) expect(resolve(v.spec, v.result, catalog).text).toMatch(/ Filtered to channel Search or Social\.$/);
  });
});

describe('a filter that cannot be read names the fix', () => {
  const whole = runQuery({ metrics: ['visitors'] }), of = (where: unknown): Spec => ({ spec: 'view/0', query: { metrics: ['visitors'], where } as Query });
  it('a dimension the catalog lacks, a dimension held to nothing, and a run of what has no order', () => {
    expect(errOf(() => resolve(of({ chanel: 'Search' }), whole, catalog))).toMatch(/The catalog has no dimension "chanel"\..*or correct the name in query\.where\./);
    expect(errOf(() => resolve(of({ channel: [] }), whole, catalog))).toMatch(/query\.where holds "channel" to \[\], which is no value\. Write one of its values, a list of them, or a run as/);
    expect(errOf(() => resolve(of({ channel: {} }), whole, catalog))).toMatch(/holds "channel" to \{\}, which is no value/);
    expect(errOf(() => resolve(of({ channel: { from: 'Direct' } }), whole, catalog))).toMatch(/"channel" is categorical: its values have no order to run from one to another\. List the values it may take, or remove "channel" from where\./);
  });
  it('an answer that is not of the query\'s filter, either way', () => {
    expect(errOf(() => resolve(of({ channel: 'Search' }), whole, catalog))).toMatch(/The query filters by where: \{"channel":"Search"\}, and the answer says it is of everything, with no "where" in its meta\..*Pass what this query returned, or make query\.where the same\./);
    expect(errOf(() => resolve(of(undefined), runQuery({ metrics: ['visitors'], where: { channel: 'Search' } }), catalog))).toMatch(/The query has no "where", and the answer says it is of where: \{"channel":"Search"\}/);
    expect(errOf(() => resolve(of({ channel: 'Social' }), runQuery({ metrics: ['visitors'], where: { channel: 'Search' } }), catalog))).toMatch(/and the answer says it is of where/);
    // The same filter written another way is the same: a value or a list of one, the list and the dimensions in any order.
    const two = runQuery({ metrics: ['visitors'], where: { device: 'Mobile', channel: ['Social', 'Search'] } });
    expect(() => resolve(of({ channel: ['Search', 'Social'], device: ['Mobile'] }), two, catalog)).not.toThrow();
  });
  it('and the schema holds its form', () => {
    const q = (where: unknown) => ({ spec: 'view/0', query: { metrics: ['visitors'], where } });
    for (const good of [{ channel: 'Search' }, { channel: ['Search', 'Social'], device: 'Mobile' }, { 'date.day': { from: '2026-09-21' } }, { load_time: { from: 0, to: 2 } }]) expect(view(q(good)), JSON.stringify(view.errors)).toBe(true);
    for (const bad of [{ channel: [] }, { channel: {} }, { channel: { from: 'a', until: 'b' } }, { channel: null }, 'Search']) expect(view(q(bad)), JSON.stringify(bad)).toBe(false);
  });
});
