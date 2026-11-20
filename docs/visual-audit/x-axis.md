# x-axis

Source: `packages/dom/src/chrome/axes.ts` (`AXES_CSS`, `paintAxes`, `thinAxis`), `packages/dom/src/measure.ts` (`thin`, `thinLabels`), `packages/dom/src/layouts/cartesian.ts`, `packages/dom/src/layouts/matrix.ts`; ticks from `packages/core/src/scene.ts` (`axisTick` callers); fit rules `axes`, `mid-tick` and matrix `marks` in `packages/core/src/fit.ts`. Seen in 43 samples across cartesian (36) and matrix (7: adjacency, bins2d, calendar, circles, correlogram, heatmap, stripes).

## Summary
The x-axis is quiet, consistent in face and colour, and holds in both themes. It steps out cleanly: cartesian at the `axes` rule (gone at 250), matrix at 150 (gone at 120). Its biggest problem is what it does to labels at the ends and in the middle. A label centred under the first band can run past the view's left edge and be cut, because `inside` only guards the far edge. And the `mid-tick` breakpoint at 380 px removes every middle tick on linear and time axes, even where they would fit easily, so at 346 px most cartesian views have a two-tick axis ("0 … 3k"). Thinning also keeps labels as tightly packed as the 6 px gap allows. The result is uneven strides and labels that run together, and on a categorical axis bars are left unnamed at random.

## Base issues
### B1. First label overflows the near edge and is cut
- **Severity**: high
- **What**: Band and matrix labels are centred under their column (`ANCHOR.middle`). When a label is wider than twice the distance from its column's centre to the axis start, it runs left past the axis. It is cut where nothing (a y gutter) catches it. `thinAxis({ inside: true })` tests only `s.hi <= room + 1`, the far edge, and never `lo >= 0`. Cartesian calls `thinAxis` without `inside` at all.
- **Evidence**: `frames/stripes/light-natural-170.png` shows "P 8" for "Sep 8", cut at the frame edge, and `light-natural-480/346` show "eP 8" and "›P 8". `frames/box/light-natural-480.png` shows "nalytics-without-cookies", which runs through the y gutter and off the view. The same happens to errors at 480 and 346 (`parts/x-axis/errors-light-natural-480.png`). Heatmap at 250 shows "2am" for "12am" in the crop. Both themes are affected. `capture.json` reports `clipped: 0` for every one of these frames, so the checker does not see it.
- **Why it matters**: A cut label reads as a different value ("P 8", "2am"). An end label is the one that anchors the scale.
- **Where to fix**: `thinAxis` in `chrome/axes.ts`: test both edges when `inside`, and clamp the first and last band labels to start/end anchor before giving them up. Make `measure`'s `clipped` count overflow past the view's edge too.

### B2. `mid-tick` drops middle ticks by breakpoint, not by collision
- **Severity**: high
- **What**: The fit rule `mid-tick` (cartesian, `needs: { inline: 380 }`, hides `x-tick.mid` = every `[data-rank]`) removes all interior ticks below 380 px. This happens even though the measured pass would already give up only the ones that meet. At 346 px every linear axis shrinks to its two ends, and every time axis to first and last date.
- **Evidence**: `frames/bubble/light-natural-346.png` shows "0 … 3k" with about 300 px empty between them. The sheets `light-natural-1..4` at 346 show the same for connected ("0 … 600"), density, ecdf and histogram ("0 … 8"), embedding and rug ("-1 … 1"), quadrant and scatter, and every time sample ("Sep 8 … Oct 5"). Wilkinson at 346 (`sheets/x-axis/light-natural-5.png`) shows "0 … 8". The dark sheets match.
- **Why it matters**: A quantitative axis with only its ends gives no sense of interval or linearity. A four-week series labelled with two dates hides where the middle is. The labels are the cheapest guide on the plot, and the rule drops them while there is room.
- **Where to fix**: In `packages/core/src/fit.ts`, drop the `mid-tick` rule, or lower it to where even one middle label cannot fit, and let `thinAxis` give up ranked ticks by measured collision.

### B3. Thinning packs survivors at the minimum gap, giving uneven strides and run-together labels
- **Severity**: medium
- **What**: `thin()` keeps labels greedily in rank order and drops only one that meets a kept label within `gap` (6 px). Survivors therefore sit as close as 6 px, at irregular intervals. Multi-word labels 6 px apart read as one label.
- **Evidence**: In `parts/x-axis/bins2d-light-natural-346.png`, 0.5 and 7.5 are dropped and every other label stays: "0  1 1.5 2 2.5 … 6.5 7  8", which is cramped and lopsided. At 170 (`sheets/x-axis/light-natural-1.png`) it reads "0 1.5 3 4.5 6 7 8", with strides of 1.5 then 1. In `parts/x-axis/correlogram-light-natural-480.png` (and circles), "Refund rate Ad spend" runs together. In `frames/pareto/light-natural-480.png`, "Timeout Not found" are close and bars 3 and 5 are unnamed. Both themes are affected.
- **Why it matters**: Even tick spacing is how a reader reads interval. Labels set as close as they can be read as one string. A gap of 6 px is less than one character of the tick face.
- **Where to fix**: In `thin` / `thinAxis` (`measure.ts`, `chrome/axes.ts`), once any ranked label collides, keep a uniform stride (every 2nd, 3rd, 6th, which the matrix `rank` already encodes) rather than greedy survivors. Raise the x gap to about one em of the tick face.

### B4. On a categorical axis, thinning leaves bars nameless with nothing to tell which
- **Severity**: medium
- **What**: Nominal labels are given up exactly as numeric ticks are, with no tick mark, abbreviation or count to show that one is missing. A surviving label then reads as belonging to whichever bar is nearest.
- **Evidence**: In `frames/pareto/light-natural-480.png`, bars 3 and 5 have no name. At 346 a different subset shows ("Timeout, Server error, Forbidden, Other"). Grouped at 346 has no "AI assistants". `frames/box/light-natural-480.png` loses two of eight paths, and errors does the same. In `frames/adjacency/light-natural-480.png`, two of eight columns are named.
- **Why it matters**: A category axis has no interpolation. An unnamed bar is unreadable, and which labels drop out changes with width, so the same view names different bars at different sizes.
- **Where to fix**: In `chrome/axes.ts` with `chrome/label.ts`'s `cut`, cut nominal labels to their band (with ellipsis) before giving them up. Give them up only below a floor, and then all together, which the fit rule can say.

### B5. A duration axis mixes units at zero
- **Severity**: low
- **What**: Zero is written "0ms" while the other ticks are "2s", "4s" and "6s".
- **Evidence**: In `parts/x-axis/qq-light-natural-480.png` the x axis reads "0ms 2s 4s 6s". `frames/box/light-natural-480.png` shows the same on its y axis ("0ms … 3s").
- **Why it matters**: The ticks of one axis should share a unit. A different unit at the origin looks like a different scale.
- **Where to fix**: In `formatMetric`'s duration form in core, choose the unit from the axis's step or largest tick and not from each value.

## Situational issues
### S1. Long nominal labels under matrix columns
- **Severity**: medium
- **Composition**: matrix with page paths or metric names on x: adjacency, correlogram, circles.
- **What**: Columns are about 70–90 px but labels like "/docs/getting-started" or "Conversion rate" are wider, so most columns go unnamed. Adjacency names only "/" and "/docs/getting-started" at 480 and 346, and only "/" at 170.
- **Evidence**: `frames/adjacency/light-natural-480.png`, `sheets/x-axis/light-natural-1.png` (adjacency, circles rows), `frames/correlogram/light-natural-346.png`.
- **Why it matters**: A square matrix whose columns carry the same names as its rows can say so once. A bare column otherwise has to be found by counting.
- **Where to fix**: In `layouts/matrix.ts`, when x and y are the same dimension, either drop x labels for a note that columns follow the rows, or cut them to the column with an ellipsis (B4's mechanism). Rotated labels are another option for this layout alone.

### S2. Start-anchored time label on a band scale starts at the bar's centre
- **Severity**: low
- **Composition**: time on a band axis (bars): diverging, waterfall, candlestick, ohlc, stacked, layers.
- **What**: The first date is `anchor: start` at `cx` of the first band, so it starts mid-bar rather than at the bar's left edge or centred on it. The last date does the same on the right.
- **Evidence**: In `frames/diverging/light-natural-480.png`, "Sep 8" starts at the first bar's centre. `parts/x-axis/waterfall-light-natural-480.png` shows the same.
- **Why it matters**: It is a small edge mismatch against the bars, and it is not aligned the same way as the line samples, whose first date is flush with the plot.
- **Where to fix**: In `scene.ts` (band, time ticks), anchor the end labels at the band edge (`x`/`x + w`) rather than at `cx`.

### S3. Time axis has three dates at any width, unlike the matrix's weekly labels
- **Severity**: low
- **Composition**: cartesian time axis (`isTime`: first, middle, last) against matrix time columns (calendar, stripes).
- **What**: At 480 a cartesian time view shows "Sep 8, Sep 21, Oct 5", a middle date that is not on any regular boundary. Calendar and stripes, from the same dates, show "Sep 7 / 14 / 21 / 28" or every third day.
- **Evidence**: `sheets/x-axis/light-natural-4.png` (series, stacked vs stripes), and calendar in `light-natural-1.png`.
- **Why it matters**: The same dimension gets two labelling schemes. Three irregular dates under a 28-day series is sparse at 480 px.
- **Where to fix**: In the time tick choice in `scene.ts`, emit ticks at a regular interval (week or day multiples) ranked like the matrix's, and let B2/B3 thin them.

## Works well
- The face, size and colour (`color-label-axis`) are quiet and the same in every layout, and read well in both themes. There are no parity problems.
- The axis sits on the plot's edge with a constant 5 px pad. Labels align with their marks in the cartesian, point (units) and matrix layouts.
- The step-down order is clear and early: cartesian at 280 with the number taking over, matrix at 150. The axis never hangs on in a cell too narrow for it.
- The far edge is respected: anchoring end ticks to start/end, plus `inside` in matrix, stops right-edge overflow.
- Marimekko ranks labels by column width, so the widest columns keep their names, which is right for unequal bands.
- `aria-hidden` on the axis, with each mark carrying its own name, is the right split.

## Open questions
- Scatter, bubble and quadrant name no x metric anywhere in the frame ("0 … 3k" of what?). Is an axis title the x-axis's job or the tldr's?
- `capture.json` reports `clipped: 0` for frames where B1's label is visibly cut at the view's edge. Is `clipped` measured against the part's own box only? If so, the checker cannot catch this class of problem.
- Height 100 shows no cartesian x-axis at all (the `axes` rule's 120 px block). That is by contract, but is a 100 px tall line chart with no dates the intended outcome, rather than a one-line axis?
