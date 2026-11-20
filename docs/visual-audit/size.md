# size

Source: `packages/dom/src/chrome/size.ts`, `packages/dom/src/chrome/swatch.ts` (and the scene half, `sizeKey` in `packages/core/src/scene.ts`, with `radius` in `packages/core/src/place.ts`). Seen in 3 samples across cartesian (bubble), matrix (circles) and geo (symbols), at natural height only, at 480, 346 and free (and 250 for circles).

## Summary
The key is quiet, well placed and the same in all three layouts: one line flush left under the plot, in the tick face and muted ink, with dots drawn by the very rule that draws the marks, so a key dot is the size of a plot dot. Its weak point is what it says: the labels are the top of each bin, shown as if they were the dot's value, and the dots' areas do not grow in the ratio the labels claim. Its fallback is the other problem: it overflows by hiding whole items (circles at 250 loses the label of its largest dot), and between the key's threshold and the marks' threshold the sized marks stay with nothing to explain them.

## Base issues
### B1. Labels state the top of a bin as if it were the dot's value
- **Severity**: medium
- **What**: Sizes are four steps, by area (`sizeStep`), and each label is `top × (s/4)²`, the most a step stands for. The key shows "301 · 1.2k · 2.7k · 4.8k" with no sign that each is an upper bound, so the smallest dot reads as "301" when it means "0 to 301". Compact formatting then rounds the bound itself: circles' first step is 0.0625 and reads "0.1", the third is 0.5625 and reads "0.6". The bounds are also uneven numbers (301, 1.9k, 4.4k, 7.8k) rather than round ones.
- **Evidence**: `parts/size/bubble-light-natural-480.png`, `parts/size/symbols-dark-natural-346.png`, `parts/size/circles-light-natural-480.png` ("0.1" for a step that ends at 0.06).
- **Why it matters**: a binned encoding should say it is binned. A reader matching a dot to the key gets a single value, often the wrong one by a whole step, and a rounded bound can put a value on the wrong side of its own step.
- **Where to fix**: `sizeKey` in core: say the bins as ranges or bounds ("≤ 301", or the steps' edges), and format a bound so it never rounds across a step edge.

### B2. Dot areas do not grow in the ratio the labels claim
- **Severity**: medium
- **What**: `radius = 2 + 2.5 × step` gives diameters of 9, 14, 19 and 24 px, so areas run about 1 : 2.4 : 4.5 : 7.1, while the labels (by area, `(s/4)²`) run 1 : 4 : 9 : 16. The smallest step is drawn at about 14% of the largest's area for values that are at most 6% of it. Key and marks share the rule, so they agree with each other; it is the encoding the key describes that is off.
- **Evidence**: the source (`place.ts` `radius`, `swatch.ts` `DOT`); visible in `frames/bubble/light-natural-480.png` and `frames/symbols/dark-natural-480.png`, where the key's "301" dot is far more than a sixteenth of the "4.8k" one.
- **Why it matters**: size is read as area; a key that labels area ratios it does not draw has a lie factor, here of about 2 at the small end. The floor that keeps a small dot visible is fair, but then the labels must follow the drawn areas.
- **Where to fix**: core's `radius` / `sizeStep` pair: either make the drawn area proportional to the labelled values above a stated floor, or derive the labels from the drawn areas.

### B3. Overflow hides whole items, the largest first
- **Severity**: medium
- **What**: `.uav-size` is a wrapping flex line with a fixed block size and `overflow: hidden`. When it does not fit, the last item wraps onto a hidden second line: no ellipsis, no clipping signal, just gone. That last item is the label of the largest dot, the key's anchor value.
- **Evidence**: circles light and dark, natural, 250: `parts/size/circles-light-natural-250.png`, `parts/size/circles-dark-natural-250.png` (the 24 px dot stands with no "1"; checker: 14 px clipped).
- **Why it matters**: a key missing its top value can't be read for scale, and nothing tells the reader that something is missing.
- **Where to fix**: `size.ts` (the step down when it can't fit) and the size fit rule in `packages/core/src/fit.ts`: let the key give up its middle steps first (keep the smallest and the largest with their labels), or hide it whole, never its last label.

### B4. The fit rule is a fixed width for a content-dependent line
- **Severity**: medium
- **What**: The key's room is a fixed number per layout (cartesian 320, matrix 240), but its width depends on the metric's name and the formatted values. "Correlation 0.1 … 1" needs about 264 px, so the matrix's 240 lets it show at 250 and cut. A longer metric name ("Average order value") would cut in any layout.
- **Evidence**: `check.md` "What each part promises" (size: matrix 240 wide); the cut at circles 250 above; bubble and symbols are only spared by the higher cartesian threshold.
- **Why it matters**: agents compose views with metrics nobody has tried; a rule that holds only for short names will fail in production combinations.
- **Where to fix**: the size fit rule: work its width out from the key's own content (as the measured pass does for labels), or have the measured pass hide the key when its line overflows.

## Situational issues
### S1. Sized marks stay after their key has gone
- **Severity**: high
- **Composition**: matrix with dots (circles) between the marks' threshold (150 wide) and the key's (240); the same window exists for cartesian between points (280) and key (320), not captured at the sampled widths.
- **What**: At 170 the circles grid still draws dots in four sizes and two hues, with neither the size key nor the ramp: size and colour are both unexplained.
- **Evidence**: `frames/circles/light-natural-170.png`; the empty 170 cells for circles in `sheets/size/light-natural-1.png` and `sheets/size/dark-natural-1.png`.
- **Why it matters**: an encoding with no key reads as decoration at best and as a false ranking at worst. A view that can't explain its sizes should fall back to the number or a form that needs no key (symbols does this well, stepping down to bars).
- **Where to fix**: the matrix fit rules in `fit.ts`: when size is encoded, the dots' threshold should not be below the key's (or the dots should fall back to plain cells, coloured only, under it).

### S2. The neutral grey of the key is a data colour in the correlogram
- **Severity**: medium
- **Composition**: matrix with a diverging colour ramp and size on the same metric (circles).
- **What**: The key's dots are `ink.muted` grey. In circles the ramp's midpoint ("0") and the near-zero dots in the grid are the same warm grey, so the key's dots read as "correlations near 0" rather than as neutral size swatches.
- **Evidence**: `frames/circles/light-natural-250.png` and `frames/circles/light-natural-480.png` (ramp's "0" swatch and the grid's grey dots against the key's dots); dark the same.
- **Why it matters**: the key's colour should carry no data meaning; here it carries one by accident.
- **Where to fix**: the matrix layout (or the size key's paint where a diverging ramp is present): draw the key's dots as outlines, or in a paint the ramp never uses.

### S3. The key does not say that size is the magnitude
- **Severity**: low
- **Composition**: size on a metric with negatives (circles: size by how far a correlation is from zero).
- **What**: The key reads "Correlation 0.1 0.3 0.6 1"; nothing says that −0.6 is drawn as large as 0.6. Colour carries the sign, but the key, read alone, implies negatives are small.
- **Evidence**: `parts/size/circles-light-natural-480.png`; the sample's own description in `packages/fixtures/src/index.ts` says "sized by how far its correlation is from zero".
- **Why it matters**: a size key should name what size stands for.
- **Where to fix**: `sizeKey` in core: when the metric's domain runs below zero, title the key as magnitude (for example "|Correlation|" or "Correlation, either sign").

## Works well
- Key dots are drawn by the same `DOT` rule as the plot's and the map's dots, so a key dot matches a mark dot exactly, in every layout.
- One placement everywhere: a full-width line under the plot, flush with the axis labels' left edge, with the view made taller by a fixed block for it, so the plot never shrinks to make room.
- Tick face in `ink.muted`: it sits below the axes in weight and doesn't compete with the marks; legible in both themes, with dot and label colour shifting together in dark.
- Neutral (not series-coloured) swatches, which is right for a size key in a single-series view.
- In geo, the view steps down to bars before the key would cut, which is the right fallback for a sized encoding.

## Open questions
- Whether the cartesian 280–320 px window (sized points shown, key hidden) happens in practice: no frame width falls in it.
- Whether the key should match the marks' 0.7 opacity; solid looks cleaner but no longer matches how a mark looks.
- The title and the values share one weight and colour; at four steps it reads, but whether the title should be set apart (as the axes' titles are, if they are) wasn't settled from these pictures.
