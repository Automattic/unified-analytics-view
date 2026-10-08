# Milestones

As of October 5, 2026. The course from the prototype to the MVP surfaces, for the three things this repo owns end to end:

- **A. The grammar.** Nail it, and position it as the next version of `@automattic/charts`, informed by Jetpack Stats.
- **B. The MVP views.** Settle the initial set of views and charts, and design them.
- **C. The MVP surfaces.** Build the first places those views appear.

The query handler and the semantic model are shared with the rest of the team and are resolved with them. This repo meets that work at one seam (see "The seam" below) and runs on fixtures until it lands.

The demo is Friday, October 9. The order below is chosen so that every milestone leaves something that can be shown, and so that the work most likely to be cut is last.

## The course

| # | Milestone | Track | Target | Done when |
|---|---|---|---|---|
| 1 | Typed core | A | **Done** | The prototype's pure pipeline is a typed, DOM-free package that matches the prototype on every case in the sweep |
| 2 | Positioning | A | **Drafted** | One doc says what this is relative to `@automattic/charts` and the Jetpack Stats widget framework, and settles the chart substrate |
| 3 | MVP view set | B | Tue–Wed | Every metric in the Friday cut has a spec, a fixture and a tldr prose, and the grammar gaps they expose are listed |
| 4 | DOM painter | A, C | Wed | The view set renders in a custom element at sidebar width, degrading per element |
| 5 | Design pass | B | Wed–Thu | The views and their chrome look finished in light and dark, in every state |
| 6 | Panel and dashboard | C | Thu | One script tag puts a working panel on any page, and the same views fill a dashboard page, on fixtures |
| 7 | Live data and demo | C | Fri | The panel reads the team's API, or the fixture demo stands on its own |

### 1. Typed core

Port sections 1 to 7 of `prototype/prototype-bench.js` into `packages/core` and `packages/fixtures`, as scoped in `docs/claude-code-prompt.md`: types, validation, presets, the plan with its central reducer, scene builders, the tldr prose, JSON Schemas for the spec and the catalog.

**Done when:** the ported pipeline produces the same plan, scene and tldr prose as the prototype for every sample, data state, painter, height and width in the sweep; the fixture facts in section 17 of the reference hold; golden scenes exist for the six samples at three container sizes.

### 2. Positioning

`docs/positioning.md`, grounded in the code of both packages. The framing (decided Oct 5): this work is the next version of `@automattic/charts`, redone with what Jetpack Stats taught us and what Spacefast and Unified Analytics now require. It is a major version, consumers refactor, and it keeps the parts worth keeping.

Three alignment choices follow from that and are already made: paint tokens use the `--a8c-charts-*` names, the keyboard model is version 4's, and presets are named after the chart they replace (`line`, `bar-list`).

**Done when:** Bob, Laura and Jeff can read it in five minutes and nobody has to ask "why not just use Automattic Charts". Proposing it to the charts and Stats owners comes after the Friday demo.

### 3. MVP view set

The views the Friday cut needs, each written as a `view/0` spec against fixtures:

| View | Metrics | Form today | Needs |
|---|---|---|---|
| Tldr value tiles | Visitors, page views, unique page views, engaged time, conversions, revenue | Number with delta | Duration and currency formats; optional sparkline beside the number |
| Trend | Any tile's metric by day | `line` | Nothing new |
| Top pages | Page views by page | `bar-list` | A top-three step when narrow |
| Referrers | Visitors by referrer domain, then URL | `bar-list` | Two-level drill |
| Channels, with AI assistants | Visitors by channel | `share-bar` or `bar-list` | A decision between the two |
| UTM | Visitors by source, medium, campaign | `bar-list` | Tabs across three dimensions (chrome, not grammar) |
| Country | Visitors by country | `bar-list` | Nothing new; the map waits |
| Device, browser, OS | Visitors by each | `share-bar` or `bar-list` | Tabs |
| Conversions and events | Count, rate and value by event | `bar-list` | More than one metric per row |
| Revenue by channel and page | Revenue by channel, by page | `bar-list` | Currency format |
| Present now | Present, by page | `bar-list`, with the tldr value above it because the metric is instant | Live update; the zero state exists |

Decided Oct 7: the spec is the seed and carries no presentation switches. `headline` and `guides` are out of `view/0`, the container's rules decide what they used to, and `keep` stays provisionally. The names are now tldr value (was headline), tldr prose (was sentence) and container (was host). See section 19 of the reference.

The fixtures grow to cover these metrics and dimensions. Each grammar gap becomes either a small extension (a format, a second metric in a row) or an entry in the positioning doc's "not yet" list.

**Done when:** every row above renders in the bench from a spec, with a correct tldr prose in all three data states.

### 4. DOM painter

Per element from the start (decided Oct 5). `docs/dom-painter-plan.md` is the design note and is awaiting review: the fit-rule format, a ratio scene with `place()` for pixel painters, element structure and container names, and how keys map to DOM. After review, a half-day spike on the trend view, then `packages/dom`: HTML, CSS and SVG with intrinsic sizing and per-element container queries, inside a custom element with shadow DOM, with paint tokens as CSS custom properties.

**Done when:** the view set renders at 346 px and degrades sensibly down to the number, with no script running on resize, and does not inherit or leak styles on a hostile host page.

**Cut for Friday if needed:** label collision beyond tick thinning, keyboard navigation over marks, keyed transitions. The tldr prose as the accessible description and the table alternative stay in.

### 5. Design pass

The visual language for the views and the chrome around them: tokens for both themes, type, the tldr value treatment, the material for the panel with fallbacks outside Chromium, motion, and every state in section 13 of the reference. The chrome primitives the prototype lacks are designed and built here: delta badge, scope and filter chips, compact date and compare control, tabs, notices for empty, loading and stale.

Direction (decided Oct 5): the instrument look, selectively. The dot-matrix or VFD treatment carries the tldr values and the live counter; marks are clean vector, and the material is restrained. Inputs: the three files in `sketches/`.

Split (decided Oct 5): David owns the look of the tldr value, the materials and motion. Claude proposes the data views and the chrome in the bench. They merge in the bench.

**Done when:** the panel on fixtures is something Bob would call slick, in light and dark.

### 6. Panel and dashboard

The first surface: a panel that slides in on the front end of a site for a recognized admin, page-aware, at sidebar width. A thin shell that composes views: scope switch (this page or the whole site), date and compare control, tiles, trend, tabbed lists, present now. It owns the shared params and hands each view its query.

**Done when:** a single script tag on an arbitrary page, not a Spacefast space, opens the panel on fixtures.

How it is authored (decided Oct 7): the chrome and the surfaces are custom elements, with Lit inside the stateful ones, built by Vite into one self-contained file. Surface state is plain data in core, and the query function and the page are handed in. That is what lets the same components land in a native browser's panel and an agent harness's artifact later. See `docs/shell-plan.md`.

Both ship (decided Oct 5). The dashboard page is the same views in wider containers, as tiles in a layout that hands each view a box, sharing the panel's params. It is a second shell and a layout, not a second set of views. If Thursday runs short, the dashboard is cut before the panel.

### 7. Live data and demo

Replace the fixture engine with the team's API behind the seam. If the API is not ready, the fixture demo is the demo.

## After Friday

In rough order: params and selections (cross-filtering), boards, generalizing the three hard-coded layouts, the `arc` mark, the dot-grid painter ported to the packages, label collision, keyboard navigation and keyed transitions, the agent surface over MCP, and the parity list and port into the Jetpack monorepo that the positioning doc describes.

The layouts, the `arc` mark and the rest of the marks are inventoried and ordered in `docs/chart-coverage-plan.md`: what it takes to draw every common chart type, in eight steps.

## The seam

This repo needs two things from the team's side, and nothing else:

1. **A result** in the shape of section 5 of the reference: `{ rows, totals, meta }`, with totals computed by the engine, comparison as `metric@previous`, a `partial` flag on the incomplete bucket, and null for unknown.
2. **A catalog** entry per metric and dimension: label, unit, polarity, how a range total is formed, and whether it is instantaneous.

Both are proposals to bring to Jeff and Laura, not decisions. An adapter between their API and this shape is cheap, so their choices do not block milestones 1 to 6.

## Open calls that shape the course

1. **The DOM painter plan.** Five calls in `docs/dom-painter-plan.md`, and a spike that can still send us back to the pixel scene.
2. **Channels and devices: share bar or ranked list.** A design decision in milestone 3.
3. **What "present now" counts.** Tabs or people is the team's call; the view is the same either way, only the label and the tldr prose change.
