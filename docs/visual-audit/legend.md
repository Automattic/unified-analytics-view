# legend

Source: packages/dom/src/chrome/legend.ts, packages/dom/src/chrome/swatch.ts. Seen in 19 samples across cartesian (area, bump, cumulative, grouped, marimekko, series, slopegraph, stacked, streamgraph), rows (likert, pyramid), radial (donut, half, parliament, pie, rings, sunburst) and band (mix, waffle).

## Summary
The legend is well made at the scale of an entry: a 12 px swatch that cannot be parted from its name, tabular right-aligned values, clean wrapping, and the same look in both themes. Its main problem is the list form's width: it always takes the full width of the view, so under a radial or a band the value sits at the far edge, 400 px from its name at 480 and about 1200 px away at free width. Two smaller base problems sit in its tokens and type: series 2 and 3 are close to the same green-teal in light, and the value is set in a heavier face than the name. The checker's "66 px overflow under a donut at height 100" is the intended swap to `legend-top`, not a defect. The legend is collapsed to 0 px and the one line shows in its place.

## Base issues

### B1. The list legend stretches to the full width, so each value ends up far from its name
- **Severity**: high
- **What**: `.uav-legend` is a grid of `12px minmax(0,1fr) auto` with no cap on its width. The name column absorbs all spare width and the value is pushed to the view's right edge. Under a centred circle the legend is also off-axis: it starts at the left edge while the plot is centred.
- **Evidence**: `frames/pie/light-natural-free.png` (names at x≈20, values at x≈1230); `parts/legend/donut-light-natural-480.png`; `frames/donut/dark-natural-480.png`; sheets `light-natural-1.png` / `-2.png`, rows mix, parliament, pie, rings, sunburst, waffle at 480.
- **Why it matters**: a key is read across, name then value. A long run of empty space breaks the row and invites misreading the row (Gestalt proximity). At free width the legend no longer reads as part of the chart.
- **Where to fix**: legend.ts `LEGEND_CSS`: give the list form a maximum inline size (on the order of 240–320 px, or `fit-content`). Let the layout choose where it stands: centred under a radial, aligned to the left under a band.

### B2. Series 2 and 3 are hard to tell apart as swatches in light theme
- **Severity**: medium
- **What**: in light, `series-2` (grass `#00a275`) and `series-3` (teal `#009f99`) have nearly the same lightness and about 15° of hue between them. At 12 px they read as one colour. Every three-series sample shows it: Desktop/Mobile/Tablet is green, green-teal, teal. Dark is better (`#45d289` vs `#00a09a` differ in lightness).
- **Evidence**: `parts/legend/donut-light-natural-480.png` (Mobile vs Tablet); `frames/stacked/light-natural-480.png`; sheet `light-natural-1.png`, rows grouped, marimekko, mix (Direct vs Social).
- **Why it matters**: a legend works only if each swatch can be found in the plot. Two neighbouring hues of similar lightness fail that, and fail worse for colour-vision deficiency. Nothing other than colour separates the entries.
- **Where to fix**: not legend.ts. Change the categorical order or values in `packages/tokens/config/charts.tokens.json` (series-1…6 aliases) so neighbouring series differ in lightness as well as hue. Light series 1–3 are all in the same green band.

### B3. The value is louder than the name, and in a different face from the one-line legend
- **Severity**: low
- **What**: the list's value column is set in the bold monospace tick face, near black in light and near white in dark. The name is in the regular sans face, so the number outweighs the label it belongs to. `legend-top` writes the same value in the sans face ("Desktop 52%"), so the full legend and its stand-in show one fact in two typefaces.
- **Evidence**: `parts/legend/mix-dark-natural-170.png`, `parts/legend/rings-light-natural-250.png`, beside `frames/donut/light-100-346.png` and `frames/mix/dark-100-250.png`.
- **Why it matters**: hierarchy. In a key, the name identifies and the value adds detail. Also consistency: the stand-in should read as the same element.
- **Where to fix**: legend.ts: drop the value's weight one step, or set it in the label colour at the name's weight. Use the same value face in `.uav-legend-top`.

### B4. The two forms have different spacing
- **Severity**: low
- **What**: the list form has a 10 px top margin, 8 px between swatch and name, and a 24 px row pitch. The inline form has a 6 px top margin, 6 px between swatch and name, and a 20 px row pitch with no row gap. A dashboard that places a radial beside a cartesian view shows both forms side by side, with different gaps.
- **Evidence**: `parts/legend/bump-light-natural-346.png` against `parts/legend/rings-light-natural-250.png`; sheet `light-natural-1.png`, rows area against donut.
- **Why it matters**: consistency across views composed together. The swatch-to-name gap in particular has no reason to differ.
- **Where to fix**: legend.ts `LEGEND_CSS`: one swatch-to-name gap for both forms. Keep the row pitch difference only if it is intended, and say so in the module.

## Situational issues

### S1. In a band at a short height, the legend is all or nothing
- **Severity**: medium
- **Composition**: band (mix) and radial (pie, rings) with six entries, in a 100 px box. Seen at every width from 480 down to 170.
- **What**: the full legend needs about 143 px, so the swap leaves one line ("Search 41%") and about 50 px of empty space below it. Three or four entries would fit. The one line also has no swatch, so it does not say which segment it names.
- **Evidence**: `frames/mix/dark-100-250.png`; `capture.json` mix/pie light 100×480 (`legend` box height 0, `legend-top` 24 px, 76 px of body).
- **Why it matters**: the space is there and goes unused. A view with six segments then names only one of them.
- **Where to fix**: the band and radial layouts' use of `LEGEND_SWAP` / `legendBlock`: clip the full legend to whole rows that fit, with a "+n more" line, before falling back to the one line. Give `legend-top` the swatch of its series.

### S2. An ordinal scale gets a categorical palette
- **Severity**: medium
- **Composition**: rows, likert (a diverging, ordinal scale).
- **What**: "Strongly disagree" through "Strongly agree" are green, grass, teal, steel and rose. Nothing in the colours shows order or a neutral midpoint, so the legend has to carry the whole ordering. At 170 px it wraps that order onto three lines.
- **Evidence**: `frames/likert/light-natural-480.png`; `parts/legend/likert-light-natural-170.png`.
- **Why it matters**: on a diverging ordinal scale, colour should show direction and intensity. Here the reader has to look up every segment in the key.
- **Where to fix**: the likert preset or sample: encode with the diverging ramp, not series colours. The legend itself is fine.

### S3. The legend is dropped early on cartesian bars that get no labels to replace it
- **Severity**: medium
- **Composition**: cartesian bars and rects (stacked, grouped, marimekko) below 320 px.
- **What**: the fit rule swaps the legend for `labels` below 320 px wide. A line has line-end labels to take over. Bars and a marimekko have none, so at 250 the view shows coloured bars with no key at all.
- **Evidence**: `frames/stacked/light-natural-250.png`, `frames/marimekko/light-natural-250.png`; sheet `light-natural-1.png`, rows grouped and marimekko, which are empty at 250 and 170.
- **Why it matters**: colour that encodes a category and has no key is decoration. The reader cannot tell Desktop from Mobile.
- **Where to fix**: the cartesian fit rule in `packages/core/src/fit.ts`: replace the legend with `labels` only for marks that draw labels. For bars, keep the inline legend, which already wraps to two lines, or step to `legend-top`.

### S4. A wide radial puts the legend under the circle
- **Severity**: low
- **Composition**: radial (pie, donut, sunburst, parliament) at 480 and free width.
- **What**: the circle sits centred with empty space on both sides, and the legend is stacked under it. This makes the view much taller than it needs to be.
- **Evidence**: `frames/pie/light-natural-free.png`, `frames/donut/dark-natural-480.png`.
- **Why it matters**: wasted space, and the key ends up far from the marks it names.
- **Where to fix**: the radial layout: when the view is wide enough, place the legend beside the circle (container query). Even under the circle, B1's width cap would help.

## Works well
- The inline form draws the swatch as `::before` on the name, so a wrap never leaves a swatch alone at a line's end (`parts/legend/bump-light-natural-346.png`).
- Values are tabular and right-aligned, so magnitudes line up (`parts/legend/rings-light-natural-250.png`).
- Order matches the marks: clockwise for the pie, bottom to top for the stack, left to right for the band.
- The swap to `legend-top` in a short box is clean. It drops the full legend and its margin together, and `hideCutLegends` hides the collapsed legend from assistive technology.
- Theme parity is good. Names follow the label token, and dark steel (`#3d6089`) is held at 3:1 against the surface by its token.
- The two forms match their layouts: inline under a plot, a list with values under a whole.

## Open questions
- The checker's "cut" findings on the legend at height 100 (donut, half, sunburst at about 66 px; mix, pie, rings at about 139 px) are the 0 px swap described in the summary, since `legend-top` is present in the same records. Should `check.ts` treat a part at 0 px height with its `legend-top` stand-in showing as hidden, not cut?
- For parliament and waffle at natural height, at 250 and 170, `capture.json` records no legend box, so the contact sheet is empty. The frames show a full legend (`frames/parliament/dark-natural-170.png`, `frames/waffle/light-natural-250.png`). Is the measurement missing a legend that shows, or are the frames stale?
- The bump chart keeps a legend of six URL paths down to 346 px. For a ranking chart, labels at the line ends are the usual key. Is the legend there on purpose?
