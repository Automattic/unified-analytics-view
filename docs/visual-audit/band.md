# band

Source: `packages/dom/src/layouts/band.ts`, `packages/dom/src/chrome/unit.ts` (scene and placement in `packages/core/src/scene.ts` `sceneGrid`, `packages/core/src/place.ts` `placeBand` / `placeGrid`, fit rules in `packages/core/src/fit.ts`). Seen in 3 samples (`mix`, `waffle`, `icons`), all in the `band` layout: one share bar (`mix`) and two unit grids (`waffle` divided by a dimension, `icons` read against a range).

## Summary
The share bar is sound. It is a steady 24 px at every width and in a 100 px box, its segments are true to their shares, it keeps a 2 px gap between them, and it hands over to the number cleanly under 110 px. The unit grid holds its square and its counts well, but it sits badly in the view. It is a 160 px square centred in a frame whose number, key and legend are all set from the left edge, so at 346 px and wider the view looks unanchored. The most important problem is colour. In light, the grid's unlit cells use a saturated lime tint that competes with the lit cells, and the first three series colours (olive, green, teal) sit too close together when they are packed edge to edge in a bar or grid.

## Base issues
### B1. The grid is centred while everything around it is set from the left
- **Severity**: medium
- **What**: The unit grid is capped at 160 px and centred (`margin-inline: auto` in `band.ts`, `left` from `heldBox` in `placeGrid`). The number above it, the "Each is 5" key under it and the legend's swatches all start at x = 0, and the legend's shares sit at the right edge. At 480 px the grid floats between two empty 160 px margins. At free width (1240) it is a small square in the middle of a wide strip. The key reads as detached: it sits 160 px to the left of the glyphs it describes.
- **Evidence**: `frames/icons/light-natural-480.png` and `frames/icons/dark-natural-480.png` (number and key at the left, grid at 160–320); `frames/waffle/light-natural-480.png` (grid centred, legend running the full 480 with shares at the far right); `parts/band/icons-light-natural-free.png` and `parts/band/waffle-light-natural-free.png` (capture.json band box `[540, 0, 160, 160]` in a 1240 frame).
- **Why it matters**: A view should share one alignment edge. A part that is centred among left-aligned parts breaks the scan line, and a guide (the key) belongs next to what it explains.
- **Where to fix**: `band.ts` grid rule and `placeGrid`. Start the grid at the view's inline start like its neighbours, or centre the key and legend with it. Do not mix the two.

### B2. Light-theme tints and adjacent series colours lose the boundaries in a packed part
- **Severity**: medium
- **What**: The band packs series colours edge to edge, with a 2 px gap in the bar and a 1 px hairline in the grid. In light, `series-1` (olive), `series-2` (green) and `series-3` (teal) are close in hue and lightness, so the Mobile/Tablet edge in the waffle's last row and the Direct/Social edge in the bar are carried mostly by the gap. In dark the same three colours (chartreuse, mint, teal) separate clearly. In the icon array, the unlit cells are `series-1-soft`. In light that is a bright, saturated lime that pulls the eye more than the darker lit cells do, and it reads as a second category. In dark it is a deep olive that recedes as "empty" should. The gauge the icon array falls back to draws its unfilled range in the same lime, so the problem lives in the token, not in this part alone.
- **Evidence**: `parts/band/waffle-light-natural-346.png` and `parts/band/waffle-dark-natural-346.png` (last row: green to teal); `parts/band/mix-light-natural-480.png` against `parts/band/mix-dark-natural-480.png`; `parts/band/icons-light-natural-480.png` and `parts/band/icons-dark-natural-480.png` (unlit cells); `frames/icons/light-natural-250.png` (the gauge's lime context arc).
- **Why it matters**: Part-to-whole charts depend on telling neighbouring categories apart, and "not yet" should carry less weight than "done". The light theme reverses that emphasis, and the two themes do not mean the same thing by the same token.
- **Where to fix**: `packages/tokens/config/charts.tokens.json` and the base ramps. Lower the chroma of `series-*-soft` in light so a tint recedes, and widen the lightness gap between `series-1`, `series-2` and `series-3` in light. Nothing changes in `band.ts`.

### B3. The grid gives way at 280 px though it needs 170
- **Severity**: low
- **What**: The `unit` and `unit-alone` rules for `band` need 280 px across, the same figure as the stack and the run. The grid is a 160 px square (built down to `GRID_LEAST` = 100), and the full legend under it needs 170 px. At 250 px both the waffle and the icon array would fit whole, but they have already become the share bar and the gauge.
- **Evidence**: `sheets/band/light-natural-1.png` and `sheets/band/dark-natural-1.png` (the icons and waffle cells are empty from 250 down); `frames/waffle/light-natural-250.png` (share bar plus full legend, at a width where the 160 px grid would fit); capture.json, waffle and icons at 250 (no band part measured).
- **Why it matters**: A fallback should come when the form stops working, not at a threshold borrowed from other forms. Swapping early costs the reader the counted view in common half-width dashboard tiles.
- **Where to fix**: The `unit` / `unit-alone` band rules in `packages/core/src/fit.ts`. Derive the inline need from the grid and its legend (about 170) rather than 280.

### B4. Small shares turn into slivers before the bar steps down
- **Severity**: low
- **What**: The segments are flex items with a fixed 2 px gap and a bar radius on every corner. At 120–170 px, a 3 % share is about 2–3 px, so its rounding turns it into a thin line, and a 6 % share is barely a block. The gaps (5 × 2 px) take about 8 % of a 120 px bar. The shares stay proportional, but the smallest one is effectively invisible, and the one-line legend at that width names only the largest.
- **Evidence**: `parts/band/mix-light-natural-120.png` (the "Other" segment is a hairline), `parts/band/mix-dark-100-120.png`, `parts/band/mix-dark-natural-170.png`.
- **Why it matters**: A segment too thin to see or hit is present in the data and missing from the reading. A pointer or touch target narrower than a few pixels cannot be used.
- **Where to fix**: `band.ts` segment rule. Square off a segment's corners, or drop its radius, once it is narrower than about twice the radius. Optionally give the hit target a minimum size larger than the paint.

## Situational issues
### S1. The icon array does not show the target that the number states
- **Severity**: medium
- **Composition**: `icon-array` (a grid with no dimension) on a metric whose catalog has a `target`.
- **What**: The number reads "303 / Target 400", and the grid lights 61 of 100 cells, but no cell, edge or rule marks the 80th cell. The gauge that the same view becomes at narrower widths and in a 100 px box draws the target as a tick. The grid is meant to read like a gauge, so the reference disappears in the wider form only.
- **Evidence**: `frames/icons/light-natural-480.png` and `frames/icons/dark-natural-346.png` (no target in the grid); `frames/icons/light-100-480.png` (the gauge with its target tick).
- **Why it matters**: A reference (role `reference`) is part of the reading. The same query should not lose it when there is more room.
- **Where to fix**: `sceneGrid` in `packages/core/src/scene.ts` and the band painter. Mark the target cell, or rule the boundary at the target's place, with the reference paint the gauge uses.

### S2. The fallback forms are not seen by the capture as this part
- **Severity**: low
- **Composition**: `waffle` and `icons` below 280 px or in a 100 px box, where the view has become `share-bar` or `gauge`.
- **What**: In these frames capture.json records `parts: {}`. The share bar the waffle becomes is drawn by this part, but it is neither measured nor checked. In `frames/waffle/light-100-480.png` it shows the one-line legend under a three-segment bar.
- **Evidence**: capture.json, waffle `100` at every width and waffle `natural` at 250 and below; `frames/waffle/light-100-170.png`.
- **Why it matters**: The checker cannot hold the fallbacks to the fit rules, so a regression in them would go unseen.
- **Where to fix**: `apps/bench/capture.ts` / `measure`. Measure the parts of the preset a view has fallen back to.

## Works well
- The share bar is 24 px at every width and in both heights, with a calm 2 px gap and a consistent radius. It is a stable anchor for the legend under it.
- The segment widths are the shares of the engine's total, taken from usable width after the gaps, so the proportions are truthful at every width.
- The step from the bar to the number at 110 px is clean, with no clipping or overlap recorded at any width.
- The grid holds its square, uses reading-order fill, and keeps a hairline between cells. Counts are exact (52/41/7, and 61 lit for 303 of 500). Lit-versus-unlit contrast in dark is excellent.
- The fallbacks chosen (a share bar for a waffle, a gauge for an icon array) keep the same reading of the same query.

## Open questions
- At 80 px the number that replaces the bar is clipped by 40 px (capture.json, mix at 80). Is that the number's fit or the band's `marks` threshold, which might need to sit higher for a long tldr value?
- When the waffle becomes the share bar at 250 px, the view's height drops from about 240 to about 100. Is that jump acceptable in a dashboard grid, or should a container that has room for the grid's height keep it?
- Should a wide segment (Search is about 190 px at 480) carry its own label, so that colour is not the only link to the legend?
