# Milestones

As of October 5, 2026. The course from the prototype to the MVP surfaces, for the three things this repo owns end to end:

- **A. The grammar.** Nail it, and position it against `@automattic/charts` and Jetpack Stats.
- **B. The MVP views.** Settle the initial set of views and charts, and design them.
- **C. The MVP surfaces.** Build the first places those views appear.

The query handler and the semantic model are shared with the rest of the team and are resolved with them. This repo meets that work at one seam (see "The seam" below) and runs on fixtures until it lands.

The demo is Friday, October 9. The order below is chosen so that every milestone leaves something that can be shown, and so that the work most likely to be cut is last.

## The course

| # | Milestone | Track | Target | Done when |
|---|---|---|---|---|
| 1 | Typed core | A | Tue | The prototype's pure pipeline is a typed, DOM-free package that matches the prototype on every case in the sweep |
| 2 | Positioning | A | Tue | One doc says what this is relative to `@automattic/charts` and the Jetpack Stats widget framework, and settles the chart substrate |
| 3 | MVP view set | B | Tue–Wed | Every metric in the Friday cut has a spec, a fixture and a sentence, and the grammar gaps they expose are listed |
| 4 | DOM painter | A, C | Wed | The view set renders in a custom element at sidebar width, degrading per element |
| 5 | Design pass | B | Wed–Thu | The views and their chrome look finished in light and dark, in every state |
| 6 | Panel surface | C | Thu | One script tag puts a working panel on any page, on fixtures |
| 7 | Live data and demo | C | Fri | The panel reads the team's API, or the fixture demo stands on its own |

### 1. Typed core

Port sections 1 to 7 of `prototype/prototype-bench.js` into `packages/core` and `packages/fixtures`, as scoped in `docs/claude-code-prompt.md`: types, validation, presets, the plan with its central reducer, scene builders, the sentence, JSON Schemas for the spec and the catalog.

**Done when:** the ported pipeline produces the same plan, scene and sentence as the prototype for every sample, data state, painter, height and width in the sweep; the fixture facts in section 17 of the reference hold; golden scenes exist for the six samples at three host sizes.

### 2. Positioning

A short doc, `docs/positioning.md`, grounded in the actual code of both packages. It answers:

- What each `@automattic/charts` component is in this grammar: a preset, a mark, a custom mark, or a part of the chrome.
- What the Jetpack Stats widget framework has that this does not (placement, sections, attributes, shared report params) and the reverse (a declarative data binding, fallback, a sentence).
- What we take from each. Known candidates: comparison as a property of a series (Eder), the metric card and richer ranked list as the missing compositions (Jarosław), `ReportParams` as the shape of shared params.
- How the two could meet later: a view spec as the body of a Jetpack widget, or `@automattic/charts` components as painters for a scene. Neither is built this week.
- The chart substrate call, stated once so the team can stop discussing it.

**Done when:** Bob, Laura and Jeff can read it in five minutes and nobody has to ask "why not just use Automattic Charts".

### 3. MVP view set

The views the Friday cut needs, each written as a `view/0` spec against fixtures:

| View | Metrics | Form today | Needs |
|---|---|---|---|
| Headline tiles | Visitors, page views, unique page views, engaged time, conversions, revenue | Number with delta | Duration and currency formats; optional sparkline beside the number |
| Trend | Any tile's metric by day | `trend` | Nothing new |
| Top pages | Page views by page | `bar-list` | A top-three step when narrow |
| Referrers | Visitors by referrer domain, then URL | `bar-list` | Two-level drill |
| Channels, with AI assistants | Visitors by channel | `share-bar` or `bar-list` | A decision between the two |
| UTM | Visitors by source, medium, campaign | `bar-list` | Tabs across three dimensions (chrome, not grammar) |
| Country | Visitors by country | `bar-list` | Nothing new; the map waits |
| Device, browser, OS | Visitors by each | `share-bar` or `bar-list` | Tabs |
| Conversions and events | Count, rate and value by event | `bar-list` | More than one metric per row |
| Revenue by channel and page | Revenue by channel, by page | `bar-list` | Currency format |
| Present now | Present, by page | `bar-list` with headline | Live update; the zero state exists |

The fixtures grow to cover these metrics and dimensions. Each grammar gap becomes either a small extension (a format, a second metric in a row) or an entry in the positioning doc's "not yet" list.

**Done when:** every row above renders in the bench from a spec, with a correct sentence in all three data states.

### 4. DOM painter

Starts with the design note the handoff prompt asks for, `docs/dom-painter-plan.md`: the fit-rule format, ratios versus pixels in the scene, element structure and container names, and how keys map to DOM. Then `packages/dom`: HTML, CSS and SVG with intrinsic sizing and per-element container queries, inside a custom element with shadow DOM, with paint tokens as CSS custom properties.

**Done when:** the view set renders at 346 px and degrades sensibly down to the number, with no script running on resize, and does not inherit or leak styles on a hostile host page.

**Cut for Friday if needed:** label collision beyond tick thinning, keyboard navigation over marks, keyed transitions. The sentence as the accessible description and the table alternative stay in.

### 5. Design pass

The visual language for the views and the chrome around them: tokens for both themes, type, the headline number treatment, the material for the panel with fallbacks outside Chromium, motion, and every state in section 13 of the reference. The chrome primitives the prototype lacks are designed and built here: delta badge, scope and filter chips, compact date and compare control, tabs, notices for empty, loading and stale.

Inputs: the three files in `sketches/`. Whether the instrument look (dot matrix, VFD) is the direction or one option is still unanswered, and this milestone is where it gets answered.

**Done when:** the panel on fixtures is something Bob would call slick, in light and dark.

### 6. Panel surface

The first surface: a panel that slides in on the front end of a site for a recognized admin, page-aware, at sidebar width. A thin shell that composes views: scope switch (this page or the whole site), date and compare control, tiles, trend, tabbed lists, present now. It owns the shared params and hands each view its query.

**Done when:** a single script tag on an arbitrary page, not a Spacefast space, opens the panel on fixtures.

A dashboard is the same views in a wider host. It is not a separate build, and whether it ships beside the panel is the team's call, not a cost in this repo.

### 7. Live data and demo

Replace the fixture engine with the team's API behind the seam. If the API is not ready, the fixture demo is the demo.

## After Friday

In rough order: params and selections (cross-filtering), boards, generalizing the three hard-coded layouts, the `arc` mark, the dot-grid painter ported to the packages, label collision, keyboard navigation and keyed transitions, the agent surface over MCP, and the paths into Jetpack Stats that the positioning doc describes.

## The seam

This repo needs two things from the team's side, and nothing else:

1. **A result** in the shape of section 5 of the reference: `{ rows, totals, meta }`, with totals computed by the engine, comparison as `metric@previous`, a `partial` flag on the incomplete bucket, and null for unknown.
2. **A catalog** entry per metric and dimension: label, unit, polarity, how a range total is formed, and whether it is instantaneous.

Both are proposals to bring to Jeff and Laura, not decisions. An adapter between their API and this shape is cheap, so their choices do not block milestones 1 to 6.

## Open calls that shape the course

1. **Panel first.** Bob's Oct 2 post names the panel; Jeff prefers a dashboard. The views are host-agnostic, so this only decides which shell is built Thursday. This plan assumes the panel.
2. **The visual direction.** See milestone 5.
3. **Channels and devices: share bar or ranked list.** A design decision in milestone 3.
4. **What "present now" counts.** Tabs or people is the team's call; the view is the same either way, only the label and sentence change.
