# rows

Source: `packages/dom/src/layouts/rows.ts`, `packages/dom/src/layouts/track.ts`, `packages/dom/src/layouts/ranges.ts` (cartesian only, not seen here), `packages/dom/src/table.ts`; fit rules `marks`, `track`, `columns`, `legend`, `legend-top`, `unit` for layout `rows` in `packages/core/src/fit.ts`, and the `marks-block` rule in `rows.ts`. Seen in 15 samples across the rows layout: bars behind labels (pages, live, conversions, funnel), text only (league, stem), and tracks beside the label (bullet, cleveland, dumbbell, lollipop, strip, isotype, likert, pyramid, tornado).

## Summary
At natural height and 250 px or more the rows are clean. Labels, values and columns line up down the list in both themes, the type is calm, and the value column in the pixel face reads well. The part degrades badly at the edges, though. Under a short fixed height it silently cuts the list to its first two or three rows, with nothing to say more exist. At narrow widths it keeps the value and drops the label until a row is a number with no name. Tracks keep being drawn after they are too narrow to read. The most important problem is the silent cut at height 100 (96–192 px, three to six rows, hidden). For a ranked list it hides most of the data. For a pyramid, tornado, Likert or stem-and-leaf it gives a different picture.

## Base issues

### B1. A height limit cuts rows silently, and nothing says the list goes on
- **Severity**: high
- **What**: Under `IN_BOX` the list is rounded down to whole rows (`.uav-rows { max-block-size: round(down, …) }`) and the rest is `overflow: hidden`. Six- and eight-row lists show two or three rows, with no "+5 more", fade, count or other cue. The cut also leaves dead space under the last row: conversions at 480 has a 20 px empty band where a third row would almost fit. How many rows survive also depends on which other parts are present, not on the data. Conversions, funnel and league show 2 rows at 480/346, where the column headers take 20 px, but 3 at 250 and below.
- **Evidence**: `sheets/rows/light-100-1.png` and `light-100-2.png` (every list cut); `frames/conversions/light-100-480.png` (2 of 6 rows, empty band beneath); `frames/live/dark-100-250.png` (1 of 4 rows under the number, and it reads as the whole list); `check.md` "cut", rows: 148 findings in 14 samples, 96–192 px.
- **Why it matters**: Truncating a list without saying so misstates the size of the data. A reader of "/ 3" alone, or "Add to cart / Newsletter signup", has no way to know that 75% of the rows are missing.
- **Where to fix**: `rows.ts` (the `IN_BOX` rule) together with a fit step in `fit.ts`. First tighten the row pitch under a height limit (28 + 4 px is generous for one line of 13 px text). Only then cut rows, and when you do, give up the last visible row to a "+N more" line. If fewer than about three rows would show, step down to the number, as the `marks-block` rule already does at one row.

### B2. At narrow widths the value is kept and the label is given up, down to nothing
- **Severity**: high
- **What**: The `marks` rule promises the label 90 px, but the rank-0 value column is never given up and the label track is `minmax(0, 1fr)`. So the label is what absorbs the shortfall. At 120 px conversions reads "Ad… / Ne… / Ch… / Pur…" and funnel "Visite… / Viewe… / Starte…". League loses the label column entirely and becomes a column of ranks beside a column of numbers, with nothing to say what is ranked. Bar lists hang on to 120 px in this state while every track list has already become the number.
- **Evidence**: `parts/rows/league-light-natural-120.png` (rank and value only); `parts/rows/conversions-light-natural-120.png` (two-letter labels); `sheets/rows/light-natural-1.png` and `dark-natural-1.png`, 120 px column (conversions, funnel, league, live); `sheets/rows/light-natural-2.png` (pages "/docs/…", "/blog/a…" at 120).
- **Why it matters**: A value with no category is not data. A label cut to two characters is worse than none, because it looks like an answer.
- **Where to fix**: the `marks` rule for `rows` in `fit.ts`, together with the column `--uav-need` in `rows.ts`. The need should be the label's minimum plus the first value column's measured room, both counted, so the list steps down to the number before the label falls under about 6–8 characters. Text-only lists such as league must never show a value without its label.

### B3. The `track` rule measures the view, not the track, so tracks are drawn too thin to read
- **Severity**: high
- **What**: `track` needs 160 px of the view. Its comment budgets "the label's 90 px and 70 to read a mark's place in", but the value column (~55–60 px) comes out of the same room and the label may take 40cqi. At 170 px the track is about 20–25 px wide. Cleveland's eight dots then sit in a 22 px band, dumbbell's two ends overlap into one blob, lollipop stems are 0–15 px, and the bullet's measure is a sliver.
- **Evidence**: `parts/rows/dumbbell-light-natural-170.png` (pairs collapsed to overlapping dots); `sheets/rows/light-natural-1.png`, 170 px column (cleveland, dumbbell, lollipop, bullet); `sheets/rows/light-natural-2.png`, 170 px (strip all bunched, pyramid/tornado halves 10–20 px).
- **Why it matters**: A track is read by position. Squeezed below roughly 60 px, the differences it encodes stop being visible, but the chart still looks like a chart, so the reader is misled rather than told.
- **Where to fix**: the `track` rule in `fit.ts`. Count the value column's measured room as `marks` claims to (or give the rule `container: 'plot'`-like semantics on the track itself), so the track is hidden below a minimum of its own, about 70 px. With labels capped at 40cqi, that moves the step to about 220–250 px for tracks that also have a value column.

### B4. Tracks have no scale, reference line or key
- **Severity**: medium
- **What**: Track rows draw marks with no baseline, gridline, axis or zero line. Cleveland, dumbbell and strip dots float in empty space. The track's start moves with the label column, so a dot's position changes from width to width. Tornado and pyramid have no values and no axis, so a bar's length cannot be read as a number. Dumbbell's grey and green ends, tornado's red and green, and the bullet's two bands and its target tick are not named anywhere in the view at any width.
- **Evidence**: `parts/rows/cleveland-light-natural-480.png` (dots with no guide); `frames/tornado/light-natural-480.png` (no values, no key for red and green); `frames/bullet/light-natural-480.png` (bands and target unexplained); `sheets/rows/light-natural-1.png` dumbbell row.
- **Why it matters**: Position encodings need a reference to be compared across rows, especially when rows are far apart. An encoding with no key leaves the reader to guess what each colour means.
- **Where to fix**: `track.ts`. Give every track a faint zero or baseline rule (the shared `rule.ts` hairline) and, for dot tracks, light guide lines at the domain ends. Name the series and guides (comparison end, bands, target) through `chrome/legend.ts` as divided rows already are.

### B5. The bar tint is too loud in light and nearly invisible in dark
- **Severity**: medium
- **What**: The row bar is a series' `-soft` tint. In light it is a saturated lime that is the heaviest thing in any frame, much heavier than the values it sits behind. In dark it is a dim olive at roughly 1.3:1 against the surface, and the shorter bars almost disappear. The same data reads as a strong bar chart in light and as a faint table in dark. Neither tint meets 3:1 against the surface. Light gets away with it through saturation; dark does not.
- **Evidence**: `parts/rows/pages-dark-natural-250.png` against `sheets/rows/light-natural-2.png` pages row; `parts/rows/conversions-dark-natural-346.png` against `frames/conversions/light-natural-480.png`; `sheets/rows/dark-natural-1.png` live and funnel rows.
- **Why it matters**: The bar's length is the encoding. It should hold the same weight in both themes and stay below the text in hierarchy, without dropping below non-text contrast (WCAG 1.4.11).
- **Where to fix**: the `color-series-*-soft` aliases in `packages/tokens/config/charts.tokens.json` (and the dark common tier). Lighten the light tint toward a paler step, and raise the dark tint a step or two, so both sit at a similar contrast against their surface.

### B6. Mixed number formats within one column
- **Severity**: medium
- **What**: A value column switches between compact and exact form from row to row. Conversions' Value column reads $48.2k, $4,210, $39.8k, $31.7k, $9,900, $960. Funnel's reads 10.5k, 1,705, 655, 412. Next to each other, "$4,210" looks larger than "$39.8k" at a glance.
- **Evidence**: `frames/conversions/light-natural-480.png`; `sheets/rows/light-natural-1.png` funnel row (all widths, both themes).
- **Why it matters**: A column is for comparing down. One format and one precision per column is basic table practice.
- **Where to fix**: where the rows scene formats its cells (core `scene.ts` with `formatValue`). Choose the form once per column, from the column's largest value, and apply it to every row.

### B7. Row labels are inset 8 px; the legend and key under them sit at 0
- **Severity**: low
- **What**: Row labels and values have 8 px of padding (`PAD`), while the legend's swatches, the one-line legend and the bars start at the view's edge. The key under a divided list therefore starts 8 px left of the labels it sits under.
- **Evidence**: `frames/likert/dark-natural-346.png` (swatches at 0, labels at 8); `frames/pyramid/light-100-346.png` ("Female 53%" at 0 under labels at 8).
- **Why it matters**: A shared left edge is what groups the list and its key as one object.
- **Where to fix**: `rows.ts`. Inset the legend grid row by the same `PAD` as the labels (the bar can stay flush, since it is the label's ground).

## Situational issues

### S1. Under a short height, shape-dependent lists show a fragment that changes their meaning
- **Severity**: high
- **Composition**: lists whose order is a scale or a distribution, not a ranking: pyramid (age bands), likert (statements on a diverging scale), tornado (sensitivity sorted by swing), stem (stem-and-leaf), strip. Height 100.
- **What**: B1's cut keeps the first two or three rows. A pyramid cut to 18–24 and 25–34 is no longer a pyramid, and a stem-and-leaf missing its lower stems is a different distribution. Pyramid also spends 24 px of the 100 on a one-line legend that names only "Female 53%", so the other side of the chart is unnamed.
- **Evidence**: `frames/pyramid/light-100-346.png`; `sheets/rows/light-100-2.png` (pyramid, stem, strip, tornado); `sheets/rows/light-100-1.png` (likert, 2 of 5).
- **Why it matters**: Cutting a ranked list keeps its top items, which is defensible. Cutting a distribution falsifies its shape.
- **Where to fix**: the presets' fit rules (pyramid, likert, tornado, stem, strip). Give these a block need equal to all their rows at the tightened pitch, and step to the number below it, rather than inheriting the bar list's whole-rows cut.

### S2. Stem-and-leaf leaves are cut with an ellipsis
- **Severity**: medium
- **Composition**: stem sample, text-only rows with long leaf strings, 120 px.
- **What**: The longest stem reads "2 0011233 4 …". Leaves are data points, so the ellipsis drops observations without counting them, and at 100 px height whole stems go too.
- **Evidence**: `sheets/rows/light-natural-2.png` and `dark-natural-2.png` stem row, 120 px; `sheets/rows/light-100-2.png` stem, 120 px.
- **Why it matters**: The point of a stem-and-leaf is that every value is visible. One that is cut has stopped being one.
- **Where to fix**: the stem preset's fit rules. Give it an inline need from its longest leaf run, and step to the number (or the histogram it stands for) below that, rather than letting `text-overflow: ellipsis` apply.

### S3. The Likert scale is painted with a categorical palette
- **Severity**: medium
- **Composition**: likert, a divided bar on an ordinal scale (Strongly disagree … Strongly agree).
- **What**: The five levels are lime, green, teal, steel and rose, the series palette in order. The layout centres the bars on Neutral, which is right, but nothing in the colours is ordered or diverging. Disagree and agree are told apart only by reading the key. Light and dark both show it.
- **Evidence**: `frames/likert/dark-natural-346.png`; `sheets/rows/light-natural-1.png` likert row.
- **Why it matters**: An ordinal, two-sided scale calls for a diverging ramp with a neutral midpoint. Categorical hues imply unrelated groups.
- **Where to fix**: the likert preset (or its encoding of the divided series). Paint from the diverging tokens `color-div-*`, which already exist.

### S4. Tornado's two sides are red and green, with no key
- **Severity**: medium
- **Composition**: tornado (two bars per row on a shared centre).
- **What**: Low and high cases are red and green, without values, labels or a legend at any width. Red against green is the pairing most often confused in colour-vision deficiency.
- **Evidence**: `frames/tornado/light-natural-480.png`; `sheets/rows/dark-natural-2.png` tornado row.
- **Why it matters**: The tornado's meaning is carried by colour alone, by the riskiest pair.
- **Where to fix**: the tornado preset. Use the diverging pair (or `direction` paint with a CVD-safe pair), and give the sides names, either a one-line legend or end labels.

### S5. Unit glyphs round small values to look equal
- **Severity**: low
- **Composition**: isotype (`unit` mark in rows), small values relative to the unit.
- **What**: With no partial glyphs, Email (632) and Other (316) both draw one glyph, and AI assistants (842) draws two. A value twice another looks the same. Glyph pitch also changes with width: spread out at 480, touching at 346.
- **Evidence**: `sheets/rows/light-natural-1.png` and `dark-natural-1.png` isotype row, 480 and 346.
- **Why it matters**: Glyph count is the encoding, and rounding to whole glyphs at this scale reverses comparisons that the printed values contradict.
- **Where to fix**: `track.ts` with core's unit scene. Draw the last glyph partially (clipped to its fraction), and keep a fixed glyph pitch so the run's length, not its spacing, carries the value.

### S6. A list under the number keeps only one row
- **Severity**: low
- **Composition**: live (number above a bar list), height 100.
- **What**: The number and its gap take 72 px, which leaves one row ("/ 3"). It reads as the only page, not the top of four.
- **Evidence**: `frames/live/dark-100-250.png`; `sheets/rows/light-100-1.png` live row.
- **Why it matters**: As B1, and worse, because a single row looks like a complete answer.
- **Where to fix**: the `rows.ts` block rule, which today asks for one row's height. When a number already stands above the list, ask for about three rows and hide the list below that.

## Works well
- The subgrid: columns line up exactly down the list and under their headers at every width, with no widths set in code.
- Ranked columns step out right to left in a sensible order (conversions drops Value, then Conversion rate).
- The value face reads well in both themes, numbers are right-aligned, and header labels are quieter than values.
- League's change column pairs an arrow with its colour, so direction is not colour alone, and it uses a dash for no change.
- Isotype steps to a bar list at 250 instead of shrinking glyphs, which is the right fallback.
- Whole rows only: there are no half-cut rows at any height.
- Track labels cap at 40cqi and truncate with an ellipsis; the track keeps a gap inside its ends so end dots stay whole.

## Open questions
- `capture.json` records no parts at all for isotype at 250 and below, where it has become a bar list, so the checker cannot see that fallback. Is that a gap in `measure`, or intended?
- In conversions the first value ("1,310", on the bar) looks heavier than the values below it. Is that a halo or weight change for text over a bar, or an artefact of the capture?
- Is the Likert bar meant to centre on the middle of Neutral? It appears to, but with no axis this cannot be confirmed from the pictures.
- Would the authors accept a denser row pitch under a height limit (B1)? That is a change to `container.ts` `rows.rowHeight`, not only to the fit rules.
