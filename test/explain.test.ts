import { describe, expect, it } from 'vitest';
import { explain, type Explanation, type ExplainRoom, type Spec } from '@unified-analytics/core';
import { catalog, moreSamples, runQuery, samples, type Scenario } from '@unified-analytics/fixtures';

const all: Record<string, { spec: Spec }> = { ...samples, ...moreSamples };
/** An explanation as lines, one an entry: part | what | from | why | lever. Golden, so a change in what a view says of itself is read in the diff. */
const lines = (e: Explanation) => [e.layout, ...e.entries.map((b) => [b.part ?? '-', b.what, b.from, b.why, b.lever ?? ''].join(' | '))];
const of = (name: string, room?: ExplainRoom, scenario?: Scenario, spec = all[name]!.spec) => explain(spec, runQuery(spec.query, scenario), catalog, room);

describe('explain', () => {
  it('says every part a view shows, and the place in the spec it comes from', () => {
    for (const [name, s] of Object.entries(all)) {
      const e = of(name), shown = e.entries.filter((b) => b.what === 'shown');
      expect(e.entries[0]!.what, name).toMatch(/^the layout is |^the view is its number/);
      for (const b of shown) expect(b.from, name + ' ' + b.part).toMatch(/^layers\[\d+\]|^use "|^query\.|^result|^the layout/);
      // A spec written as layers is named by its own paths, a preset through its name.
      if (s.spec.layers) expect(shown.every((b) => !b.from.startsWith('use ')), name).toBe(true);
    }
  });
  it('says which rule hides a part at a room, what it needs and what it has, and the room that would change it', () => {
    expect(lines(of('trend', { inline: 250 }))).toMatchSnapshot();
    expect(lines(of('mix', { inline: 120 }))).toMatchSnapshot();
    expect(lines(of('donut', { inline: 120, block: 100 }))).toMatchSnapshot();
    expect(lines(of('pages', { inline: 80 }))).toMatchSnapshot();
    expect(lines(of('dual', { inline: 480, block: 100 }))).toMatchSnapshot();
  });
  it('says a key\'s shorter form, and what went with a key that could not stay', () => {
    const what = (name: string, room: ExplainRoom, part: string) => of(name, room).entries.find((b) => b.part === part && b.rule)?.what;
    expect(what('heatmap', { inline: 220, block: 130 }, 'ramp')).toBe('shown as a thin strip');
    expect(what('bubble', { inline: 300, block: 150 }, 'size')).toBe('shown as its largest step');
    expect(what('rose', { inline: 200, block: 110 }, 'rim')).toBe('thinned to about four');
    expect(what('series', { inline: 250 }, 'labels')).toBe('hidden, and the marks it keyed drawn in one colour');
    expect(what('donut', { inline: 170, block: 80 }, 'legend')).toBe('hidden, and the marks it keyed drawn in one colour');
    // Bars have no line end to label, so no rule acts on their legend while the axes are there.
    expect(what('grouped', { inline: 300 }, 'legend')).toBeUndefined();
  });
  it('says why a comparison is not drawn, and what to add', () => {
    const spec = all.trend!.spec, asked = of('trend', undefined, 'no-prior');
    if (spec.query.compare === 'previous') expect(asked.entries.find((b) => b.what === 'not drawn')?.why).toBe('the result has no previous period to compare with');
    const { compare: _, ...query } = spec.query, unasked = of('trend', undefined, undefined, { ...spec, query });
    const missing = unasked.entries.find((b) => b.what === 'not drawn');
    if (missing) expect(missing.lever).toBe('add "compare": "previous" to the query');
  });
  it('says a view a rule hands to another preset is drawn as that preset', () => {
    const e = of('units', { inline: 200 });
    expect(e.entries.at(-1)!.what).toMatch(/^drawn as "/);
  });
});
