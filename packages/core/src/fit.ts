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
  /** Parts or roles given up otherwise, and `axis:2` for the marks drawn on the second y axis. */
  hide: string[];
  /** Parts that appear in compensation, under the same condition. */
  show?: string[];
  /** Switches under the same condition, each a custom property on the figure that a layout's own rules answer to.
   * `arrange: side` sets the number beside a bare plot, and `legend: top` a legend as its one line. A key's shorter form
   * is one too: `ramp: strip`, `size-key: most`. So is a drawing without an encoding whose key the rule takes:
   * `dots: one` for dots of one size, `split: plain` for series in one paint. */
  set?: Record<string, string>;
  /** The spec's `keep` entry that disables this rule. */
  keep?: KeepPart;
  /** A preset the view becomes under the same condition: the same query, drawn another way. It takes the place of the
   * whole view, so `hide` and `show` have nothing left to act on. `resolve()` plans again with it. A browser container
   * paints both, and the compiled rule shows one. */
  fallback?: string;
  /** The mark a view's layers must hold for the rule to be its: a legend gives way to labels at line ends only where
   * there is a line. On a rule with a `fallback`: the mark the layout's layers must hold for the view to give way. A built-in mark
   * shares its layout with others, so a rule for one of its forms names it: a band of glyphs gives way to the share
   * bar, and the share bar, in the same layout, gives way to nothing. A custom mark's layout is its own, and needs none. */
  mark?: string;
}

/** The room a container has. A view that takes its natural height has no `block`. */
export interface Room { inline: number; block?: number | null }

/* The defaults. A context passes its containers a different set, as `rules.fit`.
 * What these cannot say is measured in `resolve()`: the width of the number,
 * the width of a row's value and of each column after it, and anything that depends on how tall the content is. */
export const FIT_RULES: FitRule[] = [
  // A plot with axes. The second y axis is the key to what is measured in a second unit, which is read against nothing
  // else: it stays as long as the first does, and what is drawn on it goes when it goes. A bare plot is of one unit.
  // It has no room for a key to sizes either, so its dots are drawn at one size: what a size meant goes with what said it.
  { id: 'axes',      layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },
    hide: ['x-axis', 'y-axis', 'y-axis-2', 'grid', 'axis:2', 'size'], show: ['number'], set: { arrange: 'side', dots: 'one' }, keep: 'guides' },
  // A plot told apart by colour has a legend, which becomes a label at the end of each line. That is for a view with
  // a line or an area in it: bars have no ends to label, so their legend has nothing to give way to and stays. Both go
  // when the axes do, and the colours go with them: a bare plot's series are in one paint, as a split by `detail` is.
  { id: 'legend',      layout: 'cartesian', mark: 'line', container: 'view', needs: { inline: 320, block: 180 },
    hide: ['legend'], show: ['labels'], keep: 'guides' },
  { id: 'legend-area', layout: 'cartesian', mark: 'area', container: 'view', needs: { inline: 320, block: 180 },
    hide: ['legend'], show: ['labels'], keep: 'guides' },
  { id: 'labels',      layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },
    hide: ['labels', 'legend'], set: { split: 'plain' }, keep: 'guides' },
  { id: 'point-labels', layout: 'cartesian', container: 'view', needs: { inline: 340, block: 180 },   // labels on points go first
    hide: ['point-labels'], keep: 'guides' },
  { id: 'size',      layout: 'cartesian', container: 'view', needs: { inline: 320, block: 160 },      // then the key to the sizes of dots, down to its largest step: it stays as long as sized dots do
    hide: [], set: { 'size-key': 'most' }, keep: 'guides' },
  { id: 'points',    layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },      // a plot of points has no sparkline form: under the axes' need it is the number alone
    hide: ['points'], show: ['number'], keep: 'marks' },
  { id: 'mid-tick',  layout: 'cartesian', container: 'view', needs: { inline: 380 }, hide: ['x-tick.mid'] },
  { id: 'secondary', layout: 'cartesian', container: 'plot', needs: { inline: 180, block: 90 },       // comparison and reference layers stay legible above this
    hide: ['role:comparison', 'role:reference', 'role:context'], keep: 'secondary' },
  { id: 'marks',     layout: 'cartesian', container: 'view', needs: { inline: 152, block: 46 },       // 76 for the number, a 12 px gap and a 64 px bare plot
    hide: ['plot'], show: ['number'], keep: 'marks' },
  { id: 'marks',     layout: 'rows',      container: 'view', needs: { inline: 90 },                   // the label; the value's room is measured, and each ranked column's
    hide: ['rows'], show: ['number'], keep: 'marks' },
  { id: 'legend',     layout: 'rows',     container: 'view', needs: { inline: 170, block: 150 },      // a divided row's legend becomes one line, as the band's does, and where the rows have under three of their own
    hide: ['legend'], show: ['legend-top'], keep: 'guides' },
  { id: 'legend-top', layout: 'rows',     container: 'view', needs: { block: 84 },                    // and that line goes where it would leave no two rows, and the series' colours with it
    hide: ['legend', 'legend-top'], set: { split: 'plain' }, keep: 'guides' },
  { id: 'legend',    layout: 'band',      container: 'view', needs: { inline: 170 },                  // the full legend becomes the largest segment's label
    hide: [], set: { legend: 'top' }, keep: 'guides' },
  { id: 'marks',     layout: 'band',      container: 'view', needs: { inline: 110 },
    hide: ['band', 'legend'], show: ['number'], keep: 'marks' },
  { id: 'legend',     layout: 'radial', container: 'view', needs: { inline: 170 },                    // as the band's
    hide: [], set: { legend: 'top' }, keep: 'guides' },
  { id: 'legend-top', layout: 'radial', container: 'view', needs: { block: 88 },                      // the least circle, and one line under it. Under that the legend goes, and the segments' colours with it
    hide: ['legend', 'legend-top'], set: { split: 'plain' }, keep: 'guides' },
  // Labels round the rim: the circle, and a label's width to either side of it. They are the key to which slice is
  // which, so under that they thin to the ones with no rank, about four, and stay as long as the circle does.
  { id: 'rim',        layout: 'radial', container: 'view', needs: { inline: 230, block: 120 },
    hide: ['rim.ranked'], keep: 'guides' },
  { id: 'hole',       layout: 'radial', container: 'plot', needs: { inline: 120 },                    // the number sits in a donut's hole while the circle is this wide
    hide: ['hole'] },
  { id: 'marks',      layout: 'radial', container: 'view', needs: { inline: 72, block: 64 },          // the least circle
    hide: ['radial', 'legend', 'legend-top'], show: ['number'], keep: 'marks' },
  // A grid has no bare form. Its ramp is the key to its colours and its key to sizes to its dots, so neither goes before
  // the grid: under this each is in its shorter form, the ramp a thin strip of every step and the sizes their largest alone.
  { id: 'ramp',      layout: 'matrix',    container: 'view', needs: { inline: 240, block: 150 },
    hide: [], set: { ramp: 'strip', 'size-key': 'most' }, keep: 'guides' },
  { id: 'marks',     layout: 'matrix',    container: 'view', needs: { inline: 150, block: 90 },       // its labels thin by rank where they would meet, which is measured
    hide: ['plot', 'x-axis', 'y-axis', 'ramp', 'size'], show: ['number'], keep: 'marks' },
  { id: 'notice',    layout: 'notice',    container: 'view', needs: { inline: 150, block: 40 },
    hide: ['notice'], show: ['number'], keep: 'marks' },
  { id: 'track',     layout: 'rows',      container: 'view', needs: { inline: 160 },                  // a track beside its label: the label's 90 px and 70 to read a mark's place in. The value's room is measured
    hide: ['track'], keep: 'marks' },
  /* The `unit` mark, in each layout it draws in. Glyphs are counted, so under the room that takes they are not drawn
   * smaller: the view becomes the preset of the same query that needs less, whole, and that one steps down to the
   * number by its own rules. What a glyph is worth is said in a line under the glyphs, and that line is the key to
   * them: a count of dots says nothing with no word of what one is. So no rule takes the line alone, and the room a
   * form needs is its glyphs' and the line's together. A rule names the mark, so the layout's other views are not
   * asked. A grid with no dimension has no share bar to become, so the rule after it gives it the gauge, which reads
   * the same metric against the same range. A grid divided by a dimension has no line: its cells are hundredths.
   * ponytail: a form whose glyph is worth one has no line, and gives way at the height one would need all the same.
   * A rule cannot ask what a view shows. Let one name a part it is for (`has`), if those 40 px are ever missed. */
  { id: 'unit',       layout: 'cartesian', mark: 'unit', container: 'view', needs: { inline: 280, block: 160 },                           // a stack, where a plot has its axes, and the line
    hide: [], fallback: 'bar', keep: 'marks' },
  { id: 'unit',       layout: 'rows',      mark: 'unit', container: 'view', needs: { inline: 280, block: 120 },                           // a run of ten beside its label and its value: three rows and the line
    hide: [], fallback: 'bar-list', keep: 'marks' },
  { id: 'unit',       layout: 'band',      mark: 'unit', container: 'view', needs: { inline: 280, block: 180 },                           // a hundred cells, and a legend under them
    hide: [], fallback: 'share-bar', keep: 'marks' },
  { id: 'unit-alone', layout: 'band',      mark: 'unit', container: 'view', needs: { inline: 280, block: 220 },                           // a hundred cells under the number, and the line
    hide: [], fallback: 'gauge', keep: 'marks' },
  { id: 'unit',       layout: 'radial',    mark: 'unit', container: 'view', needs: { inline: 280, block: 200 },                           // up to a hundred seats, the line and the legend
    hide: [], fallback: 'pie-semi-circle', keep: 'marks' },
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

/** What a view gives up under a rule's `fallback`, as `via` holds it: the rule's layout, and with it the mark where the rule is for one. */
export const gaveWay = (rule: FitRule): string => (rule.mark ? rule.layout + ' (' + rule.mark + ')' : rule.layout);

/** The rule under which a layout gives way to a preset: the first of its rules that names a `fallback` and that the
 * spec's `keep` leaves on. `view` says what the view holds, where the caller knows: its layers' marks, for a rule that
 * is for one mark, and whether its query has what a preset's slots ask for. A rule whose preset the query cannot fill
 * is passed over, so a layout that draws queries of more than one shape names a fallback for each, in rules of the
 * same need, and the first that can be drawn is the one: a preset that takes a dimension and, after it, one that takes none. With no
 * `view` a rule for a mark is passed over too: nothing says the view holds it.
 * `via` holds what the view has already given up on its way here (`gaveWay`). A fallback that leads back to one of
 * them would never settle, so that throws. */
export function fallbackRule(rules: FitRule[], layout: Layout, keep: KeepPart[] = [], via: string[] = [], view?: { marks: string[]; fills(preset: string): boolean }): FitRule | undefined {
  const rule = rules.find((r) => r.layout === layout && r.fallback && !(r.keep && keep.includes(r.keep)) && (!r.mark || !!view?.marks.includes(r.mark)) && (!view || view.fills(r.fallback)));
  if (rule && via.includes(gaveWay(rule))) throw new Error('A fit rule\'s "fallback" leads back to the "' + gaveWay(rule) + '" layout (' + via.concat(gaveWay(rule)).join(', then ') + '), so the view would never settle. Name a preset that is laid out another way, or remove "fallback" from the rule.');
  return rule;
}
