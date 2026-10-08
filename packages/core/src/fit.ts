import type { KeepPart, Layout } from './types.ts';

/* Fit rules: one declaration per part. Each names a container, the room the part
 * needs in it, and what happens otherwise. `resolve()` evaluates them in code;
 * a browser container compiles the same data to container queries. */
export interface FitRule {
  /** Unique within a layout: 'axes', 'secondary', 'legend', 'marks', … */
  id: string;
  layout: Layout;
  container: 'view' | 'plot';
  /** In px. The part stays while the container has at least this in each. */
  needs: { inline?: number; block?: number };
  /** Parts or roles given up otherwise. */
  hide: string[];
  /** Parts that appear in compensation, under the same condition. */
  show?: string[];
  /** Layout switches under the same condition, as data-attributes. */
  set?: Record<string, string>;
  /** The spec's `keep` entry that disables this rule. */
  keep?: KeepPart;
}

/** The room a container has. A view that takes its natural height has no `block`. */
export interface Room { inline: number; block?: number | null }

/* The defaults. A context passes its containers a different set, as `rules.fit`.
 * What these cannot say is measured in `resolve()`: the width of the number,
 * the width of a row's value and of each column after it, and anything that depends on how tall the content is. */
export const FIT_RULES: FitRule[] = [
  { id: 'axes',      layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },      // a plot with axes
    hide: ['x-axis', 'y-axis', 'grid'], show: ['number'], set: { arrange: 'side' }, keep: 'guides' },
  { id: 'axis-2',    layout: 'cartesian', container: 'view', needs: { inline: 340 },                  // the second y axis goes before the first
    hide: ['y-axis-2'], keep: 'guides' },
  { id: 'legend',    layout: 'cartesian', container: 'view', needs: { inline: 320, block: 180 },      // a split plot's legend becomes a label at the end of each line
    hide: ['legend'], show: ['labels'], keep: 'guides' },
  { id: 'labels',    layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },      // and those go when the axes do
    hide: ['labels'], keep: 'guides' },
  { id: 'point-labels', layout: 'cartesian', container: 'view', needs: { inline: 340, block: 180 },   // labels on points go first
    hide: ['point-labels'], keep: 'guides' },
  { id: 'size',      layout: 'cartesian', container: 'view', needs: { inline: 320, block: 160 },      // then the key to the sizes of dots
    hide: ['size'], keep: 'guides' },
  { id: 'points',    layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },      // a plot of points has no sparkline form: under the axes' need it is the number alone
    hide: ['points'], show: ['number'], keep: 'marks' },
  { id: 'mid-tick',  layout: 'cartesian', container: 'view', needs: { inline: 380 }, hide: ['x-tick.mid'] },
  { id: 'secondary', layout: 'cartesian', container: 'plot', needs: { inline: 180, block: 90 },       // comparison and reference layers stay legible above this
    hide: ['role:comparison', 'role:reference', 'role:context'], keep: 'secondary' },
  { id: 'marks',     layout: 'cartesian', container: 'view', needs: { inline: 152, block: 46 },       // 76 for the number, a 12 px gap and a 64 px bare plot
    hide: ['plot'], show: ['number'], keep: 'marks' },
  { id: 'columns',   layout: 'rows',      container: 'view', needs: { block: 80 },                    // headers over the columns: their 20 px and two rows under them
    hide: ['columns'], keep: 'guides' },
  { id: 'marks',     layout: 'rows',      container: 'view', needs: { inline: 90 },                   // the label; the value's room is measured, and each ranked column's
    hide: ['rows'], show: ['number'], keep: 'marks' },
  { id: 'legend',    layout: 'band',      container: 'view', needs: { inline: 170 },                  // the full legend becomes the largest segment's label
    hide: [], set: { legend: 'top' }, keep: 'guides' },
  { id: 'marks',     layout: 'band',      container: 'view', needs: { inline: 110 },
    hide: ['band', 'legend'], show: ['number'], keep: 'marks' },
  { id: 'legend',     layout: 'radial', container: 'view', needs: { inline: 170 },                    // as the band's
    hide: [], set: { legend: 'top' }, keep: 'guides' },
  { id: 'legend-top', layout: 'radial', container: 'view', needs: { block: 88 },                      // the least circle, and one line under it
    hide: ['legend', 'legend-top'], keep: 'guides' },
  { id: 'hole',       layout: 'radial', container: 'plot', needs: { inline: 120 },                    // the number sits in a donut's hole while the circle is this wide
    hide: ['hole'] },
  { id: 'marks',      layout: 'radial', container: 'view', needs: { inline: 72, block: 64 },          // the least circle
    hide: ['radial', 'legend', 'legend-top'], show: ['number'], keep: 'marks' },
  { id: 'ramp',      layout: 'matrix',    container: 'view', needs: { inline: 240, block: 150 },      // a grid has no bare form: its ramp goes, and then the grid
    hide: ['ramp'], keep: 'guides' },
  { id: 'marks',     layout: 'matrix',    container: 'view', needs: { inline: 150, block: 90 },       // its labels thin by rank where they would meet, which is measured
    hide: ['plot', 'ramp'], show: ['number'], keep: 'marks' },
  { id: 'notice',    layout: 'notice',    container: 'view', needs: { inline: 150, block: 40 },
    hide: ['notice'], show: ['number'], keep: 'marks' },
  { id: 'track',     layout: 'rows',      container: 'view', needs: { inline: 160 },                  // a track beside its label: the label's 90 px and 70 to read a mark's place in. The value's room is measured
    hide: ['track'], keep: 'marks' },
];

/** The rule a layout has under an id. A part with no rule needs no room. */
export function ruleFor(rules: FitRule[], layout: Layout, id: string): FitRule | undefined {
  return rules.find((r) => r.layout === layout && r.id === id);
}

/** True when the rule's container is short of the room its part needs, so its `hide`, `show` and `set` take effect.
 * A size the container does not have never matches, as an unknown container query never does. */
export function applies(rule: FitRule, room: { view: Room; plot?: Room | null }): boolean {
  const c = room[rule.container];
  const short = (need?: number, has?: number | null) => need != null && has != null && has < need;
  return !!c && (short(rule.needs.inline, c.inline) || short(rule.needs.block, c.block));
}
