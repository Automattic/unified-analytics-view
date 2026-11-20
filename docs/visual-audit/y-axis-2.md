# y-axis-2

Source: `packages/dom/src/chrome/axes.ts` (`AXES_CSS`, `paintAxes(…, far)`), `packages/dom/src/layouts/cartesian.ts` (grid area `y2`, the `axes` and `y-ticks` fit overrides), `packages/core/src/scene.ts` (the second scale's ticks, about line 491), `packages/core/src/place.ts` (the 30 px gutter), fit rule `axis-2` in `packages/core/src/fit.ts`. Seen in 2 samples (`dual`, `pareto`), both in the cartesian layout, at natural height only, at 480, 346 and free widths.

## Summary
As type, the axis is fine. It is the left axis mirrored: the same face, tone and tabular figures, left-aligned 6 px off the plot, and level in both themes. As a dataviz device it is weak. Nothing tells the reader which series reads against which axis. Its ticks are laid out on their own and ignore the grid, which is drawn from the first scale only. And when the `axis-2` rule drops it, the second layer stays on the plot, still drawn to a scale nobody can now read. The most important problem is that last one, together with the missing link between series and axis: both lead a reader to read one metric against the other metric's numbers.

## Base issues

### B1. Nothing ties the axis to its series
- **Severity**: high
- **What**: The far axis's labels use the same neutral `color-label-axis` as the near axis. Neither axis has a unit caption, a metric name or a swatch, and layers that differ by metric get no legend (the reference, section on several metrics, calls this a known gap). The reader has to guess the pairing: the bars go with the left axis and the line with the right. Only two cues help. One is the mark type. The other is a unit symbol in the tick text: "$" in `dual`, "%" in `pareto`. The left axis's plain counts (`0…600`, `0…500`) carry no unit at all. The two series colours sit close in hue: green bars and a teal line in light, lime and mint in dark. Colour is therefore not a usable link either, and the axis does not use colour anyway.
- **Evidence**: `frames/dual/light-natural-480.png`, `frames/dual/dark-natural-346.png`, `frames/pareto/light-natural-480.png`, `frames/pareto/dark-natural-346.png`. Sheets: `sheets/y-axis-2/light-natural-1.png` and `dark-natural-1.png`.
- **Why it matters**: A dual-axis chart is only honest when the mapping from series to axis is explicit. If it is not, readers read the line against the left scale (or the bars against the right) and get numbers that are off by the ratio of the two scales.
- **Where to fix**: In core's scene, give the `y-axis-2` tick nodes, or one caption node at the axis's head, the second layer's paint token and metric name, and paint it in `chrome/axes.ts`. Give the first axis the same treatment, so each axis carries a small swatch or tint of its series. The overdue metric legend from the reference would also settle it.

### B2. The far axis's ticks do not fall on the grid
- **Severity**: medium
- **What**: The grid is drawn from the first scale alone ("The grid is the first scale's alone", `scene.ts`). The second scale gets its own nice ticks with no attempt to share the first scale's divisions. In `dual` the left axis has 4 intervals (0/200/400/600) and the right has 4 at other heights ($0…$4k). Every right label except the two ends floats between gridlines with no line of its own. `$1k`, `$2k` and `$3k` land at about 25%, 50% and 75% of the plot height, where there are no gridlines; the gridlines are at 33% and 67%.
- **Evidence**: `frames/dual/light-natural-480.png` (`$1k` at y≈252 against gridlines at 228 and 124, in 2× px), `frames/dual/dark-natural-346.png`, `parts/y-axis-2/dual-light-natural-480.png` (the small grid stubs at the crop's left edge do not line up with the labels).
- **Why it matters**: Gridlines are how a reader carries a tick value across the plot. A label without a line suggests a precision the eye cannot use. Worse, the right labels sit near the left scale's lines and invite a reading against the wrong grid.
- **Where to fix**: `core/src/scene.ts`, where the second scale is built. Choose its domain so it has the same number of nice intervals as the first and its ticks fall on the shared grid. If no nice domain does that, drop the far axis's ticks between its two ends.

### B3. Dropping the axis leaves its series on an unreadable scale
- **Severity**: high
- **What**: The `axis-2` rule (340 px) hides only `y-axis-2`. The second layer stays and is still scaled to its own domain, with only the first axis beside it. Between 280 and 340 px, the reader sees bars and a line that share one labelled axis. The natural reading is that the line's height means visitors or errors, but it means revenue or share. (The capture's widths go from 346 straight to 250, so this band is not pictured. This is read from the rule and the source, not from a frame.) Below 280 the `axes` rule shows the number. The bare plot keeps both layers, still on their unrelated scales: `frames/dual/light-natural-250.png` shows the revenue line weaving through the visitors bars beside "10.5k", which is visitors alone.
- **Evidence**: `fit.ts` (`axis-2`: `hide: ['y-axis-2']` only); `frames/dual/light-natural-250.png`; `frames/pareto/light-natural-250.png`.
- **Why it matters**: Two independently scaled series drawn over each other with no scale for one of them make a spurious visual correlation. Crossings and relative heights look meaningful when they are artefacts of the two domains. This is the classic objection to dual axes, and it is unmitigated here.
- **Where to fix**: The `axis-2` fit rule. When it hides `y-axis-2`, it should also hide the layer that reads against it, or demote it to the `secondary`/context treatment (for example, a role of its own that the rule can name). The `axes` rule should do the same for the bare sparkline.

### B4. The axis box does not contain its own end labels
- **Severity**: low
- **What**: Labels are centred on their tick (`translate: 0 -50%`). The top label (`$4k`, `100%`) therefore rises about half a line above the part's measured box, into the 10 px of padding above the plot. The bottom label sinks the same distance into the x axis's row. The checker reports 0 clipping, but the part crop cuts the top label in half.
- **Evidence**: `parts/y-axis-2/dual-light-natural-480.png` (`$4k` cut at the top), `parts/y-axis-2/pareto-light-natural-480.png`. `capture.json` box `[456, 10, 24, 157]`.
- **Why it matters**: The output looks fine today because `PLOT_TOP` absorbs the overflow. It matters for composition: a view stacked tight under another, or a future part above the plot, would collide with the label, and the measured pass cannot see it. The same applies to the left axis.
- **Where to fix**: `chrome/axes.ts` / `cartesian.ts`. Let the axis box take the half line above and below (or have `measure` report the overflow), so the box tells the truth about the ink.

## Situational issues

### S1. Pareto: the grids line up by chance, and the alignment implies 100% = 500
- **Severity**: medium
- **Composition**: The `pareto` sample: bars of counts with a cumulative-share line on the far axis.
- **What**: Both scales happen to get five intervals (0–500, 0–100%), so the far ticks sit exactly on the grid. That is good to look at, and the opposite of B2. But a Pareto chart's convention is that 100% on the right sits level with the total on the left. Here the bars sum to about 1,080 while the left axis tops out at 500. The perfect alignment invites the reading "100% = 500 errors", which is false.
- **Evidence**: `frames/pareto/light-natural-480.png`, `frames/pareto/dark-natural-346.png`.
- **Why it matters**: Aligned gridlines across two axes read as an equivalence. When the equivalence is not real, alignment misleads more than misalignment would.
- **Where to fix**: A Pareto preset, not this part. Either set the right axis so 100% corresponds to the engine's total on the left scale (left domain = total), or keep the axes visibly unaligned. Either way, the general fix in B2 must not turn coincidental alignment into a claim.

### S2. Neighbouring series colours too close to carry the pairing
- **Severity**: low
- **Composition**: Bar plus line where the line takes `series.2` (both samples).
- **What**: `series.1` and `series.2` are adjacent greens: a green bar against a teal line in light, lime against mint in dark. The line is a thin stroke over solid bars. If B1 is fixed by tinting the axes, the two tints will be hard to tell apart in small type.
- **Evidence**: `frames/dual/light-natural-480.png`, `frames/dual/dark-natural-346.png`.
- **Why it matters**: The link from colour to axis only works if the two colours separate clearly at label size and for colour-deficient readers.
- **Where to fix**: The samples (or a dual-axis preset) should choose a paint for the second layer that is further around the categorical ramp. Any colour link from B1 should be paired with a non-colour cue such as the metric name or a mark glyph.

## Works well
- Typographic parity with the near axis: the same face, size, tone and tabular figures, mirrored alignment (left-aligned, 6 px off the plot), and good contrast in both themes.
- Unit-bearing tick text (`$1k`, `80%`) is short and well formatted, and the column is sized by its widest label (24 px for `$4k`, 30 px for `100%`).
- The step order is sensible: the far axis goes at 340 px, before the near axis and grid go at 280 px. The `axes` override hides it in short boxes too, so it never stands without a plot. The `y-ticks` rule thins it the same way as the near axis.
- End labels sit exactly on the plot's top and baseline.

## Open questions
- The 280–340 px band, where only this axis is gone, has no frame in the capture. Adding a 300 px rung to the ladder would show B3 directly.
- Which layer goes to which axis: the code takes the units in layer order. Is that guaranteed to put the bar (or the first-listed layer) on the left in every preset? A reader convention (primary on the left) depends on it.
- No title or caption is rendered in these frames, although the specs have `title`s. If the title is shown in a real container, does it name both metrics? "Visitors and revenue" helps B1 only if the order in the title matches left and right.
