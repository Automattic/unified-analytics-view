# ramp

Source: `packages/dom/src/chrome/ramp.ts`, `packages/dom/src/chrome/swatch.ts` (the `cell` swatch), the `color-seq-*` / `color-div-*` names in `packages/dom/src/tokens.ts` (`NAMED`), `packages/tokens/config/sequential.json` and `charts.tokens.json`, and the `ramp` fit rule in `packages/core/src/fit.ts`. Seen in 11 samples across matrix (adjacency, bins2d, calendar, circles, correlogram, heatmap, stripes), geo (map, unmapped), geo-hexes (hexes) and geo-tiles (tiles). No treemap painted by a metric is in the capture.

## Summary
The ramp is quiet, consistent and well built: one line, least on the reading-start side, swatches the same shape as the cells they key, a neutral swatch for zero and one for no value, and the same look in every layout. Its main problems are in when and how it leaves: its fit rule asks for a fixed 240 px whatever the ramp holds, so the heatmap's ramp is cut mid-word at 250 px, and below 240 px or 150 px tall the grid stays while its only key goes, leaving colour that cannot be read. The palette has two colour problems: in dark the least step is close to the no-data grey, and in light the least step is the loudest colour on the page.

## Base issues

### B1. The fit rule's width doesn't depend on what the ramp holds, and overflow is cut, not stepped down
- **Severity**: medium
- **What**: The matrix rule hides the ramp below a fixed `needs: { inline: 240 }`, but how wide the ramp is depends on its end labels and on whether it has a "No data" entry. The heatmap's ramp (`10`, ten swatches, `158`, the none swatch and "No data") is about 270 px wide, so at 250 px the rule keeps it and `overflow: hidden; white-space: nowrap` cuts "No data" to "No da", partly under the edge, with no ellipsis. The checker reports this as 19 px clipped. Longer end labels (`1,234,567`, `-1.2M`) or a diverging ramp with a none entry would be cut at even wider widths.
- **Evidence**: `parts/ramp/heatmap-light-natural-250.png`, `parts/ramp/heatmap-dark-natural-250.png`; `sheets/ramp/light-natural-1.png` and `dark-natural-1.png`, heatmap row, 250 column; `check.md` "cut": ramp 19 px.
- **Why it matters**: A key cut part way through a word looks broken, and the part of a key most likely to be lost (the no-data entry) is the one that stops a reader taking grey for a low value.
- **Where to fix**: In `measure.ts` (or the ramp's rule in `fit.ts`), use the ramp's measured width instead of a constant. Step down in order: drop the "No data" words and keep its swatch, then narrow the swatches, before the ramp is hidden.

### B2. The grid keeps its colour after its key is gone
- **Severity**: high
- **What**: In matrix, the ramp is the first part to go: below 240 px wide (rule `keep: guides`), and at every width in a 100 px tall box because of the rule's `block: 150`. The grid of coloured cells stays with no ramp until 150 px wide. At 170 px natural and at every width at 100 tall, every matrix sample shows cells coloured by a value with nothing that says what the colours mean. The diverging samples (circles, correlogram, stripes) are worst: without the key, a reader cannot tell which hue is the positive one.
- **Evidence**: `frames/heatmap/light-natural-170.png` (full grid, no key); `capture.json` shows ramp absent for adjacency, bins2d, calendar, circles, correlogram, heatmap and stripes at height 100 × 480/346/250/170, while `plot` is present; `sheets/ramp/*-natural-*.png`, 170 column empty for every matrix row.
- **Why it matters**: Encoding needs a key. A colour scale with no key only gives a reader "darker means something", and for a diverging scale it doesn't give that.
- **Where to fix**: In the matrix ramp rule in `fit.ts`, keep the ramp at small sizes in a compact form: the two end labels with three swatches, or the end swatches only. A 24 px line costs less height than the 150 px block need suggests. Or, if a reduced ramp isn't possible, hide the grid's colour at the same step as the ramp.

### B3. In dark, the least sequential step is hard to tell from the no-data grey
- **Severity**: medium
- **What**: In dark, `seq-1` is `#3c3764` (desaturated indigo) and `seq-none` is `neutral-500`, a warm dark grey. Both are dark, low-chroma fills, close in lightness. On the map, Mexico, Nigeria and South Africa (the least bin) are hard to pick out from the grey countries around them, and in the ramp the first swatch and the none swatch look like near neighbours.
- **Evidence**: `frames/map/dark-natural-346.png`; `parts/ramp/map-dark-natural-480.png`; `parts/ramp/hexes-dark-natural-480.png`. Light does not have this problem (`parts/ramp/tiles-light-natural-480.png`: chartreuse against pale grey).
- **Why it matters**: "No value" and "least value" mean different things. A choropleth that blurs them under-reports where data exists.
- **Where to fix**: `seq-none` in the dark common tier (`config/common.dark`), or the dark end of `sequential.json`. Make no-data clearly different from step 1 in lightness, or mark it with a pattern or outline instead of a fill close to step 1.

### B4. In light, the least step is the loudest colour
- **Severity**: medium
- **What**: The sequential ramp goes in lightness from chartreuse `#cbed00` (least) to indigo (most), which is correct. But the light end is also its most saturated colour. On a light page, the cells and countries with the least value come forward as much as, or more than, the ones with the most. In adjacency most cells are in the least bin and the plot reads as a field of yellow-green. On the map, Mexico, Spain and South Africa stand out like the US does.
- **Evidence**: `frames/adjacency/light-natural-480.png`; `frames/map/light-natural-free.png`; `frames/heatmap/light-natural-250.png` (the night hours are the brightest part).
- **Why it matters**: Salience should follow magnitude. In a sequential scale, the end near the page should step back, through lower chroma and lightness close to the background, so the eye goes to the high values.
- **Where to fix**: `packages/tokens/config/sequential.json`: lower the chroma of steps 1 to 3 (a paler, less saturated yellow-green) and keep the hue path and the lightness order.

### B5. The diverging ramp's "0" label is ambiguous, and its first positive step is its most vivid
- **Severity**: low
- **What**: The zero label comes after the neutral swatch, so `▮ 0 ▮▮▮▮` reads as the label of the first positive step as easily as of the neutral one. In light, the positive arm starts at a saturated orange (`div-6`) and darkens to brown, so the smallest positive values are the most vivid. The negative arm's lightest blue is calmer.
- **Evidence**: `parts/ramp/circles-light-natural-480.png`; `frames/stripes/light-natural-480.png` (small positive days stand out more than large ones); same layout in `parts/ramp/correlogram-*`.
- **Why it matters**: A diverging key has to make its midpoint clear. And as in B4, the vivid colour should go with the larger magnitude.
- **Where to fix**: In `ramp.ts`, put the zero label under the neutral swatch, or on both sides of it, or close the gap so the swatch and label read as a pair. In the diverging ramp config, give the two arms matching chroma, lowest next to zero.

### B6. Only the ends are labelled
- **Severity**: low
- **What**: The ramp has ten (or 4 + 1 + 4) discrete steps, but only the least and the most have labels. A reader cannot tell what a middle cell is worth, or whether the steps are equal in value or in quantile. In adjacency, most cells are in the bottom step, which suggests the steps are linear over skewed data.
- **Evidence**: `parts/ramp/adjacency-light-natural-480.png`; `frames/adjacency/light-natural-480.png`.
- **Why it matters**: A quantized scale is a set of bins. Without the bin edges, readers estimate in their heads and get it wrong.
- **Where to fix**: In `ramp.ts` (with the scene builder that makes the `ramp` nodes), add a midpoint label at wide sizes, or a label at every other boundary. The step-down order in B1 decides when these go.

## Situational issues

### S1. Heatmap at 250 px: "No data" cut
- **Severity**: medium
- **Composition**: matrix with a no-data entry (heatmap). It's the only matrix sample with missing cells, so it's the only one wider than 240 px.
- **What**: This is B1 seen in this sample: "No data" is clipped at 250 px in both themes.
- **Evidence**: `parts/ramp/heatmap-light-natural-250.png`, `parts/ramp/heatmap-dark-natural-250.png`.
- **Why it matters**: The checker's only ramp finding. It will show up for any grid that has gaps.
- **Where to fix**: Fixed by B1. Until then, the matrix rule could ask for more room when the scene has a `ramp:none` node.

### S2. The ramp is pinned to the view's left edge, away from a centred map
- **Severity**: low
- **Composition**: geo, geo-hexes and geo-tiles at widths where the map is narrower than the view and is centred (`free`: plot at x 380 to 860, ramp at x 0).
- **What**: The key sits at the far left, about 380 px from the land it describes, so it reads as page furniture rather than this map's key. In matrix the ramp also starts at x 0, not at the plot's edge. That's acceptable there, because the y-axis labels share the same left edge.
- **Evidence**: `frames/map/light-natural-free.png`; `capture.json` map/hexes/tiles/unmapped natural×free (`plot [380, 0, 480, …]`, `ramp [0, …]`).
- **Why it matters**: Proximity: a key should be near the marks it keys.
- **Where to fix**: In the geo painters' layout (`packages/geo`, the grid area they give the ramp): align the ramp with the map's box, or centre it under the map when the map is centred.

### S3. On maps, the ramp leaves with the map, not before it
- **Severity**: low
- **Composition**: geo, geo-hexes and geo-tiles at 250 px and below.
- **What**: The ramp and the plot disappear at the same step, so there's no stage where the map shows without its key. That's correct. It's the opposite of matrix (B2) and shows the order matrix should follow. Recorded here so the two layouts get the same order.
- **Evidence**: `capture.json` map/hexes/tiles natural×250: `plot` and `ramp` both absent; `sheets/ramp/light-natural-1.png`, 250 column empty for the geo rows.
- **Why it matters**: Consistency of fallback across layouts.
- **Where to fix**: No change for geo. Use it as the model for B2.

## Works well
- The same line in every layout and sample: least label, steps, most label, none. The swatches use the cell swatch (14 × 10, cell radius), so the key looks like the marks it keys.
- The sequential ramp goes monotonically in lightness, and flips per theme so the end nearest the page is the least value in both themes.
- In diverging ramps, the neutral swatch for zero stands slightly apart from the arms, and the arms are clearly different hues (blue and orange, which colour-blind readers can tell apart).
- The ramp is quiet: small tabular numerals, muted text, no frame. It sits below the axis without competing with the plot.
- The labels use tabular figures, the reading direction comes from `pageWay`, and the ramp is `aria-hidden` because each mark's own name already gives its value.

## Open questions
- Because the ramp flips per theme, the same value is a different hue in light and dark (the most is indigo in light and chartreuse in dark). That keeps "more = further from the page", but readers who move between themes, or compare screenshots, have to relearn the key. Intended? Or should hue stay fixed while lightness flips (a ramp that goes through a different hue path in dark)?
- Should the ramp's steps be equal-value or quantile? The capture can't show which the engine uses. In adjacency, most cells are in the bottom bin, which suggests equal-value over skewed data.
- No treemap painted by a metric appears in the capture, so the ramp under `partition` is not audited.
