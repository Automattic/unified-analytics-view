# universal-analytics

The charting and UI layer for the analytics MVP. A view is described once, as JSON, in marks, encodings and roles; the container it lands in decides how to present it. Tracking, storage and retrieval are built elsewhere, and this repo starts at the query result.

Read `docs/view-grammar-reference.md` before changing the grammar, and `docs/milestones.md` for the course. `docs/chart-coverage-plan.md` is the plan that added the marks and layouts beyond the prototype's, and section 8 of it records what building each step found. Sections of the reference are labelled Proven, Proposed or Open.

## Commands

```
pnpm install
pnpm test         # vitest: sweep, parity with the prototype, plan, schema, golden scenes
pnpm typecheck    # tsc --noEmit, strict
pnpm test -u      # rewrite golden scenes; read the diff before committing it
pnpm bench        # the bench at localhost:5173, on Vite
pnpm --filter @universal-analytics/tokens generate   # rewrite packages/tokens/generated from its config
```

Packages export their TypeScript source and nothing is built for release yet. Vite serves the bench.

## Layout

- `packages/core`: types, presets and `expand`, the plan (`resolve`), scene builders (ratios) and `place` (pixels), the tldr prose, the registry for custom marks (`marks.ts`), and JSON Schemas in `schema/`.
- `packages/fixtures`: the catalog, the seeded fixture query engine (`typical`, `no-prior`, `empty`), the six sample specs the prototype knows (`samples`) and the ones it does not (`moreSamples`). It registers the `geo` mark on import, with a small file of country shapes.
- `packages/tokens`: build-time token generation, ported from the storybook repo. Base tier: Leonardo makes the colour ramps and Utopia the type, space and control-size scales; `config/base.tokens.json` holds the rest. Common tier: `config/common.tokens.json` (and `common.dark`) names the Spacefast library's variables as aliases into base. Charts tier: `config/charts.tokens.json` declares every `--ua-charts-*` token `<ua-view>` reads, as aliases into the other two. Style Dictionary compiles all three to `generated/tokens.css`. The bench loads it; `packages/dom` never imports it, and meets it only in those names (`test/dom-tokens.test.ts`).
- `test/`: one suite across the packages. There is no DOM in the run, so `packages/dom` is tested where it is strings and plain functions: the compiled rules, each layout's own rules, the measured pass's decisions, key stepping and the readout, and the path morph. The element is checked in a browser on the bench. Golden scenes are in `test/__snapshots__`.
- `prototype/`: read-only reference. The tests load `prototype-bench.js` and hold the port to it.
- `apps/bench`: where work is looked at. Every sample in resizable frames, with data state, height limit and theme as controls, beside pages for the demo, the marks one at a time, the sidebar, a dashboard for each of the seventeen plan goals (`goals`, on an engine and catalog of its own), tokens (with elevation and the materials) and the spike. Every view is a `<ua-view>`; new painters, chrome and surfaces get a place here as they land.
- `packages/dom`: the `<ua-view>` custom element and the fit-rule compiler. It plans once with no limits, paints the ratio scene, and leaves the fitting to container queries; a measured pass (`measure.ts`) settles what CSS cannot say. One module per layout in `src/layouts/`, behind the seam in `src/layout.ts`: `cartesian`, `rows`, `band`, `radial` and `matrix`, with `points`, `ranges` and `track` painting what those marks add. A custom mark's painter joins through `registerPainter`. Its only dependency is core. `src/tokens.ts` lists the public tokens with the value each falls back to: colour, radius, stroke, weight, motion and the type faces. A face may be a fluid token; the element works each out once per view. Gaps, gutters and heights are not tokens: fit rules are worked out from them. The number is set in the dot matrix (`src/dots.ts`), wherever a view shows one: the prototype's 5 by 7 glyphs on a screen, drawn by the stylesheet, with a least cell of 3 px.
- `packages/geo`: the `geo` custom mark, for a choropleth and symbols on a map. The one package that depends on `d3-geo`. Its scene half loads with no DOM.
- `packages/spacefast`: the adapter from one answer of Spacefast's analytics query API to a view's query, result and catalog. One function, `adapt`. It knows that API's names; core still knows none. The API's two recorded examples are in `test/fixtures/spacefast`.
- `packages/dots`: not started.

## Rules

- **The core has no DOM and no framework.** Runtime dependencies are `d3-scale`, `d3-shape` and `d3-array`. Ask before adding any other.
- **Do not add chart types.** A new shape is a mark. A new combination is a preset, named after the `@automattic/charts` component it replaces where one exists. What the grammar cannot say is a custom mark, registered in code (`registerMark`), and each one counts against the grammar.
- **New samples go in `moreSamples`.** The parity tests sweep every entry of `samples` against the prototype.
- **Statistics come from the engine,** as companion fields (`metric@p25`). Core computes no quantile, bin or running total.
- **This is the candidate next major of `@automattic/charts`.** Keep its token structure, under our own prefix (`--ua-charts-*` for its `--a8c-charts-*`), and its keyboard model. The two do not interoperate yet; a page with version 4 tokens aliases each one across. See `docs/positioning.md`.
- **No sizes, breakpoints or presentation switches in a spec.** They belong to the container and its rules. `keep` is the author's one lever, and it is provisional.
- **Scenes carry paint tokens, never colours.**
- **Keys are stable and unique.** Transitions and keyboard navigation hang on them.
- **The catalog is an input.** Core functions take it as an argument; nothing in `packages/core` knows a metric name.
- **Totals come from the engine.** A view never sums the rows it receives to make a tldr value.
- **Every error names the fix.**
- **Parity with the prototype** is asserted by the sweep. If the prototype is wrong, flag it and change both the behaviour and that test on purpose; do not fix it silently. The prototype keeps its old names (`headline`, `sentence`, `host`); `test/core.test.ts` maps them to tldr value, tldr prose and container.
- **Proposed items** in the reference are the plan: build them as written and report if they do not hold up. **Open items** are not yours to settle: raise them with a recommendation.
- **Small commits,** one concern each.
