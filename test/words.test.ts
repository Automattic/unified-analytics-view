import { describe, expect, it } from 'vitest';
import { buildScene, resolve, unboundedContainer, type Catalog, type Result, type Row, type Spec } from '@unified-analytics/core';

// A catalog with no visits, people or pages in it. Whatever a view says of these is said from the catalog and the query.
const catalog: Catalog = {
  metrics: {
    revenue: { label: 'Revenue', unit: 'usd', polarity: 'up', rangeTotal: 'sum of daily' },
    bounce: { label: 'Bounce rate', unit: 'ratio', polarity: 'down' },
    back: { label: 'Came back', unit: 'count', polarity: 'up' },
    engaged: { label: 'Avg. engaged time', unit: 's', polarity: 'up' },
    carts: { label: 'Open carts', unit: 'count', polarity: 'none', instant: true },
    held: { label: 'Value held', unit: 'eur', polarity: 'none', instant: true },
  },
  dimensions: {
    day: { label: 'Day', type: 'time' },
    sku: { label: 'SKU', type: 'categorical' },
    country: { label: 'Country', type: 'categorical', values: 'country' },
  },
};
const result = (totals: Result['totals'], rows: Row[] = [], range = '28d'): Result => ({ rows, totals, meta: { range, compare: null, notes: [], empty: !rows.length && range !== 'now' } });
const view = (metric: string, by?: string, use?: string): Spec => ({ spec: 'view/0', ...(use && { use }), query: { metrics: [metric], ...(by && { by: [by] }), ...(!catalog.metrics[metric]!.instant && { range: '28d' }) } });
/** Everything a view says in words: its prose, and the text of each node of its scene. */
const said = (spec: Spec, res: Result) => {
  const plan = resolve(spec, res, unboundedContainer(), catalog), scene = buildScene(plan, spec.query, res, catalog);
  return { prose: plan.text, texts: scene.nodes.flatMap((n) => (n.kind === 'text' ? [n.text] : [])) };
};

// [what it is, the spec, the result, the prose, and what the scene must say among its texts]
const cases: [string, Spec, Result, string, string[]][] = [
  ['an empty range of money, with marks', view('revenue', 'day', 'line'), result({ revenue: 0 }), 'Revenue: nothing recorded in the last 28 days.', ['Revenue: nothing in this period yet']],
  ['an empty range of money, the number alone', view('revenue'), result({ revenue: 0 }), 'Revenue: nothing recorded in the last 28 days.', ['$0', 'Revenue: nothing yet']],
  ['an empty rate', view('bounce'), result({ bounce: null }), 'Bounce rate: nothing recorded in the last 28 days.', ['0%', 'Bounce rate: nothing yet']],
  ['an empty range of a metric whose label is no noun', view('back', 'day', 'line'), result({ back: 0 }), 'Came back: nothing recorded in the last 28 days.', ['Came back: nothing in this period yet']],
  ['an empty length of time, by a dimension', view('engaged', 'sku', 'bar-list'), result({ engaged: null }), 'Avg. engaged time: nothing recorded in the last 28 days.', ['Avg. engaged time: nothing in this period yet']],
  ['money over a range', view('revenue'), result({ revenue: 4333 }, [{ revenue: 4333 }]), 'Revenue: $4,333 in the last 28 days. This is a sum of daily counts, not a unique count.', ['$4,333', 'Sum of daily counts']],
  ['an instant count, no dimension', view('carts'), result({ carts: 3 }, [], 'now'), 'Open carts: 3 right now.', ['3', 'right now']],
  ['an instant count of one', view('carts'), result({ carts: 1 }, [], 'now'), 'Open carts: 1 right now.', ['1', 'right now']],
  ['an instant count, by a dimension', view('carts', 'sku', 'bar-list'), result({ carts: 3 }, [{ sku: 'A-100', carts: 2 }, { sku: 'B-200', carts: 1 }], 'now'), 'Open carts: 3 right now; the top sku is A-100 (2).', ['3', 'right now', 'A-100']],
  ['an instant count at zero, by a dimension', view('carts', 'sku', 'bar-list'), result({ carts: 0 }, [], 'now'), 'Open carts: 0 right now.', ['0', 'right now']],
  ['an instant count the engine sent no total for', view('carts'), result({ carts: null }, [], 'now'), 'Open carts: 0 right now.', ['0', 'right now']],
  ['an instant amount of money, by country', view('held', 'country', 'bar-list'), result({ held: 1250 }, [{ country: 'DE', held: 900 }, { country: 'FR', held: 350 }], 'now'), 'Value held: €1,250 right now; the top country is Germany (€900).', ['€1,250', 'right now', 'Germany']],
  ['an instant count whose top value is null', view('carts', 'sku', 'bar-list'), result({ carts: 9 }, [{ sku: null, carts: 9 }], 'now'), 'Open carts: 9 right now; the top sku is – (9).', ['9', '–']],
  ['a ranking with a null value and codes', view('revenue', 'country', 'bar-list'), result({ revenue: 60 }, [{ country: 'DE', revenue: 30 }, { country: null, revenue: 20 }, { country: 'FR', revenue: 10 }]), 'Top countries by revenue, last 28 days: Germany ($30), – ($20), France ($10).', ['Germany', '–', 'France']],
  ['shares with a null value and codes', view('revenue', 'country', 'share-bar'), result({ revenue: 60 }, [{ country: null, revenue: 40 }, { country: 'DE', revenue: 20 }]), '– is the largest country at 67% of revenue, followed by Germany at 33%.', ['–', 'Germany']],
];

describe('the words of a view come from the catalog and the query', () => {
  it.each(cases)('%s', (_, spec, res, prose, texts) => {
    const got = said(spec, res);
    expect(got.prose).toBe(prose);
    for (const t of texts) expect(got.texts, t).toContain(t);
    // No name core could only know by being told one, and no field read off a row that the query did not ask for.
    for (const s of [got.prose, ...got.texts]) expect(s).not.toMatch(/visit|people|person|nobody|page|site|undefined|null|NaN/i);
  });
});
