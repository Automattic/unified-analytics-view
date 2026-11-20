# point-labels

Source: packages/dom/src/layouts/points.ts (POINTS_CSS, measurePoints, paintPoints), packages/dom/src/chrome/label.ts (LABEL, cut, LABEL_CSS halo), packages/dom/src/measure.ts (thinLabels); labels made in packages/core/src/scene.ts (font `tick`, paint `ink`, halo, rank) and the rule in packages/core/src/fit.ts (`point-labels`, 340 × 180). Listed in 36 samples, all cartesian, but **drawn in 2**: `scatter` and `quadrant`. The other 34 only carry the empty `.uav-point-labels` holder.

## Summary
Where labels are actually drawn they read well: the halo works in both themes, positions are stable from 480 down to 346 px, and the horizontal nudge keeps every label inside the plot. The most important problem is the fixed 14-character end cut. It shortens three of nine labels at every width, 1240 px included, and on URL-like names it removes exactly the part that tells them apart. Second: the labels avoid only each other. They are never kept inside the plot vertically and never steer clear of reference lines or reference labels. The checker cannot see either problem, because the part's box is the holder (the whole plot), not the labels.

Note on the brief: in this capture no record shows point-labels clipped by 55 px. `clipped` is 0 for this part in every record. Its only findings are 12 × "3 cut short" (ellipsis) in `scatter` and `quadrant`, at natural height, at 480, 346 and free, in both themes. The tallest label (`/pricing`) does overhang the plot. That is real, but the view's top padding hides it here (B2).

## Base issues

### B1. Fixed 14ch end-truncation, blind to room and to the shape of the text
- **Severity**: high
- **What**: `cut('14ch')` caps every point label at 14 characters with a trailing ellipsis, whatever the plot width. `/docs/getting-s…`, `/blog/analytics-…` and `/blog/launch-no…` are cut at 346, at 480 and at 1240 (free). Path-like names share their prefix, so an end cut keeps the generic part (`/blog/…`) and drops the distinguishing tail. Two `/blog/` labels already read almost alike.
- **Evidence**: `parts/point-labels/quadrant-light-natural-480.png`; `parts/point-labels/quadrant-dark-natural-346.png`; `frames/quadrant/dark-natural-free.png` (1240 px wide, still cut); `frames/scatter/light-natural-346.png`; checker: 12 ellipsis findings, 3 per frame.
- **Why it matters**: a label exists to identify the point. A cut label that cannot be told from its neighbour fails at that job. A cut that does not relax when room is plentiful throws information away for no gain.
- **Where to fix**: `points.ts` POINTS_CSS (and `cut()` in `label.ts`). Let the cap follow the room: let the measured pass widen it until labels meet, then thin, and consider a middle cut (or keeping the last path segment) for identifier-like text.

### B2. No vertical containment: a label on a high point rises out of the plot
- **Severity**: medium
- **What**: `measurePoints` nudges labels only along x (`--uav-nudge`), and its own note says labels "never move up or down". A label always sits above its dot. A point near the top of the domain puts its label above the plot box: `/pricing` (5.8% on a 0–6% axis) overhangs the plot by about 8 px. It survives only because the view has about 10 px of top padding. A point at the domain maximum would push its label about 15 px past the view's top edge. Points at the top-left/right corners have no flip-below fallback either.
- **Evidence**: `frames/quadrant/light-natural-480.png` (label top at about y = 2, plot top at y = 10); `parts/point-labels/scatter-light-natural-480.png` and `parts/point-labels/quadrant-light-natural-480.png` (the crop, which is the plot box, cuts `/pricing` in half); same in dark (`parts/point-labels/quadrant-dark-natural-346.png`).
- **Why it matters**: labels must stay inside the view in every combination an agent might compose. Today that rests on the data's range staying below the axis top, which nothing guarantees.
- **Where to fix**: `measurePoints` in `points.ts`. When the label's top would pass the plot's top (or the view's), set it below the dot instead, and declutter on the resulting box. `place.ts` (core's declutter for static scenes) needs the same rule.

### B3. The part's measured box is the holder, so the checker under-reports and over-counts
- **Severity**: medium
- **What**: `paintPoints` always creates `.uav-point-labels` with `inset: 0` over the plot. So every cartesian sample reports a `point-labels` box the size of the plot, even with no label in the plan (34 of 36 samples). In the two real ones, the box is the plot, not the labels, so a label that leaves the plot (B2) reads as `clipped: 0`, and the crop slices it. The "36 samples, 8 sheets" for this part is almost all empty plots.
- **Evidence**: `capture.json`, e.g. `area`/`pareto`/`qq` have `point-labels` boxes with plan parts lacking `point-labels`; `sheets/point-labels/light-natural-3.png` (ohlc, pareto, qq, rug… rows with no labels); `parts/point-labels/scatter-light-natural-480.png` (`/pricing` cut by the crop, measure says 0 clipped).
- **Why it matters**: the audit and the checker are how this part is held to its promise. With a box that is not the part, real overflows pass and empty frames add noise.
- **Where to fix**: `paintPoints` (create the holder only when the scene has point-label nodes), and the bench's `capture.ts` measure for this part (take the union of the visible label boxes, not the holder).

### B4. Collision ignores everything but other point labels
- **Severity**: medium
- **What**: `declutter` is fed only the point labels. They are not tested against reference-line labels, the rules themselves, other dots, or the axes. In `quadrant`, `/blog/analytics-…` sits directly on the dashed "Converts at 3%" rule; its halo erases a run of the rule, which reads as a break in the threshold. `/pricing` nearly touches "1,000 visitors". In this data no two point labels collide, so the thinning pass is not exercised anywhere in the capture.
- **Evidence**: `parts/point-labels/quadrant-light-natural-480.png`; `parts/point-labels/quadrant-dark-natural-346.png`; `frames/quadrant/dark-natural-free.png`.
- **Why it matters**: a reference line is a claim about the data, and a label that breaks it, or crowds its caption, weakens both. This is the reference's Open 5 (label collision) and should be settled for all plot labels together, not per part.
- **Where to fix**: `measurePoints`/`thinLabels` in `measure.ts`. Feed the plot's other labels (`.uav-refs span`) and the rule positions in as fixed obstacles. Flag against Open 5.

### B5. Labels are as loud as the data and set in a different face from the axes
- **Severity**: low
- **What**: point labels use paint `ink` (full-contrast text) in the sans face. The axes' ticks (the same `tick` font role in the scene) render in the dot-matrix face, and reference labels in a muted grey. With nine labels, the black (light) or white (dark) text outweighs the green dots it annotates. The same role in two faces looks unplanned.
- **Evidence**: `frames/scatter/light-natural-346.png`; `frames/quadrant/dark-natural-free.png`.
- **Why it matters**: annotation should sit one step below the marks. The data, not its captions, should carry the eye first.
- **Where to fix**: core `scene.ts` (the paint for point labels: a secondary ink, or the point's own paint) and a decision recorded in `label.ts` on which face a plot label uses.

## Situational issues

### S1. The fit rule's window is never exercised, and its height half never fires on its own
- **Severity**: low
- **Composition**: `scatter`, `quadrant` (dot + text), the width ladder 480/346/250 and height 100.
- **What**: `point-labels` drops below 340 wide, while the `points` rule drops the whole plot to the number below 280. No width in the ladder falls between them, so the step "dots without labels" is never captured. At height 100 the `points` rule has already taken the plot, so the 180-tall need is also never seen alone. At 346 all nine labels still fit comfortably, which suggests 340 may be conservative for sparse data and too generous for dense data. The threshold is a width, not a density.
- **Evidence**: `frames/scatter/light-natural-346.png` (all labels, no crowding); `frames/quadrant/light-natural-250.png` (straight to the number, "Top: /").
- **Why it matters**: the step-down order (labels before dots, dots before plot) is right, but it is unproven between 280 and 340, and a fixed width cannot know how many labels there are.
- **Where to fix**: the bench ladder (add a width around 300) and, in time, the measured pass: thinning by collision already gives up labels as room shrinks, so the width rule could be relaxed to a floor.

### S2. Free-width crops for this part show bench furniture, not the view
- **Severity**: low
- **Composition**: every sample at width `free`.
- **What**: `parts/point-labels/*-free.png` crops land on the page's explain text, not the plot.
- **Evidence**: `parts/point-labels/scatter-dark-natural-free.png`.
- **Why it matters**: the free width is where B1 is most telling, and its crop cannot be used to judge it (the frame can).
- **Where to fix**: `apps/bench/capture.ts`, cropping at the free width.

## Works well
- The halo is the background token, it holds in light and dark, and it keeps labels legible over gridlines and rules.
- Horizontal containment: labels near the left and right edges (`/contact`, `/`) are nudged inside the plot, and positions match across themes and widths.
- Thinned labels keep their box (`data-thin`, `visibility: hidden`), so the pass converges and nothing jumps.
- Rank by point size or position, so the larger points keep their names first, is the right priority.
- `aria-hidden` on the labels, with the readout carrying names, avoids doubled announcements.

## Open questions
- What the "clipped by 55 px" in the task refers to: no such figure is in this capture's `capture.json` or `check.md` for any part of `quadrant` or `scatter`.
- How thinning looks when it does fire: no sample has colliding point labels. A dense labelled scatter in `moreSamples` (20+ points, clustered) would show it.
- Whether label tone should follow the point's series paint when a scatter has several series. Neither sample has more than one.
