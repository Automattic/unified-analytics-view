# Design inputs 1: views and interactions

As of October 5, 2026. One of three briefs, alongside "the view spec" and "the semantic model". It gathers what is known about the data points, how they are processed and compared, how other products present them, and which design decisions are open.

**How much to trust this.** I read Laura's planning doc, the Spacefast chart code and the unmerged collector contract directly. The competitor survey and most of the tracker detail come from delegated research with sources cited. Competitor screens were read from docs, not seen, so anything about visual form there is second-hand.

## 1. Three conflicts to settle before designing against the data

The planning doc and the code disagree in ways that change what the UI can show.

| Question | Laura's doc says | Code says |
|---|---|---|
| Wire format | "UA's tracker and its `/u.gif` format stay" | An unmerged branch stack in `spacefast/monorepo` (`claude/beacon-1-collector` to `-5`, Oct 4, author login `claude`) defines `POST /v0/e` with a JSON envelope. Nothing analytics-related is on `main`. |
| Visitor identity | Daily-rotating hash of IP and user agent, no cookie | The Beacon contract carries no visitor or session ID, only a page-view ID. The UA tracker branch uses a 13-month cookie UUID, written only after consent. Neither implements the daily hash yet. |
| "Present now" | People on the site this minute, per page | Beacon's live channel returns `count`, `byPath` and `entries`, where count is open page views (tabs) with a 90-second expiry, not people. |

Also unresolved: the doc says the new API "keeps the shape of the mobile widgets' endpoint." I could not identify that endpoint. Ask Laura or Jeff which one is meant.

Jeff's prototypes may already be ahead of these branches. I could not open them.

## 2. Data points available

From the Beacon contract (`packages/common/src/contracts/live-analytics.ts`, read directly) and the UA tracker branch (`github.a8c.com/Automattic/unified-analytics`, branch `jblz-frontend-tracker`, delegated read).

| Data point | Beacon branch | UA tracker branch | Notes |
|---|---|---|---|
| Page view | `t: pageview`, `pv` (22-char random ID) | `n=pageview`, `eid` | UA intercepts `pushState` only for single-page apps |
| Path | `u`, path only | `url`, full URL | Beacon drops query and fragment |
| Referrer | `r`, origin plus path | `ref` | Channel and AI grouping must be derived |
| UTM | `utm{}` | Parsed from `url` | |
| Engaged time | `eng`, cumulative ms per page view, on `ping` and `leave` | `read_through.engagedSeconds` | Per page view only. Server keeps the max. |
| Scroll | `read_through.pct` 0–100 | `maxScrollPct` in 25% buckets | Scroll depth is "Later" in the plan but the event exists |
| Custom event and conversion | `signal {name, val?, cur?}` | `conversion`, `custom` (no value field; not on `/u.gif`) | Value and currency exist only in Beacon |
| Consent | `c: granted / denied / unknown`, `gpc` | `cs` | Beacon counts and drops denied or GPC events |
| Screen, language, timezone | `sw`, `sh`, `lang`, `tz` | — | In the TypeScript contract; reported as dropped by the Elixir parser |
| Country, region, city | Collector must derive from IP | GeoIP in the UA translator | The doc says no IP is stored; the Beacon spool reportedly keeps raw IP today |
| Device, browser, OS | Collector must parse the user agent | No parsed column | Not built anywhere |
| Bot class | Not built | UA-string classification, AI-referrer detection | Edge `traffic_class` fields are unverified for Spaces |
| Live presence | `live:<siteKey>` channel | — | See conflict above |
| Identified viewers | Separate comments presence rooms | — | Only people who joined the comments room |

## 3. The v1 metrics and how each is processed

Definitions are from Laura's doc. "Aggregates" is my reading of what the definition implies.

| Metric | Definition | Aggregates as | Design consequence |
|---|---|---|---|
| Visitors | Distinct people per day; a week is the sum of daily visitors | Distinct per day, not additive | A range total is a sum of dailies and has to be labelled as one. Jetpack's new widget help already says "The Visitors total is a per-period sum, not a unique count." |
| Page views | One page load or client-side route change | Additive | |
| Unique page views | Once per visitor per page per day | Distinct per day | Depends on the visitor hash |
| Engaged time | Foreground seconds from a heartbeat | Additive seconds | Show as total, mean or median? Per page view or per visitor? |
| Top pages | Pages ranked by views | Top-N | |
| Referrers | Origin and path, grouped by domain | Top-N, two-level | Domain to URL drill |
| Channel grouping | Search, social, AI, email, direct, other | Derived category | Needs a rule list |
| AI assistants as a channel | From referrer and UTM | Derived | Unmasking of "direct" is later |
| UTM | Source, medium, campaign | Top-N, three keys | |
| Country | From request IP | Top-N | |
| Device, browser, OS | From user agent | Top-N, three keys | |
| Conversions and custom events | Named SDK events; a conversion is a custom event marked as a goal, with an optional value | Additive count and sum | The goal mark is not in the wire, so it lives in the model |
| Revenue by channel and page | Conversion values by source and by converting page | Sum, attributed | Needs an attribution rule |
| Present now | People on the site this minute, per page | Instantaneous | Not comparable to a prior period |
| Period comparison | Same metric, prior period of equal length, as a delta | — | |
| History | 90 days in the doc; Bob later said free shows 30 | — | |
| Bot filtering | Removed from visitors and views | Exclusion | Do we show what was filtered? |

"What changed" is defined as a sentence, not a chart, and is slated for the MCP answer first.

## 4. What exists to render with

- **Spacefast's own chart layer** (`@spacefast/zero/charts`, read directly). Own SVG on Preact, no charting library. Exports `LineChart` and `BarChart` (`{data, x, series, height?, formatValue?}`), `Sparkline`, and `StatTile` (`label, value, delta?, deltaLabel?, upIsGood?, trend?`). It has an eight-slot categorical palette validated for colour-vision deficiency, a hover tooltip and a fixed 640-unit view box. It has no comparison series, no ranked list, no incomplete-period marking and no size adaptation.
- **Recharts** is reported as also bundled in the Zero platform, aliased onto Preact. I did not verify this.
- **The current Stats page** is two stat cards, a DataViews table and two row lists. It has no chart.
- **`@automattic/charts` 4.6.0**: Line, Area, Bar, BarList, Leaderboard, Pie, PieSemiCircle, ConversionFunnel, Geo, Heatmap, Sparkline, TrendIndicator. Comparison is an option on an ordinary series, not a first-class role.

## 5. How other products present the same metrics

| Metric | Dominant form | Notable exceptions |
|---|---|---|
| Visitors, page views | Stat tile with delta; the tile or tab picks the main chart's series | Umami plots views and visitors together; Pirsch puts a graph behind the tile |
| Trend | One time chart, often with a bar or line toggle | Parse.ly uses a line for real-time and bars for historical |
| Pages, referrers, UTM | Ranked list in a tabbed panel, expandable to a searchable table | |
| Channels | A tab inside the sources list | Parse.ly uses a 100% stacked bar |
| AI assistants | A channel row plus named sources | Fathom has a dedicated AI box |
| Country | Map plus list | Vercel and Cloudflare show a list only |
| Device, browser, OS | Tabbed ranked list with percentages | No donut found in any verified product |
| Comparison | Delta on tiles plus a second series | Parse.ly compares against an eight-week average band |
| Conversions and revenue | List with count, rate and value; clicking one scopes the dashboard | |
| Present now | Small live counter that opens a real-time view | PostHog has a live tab with a feed |

**Small surfaces** keep two to four headline numbers, one small time series, one or two short ranked lists, a period selector and a link to the full dashboard. They drop filter builders, maps, detail tables, export and comparison controls, though a fixed delta survives.

**In-page overlays.** The Parse.ly HUD is a side panel plus badges on links, scoped to the current page, with options to scale or fade the page beside it. Vercel's toolbar floats, snaps to an edge and sleeps until clicked, but carries no analytics. Clarity's live extension is a movable widget.

## 6. Candidate primitive set

This set covers every v1 metric. It is a starting list from the survey, not a decision.

| Primitive | Serves | Needed at sidebar width |
|---|---|---|
| Stat tile with delta and optional sparkline | Visitors, page views, unique page views, engaged time, conversions, revenue | Yes |
| Time series with comparison series and a marked incomplete bucket | Trend and history | Yes |
| Ranked bar list with tabs and "view all" | Pages, referrers, channels, AI, UTM, country, devices, events, revenue by channel or page, live pages | Yes; this is the workhorse |
| 100% segmented bar | Channel mix, device split | Yes |
| Live counter | Present now | Yes |
| Delta badge with direction and a "no prior data" state | Everything | Yes |
| Scope and filter chips | "This page / whole site" and active filters | Yes |
| Compact date and compare control | Presets, prior period | Yes |
| Detail table | Expansions | Dashboard only |
| Choropleth map | Country | Dashboard only |
| Notices: empty, awaiting data, loading, filtered | States | Yes |

## 7. Controls and interactions seen elsewhere

- **Nearly universal:** date presets with a custom range, one main chart with a metric switch, tabbed top-N panels with an expansion, click-to-filter, CSV export, previous-period comparison.
- **Differentiating:** match-day-of-week comparison, year over year, granularity switch, keyboard shortcuts, saved segments, drag-to-zoom on the chart, annotations.
- **The dominant grammar is "everything is a filter."** Clicking any row adds a global filter shown as a removable chip, and every panel re-queries. Plausible, Fathom, Vercel, PostHog and Pirsch follow it.
- **Its known weaknesses:** a row click is ambiguous between filter, drill and open; chips cost vertical space and are easy to forget; live counters ignore filters; filtering by a goal changes what the tiles mean; non-additive visitor counts get more misleading once filtered.
- **Jetpack Stats' new framework** keeps date range, interval and comparison in one shared, URL-backed object. Its comparison presets are previous period, week, month and year, with match-day-of-week variants.

## 8. States to design

Empty or new site, loading, today's partial bucket, no prior period to compare against, zero people present, data filtered (bots, consent), stale or late data, and metric unavailable in this context.

No surveyed product documents what it shows when the prior period has no data.

## 9. Decisions to make

1. **Which data contract is v1?** Beacon's JSON envelope or `/u.gif`, and which identity. Owner: Jeff.
2. **How is a range total of visitors shown honestly** when it is a sum of daily uniques?
3. **Engaged time:** total, mean or median, and per page view or per visitor?
4. **Default scope on open:** this page or the whole site, and how visible is the switch?
5. **Filters in the sidebar:** global chips, none, or page scope as the only filter?
6. **What does a row click do** in a narrow surface: filter, drill, or open the full view?
7. **Comparison:** always-on tile delta, or a control? Which modes ship: prior period only, or also year over year and a baseline?
8. **Date presets and grain,** and whether the free view is 30 or 90 days.
9. **Today's partial bucket:** dotted tail, hatched bar, or excluded from the delta?
10. **Present now:** tabs or people, what window, what the zero state is, and whether the owner's own visit counts.
11. **Country:** list only in the sidebar, with the map deferred?
12. **Channels and AI:** one list, or a dedicated AI panel? Which channel rule list?
13. **Devices:** ranked list or segmented bar?
14. **Conversions and revenue:** extra columns on existing lists, or a mode that re-scopes the tiles?
15. **Delta direction:** which metrics are "up is good", and what shows when there is no prior data?
16. **Overlay behaviour:** push or scale the page, float, or dock; and how it is isolated from the host page's styles.
17. **Chart substrate:** extend Spacefast's own SVG layer, use the bundled Recharts, adopt `@automattic/charts`, or build new. Laura's doc: "Decide, then stop discussing it."
18. **"What changed" sentence:** does it appear in the panel, or only in the agent answer?

## Sources

- [Laura's planning doc](https://docs.google.com/document/d/1lKyeJOymwbeiV1dLx8pjhqfy_PLG0D5LDFT88mLftuU/edit?tab=t.hgihce6w42or)
- [spacefast/monorepo](https://github.com/spacefast/monorepo): `packages/zero/src/charts.ts` on `main`; `packages/common/src/contracts/live-analytics.ts` on `claude/beacon-3-dashboard`
- [Automattic/jetpack](https://github.com/Automattic/jetpack): `projects/packages/premium-analytics`, `projects/js-packages/charts`
- [Plausible docs](https://plausible.io/docs), [Fathom docs](https://usefathom.com/docs/start/dashboard), [Vercel Web Analytics docs](https://vercel.com/docs/analytics), [PostHog web analytics docs](https://posthog.com/docs/web-analytics/dashboard), [Pirsch docs](https://docs.pirsch.io), [Parse.ly HUD docs](https://docs.parse.ly/user-handbook/tools-features/heads-up-display/)