# Design inputs 2: the view spec

As of October 5, 2026. One of three briefs, alongside "views and interactions" and "the semantic model". It gathers what a first draft of the view spec needs: what exists in-house, what precedents solved which part of the problem, the contexts the spec has to survive, and the decisions to make.

**The goal as you stated it.** A view is specified once, and the context it is displayed in decides how it is presented. The spec is intrinsic: it carries intent and priorities, not sizes or breakpoints. It speaks in the semantic model's metrics and dimensions. It is a more robust sibling of DataViews, and it must be durable from the first browser overlay to any later runtime.

**How much to trust this.** I read the Jetpack widget definitions, the Spacefast chart code and the DataViews reference directly. The external precedents come from delegated research, read through a summarising fetch, so exact field names should be re-checked before they are quoted in a spec.

## 1. What exists in-house

**DataViews** (`@wordpress/dataviews`)

- Three inputs: `fields` (definitions), `view` (serializable state), and `data`. It is controlled: every interaction emits a new `view` through `onChangeView`.
- `view` holds `type` (table, grid, list, activity, and picker variants), `fields`, `filters[{field, operator, value, isLocked}]`, `sort`, `groupBy`, pagination and a per-type `layout`.
- Role slots (`titleField`, `mediaField`, `descriptionField`) let one item render differently per layout.
- `DataForm` reuses the same field definitions for editing.
- Where it stops short of your goal: fields hold functions (`render`, `getValue`), so they are not portable across runtimes; there is no measure or aggregation concept; and the user picks the layout type, not the context.

**The Jetpack Stats v2 widget framework** (`projects/packages/premium-analytics` in `Automattic/jetpack`)

- A widget type is a folder. `widget.json` holds `name`, `title`, `description`, `help`, `category` and `presentation` (`framed`, `content-bleed` or `full-bleed`).
- `widget.ts` adds typed `attributes`, each with a `relevance`; high-relevance attributes render in the widget header.
- An instance is `{uuid, type, attributes?, placement: {width, height, order}}` on a three-column grid, stored per section.
- Shared context is one URL-backed `ReportParams` object: `from`, `to`, `preset`, `interval`, `compare_from`, `compare_to`, `compare_preset`, `filters`, `post_id`, `author_id`.
- Plugins register widget types and sections against a `WIDGET_API_VERSION`; types can declare `former_names`.
- **The missing piece is a declarative data binding.** Each widget calls a hook and maps rows to a chart by hand. This is the part your spec adds.

**Spacefast's chart layer** (`@spacefast/zero/charts`) takes plain props such as `{data, x, series}` and `StatTile {label, value, delta, upIsGood}`. Polarity is a per-view prop here, which the semantic model would move upstream.

**Your research doc** already proposes named, scoped params; a fallback ladder of chart, table, single stat; a board as a spec whose body is a layout of child specs; and context (site, URL, post, element, segment, time range) as the contract every surface sends.

## 2. Precedents, grouped by the idea worth borrowing

**The host decides presentation**

- **Adaptive Cards.** "Card authors own the content, host apps own the look and feel." Authors use only semantic values; a host-side Host Config resolves them and can cap or disable interaction. Elements declare `requires` and a `fallback` (another element, or drop). `targetWidth` uses named width classes whose pixel thresholds the host owns. `fallbackText` and `speak` are siblings of the visual card.
- **Apple WidgetKit.** The host injects an environment (widget family, rendering mode) and the view never inspects the device. Content is tagged by role, such as accent group or removable background, so the host can restyle it without understanding it. `ViewThatFits` picks the first child whose ideal size fits.
- **MCP Apps** (SEP-1865). The host passes a `hostContext`: theme, standardised style variables, display mode, container dimensions, locale, time zone, platform, touch and hover capability, safe-area insets. "Tools MUST return meaningful content array even when UI is available." Its weakness for your goal is that the UI is opaque HTML, so a host can theme it but cannot re-present it.
- **A2UI.** The client advertises which component catalogs it supports and the agent picks one. The data model is separate from the component tree.

**A semantic query plus a presentation hint**

- **Malloy.** Presentation is an annotation on a semantic query (`# bar_chart`, `# big_value`), and a table is the universal default. Format tags sit on the measure, so every view inherits them.
- **Lightdash.** A clean split between `metricQuery` (dimensions, metrics, filters, sorts, limit) and `chartConfig`. The split leaks where `eChartsConfig` exposes the renderer.
- **Cube.** The query format alone: measures, dimensions, time dimensions with range and granularity, filters, segments, order, limit.
- **Datadog.** Named queries plus formulas, and a `response_format` where the request declares the shape of the result.

**Parameters and selections**

- **Vega-Lite.** Separates variable params from selection params, and `resolve` decides whether child views share or own a scale.
- **Mosaic.** Named selections live outside any one view, each with a resolution strategy (single, union, intersect, crossfilter). A view declares its query given a filter and a coordinator executes it. Crossfilter excludes the originating view.

**Presentation attached to fields, not views**

- **Grafana `fieldConfig`.** Unit, thresholds and colour attach to fields with defaults and overrides, and carry across panel types.

**Composition**

- **Perses** and **Grafana's v2 schema** keep panels in a named map and reference them from separate layouts, so one panel can sit in several layouts.

**The contrast case**

- **ECharts `media` and Highcharts `responsive.rules`** put pixel breakpoints inside the spec. They are tied to one renderer's option tree, grow combinatorially, and cannot serve non-visual hosts.

## 3. Responsive visualization research and a fallback ladder

- **Kim, Moritz and Hullman (2021)** classified 76 strategies as targets (data, encoding, interaction, narrative, references) crossed with actions (recompose, rescale, transpose, reposition, compensate). Their core tension is the density–message trade-off.
- **Cicero (2022)** keeps responsive rules separate from the base spec and selects targets by role, not by spec path.
- **Schöttler et al. (2024)** switch layouts when constraints fail, such as minimum element size or overlap, instead of at fixed widths.
- **Olli (2022)** renders a chart as a navigable tree: overview, axes and legends, intervals, data points.

A ladder synthesised from these, for discussion:

0. Full chart.
1. Rescale and reflow.
2. Reduce references: fewer ticks, direct labels, no annotations.
3. Reduce data: coarser grain, top-N plus "other", drop the comparison.
4. Transpose or serialize: small multiples to a stack, table to a list.
5. Change encoding: chart to sparkline plus stat, bars to a ranked list.
6. Stat plus delta.
7. Structured table or tree.
8. One sentence, or speech.

Each step should record what was lost and offer a way back, such as a link to the full view.

## 4. Contexts the spec has to survive

| Context | What the host can supply | What it cannot do |
|---|---|---|
| In-page panel on a customer's site (v1) | Page URL, container width, theme preference | Rely on the host page's styles or on Chromium-only features |
| Full dashboard | Board layout, shared time range and filters | — |
| wp-admin widget or block editor sidebar | Post or site scope, WPDS tokens | Assume React version or bundling |
| Native app or home-screen widget | Size family, rendering mode | Hover, arbitrary interaction |
| Chat client through MCP | Host context, display mode | Guarantee any UI at all; text must stand alone |
| Slack or email | Almost nothing; a block vocabulary and a text fallback | Interactivity beyond buttons |
| Agent answer | A question | Render anything |

Web platform support relevant to the first context: size container queries and container units are Baseline since February 2023. Style queries are partial and scroll-state queries are Chromium-only.

## 5. Parts a first draft probably needs

| Part | What it holds | Closest precedent | In-house today |
|---|---|---|---|
| Identity and version | ID, kind, spec version, required capabilities | Adaptive Cards `version` and `requires`; Perses `kind` + `spec` | `name`, `former_names`, `WIDGET_API_VERSION` |
| Query | Metrics, dimensions, time, filters, sort, limit, comparison | Cube query; Lightdash `metricQuery`; Datadog `response_format` | Missing: imperative hooks |
| Intent | What the view is for: trend, ranking, composition, single value, live | Malloy tags; DataViews `type` | `category` only |
| Roles | Primary, comparison, label, detail, media | DataViews role slots; WidgetKit accent groups | `LeaderboardEntry {currentValue, previousValue}` |
| Params | Time range, comparison, scope, segment, filters; which are inherited and which the view owns | Vega-Lite params; Mosaic selections | `ReportParams` |
| Priorities and fallback | What may be dropped first, pinned forms, the ladder | `ViewThatFits`; Adaptive Cards `fallback`; Cicero | Missing |
| Text sibling | A sentence or table that stands alone | `fallbackText`, `speak`; MCP `content` | Laura's "what changed" sentence |
| States | Empty, loading, partial, stale, unavailable, error | Jetpack abilities' `partial` and `errors` | Per-widget |
| Actions | Drill, filter, link, export, write-back | `Action.Execute`; MCP `tools/call` | Row links and drill; DataViews callbacks |
| Composition | A board as named children plus layout intent | Perses; Grafana v2 | Sections and `placement` |
| Theming | Semantic tokens only | Host Config; MCP style variables | `--a8c-charts-*` mapped to `--wpds-*` |
| Accessibility structure | A navigable tree of the data | Olli | Missing |

## 6. Decisions to make

1. **Vocabulary:** a grammar of marks and channels, named view kinds, or intent tags over a default table? Your research doc leans to a grammar; DataViews and the Jetpack framework use named kinds.
2. **Where the query lives:** inline per view, as named queries that views reference, or derived by the view from its field roles?
3. **Field-level presentation:** on the semantic model, as per-view overrides, or both, layered?
4. **Roles or positions:** role slots such as primary and comparison, or explicit x and y channels?
5. **The context contract:** enumerated families, named width classes, continuous container dimensions, or all three layered?
6. **Capability negotiation:** a minimum version with `requires`, catalog IDs, or declared supported families?
7. **How fallbacks are declared:** an author-declared ladder, a renderer-derived one from constraints, or derived with author pins? Author breakpoints are the option the goal rules out.
8. **Is a text sibling mandatory,** or generated from the structure?
9. **Parameter scope:** board-level variables, named shared selections, or in-view params? Which persist to a URL or to the host?
10. **Cross-filter semantics:** predicates over dimensions with the originating view excluded, or simple global filters?
11. **Board composition:** children by reference with a separate layout, nested inline, or intrinsic flow with a priority per child?
12. **Scale and time sharing across children:** shared, independent, or resolved per channel?
13. **Actions and write-backs:** declarative verbs round-tripped to a server, tool calls, or callbacks? Callbacks are not portable.
14. **Theming:** semantic tokens resolved by the host only, or author styles as well?
15. **Extension:** how a custom view kind is registered, and what an unknown kind degrades to.
16. **Versioning:** minimum-version with graceful drop, additive-only, or migrations?
17. **Model payload versus human payload:** which parts an agent sees and which only the UI sees.
18. **Delivery format:** your research doc proposes a framework-agnostic TypeScript core shipped as web components with React bindings. Spacefast's Zero framework renders with Preact. Does that still hold?

## 7. Risks the precedents document

- Specs grow into programming languages. Your research doc already suggests keeping this one small with a custom mark registered in code as the escape hatch.
- Hosts implement different subsets and authors cannot see the host's configuration (Adaptive Cards).
- Renderer leakage: once one renderer's options are reachable from the spec, portability is gone (Lightdash, Evidence).
- Author-declared width variants duplicate content per width (Adaptive Cards `targetWidth`).

## Sources

- [DataViews package reference](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-dataviews/)
- [Automattic/jetpack](https://github.com/Automattic/jetpack): `projects/packages/premium-analytics/docs/dashboard-widgets.md`, `widgets/top-posts/`, `packages/data/src/utils/search.ts`
- [Adaptive Cards principles](https://learn.microsoft.com/en-us/adaptive-cards/resources/principles)
- [WidgetKit: preparing widgets for additional contexts](https://developer.apple.com/documentation/widgetkit/preparing-widgets-for-additional-contexts-and-appearances)
- [MCP Apps, SEP-1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp)
- [A2UI overview](https://a2ui.org/concepts/overview/)
- [Vega-Lite size docs](https://vega.github.io/vega-lite/docs/size.html), [Mosaic spec format](https://idl.uw.edu/mosaic/api/spec/format.html)
- [Grafana dashboard JSON model](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/), [Perses dashboard API](https://perses.dev/perses/docs/api/dashboard/)
- [Malloy visualizations](https://docs.malloydata.dev/documentation/visualizations/overview), [Lightdash dashboards as code](https://docs.lightdash.com/references/dashboards-as-code), [Cube query format](https://docs.cube.dev/reference/core-data-apis/rest-api/query-format)
- [MDN: container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/@container)
- [Your research doc](https://claude.ai/artifact/GTSQhAoHvVPL2D7HfbzPUb)