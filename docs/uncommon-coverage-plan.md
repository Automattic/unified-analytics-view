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

Empty. Step 0 writes here first.

### Step 7, a registry for presets (built October 12)

Not merged yet. 816 tests pass, nine of them new, and the typecheck is clean. Every golden scene is the same to the byte, the six of `map`, `symbols` and `unmapped` among them: the snapshot files are untouched. The parity tests are untouched. Not looked at on the bench or in a browser: nothing a painter reads changed.

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

### Step 8, link (built October 12)

Not merged yet. 836 tests pass, twenty of them new, and the typecheck is clean. Every golden scene that existed is the same to the byte: three are new, in a file of their own. The parity tests are untouched. Sample added: `sankey`. Checked on the bench in headless Chromium: the Sankey at 346 px, the grid at 250 px from the same spec, a resize in place with no script, keyboard, hover, the table, both themes, the three data states and a box of 160 and of 100 px.

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

## 8. What to count as it is built

- **Custom marks.** There is one, `geo`. The plan adds two. Each is a hole in the grammar.
- **Layer fields that are neither data nor role.** One, `sweep`. The claim is that it stays one.
- **Presets that need `detail`.** If most new presets do, `detail` is doing `color`'s work and the legend rule is wrong.
- **Claims of step 0 that fail.** The first reading said 16 types work today. Every miss is a measure of how far the docs are from the code.
