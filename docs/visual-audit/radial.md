# radial

Source: `packages/dom/src/layouts/radial.ts` (with `placeRadial` in `packages/core/src/place.ts`, the `radial` rules in `packages/core/src/fit.ts`, the gauge, donut, rose, radial-bar, sunburst and parliament presets in `packages/core/src/presets.ts`). Seen in 8 samples (donut, gauge, half, parliament, pie, rings, rose, sunburst), all in the `radial` layout.

Capture: `apps/bench/captures/2026-11-20T20-50-34-247Z/`. Paths below are relative to it.

## Summary
The arcs themselves are well drawn: clean background-coloured separators, round joins, area-true rose petals, consistent 12 o'clock clockwise ordering, and a circle that holds its shape and steps down to the number by a sensible rule. The most important problem is the number in the hole: the dot-matrix face has a fixed 4 px cell, so it never shrinks with the circle, and the DOM's `hole` rule checks only the plot's width, not whether the number fits the hole. The result is a number wider than the hole that lays its grey panel of unlit cells across the ring in every donut, half donut and gauge from 120 to 480 px, and is the 4 px clip the checker reports. Second in weight: the `-soft` context paint (gauge range, radial-bar tracks) behaves very differently in the two themes.

## Base issues

### B1. The number in the hole is wider than the hole
- **Severity**: high
- **What**: "10.5k" is about 116 px wide (`displayWidth` = (5 × 6 − 1) × 4), but a 160 px donut with `radius: 0.6` has a hole of about 96 px, and a 120 px one about 72 px. The number runs across the inner edge of the ring on both sides, and the pale rectangle of unlit dot cells is painted over the arcs. In the half donut and gauge it is set at the foot, where it crosses both ends of the arc, and in the half it covers the small Tablet segment completely. `.uav-hole.uav-f-display`'s `clamp(14px, 18cqi, …)` does nothing here, because the dot face's cell is fixed at 4 px whatever the font size is. The pixel painter does the right check (`placeRadial` drops the number unless `hypot(wide/2, tall) ≤ r0·D/2`), but the DOM does not: its `hole` rule (`needs: { inline: 120 }` of the plot) never looks at the number's length or the hole's radius.
- **Evidence**: `parts/radial/donut-light-natural-120.png` (the number spans nearly the whole circle, through both sides of the ring); `parts/radial/donut-dark-natural-250.png`; `parts/radial/half-light-natural-480.png` (the number covers the Tablet arc and both arc ends); `frames/half/dark-natural-120.png`; `frames/parliament/light-100-480.png` (the half-donut fallback shows the same overlap).
- **Why it matters**: the headline sits on top of the data it summarises, which hides segment boundaries and, in the half donut, a whole category. A grey rectangle across a ring reads as a rendering fault. In the DOM, the measured number ignores the very geometry the core already checks.
- **Where to fix**: the `hole` rule and `radial.ts`: make the DOM's decision the same as `placeRadial`'s (number width against `r0 × plot width`, as a measured-pass check or a rule that knows the text length), and drop the number to `number` beside or below the chart when it does not fit, rather than relying on a font clamp the dot face ignores.

### B2. The hole's number is clipped by 4 px
- **Severity**: medium
- **What**: wherever the hole shows, both `radial` and `hole` report `clipped: 4`: 60 frames in donut, gauge and half, at every width from 120 to 480 and in both themes. `.uav-hole` has `overflow: hidden` and `inset: 0`, and the dot face's box (line-height 0.92, 7 rows of 4 px) is taller than its line. In the half and gauge, with `place-items: end center`, the bottom row of dots sits on the part's lower edge and is cut.
- **Evidence**: `parts/radial/gauge-dark-natural-480.png` and `parts/radial/gauge-light-natural-480.png` (the foot row of "303" sits on the crop's edge); `parts/radial/half-light-natural-480.png`; `check.md` "clipped" section (radial: 60 in 3 samples).
- **Why it matters**: a cut glyph is a cut number. It also keeps the checker noisy for every arc view with a number in it.
- **Where to fix**: `.uav-hole` in `radial.ts`: size its line box to the dot face's real height (or let it overflow vertically and clip only at the view). Fixing B1 by dropping a number that does not fit would also remove most of these cases.

### B3. Context arcs (`-soft` paints) change role between themes
- **Severity**: medium
- **What**: arcs with `role: 'context'` (the gauge's range, radial-bar tracks) are painted from `color-series-N-soft`, which aliases the `qual-*-100` steps. In light these are pastels as loud as the data: the gauge's lime range competes with its dark green value. In dark the same steps come out at uneven lightness. The gauge's range is a near-black olive and almost invisible. On the rings, the AI assistants track is a saturated indigo, brighter than its slate value arc. The Social and Direct tracks are near-black, and the Email and Other tracks are a deep maroon that reads as data.
- **Evidence**: `parts/radial/gauge-light-natural-480.png` against `parts/radial/gauge-dark-natural-480.png`; `parts/radial/rings-dark-natural-480.png` against `frames/rings/light-natural-480.png`; `sheets/radial/dark-100-1.png`, gauge and rings rows.
- **Why it matters**: a track or range has to sit clearly behind its value in both themes. In dark, the range a gauge reads against disappears, so the value has no visible scale. Where a track is brighter than its value, the track is read as the bar.
- **Where to fix**: the charts tier's `color-series-*-soft` (and the `qual-*-100` dark steps they alias): pick dark soft steps of even, low contrast against the background and below their series colour. Consider one neutral track paint for context arcs instead of per-hue tints.

### B4. The centred circle and its legend do not share an edge
- **Severity**: low
- **What**: the circle is capped at 160 px and centred in the view, while the legend under it runs the full width from the left edge, with its values pinned to the far right. At 480 px the swatches start 160 px left of the circle, and the values are 160 px right of it. In 100 px boxes the one-line `legend-top` ("Desktop 52%") sits at the far left under a centred 76 px circle.
- **Evidence**: `frames/donut/light-natural-480.png`; `frames/rings/light-natural-480.png`; `frames/parliament/light-natural-480.png`; `frames/donut/light-100-480.png`.
- **Why it matters**: the chart and the key that decodes it read as two unrelated blocks. In wide views the eye has to cross a lot of empty space to pair a value with its arc.
- **Where to fix**: the radial layout's body in `radial.ts` (with the legend's placement under it): constrain the legend to the circle's column, or a sensible maximum, when the circle is capped, or align both to the same start edge.

### B5. Separators eat small segments at small sizes
- **Severity**: low
- **What**: separators are `stroke-width-rule × 2`, with `vector-effect: non-scaling-stroke`, so they stay the same width as the circle shrinks. At 80 to 120 px, the sunburst's outer ring of small slices turns into a comb of background strokes with little colour, and the pie's Email and Other wedges become slivers.
- **Evidence**: `parts/radial/sunburst-light-natural-80.png`; `sheets/radial/light-natural-1.png`, sunburst and pie rows at 120 and 80; `sheets/radial/dark-100-1.png`, sunburst row.
- **Why it matters**: below a few pixels of arc, the separator is all that is left of a segment, which says "there is something here" without any colour to tell what.
- **Where to fix**: `radial.ts` arc stroke: scale the separator down with the circle below a size, or have the scene merge segments narrower than the separator into an "other" arc at small sizes.

## Situational issues

### S1. A gauge without its number says nothing quantitative
- **Severity**: medium
- **Composition**: the gauge preset (no dimension, arcs against the catalog domain) at widths where `hole` drops, and at every width for scale.
- **What**: at 80 px the number is gone and the gauge is a bare arc with no value, no end labels and no legend content. At every width there are no minimum or maximum labels, so "303" is never placed on a scale. The target (`role: 'reference'`) is drawn as a grey double line in a background-coloured gap, which reads as a segment break rather than a target mark.
- **Evidence**: `frames/gauge/light-natural-80.png`; `sheets/radial/light-100-1.png`, gauge at 80; `parts/radial/gauge-light-natural-480.png` (the target tick).
- **Why it matters**: a gauge's whole job is value against range. Without the number or the ends, the sweep alone cannot be read, and the target mark is not identifiable as one.
- **Where to fix**: the `radial` fit rules for a no-dimension gauge: step to the number alone (as `marks` does) when `hole` drops, rather than keeping the bare arc. Give the reference arc a distinct mark: a tick outside the ring, in ink, not a gap.

### S2. A rose with no rim labels has no orientation
- **Severity**: medium
- **Composition**: the rose preset (angle by an hour dimension) below the `rim` rule's 230 px, and in any 100 px box.
- **What**: under 230 px every hour label goes at once, leaving 24 unlabelled petals. The reader cannot tell where midnight is or which way time runs. Above 230 px the declutter leaves an uneven set (1am, 10am, 11am, 1pm, 10pm and 11pm are gone, so the gaps are irregular). The crop also cuts the left labels ("Pm" for "6pm"), but only because the rim runs outside the part's box by design; the frame is fine.
- **Evidence**: `sheets/radial/light-natural-1.png`, rose row (labels at 250, none at 170); `parts/radial/rose-light-natural-120.png`; `frames/rose/light-natural-480.png`.
- **Why it matters**: a cyclic chart without an origin and a direction cannot be read. Even a clock has its four quarters marked.
- **Where to fix**: the `rim` rule and the rim's ranks in the scene: before dropping the rim, keep a reduced set of four quarter labels (12am, 6am, 12pm, 6pm), and thin at a regular stride rather than by collision alone.

### S3. Radial-bar: the largest value closes the ring, and reads as a frame
- **Severity**: low
- **Composition**: the radial-bar preset (rings sample), where the domain's maximum is the largest row.
- **What**: Search fills the whole outer ring, so it reads as a border round the chart rather than the longest bar. The inner rings are short arcs on long tracks, and arc length at different radii overstates the outer rings (a known weakness of the form).
- **Evidence**: `frames/rings/light-natural-480.png`; `parts/radial/rings-dark-natural-480.png`.
- **Why it matters**: the leading category's mark looks like decoration, and comparisons between rings are biased by radius.
- **Where to fix**: the radial-bar preset or scene: sweep the maximum to less than a full turn (for example three quarters) so every bar has a visible end.

### S4. Short wide boxes waste the width
- **Severity**: low
- **Composition**: every radial sample in a 100 px tall box at 250 px wide and more.
- **What**: the circle shrinks to 76 px, the hole's number is dropped (the plot is under 120), and more than 300 px of width stays empty beside it. The view shows a small anonymous ring and one legend line where a number and a full legend would fit side by side.
- **Evidence**: `frames/donut/light-100-480.png`; `sheets/radial/light-100-1.png` and `sheets/radial/dark-100-1.png` (all rows at 480 and 346).
- **Why it matters**: dashboards hand out short, wide tiles. The total and the key are lost at exactly the size where they have room.
- **Where to fix**: the radial layout's `IN_BOX` arrangement in `radial.ts` and the `legend` and `hole` rules: in a wide, short box, set the legend (or the number) beside the circle instead of under it.

## Works well
- Segment separators in the background colour, two rules wide with round joins: even at every angle and correct in both themes.
- Consistent ordering: largest first, clockwise from 12 o'clock, in the pie, donut, sunburst and rings.
- Rose petals are area-true (square root of the share in `scene.ts`), so the lopsided shape honestly reflects the data.
- The part holds its aspect, and below the 72 × 64 px `marks` rule it steps to the number rather than drawing a smudge (the empty cells at 40 px).
- The parliament falls back to a half donut of the same query under 280 px, or under 160 px of height: a sensible step-down.
- Sunburst's outer ring as tints of its parent reads clearly as a hierarchy in light.

## Open questions
- The circle is capped at 160 px (240 px for seats) even at 1240 px wide and natural height. Is that deliberate, so that tiles stay consistent, or should a tall, wide view get a bigger circle?
- In the parliament's fallback frames (under 280 px wide, and every 100 px box), `capture.json` records no parts at all (`measure.parts` is empty), so the checker cannot see the fallback half donut, which has B1's overlap. Is that a capture gap, or are the fallback's parts not tagged?
- The hole's number is ink in light and lime in dark (`paint: 'ink'`, but its lit dots render lime). Is that the dot face's intended dark colour, or a theme slip?
- Whether a rose with an inner hole should scale area from the hole's edge rather than from the centre could not be settled from the pictures.
