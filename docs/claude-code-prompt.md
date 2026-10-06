# Prompt for Claude Code: start the view grammar build

**Setup.** Start in an empty repository and add these files before pasting the prompt:

```
docs/view-grammar-reference.md
prototype/prototype-bench.js
prototype/prototype-bench.html
prototype/prototype-test.js
```

Then paste everything below the line.

---

You are starting the real build of an analytics view system. A view is described once, as JSON, in terms of marks, encodings and roles. Each host decides how to present it at the size it has. Chart types are not primitives here; they are presets that expand into layers. A working prototype exists, and your job in this session is to turn its core into a typed, tested foundation.

## Read first

1. `docs/view-grammar-reference.md`. This is the design. Every section is labelled Proven, Proposed or Open. Read all of it before writing code.
2. `prototype/prototype-bench.js`. The whole pipeline in one file: catalog, fixture query, presets, plan, scene, two painters and a playground UI. Use it as the reference for behaviour, not for structure or style.
3. `prototype/prototype-test.js`. The sweep you will port.
4. `prototype/prototype-bench.html`. Open it in a browser if you want to see the behaviour you are matching.

## This session: milestone 1 only

Port the pure pipeline into a typed core with tests. No DOM work yet.

1. **Scaffold** a TypeScript workspace (strict mode) with `packages/core`, `packages/fixtures` and a test runner. Use pnpm workspaces, Vite and Vitest unless the environment gives you a reason not to, and say so if it does.
2. **`packages/fixtures`:** the catalog, the seeded fixture query engine with its three data states (`typical`, `no-prior`, `empty`), and the six sample specs.
3. **`packages/core`:**
   - Types for the spec, layer, catalog, query result, host, plan and scene.
   - Validation with the prototype's error messages. Every error names the fix.
   - Presets and `expand`.
   - The plan, including the central reducer exactly as the prototype has it. The reference doc proposes replacing it with per-element degradation for browser hosts, but port it anyway: it is the baseline that approach will be measured against, and hosts with no CSS still need it.
   - The scene builders.
   - The derived sentence.
4. **A JSON Schema** for the spec and for the catalog. Test that all six samples validate and that the invalid specs in the prototype's tests are rejected.
5. **Tests:**
   - Port the sweep from `prototype-test.js`: every sample, three data states, two painters' type metrics, six height limits, nine widths. Assert no duplicate keys, no NaN, and no scene taller than its host allows.
   - Assert the fixture facts listed in section 17 of the reference doc.
   - Scene snapshots as golden files for the six samples at three host sizes: 346 px wide with no height limit, 234 px wide with no height limit, and 346 by 100 px.
   - Plan assertions for the fallback behaviour described in section 10.1, including `keep`.
6. **Write `CLAUDE.md`** at the repo root capturing the rules below and the commands to build and test.

Stop there and report. Do not start milestone 2.

## Then, before any DOM code: a design note

Write `docs/dom-painter-plan.md` and wait for review. It should propose:

- The format for per-element fit rules, such that one declaration compiles to container queries for browser hosts and can also be evaluated in code (reference doc sections 10.2 and 19, Open item 1).
- Whether the scene carries ratios or pixels, and how the dot-grid painter shares it (Open item 2).
- The element structure and container names for the three current layouts.
- Where the measured pass for tick thinning and label collision hooks in.
- How keys and roles map to DOM for keyboard navigation and transitions.

Keep it short and concrete, with one worked example: the trend view.

## Later milestones, for orientation only

2. The DOM painter: HTML, CSS and SVG with intrinsic sizing and per-element container queries, inside a custom element with shadow DOM.
3. The bench rebuilt on the packages.
4. The measured pass, accessibility (sentence, table alternative, keyboard navigation) and keyed transitions.
5. The dot-grid painter ported, the `arc` mark, and the three hard-coded layouts generalized.
6. Params and selections.

## Rules

- **The core has no DOM and no framework.** Runtime dependencies are `d3-scale`, `d3-shape` and `d3-array`. Ask before adding any other.
- **Do not add chart types.** A new shape is a mark. A new combination is a preset.
- **No sizes or breakpoints in a spec.** They belong to the host.
- **Scenes carry paint tokens, never colours.**
- **Keys are stable and unique.** They are what transitions and keyboard navigation will hang on.
- **Match the prototype's behaviour in milestone 1:** the same plans, the same sentences, the same fixture numbers. If you think the prototype is wrong somewhere, flag it and keep parity. Do not fix it silently.
- **Proposed items** in the reference doc are the plan. Build them as written and report if they do not hold up.
- **Open items** are not yours to settle. Raise them with a recommendation.
- **Small commits,** one concern each.

## Report back

- What you built, with the actual test output.
- Every place you departed from the prototype, and why.
- Anything in the reference doc that turned out to be wrong, ambiguous or missing.
- Questions on any Open items you ran into, each with your recommendation.
