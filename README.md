# universal-analytics

The charting and UI layer for the analytics MVP: a small grammar of marks, a view spec, and the renderers that draw it on each surface. A view is described once, as JSON, and the container it is shown in decides how to present it.

Tracking, storage and retrieval are built elsewhere. This repo starts at the query result.

## Layout

```
docs/
  view-grammar-reference.md   the design: start here
  milestones.md               the course to the MVP
  claude-code-prompt.md       the brief for milestone 1 (typed core, no DOM)
  design-inputs/              research behind the design: views, view spec, semantic model
prototype/                    read-only reference: the whole pipeline in one file, plus its sweep test
sketches/                     visual direction: materials and the dot-matrix readout
packages/
  core/                       spec types and schema, validation, presets, plan, scene, tldr prose
  fixtures/                   catalog, fixture query engine, sample specs
  dom/                        HTML, CSS and SVG painter; the custom element
  dots/                       dot-grid painter
apps/
  bench/                      the playground
```

`core` and `fixtures` are built and tested (`pnpm install && pnpm test`). `dom`, `dots` and `bench` are not started. The course is in `docs/milestones.md`.

## Running the prototype

Open `prototype/prototype-bench.html` in a browser.

The sweep test expects the bench at `./bench.js` and `d3` from npm:

```
cd prototype && cp prototype-bench.js bench.js && npm i --no-save d3@7.9.0 && node prototype-test.js
```
