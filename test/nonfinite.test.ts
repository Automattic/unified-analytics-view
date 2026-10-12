import { describe, expect, it } from 'vitest';
import { buildScene, makeContainer, resolve } from '@unified-analytics/core';
import type { Result, Row } from '@unified-analytics/core';
import { catalog, runQuery, samples } from '@unified-analytics/fixtures';

// A metric's value is a finite number or null. Anything else used to reach a line's `d`, a bar's ratios and the tldr
// value as "NaN"; it is refused once, in buildScene (checkValues in packages/core/src/scene.ts), which resolve() goes through.
const c = makeContainer(600, null), spec = samples.trend!.spec, q = spec.query;
const fresh = (): Result => structuredClone(runQuery(q, 'typical'));
const err = (f: () => unknown) => { try { f(); } catch (e) { return (e as Error).message; } };
const rest = ', and a metric\'s value is a finite number or null. Send null from the query layer where there is no figure: it is drawn as a gap and written as a dash.';
const scene = (result: Result) => { const plan = resolve(spec, result, c, catalog); return { plan, scene: buildScene(plan, q, result, catalog) }; };
// JSON writes NaN as null, so the numbers are looked at themselves.
const numbers = (v: unknown): number[] => (typeof v === 'number' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(numbers) : []);

describe('a value that is not a finite number', () => {
  it.each([[NaN, 'NaN'], [Infinity, 'Infinity'], [-Infinity, '-Infinity'], ['abc', '"abc"'], [undefined, 'undefined']])('%s in a row is refused, by field and row', (v, said) => {
    const result = fresh();
    result.rows[2]!.visitors = v as number;
    expect(err(() => resolve(spec, result, c, catalog))).toBe('The result has "visitors": ' + said + ' in row 3' + rest);
  });
  it('is refused in the totals, in a companion and in totalsBy, and by buildScene called alone', () => {
    const plan = resolve(spec, fresh(), c, catalog);
    const put = (at: (r: Result) => Row, f: string) => { const result = fresh(); at(result)[f] = NaN; return err(() => buildScene(plan, q, result, catalog)); };
    expect(put((r) => r.totals, 'visitors')).toBe('The result has "visitors": NaN in its totals' + rest);
    expect(put((r) => r.rows[0]!, 'visitors@previous')).toBe('The result has "visitors@previous": NaN in row 1' + rest);
    expect(put((r) => (r.totalsBy = { channel: [{ channel: 'Search' }, {}] }).channel[1]!, 'visitors')).toBe('The result has "visitors": NaN in row 2 of totalsBy["channel"]' + rest);
  });
  it('null is still no value: a gap in the line, a dash for the number, and no NaN anywhere in the scene', () => {
    const result = fresh();
    result.rows[2]!.visitors = null;
    result.totals.visitors = null;
    const { plan, scene: s } = scene(result);
    expect(numbers(s.nodes).every(Number.isFinite)).toBe(true);
    expect(JSON.stringify(s.nodes) + plan.text).not.toMatch(/NaN|Infinity/);
    expect(s.nodes.find((n) => n.key === 'value')).toMatchObject({ text: '–' });
  });
  it('a dimension\'s value is not a metric\'s, and is written as it comes', () => {
    const result = runQuery(samples.pages!.spec.query, 'typical');
    result.rows[0]!.page = 'NaN';
    expect(() => resolve(samples.pages!.spec, result, c, catalog)).not.toThrow();
  });
});
