# y-axis

Source: `packages/dom/src/chrome/axes.ts` (paint, `AXES_CSS`, `thinAxis`), `packages/dom/src/measure.ts` (`thinLabels`), `packages/dom/src/layouts/cartesian.ts`, `packages/dom/src/layouts/matrix.ts` (`LABELS_SHARE`), tick text from `packages/core/src/scene.ts` (`axisTick`) and `packages/core/src/format.ts`. Seen in 41 samples across cartesian (35) and matrix (6: adjacency, bins2d, calendar, circles, correlogram, heatmap); stripes plans one and never shows it.

## Summary
The axis is quiet, consistent and well placed: right-aligned to the plot, in the tick face and muted label colour, with even contrast in both themes, and no label is clipped anywhere in the capture. The new 40% cap works: long row names in a matrix stop at 40% of the view and take an ellipsis. The main problem is how it falls back. In cartesian the axis has a single all-or-nothing rule shared with the x axis (280 wide), so axes 12 to 36 px wide vanish at 250. Matrix row names up to 192 px wide survive down to 170. Second, the formatter labels each tick on its own, so one duration axis reads `0ms, 1s, 2s, 3s`.

## Base issues

### B1. The cartesian y axis has no step down; it goes when the x axis goes
- **Severity**: medium
- **What**: Every cartesian sample shows the y axis at 480 and 346 and drops it at 250, whatever its width. A 12 px rank axis (bump) and an 18 px percent axis (scatter, bubble) go at the same width as a 36 px `800ms` axis (candlestick, ohlc). There is no middle state, such as two ticks (min and max), the zero tick alone, or fewer ticks, before the whole view turns into the number and a bare sparkline. The matrix y axis needs 150 wide, and it carries labels up to 192 px (adjacency), so the narrower cartesian axis is the one that leaves first.
- **Evidence**: `sheets/y-axis/light-natural-1.png` (area, box, bubble, bump, candlestick, connected: columns 250 and below empty; adjacency, bins2d, calendar, circles: still present at 170); `frames/area/light-natural-250.png` (number and a bare area, no scale at all); `sheets/y-axis/dark-natural-1.png` (same pattern).
- **Why it matters**: Graceful fallback. The value scale is what makes a cartesian plot a chart rather than a shape. Between 280 and about 200 there is room for a 12 to 36 px column of two labels, and at those widths the reader loses the magnitudes completely. The two layouts also disagree on which kind of axis is cheaper to keep.
- **Where to fix**: The cartesian rule in `packages/core/src/fit.ts`. Give the y axis its own intermediate step (rank-thin to the extreme ticks, the way `y-ticks` already does for `y-axis-2`) before the shared 280 wide rule removes both axes.

### B2. Ticks on one axis are formatted one by one, so units change along the axis
- **Severity**: medium
- **What**: `formatMetric` is called per tick, and `duration()` picks the largest unit that reads for each value separately. A seconds axis therefore ends in `0ms`: `3s, 2s, 1s, 0ms` on box, and `6s, 4s, 2s, 0ms` on qq. The same happens on the x axis of qq, where `0ms, 2s, 4s, 6s` puts two units in one corner.
- **Evidence**: `parts/y-axis/qq-light-natural-480.png`, `frames/qq/light-natural-480.png`, `sheets/y-axis/light-natural-1.png` (box at 480 and 346), `sheets/y-axis/light-natural-3.png` (qq).
- **Why it matters**: A scale should be read in one unit. Mixed units make the zero look like a different quantity, and the label column ends up wider than the axis needs.
- **Where to fix**: Where `scene.ts` builds the y-axis ticks (around `axisTick('y-axis', …)`): choose the unit once from the domain or the largest tick, and format every tick in that unit (`format.ts` needs a duration form with a fixed unit).

### B3. The tick face's pixel lowercase confuses g with 9 and p with P
- **Severity**: medium
- **What**: The theme's tick face (Ans Mono at 8 px) draws `g` with no descender, so it reads as `9`, and draws `p` like a capital. Category labels on the y axis read `/Pricin9`, `/chan9elo9`, `/docs/9ettin9-started` and `Ad sPend`. On an axis where numbers and words share one face, `9` and `g` are hard to tell apart.
- **Evidence**: `parts/y-axis/adjacency-light-natural-480.png`, `frames/adjacency/light-natural-480.png`, `parts/y-axis/correlogram-dark-100-480.png` (`Ad sPend`, `Avera9e order`).
- **Why it matters**: Legibility of categorical labels, which are words the reader has to recognise. The pixel face suits numeric ticks; it is weaker for names, and URL paths are the worst case because the reader cannot guess them from context.
- **Where to fix**: In the tokens: either a face whose g and p have descenders on this grid, or a separate token for category tick labels (the `font-family-tick` vs `font-family-value` split in `packages/dom/src/tokens.ts` / `config/charts.tokens.json`) so word labels can use a non-pixel face.

### B4. The bottom tick label sits half inside the x axis row and crowds its first label
- **Severity**: low
- **What**: Every label is centred on its tick (`translate: 0 -50%`), and that includes the label on the baseline. Its lower half therefore drops into the x-axis band, beside the x axis's first label: `0ms`/`0ms` on qq, `0%` over `0` on ecdf, `0ms` beside a cut x label on box.
- **Evidence**: `frames/qq/light-natural-480.png`, `frames/ecdf/dark-natural-346.png`, `frames/box/light-natural-346.png`.
- **Why it matters**: The corner is where both scales start, and two zeros pressed together read as one cluttered glyph group. A small vertical nudge or dropping one of the duplicate zeros makes it clean.
- **Where to fix**: `AXES_CSS` in `axes.ts`: anchor the end ticks (t at 0 and 1) so they sit inside the plot's band (bottom-aligned/top-aligned), as the x axis already does with `data-anchor` start/end.

### B5. Negative ticks use a hyphen, and bin ranges use a hyphen as a separator
- **Severity**: low
- **What**: Negative values print with ASCII hyphen-minus (`-10`, `-20`, `-0.5`, `-50`), and bin labels are written `0.5-1` and `3.5-4`. Once a bin range starts below zero this reads `-1--0.5`.
- **Evidence**: `frames/diverging/light-natural-480.png`, `sheets/y-axis/light-natural-4.png` (rug, waterfall), `frames/bins2d/dark-natural-480.png`.
- **Why it matters**: Typography and unambiguous labelling. A true minus (U+2212) is a different glyph from a range dash (en dash), and the reader should not have to tell them apart from context.
- **Where to fix**: `packages/core/src/format.ts` (minus sign) and the code that names bin rows in core (en dash between the two ends).

## Situational issues

### S1. bins2d labels its two binned axes in two different ways
- **Severity**: medium
- **Composition**: matrix with a binned quantitative field on both axes (bins2d).
- **What**: The x axis puts edge values on the cell boundaries (`0 0.5 1 1.5 …`). The y axis puts range names in the cell centres (`0-0.5 … 3.5-4`). The same kind of scale is labelled two ways in one chart, and the y column is three times as wide as it needs to be (36 px vs about 12).
- **Evidence**: `frames/bins2d/dark-natural-480.png`, `frames/bins2d/light-100-250.png`, `sheets/y-axis/light-natural-1.png`.
- **Why it matters**: Consistency and truthful encoding. Edges say that the axis is continuous, while ranges say that it is a set of categories. Both axes here are the first kind.
- **Where to fix**: Where the matrix scene labels a binned y (core): put edge ticks on row boundaries, the way the binned x is done, and keep range names only for the readout.

### S2. Cutting names at the end loses what tells them apart
- **Severity**: medium
- **Composition**: matrix at 170 and 250 (and 346 for adjacency) with long row names that share a prefix (adjacency's URL paths), or a symmetric matrix whose x axis is thinned to one label (correlogram, circles).
- **What**: At 170 the 40% cap leaves about 68 px, which gives `/blog/lau…`, `/blog/ana…`, `/docs/9et…`, `Conversio…`, `Average o…` and `Refund ra…`. The x axis of correlogram and circles has thinned to a single `Conversion rate`, so the cut y labels are the only way to identify a row, and three of the six are cut.
- **Evidence**: `frames/circles/light-natural-170.png`, `sheets/y-axis/light-natural-1.png` (adjacency at 250 and 170), `sheets/y-axis/light-natural-2.png` (correlogram at 170), `sheets/y-axis/light-100-1.png`.
- **Why it matters**: A cut label that no longer names its row distinctly is close to having no label at all. In a symmetric matrix the reader also cannot recover the name from the other axis.
- **Where to fix**: In matrix.ts, or in the matrix fit rule. Options: cut in the middle for path-like names (keep the last segment), let the y axis go before it cuts most labels down to their first word, or, for a symmetric matrix, keep the x axis's labels when the y axis's are cut.

### S3. Thinned matrix rows are not marked as rows without a label
- **Severity**: low
- **Composition**: matrix at height 100 with many rows (adjacency, bins2d).
- **What**: With `gap: 0`, thinning leaves 3 of 8 labels (`/`, `/docs/getting-started`, `/blog/analytics-witho…`) on rows 1, 4 and 7. Nothing (a tick or a stub) marks the rows without a label, so it is hard to tell which row a label belongs to and how many rows lie between labels. The column also keeps its full 40% for the three labels it shows.
- **Evidence**: `frames/adjacency/light-100-346.png`, `frames/bins2d/light-100-250.png`.
- **Why it matters**: The reader cannot count rows from the axis. A short tick at each row lets the eye attach each label to its row.
- **Where to fix**: matrix.ts: a hairline tick per row in the axis gutter (the `rule.ts` rule) whenever labels are thinned.

### S4. stripes plans a y axis it never shows
- **Severity**: low
- **Composition**: matrix with one row and no row name (stripes).
- **What**: The plan lists `y-axis` at every width, yet no box is ever measured. The checker flags this 20 times (check.md, `shown`). The picture is fine, but `plan.parts` and `explain()` claim a part that is not there.
- **Evidence**: `check.md` § shown; `frames/stripes/light-100-480.png`.
- **Why it matters**: Agents read the plan and the explanation. If they list a part that is not on screen, they mislead whoever composes around the view.
- **Where to fix**: core's matrix plan: leave the y axis out when there is one row and it has no name.

## Works well
- One quiet, consistent treatment: the tick face, `color-label-axis` (muted foreground), right-aligned with 6 px to the plot, and the same in cartesian and matrix.
- Contrast holds in both themes. The dark sheets show nothing missing or faint that is fine in light.
- No y-axis label is clipped or outside its box in any of the 2496 frames. Ellipses appear only where the 40% cap meant them to.
- The 40% cap (`fit-content(40%)`) keeps long row names from squeezing the grid. At 480 the adjacency column is 192 px and the grid keeps 60%.
- Labels sit on their gridlines and row centres, and tabular numerals keep the decimal columns aligned.
- Rank axes (bump) put 1 at the top, as a ranking should.

## Open questions
- Is the pixel face meant for category labels as well as numbers (B3), or did it reach them only because both share `font-*-tick`?
- Should the cartesian y axis outlive the x axis (B1)? With time on x and a sparkline beside a number, the scale may matter more than the dates. That choice belongs to the fit rules' authors.
- The capture has no cartesian frame between 280 and 120 tall at natural width, so it does not show how the y axis thins its ticks as height drops.
