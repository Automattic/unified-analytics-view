# View grammar: the reference

For the author of a view, a person or an agent: what a spec may say, what becomes of it, and why. As of November 24, 2026.

`docs/vision.md` says what the project is for, and every Decided and Open item here is weighed against it. The same contract is data: the schemas in `packages/core/schema/`, and `describe()` in `packages/agent`. How each part came to be built is in `docs/archive/` and in git.

**Status labels.** A section or an item is one of:

- **Proven:** built and exercised across views, widths, heights and data states. A section with no label is Proven.
- **Proposed:** decided in design and not yet built. It is the plan: build it as written, and say so if building it shows it is wrong.
- **Open:** undecided. Do not settle one silently: raise it, with a recommendation.

Section 19 is the log of what is decided and what is open. Section numbers and item numbers are cited from the code, so they do not change.

---

## 1. Goal and principles

A small grammar of marks, a spec format, and renderers, for showing the answer to an analytics query. Collection, storage and the query engine are built elsewhere.

1. **A view is specified once.** An author writes a spec and decides where it renders. The spec carries no size, no breakpoint and no presentation switch: the container it lands in decides how it is presented.
2. **Chart types are presets, not primitives.** A "bar chart" is a saved combination of marks and encodings. The grammar never sees a chart type's name.
3. **A valid spec always draws something meaningful.** An invalid one fails with a message that names the fix.
4. **Specs are mostly written by agents.** So: a small closed vocabulary, plain JSON, a published schema, and errors an agent can act on.
5. **Structure and rendering are apart.** A scene stands between them, so the look of every mark can be designed and replaced.
6. **Polish is part of the system.** Accessibility, transitions and label collision are written once against the grammar, not once for each chart.
7. **The core has no DOM and no framework.** The first container is a browser, and the same spec serves an agent, a canvas painter and a native shell.
8. **It works on any site.** A view cannot rely on its page's styles, and depends on no feature of one browser without a fallback.

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

| Step | Takes | Gives |
|---|---|---|
| **Catalog** | | What names mean: labels, units, polarity |
| **Query** | `spec.query` | `{ rows, totals, meta }`, from an engine. Fixtures stand in for one here |
| **Expand** | A spec with `use` | A spec with `layers` |
| **Plan** | The spec, the result, the catalog | Layout, layers with roles, guides, the tldr prose. It takes no size |
| **Scene** | The plan, the result | A flat list of shapes, in ratios of their part, with stable keys and paint tokens |
| **Fit** | The scene, a room, the fit rules | The parts that show there, what else is hidden, the switches set (section 10) |
| **Painter** | The scene, the fit | Pixels. HTML and CSS today (`packages/dom`) |

Everything up to and including the fit is pure and has no DOM. d3 is used for scales, path geometry and array helpers, and there is no chart library.

---

## 3. Vocabulary

| Term | Meaning here |
|---|---|
| **Mark** | The shape drawn for each row: `line`, `area`, `bar`, `rule`, `text`, `dot`, `tick`, `cell`, `arc`, `unit`. A mark is a shape and the constraints that shape implies |
| **Channel** | A visual property of a mark that carries data: `x`, `y`, `color`, `size`, `text`, `angle`, `radius` |
| **Encoding** | A field on a channel |
| **Scale** | The function from data values to visual values |
| **Layer** | One mark with its encodings. A view is layers over shared scales |
| **Role** | What a layer is for: `primary`, `comparison`, `reference`, `context`. A container gives up layers by role |
| **Guide** | What is derived from a scale and never authored: an axis, the grid, a legend, a ramp, a key to sizes |
| **Tldr value** | The number: the primary metric's total from the engine, a delta, a note |
| **Tldr prose** | The sentence every view has, derived from the answer (section 16) |
| **Preset** | A named fragment of a spec that expands into layers |
| **Container** | Wherever a view renders. It owns its size and is handed the rules a view is fitted by |
| **Context** | The surface that holds containers: a panel, a dashboard, an agent. It hands its containers a rule set once, as it hands them tokens |
| **Plan** | What a spec asks to have drawn, with no size |
| **Scene** | A flat JSON list of shapes with stable keys and paint tokens |
| **Painter** | Code that draws a scene |
| **Companion** | A field the engine returns beside a metric or a dimension: `visitors@previous`, `response_time@p25`, `bin@end` |

---

## 4. The catalog contract

**Status: Proven against a stub. What the real API sends is Open (Open 11 and 23, and `docs/api-proposal.md`).**

The catalog is the slice of the semantic model a view needs: names, and the properties that drive presentation. It is an input. Core knows no metric's name.

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

Of a metric:

| Property | Says |
|---|---|
| `label` | The only name a view has for it. Every word a view says of a metric is made of its label: "Revenue: nothing yet" |
| `unit` | How a value is written, wherever it is written. See below |
| `polarity` | `up`, `down` or `none`: whether an increase is good. It colours a delta |
| `rangeTotal` | `sum`, or `sum of daily` where a range total adds up daily counts and must say so |
| `instant` | A metric with no range and no period before: people present now |
| `definition` | What the number counts, in a sentence or two. Shown when the number is pointed at |
| `domain`, `target`, `bands` | What it is read against: least and most, a goal, and where the range divides. A gauge needs `domain` |
| `by` | The dimensions it can be answered by. A query that asks it by another, in `by` or in `where`, is refused before it is run. Left out, it is asked by any |

Of a dimension: `label`; `type`, which is `time`, `categorical` or `number` (one the engine has cut into bins, each row holding where its bin starts and, as `<dimension>@end`, where it ends); and `values: "country"` where its values are ISO 3166-1 alpha-2 codes, written as the country's name.

**Units.** `count` is a number, shortened where room is short ("13.4k"). `ratio` (0 to 1) and `percent` (0 to 100) are both written as a percentage. `ms` and `s` are a length of time ("3m 48s"). `bytes` is a size. A currency is its ISO 4217 code in lower case (`usd`), written with its symbol, and each is a unit of its own: two never share an axis and nothing adds them. `rank` is a place, "1st", on a scale that runs from 1 at the top. An unknown unit is an error.

**What a view relies on:**

- **A name is an opaque string,** defined once. `date.day`, `bucket` and `page_views` are all names, and a spec uses the names of the catalog it is drawn against. Only `@` is read: `<name>@<suffix>` is a companion of `<name>`.
- **Totals come from the engine.** A view never sums the rows it receives, since many metrics do not add up.
- **Unknown is null, not zero.** A null is written as a dash, compared with nothing, and nothing is a share of it.
- **A companion is in its metric's unit,** unless the catalog has an entry under the companion's whole name: `"pageviews@rank": { "label": "Rank", "unit": "rank", "polarity": "down" }`. Core reads no suffix to know a unit.
- **A time is said as the engine wrote it.** Its date and time of day are read from the string and no offset is applied, so `2026-09-08T00:00:00+02:00` is "Sep 8" on every machine and the viewer's zone is never asked. The forms are a day (`2026-09-08`), a day and time, a month (`2026-09`) and an ISO week (`2026-W36`). Any other value of a time dimension is an error that names these. The grain is read from the value (Open 17).

---

## 5. Query and result

**Status: Proven with fixtures. The query layer is built elsewhere.**

```json
{ "metrics": ["visitors"], "by": ["date.day"], "range": "28d", "compare": "previous", "limit": 8,
  "where": { "channel": "Search" } }
```

| Field | Notes |
|---|---|
| `metrics` | Required. The first is the primary metric |
| `by` | Zero, one or two dimensions. With two, rows come back one for each pair, and the result carries `totalsBy`: the engine's totals for each value of each dimension |
| `range` | A count of days (`"28d"`), or `"now"` for an instant. Any other form is refused by name |
| `compare` | `"previous"`, or absent |
| `limit` | The first N values of a categorical dimension |
| `where` | A filter, by dimension |

**A filter** (Decided 48). Each dimension is held to a value, to any of a list, or to a run. A dimension here need not be in `by`.

```json
{ "where": { "channel": ["Search", "Social"], "device": "Mobile" } }
{ "where": { "date.day": { "from": "2026-09-21", "to": "2026-09-27" } } }
```

- Dimensions are joined by "and". There is no "or" between two, no "not", and no threshold on a metric.
- A run, `{ "from", "to" }`, is for a time or a number, both ends included, and either may be left out.
- The engine applies the filter and carries it back as `meta.where`. Core filters no row and sums none.
- An answer that is not of its query's filter is refused, so a view never says one thing and shows another.
- The view says its filter after its sentence: "Filtered to channel Search or Social, and device Mobile."
- The filter comes before the ranking and the limit. One that holds for nothing is an empty answer that still says its filter.

**A result:**

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

- **A comparison is a companion,** `metric@previous`, row by row and in the totals. It is null where there is no period before.
- **Statistics come the same way:** `metric@p25`, `metric@lower`, `metric@running`, `metric@rank`, and `dimension@end` for a bin. Core computes none. A query cannot yet ask for one by name.
- **A value is a finite number or null.** `NaN`, an infinity or a string is refused, by field and row.
- **A total may be null.** It is written as a dash, no change is said of it, and a share view says each value in place of its percentage.
- **`partial: true`** marks an unfinished bucket, and **`meta.empty: true`** a period with no data.
- **A spec may be drawn against an answer that already exists.** It names metrics that answer has, and its `by`, `range` and `compare` are the answer's.

The fixture engine (`packages/fixtures`) has three data states, `typical`, `no-prior` and `empty`. It answers `where` from the pairs it makes, within limits it names.

---

## 6. The view spec

**Version `view/0`.** The schema is `packages/core/schema/view.schema.json`. What a schema cannot check, a field against a result or a preset's name, `resolve()` does, and its error names the fix.

```json
{
  "spec": "view/0",
  "title": "Visitors",
  "use": "line",
  "query": { "metrics": ["visitors"], "by": ["date.day"], "range": "28d", "compare": "previous" }
}
```

| Field | Meaning |
|---|---|
| `spec` | The format's version |
| `title` | Shown by the container's frame, and not drawn in the view |
| `description` | What the view is for, in its author's words. Said before the tldr prose and drawn nowhere |
| `query` | Required. Section 5 |
| `use` | A preset's name, which expands into `layers` (section 9). Ignored where `layers` is present |
| `layers` | The layers, written out |
| `facet` | One of the query's dimensions: the spec is then a view for each of its values |

A spec says what to show and nothing of how. It has no lever over what a container gives up (Decided 63).

**A layer:**

| Field | Meaning |
|---|---|
| `mark` | `line`, `area`, `bar`, `rule`, `text`, `dot`, `tick`, `cell`, `arc`, `unit`, or a custom mark's name |
| `encode` | Channel to field: `x`, `y`, `x2`, `y2`, `color`, `detail`, `size`, `text`, `angle`, `radius`. A field is a dimension, a metric, a companion the result returns, or a number. What each mark reads is in section 7 |
| `series` | `"previous"` draws the metric's comparison companion. `"delta"`, on a `text` layer in rows, is the row's change, painted by polarity |
| `role` | `primary`, `comparison`, `reference` or `context`. By default a `previous` series is `comparison`, a `rule` is `reference`, and anything else is `primary` |
| `stack` | `"zero"`, `"normalize"` for share of the whole, `"center"`, or `"diverge"`, on a layer split by `color`. A `bar` split with no `stack` sits beside its neighbours |
| `sweep` | `"half"`, for an `arc` divided by `color` or read against a range, and for a `unit`'s seats |
| `label` | The text of a rule |
| `at` | On a `rule`: the value of x it stands at, or a list of them |
| `align` | `"end"` for a column of values. On a `tick`, `"start"` or `"end"` is the half of it to that side |
| `paint` | A paint token in place of the layer's own. `"delta"` is good or bad by the metric's change. `"direction"`, on a `bar` or an `area` with two ends, paints each by which way it runs |

**The channels that split.** A dimension on `color` splits a layer into a series for each value, each in a series colour, six at most, with a legend. A dimension on `detail` splits it the same way and paints none apart: every series is in the layer's own paint, with no legend and no limit. A layer is split once. The query's second dimension goes to `color`, to `detail`, to `facet` or to the other axis.

**Paint tokens an author may name:** `series.1` to `series.6`, `compare`, `rule`, `ink`, `ink.muted`, `delta`, `delta.good` and `delta.bad`. A layer with no `paint` takes `series.1`, or `compare` for a `previous` series. The ramps (`seq.1` to `seq.10`, `div.1` to `div.9`) are the colour scale's: a metric on `color` is quantized to one, diverging where its values cross zero (Decided 33).

**A description** (Decided 62). A view's sentence is derived, since its data is live. What its author can say that the data cannot is what the view is for: "How many people came, day by day." It says nothing the data would make false: no number, no date, no "up". A facet says it once.

**A rule at a value** (Decided 46). A reference line at a number stands on a scale: `{ "mark": "rule", "encode": { "y": 1000 } }`. On an axis that is a list, a time or a category, a string on a channel would be a field, so the place is said as a value:

```json
{ "query": { "metrics": ["visitors"], "by": ["date.day"], "range": "28d" },
  "layers": [
    { "mark": "line", "encode": { "x": "date.day", "y": "visitors" } },
    { "mark": "rule", "at": "2026-09-21", "label": "Launch" }
  ] }
```

A value is matched as the engine writes it. One the axis does not have is not drawn and is no error, so a view does not break when its range moves past a date.

**Colour by a metric in a plot** (Decided 47). A `bar` or a `dot` takes a metric on `color`, as a `cell` does. Each mark is a step of the ramp, and the ramp stands under the plot as its key. One metric paints a plot, and not beside colours that tell series or metrics apart. A `line` and an `area` take none: one path has one paint.

```json
{ "query": { "metrics": ["visitors", "page_conversion"], "by": ["page"] },
  "layers": [{ "mark": "bar", "encode": { "x": "page", "y": "visitors", "color": "page_conversion" } }] }
```

**Several metrics on one plot.** Each is a layer, and they are told apart as the series of a split are: a series colour for each metric, an entry in the legend, a label where each line ends. Bars of several layers sit side by side. Metrics of one unit share the y axis, metrics of two units get an axis each, and three units is an error.

**A facet** (Decided 26 and 45). `facet` names a dimension in the query's `by`, and the spec is a view for each of its values, in the engine's order. With the facet as the only dimension each view is a number: an instrument panel.

```json
{ "use": "line", "facet": "channel",
  "query": { "metrics": ["visitors"], "by": ["date.day", "channel"], "range": "28d", "compare": "previous" } }
```

- **Scales are shared.** Every scale takes the widest domain any view would take alone, so a small value is drawn small. A whole is its own: the shares of a pie are of their own view.
- **Totals are the engine's:** a view's are its value's row of `totalsBy`.
- **A spec says no columns.** The element holds the views in a grid that wraps where one would have under 200 px. `facetColumns` is the same sum for a surface with no CSS.
- `resolve` refuses a spec with a `facet`, which has no one plan. `facets(spec, result, catalog)` gives each view's `key`, `label`, `spec` and `result`.

Not built: a y axis on the first view of a row only, and a facet down the rows.

**A board** (Decided 49). A board is views and the part of the query they share. It is a document of its own, `board/0` (`board.schema.json`):

```json
{ "spec": "board/0", "title": "Traffic",
  "query": { "range": "28d", "compare": "previous" },
  "views": [
    { "spec": "view/0", "title": "Visitors by day", "use": "line", "query": { "metrics": ["visitors"], "by": ["date.day"] } },
    { "spec": "view/0", "title": "Channels", "use": "bar-list", "query": { "metrics": ["visitors"], "by": ["channel"] } }
  ] }
```

- **Its `query` is its params:** `range`, `compare` and `where`, and nothing else. There is no variable, reference or expression. A view that states its own keeps it.
- **One rule combines the views, and no field changes it.** A view is filtered by every dimension of the board's `where` but the ones it draws. On one it draws it keeps every value and marks the ones held (`selected`).
- **A board has no layout and no state apart from itself.** A surface that changes a param holds a new board.
- **Core gives the views and fetches nothing:** `boardViews(board, catalog)` returns each view's key, its spec and what it marks, and `boardSelect` the board after a selection (section 13). Each view needs a `title`, which is its key.
- `<ua-view>` draws no board. The bench's Board page is the reference surface.

**Rules:**

- A spec with no dimension and no layers is the tldr value alone.
- A spec with a dimension and neither `layers` nor `use` is an error. There is no silent default.
- A layer that encodes a field the query does not return is an error that lists what it does return.
- A layer that says what its mark does not read is an error that lists what the mark reads (section 7).
- A field that a spec, its query or a layer does not take is an error that lists the ones it does. So a size written in a spec is refused, and not read past.

---

## 7. Marks, transforms and layouts

### Marks

A mark carries only its shape and what that shape implies. How marks relate, stacked, overlaid or side by side, is a transform or layering, and never part of the mark.

| Mark | What comes with it |
|---|---|
| `line` | Joins neighbouring rows, so x is ordered. Over a binned number it is drawn as steps. With a metric on x and on y it joins the points in the engine's order. With a `rank` on y, first place is at the top |
| `area` | Fills to zero, or between two ends (`y2`). With `paint: "direction"` it is cut where its ends cross, and each piece is a gain or a loss. Stacked about the middle it has no value axis |
| `bar` | Has a baseline, so its scale holds zero. With two ends it floats. In rows, stacked, it is divided by the query's second dimension, and with nothing on `x` it is the metric's `domain` behind the row's marks. With a metric on `size`, in a plot of shares, its column is as wide as its share |
| `rule` | A reference line at a number, or at a value of x (`at`). With `x2` or `y2`, a segment for each row. With all four, a line across a plot of points |
| `text` | A row's label, a column of values, or a label on a point, on a grid's pair or on a map's region |
| `dot` | A point, sized by the painter or by a metric on `size`. With a dimension on both axes it stands in a grid |
| `tick` | A short stroke across its band at a value. In a plot of points, with a metric on x and nothing on y, a stroke at the foot for each row: a rug |
| `cell` | Both positions are lists, and its colour is a step of a ramp. With one axis it is a strip |
| `arc` | A shape about a centre. `angle` and `radius` take a metric and a dimension between them, and which holds what is the form |
| `unit` | A value as counted glyphs, one for so many. What a glyph is worth comes from the data |

**An `arc` has four forms,** and no field names one:

- **A metric on `angle`, a dimension on `color`:** a segment for each row, its share of the engine's total. A number on `radius` is the inner radius, which makes a donut. A second dimension on `detail` is a ring outside.
- **A dimension on `angle`, a metric on `radius`:** an equal slice for each row, reaching out to its value, so its area carries the value. A rose.
- **A dimension on `radius`, a metric on `angle`:** a ring for each row, six at most, swept against the catalog `domain`.
- **A metric on `angle` alone:** read against its catalog `domain`. A gauge.

**A `unit` has five forms,** chosen by its channels:

| On its channels | Layout | Draws | A glyph is worth |
|---|---|---|---|
| A dimension on x, a metric on y | `cartesian` | A stack of dots up from the axis for each value | The least of 1, 2 and 5 times a power of ten at which the largest value is ten glyphs or fewer |
| A dimension on y, a metric on x | `rows` | A run of dots along each row's track | The same |
| A metric on x, a dimension on `color` | `band` | A grid of a hundred cells, a run of them for each value | A hundredth of the engine's total, shared out by largest remainder |
| A metric on x, and no dimension | `band` | The same grid, lit up to the metric's place in its `domain` | A hundredth of the domain |
| A metric on `angle`, a dimension on `color`, `sweep: "half"` | `radial` | Seats round a half circle | One, up to a hundred seats, and beyond that a round number |

Glyphs are counted, so they are never drawn smaller than can be told apart: short of the room it needs, a form becomes the plainer preset of the same query (section 9). A line under the glyphs says what one is worth, "Each is 500".

### A custom mark is a candidate

**Decided 59.** A custom mark, registered in code (`registerMark`) and written in a spec by its name, is where a form the grammar cannot say enters the system. It is not a way round it: an author who wants a chart this system does not draw has other libraries. So a custom mark is held to what a core mark is held to from the day it is registered, in `test/admission.test.ts`:

- it says the channels it reads (`reads`) and the layer fields (`fields`);
- a sample in the bench draws it;
- every scene it builds is valid against `scene/0`: paint tokens, unique keys, and no field of its own;
- at every room it shows something, and in the least it is its number, or the view it gave way to is.

There are three: `geo`, a map (`packages/geo`); `link`, a Sankey of one step (`packages/flow`); and `partition`, a treemap (`packages/partition`). A custom mark gives core a scene in ratios and its fit rules, and gives a surface a painter. It takes one layer, alone in its view, with the plot's `text` over it where it offers its places.

**What moves a mark into core (Proposed).** It is drawn in the views of more than one product. It takes the plot's marks over it. It needs no dependency core does not have. Its fit rules are ladders of parts core already has. What moves a core mark out is the reverse, and `unit` is the one to watch.

### What each mark reads

What a mark reads depends on the layout it is drawn in. This table is the whole of it, and it is data: `READS`, `NEEDS` and `FIELDS` in `packages/core/src/reads.ts`, which `test/reads.test.ts` holds this table to. `resolve()` refuses what a layer says that is not here, by name: a mark its layout does not draw, a channel the mark does not read there, a channel holding what the mark takes no account of, a layer field the mark has no use for, and a mark with nothing on a channel it needs. The error says what the mark does read.

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

A `metric` is one of the catalog's, or a companion the engine returns with one. A `companion` is one returned with a dimension (`source@kind`). A `number` is a constant.

The table says what one channel may hold. What a mark asks of several together is refused where the mark is drawn: a second end that needs a first, a `label` on a rule for each row. Two forms are refused by the plan: a `paint` beside a dimension on `color`, since a mark has one paint, and `series: "previous"` on a layer that encodes no metric. A layer of the period before, where the answer has none, is left out and reported (`plan.dropped`).

### Limits, and why each holds

A limit is backpressure: it says where the grammar ends, and a refusal that names the next step is a signal an author can act on. Each holds for a reason, and none is changed without that reason being answered.

| The limit | Why it holds | In its place |
|---|---|---|
| Six series colours, six rings round a centre, six sources in a Sankey | What an eye can tell apart | `limit` on the query; `detail`, for a series each in one paint; a list |
| Two units on one plot, and no third | What an eye can read against an axis | A view for each, on a board |
| No sum of rows, no share worked out of them, no quantile, bin or running total | What keeps a number true: many metrics do not add up | The engine's totals and `totalsBy`; a companion field |
| An answer that is not of its query, or of its filter, is refused | What keeps a number true | What the query returned, set with its spec in one step |
| No expression, function, variable or reference in a spec; a string on a channel is a field | What keeps a spec data: a page can take one from an author it does not trust | `at`, for a value; a companion, for what is computed; a custom mark, for what is drawn another way |
| No size, breakpoint or presentation switch in a spec | The vision: what a view looks like belongs to where it lands | The container's rules, and a context's own set of them |
| One layer in a band; one custom mark to a view, with the plot's `text` over it | A layout is an arrangement of parts, and these have one place for marks | A plot or a list; `places` |
| A query is by two dimensions at most; `where` joins dimensions by "and"; a range is a count of days or now | The engine's contract, which is Open with the API's owners | Another query; another tool |

### Transforms

`stack` is the only one: `"zero"`, `"normalize"`, `"center"` and `"diverge"`. `"diverge"` sets the first half of the series below zero and the second half above it, and the middle one of an odd count half on each side. Binning, quantiles, density and running totals are not transforms: the engine returns them (Decided 25).

### Layouts

A layout is an arrangement of parts, chosen from what is on x, y and `color`. It says what stands round the marks, and not which marks may be drawn (Decided 44): a mark is one function of its space, drawn in each layout by the function it has.

| Layout | Chosen by | Draws |
|---|---|---|
| `cartesian` | A dimension on x | A plot over a category or a time axis: line, area, bar, rule, and a `unit`'s stacks |
| `cartesian` | A metric on x and on y | Points: `dot`, `text`, rules on either axis, and a `line` that joins them |
| `rows` | A dimension on y | A list: a label, a track that bars, dots, rules and ticks draw in, and columns of values |
| `band` | A dimension on `color` only | One bar divided by share, with a legend, or a `unit`'s grid of a hundred |
| `matrix` | A dimension on x and on y | A grid of `cell`s with a ramp, of `dot`s with a key to sizes, or both, and a `text` over them |
| `radial` | Anything on `angle` | `arc`s about one centre, a `unit`'s seats, and the plot's `line`, `area` and `dot` bent about it |
| a custom mark's name | A layer with that mark | What the mark draws, and the plot's `text` at its places |

**A table is rows of `text` layers.** Each `text` with a metric on `text` is a column of values, and one with the dimension is the row's label. With more than one column the columns get headers, from the metrics' labels. A bar is optional.

```json
"layers": [
  { "mark": "bar",  "encode": { "y": "page", "x": "pageviews" } },
  { "mark": "text", "encode": { "y": "page", "text": "page" } },
  { "mark": "text", "encode": { "y": "page", "text": "pageviews" }, "align": "end" },
  { "mark": "text", "encode": { "y": "page", "text": "engaged_time" }, "align": "end" }
]
```

**A row divided by the query's second dimension.** A `bar` with `stack` in rows takes that dimension on `color`. A row's text reads the engine's total for the row. With `stack: "diverge"` and two series it is a population pyramid, and with five a Likert chart.

```json
{ "query": { "metrics": ["visitors"], "by": ["age", "sex"] },
  "layers": [
    { "mark": "bar",  "encode": { "y": "age", "x": "visitors", "color": "sex" }, "stack": "diverge" },
    { "mark": "text", "encode": { "y": "age", "text": "age" } }
  ] }
```

**More in a row.** A `dot` or a `tick` with the second dimension on `detail` has one mark for each pair, at half strength: a strip plot. A `bar` with nothing on `x` is the catalog `domain` behind the row's marks, divided at its `bands`: a bullet graph. A `line` or an `area` with a metric on `x` runs down the list from row to row:

```json
{ "query": { "metrics": ["pageviews"], "by": ["page"], "compare": "previous" },
  "layers": [
    { "mark": "bar",  "encode": { "y": "page", "x": "pageviews" } },
    { "mark": "line", "encode": { "y": "page", "x": "pageviews" }, "series": "previous" },
    { "mark": "text", "encode": { "y": "page", "text": "page" } }
  ] }
```

**A grid with its values.** A `text` on a grid's x and y says what is on `text` in the middle of each pair, over a `cell` or a `dot`. A surface shows the values in every pair or in none, by whether each fits.

```json
{ "query": { "metrics": ["correlation"], "by": ["factor", "other_factor"] },
  "layers": [
    { "mark": "cell", "encode": { "y": "factor", "x": "other_factor", "color": "correlation" } },
    { "mark": "text", "encode": { "y": "factor", "x": "other_factor", "text": "correlation" } }
  ] }
```

**The plot's marks about a centre.** With a dimension on `angle` and a metric on `radius`, a `line` runs round and closes, an `area` fills in to the middle, and a `dot` stands at each place: a radar. `series: "previous"` is the period before.

```json
{ "query": { "metrics": ["visitors"], "by": ["weekday"], "compare": "previous" },
  "layers": [
    { "mark": "area", "encode": { "angle": "weekday", "radius": "visitors" }, "role": "context" },
    { "mark": "line", "encode": { "angle": "weekday", "radius": "visitors" }, "series": "previous" },
    { "mark": "line", "encode": { "angle": "weekday", "radius": "visitors" } }
  ] }
```

**A map (`geo`).** `x` is the dimension whose values are region keys, `color` a metric to fill each region by, and `size` a metric for a symbol on each. The shapes and the projection are handed over in code. A `text` on the same `x` is a label in the middle of each region. Below the room a map needs it is the ranked list of the same query.

```json
{ "query": { "metrics": ["visitors"], "by": ["country"] },
  "layers": [
    { "mark": "geo",  "encode": { "x": "country", "color": "visitors" } },
    { "mark": "text", "encode": { "x": "country", "text": "visitors" } }
  ] }
```

A tile map is the same mark with other shapes. A spec may not say which shapes to draw, since that would be a presentation switch, so a page registers the mark once for each set, under a name each, and a painter for that name: `registerGeo(shapes, { name: "geo-tiles" })` and `registerPainter(geoPainterAs("geo-tiles"))`.

**A Sankey of one step (`link`).** A query by two dimensions: `x` is the source, `y` the target and `size` the metric. A node is as tall as the engine's total for it, so the result needs `totalsBy`. Short of the room its names need it becomes the `heatmap` of the same query.

```json
{ "query": { "metrics": ["visitors"], "by": ["channel", "landing"] },
  "layers": [{ "mark": "link", "encode": { "x": "channel", "y": "landing", "size": "visitors" } }] }
```

**A treemap (`partition`).** `x` is the dimension the box is divided by and `size` the metric each area is its share of. A second dimension on `detail` divides each part again, and a metric on `color` paints every box off the ramp. Every area is a share of a total the engine gives. Below the room it needs it becomes a list.

```json
{ "query": { "metrics": ["pageviews"], "by": ["section", "page"] },
  "layers": [{ "mark": "partition", "encode": { "x": "section", "detail": "page", "size": "pageviews" } }] }
```

---

## 8. Roles, guides and the tldr value

**Roles** let a container reason about a view without knowing what chart it is. `primary` is the thing itself, `comparison` the same metric for another period, `reference` a target or a threshold, and `context` supporting ink, such as the area under a line.

**Guides are read off scales, and never authored.** A spec cannot switch one on or off. Which encoding each comes from is one table, `GUIDES` in `packages/core/src/guides.ts`:

| Guide | Read off |
|---|---|
| An axis, and the grid | A plot's positions, and a grid's |
| A legend | A dimension on `color`, or the several metrics a plot's layers measure |
| A ramp | A metric on `color` |
| A key to sizes | A metric on `size` |
| The names round a rim | A dimension on `angle` |

**A guide is a key or a frame** (Decided 40 to 42). A key says what an encoding means: the legend, the ramp, the key to sizes, what a glyph is worth, the second y axis, a column's header. The marks it keys cannot be read without it. An axis and a grid frame marks that still read by their shape, which is why a plot may give them up and stand bare beside the number. So no fit rule takes a key while its marks are drawn, unless it puts a shorter form in its place or has the marks drawn without the encoding. `test/guides.test.ts` holds every rule to it.

| Key | When room is short |
|---|---|
| A plot's legend | A label at each line's end, where there is a line. Bars and dots keep theirs as long as the axes |
| A legend with nothing to stand in for it: a divided list's, a band's, a circle's | One line that names the largest, a part of its own (`legend-top`). Then it goes and takes the colours with it: its marks are drawn in one paint (`split: plain`). One ladder for the three (Decided 66), and a band's bar goes with its line |
| The ramp | A thin strip of every step, its two ends still numbered (`ramp: strip`) |
| The key to sizes | Its largest step (`size-key: most`). In a bare plot the dots are one size |
| The names round a rim | Thinned to about four |
| The second y axis | Stays as long as the first. In a bare plot what is drawn on it goes too |
| What a glyph is worth | Stays as long as the glyphs, which give way to their plainer preset |
| A row's column headers | Stay as long as two columns do |

**The tldr value** is the primary metric's total from the engine, a delta where the query compares, and a note: the range total's caveat ("Sum of daily counts") over a time dimension, the leader ("Top: /pricing") over a categorical one, its share where the view is of shares ("Search 41%"), and "right now" for an instant metric.

Where it appears is the container's decision:

- It is the whole view where there are no layers, and what remains when the marks go.
- It stands beside the plot when the axes go.
- It sits above the marks by the rule `tldrValue.above`: by default only for an instant metric, and a context can pass `always`.

A delta is up or down with a percentage, "No change" (under 0.5%), "New" (the period before was zero), or "No prior period" (it is null). Its colour follows the metric's polarity.

---

## 9. Presets

A preset is a saved fragment of a spec with slots filled from the query: `$metric` and `$by`, `$split` for a second dimension, `$metric2` for a second metric, and a suffix for a companion (`$metric@p50`). It expands before the grammar runs, and nothing downstream knows its name.

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
  ] }
}
```

**The library ships the common charts and no more** (Decided 54), each named after the `@automattic/charts` component it replaces where one exists. A form that is less common is written as its layers: the bench has a sample of each, a box plot and a waterfall, a bump chart and a waffle.

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

**A custom mark's package registers its own,** with `registerPreset(name, { layers })`, since core cannot name a custom mark. A spec uses a registered name as it uses any other, and a fit rule's `fallback` may name one.

| Preset | The query needs | Draws |
|---|---|---|
| `choropleth` | One dimension whose values are region keys | A map, each region filled by the metric on the sequential ramp |
| `sankey` | Two dimensions, the source and then the target, and `totalsBy` in the result | A Sankey of one step: a node for each value, and a ribbon for each pair |
| `treemap` | Two categorical dimensions, a parent and its children, and `totalsBy` in the result | A box divided by area among the first dimension's values, and each part divided again among the second's (`packages/partition`) |
| `pair-list` | Two categorical dimensions | Rows, one for each pair, named by both. What a treemap of two dimensions becomes below the room it needs |

- A code base that wants a name for a form registers it, or hands `resolve()` a library of its own.
- A `previous` layer is left out on expansion where the query has no `compare`.
- A preset that needs companions works only against a result that has them, since a query cannot yet ask for one.
- An unknown preset is an error that lists the library and the registry.
- **The health check for the approach:** if presets come to need hand-tuned forms for a size, this has become a chart-type library with extra steps (Open 3).

---

## 10. Fitting the container

**Who decides what.** The spec is the seed: an author writes it and decides where it renders. A container fits the view by a rule set. The defaults ship with the design system and have to be good at any size. A context that wants its containers to behave otherwise hands them its own set once, as it hands them tokens (`rules`, whose `fit` list is the room each part needs).

**The language is where the view lands** (Decided 67). A container says it with its rules: `rules.locale`, a BCP 47 tag such as `de` or `pt-BR`. Every number, date and country's name a view says is then in that locale: in its sentence, its scene, its readout and its table. In a browser, where its rules name none, the element speaks the page's own language: the nearest `lang` at or above it, its own among them (Decided 69). With neither, or a language the machine has no data for, a view is in English. The machine's own language is never asked. A spec never says a locale, as it never says a size. What the engine sent as a value (a page's path, a bin's ends) and what an author wrote (a layer's `label`) are said as they came, and a time is said as it was written, with no zone asked, in any locale.

**Its own words are one table** (Decided 68): 49 short templates, `WORDS` in `packages/core/src/words.ts`, for what a view says that is neither the catalog's, the engine's nor the author's: "No data", "last {count} days", "Top: {name}", the clauses of the sentence. A container hands its own with its rules, as `rules.words`: any of them, and English is said for the rest.

```json
{ "locale": "de", "words": { "noData": "Keine Daten", "lastDays": { "one": "letzten Tag", "other": "letzten {count} Tagen" } } }
```

A `{name}` is filled with what the view has for it, already in the locale. An entry that depends on a count gives a form for each plural category the language has, with `other` for the rest. A word that is not in the table is refused by name. Two things are English still: the letters of a unit ("ms", "kB", "2m 05s"), and the order of the sentence's clauses, each of which is its own template.

**Intrinsic by default.** A container does not know or care where it is. It fills the room it is handed and renders itself for that room.

- With nothing said, a container fills the width and takes its natural height.
- A layout that hands out a box, a toolbar row or a dashboard tile, opts its children into filling the height too. That is the layout's CSS, and never the view's.

### 10.1 What a view gives up, and in what order

Each part has a rule that says the room it needs, and gives way on its own when its container is short of it. For a plot the effect is a ladder:

1. Labels on points go, and a legend becomes a label at each line's end.
2. The axes and the grid go. The number stands beside the bare plot in their place.
3. The layers that are not `primary` go, by the plot's own box.
4. The marks go. The number stays.
5. The number takes its shorter forms, and then the tldr prose is all that is left.

Some of the room the default rules ask, in em of the view's type, with what that is in px on a page of 16 px type:

| Part | Needs | In px |
|---|---|---|
| A plot with its axes | 21 wide, 9 tall | 280 by 120 |
| Comparison and reference layers | A plot 13.5 by 6.75 | 180 by 90 |
| A bare plot beside the number | 11.4 wide, 3.45 tall | 152 by 46 |
| A list's row | 2.1, with 6.75 for its label | 28, and 90 |
| A share bar | 8.25 wide, and 12.75 for its whole legend | 110, and 170 |
| A circle | 5.4 by 4.8 | 72 by 64 |

Every need is one of forty picked numbers or a sum of them, said once in `LEAST` in `packages/core/src/fit.ts` (Decided 58).

**Known to be weak:** a bar list keeps every row and then jumps to the number, with no step between (Open 6). The thresholds are still picked by eye.

### 10.2 How a view is fitted

**In a browser, by CSS, part by part.** The element plans once for each change of data and paints the scene in ratios. Positions are custom properties that CSS turns into pixels, lines and areas are a stretched SVG, and each fit rule is a container query. Nothing runs on resize.

**A measured pass, for what CSS cannot see:** ticks and labels thinned where they would meet, and any threshold that depends on the content.

**Anywhere else, by the reader.** `fitTo(scene, room, rules)` reads the same rules at a room and says the parts that show, what else is hidden and the switches set. `viewAt(spec, result, catalog, room)` gives the plan and the scene with it, and follows a rule's `fallback` to the view the spec gives way to. An agent, a canvas painter and a native shell read a view's fit this way. It measures nothing.

**One source of truth.** The rules are data (`FIT_RULES`): one for each part, naming a container (the view or its plot), the room the part needs, and what is hidden, shown or switched otherwise. A rule may be for a view that holds one mark (`mark`) or for one kind of view (`has`), and may name a `fallback`: a preset the view becomes. A rule names every part it takes, since a reader with no browser has no nesting to go by. `test/fit.test.ts` holds every sample at every room to what the rules promise: a view always shows something, it is its number alone wherever a rule takes its marks, and no key goes while its marks stay. The bench's `check` holds each captured frame to the same reading.

**Sizes are relative (Decided 64 and 65).** Nothing in a view is a number of px but a stroke. A view's unit is its em: the size of its type, which is its label face.

- **A need is in em.** The element sets itself in its label face, and its plot inherits that, so a fit rule's query asks in `em` on either and nothing is measured. A view set in larger type gives way sooner.
- **So is every size in the element:** a row, a gutter, a gap, a swatch, a dot. Each is in em of the view's type, or of the face it stands by: the padding beside a tick follows the tick. Where two faces must line up, a header over a column of values, both take the view's em (`--uav-em`).
- **A surface with no browser gives its room in px and says the size of an em with it:** `em` on the rooms `fitTo`, `viewAt`, `explain` and the agent's `check` take. Left out, an em is `EM`: 13.33 px, the label on a page of 16 px type.
- **A view with no theme follows the reader's type size:** the faces fall back to sizes in rem.
- **A view inside another takes that one's em:** the view a fit rule falls back to, and a facet's views.

What is still in px: a stroke, a hairline between two marks, a radius, a shadow; the half px a need is read under; what the measured pass reads off the page; and the cell of a number set in dots, which is a grid of pixels (`dots.ts`).

What it does not do:

- **One size stands for the view's type** in a need. A theme that changes its ticks alone moves no threshold, though the tick's own padding follows it.
- **The em is the element's own.** A label token that is fluid in `cqi` is read there against what the element stands in, or the viewport, and inside the view against the view. With the bench's theme the two differ by 7% at most.
- **A size lands a 64th of a px under a whole px,** since an em of 13.33 px is no whole number: a row that was 28 px is 27.98.

**What the rules do not say yet (Open 19).** The element settles these in its stylesheet or its measured pass, and a surface with no browser has to see to them itself:

- whole rows trimmed to a height, and a ranked column given up by the width of its values;
- the number's shorter forms, its note, and the prose rung where the number itself does not fit;
- a number wider than the hole of its donut;
- labels thinned where they would meet;
- a legend that wraps out of its room, and anything else that depends on how tall the content is.

The two rules on the plot (`secondary` and `hole`) ask for the plot's own box, in em as every need is, which only a surface that has laid the view out knows. `fitTo` passes over them where the room gives no plot.

**Not built:** what changes the data. The first N and "other", a coarser grain and downsampling need a new query, not new styles.

### 10.3 Constraints

1. CSS can hide and restyle. It cannot ask a new query.
2. CSS cannot see collisions, and cannot express a threshold that depends on the data.
3. CSS exists only in the DOM.
4. A height query needs a container with a definite height. One sized by its content can be asked only its width.
5. Style queries are still partial. Do not depend on them.

### 10.4 Why a view looks as it does

A spec that does not come out as its author expected is fixed in the spec, so a view says what it decided in the spec's own words. `explain(spec, result, catalog, room)` returns:

- the layout, and why the layers asked for it;
- every part the plan has, and the place in the spec it comes from: `layers[0].encode.color`, `query.metrics[0]`, or `use "donut": layers[0]` for a preset's;
- at a room, each fit rule that holds: what it hides or shows, what it needs and what the room has, and the lever that would change it. For a fit rule the lever is the room, which is the surface's to give;
- a filter, straight after the layout.

`UaView.explain()` asks it at the element's own size and adds what the measured pass decided there. The agent's `check()` is the same reading with no browser, at the rooms it is handed.

---

## 11. The scene

A scene is what is drawn, as data: `{ layout, parts, nodes }`. Nodes are flat and drawn in order. It has no size: every node says where it is in ratios of the box it is in, its part's, or in a list its row's track. Its schema is `packages/core/schema/scene.schema.json` (`scene/0`, a draft), and every scene a sample builds is held to it.

**A node says where it is in one vocabulary** (Decided 51), whatever its kind and whatever the layout:

| Field | What it says |
|---|---|
| `x`, `y` | Where it is. For a mark that runs along an axis, a bar or the fill under a line, where it reaches |
| `x2`, `y2` | Its other end, where it has one that is not the start of the axis |
| `w`, `h` | An extent: from `x` and `y` for a rect, about them for a glyph's room |

`x` runs across from the start and `y` up from the bottom, for every node. So a bar in a plot is `x` and `w` across, and up to `y` from `y2`. A line is from (`x`, `y`) to (`x2`, `y2`), and a dot and a label are at (`x`, `y`). An arc keeps its own fields: `a0`, `a1`, `r0` and `r1`. The number, a legend and a list's rows carry no position: a surface sets them in order.

Every node also has:

- **`key`:** stable across renders and unique, such as `primary:line` or `primary:bar:2026-09-08`. Transitions and keyboard navigation hang on keys. A result that says a dimension's value twice still gets a key for each row (`Google#2`).
- **`paint`:** a token, never a colour. The tokens are `ink`, `ink.muted`, `background`, `grid`, `axis`, `rule`, `compare`, `live`, `delta.good`, `delta.bad`, `series.1` to `series.6`, `band.1` to `band.3`, and the steps of the two ramps: `seq.1` to `seq.10`, `seq.none`, and `div.1` to `div.9`.
- **`part`:** the part it is drawn in, which is what a fit rule hides or shows.

A scene is the same on every machine, to the digit. Its y scale always rounds to four ticks, and a rule thins them on a short plot (Decided 21).

**Core places nothing** (Decided 43). A surface with no CSS gets the scene and what the fit rules make of it at a room, and places the parts itself. One generic placer is Open 20.

---

## 12. Painters

**Status: the HTML and CSS painter is Proven (`packages/dom`, the `<ua-view>` element). No other is built.**

- **Tokens, not colours.** A painter maps paint tokens to CSS custom properties, in the token structure of `@automattic/charts` under our own prefix: `series.1` is `--ua-charts-color-series-1`. `packages/dom/src/tokens.ts` lists the public tokens with the value each falls back to, so a page that loads none still gets a legible view. Light and dark are token sets.
- **Intrinsic sizing.** The element plans once for each change of data, and CSS fits the view on resize. Bars are HTML placed by custom properties, and lines and areas are a stretched SVG. Every size is in em (section 10.2), so a theme's type is the one thing that sets how large a view is drawn.
- **Text stays in the DOM,** so it stays crisp, takes tokens and is reachable by keyboard.
- **Isolation.** A view must not inherit or leak styles on a page it does not own: it is a custom element with shadow DOM.
- **Direction.** A plot's frame runs left to right whichever way the page reads, and a circle runs clockwise. What mirrors with the page is the legend, the keys, the number's block, the prose, a band and a list of rows.
- **A custom mark's painter** joins through `registerPainter`.

**Proposed, and not built:** a renderer chosen by how many marks there are (HTML and SVG up to a few thousand, canvas beyond), and a dot-grid painter that redraws the same scene on a fixed grid of cells, with series told apart by dither pattern. Either is a painter over the same scene, and never a chart type.

---

## 13. States

| State | What a view does | Status |
|---|---|---|
| Empty period | A notice in place of the marks, "Page views: nothing in this period yet", and a zero where it is the number alone | Proven |
| No prior period | The comparison layer is left out and reported, and the delta reads "No prior period" | Proven |
| Partial bucket | A dashed tail on a line, a faded bar, left out of the area | Proven |
| Instant metric | The number, with "right now" | Proven |
| Loading | A placeholder, which fades in after 150 ms so that a view that paints at once never shows it. A view already drawn stays drawn while new inputs are awaited | Proven |
| Error | The last valid view stays drawn, with the message under it | Proven |
| An answer of another query | Refused: a row or the totals lack a field the query names | Proven |
| Stale or late data | | Open 23 |
| Filtered (bots, consent) | | Open 23 |
| Metric unavailable here | | Open 23 |

**Inputs.** `<ua-view>` takes `spec`, `result`, `catalog` and `rules` as properties or as JSON in child scripts. A spec and its result belong together, and a host that changes both sets them in one step, or the new spec meets the old result and is refused:

```js
view.inputs = { spec, result };          // an input left out keeps what it had
```

### Selection

A selection is a filter, as a query's `where` is one (Decided 49): what is picked is said by its values, never by pixels or row ids. The view does not keep it, and decides nothing of what an activation does to it (Decided 50). When a datum is activated the view sends `ua-select`, whose `detail` is a proposal: `where`, the filter that datum is; `how`, how it was activated; and `key`. The host folds the proposal into the filter it keeps, with core's `select`, and sets the result back:

```js
view.addEventListener('ua-select', (e) => { view.selected = select(view.selected, e.detail, catalog); });
```

On a board the fold is `boardSelect`, and the host sets on each view what `boardViews` says it is to mark.

| `how` | Click or tap | Keys | What `select` makes of it |
|---|---|---|---|
| `pick` | plain | Enter, Space | Each dimension is held to the datum's value alone. Where it already was, the datum is let go |
| `toggle` | Cmd or Ctrl | Cmd or Ctrl with Enter | The value joins those the dimension is held to, or leaves them |
| `extend` | Shift | Shift with Enter or Space | On a time or a number, a run from what is held to the value. On a categorical dimension it is a toggle |

- **What a datum is.** A point of a plot or a row of a list is its value of the dimension along it. Where a series is chosen at a point it is both dimensions, as a grid's cell is.
- **What is marked.** `selected` takes any filter, and the view marks every atom whose rows all hold it (`data-selected`, and `aria-selected` for assistive technology). A dimension the view does not draw marks nothing.
- **A set of cells is a set on each dimension.** A proposal of two dimensions is folded one at a time, so two cells toggled are their columns and their rows.
- **It filters nothing.** What a view is of is its query's `where`, which is the host's to ask for.
- **It stays.** A selection outlives a new result where its data do, and Escape does not let it go.
- **A touch has no modifier,** so a tap is a pick. A surface that wants several picked by touch passes `toggle` for a plain activation.

Not built: a drag along a plot for a run, and a look for Selected, which is design's to set (Open 9).

---

## 14. Accessibility

Written once against the scene and the plan, not for each preset.

- Every view exposes its **tldr prose** as its accessible description, after its `description` where a spec has one, and says it again, politely, when new data changes it.
- Every view offers the **same query as a table.** Chart and table read one result.
- **Keyboard navigation** over data marks, by their keys and the row each came from, in the keyboard model of `@automattic/charts`. A mark announces its dimension's value, the metric's value in its catalog format, and the comparison where there is one.
- **What is selected is said,** not only shown (section 13).
- **Never colour alone.** Series also differ by dash, pattern or a direct label. Patterns are not built.
- Visible focus, sufficient contrast in both themes, and `prefers-reduced-motion` respected.

Owed: a pass with a screen reader.

---

## 15. Transitions

- **Stable keys give enter, update and exit** for any view, including when a container gives up a part.
- Positions are registered custom properties, so the **design system's motion tokens** animate them in plain CSS.
- **What needs script:** a line's shape when its data changes, and a switch between layouts.
- Nothing animates while a container is being resized. A change of data or of spec does.
- Reduced motion is respected everywhere.

---

## 16. The tldr prose

The number block in words, and then the filter (Decided 53). Every view's sentence is of this one shape. No chart type and no layout is consulted, so a custom mark needs no sentence of its own.

| Part | Says | As in |
|---|---|---|
| Each metric the query asks for, the first with the range | Its total from the engine; its change, where the query compares; its share of its target, where the catalog gives one; and that it is a sum of daily counts, where it is | "Visitors: 10.5k in the last 28 days, up 12% on the previous period. This is a sum of daily counts, not a unique count." |
| The leader, where the query's first dimension is categorical | The value the number's note names, with its share where the view is of shares | "The top channel is Search, at 41%." |
| The filter, after everything else | What the answer is filtered to, read off its `meta.where` | "Filtered to channel Search." |

Three answers have a sentence of their own:

| The answer | Tldr prose |
|---|---|
| An instant metric | "Present now: 7 right now." |
| Empty | "Visitors: nothing recorded in the last 28 days." |
| A total the engine does not give | "Correlation: no figure in the last 28 days." |

It is derived because a view's data is live and an authored sentence is not: "up 12%" is false tomorrow. It says no more than the number because what a view shows beyond it, who rose in a ranking, the busiest cell of a grid, is for whoever reads the result to say, a person or an agent. What an author can say is what the view is for (`description`, section 6).

Every word is the catalog's or the query's. The words that are not, such as "right now" and "no figure", are set in `packages/core/src/prose.ts` and nowhere else.

The tldr prose is the last rung of every view, its accessible description, and what an agent gets where it can render nothing.

---

## 17. Acceptance set

The first six sample specs, `samples` in `packages/fixtures`, are the first acceptance tests. The rest are `moreSamples`, one for each form the bench shows.

| Sample | Spec | Covers |
|---|---|---|
| Visitors over time | `use: "line"`, visitors by day, compared | A time series, a comparison, a partial bucket |
| Top pages | `use: "bar-list"`, page views by page, limit 8 | A ranked list |
| Channel mix | `use: "share-bar"`, visitors by channel | Part to whole |
| Page views total | A query with no dimension and no layers | The tldr value alone, with its delta |
| Present now | `use: "bar-list"`, present by page | An instant metric, so the number sits above the list |
| Bars and a target | Layers written out: a bar and a rule | Authored layers and roles |

Fixture facts to assert: visitors total 10,531 against 9,437 before (up 12%); page views 25,061 against 21,974 (up 14%); 28 daily rows, the last one partial; channel shares of 41, 28, 14, 8, 6 and 3 percent; 7 people present across 4 pages.

---

## 18. Stack and repository shape

Removed: what was built is in `README.md` and `CLAUDE.md`. The number is kept so later sections keep theirs.

---

## 19. Decisions and open questions

Each entry is the decision. What led to it, and what building it found, is in git and in `docs/archive/`.

### Decided

1. Chart types are presets, not primitives.
2. No `intent` in the spec.
3. Comparison is a role on a layer (`series: "previous"`), not a second metric.
4. Sizes and thresholds belong to the container and the design system. The spec has none.
5. Totals come from the engine, never from summing rows.
6. `arc` is its own mark, with a closed set of forms, and there is no general polar coordinate system. Narrowed by 44: the plot's line, area and dot are drawn about a centre too.
7. The scene is the seam between structure and rendering. Paint tokens, never colours.
8. Text stays in the DOM. Data marks may go to any renderer.
9. Every view has a derived tldr prose.
10. The front end needs only a catalog. Computation and table mapping are server-side.
11. A valid spec always draws something. An invalid one fails with a message naming the fix.
12. Guardrails are the authoring agent's job plus validation, not a restricted component API.
13. In a browser a view gives way part by part, with container queries, and not by one global switch.
14. The spec is the seed for everything: nobody writes a spec for a container. (October 7)
15. Presentation is intrinsic. A container fits a view by default rules, and a context may hand its containers a rule set of its own. (October 7)
16. `headline` and `guides` are out of the spec. The rules decide what they used to. (October 7)
17. `keep` stayed, provisionally, as the author's one lever. Removed by 63. (October 7)
18. Names: tldr value (was headline), tldr prose (was sentence), container (was host). (October 7)
19. A container fills the width and takes its natural height. A layout that hands out a box opts its children into filling it. (October 7)
20. One scene, in ratios, with a `part` on every node. (October 7) Pixel painters were to go through `place()`: amended by 43.
21. Y ticks always round to four, thinned by a rule on short plots. (October 7)
22. In the DOM, bars are HTML and lines and areas are a stretched SVG. (October 7)
23. Layouts stay, as arrangements of parts that fit rules and painters hang on. Narrowed by 44. (October 7)
24. A query is by two dimensions at most. The second goes to `color`, to `detail`, to `facet` or to the other axis. (October 7)
25. Statistics come from the engine as companion fields. Core gains no transform for them. (October 7)
26. A facet is a small board: a plan for each value with one shared domain, laid out by the container. (October 7)
27. A layer may carry a shape parameter from a closed set, starting with `sweep: "half"`. Count them: chart types must not come back as parameters. (October 7)
28. A delta for each row is `series: "delta"` on a `text` layer. (October 7) Its other half, a bar painted by its direction unasked, was replaced by 36.
29. A fit rule may name a `fallback`: a preset the view becomes below the rule's need. (October 7)
30. `d3-geo` is allowed in `packages/geo`. Core keeps its three dependencies. (October 7)
31. `detail` splits a layer into series without painting them apart: no legend, and no limit of six. (October 12)
32. `unit` draws a value as counted glyphs, and what a glyph is worth comes from the data. Its form is what is on its channels. Under the room its glyphs need, a form becomes another preset of the same query. (October 12)
33. A colour scale whose values cross zero is diverging about zero, read from the values or from the catalog's `domain`. Nothing in a spec says so. Its arms say below and above, never bad and good. (October 12)
34. A `line` or an `area` over a binned number is drawn as steps, and there is no layer field for it. (October 12)
35. `rank` is a unit. A companion is in its metric's unit unless the catalog has an entry under its whole name. (October 12)
36. `paint: "direction"` paints a `bar` or an `area` with two ends by which way it runs and the metric's polarity. Nothing is painted by direction unless a layer says so. (October 12)
37. A stack may diverge (`stack: "diverge"`). `"center"` stays, as the silhouette a streamgraph uses. (October 12)
38. A row may be divided by the query's second dimension: a `bar` with `stack` takes it on `color`, and a `dot` or a `tick` on `detail`. (October 12)
39. Layers of a plot that measure several metrics are told apart as the series of a split are: a colour, a legend entry and a label at its line's end for each. Nothing in a spec asks for it. (November 20)
40. A guide is read off a scale, and which encoding each comes from is one table, `GUIDES`. A guide is a key or a frame, and a key leaves no sooner than the marks it keys. (November 20)
41. A key with no shorter form stays as long as its marks, or its marks give way with it: the second y axis, what a glyph is worth, a row's column headers, a Sankey's node names. (November 23)
42. Where a key cannot stay whole it is cut down, or its marks give up what it was the key to. A legend takes the colours with it, the ramp becomes a strip, the key to sizes its largest step, and the names round a rim about four. (November 23)
43. A plan takes no size, and core places nothing. How a view gives way is the fit rules, as data, and one function reads them at a room with no browser: `fitTo`, with `viewAt` to follow a `fallback`. A rule names every part it takes, and may be for one kind of view (`has`). (November 23)
44. One space for the marks. A view's space is two axes, each a list of values, a quantity or nothing, flat or bent about a centre, and a mark is one function of that space. A layout says what stands round the marks, and no longer which marks may be drawn. Built for the grid, the list, the circle and the map. The share bar as a list of one row, and a slice as a bar, bent, are left. (November 23)
45. A board holds views and what they share, and no layout. The facet was built first: a view for each value of one of the query's dimensions, on shared scales. (November 23)
46. A mark's place may be said as a value: `at`, for a `rule` on an axis that is a list. A value the axis does not have is not drawn. (November 23)
47. A metric on `color` paints a plot's bars and dots off the ramp, and the ramp is its key. One metric paints a plot. (November 23)
48. A filter is part of the query. `where` holds a dimension to a value, to a list or to a run, and dimensions are joined by "and". The engine applies it and carries it back, and `resolve` refuses an answer that is not of its query's filter. Core filters no row. (November 24)
49. A board is views and what they share, and a selection is a filter. A board's `query` is its params, with no variable or expression. Views are combined by one rule with no field: each is filtered by every dimension of the board's `where` but the ones it draws. (November 24)
50. A view says what was activated and how (`pick`, `toggle`, `extend`), and core's `select` decides what that does to the selection. The view keeps none. (November 24)
51. One vocabulary for where a node is: `x` and `y`, `x2` and `y2`, `w` and `h`, whatever its kind and its layout, with `y` counting up everywhere. A row's marks are the plot's, turned. (November 24)
52. The prototype is gone, and nothing is held to it. (November 24)
53. The tldr prose is the number block in words, and then the filter: one shape for every view. It stays derived. What a view shows beyond its number is for whoever reads the result to say. (November 24)
54. The library ships the common charts and no more: thirteen presets. A form that is less common is written as its layers and kept as a sample. (November 24)
55. Nothing a layer says is dropped without a word. `paint`, `series` and `stack` are in the table of what each mark reads, a band is one layer, and bars of several layers sit side by side. (November 24)
56. The scene has a schema, `scene/0`, a draft. (November 24)
57. The agent surface is `packages/agent`, which wraps core and adds no rule: `describe()`, `check()`, and an MCP server over stdio that also draws a spec. A spec, a query and a layer refuse a field they do not take. (November 24)
58. What the fit rules pick is said once: forty numbers, in `LEAST`. (November 24)
59. A custom mark is a candidate for the system, and not a way round it. It is held to what a core mark is held to (`test/admission.test.ts`), and the count of them is a queue of candidates. (November 24)
60. A catalog may say which dimensions a metric is answered by (`by`), and a query that asks it by another is refused before it is run. (November 24)
61. A view says its sentence in a live region when new data changes it. A draft of the alias sheet for the WordPress Design System is `packages/tokens/wpds.css`. (November 24)
62. A spec may say what its view is for: `description`, the one authored sentence it has. (November 24)
63. `keep` is gone. A spec has no lever over what a container gives up: where a default is wrong for a view, the answer is a better rule, or a rule set a context hands its containers. (November 24)
64. A need follows the type: a need of the view grows and shrinks with the view's label face. The element asks it in `em`, and a surface with no browser says the size with the room. It is narrower than proposed, the face each part is set in: a container query has one em. Its first form, px at a default type with the plot's needs left in px, was replaced the same day by 65. (November 24)
65. Sizes are relative. A need is written in em, and so is every size in the element: a row, a gutter, a gap, a swatch, a dot, in em of the view's type or of the face it stands by. The view is set in its label face and everything in it inherits that, so one em is the unit of a need, on the view and on its plot, and of what the need is a sum of. px is for a stroke, a hairline, a radius, what is measured, and a grid of pixels: the cell of a number set in dots is the one size left in it. A room is still given in px, with the size of an em. On the bench nothing moved by more than 0.6 px, but for a legend that wraps, which fits one more name on a line where the theme sets its label smaller. (November 24)
66. A legend has one ladder, in a divided list, a band and a circle, written once (`legend` in `fit.ts`): whole, then its one line, then neither, with its marks in one paint. The least of a layout's marks is what differs between the three. The one line is a part a rule shows in the whole legend's place, `legend-top`, so `fitTo` names what shows, and the switch `legend: top` is gone. A band's bar still goes at the height its line would, so a band is not drawn in one paint. A list's whole legend has a height a rule says, since it wraps; a band's and a circle's is a line for each entry, which the stylesheet reads. (November 25)
67. A view speaks the language of where it lands. Its container says which, as `rules.locale`, and every number, date and country's name the view says is then in it. The formatters are a set made for a locale (`formats`), which the plan names and everything that builds a view's text is handed: nothing asks the machine its own language, and a tag the machine has no data for is refused, so a scene is the same on every machine. English where none is said. (November 25)
68. The words a view says of its own are one table, `WORDS`: templates with named places, and a form for each plural category where one depends on a count. A container hands its own with its rules (`rules.words`), any of them, and English is said for the rest. The table is data, so a host's translation is JSON, and a word a view does not say is refused. The sentence is made of the table's clauses in English's order, and a unit's letters are not in it. (November 25)
69. In a browser the element speaks the page's language where its container names none: the nearest `lang` at or above it, through any shadow root, as the page's own text is read. `rules.locale` is over it. A page in plain English is as it was, and a language the machine has no data for is English. (November 25)

### Open

1. A rule on the view cannot say the plot's room where the number sits above the plot, which is why the `y-ticks` rule carries a note. The rule format itself is built (Decided 43).
2. Settled: Decided 20.
3. How a preset pins a hand-tuned form for a size.
4. Settled: Decided 23.
5. Label collision: build or source.
6. A bar list when narrow, and what a collapsed ranking should show.
7. Whether a trend shows the tldr value above the plot by default. It is the rule `tldrValue.above`, and the default says no.
8. Whether a delta leaves out the partial day. Today the totals include it.
9. Params and selections, settled in part (Decided 48 to 50). Still open: a drag for a run, which waits for a look; whether a touch should pick several in the element itself; how a screen reader reads what is selected; and whether Spacefast's API takes a filter in this form.
10. Settled: Decided 24.
11. Catalog properties beyond the stub. Among them what a metric counts, one and many ("person", "people"), without which an instant metric reads "Present now: 7 right now", and a colour for a value of a dimension. `domain`, `target`, `bands`, a `number` dimension and `totalsBy` are built here, and whether the API sends them is open (`docs/api-proposal.md`).
12. Settled: Decided 45 and 49.
13. The name.
14. Which survives at the smallest size, the marks or the tldr value. Today the number does. A sparkline in a table's cell wants the line alone.
15. Whether the prose rung can be anything but measured. Its threshold is the width of the number itself, which is the one place the fit is not intrinsic.
16. What building the chart coverage left to decide: `docs/archive/chart-coverage-plan.md`, section 9.
17. Time zone and grain. The locale is settled, in three parts (Decided 67 to 69). What is open is the time zone, which was asked for with it. A time is said as its string writes it, which needs no zone while an engine names a bucket by the clock where it cut it, and `docs/api-proposal.md` asks the API's owners for exactly that. A zone handed to the view would move an instant to another clock, which is right for an hour and wrong for a day: a day cut in UTC is not a day anywhere else, and a view cannot tell the two apart until an answer says its grain (Open 23). Recommendation: no time zone input. The zone stays the engine's, and what is asked of the API is that a bucket is written as its own clock reads.
18. Settled: Decided 41 and 42.
19. What the fit rules do not say (section 10.2). Recommendation: write each as a rule where its need can be stated, starting with the number's forms and whole rows, and leave label collision to the surface (Open 5).
20. A placer for surfaces with no CSS. Recommendation: one generic function that maps a ratio and its part's box to pixels and knows no layout, written when a pixel painter is wanted.
21. Settled: Decided 44.
22. A field that is read out and never drawn, proposed by the Jetpack Stats team's review in place of a hook that writes a tooltip: a view names fields that the readout and the table say and no mark draws. It is data and not a function, so a spec stays JSON. Recommendation: adopt it, as Proposed, as a list on the spec.
23. What a catalog and an answer should say that they do not. Of the catalog: the grains a time dimension may be asked at, and whether a metric adds up over a dimension. Of the answer: how fresh it is, what was left out of it, and that a metric is not available here. Recommendation: propose all five to the API's owners, which `docs/api-proposal.md` does, and build none here before they are accepted.

---

## 20. Out of scope for now

- **A query coordinator:** the layer that collects each view's request, merges duplicates, caches and routes to an engine.
- **A local engine,** slicing server results in the browser.
- **Canvas and WebGPU renderers** for dense data.
- **A semantic compiler.** Turning catalog names into SQL is server-side.
- **A board element.** The board is data and two functions (Decided 49). An element that is handed a board and a query function, and keeps the board, is the shell's (`docs/shell-plan.md`).
- **A bridge to each agent harness.** Returning a view into a harness's own frame is not built. The agent surface is (Decided 57).
- **What a product needs round a view:** scope and filter chips, a date and compare control, a detail table.
