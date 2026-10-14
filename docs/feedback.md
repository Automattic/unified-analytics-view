# Feedback from the build

As of October 8, 2026. What executing `docs/dom-painter-plan.md` has found so far: where the plan did not hold as written, bugs, and loose ends. Every step of the plan is built and merged into `dom-painter`, since merged into `master`. Every item was checked again against `efa899f` on October 14; where a later commit settled one, the item says so.

Each entry says what was found, what was done about it, and what is still to decide. Nothing here has been settled quietly.

## Decided October 7, after the build

Six of the open items below were put to David and settled. Each is still marked where it was found; this list is what to build.

1. **Path keys are fixed in core.** Keys name the layer by its role and do not count layers, so they hold when a layer drops. Every cartesian parity case changes key names, so the parity test maps the prototype's keys to ours on purpose. The painter's local guard goes.
2. **Keyboard: two departures from version 4 stay, one goes.** Up and down step in bar lists, and a click or tap activates. A chosen point no longer stays when the mouse leaves a focused view; it clears, as in version 4.
3. **The readout is in catalog format and marks the unfinished day.** Core exports its value and date formatters; the readout and the table both use them.
4. **Core exports the path function.** One function from points to a path string, used by the scene builder and by the painter's interpolation. The copy in `packages/dom` is deleted.
5. **The measured pass defers its write a frame,** so no "ResizeObserver loop" error can reach a host page. A view that crosses a threshold paints one frame in the old state.
6. **The note is given up before prose.** When the number with its note is too tall for the box, the note goes first, in `resolve()` and in the measured pass together. This departs from the prototype, so the parity test changes on purpose for those cases.

## Building the six decisions

All six are built and merged into `dom-painter`. Checked in Chrome 155 and Playwright's WebKit 26.5 by the agents; the last follow-up in Chrome only.

1. **The loop error is gone.** With a host observing each view's parent and widths swept 420 to 40 and back, Chrome raised 27 "ResizeObserver loop" errors before and none after; WebKit 15 and none. A resize now only requests a frame, and that frame reads once and writes once. The run after a paint is still synchronous, since a paint is not in an observer's callback, so new data is fitted before any frame. Not verified: a hidden tab, where the frame waits; and a host that sets a view's data inside its own observer callback.
2. **The note rule holds at 60 and 40 px, and not between about 42 and 51 px.** At 46 px tall the trend still goes sparkline, prose at 151 px wide, number at 98, prose at 69: the full form without its note (52 px) is too tall, but the 26 px form (42 px) fits once the width forces it. The fix is to try the smaller forms before prose when the chosen one is too tall. Not built: it goes beyond the decision, and `resolve()` would need the same. **To decide.**
3. **The note can come back while narrowing.** Channel mix in a 40 px box shows the number without its note down to 99 px wide, then with it from 98, because the smaller form leaves room. Not prose, but a flip.
4. **Only a number standing alone gives up its note in core.** A spec with `keep: ['marks']` and the number above its marks still goes straight to prose. And any note goes, including an instant metric's "on the site right now". Both were the core agent's reading of the decision. **To confirm.**
5. **`resolve()` and `<ua-view>` agree on the trend and the total in 60 and 40 px boxes,** at 346 to 80 px wide. Where they still differ there, the cause is older: `place()` counts the number about 8 px taller than the DOM sets it (channel mix and layers at 40 px: prose against the number), the number block above rows is shorter in the DOM (present now), and the widest value's room (top pages at 120 px).
6. **A table needs exact numbers, and the readout does not.** With one formatter for both, the table's total read "10.5k" beside "9,437". `formatValue` now takes a form, `compact` or `exact`, and the table asks for exact. This was not in the decision.
7. **"so far" is new wording** for the unfinished day; the tldr prose had none to match.
8. Key names: `L2:line` is now `primary:line`, with `#2` for a second layer of the same role and mark. `apps/bench/src/spike-view.ts` still carries old-style literals of its own; harmless.

## Findings: step 1, fit rules

The rules are data in `packages/core/src/fit.ts` and `resolve()` reads them. No plan, scene or prose changed.

1. **The view's height needs do not fully reproduce `resolve()`.** Pinned in `test/fit.test.ts`, not tuned.
   - Trend with the number above the plot, at 160 px tall: `resolve()` drops the axes and the rule keeps them. The number takes 92 px (114 in the dot face), so the axes need about 212 px, not 120.
   - Trend with `keep: ['guides']`, at 100 px and below: `resolve()` cannot drop the kept axes, so it collapses to the number or the prose. The rules, each read alone, keep both axes and marks.
   - A bare plot beside a number with a delta is 50 px tall (54 in dots). Between 46 and 49 px `resolve()` collapses and the rule keeps the plot. Recorded, not pinned by a test.
   - What did hold over the whole sweep: no rule hides what `resolve()` keeps, and the `secondary` and `mid-tick` rules match it exactly.
2. **Some thresholds depend on content, which a fixed rule cannot carry.** They stay in code in `plan.ts`. In the DOM they fall to the measured pass.
   - The prose rung and the number above the marks: the need is the number's own width.
   - A bare plot beside a number wider than 76 px. In the dot face "10.5k" is 116 px, so the marks go at 170 px wide where the rule alone keeps them.
   - A bar list: the rule holds the label's 90 px, and the widest value's room is added in code. Top pages collapses at 120 px where the rule alone keeps it.
   - Heights that depend on content: a full legend under a height limit, a number above rows, a number too tall for the view.
3. **`keep` means two different things.** In the reducer a kept step is skipped and the next one is tried. A compiled rule would only be switched off. `resolve()` still takes `keep` from the `KEEP` map per reduction; the rule's own `keep` field is there for the CSS compiler.
4. **The notice had no height need.** `resolve()` collapses it under 40 px, but 40 was never a `CONTAINER_RULES` number, so no rule carried it. Fixed in `4f3d51b`: the `notice` rule has `block: 40`, and `place()` builds the notice to it. A notice never has the number above it, so the view's need is the notice's own.

**To decide:** whether the DOM painter accepts these gaps as measured-pass work, or the rule shape grows a way to say "this part's need includes that part's size".

## Findings: step 2, ratio scene and `place()`

`buildScene` returns one ratio scene with no size; `place(scene, container)` makes the pixel scene. The parity sweep and the 18 golden pixel scenes are unchanged.

1. **`place()` rebuilds the x scale; it does not multiply ratios.** `lo + ratio * span` differs from d3's band arithmetic in the last bit, and the sweep compares exactly. So the scene also carries `rows` and `scale`, and the `x` and `w` ratios are for the DOM only. A test holds them to the placed pixels within 1e-9. **To decide:** accept, or relax parity to a tolerance and drop the scale from the scene.
2. **Paths carry `points` as well as `d`.** `place()` regenerates the path at pixel size, since scaling a rounded string would not match. The DOM painter's per-frame interpolation needs the points too.
3. **Placed nodes do not carry `part`, `role`, `row` or `rank`.** The prototype's nodes have none, so adding them breaks every parity case. "Identical in both forms" holds for keys, paint and `layer` only. If pixel painters want the rest, the parity test should strip them on purpose.
4. **Four parts have no 0-to-1 coordinates:** `number`, `rows`, `legend` and `notice`. They are text in flow or fixed-height rows. Their nodes carry `row` and order, and `place()` supplies the pixel constants.
5. **A `notice` part was added** for the empty state. The plan's fixed part sets lacked it.
6. **The number's nodes are always in the scene,** even when the plan does not show it, because a rule's `show: ['number']` needs something to show. `scene.parts` says what the plan shows.
7. **The band's one-line legend was not emitted beside the full legend.** Fixed in `6b18cd5`: the scene carries both. The one-line legend is its own part, `legend-top`, and `scene.parts` names the one the plan shows, as it does for the number. `place()` draws only the parts named, so the pixel scenes are unchanged. Still open: the keys are the prototype's, `legend:` plus the segment and `legend:top`, so a segment called "top" would now meet the one-line legend's key. No fixture has one. Renaming either key changes every parity case for the band, so it is a deliberate departure to decide, not a quiet fix. Since done: the one-line legend's key is `legend-top` (`2deb6b3`).
8. **A bare sparkline will sit slightly lower in the DOM than in pixels.** The prototype rounds the y scale only when the y guides are on, so a bare plot fills its height. One unbounded scene always rounds. Kept for parity in pixels; not settled for the DOM.
9. **The four-tick departure touches no swept case.** Under the default rules a plot with axes is never under 120 px tall. It is named in its own test, with a context that allows an 80 px plot.
10. **The tick rank policy was the agent's choice.** A tick is unranked if a two-tick scale would also have it, otherwise `rank: 1`. "Keep only the ends" was tried and dropped, because it thinned the trend more than the prototype does.
11. **The middle x tick uses `rank: 1`,** not a `mid` class. The fit rule's `x-tick.mid` has to map to it.
12. **No scene nodes for the hit targets.** `scene.rows` gives the painter the list.
13. **There was no "unbounded" container.** A browser caller passed `makeContainer(Infinity)`, a convention and not an API. Fixed in `cfab2cd`: `unboundedContainer(painter?, cell?)`. The convention still works and is still tested.

## Findings: step 3, the spike

The page is `/spike.html` in the bench. It computes its seven verdicts in whatever browser opens it and prints the user agent at the top.

**Verdict: all seven pass in Chrome 155 and in Playwright's WebKit 26.4 build, so on this evidence the intrinsic painter goes ahead and the pixel fallback is not needed.** Firefox and Safari itself were not observed: no Firefox would launch on this machine, and Safari refuses automation until "Allow remote automation" is switched on. A person has to open the page in each. Items 1 and 4 are the ones the plan names for those browsers.

What the spike changed from the plan, because the plan's CSS did not work:

1. **Section 2's compiled `or` query is dead on a natural-height view.** The plan compiles `@container view (inline-size < 280px) or (block-size < 120px)` and says the block half is unknown on a width-only container, so the rule still serves. In Chrome and WebKit the whole rule never matches, the inline half included: a view at natural height never dropped its axes at any width. **Fix: one `@container` block per need.** The block-size one is inert until a layout makes the view a size container. The `plot` rule works with `or` as written, because the plot is always a size container.
2. **The axes rule's `set` needs more than `grid-template-columns`.** The grid areas, the gap, the padding and the bare plot height all have to switch under the same condition. Nothing reads `--uav-arrange`.
3. **The plot's height must be a stated `block-size`,** read from a custom property, with one added rule: `@container view (block-size >= 0px) { .uav-plot { block-size: auto; } }`, which matches only when the view was handed a box. `contain-intrinsic-block-size` and `min-block-size` lay out correctly in Chrome 155 but answer no `block-size` query. So one stylesheet does serve both sizings, and no `fit="box"` attribute is needed.
4. **Smaller ones.** Axis labels are grid items in one cell moved by a percentage inset, not absolutely positioned, so the y-axis column is sized by its content. X labels carry `start`, `mid` and `end` classes. The SVG is inset 2 px each side for the point scale's padding. The natural view is 210 px tall, where the prototype's 184 includes its margins. The `translate` used is physical, so right-to-left is not handled. Since `d3c66a8` the insets are logical; the `translate` in `chrome/axes.ts` is still physical.

Two things the real painter has to respect:

- **Chrome can skip a transition started at the end of a long task.** Wait a frame before the change.
- **Reconciling by key must not re-append kept elements,** or their transitions are cancelled.

How far the verdicts go:

- Item 2 (no flicker) reads state after a forced layout. Nobody has watched a drag; the page has a "Play the sweep" button for that.
- Item 3 (animated registered properties) uses a stand-in data change, the last 7 rows of the same result, because no fixture query moves a shared tick.
- Item 5 (stretched path within a pixel: 0.054 px at worst) proves geometry, not rasterised pixels.
- Not built in the spike: the hit targets, the table, tick ranks, the measured pass.

## Findings: step 4, `<ua-view>` for cartesian

`packages/dom` exists: the fit-rule compiler, the element, the cartesian layout, and stubs for `rows` and `band` behind a documented seam (`packages/dom/src/layout.ts`). The bench's views page has a painter control. Observed in Chrome 155 and Playwright's WebKit 26.4; not in Firefox or Safari itself. Nobody has watched a live drag.

Where the plan did not hold as written:

1. **A rule's `set` cannot be compiled from data alone.** The compiler takes per-rule declarations from the layout module (`fit` on a `LayoutPainter`). The `marks` rule needs them too, though it has no `set`.
2. **`show` compiles to `display: block`,** so a shown part has to work as a block.
3. **The stated `block-size` is on `.uav-body`, not the plot.** The plot stretches inside it and still answers `block-size` queries in Chrome and WebKit. Since moved: the height is stated on the plot's grid row, `--uav-plot-block`.
4. **Ranked y ticks are thinned by a rule local to `packages/dom`,** on the view at `block: 152` (120 for the plot, 10 above, 22 for the x axis). The y axis sits outside the `plot` container, so a `plot` query cannot reach its labels. It is wrong when the number sits above the plot. A `plot` rule in core, with the y axis inside that container, would say it properly. Open.
5. **Two additions beyond the plan:** base styles sit in `@layer uav`, so compiled rules win whatever the specificity; and rule names are validated before they reach a selector, because a rule set can arrive as markup JSON.

Where `<ua-view>` shows something other than what `resolve()` plans at that size. At natural height every checked case agrees (trend and layers, 346 to 80 px wide). In a box:

- **346 by 100:** `resolve()` drops the comparison, the context fill and the reference line; `<ua-view>` shows them. In a box the bare plot fills the height, so the `secondary` rule does not apply. `resolve()` builds its bare plot to 46 px.
- **Any box in the side arrangement:** the plot is as tall as the box, where the pixel scene keeps 46 px. Sparklines in tiles are much taller than the pixel painter's.
- **40 px tall at 120 px and wider, and the trend at 120 by 60:** `resolve()` goes to prose; `<ua-view>` shows the number. This is the measured pass, not built yet.

Visible differences from the pixel painter, for the design pass:

- The y-axis gutter is sized by its labels, not 36 px, and there is no right margin, so the plot is wider and starts further left.
- Beside a bare plot the number column is as wide as its content, not 42% or 76 px, and the number is centred vertically, not top-aligned.
- At 120 px wide the pixel painter shows the number at 34 px with its note; `<ua-view>` shows it at 26 px in short form with no note. Left for the measured pass, which will own the number's size.
- Bars are HTML boxes snapped to device pixels, with all four corners rounded. The dashed reference line is a gradient, snapped to 1 or 2 px.
- Paint order in the plot is fixed (grid, bars, paths, rules and labels), whatever the layer order.
- Overall height matches the pixel painter: 184 px natural, 152 px plot.

Gaps:

- No attribute on the element to force light or dark; theme comes only through the custom properties.
- The views page enforces no content security policy, unlike the spike page. The source follows the rules, but nothing is checking.
- Right-to-left is not handled. Since handled in `d3c66a8`; what that leaves is in the review of October 12, Left 12.
- Wanted from core: `fmt` is not exported, so the table formats numbers itself (core's half fixed in `fa96d14`: it exports `formatValue` and `formatDimension`; the table uses them since `df452e7`); the number's short-form widths (160, 200, 120) are constants in `place.ts`, copied into the base CSS.
- The table is built but has only been checked by its row count.
- A running dev server does not see a new workspace package. After `packages/dom` was merged the bench was blank until the server was restarted.

## Findings: step 4, `rows` and `band`

Both layouts are built, each in its own file under `packages/dom/src/layouts/`. Observed in Chrome 155 and Playwright's WebKit; not in Firefox or Safari itself.

Rows:

1. **The plan's height-limit trick needs a spacer.** A flex line always takes its first item, so when not even one row fits, the first row was cut mid-height. An empty `::before` as the first flex item, full width, with a negative margin that cancels the gap, makes the first row wrap away like any other. Still no script. With it, only whole rows show at every checked size. Since replaced by a `round(down …)` clamp on `max-block-size` (`09df25b`).
2. **Top pages at 120 px wide shows a squeezed list where `resolve()` shows the number.** Expected: the widest value's room depends on content and cannot be said in CSS. A container query on the label track can only style what is inside it. Open; it wants the measured hook.
3. **Present now fits one more row in a box than the pixel pipeline,** because the number block is 50 px tall in the DOM and 58 px in pixels. The element owns that.
4. **A box shorter than one row, with no number above, would be blank** where `resolve()` shows the number. Not observed; core has no block need for `rows`, and a layout's own rules are static, so it cannot write one from `rules.rows.rowHeight`. Observed in review, in Chrome 155: a 346 by 27 px box showed nothing. Fixed there: a layout's `rules` is now handed the context's rule set, and the rows layout writes a `marks-block` rule from `rows.rowHeight`, as the band has one. It asks the view, so it has the band rule's limit.
5. **A row has no node in the scene.** The layout makes a `RectNode` per row to reuse `keyed`. A row node in the scene, or a `keyed` that takes any `{ key }`, would be cleaner.
6. **Bar radius fallbacks disagree:** rows fall back to 3 px and cartesian to 2 px on the same token.
7. The `list` and `listitem` roles on the rows were the agent's addition, not the plan's. Since replaced by `listbox` and `option` (keyboard finding 4).

Band:

1. **A full legend under a height limit is done in CSS, with no script.** The plan left it open for the DOM. The layout writes its row count as `--uav-rows`, and a `max-block-size` clamp on `100cqb` swaps the legends. It assumes fixed-height legend rows.
2. **A rule local to the layout collapses the band under 48 px,** because core's band `marks` rule has no block need. It is wrong when the number sits above the band. A block need in core would remove it.
3. **With `keep`, kept parts are clipped by the box** where `resolve()` would collapse. This is step 1's finding 3 again.
4. **Reading order can drift.** A segment entering mid-list is placed with `order`, so DOM order and visual order differ until the layout is rebuilt. The legend is read by assistive technology. The fix belongs with transitions and keys, since moving a kept element cancels its transition. Open.
5. **Bar and legend row heights (24 px) are held twice,** in `place.ts` and in the layout's CSS.
6. One 404 in the bench's console, not chased.

## Findings: step 5, the measured pass

Built in `packages/dom/src/measure.ts` and `view.ts`. It settled in one run at every size swept (widths 420 to 40 and back, box heights 200 to 20 and back, 66 views), in Chrome and WebKit, with no hysteresis: nothing it reads depends on what it writes.

**Decision 5 holds: the prose rung is measured.** The threshold is the number's own width, about 69 px for "10.5k", and it now follows the font and the data with no constant. It costs a hidden ruler that holds the number in each form, and a lift-and-reset of the attribute while a view is prose.

What it writes: `data-fit` on the number (`small`, `short`, `delta-short`, `no-note`), `data-fit="prose"` on the figure, `data-thin` on x labels that would collide. The old fixed queries stay as the fallback where there is no `ResizeObserver`.

The seam gained one optional member, `measure?(body, room)`, for a layout's own measured work. Cartesian uses it for tick thinning. Since moved: the thinning is `thinAxis` in `chrome/axes.ts`.

Closed by it: the 40 px box and the trend at 120 by 60 now go to prose; at 120 px wide the number is 34 px with its note, as in pixels.

New findings:

1. **A "ResizeObserver loop" error can reach the host page.** The pass writes inside its observer callback. When that changes the view's natural height and the page itself observes an ancestor, the window gets "ResizeObserver loop completed with undelivered notifications". Benign, but an error tracker on a customer's page will see it. The alternative is to defer the write a frame, which paints one frame unfitted. The synchronous write was kept. **To decide.** Decided October 7 and built in `b48484f`: the write waits a frame.
2. **Prose appears in the middle of a narrowing sweep.** In a 60 px box the trend goes sparkline, then prose from about 152 to 104 px, then the number again once the note stops fitting, then prose. `resolve()` does the same at 120 and 80 px, so this is the reducer's behaviour, now visible live. Dropping the note for height before falling to prose would fix it. Not done, to stay with `resolve()`. Decided October 7, and core's half fixed in `7c1139d`: `place()` drops the note of a number that stands alone and is too tall, `resolve()` goes to prose only if it is still too tall, and the plan lists "the note under the number" in `dropped`. In the 60 px box the trend now goes sparkline, number, prose. This departs from the prototype in 36 swept cases, all of them prose there and the number alone here; they are named in `test/core.test.ts` and have their own describe. Two limits: only a number that stands alone gives up its note, so a spec that keeps its marks still goes straight to prose; and any note goes, the unranked one of an instant metric too, to agree with the measured pass. No swept case turns on either.
3. **Prose overflows a small box.** At 40 or 60 px tall the sentence is clipped by whatever holds the view.
4. **The `mid-tick` rule is more cautious than the labels need.** By measurement the middle label clears the others down to about 150 px; the rule drops it under 380. Kept, since it matches `resolve()`.
5. **The ladder skips the full form at 26 px.** `place()` can show a long full number small; the pass goes to the short form at 37 px first.
6. **Layers in a 40 px box shows the number where `resolve()` says prose.** `place()` counts a lone number as 42 px tall; the DOM sets it in 34, which fits.
7. **The no-prior delta shows whole** where pixels clip it by character count.
8. Still not measured: a bare plot beside a number wider than 76 px. Right-to-left came later, in `d3c66a8`.
9. Not observed: a web font swapping in. The ruler is observed for it, but nothing loaded a font.

Still differing from `resolve()` and not the measured pass's: at 346 by 100 the secondary layers stay, and a bare plot fills a box where pixels keep 46 px.

## Findings: step 5, transitions

Built in `packages/dom/src/motion.ts`. Observed in real time in Chrome 155 and Playwright's WebKit 26.5.

What moves, only on a data change within the same layout: positions transition as registered custom properties; entering nodes fade in by `@starting-style`, with bars and segments growing from nothing; leaving nodes placed by a ratio fade out, and anything that takes room in the flow leaves at once, so the measured pass never reads a leaving node. Paths are redrawn per frame. Nothing animates on resize, under reduced motion, or where registration fails. Three motion tokens are new: update, exit, and their easings, beside version 4's entrance.

1. **Core's path keys are not stable between data states.** Keys count layers, so when the comparison layer drops, the primary line takes the comparison's key, `L1:line`. By key that would morph the dashed comparison into the primary line. Guarded locally: a path whose role changed is treated as new. Core's keys should name the layer. Fixed in `60da786`: a layer's key is its role and mark, `primary:line` for `L2:line` and `primary:bar:2026-09-08` for `L0:bar:2026-09-08`, in every layout. Two layers of one role and mark are counted among themselves, `primary:text` and `primary:text#2`, with the previous series counted last, so neither a reduction nor missing prior data can move a count. The prototype keeps its keys, and the parity tests map them to ours in one helper, `ourKeys`. The golden scenes changed in key names only. The painter's guard went in `df452e7`.
2. **`packages/dom` carries its own copy of d3-shape's monotone curve,** because core does not export a path function and the package may not add a dependency. A test holds it string-identical to core's `d` for the trend at 28, 14 and 7 days. Core should export one. Core's half fixed in `7bfb5aa`: `pathD(points, curve, fill)` is exported, and the scene builder and `place()` both draw with it, with no golden scene changed. The copy in `packages/dom` went in `df452e7`.
3. **When the row set changes, a path and a bar disagree.** Bars slide by key. A path is read at the new rows first, a small jump, then morphs vertically.
4. **Reading order now follows the scene** (band finding 4, closed). `keyed` leaves children in scene order, and the band's `order` workaround is gone. The trade: WebKit has no `moveBefore`, so a kept element that changes place is re-inserted and re-enters, where Chrome slides it.
5. **The first paint and a change of layout do not animate.** The agent's choice; one condition in `view.ts`.
6. **The fixtures now honour `range`,** so the bench has a Range control to judge motion by. `28d` is unchanged and parity holds. This went beyond the brief.
7. Smaller: a resize within about 300 ms of a data change can fade a returning part in; the band's 2 px gap beside a leaving segment closes in a jump; entering rows fade under a fading parent, so their opacity compounds briefly.
8. The spike's warning that Chrome skips a transition at the end of a long task did not bite with 30 views changing in one handler. It would return if a host did much more work in the same task.
9. Not verified: a browser without `@starting-style`, a web font swap during motion, and how the motion looks to a person.

## Findings: step 5, keyboard, hit targets and the readout

Built in `packages/dom/src/keys.ts`. Driven with real key and pointer events in Chrome 155 and Playwright's WebKit. **No screen reader was run,** and no touch device.

The model is version 4's, read from `useKeyboardNavigation` on Jetpack trunk: one tab stop per view, on the element that holds its points; left and right step and stop at the ends; Enter or Space activates; Escape lets go; no Home or End. Activation dispatches `ua-activate` from the element, bubbling and composed, with the result's row in `detail.row`.

Each layout's points sit in a `listbox` of `option`s, with the readout text as each option's name. Announcement is through `aria-activedescendant`, not a live region, so what is shown and what is spoken are one string. A view with no points showing (number only, prose) has no tab stop.

1. **Three departures from version 4, all the agent's choice.** Up and down also step in the `rows` layout. A click activates, and on touch the second tap does. A chosen point stays when the mouse leaves a focused view. **To decide.** Decided October 7: the first two stay, and the third went in `2d50662`.
2. **The readout is not in catalog format.** Core's `fmt` and `fmtDay` are not exported, so dates read `2026-09-08` and numbers are grouped as the table groups them. The catalog's `unit` is unused. Core's half fixed in `fa96d14`: `formatValue(value, metric)` and `formatDimension(value, dimension)` are exported, so a day reads "Sep 8". Every unit in the catalog is a count, so `unit` still picks nothing; the function is where a new unit gets its branch. The readout does not use them yet. Since then the readout uses both (`df452e7`), and `unit` picks the format (`916a90c`).
3. **The partial day is not marked in the readout.** The last trend row reads "Visitors 175" with no "so far". Core's half fixed in `fa96d14`: `partialNote(row)` gives "so far" for the unfinished bucket and nothing for a finished one, so the words are core's. The row's `partial` flag is all a painter needs to tell. The tldr prose says nothing of the unfinished day, so there was no wording to match; the scene's own `note` on the dashed tail still reads "incomplete bucket", as the prototype's does. The readout says "so far" now.
4. **Rows lost their list semantics** to become a listbox. A screen reader in browse mode may read it as one control. Unverified.
5. **Rows clipped by a height limit are still options** in the accessibility tree: "1 of 8" when five show.
6. **The plan's `uav-hits` layer is only needed in cartesian.** In rows the row is the target, in band the segment, which is no longer `aria-hidden`.
7. **The readout covers the number in a sparkline tile,** since it has to stay inside the view's box, and sits over the x labels under a full trend. It is placed once and does not follow a resize or scroll. The look is the owner's. Since `9603b40` it is in the top layer and a scroll hides it; it still does not follow a resize.
8. **No focus token exists** among version 4's names, so the focus ring is the browser's own. Since added: `color-focus` and `stroke-width-focus` (`2c37022`).
9. **Chrome makes a scrolling table focusable,** so in table mode nine narrow views become tab stops on the figure. Not a trap.
10. `scene.rows[i]` is taken to match `result.rows[i]`. True of every builder today, and marked in the code.

## At the merge of motion and keys

Checked together in Chrome and WebKit: stepping, activation, and a change from 28 days to 7 mid-transition.

- **Hit targets would have slid and faded with the marks,** since they carry the registered properties and a key. Fixed in the merge: the hit layer takes its new places at once and a leaving target goes at once.
- **A leaving band segment keeps `role="option"` with the id `hit--1`** for the 150 ms it fades. It is skipped when stepping. Open: it keeps its `data-row`, so it is indexed −1 (`keys.ts`).
- **The two branches were merged on a side branch first,** `dom-painter-step5`, because the main checkout held another session's uncommitted edits to `apps/bench/index.html`. It was merged into `dom-painter` once that work was committed, with no conflict.

## Findings: the review of October 7

`dom-painter` was reviewed against `master` at `5ff3def`, with findings reproduced in headless Chromium, WebKit and Chrome 155. Fourteen were fixed in the same pass: row keys that are not strings, the `table` attribute, fit rules at a fractional zoom, a repaint under a resting mouse, sizes under a scaled ancestor, duplicate keys in `keyed`, the alert shown while markup is parsed, marks in print and forced colours, a box shorter than one row (rows finding 4), a lone "0" on a thinned y axis, a touch that becomes a scroll, `placeRows` and `rules.rows`, a partial nested `rules`, and the clipped one-line legend. No screen reader, touch device, Safari or Firefox was used.

Two of the fixes are choices to confirm. Marks keep the page's own colours in forced-colours mode (`forced-color-adjust: none`), where mapping them to system colours is the other answer. `placeRows` now reads `rules.rows`, a departure from the prototype under any row size but the default; it has a named test in `test/fit.test.ts`.

What it found and left, all open:

1. **The container is named plain `view`.** `@container view (block-size …)` skips a host that is sized in width only, and is answered by any ancestor size container the page also names `view`. Seen in Chrome: a `container: view / size` wrapper 500 px tall around a stacked trend at 346 px gave a 46 px host with a 14 px plot, and a Channel mix 0 px tall. The plan names the containers `view` and `plot`. Recommended: prefix both, `uav-view` and `uav-plot`, and change the plan with them. Done in `5206a81` and `0de3b19` (Before testing against real data, 4).
2. **Ranked y ticks are thinned at two different heights.** The DOM's local rule asks 152 px of the view (cartesian finding 4); `place()` asks 120 px of the plot, gutters included. Bug 2's `plot` rule with `block: 120` would give both one number.
3. **The `legend:top` key meets a segment named "top".** The one-line legend's key is `legend:top`, and so is the legend entry of a band segment whose dimension value is `top`. Keys must be unique. Fixed in `2deb6b3`.
4. **`note-first` drops unranked lines under the number.** An empty state can show a bare "0" without "No visits yet" (now "Visitors: nothing yet"). The reference marks this to confirm.
5. **Scene labels write a time dimension raw on rows and band:** `2026-09-29` where the readout says "Sep 29". The prototype does the same, so `formatDimension` there is a parity departure to make on purpose. Made in `be71d44`.
6. **One unbounded scene scales the y axis to layers a rule later hides.** A sparkline whose secondary layer is hidden can sit at 30% of its height. Design-level: the scale would have to follow what shows.
7. **View-level block needs are wrong when the number sits above the plot.** The need is asked of the view, which also holds the number, so axes can stay around a 4 px plot. Known; the same limit as the band's and the rows' `marks-block` rule.
8. **Compiled rules differ in specificity when one has `keep`,** so "later wins" does not always hold. Latent: no two rules in the set meet this way today.
9. **Only a rule's `needs` are shared.** `resolve()` reads nothing of `hide`, `show`, `set` or `keep`, and `FitRule.set` is read by nothing at all. Since then `resolve()` reads `keep`; `set` compiles to custom properties that nothing in `packages/dom` reads.
10. Residuals of the fixes: a view left inside a removed iframe still raises ResizeObserver loop errors, and a hovering pen is treated as touch.
11. Smaller, as the pixel painter has them: a rule's label sits above the top edge when the rule is at the top of the scale, and the end labels of a category axis overflow. A spec with no primary layer leaves an empty plot. A list clipped to nothing is still a tab stop (keyboard finding 5), and both band legends are exposed to assistive technology in a box.
12. Efficiency, not taken: transitions on registered properties restyle every node each frame (plan section 6); one forced layout per view per data change; the hidden table's inputs are not stored, so it cannot be skipped; `resolve()` builds the scene twice and places it at Infinity; the fit rules are compiled on every render.
13. Cleanups, not taken: `test/fit.test.ts` copies the sweep harness; `paint-svg.ts` duplicated the paint table (gone with the pixel painter, `6ac261e`); `.stage` is defined in both `bench.css` and `demo.css`; `surface.json` is unvalidated; the token generator lost its validation, and `{color.white}` is unresolved in the light primitives.

## Defects: chart coverage, steps 1 to 8

Found while building `docs/chart-coverage-plan.md` on October 8, by the agents that built each step and by two browser checks of the merged tree (headless Chromium, and WebKit for the second). Design questions the build raised are not here: they are in section 9 of that plan. Each step's own findings are in its section 8. The pixel painter compared below is the bench's SVG painter, removed in `6ac261e`; `place()` is the pixel comparison left.

### Fixed

1. **Shares divided by the sum of the rows received.** `sceneBand`, the share note under the number and the share sentence in `prose.ts` all did. With a `limit` they added to 100% of the top N. They divide by the engine's total now.
2. **The fixture's channel rows did not add up to its total** at any range but 28 days. They are shares of it now.
3. **Hover and click were dead on every plot without points,** the trend among them. The holder for a scatter's points lay over the whole plot and took the pointer when empty. Fixed in `layouts/points.ts`. The agent that built it had not hovered a trend; the first browser check of the merged tree caught it.
4. **A map's symbol holder took the pointer from its regions** the same way. Fixed in `packages/geo`.
5. **A heatmap's row labels stood 12 px from the cells, not 6:** one step's label padding met another's column gap at the merge.
6. **A row's bar was taken for a plot of points,** since both have a metric on x and no dimension there. A plot of points now needs no dimension on y either.
7. **Core named two metrics in an error's example.** The example is generic now.
8. **A rule with no number on either axis drew at NaN.** It is an error that names the fix.
9. **The pixel painter clipped the first letter of each weekday in a heatmap,** and the DOM's last column label ran past the edge.
10. **"Top countrys".** A small `plural()` in `prose.ts`.
11. **A test timed out now and then.** `fit.test.ts`'s sweep runs about 4.6 s in one test, against a 5 s limit. It has a longer one.
12. **Two steps each added a `conversion_rate` to the fixtures,** one a ratio and one in percent points. The second is `page_conversion` now. Both units still exist for one idea.

### Open

**Overflow and clipping**

1. **The quadrant at 7 days overflows the view by 74 px.** The upright rule lands on the plot's right edge and its label sits to its right with no flip (`.uav-refs span[data-upright]` in `layouts/points.ts`). The pixel painter clips the same label. Seen again after the merge with `dom-painter`.
2. **A heatmap's hidden last column label keeps its box** 9 to 13 px past the view's edge. A host without `overflow: hidden` would scroll.
3. **A label on a point near the top of a scatter is cut by about 4 px.** The pixel painter puts it under the point.
4. **The first x label of the box plot and the error bars is cut at the left edge.** It is centred under its band with no start anchor. The pixel painter cuts it too, and overlaps all its categorical x labels where `<ua-view>` thins them.
5. **A rule's label can sit over a point** (the quadrant's "1,000 visitors" over `/pricing`). Labels are kept clear of each other only.

**Where `<ua-view>` and `resolve()` disagree**

6. **Rows ignore the value's room in `<ua-view>`.** Top pages at 120 px, the dumbbell and the bullet at 170, and the map's fallback list at 120 show rows where `resolve()` gives the number. With the rank column the league table at 120 px is rank, "/…" and a value.
7. **A heatmap is 184 px tall in `<ua-view>` and 208 in pixels.** The ramp's 24 px comes out of the grid, so the cells are squatter.
8. **The number in a donut's hole** shows in `<ua-view>` and not in pixels between about 120 and 145 px across.
9. **A half circle uses the circle's needs:** it collapses to the number when it would still fit, and between 64 and 87 px tall the DOM drops its one-line legend where pixels keep it.
10. **Donut, pie and half go from marks straight to prose** in `<ua-view>`, with no number-alone rung.
11. **A bare box plot's ticks sit on the full scale** in `<ua-view>`, which plans once. `resolve()` rescales to the medians.
12. **With `keep`,** a kept ramp or a kept map stays in `<ua-view>` where `resolve()` ends at the number or the prose. The same difference as for the band.
13. **A legend that wraps to three lines** in a box near 290 by 185 px falls to the bare plot and skips the labels at the line ends.

**Hit targets, readout and keyboard**

14. **A stacked area has no hit target on the unfinished day.** Core draws the stack only to the last whole day.
15. **A companion the view did not ask for is in the readout and the table.** The dumbbell says "rank 2", because both list every companion the result carries. Fixed in `6aff38c`.
16. **A bin's readout and table say its start, not its range** ("0: Page views 317"). Fixed in `4bae55f`.
17. **`aria-orientation` on the listbox of points in two dimensions is `horizontal`.**
18. **Regions with no row have no readout** and are not in the map's keyboard list. A row with no matching shape is not on the map, and nothing says so. Since `079d953` a note counts those rows; regions with no row still have no readout.
19. **One series cannot be chosen with the pointer;** hover gives the whole point. Since `73eca2e` the pointer can choose an arc of a second ring; other plots still give the whole point.

**Painting**

20. **One-pixel range segments look grey in `<ua-view>`** and black in pixels. Whiskers, wicks and error bars sit at fractional positions and are antialiased.
21. **`seq.none` and `seq.1` differ by hue only in dark** (contrast 1.27). Clear at 346 px, faint at 170, and likely to merge in greyscale.
22. **Leaving labels, second-axis ticks and arcs go at once.** They are not in the motion sheet's fade list.
23. **`points.ts` still sets `--uav-body-block`** where cartesian now states the plot's height. A plot with both a legend and a key to sizes would come out short. No sample has both.
24. **A heatmap's `marks` rule does not know its column count:** 24 columns at 150 px are about 5 px each.
25. **Units are not formatted.** Revenue reads "63.5k", a rate's ticks read "2, 4, 6", and load time has no "s". Fixed in `916a90c` (Before testing against real data, 1).
26. **Symbols on a map sit at the centroid of the whole shape,** off the mainland for a country with far-flung parts. The map's fallback list has no limit: 15 countries is 476 px tall.

**To fix before it bites**

27. **`ensure()` in `dom.ts` is called on the shadow root with a `:scope >` selector, which returns null there in Chromium.** It does no harm today, since it is called on the root only in the constructor. A later call outside it would add a second element each time.
28. **The pixel SVG painter on the bench raises "ResizeObserver loop completed with undelivered notifications"** during fast resizing: `main.ts` repaints inside the observer's callback. Obsolete: that painter was removed in `6ac261e`.
29. **In a 40 px box most cartesian views showed a 42 px number,** 2 px over, where they should fall to prose. Seen on the six originals before the review fixes were merged in, and not looked at since.

### Not verified

- Firefox and Safari itself. WebKit through Playwright for parts of steps 2 and 3 and for the second check.
- A screen reader, touch, reduced motion, right-to-left. Whether a changed `aria-label` on the same active descendant is announced.
- The motion as it moves. Only its end state was read, and three frames mid-transition.
- The colours, by a person.
- After the merge with `dom-painter`: a structural pass of all 34 samples in both painters, the table on twelve, hover and data changes, in headless Chromium. No errors but item 1. Screenshots were not read again.

## Before testing against real data

October 8. Six items above were picked as the ones that would make real data read as wrong, and built by three agents on branches merged into `real-data-prep`. What the real data looks like was read from `spacefast-monorepo`, branch `jblz-tracker` at `ef798685ad`: a tracker and its wire contract, with no ingestion, store or query API yet. The merged tree was read in Chromium in `<ua-view>`: 175 views, no console errors, none blank.

### Built

1. **Units** (open item 25). `916a90c`, `49da2df`. `formatValue` branches on `count`, `ratio`, `percent`, `usd`, `ms`, `s` and `bytes`, and an unknown unit is an error that names the valid ones. The tldr value, ticks, point labels, the size key, the ramp's ends and the prose all go through it. Money is in major units, as the tracker sends it. Rates work at either scale, since the query API has not chosen one.
2. **Time values** (review item 5). `be71d44`. A bare date or a full ISO datetime, always UTC; a bucket off midnight reads "Sep 8, 3 PM". Row labels and band and radial legend names go through `formatDimension`, a departure from the prototype with its own describe.
3. **The one-line legend's key is `legend-top`** (review item 3). `2deb6b3`. Mapped in `ourKeys`; a segment named "top" has a test.
4. **The containers are `uav-view` and `uav-plot`** (review item 1). `5206a81`, as `vg-`, and `0de3b19`, as `uav-`. The fit rules' data keeps `view` and `plot`; the compiler writes the prefix. Inside a wrapper named `view` four views now match the unwrapped ones.
5. **The readout and the table list only the companions a layer encodes** (open item 15). `6aff38c`. The dumbbell no longer says "rank". The box plot no longer says `lower` and `upper`, which it never drew.
6. **Rows with no shape are counted in a note** (open item 18). `10ff680`, `a1899c6`, `079d953`. "4 countries not shown", under the map, dropped with the ramp by the `guides` rule. An empty or null value is counted too.
7. **The shapes were keyed on country names,** so every real result would have matched nothing and thrown. `682883f`. 122 of 123 are keyed on ISO 3166-1 alpha-2 now, the name kept beside it; Somaliland has no code. The fixtures send codes. The match is exact.

### Open, from building them

1. **A country read as its code** in the fallback list, the tldr prose, the readout and the table. Decided October 8 and built: a dimension's catalog entry may carry `values: 'country'`, and `formatDimension` names the code with `Intl.DisplayNames`. The "Top:" line under the number goes through it too. Names are `en-US`, as every other format in core is.
2. **The midnight bucket of an hourly result reads as a day.** Grain is read from the value. The result should state it. **To decide,** with the query API.
3. **A number dimension has no unit** (reference, Open 11), so load time on an axis still has no "s".
4. **Every companion is written in its metric's unit,** so a rank or a density of a duration would be mis-suffixed. No sample has one. Since fixed in `9e14723`: a companion may have a catalog entry of its own.
5. **The instant value and its prose are still raw counts.** Since fixed in `4f603a2`.
6. **A map 280 to 319 px wide shows neither its ramp nor the note.** The note goes with the `guides` rule; `plan.dropped` says only "the colour ramp".
7. **The fallback list showed an unknown country as a blank label.** It reads "–" now, as a missing value does.
8. **The "$" widens the value column by 6.6 px,** so the conversions view drops it at 322 px, not 315.
9. `geoMark` accepts a feature with a name and no id. It rejected one before.

### Not verified

- The pixel painter after the merge, beyond the test run. Each agent looked at it on its own branch.
- Hover, the table and the dark theme after the merge. The spike page's seven verdicts after the container rename: they stayed at "running" in a background tab, on the baseline too.
- Safari and Firefox.

## The adapter for Spacefast's query API

October 8. `packages/spacefast` turns one answer of the API's contract into a query, a result and a catalog. The contract is merged (spacefast/monorepo#3816 and #3827, read at `23789af`) and nothing serves it yet. Held to the API's two recorded examples in `test/spacefast.test.ts`. Not looked at in a browser: the bench has no page that feeds it.

What it does: the bucket is the time dimension and `complete: false` is `partial`; `previous` is laid beside each value as `@previous`, bucket for bucket in a series and by value in a list; a list's rows carry their place as `@rank`; a scroll bucket is a `number` dimension; `percent_points` is `percent`; a country column sets `values: 'country'`; polarity is the column's; totals are the API's own. Money is a metric for each currency, `revenue.usd` and `revenue.eur`, in the currency's own units, and in core a currency's code is a unit of its own.

What the API's owners answered, after the review on the PR:

- **Polarity is in the catalog and in every column.** The adapter reads it; its own option is gone.
- **Minor units are ISO 4217's, by a fixed table.** Chrome and Safari disagree on the digits of seventeen currencies, so the adapter carries the tracker's table and does not ask `Intl`.
- **Any three letters are a currency,** so a typo arrives as one. The adapter leaves out a code core cannot write, with a note.
- **Coming, not in the contract yet:** buckets snap to their start; a comparison's rows line up with the current rows; every column is in every row; empty revenue is null; a query with no time and no breakdown has its numbers in `totals` and no rows; time with a breakdown is refused. The adapter takes each of these as it is now and as it will be, with a test for the two that change a shape.

Open:

1. **A metric's definition had nowhere to go.** Every column carries one, caveats included: unique visitors over a range are consented visitors only. Decided October 8 and built: a catalog entry may carry `definition`, the tldr value carries it as its `note`, and `<ua-view>` shows it as the number's `title`. Seen in Chromium. It is not under the number, where the measured pass would drop a line that long at every width, and not in the tldr prose, which is also the prose rung and overflows a small box already. So it shows on hover and to assistive technology only: not on touch, not in the pixel painter, and not in the table's column heads. Whether a caveat this important needs a place that always shows is **to decide.**
2. **Core writes money with the browser's digits.** The value is right in any browser, but Chrome writes forints with no decimals and Safari with two. The same seventeen currencies.
3. **Time with a breakdown is refused,** here and by the API for now. A split or stacked series cannot be fed.
4. **Until buckets snap, the first bucket of a series is cut by the window's start** and marked complete, and the adapter passes it on. Wrong: see On the live API below. Buckets do not snap, and the first bucket arrives `complete: false`.
5. **An answer whose every value is zero is `empty`,** so a quiet week on an old site reads "No visits yet".
6. **`other` and `truncated` are dropped.** A result has no place for them.
7. **A custom range reads as a count of days,** "last 31 days", whatever its ends. An hourly bucket at midnight still reads as a day: the answer states its grain and core does not take one.

### On the live API

October 8. The API is served for the synthetic `seed` space, and the bench's `live` page asks it from the browser: two batches a range, each answer through `adapt`, twenty views. Read in Chromium at 7, 30 and 90 days, light and dark, as tables: none blank, no console errors. The contract was reread at `b1e28cc` (spacefast/monorepo#3665) and the recorded examples replaced with that branch's.

One thing the note above had wrong: buckets do not snap. A `window` ends now and starts as long before, so the first bucket of a series is `complete: false` as well as the last. The line builder took every partial row for the tail and drew a dash from the last whole day back to the first. It now dashes in from a leading partial bucket (`:partial:lead`) and out to a trailing one. The adapter's note about today is said only when the last bucket is the unfinished one.

The page is now the prototype of the analytics sidebar the tracking snippet will open on a site: a panel against the page's edge, 400px wide, with a range of 7, 30 or 90 days and nothing of the bench around it. Its content is the Earn attention goal as far as the API serves it, the one goal whose headline metrics it answers in full: tiles for visitors (as visitor-days, which have a total over a range where visitors a day have none), page views and engaged time, a trend of each, top pages, pages then and now, engaged time by page, referrers with their change, and scroll depth. Scroll depth is the page views in each bucket of deepest scroll, not the share who reached each depth: that is a running total, which core does not compute. It borrows the chrome of the `sidebar` mock-up, without the parts nothing backs yet: this page or the whole site, now or trends, and a switch for the comparison.

What the real answers showed, not fixed:

- **The previous period's line dips at both ends.** Its first and last buckets are part days too, and a comparison is drawn whole. Asking in whole UTC days (`since` and `until` on midnights) would avoid it; a `window` cannot.
- **A readout says "so far" of the first bucket,** which is not filling. `partialNote` has one wording for both ends.
- **Visitors a day has no total over a range,** so its trend is headed by a dash and "No prior period", though there is one. Since `3891657` a missing total shows no change beside the dash, and the page shows visitor-days.
- **A share bar's legend writes `null`** for a value that is null (operating system), where a bar list writes a dash. Fixed in `4f603a2`.
- **`@rank` goes on the first metric,** and the API now orders by the first that is not money. No view on the live page reads `@rank` yet; the `bump` preset would.

## Bugs

1. **Prototype: duplicate keys on a one-row time series.** A time series with exactly one row emits two `xtick` nodes with the same key. No swept case reaches it. Fixed in `37edd5d`, as a departure from the prototype on purpose: one row has one tick. It has its own test, which shows the prototype's two and says why ours differs. The prototype itself is unchanged.
2. **`place.ts` and `plan.ts` hard-coded numbers the rules now own.** 380 for the middle tick, 76 for the number beside a bare plot, 40 as the notice's least height. A context that changed the `mid-tick` rule changed what was reported as dropped, but not what was drawn. Fixed in `4f3d51b`:
   - `place()` asks the `mid-tick` rule, with the question `resolve()` asks.
   - 40 is the `notice` rule's block need.
   - 76 is `rules.bare.numberWidth`, read by both. A fit rule could not carry it: it is not a container's need but one term of the `marks` rule's 152 (76, a 12 px gap and a 64 px plot). So it is still held twice in that sense. A context that changes `numberWidth` should change the `marks` need with it.
   - Not touched: 120 px, the plot height under which `place()` drops ranked y ticks. No rule carries it, and section 3 of the plan says one should. A `plot` rule with `block: 120` would say it. It is `SHORT_PLOT` in `place.ts` now.
3. **One number held twice.** `axes.minHeight: 120` (the size `place()` builds to) and the `axes` rule's `block: 120`. A context that lowered one had to lower the other, or the axes were dropped anyway. Fixed in `5ee81d2`: `axes.minHeight` is removed and `place()` builds to the rule's block need. The y tick test lowers one number. The same pair remains for a bare plot, `bare.height: 46` and the cartesian `marks` rule's `block: 46`. There the first is the height the plot is drawn at, not only its least, so it was left. Open.
4. **Import cycle between `scene.ts` and `plan.ts`.** `scene.ts` imported `roleOf` from `plan.ts`. Fixed in `112871a`: `roleOf` lives in `scene.ts`, beside `isDim`, and `plan.ts` imports it. The package index exports it as before.
5. **The test run picked up agent worktrees.** `vitest run` globbed `.claude/worktrees/` and reported another agent's unfinished work as a failure here. Fixed in `898dd8e`: `pnpm test` runs `--dir test`, and the worktrees are ignored by git.
6. **`tokens-generate` fails on the working copy.** Uncommitted token edits from another session, not a fault in the committed code. Two parts:
   - `generated/` did not match the edited config. Fixed: it has been regenerated, and "is what the config generates" passes.
   - "aliases the common tier to the ramps, per theme where the step differs" now fails. It expects light `--ua-color-background` to be `neutral-300`; with the retuned ramps it is `neutral-100` in both themes. The test wants a token whose step still differs by theme, or a new expectation. Settled since: the test expects `--ua-color-muted` and passes.

## At the merge

- The two branches merged with no text conflicts but did not typecheck together. `test/fit.test.ts` called the old `buildScene` signature and read `scene.plot`; it now places its scenes. Fixed in `23e8ebc`.
- A branch that reads a removed `ContainerRules` field (`axes.minWidth`, `axes.minHeight`, `secondary`, `bare.minPlotWidth`, `rows.minLabelWidth`, `band`, `notice`) will fail typecheck after merging. So will one that builds a rule set without `bare.numberWidth`, or that switches on every `Part` without `legend-top`. The prototype still needs `axes.minWidth` in its own rules, so a test that hands our rules to the prototype must fill it in.

## Not yet verified

- The bench after the merge was checked by reading its DOM in headless Chrome: 30 frames, no errors. Nobody has looked at it.
- Nothing has been checked in Safari itself or in Firefox. Open `/spike.html` in each and read the seven badges.
- After the merge the spike page was re-read in headless Chrome under virtual time: six items pass and item 3 reads fail, with no transition found. Virtual time fast-forwards transitions, so this is most likely the check and not the page, but it has not been re-run in real time here. Item 3 is the one to look at first when the page is opened by hand.

## Findings: the marks and chrome in Figma

As of October 14, 2026. The marks and the chart chrome were rebuilt as components in the Figma file *Unified Analytics Charts*, read from the code. Building them read the code closely, and these are what that turned up: possible faults in the code, questions to decide, and what Figma cannot say. Nothing in the code was changed.

### Decided October 14

1. **The data table and the words inside a plot stay in the mono face for now.** In code both take the page's face: `.uav-table` sets no family, and `.uav-plot :is(.uav-f-tick, .uav-f-value)` resets it to `inherit`, which reaches point labels and reference-line labels. In Figma each has a style of its own (`charts/table`, `charts/table-heading`, `charts/plot-label`), so the face can change there without touching the rest.
2. **A split point's readout is a line per series, with its swatch.** Today `readoutAt` writes one sentence, "Sep 8: Visitors (Search 177, Direct 123, Social 54, …)", with nothing tying a name to its line. The readout becomes the point and the metric on its first line, then a line for each series in the plot's order: its swatch, its name, its value at the end, the values in a column. It is taller, a line a series. In Figma it is `Readout / Split`, of `Readout / Series line`s. Not built in code: `readoutAt` returns a string, so the readout needs the rows and their paints, and the option's accessible name can stay the sentence. The swatches are on the tooltip surface, the constant lime, where some series colours are weak; that is still to look at.

### Possibly wrong in the code

1. **A dot in a plot never recedes.** `keys.ts` recedes the other series of a bar, line or area when one is chosen, but no rule reaches a dot. To check whether that is meant.
2. **A treemap's children have a radius of 2 in `place()` and 1 in the painter.** One of the two is wrong.
3. **Lit and unlit dots do not line up.** At optical size 72 the face draws a lit dot 3.375 px square, centred in its 4 px cell. `DOTS_CSS` draws an unlit one 3 px square at the cell's top left, so the two sit about a third of a pixel apart. The grid's dot should be worked out from the optical size the face is set at, or drawn by the face itself (below).
4. **An axis tick's paint is ignored.** The scene gives a tick `ink.muted`; `AXES_CSS` colours it with `color-label-axis` whatever the scene says. Only where the generated tokens are loaded: without them the token falls back to the scene's paint. And the scene paints every tick `ink.muted`, so nothing differs today.
5. **The keyboard's rule reads by its width alone.** `color-focus` resolves to the ring colour, the primary at 50% (60% in dark), so a crosshair the keys drive is told from the pointer's mostly by being 2 px wide.
6. **The key to sizes can never wrap.** `.uav-size` has `flex-wrap: wrap` but a fixed `block-size: 24px` and `overflow: hidden`, so a second line is cut off. Either the wrap is dead or the height is.
7. **The readout's width cap holds only in the top layer.** `min(320px, 100vw - 8px)` is on `[popover]`; elsewhere the cap is the figure's width.
8. **120 px, the plot height under which ranked y ticks go,** is still the `ponytail` in `cartesian.ts`, with no rule carrying it (Bugs, 2).
9. **The number in a donut's hole overruns the ring.** `place()` measures the number against the hole and leaves it out where it does not fit; the element applies only the `hole` rule, a plot narrower than 120 px. In dots "10.5k" is 108 px wide, and the hole is 96 px across in a view 160 px tall and 72 px in one 120 px tall, so on the donut, the half circle and the parliament the element draws the number across the ring. Either the element measures the number against the hole, as `place()` does, or the hole sets its number in a smaller cell. The views in Figma draw what the element does, and say so.
10. **`place()` and the element thin the x axis differently.** The element's `thinAxis` gives up a label that runs past the plot's far edge; `place()` keeps it (the adjacency matrix's longest page name). Neither checks the near edge, so the stripes' first label hangs off the left of the view in both.
11. **A country with no name.** In the unmapped sample's list, row 17 is named "–" (82 visitors): an empty country value, seeded on purpose in the fixtures, which `formatDimension` writes as a dash. Whether an empty value should read "Unknown" is the question.
12. **A bar is at least 3 px wide in the element and not in `place()`.** `.uav-row > i` has `max(3px, …)`; `place()` floors a list's own bar at 3 px too, but not a series segment or a band range, so a pixel painter shows those near zero as nothing.
13. **`place()` sets the number shorter than the element does in dots.** Its number heights run 36 to 70 px where the element's screen, with a cell of padding round it and a row between the value and the words, comes to 56 to 76. So a bare plot beside the number, and the number alone, are taller in a browser than the plan made room for. This is the older gap in Findings, step 4, item 5, now in the dot face.
14. **`place()` sets every label on a band x axis,** and the element's measured pass (`thin` in `measure.ts`) gives up the ones that meet. A pixel painter shows them overlapping: the box plot, the error bars, the Pareto and the grouped bars.

### To decide

1. **Ans Mono 1.5 can draw the screen.** The face now has unlit cells (`ss01`), a `█` that fills the whole 6 by 8 cell, spaces at whole-dot widths, and cell graphics in eighths. `packages/tokens/fonts` still holds 1.4. With 1.5, the unlit grid could be the face's own, which settles item 3 above; the three-per-em space is the three-cell space `NARROW` makes by hand. Still to come from the face: a point and a comma four cells wide, without which a number cannot be one run of type.
2. **The cell graphics fit the dot painter.** The lower fills are bars and sparklines in eighths, the shades are the prototype's dither patterns, and the left fills are a loading bar, which the element does not have. For `packages/dots`, when it starts.
3. **A rim label is never on a donut.** The scene makes rim labels only for a radial view whose slices are equal and whose value sets each one's reach. To confirm that a donut or pie is meant to have none.
4. **The prose rung is tall in a narrow view.** At 80 px wide the tldr sentence runs 240 to 320 px tall for the scatter, bubble, quadrant, box and error-bar samples. A shorter sentence for that rung, or the number alone below some width, would fit better.
5. **The second and third series colours are hard to tell apart:** grass and teal, side by side in the series, stacked and grouped samples.

### Open in the Figma file

What building the views from the code's placed scenes found in the components themselves. To fix in the file, not the code.

- **The metric display's change and note lines are in Ans Mono with no text style,** so a script cannot set their words; the view agents put `charts/value` and `charts/tick` on each instance to get past it. Give the two layers their styles in the component.
- **The point, comma and space glyphs are wider than the code's:** 24, 24 and 20 px, where `NARROW` makes them 16, 16 and 12. A number with a point runs a cell long. Waits on the face's narrow point and comma.
- **The glyph set has no `m`.** The face has it, so "436ms" shows as "436s" in the cartesian views (box, error bars, candlestick, fan). Add it.
- **Units were narrowed by hand in the cartesian views.** The view agent set k, % and s to 16 px; in code a unit is a slot six cells wide, like a figure (`.uav-glyph-run sup`). Those numbers read a little short.
- **`View / Beside`'s placeholder body is at 40% opacity** in the main component; every view resets it.
- **The metric display does not widen with its glyphs,** so each instance is fixed to its room, rounded down to a whole cell.
- **An `Arc` instance does not resize its ellipses;** the views rescale it and put the stroke back.
- **A treemap box's label has no text style;** the code sets it in the tick face.
- **The choropleth example's United States is 2.8 px short** at its western edge against the scene.
- **The bullet's background ranges have no component;** they are rectangles bound to the band colours.
- **The key to sizes paints its dots in the series colour** in one place and `ink.muted` in another; the scene says `ink.muted`.
- **A Sankey's target nodes are muted at 70%** in `Link / Node`; the scene paints them `ink.muted` at full strength.
- **Soft fills:** treemap parents and list bars use the `*-soft` colour variables where the scene asks for a series colour at 14% or 20% opacity. The element's `nodePaint` does the same for the soft tone, so this is likely right; to confirm for the treemap.

### What Figma cannot say

Recorded so the Figma file is not taken for the code where they differ.

- **Placing by value.** Axis labels, end labels, point labels, rim labels and the crosshair's chips are placed by hand in each example. Figma cannot stand a box at a point by its middle or its end, measure collisions, or give up a label that does not fit (`data-thin`).
- **Lining up across rows.** The table's columns, a list's value columns and the shares legend's values are fixed widths where the code uses a grid or a subgrid.
- **A squarified layout.** A treemap resized in Figma scales its boxes and is not laid out again.
- **Motion.** The roll of a number in dots, the run under the pointer, the readout's delay and a line drawing in are not shown.
- **Exposing what is in a slot.** Figma will not expose a nested instance's properties from inside a slot, so the crosshair's hover or keys state is set on each rule.
- **The face in scripts.** The scripts that build the file cannot load Ans Mono, so the mono styles are set by hand after a script has made them.

## Findings: the review of October 12 and its fixes

As of October 14, 2026. A review of the system as it shipped in Spacefast found eleven bugs, and each was fixed on `map-zoom`, from `0e8e067` to `175e23e`, by agents working in parallel. These are what the review raised and the fixes did not take on, and what the agents flagged while fixing. Recorded at `175e23e`, and checked again at `efa899f`: none had been fixed. None of the fixes are copied to the Spacefast monorepo.

### Before a second host

The review's list of what would bite a host other than Spacefast. None of it is started.

1. **One language, locale and time zone.** `en-US`, UTC and English sentences are hard-coded in core and `packages/dom`. Strings, locale and zone as inputs is the large one.
2. **Two copies on one page fail silently.** `defineUaView()` returns if any version is already defined, and the mark and painter registries are module state. Several plugins bundling their own copy is normal on wp-admin.
3. **A thin host contract.** There is no loading state and no `ua-error` event, missing inputs show a red error to end users, and there are no element or event typings and no React binding. `view.inputs` (bug 6) is the atomic setter the rest would hang on.
4. **Layout and style leaks.** The view is 0 px wide in a shrink-to-fit parent such as a flex row or a table cell, and the page's `text-transform`, `letter-spacing` and `font-weight` reach the tick labels.
5. **Accessibility.** A metric's definition is a pointer-only `title`, series differ by colour alone, and the data table appears only if the host sets `table`.
6. **Cost at size.** A 2,000-row list takes 187 ms to paint and 301 ms to update in Chromium (305 and 675 in WebKit). Hover on a 3,650-point line costs 12.7 ms per pointer move, with quadratic loops in `keys.ts` and `scene.ts`.
7. **Packaging.** Nothing is built for release, and no default theme ships; the face's CSS is in `packages/tokens/fonts` but nothing exports it.

### What Spacefast worked around

Each is a gap in what the packages offer, seen from the host that shipped.

1. **Tokens:** 57 `--ua-charts-*` declarations written by hand, since no default theme ships.
2. **Fonts:** two faces embedded as base64 and adopted into the document, because the package names the face and ships neither it nor a switch to turn the dots off.
3. **React wrapper:** it sets the three properties in a layout effect only to stop the red "no spec" error flashing. `view.inputs` can replace that.
4. **Map pre-check:** the host checks for a known country first, because the geo mark throws when none match.
5. **Titles and truncation:** the host draws every title and its own "+N more", since `spec.title` is only an `aria-label` and a result has nowhere to carry `truncated` or `other` (the adapter's open item 6).
6. **Query surgery:** it slices `query.metrics` and strips `compare` to steer which number and delta show.
7. **Unused by the host:** `ua-activate`, `table`, `rules`, the JSON `<script>` inputs and `keep`.

### Left by the fixes

1. **The element and core word an unknown metric differently.** `view.ts` checks first and ends "Pass the catalog the query was run against."; `resolve()` ends "Add it to the catalog passed in, or correct the name in query.metrics." The element's is the one a host sees.
2. **A refused input's message is hidden in a fixed-height box.** The last good view stays drawn (bug 6) and the message sits under it, past the box's edge. Seen in Chromium and WebKit on the samples page: the old chart, and no message. Accepted for now in the bug 6 round.
3. **A share view with no total paints nothing in place of its band or circle,** only a legend of values, with nothing to say why. Whether it should show a notice is **to decide.**
4. **A null time value on an x axis is refused** with the error for an unreadable time, naming "null", where a row label for the same value shows a dash. It printed "Invalid Date" before bug 2. A small change in `scene.ts`.
5. **A null bin start on a linear x is drawn at 0,** not skipped, and the numeric-dimension prose can say "at a size of null".
6. **A row that lacks a metric's key is not refused,** where one with the key set to `undefined` is. It reads as a dash or a gap in most views, and "NaN%" in the band.
7. **A previous figure of 0 gives the prose "with no prior period to compare",** though there is one. The delta says "New"; and 0 to −5 is "New" too, as the prototype has it.
8. **`rangeLabel`, a public export of core, now throws** on a form it cannot say, where it used to return the form as written. `plan.ts` calls it too, to refuse a range early.
9. **A face declared after the first paint** reaches the number only at the view's next paint (bug 8). Check the order in Spacefast's wrapper before copying the fix across.
10. **Two rows of the same name trade identities** when their order in the result swaps (bug 5). Only a host passing ids, not labels, avoids it.
11. **Duplicates in a matrix and on a map.** A matrix merges two rows of one cell, the last winning; geo assumes its rows run in step with the result.
12. **Right-to-left, still:** a row label or legend shows "/pricing" as "pricing/"; the dot-matrix number reads correctly but sits at the left of its screen; a page that flips direction with no new data keeps the legend's old direction until the next paint; and in two of about ten WebKit runs a few views fitted differently just after a flip, not seen again in six more. The matrix ramp follows the page, low end at the right; a one-line removal in `chrome/ramp.ts` makes it read like an axis. **To decide.**
13. **Words core still writes without the catalog's say:** labels are lower-cased inside sentences, so an acronym loses its capitals; the heatmap prose says "the busiest" of revenue too; matrix ticks and a categorical x tick print "null" and bare country codes; `matrix.ts` has a literal ": No data"; and error examples in `plan.ts` and `view.ts` name fixture fields ("page", "visitors").
14. **The live wording changed for want of a noun:** "7 people are on the site right now" reads "Present now: 7 right now". A per-metric noun is raised in the reference's Open 11; the old wording can come back with one.
15. **The empty notice wraps to two lines in narrow frames** (166 to 274 px) since the colon form, and `place()` clips it sooner: the Visitors notice needs 238 px to show whole, where it needed 198.
16. **Bug 10 has no test;** it is one line in a lifecycle callback, checked in a browser only.

### To decide, with recommendations

1. **Ranges other than a count of days** (the reference's `range`, Open). Until settled, any other form is refused by name. Recommended: the engine sends the words itself, a `meta.rangeLabel` such as "September 2026", which core says as written, so calendars and locales stay out of core as totals and statistics do.
2. **Site time zones** (the reference's Open 17). Recommended: the adapter rewrites each instant as the site's clock time, so core never takes a zone.
3. **A week reads as its Monday,** "Aug 31", which on an axis cannot be told from a day. Refusing weeks until a result states its grain is one line.

### Not verified

- Firefox, for every fix in this round, and a screen reader.
- In a browser, after the last round: the two-dimension and grid sentences with no total, the number dimension's refusal, and the `live` page. The rest of the last round was read on live views in headless Chromium and WebKit, with the whole bench swept for errors and stray words.
- Two real bundles on one page, a strict content security policy, bundle size, and the geo zoom.
- Nothing runs the element in the test suite. The review recommended a Playwright smoke file against the bench first: every sample across widths with no tokens loaded, and four behavioural checks.
