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

### Step 9, partition (built October 12)

Built on a branch of its own, not merged. 882 tests pass (836 before) and the typecheck is clean. Every golden scene that existed is the same to the byte: the snapshot files are untouched, and `test/__snapshots__/partition.test.ts.snap` is new, with eight scenes. The parity tests are untouched. Checked in headless Chromium on the bench: both samples at 346, 250, 170, 120 and 80 px, in a box 160 px tall, light and dark, `typical`, `no-prior` and `empty`, a frame resized in place from 250 to 700 px and back, real key events, the pointer, a click, the table, and on the marks page the six surfaces, the ramp and a `limit`. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, a page that reads from the right, the dot-grid painter, and a data change while a box is chosen.

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

## 8. What to count as it is built

- **Custom marks.** There is one, `geo`. The plan adds two. Each is a hole in the grammar.
- **Layer fields that are neither data nor role.** One, `sweep`. The claim is that it stays one.
- **Presets that need `detail`.** If most new presets do, `detail` is doing `color`'s work and the legend rule is wrong.
- **Claims of step 0 that fail.** The first reading said 16 types work today. Every miss is a measure of how far the docs are from the code.
