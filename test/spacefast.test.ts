import { describe, expect, it } from 'vitest';
import { buildScene, formatDimension, formatValue, place, resolve, tldrProse, makeContainer, type Spec } from '@unified-analytics/core';
import { adapt, type ApiResult } from '@unified-analytics/spacefast';
import trends from './fixtures/spacefast/trends.response.json';
import breakdowns from './fixtures/spacefast/breakdowns.response.json';

// The API's own examples (spacefast/monorepo, at b1e28cc), recorded from its store for a seeded site.
const answers = [...trends.data.results, ...breakdowns.data.results] as unknown as ApiResult[];
const answer = (id: string) => answers.find((a) => a.id === id)!;

describe('one answer of the Spacefast query API, as a view takes it', () => {
  it('a daily series: the bucket is the time dimension, and a day the range only partly covers is partial, as is the one still filling', () => {
    const { query, result, catalog } = adapt(answer('traffic'));
    expect(query).toEqual({ metrics: ['page_views', 'visitors', 'bot_traffic'], range: '30d', by: ['bucket'] });
    expect(result.rows).toHaveLength(31);
    expect(result.rows[0]).toEqual({ bucket: '2026-09-07T00:00:00Z', partial: true, page_views: 108, visitors: 83, bot_traffic: 10 });
    expect(result.rows.filter((r) => r.partial).map((r) => r.bucket)).toEqual(['2026-09-07T00:00:00Z', '2026-10-07T00:00:00Z']);
    expect(formatDimension(result.rows[1]!.bucket, catalog.dimensions.bucket!)).toBe('Sep 8');
    expect(result.meta).toEqual({ range: '30d', compare: null, notes: ['Today is still in progress.'] });
  });
  it('totals are the API\'s own: a metric with no value over a range stays null, and nothing is summed', () => {
    const { result } = adapt(answer('traffic'));
    expect(result.totals).toEqual({ page_views: 13397, visitors: null, bot_traffic: 996 });
  });
  it('the catalog comes from the answer\'s columns: units, labels, and whether a rise is good', () => {
    const { catalog } = adapt(answer('pages'));
    expect(catalog.metrics).toEqual({
      page_views: { label: 'Page views', unit: 'count', polarity: 'up', definition: 'One page load or client-side route change.' },
      engaged_time: { label: 'Engaged time', unit: 'ms', polarity: 'up', definition: expect.stringContaining('Median') },
      scroll_depth: { label: 'Scroll depth', unit: 'percent', polarity: 'up', definition: expect.any(String) },
    });
    // The caveat travels with the number: consented visitors only, in the API's own words.
    expect(adapt(answer('headline')).catalog.metrics.unique_visitors_range!.definition).toMatch(/consented visitors only/);
    expect(formatValue(27632, catalog.metrics.engaged_time!)).toBe('27.6s');
    expect(formatValue(72.8, catalog.metrics.scroll_depth!)).toBe('73%');
    expect(adapt(answer('headline')).catalog.metrics.bot_traffic!.polarity).toBe('none');
    const col = answer('countries').columns, down = adapt({ ...answer('countries'), columns: [col[0]!, { ...col[1]!, polarity: 'down_is_good' } as ApiResult['columns'][number]] });
    expect(down.catalog.metrics.page_views!.polarity).toBe('down');
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
    expect(result.totals['engaged_time@previous']).toBe(28104);
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
  it('scroll buckets draw as a strip: a cell layer with no x is one column, a row for each bin', () => {
    const bins: ApiResult = { ...answer('countries'), columns: [{ kind: 'dimension', id: 'scroll_depth_bucket', label: 'Deepest scroll', valueType: 'scroll_bucket' }, answer('countries').columns[1]!], rows: [{ scroll_depth_bucket: '0', page_views: 40 }, { scroll_depth_bucket: '90', page_views: 25 }, { scroll_depth_bucket: '10', page_views: 12 }] };
    const { query, result, catalog } = adapt(bins);
    const spec = { spec: 'view/0', query, layers: [{ mark: 'cell', encode: { y: 'scroll_depth_bucket', color: 'page_views' } }] } as Spec;
    const plan = resolve(spec, result, makeContainer(346), catalog), scene = buildScene(plan, spec.query, result, catalog);
    expect(plan.layout).toBe('matrix');
    const cells = scene.nodes.filter((n) => n.part === 'plot') as { x: number; w: number; pair: string[] }[];
    expect(cells.map((c) => [c.x, c.w, c.pair])).toEqual([[0, 1, ['', '0']], [0, 1, ['', '10']], [0, 1, ['', '90']]]);
    expect(scene.nodes.filter((n) => n.part === 'y-axis').map((n) => (n as { text: string }).text)).toEqual(['0–10', '10–20', '90–100']);
    expect(scene.nodes.some((n) => n.part === 'x-axis')).toBe(false);
  });
  it('a cell layer with no y is one row, and a binned row is labelled at its edges', () => {
    const catalog = { metrics: { arrivals: { label: 'Arrivals', unit: 'count' as const, polarity: 'none' as const } }, dimensions: { ago: { label: 'Seconds from now', type: 'number' as const } } };
    const query = { metrics: ['arrivals'], by: ['ago'] }, result = { rows: [{ ago: -30, 'ago@end': -20, arrivals: 0 }, { ago: -20, 'ago@end': -10, arrivals: 2 }, { ago: -10, 'ago@end': 0, arrivals: 1 }], totals: { arrivals: 3 }, meta: { range: 'now', compare: null, notes: [] } };
    const spec = { spec: 'view/0', query, layers: [{ mark: 'cell', encode: { x: 'ago', color: 'arrivals' } }] } as Spec;
    const plan = resolve(spec, result, makeContainer(346), catalog), scene = buildScene(plan, query, result, catalog);
    expect(plan.layout).toBe('matrix');
    expect((scene.nodes.filter((n) => n.part === 'plot') as { y: number; h: number; pair: string[] }[]).map((c) => [c.y, c.h, c.pair])).toEqual([[0, 1, ['-30', '']], [0, 1, ['-20', '']], [0, 1, ['-10', '']]]);
    expect((scene.nodes.filter((n) => n.part === 'x-axis') as { text: string; x: number }[]).map((n) => [n.text, n.x])).toEqual([['-30', 0], ['-20', 1 / 3], ['-10', 2 / 3], ['0', 1]]);
    expect(scene.nodes.some((n) => n.part === 'y-axis')).toBe(false);
  });
  it('money is a metric for each currency, in the currency\'s own units, and nothing is added across them', () => {
    const { query, result, catalog } = adapt(answer('goals'));
    expect(query.metrics).toEqual(['event_occurrences', 'revenue.eur', 'revenue.gbp', 'revenue.usd']);
    expect(catalog.metrics['revenue.eur']).toEqual({ label: 'Revenue (EUR)', unit: 'eur', polarity: 'up', rangeTotal: 'sum', definition: expect.any(String) });
    expect(result.rows[2]).toEqual({ event_label: 'purchase', event_occurrences: 203, 'revenue.eur': 418, 'revenue.gbp': 126, 'revenue.usd': 4333, 'event_occurrences@rank': 3 });
    expect(result.rows[0]!['revenue.usd']).toBeNull();                         // an event with no amount has none, not zero
    expect(result.totals).toEqual({ event_occurrences: 738, 'revenue.eur': 418, 'revenue.gbp': 126, 'revenue.usd': 4333 });
    expect(query.metrics.slice(1).map((m) => formatValue(result.totals[m], catalog.metrics[m]!))).toEqual(['€418', '£126', '$4,333']);
    expect(result.meta.notes).toEqual([]);
    expect(result.meta.range).toBe('31d');                                     // whole days, as the answer's own since and until say
  });
  it('minor units are ISO 4217\'s, by the tracker\'s table and not the browser\'s: yen whole, dinars in thousandths, forints in hundredths', () => {
    const goals = answer('goals'), sold = [{ amountMinor: 5000, currency: 'jpy' }, { amountMinor: 1234, currency: 'kwd' }, { amountMinor: 123456, currency: 'huf' }];
    const { result } = adapt({ ...goals, rows: [{ event_label: 'purchase', event_occurrences: 1, revenue: sold }], totals: { event_occurrences: 1, revenue: sold } });
    expect([result.totals['revenue.jpy'], result.totals['revenue.kwd'], result.totals['revenue.huf']]).toEqual([5000, 1.234, 1234.56]);
  });
  it('money with no amount anywhere is a note, as is a code that is no currency, and empty revenue may be null', () => {
    const goals = answer('goals'), typo = [{ amountMinor: 4999, currency: 'usx' }, { amountMinor: 4999, currency: 'usd' }];
    const odd = adapt({ ...goals, rows: [{ event_label: 'purchase', event_occurrences: 1, revenue: typo }, { event_label: 'newsletter', event_occurrences: 2, revenue: null }], totals: { event_occurrences: 3, revenue: typo } });
    expect(odd.query.metrics).toEqual(['event_occurrences', 'revenue.usd']);
    expect(odd.result.rows.map((r) => r['revenue.usd'])).toEqual([49.99, null]);
    expect(odd.result.meta.notes).toEqual(['Revenue in "usx" is left out: that is not a currency.']);
    const none = adapt({ ...goals, rows: goals.rows.slice(0, 2), totals: { event_occurrences: 535, revenue: [] } });
    expect(none.query.metrics).toEqual(['event_occurrences']);
    expect(none.result.meta.notes).toEqual(['Revenue has no amount in any currency over this range.']);
  });
  it('an answer with nothing in it is empty', () => {
    const none = { ...answer('traffic'), rows: answer('traffic').rows.map((r) => ({ ...r, page_views: 0, visitors: 0, bot_traffic: 0 })), totals: { page_views: 0, visitors: null, bot_traffic: 0 } };
    expect(adapt(none).result.meta.empty).toBe(true);
    expect(adapt(answer('traffic')).result.meta.empty).toBeUndefined();
  });
  it('what it cannot adapt is an error that names the fix', () => {
    expect(() => adapt({ id: 'x', problem: {} } as unknown as ApiResult)).toThrow(/A failed query has a `problem`/);
    expect(() => adapt({ ...answer('traffic'), columns: [...answer('traffic').columns, answer('countries').columns[0]!] })).toThrow(/two queries in the batch/);
    expect(() => adapt({ ...answer('goals'), columns: answer('goals').columns.filter((c) => c.kind !== 'metric') })).toThrow(/Ask for at least one metric/);
    expect(() => adapt({ ...answer('goals'), columns: answer('goals').columns.filter((c) => c.id !== 'event_occurrences'), rows: [], totals: { revenue: [] } })).toThrow(/"revenue" has no amount in any currency over this range\. Ask for a count beside it, or a longer range/);
    const odd = answer('countries');
    expect(() => adapt({ ...odd, columns: [odd.columns[0]!, { ...odd.columns[1]!, unit: 'furlongs' } as ApiResult['columns'][number]] })).toThrow(/Add it to UNITS/);
    expect(() => adapt({ ...odd, columns: [odd.columns[0]!, { ...odd.columns[1]!, polarity: 'sideways' } as ApiResult['columns'][number]] })).toThrow(/Add it to POLARITY/);
  });
});

describe('the adapted answers draw', () => {
  const draw = (id: string, use: string, metric: string) => {
    const { query, result, catalog } = adapt(answer(id));
    const spec = { spec: 'view/0', title: id, use, query: { ...query, metrics: [metric] } } as Spec, container = makeContainer(346);
    const plan = resolve(spec, result, container, catalog);
    return { scene: place(buildScene(plan, spec.query, result, catalog), container), prose: tldrProse(spec.query, result, false, catalog) };
  };
  it('a trend of page views, dashed in from the day the range starts inside and out to the one still filling', () => {
    const { scene, prose } = draw('traffic', 'line', 'page_views');
    expect(scene.nodes.flatMap((n) => ('note' in n && n.note === 'incomplete bucket' ? [n.key] : []))).toEqual(['primary:line:partial:lead', 'primary:line:partial']);
    expect(prose).toContain('13.4k');
    expect(prose).toContain('last 30 days');
  });
  it('revenue in one currency, on an axis in that currency', () => {
    const { scene, prose } = draw('goals', 'bar-list', 'revenue.eur');
    const text = scene.nodes.flatMap((n) => ('text' in n && typeof n.text === 'string' ? [n.text] : []));
    expect(text).toContain('€418');
    expect(prose).toContain('€418');
  });
  it('a headline whose numbers are in the totals, with no rows', () => {
    const { query, result, catalog } = adapt({ ...answer('headline'), rows: [], previous: { ...answer('headline').previous!, rows: [] } });
    const spec = { query: { ...query, metrics: ['page_views'] } };
    expect(result.rows).toEqual([]);
    expect(result.meta.empty).toBeUndefined();
    expect(tldrProse(spec.query, result, false, catalog)).toBe('Page views: 3,287 in the last 7 days, down 8.2% on the previous period.');
  });
  it('the number carries its metric\'s definition, for a painter to show when it is pointed at', () => {
    const { query, result, catalog } = adapt(answer('headline'));
    const spec = { spec: 'view/0', title: 'Visitors', query: { ...query, metrics: ['unique_visitors_range'] }, layers: [] } as unknown as Spec, container = makeContainer(346);
    const scene = buildScene(resolve(spec, result, container, catalog), spec.query, result, catalog), value = scene.nodes.find((n) => n.key === 'value') as { text: string; note?: string };
    expect(value.text).toBe('134');
    expect(value.note).toMatch(/consented visitors only/);
  });
  it('a list of top pages', () => {
    const { scene } = draw('pages', 'bar-list', 'page_views');
    const text = scene.nodes.flatMap((n) => ('text' in n && typeof n.text === 'string' ? [n.text] : []));
    expect(text).toContain('/trails/easy-loops-under-5-miles');
    expect(text).toContain('817');
  });
});
