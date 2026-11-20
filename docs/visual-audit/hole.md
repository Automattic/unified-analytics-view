# hole

Source: `packages/dom/src/layouts/radial.ts` (`.uav-hole`, the painter's `hole` node), `packages/dom/src/dots.ts` (the screen, `CELL`, the unlit field), `packages/core/src/fit.ts` (the `hole` rule: 120 px inline of the plot). Seen in 3 samples (donut, gauge, half) across the radial layout only.

Capture: `apps/bench/captures/2026-11-20T20-50-34-247Z/`; paths below are relative to it.

## Summary
The part reads clearly where the number is short (`303` in the gauge) and the ring is at its full 160 px, but it does not fit the hole it is named for. The dot-matrix cell is fixed at 4 px and the rule's threshold is fixed at 120 px of plot, so the number never gets smaller as the circle does, and the rule takes no account of how many characters there are. A five-character total (`10.5k`, `25.1k`) is already as wide as the hole at 160 px and runs across the ring at 120 px. That breaks the part's one promise, and in dark at 120 px it makes digits disappear into a segment of the same colour.

## Base issues

### B1. The number is wider than the hole, and the rule does not know it
- **Severity**: high
- **What**: The glyphs are a fixed 4 px cell, so a five-character value is about 100 px wide however big the circle is. At a 160 px plot the donut's hole is about 98 px across, so `10.5k` touches the ring on both sides. At 120 px the hole is about 73 px across and the number spills about 14 px into the ring on each side. The `hole` rule asks only for 120 px of plot. It ignores the length of the string, and the stylesheet cannot shrink the glyphs: the `clamp(14px, 18cqi, …)` font size on `.uav-hole.uav-f-display` has no effect on a screen whose size is set by `--uav-u`.
- **Evidence**: `parts/hole/donut-light-natural-120.png` (both the `1` and the `k` sit on the ring); `parts/hole/donut-dark-natural-480.png` (at full size the `1` and the `k` touch the inner edge); `sheets/hole/light-natural-1.png`, the donut and half rows at 120 px; `parts/hole/half-light-natural-170.png` (the `k` runs into the teal segment). The gauge's `303`, at about 68 px, fits at every width: `parts/hole/gauge-light-natural-480.png`.
- **Why it matters**: A label set over a mark has to stay inside the space it claims. When the total crosses arc boundaries, the reader cannot cleanly see the arcs or the number. This is also the case agents will hit first: a total rendered with a `k` suffix is the common one.
- **Where to fix**: The `hole` rule in `fit.ts`, together with the measured pass: make the decision depend on the number's width against the hole's inner diameter (about 0.6 × the plot), not on a fixed 120 px. Alternatively, give the hole a smaller cell, so that at 160 px the number fits inside the inner radius with at least one cell of clearance.

### B2. The unlit field paints over the ring
- **Severity**: medium
- **What**: The hole's screen is only as wide as its number, and its unlit cells (9% of the label colour) form a rectangular slab. When the number overruns (B1), the slab lies over the arcs. In light it shows as a dirty grey patch across the segments. In dark it shows as a darkened band over the ring.
- **Evidence**: `parts/hole/half-dark-100-120.png` (dark cells across the lime and green arcs); `parts/hole/donut-light-natural-120.png` (grey band across both green segments); `frames/half/light-natural-480.png` (the field's corner sits over the teal segment).
- **Why it matters**: Marks should not be tinted by chrome. A grey band over an arc changes how that arc's colour reads, and the band's rectangle cuts across a circular figure.
- **Where to fix**: `dots.ts`, `.uav-hole .uav-glyphs`: clip the hole's screen to the hole (a circular clip at the inner radius), or drop the unlit field in the hole. Fixing B1 removes most of this.

### B3. In dark, the number takes the colour of a category
- **Severity**: medium
- **What**: The number is drawn in `color-label-screen`. In dark that is the same lime as the first categorical colour. The donut's and half's total therefore reads as the value of the Desktop segment, and where the two overlap the lit cells vanish: the `2` of `25.1k` is lost against the lime arc. In light the label is a neutral near-black, so the problem appears in dark only.
- **Evidence**: `frames/donut/dark-natural-480.png` (lime `10.5k` beside a lime Desktop arc); `parts/hole/half-dark-100-120.png` (the `2` is unreadable on the lime arc); `sheets/hole/dark-100-1.png`, the half row.
- **Why it matters**: Colour encodes category in this view. Text set in a category's colour claims to belong to that category, and a value with no contrast against its neighbour is unreadable. Light and dark should not say different things.
- **Where to fix**: In the tokens (charts tier), keep `color-label-screen` in dark clear of the categorical ramp's first hue, or have the hole use the neutral label colour. The source comment says the hole is painted with `--uav-paint`, but the glyphs override it with `color-label-screen`. Settle which one is intended.

### B4. The number has no caption
- **Severity**: low
- **What**: The hole shows `10.5k` or `25.1k` with no word for what is being counted. The legend under it gives percentages, so the reader must infer that the hole is the sum of the 100%.
- **Evidence**: `frames/donut/dark-natural-480.png`; `frames/half/light-natural-480.png`.
- **Why it matters**: A total without a unit is easy to misread, especially beside percentages.
- **Where to fix**: Composition: let the view's tldr or a title carry the metric's name. Do not add it to the hole, which has no room for words.

### B5. The stylesheet comment and rule describe a size that does not exist
- **Severity**: low
- **What**: `radial.ts` says the number is "smaller with the circle" and sets a `clamp()` font size, but the dot screen's size comes from `CELL`. The rule is dead, and the comment tells the next reader the opposite of what happens.
- **Evidence**: The number is the same pixel size from 480 to 120 px on every sheet in `sheets/hole/`.
- **Where to fix**: `radial.ts`: remove the dead rule or make it real, as part of B1.

## Situational issues

### S1. A donut in a short box loses its total, and nothing replaces it
- **Severity**: medium
- **Composition**: A full circle (donut) in a 100 px tall box. In that box the circle is about 75 px, below the rule's 120 px, so the plan still lists `hole` but the number is hidden. The legend collapses to one line (`Desktop 52%`), so the view shows neither the total nor a reason for its absence. The half and gauge keep their number at 100 px because a half circle is twice as wide as it is tall.
- **Evidence**: `frames/donut/light-100-480.png` (no number at any width); there is no donut row in `sheets/hole/light-100-1.png`; `frames/donut/dark-natural-80.png` shows the same at 80 px.
- **Why it matters**: The total is the view's one number. Dropping it while keeping a single segment's share inverts the hierarchy.
- **Where to fix**: The radial fit rules: when `hole` drops, hand the number to the view's own number part, as the band's `legend` rule does (`else number shows`), instead of letting it go with nothing in its place.

### S2. On a half circle, the number sits on the diameter and runs into the outer segments
- **Severity**: low
- **Composition**: Half circle (`place-items: end center`) with a five-character value. The number's foot is on the diameter, where the hole is widest, but the right-hand segment is small (Tablet 7%) and its arc meets the baseline right where the `k` sits.
- **Evidence**: `parts/hole/half-light-natural-170.png`; `frames/half/light-natural-480.png`.
- **Where to fix**: Follows B1. When the number fits the inner diameter with a cell of clearance, this goes away.

## Works well
- The gauge's `303` sits well at the foot of the arc from 480 px to 120 px in both themes, with clear space above it: `parts/hole/gauge-light-natural-480.png`.
- On the donut the number is centred optically as well as by its box.
- Steps down cleanly: the number is present or absent, never cut short or truncated with an ellipsis. It goes before the ring does, so the ring is never left without room.
- In light, near-black dots on the paper background read crisply, and the dot face links the hole's number to the legend's percentages.

## Open questions
- The checker reports `clipped: 4` for every hole frame (60 of 60). The pictures show no lost cells, so this may be the unlit field's last row, cut by `.uav-hole { overflow: hidden }`, rather than lost glyphs. It needs a look at the measured element before it is either fixed or exempted in `check.ts`.
- Should a gauge's number be coloured like its value arc (lime in dark), as it now happens to be? For a gauge that is arguably right, unlike for a donut's total. B3's fix should decide this case on purpose.
