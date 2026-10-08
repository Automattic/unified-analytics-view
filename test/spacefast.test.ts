import { describe, expect, it } from 'vitest';
import { buildScene, formatDimension, formatValue, place, resolve, tldrProse, makeContainer, type Spec } from '@universal-analytics/core';
import { adapt, type ApiResult } from '@universal-analytics/spacefast';
import trends from './fixtures/spacefast/trends.response.json';
import breakdowns from './fixtures/spacefast/breakdowns.response.json';

// The API's own examples (spacefast/monorepo#3816, at afd8faa), recorded from its store for a seeded site.
const answers = [...trends.data.results, ...breakdowns.data.results] as unknown as ApiResult[];
const answer = (id: string) => answers.find((a) => a.id === id)!;

describe('one answer of the Spacefast query API, as a view takes it', () => {
  it('a daily series: the bucket is the time dimension, and the day still filling is partial', () => {
    const { query, result, catalog } = adapt(answer('traffic'));
    expect(query).toEqual({ metrics: ['page_views', 'visitors', 'bot_traffic'], range: '30d', by: ['bucket'] });
    expect(result.rows).toHaveLength(31);
    expect(result.rows[0]).toEqual({ bucket: '2026-09-07T00:00:00Z', partial: false, page_views: 108, visitors: 83, bot_traffic: 10 });
    expect(result.rows.filter((r) => r.partial).map((r) => r.bucket)).toEqual(['2026-10-07T00:00:00Z']);
    expect(formatDimension(result.rows[1]!.bucket, catalog.dimensions.bucket!)).toBe('Sep 8');
    expect(result.meta).toEqual({ range: '30d', compare: null, notes: ['Today is still in progress.'] });
  });
  it('totals are the API\'s own: a metric with no value over a range stays null, and nothing is summed', () => {
    const { result } = adapt(answer('traffic'));
    expect(result.totals).toEqual({ page_views: 13397, visitors: null, bot_traffic: 996 });
  });
  it('the catalog comes from the answer\'s columns: units, labels, and a rise in bots is neither good nor bad', () => {
    const { catalog } = adapt(answer('pages'), { polarity: { engaged_time: 'up' } });
    expect(catalog.metrics).toEqual({
      page_views: { label: 'Page views', unit: 'count', polarity: 'up' },
      engaged_time: { label: 'Engaged time', unit: 'ms', polarity: 'up' },
      scroll_depth: { label: 'Scroll depth', unit: 'percent', polarity: 'up' },
    });
    expect(formatValue(27632, catalog.metrics.engaged_time!)).toBe('27.6s');
    expect(formatValue(72.8, catalog.metrics.scroll_depth!)).toBe('73%');
    expect(adapt(answer('headline')).catalog.metrics.bot_traffic!.polarity).toBe('none');
    expect(adapt(answer('headline')).catalog.metrics.visitor_days!.rangeTotal).toBe('sum of daily');
  });
  it('a list: rows keep the API\'s order and carry their place as a rank', () => {
    const { query, result } = adapt(answer('pages'));
    expect(query.by).toEqual(['path']);
    expect(result.rows.map((r) => r['page_views@rank'])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.rows[0]).toEqual({ path: '/', page_views: 817, engaged_time: 27014, scroll_depth: 68, 'page_views@rank': 1 });
    expect(result.totals.page_views).toBe(3287);                               // the whole range, not the ten rows
  });
  it('a country is a code the catalog says is one, and an unknown country is null', () => {
    const { result, catalog } = adapt(answer('countries'));
    expect(catalog.dimensions.country).toEqual({ label: 'Country', type: 'categorical', values: 'country' });
    expect(result.rows.map((r) => formatDimension(r.country, catalog.dimensions.country!)).slice(0, 6)).toEqual(['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', '–']);
  });
  it('a comparison is laid beside each value', () => {
    const { query, result } = adapt(answer('headline'));
    expect(query.compare).toBe('previous');
    expect(result.totals.page_views).toBe(3287);
    expect(result.totals['page_views@previous']).toBe(3582);
    expect(result.rows[0]!['engaged_time@previous']).toBe(28104);
    expect(result.meta.compare).toBe('previous');
  });
  it('a list\'s comparison is matched by value, and is null for a value that was not there before', () => {
    const pages = answer('pages'), before = { ...pages, rows: [{ path: '/shop', page_views: 90, engaged_time: null, scroll_depth: null }, { path: '/gone', page_views: 5, engaged_time: null, scroll_depth: null }], totals: { page_views: 3000, engaged_time: null, scroll_depth: null } };
    const { result } = adapt({ ...pages, previous: before });
    expect(result.rows.find((r) => r.path === '/shop')!['page_views@previous']).toBe(90);
    expect(result.rows[0]!['page_views@previous']).toBeNull();
    expect(result.totals['page_views@previous']).toBe(3000);
  });
  it('a scroll bucket is a bin ten points wide', () => {
    const bins: ApiResult = { ...answer('countries'), columns: [{ kind: 'dimension', id: 'scroll_depth_bucket', label: 'Deepest scroll', valueType: 'scroll_bucket' }, answer('countries').columns[1]!], rows: [{ scroll_depth_bucket: '0', page_views: 40 }, { scroll_depth_bucket: '90', page_views: 12 }, { scroll_depth_bucket: null, page_views: 3 }] };
    const { result, catalog } = adapt(bins);
    expect(catalog.dimensions.scroll_depth_bucket!.type).toBe('number');
    expect(result.rows).toEqual([{ scroll_depth_bucket: 0, 'scroll_depth_bucket@end': 10, page_views: 40 }, { scroll_depth_bucket: 90, 'scroll_depth_bucket@end': 100, page_views: 12 }, { scroll_depth_bucket: null, 'scroll_depth_bucket@end': null, page_views: 3 }]);
  });
  it('money is left out, and a note says so', () => {
    const { query, result, catalog } = adapt(answer('goals'));
    expect(query.metrics).toEqual(['event_occurrences']);
    expect(catalog.metrics.revenue).toBeUndefined();
    expect(result.rows[2]).toEqual({ event_label: 'purchase', event_occurrences: 203, 'event_occurrences@rank': 3 });
    expect(result.meta.notes).toEqual(['Revenue is left out: it is split by currency, which a view cannot show yet.']);
    expect(result.meta.range).toBe('31d');                                     // whole days, as the answer's own since and until say
  });
  it('an answer with nothing in it is empty', () => {
    const none = { ...answer('traffic'), rows: answer('traffic').rows.map((r) => ({ ...r, page_views: 0, visitors: 0, bot_traffic: 0 })), totals: { page_views: 0, visitors: null, bot_traffic: 0 } };
    expect(adapt(none).result.meta.empty).toBe(true);
    expect(adapt(answer('traffic')).result.meta.empty).toBeUndefined();
  });
  it('what it cannot adapt is an error that names the fix', () => {
    expect(() => adapt({ id: 'x', problem: {} } as unknown as ApiResult)).toThrow(/A failed query has a `problem`/);
    expect(() => adapt({ ...answer('traffic'), columns: [...answer('traffic').columns, answer('countries').columns[0]!] })).toThrow(/two queries in the batch/);
    expect(() => adapt({ ...answer('goals'), columns: answer('goals').columns.filter((c) => c.id !== 'event_occurrences') })).toThrow(/Ask for a count beside it/);
    const odd = answer('countries');
    expect(() => adapt({ ...odd, columns: [odd.columns[0]!, { ...odd.columns[1]!, unit: 'furlongs' } as ApiResult['columns'][number]] })).toThrow(/Add it to UNITS/);
  });
});

describe('the adapted answers draw', () => {
  const draw = (id: string, use: string, metric: string) => {
    const { query, result, catalog } = adapt(answer(id));
    const spec = { spec: 'view/0', title: id, use, query: { ...query, metrics: [metric] } } as Spec, container = makeContainer(346);
    const plan = resolve(spec, result, container, catalog);
    return { scene: place(buildScene(plan, spec.query, result, catalog), container), prose: tldrProse(spec.query, result, false, catalog) };
  };
  it('a trend of page views, with the day still filling dashed', () => {
    const { scene, prose } = draw('traffic', 'line', 'page_views');
    expect(scene.nodes.some((n) => n.key === 'primary:line:partial')).toBe(true);
    expect(prose).toContain('13.4k');
    expect(prose).toContain('last 30 days');
  });
  it('a list of top pages', () => {
    const { scene } = draw('pages', 'bar-list', 'page_views');
    const text = scene.nodes.flatMap((n) => ('text' in n && typeof n.text === 'string' ? [n.text] : []));
    expect(text).toContain('/trails/easy-loops-under-5-miles');
    expect(text).toContain('817');
  });
});
