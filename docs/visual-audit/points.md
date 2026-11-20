# points

Source: `packages/dom/src/layouts/points.ts`, `packages/dom/src/chrome/swatch.ts` (`DOT`), `packages/dom/src/chrome/size.ts`; sizes from core (`sizeStep`, `SIZES`, `sizeKey` in `packages/core/src/scene.ts`, `radius` in `place.ts`); fit rule `points` in `packages/core/src/fit.ts`. The capture records the part in 41 samples (cartesian, geo, geo-tiles, geo-hexes), but the `.uav-points` holder sits empty over every cartesian plot. Only 8 samples actually draw dots in it: bubble, connected, embedding, qq, quadrant, rug, scatter (cartesian) and symbols (geo). The part shows at 480, 346 and free width, and only at natural height.

## Summary
At full size the dots work in both themes. The unsized 6 px dot is crisp, the lime dot on near-black is strong in dark, the 0.7 opacity on sized dots helps with overlap, and the key to sizes draws exactly the plot's dot. The most important problem is the fallback. Below 280 × 120 a plot of points does not step down. It is replaced outright by the number, and for samples with no headline total that number is a dash, which leaves the view almost empty, even at 480 × 100. The second problem is that sized dots do not encode value by area: the steps make large values look too small, and the key labels each step with its upper bound.

## Base issues

### B1. A plot of points goes straight from everything to nothing, and often to an empty number
- **Severity**: high
- **What**: The `points` rule (needs 280 wide, 120 tall) hides the whole body through `POINTS_FIT` and shows the number alone. A line, bar or area plot keeps a bare plot down to 152 × 46. A scatter loses its plot at the 346 → 250 step, and at any width when the view is 100 tall. In qq, embedding and rug there is no total, so the number that replaces the dots is a dash ("-----") with a tldr line. A 480 × 100 view is then about 80% empty. The unit-dot samples (units, wilkinson) do keep a bare mini plot at 250, so dots already have a sparkline form elsewhere in the system.
- **Evidence**: `frames/qq/light-100-480.png` (dash and "Top: 95%", rest blank); `frames/embedding/dark-100-480.png` (same); `frames/scatter/light-natural-250.png` (number alone); compare `frames/series/light-100-480.png` (number and a sparkline) and `frames/wilkinson/light-natural-250.png` (number and a bare dot plot). Every `sheets/points/*` sheet has empty 250 → 40 columns for all dot samples.
- **Why it matters**: The fallback is abrupt and is not consistent across layouts. A distribution shape (qq, rug, clusters) reads well with no axes at 250 × 100, and the dash replacing it says nothing. An agent putting a scatter into a dashboard tile gets a blank tile.
- **Where to fix**: The `points` fit rule in `fit.ts` and `POINTS_FIT` in `points.ts`. Let points step down like other plots: drop the axes and point labels first, keep the bare dots (unsized, or sizes clamped) down to roughly the plot's 152 × 46, and fall back to the number only below that, or only when a number exists.

### B2. Sized dots understate value: the area is not proportional, and the key labels upper bounds
- **Severity**: medium
- **What**: `sizeStep` sorts a value into 4 steps by sqrt(share). `DOT` then draws 9, 14, 19 and 24 px across, which is a fixed base plus a linear step. The areas are 1 : 2.4 : 4.5 : 7.1, while the value bands' upper bounds are 1 : 4 : 9 : 16, so the largest values look about half as big as they should next to the smallest. The key's labels (`sizeKey`: 301, 1.2k, 2.7k, 4.8k; or 486, 1.9k, 4.4k, 7.8k) are each step's upper bound, but they read as "this dot = this value".
- **Evidence**: `frames/bubble/light-natural-480.png` (key "301 · 1.2k · 2.7k · 4.8k", with dots of 9 to 24 px); `frames/symbols/dark-natural-346.png` (key "486 · 1.9k · 4.4k · 7.8k"; the US and Europe dots look closer in size than their values are).
- **Why it matters**: Area is the channel a reader decodes for bubbles. A base offset adds a lie factor that grows with the ratio. Binning to 4 steps also hides differences within a step, and the key does not say that it does.
- **Where to fix**: Core's `radius` (`place.ts`), which `DOT` reads back, and `sizeKey` in `scene.ts`. Make area proportional to the step's value, keeping a minimum only as a visibility floor below step 1. Label the key as ranges ("≤ 301") or with each step's representative value, not its ceiling.

### B3. The dot of an incomplete period is drawn at full strength
- **Severity**: medium
- **What**: In a joined plot the last segment is dashed, the system's sign for the current, incomplete period. Its dot is drawn solid, the same as every complete point. Bars and areas fade their partial row (dual, stacked, area), but dots do not.
- **Evidence**: `parts/points/connected-light-natural-480.png` (dashed segment to the far-left dot, which is solid); `sheets/points/dark-natural-1.png`, connected row, at 480 and 346.
- **Why it matters**: The same data state should look the same in every mark. A solid dot asserts a final value that the dashed line around it says is provisional.
- **Where to fix**: `paintPoints` / the dot rule in `POINTS_CSS`, keyed on the scene's partial flag. Give a partial point the same fade (or hollow) treatment bars and areas use.

### B4. Dots have no separation from each other
- **Severity**: low
- **What**: Dots are flat fills with no ring, so coincident or touching dots merge into one blob. Unsized dots are fully opaque, so two at the same place look like one.
- **Evidence**: `parts/points/connected-light-natural-480.png` (pairs near x ≈ 630 and 415 merge); `frames/symbols/dark-natural-346.png` (Europe's sized dots fuse even at 0.7 opacity).
- **Why it matters**: Overplotting hides the count of points, which matters most in scatter and embedding plots.
- **Where to fix**: The dot rule in `POINTS_CSS`: a thin ring in the surface colour (a token, as the halo on labels is) on every dot, so overlaps show as edges.

## Situational issues

### S1. Dots and their labels at the top of the domain overflow the plot
- **Severity**: low
- **Composition**: The largest sized dot, or a labelled point, at or near the y maximum (bubble, scatter, quadrant).
- **What**: The 24 px dot at 5.8% in bubble pokes above the plot box into the 10 px top margin. In scatter and quadrant the top point's label ("/pricing") is cut off above the plot. The scale domain is not padded for the dot's radius or a label's height.
- **Evidence**: `parts/points/bubble-dark-natural-480.png` (top bubble cut at the crop edge); `parts/points/scatter-dark-natural-480.png` and `sheets/points/light-natural-3.png`, quadrant and scatter at 480 and 346 ("/pricing" clipped).
- **Why it matters**: In a tighter composition (a number or legend above), the dot or label would collide with its neighbour. A clipped label cannot be read.
- **Where to fix**: Core's cartesian placement (`place.ts`, top margin for point scales), or the y domain nice-ing when the plan has `size` or `point-labels`. Reserve the largest radius, plus a label line when labels are on.

### S2. A connected scatter has no start or direction
- **Severity**: low
- **Composition**: The `connected` sample: a line joining dots of two metrics, in time order, that crosses itself many times.
- **What**: Every dot is identical, so the reader cannot tell where the path begins or which way it runs. The only clue is the dashed segment at the end.
- **Evidence**: `parts/points/connected-light-natural-480.png`; `sheets/points/dark-natural-1.png`, connected at 346.
- **Why it matters**: A connected scatterplot is read in sequence. Without an anchor it is a tangle.
- **Where to fix**: The connected preset or the joined-path case in `paintPoints`. Mark the first and last points (for example a hollow start and a labelled end), or step the opacity along the path.

### S3. Overlapping symbols on a map in dense regions
- **Severity**: low
- **Composition**: Geo `symbols` with several large values close together (Western Europe).
- **What**: Sized dots stack at 0.7 opacity with nothing to show which is which. A smaller dot can sit under a larger one.
- **Evidence**: `frames/symbols/dark-natural-346.png`; `sheets/points/light-natural-4.png`, symbols at 480 and 346.
- **Why it matters**: The values of neighbouring regions cannot be compared or even counted.
- **Where to fix**: The geo painter's draw order (largest first, so small dots sit on top), together with the ring in B4.

## Works well
- The key to sizes and the plot share one dot (`DOT` read back from core), so a key dot and a plot dot of the same step are exactly the same size (checked in bubble and symbols).
- Theme parity: lime on near-black (dark) and green on cream (light) both have good contrast. The key's muted grey stays quieter than the data in both themes.
- The unsized 6 px dot is crisp and well weighted against gridlines and rules (qq, rug, embedding).
- The 0.7 opacity on sized dots is a sensible default for overlap.
- Dots line up exactly with axis values and rules (qq diagonal, rug ticks under the dots).

## Open questions
- The capture records `points` for every cartesian and geo sample because the empty holder fills the plot. Should the checker count the part only when it has a dot (`.uav-points > i` or `.uav-dots > i`)? As it stands, "41 samples" overstates the part by about five times.
- No sample shows dots on a time or category line (`.uav-dots`), a dumbbell or a strip. Their look and fallback could not be judged.
- The dashed last segment in connected is read here as the incomplete period (B3). This is assumed from the convention elsewhere and not confirmed in the scene.
- units and wilkinson draw round glyphs that look like points, but they are the `unit` mark under rules of their own. They were not judged here, beyond the contrast in B1.
- Focus, selection and hover states of a dot are not in the capture.
