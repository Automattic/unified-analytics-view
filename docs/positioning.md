# Positioning: the view grammar, `@automattic/charts` and Jetpack Stats

As of October 5, 2026. A five-minute read. The facts behind it are in `design-inputs/4-a8c-charts-and-jetpack-stats.md`, read from `Automattic/jetpack` trunk at `a737864` (`@automattic/charts` 4.7.0, `jetpack-premium-analytics` 0.11.0). Nothing there was run.

## The short version

- `@automattic/charts` is a library of **React chart components**. You hand each one data already shaped for it.
- The Jetpack Stats widget framework is a **dashboard of widgets**. Each widget fetches its own data and maps it onto one of those components by hand.
- The view grammar is the layer neither has: **a view described as data**, in metric and dimension names, that any host can present at whatever size it has, including a host that can only show a sentence.

They are three layers, not three competitors. The grammar could sit under a Jetpack widget later. This week it does not sit on `@automattic/charts`.

## The substrate call

**We build on `d3-scale`, `d3-shape` and `d3-array`, with our own painters. We do not build on `@automattic/charts` for the MVP.** Four reasons, each from the source:

1. **It cannot go where v1 goes.** The first surface runs inside a customer's own page, on any site. `@automattic/charts` needs React 18 or 19 and brings 16 visx packages, react-spring and Google Charts. Jetpack's own widget rules forbid importing it per widget because of that weight. It ships one global stylesheet and no shadow DOM.
2. **Its inputs are not data.** Props include functions, `ReactElement` labels and visx types. A view an agent writes, a server stores, or a non-React host renders has to be plain JSON.
3. **It does not adapt.** Charts measure their parent and redraw in pixels after a 300 ms debounce. There is no fallback when space runs out. Jetpack adds that by hand, per component, in SCSS and script (`compactWhenShort`, `fitRows`, seven named breakpoints).
4. **It moves fast.** Two majors and six minors since August 21. That is healthy for the package and a cost for anything pinned to it.

This is not a verdict on the package. It does things this repo has not started: tooltips, keyboard navigation over points, zoom, pie, heatmap, map and funnel charts.

## What each layer is, in the grammar's terms

| `@automattic/charts` | In the grammar |
|---|---|
| `LineChart`, `AreaChart`, `BarChart`, `BarListChart`, `LeaderboardChart` | Presets over marks we have (`line`, `area`, `bar`, `rule`, `text`) |
| `Sparkline` | Not a thing you ask for. It is what a trend becomes when its host is small |
| `PieChart`, `PieSemiCircleChart`, `HeatmapChart` | Need the proposed `arc` and `cell` marks |
| `GeoChart`, `ConversionFunnelChart` | Custom marks, the grammar's escape hatch |
| `Legend`, axes | Guides: derived from scales, never authored |
| `TrendIndicator` | The delta in the headline, coloured by the metric's polarity |
| Tooltips | Chrome in the DOM layer |

Five of its eleven charts are presets today. Gaps the mapping exposes in the grammar: several series split by a second dimension, grouped and time-stacked bars, a delta per row, and annotations anchored to a datum.

| Jetpack Stats framework | In the grammar |
|---|---|
| Widget type, instance, placement, sections | A board. Out of scope here; theirs is the reference when we get to it |
| `render.tsx` mapping rows to props | The spec. This is the piece the framework lacks |
| `ReportParams` in the URL | Shared params. Not started here; theirs is the shape to match |
| `WidgetState` | The states in section 13 of the reference |

## What we take

- **Comparison belongs to a series.** Charts mark it with `options.type: 'comparison'`; we mark a layer with `series: "previous"`. Same idea, and we keep their dashed line as the default treatment.
- **One result, not two requests.** Jetpack fetches the two periods separately and joins them in each report. Our result carries `metric@previous` on each row. This is an ask of the query layer.
- **Totals from the engine.** The `total-views` widget notes that its summary is built by summing the returned buckets, and pins the bucket to a day to avoid undercounting visitors. That is the error the catalog's `rangeTotal` exists to prevent.
- **Their state order:** error, then loading, then empty, then content, keeping the last good rows on screen during a failed refetch.
- **Their params.** `from`, `to`, `preset`, `interval`, `compare_from`, `compare_to`, `compare_preset`, `filters`, plus six comparison presets. When params land here, they should round-trip to this.
- **Their token roles.** `--a8c-charts-color-series-N`, `-grid`, `-axis-x`, `-label`, `-trend-up`, `-trend-down` line up almost one to one with our paint tokens (`series.N`, `grid`, `axis`, `ink`, `delta.good`, `delta.bad`). A token set that maps ours onto theirs makes a view look native in wp-admin with no code change.
- **Their keyboard model:** one tab stop per chart, arrows step through points, Enter activates, the tooltip is the readout.

## How they meet later

Neither is built this week.

1. **A view as the body of a Jetpack widget.** The framework's rule is "the host owns all chrome; the widget renders body only", which is the same contract as ours. A widget's `render.tsx` would mount the view's custom element, pass `reportParams` as params, and delete its hand-written mapping. This is the natural path into Jetpack Stats.
2. **`@automattic/charts` as a painter for a plan.** Where a surface must look exactly like the rest of Jetpack, an adapter can turn a plan and a result into `SeriesData[]` or `LeaderboardEntry[]`. It works from the plan, not the scene, because those components do their own geometry. It would cover the five preset charts and lose the fallback.
3. **Marks flowing back.** If our `arc` or `cell` work is good, it is plain geometry on d3 and could be offered to the charts package. Low priority.

## What this costs us

- We write tooltips, keyboard navigation and transitions ourselves.
- Pie, heatmap, map and funnel do not exist here. None is in the Friday cut.
- A second charting approach inside Automattic needs a reason people can repeat. The reason: it is the layer that makes a view portable and agent-writable, and the existing components can sit beneath it.
