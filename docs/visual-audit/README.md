# Visual audit of `<ua-view>`: consolidated findings

**Verdict.** Every part reads well at full size. At 480 and 346 px, in both themes, the type is quiet, the subgrid holds and the marks are honest. The component is not yet dependable in untried compositions. It fails at the edges of its rooms, and it fails in ways that mislead. The headline number is cut into a different number. A key leaves while the colour, size or second axis it explains stays on screen. Lists and labels are cut with nothing to say so. Several fit rules use a fixed width that ignores what the part holds. The palette, in light, puts its loudest colours on context (soft tints, the low end of the sequential ramp). Most of this is fixed at the source, in `fit.ts`, the label and number atoms, `format.ts` and the tokens, not one layout at a time.

**How it was run.** Capture `apps/bench/captures/2026-11-20T20-50-34-247Z/` (2,496 frames: widths 480 to 40 and free, natural height and 100 px, light and dark). 20 critics each audited one part against [BRIEF.md](BRIEF.md). This page merges their 91 base and 60 situational findings (the brief said 92 and 61; the index below has the per-report counts) and ranks them by how many compositions they reach, putting misleading above rough.

I opened these images to confirm the top themes before ranking them. Each matched its report.
- `parts/number/bubble-light-natural-80.png`: `10.5k` shows as `10.` plus a sliver.
- `parts/hole/donut-light-natural-120.png`: `10.5k` runs across the ring, with the unlit slab over the arcs.
- `parts/plot/fans-light-natural-480.png`: a lime band drowns its olive median.
- `parts/columns/league-dark-natural-480.png`: "Pa9e views", "Chan9e".
- `frames/conversions/light-100-480.png`: 2 of 6 rows with no cue that more exist, `$48.2k` beside `$4,210`, and loud lime bars.
- `frames/heatmap/light-natural-170.png`: a full colour grid with no ramp, and "12Pm".
- `parts/legend/donut-light-natural-480.png`: Mobile and Tablet swatches nearly alike, and values about 900 px (2×) from their names.

---

## Source fixes

Ranked. **M** means it misleads (a wrong reading of the data). **R** means it only looks rough.

### F1. The headline number is cut into a different number
- **Severity**: high, M. It reaches every view that shows a number: 57 of 58 samples at 80 px, and some at 120.
- **What**: When no form fits, `fitNumber` keeps the last form on the screen and cuts it at a cell. The magnitude suffix or the unit is the part that goes (`10.5k` becomes `10.`, `$63.5k` becomes `$63`, `436ms` becomes `436`), and a sliver of the next glyph can pass for a character. Units are forced into small caps, so `ms` reads `MS`.
- **Merges**: number B1, number B4.
- **Fix at**: `measure.ts` `fitNumber`, the value's forms in core `scene.ts`, and `.uav-glyph-run sup` in `dots.ts`.
- **Direction**: add a lower-precision compact rung that keeps the suffix and unit (`25k`, `$64k`, `0.4s`). Below that rung, fall to prose and never cut the value. Keep the unit's own case.

### F2. Keys and guides leave before the encoding they explain
- **Severity**: high, M. It reaches every layout.
- **What**: The rules hide a key at a higher threshold than the marks it keys. That leaves a window where colour, size, glyph count, a second scale or an angle is drawn with nothing to decode it. Instances:
  - A matrix grid keeps its colours from 240 down to 150 px, and at every width in a 100 px box, with no ramp. Diverging samples lose their sign.
  - Sized circles stay at 170 with neither key.
  - Split bars at 280 to 319 px lose the legend, and the promised line-end labels never come for bars.
  - The second layer stays plotted on its own domain after `y-axis-2` drops (280 to 340 px, and the bare sparkline).
  - Isotype glyphs stay at 100 px tall without their worth.
  - A choropleth stays without its "not shown" note.
  - The header row goes with the second column, so the last number has no name.
  - A rose goes from 16 rim labels to none.
  - A donut in a short box drops its total and puts nothing in its place.
- **Merges**: ramp B2, size S1, labels S1, legend S3, y-axis-2 B3, unit-key S2, note B1, columns B1, rim B2, radial S2, hole S1.
- **Fix at**: `packages/core/src/fit.ts`, as one invariant: a part that keys an encoding never leaves before that encoding does. Add a rule check in `test/` so new rules obey it.
- **Direction**: give each key a compact rung (end swatches only, the four quarter hours on the rim, the header in the rank-0 column). Where no compact rung is possible, drop or demote the encoding at the same step as its key.

### F3. Lists and labels are cut silently, and the cut keeps the wrong end
- **Severity**: high, M. It reaches rows, axes, legends, point labels and keys.
- **What**:
  - Under a height limit, a list is rounded down to whole rows with no "+N more" (`live` at 100 px shows 1 of 4 rows, and it reads as the whole answer).
  - A size key's overflow hides its largest step's label.
  - Category axes drop names with no mark that one is missing.
  - `legend-top` is one string, so the share is ellipsized before the name.
  - Point labels are cut at a fixed 14ch even at 1,240 px, and an end cut on URL paths keeps `/blog/…` and loses what tells two paths apart.
  - The number's delta and note are measured without the screen's padding, so they ellipsize ("peri…") when the short form was available.
- **Merges**: rows B1, size B3, x-axis B4, legend-top B2, point-labels B1, number B3, y-axis S2 (middle cut).
- **Fix at**: `rows.ts` (`IN_BOX`) with a `fit.ts` step; `chrome/label.ts` `cut`; `legend.ts` with `scene.ts` `shareLegend`; `size.ts`; `measure.ts` `readNumber`.
- **Direction**: cut the least important text first (the name before the value, the middle of a path before its tail), let the cut follow the room, and always say when rows or items are hidden.

### F4. Falling back to an empty number, a dash or a value with no name
- **Severity**: high, M/R. It reaches every point mark, every rows layout and the gauge.
- **What**:
  - Point plots go straight from the full plot at 346 px to the number alone at 250, and in qq, embedding and rug that number is a dash, so a 480 × 100 tile is about 80% empty. A lone dash outlives every real value.
  - The cartesian y axis has no rung of its own.
  - A gauge at 80 px is a bare arc.
  - Row lists keep the value and give up the label, down to rank and number only (league at 120).
- **Merges**: points B1, plot S1, number S4, y-axis B1, radial S1, rows B2.
- **Fix at**: `fit.ts` (`points` rule, the cartesian axis rules, the radial rules, the rows `marks` need); `points.ts` `POINTS_FIT`; `fitNumber`.
- **Direction**: every part steps down one rung at a time: bare dots down to 152 × 46, the y axis thinned to its extremes. A value with no figure, or a value with no label, counts as "does not fit", so the view falls to prose.

### F5. The pixel tick face sets words badly, and the number screen clips descenders
- **Severity**: high, M. It reaches every axis, column header, Sankey label, rim and number note.
- **What**: Ans Mono at 8 px has no descender on its grid, so `g` reads `9` and `p` reads `P` ("Pa9e views", "/docs/9ettin9-started", "12Pm"). Separately, the number screen's lines of words are exactly 5 cells tall with `overflow: hidden`, which gives "ToP: DesktoP" and "ri9ht now". At 8 px the face is also below the usual size for running words. Point labels set the same `tick` role in the sans face, so one role appears in two faces.
- **Merges**: columns B3, columns B4, labels B4, y-axis B3, number B2, point-labels B5 (face half), rim open question.
- **Fix at**: tokens (`font-family-tick`, `font-size-tick` in `charts.tokens.json` and `dom/src/tokens.ts`); `DOTS_CSS` in `dots.ts` with `.uav-number > span` in `view.ts`.
- **Direction**: split the token. Digits stay in the pixel face; category labels and headers use the label face a step below `font-size-label`. Give lines of words on the screen a sixth row, or clip them inline only.

### F6. Numbers are formatted one value at a time
- **Severity**: medium, M. It reaches every value column and every duration or negative axis.
- **What**:
  - A column mixes compact and exact forms (`$48.2k` above `$4,210`, which reads as larger at a glance).
  - A duration axis reads `0ms, 1s, 2s`.
  - Beside a bare plot the number is `1.1k`, while alone in a narrower room it is `1,084`.
  - Negatives use a hyphen, and bin ranges use a hyphen as the separator (`-1--0.5`).
  - Size-key bounds round across a step edge (`0.0625` shows as `0.1`).
- **Merges**: rows B6, y-axis B2, x-axis B5, number S2, y-axis B5, size B1 (rounding half).
- **Fix at**: `packages/core/src/format.ts`, and its callers in `scene.ts` (axis ticks, row cells, `sizeKey`).
- **Direction**: choose the form and the unit once per scale or column, from its domain or its largest value. Use U+2212 for minus and an en dash for ranges.

### F7. In light, soft tints are louder than the marks they support, and in dark they are uneven
- **Severity**: high, M. The hierarchy flips between themes. It reaches every single-series area, fan, band, difference fill, row bar, gauge range, radial-bar track and unit grid.
- **What**: `color-series-*-soft` aliases `qual-*-100`. In light that is a saturated lime brighter than its olive line, and the unlit cells of an icon grid read as a second category. In dark, row bars sit around 1.3:1 against the surface (short bars vanish), the gauge's range disappears, and a radial-bar track can be brighter than its value.
- **Merges**: plot B1, band B2 (tint half), rows B5, radial B3.
- **Fix at**: the charts and common tiers (`charts.tokens.json`, `common.dark`). Nothing changes in the layouts.
- **Direction**: in both themes a soft step sits below its series colour at an even, low contrast. Consider one neutral track paint for context arcs.

### F8. The light sequential ramp gives the most vivid colour to the least value
- **Severity**: high, M. It reaches every matrix and every choropleth.
- **What**:
  - In light, `seq-1` is acid lime `#cbed00`, so sparse matrices (adjacency) read as a field of lime and the least countries advance on the map.
  - In dark, `seq-1` sits close to the no-data grey.
  - The diverging ramp's first positive step is its most vivid, and its "0" label reads as belonging to the next swatch.
- **Merges**: plot B2, ramp B4, ramp B3, ramp B5.
- **Fix at**: `packages/tokens/config/sequential.json` and the diverging arms; `seq-none` in dark; the zero label's placement in `ramp.ts`.
- **Direction**: keep lightness monotonic, let chroma rise with value, and separate no-data from step 1 in lightness. This is partly your call (see D1).

### F9. Fit rules use fixed widths that ignore what the part holds
- **Severity**: high, M (tracks) and R (the rest). It reaches every key, the tracks, the mid ticks and the hole.
- **What**:
  - The `track` rule measures the view, not the track, so at 170 px dumbbell ends merge and cleveland dots sit in about 22 px.
  - The ramp (240) and the size key (240 or 320) are fixed while their own width varies, so "No da" and the largest size label are cut at 250.
  - A column's survival depends on how long its header is.
  - `mid-tick` drops every interior tick below 380 px even when they fit, so axes read "0 … 3k".
  - The rim asks for 230 px for 175 px of ink.
  - The grid gives way at 280 px though it needs 170.
  - A plot beside the number is kept as an 18 px sliver.
- **Merges**: rows B3, ramp B1, size B4, columns B2, x-axis B2, rim B2 (threshold half), band B3, number S1, point-labels S1, hole B1 (rule half).
- **Fix at**: `fit.ts`, with `measure.ts` reporting the part's own measured width. Columns are sized on their values in `rows.ts` `roomsHere` and `place.ts` `columnRooms`.
- **Direction**: needs come from content (measured or computed from the scene), not from constants. Let collision thinning, not a breakpoint, give up ticks.

### F10. Labels at the ends leave the plot or the view, and the measurement misses it
- **Severity**: high, M. It reaches every band or matrix x axis and every point-label or bubble at the domain's top.
- **What**: A centred first band label runs past the start edge ("P 8" for "Sep 8", "2am" for "12am"), because `thinAxis` tests only the far edge. A label on a high point rises above the plot, and a large dot pokes above it. Axis end labels overhang their own box by half a line, and the two zeros crowd each other in the corner.
- **Merges**: x-axis B1, point-labels B2, points S1, plot S3, y-axis-2 B4, y-axis B4.
- **Fix at**: `chrome/axes.ts` `thinAxis` (both edges), `points.ts` `measurePoints` (flip the label below its point), the domain padding in `place.ts`, and the end-tick anchoring in `AXES_CSS`.
- **Direction**: every label is contained on both edges, and `measure` reports ink past the view.

### F11. The number in a ring's hole is wider than the hole
- **Severity**: high, R that hides data (the half donut's Tablet segment is covered). It reaches donut, half, gauge and parliament's fallback.
- **What**: The 4 px cell never shrinks, so `10.5k` (about 116 px) sits in a 96 px hole at 160 px and a 72 px hole at 120 px. Its unlit slab tints the arcs, its foot row is clipped 4 px, and the `clamp()` font size is dead code. The core painter checks the fit (`placeRadial`); the DOM's `hole` rule does not.
- **Merges**: hole B1, hole B2, hole B5, hole S2, radial B1, radial B2.
- **Fix at**: the `hole` rule in `fit.ts` with the measured pass, `.uav-hole` in `radial.ts`, `dots.ts`.
- **Direction**: decide by the number's width against `r0 × plot`, as `placeRadial` does. If it does not fit, hand the number to the view's own number part. Clip any field to the hole. See D2 for a smaller face.

### F12. A second axis is not tied to its series, and its ticks miss the grid
- **Severity**: high, M. It reaches any view with two metrics.
- **What**: Both axes use the same neutral tone, with no metric name or swatch, and series 1 and 2 are neighbouring greens. The far scale's ticks fall between the first scale's gridlines.
- **Merges**: y-axis-2 B1, y-axis-2 B2, y-axis-2 S2.
- **Fix at**: the second scale in core `scene.ts`, and `chrome/axes.ts`.
- **Direction**: caption each axis with its metric and its series' swatch. Choose the second domain so its ticks land on the shared grid; failing that, show its ends only.

### F13. Neighbouring categorical colours are alike, and neutral tokens collide with data
- **Severity**: medium, M. It reaches every stack, legend and 3+ series view.
- **What**: In light, series 1 to 3 (olive, grass, teal) sit in one green band, and 2 and 3 read as one colour at 12 px. The hole's number uses `color-label-screen`, which in dark is series-1 lime, so the total reads as the Desktop value and vanishes on its arc. The size key's grey is the diverging ramp's zero.
- **Merges**: legend B2, plot B7, band B2 (neighbour half), y-axis-2 S2, hole B3, size S2.
- **Fix at**: the series order and values in `charts.tokens.json`; `color-label-screen` in dark.
- **Direction**: neighbours differ in lightness as well as hue, and no chrome token equals a data token.

### F14. The one-line legend is a different part from the full legend
- **Severity**: high (no swatch), M. It reaches every radial, band and divided rows view in a short or narrow box.
- **What**:
  - `legend-top` draws no swatch: the share form is ink only, and the series form is hue-coloured text. So "Search 4,318" under six rings names nothing.
  - The value changes face and place across the step.
  - The full legend sets its value louder than its name.
  - The two forms use different gaps.
- **Merges**: legend-top B1, legend-top B3, legend-top B4, legend B3, legend B4.
- **Fix at**: `chrome/legend.ts` (`paintLegend`, `LEGEND_CSS`) and `scene.ts` `shareLegend` (give the node the leader's paint).
- **Direction**: one entry atom (swatch, then name, then value) in both forms, with one set of gaps.

### F15. Keys are pinned to the view's edge, not to the body they key
- **Severity**: medium, R. It reaches radial, band, geo, and wide views of any layout.
- **What**:
  - The list legend stretches to the full width, so a value sits 400 to 1,200 px from its name.
  - Centred grids, circles and maps sit among keys, notes and unit keys that start at x = 0.
  - Rows inset their labels 8 px, but their keys start at 0.
  - The unit key under seats reads as the legend's title.
- **Merges**: legend B1 (high), band B1, radial B4, unit-key B3, unit-key S1, legend-top S4, legend-top S2, note S2, ramp S2, rows B7.
- **Fix at**: the layout seam (`layout.ts`), so that every layout aligns its keys to the body's box. Cap the list legend's inline size in `LEGEND_CSS`.
- **Direction**: a body and its keys share one start edge (or one centre).

### F16. Sized dots understate value, and the key labels a bin's ceiling
- **Severity**: medium, M. It reaches every `size` encoding (bubble, circles, symbols).
- **What**: Diameters of 9, 14, 19 and 24 px give areas of about 1 : 2.4 : 4.5 : 7.1, against labelled bands of 1 : 4 : 9 : 16, a lie factor of about 2. The labels are upper bounds shown as values. For a signed metric, the key does not say that size means magnitude.
- **Merges**: points B2, size B1, size B2, size S3.
- **Fix at**: core `place.ts` `radius`, `scene.ts` `sizeKey` / `sizeStep`.
- **Direction**: make area proportional above a stated floor, label the bins as ranges, and title a signed metric's key "|x|".

### F17. A dash means four things, and the partial period looks different in each mark
- **Severity**: medium, M. It reaches every time series.
- **What**: One thin dash marks the partial period, a comparison series, reference rules and the qq diagonal. Bars fade the partial period, single-series areas stop with a hard edge, and dots stay solid.
- **Merges**: plot B3, plot B4, points B3.
- **Fix at**: `chrome/rule.ts`, the partial paint in `cartesian.ts`, the dot rule in `points.ts`, with named tokens.
- **Direction**: one pattern per meaning, and one partial treatment for every mark.

### F18. Thinning keeps survivors greedily, so strides are uneven
- **Severity**: medium, R/M. It reaches every axis and the rim.
- **What**:
  - Survivors sit 6 px apart at irregular strides (`0 1.5 3 4.5 6 7 8`), and multi-word labels run together.
  - The rim keeps every flank hour and leaves 3-hour gaps at the poles.
  - Thinned matrix rows have no stub, so labels cannot be matched to their rows.
  - Cartesian time ticks are first, middle and last instead of a regular interval.
- **Merges**: x-axis B3, rim B1, y-axis S3, x-axis S3.
- **Fix at**: `measure.ts` `thin` / `thinLabels`, `chrome/axes.ts` `thinAxis`, time ticks in `scene.ts`.
- **Direction**: once a rank collides, drop the whole rank (a uniform stride), raise the gap to about one em, and add a hairline tick per thinned row.

### F19. Plot labels ignore everything but each other, and are louder than the data
- **Severity**: medium, R. It reaches every labelled scatter and Sankey.
- **What**: Point labels sit on reference rules, and their halo erases the rule. They are set in full ink. Sankey labels over ribbons carry no halo, and `label.ts`'s comment on tone contradicts the code.
- **Merges**: point-labels B4, point-labels B5 (tone half), labels B3.
- **Fix at**: `thinLabels` (feed in reference labels and rules as obstacles), `scene.ts` label paint, `packages/flow/src/index.ts` halo. Settle it with the reference's Open 5.

### F20. The unit key names no glyph and hides rounding
- **Severity**: medium, M. It reaches every `unit` mark.
- **What**: "Each is 500" shows no glyph. Counts are rounded with a floor of one, so 316 and 632 both draw one glyph.
- **Merges**: unit-key B1, unit-key B2, rows S5.
- **Fix at**: `chrome/unit.ts` `paintUnitKey` with the swatch atom; the unit scene (partial last glyph, fixed pitch).

### F21. Absence is worded four ways, and the note is a one-off
- **Severity**: medium, M. It reaches geo now, and every future custom mark.
- **What**: "4 countries not shown" counts a row with no country as a country, gives no share, and lives only in the geo package. "nothing in this period yet", "No data" and "–" are the other three words for absence.
- **Merges**: note B2, note B3, note B4.
- **Fix at**: a `chrome/note.ts` atom; `prose.ts` owns the vocabulary; an engine companion for the unmatched share (see D9).

### F22. Track rows have no reference and no key
- **Severity**: medium, M. It reaches bullet, cleveland, dumbbell, lollipop, strip, tornado and pyramid.
- **What**: There is no baseline or end guide, the track's start moves with the label column, and the bands, target and comparison ends are never named.
- **Merges**: rows B4.
- **Fix at**: `layouts/track.ts` with `rule.ts` and `chrome/legend.ts`.

### F23. Fixed pixel chrome overwhelms small marks
- **Severity**: low, R.
- **What**: A bar radius turns a sliver into a nub and a stack segment into a pill. Non-scaling separators eat small arcs at 80 to 120 px. A 1 px gutter is a fifth of a 5 px cell.
- **Merges**: band B4, plot B6, radial B5, plot S4.
- **Fix at**: the bar CSS in `band.ts` and `cartesian.ts`, the arc stroke in `radial.ts`, the gap in `matrix.ts`.
- **Direction**: drop the radius (or round only the outer end) below 2× its size, scale separators, and drop gutters under 8 px.

---

## Situational fixes

Ranked within each group. Where a base fix covers an item, it is named.

### Cartesian
- **S1. Range marks become a different chart as a sparkline** (medium, M). Box keeps only its medians, candlestick loses its wicks, and OHLC becomes a scribble. Seen in box, candlestick and ohlc at 250 and 170. Fix in `ranges.ts` and the bare branch of `cartesian.ts`: draw the centre line, or go to the number. Merges plot B5.
- **S2. Pareto's aligned grids imply 100% = 500** (medium, M). The bars sum to about 1,080. Seen in pareto at 480 and 346. Fix in a pareto preset: tie the left domain to the total. Merges y-axis-2 S1.
- **S3. The sparkline goes portrait in a 100 px box** (medium, R/M). The plot is about 40 px wide and full height, so slopes read steep and bars alias. Seen in histogram, stacked, dual, series and ohlc at 100 tall, 170 and 250 wide. Fix in the bare branch: cap the height to the width, or stack the number over the plot. Merges plot S2.
- **S4. Bare plots disagree on what survives** (low, R). Some soft fills survive and some do not, and some notes survive and some do not. Seen in trend, density, fans and difference against area and streamgraph; connected against series. Fix by stating one rule in the bare branch and `scene.ts` note ranks. Merges plot S5, number S3.
- **S5. Band time labels start at the bar's centre** (low, R). Seen in diverging, waterfall, candlestick, ohlc and stacked at 480. Fix in `scene.ts`: anchor at the band edge. Merges x-axis S2.
- **S6. A connected scatter has no start or direction** (low, M). Seen in connected at 480 and 346. Fix in the preset: mark the first and last points. Merges points S2.
- **S7. Split bars lose their key at 280 to 319 px** (medium, M). Seen in grouped, stacked and marimekko. Covered by F2; keep the legend for bars. Merges labels S1, legend S3.

### Rows
- **S8. A height limit cuts a distribution into a different shape** (high, M). Seen in pyramid, likert, tornado, stem and strip at 100 tall, every width. Fix in those presets' rules: a block need of all rows, else the number. Merges rows S1. F3 is the base half.
- **S9. Likert is painted categorically and summarised by its largest point** (medium, M). Seen in likert at every width; the one line reads "Agree 33%". Fix in the likert preset: use `color-div-*`, and give the one line net agreement or skip it. Merges rows S3, legend S2, legend-top S3.
- **S10. Tornado is red against green with no key** (medium, M). Seen in tornado at every width. Fix in the preset: a CVD-safe pair, with names. Merges rows S4.
- **S11. Stem-and-leaf leaves are ellipsized** (medium, M). Seen in stem at 120. Fix in the stem rules: an inline need from the longest leaf run. Merges rows S2.
- **S12. In a ranked list, the dimension header sits over the rank** (medium, R/M). Seen in league at every width that shows the header. Fix in `rows.ts` `cell`: put it at column `lead + 1`. Merges columns S1.
- **S13. One row under a number reads as the whole list** (low, M). Seen in live at 100 tall. Fix in the `rows.ts` block rule: ask for about 3 rows. Merges rows S6.

### Radial
- **S14. A short, wide box loses the total and wastes the width** (medium, R). The circle shrinks to 76 px, the hole drops, and one legend line remains. Seen in donut, pie, rings, sunburst and half at 100 tall, 250 and wider (and at 480 natural). Fix in `radial.ts` `IN_BOX`: set the number or legend beside the circle. Merges radial S4, legend S4, hole S1.
- **S15. A gauge has no ends, and its target reads as a gap** (medium, M). Seen in gauge at every width. Fix in the gauge preset: end labels, and a target tick outside the ring in ink. Merges radial S1 (the target half).
- **S16. Radial-bar's maximum closes the ring** (low, R). Seen in rings. Fix in the preset: sweep at most 3/4 of a turn. Merges radial S3.

### Band
- **S17. The icon array drops the target its number states** (medium, M). Seen in icons at 480 and 346. Fix in `sceneGrid` and the band painter: mark the target cell with the reference paint. Merges band S1.
- **S18. A short box swaps a 6-line legend for 1 and leaves the room empty** (medium, R). Seen in mix, pie and rings at 100 tall, 480 to 170. Fix in the `LEGEND_SWAP` use: show whole rows that fit, then "+n more". Merges legend-top S1, legend S1.
- **S19. Too little gap under centred glyphs** (low, R). Seen in icons and parliament at 480. Fix by giving the unit key 8 px, as the axes have. Merges unit-key S3.

### Matrix
- **S20. Symmetric matrices name almost no columns, and cut row names lose what tells them apart** (medium, M). Seen in adjacency, correlogram and circles at 480 down to 170. Fix in `matrix.ts`: when x is the same dimension as y, say so once; use a middle cut for paths. Merges x-axis S1, y-axis S2.
- **S21. bins2d labels its two binned axes two ways** (medium, M). Seen in bins2d at every width. Fix in the matrix scene: edge ticks on both axes. Merges y-axis S1.
- **S22. stripes plans a y axis it never shows** (low; the plan and `explain()` mislead agents). Fix in core's matrix plan. Merges y-axis S4.

### Custom marks
- **S23. A Sankey between 280 and 319 px wide (or 120 and 139 tall) has unnamed grey targets** (medium, M). Fix in `LINK_RULES`: fall to the heatmap when the labels go. Merges labels S2.
- **S24. The geo note and "No data" read as one key** (medium, M). They mean opposite things. Seen in unmapped at 480 and 346. Fix in the geo painter: put a gap between them, or put the note after the keys. Merges note S1.
- **S25. Map symbols overlap with no order** (low, M). Seen in symbols at 480 and 346. Fix in the geo painter: draw the largest first, with a ring (points B4). Merges points S3, points B4.
- **S26. The smallest Sankey node is dropped without a mark** (low). Optionally merge it into "Other". Merges labels S3.

---

## What holds up

- The rows subgrid: headers, values and columns line up at every width with no measuring.
- Theme parity of the type: `-text` series steps, muted ink and tabular figures read the same in light and dark.
- One stroke weight (1 px non-scaling), a quiet 15% grid and a firmer baseline.
- The dot face itself is crisp on a 4 px grid, and it links the number, the legend values and the row values.
- The swatch atom (12 px, cannot be split from its name on wrap), and the `DOT` rule shared by marks and the size key.
- Step orders that work, worth copying: geo drops its map and keys together (ramp S3), isotype goes to bars, waffle to a share bar, parliament to a half donut, and the share bar to the number. Nothing is half cut by rows, and `aria-hidden` sits on chrome while the readout names the marks.
- Rose area is true, the radial order is consistent, separators use the background colour, and deltas pair an arrow with their colour.

## Decisions for you

| # | Decision | Raised by | Recommendation |
|---|---|---|---|
| D1 | Light sequential ramp: keep acid lime at the low end, and keep flipping hue per theme? | plot B2, ramp B4, ramp open question | Keep the lightness flip. Lower the chroma of light steps 1–3 so salience rises with value. |
| D2 | Dot-matrix face: may it step down (for example 3 × 5) for the hole and narrow rooms? | number open question, hole B1, radial B1 | Yes, as a `small` rung. Keep 5 × 7 as the headline face. |
| D3 | Should a number alone fill its room with unlit cells? | number B5 | Cap the screen at its content plus a cell, except in a declared grid of tiles. |
| D4 | Pixel face for words? | columns B3, y-axis B3, labels B4 | No. Pixel face for digits, label face for names (F5). |
| D5 | Should point plots have a sparkline form? | plot S1, points B1 | Yes, bare dots down to the cartesian floor. |
| D6 | Lines: direct labels first, legend as the fallback? | labels B2, legend open question | Yes, for up to about 6 lines (bump and slopegraph above all). Keep the legend first for bars. |
| D7 | Should the unit key drop before the glyphs (reference §10)? | unit-key S2, unit-key open question | No. Swap the glyphs to bars at the key's step. |
| D8 | Where is the metric named when only one number or column is left? | columns B1 and open question, hole B4, x-axis open question | The tldr or a caption always carries it; set one rule for all layouts. |
| D9 | Should the engine send the unmatched share for the geo note? | note B3 | Yes, as a companion field; core states it. |
| D10 | Denser row pitch under a height limit (`container.ts`)? | rows B1, rows open question | Yes, before cutting rows. |
| D11 | A wide radial: legend beside the circle, and the 160 px cap? | legend S4, radial open question | Keep the cap. Put the legend beside the circle above about 400 px. |
| D12 | Gauge number in its value colour, donut total in neutral? | hole B3, hole and radial open questions | Neutral for both; the arc carries the colour. |
| D13 | Should the waffle's height drop (240 to 100) at its swap? | band open question | Keep the grid while the container has its height (F9 lowers its width need anyway). |
| D14 | Ramp bins: equal value or quantile? | ramp B6, ramp open question | The engine decides. The ramp labels the bin edges at wide sizes. |

## Audit tooling to fix

For `apps/bench/capture.ts`, `measure` and `check.ts`:

1. **Boxes are holders, not ink.** `point-labels` and `points` measure an empty full-plot holder in about 34 samples, the rim measures the ring's inner box, and the axes' boxes do not hold their end labels. Measure the union of visible children, and create holders only when the scene has nodes (point-labels B3, points open question, rim open question, y-axis-2 B4, radial S2).
2. **Fallback views are not measured.** Waffle at 250 and below (and at 100), icons, parliament and isotype record `parts: {}` once they are another preset nested inside the view, so the share bar, gauge and half donut fallbacks go unchecked (band S2, radial open question, legend-top and legend open questions, rows open question).
3. **False clips.** A 0 px collapsed header or legend is reported as cut, though its stand-in shows (columns and legend open questions; 60 legend findings). The 4 px "clipped" on a value with no words under it is an empty row (most of number's 978). Intended layering is reported as overlap (Sankey `plot×labels`). Treat a 0-height part as hidden, and add exemptions for layering.
4. **Real clips missed.** `clipped` is measured against the part's own box, so labels past the view's edge read 0 (x-axis B1 "P 8", the `/pricing` label). Measure against the view too.
5. **The ladder misses the rules' thresholds.** No width falls in 280–340 (labels, the note, `y-axis-2` and the size key live only there; `point-labels` drops at 340; the bar legend swap happens there), none near 320 or 380 (`mid-tick`), and no height falls in 120–180 (line-end labels, the note, axis thinning). Add 300, 320 and 380 px widths and a 150 px height, or derive the ladder from `FIT_RULES`.
6. **No data states.** There are no `empty` or `no-prior` frames, so the notice layout, the "yet" wording and the number with no delta are unaudited (note open question).
7. **Free-width crops** land on bench furniture (point-labels S2).
8. **Missing samples for stress.** Add a dense, clustered labelled scatter (thinning never fires), a multi-series scatter, dots on a category line, a 12-slice rose, a treemap by metric (ramp under `partition`), long dimension values in `legend-top`, and a dual-axis view without unit symbols.
9. **The brief misquoted a finding.** The "point-labels clipped by 55 px" claim is in no record (point-labels open question). Generate task notes from `check.json`, not by hand.
10. **Possibly stale frames** at the parliament and waffle fallbacks (legend-top open question). Wait for layout to settle before the shot, and assert it.

## Coverage gaps

Nobody audited these:
- The **treemap (`partition`)** body: its 31–60 px clips are in `check.md` but unread.
- The **Sankey (`link`)** ribbons: only its labels were audited.
- The **map's own marks**: shapes, tiles, hexes, borders and the choropleth fill itself.
- The **tooltip, readout and crosshair** (`tip.ts`).
- **Keyboard focus, selection, emphasis and hover** (`rove.ts` `STATE`), and the legend's keyboard echo.
- **Empty and no-prior states**, and the `notice` layout.
- **Line-end labels**: never drawn in this capture.
- **Reference lines and labels** as a part of their own.
- **Ranges in cartesian** (`ranges.ts` beyond the sparkline).
- **Motion and transitions**: captured with motion off.
- **Forced colours and high contrast.**
- **RTL** (`pageWay`).
- **Title and caption**: not rendered in the frames.
- **Several views side by side** in a dashboard (cross-view consistency was inferred, not seen).
- **Heights between 100 and natural.**

## Index

| Report | Part | Base | Situational |
|---|---|---|---|
| [band](band.md) | share bar, unit grid | 4 | 2 |
| [columns](columns.md) | rows header | 4 | 1 |
| [hole](hole.md) | number in a ring | 5 | 2 |
| [labels](labels.md) | line ends, Sankey labels | 4 | 3 |
| [legend-top](legend-top.md) | one-line legend | 4 | 4 |
| [legend](legend.md) | full legend | 4 | 4 |
| [note](note.md) | geo "not shown" note | 4 | 2 |
| [number](number.md) | dot-matrix number | 5 | 4 |
| [plot](plot.md) | cartesian and matrix plot | 7 | 5 |
| [point-labels](point-labels.md) | scatter labels | 5 | 2 |
| [points](points.md) | dots | 4 | 3 |
| [radial](radial.md) | arcs | 5 | 4 |
| [ramp](ramp.md) | colour ramp | 6 | 3 |
| [rim](rim.md) | rose labels | 2 | 0 |
| [rows](rows.md) | rows layout | 7 | 6 |
| [size](size.md) | size key | 4 | 3 |
| [unit-key](unit-key.md) | unit key | 3 | 3 |
| [x-axis](x-axis.md) | x axis | 5 | 3 |
| [y-axis-2](y-axis-2.md) | far y axis | 4 | 2 |
| [y-axis](y-axis.md) | y axis | 5 | 4 |
| **Total** | | **91** | **60** |
