# universal-analytics

The charting and UI layer for the analytics MVP. A view is described once, as JSON, in marks, encodings and roles; the container it lands in decides how to present it. Tracking, storage and retrieval are built elsewhere, and this repo starts at the query result.

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

- `packages/core`: types, presets and `expand`, the plan (`resolve`), scene builders, the tldr prose, and JSON Schemas in `schema/`.
- `packages/fixtures`: the catalog, the seeded fixture query engine (`typical`, `no-prior`, `empty`) and the six sample specs.
- `packages/tokens`: build-time token generation, ported from the storybook repo. Base tier: Leonardo makes the colour ramps and Utopia the type, space and control-size scales; `config/base.tokens.json` holds the rest. Common tier: `config/common.tokens.json` (and `common.dark`) names the Spacefast library's variables as aliases into base. Style Dictionary compiles both to `generated/tokens.css`. Nothing consumes them yet.
- `test/`: one suite across both packages. Golden scenes are in `test/__snapshots__`.
- `prototype/`: read-only reference. The tests load `prototype-bench.js` and hold the port to it.
- `packages/dom`, `packages/dots`, `apps/bench`: not started.

## Rules

- **The core has no DOM and no framework.** Runtime dependencies are `d3-scale`, `d3-shape` and `d3-array`. Ask before adding any other.
- **Do not add chart types.** A new shape is a mark. A new combination is a preset, named after the `@automattic/charts` component it replaces where one exists.
- **This is the candidate next major of `@automattic/charts`.** Keep its token names (`--a8c-charts-*`) and its keyboard model. See `docs/positioning.md`.
- **No sizes, breakpoints or presentation switches in a spec.** They belong to the container and its rules. `keep` is the author's one lever, and it is provisional.
- **Scenes carry paint tokens, never colours.**
- **Keys are stable and unique.** Transitions and keyboard navigation hang on them.
- **The catalog is an input.** Core functions take it as an argument; nothing in `packages/core` knows a metric name.
- **Totals come from the engine.** A view never sums the rows it receives to make a tldr value.
- **Every error names the fix.**
- **Parity with the prototype** is asserted by the sweep. If the prototype is wrong, flag it and change both the behaviour and that test on purpose; do not fix it silently. The prototype keeps its old names (`headline`, `sentence`, `host`); `test/core.test.ts` maps them to tldr value, tldr prose and container.
- **Proposed items** in the reference are the plan: build them as written and report if they do not hold up. **Open items** are not yours to settle: raise them with a recommendation.
- **Small commits,** one concern each.
