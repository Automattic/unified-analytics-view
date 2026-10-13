# Uncommon chart coverage: plan

As of October 12, 2026. **Status: a plan, with its open questions settled on October 12 (section 4). Nothing here is built.** It follows `docs/chart-coverage-plan.md`, which took the grammar to the 40 Common types, and it keeps that note's rules, its step format and its section 3.7 (what every new arrangement owes).

The catalog's 84 Uncommon types were read against the grammar as it stands on `master`: the two docs, the marks each layout accepts (`PLOT_MARKS`, `TRACK_MARKS`, `sceneRadial`, `sceneMatrix`) and the refusals in `plan.ts` and `scene.ts`. **No spec was run.** Step 0 exists to replace that reading with samples.

How common a type is, is the catalog's judgement. Which step a chart falls under is this note's.

## 1. The finding

- **One built-in mark and two custom marks are new:** `unit`, and `link` and `partition`.
- **One channel is new:** `detail`, which splits a layer into series without painting them apart. Four steps use it.
- **Most of the tier needs no mark.** 17 types read as sayable today. 26 more need an existing mark to take a field or a layout it refuses now.
- **The plan reaches 52 of the 84.** 13 are deferred with a reason each, and 19 stay out.

| | Types | Count |
|---|---|---|
| Sayable today, to be shown by a sample (step 0) | Cleveland dot plot, lollipop, dumbbell, bullet graph, ordered dot plot, tornado, Pareto, sparkline, fan chart, streamgraph, slopegraph, cumulative flow, calendar heatmap, climate stripes, adjacency matrix, embedding scatter, stem-and-leaf | 17 |
| Existing marks, extended (steps 2 to 5, 10, 11) | See each step | 26 |
| `unit` (step 6) | Waffle, unit chart, parliament, Wilkinson dot plot, isotype, icon array | 6 |
| `link` (step 7) | Sankey, alluvial | 2 |
| `partition` (step 8) | Treemap | 1 |
| Deferred | Beeswarm, bar chart race, scatterplot matrix, UpSet plot, chord diagram, arc diagram, flow map, circle packing, bubble comparison, icicle, bivariate choropleth, Dorling cartogram, dot density map | 13 |
| Out | Section 6 | 19 |

Stem-and-leaf is counted with the first row because it needs only a fixture: rows of `text`, with the leaves as a field the engine returns.

**What changed from the first reading** (given in conversation on October 12): `link` and `partition` are custom marks here, not built in, because each lays its layers out alone, which is exactly the custom mark's contract. Sunburst moved from `partition` to `arc` with `detail`. Chord, arc diagram, circle packing and icicle moved to Deferred: a form that already works says the same.

## 2. The inventory

### 2.1 Marks

| Mark | Kind | Channels | What comes with it |
|---|---|---|---|
| `unit` | Built in | Those of `bar`, and `angle` | A value drawn as counted glyphs. It draws in the layouts `bar` and `arc` draw in, beside other marks |
| `link` | Custom, `packages/flow` | `x` the source, `x2` the target, `size` the metric | A ribbon from a value of one dimension to a value of the other. A layout of its own |
| `partition` | Custom, `packages/partition` | `x` the parent, `detail` the child, `size` the metric | A box divided by area, nested once. A layout of its own |

The line between the two kinds: **a built-in mark shares a layout with other marks; a custom mark lays its layers out alone.** Neither new package needs a dependency. A one-step Sankey is two stacks and a cubic between them, and a squarified treemap is about forty lines; `d3-sankey` and `d3-hierarchy` are not asked for.

Changes to marks that exist:

| Mark | Change | Step |
|---|---|---|
| `arc` | A dimension on `angle`, a metric or a dimension on `radius`, a second ring by `detail` | 2 |
| `line` | Joins the points of a metric-by-metric plot; steps over bins; a rank scale; series by `detail` | 3 |
| `area` | Painted by direction between two ends | 3 |
| `bar` | Splits by a second dimension in rows; `stack: "diverge"`; width from `size` | 4 |
| `dot` | Several to a row's track, by `detail` | 4 |
| `tick` | Stands at the foot of a plot of points; `align` to one side | 4 |
| `rule` | A number as its start; both ends on both axes | 4 |
| `cell` | A diverging ramp; `dot` beside it in a grid | 5 |

### 2.2 Channels, layer fields and the catalog

| Addition | Where | Notes |
|---|---|---|
| `detail` | Channel | A dimension. One series per value, all in the layer's own paint, with no legend. The query's second dimension may now go to `color`, `detail`, `facet` or the other axis |
| `stack: "diverge"` | Layer | The first half of the series run below zero and the second half above; a middle one straddles it. This is the Likert offset section 9, item 7 of the coverage plan left open |
| `paint: "direction"` | Layer | A ranged `bar` or `area` painted good or bad by which end is higher and the metric's polarity. It replaces the automatic rule of Decided 28, which caught the box plot (coverage plan, section 9, item 2) |
| `align: "start"` | Layer | Beside `"end"`. On a `tick`, the half to that side |
| Unit `rank` | Catalog | A scale that runs from 1 at the top. A `metric@rank` companion takes it |
| A preset registry | Code | `registerPreset`, beside `registerMark` (coverage plan, section 9, item 4) |
| Paint tokens `div.1` to `div.n` | Tokens | A diverging ramp, as `seq` was made |

**Shape parameters stay at one,** `sweep`. `stack`, `paint` and `align` gain a value each; none is a new field. Nothing above is a size, a breakpoint or a presentation switch.

### 2.3 Scene

No new node kind. `unit` emits `rect` and `circle` nodes, `link` emits `rect` and `path`, `partition` emits `rect` with `x`, `y`, `w` and `h` as a cell has. New parts: `unit-key` (what one glyph is worth), and the two custom marks' own. Keys carry the detail value where a series does today: `primary:line:<detail>`.

## 3. The plan

Twelve steps, 0 to 11. Step 0 comes first because it may shorten the rest. Step 1 is the foundation. After it, steps 2 to 6 are independent and can go in parallel worktrees, as steps 2 to 6 of the coverage plan did.

```
0 samples ─► 1 detail ─┬─► 2 arc
                       ├─► 3 line and area
                       ├─► 4 rows, bars, ticks, rules
                       ├─► 5 cell and the diverging ramp
                       └─► 6 unit
             7 preset registry ─┬─► 8 link
                                ├─► 9 partition
                                └─► 10 geo tiles
             11 facet in rows   (waits for the board, as step 7 of the coverage plan does)
```

Both rules of the coverage plan hold: parity is not touched, and commits are small.

### Step 0. Samples for what should work

Size: small. Unlocks nothing new; it turns 17 claims into facts.

1. **A sample in `moreSamples` for each of the 17,** with a fixture where the engine must return something new: leaves for stem-and-leaf, a week and a weekday for the calendar, a signed anomaly for the stripes.
2. **Each that throws or draws wrongly is a finding,** recorded in section 7 and moved to the step that owns its mark. Known already: a lollipop's `rule` cannot start at a number, and a bullet's `bands` are not drawn. Both are in step 4.
3. **Golden scenes** for the ones that pass.

Done when every one of the 17 either has a golden scene or a line in section 7 naming its step.

### Step 1. `detail`

Size: small. Unlocks nothing alone; steps 2, 3, 4 and 9 use it.

1. **The channel,** in `Channel`, the schema and `checkLayers`. The "no layer encodes it" error names `detail` beside `color`.
2. **`splitOf` reads it.** A layer split by `detail` makes a series per value with no entry in `Scene.series`, so no paint and no legend follow from it.
3. **No limit of six.** The limit is the count of series colours, and `detail` spends none.

Done when visitors by day with `detail` on a second dimension draws one line per value in `series.1`.

### Step 2. `arc` reads data

Size: medium. Unlocks Nightingale rose, circular bar plot, radial bar, 24-hour radial chart, sunburst.

1. **A dimension on `angle`** gives each value an equal slice, in the engine's order.
2. **A metric on `radius`** sets each slice's outer edge, on a square-root scale, so the area carries the value. That is the rose. The circular bar plot and the 24-hour chart are the same layers on another dimension.
3. **A dimension on `radius`** gives each value a ring, and a metric on `angle` sweeps it against the largest, or the catalog `domain`. That is the radial bar. More than six rings is an error that names the fix.
4. **`detail` on a split `arc`** adds an outer ring, each parent's span divided by its children. That is a sunburst of two levels.
5. **Presets:** `rose`, `radial-bar`, `sunburst`.
6. **Fit rules** are the radial layout's own. Prose is the share sentence for the sunburst and the ranked sentence for the rest.
7. **DOM:** `layouts/radial.ts`. Keys step round the circle, and out and in for the second ring.

Done when visitors by hour renders as a rose and device by browser as a sunburst, and both fall to the number as a donut does.

### Step 3. Lines and areas

Size: medium. Unlocks connected scatterplot, ECDF, bump chart, spaghetti plot, surplus and deficit line.

1. **`line` in a plot of points.** It joins the rows in the engine's order. The dimension that keys the rows is the order, so a time dimension gives the path through time.
2. **Steps over bins.** A `line` on a number dimension whose rows carry `<dimension>@end` is drawn as steps, as a `bar` there is drawn with no gap. No layer field. `PathNode.curve` gains `'step'`.
3. **Unit `rank`.** The y scale runs from 1 at the top to the largest rank, with a tick per rank.
4. **`paint: "direction"`** on a ranged `area`: the path is cut where its ends cross, and each piece is `delta.good` or `delta.bad`. On a ranged `bar` it is the rule Decided 28 applied to every bar; presets `waterfall` and `candlestick` then state it.
5. **Presets:** `bump`, `spaghetti`, `difference`.

Done when rank by week renders as a bump chart with first place at the top, and a metric against its `@previous` as two-toned area.

### Step 4. Rows, bars, ticks and rules

Size: large. Unlocks population pyramid, butterfly, Marimekko, strip plot, rug plot, Q–Q plot, OHLC, and closes lollipop and bullet.

1. **A row split by a second dimension.** The refusal at `plan.ts` line 62 goes for a `bar` with `stack`. `sceneRows` builds a series per value, with a legend.
2. **`stack: "diverge"`,** in rows and on an axis. With two series it is the pyramid and the butterfly.
3. **Several dots to a row,** by `detail`. `trackDot` draws one per pair. That is the strip plot.
4. **`size` on a `bar`** in a plot split by `color`: a column's width is its share of the engine's total, from `totalsBy`. That is the Marimekko.
5. **`tick` in a plot of points,** with a metric on x and nothing on y: a short stroke at the foot. That is the rug.
6. **`align` on a `tick`:** the half to one side. The preset `ohlc` is a `rule` and two ticks.
7. **`rule`:** a number as the start of a ranged rule, and `x`, `y`, `x2`, `y2` together for a line across a plot of points.
8. **`bands` drawn,** behind a row's track and a gauge. This needs paint tokens for bands, which do not exist.
9. **Presets:** `pyramid`, `marimekko`, `strip`, `ohlc`, `lollipop`.

Done when visitors by age band and sex renders as a pyramid, and pages by section as a strip plot, each from a preset.

### Step 5. `cell` and the diverging ramp

Size: medium. Unlocks correlogram, hexbin and 2D density as square bins, clustermap as its grid.

1. **Tokens.** A diverging ramp in `packages/tokens`, and paint tokens `div.1` to `div.n` with a neutral middle.
2. **The scale picks its ramp from its values:** a domain that crosses zero is diverging about zero, and anything else is sequential as now.
3. **Two number dimensions.** A sample of a grid on two binned dimensions. `matrix` is thought to draw it today; this part is a sample, a golden scene and whatever they find.
4. **`dot` in a grid,** with a metric on `size`, beside or in place of the `cell`.

Done when a correlation matrix renders in both themes with zero as the neutral step.

### Step 6. `unit`

Size: large. Unlocks waffle, unit chart, parliament, Wilkinson dot plot, isotype, icon array.

1. **The mark,** in `PLOT_MARKS` and `TRACK_MARKS`, and in the band and radial layouts. It takes the place a `bar` or an `arc` would: a stack of glyphs up from the axis, a run along a row's track, a grid of a hundred divided by share, or seats round a half circle.
2. **What a glyph is worth** is worked out from the data, never from a size, because a scene has none. A stack or a run uses the round number that gives the largest value at most ten glyphs. A share grid is always one hundred, shared out by largest remainder so that it sums. Seats are one each.
3. **A `unit-key` part** says the worth: "Each is 500". It is a guide and goes with them.
4. **Glyphs hold their shape.** A grid's part has an `aspect`; a stack's glyph is as wide as its band.
5. **Shares divide by the engine's total.** A count is never summed from the rows.
6. **Presets:** `waffle`, `unit-chart`, `parliament`, `icon-array`. The icon array has no dimension and reads the metric against its catalog `domain`, as the gauge does.
7. **Fit rules.** Each form falls back, by `FitRule.fallback`, to the form of the same query that needs less room: `share-bar` for a waffle, `bar-list` for a run.
8. **DOM.** Glyphs are HTML. Keys step by group, not by glyph, and a group's accessible name carries its value.

Done when device share renders as a waffle that becomes the share bar at sidebar width, from one spec.

### Step 7. A registry for presets

Size: small. Unlocks a `use` name for every custom mark, `geo` included.

1. **`registerPreset(name, { layers })`** in `packages/core/src/presets.ts`. `expand` reads the registry after the library handed to it.
2. **`geo` registers `choropleth` and `symbol-map`.**

Done when the `map` sample is written with `use`.

### Step 8. `link`

Size: large. Unlocks Sankey, and alluvial in its two-stage form.

1. **`packages/flow`,** a custom mark registered as `geo` is. No dependency.
2. **Two columns of nodes,** a rect per value, sized by `totalsBy`, in the engine's order. A ribbon per row of the result, as wide at each end as its share of that node.
3. **Paint** follows the source: a series colour per source, the ribbon in its `soft` tone. More than six sources is an error that names the fix.
4. **The fallback** is `heatmap`, which draws the same pairs at any width.
5. **Prose:** the largest flow by name, and its share of the total.
6. **Preset:** `sankey`.

Done when source by landing page renders as a Sankey at dashboard width and as a grid at sidebar width, from one spec.

### Step 9. `partition`

Size: medium. Unlocks treemap.

1. **`packages/partition`,** a custom mark. No dependency: squarify is written here.
2. **A box per parent,** by its engine total, and inside each a box per child. With one dimension it is one level.
3. **Paint** is a series colour per parent. A metric on `color` paints by the ramp instead.
4. **Labels are ranked by area** and the measured pass hides the ones that do not fit, as it does for points.
5. **The fallback** is `bar-list` of the first dimension.
6. **Preset:** `treemap`.

Done when pages by section renders as a treemap and falls to the ranked list.

### Step 10. Tile maps

Size: small. Unlocks hex tile map and tile grid map.

1. **A shapes file of equal tiles,** one per region, in `packages/fixtures`, and an identity projection handed to `geoMark`.
2. **A sample of each.** No change to the mark is expected.

Done when visitors by country renders as a tile grid.

### Step 11. A facet down the rows

Size: medium. Unlocks ridgeline, violin, raincloud. **Waits for the board,** as step 7 of the coverage plan does.

A ridgeline is small multiples in one column with a shared x. So it is not a mark and not a change to `rows`: it is what `facet` becomes when its children are stacked. A violin is the same with one `area` centred, which needs `stack: "center"` to apply to a layer that is not split. A raincloud adds a box and a strip to each child, both built by then.

### What the plan does not build

| Type | Why |
|---|---|
| Beeswarm | Placement by collision needs pixel sizes, which a scene has none of. A strip plot says the same |
| Bar chart race | Needs params (Open 9) |
| Scatterplot matrix, UpSet plot | Boards (Open 12) |
| Chord diagram, arc diagram | The adjacency matrix draws the same pairs today, and reads better |
| Circle packing, bubble comparison, icicle | The treemap and the bar list say the same |
| Flow map | `link` inside `geo`. After step 8, if wanted |
| Bivariate choropleth | Needs two fields on `color` and a nine-step token grid |
| Dorling cartogram, dot density map | Collision, and scattering within a shape |

## 4. Decided October 12

All eight questions the plan raised were put to David Bowman and settled as recommended.

| # | Question | Decision |
|---|---|---|
| 1 | `detail` as a channel | Add it |
| 2 | A diverging stack | `stack: "diverge"`, and `"center"` stays as the silhouette the streamgraph uses |
| 3 | What paints a ranged mark by direction | An explicit `paint: "direction"`. It replaces the automatic rule of Decided 28 |
| 4 | Where a rank scale comes from | A unit `rank` in the catalog. For the API's owners to send |
| 5 | Steps on a `line` | From the bins: a line on a number dimension with `@end` is stepped. No field |
| 6 | A hole in a rose | None. The circular bar plot is drawn as the rose |
| 7 | `link` and `partition` | Custom marks, in packages of their own |
| 8 | What a `unit` glyph looks like | A dot or a square. Icons wait for a glyph per metric in the catalog |

Decisions 1 to 5 change the grammar, so the reference takes them when their step is built: sections 6, 7 and 19 of `docs/view-grammar-reference.md`.

## 5. For the API's owners

Beyond the list in the coverage plan, section 9:

- **Order.** The rose, the calendar and the 24-hour chart need an answer in the dimension's own order, not ranked. Already asked for weekday and hour.
- **`metric@rank` without `compare`,** for the bump chart. Already asked as "a companion by name".
- **`totalsBy`** is now read by `link`, `partition` and the Marimekko, as well as the normalized stack.
- **More than two dimensions** would give a Sankey of several stages and a hierarchy deeper than two levels. Decided 24 says two, and nothing here argues for reopening it.

## 6. Out

| Types | Why |
|---|---|
| Parallel coordinates, radar | Decided 6: no general polar or multi-axis system |
| Contour plot, 3D surface plot, isochrone map, vector field, prism map, contiguous cartogram | Continuous fields, a third dimension, or geometry computed elsewhere |
| Node-link diagram, sociogram, PERT chart, dendrogram, radial tree | Graphs that need a force or a tree layout, and a hierarchy the query cannot carry |
| Euler diagram, text heatmap | A set layout by area; text that flows |
| Physical bar chart, layered data surface, woven and knitted data, unit physicalisation | Not charts on a screen |

## 7. Findings as it is built

### Step 0, samples (built October 12)

Every one of the 17 was written as a spec and run. 916 tests pass and the typecheck is clean. Nothing in `packages/core/src`, `packages/dom` or `prototype/` changed. Every golden scene that existed is byte-identical; 42 are new. **Nothing was opened in a browser:** each sample is checked as a scene, in ratios and in pixels, and no painter has been looked at.

**15 of the 17 are drawn today. Two are not:** the bullet graph has no bands, and climate stripes have no neutral zero. Four of the 15 are drawn in one form only (lollipop, tornado, slopegraph, embedding scatter).

Samples added to `moreSamples`: `cleveland`, `lollipop`, `tornado`, `pareto`, `sparkline`, `fans`, `streamgraph`, `slopegraph`, `cumulative`, `calendar`, `stripes`, `adjacency`, `embedding`, `stem`. `dumbbell`, `bullet` and `fan` were there. Each is swept with the samples of its layout (`test/coverage.test.ts`, `test/ranges.test.ts`, `test/cell.test.ts`), and what each one is, and each hole below, is held as a fact in `test/uncommon.test.ts`.

**The 17**

| Type | Sample | Result | Owner of what is left |
|---|---|---|---|
| Cleveland dot plot | `cleveland` | Golden scene. `dumbbell` with no `compare`: a dot, the label and the value for each row | |
| Ordered dot plot | `cleveland` | The same sample. The engine ranks a categorical dimension, so a Cleveland dot plot of one is already ordered. A second sample would differ in nothing | |
| Lollipop | `lollipop` | Golden scene, from zero: a `rule` with one end and a `dot`, in rows. The same pair stands on an axis. A stem to a number is sayable as the second end (`x: "visitors", x2: 1000`). Written from the number it is refused: `Layer 1 has "x2" and no value on x to run from.` | Step 4 |
| Dumbbell | `dumbbell` | Was there, with its golden scene. It is that chart | |
| Bullet graph | `bullet` | **Not a bullet graph.** A bar and a tick at the target. The catalog's `bands` are read nowhere in core or in `<ua-view>`, the gauge's included | Step 4 |
| Tornado | `tornado` | Golden scene, with the paint stated: two ranged bars a row that meet at zero. Without a stated paint the gain is painted as a loss (finding 1) | Step 3, part 4 |
| Pareto | `pareto` | Golden scene. Bars and a line, an axis each, because the running share is a metric of its own in unit `ratio`. As a companion it is drawn on the count scale, flat along the foot (finding 2) | Step 3 |
| Sparkline | `sparkline` | Golden scene at 234 px: parts `number` and `plot`, 46 px tall. One `line` layer. No spec asks for it | |
| Fan chart | `fan`, `fans` | `fan` was there, with one band. `fans` has two, one inside the other, and a golden scene | |
| Streamgraph | `streamgraph` | Golden scene. `area` with `stack: "center"`. Its y axis counts away from the middle: -1k, -500, 0, 500, 1k | Step 3, to look at |
| Slopegraph | `slopegraph` | Golden scene, by week. By day it is not one: a range of two days ends on the unfinished day, so each line is one point and a dashed stroke. Names stand at the line ends, not values, and only at the far end | Step 3, to look at |
| Cumulative flow | `cumulative` | Golden scene. A stacked `area` on `signups@running`. It stops at the last whole day, as every stacked area does | |
| Calendar heatmap | `calendar` | Golden scene. `heatmap` by `weekday` and `date.week`: seven rows, a column a week, each named by its Monday | |
| Climate stripes | `stripes` | **Not climate stripes.** A golden scene of what is drawn: a `cell` with only `x`, one cell a day, on the sequential ramp. The ramp runs from -18 to 20, so the worst loss is the palest step and a day near no change is a middle one | Step 5 |
| Adjacency matrix | `adjacency` | Golden scene. `heatmap` of `page` by `next_page`, which share their values | |
| Embedding scatter | `embedding` | Golden scene, uncoloured. Coloured by a second dimension it throws: `The query is by "term", and no layer encodes it, so its rows would be drawn over each other. Encode it on color, or remove it from query.by.` (finding 3) | Step 1 |
| Stem-and-leaf | `stem` | Golden scene. Two `text` layers a row: the dimension, and its companion `load_stem@leaves` | |

**Findings**

1. **Paint by direction reads a bar to zero backwards.** A ranged bar needs a field on `x` and takes a number only on `x2`, so a bar from zero to a gain is written `x: "revenue_effect@high", x2: 0`. That runs from the gain down to zero, and the rule of Decided 28 paints it `delta.bad`; the loss is painted `delta.good`. The `tornado` sample states `delta.bad` and `delta.good` to get it right. An explicit `paint: "direction"` (step 3, part 4) removes the surprise. A number as the first end (step 4, part 7) removes the cause.
2. **A companion has no unit.** `unitOf` reads the catalog, and a companion is not in it, so `pageviews@rank` beside `pageviews` is drawn on the count scale: eight points between 0.0002 and 0.0016 of the plot's height. The Pareto works only because the fixture sends the share as a metric. Step 3 gives `metric@rank` a unit; the same answer is wanted for any companion that is not in its metric's unit.
3. **A coloured scatter needs every point named.** With `term` and `intent` in the query and `intent` on `color`, no layer encodes `term`, and `checkLayers` refuses. Add a `text` layer with `term` on `text` and it draws: three series of eight, a legend, labels. `detail` is the honest way to say the rows' own dimension. With two dimensions the prose is then the sentence for two dimensions, which is wrong for points: "getting started is the largest search term (0.73), and Pricing the largest intent (–)." Step 1 should make the points sentence win.
4. **The sentence and the note call the first rows the top ones,** whatever order the engine sent. For a dimension in its own order that is false: "Top whole seconds by requests, last 28 days: 0 (5), 1 (9), 2 (12)", where 2 leads. Under the number of the embedding it is "Top: pricing". Every categorical dimension the fixture had was ranked, or happened to fall, so this did not show. **No step owns it.** Step 2 meets it first, with the hour and the weekday. Recommended: the catalog says a dimension is ordered, or the result says its rows are ranked.
5. **A view of something with no total falls back to a dash.** An effect and a place in an embedding have no total, so the fixture sends null, and below the plot's room the view is "–". Correct by the rules, and of no use. **To decide:** whether such a view has a fallback at all.
6. **There is no unit for a plain number.** The embedding's components are `count` for want of one. `ratio` would write them as percentages.
7. **A plan says it gave up a middle date label that was never there.** A time axis of two points has a first and a last tick. `plan.dropped` still lists "the middle date label". Small, and core's. Step 3 has the slopegraph.
8. **A line's scale holds zero,** so a slopegraph's slopes are shallow, on a scale from 0 to 1.5k. The same was found for the candlestick and the fan (coverage plan, section 8, step 3, finding 9).
9. **A streamgraph's axis is signed.** `stack: "center"` puts zero in the middle and the ticks say so. A streamgraph is read by thickness, so the axis says nothing true. To look at when step 3 or step 11 next touches `center`.
10. **Rows of text hold at any width down to 90 px, and the last label is clipped to its room.** At 120 px the third row of `stem` ends in an ellipsis. A cut leaf is a request not shown. Rows with a value column would have collapsed to the number by then; these have none to measure. Step 4, with the rows.
11. **A stem-and-leaf display has no rule between stem and leaves,** and its leaves are set in the label face. If that face is proportional, the length of a row is not its count. Not checked: it is the painter's, and no browser was opened.

**Where the notes for this step were wrong**

- *A lollipop's rule cannot start at a number.* Half right. It cannot start at one; it can end at one, which draws the same stem.
- *A tornado works as two ranged bars meeting at zero.* The geometry does. The paint does not, until it is stated (finding 1).
- *Two start-anchored texts in a row may overlap.* They do not. `placeRows` sets each in a column as wide as its longest text, as the league table's rank is.
- *A fan of several bands is untested.* It works. But the fixture's interval of the mean was not inside the day's least and most on every day, so two bands of them crossed. A day now has quartiles too.
- *`test/dom-series.test.ts` re-queries every sample at other ranges.* What it caught was its own exception by name: a stacked area has no hit target on the unfinished day, and the test knew that of `area` only.

**The fixture**

- **Dimensions:** `date.week` (time, as ISO weeks: `2026-W37`), `next_page`, `cause`, `factor`, `term`, `intent`, `load_stem`.
- **Metrics:** `errors` and `errors_share` (by `cause`), `revenue_effect` (by `factor`, in `usd`), `embed_x` and `embed_y` (by `term`), `requests` (by `load_stem`).
- **Companions:** `revenue_effect@low` and `@high`, signed. `load_stem@leaves`, a string, of the dimension. `signups@running`, on each pair of a query through time. `response_time@p25` and `@p75`, by day.
- **By week the range is its whole weeks,** the last of them the one before today's, so nothing is ragged or unfinished: `28d` is four weeks and `14d` two. `compare` is refused there, because the fixture's days run out one short.
- **A table may carry companions for a row** (`also`), **a second dimension** each row falls under (`split`: `term` by `intent`), and **a null total.**
- **What does not add up over a range no longer follows it:** a table's value is scaled to the range only where the catalog gives its metric a `rangeTotal`. That was true of a `ratio` alone, and it rounded the embedding to whole numbers.
- **The calendar's cells are a week divided among its weekdays,** as any pair is, not the days the fixture holds. They add up to the week.

**For the API's owners**

- A dimension's order: ranked, or its own (finding 4).
- A unit for a companion, or the rule that it shares its metric's (finding 2).
- A plain number as a unit (finding 6).

### Step 1, detail (built October 12)

Merged. 827 tests pass (807 before) and the typecheck is clean. `prototype/`, the six samples' golden scenes and every golden scene that existed are unchanged: the snapshot file gained three scenes and lost no line. One new sample, `spaghetti` (visitors by day, a line for each of fifteen countries), swept and with golden scenes in `test/coverage.test.ts`. Step 0 was not built first, so this is the first entry here. Checked in headless Chromium on the bench: the sample at 346, 250, 170, 120 and 80 px and widened to 700 px, light and dark, real key events, and the pointer. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a data change, the pivoted table, and a detail split of bars or areas in a browser (those are tested as scenes only).

**What was added, for the steps that follow**

- `Channel` gains `'detail'`, and the schema's `encode` gains `detail`, a string. It is a dimension's name, so the schema takes no number there.
- **`detailOf(catalog, layer, xField?)`** in `scene.ts`, exported from core: the dimension a layer is split by with nothing painted apart, or null. **A step that reads `detail` calls this.** `splitOf` now answers for either way of splitting (`color`, or else `detail`), and `seriesOf` only for the painted way, since it is what makes a legend.
- `Scene.detail?: string[]`: the detail dimension's values in the engine's order, where a plot is split and nothing is painted apart. `Scene.series` is absent then, which is what keeps the legend, the labels and `placeLegend` away. A node's `series` holds its value either way.
- **`DETAIL_LAYOUTS`** in `scene.ts`, now `['cartesian']`. `resolve()` refuses `detail` in any other built-in layout, by name. **A step that makes a layout read `detail` adds the layout's name here** (steps 2 and 4), or the refusal stands. A custom mark is not asked: it reads its own channels (step 9).
- Keys are the colour split's: `primary:line:<detail>`, `primary:line:<detail>:partial`, `primary:area:<detail>`, `primary:bar:<x>:<detail>`.
- `plural` is exported from core's prose, for the readout.
- The DOM marks a plot split by detail with `data-mass` on `.uav-body`.

**Choices where the plan was silent, and departures**

1. **`Scene.detail` is a new scene field.** The plan said a detail split makes "no entry in `Scene.series`", and that holds. But the keyboard and the readout find the rows at a point by the split's order, which they read from `Scene.series`. So the order is carried under another name, and what reads `series` for paint or a legend is untouched.
2. **A layer in a plot is split once.** With a dimension on x there is one more to split by, so a dimension on `color` and one on `detail` in one layer are refused, whichever two they are: the same one twice is a contradiction, and of two different ones one is x's own. Away from a plot only the same dimension on both is refused, so a sunburst (step 2) and a treemap (step 9) may put the parent on `color` and the child on `detail`.
3. **`stack` with `detail` is refused,** with the fix (put the dimension on `color`). A stack is read by its colours.
4. **A `bar` split by `detail` sits beside its neighbours,** as one split by `color` with no stack does: fifteen thin bars to a day in one paint. It is what the grammar says, and it is not a chart anyone wants. Not refused.
5. **Bars split by `detail` that fall below zero are not painted as gains and losses.** A split layer never was, since its paint was its series'. Here the paint is free, so they could be. Left as it was. **To decide** when a step needs it.
6. **A detail-split `line` is drawn at half strength** (`opacity: 0.5`, its unfinished tail too), so where lines run together the plot reads darker, and the bare plot beside the number is a texture and not a block. Looked at both ways in both themes: at full strength fifteen lines below 50 are one solid band. Not `tone: 'soft'`, which is for a fill that tints. An area split by `detail` is already a tint (0.14), and bars do not overlap, so neither changed.
7. **Two layers may split the same dimension two ways:** one by `detail` and one by `color`. The colours, the legend and the limit of six then apply, because a colour is spent. Tested as a scene; not looked at.
8. **The other marks of a plot (`dot`, `tick`, `rule`, `text`) split by `detail` as they do by `color`,** because they share the code. Not tested and not looked at.
9. **`detail` naming the dimension that is on x does nothing,** as `color` naming it does nothing today. Not refused.
10. **The readout of a whole point says the mass, not every series:** "Sep 8: Visitors 416 (15 countries, the most United States 137)". Listing forty values is no readout. It is so for any detail split, three series or forty. "The most" is a comparison of the engine's rows at that x, as the prose's leader is.
11. **Up and down step through the series one at a time,** as they do through colours, in the engine's order. The chosen line is drawn whole and the rest stand back, with the crosshair on it: the one way to read a single line of many. It costs a press a series, so the last of forty is forty presses away. Left as it is, on purpose. **To decide** with the keyboard model of the coverage plan's step 1, part 11, item 1.
12. **The pointer cannot choose one line.** It could not choose one colour either.
13. **The prose needed no change.** For this query it is the two-dimension sentence: "United States is the largest country at 32% of visitors in the last 28 days, and leads on all 28 days." It names no colour and no legend, and it is held by a test.
14. **`place()` needed no change.** Only `placeLegend` reads `Scene.series`, and it runs where the plan shows a legend.
15. **The fixture engine needed nothing.** It already answers a day by any dimension held as a mix.
16. **A legend's and a label's text is the raw value** (`US`), where the readout says the name. That is the colour split's too, and it does not show here, since a detail split has neither.
17. **The dot-grid painter turns low opacity into a sparse pattern** (reference, section 12). What it makes of a line at half strength was not looked at.
18. **No preset.** `spaghetti` as a preset is step 3's.

### Step 7, a registry for presets (built October 12)

Merged. 816 tests pass, nine of them new, and the typecheck is clean. Every golden scene is the same to the byte, the six of `map`, `symbols` and `unmapped` among them: the snapshot files are untouched. The parity tests are untouched. Not looked at on the bench or in a browser: nothing a painter reads changed.

**What was added**

- **The registry,** in `packages/core/src/presets.ts`: `registerPreset(name, { layers })` and `customPresets()`, both exported from core. A map and two functions, as the one for marks is, and no dependency.
- **`expand` looks in the library handed to it, then in the registry.** The library is read by its own keys, so `use: "constructor"` is an unknown preset and not `Object.prototype`'s.
- **`geo` registers `choropleth` and `symbol-map`,** in `registerGeo`, after the mark. Working names, to check against `@automattic/charts`.
- **The `map` and `symbols` samples are written with `use`.** This closes finding 2 of step 8 of the coverage plan.
- **Two errors say more.** An unknown preset lists the library and the registry, and names `registerPreset`. A spec with a dimension and no layers is offered the registered names after the library's.
- **The reference** (section 9) has the two presets in a table of their own, and the schema's description of `use` names them. `test/docs.test.ts` holds both to the registry as it holds them to the library.

**Choices, departures and findings**

1. **A registered preset is an ordinary preset from `expand` on.** The slots, a companion's suffix, the layers of the period before and the three "needs a dimension, a second dimension, a second metric" errors needed no change. `test/registry.test.ts` holds each.
2. **`registerPreset` refuses three things, and each error names the fix:** a name that is not letters, digits, `_` and `-`; a name core's own `PRESETS` has; a preset with no layers. A name already registered is replaced, as a mark is. It does not check that the preset's marks are registered: a package may register in either order, and `resolve()` refuses an unknown mark by name already.
3. **A caller's library wins over the registry,** so a code base can still override a registered name for one call. Only core's `PRESETS` is refused at registration, since a caller's library is not known then.
4. **A rule's `fallback` may name a registered preset, and nothing was changed for it.** `resolve()` plans again through `expand`. Proven by a test: a toy mark whose `marks` rule falls back to a registered list, reached from layers and from a registered preset of its own, with the scene equal to that list's to the node. In `<ua-view>` the same holds by reading only (`view.ts` hands a nested view the spec with `use: <fallback>`, and that view resolves it): there is no DOM in the test run.
5. **`<ua-view>` takes no library,** so the registry is the only way a page adds a preset to the element. `resolve()` takes one as an argument and the element never passes it. Not new, and now it matters less. **To decide** whether the argument is still wanted.
6. **`plan.preset` is `choropleth` for the map sample,** where it was `null`. Three assertions in `test/geo.test.ts` changed on purpose, and two test strings in `test/core.test.ts` that list the presets.
7. **The registry is one per page, and filled by importing.** A name is unknown until its package has been loaded and has registered. The fixtures register `geo` on import, so every test file that imports them sees the two names in its errors, and one that does not sees none.
8. **The schema names a custom mark's presets in prose,** as it already names `geo` under `mark`. Core's code still names neither. Each package that registers a preset owes a row in the reference and a word in that description, and `test/docs.test.ts` fails until it has both, for the packages the fixtures load.
9. **The schema's rule "a preset needs a dimension, the gauge excepted" names `gauge` alone.** A registered preset with no dimension would be refused by the schema and accepted by `resolve()`. None exists. For steps 8 and 9: `sankey` and `treemap` both take a dimension.
10. **The invalid sample `unknown preset` uses the name `treemap`.** Step 9 registers a preset of that name, and that sample then needs another.
11. **The count section 8 asks for:** two presets need a custom mark, of 21.

**Not done**

- `unmapped` is still written as layers. It could `use: "choropleth"`; the step asked for the two.
- No way to remove a registered preset. Nothing needs one.
- `CLAUDE.md`'s line for `packages/core` names the registry for marks and not this one. It was left for its owner.
- Section 1's table still gives `link` and `partition` as steps 7 and 8. They are 8 and 9.

### Step 10, tile maps (built October 12)

Merged. 840 tests pass, 24 of them new, and the typecheck is clean. Every golden scene there was is the same to the byte: no snapshot file but the new one changed. The parity tests are untouched. Core's code is untouched; two descriptions in its schema changed. Looked at on the bench in headless Chromium.

**Did the claim hold?** In the scene, yes. The `geo` mark draws a file of squares or hexagons with no change to how it builds a scene or places one: 122 paths, filled on the ramp, the same ramp under them, the same readout, list, table and fallback. Around the scene, no. Three things in `packages/geo` had to change before a page could have tiles beside a map, and none of them is about tiles: a planar set of shapes needed a way to say so, the mark's fit rules had `geo` written into them, and so did the painter's stylesheet.

**What was added**

- **`planar` on a shapes file,** in `packages/geo`. It says the coordinates are x and y on a flat sheet, y downward. The mark then fits them with d3-geo's identity in place of Equal Earth, and keeps path corners to a hundredth of the box where a map keeps a tenth.
- **A name for the mark.** `geoMark(shapes, { name, projection })` and `registerGeo(shapes, { name, projection, presets })`. `geoRules(name)` makes the fit rules for a layout of that name, and `GEO_RULES` is `geoRules('geo')`. `presets` names the preset that fills on `color` and the one that stands symbols on `size`; under `geo` they are `choropleth` and `symbol-map` as before, and under another name only what is given.
- **`geoPainterAs(name)`,** in `packages/geo/src/dom.ts`: the same painter as the layout of that name, with its stylesheet written for that name.
- **Two shapes files** in `packages/fixtures/src`, `tiles-square.json` (17.5 kB) and `tiles-hex.json` (23 kB), and `scripts/tiles.mjs`, which writes both. Exported as `tiles.square` and `tiles.hex`.
- **Two marks and two presets,** registered by the fixtures: `geo-tiles` with `tile-grid-map`, and `geo-hexes` with `hex-tile-map`. Working names, all four.
- **Two samples** in `moreSamples`, `tiles` and `hexes`: visitors by country, written with `use`.
- **`test/tiles.test.ts`:** a sweep, the fallback's thresholds, five golden scenes, the files, the shapes of the tiles, registration under a name, the painter, and symbols on tiles.
- **The bench:** `main.ts` and `marks.ts` register a painter for each of the two names. The main page has a row of frames for each sample, as it has for every sample, and the marks page has both as states of `geo`.
- **The reference** (sections 7 and 9) and the schema's descriptions of `use` and of a custom mark's name.

**Choices, departures and findings**

1. **Two more mark names, and no field.** The registry holds one mark to a name, and a layer or spec field that chose the shapes would be a presentation switch. So the same code is registered three times by the fixtures. **What it costs:** each name is a custom mark to the health check, so the fixtures now register three custom marks and four presets that need one, of 23. That overstates it: it is one mark's code and three inputs. **To decide** whether the count is of names or of code. Counted by names, every further set of shapes a page wants (a country's regions, another tile grid) is another custom mark.
2. **A custom mark's name is its layout's, and that reaches further than the registry.** The fit rules name the layout, the painter is registered by it, and the stylesheet selects on it. Before this step `geoMark()` always returned rules for `geo`, so a mark registered under any other name had no fit rules of its own and never fell back to the list. `test/geo.test.ts` registers two such marks (`south`, `world`) and only draws them wide, so it never showed. They are still made with no name. Not changed: it is that test's to say.
3. **The projection is chosen by the file, and the caller can still hand one over.** `d3-geo` is allowed in `packages/geo` only, so the fixtures cannot make an identity projection to hand in. A flag on the shapes says what is true of the data, as `keys` does, and needs no import. `projection` is still an option for a page that has d3-geo.
4. **A departure: `geoMark` and `registerGeo` take an options object second,** where they took a projection. Nothing in the repo passed one.
5. **d3-geo's types leave `fitWidth` off its identity transform,** which has it. One cast in `geoMark`, with a comment.
6. **The regions are all 122 countries of the fixture that have a code.** Somaliland has no code there, so no row could be its, and it has no tile. A tile's id and name are copied from the country file, so a row with a shape has a tile. The grid is 22 tiles across and 13 down for squares, and 22.5 by 14 rows for hexagons.
7. **Nobody drew the grids, and it shows.** The script puts each country at the middle of its largest piece, 13 degrees to a tile, takes nearest free places, and then swaps for as long as the total distance falls. It keeps a country near its place and knows nothing of borders. Europe spills east and south, Africa is a block, and the Americas are a thin column. At the root of the mean square a square tile is one tile from home, and a hexagon 0.8. **A grid drawn by hand reads better.** The published ones were not used: their licences were not checked.
8. **A tile map with no labels cannot be read, and the mark has no way to label a region.** This is the finding that matters. On a map a country is known by its shape and place. A tile has neither, so a reader cannot tell which tile is France without hovering. The readout, the list and the table all name it, so nothing is hidden, but the picture alone says only "somewhere about there". **Labels were not built.** They are more than a few lines: text nodes in the scene, a part to hide them by, a painter for them, and three things with no answer yet. One, the ink on a filled tile: the ramp runs from a light step to a dark one in each theme and there is no paint token for text on a step. Two, room: a tile is 15.7 px at a dashboard's 346 px and 21.8 px at the mark's full 480 px, and a two-letter code in the tick face is about 14 px wide, so it fits only near full width and needs a fit rule of its own. Three, what a label says: a key such as `US`, which the shapes hold, and a name does not fit. **Recommended:** build labels as a part of `geo` that planar shapes turn on, before either preset ships.
9. **Symbols by `size` on tiles work and do not fit.** With the layers written out, a symbol stands at the middle of each tile and the key to sizes is under the grid. The largest symbol is 24 px across on a tile of 15.7 px, so it covers its neighbours, and the one for the United States, in the first column, is cut by the edge of the box. On a map of countries the same symbol sits inside a large country. A size step that follows the tile would need the mark to know a tile's size. No preset was registered for it.
10. **Tiles hold their shape.** In the browser every square measured 15.71 to 15.74 px each way at 346 px, and every hexagon 15.36 to 15.40 across by 17.75 to 17.79 tall, which is regular. At 700 px the grid stops at 480 px, in the middle.
11. **The fallback is the same list from the same spec.** Under 280 px wide or 120 px tall a tile map is the `bar-list` of its query, to the node, and that list is the one the map of countries becomes.
12. **A click on a tile brings the map in to it,** as on a map of countries. On tiles it shows a few large squares and tells the reader nothing new. Left as it is: switching it off would be a difference between the two for the painter to know.
13. **The stylesheet is written out again for each name.** About 3.5 kB each. Marked in the code.
14. **The keyboard is the map's:** the regions are one list in the result's order, and every arrow steps along it. `Home` and `End` do nothing, here and on the map of countries. Not new.

**Not done**

- Labels (finding 8).
- A grid drawn by hand (finding 7).
- Presets for symbols on tiles (finding 9).
- No tile sample has a row with no tile. `unmapped` covers that for the mark, and the note is the same code.
- `CLAUDE.md` says the fixtures register the `geo` mark with a file of country shapes. They now register it three times. Left for its owner.
- In the browser: Chromium only, at the bench's widths. Not checked: a page that reads from the right, the `dots` painter on screen, reduced motion, a touch pointer, and a screen reader.

### Step 3, lines and areas (built October 12)

Built on a branch of its own, from `e09de06`, and not merged. 1,021 tests pass (969 before) and the typecheck is clean. `prototype/`, the parity tests and the six samples' golden scenes are untouched. Four golden scenes that existed changed, on purpose, and twelve are new; they are listed below. Looked at on the bench in headless Chromium.

**What was added**

- **A `line` in a plot of points.** With a metric on x and on y a line joins the rows in the engine's order, straight from each to the next, with the unfinished bucket joined on by a dashed stroke as on any line. Its path is in the points' part, `points`, with no `curve`.
- **Steps over bins.** `PathNode.curve` is `'monotone' | 'step'`, and a point of a stepped path has `w`, the width of its bin. `pathD` draws each point as a flat run `w` wide about its `x`, so `place()`, the DOM and the morph draw steps with no code of their own. A line or an area is stepped where x is a `number` dimension and the first row has `<dimension>@end`: the test a bar there already made.
- **The unit `rank`,** in `Unit`, `UNITS`, `formatUnit` and the catalog schema. Its y scale runs from 1 at the top to the largest rank, with a tick and a grid line for each. It is written "1st" in a readout, a table and the prose, and as the bare number on its axis.
- **A companion's unit.** `metricOf(catalog, field)`, exported from core: a field's own catalog entry where there is one under its whole name, and for a companion with none its metric's. `unitOf`, the scales, the readout, the crosshair and the table read through it.
- **`paint: "direction"`,** on a `bar` or an `area` with two ends, in a plot and in a row's track. `cut()` in `scene.ts` divides an area where its ends cross.
- **Five presets** in core's `PRESETS`: `bump`, `spaghetti`, `difference`, `connected-scatter`, `ecdf`. Working names, all five.
- **Four samples** in `moreSamples`: `connected`, `ecdf`, `bump`, `difference`. `spaghetti` is now written with its preset. All are swept in `test/coverage.test.ts` with golden scenes at three sizes, and what each is is held in `test/uncommon.test.ts`. `test/lines.test.ts` is new: a companion's unit, the rank scale and the joined line, on a catalog of its own.
- **The fixture:** `visitors@rank` on each pair of a query by week (a value's place among its week's, counted before any limit), `pageviews@cumulative` on each bin of load time, and `errors@share` on each cause. The catalog has an entry for each of the three.
- **Prose** for a plot of ranks, for an area painted by direction, and for two metrics joined through time (`rankProse`, `differenceProse`, and a branch of `tldrProse`).
- **The DOM:** `layouts/cartesian.ts` paints a path of `points` in the plot's SVG, under the dots. `layouts/points.ts` makes its points the targets, `data-hits="path"`. `motion.ts` carries a step's width through a morph, and morphs a joined line point for point (`pairUp`, and `mix` with `free`). The table writes a companion in its own unit, under its own label.
- **The bench:** every sample has its row of frames on the main page, as all do. The marks page has new states under `line`, `area` and `bar`.

**Golden scenes that changed, and why**

| Scene | Why |
|---|---|
| `density` at 346 by any, 234 by any and 346 by 100 | Part 2. Its line and its area are on a `number` dimension with `@end`, so both are steps now. **Not the reason the step's brief allowed** (it allowed part 4 alone): the decision of section 4, item 5 applies to this sample as written, and there was no way to keep it smooth without a field |
| `streamgraph` at 346 by any | Part 5. No y ticks, no grid and no gutter for them, and the bands take the height of the plot. Also outside what the brief allowed, and asked for by it |

No preset's scene changed: `waterfall`, `candlestick` and `box` are the same to the byte. No golden scene relied on the automatic rule. Twelve scenes are new, three for each new sample.

**Assertions that changed, and why**

- `test/ranges.test.ts`: the box plot's expansion has no `paint`. "A bar takes a second end … and is painted by which way it goes" now asks for it with `paint: "direction"`, and holds that without it the bars are `series.1`. "Is no spec field" became three tests: that the presets state it, the three refusals, and what a stated token does.
- `test/uncommon.test.ts`: the tornado's "for step 3 and 4" fact is now two. With no paint both bars are `series.1`. With `paint: "direction"` a bar from a gain to zero is still a loss, which is step 4's. The streamgraph's fact says it has no axis. The fact that a companion has no unit is replaced by the Pareto drawn from a companion.
- `test/coverage.test.ts`: `stack: "center"` has no `ytick:0` to find its middle by, so the middle is 0.5 and the test holds that there is no axis. The sweep's "what a plot gives up first at 250 px" passes over what a comparing plot says of a missing prior period, since `difference` is the first plot of the sweep that compares. `connected` joins the names of the plots of points.
- `test/points.test.ts`: the density's first point has a width, and its paths are steps. An error that lists the companions of page views lists one more.
- `test/core.test.ts`: the units an error names include `rank`, and the two strings that list presets have five more.
- `test/coverage-rows.test.ts`, `test/registry.test.ts`: the error for a preset short of a second metric.

**Choices where the plan was silent, and departures**

1. **A companion's unit is known from the catalog, by the companion's whole name.** A companion with no entry is in its metric's unit, which is what was true by accident of quantiles and intervals. One that is not has an entry in `metrics`, `"visitors@rank": { "label": "Rank", "unit": "rank", "polarity": "down" }`. Core learns no suffix. The alternatives were a suffix table in core, which the rule forbids, and a `unit` on the result's `meta`, which would put a presentation fact in the answer. **What it costs:** `catalog.metrics` now holds names that are not metrics a query can ask for, and an error that lists the catalog's metrics lists them. A `text` layer in rows on a companion that has an entry becomes a column with a header, so the fixture gives `pageviews@rank` none and the league table is unchanged.
2. **The Pareto's companion form works, and the sample was left as it is.** With `errors@share` and its entry, the line has the far axis in `ratio`, and the scene is the metric form's node for node (held by a test). The sample keeps the metric form so that its golden scenes stand. The two differ in one thing: a companion is no metric of the query, so the prose has no "Overall, cumulative share 100%".
3. **A rank is written "1st" where a value is said, and "1" on its own axis.** The plan said only "written as ranks".
4. **What is no rank is at the foot of a rank scale.** A bar or an area starts from zero, which is no rank, so the scale puts anything under 1 at the bottom. A bar of ranks is then tallest for the first and has no height for the last. Not refused, and not a chart anyone wants.
5. **Ticks past ten ranks are every few,** with the first and the last always there. The plan said a tick per rank, thinned by the usual rule; the usual rule only knows a short plot, and thirty labels do not fit a tall one.
6. **A line in a plot of points has straight segments, and so no curve to invent a path.** A stepped line has none either. Every other line keeps the monotone curve it had.
7. **An area steps over bins too.** The plan names the line. An area under a stepped line that stayed smooth would not meet it, and the density sample is that pair.
8. **An `area` in a plot of points is refused,** with the fix. There is no one way along x to fill under. A new refusal.
9. **A line of points with no dot layer still has a target at each point.** The painter makes them from the path, with nothing painted, so the keyboard and the pointer work and the `points` fit rule finds its part. Core emits no node for them.
10. **Keyboard along a connected scatter:** left and right step back and on along the line, which is the rows' order, and stop at its ends. Up and down do nothing. Enter activates, Escape lets go. Loose points keep the nearest-neighbour model.
11. **A joined line has no crosshair.** Its x axis is a metric, and a crosshair's label under the plot is the row's name, which would stand among the wrong numbers. The readout says both values.
12. **An area painted by direction is a tint,** at the 0.14 a fan's band has, in `delta.good` and `delta.bad`. Looked at in both themes: pale, and enough between two lines.
13. **A crossing is found on the straight line between two rows,** and the pieces are then drawn with the curve the lines beside them have. So a piece's tip is a hair from where those curves cross. Not visible at any size looked at. Marked in the code.
14. **A piece of a cut area is keyed by the row it starts at:** `context:area:2026-09-17`. A point where the ends cross has no `row`, so `PathNode.points[].row` is optional now. `hitNodes` and `crossMarks` pass over such a point.
15. **`paint: "direction"` is refused in three cases,** each with the fix: on a mark with one end, on a mark that is no bar or area, and beside a field on `color`.
16. **Where polarity is `none` a mark painted by direction is in its layer's own paint,** and an area is not cut. That is what the automatic rule did.
17. **Bars that go both ways from zero are still painted as gains and losses with nothing said** (the `diverging` sample). That rule is older than Decided 28's and is not the one that was replaced. **To decide** whether it should be asked for too.
18. **The tornado still states `delta.bad` and `delta.good`.** `paint: "direction"` does not mend it: a bar's first end must be a field, so a bar from zero to a gain is written from the gain to zero and runs down. Step 4, part 7 mends the cause.
19. **A stack about the middle has no value axis.** Chosen over an axis of thickness, which would need its own ticks on a scale no band sits on. No ticks, no grid, no gutter, and the scale is not rounded, so the thickest day takes the whole height. `plan.guides.y` is still true; the scene's `parts` leave `y-axis` out. Thickness is in the readout and the table.
20. **A slopegraph over two days is the query's business, and nothing was changed.** The range ends on the unfinished day, and a slope to an unfinished day is rightly dashed: it is the rule every line has. What is missing is a range that ends on the last whole bucket, which a query cannot say. For the API's owners.
21. **Step 0's finding 7 was not fixed.** A plan with two dates on x says it gave up a middle date label that was never there. Mended, it broke a parity test: the prototype says the same of a plot with one row, and the test holds the port's plan to it. Left, and recorded.
22. **The bump sample is pages by week, six of them.** Channels by week never change place in the fixture. Pages do, twice, and each ends where it began, so the prose has a sentence for that: "Places changed along the way, and each page ended where it began." A net rise and a net fall are held on a result of the test's own.
23. **The `bump` preset is the line alone,** with no dot at each place. With dots the pointer's readout would say visitors and not ranks.
24. **The difference sample is revenue,** which crosses the period before fourteen times. Visitors never does.
25. **`difference` has no form against a catalog `target`.** The plan offered one. A second end may be a number, and a target is in the catalog, so it would need a slot or the lean on role the gauge has. Not built.
26. **`ecdf` is a preset:** a line of `$metric@cumulative`. The suffix is the fixture's name for the share held so far.
27. **`connected-scatter` is a line and a dot,** with no label on each point: twenty-eight dates is clutter, and the readout names each.
28. **The error for a preset short of a second metric was the funnel's own words.** It names both presets that use the slot now.

**Findings**

1. **A rank at a whole point is not said.** The readout of a point of a split plot lists each series' value of the query's metric, so on a bump chart it says visitors. Up and down choose a series, and then the crosshair and the readout say its rank. The pivoted table has no companions at all, so it has no ranks. **To decide** with the keyboard model.
2. **A scale still holds zero,** so a connected scatter sits in a corner of its plot when neither metric comes near nothing. Step 0's finding 8, again.
3. **Up and down on a joined line scroll the page,** as they do on any plot with no series: the keys are not taken where they are no step. The readout goes with the scroll. Not new.
4. **The ECDF's prose is the binned sentence,** "The most, 4,758, at a load time of 1.5 to 2", which is true of the count and says nothing of the share. A sentence for it ("half within 2.5 seconds") would read a quantile off the engine's rows. Not written.
5. **A cut area's pieces change keys when a crossing moves to another row,** so on a data change a piece may leave and another enter where one would do better to move. Seen as a fade, not a fault.
6. **Section 8's counts.** Layer fields that are neither data nor role: still one. Presets that need `detail`: one of the five, `spaghetti`.

**Not done**

- A sentence for an ECDF, and a rank in the whole-point readout and the pivoted table (findings 1 and 4).
- `difference` against a target (choice 25).
- In the browser: Chromium only. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a page that reads from the right, the dots painter on screen, and a boxed height for the new samples beyond what the sweep holds.

**For the API's owners**

- A catalog entry for a companion that is not in its metric's unit, or a unit beside each companion in the answer.
- `metric@rank` and `metric@cumulative` by name, without `compare`.
- A range that ends on the last whole bucket.

## 8. What to count as it is built

- **Custom marks.** There is one, `geo`. The plan adds two. Each is a hole in the grammar.
- **Layer fields that are neither data nor role.** One, `sweep`. The claim is that it stays one.
- **Presets that need `detail`.** If most new presets do, `detail` is doing `color`'s work and the legend rule is wrong.
- **Claims of step 0 that fail.** The first reading said 16 types work today. Every miss is a measure of how far the docs are from the code.
