import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, WORDS, buildScene, expand, facets, formats, resolve, viewAt, type Row } from '@unified-analytics/core';
import { spoken } from '@unified-analytics/dom';
import { catalog, facetSamples, moreSamples, runQuery, samples, scenarios } from '@unified-analytics/fixtures';
import { errOf, trend } from './helpers.ts';

/* A view speaks the language of where it lands (reference, Decided 67). Its container says which, as `rules.locale`,
 * and every number, date and name of a country a view says is then in it: the sentence, the scene, a facet's names.
 * With none said a view is in English, as it was. What a spec's author wrote and what the engine sent as a value are
 * said as they came. */
const at = (locale: string) => ({ ...CONTAINER_RULES, locale });

describe('formatters are made for a locale', () => {
  it('in English where none is given, and one set a locale', () => {
    expect(formats()).toBe(formats('en-US'));
    expect(formats('de')).toBe(formats('de'));
    expect([formats().locale, formats('de').locale]).toEqual(['en-US', 'de']);
  });
  it('a number, a share, money, a time and a country are said as the locale says them', () => {
    const de = formats('de'), en = formats(), n = (o?: Intl.NumberFormatOptions) => new Intl.NumberFormat('de', o);
    expect([en.fmt(1234.5), de.fmt(1234.5)]).toEqual(['1,234.5', '1.234,5']);
    // Held to what Intl says on this machine, and not to a string: the data behind it changes from one release to the next.
    expect(de.pct(0.074)).toBe(n({ style: 'percent', maximumFractionDigits: 1 }).format(0.074));
    expect(de.pct(0.074)).not.toBe(en.pct(0.074));
    expect(de.unit(49.5, 'eur')).toBe(n({ style: 'currency', currency: 'EUR' }).format(49.5));
    expect(de.unit(1.5, 'bytes', 'exact')).toBe(n().format(1.5) + ' B');
    expect(de.time('2026-09-08')).toBe(new Intl.DateTimeFormat('de', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(Date.UTC(2026, 8, 8)));
    expect(de.time('2026-09-08')).not.toBe(en.time('2026-09-08'));
    expect([en.dimension('DE', catalog.dimensions.country!), de.dimension('DE', catalog.dimensions.country!)]).toEqual(['Germany', 'Deutschland']);
  });
  it('a time is said as it was written, in any locale: no zone is asked', () => {
    for (const locale of ['en-US', 'de', 'ja']) expect(formats(locale).time('2026-09-08T00:00:00+02:00')).toBe(formats(locale).time('2026-09-08'));
  });
  it('a tag that is no locale is refused, and so is one this machine has no data for', () => {
    for (const tag of ['not a locale', 'tlh', '']) expect(errOf(() => formats(tag)), tag).toMatch(/^The locale ".*" is not one a view can speak here\. Give a BCP 47 language tag this machine has, such as "en-US", "de" or "pt-BR", or leave it out for English\.$/);
    expect(errOf(() => resolve(trend, runQuery(trend.query), catalog, at('tlh')))).toMatch(/^The locale "tlh"/);
  });
});

describe('a view is in its container\'s locale', () => {
  // English with other digits: whatever a view formats is then in them, and whatever it does not is plain to see.
  const OTHER = 'en-u-nu-arab';
  it('with none said it is in English, and its plan names no locale', () => {
    const result = runQuery(trend.query);
    expect(resolve(trend, result, catalog).locale).toBeUndefined();
    expect(resolve(trend, result, catalog, at('de'))).toMatchObject({ locale: 'de' });
    expect(resolve(trend, result, catalog, at('en-US')).text).toBe(resolve(trend, result, catalog).text);
  });
  it('every number and date a view says is in it: the sentence and the scene of every sample, in each state of its data', { timeout: 60000 }, () => {
    let said = 0;
    for (const [name, s] of Object.entries({ ...samples, ...moreSamples })) for (const scenario of scenarios) {
      const result = runQuery(s.spec.query, scenario), full = expand(s.spec);
      const en = resolve(s.spec, result, catalog), plan = resolve(s.spec, result, catalog, at(OTHER));
      const a = buildScene(en, full.query, result, catalog), b = buildScene(plan, full.query, result, catalog);
      expect(b.nodes.map((n) => n.key), name).toEqual(a.nodes.map((n) => n.key));
      // What is said as it came: a value of a dimension, which the engine wrote; a companion a `text` layer says that the
      // catalog has no entry for, which is a bare number; and a layer's label, which the author wrote.
      const rows: Row[] = [...result.rows, ...Object.values(result.totalsBy ?? {}).flat()], layers = full.layers ?? [];
      const bare = layers.map((l) => l.encode?.text).filter((f): f is string => typeof f === 'string' && !Object.hasOwn(catalog.metrics, f));
      const raw = [...new Set([...rows.flatMap((r) => Object.entries(r).filter(([k]) => k.split('@')[0]! in catalog.dimensions || bare.includes(k)).map(([, v]) => String(v))), ...layers.flatMap((l) => (l.label ? [l.label] : []))])]
        .filter((t) => /[0-9]/.test(t)).sort((x, y) => y.length - x.length);
      for (const [key, text] of [['the sentence', plan.text], ...b.nodes.flatMap((n) => (n.kind === 'text' ? [[n.key, n.text]] : []))] as [string, string][]) {
        said++;
        expect(raw.reduce((t, r) => t.split(r).join(''), text), name + ' ' + scenario + ' ' + key + ': ' + text).not.toMatch(/[0-9]/);
      }
    }
    expect(said).toBeGreaterThan(2500);
  });
  it('a facet\'s views are named in it, and a view at a room keeps it through a fallback', () => {
    const spec = Object.values(facetSamples).find((s) => catalog.dimensions[s.spec.facet!]!.type === 'time')?.spec;
    if (spec) { const result = runQuery(spec.query); expect(facets(spec, result, catalog, at('de')).map((v) => v.label)).not.toEqual(facets(spec, result, catalog).map((v) => v.label)); }
    const waffle = moreSamples.waffle!.spec, small = viewAt(waffle, runQuery(waffle.query), catalog, { view: { inline: 150, block: 100 } }, at(OTHER));
    expect([small.gave.length > 0, small.plan.locale]).toEqual([true, OTHER]);
  });
});

describe('the element speaks the page\'s language where its container names none', () => {
  it('a tag it can speak is the page\'s, and none, an empty one and one with no data here are English', () => {
    expect(['de', 'pt-BR', 'en', '', null, undefined, 'tlh', 'not a tag'].map(spoken)).toEqual(['de', 'pt-BR', 'en', undefined, undefined, undefined, undefined, undefined]);
  });
  it('a page in plain English is as a view with no locale is: every sample\'s sentence and scene', { timeout: 60000 }, () => {
    for (const [name, s] of Object.entries({ ...samples, ...moreSamples })) for (const scenario of scenarios) {
      const result = runQuery(s.spec.query, scenario), q = expand(s.spec).query, plain = resolve(s.spec, result, catalog), { locale: _, ...en } = resolve(s.spec, result, catalog, at('en'));
      expect(en, name).toEqual(plain);
      expect(buildScene({ ...en, locale: 'en' }, q, result, catalog), name).toEqual(buildScene(plain, q, result, catalog));
    }
  });
});

describe('the words a view says of its own are one table', () => {
  // Enough German to see a view say it. A real table is a host's to write, and gives every entry.
  const DE = { lastDays: { one: 'letzten Tag', other: 'letzten {count} Tagen' }, over: ' in den {range}', saidUp: ', {change} mehr als im Zeitraum davor', saidSumOfDaily: 'Das ist eine Summe von Tageswerten.',
    sumOfDaily: 'Summe der Tageswerte', onPrevious: '{change} zum Zeitraum davor', noData: 'Keine Daten', previous: 'Zeitraum davor' };
  it('a container hands its own with its rules, and English is said for the rest', () => {
    const F = formats('de', DE);
    expect([F.say('noData'), F.say('soFar'), formats('de').say('noData')]).toEqual(['Keine Daten', 'so far', 'No data']);
    expect(formats('de', DE)).toBe(F);
    const result = runQuery(trend.query), plan = resolve(trend, result, catalog, { ...at('de'), words: DE }), scene = buildScene(plan, expand(trend).query, result, catalog);
    expect(plan.text).toMatch(/^Visitors: \S+ in den letzten 28 Tagen, \d+\s% mehr als im Zeitraum davor\. Das ist eine Summe von Tageswerten\.$/);
    expect(scene.nodes.filter((n) => n.kind === 'text' && n.part === 'number').map((n) => (n as { text: string }).text.replace(/\d+\s%/, 'N'))).toEqual([formats('de').fmt(result.totals.visitors), '▲ N zum Zeitraum davor', 'Summe der Tageswerte']);
  });
  it('an entry that depends on a count has a form for each, by the locale\'s own plural rules', () => {
    expect([formats().range('1d'), formats().range('28d'), formats().range('now')]).toEqual(['last day', 'last 28 days', 'right now']);
    expect([formats('de', DE).range('1d'), formats('de', DE).range('28d')]).toEqual(['letzten Tag', 'letzten 28 Tagen']);
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map((n) => formats().unit(n, 'rank'))).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd']);
    // A form the table does not give is the one for the rest.
    expect(formats('en-US', { nth: { other: '{n}.' } }).unit(2, 'rank')).toBe('2.');
  });
  it('a name may ask for an English form of what fills it, and a translation need not', () => {
    expect([formats().say('counted', { count: '3', dimension: 'Country' }, 3), formats().say('counted', { count: '1', dimension: 'Country' }, 1)]).toEqual(['3 countries', '1 country']);
    expect(formats('de', { counted: '{count} × {dimension}' }).say('counted', { count: '3', dimension: 'Land' }, 3)).toBe('3 × Land');
  });
  it('a word a view does not say is refused, and so is one that is no template', () => {
    expect(errOf(() => formats('de', { nodata: 'x' } as never))).toMatch(/^The words have "nodata", which is not something a view says\. It says: up, down, .* Correct the name, or remove it\.$/);
    expect(errOf(() => formats('de', { noData: 3 } as never))).toMatch(/^The words give "noData" as 3\. Give a template, as English has it \("No data"\), or one for each plural form of a count, with "other" among them\.$/);
    expect(errOf(() => formats('de', { lastDays: { one: 'x' } } as never))).toMatch(/^The words give "lastDays"/);
    expect(errOf(() => resolve(trend, runQuery(trend.query), catalog, { ...CONTAINER_RULES, words: [] as never }))).toMatch(/^The words are \[\], and they are a table/);
  });
  it('every entry is one that something says', () => {
    const root = new URL('../packages', import.meta.url).pathname, src = readdirSync(root).filter((pkg) => existsSync(root + '/' + pkg + '/src')).flatMap((pkg) => files(root + '/' + pkg + '/src')).map((f) => readFileSync(f, 'utf8')).join('\n');
    const said = src.split('\n').filter((line) => /\bsay\(/.test(line)).join('\n');
    expect(Object.keys(WORDS).filter((w) => !said.includes("'" + w + "'"))).toEqual([]);
  });
});

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(dir + '/' + e.name) : e.name.endsWith('.ts') ? [dir + '/' + e.name] : []));
describe('nothing that builds a view formats in English behind its back', () => {
  // The English formatters keep their old names for a test and an error. A view's text is built with its plan's.
  const BARE = /(?<![.\w])(fmt|fmtPct|fmtTime|formatMetric|formatUnit|formatValue|formatDimension|formatBin|rangeLabel)\(/;
  it('no source file but format.ts calls one', () => {
    const root = new URL('../packages', import.meta.url).pathname;
    const found = readdirSync(root).filter((pkg) => existsSync(root + '/' + pkg + '/src')).flatMap((pkg) => files(root + '/' + pkg + '/src')).filter((f) => !f.endsWith('core/src/format.ts'))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n').flatMap((line, i) => (BARE.test(line) ? [f.slice(root.length + 1) + ':' + (i + 1)] : [])));
    expect(found).toEqual([]);
  });
});
