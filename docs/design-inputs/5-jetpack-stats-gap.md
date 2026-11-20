# Design inputs 5: what Jetpack Stats would need from a view

As of October 16, 2026. This compares what Jetpack draws with `@automattic/charts` against what `<ua-view>` can do today, and lists the gap in the order it would block a move. It updates `4-a8c-charts-and-jetpack-stats.md`, which was read at `a737864` (charts 4.7.0). Its last section lists the charts package's interaction states, for comparison with `docs/component-states-plan.md`.

**How much to trust this.** Everything here was read from source, and nothing was run.

- **Jetpack:** `Automattic/jetpack` trunk at `56174bc` (`@automattic/charts` 4.10.0).
- **This repo:** `77a1e4f`. The states work landed after the read (`e4f452e` to `feb1ecf`), and the event list below accounts for it.
- **How it was read:** the Jetpack widget and charts inventories, and the inventory of this repo, were delegated reads; the interaction-state names were checked directly. *(inferred)* marks a conclusion from absence. *(unverified)* marks something neither read confirmed.

## 1. What Jetpack draws

### Premium Analytics

`projects/packages/premium-analytics/widgets/` has **47 widgets**. Another 33 sit on the same toolkit in `woocommerce-stats` (29), `ads` (3) and `videopress` (1), for 80 in all.

| Form | Count (of 47) | Through |
|---|---|---|
| Top-N list with share bars, comparison and deltas | 15 | toolkit `LeaderboardChart` → `LeaderboardChartUnresponsive` |
| Metric tabs over a line or bar time series, with comparison | 6 | `MetricTabsChart` → `ComparativeLineChart` / `ComparativeBarChart` |
| Big number over a sparkline; peak over a sparkline | 2 + 2 | `Sparkline` |
| Year × month heatmap with a summary column | 2 | `MonthlyHeatmap` → `HeatmapChart` |
| Calendar heatmap (weeks × days, paged) | 1 | `HeatmapChartUnresponsive` + `useCalendarHeatmapData` |
| Twelve small month calendars | 1 | `MonthCalendarHeatmap` → `HeatmapChart` |
| Semi-circle with legend and deltas | 1 | `Donut variant="half-ring"` → `PieSemiCircleChart` |
| Geo map beside a list | inside 2 lists | `LocationsGeoChart` → `GeoChart` (Google) |
| No chart: tiles, text highlights, post cards, avatar lists, link lists, dev | 19 | toolkit only |

- **WooCommerce adds** donuts with a centre total, grouped bars with comparison (`Columns`), funnels (`ConversionFunnelChart`), and leaderboards with thumbnails.
- **Not used anywhere in the 47:** stacking, zoom, brush or annotations *(inferred from grep)*.

### Other consumers

| Package | What it draws |
|---|---|
| Boost | `BarChart` of score history. Bars are coloured by score tier through `barClassName`; `onBandHighlightChange` drives its own popover |
| VideoPress | `LineChart` with a previous period, as a plain series rather than `type: 'comparison'` |
| Podcast | `BarChart` of plays per day, and a `GeoChart`. It wrote its own bar list because `BarListChart` has "no per-row onClick (Top episodes needs drilldown)" |
| Newsletter | `LineChart`, two series, y axis on the right |
| Publicize | `LineChart`, one series per connection |
| My Jetpack | 200px `BarChart` |

### The charts package between 4.7 and 4.10

No chart types were added. The work since was:

- **Accessibility:** `ariaLabel` on every chart but `Sparkline`, `role="application"` replacing `grid`, and arrow keys on pie and semi-circle.
- **Tooltips:** one tooltip surface (`TooltipBox`, `XYChartTooltip`).
- **Heatmap:** `fitCells`, and an empty-cell swatch in the legend.
- **Leaderboard:** `hasInteractiveLabel`, for a link inside a clickable row.
- **Legend:** `comparisonSeriesItems`, one legend item per comparison series.

## 2. What the view already covers

The marks are not the gap: 10 marks and 35 presets go well beyond what Jetpack draws.

| Jetpack form | The view |
|---|---|
| Line or bar over time with comparison; click a bucket to set the period | `line` and `bar` presets with `@previous`. The click is `ua-activate` with the row |
| Short chart becomes a sparkline (`compactWhenShort`); number over a sparkline | The fallback ladder and the tldr value. The closest fit of all |
| Top-N list: share bar, comparison, delta | `bar-list` with a comparison layer and `series: "delta"`. Deltas follow polarity, which Jetpack's do not. The row chrome is the gap (3.1) |
| Donut with total; semi-circle | `donut`, `pie-semi-circle` |
| Year × month and calendar heatmaps | `matrix`, when the adapter supplies the week and weekday dimensions. Core does not bin |
| Funnel; grouped bars with comparison | `funnel`, `grouped-bar` |
| Loading, empty, error | Built. Jetpack has no partial-bucket or no-prior-period state; the view has both |
| Fixed-height grid rows (200px) | A height-limited view in a sized box (`container-type: size`) |

## 3. The gap, in the order it blocks

### 3.1 Rows that carry links, media and drill-downs

This affects 15 or more widgets.

- **What the labels hold.** Every leaderboard label is a React element:
  - a post, author or external link;
  - an avatar, favicon, flag or thumbnail;
  - a drill button.
- **How deep the drill-downs go:**
  - referrers and archives drill to any depth;
  - locations go country → region → city;
  - authors drill to their posts;
  - clicks go domain → link.
- **What the view can do.** It has no links, no images and no slots. Its DOM is built with `createElement` alone, for CSP. Podcast's reason for writing its own list applies to the view as it stands.
- **The pressure.** "A spec is JSON, with no render props" against "Stats puts UI inside rows". It can be met without breaking the rule:
  - a link field and a media field on the `rows` layout, read from a field of the row (`favicon`, `avatar`, `flag`, `thumbnail`);
  - `ua-activate` carrying enough for the host to drill down and query again.
- **The decision.** Either the view takes on list chrome, or leaderboards stay host-drawn and most of what a move would gain is lost.

### 3.2 Locale, time zone and strings

- **The view today:**
  - formats in a fixed `en-US` and UTC (`packages/core/src/format.ts`);
  - writes its prose (which is also the accessible description) in English;
  - has a Spacefast adapter that refuses a time zone other than UTC.
- **What Jetpack needs:** dozens of locales, right-to-left scripts among them, and each site's time zone. Our RTL is partial, with open bugs.
- **Status:** this blocks every Jetpack surface, not only Stats. It is Open 17, and in `feedback.md`'s "before a second host".

### 3.3 Packaging and a React host

- **Nothing is built for release.** Packages export TypeScript source.
- **No React binding,** and no JSX typings for the element or its events.
- **Events today:** `ua-activate` and `ua-select`. There is still no `ua-error`.
- **Two copies on one page fail silently,** because the registries are module state. This matters more in wp-admin than anywhere: Boost, My Jetpack and Stats each bundle their own copy and can share a page.

### 3.4 Interaction Jetpack uses and the view lacks

- **Interactive legend.** `traffic-chart` shows and hides its counterpart and comparison series; Open 9.
- **Extra lines in the tooltip.** `DatedTooltip` adds "views per visitor" and "posts published". The readout is fixed by the catalog's formats. A declared list of extra metrics for the readout fits the grammar.
- **Deltas on a donut's legend items** *(unverified for the view)*.
- **Paging a heatmap** (older, newer) and choosing the period stay with the host, which queries again.

### 3.5 Theme and accessibility

- **No default theme ships.** Version 4 maps every token to `--wpds-*`, with literal fallbacks; the view needs the same alias sheet. Spacefast wrote 57 declarations by hand.
- **The view's accessibility is unverified.** Version 4 has spent three releases on it. The view's keyboard models are built and unconfirmed against version 4, and have not been tried with a screen reader, Firefox or Safari.
- **Colour is the only channel between series.** Version 4 has bar patterns as a second one.

### 3.6 Smaller gaps in marks and data

- **Facets.** The twelve month calendars (`posting-activity`) need them; facets are not built.
- **Maps below country level.** `geo` ships country shapes only. `locations` drills to regions and city markers.
- **The year × month summary column.** Whether `totalsBy` covers it is unverified.
- **Bars coloured by value bands,** for Boost's score tiers, *(unverified)*.
- **More than six colour series** is an error, and there is no fold into "Other".

## 4. Whether the approach fits

No hard blockers, and two strains.

- **JSON alone against injected UI.** This is 3.1. It needs declarative row links and media, or it caps what the view replaces. Worth deciding before any port.
- **Totals from the engine.** The Stats API does not return some totals. The visits sanitizer sums buckets, and `stats/visits` counts a visitor once per bucket, so a coarser bucket undercounts. The rule moves that work into a Stats adapter rather than removing it. That is the right place, and better than every widget doing it, but the adapter carries real logic:
  - joining the two comparison queries;
  - weekday and hour buckets;
  - free subscribers worked out as total minus paid.

The rest fits:

- Choosing a period and drilling down are host queries, fed by `ua-activate`.
- Tabs, tile grids, cards, upsells and calls to action in empty states are host chrome around a view.
- Stats' own rule for widgets, "the host owns all chrome; the widget renders body only", is the view's split already.

## 5. Where the view is ahead

- **Weight:** no React, visx, react-spring or Google Charts.
- **Shrinking:** declared once, instead of `compactWhenShort` plus seven SCSS breakpoints.
- **Built in:**
  - deltas that follow polarity;
  - an unfinished-bucket state;
  - keyed enter, update and exit;
  - every view in words.
- **The reshaping wrappers go:** most of the Stats layer that reshapes data per widget (about 250 KB) would go.

## 6. A suggested order

1. Locale, time zone and strings as inputs.
2. Packaging, a React binding, and the fix for two copies.
3. A WordPress token alias sheet.
4. Row links and media, and a richer `ua-activate`.
5. Interactive legend, and extra lines in the readout.
6. Accessibility checked against version 4.
7. Facets, and maps below country level.

**`positioning.md` is out of date.** Its "What is not there yet" list (October 5) still names tooltips, keyboard over points, pie and heatmap, map, funnel, and split, grouped and stacked bars. All of those are built now. Interactive legends, zoom and annotations at a point are still missing.

## 7. Interaction states in `@automattic/charts`

The package has no shared set of states. Each chart names and paints its own; only zoom has tokens, and the opacities and the bar's keyboard stroke (`#005fcc`) are literals.

| State | Their name | Where | What it does |
|---|---|---|---|
| Hover | `hovered` in tooltip data; CSS `:hover` | XY charts, pie and heatmap (through visx's tooltip); legend items; leaderboard rows | Shows the tooltip. Legend item at 0.8 opacity. A leaderboard row fades its bar to 0.5, shows a chevron and slides the value (`leaderboard-chart.module.scss:203`) |
| Crosshair | `withTooltipCrosshairs` (`showVertical`, `showHorizontal`) | Line, area | Guide lines at the hovered point |
| Band highlight | `withBandHighlight`, `onBandHighlightChange` (`BandHighlightSelection`) | Bar | A `surfaceSecondary` band behind the hovered x band, reported to the host |
| Keyboard selection | `selectedIndex` / `setSelectedIndex` | XY charts (`useKeyboardNavigation`) | Arrows move it, Enter fires `onDatumActivate`, Escape clears it |
| | `highlightedBarStyle` | Bar | A 2px `#005fcc` stroke on the selected bar, through an injected `nth-child` stylesheet (`bar-chart.tsx:492`) |
| | `selectedArc` → `SelectedSegmentRing` | Pie, semi-circle | A ring round the selected segment |
| | `heatmap-chart__cell--selected`, `aria-activedescendant` | Heatmap | Focus outline on the cell |
| Clicked, the rest recede | `clickedStep` → `isClicked` / `isBlurred` (`funnel-step--blurred`) | Funnel only | The other steps drop to 0.3. The only place other marks recede |
| Series hidden | `hiddenSeries`, `isVisible`, `defaultHiddenSeries`; legend item `--inactive` | Charts with an interactive legend | The series leaves the plot; its legend item goes to 0.4 with a strikethrough |
| Zoom selection | `zoomable`; tokens `color-zoom-selection`, `color-zoom-selection-stroke` | Line, area | The dragged range, and a reset button |
| Focus | `:focus-visible` | Containers, legend items, funnel bars, leaderboard row buttons | A ring in `--wpds-color-stroke-focus` |
| Loading (not input, but passing) | `--loading` | Leaderboard (0.5), funnel (0.6) | The whole chart fades |

- **No dimming of other series on hover:** in the XY charts, pointing at one series leaves the rest as they are.
- **Two meanings of "highlight":** keyboard selection is "selected" in the code but "highlight" in the bar chart's style, which is also the name of the band hover.

Against `component-states-plan.md`:

| Their state | In the plan |
|---|---|
| `:hover`, `hovered` | Interaction: Hover |
| `selectedIndex` and its rings | Focus. It is the keyboard's place, not a lasting pick |
| `isClicked` | Selected |
| `isBlurred` | Emphasis: Dimmed |
| Legend `--inactive` | The plan's left-out Disabled, which waits for exactly this |
| Band highlight, crosshair, zoom selection | Chrome, not atom states |

## Sources

All in `Automattic/jetpack` at `56174bc`.

- **`projects/js-packages/charts/`:**
  - `package.json`, `CHANGELOG.md`, `TOKENS.md`, `src/index.ts`
  - `src/charts/*/types.ts`, `bar-chart/bar-chart.tsx`, `bar-chart/private/band-highlight.tsx`
  - `conversion-funnel-chart/conversion-funnel-chart.tsx` and its selection hook
  - `pie-chart/pie-chart.tsx`, `private/pie-keyboard-navigation/`
  - `heatmap-chart/heatmap-chart.module.scss`, `leaderboard-chart/leaderboard-chart.module.scss`
  - `components/legend/private/base-legend.module.scss`, `components/tooltip/`
- **`projects/packages/premium-analytics/`:**
  - `widgets/*` (`widget.json`, `render.tsx`)
  - `packages/widgets-toolkit/src/components/*`
  - `packages/externals/src/index.ts`
  - `git log a737864..HEAD`
- **Other packages:**
  - `projects/packages/woocommerce-stats/widgets/*`, `ads/widgets/*`, `videopress/widgets/*`
  - `plugins/boost/_inc/overview/history-chart-card.tsx`
  - `packages/videopress/src/dashboard/components/overview/views-trends-card.tsx`
  - `packages/podcast/src/dashboard/stats/components/*`
  - `packages/newsletter/routes/dashboard/components/subscriber-stats-chart/index.tsx`
  - `packages/publicize/_inc/components/overview-tab/traffic-chart-card.tsx`
  - `packages/my-jetpack/_inc/components/stats-section/stats-chart.tsx`
