# Design inputs 4: `@automattic/charts` and the Jetpack Stats widget framework

As of October 5, 2026. A factual inventory of two Automattic codebases, read against `docs/view-grammar-reference.md`. It makes no recommendation about which to use.

**How much to trust this.** Everything here was read from a shallow clone of `Automattic/jetpack` at trunk commit `a737864` (`projects/js-packages/charts`, v4.7.0, and `projects/packages/premium-analytics`, v0.11.0). Type and field names are quoted from source. I read types, exports, docs and the traced widgets directly; I did not run either package, open Storybook, or read every chart's render body line by line. Anything marked *(inferred)* is a conclusion from what was absent or from a code comment, not something I saw execute. `@wordpress/widget-dashboard` and `@wordpress/widget-primitives`, which own the grid and the render-prop contract, live outside the Jetpack repo and were not read.

## 1. `@automattic/charts`

### Inventory

Every chart except `ConversionFunnelChart` is exported twice: `X` (wrapped in `withResponsive`) and `XUnresponsive`.

| Export | Data prop | Notable options |
|---|---|---|
| `LineChart` | `SeriesData[]` | `withGradientFill` (required), `curveType: 'smooth' \| 'linear' \| 'monotone'`, `withStartGlyphs`, `withEndGlyphs`, `renderGlyph`, `withTooltipCrosshairs`, `tooltipPlacement: 'auto' \| 'below-axis'`, `zoomable`, `rescaleYOnVisibilityChange`, `defaultHiddenSeries`; sub-components `.Legend`, `.Annotation`, `.AnnotationsOverlay` |
| `AreaChart` | `SeriesData[]` | `stacked`, `stackOffset: 'none' \| 'expand' \| 'wiggle' \| 'silhouette'`, `fillOpacity`, `withStroke`, `zoomable`, `curveType` |
| `BarChart` | `SeriesData[]` | `orientation: 'horizontal' \| 'vertical'`, `withPatterns`, `showZeroValues`, `withBandHighlight` + `onBandHighlightChange`, `barClassName(datum)`, `tooltipPlacement: 'auto' \| 'beside'`; `.Legend` |
| `BarListChart` | `SeriesData[]` (extends `BarChartProps`) | `options.labelFormatter`, `valueFormatter`, `labelComponent`, `valueComponent`, `labelPosition`, `valuePosition`, `yOffset` |
| `LeaderboardChart` | `LeaderboardEntry[]` | `withComparison`, `withOverlayLabel`, `primaryColor`, `secondaryColor`, `valueFormatter`, `deltaFormatter`, `loading`, `fitRows`, `legendLabels: { primary?, comparison? }` |
| `Sparkline` | `number[]` (`SparklineDataPoint`) | `color`, `strokeWidth`, `withGradientFill`, `gradient`, `animation`. Delegates to `LineChartUnresponsive` |
| `PieChart` | `DataPointPercentage[]` | `innerRadius`, `thickness`, `padding`, `gapScale`, `cornerScale`, `showLabels`, `legendValueDisplay: 'percentage' \| 'value' \| 'valueDisplay' \| 'none'`; `.Legend`, `.SVG`, `.HTML` |
| `PieSemiCircleChart` | `DataPointPercentage[]` | `thickness`, `clockwise`, `label`, `note`, `legendValueDisplay` |
| `HeatmapChart` | `HeatmapColumn[]` | `rowLabels`, `columnGroups`, `keyboardNavigation: 'grid' \| 'calendar'`, `compact`, `showValues`, `min/maxCellWidth/Height`, `primaryColor`, `ariaLabel`. Helpers `buildCalendarHeatmapData`, `buildMonthCalendarHeatmapData` and matching hooks |
| `GeoChart` | `GeoData` (Google DataTable rows) | `region`, `resolution: 'countries' \| 'provinces' \| 'metros'`, `displayMode: 'regions' \| 'markers'`, `domain`, `onError`, `renderPlaceholder` |
| `ConversionFunnelChart` | `steps: FunnelStep[]`, `mainRate: number` | `changeIndicator`, `loading`, `renderStepLabel`, `renderStepRate`, `renderMainMetric`, `renderTooltip` |
| `Legend`, `useChartLegendItems`, `useLeaderboardLegendItems` | — | Standalone legend; reads a chart's registration by `chartId` |
| `BaseTooltip`, `AccessibleTooltip` | — | Tooltip box; the XY tooltip with keyboard support |
| `TrendIndicator` | `direction: 'up' \| 'down' \| 'neutral'`, `value: string \| number` | `showIcon` |
| `GlobalChartsProvider` (also exported as `ThemeProvider`) | — | `theme?: Partial<ChartTheme>`, `locale?`, `timeZone?` |

`src/compositions/index.ts` is empty ("prepared for future use"). "Composition" in this package means sub-components attached with `attachSubComponents` (`LineChart.Legend` and so on).

### Data types (quoted from `src/types.ts`)

```ts
type DataPoint = { label: string; value: number; color?: string };
type DataPointDate = { date?: Date; dateString?: string; value: number | null; label?: string; color?: string };
type SeriesData = { group?: string; label: string; data: DataPointDate[] | DataPoint[]; options?: SeriesDataOptions };
type SeriesDataOptions = { gradient?: {...}; stroke?: string; seriesLineStyle?: LineStyles; legendShapeStyle?: CSSProperties; type?: 'comparison' };
type DataPointPercentage = { label: string; value: number; valueDisplay?: string; color?: string; group?: string };
type LeaderboardEntry = { id: string; label: string | ReactElement; currentValue: number; previousValue?: number;
  currentShare: number; previousShare?: number; delta?: number; imageColor?: string; onClick?: (...) => void; ariaLabel?: string };
type HeatmapColumn = { label?: string; data: HeatmapCell[]; summary?: boolean };
type HeatmapCell = { label?: string; value: number | null; hidden?: boolean; placeholder?: boolean };
interface FunnelStep { id: string; label: string; rate: number; count?: number }
type GeoData = [ GoogleDataTableColumn[], ...GoogleDataTableRow[] ];
```

`BaseChartProps<T>` is shared by most charts: `data`, `chartId`, `className`, `width`, `height`, `size`, `margin`, `onPointerDown/Up/Move/Out`, `onDatumActivate`, `withTooltips` (false by default), `showLegend`, `legend: ChartLegendConfig`, `gridVisibility: 'x' | 'y' | 'xy' | 'none'`, `animation`, `gap: GapSize`, and `options: { xScale?: ScaleOptions; yScale?: ScaleOptions; axis?: { x?: AxisOptions; y?: AxisOptions } }`.

The caller supplies values already shaped per series. There is no query, field name, unit or metric concept. `LeaderboardEntry.currentShare`, `previousShare` and `delta` are computed by the caller.

### Rendering library and how much leaks

- Built on visx 4 (`@visx/xychart`, `shape`, `scale`, `axis`, `annotation`, `legend`, `tooltip`, `responsive`, and more). `AreaChart` uses `AnimatedAreaSeries` and `AnimatedAreaStack`; `@react-spring/web` is a direct dependency.
- `GeoChart` is `react-google-charts` (`chartType="GeoChart"`), and its data prop is Google's DataTable format, including the `GoogleDataTableColumnRoleType` enum.
- visx types appear in the public API: `LineStyles`, `GridStyles`, `EventHandlerParams` are re-exported from `@visx/xychart`; `AxisOptions.tickFormat` is visx's `TickFormatter`, `AxisOptions.children` takes `AxisRendererProps`; `ScaleOptions.type` is visx's `ScaleType`; `AnnotationStyles` is built from `@visx/annotation` prop types; `renderGlyph` takes `GlyphProps`; `ChartTheme.svgLabelSmall` is `TextProps`. Three visx modules are published as entry points: `@automattic/charts/visx/group`, `/visx/legend`, `/visx/text`.

### Comparison series

- XY charts: a second `SeriesData` with `options.type: 'comparison'`, usually sharing a `group` with its primary. Default styling comes from the theme: `lineChart.lineStyles.comparison = { strokeDasharray: '4 4', strokeLinecap: 'square' }` and `barChart.barStyles.comparison = { widthFactor: 1.5, opacity: 0.5 }` (a wider translucent "shadow" bar behind the primary).
- Legend: `SeriesChartLegendConfig.collapseGroups` folds a group into one item; `comparisonItem: boolean | string` appends a static "Comparison period" item.
- Leaderboard: `withComparison` plus `previousValue`, `previousShare`, `delta` on each row. A row with no `previousValue` shows a placeholder ("No comparison data").
- Alignment of comparison points to primary dates is the caller's job. The package does not shift dates *(inferred from the Jetpack toolkit doing it itself, see section 2)*.

### Theming

- `GlobalChartsProvider` takes a `theme` that holds shape and spacing only. `TOKENS.md`: "the `theme` prop carries no colors."
- Colours are CSS custom properties named `--a8c-charts-{category}-{name}`, declared once in `src/styles/chart-scope.scss` on `:where(.a8c-charts-scope, .a8c-charts-tooltip-scope)` (zero specificity). Each maps to a `--wpds-*` token; a LightningCSS build step injects the WPDS spec value as a literal fallback.
- Roles include `--a8c-charts-color-series-1` to `-5`, `-grid`, `-axis-x`, `-tick-x`, `-axis-y`, `-tick-y`, `-label`, `-label-secondary`, `-label-inverse`, `-label-axis`, `-annotation`, `-trend-up`, `-trend-down`, `-trend-neutral`, `-background`, `-surface`, `-surface-secondary`, `-track`, `-tooltip-surface`; plus `--a8c-charts-motion-duration-entrance`, `-motion-easing-entrance`, `-border-radius-bar`, `-border-radius-cell`, and leaderboard dimensions.
- Only series slot 1 has a default, and it leads with `--wp-admin-theme-color`. Slots 2 to 5 are undeclared; the provider generates further colours, with a stated goal of staying distinguishable for colour-blind viewers (changelog 4.5.0).
- Some colours cross into JS through `getComputedStyle` at the provider wrapper (series palette, background, pie and heatmap label contrast). Consequences documented in `TOKENS.md`: the palette is read once at provider mount, and `GeoChart` takes a resolved-hex snapshot.
- `forced-colors: active` is handled (`CanvasText`, `GrayText`).
- No shadow DOM. Styles ship as one global `style.css` with CSS-module class names.

### Size, legends, tooltips, axes, annotations

- **Size.** `withResponsive` wraps each chart with visx `useParentSize` (debounced, 300 ms default). `ResponsiveConfig = { maxWidth?: number; aspectRatio?: number; resizeDebounceTime?: number }`; `maxWidth` defaults to 1200. Explicit `width`/`height` pin the size. Charts are drawn in measured pixels.
- **No fallback ladder.** I found no breakpoint, container query or "drop the axis when small" logic in the charts package. The exceptions are `LeaderboardChart.fitRows` (hides rows that do not fit, measured from the DOM), `HeatmapChart.compact`, and `AxisOptions.labelOverflow: 'ellipsis'` (bar charts only). The docs for that option say that otherwise "labels may overlap."
- **Legend.** `ChartLegendConfig`: `orientation`, `position: 'top' | 'bottom'` (left and right are a TODO), `alignment`, `shape`, `interactive` (toggles series visibility through the provider), plus style objects.
- **Tooltip.** Off by default. `renderTooltip` render props on each chart; the box renders inside the chart wrapper on one dark surface.
- **Axes.** `AxisOptions`: `orientation`, `numTicks`, `tickValues`, `tickFormat`, `tickResolution: 'hour' | 'day' | 'week' | 'month' | 'year'`, `display`, `children`. A time axis infers bucket size or takes it declared. Whole-number ticks when all values are whole.
- **Annotations.** `LineChart.Annotation` only: `{ datum: DataPointDate; title; subtitle?; subjectType?: 'circle' | 'line-vertical' | 'line-horizontal'; styles?; renderLabel?; renderLabelPopover? }`.
- **Zoom.** `zoomable` on line and area charts: drag to select an x range, with a reset button.
- **Locale and time zone.** `ChartFormatting = { locale?: string; timeZone?: string }` set on the provider.

### Accessibility and motion

- Line, area and bar charts render a wrapper with `role="grid"`, `tabIndex={0}` and a generic `aria-label` ("Line chart"). Arrow left and right step through points, Enter or Space fires `onDatumActivate`, Tab and Escape leave. The tooltip is the readout.
- `HeatmapChart` is a full ARIA grid (`aria-rowcount`, `aria-colcount`, `aria-activedescendant`, a label per cell) with arrow, PageUp and PageDown keys and a calendar mode.
- `ConversionFunnelChart` steps are `role="button"`. Leaderboard rows with `onClick` are real `<button>`s. `Sparkline`'s SVG is `aria-hidden`.
- No data-table fallback and no generated text description in the package *(inferred from grep; none found)*. Pie charts have no keyboard path that I found.
- Entrance animation only: CSS keyframes on bars, leaderboard and funnel; a radial wipe on pies; react-spring on areas. `animation?: boolean` on `BaseChartProps`. `usePrefersReducedMotion` disables it. The line itself is not animated (code comment). No enter, update or exit transitions on data change that I found.
- Bar `withPatterns` gives pattern fills as a non-colour channel; comparison lines are dashed.

### Empty, loading, error

- Empty and invalid data render a message in place of the plot: "No data available", "Invalid data", "All series are hidden. Click legend items to show data." (`SvgEmptyState`).
- `loading?: boolean` exists on `LeaderboardChart` and `ConversionFunnelChart` only. `GeoChart` has `renderPlaceholder` and `onError`.
- Null values draw a gap in a line or bar series (changelog 4.3.0).
- No partial-bucket, stale or "no prior period" state *(inferred from grep)*.

### Dependencies, version, pace

- Peer dependencies: `react` and `react-dom` `^18.0.0 || ^19.0.0`. Node `>=20.11.0`. ESM and CJS builds via tsdown.
- Hard dependencies include 16 `@visx/*` packages, `@react-spring/web`, `react-google-charts`, `date-fns`, `@date-fns/tz`, `dompurify`, `@wordpress/i18n`, `@wordpress/icons`, `@wordpress/theme` (a `-next` prerelease) and `@wordpress/ui` 0.22.0.
- The Jetpack widget rules forbid importing it per widget because "that inlines the entire charting stack (charts, visx, react-spring) into the widget's render bundle."
- Version 4.7.0, dated 2026-10-05. 143 changelog releases since 0.2.0 (2024-12-31). Majors 3.0.0 (2026-08-21) and 4.0.0 (2026-09-04); six minors between 2026-09-18 and 2026-10-05. Recent headlines: one dark tooltip surface for every chart (4.7.0), GeoChart `displayMode` markers (4.6.0), colour-blind-safe generated palette (4.5.0), comparison legend item and bar axis starting at zero (4.3.0), heatmap `columnGroups` and calendar keyboard mode (4.2.0).
- The README lists entry points `@automattic/charts/hooks`, `/providers` and `/utils`. `package.json` `exports` does not define them.

## 2. The Jetpack Stats widget framework (`projects/packages/premium-analytics`)

The path exists on trunk. The package is `@automattic/jetpack-premium-analytics` 0.11.0, private, built with `wp-build`. The dashboard grid and widget host are the upstream packages `@wordpress/widget-dashboard` and `@wordpress/widget-primitives`; this package supplies registration, data, a toolkit of components, and about 75 widget folders.

### Widget type

| Piece | Content |
|---|---|
| `widget.json` | `name` (`<namespace>/<name>`, e.g. `jpa/stats-top-posts`), `title`, `description`, `help: { content, links?: [{ label, href }] }`, `category`, `presentation` (`framed`, `content-bleed` or `full-bleed`), optionally `former_names` |
| `widget.ts` | Default export `{ icon, attributes?, example? }`. `attributes` is `WidgetAttributeField<Item>[]`, each `{ id, label, type, elements?, relevance?, getValue? }`. `relevance: 'high'` puts the control in the frame header |
| `render.tsx` | Default-export React component typed `WidgetRenderProps<Item>`; receives `{ attributes, setAttributes }` |
| `Widget_Type` (PHP) | `name`, `render_module`, `widget_module`, `presentation`, `category`, `title`, `description`, `help`, `icon`, `actions`, `keywords`, `textdomain`, `i18n_manifest`, `former_names` |

- Registration is server-side. The package registers its own manifest on the action `jetpack_premium_analytics_register_widget_types` at priority 10; plugins call `register_widget_types_from_manifest( $manifest, $args, $registry )` or `register_widget_type( $name, $args )` at priority 20.
- `WIDGET_API_VERSION = '1.3.0'` (`src/widget-types.php`). Consumers compare it themselves. 1.1.0 added `former_names`; 1.2.0 `Leaderboard`, `describeError()`, `useStatsVideoPlays`; 1.3.0 `ExporterCsvDownloadButton`.
- Two filters: `jetpack_premium_analytics_registrable_widget_types` (registry time) and `jetpack_premium_analytics_widget_types` (per read).
- The client reads `GET /wpcom/v2/widget-modules` and `import()`s each `render_module` through the page import map. Plugins import the dashboard through one SDK module, `@automattic/jetpack-premium-analytics-sdk`.
- Rule from `.agents/rules/widgets.md`: "The host owns all chrome. The widget renders body only."

### Instance and placement

- Instance: `{ uuid, type, attributes?, placement: { width, height, order } }` (`get_dashboard_default_widget_instance()` in `src/dashboard-layout.php`).
- Grid: `PA_COLUMN_COUNT = 3`, row height `ROW_HEIGHT_PRESETS.small` (200 px per the comment) in `routes/grid.ts`.
- Sections are registered like widget types (`register_dashboard_section()`), with `label`, `title`, `order`, `date_filter` (`range` or `year`), `date_filter_options` (`with_date_comparison`, `with_header_date_control`), `requires_sync`, `is_available`, `default_layout`. Served from `GET /wpcom/v2/dashboards/{name}/sections`.
- A customised layout is stored per section in `@wordpress/preferences` (`use-dashboard-section-layout.ts`).

### Shared report params

`ReportParams` in `packages/data/src/utils/search.ts`, described there as "the expected params present in the client URL":

```ts
type ReportParams = {
  from: string; to: string; preset?: ReportPresetId; interval: IntervalType; period?: string;
  compare_from?: string; compare_to?: string; compare_preset?: ComparisonPresetId; comp?: '1';
  view?: OrderAttributionView; filters?: FilterCondition[]; section?: string; date_type?: DateType;
  post_id?: string | number; author_id?: string | number;
};
type FilterCondition = { key: string; value: string | string[]; compare: '=' | 'IN' | 'NOT IN' | '!=' | '>' | '<' | '>=' | '<=' | 'BETWEEN' | 'NOT BETWEEN' | 'LIKE' | 'NOT LIKE' };
```

- Read from the route with `useSearch( { strict: false } )` (`@wordpress/route`) and normalised by `normalizeReportParams()`. A widget instance can override with `attributes.reportParams`. `WidgetRoot` resolves this and exposes it through `useWidgetRootContext()`.
- Comparison is on only when `comp === '1'` and both `compare_from` and `compare_to` are set (`hasComparisonEnabled`). "Comparison only ever comes from the URL."
- `COMPARISON_PRESETS` has six ids: `previous-period`, previous period matched to day of week, `previous-week`, `previous-month`, `previous-year`, previous year matched to day of week.
- Writes go through `useReportDateFilters` and `useStagedSearch` in `packages/routing`. I did not read the write path.

### How a widget gets data

- Hooks in `packages/data/src/hooks` (`useStatsVisits`, `useStatsTopPosts`, `useStatsReferrers`, `useReportOrders`, and about 50 more), on `@tanstack/react-query`.
- `useReport()` issues **two queries**, primary and comparison, the second with `from`/`to` replaced by `compare_from`/`compare_to`. It returns `{ primary, comparison, hasComparison, isLoading, isFetching, hasData, isError, error, refetch, timezone }`.
- Stats requests go through one REST proxy, `/jetpack-premium-analytics/v1/proxy/v{version}/{endpoint}` (`Api_Proxy_Controller`, which calls `Client::wpcom_json_api_request_as_blog` on `/sites/%d/%s`). Each query names a WPCOM endpoint and a client-side sanitizer.
- No Abilities API use was found in this package.

**Trace 1, trend: `widgets/traffic-chart`.** `render.tsx` → `useTrafficChart(reportParams, period)` (`use-traffic-chart.ts`) → two `useStatsVisits` calls (`stats/visits` v1.1, `stat_fields` `views,visitors` and `likes,comments,post_titles`) → `buildMetricTab()` → toolkit `MetricTabsChart`, which builds `SeriesData` and marks the previous period `options: { type: 'comparison' }` → `ComparativeLineChart` (charts `LineChart`) or `ComparativeBarChart` (charts `BarChart`) by the `chartType` attribute (`'line' | 'bar'`). Clicking a bucket calls `drillDown( date, period )`. Metrics the hourly bucket cannot serve become a tab with `unavailable: reason`.

**Trace 2, leaderboard: `widgets/top-posts`.** `render.tsx` → `useStatsTopPosts( { ...reportParams, max: WIDGET_ROW_LIMIT }, { maxRows: WIDGET_ROW_LIMIT } )` (`stats/top-posts` v1.1, `skip_archives: 1`; limit is 10) → `mergeStatsTopPostsComparisonRows` joins the two periods into `StatsTopPostsComparisonItem` (`previousViews?`) → `toTopPostRows()` → `buildLeaderboardData()` computes `currentShare`, `previousShare` and `delta` by hand → toolkit `LeaderboardChart` → charts `LeaderboardChartUnresponsive`. The Archives view adds an in-widget drill-down path and a back link.

**Trace 3, single stat: `widgets/total-views`.** `render.tsx` → `useStatsVisits( withoutComparison( { ...reportParams, stat_fields: 'views,visitors', period: 'day' } ) )` → `report.summary.views` as the headline (`AbbreviatedValue`) and `report.data[].views` as `number[]` → charts `Sparkline`. A code comment states "The sanitizer builds the report summary by summing the returned buckets", and that the period is fixed to `day` because "`stats/visits` counts a visitor once per bucket, so a coarser bucket undercounts a repeat visitor."

### Size, loading, empty, error, partial

- `WidgetState` takes `{ isLoading, isFetching?, isError, isEmpty, error?: { title?, description, actions? }, empty?, renderLoading?, children }`. Order of precedence: error, loading, empty, children. Each widget passes a matching skeleton (`LeaderboardSkeleton`, `MetricSparklineSkeleton`, `MetricTabsChartSkeleton`).
- Stale-while-revalidate: widgets keep prior rows on a failed refetch and raise the error only when nothing is on screen. A delayed "revalidating" state follows `isFetching`.
- Size is handled with container queries. `packages/widgets-toolkit/src/styles/_widget-container.scss` defines a `widget` container (`container-type: inline-size`) with named breakpoints `xxs` 256, `xs` 320, `sm` 384, `md` 448, `lg` 512, `xl` 576, `2xl` 672 px, and a shared `$widget-short-max-block-size: 140px` below which components drop chrome.
- `ComparativeLineChart` has `compactWhenShort`: below `COMPACT_CHART_HEIGHT = 140` it "degrades the chart to a sparkline (no y-axis, grid, or legend)", measured with a `ResizeObserver`. Lists use `fitRows`.
- These rules are written per component, in SCSS and in script. There is no declared ladder.
- Partial data: no partial-bucket flag reaches the charts *(inferred)*. `partial?: boolean` appears only on the CSV export response.
- No polarity concept was found near the delta components *(inferred from one grep)*.

### `@automattic/charts` components actually used

Imported once, in `packages/externals/src/index.ts`: `BarChart`, `LineChart`, `LeaderboardChartUnresponsive`, `PieChartUnresponsive`, `PieSemiCircleChart`, `HeatmapChart`, `HeatmapChartUnresponsive`, `GeoChart`, `ConversionFunnelChart`, `Sparkline`, `Legend`, `BaseTooltip`, `GlobalChartsProvider`. Not imported: `AreaChart`, `BarListChart`, `TrendIndicator`. Widgets never use them directly; the toolkit wraps each (`chart-comparative-line`, `chart-comparative-bar`, `chart-leaderboard`, `chart-donut`, `chart-semi-circle`, `locations-geo-chart`, `calendar-heatmap`, and so on).

## 3. Mapping `@automattic/charts` onto the view grammar

Based on sections 6, 7, 9 and 12 of the reference. "Preset" means expressible with today's marks (`line`, `area`, `bar`, `rule`, `text`).

| Component | Against the grammar | What does not carry over |
|---|---|---|
| `LineChart` | Preset over `line` (+ `area` as `context` for `withGradientFill`, `series: "previous"` for comparison). This is the `trend` preset | Several series split by a second dimension (`by` is zero or one today); start and end glyphs need `dot`; zoom and crosshairs are interaction |
| `LineChart.Annotation` | `rule` + `text` for `line-horizontal`. `line-vertical` and `circle` at a datum are not expressible: `rule` takes only a constant `y`, and `dot` is proposed | Popover labels are chrome |
| `AreaChart` | Preset over `area` for one series | `stacked` needs stacking on a time axis (Proposed transform); `stackOffset: 'wiggle' \| 'silhouette'` has no equivalent |
| `BarChart` | Preset over `bar`; horizontal is the `rows` layout; comparison is a second `bar` layer with `series: "previous"` | Side-by-side grouped series have no transform *(inferred: only `stack: "normalize"` exists)*; `withPatterns` is a painter concern |
| `BarListChart` | The `bar-list` preset as shipped (`bar` + `text` + `text`) | — |
| `LeaderboardChart` | `bar-list` preset plus a comparison `bar` layer | A per-row delta has no channel today; row `onClick` is an action; `fitRows` is the plan's "trim rows" step |
| `Sparkline` | Not a preset: it is what the plan derives from `trend` when guides drop | Takes bare `number[]`, so no dimension |
| `PieChart` (and donut) | Needs proposed mark `arc` | — |
| `PieSemiCircleChart` | Needs proposed mark `arc` with a half sweep; `label` and `note` map to the headline | — |
| `HeatmapChart` | Needs proposed mark `cell`, and two dimensions in `by` (Open 10) | Calendar builders are a binning transform (Proposed) |
| `GeoChart` | Custom mark (maps are named as the escape hatch) | — |
| `ConversionFunnelChart` | Custom mark (funnels are named as the escape hatch) | — |
| `Legend` | A guide, derived and never authored | Interactive series toggling is a selection (Open 9) |
| `BaseTooltip`, `AccessibleTooltip` | Chrome in the DOM layer, outside the grammar | — |
| `TrendIndicator` | Part of the headline (the "delta badge as its own part" listed in section 17) | Direction is passed in; no polarity |
| `GlobalChartsProvider` | Host context and painter tokens | — |

Count: 5 of 11 charts are presets over existing marks (with gaps noted), 1 is a derived form, 3 need a proposed mark, 2 need a custom mark.

## 4. What each has that the other does not

**`@automattic/charts` has; the reference does not (or lists as Proposed, Open or To do)**

- Shipped arc, cell, map and funnel charts.
- Tooltips, crosshairs, interactive legends, drag-to-zoom, band highlight, pointer and `onDatumActivate` callbacks.
- Working keyboard navigation on XY charts and the heatmap.
- Annotations anchored to a datum, including vertical lines.
- Stacked and grouped series; several series per chart.
- Locale and time-zone aware time axes with declared bucket resolution.
- Generated palettes beyond the seed colours, contrast-checked labels on fills, `forced-colors` support, pattern fills.
- A documented token catalogue mapped to WPDS, with fallbacks for pages without WPDS.
- Translated empty and invalid-data messages.
- Render-prop escape hatches for tooltips, glyphs, labels and legend shapes.

**The reference has; `@automattic/charts` does not**

- A serialisable spec. Charts take React props, functions and `ReactElement` labels.
- A query in semantic names, a catalog (unit, polarity, `rangeTotal`, `instant`), and engine-supplied totals.
- Roles on layers, and a derived plan that drops parts by role as space shrinks.
- A sentence per view, and a table of the same query (a requirement; not yet built).
- Partial-bucket and no-prior-period states.
- A headline with delta states driven by polarity.
- A framework-free, DOM-free core; a scene with stable keys; swappable painters; shadow-DOM isolation.
- Ratio-based CSS layout. Charts measure in script and redraw in pixels after a debounce.
- Enter, update and exit transitions as a requirement. Charts animate on entrance only.
- No Chromium, React or visx assumption. Charts require React 18 or 19.

**The Jetpack framework has; the reference does not**

- Widget type registration with a versioned contract, former names, availability filters and a plugin SDK.
- Instances, placement on a grid, sections, default layouts and per-user persistence (boards are out of scope in the reference).
- A shared, URL-backed params object with six comparison presets, filters, and post and author scope (params are Open 9; `compare` is `"previous"` only).
- Drill-down, row links, CSV export, per-widget attributes with header controls.
- Loading skeletons, stale-while-revalidate, error mapping with retry, focus restoration on state change (loading and stale are To do in the reference).
- Named container-query breakpoints already in use.

**The reference has; the Jetpack framework does not**

- A declarative binding from data to marks. Every widget maps rows to props in its own `render.tsx`.
- One result carrying the comparison as a companion field. The framework issues two requests and joins them on the client, per report.
- Totals that are never summed on the client (see Trace 3).
- A catalog. Labels, formats and metric ids are declared per widget (`TRAFFIC_CHART_METRICS`, `DATA_FORMAT`).
- A derived fallback, a sentence, and any non-React host.

## 5. Things I could not verify

- `WidgetRenderProps`, `WidgetAttributeField`, `DEFAULT_GRID`, `ROW_HEIGHT_PRESETS` and the layout-change contract: defined in `@wordpress/widget-dashboard` and `@wordpress/widget-primitives`, outside this repo.
- How `presentation` values change the frame; the host decides and the host was not read.
- The exact URL write path (`useStagedSearch`) and whether `filters` are serialised into the URL for Stats sections.
- Runtime behaviour: bundle size, rendering at small widths, screen-reader output, animation feel. Nothing was run.
- Whether pie, semi-circle and leaderboard charts have keyboard navigation beyond focusable buttons. I found none but did not read every line.
- Whether the visits sanitizer really sums buckets for `summary`; this rests on the comment in `widgets/total-views/render.tsx`.
- The two `-MATCH_DAY_OF_WEEK` comparison preset string values (constants seen, values not printed).
- `projects/js-packages/premium-analytics-sdk` and the Ads and VideoPress consumer packages were not in the sparse clone; statements about them come from `docs/dashboard-widgets.md`.

## Sources

All under `Automattic/jetpack` at `a737864` (trunk).

- `projects/js-packages/charts/`: `package.json`, `CHANGELOG.md`, `README.md`, `TOKENS.md`, `src/index.ts`, `src/types.ts`, `src/charts/*/types.ts`, `src/charts/pie-chart/pie-chart.tsx`, `src/charts/pie-semi-circle-chart/pie-semi-circle-chart.tsx`, `src/charts/bar-list-chart/bar-list-chart.tsx`, `src/charts/private/with-responsive/with-responsive.tsx`, `src/charts/leaderboard-chart/hooks/use-fitted-row-count.ts`, `src/components/tooltip/accessible-tooltip.tsx`, `src/components/trend-indicator/types.ts`, `src/providers/chart-context/themes.ts`, `types.ts`, `global-charts-provider.tsx`, `src/compositions/index.ts`
- `projects/packages/premium-analytics/`: `package.json`, `CHANGELOG.md`, `docs/dashboard-widgets.md`, `docs/dashboard-sections.md`, `src/widget-types.php`, `src/class-widget-type.php`, `src/dashboard-layout.php`, `src/REST/class-api-proxy-controller.php`, `routes/grid.ts`, `routes/dashboard/stage.tsx`, `routes/dashboard/hooks/use-dashboard-section-layout/use-dashboard-section-layout.ts`
- `projects/packages/premium-analytics/packages/`: `data/src/utils/search.ts`, `data/src/types/filter-condition.ts`, `data/src/hooks/use-report.ts`, `use-stats-report.ts`, `use-stats-top-posts.ts`, `use-stats-visits.ts`, `data/src/queries/stats-query.ts`, `stats-top-posts-query.ts`, `stats-visits-query.ts`, `data/src/api/constants.ts`, `stats-proxy-fetch.ts`, `datetime/src/get-comparison-range.ts`, `externals/src/index.ts`, `widgets-toolkit/src/components/widget-root/widget-root.tsx`, `widget-state/widget-state.tsx`, `chart-comparative-line/comparative-line-chart.tsx`, `metric-tabs-chart/metric-tabs-chart.tsx`, `widgets-toolkit/src/helpers/build-time-series-chart-data.ts`, `widgets-toolkit/src/hooks/use-normalized-report-params.ts`, `widgets-toolkit/src/styles/_widget-container.scss`
- `projects/packages/premium-analytics/widgets/`: `top-posts/`, `traffic-chart/`, `total-views/`, `visitors-over-time/` (`widget.json`, `widget.ts`, `render.tsx`)
- `.agents/rules/widgets.md` (repo root)
