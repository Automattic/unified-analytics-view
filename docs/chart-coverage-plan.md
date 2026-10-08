# Chart coverage: inventory and plan

As of October 7, 2026. **Status: Proposed. Nothing here is built. The calls it stood on were decided on October 7 and are recorded in section 6, with what is still open.**

A catalog of 220 chart types (40 Common, 84 Uncommon, 38 Rare, 58 Specialist) was read against the grammar as it stands in `packages/core`. This note records what the grammar can draw today, what it would take to draw every Common type, and the order to build that in.

How common a type is, is the catalog's judgement. Which step a chart falls under is this note's.

## 1. The finding

- **The mark vocabulary scales.** No Common chart needs a mark beyond the four the reference already proposes: `dot`, `tick`, `cell` and `arc`.
- **The shape around the marks does not, yet.** 4 of the 40 Common charts can be drawn today. Nearly every other one stops at `detectLayout` in `packages/core/src/plan.ts`, at a `throw` in `packages/core/src/scene.ts`, or at `maxItems: 1` on `query.by` in the schema.
- **With the additions in section 3, 29 of the 40 are plain presets.** 2 of those, Gantt and timeline, are deferred until the query contract can carry records. 2 more need a registered custom mark (`geo`). 9 are diagrams or continuous fields, not charts of rows, and stay out.
- **The health check in section 9 of the reference holds.** None of the 29 needs a pin or a custom mark to exist.

What the grammar cannot do today, read from the code:

| Limit | Where |
|---|---|
| One dimension per query | `view.schema.json`, `query.by.maxItems` |
| A layout needs a dimension on x, y or color, so a metric cannot sit on both axes | `detectLayout` |
| `color` splits only the band. Every cartesian layer paints `series.1` unless it overrides | `sceneCartesian` |
| The y domain is `[0, max]` and a bar rises from the bottom: no negatives, no floating bars | `sceneCartesian`, `RectNode.v` |
| `stack` is `normalize` only, and only on the band | `sceneBand` |
| `rule` takes a constant y only | `sceneCartesian` |
| `text` draws only in rows | `sceneCartesian` throws |
| The band reads its first layer and ignores the rest | `sceneBand(p.layers[0])` |
| Paint is `series.(i % 6)` by row order, so the seventh series repeats the first and a value changes colour between views | `sceneBand` |
| Every part stretches freely; nothing can hold an aspect ratio | the ratio scene |

One fault found on the way: `sceneBand` and the share note in `sceneNumber` divide by the sum of the rows received. With a `limit`, shares add to 100% of the top N, not of the total. The note is part of the tldr value, so this is the row-summing the rules forbid. It is fixed in step 1, before `stack: "normalize"` spreads to an axis.

## 2. The 40 Common charts

Steps are those of section 5. Layer sketches leave out roles and the comparison layer.

| Chart | Step | As layers |
|---|---|---|
| Bar chart | today | `bar` x: dimension, y: metric |
| Line chart | today (one series); 1 (several) | `line`, with `color` for series |
| Area chart | today | `area` |
| Ordered bar | today | `bar-list`; the order is the query's |
| Grouped bar | 1 | `bar` with `color`, no `stack` |
| Stacked bar | 1 | `bar` with `color`, `stack: "zero"` or `"normalize"` |
| Stacked area | 1 | `area` with `color`, `stack: "zero"` |
| Diverging bar | 1 | `bar` on a signed scale; `stack: "center"` for the Likert form |
| Table with in-cell bars | 2 | rows: a `bar` and a `text` per metric column |
| League table with movement | 2 | rows: `text` columns and a delta per row |
| Funnel chart | 2 | rows in stage order, `bar` plus a rate column from the engine |
| Waterfall chart | 3 | `bar` y, y2 from engine running totals |
| Gantt chart | 3 | rows on a time x: `bar` x, x2. Deferred: needs row-level data |
| Error bars | 3 | `rule` y, y2 over `dot` or `bar` |
| Candlestick chart | 3 | `rule` low to high, `bar` open to close |
| Box plot | 3 | `rule` min to max, `bar` p25 to p75, `tick` p50, quantiles from the engine |
| Timeline | 3, 4 | rows on a time x: `dot` and `text`. Deferred: needs row-level data |
| Scatterplot | 4 | `dot` x: metric, y: metric |
| Bubble chart | 4 | `dot` with `size` |
| Quadrant chart | 4 | `dot`, `text`, and a `rule` on each axis |
| Histogram | 4 | `bar` on a binned numeric dimension |
| Density plot | 4 | `area` on a numeric dimension, density from the engine |
| Heatmap | 5 | `cell` x: dimension, y: dimension, color: metric |
| Pie chart | 6 | `arc` angle: metric, color: dimension |
| Donut chart | 6 | `arc` with an inner radius; the number sits in the hole |
| Gauge | 6 | `arc` for the range, `arc` for the value, `tick` for the target |
| Analog instrument panel | 6, 7 | a board of gauges; no grammar of its own |
| Dual-axis chart | 1 | two layers whose metrics differ in unit get a scale each |
| Small multiples | 7 | `facet` on a dimension |
| Choropleth map | 8 | custom mark `geo`, color: metric |
| Proportional symbol map | 8 | custom mark `geo`, size: metric |
| Tree diagram, mind map, flowchart, swimlane diagram | out | node-link diagrams; the data is a graph |
| Venn diagram | out | sets |
| Geographic heat map, isopleth map | out | interpolated fields |
| Schematic transit map | out | a drawing |
| Word cloud | out | a `bar-list` says the same and can be read |

### The Uncommon tier, roughly

A quicker pass, less carefully counted. The same additions cover about 35 of the 84:

- **Steps 1 to 3:** slopegraph, bump chart, streamgraph, cumulative flow, spaghetti plot, population pyramid, butterfly, tornado, bullet graph, dumbbell, fan chart, surplus and deficit line, OHLC, Pareto, bar chart race (a `bar-list` with keyed transitions over a time param).
- **Step 4:** Cleveland dot plot, lollipop, ordered dot plot, strip plot, rug plot, connected scatterplot, embedding scatter, ECDF.
- **Step 5:** calendar heatmap, climate stripes, correlogram, adjacency matrix.
- **Step 6:** radial bar, Nightingale rose, circular bar plot, 24-hour radial chart.

The rest fall into four families that should stay custom marks, if they are built at all:

| Family | Types | Why it is outside |
|---|---|---|
| Unit charts | Waffle, unit chart, icon array, isotype, parliament, Wilkinson dot plot | One shape per counted thing, packed |
| Hierarchy | Treemap, sunburst, icicle, circle packing, dendrogram, radial tree | Needs a hierarchy on a dimension and a partition layout |
| Networks and flows | Sankey, alluvial, chord, arc diagram, node-link, flow map | The data is nodes and links |
| Maps | The nine Uncommon map types | Projection and boundary geometry |

Radar and parallel coordinates need a general polar or multi-axis system. Decision 6 of the reference rules that out, and nothing here argues for reopening it.

## 3. The inventory

### 3.1 Marks

All four are Proposed in section 7 of the reference. This note adds only their channels.

| Mark | Channels | What comes with it |
|---|---|---|
| `dot` | x, y, size, color | A point. Its radius is the painter's, in pixels, never a ratio |
| `tick` | x or y, and the band it sits in | A short stroke across its band at a value |
| `cell` | x, y, color | Both positions are discrete; the colour scale is sequential |
| `arc` | angle, radius, color | Its own layout. No general polar coordinates |

Changes to marks that exist:

- **`bar`, `rule`, `area` take a second end,** `x2` or `y2`. A bar with both ends floats; an area with both is a band.
- **`rule` reads data.** A constant on x as well as y, or fields per row.
- **`text` draws in the plot,** not only in rows.

### 3.2 Channels

`x2`, `y2`, `size`, `angle` and `radius` are new. `color` works on every layout. A layer that puts `color` on a dimension is split into one series per value.

### 3.3 Transforms

| Transform | Form | Notes |
|---|---|---|
| Stack | `stack: "zero" \| "normalize" \| "center"` on any layer with `color` | `normalize` exists, on the band only |
| Dodge | No field. A `bar` with `color` and no `stack` sits beside its neighbours | Overlapping bars are never what was meant. Lines and areas with no `stack` overlay |
| Bin, quantile, density, running total | **Not in core.** The engine returns them | Decided October 7 |

Statistics arrive as companion fields, the way `metric@previous` does today: `load_time@p25`, `revenue@lower`, `revenue@running`. `checkLayers` then validates a field against what the result returns, not only against the query.

### 3.4 Scales and layouts

**A layout stays, as an arrangement of parts.** Fit rules and painters hang on it, and that is worth keeping. What goes is the mark handling hard-coded inside each one.

- **A channel's scale comes from its field.** A time dimension gives a point scale, a categorical one a band, a numeric dimension or a metric a linear scale.
- **`cartesian` takes any pair.** Dimension by metric (today), metric by metric (scatter), dimension by dimension (heatmap).
- **`rows` becomes a track per row.** A label column, a plot track with a linear or time x, and value columns. Horizontal bars, dot plots, dumbbells, diverging bars, Gantt and the table with in-cell bars are all this one arrangement, so no transposed cartesian is needed.
- **`band` stays** as a stack with no positional dimension.
- **`radial` is new,** for `arc`.
- **Signed domains.** The linear scale includes zero and whatever is below it; the baseline is drawn at zero, not at the bottom.
- **Independent scales by unit.** Two layers whose metrics have a different catalog `unit` get a y scale and an axis each. Dual-axis then needs no spec field, and two metrics of one unit correctly share a scale.
- **A sequential colour scale that outputs tokens.** Values are quantized to the steps of a ramp, `seq.1` to `seq.n`, so a scene still carries no colour.

### 3.5 Spec, query and catalog

| Addition | Where | Notes |
|---|---|---|
| Two dimensions in `by` | Query, schema | Decided October 7: two, no more. Rows come back long: one per pair |
| `facet` | Spec | Names a dimension. No column count; the container decides |
| A third preset slot, `$split` | Presets | The second dimension |
| Dimension type `number` | Catalog | For bins and density |
| `domain`, `target` and `bands` on a metric | Catalog | Gauge and bullet read one entry |
| `sweep: "half"` on a layer | Spec | For `arc`. The one layer field that is neither data nor role |
| `series: "delta"` on a `text` layer | Spec | A delta per row, painted by polarity |
| `fallback` on a fit rule | Fit rules | Names the preset a view becomes below the rule's need |
| A colour role on a dimension's values | Catalog | So "Search" is one colour in every view. Until it lands, paint follows the domain's order, not the row's |
| Totals per split | Result | So a normalized stack divides by an engine total |

Nothing above is a size, a breakpoint or a presentation switch. The four catalog and result rows are proposals to the API's owners, as the rest of the seam is.

### 3.6 Scene

| Addition | Why |
|---|---|
| `RectNode.v0`, and `y` and `h` in ratios for a cell | Floating and signed bars; the heatmap |
| `LineNode` as a segment (`x`, `t`, `x2`, `t2`) | Vertical and ranged rules, ticks |
| `CircleNode` with `x`, `t` and a size step | Today it is only the pulse beside the number |
| `ArcNode`: `a0`, `a1` in turns, `r0`, `r1` in ratios | `arc` |
| A part that holds its aspect ratio | A pie cannot stretch |
| Parts: `legend` on cartesian, `ramp`, `radial`, `columns` | Guides for the new encodings |
| Keys that carry the series: `primary:bar:2026-09-08:Search` | Keys stay stable and unique with two dimensions |

### 3.7 What every new arrangement owes

The marks are the small part of the work. Each step is done only when all of this exists for it:

1. Types and the JSON Schema, with an error that names the fix for each new way to be wrong.
2. The scene builder, in ratios, and `place()` for pixel painters.
3. Fit rules: what is given up, in what order, down to the number and the prose.
4. A tldr prose sentence for the new query shape.
5. A module in `packages/dom/src/layouts/`, with keyboard hits and the table.
6. A sample spec and fixture, golden scenes at three sizes, and a place in the sweep.
7. A frame on the bench.

## 4. Three specs in the extended grammar

```json
{ "spec": "view/0", "use": "stacked-bar",
  "query": { "metrics": ["visitors"], "by": ["date.day", "channel"], "range": "28d" } }
```
expands to `{ "mark": "bar", "encode": { "x": "date.day", "y": "visitors", "color": "channel" }, "stack": "zero" }`.

```json
{ "spec": "view/0", "use": "box-plot",
  "query": { "metrics": ["load_time"], "by": ["page"], "limit": 8 } }
```
expands to
```json
[ { "mark": "rule", "encode": { "x": "page", "y": "load_time@min", "y2": "load_time@max" }, "role": "context" },
  { "mark": "bar",  "encode": { "x": "page", "y": "load_time@p25", "y2": "load_time@p75" } },
  { "mark": "tick", "encode": { "x": "page", "y": "load_time@p50" } } ]
```

```json
{ "spec": "view/0", "title": "Traffic against conversion",
  "query": { "metrics": ["visitors", "conversion_rate"], "by": ["page"], "limit": 40 },
  "layers": [ { "mark": "dot", "encode": { "x": "visitors", "y": "conversion_rate" } } ] }
```

Preset names here are working names. A preset is named after the `@automattic/charts` component it replaces where one exists, so check each against the package when it is written.

## 5. The plan

Eight steps. Step 1 is the foundation and everything else stands on it. After it, steps 2 to 6 are independent of each other and can be taken in any order or in parallel worktrees; 7 and 8 come last.

```
1 scales, series, stack ─┬─► 2 rows as tracks ─► 3 ranges and tick
                         ├─► 4 metric by metric, dot
                         ├─► 5 cell
                         ├─► 6 arc ──────────────┐
                         └───────────────────────┴─► 7 facet ─► 8 custom marks, geo
```

Two rules for all of it:

- **Parity is not touched.** The prototype knows the six samples only. Every refactor is held to the existing sweep and golden scenes, unchanged. New behaviour gets new samples and new golden scenes; it has no prototype to match.
- **Small commits, one concern each.** Each numbered part below is at least one commit.

### Step 1. Scales from fields, series, stacking

Size: large. Unlocks grouped bar, stacked bar, stacked area, diverging bar, several-series line, dual-axis.

1. **Refactor with no change in output.** In `scene.ts`, split `sceneCartesian` into scale derivation and one function per mark, looked up by mark name. Replace the three `if`s in `detectLayout` with a table from the field types on x, y and color to a layout. Done when the sweep, parity and golden scenes pass untouched.
2. **Shares from the engine.** `Result.totals` is the divisor in `sceneBand` and `sceneNumber`. The fixture engine returns a total that includes rows past the `limit`. This changes the channel-mix golden scene only if the fixture limits it; say so in the commit either way.
3. **Two dimensions.** `maxItems: 2` in the schema. The fixture engine answers `by: [a, b]` with one row per pair and totals per value of each. `checkLayers` lists both in its error.
4. **`color` as a split on cartesian.** One series per value: a path per series for `line` and `area`, a rect per pair for `bar`. Keys gain the series. Paint follows the colour dimension's domain order. A `legend` part, and fit rules for it: full legend, then direct labels at the line ends, then nothing.
5. **More than six series is an error that names the fix:** add a `limit`. The resolver's fold into "Other" (Proposed as tier 3 in section 10.2 of the reference) replaces the error when it is built; it is not part of this step.
6. **`stack: "zero"`, `"normalize"`, `"center"` on an axis,** and dodge for an unstacked `bar`. `RectNode` gains `v0`.
7. **Signed domain.** The domain covers negatives; the axis line moves to zero. `place()` and the cartesian layout's CSS read `v0`.
8. **A scale per unit.** Layers whose metrics differ in catalog `unit` get their own y scale; a second `y-axis` part on the far side. Fit rule: the second axis goes before the first.
9. **Prose** for two dimensions ("Search leads on 18 of 28 days…" is a guess; write it against the fixtures) and for two metrics.
10. **Presets** with `$split`: the grouped, stacked and stacked-area forms.
11. **DOM:** `layouts/cartesian.ts` paints series, stacks and the legend. Keyboard: left and right step along x, up and down step through the series at that x. Check that against version 4's keyboard model before building.

Done when a stacked bar, a grouped bar, a three-series line and a diverging bar each render from a spec on the bench in all three data states and degrade to the number.

### Step 2. Rows as tracks

Size: medium. Unlocks table with in-cell bars, league table, funnel. The MVP view set already asks for it ("more than one metric per row").

1. **Columns.** Each `text` or `bar` layer that encodes a metric is a column, in layer order. A `columns` part carries header labels as guides.
2. **Columns are ranked.** The first metric stays; the rest carry `rank` and are given up from the right when the row is short. The room a column needs is measured, as the value's room is today.
3. **A delta per row.** A `text` layer with `series: "delta"`, painted by polarity as the tldr value's delta is. It is left out on expansion when the query has no `compare`, as a `previous` layer is.
4. **The track.** The `bar` layer's x gets a real scale (linear, signed). Nothing else draws in it until step 3.
5. **Funnel preset:** rows in the query's order, a bar, the count, and a rate. The rate is an engine metric; the view does not divide.
6. **DOM:** `layouts/rows.ts` becomes a grid with one track per column. The feedback note that a row has no node in the scene (step 5 of the painter work, finding 5) is fixed here: add the row node.

Done when conversions by event renders count, rate and value per row and drops columns as it narrows.

### Step 3. Ranges and `tick`

Size: medium. Unlocks waterfall, error bars, candlestick and box plot. It also builds the ranged bar Gantt and timeline would use; those two are deferred.

1. **Companion fields.** `checkLayers` accepts `metric@suffix` when the result returns it, and its error lists the companions that exist. The fixture engine gains `@min`, `@max`, `@p25`, `@p50`, `@p75`, `@lower`, `@upper` and `@running` for one metric each.
2. **`x2` and `y2`** on `bar`, `rule` and `area`, in cartesian and in a row's track.
3. **`rule` with fields,** and a constant on x.
4. **`tick`.**
5. **Paint by direction and polarity.** A ranged bar whose end is below its start paints `delta.bad`, otherwise `delta.good`, turned by the metric's polarity, and neutral when polarity is `none`. Waterfall and candlestick both need it. No spec field.
6. **Presets:** box-plot, error-bars, waterfall, candlestick, a fan (ranged `area` as `context`).
7. **Fit rules.** Ranges are `context`; they go with the `secondary` rule and the central mark stays.

Done when a box plot of a metric by page and a waterfall render from presets, and the box plot at 180 px wide is its medians alone.

### Step 4. A metric on both axes, and `dot`

Size: large. Unlocks scatterplot, bubble, quadrant, histogram, density. Touches Open 5 (label collision).

1. **Linear x.** `cartesian` accepts a metric or a numeric dimension on x. X ticks are derived as y ticks are, and ranked.
2. **`dot`,** in the plot and in a row's track (which gives the Cleveland dot plot and the dumbbell with step 3).
3. **`size`.** Quantized to a few steps the painter owns in pixels. A size legend is a guide.
4. **Catalog type `number`.** A binned numeric dimension draws bars with no gap between them. The bins are the engine's.
5. **`text` in the plot.** Labels are ranked by the size or y value of their point. The measured pass hides the ones that collide, lowest rank first. That is the first cut, not the answer to Open 5.
6. **Prose** for two metrics by one dimension: the range of each and the outliers by name.
7. **DOM.** Dots are HTML, placed by custom properties as bars are. Keyboard over points in two dimensions has no model in version 4; propose nearest-neighbour by arrow direction and raise it.
8. **Fit rules.** Labels, then the size legend, then axes, then the number. A scatter has no sparkline form; say so in the rules by giving it no bare-plot rung.

Done when traffic against conversion by page renders with the top labels shown, and a histogram of load time renders from a binned dimension.

### Step 5. `cell`

Size: medium. Unlocks heatmap, and calendar heatmap and climate stripes beyond the Common tier.

1. **Tokens.** A sequential ramp from `packages/tokens`, named in the `--a8c-charts-*` scheme, and paint tokens `seq.1` to `seq.n`. This is the first thing to consume the generated tokens.
2. **`cell`** on band by band. The colour value is quantized to the ramp. Null is its own token, not the lowest step.
3. **A `ramp` part:** the legend, with the low and high value.
4. **DOM.** A CSS grid. Keyboard in two dimensions over a real grid.
5. **Fit rules.** Tick labels thin by rank, the ramp goes, then the number.
6. **Never colour alone.** A cell's value is in its accessible name and in the readout; the table alternative is the same query pivoted.

Done when visitors by weekday and hour renders in both themes.

### Step 6. `arc`

Size: medium. Unlocks pie, donut, gauge.

1. **`ArcNode` and the `radial` layout,** triggered by a layer that encodes `angle`.
2. **A part that holds its aspect ratio.** In the DOM, an SVG that is not stretched (`preserveAspectRatio` at its default). In `place()`, a square within the part's box.
3. **Catalog `domain`, `target` and `bands`** on a metric, for the gauge.
4. **Presets:** pie, donut, a half-circle form, gauge. The half-circle is `sweep: "half"` on the layer, the first layer field that is neither data nor role.
5. **Fit rules.** The legend steps down as the band's does. In a donut the number sits in the hole, which is a rule and not a spec field. Below the `marks` need, the number alone.
6. **Prose** is the share sentence the band already has.

Done when device share renders as a donut with the number in the hole, and falls back through the same legend steps as the share bar.

### Step 7. `facet`

Size: medium. Unlocks small multiples and, with step 6, the instrument panel. Touches Open 12 (boards).

1. **`facet` in the spec** names a dimension from `by`.
2. **A facet is a small board, not a bigger scene.** The plan is made once per facet value with one shared domain handed to every scene builder, and the container lays the children out in a wrapping grid. No column count anywhere.
3. **Shared guides.** The y axis shows on the first child of each row; the rest carry the grid only.
4. **Fit rules** apply per child, which is what intrinsic sizing already gives.

Decided October 7: a facet is a small board. Build this after the board design is at least sketched, so the two share one layout mechanism.

Done when visitors by day, faceted by channel, wraps from four columns to one with no script on resize.

### Step 8. Custom marks, and `geo`

Size: large. Unlocks choropleth and proportional symbol map.

1. **The registry.** A custom mark is registered in code under a name: a scene builder for core's side, a painter for the DOM's. The spec refers to it by name and passes encodings, nothing else.
2. **`geo` lives in its own package,** `packages/geo`, which depends on `d3-geo` (approved October 7, for that package only). Core stays at three dependencies. Boundary shapes are an input handed in, as the catalog is.
3. **It reuses** the sequential ramp from step 5 and the size steps from step 4.
4. **Its fallback is a different layout:** below the room a map needs, it becomes the `bar-list` of the same query. The rule says so with a new optional field, `fallback`, naming the preset. `resolve()` plans again with it; the DOM painter paints both and a container query shows one.

Done when visitors by country renders as a map at dashboard width and as a ranked list at sidebar width, from one spec.

### What the plan does not build

The nine Common charts marked "out" in section 2, and the four Uncommon families. If one is wanted, it is a custom mark through step 8's registry, and it counts against the health check.

## 6. Decided, and still open

### Decided October 7

| # | Question | Decision |
|---|---|---|
| Open 4 | Generalizing the three layouts | Layouts stay, as arrangements of parts. A channel's scale comes from its field. `rows` is a track per row. `radial` is added for `arc` |
| Open 10 | More than one dimension in `by` | Two. The second goes to `color`, to `facet`, or to the other axis |
| Open 11 | Catalog properties | Propose to the API's owners: dimension type `number`; `domain`, `target` and `bands` on a metric; a colour role per dimension value; and, on the result, totals per split |
| Open 12, in part | How a facet relates to a board | A facet is a small board: a plan per value, one shared domain, laid out by the container |
| A | Shape parameters | A closed set of layer fields, starting with `sweep: "half"` |
| B | Row-level data | Deferred. Gantt and timeline wait until the query contract can carry records. Step 3 still builds the ranged bar |
| C | Where statistics run | In the engine, returned as companion fields. Core gains no transform for them |
| D | A fit rule that swaps a layout | A `fallback` on the rule, naming a preset |
| | A delta per row | `series: "delta"` on a `text` layer |
| | Paint of a ranged bar | By direction and the metric's polarity. No spec field |
| | More than six series | An error that names the fix, until the fold into "Other" is built |
| | `d3-geo` | Approved, in `packages/geo` only |

### Still open

| # | Question | Where it bites |
|---|---|---|
| Open 5 | Label collision: build or source | Step 4 ships ranked labels and the measured pass as a first cut. Decide after seeing it |
| Open 12 | The board itself | Step 7 waits for a sketch |
| Open 3 | How a preset pins a hand-tuned form | Nothing here needs it. If a step finds it does, that is a finding for section 7 |
| New | Keyboard over points in two dimensions | Scatter (step 4) and heatmap (step 5). Version 4 has no model for it; the proposal is nearest neighbour by arrow direction for points, and row and column for a grid |
| New | Keyboard through series at one x | Step 1. Check against version 4's model before building |

## 7. What to count as it is built

- **Presets that need a pin or a custom mark.** The claim is none of 29. Each exception is a hole in the grammar.
- **Specs that need `keep`.** As today.
- **Layer fields that are neither data nor role.** There is one, `sweep`. If the count grows, chart types are coming back as parameters.
- **Charts that need their own fit rules** rather than their layout's. The claim is that rules belong to arrangements and parts.
