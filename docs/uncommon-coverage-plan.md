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

### Step 6, unit (built October 12)

Built on a branch of its own, not merged. 937 tests pass (836 before) and the typecheck is clean. `prototype/` and every golden scene that existed are unchanged: no line of an existing snapshot file moved, and `test/__snapshots__/unit.test.ts.snap` is new. All five forms are whole: each has its types and schema, a scene and `place()`, fit rules down to the number and the prose, a sentence, a layout module with keys and the table, a sample with golden scenes and a place in a sweep, and frames on the bench. Checked in headless Chromium on the bench: the six samples at 346, 250, 170, 120 and 80 px, widened to 600 px and resized in place across 280 px both ways, in a box 160 px tall, light and dark, the three data states, 28 and 7 days, real key events, the pointer, the table, and the marks page. Every glyph was measured where it was laid out and is as wide as it is tall. Not checked: WebKit, Firefox, a screen reader, touch, reduced motion, right to left, print, forced colours, the dot-grid painter, a data change that moves glyphs, and a spec that keeps its marks at a narrow width.

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

## 8. What to count as it is built

- **Custom marks.** There is one, `geo`. The plan adds two. Each is a hole in the grammar.
- **Layer fields that are neither data nor role.** One, `sweep`. The claim is that it stays one.
- **Presets that need `detail`.** If most new presets do, `detail` is doing `color`'s work and the legend rule is wrong.
- **Claims of step 0 that fail.** The first reading said 16 types work today. Every miss is a measure of how far the docs are from the code.
