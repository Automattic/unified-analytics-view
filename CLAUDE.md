# universal-analytics

The charting and UI layer for the analytics MVP. A view is described once, as JSON, in marks, encodings and roles; each host decides how to present it. Tracking, storage and retrieval are built elsewhere, and this repo starts at the query result.

Read `docs/view-grammar-reference.md` before changing the grammar, and `docs/milestones.md` for the course. Sections of the reference are labelled Proven, Proposed or Open.

## Commands

```
pnpm install
pnpm test         # vitest: sweep, parity with the prototype, plan, schema, golden scenes
pnpm typecheck    # tsc --noEmit, strict
pnpm test -u      # rewrite golden scenes; read the diff before committing it
pnpm --filter @universal-analytics/tokens generate   # rewrite packages/tokens/generated from its config
```

There is no build step yet. Packages export their TypeScript source; a bundler arrives with the first thing that needs one.

## Layout

- `packages/core`: types, presets and `expand`, the plan (`resolve`), scene builders, the sentence, and JSON Schemas in `schema/`.
- `packages/fixtures`: the catalog, the seeded fixture query engine (`typical`, `no-prior`, `empty`) and the six sample specs.
- `packages/tokens`: build-time token generation, ported from the storybook repo. Leonardo makes the colour ramps and Utopia the type, space and control-size scales, from `config/` into `generated/` (DTCG JSON and `tokens.css`). Primitives only; nothing consumes them yet.
- `test/`: one suite across both packages. Golden scenes are in `test/__snapshots__`.
- `prototype/`: read-only reference. The tests load `prototype-bench.js` and hold the port to it.
- `packages/dom`, `packages/dots`, `apps/bench`: not started.

## Rules

- **The core has no DOM and no framework.** Runtime dependencies are `d3-scale`, `d3-shape` and `d3-array`. Ask before adding any other.
- **Do not add chart types.** A new shape is a mark. A new combination is a preset, named after the `@automattic/charts` component it replaces where one exists.
- **This is the candidate next major of `@automattic/charts`.** Keep its token names (`--a8c-charts-*`) and its keyboard model. See `docs/positioning.md`.
- **No sizes or breakpoints in a spec.** They belong to the host.
- **Scenes carry paint tokens, never colours.**
- **Keys are stable and unique.** Transitions and keyboard navigation hang on them.
- **The catalog is an input.** Core functions take it as an argument; nothing in `packages/core` knows a metric name.
- **Totals come from the engine.** A view never sums the rows it receives to make a headline number.
- **Every error names the fix.**
- **Parity with the prototype** is asserted by the sweep. If the prototype is wrong, flag it and change both the behaviour and that test on purpose; do not fix it silently.
- **Proposed items** in the reference are the plan: build them as written and report if they do not hold up. **Open items** are not yours to settle: raise them with a recommendation.
- **Small commits,** one concern each.
