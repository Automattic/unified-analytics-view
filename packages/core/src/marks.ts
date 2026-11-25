import type { FitRule } from './fit.ts';
import type { Formats } from './format.ts';
import type { Field, Reads } from './reads.ts';
import { LAYOUTS, MARKS } from './types.ts';
import type { Catalog, Guides, Layer, Part, Query, Result, Scene } from './types.ts';

/* Custom marks: where a form the grammar cannot say enters the system (reference, section 7). One is a candidate for
 * the system, and not a way round it: it is held to what a core mark is held to (test/admission.test.ts), so that what
 * proves itself can move into core as it stands. One is registered in
 * code under a name, and a spec refers to it by that name in `mark` and passes it encodings, nothing else. Whatever
 * else it draws from, such as the boundary shapes of a map, it was handed when it was made, as the catalog is handed in.
 *
 * A custom mark is laid out by its own code, so it is a layout of its own, under its own name: a view draws its layers
 * alone, its fit rules name it in `layout`, and a painter is registered for it under the same name. This is core's
 * half. It has no DOM.
 *
 * The registry is a map and two functions. Do not let it grow into a plugin system. */

/** What a custom mark's scene is built from. `formats` is how the view says a number, a time and a name, in its container's locale: a mark's text goes through it. */
export interface MarkView { layers: Layer[]; guides: Guides; query: Query; result: Result; catalog: Catalog; formats: Formats }

export interface CustomMark {
  /** The channels it reads, and what each may hold (reads.ts). `resolve()` refuses an encoding that is not among them,
   * as it does for core's marks: one a mark does not read is drawn without. A mark that says nothing here is not asked. */
  reads?: Reads;
  /** The layer fields it reads beside its channels, of those only some marks read (reads.ts, `FIELDS`): a `paint` for
   * its symbols, say. One it does not name is refused on its layer, where it was once drawn without. */
  fields?: readonly Field[];
  /** The fit rules of its layout, read as core's are (`fitTo`). A context's own rules for the layout come before these.
   * A key steps down to a shorter form by a switch (`set: { ramp: 'strip' }`, `'size-key': 'most'`), which its painter
   * draws. A key may not go while the marks it keys are drawn (test/guides.test.ts). */
  rules: FitRule[];
  /** Its scene, in ratios, with stable keys and paint tokens: every node, and in `parts` the ones the plan shows.
   * The plan's guides say whether it has a `ramp` and a `size`. `rows` are the dimension values in the result's order,
   * one for each of its rows. */
  scene(view: MarkView): Pick<Scene, 'nodes' | 'rows' | 'aspect'> & { parts: Part[] };
  /** The places its space has, for the plot's marks that stand at a place and need no axis (reference, Decided 44):
   * where the value `key` of the dimension on its `x` is, across and up its `plot` part's box from 0 to 1, or null
   * where that value has no place. A mark that gives this lets a `text` layer on the same `x` say something at each
   * place, drawn by the plot's own function. One that does not is drawn alone, as before. */
  places?(view: MarkView): (key: string) => { x: number; y: number } | null;
}

const REGISTERED = new Map<string, CustomMark>();

/** Register a custom mark under a name, or replace the one that has it. */
export function registerMark(name: string, mark: CustomMark): void {
  if (!/^[\w-]+$/.test(name)) throw new Error('A custom mark cannot be named ' + JSON.stringify(name) + ': the name is written into specs and selectors. Use letters, digits, "_" and "-" only.');
  // A custom mark's name is its layout's, so it cannot be one of core's layouts either.
  if (([...MARKS, ...LAYOUTS] as string[]).includes(name)) throw new Error('A custom mark cannot be named "' + name + '", which core has already. Register it under another name.');
  // Its rules are compiled for the layout they name, so rules made for another name would fit nothing here, silently.
  const other = mark.rules.find((r) => r.layout !== name);
  if (other) throw new Error('The mark registered as "' + name + '" has fit rules for the "' + other.layout + '" layout, and a custom mark\'s layout is its name. Make the mark under the name "' + name + '", as its package\'s maker lets you, or set "layout" to "' + name + '" in each of its rules.');
  REGISTERED.set(name, mark);
}
/** The marks registered, by name. */
export function customMarks(): ReadonlyMap<string, CustomMark> {
  return REGISTERED;
}
