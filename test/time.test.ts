import { describe, expect, it } from 'vitest';
import { formatDimension, resolve, unboundedContainer, type Result } from '@unified-analytics/core';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';
import { adapt, type ApiResult } from '@unified-analytics/spacefast';
import trends from './fixtures/spacefast/trends.response.json';

/* A time is said as the engine wrote it: its date and its time of day, with the offset left alone. So a label is the same
 * for one string on every machine. This file is run under TZ=UTC, America/Los_Angeles and Asia/Kolkata, and passes in each. */
const DAY = catalog.dimensions['date.day']!, time = (v: string) => formatDimension(v, DAY);

describe('a time, as its string writes it', () => {
  it.each([
    // The fixture engine's form, and the prototype's: a bare date.
    ['2026-09-08', 'Sep 8'],
    ['2026-10-05', 'Oct 5'],
    ['2026-01-01', 'Jan 1'],
    ['2026-12-31', 'Dec 31'],
    // The Spacefast API's form: an instant, cut in UTC and written in it.
    ['2026-09-08T00:00:00Z', 'Sep 8'],
    ['2026-09-08T00:00:00.000Z', 'Sep 8'],
    ['2026-09-08T15:00:00Z', 'Sep 8, 3 PM'],
    ['2026-09-08T15:00:00.000Z', 'Sep 8, 3 PM'],
    ['2026-09-08T23:00:00.000Z', 'Sep 8, 11 PM'],
    // No offset: the same clock, and never the viewer's.
    ['2026-09-08T15:00:00', 'Sep 8, 3 PM'],
    ['2026-09-08T15:00', 'Sep 8, 3 PM'],
    ['2026-09-08 15:00:00', 'Sep 8, 3 PM'],
    ['2026-09-08 00:00:00', 'Sep 8'],
    ['2026-09-08T15:00:00.123456', 'Sep 8, 3 PM'],
    // An offset says where the bucket was cut. It does not move the label.
    ['2026-09-08T00:00:00+02:00', 'Sep 8'],
    ['2026-09-08T15:00:00+05:30', 'Sep 8, 3 PM'],
    ['2026-09-08T00:00:00-07:00', 'Sep 8'],
    ['2026-09-08T23:00:00-08:00', 'Sep 8, 11 PM'],
    ['2026-09-08T01:00:00+14:00', 'Sep 8, 1 AM'],
    ['2026-09-08 15:00:00+0530', 'Sep 8, 3 PM'],
    ['2026-09-08T15:00:00.000-03', 'Sep 8, 3 PM'],
    // A month, and an ISO week by the Monday it starts on.
    ['2026-09', 'Sep 2026'],
    ['2026-W36', 'Aug 31'],
    ['2026-W01', 'Dec 29'],
    ['2026-W53', 'Dec 28'],
    ['2024-02-29', 'Feb 29'],
  ])('%s reads "%s"', (v, said) => expect(time(v)).toBe(said));

  it.each(['yesterday', 'Invalid Date', '', 'null', '1788998400000', '2026', '09/08/2026', 'Sep 8', '2026-9-8', '2026-02-30', '2025-02-29', '2026-13-01',
    '2026-09-08T24:00:00', '2026-09-08T15:61:00', '2026-09-08T15', '2026-09-08Z', '2026-09+02:00', '2026-W00', '2026-W54', '2025-W53', '2026-W36-1', '2026-Q3',
  ])('"%s" is refused, and the error names the forms that are read', (v) => {
    expect(() => time(v)).toThrow('The time ' + JSON.stringify(v) + ' is not in a form a view reads. Send a day ("2026-09-08"), a day and time ("2026-09-08T15:00:00", "2026-09-08 15:00:00", with or without an offset such as "Z" or "+02:00"), a month ("2026-09") or an ISO week ("2026-W36"), or give the dimension the type "categorical" in the catalog for its values to be written as they come.');
  });
  it('no value is still a dash, and a category is still written as it came', () => {
    expect(formatDimension(null, DAY)).toBe('–');
    expect(formatDimension('yesterday', catalog.dimensions.page!)).toBe('yesterday');
  });
});

describe('where a time is read', () => {
  const trend = samples.trend!.spec, result = runQuery(trend.query), plan = (r: Result) => resolve(trend, r, unboundedContainer(), catalog);
  it('every day the fixture engine sends reads as its own month and day', () => {
    expect(result.rows.length).toBeGreaterThan(0);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (const r of result.rows) {
      const [, m, d] = /^\d{4}-(\d\d)-(\d\d)$/.exec(r['date.day'] as string)!;
      expect(time(r['date.day'] as string)).toBe(MONTHS[+m! - 1] + ' ' + +d!);
    }
  });
  it('a result with a time no view reads is refused by the plan, before a scene is built', () => {
    expect(() => plan(result)).not.toThrow();
    const rows = result.rows.map((r, i) => (i === 3 ? { ...r, 'date.day': 'last Tuesday' } : r));
    expect(() => plan({ ...result, rows })).toThrow('The time "last Tuesday" is not in a form a view reads.');
  });
  it('the Spacefast adapter passes buckets cut in UTC as they came, and refuses any other zone', () => {
    const traffic = trends.data.results.find((a) => a.id === 'traffic') as unknown as ApiResult, { result: r, catalog: c } = adapt(traffic);
    expect(traffic.timezone).toBe('UTC');
    expect(r.rows.slice(0, 2).map((row) => formatDimension(row.bucket, c.dimensions.bucket!))).toEqual(['Sep 7', 'Sep 8']);
    expect(() => adapt({ ...traffic, timezone: 'Europe/Berlin' })).toThrow('This answer\'s buckets are cut in "Europe/Berlin", and this adapter knows them cut in UTC');
    // A breakdown has no bucket, so its zone changes nothing a view writes.
    const headline = trends.data.results.find((a) => a.id === 'headline') as unknown as ApiResult;
    expect(() => adapt({ ...headline, timezone: 'Europe/Berlin' })).not.toThrow();
  });
});
