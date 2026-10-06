# Design inputs 3: the semantic model

As of October 5, 2026. One of three briefs, alongside "views and interactions" and "the view spec". It gathers the metrics, dimensions and use cases the model has to absorb from v1, Parse.ly and Jetpack Stats, what a universal model must be able to express, how existing semantic layers and adjacent standards handle it, and the decisions to make.

**The goal as you stated it.** One model that works for content analytics the same way it works for app performance or security analytics, and that supports different users and use cases. A metric's declared properties should drive formatting and comparison in the UI so view specs stay small.

**How much to trust this.** The inventories and precedents come from delegated research with sources cited. I checked a sample directly: Laura's doc, the Jetpack abilities and widget code, the Spacefast contracts, and the Apache Ossie rename. Items marked "not verified" could not be confirmed.

## 1. What the model has to absorb

### Metrics, grouped by how they behave

| Behaviour | Spacefast v1 | Parse.ly | Jetpack Stats and Woo | Performance and security (my examples) |
|---|---|---|---|---|
| Additive count | Page views, custom events, conversions | Views, referrals, video starts | Views, likes, comments, clicks, downloads, orders, items sold | Requests, errors, blocked requests |
| Additive quantity | Engaged seconds, revenue | Engaged minutes, minutes watched | Gross and net sales, refunds | Bytes served |
| Distinct count, not additive | Visitors, unique page views | Visitors (HyperLogLog estimate), new and returning, sessions | Visitors (per bucket) | Unique clients |
| Ratio, recomputed from parts | Conversion rate | Average engaged time, recirculation rate, click-through rate | Open and click rates, average order value, conversion rate | Error rate, cache hit rate |
| Percentile or distribution | — | — | — | Core Web Vitals at the 75th percentile; latency percentiles |
| Instantaneous | Present now | Concurrent visitors, clicks per minute | — | — |
| Score or band | — | Signal: 1–5 quintile against the site's own 90 days | — | Web Vitals rating; edge threat score |
| Relative to a baseline | "Over or under its own baseline" (wishlist) | Average of the previous 8 same weekdays; goal pace | Change against the prior 7 days | — |
| Attributed | Revenue by channel and page | Conversions under four attribution models, with fractional credit | Order attribution by channel, source, campaign | — |

### Dimensions and entities

- **Entities:** site or space, site group and network, page or path, post (by ID), author, section, tag, video, product, order, customer, campaign, visitor, session, page view, bot or agent, and on-page element (Parse.ly's "slot").
- **Hierarchies:** referrer category → domain → URL; country → region → city; channel → source; bot class → operator → name; archive type → term.
- **Multi-valued and overlapping:** tags, authors and audience segments. Breakdowns by these do not sum to the total.
- **Derived categories that need a rule list:** channel grouping and AI traffic type. Parse.ly has seven referrer categories; GA4 has 17 channels and now includes "AI Assistant"; Martin Remy's typology has five AI interaction types.
- **Availability varies by source.** Parse.ly has no visitors on Apple News and no sessions on AMP or Android. Jetpack Stats has no hourly visitors. Jetpack gates UTM, devices, region and city by plan.

### "Visitor" means something different in every product

| Source | Visitor | Session |
|---|---|---|
| Spacefast v1 plan | Daily-rotating hash of IP and user agent, no cookie; a week is a sum of days | Later; 30 minutes idle |
| Spacefast Beacon branch | None; only a page-view ID | None |
| UA tracker branch | Cookie UUID, 13 months, consented visitors only | Per-visitor counter, 30-minute sliding |
| Parse.ly | First-party cookie; non-consenting visitors share one ID; counts are estimates | 30-minute rolling; absent on some channels |
| Jetpack Stats | IP and user-agent hash per bucket | None |
| Woo analytics | IP, domain and daily-salt hash | UUID, 30-minute timeout |

This is the same problem Gary's "One Pixel to Rule Them All" post describes. The model needs to say which definition a number uses.

### Time

- **Grains:** 5-minute and daily rollups in Parse.ly; hour, day, week, month and year in Jetpack Stats; 5-minute, daily and monthly tiers in the UA platform tables.
- **Windows:** rolling, to-date, calendar year, all time, and anchored to an entity such as a post's publish date.
- **Time zone:** Parse.ly and Jetpack report in the site's time zone; the Parse.ly pipeline is UTC.
- **Comparison:** prior period, prior year, match-day-of-week variants, and baselines.
- **Retention:** differs by tier and by source, which limits which grains a range can use.

### Who uses it for what

- **Site owners on Spacefast:** is anyone using it, what changed, why did it drop, what should I do next (Laura's four questions).
- **Editors and homepage curators:** live, per-slot performance through the HUD all shift.
- **Audience and content leads:** daily dashboard use.
- **Data teams:** build their own composite metrics from raw events.
- **Merchants:** revenue, orders, funnel.
- **Agents:** the Parse.ly MCP is live. Jetpack Stats has seven abilities in code, and the plan says "every response carries metric definitions, returns null for unknown values."
- **Recurring asks:** unique page views, customer-defined composite metrics, over- and under-performance flags, new versus returning, scroll depth and heat maps, and plain-language metric definitions.

## 2. What universality demands

Collected from the inventories above. A model that cannot express these will not hold Parse.ly and Jetpack Stats, let alone performance or security data.

1. Additivity per metric, across time and across dimensions, so a total is never produced by summing distinct counts or ratios.
2. Approximation and coverage, such as "estimated" or "consented visitors only".
3. The identity definition behind any people-count.
4. Valid grains and valid dimensions per metric.
5. Null versus zero, partial results and freshness.
6. Hierarchical and multi-valued dimensions.
7. Baselines and comparison windows as first-class objects.
8. Attribution model and lookback for anything attributed.
9. Thresholds, bands and a default percentile, which performance metrics require.
10. Provenance: pixel, edge log, platform API or synced orders.
11. Entitlement and availability, with an "unavailable here" state.
12. Scope: whether a field describes an event, a page view, a session, a visitor or an entity.

## 3. How existing semantic layers handle it

| Precedent | Metric typing | Additivity | Binding | Agent exposure |
|---|---|---|---|---|
| dbt MetricFlow | Simple, ratio, derived, cumulative, conversion | `non_additive_dimension` | Embedded in the model YAML | MCP tools to list and query metrics |
| Cube | Measure types, `rolling_window`, `time_shift` for prior period | Exact versus approximate distinct counts | `sql_table` on the cube | `meta.ai_context`; hosted MCP |
| Malloy | Free expressions | Symmetric aggregates; rejects illegal fan-out | `conn.table()` | Annotations |
| LookML | Many measure types | Symmetric aggregates | `sql_table_name` | Synonyms, descriptions |
| Apache Ossie (formerly OSI) | Name and expression only | None declared | `datasets[].source` | `ai_context` with synonyms and examples |
| Snowflake semantic views | Facts and metrics | `non_additive_dimensions` | Logical table over physical | Synonyms, sample values, verified queries |
| PostHog semantic layer (beta) | A definition is an executable query | Not declared | Over events or warehouse tables | MCP tools; approval lifecycle; drift detection |
| GA4 | Catalogue with metric type | — | — | Scope (user, session, event, item) and a compatibility check |

**Three findings that change the design:**

- **No surveyed semantic layer declares polarity or thresholds on a metric.** They stop at format. Today that knowledge lives in views: `upIsGood` on Spacefast's stat tile, the inverted colour for bounce rate in Plausible's source. Putting it in the model is new ground. The nearest precedents are Core Web Vitals bands and OpenTelemetry's web-vital `rating`.
- **OSI is now Apache Ossie.** It entered the Apache Incubator in July 2026. Its metric object is deliberately thin, so aligning with it costs little and gains little beyond interchange.
- **Events-first and metrics-first are different traditions.** PostHog, Amplitude and Metorik keep raw events and compute at query time, which is what Bob's "back-generated composite metrics" and "segments after the fact" ask for. dbt, Cube and Ossie define metrics over tables.

## 4. Adjacent standards the model should be able to absorb

- **OpenTelemetry.** Instrument types (counter, up-down counter, gauge, histogram) encode additivity. Units are UCUM. Names are dot-namespaced. "Resource" versus "attributes" maps to entity versus dimension.
- **Core Web Vitals.** LCP good at or below 2.5 s and poor above 4 s; INP 200 ms and 500 ms; CLS 0.1 and 0.25; all assessed at the 75th percentile. A metric definition therefore needs a default aggregation, ordered bands and a "lower is better" direction.
- **OCSF** for security. A layered schema: attribute dictionary, objects, event classes, then profiles and extensions. Enums carry an ID and a label, with fixed values for unknown and other. It is the closest precedent for your core, domain, organization, user packs.
- **GA4 scope.** A field describes a user, a session, an event or an item, and mixing scopes produces plausible but wrong numbers.
- **Units and format.** UCUM for units, ISO 4217 for currency, ISO 8601 for durations, and `Intl.NumberFormat` for display.
- **Data contracts.** The Open Data Contract Standard separates logical names from physical servers and carries freshness and retention, which is close to your binding layer.

## 5. Properties worth declaring

**On a metric:** id, label, description, synonyms, type, unit, format, polarity, thresholds or bands, additivity across time and dimensions, default aggregation, default and valid grains, valid dimensions, scope, freshness, approximation, coverage, provenance, owner, privacy class, status.

Most are covered by some precedent. Polarity, thresholds and coverage have no home in any surveyed semantic layer.

**On a dimension:** type, hierarchy, enumerated values with labels, ordering, scope, the entity it joins to, and a colour role. Nobody declares cardinality or a colour role today.

**On an entity:** key, display field, deep link and thumbnail.

## 6. Decisions to make

1. **Events-first or metrics-first?** A hybrid needs metrics that reduce to predicates over raw events.
2. **A closed set of metric types, or free expressions?** A closed set is easier for agents and for the UI to reason about.
3. **How are distinct counts over a range declared:** exact, approximate, or explicitly non-additive across time?
4. **Is scope a first-class property?**
5. **Are segments saved filters over raw events,** as in Metorik and Bob's ask, or named predicates in the model?
6. **Do comparisons and baselines belong to the metric or to the query?** Eder's finding and the Jetpack framework both put them on the query.
7. **Where do polarity and thresholds live:** core metric properties, an overridable pack layer, or view configuration?
8. **One unit vocabulary,** or free strings?
9. **How do packs layer and override,** and which properties can be overridden? A definition probably should not be.
10. **How is the binding expressed:** inline source, or a separate contract the data team owns?
11. **When two sources define the same concept differently,** is that one metric with several bindings or separate named metrics? Spacefast already chose separate names once, relabelling edge "Views" as "Visitor requests".
12. **How does the model state identity and coverage** for people-counts?
13. **How is it serialized for agents:** search plus compact records, list and get tools, or a dense file with synonyms and verified queries?
14. **Is there governance state,** such as proposed, approved, deprecated?
15. **Which naming convention?**
16. **Where does time zone live,** and is the grain set fixed?
17. **Align with an existing spec** (Ossie, dbt, Cube) for interchange, or define our own and export?

## 7. Pitfalls practitioners document

- Fan-out joins inflate sums and counts.
- Non-additive measures get summed in rollups.
- Daily-salted visitor hashes count a returning visitor as new each day.
- Mixing scopes gives plausible but wrong numbers.
- Approximate counts differ between a UI and a raw export.
- Definitions drift across products.
- Changing a metric's type rewrites its history.
- High-cardinality dimensions cause cost and row-collapse problems.

## 8. Not found

- The shipped Parse.ly MCP tool names and parameters.
- The 23-tool list for the Jetpack Stats "exit ramps", which lives in a Google Doc.
- Whether Parse.ly de-duplicates visitors across sites in a network rollup.
- Any standard for annotating consent basis on a metric.

## Sources

- [Laura's planning doc](https://docs.google.com/document/d/1lKyeJOymwbeiV1dLx8pjhqfy_PLG0D5LDFT88mLftuU/edit?tab=t.hgihce6w42or)
- Parse.ly: [available metrics](https://docs.parse.ly/api-available-metrics/), [calculations](https://docs.parse.ly/calculations-in-parsely/), [data pipeline schema](https://docs.parse.ly/data-pipeline-schema/), [HUD metric definitions](https://docs.parse.ly/user-handbook/tools-features/heads-up-display/hud-metric-definitions/), [MCP server](https://docs.parse.ly/mcp-server/)
- Internal: [UPV PRD](https://unifiedanalyticsp2.wordpress.com/2026/05/27/prd-unique-page-views-upv-as-a-target-metric/), [One Pixel to Rule Them All](https://unifiedanalyticsp2.wordpress.com/2026/03/13/one-pixel-to-rule-them-all-why-jiab-needs-a-single-tracking-system/), [Proposed Typology of AI Web Interactions](https://unifiedanalyticsp2.wordpress.com/2026/09/21/proposed-typology-of-ai-web-interactions/)
- [Automattic/jetpack](https://github.com/Automattic/jetpack): `projects/packages/stats/src/abilities/class-stats-abilities.php`, `projects/packages/premium-analytics`
- Semantic layers: [dbt metrics](https://docs.getdbt.com/docs/build/metrics-overview), [Cube measures](https://docs.cube.dev/reference/data-modeling/measures), [Malloy aggregates](https://docs.malloydata.dev/documentation/language/aggregates), [Apache Ossie](https://ossie.apache.org), [Snowflake semantic view spec](https://docs.snowflake.com/en/user-guide/views-semantic/semantic-view-yaml-spec), [PostHog semantic layer](https://posthog.com/docs/semantic-layer)
- Standards: [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model), [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds), [OCSF](https://github.com/ocsf/ocsf-docs), [GA4 dimension and metric scope](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema), [UCUM](https://ucum.org/ucum), [Open Data Contract Standard](https://bitol-io.github.io/open-data-contract-standard/latest)