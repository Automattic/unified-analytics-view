# universal-analytics

The charting and UI layer for the analytics MVP: a small grammar of marks, a view spec, and the renderers that draw it on each surface. A view is described once, as JSON, and the container it is shown in decides how to present it.

Tracking, storage and retrieval are built elsewhere. This repo starts at the query result.

## Layout

```
docs/
  vision.md                   what this is for: read first
  view-grammar-reference.md   the design, and what is decided and open
  focus-plan.md               the course: what is cut and what is built, a step at a time
  api-proposal.md             what the views ask of the query API: a proposal to its owners
  archive/                    the plans that are built, and what building each found
  design-inputs/              research behind the design: views, view spec, semantic model
sketches/                     visual direction: materials and the dot-matrix readout
packages/
  core/                       spec types and schemas, presets, plan, scene, fit rules, tldr prose, the board
  fixtures/                   catalog, fixture query engine, sample specs
  tokens/                     build-time design tokens
  dom/                        the <ua-view> custom element: HTML, CSS and SVG painter
  geo/ flow/ partition/       custom marks: a map, a Sankey, a treemap
  spacefast/                  the adapter from Spacefast's analytics query API
  agent/                      the agent surface: what can be said, and a spec checked or drawn, as an MCP server
  dots/                       dot-grid painter (not started)
apps/
  bench/                      where work is looked at: playground, samples, a board, marks, parts, tokens
test/                         one suite across the packages
```

Everything but `dots` is built. `pnpm install && pnpm test` runs the suite, and `pnpm bench` serves the bench at localhost:5173. `CLAUDE.md` says what each package holds and the rules the code keeps.
