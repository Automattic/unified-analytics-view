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

### Step 2, arc reads data (built October 12)

Merged. 873 tests pass (836 before) and the typecheck is clean. `prototype/` and the parity tests are untouched, and every golden scene that existed is the same to the byte: the snapshot files of pie, donut, half and gauge among them have no changed line, and a new file holds the new ones (three samples at three sizes, and each one's ratio scene). Three samples in `moreSamples`: `rose` (visitors by hour), `rings` (visitors by channel, the `radial-bar` preset) and `sunburst` (visitors by device, then by channel). Swept and held in `test/arc-data.test.ts`. Checked in headless Chromium on the bench: each sample at 346, 250, 170, 120 and 80 px; the widest frame drawn in to 240, 225, 180, 150, 100, 70 and 40 px and out again; boxes 160, 100 and 60 px tall; light and dark; the three data states; a change of range and of data state in place; real key events; the pointer; the table. The four radial samples that existed were looked at again and are as they were. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a page that reads from the right, the dot-grid painter, `place()` in any pixel painter (it is tested as numbers only), and the arcs' motion on a data change beyond that it ends in the right place.

**What was added**

- **Four forms of one mark,** chosen in `sceneRadial` by what is on `angle` and `radius`. No layer field was added: `sweep` is still the only one that is neither data nor role.
  - A metric on `angle`, a dimension on `color`: as it was. With a dimension on `detail`, a second ring (the sunburst).
  - A dimension on `angle`, a metric on `radius`: a slice for each row (the rose).
  - A dimension on `radius`, a metric on `angle`: a ring for each row (the radial bar). With nothing on `angle`, the whole ring, faint.
  - A metric on `angle` alone: as it was (the gauge).
- **Presets** `rose`, `radial-bar` and `sunburst`. Working names, to check against `@automattic/charts`.
- **`radius` takes a field.** In the schema it is a number from 0 up to 1, or a string. `DETAIL_LAYOUTS` has `radial`.
- **A part, `rim`,** a guide `Guides.rim`, and a fit rule `rim` for `radial` (230 px across, 120 px tall, kept by `keep: ["guides"]`). The reducer's `drop-guides` gives it up and says "the labels round the rim".
- **Scene.** A second ring's arc has its segment's `row` and its own value as `series`, with key `primary:arc:<parent>:<child>`. `Scene.detail` holds the second ring's values in the engine's order, as step 1 made it for a plot. `Scene.rows` are the segments, slices or rings.
- **The fixture engine answers `hour` and `weekday` in their own order** when either is asked for alone. No catalog entry was added.
- **In the DOM,** `layouts/radial.ts` paints the three forms, the rim's labels and a measured pass that thins them. A second SVG, `.uav-under`, holds the arcs that are no point of their own. `keys.ts` gained two lines: the pointer over an arc of a second ring chooses it, and the readout stands over it.

**Choices where the plan was silent, and departures**

1. **A rose is in one paint,** `series.1`, or the layer's `paint`. A colour each would be held to six, and a day has twenty-four hours. A dimension on `color` beside one on `angle` is refused, with the fix: a stacked rose is a later question.
2. **A rose has no hole** (Decided October 12, item 6). A number on `radius` beside a dimension on `angle` is refused, since every slice would then be the same.
3. **`sweep: "half"` is refused with a dimension on `angle` or on `radius`,** by name, with the fix. A half sunburst is allowed: it is the circle divided by colour that `sweep` already served, and it cost nothing. It was not tested and not looked at.
4. **The faint ring behind a radial bar is a layer of the preset, not something the mark adds.** `{ "mark": "arc", "encode": { "radius": "$by" }, "role": "context" }`: a layer with nothing on `angle` is the whole sweep, which is what the gauge's range already was. So an author may leave it out, and the reducer gives it up with the other `context` layers. Decided yes, it stands there: without it a short arc is not seen as part of a ring, and the full turn it is read against is not on the page.
5. **A ring takes a colour only where its dimension is on `color` too,** as a row does in `rows`. The preset writes it, so each ring has a series colour and an entry in the legend. Without it every ring is `series.1` and there is no legend. Any other dimension on `color` is refused.
6. **A radial bar's legend says each ring's value, not a share:** a ring is read against the largest, or a range, and is no part of a whole. It is the band's legend otherwise, node for node, and steps down by the same two rules.
7. **Six rings is its own limit** (`RINGS` in `scene.ts`), not the count of series colours, though the two are equal. It holds for rings in one paint as well: under that each is too thin to follow round.
8. **Rings run from the outside in, in the engine's order,** the first outermost. They share the radius from 0.3 of it out, and each fills 82% of its share. Constants in `scene.ts`.
9. **A ring sweeps against the largest row, which makes the largest a closed circle.** That is the step as written. Charts of this kind often stop at three quarters of a turn, to leave room for labels at the start. Not done: the legend is the label. **To decide** if a full turn reads badly.
10. **The second ring is in its segment's colour at 60% of it** (`opacity: 0.6`, no `tone`). Lighter and not the same: at full strength the two rings are one mass, and only a hairline says where one level ends. The hue still ties each arc to its segment. `tone: "soft"` is for a fill that tints behind a mark, and would take the token's palest step, which is too faint for a mark that carries a value.
11. **The first ring ends at 0.6 of the way from the inner radius to the rim** (`SPLIT`). The `sunburst` preset has no hole. A number on `radius` gives it one, and from 0.5 the number sits in it as in a donut. Tested as a scene; not looked at.
12. **An arc of the second ring is its share of the engine's total,** set from where its segment starts. With whole data that divides the segment's span exactly, and with a `limit` the ring stops short of its segment's end, as a circle with a `limit` stops short of closing. The span itself is `totalsBy` for the first dimension. Without `totalsBy` the layer is refused, by name.
13. **The legend of a sunburst is its segments' only.** The second ring's values have no entry. They are named by the readout, the keys and the table.
14. **Labels round the rim are the smallest readable form.** One for each slice, at the middle of it, set outside the circle and upright. The circle gives up 14 px all round to them, and those to either side run out of the part into the view's width, which is why the rule asks for 230 px. They are ranked so that about four stay, then those half way between, then the rest; `place()` and the DOM's measured pass both thin them with `declutter`, which was there. **What is missing:** a label does not turn with its slice or follow the arc; the thinning is by collision, so at 160 px a clock keeps eighteen of its twenty-four labels and loses the ones beside 12 and 6, which is uneven; where the count is not a multiple of four the ones that stay are not evenly spaced (seven weekdays keep Monday, Wednesday, Friday and Sunday); and a long label to either side is not clipped.
15. **A radial bar in one paint has no labels at all.** Labels beside the rings were not built. The preset is not that form.
16. **A rose shows no number.** Like a pie, it has none above it by default and no hole to put one in. Each slice's value is in the readout, the option's name and the table, and the three largest are in the prose.
17. **The prose now ranks rows by comparing them.** `tldrProse` took the first rows as the largest, and `leader` the first row, which is false of rows in clock order ("Top hours: 12am, 1am, 2am"). Both now compare the engine's rows, as the grid's peak and the scatter's extremes already did. Nothing is summed. For rows an engine ranked the words are the same, so no test of the six samples moved. The share sentence of a pie is fixed by the same line.
18. **`share` is false for a rose and a radial bar,** so they take the ranked sentence and the note "Top: 11am". A sunburst takes the two-dimension share sentence that was there: "Desktop is the largest device at 52% of visitors, and Search the largest channel at 42%."
19. **Keys.** Left and right step through the slices, the rings (from the outside in) or the segments, and stop at the ends, as version 4 does. In a sunburst, up steps out to the segment's first arc of the second ring and on through them, and down comes back and then in to the segment. That is the split plot's stepping, unchanged. The order is the second dimension's own, so it is the same in every segment.
20. **The pointer chooses an arc of the second ring,** which it cannot do for a line of a split plot. An arc there is its own target, and its neighbour is another value. Over the faint ring of a radial bar it chooses that ring's row.
21. **A segment chosen with the keys says its second ring as a mass:** "Mobile: Visitors 4,318 (6 channels, the most Search 1,763)". Step 1's readout for a split with no colours, unchanged.
22. **The table needed nothing.** One dimension is a row each, and two is the pivot.
23. **Two errors changed on purpose.** "It takes a number from 0 up to 1" now names all three things `radius` takes. A dimension on both `angle` and `color` with nothing on `radius` used to say "Put a metric on angle"; it now says what a slice needs, and names that fix as the other way out.
24. **`detail` naming the dimension that is on `color` is still refused by `resolve()`,** as step 1 left it.

**Findings**

- **The plan's "equal slice, in the engine's order" needs the engine to have an order.** The fixture ranked every categorical dimension. Section 5 already asks the API's owners for it, and core cannot tell which it was handed: hence item 17.
- **An SVG that is focused draws its outline as a square,** and the rim's labels at the four diagonals lie across it. Seen, and left.
- **Arcs are parted by a stroke in the background colour, two rules wide.** On a rose it eats the thin end of every slice, so the centre is a small empty disc. It is not the scene's gap, and it was left as the pie has it.
- **An arc narrower than the gap has no width** (Tablet's last channel, at 0.2% of the circle). It keeps its key, and the keys and the table still reach its value. The pointer cannot.
- **A slice with no value, or none above zero, is not drawn** and keeps its place and label. Its row is in `Scene.rows`, and the keys pass over it.
- **The count section 8 asks for:** one of the three new presets needs `detail`.

**Not done**

- A stacked rose, a rose or a radial bar of the previous period, a half rose and a half radial bar.
- A hierarchy deeper than two levels (Decided 24).
- Labels beside the rings, and labels that follow the circle.
- A scale on a rose: nothing says what radius is what value.
- `CLAUDE.md` was left for its owner.

### Step 6, unit (built October 12)

Built on a branch of its own. Merged. 937 tests pass (836 before) and the typecheck is clean. `prototype/` and every golden scene that existed are unchanged: no line of an existing snapshot file moved, and `test/__snapshots__/unit.test.ts.snap` is new. All five forms are whole: each has its types and schema, a scene and `place()`, fit rules down to the number and the prose, a sentence, a layout module with keys and the table, a sample with golden scenes and a place in a sweep, and frames on the bench. Checked in headless Chromium on the bench: the six samples at 346, 250, 170, 120 and 80 px, widened to 600 px and resized in place across 280 px both ways, in a box 160 px tall, light and dark, the three data states, 28 and 7 days, real key events, the pointer, the table, and the marks page. Every glyph was measured where it was laid out and is as wide as it is tall. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, right to left, print, forced colours, the dot-grid painter, a data change that moves glyphs, and a spec that keeps its marks at a narrow width.

**What was added, for the steps that follow**

- **The mark,** `unit`, in `Mark`, the schema's enum, `PLOT_MARKS`, `TRACK_MARKS` and so `BUILT_IN_MARKS`, with a grid in `band` (`sceneGrid`) and seats in `sceneRadial`. Four error strings list marks and each has it: no mark at all (`plan.ts`), no rule for an axis and none for rows (`scene.ts`), and none about a centre.
- **`packages/core/src/unit.ts`** holds the arithmetic, exported from core and tested in `test/unit-rules.test.ts`: `unitWorth(most, cap, whole)`, `unitCount(value, worth, what)`, `unitShares(values, total, cells)` and `unitSeats(count)`. **A step that needs a largest-remainder share calls `unitShares`.**
- **`CircleNode` gains `w` and `h`,** the room a glyph has. `Part` gains `unit-key`, `Guides` gains `unitKey`, and `Scene.aspect` is stated by a grid in `band`.
- **`FitRule` gains `mark`,** and `fallbackRule` a fifth argument. See finding 1.
- **A preset, `bar`,** and five for the mark: `waffle`, `unit-chart`, `isotype`, `parliament`, `icon-array`. Working names.
- **Nine default fit rules:** `unit-key` in each of the four layouts, and a fallback in each, two in `band`.
- **Six samples** in `moreSamples`: `waffle`, `units`, `wilkinson`, `isotype`, `parliament`, `icons`. The fixture catalog and engine needed nothing.
- **`packages/dom/src/layouts/unit.ts`:** the shared styles, the key, and `unitDot`. The four layout modules call it.

**Findings**

1. **A fallback did not work from a built-in layout, and three things were widened for it.** `fallbackRule` chose by layout alone. A waffle and the share bar it becomes are both `band`, so the rule applied to its own result and threw as a loop, and in the DOM the compiled rule hid every band under its need, a share bar among them. What it took: (a) a rule may name the `mark` its layout must hold; (b) a rule whose preset the query cannot fill is passed over (`fills`, in `presets.ts`), so `band` offers the share bar and then, for a grid with no dimension, the gauge; (c) the compiled swap hides the figure only where the view beside it is that rule's own, `:has(~ .uav-fallback[data-rule="<id>"])`, where it was any band's. `via` now holds what was given up, `band (unit)` for such a rule, so a context's own rule for the layout may still follow it. A rule with a `mark` is passed over where the caller does not say what the view holds. The compiled string changed for every fallback, `geo`'s too: two assertions changed on purpose.
2. **The schema's clause "a preset needs a dimension" is dropped,** as step 7 recommended, and not added to. Two assertions that the schema refuses `use: "line"` with no dimension now say it accepts it and `resolve()` refuses it by name (`test/core.test.ts`, `test/radial.test.ts`).
3. **`test/fallback.test.ts` said no default rule names a fallback.** Now those of one mark do, and it says that.

**Choices where the plan was silent, and departures**

1. **How a glyph holds its shape.** A dot states its room, `w` and `h`, as a cell states `y` and `h`, with `x` and `t` at the middle. The two are ratios of different lengths, so a scene cannot say "round": the painter takes the lesser in pixels, less a hairline. `place()` does it in `glyphRadius`, and the stylesheet with `min(var(--uav-w) * 100cqi, var(--uav-h) * 100cqb)` and `aspect-ratio: 1`, which works because the plot is a size container already. Two fields on one node kind, and no new kind.
2. **A stack is on the plot's own scale, and is not packed.** A glyph's height is its worth on the y scale, so the axis, the grid and a `rule` read true against it and it can stand beside other marks. The cost: where a band is narrower than a glyph's share of the height, dots stand apart up the stack. A packed stack (the plan's "as wide as its band", always) would need positions in pixels and an axis that lies. At the sizes looked at the dots touch.
3. **A stack keeps its y axis and grid.** Guides are derived from scales and a unit has one. The key says the same in other words.
4. **The share grid needs no `stack`.** A unit divided by `color` with no dimension on an axis is shares already, and its prose and note are the share bar's. `stack: "normalize"` is accepted there and changes nothing; every other `stack` on a unit is refused.
5. **The icon array is a metric on x and nothing else,** and is laid out as `band`: the same grid as the waffle. `detectLayout` gained one line for it. A query with a dimension is refused there, by name.
6. **The number stands above an icon array, always.** Its grid says how far along its range the metric is, and not what it is, and it has no hole to put the number in. This goes round `tldrValue.above`. **To decide.**
7. **A grid has no key for a hundredth.** A waffle's cell is 1% and its legend says the shares. An icon array's cell is a hundredth of the domain and does have one: "Each is 5".
8. **No least of one cell in a share grid.** Largest remainder sums to a hundred; a value too small for a cell has none, and is in the legend. A stack, a run and seats do give any value above nothing one glyph.
9. **Seats: the cap is a hundred.** A seat is one of the metric while the engine's total is a hundred or fewer. Each row's seats are its own value rounded, so they need not sum to the total's. With a `limit` the rest's seats are there in no value's paint, and they are worked out only then (`q.limit`), or rounding alone would leave a grey seat. With no total a seat's worth is the largest row's, as a stack's is.
10. **Seats stand in as few rings as hold them,** between 0.4 of the radius and the rim, so a seat is as large as the count allows, and are handed out by angle so a value is a wedge. Their part is up to 240 px across, where arcs have 160.
11. **A seat's and a cell's paint cycle as their layout's does:** a seventh value of seats is an error, as a seventh arc is, and a seventh value of a grid takes the first colour again, as a seventh segment does.
12. **The rest is `seq.none`,** the paint of a cell with no value. An icon array's unlit cells are the layer's own paint as a tint, as a gauge's range is.
13. **Keys.** `primary:unit:<row>:<n>`, from 1. The rest: `primary:unit#rest:<n>`. An icon array's cell has no row, so it is `primary:unit:<n>` by its place, and one that stays lit keeps its key. The key's own: `unit-key:<layer key>`.
14. **The key's rule asks for height alone:** 160, 120, 220 and 200 px by layout. A line of three words is never short of width where its glyphs are drawn. It is the first thing `drop-guides` gives up.
15. **Every fallback is at 280 px across,** the room a plot with axes needs, so on the bench a form shows at 346 and its fallback at 250. By height: 120 for a stack, 180 for a grid, 160 for seats, none for a run, whose rows are trimmed.
16. **`bar` is a new preset,** for the stack to fall back to. The step did not list it. It follows `BarChart`.
17. **Refused, each by an error that names the fix:** `x2` or `y2` (the error that was there), `stack`, `series`, a split by `color` or `detail` on an axis, a value below zero in any form, seats with no `sweep`, with no dimension or of more than six values, no metric to count from, a metric where a dimension must stand, bins with no `@end`, and a grid with no dimension in a query that has one.
18. **In the DOM a group of glyphs is one option.** In the band and round the half circle every glyph carries its row; the first of a group is the listbox's option and the rest are `presentation`. `Keys` took the first of a row where it took the last. In a plot and in a list nothing changed: the hit targets were a row's already.

**Not done, and what is uncertain**

- **A unit beside a bar in `band` draws the grid and ignores the bar,** as `sceneBand` ignores every layer after its first. Not refused.
- **In a box, the stylesheet keeps a run's key where `resolve()` gives it up for one more row.** A height that depends on the data, which a rule cannot hold.
- **A chosen group wears an outline on every glyph.** It reads, and it is heavy on a hundred cells. Not tuned.
- **Glyphs that move on a data change were not looked at.** A cell that changes group changes key, so it fades out and in.
- **`CLAUDE.md`'s line for `packages/dom` does not name `unit.ts`.** Nothing there became false, so it was left.
- **The count section 8 asks for:** `sweep` is still the only layer field that is neither data nor role, and a unit's seats now read it. No preset here needs `detail` or a custom mark.

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

### Step 8, link (built October 12)

Merged. 836 tests pass, twenty of them new, and the typecheck is clean. Every golden scene that existed is the same to the byte: three are new, in a file of their own. The parity tests are untouched. Sample added: `sankey`. Checked on the bench in headless Chromium: the Sankey at 346 px, the grid at 250 px from the same spec, a resize in place with no script, keyboard, hover, the table, both themes, the three data states and a box of 160 and of 100 px.

**What was added**

- **`packages/flow`,** with no dependency but core, and `packages/dom` for its painter, as `packages/geo` has. `linkMark` is the mark, `registerLink()` registers it and its preset, and `linkPainter` is the DOM's half. The scene half loads with no DOM.
- **The scene:** two columns of nodes, a `rect` for each value in the engine's order, as tall as the engine's total for it from `totalsBy`; a `path` for each row of the result, as wide at each end as the row's share of the node it meets; a label for each node, in the `labels` part. Ribbons are drawn in a box 100 by 100 and stretched, as a plot's lines are.
- **Paint:** `series.1` to `series.6` by a source's place in the engine's order, its ribbons the same paint with `tone: "soft"`, and a target `ink.muted`.
- **Fit rules:** `guides` (320 by 140) hides the labels, and `marks` (280 by 120) has `fallback: "heatmap"`.
- **The preset `sankey`,** registered with the mark. A working name.
- **Fixtures:** a dimension `section` (Home, Blog, Docs, Pricing, Changelog), which with `channel` is a flow. The engine needed nothing else: it already answers two categorical dimensions with `totalsBy`.
- **The bench:** the sample's frames on the first page, and `link` on the marks page with a ribbon chosen.

**Nothing in `packages/core/src` changed.** The schema's descriptions of `mark` and `use` name the mark and the preset, in prose.

**Choices, departures and findings**

1. **The target is on `y`, not `x2`.** The plan said `x2`. `checkLayers` keeps `x2` for a bar, a rule or an area, and `encode` is a closed set. With the source on `x` and the target on `y`, none of core's checks needed a change, and its "no layer encodes it" error catches a missing target before the mark is asked. A test holds that `x2` is still refused, in core's words. **To decide,** with finding 3 of the coverage plan's step 8: `source` and `target` channels, or leave it.
2. **A custom mark cannot give the prose.** The step asked for the largest flow by name and its share. `CustomMark` has `rules`, `scene` and `place`, and `resolve()` writes `plan.text` itself, so the Sankey says what any query by two dimensions says: "Search is the largest channel at 41% of visitors, and Home the largest section at 30%." The grid it falls back to says more, since `gridProse` is the matrix layout's: "Most visitors at Search, Home (1,378) in the last 28 days…". So one spec says two sentences at two widths, and the wider one says less. The registry was not widened. The smallest change that would close it is an optional `prose(view)` on `CustomMark` and one line in `plan.ts`. **To decide.**
3. **Core cannot say that the labels went.** `resolve()` asks a custom mark's `guides` rule only when its scene shows a `ramp` or a `size` part, and `link` has neither. So between 280 and 320 px the plan still lists `labels` and `dropped` is empty. In the DOM the compiled rule hides them. For pixel painters `place()` asks the rule itself, and it has no spec, so `keep: ["guides"]` keeps the labels in the DOM and not there. A custom mark with a guide of its own needs a way to name it. **To decide.**
4. **A result with no `totalsBy` is an error that names the fix,** as `stack: "normalize"` has. It names the dimension that lacks it.
5. **The plot is as tall as the engine's total.** So with a `limit` a column stops short of the foot by what the values past the limit hold, as a band does, and a node stops short of full by the ribbons the limit left out. Where a column's totals come to more than the total, which a metric that does not add up gives, or the engine gives no total, the plot is as tall as the taller column. That sum fits the box and nothing else: no value is said from it. A node is never sized from the rows, and a test holds it by cutting the rows.
6. **A value with no total, or a total of zero, has no node. A row with no value, a value of zero or less, or an end with no node has no ribbon,** and says nothing of it: the row is still in the table. A count of rows not shown, as `geo` has, was not built.
7. **The grid reads the right way round.** `heatmap` puts the query's first dimension down the side and the second across, so the sources are the rows and the targets the columns, as a from-and-to table is read. Nothing was changed for it. At 250 px its x labels thin: Home, Blog and Pricing show, of five.
8. **The labels are inside the columns, over the ribbons,** so no gutter has to be measured. Where two in a column would meet, the larger node's stands: `standing()`, used by `place()` at a line of 14 px and by the painter's measured pass at the real line. At the natural height of 184 px the fixture's smallest source, "Other", has no label.
9. **The keyboard is the element's own, on the list of ribbons.** One tab stop, a listbox, and every arrow steps along the result's rows, which the engine sends source by source; each option is named by its readout, "Search, Blog: Visitors 1,211". Every ribbon's value is reached. A node is not a stop. **Proposed, not built:** up and down a column's nodes, left and right between the columns, and Enter into a node's ribbons, with the node's total said. It needs listeners of its own, as the grid has.
10. **The table is the element's pivot of the query,** sources down the side, targets across, with the engine's totals at its edges. It has every flow and every node's total, so the painter has no table of its own. A node's total is nowhere else: hovering a node says nothing.
11. **A chosen ribbon is told by the rest standing back** to 0.3, as well as by its edge. Ribbons lie over one another in the result's order, and a hairline's edge alone was not seen.
12. **In the dark theme the ribbons are faint.** A series colour's soft tone there is close to the surface, since it was made to sit behind a label. The step asked for the soft tone, so it is as asked. **To look at:** the paint at an opacity, or a tone of its own.
13. **Nothing moves on a data change but a fade.** A ribbon's shape is set, not morphed, and the nodes and labels are placed by properties that are not registered, so that they do not glide while the ribbons jump.
14. **`no-prior` is `typical` for this sample:** the query does not compare. `empty` is the notice, and then the number.
15. **The fixtures register the mark,** so `fixtures` depends on `flow`, as on `geo`. The painter is registered on the bench's first page and its marks page only.
16. **A layer's `paint` is not read,** and a companion on `size` (`visitors@previous`) is taken as any field is, and is not tested.
17. **Three presets need a custom mark, of 22.** There are two custom marks.

**Not done**

- No sentence of its own, and no report of the labels going: findings 2 and 3.
- No keyboard stop or readout for a node: findings 9 and 10.
- The natural height is a plot's, 184 px, whatever the count of nodes. Six sources fit; more than six is refused, but a target column has no limit.
- Not checked: a screen reader, a page that reads from the right, a touch, any browser but Chromium, and the dot painter in a browser (it is swept in the tests).
- `test/geo.test.ts` asserted the whole list of registered presets. It now asserts the first two, since the fixtures register a third.

### Step 9, partition (built October 12)

Merged. Built on a branch of its own. 882 tests pass (836 before) and the typecheck is clean. Every golden scene that existed is the same to the byte: the snapshot files are untouched, and `test/__snapshots__/partition.test.ts.snap` is new, with eight scenes. The parity tests are untouched. Checked in headless Chromium on the bench: both samples at 346, 250, 170, 120 and 80 px, in a box 160 px tall, light and dark, `typical`, `no-prior` and `empty`, a frame resized in place from 250 to 700 px and back, real key events, the pointer, a click, the table, and on the marks page the six surfaces, the ramp and a `limit`. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a page that reads from the right, the dot-grid painter, and a data change while a box is chosen.

**What was added**

- **`packages/partition`,** set up as `packages/geo` is. Its dependencies are core and, for the painter, `packages/dom`. `registerPartition()` registers the mark and two presets. The fixtures call it on import.
- **`squarify(values, w, h, total)`,** written there: about twenty lines, with a test of its own (areas, shapes, the whole box, the same answer twice, the room left for a rest).
- **The mark,** `partition`: `x` the parent, `detail` the child, `size` the metric, and a metric on `color` for the ramp. One level with no `detail`.
- **Presets** `treemap` and `pair-list`. Working names.
- **The painter,** `partitionPainter`, with a keyboard, a readout and a table of its own, and `measure` for the names.
- **Fixtures:** a dimension `section`, which divides the whole as `channel` does, and the pages each section holds. A query by `section` and then `page` answers with a row a page, `totalsBy` for both, and all three scenarios. Samples `treemap` (two levels, by `use`) and `tiles` (one level, as layers).
- **The bench:** both samples in the frames of the first page, and `partition` on the marks page with one level, the ramp and a `limit` as states.

**Changes outside the package, exactly**

1. **Core: a layout may name a fallback for each shape of query.** `fallbackRule()` in `fit.ts` takes a fifth argument, `can(preset)`, and passes over a rule whose preset it refuses. `fills(use, query, presets)` is new in `presets.ts` and exported: whether the query has a field for every slot the preset's layers name. `resolve()` and `<ua-view>` both hand `fallbackRule` that. With nothing handed in it answers as before, and `geo`'s one rule is found as before. Why: a rule names one preset, a custom mark's rules are fixed when it is registered, and no one preset draws both a query by one dimension and a query by two. `bar-list` leaves the second dimension undrawn, which core refuses, and anything with `$split` is refused with one. Without this the mark could have a fallback for one level or for two, and not both, and the element builds the fallback's view whatever the size. **To confirm.** It is a change to fit rules, not to `CustomMark`, which is as it was.
2. **DOM: `hideReadout`, `placeReadout` and `readoutOf` are exported from `packages/dom`.** A layout that stands in for the element's keyboard needs the view's one readout, as the grid does, and a custom mark's painter is outside the package.
3. **`geo`'s test** of the registry now reads the first two registered names, since another package registers after it.
4. **The invalid sample `unknown preset`** uses `no-such-preset`.

**Choices where the plan was silent, and departures**

1. **The part holds its shape,** 1.6 wide to 1 tall, up to 480 px across, as a map does. Squares are made for one shape of box, and a scene has no size. In a box the height leads and the width follows.
2. **Order is the engine's and squarify does not sort.** A ranked dimension arrives largest first, which is what the method wants. One in an order of its own keeps it and has longer boxes.
3. **A child's box is set in its parent's box, not in the part.** Its `x`, `y`, `w` and `h` run 0 to 1 within the parent, under the parent's name. This departs from "coordinates run 0 to 1 within the part". The reason is the name: it takes a line of pixels at the top of the parent, and a ratio of the part could not leave room for it.
4. **A parent's name has a line of its own at the top of its box,** 16 px, or three tenths of a short box. That is how a parent is readable where its children are named. Where the name does not fit that line, it is hidden, and its children's names with it: a child is never named without its parent. So the children of one parent are a little smaller against another parent's than their values say. Within a parent they are exact.
5. **With a `limit` the boxes stop short and the rest is unpainted,** as a band stops short of its end. Parents past the limit leave the end of the whole box empty. Children past it leave the end of their parent's box in the parent's tint. No "rest" box, name or node.
6. **Two dimensions with no `totalsBy` is an error that names the fix,** as a normalized stack's is. So is a row whose parent has no total. A parent is never sized by a sum of its rows.
7. **A value that is null, zero or below zero has no box.** A metric that can fall below zero has no treemap. With no total, or a total of zero, there are no boxes at all, as a band has no segments.
8. **Where the rows hold more than the engine's total, the boxes are fitted to what they hold,** so none leaves the part. The fixture's rows are a few over by rounding. This is the one place a sum of rows is taken, and it is geometry: no value said anywhere is made of it. **To confirm.**
9. **The limit of six counts the boxes drawn in a series colour,** and a metric on `color` lifts it.
10. **Names on a series colour are painted `background`,** a paint token that maps to `color-background` by name. Every series colour is made to stand out from the ground, in both themes. On the ramp a step may be near either end, so names there are `ink` with a halo. The halo is heavy, and on frosted glass the ground's colour is faint. **To look at again**, with a token for text on a mark if one is wanted.
11. **No node has a `row`.** The element's keyboard takes any `data-row` as a row of the result, and a box is not one for one. So the painter has its own, as the grid has. A child carries `pair`.
12. **Labels are ranked by area in the scene, and nothing reads the rank.** A name is inside its own box, so two cannot collide. What decides is fit: the measured pass reads each name against its box, and `place()` works a width out from the name's length at 6 px a character.
13. **The keyboard is a proposal.** Left and right among parents, down into a parent, left and right among its children, up and out. Steps follow the engine's order, not where a box lies. To assistive technology it is a tree of two levels. Version 4 has no model for this.
14. **The table is long,** a row a page under a row for its section's total, in place of the pivot. A pivot of a hierarchy is a column a page and nearly all of it empty.
15. **The readout says the value and not the share.** A parent's is the engine's total for it.
16. **`treemap` is two levels.** A preset's slots are filled or refused whole, so one level is the layer written out. A second preset for it was not added.
17. **The fallback with two dimensions is `pair-list`,** a new preset: a row for each pair, with both names. `bar-list` throws (the second dimension is undrawn), `stacked-bar` throws at more than six children, and `heatmap` draws a grid that is nearly all empty for a hierarchy. With one dimension it is `bar-list`, as planned.
18. **Prose needed nothing.** With two dimensions it is the sentence core already has: "Marketing is the largest section at 42% of page views, and / the largest page at 21%." With one it is the ranked sentence, and not a share: core says the share sentence only for a normalized stack or an `arc`, and a custom mark has no way to ask for it. Recorded, not widened.
19. **`resolve()` reports nothing for a name that is not set.** A custom mark cannot add to `dropped`.

**Not done**

- No sample of the ramp in `moreSamples`: it is a state on the marks page and a spec in the tests.
- `unmapped` and the goals page are as they were.
- `CLAUDE.md`'s line for the fixtures still names only `geo`.
- Nothing from the plan's other steps.

### Step 5, cell and the diverging ramp (built October 12)

Merged. All four parts of the step are built, the `dot` in a grid among them. 988 tests pass and the typecheck is clean. Every golden scene that existed is byte-identical but the three of `stripes`, which were recorded wrong on purpose; nine are new. Looked at in headless Chromium on the bench, light and dark: the tokens page, the four samples at the bench's five widths, the marks page, the keyboard, the pointer, the table and the three data states.

Samples added to `moreSamples`: `correlogram`, `circles`, `bins2d`. `stripes` was there and is now diverging. No preset was added. All are swept in `test/cell.test.ts`.

**The ramp**

1. **Nine steps: four below zero, a neutral, four above.** Paint tokens `div.1` (farthest below) to `div.9` (farthest above), with `div.5` the middle. Nine and not eleven: four steps a side are 1.46 apart, and a reader can name four.
2. **Made by Leonardo, as the first sequential ramp was,** each arm at its own ratios against the page: 3.2, 4.7, 6.85 and 10. The middle is `neutral.600`, at 2.2, which was in the system. The sequential ramp has since been remade by hand (`config/sequential.json`); this one was not.
3. **No new hue.** Below is steel: the `steel` constant and the steel ramp's light key. Above is orange: the `orange` constant alone. Each has fewer keys than the qualitative ramp of its hue. Steel's indigo key made the deepest step a brighter blue than the three before it. Orange's other two keys turn it crimson as it deepens, and a red arm reads as bad.
4. **Below and above, not bad and good.** Blue and orange, never red and green. Polarity paints deltas, and no step of this ramp is a delta's colour.
5. **Names.** Base `color.div-below.100` to `400` and `color.div-above.100` to `400`, where 100 is the step nearest the middle. Common `color.div-1` to `div-9`. Charts `color.div-1` to `div-9`, so `--ua-charts-color-div-1` to `-9`, through `paintVar` with no table entry. `NAMED` in `packages/dom/src/tokens.ts` has `div-\d+`.
6. **Measured, by the measure the sequential entry used** (WCAG contrast between neighbours):

   | | Light | Dark |
   |---|---|---|
   | `div.1` to `div.9` | `#293e58 #36567d #4470a4 #568bce #aba79c #e46114 #b54f15 #894018 #5f3017` | `#8ebcfb #649be3 #4d7ebb #3d6491 #4d4941 #a04817 #cf5814 #fb6d1b #ffa464` |
   | Neighbours | 1.45 to 1.47 | 1.44 to 1.47 |
   | Zero against no value | 1.89 | 1.62 |
   | A step against its opposite | 1.00 to 1.01 | 1.00 to 1.01 |

   `test/tokens-generate.test.ts` holds the first row to more than 1.4, the second to more than 1.6 and the third to under 1.02.
7. **No value is `seq.none`, reused.** It is the quietest neutral on both ramps, nearer the page than zero is. There is no `div.none`.
8. **`div.*` and `seq.*` are not an author's to name.** They are the scale's. The reference says so in section 6.

**The scale**

9. **One place, `seqScale`.** Where the least and the most of the values, or the catalog's `domain`, cross zero, it is diverging. A grid and `geo` both get it, the tile maps with `geo`. No spec field, no layer field.
10. **The ramp guide says the scale's ends, not the data's.** A diverging scale runs as far below zero as above, so `stripes`, from -18 to 20, reads "-20", "0", "20". The least value is not said. A departure from "the low, zero and high values" if that meant the data's.
11. **Zero is said beside its own swatch,** the neutral one, which stands 5 px clear of the arm before it: the idiom of "No data". The diverging ramp is 8 px wider than the sequential one at the same labels, and fits where that did.
12. **The middle step is a ninth of the scale.** In `stripes` a day within 2.2 of no change is neutral, whichever way it went. A scale with an even number of steps would have no neutral.
13. **Values all below zero are sequential,** as before: the scale runs from the least to the most, and the most is the one nearest zero. Not looked at.

**Never colour alone**

14. **A cell says its sign.** The readout and the accessible name are the catalog's format: "Conversion rate, Traffic: Correlation -0.42". A value above zero has no plus.
15. **The two arms do not survive greyscale.** A step and its opposite are the same lightness, to 1.01, by construction. How far from zero survives; which side does not. The sequential ramp survives whole. No hatch or outline was built. The table and the readout are what a reader without colour has. **To decide:** a pattern on one arm, in the painter.

**Two number dimensions**

16. **`matrix` drew it, upside down.** Bins were in number order on both axes, with the least at the top, as a table reads. A binned dimension on y beside another on x now reads from the foot. One alone, a column, still reads down: it is a list, and Spacefast's scroll buckets are one.
17. **Two bins are said by name.** "Page weight 1.5–2, Load time 0.5–1: Page views 189" in the readout, and so in the prose. Two bare ranges did not say which was which.
18. **The grid's table could not find a bin's total,** and named a bin by its start. It compared a number with a string. Fixed: it names a bin by both ends, and lists a quantity from its least.
19. **A pair nothing fell in is a count of none,** a step of the ramp. In light the lowest step is the chartreuse end, so an empty corner of the grid is the loudest thing in it. That is the sequential ramp's, and it was recorded that nobody had looked at it. **To look at.**
20. **Ticks along a binned foot thin unevenly:** 0, 1, 1.5, 2 at 346 px. The measured pass drops what would meet, by rank, and knows nothing of even steps.

**`dot` in a grid**

21. **One `cell` layer, one `dot` layer, or both** on the same x and y. The dot needs a metric on `size`. Alone it may have a metric on `color`, on the grid's one colour scale. Over a cell it may not: one scale to a grid.
22. **Size is by how far the value is from zero.** `sizeStep` of the magnitude, against the farther end of the domain. A plot's dot clamps a negative to the least step, and was left alone.
23. **A dot is a plot's dot, and no wider than its cell.** Where cells are smaller than 24 px each step is its share of one. The key to sizes is then larger than the dots it explains.
24. **A pair with no value has the least dot, in `seq.none`,** so the pair can still be reached and read.
25. **A dot over a cell takes `series.1`, or the paint the layer states.** `ink` on the deep end of the sequential ramp cannot be seen in light. No paint is right on every step.
26. **The key to sizes rounded a count's steps,** so a correlation's read 0, 0, 1, 1. Where the most is under 16 they are said as they are: 0.1, 0.3, 0.6, 1. The second is 0.25, written to one decimal. There is still no unit for a plain number (step 0, finding 6).
27. **The two keys go together,** by the ramp's rule, and are 52 px. In a box 160 px tall they leave the grid 85. A rule of its own for the key to sizes was not built.
28. **In `<ua-view>` a pair is one element** whichever marks it has, so the keyboard and the pointer are unchanged.

**Prose**

29. **Signed cells:** "Correlation runs from -0.56 (Conversion rate and Churn) to 0.81 (Traffic and Ad spend) in the last 28 days." No busiest, no share. A value set against itself is passed over where there is any other pair.
30. **A note under the number said "Top: Conversion rate"** where the engine had no figure for any factor. It now says nothing.
31. **A strip's sentence is the query's own:** "Net subscribers: 180 in the last 28 days." It does not say the days were signed.

**Found on the way**

- **One row of cells had no ramp in `<ua-view>`,** and was 52 px tall, where the pixel painter drew it 184 tall with one. Both now stand it 34 px tall with its labels and its ramp under it. Step 0 opened no browser.
- **The step's test of `stripes` is in `test/cell.test.ts`,** not `test/uncommon.test.ts`.
- **A correlation's table has a row and a column of totals, all dashes.**
- **The number of a correlogram is a dash** (step 0, finding 5).

**Not done**

- A preset `correlogram`. The circles are written as layers.
- A clustermap. Its grid is `heatmap` in the engine's order, and nothing more is needed of the grammar; the ordering by cluster is the engine's, and its trees are a mark this plan does not have.
- A signed sample on a map. The scale is held by a test with made values; no fixture has a signed metric by country.
- `dot` in a strip, one row or one column.
- In the browser: Chromium only. Not checked: a page that reads from the right, the `dots` painter on screen, a touch pointer, a screen reader, forced colours, and dots over cells in dark.

### Step 3, lines and areas (built October 12)

Built on a branch of its own, from `e09de06`. Merged. 1,021 tests pass (969 before) and the typecheck is clean. `prototype/`, the parity tests and the six samples' golden scenes are untouched. Four golden scenes that existed changed, on purpose, and twelve are new; they are listed below. Looked at on the bench in headless Chromium.

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

### Step 4, rows, bars, ticks and rules (built October 12)

Merged. Built on a branch from `e09de06`. 1,045 tests pass (969 before) and the typecheck is clean. `prototype/` and the parity tests are untouched. **Every golden scene that existed is the same to the byte but three, on purpose:** the `bullet` sample's, which now has its bands (part 7). 21 golden scenes are new, in a snapshot file of their own. Looked at on the bench in headless Chromium: the seven new samples and `bullet` at 346, 250, 170, 120 and 80 px, light and dark, resized in place from 700 px down to 90 and back, under height limits of 100 and 60 px, empty, as a table, with real key events and the pointer. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a page that reads from the right, the `dots` painter on screen, a data change in place, the no-prior state in a browser (no new sample compares), and the marks page beyond that it paints with no error.

**Whole:** parts 1 to 6, 8, 9, 10 and 12. **Partial:** part 7 (the bullet's bands are drawn, the gauge's are not, as asked) and part 11 (Chromium only).

**What was added**

- **A row divided by a second dimension** (part 1). A `bar` with `stack` in rows takes the query's other dimension on `color`. `rowSplitOf` and `listRows` in `scene.ts`, exported from core: the dimension a list is divided by, and the rows it has. `Scene.series` in rows, a `series` on each part of a bar, keys `primary:bar:<row>:<series>`. Parts `legend` and `legend-top` in rows, and `Guides.legend` there. Two fit rules, `rows/legend` and `rows/legend-top`. `legendBlock` in `place.ts`.
- **`stack: "diverge"`** (part 2), in the type, the schema, a row's track and a plot. The stacking code is one function, `stacked`, which both layouts call.
- **`detail` in rows** (part 3): `'rows'` joins `DETAIL_LAYOUTS`. A `dot` or a `tick` has a mark to each pair, keys `primary:dot:<row>:<detail>`, `Scene.detail` in rows. `pointDimOf` in `scene.ts`: the dimension a plot of points has a point for.
- **`size` on a `bar`** (part 4): the column's width. The plot's `scale` is then `linear`.
- **The rug and `align`** (part 5): `align` is `'start' | 'end'`.
- **`rule`** (part 6): a number as the start of a ranged rule, on either axis, and all four channels for a line across a plot of points.
- **The range behind a row's marks** (part 7): a `bar` in rows with nothing on `x`. Paints `band.1` to `band.3`, tokens `--ua-charts-color-band-1` to `-3`, aliases of three neutral steps (600, 500, 400) that need no dark values, since that ramp flips with the theme.
- **Presets** (part 8): `lollipop`, `pyramid`, `strip`, `marimekko`, `ohlc`. Working names, all five. `bullet` gained a layer.
- **The fixture** (part 9). Dimensions `age`, `sex`, `question`, `answer`, `quantile`. Metrics `responses`, `load_normal`, `load_quantile`. A day holds its `responses`, about one visitor in eight, drawn from no seed, so no figure there was moved. `ORDERED` names the dimensions that keep an order of their own, alone and as the outer one of a pair. `TILT` gives one dimension's mix under each value of another: sex by age, answer by statement. A table `quantile`, with no totals.
- **Samples:** `pyramid`, `likert`, `strip`, `marimekko`, `rug`, `ohlc`, `qq`. `lollipop` is written with its preset. They are swept, and have their golden scenes, in `test/uncommon-rows.test.ts`; `test/dom-uncommon-rows.test.ts` holds what the element does that is strings and plain functions.
- **The bench:** the main page has a row of frames for each sample, as for every sample. The marks page has them as states of `bar`, `bar in rows`, `rule`, `dot` and `tick`.

**Choices where the plan was silent, and departures**

1. **A divided row's track stands beside its label,** as a ranged bar's does, and its parts are drawn whole. Behind a label a bar is a tint at a fifth of its paint, and three tints in a row cannot be told apart.
2. **The rows of a divided list are in the order the result first has them, and the series in the order of `totalsBy`.** A plot does the same. So a list of channels by device is ranked, and an age pyramid is in age order only because the engine sends ages in order. The fixture does (`ORDERED`). This is finding 4 of step 0 again.
3. **A divided list needs `totalsBy` for its rows' dimension, and says so.** A row's value column, and the whole a share is of, are read from it. With none the error names the fix. It could have drawn the bars and left the values out; it does not.
4. **The legend steps down by two rules, both of the view.** Under 170 px wide or 150 px tall it is the one line; under 84 px tall it is nothing. The one line names the series with the most, by the engine's totals, and is painted in that series' colour, since a line of text has no swatch. With two series that keys both. With five it keys one.
5. **The one line of the legend is a fact about the totals, not about the rows on show.** Under a height limit the rows are trimmed and it still says "Agree 33%", which is of all five statements.
6. **The axis of a diverging stack says magnitudes:** `3k, 2k, 1k, 0, 1k, 2k`. The tick keys keep the sign (`ytick:-2000`), so they stay unique. A row's track has no axis, so there the question does not arise, and no line is drawn at zero: the two colours meet there.
7. **A value below zero in a diverging stack is refused,** with the fix. Which side a series is on is its place among them.
8. **`"center"` was not touched.** Its signed axis (step 0, finding 9) is still there.
9. **No `likert` preset.** It would be `pyramid`'s two layers under another name. The `likert` sample uses `pyramid`. **To decide:** whether the name `pyramid` is right for a preset that is also the Likert chart; `diverging-bar` says what it is.
10. **A Likert chart is painted in five series colours.** They are categorical, and the answers are an ordered scale from one end to the other: a diverging ramp is the honest paint. Step 5 makes one for cells. Nothing here uses it.
11. **A dot by `detail` is drawn at 0.5, as step 1 chose for lines.** A tick by `detail` too, and a stroke of a rug. Looked at in both themes: fifteen dots to a row read as a cluster with its outliers plain.
12. **By `detail` in rows only a `dot` and a `tick` are drawn.** A `bar` or a `rule` there would lie one over another in one paint, and is refused with the fix. Step 1 let a plot's bars sit side by side by `detail`; a row has no side by side.
13. **In a plot of points, a `dot` with one dimension on `color` and the other on `detail` worked as step 1 left it,** where the query names the points' own dimension first. Named the other way round the rows were keyed by the colour's dimension. `pointDimOf` settles it: the dimension on `detail` is the points' own, whichever way the query names the two.
14. **The points sentence now wins over the two-dimension sentence,** as step 0's finding 3 asked. This also changes the prose of a coloured scatter that names each point with a `text` layer: it was the two-dimension sentence and is now the points one. `tldrProse` takes the points' dimension where it took `true`.
15. **A coloured point is read out as a row:** its name, what it is coloured by, and its two values. It was going to be read as a point of a split plot, with its one series in brackets.
16. **A Marimekko's x is `linear` in the scene,** because every column has a place and a width of its own, which is what `linear` means to a painter. No band scale could say it.
17. **Its labels are ranked by their column's width,** the widest unranked. `place()` leaves out the ones that would meet a wider column's, by character width. The `mid-tick` rule, which gives up a middle date under 380 px, is not theirs: in the DOM such a label carries its rank as `data-order`, not `data-rank`, so that rule's selector passes it by, and the measured pass thins it as it thins any label.
18. **`size` on a `bar` is refused anywhere but a plot of shares** (a dimension on x, the other on `color`, `stack: "normalize"`), and where the engine gives no total of the metric. The width is the x's total over the engine's total, so with a `limit` the columns stop short of the plot's end, as a band does.
19. **A rug's tick must be at the plot's own x metric,** or it is refused. Its strokes are a twentieth of the plot's height. A rug along y was not asked for and is not built: a `tick` with a metric on y is still refused there.
20. **`align` on a tick in a row's track** is the upper or the lower half of the row: the start is the top, where a page begins.
21. **In `ohlc` every layer is `primary`,** the stroke included, where `candlestick`'s wick is `context`. An OHLC chart with its strokes given up is two ticks a day.
22. **A rule between two numbers on one axis is still refused** (`y: 0, y2: 500` with a dimension on x): every row's would be the one stroke. **A `bar` still starts at a field.** Step 0's finding 1 wanted a bar from a number; paint by direction is step 3's, and a bar from zero to a gain cannot be painted right until that lands.
23. **The line across a plot is a `path` of two points, not a `line` node.** A painter's line is level or upright, in `place()` and in the DOM, and a path is drawn by both already. So no painter changed for it.
24. **With a field at any end, a rule across a plot is a line for each row,** in the layer's paint and solid: an arrow from then to now. With four numbers it is one line, dashed, in the `rule` paint, as a reference at one number is. A field is a row's value everywhere else in the grammar, and there is no other reading that keeps that.
25. **A line across a plot takes no `label`,** and says so. There is no anchor for one that both painters can set.
26. **The bands are a layer, not a rule.** A `bar` in rows with nothing on `x` is the metric's range, as an `arc` with nothing on `angle` is a gauge's. Nothing draws bands unasked. The metric is the one the row's other marks put on the track.
27. **The bands are `guide` nodes with `role: "context"`.** They are read against, as a grid is, and a painter tells them from a bar by that: as tall as the row, no least width, no rounded corner.
28. **A metric with no `domain` has no range drawn, and no error,** as one with no `target` has no tick. More than two `bands` is an error: there are three paints.
29. **`band.1` is the least part of the range, whatever the metric's polarity.** A bullet graph's darkest band is by convention the worst, which for a metric where less is better is the far end. Not built.
30. **A departure: `bullet`'s golden scenes changed.** The preset gained the range layer, so the three scenes hold nine more rectangles each, and the track now runs to the top of the domain (500) where it ran to the target (400), so every bar and tick moved. Leaving `bullet` as it was would have left it not a bullet graph.
31. **The keyboard in a divided list:** up and down from row to row, right and left through the series of the chosen row, on from the whole row and back to it, the other way on a page that reads from the right. Up and down keep the series. Only the series a row has are stepped through. The chosen part is drawn whole and the rest of its row stand back, and its name is underlined in the legend.
32. **The strip plot's query is channel by country,** not pages by section as the plan's "done when" has it. The fixture has no section, and its two-dimension engine crosses every value of one with every value of the other.

**Findings**

1. **A registered ratio is nothing when unset, not its fallback.** The ratios a painter writes (`--uav-t`, `--uav-x`) are registered so that they can move. `var(--uav-t2, 1)` on an element that never set it gave 0, and the bullet's tick was no height at all. Seen in the browser and nowhere else. A tick's two ends are now always stated.
2. **A label under a narrow last column runs past the plot's edge.** A Marimekko's `Other`, at 700 px. It meets no other label, so nothing thins it. Not fixed.
3. **A divided row's value column is its total, and a pyramid has no room to say its two sides.** The readout says both. The preset has no value column.
4. **A row's track has no axis, so a pyramid is read by length alone,** and one of shares cannot be said (`stack` holds one value). On an axis the same layers draw a butterfly with a true axis.
5. **Under a height limit a legend sits at the foot of the box,** and what the whole rows leave over is between it and them: up to a row's height of nothing.
6. **Views of things with no total fall to a dash** (step 0, finding 5): the rug and the Q-Q plot, below 280 px.
7. **The unit `s` writes 0.76 as "760ms" and 4.04 as "4s",** so the Q-Q sentence says a range of "760ms to 4s". The formatter's, and not touched.
8. **A rule from a number to a plain metric is drawn on the first y scale,** whatever the metric's unit, because `unitOf` reads `y` alone. Not changed: how a field gets a unit is step 3's.
9. **`hitNodes` took the middle of a row's marks as its place.** Half a tick is to one side, so an OHLC day's target stood off its stroke; it now gives way to a mark at the middle. And columns of unequal width now meet at their edges, not half way between their middles.
10. **Rows of text, cut short** (step 0, finding 10, which this step was to look at): not looked at.

**Existing assertions changed, each on purpose**

- `test/uncommon.test.ts`: three of step 0's "for step N" facts are brought up to date (a stem written from a number; the coloured scatter; the bullet's bands), and the lollipop's layers are read from its expansion.
- `test/coverage.test.ts`: a `bar` in rows with `detail` is refused by a new message, and the old message is held by a grid. The samples of this step are left to their own sweep.
- `test/ranges.test.ts`: the bullet's preset has five layers; its tick and bar are measured against the domain; its bands are drawn. Three golden scenes.
- `test/core.test.ts`: the two strings that list the presets.
- `test/fit.test.ts`: `gaveUp` knows the rule `legend-top`.

**Not done**

- The gauge's bands (step 2 has the radial layout).
- A rug along y. A label on a line across a plot. A bar from a number.
- A zero line in a diverging row. A diverging ramp for ordered series.
- Bands that follow the metric's polarity.
- `CLAUDE.md` was left for its owner.

**The counts section 8 asks for:** layer fields that are neither data nor role, still one. Presets that need `detail`: one of the five, `strip`. Presets that need a custom mark: none of the five.

**At the merge:**

Merged after steps 2, 3, 5, 6, 8 and 9, none of which this step had seen. 1,323 tests pass in 50 files and the typecheck is clean. The step's worktree held nothing its branch did not: no work was lost with its author's session.

*What the merge changed*

- **The two decisions are 37 and 38** in section 19 of the reference. They were written as 32 and 33, which steps 6 and 5 hold.
- **`tldrProse` takes the points' dimension and, apart from it, whether a line joins them.** This step made its fifth argument the dimension's name, and step 3 made it `"path"`. It is the name, and `path` is a sixth.
- **A centred stack has no value axis** (step 3). This step's test of `"center"` held its ticks from -4k to 4k. It now holds that the stack is about the middle of the plot and has no ticks.
- **Four golden scenes of this step changed, and no other.** `rug` at 234 px and at 346 by 100, and `qq` at 234 px and at 346 by 100: the line under the number was "Top: pricing" and "Top: 5%", the first row, and is "Top: getting started" and "Top: 95%", the row with the most, because step 2 made that line compare the rows. Neither says anything worth reading: a component and a quantile have no top. It is finding 6 again.
- **The fixture has two lists of dimensions in their own order.** `OWN_ORDER` (step 2: weekday, hour) holds alone; `ORDERED` (this step: age, sex, question, answer) holds alone and as the outer one of a pair. They were not made one, so that no pair a test held was reordered.
- **A unit in a list reads its glyphs from the list's rows,** which this step made the engine's totals where a layer divides them. A divided bar and a unit in one list draw. No test holds it.
- **`divided` in `resolve()` was two things,** a unit's grid (step 6) and a divided list (this step). The second is `dividedRows`.
- No sample or fixture name collided. The band paints stand after the diverging ramp's in both token files, and `generated/` was written by the generator.

*What the merge added*

- **A `bar` may start at a number, as a `rule` may** (choice 22 above, and step 3's finding 18). `x: 0, x2: "metric@high"` is the same bar as the one written the other way, and by `paint: "direction"` it runs from the number to the value, so a bar from zero to a gain is a gain. It is one clause in `checkLayers` and the polarity read from whichever end is a field. A bar between two numbers is still refused, and so is an `area` from a number.
- **The `tornado` sample is written that way,** with `paint: "direction"` on both bars and no paint token stated. The loss is to the left in `delta.bad` and the gain to the right in `delta.good`, as before, and each bar's `v0` is now zero's place. Its two facts in `test/uncommon.test.ts` are up to date: the sample asks for direction from zero, and the same bars written from the field to zero are still painted the other way round, since the way a bar is written is the way it goes.
- **A rule or a bar from a number measures in what its second end does** (finding 8 above). `unitOf` read `y` alone, so such a mark was drawn on the first scale whatever its metric's unit.
- **Pages by section is a strip plot from the preset** (choice 32 above). The fixture has sections now, with their pages inside them, and the preset draws a dot for each section's own pages. A test holds it. The `strip` sample is still channel by country, so its golden scenes did not move.

*What the entry says that the code does not*

- `rowSplitOf` and `listRows` are exported from `scene.ts`, not from core's `index.ts`. Nothing outside core reads them, so they were left.
- Part 7 is called partial for the gauge's bands. The step's brief asked for a row's alone, so by the brief it is whole.

*In the browser, at the merge*

Headless Chromium on the bench, for `pyramid`, `likert`, `strip`, `marimekko`, `rug`, `ohlc`, `qq`, `lollipop`, `bullet` and `tornado`: at 346, 250, 170, 120 and 80 px, light and dark, typical, no prior and empty, under height limits of 100 and 60 px, resized in place from 346 out to 700, down to 90 and back, with key events, the pointer and the table. No console or page error. A view resized in place is the same to the pixel as one painted at that width, at 250, 170 and 120 px, and the same again back at 346. All 78 samples of the main page paint at 346 and 250 px in both themes, and the marks and tokens pages load.

- The pyramid, the Likert chart, the strip plot, the lollipop, the bullet and the tornado read at 346, 250 and 170 px, and are the number below that.
- **The Marimekko, the OHLC chart, the rug and the Q-Q plot are charts at 346 px alone.** At 250 and 170 px the first two are the number beside a plot too small to read, and the last two a dash over "Top: getting started" and "Top: 95%".
- A Likert chart's five colours say five things and not a scale from one end to the other (choice 10). Nothing marks zero in a pyramid or a Likert row (finding 4).
- Under a height limit of 100 px a pyramid is two rows, a gap of a row, and "Female 53%" (finding 5).
- At 700 px the Marimekko's last label runs past the plot's edge (finding 2).
- In a divided list, up and down step the rows, and right and left the series of the chosen row and back to the whole of it; the chosen part is whole, the rest of its row stand back, and its name is underlined in the legend. The readout says the row with its parts, and then the one part. A strip plot's row says "15 countries, the most United States 889".
- The tornado's table and readout say `low` and `high` with a number on the bar's first end.

Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a page that reads from the right, the `dots` painter, a data change in place, the marks page beyond that it paints with no error, and whether the marks and tokens pages take a theme from the URL.

*Still not done*

The gauge's bands. A rug along y. A label on a line across a plot. An area from a number. A zero line in a diverging row. A diverging ramp for ordered series. Bands that follow the metric's polarity. Rows of text cut short (step 0, finding 10). A `likert` preset, or another name for `pyramid` (choice 9). `CLAUDE.md`, which names neither this step's layers nor `test/uncommon-rows.test.ts`.

## 8. What to count as it is built

- **Custom marks.** There is one, `geo`. The plan adds two. Each is a hole in the grammar.
- **Layer fields that are neither data nor role.** One, `sweep`. The claim is that it stays one.
- **Presets that need `detail`.** If most new presets do, `detail` is doing `color`'s work and the legend rule is wrong.
- **Claims of step 0 that fail.** The first reading said 16 types work today. Every miss is a measure of how far the docs are from the code.
