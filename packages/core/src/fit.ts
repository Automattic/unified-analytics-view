import { BAND_BAR, EM, PLOT_TOP, X_AXIS_BLOCK } from './sizes.ts';
import type { Layout } from './types.ts';

/* Fit rules: one declaration per part. Each names a container, the room the part
 * needs in it, and what happens otherwise. `fitTo()` reads them in code, for any surface;
 * a browser container compiles the same data to container queries. */
export interface FitRule {
  /** Unique within a layout: 'axes', 'secondary', 'legend', 'marks', … */
  id: string;
  layout: Layout;
  container: 'view' | 'plot';
  /** In em: the size of the view's type, which is its label face. The part stays while the container has at least
   * this in each. So a need follows the type, on the view and on its plot alike. */
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
  /** A preset the view becomes under the same condition: the same query, drawn another way. It takes the place of the
   * whole view, so `hide` and `show` have nothing left to act on. `viewAt()` plans again with it. A browser container
   * paints both, and the compiled rule shows one. */
  fallback?: string;
  /** The mark a view's layers must hold for the rule to be its: a legend gives way to labels at line ends only where
   * there is a line. On a rule with a `fallback`: the mark the layout's layers must hold for the view to give way. A built-in mark
   * shares its layout with others, so a rule for one of its forms names it: a band of glyphs gives way to the share
   * bar, and the share bar, in the same layout, gives way to nothing. A custom mark's layout is its own, and needs none. */
  mark?: string;
  /** What a view must have for the rule to be its (`hasOf`): a part its scene shows, or `track`, where a row's track
   * stands beside its label. A plot of points has no bare form, and a row read by where its marks are needs more room
   * than a bar behind its label: each has a rule of its own, under the room the others keep their marks in. */
  has?: string;
}

/** The room a container has. A view that takes its natural height has no `block`. */
export interface Room { inline: number; block?: number | null }

/** Half a px, which a need is read under: a container laid out at exactly its need measures a hair under it at a
 * fractional zoom, and its part would go at the very size the rule says it fits. A compiled query asks the same. */
export const SLACK = 0.5;

/* The defaults. A context passes its containers a different set, as `rules.fit`.
 * What these cannot say is a surface's to measure: the width of the number, the width of a row's value and of each
 * column after it, and anything that depends on how tall the content is (reference, section 10.2).
 * A rule names every part it takes, one that stands inside another among them: a reader with no browser has no
 * nesting to go by, and test/fit.test.ts holds a view to be its number alone wherever a rule takes its marks. */
/* What is picked (docs/focus-plan.md, step 8). Every need in the rules below is one of these, or a sum of them and of
 * the gutters a surface builds to (sizes.ts). Each was set by eye, for the part it is of, and is in em, the size of
 * the view's type. They are what a need has yet to be worked out from, and they are said here once, so that what is
 * picked can be counted. */
const LEAST = {
  /** A plot with its axes; with a legend under it; with a label on each point; with the whole key to its dots' sizes. */
  plot: { inline: 21, block: 9 }, plotLegend: { inline: 24, block: 13.5 }, plotPointLabels: { inline: 25.5, block: 13.5 }, plotSizeKey: { inline: 24, block: 12 },
  /** A plot wide enough for the date in the middle of its x axis. */
  plotMidTick: 28.5,
  /** A plot's own box, in which a comparison, a reference and a fill still read. */
  secondary: { inline: 13.5, block: 6.75 },
  /** A plot with no axes; the number that stands beside it; the gap between the two. */
  bare: { inline: 4.8, block: 3.45 }, number: 5.7, gap: 0.9,
  /** A row's label; a row; the gap between two rows; a track read by where its marks are, beside its label. */
  label: 6.75, row: 2.1, rowGap: 0.3, track: 5.25,
  /** A legend whole, across; its one line, tall; a list whose rows are divided, with its legend whole under it. */
  legend: 12.75, legendLine: 1.8, dividedRows: 11.25,
  /** A band's bar across. */
  band: 8.25,
  /** A circle; one with a name for each slice round its rim; one with the number in its hole, across its own box. */
  circle: { inline: 5.4, block: 4.8 }, rim: { inline: 17.25, block: 9 }, hole: 9,
  /** A grid; one with its ramp and its key to sizes whole. */
  grid: { inline: 11.25, block: 6.75 }, gridKeys: { inline: 18, block: 11.25 },
  /** A notice. */
  notice: { inline: 11.25, block: 3 },
  /** Counted glyphs, across, and each form of them, tall: a stack, a run of rows, a grid of a hundred with its legend, one under the number, seats. */
  glyphs: 21, stack: 12, run: 9, hundred: 13.5, hundredAlone: 16.5, seats: 15,
};
/** Every part of a plot's body, and of a list's: what a rule takes where the view is its number alone. */
const PLOT = ['plot', 'points', 'point-labels', 'x-axis', 'y-axis', 'y-axis-2', 'labels', 'legend', 'ramp', 'size', 'unit-key'];
const ROWS = ['rows', 'track', 'columns', 'legend', 'legend-top', 'unit-key'];
export const FIT_RULES: FitRule[] = [
  // A plot with axes. The second y axis is the key to what is measured in a second unit, which is read against nothing
  // else: it stays as long as the first does, and what is drawn on it goes when it goes. A bare plot is of one unit.
  // It has no room for a key to sizes either, so its dots are drawn at one size: what a size meant goes with what said it.
  { id: 'axes',      layout: 'cartesian', container: 'view', needs: LEAST.plot,
    hide: ['x-axis', 'y-axis', 'y-axis-2', 'grid', 'axis:2', 'size'], show: ['number'], set: { arrange: 'side', dots: 'one' } },
  // A plot told apart by colour has a legend, which becomes a label at the end of each line. That is for a view with
  // a line or an area in it: bars have no ends to label, so their legend has nothing to give way to and stays. Both go
  // when the axes do, and the colours go with them: a bare plot's series are in one paint, as a split by `detail` is.
  { id: 'legend',      layout: 'cartesian', mark: 'line', container: 'view', needs: LEAST.plotLegend,
    hide: ['legend'], show: ['labels'] },
  { id: 'legend-area', layout: 'cartesian', mark: 'area', container: 'view', needs: LEAST.plotLegend,
    hide: ['legend'], show: ['labels'] },
  { id: 'labels',      layout: 'cartesian', container: 'view', needs: LEAST.plot,
    hide: ['labels', 'legend', 'ramp'], set: { split: 'plain' } },   // and a ramp, which has no shorter form a bare plot has room for
  { id: 'point-labels', layout: 'cartesian', container: 'view', needs: LEAST.plotPointLabels,   // labels on points go first
    hide: ['point-labels'] },
  { id: 'size',      layout: 'cartesian', container: 'view', needs: LEAST.plotSizeKey,      // then the key to the sizes of dots, down to its largest step: it stays as long as sized dots do
    hide: [], set: { 'size-key': 'most' } },
  { id: 'points',    layout: 'cartesian', has: 'points', container: 'view', needs: LEAST.plot,   // a plot of points has no sparkline form: under the axes' need it is the number alone
    hide: PLOT, show: ['number'] },
  { id: 'mid-tick',  layout: 'cartesian', container: 'view', needs: { inline: LEAST.plotMidTick }, hide: ['x-tick.mid'] },
  // A short plot keeps its unranked y ticks: 9 em for the plot, 0.75 above it and 1.65 for the x axis.
  // ponytail: it asks the view, since the y axis stands outside the plot's container. Wrong when the number is above
  // the plot. A rule on the plot, and the y axis inside that container, would say it properly.
  { id: 'y-ticks',   layout: 'cartesian', container: 'view', needs: { block: LEAST.plot.block + PLOT_TOP + X_AXIS_BLOCK }, hide: ['y-tick.ranked'] },
  { id: 'secondary', layout: 'cartesian', container: 'plot', needs: LEAST.secondary,       // comparison and reference layers stay legible above this
    hide: ['role:comparison', 'role:reference', 'role:context'] },
  { id: 'marks',     layout: 'cartesian', container: 'view', needs: { inline: LEAST.number + LEAST.gap + LEAST.bare.inline, block: LEAST.bare.block },       // 5.7 em for the number, a gap of 0.9 and a bare plot of 4.8
    hide: PLOT, show: ['number'] },
  { id: 'legend',     layout: 'rows',     container: 'view', needs: { inline: LEAST.legend, block: LEAST.dividedRows },      // a divided row's legend becomes one line, as the band's does, and where the rows have under three of their own
    hide: ['legend'], show: ['legend-top'] },
  { id: 'legend-top', layout: 'rows',     container: 'view', needs: { block: 2 * LEAST.row + LEAST.rowGap + LEAST.legendLine },                    // and that line goes where it would leave no two rows, and the series' colours with it
    hide: ['legend', 'legend-top'], set: { split: 'plain' } },
  // After the legend's rules, as every layout's is: where two rules say otherwise of a part the later one wins, and the one that takes the marks has the last word.
  { id: 'marks',     layout: 'rows',      container: 'view', needs: { inline: LEAST.label, block: LEAST.row },        // the label, and one row: a surface shows whole rows, so a box shorter than one shows none. The value's room is measured, and each ranked column's
    hide: ROWS, show: ['number'] },
  { id: 'legend',    layout: 'band',      container: 'view', needs: { inline: LEAST.legend },                  // the full legend becomes the largest segment's label
    hide: [], set: { legend: 'top' } },
  { id: 'marks',     layout: 'band',      container: 'view', needs: { inline: LEAST.band, block: BAND_BAR + LEAST.legendLine },       // the bar and the one-line legend, 1.8 em each
    hide: ['band', 'legend', 'legend-top', 'unit-key'], show: ['number'] },
  { id: 'legend',     layout: 'radial', container: 'view', needs: { inline: LEAST.legend },                    // as the band's
    hide: [], set: { legend: 'top' } },
  { id: 'legend-top', layout: 'radial', container: 'view', needs: { block: LEAST.circle.block + LEAST.legendLine },                      // the least circle, and one line under it. Under that the legend goes, and the segments' colours with it
    hide: ['legend', 'legend-top'], set: { split: 'plain' } },
  // Labels round the rim: the circle, and a label's width to either side of it. They are the key to which slice is
  // which, so under that they thin to the ones with no rank, about four, and stay as long as the circle does.
  { id: 'rim',        layout: 'radial', container: 'view', needs: LEAST.rim,
    hide: ['rim.ranked'] },
  { id: 'hole',       layout: 'radial', container: 'plot', needs: { inline: LEAST.hole },                    // the number sits in a donut's hole while the circle is this wide
    hide: ['hole'] },
  { id: 'marks',      layout: 'radial', container: 'view', needs: LEAST.circle,          // the least circle, and what stands in it and round it
    hide: ['radial', 'hole', 'rim', 'legend', 'legend-top', 'unit-key'], show: ['number'] },
  // A grid has no bare form. Its ramp is the key to its colours and its key to sizes to its dots, so neither goes before
  // the grid: under this each is in its shorter form, the ramp a thin strip of every step and the sizes their largest alone.
  { id: 'ramp',      layout: 'matrix',    container: 'view', needs: LEAST.gridKeys,
    hide: [], set: { ramp: 'strip', 'size-key': 'most' } },
  { id: 'marks',     layout: 'matrix',    container: 'view', needs: LEAST.grid,       // its labels thin by rank where they would meet, which is measured
    hide: ['plot', 'point-labels', 'x-axis', 'y-axis', 'ramp', 'size'], show: ['number'] },
  { id: 'notice',    layout: 'notice',    container: 'view', needs: LEAST.notice,
    hide: ['notice'], show: ['number'] },
  { id: 'track',     layout: 'rows',      has: 'track', container: 'view', needs: { inline: LEAST.label + LEAST.track },    // a track beside its label: the label's 6.75 em and 5.25 to read a mark's place in. The value's room is measured
    hide: ROWS, show: ['number'] },
  /* The `unit` mark, in each layout it draws in. Glyphs are counted, so under the room that takes they are not drawn
   * smaller: the view becomes the preset of the same query that needs less, whole, and that one steps down to the
   * number by its own rules. What a glyph is worth is said in a line under the glyphs, and that line is the key to
   * them: a count of dots says nothing with no word of what one is. So no rule takes the line alone, and the room a
   * form needs is its glyphs' and the line's together. A rule names the mark, so the layout's other views are not
   * asked. A grid with no dimension has no share bar to become, so the rule after it gives it the gauge, which reads
   * the same metric against the same range. A grid divided by a dimension has no line: its cells are hundredths.
   * ponytail: a form whose glyph is worth one has no line, and gives way at the height one would need all the same.
   * A rule cannot ask what a view shows. Let one name a part it is for (`has`), if those 3 em are ever missed. */
  { id: 'unit',       layout: 'cartesian', mark: 'unit', container: 'view', needs: { inline: LEAST.glyphs, block: LEAST.stack },                           // a stack, where a plot has its axes, and the line
    hide: [], fallback: 'bar' },
  { id: 'unit',       layout: 'rows',      mark: 'unit', container: 'view', needs: { inline: LEAST.glyphs, block: LEAST.run },                           // a run of ten beside its label and its value: three rows and the line
    hide: [], fallback: 'bar-list' },
  { id: 'unit',       layout: 'band',      mark: 'unit', container: 'view', needs: { inline: LEAST.glyphs, block: LEAST.hundred },                           // a hundred cells, and a legend under them
    hide: [], fallback: 'share-bar' },
  { id: 'unit-alone', layout: 'band',      mark: 'unit', container: 'view', needs: { inline: LEAST.glyphs, block: LEAST.hundredAlone },                           // a hundred cells under the number, and the line
    hide: [], fallback: 'gauge' },
  { id: 'unit',       layout: 'radial',    mark: 'unit', container: 'view', needs: { inline: LEAST.glyphs, block: LEAST.seats },                           // up to a hundred seats, the line and the legend
    hide: [], fallback: 'pie-semi-circle' },
];

/** The rule a layout has under an id. A part with no rule needs no room. */
export function ruleFor(rules: FitRule[], layout: Layout, id: string): FitRule | undefined {
  return rules.find((r) => r.layout === layout && r.id === id);
}

/** What a rule needs in px, where an em is `em` px: what a surface that measures in px holds its room to. */
export function needAt(rule: FitRule, em: number = EM): FitRule['needs'] {
  const at = (n?: number) => (n == null ? undefined : n * em);
  return { inline: at(rule.needs.inline), block: at(rule.needs.block) };
}

/** True when the rule's container is short of the room its part needs, so its `hide`, `show` and `set` take effect.
 * A size the container does not have never matches, as an unknown container query never does. */
export function applies(rule: FitRule, room: Rooms): boolean {
  const c = room[rule.container], need = needAt(rule, room.em);
  const short = (need?: number, has?: number | null) => need != null && has != null && has < need - SLACK;
  return !!c && (short(need.inline, c.inline) || short(need.block, c.block));
}

/** The rooms a view's rules ask about: its own, and its plot's. A plot nobody has measured is left out, and no rule on
 * it is asked. `null` says there is no plot to measure, and what sits in one has gone with it. A room is in px, and
 * `em` is the size of the view's type in px, its label face, where that is not `EM`. */
export interface Rooms { view: Room; plot?: Room | null; em?: number }

/** What the fit rules make of a view at a room. */
export interface Fit {
  /** The parts that show: the view's own, less the ones a rule hides, with the ones a rule shows in their place. */
  parts: string[];
  /** Every target a rule hides here, parts among them. The rest name marks or labels inside a part: by role
   * (`role:comparison`), by axis (`axis:2`), a rim's ranked names (`rim.ranked`), a tick (`x-tick.mid`). */
  hidden: string[];
  /** The switches set here: a key's shorter form, the number beside the plot, a drawing without an encoding. */
  set: Record<string, string>;
  /** The rule under which the view gives way, whole, to a preset. Nothing of this view shows then: `parts` is empty. */
  fallback?: FitRule;
  /** Each rule that holds here, in order: the parts it took that were showing, and the ones it put in their place. */
  held: { rule: FitRule; hid: string[]; showed: string[] }[];
}

/** What a view holds, as its rules ask of it: its scene, its layers' marks, and whether its query
 * fills a preset a rule would have it become. `via` is what it has given way from already (`gaveWay`). */
export interface FitView { marks?: string[]; fills?: (preset: string) => boolean; via?: string[] }

/** What a view has, for a rule that is for one kind of view (`has`): each part its scene shows, and `track` where a
 * row's track stands beside its label. A surface says the same of its figure, for the compiled rules to ask. */
export const hasOf = (scene: { parts: string[]; track?: string | undefined }): string[] => (scene.track && !scene.parts.includes('track') ? [...scene.parts, 'track'] : scene.parts);

/** A view at a room, read off its fit rules with no browser. It is the reading a stylesheet compiled from the same
 * rules gives (`compileFitRules` in packages/dom): every rule of the layout whose container is short of its need
 * holds, each on its own, and where two say otherwise of one part the later one wins. A rule for a mark is asked only
 * of a view that holds it, one for a kind of view (`has`) only of that kind. `rules` are the context's, with a custom
 * mark's own after them. Pure, and it measures nothing: what depends on the content is the surface's to see to. */
export function fitTo(scene: { layout: Layout; parts: string[]; track?: string | undefined; nodes: { part: string }[] }, room: Rooms, rules: FitRule[], view: FitView = {}): Fit {
  const marks = view.marks ?? [], has = hasOf(scene);
  const swap = fallbackRule(rules, scene.layout, view.via, view.fills && { marks, fills: view.fills });
  const fit: Fit = { parts: scene.parts.slice(), hidden: [], set: {}, held: [] }, gone = new Set<string>();
  for (const r of rules) {
    if (r.layout !== scene.layout || (r.mark && !marks.includes(r.mark)) || (r.has && !has.includes(r.has))) continue;
    // A rule on the plot holds when there is no plot left: what sits in it has gone with it.
    if (!applies(r, room) && !(r.container === 'plot' && (room.plot === null || gone.has('plot')))) continue;
    if (r.fallback) {
      if (r !== swap) continue;                                             // a preset the query cannot fill is no fallback of this view's
      fit.held.push({ rule: r, hid: fit.parts, showed: [] });
      return { ...fit, parts: [], fallback: r };
    }
    const hid = r.hide.filter((t) => fit.parts.includes(t)), showed = (r.show ?? []).filter((t) => !fit.parts.includes(t) && scene.nodes.some((n) => n.part === t));
    r.hide.forEach((t) => gone.add(t)); (r.show ?? []).forEach((t) => gone.delete(t));
    // The number leads where it shows, as it does in a scene. The rest stand after what is there.
    fit.parts = [...showed.filter((t) => t === 'number'), ...fit.parts.filter((p) => !hid.includes(p)), ...showed.filter((t) => t !== 'number')];
    Object.assign(fit.set, r.set);
    fit.held.push({ rule: r, hid, showed });
  }
  fit.hidden = [...gone];
  return fit;
}

/** What a view gives up under a rule's `fallback`, as `via` holds it: the rule's layout, and with it the mark where the rule is for one. */
export const gaveWay = (rule: FitRule): string => (rule.mark ? rule.layout + ' (' + rule.mark + ')' : rule.layout);

/** The rule under which a layout gives way to a preset: the first of its rules that names a `fallback`.
 * `view` says what the view holds, where the caller knows: its layers' marks, for a rule that
 * is for one mark, and whether its query has what a preset's slots ask for. A rule whose preset the query cannot fill
 * is passed over, so a layout that draws queries of more than one shape names a fallback for each, in rules of the
 * same need, and the first that can be drawn is the one: a preset that takes a dimension and, after it, one that takes none. With no
 * `view` a rule for a mark is passed over too: nothing says the view holds it.
 * `via` holds what the view has already given up on its way here (`gaveWay`). A fallback that leads back to one of
 * them would never settle, so that throws. */
export function fallbackRule(rules: FitRule[], layout: Layout, via: string[] = [], view?: { marks: string[]; fills(preset: string): boolean }): FitRule | undefined {
  const rule = rules.find((r) => r.layout === layout && r.fallback && (!r.mark || !!view?.marks.includes(r.mark)) && (!view || view.fills(r.fallback)));
  if (rule && via.includes(gaveWay(rule))) throw new Error('A fit rule\'s "fallback" leads back to the "' + gaveWay(rule) + '" layout (' + via.concat(gaveWay(rule)).join(', then ') + '), so the view would never settle. Name a preset that is laid out another way, or remove "fallback" from the rule.');
  return rule;
}
