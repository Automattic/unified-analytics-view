# Positioning: the next version of `@automattic/charts`

As of October 5, 2026. A five-minute read.

**How much to trust this.** The facts about the two existing codebases are in `design-inputs/4-a8c-charts-and-jetpack-stats.md`, read from `Automattic/jetpack` trunk at `a737864` (`@automattic/charts` 4.7.0, `jetpack-premium-analytics` 0.11.0). The dependency between them, the token names and the size of the Stats wrapper layer were checked directly. The descriptions of what the wrappers do come from a delegated read. Nothing was run. That Stats drove particular changes in the charts package is an inference.

## The short version

This work is the next version of `@automattic/charts`: the same job, redone with what we have learned since the first one.

The first version, begun at the end of 2024, answered "we need shared chart components". Since then three things have happened:

1. **Jetpack Stats was rebuilt on it,** and had to write a second layer on top to turn charts into analytics views.
2. **Spacefast needs analytics that run on any site,** inside a customer's own page, written as often by an agent as by a person, and held to a high visual bar.
3. **Unified Analytics needs one way of describing a view** that holds for Parse.ly, Jetpack Stats, Woo and whatever comes next, and that an agent can read and write.

None of those were requirements when the package was designed. All three point at the same change: a chart should be **described as data**, in the names of metrics and dimensions, and each place it appears should decide how to present it.

It is a major version. Consumers refactor. It keeps the parts of the package that were right.

## What Jetpack Stats taught us

Stats depends on `@automattic/charts` and wraps every chart it uses. Those wrappers come to about 250 KB of source, against about 680 KB for the charts package itself. Each thing the wrappers add is something the library should have done:

| What Stats had to build on top | What the next version does instead |
|---|---|
| Comparison: fetch two periods, align them, mark one series as the comparison | Comparison is a role on a layer. The result carries the previous value beside the current one |
| A chart that becomes a sparkline when its widget is short; lists that fit rows to height | Every view degrades by itself: guides go, then secondary layers, then rows, then marks, down to the tldr value and the tldr prose |
| A metric tile: label, number, trend, sparkline | The tldr value is part of every view. A tile is a trend view in a small space |
| Deltas, with direction passed in by each widget | The metric declares whether up is good, once. Every delta follows |
| A summary number made by summing the buckets on screen | Totals come from the engine. A view never adds up its own rows |
| Mapping each API response onto chart props, by hand, in every widget | A spec names the metric and the dimension. The mapping is the library's |
| Loading, empty and error handling per widget | States belong to the view, including two Stats lacks: an unfinished day, and no prior period |
| Seven named breakpoints in a stylesheet | No sizes in a view. Each part knows the room it needs |

## What Spacefast and Unified Analytics add

- **It has to run anywhere.** The first surface is a panel inside a customer's page. Version 4 needs React 18 or 19 and brings visx, react-spring and Google Charts with it; Jetpack's own rules forbid importing it per widget because of the weight. The next version's core has no framework and no DOM, and it draws inside a custom element that neither inherits nor leaks styles.
- **Agents write the views.** Version 4's props include functions and React elements. A spec is plain JSON with a published schema, and an invalid one fails with a message that names the fix.
- **Not every container can draw.** An agent answering a question, a Slack message and a screen reader all need the same view as words. Every view carries a tldr prose derived from its query.
- **One description across products.** A view refers to `visitors`, never to a formula or an endpoint. What `visitors` means, and how it differs between products, is declared once, outside the view.
- **The look is designed, not inherited.** Structure and rendering are separated by a scene, so the appearance of every mark can be replaced without touching the grammar.

## What carries forward

The parts of `@automattic/charts` worth keeping are kept by name.

- **The tokens.** Its names, under our own prefix until the two interoperate: `--ua-charts-color-series-1`, `-grid`, `-label`, `-annotation` and the rest, for its `--a8c-charts-*`, with their mapping onto the WordPress Design System. A page themed for version 4 themes the next version by aliasing each token across, name for name. Three tokens are new: a comparison colour, a live colour, and good and bad deltas, which default to the existing up and down colours.
- **The keyboard model.** One tab stop per chart, arrows step through points, Enter activates, Escape leaves.
- **The accessibility groundwork:** forced-colours support, patterns as a second channel, reduced motion, colour-blind-safe palettes, labels that keep their contrast on a fill.
- **The time axis:** bucket inference, declared resolution, locale and time zone.
- **The interaction designs:** tooltips, legends that toggle series, drag to zoom, annotations. Re-implemented, not redesigned.
- **The chart names.** `LineChart` becomes the `line` preset, `BarListChart` the `bar-list` preset. A chart type stops being a component and becomes a saved combination of marks.
- **The stories and tests,** as the acceptance set the new version has to pass.
- **The package, its home and its consumers.**

## What changes

| Version 4 | Next version |
|---|---|
| A React component per chart type | A small grammar of marks. Chart types are presets over it |
| Props, some of them functions | A JSON spec |
| Values shaped by the caller per chart | A result, plus declarations of what each field means |
| Measures its parent, redraws in pixels after a pause | Lays out with CSS; each part gives way when it runs out of room |
| visx and react-spring | `d3-scale`, `d3-shape`, `d3-array` and our own painters |
| React required | A custom element, with thin React and Preact bindings |
| One global stylesheet | Shadow DOM, themed through custom properties |
| Map and funnel always bundled | Custom marks, loaded when used |

A consumer with no semantic layer still works. It declares its fields inline (label, unit, whether up is good) and passes rows and totals.

## What a refactor looks like for Jetpack Stats

Today a widget fetches, reshapes the response for one chart component, computes shares and deltas, and picks a skeleton. After, it fetches, hands the result to a view, and names the metric and dimension. The comparison, the fallback, the tile, the delta and the states stop being the widget's concern, and most of the wrapper layer can go.

Stats' own rule for widgets is "the host owns all chrome; the widget renders body only". A view makes the same split, so it drops into a widget body as it is.

## What is not there yet

This is an honest list. Version 4 does all of it today.

- Tooltips, interactive legends, zoom and annotations anchored to a point.
- Keyboard navigation over points.
- Pie, semi-circle and heatmap, which need the `arc` and `cell` marks.
- Map and funnel, which become custom marks.
- Several series split by a second dimension; grouped and time-stacked bars.

None of these is in the Spacefast MVP. All of them are needed before Jetpack Stats could move, so version 4 stays maintained until the next version covers what Stats uses.

## The path

1. **This week:** built in its own repository against the Spacefast MVP, so it can move at the week's pace. It already uses version 4's token names, keyboard model and chart names.
2. **Friday:** the MVP is the demonstration. It shows the approach holding on a real product, at sidebar width, on a site that is not WordPress.
3. **After:** propose it to the charts and Stats owners as the next major. If they agree, port it into the Jetpack monorepo beside version 4, close the gaps above in the order Stats needs them, and move widgets across one at a time.

Step 3 is a conversation with the people who own the package and the people rebuilding Stats on it. Their dates have already slipped once, and when a breaking major lands is theirs to weigh.
