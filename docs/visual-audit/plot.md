# plot

Source: `packages/dom/src/layouts/cartesian.ts`, `layouts/matrix.ts`, `layouts/ranges.ts`, `chrome/rule.ts`, `chrome/label.ts` (paint tokens from `packages/tokens/config/*`). Seen in 51 samples across cartesian, matrix and the custom marks (geo, geo-tiles, geo-hexes, partition, link). This report judges the cartesian and matrix plots (41 samples); the custom marks are noted only where they touch the plot's contract.

## Summary
At 480 and 346 the plot is sound: a quiet 15% grid, a firmer baseline, bars that sit on it, consistent 1 px lines, and a matrix that fills its room with honest 1 px gutters. The weak points are colour and the bare sparkline. In light, the "soft" series tint and the low end of the sequential ramp are the loudest colours on the page, which reverses the hierarchy dark gets right. When the plot steps down to a sparkline beside the number, range marks (box, candlestick, OHLC) lose the parts that carry their meaning, and point marks vanish with no step in between. The most important problem is the light-theme soft tint (B1): it affects every single-series area, band and difference fill.

## Base issues

### B1. Light "soft" tint is louder than the line it supports
- **Severity**: high
- **What**: In light, `color-series-1-soft` resolves to `qual-chartreuse-100`, a saturated lime. It is brighter and more chromatic than the series line (`chartreuse-200`, olive) drawn on it. Area fills, fan bands and the density step fill therefore outshout their own line and the grid. In dark the same token is a dim olive and reads correctly as a backdrop, so the two themes rank the layers in opposite orders.
- **Evidence**: `parts/plot/fans-light-natural-480.png` (lime band, thin olive median nearly lost) against `sheets/plot/dark-natural-2.png` fan row; density in `sheets/plot/light-natural-2.png` against `dark-natural-2.png`; trend in `sheets/plot/light-natural-5.png` and `light-100-4.png`.
- **Why it matters**: A band or area under a line is context, and the line is the estimate. Inverting their weight sends the eye to the uncertainty rather than the value. Theme parity: a theme should not reorder the layers.
- **Where to fix**: the charts and common tier tokens (`*-soft` for each qualitative mark in light): use a lighter, lower-chroma step so soft sits below the line, as dark already does.

### B2. The light sequential ramp gives its most vivid colour to the lowest values
- **Severity**: high
- **What**: In light, `seq-1` is `#cbed00` (acid lime) and `seq-10` a dark indigo. The low end is the most saturated and highest-contrast-in-chroma colour on the page, so sparse matrices read as a field of lime. Adjacency is mostly lime, and the low-count cells pull focus from the few high ones. Dark flips the ramp so the lime is the high end, which reads correctly.
- **Evidence**: adjacency and bins2d in `sheets/plot/light-natural-1.png` (rows 1 and 3) against `sheets/plot/dark-100-1.png`; heatmap in `light-natural-3.png` against `frames/heatmap/dark-natural-346.png`.
- **Why it matters**: In a sequential encoding, salience should rise with value. Low values should recede towards the background. Here, in light, they advance.
- **Where to fix**: `packages/tokens/config/sequential.json` (light): start the ramp from a pale, low-chroma step near the surface and end on the dark one, keeping lightness monotonic and chroma rising with value.

### B3. A dash means four different things in the plot
- **Severity**: medium
- **What**: The same thin dash, in the same grey or series colour, is used for the partial last period of a line, a comparison or prior series (difference, trend), reference rules and the qq diagonal, and in a bare box plot for what is left of the box. One look cannot tell "incomplete data" from "the other series" from "a threshold".
- **Evidence**: `parts/plot/difference-dark-natural-480.png` (dashed prior series and dashed partial tail side by side); `sheets/plot/light-natural-5.png` trend row (dashed comparison inside the area, then a dashed partial); `parts/plot/quadrant-light-natural-480.png` (dashed reference rules); `parts/plot/box-light-natural-250.png`.
- **Why it matters**: Channel overloading. Partial-period honesty is the part's most important encoding, and it shares its look with ordinary furniture.
- **Where to fix**: in `chrome/rule.ts` and the line paint in `cartesian.ts`, give each meaning its own pattern: references a long dash in the label colour, comparisons a dotted or lighter series, the partial period the series' own dash. Name them in tokens.

### B4. The partial period is treated differently by each mark
- **Severity**: medium
- **What**: Lines continue dashed. Bars and stacked areas fade to a pale tint. Single-series areas (trend, density) and fan bands simply stop at the last whole period with a hard vertical edge, and only their line goes on dashed. The stacked-area fade also ends in a hard vertical seam.
- **Evidence**: `parts/plot/area-light-natural-480.png` (faded wedge with a seam); `parts/plot/fans-light-natural-480.png` (band stops while the median goes on dashed); trend in `sheets/plot/light-natural-5.png`; stacked and dual bars in `light-natural-4.png` and `light-natural-2.png`.
- **Why it matters**: The same fact ("this period isn't over") should look the same in every mark, or the reader learns it once per chart.
- **Where to fix**: `cartesian.ts`, where the partial segment is painted. Choose one rule for every fill: the soft tint carried on through the partial segment, under the dashed line where there is one.

### B5. Range marks lose their meaning as a sparkline
- **Severity**: medium
- **What**: In the bare plot beside the number, box keeps only its medians, which read as a dashed line. Candlestick keeps bodies without wicks, and OHLC turns into a dark scribble at 170. What remains is not a smaller box plot or candlestick chart but a different and misleading picture.
- **Evidence**: `frames/box/light-natural-250.png`; `parts/plot/box-light-natural-250.png`; `frames/candlestick/light-natural-250.png`; ohlc at 170 in `sheets/plot/light-natural-3.png` and `light-100-3.png`.
- **Why it matters**: A reduced view must stay true to the encoding or step down to a simpler one (one line of the median or close). Half a glyph is worse than either.
- **Where to fix**: `layouts/ranges.ts` and the bare branch in `cartesian.ts`. When bare, paint a range mark's centre as a line (median or close), or let the fit rule drop range marks to the number alone.

### B6. The bar radius is applied to every stacked segment and to hairline bars
- **Severity**: low
- **What**: `border-radius-bar` (2 px) rounds every segment of a stack, so a short top segment becomes a separate pill floating above its bar. When bars narrow to 1–3 px (dense series at 250 and 170), the radius turns each bar into a rounded nub.
- **Evidence**: `frames/stacked/light-100-480.png` (series-3 caps read as loose pills); stacked and diverging at 170 in `sheets/plot/light-100-3.png` and `light-100-2.png`.
- **Why it matters**: A stack should read as one bar divided, and a rounded inner joint suggests separate objects.
- **Where to fix**: `cartesian.ts` bar CSS: round only the outer end of a stack, and drop the radius below a bar width of about 2× the radius.

### B7. Adjacent categorical colours are hard to tell apart
- **Severity**: low
- **What**: Series 2 (grass) and series 3 (teal) are close in hue and lightness in both themes. The two middle bands of the stacked areas, and the second and third lines of `series`, need the legend to separate.
- **Evidence**: `parts/plot/area-light-natural-480.png`; series in `sheets/plot/light-natural-4.png` and `dark-natural-4.png`; streamgraph in `light-natural-5.png`.
- **Why it matters**: Categorical order should maximise the difference between neighbours, because stacks always put neighbours side by side.
- **Where to fix**: the series order in `config/charts.tokens.json`: separate grass and teal by a contrasting hue.

## Situational issues

### S1. Point plots vanish with no step between full and nothing
- **Severity**: medium
- **Composition**: point marks (scatter, bubble, connected, qq, quadrant, rug, embedding, units, wilkinson) at natural height
- **What**: Line and bar plots keep a sparkline down to 170. Point plots go from a full plot at 346 straight to the number alone at 250, because the `points` rule needs 280 wide.
- **Evidence**: `sheets/plot/light-natural-1.png` bubble and connected rows; `light-natural-4.png` qq, quadrant, scatter, rug; `light-natural-6.png` wilkinson (all empty at 250).
- **Why it matters**: The step order across samples differs by mark with no visual reason. A dashboard row of mixed views loses its scatters one step before its lines.
- **Where to fix**: `points.ts` / `POINTS_FIT`: let points keep a bare plot (dots without labels) down to the cartesian 152, or say on purpose that they cannot.

### S2. In a 100 px box, the sparkline goes portrait
- **Severity**: medium
- **Composition**: any cartesian view at height 100 and width 170 (also 250)
- **What**: Beside the number, the bare plot takes the full height but only about 40 px of width, so 30 periods are squeezed into a tall sliver. Bars become 1 px hairlines and lines become vertical scribbles. At natural height the same plot is a short wide band.
- **Evidence**: `frames/histogram/light-100-170.png`; `frames/stacked/light-100-170.png`; the 170 column of `sheets/plot/light-100-2.png` and `light-100-3.png` (dual, stacked, series, ohlc).
- **Why it matters**: Banking. Slopes read steeper than they are when the aspect is inverted, and dense bars alias.
- **Where to fix**: the bare branch in `cartesian.ts` / `layout.ts`: cap the sparkline's height to its width (or to `BARE_HEIGHT`) and centre it, or stack the number over the plot when the plot would be narrower than it is tall.

### S3. A point label on the topmost point leaves the plot
- **Severity**: low
- **Composition**: point labels with a point at the y maximum (quadrant, scatter)
- **What**: "/pricing" sits above the top point and is cut by the frame. Separately, "/blog/analytics-…" is struck through by the dashed reference rule.
- **Evidence**: `parts/plot/quadrant-light-natural-480.png`; scatter and quadrant at 480 and 346 in `sheets/plot/light-natural-4.png` and `dark-natural-4.png`.
- **Why it matters**: Clipped labels and labels crossed by rules both cost legibility on exactly the points a reader looks at first.
- **Where to fix**: `chrome/label.ts` / `thinLabels`: flip a label below its point when it would cross `PLOT_TOP`, and treat reference rules as obstacles.

### S4. Dense matrices at narrow widths are mostly gutter
- **Severity**: low
- **Composition**: matrix with many columns (heatmap with 24 hours, bins2d) at 170
- **What**: At about 5 px a cell, the 1 px light gutter is a fifth of each cell, and the grid shimmers into stripes rather than a field.
- **Evidence**: heatmap at 170 in `sheets/plot/light-natural-3.png` and `light-100-2.png`; bins2d at 170 in `light-natural-1.png`.
- **Why it matters**: The gutter should separate cells, not compete with the colour that carries the value.
- **Where to fix**: `layouts/matrix.ts` `.uav-cells` gap: drop the gap to 0 (or a hairline at the surface colour) below a cell size of about 8 px.

### S5. Bare plots disagree on whether a fill survives
- **Severity**: low
- **Composition**: single-series areas, bands and difference fills in the bare sparkline
- **What**: Stacked areas, streamgraph and cumulative keep their fills as sparklines. Trend, density, fan bands and difference fills drop theirs to a line.
- **Evidence**: 250 and 170 columns of `sheets/plot/light-natural-2.png` (density, difference, fan) against `light-natural-1.png` and `light-natural-5.png` (area, streamgraph).
- **Why it matters**: Consistency. If the soft fill is context to drop when bare, stacked fills (which are the data) are rightly kept, but the rule should be stated and visibly hold.
- **Where to fix**: the bare branch in `cartesian.ts`: document the rule (drop `-soft` fills, keep data fills) and check that difference fills, which are data, are kept.

## Works well
- The grid at 15% `currentColor` is quiet in both themes, and the baseline is a step firmer. Bars sit exactly on it.
- Lines share one 1 px non-scaling stroke at every width, so weight does not drift as the plot scales.
- Matrix cells fill their room at every width, gutters are honest at 1 px, and a missing cell has its own neutral ("No data") rather than a ramp step.
- The dark sequential ramp runs dim to vivid with value, and the dark soft tints sit correctly beneath their lines.
- The diverging bars' green and red are paired with direction (above or below the zero rule), so colour is not the only cue.
- The stepped fallback order for lines and bars (full plot, then sparkline beside the number, then number alone below 152) is steady across samples.

## Open questions
- Is the inverted light ramp (B2) chosen on purpose for brand reasons? `sequential.json` is hand-picked, so the ordering may be intended.
- Should points ever have a bare form (S1), or is "number alone" the intended answer for a scatter?
- The fan band's flat bottom near x≈430–470 in `parts/plot/fans-light-natural-480.png` may be clamping to the domain or may be the data. It cannot be told from the picture.
- The treemap clips by 31–60 px and the sankey overlaps its labels in check.md. Both are custom marks, left to their own audits.
