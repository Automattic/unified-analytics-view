# View grammar: reference for the build

As of October 7, 2026. Working name only; rename freely.

This is the reference for building an analytics view system in which a view is described once, as data, and the container it lands in decides how to present it. It compiles the design work so far and the lessons from a working prototype (`prototype/prototype-bench.js`, 815 lines, plus `prototype-bench.html` and `prototype-test.js`).

**How to read the status labels.** Each section is marked one of:

- **Proven:** implemented in the prototype and exercised across views, widths, heights and data states.
- **Proposed:** decided in design but not yet built. Treat as the plan, and say so if building it shows it is wrong.
- **Open:** undecided. Do not settle these silently; raise them.

---

## 1. Goal and principles

Build the front-end foundation for analytics views: a small grammar of marks, a spec format, and renderers. Collection and storage are out of scope and handled elsewhere.

1. **A view is specified once, and the spec is the seed for everything.** An author writes a spec and decides where to render it, and nothing else. The spec carries no sizes, no breakpoints and no presentation switches; the container it lands in decides how it is presented.
2. **Chart types are presets, not primitives.** A "bar chart" is a saved combination of marks, encodings and transforms. The grammar never sees a chart-type name.
3. **A valid spec always produces something meaningful,** even if it is odd. Odd may be what was asked for. An invalid spec fails with a message that names the fix.
4. **Specs are mostly written by agents.** That means a small closed vocabulary, plain JSON, a published schema, and errors an agent can act on.
5. **High visual control.** Structure and rendering are separated by a scene, so the look of every mark can be designed and replaced.
6. **Polish is not optional.** Accessibility, transitions and label collision are requirements of the system, written once against the grammar and not once per chart.
7. **The core is framework-free TypeScript with no DOM.** The first container is in a browser, but the same spec must be usable by an agent (text only), a canvas painter and later a native shell.
8. **It must work on any site.** The first surface is a panel that slides in on a customer's own site, at sidebar width, in the site owner's browser. It cannot rely on the host page's styles, and it cannot depend on Chromium-only features without a fallback.

---

## 2. Architecture

```
            catalog ──────────────┐
                                  ▼
spec ──► expand ──► plan ──► scene ──► painter
 ▲        (presets)  ▲  (fit the container)   (DOM, dot grid, canvas…)
 │                   │
 └─ query ──► result ┘        container: width, height, painter, type metrics, rules
```

| Step | Input | Output | Owns | Status |
|---|---|---|---|---|
| **Catalog** | — | Metric and dimension definitions | What names mean; units, polarity, additivity | Proven (as a stub) |
| **Query** | `spec.query` | `{ rows, totals, meta }` | Fetching. Stubbed with fixtures today | Proven (fixtures only) |
| **Expand** | Spec with `use` | Spec with `layers` | Preset library | Proven |
| **Plan** | Expanded spec, result, container | A plan: layout, layers with roles, guides, what was dropped, the tldr prose | Fitting the view to the container | Proven for the central reducer; the per-element approach in section 10 is Proposed |
| **Scene** | Plan, result, container | Flat list of positioned shapes with stable keys | Geometry | Proven |
| **Painter** | Scene | Pixels | Appearance | Proven: SVG and dot grid |

Everything up to and including the scene is pure and has no DOM. d3 is used only for scales (`d3-scale`), path geometry (`d3-shape`) and array helpers (`d3-array`). No chart library.

**Deliberately deferred:** the query coordinator, DuckDB-WASM, WebGPU, cross-filtering, boards, and the semantic compiler. See section 20.

---

## 3. Vocabulary

| Term | Meaning here |
|---|---|
| **Mark** | The shape drawn per row of data: line, area, bar, rule, text (later dot, cell, tick, arc). A mark is only a shape plus the constraints that shape implies |
| **Channel** | A visual property of a mark that can carry data: x, y, color, text |
| **Encoding** | Assigning a field to a channel |
| **Scale** | The function from data values to visual values |
| **Transform** | How rows relate before drawing: stack, normalize (later bin) |
| **Layer** | One mark with its encodings. A view is a stack of layers over shared scales |
| **Role** | What a layer is for: `primary`, `comparison`, `reference`, `context`. A container gives up layers by role |
| **Guide** | Anything derived from scales, never authored: axes, grid, legend, tick labels |
| **Tldr value** | The numerical tl;dr of a view: the primary metric's total from the engine, an optional delta, an optional note. Formerly "headline" |
| **Preset** | A named, saved fragment of a spec that expands into layers |
| **Container** | Wherever a view renders. It supplies width, height, painter, type metrics and the rules a view is fitted by. Formerly "host" |
| **Context** | The surface that holds containers: a panel, a toolbar, a dashboard, an agent. It lays its containers out by a scheme of its own, and hands them a durable rule set once, as it hands them a token set |
| **Plan** | The resolved description of what will be drawn at this size, and what was dropped |
| **Scene** | A flat JSON list of positioned shapes with stable keys and paint tokens |
| **Painter** | Code that draws a scene |
| **Tldr prose** | The prose tl;dr of a view: the text sibling every view has, derived from the query and transforms. Formerly "sentence" |

---

## 4. The catalog contract

**Status: Proven as a stub. The real contract is Open and depends on the server API.**

The catalog is the slice of the semantic model the front end needs. Computation and table mapping live on the server, behind the API. The front end needs only names and the properties that drive presentation.

```json
{
  "metrics": {
    "visitors":  { "label": "Visitors",    "unit": "count", "polarity": "up",   "rangeTotal": "sum of daily" },
    "pageviews": { "label": "Page views",  "unit": "count", "polarity": "up",   "rangeTotal": "sum" },
    "present":   { "label": "Present now", "unit": "count", "polarity": "none", "instant": true }
  },
  "dimensions": {
    "date.day": { "label": "Day",     "type": "time" },
    "page":     { "label": "Page",    "type": "categorical" },
    "channel":  { "label": "Channel", "type": "categorical" }
  }
}
```

Rules the front end relies on:

- **Each name is defined exactly once,** outside both the data and the views. A view refers to `visitors`; it never carries a formula.
- **Totals come from the engine.** A view never sums the rows it happens to receive, because many metrics are not additive. Visitors in v1 are counted per day, so a range total is a sum of daily counts and must be labelled as one (`rangeTotal: "sum of daily"`).
- **Polarity drives delta colour.** `up` means an increase is good, `down` the reverse, `none` means no judgement.
- **`instant`** marks a metric with no range and no prior period, such as people present now.
- **Unknown is null, not zero.**

Properties the full catalog will need but the stub lacks: format, thresholds or bands, valid dimensions per metric, valid grains, approximation and coverage, identity definition for people-counts, hierarchy on dimensions, and a colour role on dimensions.

The v1 metric list the catalog must eventually cover: visitors, page views, unique page views, engaged time, top pages, referrers, channels (including AI assistants), UTM, country, device, conversions and custom events, revenue by channel and page, and present now.

---

## 5. Query and result

**Status: Proven with fixtures. The real query layer is deferred.**

A query is written in catalog names:

```json
{ "metrics": ["visitors"], "by": ["date.day"], "range": "28d", "compare": "previous", "limit": 8 }
```

| Field | Notes |
|---|---|
| `metrics` | Required. The first is the primary metric |
| `by` | Zero or one dimension today. More than one is Open |
| `range` | `"28d"` style. Presets and custom ranges are Open |
| `compare` | `"previous"` or absent. Other modes (year over year, baseline) are Open |
| `limit` | Top-N for categorical dimensions |

A result is:

```json
{
  "rows": [
    { "date.day": "2026-09-08", "visitors": 416, "visitors@previous": 370, "partial": false },
    { "date.day": "2026-10-05", "visitors": 175, "visitors@previous": 405, "partial": true }
  ],
  "totals": { "visitors": 10531, "visitors@previous": 9437 },
  "meta": { "range": "28d", "compare": "previous", "notes": ["Today is still in progress."] }
}
```

- A comparison is delivered as a companion field, `metric@previous`, aligned row by row. It is null when there is no prior data.
- `partial: true` marks an incomplete bucket (today).
- `meta.empty: true` marks a period with no data at all.

The fixture engine has three data states: `typical`, `no-prior` (comparison requested, none available) and `empty`. Keep all three as test fixtures.

---

## 6. The view spec

**Status: Proven. Version string is `view/0`.**

```json
{
  "spec": "view/0",
  "title": "Visitors",
  "use": "line",
  "query": { "metrics": ["visitors"], "by": ["date.day"], "range": "28d", "compare": "previous" }
}
```

| Field | Type | Meaning |
|---|---|---|
| `spec` | string | Format version |
| `title` | string | Shown by the container's frame, not drawn in the scene |
| `query` | object | Required. See section 5 |
| `use` | string | A preset name. Expands into `layers`. Ignored if `layers` is present |
| `layers` | array | Explicit layers. See below |
| `keep` | array | Parts a container may not drop: `"guides"`, `"secondary"`, `"rows"`, `"marks"`. Provisional; see section 10.1 |

The spec says what to show and nothing about how. Whether the tldr value or a guide appears is decided by the container's rules (sections 8 and 10). `keep` is the one presentation lever an author has.

A layer:

| Field | Meaning |
|---|---|
| `mark` | `line`, `area`, `bar`, `rule`, `text` |
| `encode` | Channel to field: `x`, `y`, `color`, `text`. A field is a dimension name, a metric name, or a number (for a rule) |
| `series` | `"previous"` draws the comparison companion of the metric. Comparison is a property of a layer, not a second metric |
| `role` | `primary`, `comparison`, `reference`, `context`. Defaults: a `previous` series is `comparison`, a `rule` is `reference`, everything else is `primary` |
| `stack` | `"normalize"` for share of whole |
| `label` | Text for a rule |
| `align` | `"end"` for right-aligned text |
| `paint` | Override the paint token |

The same spec, written as layers:

```json
{
  "spec": "view/0",
  "title": "Daily page views",
  "query": { "metrics": ["pageviews"], "by": ["date.day"], "range": "28d" },
  "layers": [
    { "mark": "bar",  "encode": { "x": "date.day", "y": "pageviews" } },
    { "mark": "rule", "encode": { "y": 1000 }, "label": "Target 1,000", "role": "reference" }
  ]
}
```

Rules:

- A spec with no dimension and no layers is the tldr value alone.
- A spec with a dimension and no layers (and no `use`) is an error. There is no silent default.
- A layer that encodes a field the query does not return is an error that lists what the query does return.
- There is no `intent` field. An earlier version had one; it was a chart type under a new name and was removed.
- There is no `headline` field and no `guides` field. Both were presentation switches and were removed on October 7; the schema rejects them. The container's rules decide what they used to.

**To do:** publish a JSON Schema for the spec. It is the contract agents will write against.

---

## 7. Marks, transforms and layouts

### Marks

| Mark | Channels today | What comes with it | Status |
|---|---|---|---|
| `line` | x, y | Connects neighbouring rows, so x must be ordered | Proven |
| `area` | x, y | Fills to a zero baseline | Proven |
| `bar` | x, y (and color when stacked) | Has a baseline, so the scale starts at zero | Proven |
| `rule` | y (a constant) | A reference line with an optional label | Proven |
| `text` | y, text | A label per row | Proven (rows layout only) |
| `arc` | angle, radius, color | Its own mark. No general polar coordinate system | Proposed |
| `dot`, `cell`, `tick` | — | Scatter, heatmap, strip | Proposed |

A mark carries only its shape and those constraints. Relationships between marks (stacked, overlaid, normalized) are transforms or layering, never part of the mark.

A custom mark registered in code and referenced by name is the escape hatch for anything the grammar cannot express (maps, funnels, Sankeys). Keep the spec small; do not let it grow an expression language.

### Transforms

`stack: "normalize"` is the only one today. Stacking on a time axis, binning and windowing are Proposed.

### Layouts

**This is the thinnest part of the prototype.** The scene builder detects one of three hard-coded layouts from the layers:

| Layout | Trigger | Draws |
|---|---|---|
| `cartesian` | A dimension on x | line, area, bar, rule over a category or time axis |
| `rows` | A dimension on y | The ranked bar list: a bar behind a label and a value per row |
| `band` | A dimension on color only | One stacked, normalized bar with a legend |

These are chart types hiding in the scene builder. Generalizing them (facets, two dimensions, a metric on both axes) is Open and is the most important structural work after the port.

---

## 8. Roles, guides and the tldr value

- **Roles** let a container reason about a view without knowing what chart it is. `primary` is the thing itself. `comparison` is the same metric for another period. `reference` is a target or threshold. `context` is supporting ink, such as the area under a line.
- **Guides** are derived from scales. Axes, grid, tick labels and legends are never authored, and a spec cannot switch them on or off. They start on (both axes and the grid on a cartesian layout, the full legend on a band), and the container's rules decide when they go.
- **The tldr value** is the primary metric's total from the engine, a delta if the query compares, and a derived note:
  - time dimension: the range-total caveat, such as "Sum of daily counts"
  - categorical dimension: "Top: /pricing"
  - categorical with `stack: "normalize"`: "Search 41%"
  - instant metric: "on the site right now"

Where the tldr value appears is the container's decision, never the spec's:

- It is the whole view when there are no layers, and what remains at collapse.
- It is added beside the plot when the axes drop.
- It sits above the marks, when there is room for both, according to the rule `tldrValue.above`. The default is `instant`: only for an instant metric. A context can pass `always`.

Delta states: up or down with a percentage, "No change" (under 0.5%), "New" (prior was zero), "No prior period" (prior is null). Colour follows the metric's polarity.

---

## 9. Presets

**Status: Proven.**

A preset is a saved fragment of a spec with two slots, `$by` and `$metric`, filled from the query. It expands before the grammar runs, and nothing downstream knows its name.

```json
{
  "line": { "layers": [
    { "mark": "area", "encode": { "x": "$by", "y": "$metric" }, "role": "context" },
    { "mark": "line", "encode": { "x": "$by", "y": "$metric" }, "series": "previous", "role": "comparison" },
    { "mark": "line", "encode": { "x": "$by", "y": "$metric" }, "role": "primary" }
  ] },
  "bar-list": { "layers": [
    { "mark": "bar",  "encode": { "y": "$by", "x": "$metric" } },
    { "mark": "text", "encode": { "y": "$by", "text": "$by" } },
    { "mark": "text", "encode": { "y": "$by", "text": "$metric" }, "align": "end" }
  ] },
  "share-bar": { "layers": [
    { "mark": "bar", "encode": { "x": "$metric", "color": "$by" }, "stack": "normalize" }
  ] }
}
```

- The library ships the basics. Users and agents add their own presets to it.
- A preset is named after the `@automattic/charts` component it replaces, where one exists: `line` for `LineChart`, `bar-list` for `BarListChart`. The prototype calls `line` by its earlier name, `trend`.
- A `previous` layer is left out on expansion when the query has no `compare`.
- **Proposed:** a preset may pin a hand-tuned form for a size where the derived result is not good enough. The format for this is Open.
- **The health check for the whole approach:** count how many presets need pins or custom marks. If most do, this has become a chart-type library with extra steps.

---

## 10. Fitting the container

This is the heart of the system and the part most in flux.

**Who decides what (decided October 7).** The spec is the seed. An author writes it and decides where it renders; nobody writes a spec for a container. A container fits the view by a rule set. The defaults ship with the design system and have to be good at any size. A context that wants its containers to behave differently passes them its own rule set once, the way it passes them tokens. In the code today that rule set is `CONTAINER_RULES`, carried on each container as `rules`; the room each part needs is its `fit` list.

**Intrinsic by default (decided October 7).** A surface lays its containers out by a scheme of its own: a sidebar stacks them, a toolbar sets them small in a row. As containers are added they divide the room by that scheme. A container does not know or care where it is. It fills the room it is handed and renders itself for that room. Nothing in a view or a spec names a surface, a size or a mode.

- With nothing said, a container fills the width and takes its natural height, so it cannot collapse whatever it is dropped into.
- A layout that hands out a box (a toolbar row, a dashboard tile) opts its children into filling the height too. That is set in the layout's own CSS, never on the view.
- Both behaviours exist because of constraint 4 in section 10.3.

The layouts and their CSS are in `docs/dom-painter-plan.md`, section 4.2.

### 10.1 What the prototype does (Proven)

A central reducer. The plan starts with everything the spec asks for, checks whether it fits, and if not applies the container's reductions in a fixed order until it does:

1. **Drop guides.** Axes and grid go; the tldr value is added beside a bare plot to make up for them. A full legend becomes the largest segment's label.
2. **Drop secondary layers.** Everything whose role is not `primary`.
3. **Trim rows.** Only when the container has a height limit.
4. **Collapse.** All marks go; the tldr value stays.
5. **Tldr prose.** Only the text remains.

The port departs from the prototype in one place (decided October 7): a tldr value that stands alone and is too tall for the container gives up its note before step 5.

"Fits" means the container is at least the layout's minimum width, the scene is no taller than the container's height limit, and any secondary layers have a plot at least 180 by 90 px.

Starting values, owned by the container's rules and not the spec:

| Part | Needs |
|---|---|
| Plot with axes | 280 px wide, 120 px tall (natural height 184) |
| Secondary layers legible | Plot 180 by 90 px |
| Bare plot beside the tldr value | 64 px wide, 46 px tall |
| Row in a bar list | 28 px plus a 4 px gap; 90 px for the label plus room for the value |
| Share bar | 110 px, or 170 px with a full legend |

A spec's `keep` stops a step from being applied. It is provisional (decided October 7): showing and hiding parts is the main discretionary lever over how a view scales, so it stays while the defaults are tested. Count the specs that need it. Each use points at a default rule to fix, and the field goes when the count reaches zero.

**What this got right.** Derived fallback reproduced a hand-designed ladder without being told: a trend steps from chart, to tldr value beside sparkline, to tldr value, to tldr prose. Bars with a target became a bar sparkline nobody designed. The comparison drops because of a legibility rule, not because a chart type said so.

**Where it was weaker than hand tuning.**

- The bar list keeps every row down to about 140 px wide and then jumps straight to the tldr value. A hand-tuned version had a top-three step in between.
- A collapsed bar list shows the metric total with "Top: /" as a note. For a view called "Top pages" that is arguably the wrong number.
- The thresholds are still picked by hand. They moved from per chart type to per part.
- "Add the tldr value when the axes drop" is a hard-coded rule for one layout.
- Everything switches at once. That is the model the next section replaces for browser containers.

### 10.2 The direction: degrade per element (Proposed)

For browser containers, each element should break only when it needs to, using intrinsic layout and container queries. Three tiers:

**Tier 1: CSS, per element.** Handles hiding, restyling and reflow with no script on resize.

- **Positions are ratios.** A scale outputs 0 to 1, written as a custom property on the element. CSS turns it into pixels: a bar's size is `calc(var(--v) * 100%)`, a tick sits at `calc(var(--t) * 100%)`, share segments use `flex-grow: var(--v)`.
- **Lines and areas stretch.** An SVG with a fixed viewBox, `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke` resizes fluidly. Text is never inside the stretched SVG.
- **Each element owns its thresholds.** The axis, grid, legend, tick labels and each role carry their own container query. These rules belong to the design system's mark and chrome components, so the view spec stays free of sizes.
- **Dependent changes share a condition.** The tldr value that appears when the axes go uses the same query as the axes.

A sketch, untested. The worked rules are in `docs/dom-painter-plan.md`, section 2, where the axes rule queries the view and not the plot, because hiding an axis changes the plot's size:

```css
.vg-plot { container: plot / size; }           /* needs a definite height; use inline-size otherwise */
@container plot (inline-size < 280px) or (block-size < 120px) {
  .vg-axis, .vg-grid { display: none; }
}
@container plot (inline-size < 180px) or (block-size < 90px) {
  [data-role="comparison"], [data-role="reference"], [data-role="context"] { display: none; }
}
```

**Tier 2: a measured pass in script.** For what CSS cannot see.

- Tick thinning when labels would collide. Simple to build.
- Label placement on points and lines. Source or build properly; an occupancy-bitmap approach is the usual technique.
- Any threshold that depends on the data, such as how many ticks there are or how long the labels run.

**Tier 3: the resolver.** For what changes the data, and for containers with no CSS.

- Top-N plus "other", coarser grain (daily to weekly), and downsampling to pixel resolution. These need new data, not new styles.
- The tldr prose for an agent, a canvas or dot-grid painter, and a native shell cannot read container queries.

**One source of truth.** Declare the per-element rules as data. Compile them to container queries for browser containers, and evaluate the same rules in code everywhere else. This rule set is what a context passes to its containers. A format is Proposed in `docs/dom-painter-plan.md`, section 2, and evaluated in code by `packages/core/src/fit.ts`: one declaration per part, naming a container, the room the part needs in width and height, and what is hidden or shown otherwise.

### 10.3 Constraints to design around

1. CSS can hide and restyle. It cannot re-query.
2. CSS cannot see collisions, and cannot express a threshold that depends on the data.
3. CSS only exists in the DOM.
4. Height queries need a container with a definite height. A container sized by its content can only be queried on width.
5. Container queries of this kind have been widely supported since early 2023. Style queries are still partial; do not depend on them.

---

## 11. The scene

**Status: Proven in pixels. The ratio form is built: `buildScene` returns it and `place(scene, container)` makes the pixel scene from it, held to the sweep and the golden scenes. `<ua-view>` in `packages/dom` paints from the ratios. What follows describes the placed scene; the ratio fields are in `packages/core/src/types.ts`.**

A placed scene is `{ width, height, nodes, plot? }`. Nodes are flat and drawn in order.

| Kind | Fields |
|---|---|
| `rect` | `x, y, w, h, rx` |
| `path` | `d`, `fill` (boolean), `width`, `dash` |
| `line` | `x1, y1, x2, y2, width, dash` |
| `circle` | `cx, cy, r, pulse` |
| `text` | `x, y, text, anchor, baseline, font` (`tick`, `label`, `value`, `display`), and for `display`: `h, cell`; optional `halo` |

Every node also has:

- `key`: stable across renders, for example `primary:line`, `primary:bar:2026-09-08`, `seg:Search`. A layer's key is its role and mark, with `#2` for a second layer of the same role and mark; it does not count layers, so it holds when one drops. The prototype's keys do count them (`L2:line`), and the parity test maps them. Keys are what make transitions and keyboard navigation possible. Duplicate keys are a bug; the prototype test checks for them.
- `paint`: a token, never a colour.
- `layer`: `data` or `guide`.
- Optional `opacity`, `tx`, `ty`, `note`.

```json
{ "key": "primary:line:partial", "kind": "path", "d": "M326.9,83.5L338,117.7", "paint": "series.1",
  "width": 2, "dash": "2 4", "opacity": 0.75, "layer": "data", "note": "incomplete bucket" }
```

Paint tokens in use: `ink`, `ink.muted`, `grid`, `axis`, `series.1` to `series.6`, `compare`, `rule`, `delta.good`, `delta.bad`, `live`.

**Decided October 7: one scene, in ratios.** A pixel scene needs a size before it can exist, which is the opposite of intrinsic. Every node gets a `part` and coordinates from 0 to 1 within that part's box. The DOM painter lets CSS turn them into pixels. The dot-grid and canvas painters get today's pixel scene from a pure function, `place(scene, size)`, which is held to the existing golden scenes. Keys, paint tokens, roles and `layer` are identical in both. Detail is in `docs/dom-painter-plan.md`, section 3.

One consequence, also agreed: a scene with no size cannot choose its tick count by height, so the y scale always rounds to 4 ticks and a rule thins them on short plots. This departs from the prototype, which rounds to 2 under 120 px, and the parity test changes with it on purpose.

---

## 12. Painters

**Status: SVG and dot grid Proven. An HTML and CSS painter is Proposed and comes first in the build.**

- **Two layers per view.** Data marks go to whichever renderer fits. Axes, labels, tooltips, brush and focus rings always stay in the DOM, so text stays crisp, tokens apply through CSS and keyboard access survives.
- **Tokens, not colours.** A painter maps paint tokens to CSS custom properties, using the `@automattic/charts` token names (`series.1` becomes `--a8c-charts-color-series-1`). The full map is in `docs/dom-painter-plan.md`. Light and dark are token sets.
- **Intrinsic sizing.** The DOM painter plans once per data change and CSS fits the view on resize. Bars are HTML positioned by custom properties; lines and areas are a stretched SVG (decided October 7). The view carries no size or mode; see section 10.
- **Isolation.** On a customer's site the view must not inherit or leak styles. Use a custom element with shadow DOM.
- **Renderer choice by mark count.** HTML and SVG for up to a few thousand marks, canvas beyond, WebGPU later. Aggregating to pixel resolution first keeps most analytics views in the first tier.

### The dot-grid painter

It exists to prove the scene seam and to carry the product's visual direction. It redraws the same scene on a fixed grid; a shape only decides which cells are lit.

- Cells are 4 px or 8 px, fixed in space. Movement is shown only by which cells light up.
- Light mode reads as an LCD: one ink, with series told apart by dither pattern (solid, checker, horizontal stripe, sparse, diagonal, vertical stripe). Low opacity becomes a sparse pattern; a dashed line becomes a checker.
- Dark mode reads as a VFD on black: series told apart by wide-gamut (Display P3) hue, with an sRGB fallback. No drawn glow.
- Big numbers are set on a 5 by 7 grid. Other text stays in the DOM.
- Shapes are rasterized through a low-resolution mask, one mask pixel per cell.

Related visual directions not yet built: segmented display type for large numerals, split-flap style tables, and refined transitions. Treat these as painters and design-system components over the same scene, never as chart types.

---

## 13. States

| State | Prototype behaviour | Status |
|---|---|---|
| Empty period | A notice in place of the marks; "0" and "No visits yet" when collapsed | Proven |
| No prior period | Comparison layer dropped and reported; delta reads "No prior period" | Proven |
| Partial bucket (today) | Dashed tail on a line, faded bar, excluded from the area | Proven |
| Zero people present | "0" with "Nobody is here right now" | Proven |
| Loading | — | To do |
| Stale or late data | — | To do. Freshness should be a visible state |
| Filtered (bots, consent) | — | To do |
| Metric unavailable here | — | To do |
| Error | Message shown outside the view; the last valid view stays drawn | Proven in the bench only |

**Open:** whether a delta should exclude the partial day. Today the totals include it.

---

## 14. Accessibility requirements

Write these once against the scene and the plan, not per preset.

- Every view exposes its **tldr prose** as its accessible name or description.
- Every view offers the **same query as a table**. Chart and table read one result.
- **Keyboard navigation** over data marks, driven by keys and the row each mark came from. Announce the dimension value, the metric value in its catalog format, and the comparison if present.
- A **canvas or dot-grid painter needs a hidden DOM mirror** carrying the same structure.
- **Never colour alone.** Series must also differ by dash, pattern or direct label. The dot painter's dither patterns are one instance of this.
- Visible focus, sufficient contrast in both themes, and `prefers-reduced-motion` respected.
- The Olli model (overview, then axes and legends, then intervals, then points) is the reference for the navigable tree.

---

## 15. Transitions

- **Stable keys give enter, update and exit** for any view, including when a container drops a part.
- With positions as registered custom properties, the **design system's motion tokens** animate them in plain CSS.
- **Hard cases that need script:** discrete layout switches, and line shapes when the data changes (interpolate the values and regenerate the path).
- Do not animate while the container is being resized continuously; animate on data and spec changes.
- The dot painter animates by interpolating the scene and re-rasterizing. Cells never move.
- Respect reduced motion everywhere.

Transitions are a first-class requirement and should be refined, not incidental.

---

## 16. The tldr prose

Derived from the query and transforms. No chart type is consulted.

| Query shape | Tldr prose |
|---|---|
| Instant metric | "7 people are on the site right now; the busiest page is / (3)." |
| Time dimension, or none | "Visitors: 10.5k in the last 28 days, up 12% on the previous period. This is a sum of daily counts, not unique people." |
| Categorical dimension | "Top pages by page views, last 28 days: / (4,820), /pricing (2,960), /blog/launch-notes (2,105)." |
| Categorical with `stack: "normalize"` | "Search is the largest channel at 41% of visitors, followed by Direct at 28%." |
| Empty | "No visitors recorded in the last 28 days." |

The tldr prose is the last rung of every view, the accessible description, and what an agent gets when it cannot render anything.

---

## 17. Acceptance set

The six sample specs in the prototype are the first acceptance tests. Port them with their fixtures.

| Sample | Spec | Covers |
|---|---|---|
| Visitors over time | `use: "line"`, visitors by day, compare previous | Time series, comparison, partial bucket |
| Top pages | `use: "bar-list"`, page views by page, limit 8 | Ranked list |
| Channel mix | `use: "share-bar"`, visitors by channel | Part to whole |
| Page views total | A query with no dimension and no layers | The tldr value alone, with delta |
| Present now | `use: "bar-list"`, present by page | Instant metric, so the tldr value sits above the list |
| Bars and a target | Explicit layers: bar plus rule | Authored layers and roles |

Fixture facts to assert: visitors total 10,531 against 9,437 previous (up 12%); page views 25,061 against 21,974 (up 14%); 28 daily rows, the last one partial; channel shares 41, 28, 14, 8, 6 and 3 percent; 7 people present across 4 pages.

`prototype-test.js` sweeps every sample across three data states, two painters, six height limits and nine widths, and checks for duplicate keys, NaN values and scenes taller than the container allows. Port that sweep.

The v1 product also needs primitives the prototype does not have yet: a delta badge as its own part, scope and filter chips, a compact date and compare control, a detail table, and loading and stale notices.

---

## 18. Stack and repository shape

**Status: Proposed. Push back if something here is a poor fit.**

- TypeScript, strict. The core has no DOM and no framework.
- `d3-scale`, `d3-shape`, `d3-array` only. No chart library.
- A custom element with shadow DOM for the DOM painter. Thin Preact and React bindings later; one consumer renders with Preact, so do not assume React.
- Vite and Vitest. Scene snapshots as golden files, so grammar changes show up as diffs.
- A JSON Schema for the spec and the catalog as the published contract.
- Tokens as CSS custom properties.

```
packages/
  core/       spec types and schema, validation, catalog types, presets and expand, plan, scene, tldr prose
  dom/        HTML, CSS and SVG painter; the custom element
  dots/       dot-grid painter (later)
  fixtures/   catalog, fixture query engine, sample specs
apps/
  bench/      the playground: spec editor, container width and height, data states, painter switch
docs/
  view-grammar-reference.md
prototype/    read-only reference: prototype-bench.js, prototype-bench.html, prototype-test.js
```

Map from the prototype's sections to modules: catalog (1), fixtures and query (2), formatting (3), host context (4), presets (5), plan (6), scene (7), painters (8), bench UI (9).

---

## 19. Decisions and open questions

### Decided

1. Chart types are presets, not primitives.
2. No `intent` in the spec.
3. Comparison is a role on a layer (`series: "previous"`), not a second metric.
4. Sizes and thresholds belong to the container and the design system. The spec has none; `keep` is the author's only lever.
5. Totals come from the engine, never from summing rows.
6. `arc` will be its own mark. No general polar coordinates.
7. The scene is the seam between structure and rendering. Paint tokens, never colours.
8. Text stays in the DOM. Data marks may go to any renderer.
9. Every view has a derived tldr prose.
10. The front end needs only a catalog. Computation and table mapping are server-side. Presentation hints may live with the design system, keyed to catalog names.
11. A valid spec always draws something. An invalid one fails with a message naming the fix.
12. Guardrails are the authoring agent's job plus validation, not a restricted component API.
13. For browser containers, degradation is per element with container queries, not one global switch.
14. The spec is the seed for everything. An author writes a spec and decides where to render it; nobody writes a spec for a container. (October 7)
15. Presentation is intrinsic. A container fits a view by default rules, and a context that wants different behaviour passes its containers a durable rule set. (October 7)
16. `headline` and `guides` are out of the spec. Whether the tldr value and the guides show is decided by the rules. (October 7)
17. `keep` stays, provisionally, as the author's one lever. Uses are counted during testing and the field is removed if the defaults make it unnecessary. (October 7)
18. Names: tldr value (was headline), tldr prose (was sentence), container (was host). The read-only prototype keeps the old names, and the parity test maps them. (October 7)
19. Intrinsic behaviour is the default. A surface lays its containers out by its own scheme; a container fills the room it is handed and does not know where it is. With nothing said it fills the width and takes its natural height; a layout that hands out a box opts its children into filling it. (October 7)
20. One scene, in ratios, with a `part` on every node. Pixel painters go through `place(scene, size)`. (October 7)
21. Y ticks always round to 4, thinned by a rule on short plots. A deliberate departure from the prototype. (October 7)
22. In the DOM, bars are HTML and lines and areas are a stretched SVG. (October 7)

### Open

1. The format for per-element fit rules, such that they compile to container queries and also run in code. Proposed in `docs/dom-painter-plan.md`, section 2. Step 1 of that plan built it (`packages/core/src/fit.ts`) and it holds for running in code: `resolve()` reads the rules with no change to any plan. It stays here until the rules are compiled, and until the differences step 1 found are settled: the view's block needs when the number sits above the plot, and what `keep` means to a compiled rule.
2. Settled October 7: see Decided 20. The number is kept so later items keep theirs.
3. How a preset pins a hand-tuned form.
4. Generalizing the three hard-coded layouts.
5. Label collision: build or source.
6. Bar list behaviour when narrow, and what a collapsed ranking should show.
7. Whether a trend shows the tldr value above the plot by default. This is now the container rule `tldrValue.above` and not a spec field; the default says no.
8. Whether deltas exclude the partial day.
9. Params and selections. Not started. The design intent: a selection is a filter predicate, not pixels or row IDs; three kinds (interval, point, set); several views combine by union, intersection or cross-filter; dragging is transient and local, releasing commits to the context.
10. More than one dimension in `by`.
11. Catalog properties beyond the stub, and where polarity and thresholds are declared.
12. How a board composes views that share params.
13. The name.
14. Which survives at the smallest size, the marks or the tldr value. Today the tldr value does; a sparkline in a table cell wants the line alone. To settle in testing.
15. Whether the tldr prose rung can be anything but measured. The plan proposes a measured pass, because the threshold is the width of the number itself. It is the one place the fit is not intrinsic.

---

## 20. Out of scope for now

- **Query coordinator.** The layer that collects each view's request, merges duplicates, caches and routes to an engine.
- **Local engine.** DuckDB-WASM slicing server results in the browser. An in-page panel should lean on the server tier because of download size.
- **WebGPU and canvas renderers for dense data.**
- **Cross-filtering and brushing.** Next after static views feel right.
- **Semantic compiler.** Turning catalog names into SQL is server-side.
- **Boards.** A board is a spec whose body is a layout of child specs sharing params. Not started.
- **Agent surface.** Returning a view through an MCP server. The spec and the tldr prose are designed for it; nothing is built.
