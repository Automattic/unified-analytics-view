# rim

Source: packages/dom/src/layouts/radial.ts (CSS `.uav-rim`, `measure`), packages/dom/src/chrome/label.ts (`LABEL`), packages/dom/src/measure.ts (`thinLabels`), with the labels' points and ranks from packages/core/src/scene.ts (slices branch) and `declutter` in packages/core/src/place.ts; fit rule `rim` in packages/core/src/fit.ts. Seen in 1 sample (`rose`) across the radial layout.

## Summary
Where it shows (natural height, 250 px and wider), the rim is quiet, legible in both themes, sits at the right weight under the slices, and never collides or gets cut. Its most important problem is the thinning: the greedy, index-ordered declutter keeps every hour on the flanks but leaves 2- and 3-hour gaps at the poles, so the clock face is labelled unevenly and the gaps read as missing hours. Its second is the fallback: it is all 16 labels or none, so at 170 px wide or 100 px tall the rose becomes 24 unnamed spokes with no way to tell where midnight is.

## Base issues
### B1. Thinning leaves an uneven clock: every hour at the sides, gaps of 2 and 3 at the poles
- **Severity**: medium
- **What**: Of 24 hours, 16 are kept: 12am, 2am–9am, 12pm, 2pm–9pm. Dropped are 1am, 10am, 11am, 1pm, 10pm, 11pm. Ranks put 12am/6am/12pm/6pm first and 3/9 am/pm second, but every other hour is rank 2 and `declutter` keeps rank-2 labels greedily in row order, so 2am wins its spot near the top while 10pm and 11pm lose theirs, and 2pm wins near the foot while 10am, 11am and 1pm lose theirs. The result is a 3-hour gap from 9pm to 12am beside a 2-hour one from 12am to 2am, and a 3-hour gap from 9am to 12pm beside a 2-hour one from 12pm to 2pm, with hourly labels in between. The layout is the same at every width because the circle is fixed at 160 px.
- **Evidence**: frames/rose/light-natural-480.png, frames/rose/dark-natural-250.png; sheets/rim/light-natural-1.png and dark-natural-1.png (all three widths the same); parts/rim/rose-light-natural-346.png.
- **Why it matters**: A cyclic axis labelled at an irregular step suggests the gaps mean something (missing data, a different grain) and makes it harder to interpolate the unlabelled slices. A clock face reads best labelled at one even step.
- **Where to fix**: the thinning for the rim (core's rim ranks in `scene.ts`, applied by the radial `measure` pass). If any label of a rank has to go, drop that whole rank, or thin to one even step (every 2 or every 3 hours) chosen from the room, so what is kept is symmetric about the circle.

### B2. All or nothing: no reduced rim before it drops out
- **Severity**: medium
- **What**: The rule `rim` (needs 230 wide, 120 tall) hides every label at once, and nothing replaces it. At 170 px wide (natural height) and at every width with a 100 px height, the rose shows 24 bare spokes. The rank-0 labels (12am, 6am, 12pm, 6pm) would fit in far less room and are enough to orient the circle, but there is no step that keeps only them. The 230 px threshold is also about 55 px wider than the rim's own ink (the labels span about 175 px at 250 and 480 wide).
- **Evidence**: frames/rose/light-natural-170.png (no labels, 170 × 160 view); frames/rose/light-100-480.png (480 wide with room to spare either side, no labels); frames/rose/dark-natural-120.png; capture.json shows `rim` absent at 170 natural and at every 100-tall frame.
- **Why it matters**: The angle of a rose is the dimension. Without even a midnight marker the reader cannot tell which slice is which hour, and the shape (the late-morning peak) becomes unreadable except through the readout. Graceful fallback means losing detail before losing orientation.
- **Where to fix**: the `rim` fit rule in `fit.ts` and the radial painter's `fit`: add an intermediate step that keeps only rank-0 labels (four cardinal positions) with a smaller margin, and size the full rule from the labels' real extent rather than a flat 230.

## Situational issues
None that could be separated from the base: the rim appears in only one sample, one data shape (24 hours) and one height.

## Works well
- Labels are set at the middle of each slice's angle and pushed out by degrees (right of a right-hand point, over a top one), so each sits clearly against its own slice with an even small gap all round.
- Tone (`ink.muted`, tick face) keeps the labels below the slices in the hierarchy, and reads cleanly in both themes; no theme parity problems.
- Nothing is ever cut or overlapped: the margin the circle gives (14 px) and the declutter keep every shown label whole, and the circle takes its margin back when the rim goes.
- `aria-hidden` on the rim with each slice named by its readout is the right split for assistive tech.

## Open questions
- The hours read "9Pm", "12Pm" beside "2am": the pixel tick face seems to draw a lowercase p as a small capital (no descender on its grid). That is the shared tick face, not the rim, but it is most visible here; worth checking against the time-axis ticks and Ans Mono's glyph set.
- The capture's `rim` box (138 × 138) is the ring's inner box, not the labels' ink, so the crops in parts/rim/ cut off 12am, 12pm and the left-hand labels, and `clipped: 0` cannot see whether a label runs out of the view. The frames show nothing is actually cut; the measurement should take the labels' union box.
- With 12 or fewer slices (months, weekdays) the thinning and the 230 px rule would behave differently; no sample shows it.
- The rose has no radial reference (no rings or value scale), so the rim names the angle but nothing gives the reach a value. Whether that is the rim's job or a guide of its own is not settled here.
