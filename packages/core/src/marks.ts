import type { FitRule } from './fit.ts';
import { MARKS } from './types.ts';
import type { Catalog, Container, Guides, Layer, Part, PlacedNode, Query, Result, Scene } from './types.ts';

/* Custom marks: the escape hatch for what the grammar cannot express (reference, section 7). One is registered in
 * code under a name, and a spec refers to it by that name in `mark` and passes it encodings, nothing else. Whatever
 * else it draws from, such as the boundary shapes of a map, it was handed when it was made, as the catalog is handed in.
 *
 * A custom mark is laid out by its own code, so it is a layout of its own, under its own name: a view draws its layers
 * alone, its fit rules name it in `layout`, and a painter is registered for it under the same name. This is core's
 * half. It has no DOM.
 *
 * The registry is a map and two functions. Do not let it grow into a plugin system. */

/** What a custom mark's scene is built from: the plan's layers and guides, the query, and the result and catalog as they were given. */
export interface MarkView { layers: Layer[]; guides: Guides; query: Query; result: Result; catalog: Catalog }

export interface CustomMark {
  /** The fit rules of its layout. A context's own rules for the layout come before these. Two ids are asked for by
   * `resolve()`: `guides` is the room its `ramp` and `size` parts need, and `marks` the room the marks do. */
  rules: FitRule[];
  /** Its scene, in ratios, with stable keys and paint tokens: every node, whatever the plan shows, and in `parts` the
   * ones it does. A plan starts with the guides `ramp` and `size` on, and they go together. `rows` are the dimension
   * values in the result's order, one for each of its rows. */
  scene(view: MarkView): Pick<Scene, 'nodes' | 'rows' | 'aspect'> & { parts: Part[] };
  /** For painters with no CSS: its own parts in pixels, in a box `width` wide and, where the view has a height limit,
   * no taller than `room`. A `ramp` and a `size` part are place()'s, set under what this returns. `plot` is the box
   * its marks were drawn in. */
  place(scene: Scene, width: number, room: number | null, container: Container): { nodes: PlacedNode[]; height: number; plot?: { w: number; h: number } };
}

const REGISTERED = new Map<string, CustomMark>();
// The layouts core builds. A custom mark's name is its layout's, so it cannot be one of them.
const TAKEN = ['cartesian', 'rows', 'band', 'radial', 'matrix', 'none', 'notice', 'prose'];

/** Register a custom mark under a name, or replace the one that has it. */
export function registerMark(name: string, mark: CustomMark): void {
  if (!/^[\w-]+$/.test(name)) throw new Error('A custom mark cannot be named ' + JSON.stringify(name) + ': the name is written into specs and selectors. Use letters, digits, "_" and "-" only.');
  if ([...MARKS, ...TAKEN].includes(name)) throw new Error('A custom mark cannot be named "' + name + '", which core has already. Register it under another name.');
  REGISTERED.set(name, mark);
}
/** The marks registered, by name. */
export function customMarks(): ReadonlyMap<string, CustomMark> {
  return REGISTERED;
}
