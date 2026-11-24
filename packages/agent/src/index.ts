import { readFileSync } from 'node:fs';
import Ajv, { type ErrorObject } from 'ajv';
import { FIELDS, FIT_RULES, GUIDES, NEEDS, PRESETS, READS, customMarks, customPresets, explain, facets, viewAt, type Because, type Catalog, type Result, type Spec } from '@unified-analytics/core';

/* The agent surface (docs/focus-plan.md, step 7): what an author who is not in this repository needs in order to
 * write a view and know what became of it. It wraps what core has and adds no rule. Two things, both plain data:
 *
 *   describe()   what can be said: the schemas, what each mark reads, the guides, the fit rules, the presets.
 *   check()      a spec with its answer, with no browser: the refusal, or what the view says and shows at each room.
 *
 * A spec drawn, with pictures, is the bench's capture (apps/bench), which the server beside this offers too. */

const schema = (name: string) => JSON.parse(readFileSync(new URL('../../core/schema/' + name + '.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const SCHEMAS = { view: schema('view'), catalog: schema('catalog'), board: schema('board'), scene: schema('scene') };

/** What can be said, as data: the contract an author writes against. `catalog` is the one the views are of, where the
 * caller has it: the names a spec may use are its, and core knows none. */
export function describe(catalog?: Catalog) {
  return {
    schemas: SCHEMAS,
    /** For each layout, the marks it draws, the channels each reads and what a channel may hold there. */
    reads: READS,
    /** The channels a mark is not drawn without. */
    needs: NEEDS,
    /** The layer fields each mark has a use for. One written on another mark is refused. */
    fields: FIELDS,
    /** The marks registered in code: each is a layout of its own, under its name. */
    customMarks: Object.fromEntries([...customMarks()].map(([name, m]) => [name, { reads: m.reads ?? null, fields: m.fields ?? [], fit: m.rules }])),
    /** Which encoding each guide is read off, the parts it is painted in, and whether it is a key. A guide is never authored. */
    guides: Object.fromEntries(Object.entries(GUIDES).map(([name, { from: _from, ...guide }]) => [name, guide])),
    /** What each part needs, and what goes without it: how a view gives way when room is short. */
    fit: FIT_RULES,
    presets: { library: PRESETS, registered: Object.fromEntries(customPresets()) },
    ...(catalog && { catalog }),
  };
}

/** The room a view has, in px: its width, and its height where it was handed one. */
export interface Room { inline: number; block?: number | null }
/** A view at one room: the parts that show, what else a rule hides, the switches set, what it gave way from, and why. */
export interface AtRoom { room: Room; parts: string[]; hidden: string[]; set: Record<string, string>; gave: string[]; because: Because[] }
/** One view checked: a spec's own, or each view of a facet under its value. */
export interface Viewed { key?: string; layout: string; sentence: string; dropped: string[]; made: Because[]; rooms: AtRoom[] }
export type Checked = { ok: false; error: string } | { ok: true; /** What the view is for, where its author said. */ description?: string; views: Viewed[] };

/** The rooms a view is read at where none is asked for: a sidebar, a tile, and a cell of a table. */
export const ROOMS: Room[] = [{ inline: 346 }, { inline: 250, block: 100 }, { inline: 120, block: 60 }];

const validView = new Ajv({ allowUnionTypes: true, verbose: true, strict: false }).compile(SCHEMAS.view);
/** What the schema refuses, in a sentence that names the fix. It is asked once core has drawn the spec: core's own
 * refusals say more, and what is left for the schema is what core reads past, a size or a switch that would be drawn without. */
function refused(errors: ErrorObject[]): string {
  const e = errors.find((x) => x.keyword === 'additionalProperties') ?? errors[0]!, at = e.instancePath ? 'spec' + e.instancePath.replace(/\/(\d+)/g, '[$1]').replace(/\//g, '.') : 'The spec';
  if (e.keyword === 'additionalProperties') {
    const takes = Object.keys((e.parentSchema as { properties?: object }).properties ?? {});
    return at + ' has "' + (e.params as { additionalProperty: string }).additionalProperty + '", which it does not take. It takes: ' + takes.join(', ') + '. A view says what to show and nothing of how: no size, breakpoint or switch.';
  }
  return at + ' ' + e.message + (e.keyword === 'enum' ? ': ' + (e.params as { allowedValues: unknown[] }).allowedValues.join(', ') : '') + '.';
}

/** A spec with its answer and catalog, read with no browser. Refused: the message, which names the fix. Drawn: what
 * the view says, how it is laid out and from where in the spec, and at each room the parts that show and each fit rule
 * that holds, with the lever that changes it. A spec with a `facet` is each of its views. Pure, and it measures nothing:
 * what depends on the size of the content is a surface's to see, and the capture's to show. */
export function check({ spec, result, catalog, rooms = ROOMS }: { spec: Spec; result: Result; catalog: Catalog; rooms?: Room[] }): Checked {
  try {
    const each = spec.facet != null ? facets(spec, result, catalog).map((f) => ({ key: f.key, spec: f.spec, result: f.result })) : [{ spec, result }];
    const views = each.map((v): Viewed => {
      const made = explain(v.spec, v.result, catalog), first = viewAt(v.spec, v.result, catalog, { view: { inline: Infinity, block: null } });
      return {
        ...('key' in v && { key: v.key }), layout: made.layout, sentence: first.plan.text, dropped: first.plan.dropped, made: made.entries,
        rooms: rooms.map((room): AtRoom => {
          const at = viewAt(v.spec, v.result, catalog, { view: { inline: room.inline, block: room.block ?? null } });
          return { room, parts: at.fit.parts, hidden: at.fit.hidden, set: at.fit.set, gave: at.gave, because: explain(at.spec, v.result, catalog, room).entries.filter((b) => b.rule) };
        }),
      };
    });
    return validView({ spec: 'view/0', ...spec }) ? { ok: true, ...(spec.description && { description: spec.description }), views } : { ok: false, error: refused(validView.errors ?? []) };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
