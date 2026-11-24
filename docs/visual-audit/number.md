# number

Source: `packages/dom/src/dots.ts` (the screen and the face), `packages/dom/src/view.ts` (the number's rules, lines 69–104), `packages/dom/src/measure.ts` (`fitNumber`, `readNumber`, `SCREEN_LEAST`), with the forms built in `packages/core/src/scene.ts` (the number's nodes) and `packages/core/src/place.ts` (`NUMBER_SHORT`, `DELTA_FULL`, `NOTE_LEAST`). Seen in 58 samples across cartesian (34), rows (14), matrix (7), band (2) and none (1).

## Summary
Where it has room, the number holds up well. The dot face is crisp and the same in both themes, the screen keeps a whole-cell rhythm, and the delta and note sit on its rows. Its main problem is what happens when the value does not fit. On a screen, `fitNumber` keeps the last form and lets the room cut it, down to 44 px, so at 80 px (57 of 58 samples) and in some 120 px frames the value loses its magnitude suffix or unit. It then reads as a different number: `10.5k` shows as `10.`, `$63.5k` as `$63`, `436ms` as `436`. Of the checker's 978 "cut" findings, the 4 px ones on a value with no words under it are invisible. The same 4 px under a note or delta is visible: the descenders are cut, so `Top` reads `ToP` and `getting` reads `9etting`. The 16–64 px ones are the value-truncation problem.

## Base issues

### B1. A value too wide for its screen is cut, and the cut reads as a different number
- **Severity**: high
- **What**: when no form fits, `fitNumber` keeps the last form on a screen as long as the room is at least `SCREEN_LEAST` (44 px). The screen then cuts it at a whole cell, and the end can only be seen by hovering, when the number scrolls. The cut falls on the suffix or unit, so a value 1000 times too small, or one with no unit, is left showing. The cut lands on a cell boundary, not a glyph boundary, so a sliver of the next glyph remains. That sliver can pass for a character: the `1` of `25.1k` shows as a `:`. The `small` form does nothing here, because a cell is 4 px whatever the font size, so a screen has no shrink rung before the cut. Compact values (`25.1k`) have no shorter `short` either, so the ladder is really a single rung.
- **Evidence**:
  - `10.5k` → `10.` + sliver: `parts/number/bubble-light-natural-80.png`, and grouped, lollipop, scatter, series and sparkline at 80 (`sheets/number/light-natural-3.png`, `-5.png`).
  - `$63.5k` → `$63.5` at 120 (24 px) and `$63` at 80 (64 px): difference, `sheets/number/light-natural-2.png`.
  - `436ms` → `436MS` with the S half gone at 120 (8 px), and `436` at 80 (48 px): `parts/number/box-light-100-120.png`; candlestick, errors, fan, fans and ohlc, dark and light (`sheets/number/dark-100-3.png`).
  - `1.3k` → `1.3` + part of a K: `parts/number/likert-light-natural-80.png`; pareto and slopegraph at 80 behave the same way.
  - `25.1k` → `25.` + a `:`-like sliver in every 25.1k sample at 80: `frames/total/light-natural-80.png`.
- **Why it matters**: the headline value is the one thing a reader takes from a KPI. Dropping the magnitude suffix or unit is a silent misstatement of the data, not a lost detail. The scroll on hover does not help on touch, in a static dashboard, in a screenshot or in print. No other part fails as badly.
- **Where to fix**: core's number scene (`scene.ts`, the value's forms) and `fitNumber` in `measure.ts`. Add a lower-precision compact rung that keeps the suffix and unit (`25k`, `11k`, `$64k`, `0.4s`). When even that does not fit, fall to prose instead of cutting the value. If a cut is kept anywhere, make it land on a slot boundary and show that it is cut.

### B2. Descenders in the note and the delta are clipped, which changes how the words read
- **Severity**: high
- **What**: on a screen, each line of words is set to a line-height of exactly 5 cells (`.uav-number:has(> b .uav-glyphs) > span`). Those spans also have `overflow: hidden` (`.uav-number > span`), so the row below the baseline is cut off. The result: `p` loses its stem and reads as a capital `P` (`ToP: DesktoP`, `on the Previous Period`). `g` loses its tail and reads as `9` (`9etting started`, `ri9ht now`), and `y` is shortened. This is the visible part of the checker's 4 px "clipped" findings. The 4 px on a value with no words under it is an empty row of the slot and cannot be seen.
- **Evidence**:
  - `parts/number/embedding-light-natural-250.png` (`ToP: 9etting started`) and `parts/number/bullet-light-natural-120.png` (`ToP: DesktoP`).
  - `parts/number/live-dark-100-170.png` (`ri9ht now`).
  - total at every width with the long delta (`sheets/number/light-natural-6.png`, `dark-natural-6.png`).
- **Why it matters**: lowercase that turns into capitals looks like a typo. A `g` that reads as `9`, right beside a figure, is a misread waiting to happen. These are two of the three lines the part shows.
- **Where to fix**: `DOTS_CSS` in `dots.ts`, together with the `.uav-number > span` rule in `view.ts`. Either give a line of words on the screen room for its descenders (6 cells, or let its overflow show in the block direction), or stop clipping those spans vertically. Keep the cutting for the inline direction only.

### B3. The note and the long delta are measured without the screen's padding, so they are cut short instead of given up
- **Severity**: medium
- **What**: `readNumber` measures the delta and the note in the ruler at `max-content`, with no padding. The live number on a screen adds one cell of padding on each side, 8 px in total. So `fitNumber` keeps the long delta, or the note, in rooms 8 px too narrow, and the stylesheet then ends it with an ellipsis. Its own promise is to take the short delta, or `no-note`, "when it would be cut". The checker counts 56 ellipses in 14 samples: 13 at 120 px with a note (`Sum of daily coun…`, `Top: Easy to set …`, `Top: getting star…`), and total at 250 px with `↑ 14% on the previous peri…` when the short `↑ 14%` was available.
- **Evidence**: `sheets/number/light-natural-6.png` (total 250, trend 120); `parts/number/likert-light-natural-120.png`; `parts/number/trend-dark-natural-120.png`; bump, connected and dual at 120 (`sheets/number/light-natural-1.png`, `-2.png`).
- **Why it matters**: a delta that ends in "peri…" is noise when its short form says everything it needs to. The note promises to step down cleanly, and here it does not.
- **Where to fix**: `readNumber` or `fitNumber` in `measure.ts`. Count the screen's two padding cells when comparing the delta's and the note's widths with the room. Measuring them inside a padded screen in the ruler would do the same.

### B4. Units in small caps lose their case, so `ms` reads as `MS`
- **Severity**: medium
- **What**: units are set with `font-variant-caps: all-small-caps` (`.uav-glyph-run sup`), so `436ms` shows as `436MS`. The face's set has both `m` and `M`, and both come out as the same small capital. `k` is the only unit that survives this unharmed.
- **Evidence**: `parts/number/box-light-100-120.png`; `sheets/number/dark-100-3.png` (errors, fan, fans).
- **Why it matters**: case carries meaning in units. `M` is mega or million, and `m` is milli or minutes. A latency of `436MS` invites a misread, and with two-letter units such as `ms` the problem will recur.
- **Where to fix**: `.uav-glyph-run sup` in `dots.ts`. Keep the unit's own case, perhaps quieter in size or tone, rather than forcing small caps.

### B5. A number alone fills its room with a field of unlit cells, however little it holds
- **Severity**: low
- **What**: alone, the screen is as wide as its room. At 480 px that is a grey panel about 480 × 60 px (light) or a dark olive one (dark), holding a short value in its corner (`303`, `• 7`, `25.1k`). Beside a bare plot, the same screen is only as wide as its value. The field is quiet, about 9% tint, but its area grows with the room while its content does not.
- **Evidence**: icons, live and total at 480 and 346 (`sheets/number/light-natural-3.png`, `-4.png`, `-6.png`); compare trend beside its plot in `frames/trend/light-100-480.png`.
- **Why it matters**: a large empty panel draws weight away from the figure and sets a box edge that lines up with nothing else in the view. The intended upside, equal screens in a row of equal rooms, holds only in a grid.
- **Where to fix**: `.uav-glyphs` sizing in `dots.ts`. This is a design call (see Open questions). One option is to cap the screen at the width of its widest line plus a cell, as beside a bare plot.

## Situational issues

### S1. Beside a bare plot the plot hangs on as a sliver
- **Severity**: medium
- **Composition**: cartesian views whose number steps beside a bare plot, when the number is wide (a `$` prefix with a delta, or a unit), at 170 px.
- **What**: the number keeps its full width, 116–140 px, and the plot gets what is left: 18 px for difference, 34 px for box and candlestick, 42 px for area, bump and density at 170. An 18 px plot is a green scribble with no information in it.
- **Evidence**: `frames/difference/light-natural-170.png` (plot box 18 px wide in `capture.json`); box and candlestick at 170 (`sheets/number/light-100-1.png`).
- **Why it matters**: a mark with no readable shape adds clutter and suggests a trend that cannot be read. The number alone would read better.
- **Where to fix**: the cartesian fit rule that brings the number in beside a bare plot (`packages/core/src/fit.ts` and `place.ts`). Have it require a minimum plot width beyond the number's measured width, rather than the view's width alone, and drop the plot below that.

### S2. Beside a bare plot the value is shorter than when it stands alone in a narrower room
- **Severity**: low
- **Composition**: a bare plot beside the number, for values that have a long form (`1,084`, `5,674`, `1,265`).
- **What**: beside a plot at 480–170 px, pareto shows `1.1k` and slopegraph `5.7k`. Alone at 120 px they show `1,084` and `5,674`. Precision goes up as the room shrinks. The number beside the plot carries no `data-fit`, so the layout's own small or short setting applies at any width.
- **Evidence**: `sheets/number/light-100-4.png` (pareto); `sheets/number/light-natural-5.png` (slopegraph).
- **Why it matters**: the same value should not gain digits as its room shrinks. A reader comparing tiles of different widths sees `1.1k` beside `1,084` and wonders whether they differ.
- **Where to fix**: the bare-plot branch in `place.ts` and `view.ts` (`.uav-number:not([data-fit])`). Choose the form from the room, as `fitNumber` does, not from the layout.

### S3. Whether the note survives beside a bare plot varies from sample to sample
- **Severity**: low
- **Composition**: cartesian views beside a bare plot at 250 and 170, natural height.
- **What**: connected keeps `Sum of daily counts`, while series, spaghetti, sparkline, stacked and bump give up the same note. Scatter, quadrant, bubble, qq, rug and embedding keep their `Top: …` note. The pictures show no rule a reader could infer.
- **Evidence**: `sheets/number/light-natural-2.png` (connected and dual at 250); `sheets/number/light-natural-5.png` (series, scatter).
- **Why it matters**: when agents compose open-endedly, the same metric should look the same in the same composition.
- **Where to fix**: the note's rank in `scene.ts` (`sub(note, 1)`) and how the bare-plot layout treats a ranked note. Make one rule and apply it to every bare plot.

### S4. An empty value standing alone says nothing
- **Severity**: low
- **Composition**: a null or empty value (`—`): circles, correlogram, embedding, qq, rug and tornado, at 80 and 40.
- **What**: once the note goes, the screen holds only a dash. Because the dash fits in 40 px, it outlives every real value, which falls to prose at that width.
- **Evidence**: `sheets/number/light-natural-1.png` (circles at 40); `sheets/number/light-natural-3.png` (embedding at 80 and 40).
- **Why it matters**: a dash on its own does not tell the reader what is missing. The prose would.
- **Where to fix**: `fitNumber`. Treat a value with no figure as not fitting once its note has gone, so the view falls to prose.

## Works well
- The dot face is crisp at 2×. Glyphs, unlit cells and spacing are on one 4 px grid in every crop, and value, delta and note share the screen's rows.
- Theme parity is good. Lime on dark olive and near-black on warm grey are both high-contrast, and the unlit field is visible without being loud in either theme.
- The delta pairs an arrow with its colour, so its direction never rests on colour alone. The short form (`↑ 14%`) is a good rung.
- The step order is sound where it works: beside a bare plot when there is height, alone at 120 and below, prose at 40.
- Beside a bare plot the number is centred on the plot's height (y 32 of 100), with a clean gap (12 px) to the plot.
- The words stay in the document for screen readers and forced colours (`.uav-glyphs-text`).

## Open questions
- Is the full-width screen (B5) a deliberate dashboard device, meant to make equal rooms show equal screens? If so, should it be kept for the number alone and never in a single view on a page?
- Can the dot face itself step down a size (for example a 3 × 5 glyph) as the `small` form, or is the 5 × 7 face fixed by the direction? A smaller face would give B1 a rung before precision has to be dropped.
- Notes such as `Top: /` (adjacency, cleveland, dumbbell, quadrant, scatter) come from the fixture's page path. Such a note is unreadable on its own, and it is unclear whether the note should name the dimension (`Top page: /`).
- In dark, the up delta's green sits close in hue to the lime value, so the delta reads as part of the figure. A colour contrast check of `delta.good` against `color-label-screen` on the screen field would settle it.
