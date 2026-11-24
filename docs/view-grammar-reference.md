# View grammar: reference for the build

As of October 7, 2026. Working name only; rename freely.

`docs/vision.md` says what the project is for. Every Decided and Open item here is weighed against it.

This is the reference for building an analytics view system in which a view is described once, as data, and the container it lands in decides how to present it. It compiles the design work so far and the lessons from a working prototype, which left the repository on November 24, 2026 (Decided 52).

**How to read the status labels.** Each section is marked one of:

- **Proven:** built and exercised across views, widths, heights and data states.
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
spec ──► expand ──► plan ──► scene ──► fit ──► painter
 ▲        (presets)  ▲   (no size)   (a room)   (DOM first; any surface)
 │                   │
 └─ query ──► result ┘        container: its own size, and the rules a context hands it
```

| Step | Input | Output | Owns | Status |
|---|---|---|---|---|
| **Catalog** | — | Metric and dimension definitions | What names mean; units, polarity, additivity | Proven (as a stub) |
| **Query** | `spec.query` | `{ rows, totals, meta }` | Fetching. Stubbed with fixtures today | Proven (fixtures only) |
| **Expand** | Spec with `use` | Spec with `layers` | Preset library | Proven |
| **Plan** | Expanded spec, result, the context's rules | A plan: layout, layers with roles, guides, the tldr prose. It takes no size | What a spec asks to have drawn | Proven |
| **Scene** | Plan, result | Flat list of shapes in ratios of their part, with stable keys | What is drawn | Proven |
| **Fit** | Scene, a room, the fit rules | The parts that show there, what else is hidden, the switches set | How a view gives way when room is short (section 10) | Proven: `fitTo` in core, and the same rules compiled to container queries |
| **Painter** | Scene, fit | Pixels | Appearance, and where each part is placed | Proven: HTML and CSS (`packages/dom`). SVG and dot grid were the prototype's, and are not built here |

Everything up to and including the scene is pure and has no DOM. d3 is used only for scales (`d3-scale`), path geometry (`d3-shape`) and array helpers (`d3-array`). No chart library.

**Deliberately deferred:** the query coordinator, DuckDB-WASM, WebGPU, brushing, a board element, and the semantic compiler. See section 20.

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
| **Container** | Wherever a view renders. It owns its size, and is handed the rules a view is fitted by. Formerly "host" |
| **Context** | The surface that holds containers: a panel, a toolbar, a dashboard, an agent. It lays its containers out by a scheme of its own, and hands them a durable rule set once, as it hands them a token set |
| **Plan** | What a spec asks to have drawn, with no size: layout, layers with roles, guides and the sentence |
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

- **The names in this document are the fixtures'.** Another catalog has its own (`bucket` for `date.day`, `page_views` for `pageviews`), and a spec uses the names of the catalog it is drawn against.
- **Each name is defined exactly once,** outside both the data and the views. A view refers to `visitors`; it never carries a formula.
- **Totals come from the engine.** A view never sums the rows it happens to receive, because many metrics are not additive. Visitors in v1 are counted per day, so a range total is a sum of daily counts and must be labelled as one (`rangeTotal: "sum of daily"`).
- **The unit says how a value is written,** wherever it is written: the tldr value, a tick, a row, the readout, the table, the prose. The units are `count`, `ratio` (a rate from 0 to 1), `percent` (one from 0 to 100), `ms`, `s`, `bytes` and `rank` (a place in an order, 1 the first), and a currency's ISO 4217 code in lower case (`usd`, `eur`) for money in that currency's own units: dollars, not cents. Each currency is a unit of its own, so two never share an axis and nothing adds them. An unknown unit is an error. A `number` dimension has no unit yet, so load time is still a bare number.
- **A metric may carry its definition:** what the number counts, caveats included, in a sentence or two. It rides on the tldr value as its `note`, and `<ua-view>` shows it when the number is pointed at. It is too long to stand under the number, and the tldr prose does not say it.
- **A time value is said as the engine wrote it,** and written the same wherever it is: "Sep 8" on an axis, a row, a legend and in the readout. Its date and its time of day are read from the string, and an offset is not applied: an engine names a bucket by the clock where it cut it, so `2026-09-08T00:00:00+02:00` is "Sep 8" on every machine, and the viewer's time zone is never asked. So a result has no time zone, and an engine that sends instants cut in another zone writes each as that zone's clock time before the view has it (an adapter's work; Open 17). The forms are a day (`2026-09-08`), a day and time with a `T` or a space and with or without an offset (`2026-09-08T15:00:00Z`, `2026-09-08 15:00:00`), a month (`2026-09`, "Sep 2026") and an ISO week (`2026-W36`, said by the Monday it starts on, "Aug 31"). A bucket on an hour of the day reads "Sep 8, 3 PM". Any other value of a time dimension is an error that names these forms, raised by the plan before anything is drawn. The grain is read from the value, because neither the catalog nor the result states it, so the midnight bucket of an hourly result reads as a day. Valid grains are among the properties below.
- **A dimension whose values are codes says so,** with `values`. `country` is the one kind: an ISO 3166-1 alpha-2 code in capitals, written as the country's name wherever a value is written. An empty code reads as no value, and what is not a code is written as it came.
- **Polarity drives delta colour.** `up` means an increase is good, `down` the reverse, `none` means no judgement.
- **`instant`** marks a metric with no range and no prior period, such as people present now.
- **The label is the only name a view has for a metric or a dimension,** and every word it says of one is made of it: "Revenue: nothing yet", "Open carts: 3 right now; the top sku is A-100 (2)". Core holds no noun of its own, so it cannot say "7 people" or "on the site". Nor does it make a noun of a label: the label leads and a colon follows, so one that is a phrase reads too, "Came back: nothing in this period yet" and not "No came back yet". A catalog that wants those words needs a property for them, and that is Open (section 19, Open 11).
- **How each unit reads.** `count` is a number, shortened where room is short ("13.4k"). `ratio` and `percent` are both written as a percentage ("5.8%"). `ms` and `s` are a length of time ("27.6s", "3m 48s"). `bytes` is a size. A currency is written with its symbol ("$4,333"). A `rank` is written as a place, "1st", "2nd", "23rd", and as the bare number on a scale of ranks. A value that is null is written as a dash, and never as zero.
- **The unit `rank` has a scale of its own** (built October 12). On y it runs from 1 at the top down to the largest rank in the rows, with a tick and a grid line for each rank, and for every few of them past ten. On a short plot the first and the last stay. It holds no zero: what is no rank, such as the zero a bar or an area starts from, is at the foot. A metric may be in it, and so may a companion.
- **A companion's unit is its metric's, unless the catalog has an entry for the companion** (decided October 12). `response_time@p25` is in milliseconds because `response_time` is, and nothing need say so. A companion that is not in its metric's unit, a rank or a share of a count, has an entry in `metrics` under its whole name, `"pageviews@rank": { "label": "Rank", "unit": "rank", "polarity": "down" }`, and its unit, label and polarity are read from there: its axis, its ticks, the readout and the table all follow. Core reads no suffix to know any of this, so `@rank` and `@share` mean nothing to it: the same companion under a catalog that has no entry for it is drawn in its metric's unit. An entry does not make a companion something a query can ask for (section 5). In rows, a `text` layer on a companion that has an entry is a column of values with a header, as a metric's is.
- **A metric may say what it is read against,** with `domain` (least, then most), `target` and `bands`. The `gauge` preset needs `domain`; a gauge and a bullet graph mark `target`. A dimension of type `number` is one the engine has cut into bins: each row holds where its bin starts, and where it ends as `<dimension>@end`. These are built here and are in the schema. They are still proposals to the API's owners (section 19, Open 11).
- **A name is an opaque string.** `date.day`, `bucket`, `revenue.usd` and `page_views` are all names; a dot means nothing to the grammar. Only `@` is read: `<name>@<suffix>` is a companion of `<name>`.
- **Unknown is null, not zero.**

Properties the full catalog will need but the stub lacks: format, thresholds or bands, valid dimensions per metric, valid grains, approximation and coverage, identity definition for people-counts, hierarchy on dimensions, and a colour role on dimensions.

The v1 metric list the catalog must eventually cover: visitors, page views, unique page views, engaged time, top pages, referrers, channels (including AI assistants), UTM, country, device, conversions and custom events, revenue by channel and page, and present now.

---

## 5. Query and result

**Status: Proven with fixtures. The real query layer is deferred.**

A query is written in catalog names:

```json
{ "metrics": ["visitors"], "by": ["date.day"], "range": "28d", "compare": "previous", "limit": 8,
  "where": { "channel": "Search" } }
```

| Field | Notes |
|---|---|
| `metrics` | Required. The first is the primary metric |
| `by` | Zero, one or two dimensions. With two, rows come back long, one per pair, and the result carries `totalsBy`: the engine's totals per value of each dimension |
| `range` | `"28d"` style. Optional: where the answer's `meta.range` names none, the prose names none. A count of days, or `"now"` for an instant. Presets and custom ranges are Open: until they are settled, a value in another form is refused by name |
| `compare` | `"previous"` or absent. Other modes (year over year, baseline) are Open |
| `limit` | Top-N for categorical dimensions |
| `where` | A filter, by dimension: the answer is of the rows where every dimension named holds what is said of it. See below |

**A filter (`where`, Decided 48).** Each dimension is held to one of three things, and a dimension here need not be in `by`:

```json
{ "where": { "channel": "Search" } }
{ "where": { "channel": ["Search", "Social"], "device": "Mobile" } }
{ "where": { "date.day": { "from": "2026-09-21", "to": "2026-09-27" } } }
```

| Form | Holds for |
|---|---|
| A value | That value of the dimension |
| A list of values | Any of them |
| `{ "from", "to" }` | Every value from the one to the other, both included, as the engine names and orders them: a day, where a bin starts. Either end may be left out. For a time or a number, and refused on a categorical dimension, which has no order to run along |

- **Dimensions are joined by "and".** There is no "or" between two dimensions, no "not", and no threshold on a metric. What needs one is a query for another tool.
- **The engine applies it, and says so.** Its answer carries the filter back as `meta.where`. Core filters no row and sums none: a filtered total is the engine's, as every total is.
- **An answer that is not of the query's filter is refused.** `resolve` compares `query.where` with `meta.where` by what they hold (a value is a list of one, and order does not count) and names both where they differ. Without it a spec that asked for some rows would be drawn from an answer of all of them, or the other way about, and the view would say one thing and show another. It is the stale answer of section 13, caught for a filter.
- **The view says it.** After its sentence: "Filtered to channel Search or Social, and device Mobile." (section 16), and in what it says of itself (section 10.4). It paints no chip: a filter's control is chrome, and the surface's.
- **The filter comes before the ranking and the limit:** the first values are the first of what is left.
- **A filter that holds for nothing** is an answer of nothing, `meta.empty`, which still says its filter.

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

An answer to a query with `where` has it in its `meta` too, as the query wrote it.

- A comparison is delivered as a companion field, `metric@previous`, aligned row by row. It is null when there is no prior data.
- Statistics arrive the same way, as companions the engine returns: `metric@p25`, `metric@lower`, `metric@running`, `metric@rank`, `metric@cumulative`, and `dimension@end` for a bin. One that is not in its metric's unit has a catalog entry of its own (section 4). Core computes none of them. A query cannot yet ask for one by name; that is Open.
- A spec drawn against an answer that already exists names metrics that answer has, in any order and not necessarily all of them: the first named is the primary metric. Its `by`, `range` and `compare` are the answer's. Leaving `limit` out keeps every row the answer has.
- A total may be null, where the engine has no figure for the range. It is written as a dash. Nothing is compared with it: no change is shown or said, where a missing `metric@previous` is "No prior period". Nothing is a share of it either, nor of a total of zero: a share view says each value in place of its percentage and draws no segment, and the rows are never summed to make a total.
- A metric's value, or a companion's, is a finite number or null, in a row and in the totals. `NaN`, an infinity, a string or `undefined` is refused, as an error that names the field and the row.
- `partial: true` marks an incomplete bucket (today).
- `meta.empty: true` marks a period with no data at all.

The fixture engine has three data states: `typical`, `no-prior` (comparison requested, none available) and `empty`. Keep all three as test fixtures.

It counts no events, so it has none to filter. It answers `where` from the pairs it already makes: a dimension the query is not by is asked for beside the ones it is, the rows that hold are kept, and what is left is added up. So a filter agrees with the query by the same dimension row for row, which `test/where.test.ts` holds. Its limits are its own: it makes pairs and no triples, so a dimension filtered past two in all, `by` and `where` together, is taken as independent of them, and the share its values hold of each metric scales what the pairs give; and it filters only metrics that add up over rows, and refuses another by name. Its pairs do not add up to what a query by one dimension returns, which it has always said of itself, so two views of one board may differ by a few percent under one filter.

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
| `facet` | string | One of the query's dimensions. The spec is then a view for each of its values, on the same scales. See "A facet", below |

The spec says what to show and nothing about how. Whether the tldr value or a guide appears is decided by the container's rules (sections 8 and 10). `keep` is the one presentation lever an author has.

A layer:

| Field | Meaning |
|---|---|
| `mark` | `line`, `area`, `bar`, `rule`, `text`, `dot`, `tick`, `cell`, `arc`, `unit`, or the name of a custom mark registered in code |
| `encode` | Channel to field: `x`, `y`, `x2`, `y2`, `color`, `detail`, `size`, `text`, `angle`, `radius`. A field is a dimension name, a metric name, a companion the result returns (`metric@p25`), or a number (for a rule, or an arc's inner radius). In rows, `color` paints each row: the rows' own dimension is a colour for each, and a companion of it (`source@kind`) paints rows that share a value alike. Built October 8, for the sidebar test case. `detail` is one of the query's dimensions: it splits the layer into a series for each value, as a dimension on `color` does, and paints none apart. Every series is in the layer's own paint, there is no legend and no label at a line's end, and the limit of six series does not apply, since no series colour is spent. A layer in a plot is split once, by `color` or by `detail`, and a layer split by `detail` takes no `stack`. Read in a plot with a dimension on x; built October 12. In rows it is read by a `dot` or a `tick`, which then has one to each pair of a row and a detail value, drawn at half strength, and in a plot of points a `dot` with one dimension on `color` and the other on `detail` is a point for each value of `detail`'s, coloured by `color`'s (step 4, October 12). On an `arc`, `angle` and `radius` take a metric and a dimension between them, and which holds what is the form (section 7, the `arc` row): a number on `radius` is the inner radius, a metric there is how far each slice reaches, and a dimension there is a ring for each value. `detail` on an `arc` split by `color` is a second ring; built October 12. `x2` and `y2` are the second end of a `bar`, a `rule` or an `area`; a `rule` or a `bar` may start at a number, and with all four a `rule` is a line across a plot of points. `size` on a `bar` is its column's width, in a plot of shares. A `bar` in rows with nothing on `x` is the range behind the row's marks |
| `series` | `"previous"` draws the comparison companion of the metric. Comparison is a property of a layer, not a second metric. `"delta"`, on a `text` layer in rows, is the row's change, painted by polarity |
| `role` | `primary`, `comparison`, `reference`, `context`. Defaults: a `previous` series is `comparison`, a `rule` is `reference`, everything else is `primary` |
| `stack` | `"zero"`, `"normalize"` for share of whole, `"center"`, or `"diverge"`, on a layer split by `color`, and not by `detail`. `"diverge"` sets the first half of the series below zero and the second half above it, in their order, and with an odd count the middle one half on each side; its axis counts away from zero on both sides (built October 12). A `bar` split by `color` or by `detail` with no `stack` sits beside its neighbours. In rows, `stack` is what lets a bar's `color` be the query's second dimension: each row's bar is divided into a series for each of its values (built October 12) |
| `sweep` | `"half"` for an `arc` that is divided by `color`, or that reads a metric against its range. Refused with a dimension on `angle` or on `radius`: those go all the way round. Also for a `unit` with a metric on `angle`, whose seats sit round a half circle and no other way. The one layer field that is neither data nor role |
| `label` | Text for a rule |
| `at` | On a `rule`, in a plot whose x is a time, a category or a number in bins: the value of x it stands at, or a list of them. A value, where what is on a channel is a field. See "A rule at a value", below |
| `align` | `"end"` for right-aligned text. On a `tick`, `"start"` or `"end"` is the half of it to that side of its band's middle (built October 12) |
| `paint` | Override the paint token. `"delta"` is the paint of the metric's change over the range: good or bad by its polarity, and the layer's own where there is no change to judge. Built October 8, for the sidebar test case. `"direction"` is for a `bar` or an `area` with two ends, and is refused on anything else and beside a dimension on `color`: each bar is painted `delta.good` or `delta.bad` by which way it runs from its first end (`x` or `y`) to its second (`x2` or `y2`) and the metric's polarity, and an area is cut where its two ends cross and each piece painted so. Where the polarity is `none` the mark is in the layer's own paint. Nothing is painted by direction unless a layer says so. Built October 12 |

Paint tokens an author may name: `series.1` to `series.6`, `compare`, `rule`, `ink`, `ink.muted`, `delta`, `delta.good` and `delta.bad`. `direction` is not a token: it is the one value of `paint` that asks for two, `delta.good` and `delta.bad`, mark by mark. A scene also names `band.1` to `band.3`, for the parts a metric's catalog `bands` divide its range into, the least first: three neutral steps, and not an author's to choose. A layer with no `paint` takes `series.1`, or `compare` for a `previous` series, or in a plot whose layers measure several metrics the series colour of its own metric, and that holds for a bar or an area with two ends too; a layer split by a dimension on `color` takes a series colour per value, and one split by `detail` keeps its own for every value. The steps of the two colour ramps, `seq.1` to `seq.10` and `div.1` to `div.9`, and `seq.none`, are the colour scale's and not an author's: a metric on `color` is quantized to them, and which ramp it is on is read from its values (decision 33).

**A rule at a value** (built November 23; Decided 46). A reference line at a number stands on a scale: `{ "mark": "rule", "encode": { "y": 1000 } }`. A plot whose x is a list of values, a time or a category, has no number to stand at, and a string on a channel is always a field. So the place is said as a value, in the layer field `at`, and the rule encodes nothing:

```json
{ "query": { "metrics": ["visitors"], "by": ["date.day"], "range": "28d" },
  "layers": [
    { "mark": "line", "encode": { "x": "date.day", "y": "visitors" } },
    { "mark": "rule", "at": "2026-09-21", "label": "Launch" }
  ] }
```

It stands the height of the plot at that value's place, drawn as any reference is, with its label beside it at the top. A list of values is a rule at each, all with the layer's one label; rules that are named apart are layers apart. A value is matched to the rows as it is written, so a date is in the form the engine returns. One the axis does not have is not drawn, and is no error: a date outside the range leaves the view as it was. `at` is refused on any other mark and in any other layout, and beside anything on the rule's channels.

**Colour by a metric in a plot** (built November 23; Decided 47). A `bar` or a `dot` in a plot takes a metric on `color`, as a `cell` does in a grid. Each mark is then a step of the sequential ramp, by its row's value, and the ramp stands under the plot as its key: the least value, a swatch for each step, the most, and a swatch for no value where a row has none. A bubble chart may have the ramp and the key to sizes together, each on a line of its own under the plot. A layer split by `detail` is painted mark by mark, each by its own row.

```json
{ "query": { "metrics": ["visitors", "page_conversion"], "by": ["page"] },
  "layers": [{ "mark": "bar", "encode": { "x": "page", "y": "visitors", "color": "page_conversion" } }] }
```

A plot's colours say one thing. So one metric paints a plot, whichever layers name it; a layer it paints states no `paint`; and it is refused beside a split by a dimension on `color` and beside layers that are told apart by the metrics they measure. A `line` and an `area` take no metric on `color`: one path has one paint. The ramp stays as long as the axes do. Under their need a plot has no room for it, so it goes and the marks are drawn in one paint, as a legend's series are (the `labels` rule, `split: plain`): what a colour meant goes with what said it. The readout says both metrics of a mark either way.

**A facet** (built November 23; Decided 26 and 45). `facet` names one of the dimensions in the query's `by`, and the spec is then a small board: a view for each value of that dimension, in the engine's order. Each is the spec without the facet, asked of that value's rows alone, so the layers do not encode the facet's dimension, and a preset is filled from the dimensions that are left. With the facet as the only dimension each view is a number, and needs no layers: an instrument panel.

```json
{ "use": "line", "facet": "channel",
  "query": { "metrics": ["visitors"], "by": ["date.day", "channel"], "range": "28d", "compare": "previous" } }
```

Core gives the views and draws none: `facets(spec, result, catalog)` returns each one's `key`, `label`, `spec` and `result`, and a surface draws each as it draws any view, with `resolve`, `buildScene` and `fitTo`. `resolve` refuses a spec with a `facet`, since it has no one plan.

- **Totals are the engine's.** A view's totals are its value's row of `totalsBy`, or its own row where the facet is the only dimension. With neither a view has no number: none is summed from its rows.
- **Scales are shared.** Every scale of every view takes the widest domain any of them would take alone, so a small value is drawn small: the y scale of a plot and its x where that is a quantity, a list's track, how far a slice or a ring reaches, the colour ramp, the sizes of dots and symbols, and what a `unit`'s glyph is worth. It is said as data on each view's result (`Result.domains`, by the scale's name), so any surface that builds the scene shares them. A whole is its own: the shares of a pie or a share bar are of their own view. A list of values on an axis is each view's own rows, so the engine must return every pair for the views to line up.
- **A spec says no columns.** Where the views stand is the surface's. The element holds them in a grid that wraps where a view would have less than `FACET_LEAST` (200 px, with `FACET_GAP` between), each its own container with its own fit rules, keyboard and measured pass, so nothing runs on resize; `facetColumns(inline, count)` is the same sum for a surface with no CSS. In a box the rows share its height. A view paints no title, so the element sets the value's name over each.
- **The table and the selection.** The table switch shows each view's own table. A selection one view proposes is heard on the facet, and the key set on the facet is marked in every view that has it.
- **Empty.** A result with no value of the dimension is one view, of the whole, which says that it is empty.
- **What it says of itself.** `explain` says how many views there are and of what, then what the first view says at its own room. In the element the views are a group named by the spec's `title`, and each is a figure named by its value, with its own sentence and table.

Not built: the y axis on the first view of each row only (the coverage plan's step 7, item 3), because CSS cannot say which view starts a row of a wrapping grid, and a view that gave up its axis would have a wider plot than its neighbour; every view keeps its own. A view's sentence does not name its value. A facet down the rows, for a ridgeline, is still the Uncommon plan's step 11. `partition` shares only its colour ramp and `link` nothing: their areas and widths are shares of their own whole.

**A board** (built November 24; Decided 45, 48 and 49). A board is views and the part of the query they share. It is a document of its own, `board/0`, and its schema is `packages/core/schema/board.schema.json`:

```json
{ "spec": "board/0", "title": "Traffic",
  "query": { "range": "28d", "compare": "previous" },
  "views": [
    { "spec": "view/0", "title": "Visitors", "query": { "metrics": ["visitors"] } },
    { "spec": "view/0", "title": "Visitors by day", "use": "line", "query": { "metrics": ["visitors"], "by": ["date.day"] } },
    { "spec": "view/0", "title": "Channels", "use": "bar-list", "query": { "metrics": ["visitors"], "by": ["channel"] } }
  ] }
```

| Field | Notes |
|---|---|
| `spec` | `"board/0"` |
| `title` | Shown by the surface |
| `query` | What the views share, each a part of a query: `range`, `compare` and `where`. Nothing else: metrics, `by` and `limit` are each view's own, and anything else here is refused by name |
| `views` | View specs, each whole and valid alone. Each needs a `title`, and no two the same: it is the view's key |

- **Params are the board's `query`.** There is no named variable, no reference and no expression. `range` and `compare` stand where a view states none, and a view that states its own keeps it.
- **One rule combines the views, and no field changes it.** A view is filtered by every dimension of the board's `where` but the ones it draws, which are those in its own `by`. On one it draws it keeps every value and is told which to mark (`selected`). So a list shows what was picked among the rest, and every other view is of the pick. A view's own `where` is its own, and wins.
- **A board has no state apart from itself.** Its `query` is its params at their values now. A surface that changes one, by a control or by a selection, holds a new board; the one it began with is how it resets.
- **Core gives the views and fetches nothing.** `boardViews(board, catalog)` returns each view's `key` (its title), the `spec` to run and draw, and what it is to mark, `selected`. A surface runs each query with the function it was handed and draws each view as it draws any. `boardSelect(board, proposal, catalog)` is the board after a view proposes a selection: the proposal folded into the board's `where` (`select`, section 13). Which view proposed it does not matter, since a datum's filter is of the dimensions its view draws.
- **No layout.** Where each view stands is the surface's. `<ua-view>` does not draw a board: a board needs a query function and something to keep it, and the element has neither. The bench's Board page is the reference surface, in about twenty lines.

Not built: a view that turns the board's `compare` off, which `compare` has no value for; and a board inside a board.


**Several metrics on one plot** (built November 20). Each is a layer of its own, and the layers are told apart as the series of a split are. A metric has a series colour, in the order the layers first name them, and every layer of it that states no `paint` is drawn in it: the fill under a line with its line. A `paint` that is stated stands. Each metric has an entry in the legend, named by its catalog label and in the paint its layer is drawn in, and where the legend's rule gives it up, a label where its line ends. A companion is its metric's, so a box's quartiles are one quantity and have no legend; one with a catalog entry of its own (`pageviews@rank`) is a quantity of its own. A `rule`, a `tick` and a `text` are set in ink and count for none. More than six metrics that state no paint is an error. Beside a split by a dimension on `color` the colours are the series', and the legend is theirs. Metrics of one unit share the y axis, however far apart their values are. Metrics of two units get an axis each; three units is an error.

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
- A layer that encodes what its mark does not read is an error that lists what the mark does read, in the layout it is drawn in (section 7, "What each mark reads"). Nothing a layer encodes is dropped without a word.
- A field that a spec, its query or a layer does not take is an error that lists the ones it does (built November 24). A size in a spec, or a filter written as `filter`, was read past, and the view drawn without it.
- There is no `intent` field. An earlier version had one; it was a chart type under a new name and was removed.
- There is no `headline` field and no `guides` field. Both were presentation switches and were removed on October 7; the schema rejects them. The container's rules decide what they used to.

The JSON Schema for a spec is `packages/core/schema/view.schema.json`, and the catalog's is beside it. A board's is `board.schema.json`, which holds each of its views to the view's. It is the contract agents write against. It cannot check a field against a result, a preset's name, or a custom mark's: `resolve()` does, and its error names the fix.

---

## 7. Marks, transforms and layouts

### Marks

| Mark | Channels today | What comes with it | Status |
|---|---|---|---|
| `line` | x, y, color, detail | Connects neighbouring rows, with a curve that never leaves the values it joins, so x must be ordered. Split by `detail` its lines are drawn light, so where many run together reads darker. On a `number` dimension whose rows carry `<dimension>@end` it is drawn as steps: flat across each bin and upright at its edge, as a bar there has no gap. With a metric on x as well as on y it joins the points in the engine's order, straight from each to the next: the dimension that keys the rows is the order, so by a time dimension it is the path through time. With a metric of unit `rank` on y, first place is at the top | Proven; split by `detail`, steps, the joined points and the rank scale built October 12 |
| `area` | x, y, y2, color, detail | Fills to a zero baseline, or between two ends. Over a `number` dimension's bins it is steps, as a line is. Between two ends with `paint: "direction"` it is cut where they cross, and each piece is a gain or a loss. Stacked about the middle (`stack: "center"`) it has no value axis. Refused with a metric on x: there is no one way along x to fill under | Proven; split, stacked and ranged forms built October 8; split by `detail`, steps and paint by direction built October 12 |
| `bar` | x, y, x2, y2, color, detail, size | Has a baseline, so the scale holds zero. In a plot `color` may be a metric, which paints each bar off the ramp (section 6, "Colour by a metric in a plot"). With two ends it floats, in the layer's own paint, or with `paint: "direction"` as a gain or a loss by which way it runs. Its first end may be a number where its second is a field (`x: 0, x2: "metric@high"`): the same bar as one written the other way, and by direction one that runs from the number to the value, so a bar from zero to a gain is a gain. Bars of one metric that go both ways from zero are still painted as gains and losses with nothing said In rows, stacked, it is divided by the query's second dimension. With a metric on `size`, in a plot of shares, its column is as wide as its x's share of the engine's total. In rows with nothing on x it is the metric's catalog `domain` behind the row's marks, divided at its `bands` | Proven; split, stacked, signed and ranged forms built October 8; split by `detail` built October 12; paint by direction made the layer's to ask for October 12; divided rows, `size` and the range built October 12 |
| `rule` | x or y (a constant), or `at` (a value of x), or fields per row with x2 or y2, or all four | A reference line with an optional label, at a number or at a value of the list on x (`at`: a date, a category), or a segment per row, which may run from a number to a field or from a field to a number. With x, y, x2 and y2 it is a line across a plot of points: one line where all four are numbers, drawn as a reference is and with no label, and a line for each row where any is a field | Proven; constant on x and the per-row form built October 8; a number as the start and the line across a plot built October 12 |
| `text` | y, text; in a plot x, y, text | A label per row, a column of values, or a label on a point | Proven in rows; in the plot built October 8 |
| `dot` | x, y, size, color, detail | A point. Its radius is the painter's, in pixels. In a plot `color` may be a metric, as on a bar. With a dimension on both x and y it stands in a grid, in each pair: `size` is a metric, read by how far it is from zero, and `color` may be a metric where no `cell` has one. In rows with a dimension on `detail` a row has a dot for each of its pairs, at half strength so that where they lie over each other the row reads darker | Built October 8; in a grid October 12; several to a row October 12 |
| `tick` | x, y, detail | A short stroke across its band at a value, or with `align` the half of it to one side of the band's middle. In a plot of points, with the plot's metric on x and nothing on y, it is a stroke at the foot of the plot for each row: a rug. In rows it may be several to a row, by `detail`, as a dot may | Built October 8; `align`, the rug and several to a row October 12 |
| `cell` | x, y, color | Both positions discrete; colour quantized to a ramp: `seq`, or `div` where the values or the catalog's `domain` cross zero, with zero in its neutral middle step and both arms measured by the end farther from zero. No value is `seq.none` on either. With no x it is one column and with no y one row, a strip. A binned dimension's row is labelled by its bin, and along the foot at its edges; a binned dimension on y beside another on x reads from the foot, its least bin lowest | Built October 8; the strip October 9; the diverging ramp October 12 |
| `arc` | angle, radius, color, detail | Its own mark. No general polar coordinate system: `angle` and `radius` take a metric and a dimension between them, and there are four forms. **A metric on `angle`, a dimension on `color`:** a segment for each row, its share of the engine's total; a number on `radius` is the inner radius. With a second dimension on `detail`, a ring outside it divides each segment among that dimension's values, lighter and in the segment's colour, with no legend entry: the query is by the two, and a segment's span is the engine's `totalsBy`. **A dimension on `angle`, a metric on `radius`:** an equal slice for each row, in the engine's order, reaching out to its value on a square-root scale, so its area carries the value. It starts at the centre and is drawn in one paint, with a label for each slice round the rim. **A dimension on `radius`, a metric on `angle`:** a ring for each row, six at most, the first outermost, swept against the catalog `domain`, or the largest row where there is none. With nothing on `angle` it is the whole ring, faint. The same dimension on `color` gives each ring a series colour and a legend entry that says its value. **A metric on `angle` alone:** read against its catalog `domain` | Built October 8; data on `angle` and `radius`, and the second ring, built October 12 |
| `unit` | x, y, color, angle | A value drawn as counted glyphs, one for so many, where a `bar` or an `arc` would draw a length. What a glyph is worth comes from the data. It takes no second end, no `stack`, no `series` and no value below zero | Built October 12 |

"Built October 8" means built, tested and looked at in headless Chromium by the agent that built it. What each one found is in `docs/chart-coverage-plan.md`, section 8.

**The `unit` mark has five forms, and its channels choose between them.** No field names one.

| On its channels | Layout | Draws | A glyph is worth |
|---|---|---|---|
| A dimension on x, a metric on y | `cartesian` | A stack of dots up from the axis for each value. On a binned number dimension it is the Wilkinson dot plot | The least of 1, 2 and 5 times a power of ten at which the largest value is ten glyphs or fewer |
| A dimension on y, a metric on x | `rows` | A run of dots along each row's track, beside its label | The same |
| A metric on x, a dimension on `color` | `band` | A grid of a hundred cells, a run of them and a series colour for each value, with the band's legend | A hundredth of the engine's total. The cells are shared out by largest remainder, so values that make up the total fill the grid exactly; under a `limit` the cells left over are the rest, painted as no value |
| A metric on x, and no dimension in the query | `band` | The same grid, lit up to the metric's place in its catalog `domain`, under the number | A hundredth of the domain |
| A metric on `angle`, a dimension on `color`, `sweep: "half"` | `radial` | Seats round a half circle, a wedge and a series colour for each value | One of the metric while the engine's total is a hundred or fewer, and beyond that the round number at which it is a hundred seats or fewer |

A value is rounded to whole glyphs, and a value above nothing has one at least. A glyph is a dot or a square (decided October 12): icons wait for a glyph per metric in the catalog. Glyphs hold their shape: a grid's part states an `aspect`, and a dot states the room it has, `w` and `h`, of which the painter takes the lesser in pixels. A stack is on the plot's own y scale, so an axis or a `rule` reads true against it. Each form gives way, under 280 px across or under its own height, to the preset of the same query that needs less room (section 9): glyphs are counted, so they are never drawn smaller than can be told apart.

A mark carries only its shape and those constraints. Relationships between marks (stacked, overlaid, normalized) are transforms or layering, never part of the mark.

A custom mark registered in code and referenced by name is the escape hatch for anything the grammar cannot express (maps, Sankeys). Keep the spec small; do not let it grow an expression language. The registry is `registerMark` in `packages/core/src/marks.ts`. There are two: `geo`, in `packages/geo`, and `link`, in `packages/flow`. A custom mark says which channels it reads, in `reads` beside its fit rules, and is held to that as core's marks are (below). What it gives core is a scene in ratios and its fit rules, and what it gives a surface is a painter: it places nothing in pixels itself (Decided 43).

### What each mark reads

**Built November 20.** What a mark reads depends on the layout it is drawn in, and this table is the whole of it: a row for each mark in each layout, with the channels it reads there and what each may hold, the ones it is not drawn without, and the fields of the layer it has a use for. It is data: `READS`, `NEEDS` and `FIELDS` in `packages/core/src/reads.ts`. The rows below are held to them by `test/reads.test.ts`, which also holds every cell to be true: a sample draws it, or a probe there writes that channel another way and gets another scene. A custom mark states the channels it reads beside its fit rules (`reads`), and the fields (`fields`), and its layout is its name.

`resolve()` refuses what a layer says that is not here, by name: a mark its layout does not draw, a channel the mark does not read there, a channel holding what the mark takes no account of, and a field of the layer on a mark with no use for it: a `label`, an `align`, a `sweep`, an `at`, a `paint`, a `series` or a `stack`. It refuses a mark with nothing on a channel it needs. The error says what the mark does read, and where what was written is read. Until this was built each of these was dropped and the view drawn without it: a bar with a metric on `color` was drawn in one colour, a `text` beside a band's bar not at all, and a bar with nothing on `y` as a plot with no marks.

| Layout | Mark | Channels, the ones it needs in bold | Fields |
|---|---|---|---|
| `cartesian` | `line` | `x` dimension, metric; **`y`** metric; `color` dimension; `detail` dimension | `paint`, `series`, `stack` |
| `cartesian` | `area` | `x` dimension; **`y`** metric; `y2` metric, number; `color` dimension; `detail` dimension | `paint`, `series`, `stack` |
| `cartesian` | `bar` | `x` dimension; **`y`** metric, number; `y2` metric, number; `color` dimension, metric; `detail` dimension; `size` metric | `paint`, `series`, `stack` |
| `cartesian` | `rule` | `x` dimension, metric, number; `y` metric, number; `x2` metric, number; `y2` metric, number; `detail` dimension | `label`, `at`, `paint`, `series` |
| `cartesian` | `dot` | `x` dimension, metric; **`y`** metric; `color` dimension, metric; `detail` dimension; `size` metric | `paint`, `series` |
| `cartesian` | `tick` | `x` dimension, metric; `y` metric; `detail` dimension | `align`, `paint` |
| `cartesian` | `text` | `x` dimension, metric; **`y`** metric; **`text`** dimension, metric, companion; `detail` dimension |  |
| `cartesian` | `unit` | `x` dimension; **`y`** metric | `paint` |
| `rows` | `bar` | `y` dimension; `x` metric, number; `x2` metric, number; `color` dimension, companion | `paint`, `series`, `stack` |
| `rows` | `rule` | `y` dimension; **`x`** metric, number; `x2` metric, number | `paint`, `series` |
| `rows` | `tick` | `y` dimension; **`x`** metric, number; `detail` dimension | `align`, `paint` |
| `rows` | `dot` | `y` dimension; **`x`** metric, number; `color` dimension, companion; `detail` dimension | `paint`, `series` |
| `rows` | `unit` | `y` dimension; **`x`** metric; `color` dimension, companion | `paint` |
| `rows` | `text` | `y` dimension; **`text`** dimension, metric, companion | `align`, `series` |
| `rows` | `line` | `y` dimension; **`x`** metric | `paint`, `series` |
| `rows` | `area` | `y` dimension; **`x`** metric | `paint`, `series` |
| `band` | `bar` | **`x`** metric; **`color`** dimension | `stack` |
| `band` | `unit` | **`x`** metric; `color` dimension | `paint`, `stack` |
| `radial` | `arc` | `angle` dimension, metric, number; `radius` dimension, metric, number; `color` dimension; `detail` dimension | `sweep`, `paint`, `series` |
| `radial` | `unit` | **`angle`** metric; **`color`** dimension | `sweep` |
| `radial` | `line` | **`angle`** dimension; **`radius`** metric | `paint`, `series` |
| `radial` | `area` | **`angle`** dimension; **`radius`** metric | `paint`, `series` |
| `radial` | `dot` | **`angle`** dimension; **`radius`** metric | `paint`, `series` |
| `matrix` | `cell` | `x` dimension; `y` dimension; **`color`** metric |  |
| `matrix` | `dot` | **`x`** dimension; **`y`** dimension; `color` metric; **`size`** metric | `paint` |
| `matrix` | `text` | `x` dimension; `y` dimension; **`text`** dimension, metric, companion |  |
| `geo` | `geo` | `x` dimension; `color` metric; `size` metric | `paint` |
| `link` | `link` | `x` dimension; `y` dimension; `size` metric |  |
| `geo-tiles` | `geo-tiles` | `x` dimension; `color` metric; `size` metric | `paint` |
| `geo-hexes` | `geo-hexes` | `x` dimension; `color` metric; `size` metric | `paint` |
| `partition` | `partition` | `x` dimension; `detail` dimension; `size` metric; `color` metric |  |

A `metric` is one of the catalog's, or a companion the engine returns with one (`visitors@p25`): a quantity, as its metric is. A `companion` is one returned with a dimension (`source@kind`). A `number` is a constant.

The table says what one channel may hold. What a mark asks of several together is refused where the mark is drawn, in that code's own words: a second end that needs a first, a `size` on a bar that needs a plot of shares, a tick that needs a value on `y` unless it is a rug, a `label` on a rule for each row. Those errors come first: the table is asked once the scene has been built. One such rule is the plan's: the dimension a plot has a mark for each of, the one on x or under two metrics the one its points are keyed by, splits nothing on `color` and paints nothing, so it is refused there, and beside itself on `detail`. In rows that encoding is read, as a colour for each row. A mark, a channel or a field that is built is added to these tables in the same change.

**What was dropped, and is refused or drawn now** (built November 24; Decided 55). Each of these was found while the table was built, and was drawn wrong or not at all with nothing said:

- **Bars of several layers on one x** were drawn over each other. They sit side by side, as the bars of a split do, each metric in its series colour with its entry in the legend. A bar with two ends still lies over what it belongs to, as a box lies over its whiskers.
- **A band drew its first layer and dropped a second.** A band of two layers is refused, and so is a bar there with a `stack` that is not `"normalize"`: it was divided by share whatever its `stack` said.
- **`paint`, `series` and `stack` are in the table.** On a mark with no use for one it is refused: a `paint` on a `text`, a `series` on a `tick`, a `stack` on an `arc`. Two forms are refused by the plan, where the form is known: a `paint` beside a dimension on `color`, since a mark has one paint, and `series: "previous"` on a layer that encodes no metric. A custom mark says the fields it reads beside its channels (`fields`): `geo` reads a `paint`, for its symbols, and `link` and `partition` read none.
- **A view was checked only where it had layers left.** One whose every layer was of the period before, with no period before in the answer, is held to the table as any other is, so a spec is not valid without a comparison and refused with one.

`test/reads.test.ts` holds the fields as it holds the channels: each one listed is read by a sample or a spec there, and one that is not listed is refused wherever a sample would write it. A layer of the period before, where the query does not compare or the answer has no period before, is still left out and reported (`plan.dropped`), as it was.

### Limits, and why each holds

A limit is backpressure: it says where the grammar ends, and a refusal that names the next step is a signal an author can act on. Each is held for one of four reasons, and none is changed without that reason being answered.

| The limit | Why it holds | In its place |
|---|---|---|
| Six series colours, six rings round a centre, six sources in a Sankey | What an eye can tell apart | `limit` on the query; `detail`, for a series each in one paint; a list |
| Two units on one plot, and no third | What an eye can read against an axis | A view for each, on a board |
| No sum of rows, no share worked out of them, no quantile, bin or running total | What keeps a number true: many metrics do not add up | The engine's totals and `totalsBy`; a companion field |
| An answer that is not of its query, or of its filter, is refused | What keeps a number true | What the query returned, set with its spec in one step |
| No expression, function, variable or reference in a spec; a string on a channel is a field | What keeps a spec data: a page can take one from an author it does not trust | `at`, for a value; a companion, for what is computed; a custom mark, for what is drawn another way |
| No size, breakpoint or presentation switch in a spec | The vision: what a view looks like belongs to where it lands | The container's rules; `keep` |
| One layer in a band; one custom mark to a view, with the plot's `text` over it | A layout is an arrangement of parts, and these have one place for marks | A plot or a list; `places` |
| A query is by two dimensions at most; `where` joins dimensions by "and"; a range is a count of days or now | The engine's contract, which is Open with the API's owners | Another query; another tool |


### Transforms

`stack` is the only one: `"zero"`, `"normalize"`, `"center"` and `"diverge"`, on any axis and in a row's track. Binning, quantiles, density and running totals are not transforms: the engine returns them (section 19, Decided 25).

### Layouts

**This was the thinnest part of the prototype.** It detected one of three hard-coded layouts from the layers. A layout is now an arrangement of parts, chosen from a table of what is on x, y and color (`LAYOUTS` in `plan.ts`), and each mark is a function looked up by name:

| Layout | Trigger | Draws |
|---|---|---|
| `cartesian` | A dimension on x | line, area, bar, rule over a category or time axis, and a `unit`'s stacks |
| `rows` | A dimension on y | The ranked bar list: a bar behind a label and a value per row. A `unit` is a run of glyphs in the track. A `line` or an `area` runs down the list from row to row |
| `band` | A dimension on color only, or a `unit` with a metric on x and no dimension at all | One stacked, normalized bar with a legend, or a `unit`'s grid of a hundred |
| `cartesian` | A metric on x and on y | Points: `dot`, `text`, rules on either axis, and a `line` that joins them in the engine's order |
| `matrix` | A dimension on x and on y, or a `cell` with one on either alone | A grid of `cell`s with a ramp, of `dot`s with a key to sizes, or of both: one `cell` layer, one `dot` layer on the same x and y, or the two together. A diverging ramp says its low end, zero and its high end A `text` on the same x and y says a value in the middle of each pair, over the cells or the dots |
| `radial` | Anything on `angle` | `arc`s about one centre, and a `unit`'s seats, in a part that holds its shape. Under it the legend of what is on `color`, or round it a label for each slice of a dimension on `angle` (the `rim` part, which the `rim` fit rule gives up first). Its rows are the segments, slices or rings: the keys step through them, and up and down step out to a second ring and back. With a dimension on `angle` and a metric on `radius` it also draws the plot's `line`, `area` and `dot`, about the centre |
| a custom mark's name | A layer with that mark | Whatever the mark draws, and over it the plot's `text` at each of its places, where the mark offers them |

**A table is rows of `text` layers.** In `rows`, each `text` layer with a metric on `text` is a column of values, set at the end with `align: "end"`; one with the dimension on `text` is the row's label. With more than one column the columns get headers, from the metrics' labels. A bar is optional: rows with no bar, dot or tick are a plain table. Each column takes the unit of its own metric, so columns of different units, or of several currencies, are fine. A header cannot be authored, and a column that is not a metric is written raw.

```json
"layers": [
  { "mark": "bar",  "encode": { "y": "page", "x": "pageviews" } },
  { "mark": "text", "encode": { "y": "page", "text": "page" } },
  { "mark": "text", "encode": { "y": "page", "text": "pageviews" }, "align": "end" },
  { "mark": "text", "encode": { "y": "page", "text": "engaged_time" }, "align": "end" }
]
```

**A grid draws the plot's `text`** (built November 23, the first stage of Decided 44). A grid is a plot whose two axes are both lists, so a mark of the plot's that needs no quantity to stand at is drawn there by the plot's own function, handed the grid's places. A `text` on the grid's x and y says what is on `text` in the middle of each pair, over a `cell` or a `dot`: a heatmap with its values in its cells. A pair with no value says nothing. A surface shows the values in every pair or in none, by whether each fits its cell, which it measures. A `text` alone is refused, since the cells and dots are what a reader steps through, and so is a second one. A `tick`, a `rule`, a `line` and a `bar` are measured along an axis and have no place between two lists.

```json
{ "query": { "metrics": ["correlation"], "by": ["factor", "other_factor"] },
  "layers": [
    { "mark": "cell", "encode": { "y": "factor", "x": "other_factor", "color": "correlation" } },
    { "mark": "text", "encode": { "y": "factor", "x": "other_factor", "text": "correlation" } }
  ] }
```

**The `geo` mark** draws a map, and was the first custom mark. It takes one layer, alone in the view. `x` is the dimension whose values are region keys (a `country` dimension holds ISO 3166-1 alpha-2 codes). `color` is a metric to fill each region by, on the sequential ramp, or the diverging one where its values cross zero, as a `cell` is; `size` is a metric for a symbol on each region. Either or both. The boundary shapes and the projection are handed over in code, not in the spec.

```json
{ "query": { "metrics": ["visitors"], "by": ["country"] }, "layers": [{ "mark": "geo", "encode": { "x": "country", "color": "visitors" } }] }
```

**Text over a map** (built November 23, the fifth stage of Decided 44). A custom mark may offer its places: where each value of the dimension on its `x` is, in its own box (`places`, in `packages/core/src/marks.ts`). The plot's `text` is then drawn over it by the plot's own function, a label in the middle of each place: `geo` offers the middle of each region, where its symbol stands. The text takes the mark's `x` and says what is on `text`, a metric or the dimension itself. It is ranked by what it says, so where two would meet a surface keeps the one that says more, and it says nothing of a row the mark has no place for. One text to a view, and no other mark of the plot's: a `dot` there is the map's own symbol, on `size`. A mark that offers no places is still drawn alone, as `link` and `partition` are, which set their own names. The labels go where the map goes, to the list of the same query, and stand down while the map is brought in to one region.

```json
{ "query": { "metrics": ["visitors"], "by": ["country"] },
  "layers": [
    { "mark": "geo",  "encode": { "x": "country", "color": "visitors" } },
    { "mark": "text", "encode": { "x": "country", "text": "visitors" } }
  ] }
```

**A tile map is the same mark with other shapes** (built October 12). A tile grid map draws each region as an equal square roughly where the region is, and a hex tile map as an equal hexagon. Neither is a new mark. The shapes file holds a square or a hexagon for each region, under the region's key, and says `"planar": true`: its coordinates are x and y on a flat sheet, and the mark fits them to its box as they are, with no map projection. The registry holds one mark to a name, and a spec may not say which shapes to draw, since that would be a presentation switch. So a page that wants a map and tiles registers the mark once for each set of shapes, under a name each: `registerGeo(shapes, { name: "geo-tiles", presets: { color: "tile-grid-map" } })`, and a painter for that name, `registerPainter(geoPainterAs("geo-tiles"))`. The name is what a spec writes in `mark`, and the layer takes the same encodings.

```json
{ "query": { "metrics": ["visitors"], "by": ["country"] }, "layers": [{ "mark": "geo-tiles", "encode": { "x": "country", "color": "visitors" } }] }
```

Each name is a custom mark to the health check of section 9. Below the room a map needs, a tile map is the same ranked list. A tile carries no label yet: the mark names a region in its readout and the table, and nowhere on the tile.

**The `link` mark** draws a Sankey of one step, and is the second custom mark (built October 12, in `packages/flow`, with no dependency but core). It takes one layer, alone in the view, of a query by two dimensions. `x` is the source dimension, `y` the target and `size` the metric. Two columns of nodes, the sources on the left: a node for each value, in the engine's order, as tall as the engine's total for it, so a result with no `totalsBy` is an error. A ribbon for each row, as wide at each end as the row's share of the node it meets; a row whose value is null or zero has none. A source takes a series colour, so more than six is an error that names `limit`; its ribbons are that colour as a tint, and a target is neutral. A node's name is the key to it, so the names stay as long as the ribbons do: short of the room they need, 320 by 140 px, the view becomes the `heatmap` of the same query, with the sources down the side.

```json
{ "query": { "metrics": ["visitors"], "by": ["channel", "landing"] }, "layers": [{ "mark": "link", "encode": { "x": "channel", "y": "landing", "size": "visitors" } }] }
```

The target is on `y` because a custom mark cannot add a channel, and `x2` is kept for a bar, a rule or an area. A view of it says what any view says, the number and who leads its first dimension (section 16): a custom mark needs no sentence of its own.

**The `partition` mark** draws a treemap: a box divided by area, nested once. It is a custom mark, in `packages/partition`, and takes one layer, alone in the view. `x` is the dimension the box is divided by and `size` the metric each part's area is its share of. A second dimension on `detail` divides each part again. A metric on `color` paints every box a step of the sequential ramp, with the ramp under it; without one each value on `x` has a series colour, its children are in that colour, and more than six is an error that names the fix. Every area is a share of a total the engine gives: the whole box is the metric's total, a parent is its row of `totalsBy`, and a child is its value against its parent's. So with a `limit` the boxes stop short and the rest is left unpainted, as a band stops short of its end. Two dimensions without `totalsBy` is an error. A name shows only where it fits its box, and a child's only where its parent's does. Below the room it needs the view becomes a list of the same query: `bar-list` with one dimension, `pair-list` with two.

```json
{ "query": { "metrics": ["pageviews"], "by": ["section", "page"] }, "layers": [{ "mark": "partition", "encode": { "x": "section", "detail": "page", "size": "pageviews" } }] }
```

**A row may be divided by the query's second dimension** (built October 12). A `bar` with `stack` takes that dimension on `color`: the rows are the values of the first dimension, in the order the result first has them, and each row's bar is a series for each value of the second, end to end, in that dimension's own order, which is the engine's. Series colours follow that order, six at most, and a legend stands under the rows. It steps down as a band's does: to one line that names the series with the most, in its colour, and then to nothing, before the rows go. A row's text reads the engine's total for the row (`totalsBy`), and a share under `"normalize"` is of that total: no pair is ever summed. Such a track stands beside its label, as any track read by position does. Any other mark in rows is still painted by the row's own dimension.

```json
{ "query": { "metrics": ["visitors"], "by": ["age", "sex"] },
  "layers": [
    { "mark": "bar",  "encode": { "y": "age", "x": "visitors", "color": "sex" }, "stack": "diverge" },
    { "mark": "text", "encode": { "y": "age", "text": "age" } }
  ] }
```

With `stack: "diverge"` and two series that is a population pyramid; with five it is a Likert chart, the middle answer half on each side of zero. A row's track has no axis, so nothing there says a count: the readout does, and no count is below zero anywhere but in where it is drawn. A diverging stack of shares needs the engine to send the share as a metric, since `stack` holds one value.

**Several marks to a row** (built October 12). A `dot` or a `tick` in rows with the second dimension on `detail` has one mark for each pair, each at its own value on the row's track, all in the layer's paint and at half strength. That is a strip plot. There is no legend and no limit of six. The readout of a row says how many it holds and which has the most.

**The range behind a row's marks** (built October 12). A `bar` in rows with nothing on `x` is no mark of a value: it is the catalog `domain` of the metric the row's other marks put on the track, drawn as tall as the row and under them, in a part for each of the catalog's `bands`, painted `band.1` to `band.3` from the least. The track's scale then holds the whole domain. A metric with no `domain` has no range drawn, and that is no error, as a metric with no `target` has no tick at one. The bench's bullet graph has this layer. The gauge's bands are not drawn yet.

**The plot's marks about a centre** (built November 23, the fourth stage of Decided 44). The circle is the bend: a place round it is what a plot has along x, and how far out from the middle what it has up y. A spec says so as `arc` does, with `angle` and `radius`, and nothing else. With a dimension on `angle` and a metric on `radius`, a `line` runs round from each value's place to the next and closes, an `area` fills in from it to the middle, and a `dot` stands at each place: a radar. Each is drawn by the plot's own function and then bent, so a line's path is drawn about the middle as an arc's is, straight from place to place, and a dot is set in the part's box as a seat is. They are on the circle's one scale out, from nothing at the middle to the most of the layers at the rim: by distance where only lines and dots reach, and by area where a slice does, so over a rose a line meets the slices' ends. The layers reach by one metric, and `series: "previous"` is the period before. The names round the rim are said once, the rows are the places, and where no slice stands a place's share of the circle is what a reader points at and steps to.

```json
{ "query": { "metrics": ["visitors"], "by": ["weekday"], "compare": "previous" },
  "layers": [
    { "mark": "area", "encode": { "angle": "weekday", "radius": "visitors" }, "role": "context" },
    { "mark": "line", "encode": { "angle": "weekday", "radius": "visitors" }, "series": "previous" },
    { "mark": "line", "encode": { "angle": "weekday", "radius": "visitors" } },
    { "mark": "dot",  "encode": { "angle": "weekday", "radius": "visitors" } }
  ] }
```

**A line down a list** (built November 23, the second stage of Decided 44). A list draws the plot's `line` and `area`, by the plot's own function, on their side: a row's place down the list is what a plot has along x, and the track's scale what it has up y. A `line` with a metric on `x` runs from each row's value to the next, through the middle of each row, and an `area` fills back to where the track has nothing. It is on the scale the row's other marks are on, so it is in their unit, and a row with no value has no point. With `series: "previous"` it is the period before, dashed, down a list of this period's bars. Such a list is read by where its marks are, so its track stands beside its labels. The line is one mark to the list and not one to a row: its nodes are in a part of their own, `track`, which lies over the tracks of every row, and a surface turns them. It takes no `color` and no `detail`, and a reader steps through the rows as before.

```json
{ "query": { "metrics": ["pageviews"], "by": ["page"], "compare": "previous" },
  "layers": [
    { "mark": "bar",  "encode": { "y": "page", "x": "pageviews" } },
    { "mark": "line", "encode": { "y": "page", "x": "pageviews" }, "series": "previous" },
    { "mark": "text", "encode": { "y": "page", "text": "page" } }
  ] }
```

`rows` is a track per row: a label, a track with a linear scale that bars, dots, rules and ticks draw in, and columns of values. A facet is a view for each value (section 6, "A facet"). The plan and what building it found are in `docs/chart-coverage-plan.md`.

---

## 8. Roles, guides and the tldr value

- **Roles** let a container reason about a view without knowing what chart it is. `primary` is the thing itself. `comparison` is the same metric for another period. `reference` is a target or threshold. `context` is supporting ink, such as the area under a line.
- **Guides** are derived from scales. Axes, grid, tick labels and legends are never authored, and a spec cannot switch them on or off. They start on (both axes and the grid on a cartesian layout, the full legend on a band), and the container's rules decide when they go. One scale has no axis to show: a stack set about the middle (`stack: "center"`) is read by how thick each band is, and a scale that counts away from the middle says nothing true of that, so it has no y ticks, no grid and no gutter for them, and its bands take the height of the plot (decided October 12). Thickness is said by the readout, the legend's order and the table. Which encoding each comes from is said once, in `GUIDES` in `packages/core/src/guides.ts`: the plan reads a view's guides off its layers from that table, whatever its layout, and `explain()` and the check on the fit rules have it from there. An axis: a plot's positions and a grid's. A legend: a dimension on `color`, or in a plot the several metrics its layers measure. A ramp: a metric on `color`. A key to sizes: a metric on `size`, but for a bar's, which is its column's width. A rim: a dimension on `angle`. (Built November 20; until then each layout set its own.)
- **A guide is a key or a frame.** A key says what an encoding means: the legend, the ramp, the key to sizes, what a glyph is worth, the second y axis, a row's column headers, the names round a rim. The marks it keys cannot be read without it. An axis and a grid frame marks that still read by their shape, which is why a plot may give them up and stand bare beside the number. So no fit rule takes a key while the marks it keys are drawn, unless it puts a shorter form of the same guide in its place or has the marks drawn without the encoding. Eighteen rules did, and that was the audit's finding F2. All are closed (November 23), each by one of three answers: the key stays as long as its marks, a shorter form of it does, or the marks give up the encoding when the key goes. `test/guides.test.ts` holds every rule to it, core's and each custom mark's, and names the window a new rule would open.
  - **The second y axis** stays as long as the first. It went under 340 px once, and left a line in one unit to be read against the axis of another. Where the axes go and the plot stands bare beside the number, what is drawn on the second axis goes with it: a bare plot is of one unit, which is the number's. A scene's node says which axis it is on (`axis: 2`), and the `axes` rule takes `axis:2` with the axes.
  - **What a glyph is worth** stays as long as the glyphs. No rule takes the line but one that leaves the number alone. The room a `unit` form needs is its glyphs' and the line's together, and short of it the form becomes its plainer preset: a stack 160 px tall, a run 120, a grid read against a range 220, seats 200.
  - **A row's column headers** stay as long as two columns do. Short of height a list gives up rows, and never the names of the columns it still shows.
  - **A Sankey's node names** stay as long as its ribbons: the view becomes its grid at the size the names need (section 7).

  - **The legend, where nothing stands in for it,** takes the colours with it. In a plot a label at each line's end stands in for the legend, so the rule that swaps the two asks for a line or an area (a rule's `mark`, which is then a condition on the view's marks): bars and dots have no end to label, and keep their legend as long as the axes. It left them under 320 px once. Where the axes go and the plot stands bare beside the number, where a divided row is under 84 px tall and where a circle is under 88, nothing says which colour is which, so there is one colour: every mark a legend keyed is drawn in the first series' paint (the switch `split: plain`), as `detail` draws a split. A scene's node says that its paint is a legend's (`legend: true`), and one that was a tint is a tint of that paint. The pieces keep their gaps, so a row or a circle still says how it divides, and the number beside them is of them all.
  - **The ramp** is cut to a strip (`ramp: strip`): every step 7 px wide with no gap between them, its two ends still numbered and the neutral step still marked where it diverges, and no swatch for no data. A grid has it under 240 by 150, and a map and a treemap under the room their `guides` rule asks. It is not hidden while a cell is drawn.
  - **The key to sizes** is cut to its largest step (`size-key: most`): the metric's name, the biggest dot and the most it stands for. A plot has it under 320 by 160, and a grid and a map with their ramp. In the bare plot the dots are one size (`dots: one`), since nothing there says what a size means.
  - **The names round a rim** are thinned to about four (the fit target `rim.ranked`, under 230 by 120): the scene ranks them, about four spaced evenly round with no rank, and the rule takes the ranked ones. Four names are enough to read the rest by their place.

  A key cut down in place is still the key. The rule says so with a switch (`ramp: strip`, `size-key: most`) or a target inside the part (`rim.ranked`), `fitTo` reports it, and a surface draws that form.
- **A `unit`'s key** is a line under the glyphs that says what one is worth, "Each is 500", in the metric's own format. It is the part `unit-key`. There is none where a glyph is worth one, or a hundredth of a whole. It is the key to the glyphs, so it stays as long as they do: the glyphs give way to their plainer preset at the height the two need together (above).
- **The tldr value** is the primary metric's total from the engine, a delta if the query compares, and a derived note:
  - time dimension: the range-total caveat, such as "Sum of daily counts"
  - categorical dimension: "Top: /pricing"
  - categorical with `stack: "normalize"`: "Search 41%"
  - instant metric: "right now"

Where the tldr value appears is the container's decision, never the spec's:

- It is the whole view when there are no layers, and what remains at collapse.
- It is added beside the plot when the axes drop.
- It sits above the marks, when there is room for both, according to the rule `tldrValue.above`. The default is `instant`: only for an instant metric. A context can pass `always`.
- It sits above a `unit`'s grid that has no dimension, always: the grid says how far along its range the metric is, and not what it is. A departure from the line above, built October 12 and still to confirm.

Delta states: up or down with a percentage, "No change" (under 0.5%), "New" (prior was zero), "No prior period" (prior is null). Colour follows the metric's polarity.

---

## 9. Presets

**Status: Proven.**

A preset is a saved fragment of a spec with slots filled from the query: `$metric` and `$by`, `$split` for a second dimension, and `$metric2` for a second metric. A slot may carry a suffix, `$metric@p50`, for a companion the engine returns. It expands before the grammar runs, and nothing downstream knows its name.

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

The library ships the common charts and no more (`packages/core/src/presets.ts`; Decided 54). The three above are written out; the rest expand the same way. A form that is less common is written as its layers: the bench's samples show each one, a box plot and a waterfall, a bump chart and a waffle, and a code base that wants a name for one registers it, or hands `resolve()` a library of its own.

| Preset | The query needs | Draws |
|---|---|---|
| `line` | One dimension, time or ordered | A line over its filled area, and the period before as a second line when the query compares |
| `bar-list` | One categorical dimension | Ranked rows: a bar, the label and the value |
| `share-bar` | One categorical dimension | One bar divided by share, with a legend |
| `bar` | One dimension | A bar for each value, up from the axis |
| `grouped-bar` | Two dimensions: the axis, then the split | Bars side by side, a colour for each value of the split |
| `stacked-bar` | Two dimensions: the axis, then the split | Bars stacked |
| `stacked-area` | Two dimensions: the axis, then the split | Areas stacked |
| `pie` | One categorical dimension of six values or fewer (`limit`) | A circle divided by share |
| `donut` | The same | A ring divided by share, with the total in the middle |
| `pie-semi-circle` | The same | Half a ring |
| `gauge` | No dimension, and a metric with a catalog `domain` | The metric against its range, with its `target` marked and its `bands` behind |
| `heatmap` | Two dimensions: down the side, then across | A grid of cells coloured by the metric |
| `funnel` | Two metrics, a count then a rate, by a dimension in the engine's order | Rows with a bar, the count and the rate |

**A custom mark's package registers its own presets.** Core cannot name a custom mark, so the library cannot hold a preset that draws one. The package that registers the mark registers its presets beside it, with `registerPreset(name, { layers })` (`packages/core/src/presets.ts`), written in the same slots. `expand` looks in the library first and then in the registry, so a spec uses a registered name as it uses any other, and a fit rule's `fallback` may name one. Each registers the one that draws its mark, and `packages/partition` the list its treemap gives way to:

| Preset | The query needs | Draws |
|---|---|---|
| `choropleth` | One dimension whose values are region keys | A map, each region filled by the metric on the sequential ramp |
| `sankey` | Two dimensions, the source and then the target, and `totalsBy` in the result | A Sankey of one step: a node for each value, and a ribbon for each pair |
| `treemap` | Two categorical dimensions, a parent and its children, and `totalsBy` in the result | A box divided by area among the first dimension's values, and each part divided again among the second's (`packages/partition`) |
| `pair-list` | Two categorical dimensions | Rows, one for each pair, named by both. What a treemap of two dimensions becomes below the room it needs |

A page that registers the `geo` mark again for a set of tiles (section 7) may name a preset for it. The fixtures name none: their tile maps and their map of symbols are written as layers.

`gauge` is the one preset that takes no dimension. The schema does not say which presets take one (it cannot know a library's or the registry's): `resolve()` does, by name.

A name must be letters, digits, `_` and `-`, and cannot be one the library has. A name already registered is replaced. `customPresets()` lists what is registered. The registry is a map and two functions, as the one for marks is, and a name in it is unknown until its package has been loaded: the error for an unknown preset lists the library and the registry, and names `registerPreset`.

- The library ships the common charts. Users and agents add their own presets to it.
- A preset is named after the `@automattic/charts` component it replaces, where one exists: `line` for `LineChart`, `bar-list` for `BarListChart`.
- A `previous` layer is left out on expansion when the query has no `compare`.
- A companion is something the engine returns with a metric. A query cannot yet ask for one by name (section 5), so a preset that needs companions works only against a result that has them.
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

### 10.1 What the prototype did

The port ran this reducer too, until November 23 (Decided 43). Core no longer does: a plan takes no size, and how a view gives way is the rules of 10.2, read at a room by `fitTo`. This section stays as the record of what the prototype did and of where the ladder came from.

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
- The thresholds are still picked by hand. They moved from per chart type to per part, and since November 24 they are counted: forty, in one table (Decided 58).
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
.uav-plot { container: uav-plot / size; }           /* needs a definite height; use inline-size otherwise */
@container uav-plot (inline-size < 280px) or (block-size < 120px) {
  .uav-axis, .uav-grid { display: none; }
}
@container uav-plot (inline-size < 180px) or (block-size < 90px) {
  [data-role="comparison"], [data-role="reference"], [data-role="context"] { display: none; }
}
```

**Tier 2: a measured pass in script.** For what CSS cannot see.

- Tick thinning when labels would collide. Simple to build.
- Label placement on points and lines. Source or build properly; an occupancy-bitmap approach is the usual technique.
- Any threshold that depends on the data, such as how many ticks there are or how long the labels run.
- The plot set on whole device px (`packages/dom/src/pixels.ts`), so that a pixel face and a hairline are sharp: CSS cannot know where on the page a view stands. The element reads it after each paint, when its room changes, and when anything it stands in changes size, which is how a view learns that what is above it has moved it. Until November 24 it read only the first two, so a view moved by a caption or a view above it kept a move made for where it had been, and stood a fraction of a px off. A plot half way between two device px goes to the one before it, nearer the top and the start, always: read back after a move it is a hair to either side, and plain rounding sent it up on one load and down on the next. Those two were why a capture differed from the last by 1 px on a few frames with nothing changed.

**Tier 3: the reader, for surfaces with no CSS.** `fitTo(scene, room, rules)` in core reads the rules at a room and says the parts that show, what else is hidden and the switches set. `viewAt(spec, result, catalog, room)` gives the plan and scene with it, and follows a rule's `fallback` to the view the spec gives way to. An agent, a canvas or dot-grid painter and a native shell read a view's fit this way. It measures nothing.

Changing the data is a resolver's work and is not built: Top-N plus "other", coarser grain (daily to weekly), and downsampling to pixel resolution need new data, not new styles.

**One source of truth.** The per-element rules are data (`FIT_RULES` in `packages/core/src/fit.ts`): one declaration per part, naming a container, the room the part needs in width and height, and what is hidden, shown or switched otherwise. A rule may be for a view that holds one mark (`mark`) or for one kind of view (`has`: a plot of points, a row whose track stands beside its label). They compile to container queries for a browser, and `fitTo` reads the same rules in code. This rule set is what a context passes to its containers. Three things hold the two readings together:

- `test/fit.test.ts` holds the reader to the rules, and every sample at every room of the sweep to what the rules promise: a view always shows something, it is its number alone wherever a rule takes its marks, and no key goes while its marks stay.
- A rule names every part it takes, one that stands inside another among them, because a reader with no browser has no nesting to go by. A layout's painter may add CSS under a rule for how what is left is arranged, and never for which parts show.
- The bench's `check` reads each captured frame's room through `fitTo` and reports a frame where the element shows otherwise.

**What the rules do not say yet (Open 19).** The element settles these in its stylesheet or its measured pass. A surface with no browser has to see to them itself until each is a rule:

- whole rows trimmed to a height, and a ranked column given up by the width of its values;
- the number's shorter forms (under 160, 200 and 120 px, in `sizes.ts`), its note, and the prose rung where the number itself does not fit;
- a number wider than the hole of its donut;
- labels thinned where they would meet: ticks, line ends, points, the names round a rim, a Sankey's columns, a treemap's names, and the values in a grid's cells, which show in every cell or in none;
- a legend that wraps out of its room, and anything else that depends on how tall the content is.

The rules on the plot (`secondary` and `hole`) ask for the plot's own box, which only a surface that has laid the view out knows. `fitTo` passes over them where the room gives no plot, and `explain()` says they were not asked.

### 10.3 Constraints to design around

1. CSS can hide and restyle. It cannot re-query.
2. CSS cannot see collisions, and cannot express a threshold that depends on the data.
3. CSS only exists in the DOM.
4. Height queries need a container with a definite height. A container sized by its content can only be queried on width.
5. Container queries of this kind have been widely supported since early 2023. Style queries are still partial; do not depend on them.

### 10.4 Why a view looks as it does (Proven)

A spec that does not come out as its author expected is fixed in the spec, so the view says what it decided in the spec's own words. `explain(spec, result, catalog, room)` in core returns the layout and why the layers asked for it, every part the plan has and the place in the spec it comes from (`layers[0].encode.color`, `query.metrics[0]`, or `use "donut": layers[0]` for a preset's), and at a room each fit rule that holds: what it hides or shows, what it needs and what the room has, its id, and the lever where the spec has one (`keep`, a field, `compare`). A key a rule cuts down is said in its shorter form ("shown as a thin strip", "shown as its largest step", "thinned to about four"), and one it takes says what went with it ("hidden, and the marks it keyed drawn in one colour"). A rule on the plot is said to be "not asked" where the room gives no plot to measure. A filtered answer is said straight after the layout ("filtered to channel Search"), from `query.where`, with the lever that draws the whole. A plan knows no selection, so what a view marks of one is a surface's to add, with `selectedBecause`: "marked as selected: channel Search", from `selected`, and why the view is not filtered by it. `UaView.explain()` adds it. An entry with no lever is a default, and the rules are where it is fixed. `UaView.explain()` asks it at the element's own size and adds what the measured pass decided there: labels given up or cut short, the number's shorter forms, the prose rung.

The fit rules are the contract it reads, so a part the element hides that no rule names is a gap in the rules. Building it found two: the `axes` rule now names `y-axis-2`, and the grid's `marks` rule its axes and keys.

---

## 11. The scene

**Status: the ratio form is Proven. `buildScene` returns it, `<ua-view>` in `packages/dom` paints from it, and the golden scenes hold it; its fields are in `packages/core/src/types.ts`. What follows describes the placed scene, which is the prototype's. Core made one with `place()` until November 23 (Decided 43) and no longer does: this stays as the record of what a placed node holds, for the surface that next needs one.**

**The ratio scene's fields (Decided 51, November 24).** A node says where it is in the box it is in, its part's or in a list its row's track, in the same fields whatever its kind and whatever the layout:

| Field | What it says |
|---|---|
| `x`, `y` | Where it is. For a mark that runs along an axis, a bar or the fill under a line, where it reaches |
| `x2`, `y2` | Its other end, where it has one that is not the start of the axis |
| `w`, `h` | An extent: from `x` and `y` for a rect, about them for a glyph's room |

So a bar in a plot is `x` and `w` across, and up to `y` from `y2`. A row's bar reaches `x` from `x2` along its track, as a rule on the same track runs from `x` to `x2`. A band's segment is its share, `w`. A line is from (`x`, `y`) to (`x2`, `y2`), a dot and a label are at (`x`, `y`), and a path's point is (`x`, `y`), with `y2` where the fill under it starts above the bottom. An arc keeps its own fields, `a0`, `a1`, `r0` and `r1`. A custom mark's `places` gives `x` and `y` too.

`x` runs across from the start and `y` up from the bottom, for every node. So a rect with an extent stands on `y` and is `h` tall: a grid's cell, a cell of a `unit`'s grid, a treemap's box, which is in its parent's, and a Sankey's node. The bottom left cell of a grid is at `y` 0. Until the second stage of this work those four counted down from the top.

The number, a legend and a list's rows carry no position: a surface sets them in order. So this is what a generic placer needs (Open 20) and not that placer.

**The scene has a schema** (built November 24; Decided 56): `packages/core/schema/scene.schema.json`, `scene/0`. It is a draft, and says the scene as it is built: the fields above, an arc's own, each kind of node and what it must hold, the parts, and the paint tokens. `test/scene-schema.test.ts` holds every scene a sample builds to it, in every data state, so a field a builder adds without the schema fails there. A surface that paints a scene, or an author who writes one, has it to go by.

Until this the height up a plot was `v` on a bar and on a path's point and `t` on a line, a dot and a label, and a row's bar ran from `v0` to `v` beside a rule from `x` to `x2`. The plans that record earlier steps (`docs/chart-coverage-plan.md`, `docs/uncommon-coverage-plan.md`) use those names, as they were then.

A placed scene is `{ width, height, nodes, plot? }`. Nodes are flat and drawn in order.

| Kind | Fields |
|---|---|
| `rect` | `x, y, w, h, rx` |
| `path` | `d`, `fill` (boolean), `width`, `dash` |
| `line` | `x1, y1, x2, y2, width, dash` |
| `circle` | `cx, cy, r, pulse` |
| `text` | `x, y, text, anchor, baseline, font` (`tick`, `label`, `value`, `display`), and for `display`: `h, cell`; optional `halo` |

Every node also has:

- `key`: stable across renders, for example `primary:line`, `primary:bar:2026-09-08`, `seg:Search`. A layer's key is its role and mark, with `#2` for a second layer of the same role and mark; it does not count layers, so it holds when one drops. Keys are what make transitions and keyboard navigation possible. Duplicate keys are a bug; the sweep in `test/core.test.ts` checks for them. A result that says a dimension value twice still gets a key for each row: the repeat is `Google#2` (`rowKeys`), and the axis, legend and readout say its value as it is. Which of the two is the second is the result's order, so a host that has ids hands those over, not labels.
- `paint`: a token, never a colour.
- `layer`: `data` or `guide`.
- Optional `opacity`, `tx`, `ty`, `note`.

```json
{ "key": "primary:line:partial", "kind": "path", "d": "M326.9,83.5L338,117.7", "paint": "series.1",
  "width": 2, "dash": "2 4", "opacity": 0.75, "layer": "data", "note": "incomplete bucket" }
```

Paint tokens in use: `ink`, `ink.muted`, `grid`, `axis`, `series.1` to `series.6`, `compare`, `rule`, `delta.good`, `delta.bad`, `live`, the steps of the two ramps (`seq.1` to `seq.10`, `seq.none`, `div.1` to `div.9`), `band.1` to `band.3`, and `background`, which the `partition` mark sets a name on a filled box in.

**Decided October 7: one scene, in ratios.** A pixel scene needs a size before it can exist, which is the opposite of intrinsic. Every node gets a `part` and coordinates from 0 to 1 within that part's box. The DOM painter lets CSS turn them into pixels. The dot-grid and canvas painters get today's pixel scene from a pure function, `place(scene, size)`, which is held to the existing golden scenes. Keys, paint tokens, roles and `layer` are identical in both. Detail is in `docs/dom-painter-plan.md`, section 3.

**Amended November 23 (Decided 43).** No painter read the pixel scene: the element paints the ratios, and the dot-grid and canvas painters are not started. `place()` was a second layout engine written by hand for each layout, and each new form had to be written in it as well as in the scene and the stylesheet. It is parked. A surface with no CSS gets the scene and what the fit rules make of it at a room (`fitTo`), and places the parts itself. One generic placer is the thing to write when a pixel painter is wanted, once every node is a ratio of its part's box (Open 20).

One consequence, also agreed: a scene with no size cannot choose its tick count by height, so the y scale always rounds to 4 ticks and a rule thins them on short plots. The prototype rounded to 2 under 120 px.

---

## 12. Painters

**Status: the HTML and CSS painter is Proven (`packages/dom`). SVG and dot grid were the prototype's, and are not built here: core places nothing since November 23 (Decided 43).**

- **Two layers per view.** Data marks go to whichever renderer fits. Axes, labels, tooltips, brush and focus rings always stay in the DOM, so text stays crisp, tokens apply through CSS and keyboard access survives.
- **Tokens, not colours.** A painter maps paint tokens to CSS custom properties, using the `@automattic/charts` token names under our own prefix (`series.1` becomes `--ua-charts-color-series-1`, for its `--a8c-charts-color-series-1`). Which custom property each paint token reads is `PAINT` in `packages/dom/src/dom.ts`, and `docs/dom-painter-plan.md` section 4.1 says where the rest of the map is. Light and dark are token sets.
- **Intrinsic sizing.** The DOM painter plans once per data change and CSS fits the view on resize. Bars are HTML positioned by custom properties; lines and areas are a stretched SVG (decided October 7). The view carries no size or mode; see section 10.
- **Direction.** A plot's frame runs left to right whichever way the page reads: the plot, the axes on every side of it, the labels at the line ends, a grid of cells and its row labels, and a map. A circle of arcs runs clockwise and a number from its first character. What mirrors with the page is the legend, the key to sizes and the ramp, the number's block and the prose, a band and a list of rows; a label's words run their own way wherever they stand. Left and Right move the way they point.
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

| State | Behaviour | Status |
|---|---|---|
| Empty period | A notice in place of the marks, "Page views: nothing in this period yet"; a zero in the metric's unit and "Page views: nothing yet" when collapsed. Both lead with the metric's label, so where one is cut to its room the label is what stays. | Proven |
| No prior period | Comparison layer dropped and reported; delta reads "No prior period" | Proven |
| Partial bucket (today) | Dashed tail on a line, faded bar, excluded from the area | Proven |
| Instant metric at zero | "0" with "right now", and no pulse. | Proven |
| Loading | — | Built in `<ua-view>`: a placeholder until an input it has not been handed comes, and until its turn to paint on a page of many views. A plot's natural height in a stack, the whole box in a row. It fades in after 150 ms, so a view that paints at once never shows it. A view already drawn stays drawn while new inputs are awaited. An input still missing after ten seconds is reported in the console with its fix, not shown as an error |
| Stale or late data | — | To do. Freshness should be a visible state |
| Filtered (bots, consent) | — | To do |
| Metric unavailable here | — | To do |
| Error | Message shown outside the view; the last valid view stays drawn | Proven in the bench, and in `<ua-view>` for inputs it refuses: the last view stays drawn with the message under it. A view with nothing drawn yet, or one that failed while painting, shows the message alone |
| Result of another query | Refused, as an error: a row or the totals lack a field the query names. Companions are not required | Proven |

**Open:** whether a delta should exclude the partial day. Today the totals include it.

`<ua-view>` takes its inputs as properties (`spec`, `result`, `catalog`, `rules`) or as JSON in child scripts. A spec and its result belong together, and a host that changes both sets them in one step:

```js
view.inputs = { spec, result };          // or { spec, result, catalog, rules }; an input left out keeps what it had
```

Set a task apart, the new spec meets the old result. The view checks the first row and the totals for the query's `by` fields and metrics, refuses a result that lacks one, and names it. A result with no rows is an answer, and is held to its totals alone.

### Selection (Built November 24)

A datum the user picks stays picked: it is **Selected**, one of the states every atom has (`docs/component-states-plan.md`). A selection is a filter, as a query's `where` is one (Decided 49): what is picked is said by its values, never by pixels or row ids. The view does not keep it, because the host is what outlives a re-render, and the view decides nothing of what an activation does to it (Decided 50). When the user activates a datum the view sends `ua-select`, whose `detail` is a proposal: `where`, the filter that datum is, its value of each dimension it is of; `how`, how it was activated; and `key`, its key in the view. The host folds the proposal into the filter it keeps, with core's `select`, and sets the result back:

```js
view.addEventListener('ua-select', (e) => { view.selected = select(view.selected, e.detail, catalog); });
```

In a board the fold is `boardSelect`, and the host sets on each view what `boardViews` says it is to mark:

```js
surface.addEventListener('ua-select', (e) => { board = boardSelect(board, e.detail, catalog); draw(); });
```

| `how` | Click or tap | Keys | What `select` makes of it |
|---|---|---|---|
| `pick` | plain | Enter, Space | Each dimension is held to the datum's value alone. Where it already was, the datum is let go |
| `toggle` | Cmd or Ctrl | Cmd or Ctrl with Enter | The value joins those the dimension is held to, or leaves them: a set. A run gives way to the value |
| `extend` | Shift | Shift with Enter or Space | On a time or a number, a run from what is held to the value. It grows to take the value in, and a value inside it becomes its end. With nothing held it is a pick |

- **Extend is for what has an order.** On a categorical dimension `extend` is a toggle: the order a list's rows are drawn in is their rank today, and no order of their values.
- **A set of cells is a set on each dimension.** A proposal of two dimensions is folded one at a time, and dimensions are joined by "and", so two cells toggled are their columns and their rows.
- **The modifiers take nothing from version 4's keyboard.** Its plots read Enter and Space whatever is held with them. Read from `xy-chart-tooltip.tsx` on Jetpack trunk, November 24.
- **A touch has no modifier, so a tap is a pick.** The fold is the host's, so a surface that wants several picked by touch passes `toggle` for a plain activation: the bench's Board page has a switch that does.
- **What a datum is.** A point of a plot or a row of a list is its value of the dimension along it. Where a series is chosen at a point, by the keys or on a ring, it is that series' mark: both dimensions. A grid's cell is both of its dimensions, a treemap's parent its own value, and a child both.
- **What is marked.** `selected` takes any filter, and the view marks `data-selected` on every atom whose rows all hold it (`holds` in core). So a filter on the dimension along x marks every mark at a point; one on the split marks a whole series, its line and its legend entry with it; one on both marks a single mark; a list marks each of its values, and a run every value in it. A dimension the view does not draw marks nothing.
- **It is said.** Each thing that can be chosen, an option, a grid's cell, a tree's item, says `aria-selected`, and its holder `aria-multiselectable`.
- **It filters nothing.** `selected` paints nothing again and takes no row away. What a view is of is its query's `where`, and the host's to ask for.
- **It stays.** A selection outlives a new result where its data do. Escape lets go of hover and focus, never of the selection. A spec says nothing of it: like a size, it is the container's.

Not built: a drag along a plot for a run. Shift does the same by pointer and by keyboard, and a drag needs a band drawn as it moves. When it is built, the band is the view's own and transient, and letting go proposes the run, once.

Selected has no look of its own yet; that is design's to set. The bench's Board page lends one so that a selection can be seen there: the rest set back, and a band over a run of days.

---

## 14. Accessibility requirements

Write these once against the scene and the plan, not per preset.

- Every view exposes its **tldr prose** as its accessible name or description.
- Every view offers the **same query as a table**. Chart and table read one result.
- **Keyboard navigation** over data marks, driven by keys and the row each mark came from. Announce the dimension value, the metric value in its catalog format, and the comparison if present.
- A **canvas or dot-grid painter needs a hidden DOM mirror** carrying the same structure.
- **Never colour alone.** Series must also differ by dash, pattern or direct label. The dot painter's dither patterns are one instance of this.
- **What is selected is said**, not only shown: `aria-selected` on each thing that can be chosen, and `aria-multiselectable` on what holds them (section 13). Not yet heard through a screen reader.
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

The number block in words, and then the filter (Decided 53). Every view's sentence is of this one shape: no chart type and no layout is consulted, so a custom mark needs no sentence of its own.

| Part | Says | As in |
|---|---|---|
| Each metric the query asks for, the first with the range | Its total from the engine; its change, where the query compares; its share of its target, where the catalog gives one; and that it is a sum of daily counts, where it is | "Visitors: 10.5k in the last 28 days, up 12% on the previous period. This is a sum of daily counts, not a unique count." |
| The leader, where the query's first dimension is categorical | The value the number's note names, with its share where the view is of shares. None where that value has no figure or no name | "The top page is /." "The top channel is Search, at 41%." |
| The filter, after everything else | What the answer is filtered to, read off its `meta.where` as the range is read off its `meta.range` | "Filtered to channel Search." A list is "channel Search or Social", a run "day from Sep 21 to Sep 27", and dimensions are joined by ", and" |

Three answers have a sentence of their own, each still of the number:

| The answer | Tldr prose |
|---|---|
| An instant metric | "Present now: 7 right now." |
| Empty | "Visitors: nothing recorded in the last 28 days." |
| A total the engine does not give | "Correlation: no figure in the last 28 days." Under the number it is a dash, which a voice cannot say |

It is derived, and not written by a spec's author, because a view's data is live and an authored sentence is not: "up 12%" is false tomorrow. It says no more than the number because what a kind of view shows beyond it, who rose in a ranking, the busiest cell of a grid, how far a range runs, is for whoever reads the result to say in their own words, a person or an agent. The table and the readout say every row.

Every word is the catalog's or the query's: a metric is said by its label, a dimension by its label, and a value of one as a row says it, so a country's code is its name. The words that are not, such as "right now", "nothing … yet" and "no figure", are set in `packages/core/src/prose.ts` and nowhere else.

The tldr prose is the last rung of every view, the accessible description, and what an agent gets when it cannot render anything.

---

## 17. Acceptance set

The first six sample specs, `samples` in `packages/fixtures`, are the first acceptance tests.

| Sample | Spec | Covers |
|---|---|---|
| Visitors over time | `use: "line"`, visitors by day, compare previous | Time series, comparison, partial bucket |
| Top pages | `use: "bar-list"`, page views by page, limit 8 | Ranked list |
| Channel mix | `use: "share-bar"`, visitors by channel | Part to whole |
| Page views total | A query with no dimension and no layers | The tldr value alone, with delta |
| Present now | `use: "bar-list"`, present by page | Instant metric, so the tldr value sits above the list |
| Bars and a target | Explicit layers: bar plus rule | Authored layers and roles |

Fixture facts to assert: visitors total 10,531 against 9,437 previous (up 12%); page views 25,061 against 21,974 (up 14%); 28 daily rows, the last one partial; channel shares 41, 28, 14, 8, 6 and 3 percent; 7 people present across 4 pages.

`test/core.test.ts` sweeps each of them across three data states, six height limits and nine widths, and checks for duplicate keys, NaN values and a part shown that its scene does not have.

The v1 product also needs primitives that are not built here yet: a delta badge as its own part, scope and filter chips, a compact date and compare control, a detail table, and loading and stale notices.

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
```

---

## 19. Decisions and open questions

### Decided

1. Chart types are presets, not primitives.
2. No `intent` in the spec.
3. Comparison is a role on a layer (`series: "previous"`), not a second metric.
4. Sizes and thresholds belong to the container and the design system. The spec has none; `keep` is the author's only lever.
5. Totals come from the engine, never from summing rows.
6. `arc` will be its own mark. No general polar coordinates. It reads data on `angle` and on `radius`, one a metric and the other a dimension, and that is a closed set of forms of one mark and not a coordinate system: no other mark is drawn about a centre, and nothing has an angle and a radius both from metrics. A slice that reaches to its value starts at the centre: there is no hole in a rose. (Extended October 12) Reopened November 23: see Open 21.
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
18. Names: tldr value (was headline), tldr prose (was sentence), container (was host). The prototype kept the old names, and the parity test mapped them, until both went (Decided 52). (October 7)
19. Intrinsic behaviour is the default. A surface lays its containers out by its own scheme; a container fills the room it is handed and does not know where it is. With nothing said it fills the width and takes its natural height; a layout that hands out a box opts its children into filling it. (October 7)
20. One scene, in ratios, with a `part` on every node. Pixel painters go through `place(scene, size)`. (October 7) The second sentence is amended by 43.
21. Y ticks always round to 4, thinned by a rule on short plots. A deliberate departure from the prototype. (October 7)
22. In the DOM, bars are HTML and lines and areas are a stretched SVG. (October 7)
23. Layouts stay, as arrangements of parts that fit rules and painters hang on. A channel's scale comes from its field; `rows` becomes a track per row; `radial` is added for `arc`. Detail and the build order are in `docs/chart-coverage-plan.md`. (October 7) Reopened November 23, to be narrowed and not undone: see Open 21.
24. A query may have two dimensions in `by`, no more. The second goes to `color`, to `facet`, or to the other axis. (October 7)
25. Statistics (bins, quantiles, density, running totals) come from the engine as companion fields, as `metric@previous` does. Core gains no transform for them. (October 7)
26. A facet is a small board: a plan per value with one shared domain, laid out by the container. (October 7)
27. A layer may carry a shape parameter from a closed set, starting with `sweep: "half"` for `arc`. Count them; chart types must not come back as parameters. (October 7)
28. A delta per row is `series: "delta"` on a `text` layer. ~~A ranged bar is painted by its direction and the metric's polarity.~~ (October 7) **Amended October 12 by Decided 36:** no mark is painted by direction unless its layer says `paint: "direction"`. The automatic rule caught a box plot, whose box goes no way, and read a bar from a gain to zero as a loss.
29. A fit rule may name a `fallback` preset that the view becomes below the rule's need. (October 7)
30. `d3-geo` is allowed in a `packages/geo` of its own. Core keeps its three dependencies. (October 7)
31. `detail` splits a layer into series without painting them apart. It is a channel that takes a dimension: one series per value, all in the layer's own paint, with no legend and no limit of six. The query's second dimension may go to `color`, to `detail`, to `facet` or to the other axis. (October 12)
32. `unit` draws a value as counted glyphs; what a glyph is worth comes from the data. It is one built-in mark whose form is what is on its channels: a stack, a run, a grid of a hundred, seats. A glyph is a dot or a square. A scene has no size, so nothing about a glyph's worth or count is a size: the largest value is ten glyphs or fewer, a grid is a hundred cells shared by largest remainder against the engine's total, and seats are one each up to a hundred. Under the room its glyphs need a form becomes another preset of the same query, by a fit rule's `fallback`, which for that may now name the mark it is for. (October 12)
33. A colour scale whose values cross zero is diverging about zero. Nothing in a spec says so: the ramp is read from the least and the most of the values drawn, or from the `domain` the catalog states for the metric. Zero is the neutral middle step, `div.5`, and both arms are measured by the end farther from zero, so two values as far from zero as each other are as many steps from the middle. Anything else is sequential, as before. The arms say below and above, never bad and good: that is polarity's, and the delta's paint. A grid and a map share the one scale. (October 12)
34. A `line` or an `area` on a `number` dimension whose rows carry `<dimension>@end` is drawn as steps, as a `bar` there is drawn with no gap. It follows from the bins, and there is no layer field for it. (October 12)
35. `rank` is a unit in the catalog: a scale that runs from 1 at the top, with a tick for each rank. A companion is in its metric's unit unless the catalog has an entry under the companion's whole name, which is how `metric@rank` takes the unit, and how any companion that is not in its metric's unit says so. Core reads no suffix for it. (October 12)
36. `paint: "direction"` paints a `bar` or an `area` with two ends by which way it runs and the metric's polarity, `delta.good` or `delta.bad`, and the layer's own paint where the polarity is `none`. An area is cut where its ends cross. It replaces the automatic rule of Decided 28: the presets `waterfall`, `candlestick` and `difference` state it, and a bar with two ends and no `paint` is in its layer's own. `paint` gains a value, and no layer field is added. (October 12)
37. A stack may diverge: `stack: "diverge"` sets the first half of a layer's series below zero and the second half above it, in the series' own order, and the middle one of an odd count half on each side. `"center"` stays as the silhouette a streamgraph uses. An axis under a diverging stack counts away from zero on both sides, so no series is said to be less than nothing. (October 12)
38. A row may be divided by the query's second dimension: a `bar` with `stack` in rows takes it on `color`, and a `dot` or a `tick` takes it on `detail`. The rows are the first dimension's values, and what a row says of itself is the engine's total for it. So the query's second dimension may go to `color`, to `detail`, to `facet` or to the other axis, in rows as in a plot. (October 12)
39. Layers of a plot that measure several metrics are told apart as the series of a split are: a series colour for each metric where its layers state no paint, an entry each in the legend, and a label where each one's line ends. Nothing in a spec asks for it, as nothing asks for a legend. It closes the gap of October 8, where two metrics on one plot were both `series.1` with nothing to say which was which. (November 20)
40. A guide is read off a scale, and which encoding each comes from is one table, `GUIDES`. A guide is a key or a frame, and a key leaves no sooner than the marks it keys. (November 20)
41. A key with no shorter form stays as long as its marks, or its marks give way with it. The second y axis stays as long as the first, and in the bare plot what is drawn on it goes too. What a glyph is worth stays as long as the glyphs, which give way to their plainer preset at the height the two need. A row's column headers stay as long as two columns do, and a list gives up rows instead. A Sankey becomes its grid at the size its node names need. (November 23)
42. Where a key cannot stay whole it is cut down, or the marks give up what it was the key to. A legend with nothing to stand in for it takes the colours with it, and its marks are drawn in one paint; bars and dots, which have no line end to label, keep theirs as long as the axes. The ramp becomes a thin strip of every step between its two ends, chosen over its two ends alone when both were looked at. The key to sizes becomes its largest step, and dots are one size in the bare plot. The names round a rim are thinned to about four. With that no rule takes a key from marks that are still drawn. (November 23)
43. A plan takes no size, and core places nothing. How a view gives way when room is short is the fit rules, as data, and one function reads them at a room with no browser: `fitTo`, with `viewAt` to follow a rule's `fallback`. The reducer in `resolve()`, `place()` and each custom mark's `place` are parked: nothing shipped read them, and they were a second reading of the rules and a second layout engine, both written by hand for each layout. Parity with the prototype is held for what takes no size: the engine's answer, the plan, the sentence and what each scene holds, node for node. Where a node is placed is no longer compared, and the tag `prototype-parity` marks the last commit that did. The rest of the parity went with the prototype on November 24 (Decided 52). Two conditions joined the rule format so that the data says what the element does: a rule names every part it takes, and may be for one kind of view (`has`). The rules the DOM's painters had made for themselves are core's now. (November 23)
44. One space for the marks, which reopens 6 and narrows 23. A view's space is two axes, each a list of values (a dimension), a quantity (a metric or a binned number) or nothing, and it is flat or bent about a centre. A spec asks for the bend as `arc` does, by writing `angle` and `radius` where a flat view writes `x` and `y`, and says nothing else. A mark is one function of that space: on an axis that is a list it takes its value's place, and on one that is a quantity it is measured along it. A layout stays as what stands round the marks and how the view takes its size, and no longer says which marks may be drawn. It is built a layout at a time and held to the bench's capture, frame for frame, since a scene's nodes change shape on the way. Stage 1, the grid, is built: it draws the plot's `text` by the plot's function, handed a pair's place and what the pair is known by (`GRID_MARKS` and `Draw.of` in `scene.ts`), and the element paints it with the plot's label painter. Between two lists only `cell`, `dot` and `text` have a place. Stage 2, the list, is built: it draws the plot's `line` and `area` by the plot's function, on their side (`LIST_MARKS`), in a part of their own, `track`, that lies over the rows, and the element paints them with the plot's path painter in one SVG it turns. A row's own five marks are still the track's own functions (`TRACK_MARKS`): each is a line or two and belongs to its row's element, so making them the plot's would add more than it took away until a node says its place one way in every layout. Stage 4, the circle, is built: with a dimension on `angle` and a metric on `radius` it draws the plot's `line`, `area` and `dot` by the plot's functions (`ROUND_MARKS`), then bends them, on one scale out from the middle that slices share. A path about a centre is made where every path is (`pathD`, `curve: "radial"`). It was built before stage 3 because it is the one that adds diagrams. Stage 5 is built for the map: a custom mark may offer its places (`places`), and the plot's `text` is drawn over it at them by the plot's function (`OVER_MARKS`), so `geo` carries labels. Stage 3, the share bar as a list of one row, is not built: it would add no diagram. What the stages have not done is replace a layout's own marks with the plot's: a grid's cell and dot, a row's five, an arc and a map's symbol are still their layout's own functions, because a node says its place differently in each layout (`v` and `t` from the foot, a cell's `y` from the top, `row` against `pair`). Since Decided 51 a node says its place one way, and a row's five are the plot's, turned; a grid's cell and dot, an arc and a map's symbol are still their own. One way of saying it is the step that would let them be one, and it changes every painter. (November 23)
45. A board holds views and what they share, and no layout: where each view stands is the surface's, as a view's size is its container's. That settles the part of Open 12 a facet waited for, so the facet is built first, since it shares only its scales and needs no params. A spec's `facet` names one of the query's dimensions, core's `facets` gives a view for each value with the engine's totals and one domain for every scale, and a surface lays them out; a spec says no columns. (November 23)
46. A mark's place may be said as a value. What is on a channel is a field or a number, so a value of a list axis (a date, a category) had no way to be said: a string there is a field. The layer field `at` says it, first for a `rule` in a plot, which stands at that value of x. A value the axis does not have is not drawn, since a view must not break when its range moves past a date. (November 23)
47. A metric on `color` paints a plot's bars and dots off the ramp, as it paints a grid's cells, and the ramp is its key. A guide is read off a scale, so the ramp was already a view's wherever a metric is on `color`; a plot now draws it. One metric paints a plot, and not beside colours that tell series or metrics apart. The ramp leaves with the axes, and the marks are then in one paint. (November 23)
48. A filter is part of the query, and a param is a part of the query that views share. That settles how Open 9 begins. A query's `where` holds a dimension to one of its values, to any of a list, or to a run from one to another: the three kinds Open 9 named, point, set and interval. Dimensions are joined by "and" and there is nothing else: no "or", no "not", no threshold. The engine applies it and carries it back as `meta.where`, a view says it after its sentence and of itself, and `resolve` refuses an answer that is not of its query's filter. Core filters no row. Proposed to the API's owners with it: `where` on the request and on the answer's `meta`. What follows from it and is not built: a board's `query` laid under each of its views' as their params, a selection as a `where` that a view proposes, and views combined by one rule with no field, each filtered by every dimension but the ones it draws, where it marks what is selected. (November 24)

49. A board is views and what they share, and a selection is a filter. This settles the rest of Open 9's model and the board of Open 12. A board's `query` holds `range`, `compare` and `where`, laid under each view's own: those are its params, and there is no variable, reference or expression. Views are combined by one rule with no field: each is filtered by every dimension of the board's `where` but the ones it draws, and on those it marks what is held. A board has no layout and no state apart from itself, so a surface that changes a param holds a new board. Core gives the views (`boardViews`) and the board after a selection (`boardSelect`), and fetches nothing. `<ua-view>` proposes a selection as the filter the activated datum is (`ua-select`, `detail.where`) and marks by any filter set back on it (`selected`), which replaces the key it took before. It draws no board: that is a surface's, and the bench has the reference one. (November 24)

50. A view says what was activated and how, and core decides what that does to the selection. `ua-select` carries a proposal: the datum's filter, and `how`, which is `pick`, `toggle` or `extend` by the modifier held (none, Cmd or Ctrl, Shift), the same for a click and for Enter or Space. Core's `select` folds a proposal into the filter held, and `boardSelect` is that fold on a board, so it no longer asks which view proposed. The view keeps no anchor and no set, and no longer sends `null` to let a datum go: picking it again does that, in the fold. A set is a list on a dimension and a run is `from` and `to`, which a filter already held and a view already marked by. Extend is for a time or a number. There is no drag yet. What is selected is said to assistive technology. This settles how a set and an interval are picked, which Open 9 left. (November 24)
51. One vocabulary for where a node is, begun. Every node says its place in the same fields, whatever its kind and its layout: `x` and `y` where it is, `x2` and `y2` its other end, `w` and `h` an extent (section 11). `v`, `v0`, `t` and `t2` are gone, and with them a list's bar that ran from `v0` to `v` beside a rule from `x` to `x2`. It is the step Decided 44 named as the one that would let each layout's own marks be the plot's. The first stage was the names alone: no number changed, which a comparison of every node of every sample's scene before and after holds, and the capture. The second made `y` count up everywhere: a grid's cell, a cell of a `unit`'s grid, a treemap's box and a Sankey's node had counted down from the top, and each now stands on `y` from the bottom, where it stood before. The third made a row's marks the plot's, turned. A list had five functions of its own, for a bar, a rule, a tick, a dot and a unit, each a copy of the plot's on its side. A row's track now draws the plot's own, handed one row and the track's scale, and each node is turned once: what was up the plot runs along the track, and what was across a band runs up the row, from the top. A list's layer is turned the same way going in, its `y` read as `x` and its `x` as `y`. What a list alone does is said after the turn: a bar behind its label is a tint and is never faded as an unfinished bucket is, a dot or a tick of a mass lets the ones under it show, and a rule with one end at a number lies from zero in each row. What it found: every node of every sample's scene is as it was, ten of them to the last digit of a float; a list already drew every mark a plot does, so it gained none; and the code is no shorter, seven lines longer. What it gives is one definition of each mark, so what is added to the plot's reaches a list where its painter draws it. Still to come, if they are wanted: the share bar as a list of one row, and a slice as a bar, bent. (November 24)
52. The prototype is gone, and nothing is held to it. It was an artifact of development: the port was proven against it, and since Decided 43 it was held to less of it at each step. Its three files and the comparison in `test/core.test.ts` are removed, and git keeps them. The sweep holds what it held of its own, unique keys and no `NaN` in every data state, and each departure that was asserted against the prototype is asserted for itself. It is the first step of `docs/focus-plan.md`. (November 24)
53. The tldr prose is the number block in words, and then the filter: one shape for every view. It says each metric's total from the engine with its change and its target, and the value that leads the query's first dimension where the number's note names one. The sentences a kind of view had of its own are gone: for a ranking and for shares, for two dimensions, for a grid, for ranks, for a range, for a difference and for a path of points. A sentence stays derived, since a view's data is live and an authored one is not, and it stays the accessible description and the last rung. What a view shows beyond its number is for whoever reads the result to say. A total the engine does not give is said as "no figure". It is the second step of `docs/focus-plan.md`. (November 24)
54. The library ships the common charts and no more: thirteen presets, the charts `@automattic/charts` has and the ones a fit rule falls back to. The twenty-five it had beyond them are gone from it, and so are three a custom mark's package registered: a form that is less common is more likely to be written to its case than taken whole, so it is written as its layers, and the bench keeps a sample of each. `use`, `registerPreset` and a library handed to `resolve()` are as they were. Every sample's scene is what it was, node for node. It is the third step of `docs/focus-plan.md`. (November 24)
55. Nothing a layer says is dropped without a word. `paint`, `series` and `stack` join the table of what each mark reads, and are refused on a mark with no use for one; a custom mark says the fields it reads, in `fields`. A `paint` beside a dimension on `color` is refused, and so is `series: "previous"` on a layer that encodes no metric. A band is one layer, and its bar takes no `stack` but `"normalize"`. Bars of several layers on one x sit side by side, as the bars of a split do: of the ways to settle two bars in one place, that is the one that draws what was asked. Each limit of the grammar is listed with the reason it holds (section 7). It is the fourth step of `docs/focus-plan.md`. (November 24)
56. The scene has a schema, `scene/0`, a draft: `packages/core/schema/scene.schema.json`. It is the node vocabulary of Decided 51 as data, with an arc's own fields and the parts that carry no position said as such, and every scene a sample builds is held to it. Writing it found two things no type said: a `text` in a grid carries the `pair` it stands at, and the `partition` mark paints in a token of its own, `background`. It is the fifth step of `docs/focus-plan.md`. (November 24)
57. The agent surface is a package of its own, `packages/agent`, that wraps core and adds no rule. `describe()` gives what can be said as data: the four schemas, what each mark reads, the guides, the fit rules and the presets. `check()` reads a spec with its answer and no browser, and gives the refusal, or what the view says, where each part comes from in the spec, and at each room the parts that show, each fit rule that holds and the lever that changes it. A server offers both over stdio as MCP tools, with a third that draws a spec by the bench's capture and returns pictures and the check's findings. A view is read on the answer it is handed, or on the fixture engine where it is handed none. Building it found that `resolve()` read past a field it had no use for, so a size in a spec or a filter under another name was drawn without: a spec, a query and a layer now refuse a field they do not take. It is the sixth and seventh steps of `docs/focus-plan.md`. (November 24)
58. What the fit rules pick is said once. Every need is one of forty numbers, or a sum of them and of a surface's gutters, and the forty are in one table, `LEAST` in `packages/core/src/fit.ts`, each named for the part it is the least room of. No rule changed: the thirty are the same data. It is the first stage of the eighth step of `docs/focus-plan.md`, which goes on to work the needs out, from the type a part is set in first, and that is proposed there and not built. (November 24)

### Open

1. The format for per-element fit rules, such that they compile to container queries and also run in code. Proposed in `docs/dom-painter-plan.md`, section 2. Built: the rules are compiled (`packages/dom/src/compile.ts`) and read in code by `fitTo` (Decided 43), and `keep` holds a rule off in both. One difference step 1 of that plan found is still open: a rule on the view cannot say the plot's room when the number sits above the plot, which is why the `y-ticks` rule carries a note and Open 19 its last sentence.
2. Settled October 7: see Decided 20. The number is kept so later items keep theirs.
3. How a preset pins a hand-tuned form.
4. Settled October 7: see Decided 23. Built October 8.
5. Label collision: build or source.
6. Bar list behaviour when narrow, and what a collapsed ranking should show.
7. Whether a trend shows the tldr value above the plot by default. This is now the container rule `tldrValue.above` and not a spec field; the default says no.
8. Whether deltas exclude the partial day.
9. Params and selections. Settled in part November 24: see Decided 48 and 49. The filter, the board's shared query, a selection as a filter a view proposes and cross-filtering by one rule are built. A set and an interval are picked with modifiers (Decided 50). Still open: a drag for a run, which waits for a look; whether a touch should pick several in the element itself, by a long press, where today the surface decides; how a screen reader reads what is selected; and whether Spacefast's API takes a filter in this form, which its recorded answers do not show.
10. Settled October 7: see Decided 24. Built October 8.
11. Catalog properties beyond the stub, and where polarity and thresholds are declared. Among them, what a metric counts, one and many ("person", "people"): without it an instant metric reads "Present now: 7 right now" and not "7 people are here right now". What this repo will propose to the API's owners is listed in `docs/chart-coverage-plan.md`, section 3.5: a `number` dimension type; `domain`, `target` and `bands` on a metric; a colour role per dimension value; and totals per split on the result. All but the colour role are built here and are in the schema, so a catalog may use them; what is open is whether the API will send them.
12. Settled November 23 and 24: see Decided 45 and 49. A board holds views and no layout; the facet and the board are built.
13. The name.
14. Which survives at the smallest size, the marks or the tldr value. Today the tldr value does; a sparkline in a table cell wants the line alone. To settle in testing.
15. Whether the tldr prose rung can be anything but measured. The plan proposes a measured pass, because the threshold is the width of the number itself. It is the one place the fit is not intrinsic.
16. What building the chart coverage plan left to decide. Listed in `docs/chart-coverage-plan.md`, section 9.
17. Time zone, grain and locale on the time axis. A time is said as its string writes it (section 4), which needs no zone while an engine names buckets by its own clock: the fixtures send bare dates, and Spacefast's API cuts in UTC and says so. Its contract says site time zones come later. When they do, either the adapter rewrites each instant as the site's clock time, or a zone reaches the formatter as a new input on the result. The first is recommended, since it adds nothing to the grammar. A stated grain would let the midnight bucket of an hourly result say its hour and a week say that it is one. Dates are written in `en-US` throughout. Raised again on November 24 by the Jetpack Stats team's review, which calls it architectural and asks that it be threaded through while the call sites are few: `format.ts` builds its formatters once, in `en-US` and UTC, some seventy calls read them from core, the element and two custom marks, and the prose, `explain` and the readout are written in English. Recommendation: locale and time zone are where the view lands, as its theme is, so they are an input a container hands a view beside `catalog` and `rules` and never a part of a spec; and the words are an input too, a table of the sentences with English as what stands where none is given. In three stages, each leaving every view as it is where nothing is handed in: the formatters made from the input and no longer once for all; then the words gathered into one table; then the element reading the page's own language where it is told none.
18. Settled November 23: see Decided 41 and 42. Built that day.
19. What the fit rules do not say (section 10.2 lists it): rows trimmed to a height, columns given up by width, the number's shorter forms and the prose rung, a number too wide for its hole, labels that would meet, and anything that depends on the content's height. The element measures these, and the reader is silent on them. Recommendation: write each as a rule where its need can be stated in px, starting with the number's forms and whole rows, and leave label collision to the surface (Open 5). The two rules on the plot need the plot's box, which a rule on the view could state where the plot's share of the view is known.
20. A placer for surfaces with no CSS. Recommendation: one generic function, written when a pixel painter is wanted and after the layouts share one coordinate space, so that it maps a ratio and its part's box to pixels and knows no layout. Until then such a surface gets the scene and `fitTo`.
21. Settled November 23: see Decided 44. Its first stage was built that day.

22. A field that is read out and never drawn. Proposed by the Jetpack Stats team's review (November 24), in place of a hook that lets a host write a tooltip's content: a view names fields, of its query's metrics or their companions, that the readout and the table say, labelled and formatted from the catalog, and that no mark draws. It is data and not a function, so a spec stays JSON and every surface can say it, which a hook could not. Recommendation: adopt it, as Proposed. What is open within it is where it is said: a layer draws, so a list on the spec is the likelier place than a layer with no mark, and the readout already says each metric its layers draw and their companions (`companions` in `packages/dom/src/keys.ts`), which this would add to.

---

## 20. Out of scope for now

- **Query coordinator.** The layer that collects each view's request, merges duplicates, caches and routes to an engine.
- **Local engine.** DuckDB-WASM slicing server results in the browser. An in-page panel should lean on the server tier because of download size.
- **WebGPU and canvas renderers for dense data.**
- **A drag for a run.** Cross-filtering by a value, a set and a run is built (Decided 49 and 50), with modifiers. The drag is Open 9.
- **Semantic compiler.** Turning catalog names into SQL is server-side.
- **A board element.** The board is built as data and two functions (Decided 49), and the bench has the reference surface. An element that is handed a board and a query function, and keeps the board, is the shell's (`docs/shell-plan.md`).
- **A bridge to each agent harness.** The agent surface is built (Decided 57): `packages/agent`, as functions and as an MCP server over stdio. Returning a view into a harness's own frame, and the size of that frame, are not.
