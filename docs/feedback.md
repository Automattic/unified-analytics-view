# Feedback from the build

As of October 8, 2026. What executing `docs/dom-painter-plan.md` has found so far: where the plan did not hold as written, bugs, and loose ends. Every step of the plan is built and merged into `dom-painter`.

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
7. **The band's one-line legend was not emitted beside the full legend.** Fixed in `6b18cd5`: the scene carries both. The one-line legend is its own part, `legend-top`, and `scene.parts` names the one the plan shows, as it does for the number. `place()` draws only the parts named, so the pixel scenes are unchanged. Still open: the keys are the prototype's, `legend:` plus the segment and `legend:top`, so a segment called "top" would now meet the one-line legend's key. No fixture has one. Renaming either key changes every parity case for the band, so it is a deliberate departure to decide, not a quiet fix.
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
2. **The axes rule's `set` needs more than `grid-template-columns`.** The grid areas, the gap, the padding and the bare plot height all have to switch under the same condition. Nothing reads `--vg-arrange`.
3. **The plot's height must be a stated `block-size`,** read from a custom property, with one added rule: `@container view (block-size >= 0px) { .vg-plot { block-size: auto; } }`, which matches only when the view was handed a box. `contain-intrinsic-block-size` and `min-block-size` lay out correctly in Chrome 155 but answer no `block-size` query. So one stylesheet does serve both sizings, and no `fit="box"` attribute is needed.
4. **Smaller ones.** Axis labels are grid items in one cell moved by a percentage inset, not absolutely positioned, so the y-axis column is sized by its content. X labels carry `start`, `mid` and `end` classes. The SVG is inset 2 px each side for the point scale's padding. The natural view is 210 px tall, where the prototype's 184 includes its margins. The `translate` used is physical, so right-to-left is not handled.

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
3. **The stated `block-size` is on `.vg-body`, not the plot.** The plot stretches inside it and still answers `block-size` queries in Chrome and WebKit.
4. **Ranked y ticks are thinned by a rule local to `packages/dom`,** on the view at `block: 152` (120 for the plot, 10 above, 22 for the x axis). The y axis sits outside the `plot` container, so a `plot` query cannot reach its labels. It is wrong when the number sits above the plot. A `plot` rule in core, with the y axis inside that container, would say it properly. Open.
5. **Two additions beyond the plan:** base styles sit in `@layer vg`, so compiled rules win whatever the specificity; and rule names are validated before they reach a selector, because a rule set can arrive as markup JSON.

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
- Right-to-left is not handled.
- Wanted from core: `fmt` is not exported, so the table formats numbers itself (core's half fixed in `fa96d14`: it exports `formatValue` and `formatDimension`; the table does not use them yet); the number's short-form widths (160, 200, 120) are constants in `place.ts`, copied into the base CSS.
- The table is built but has only been checked by its row count.
- A running dev server does not see a new workspace package. After `packages/dom` was merged the bench was blank until the server was restarted.

## Findings: step 4, `rows` and `band`

Both layouts are built, each in its own file under `packages/dom/src/layouts/`. Observed in Chrome 155 and Playwright's WebKit; not in Firefox or Safari itself.

Rows:

1. **The plan's height-limit trick needs a spacer.** A flex line always takes its first item, so when not even one row fits, the first row was cut mid-height. An empty `::before` as the first flex item, full width, with a negative margin that cancels the gap, makes the first row wrap away like any other. Still no script. With it, only whole rows show at every checked size.
2. **Top pages at 120 px wide shows a squeezed list where `resolve()` shows the number.** Expected: the widest value's room depends on content and cannot be said in CSS. A container query on the label track can only style what is inside it. Open; it wants the measured hook.
3. **Present now fits one more row in a box than the pixel pipeline,** because the number block is 50 px tall in the DOM and 58 px in pixels. The element owns that.
4. **A box shorter than one row, with no number above, would be blank** where `resolve()` shows the number. Not observed; core has no block need for `rows`, and a layout's own rules are static, so it cannot write one from `rules.rows.rowHeight`. Observed in review, in Chrome 155: a 346 by 27 px box showed nothing. Fixed there: a layout's `rules` is now handed the context's rule set, and the rows layout writes a `marks-block` rule from `rows.rowHeight`, as the band has one. It asks the view, so it has the band rule's limit.
5. **A row has no node in the scene.** The layout makes a `RectNode` per row to reuse `keyed`. A row node in the scene, or a `keyed` that takes any `{ key }`, would be cleaner.
6. **Bar radius fallbacks disagree:** rows fall back to 3 px and cartesian to 2 px on the same token.
7. The `list` and `listitem` roles on the rows were the agent's addition, not the plan's.

Band:

1. **A full legend under a height limit is done in CSS, with no script.** The plan left it open for the DOM. The layout writes its row count as `--vg-rows`, and a `max-block-size` clamp on `100cqb` swaps the legends. It assumes fixed-height legend rows.
2. **A rule local to the layout collapses the band under 48 px,** because core's band `marks` rule has no block need. It is wrong when the number sits above the band. A block need in core would remove it.
3. **With `keep`, kept parts are clipped by the box** where `resolve()` would collapse. This is step 1's finding 3 again.
4. **Reading order can drift.** A segment entering mid-list is placed with `order`, so DOM order and visual order differ until the layout is rebuilt. The legend is read by assistive technology. The fix belongs with transitions and keys, since moving a kept element cancels its transition. Open.
5. **Bar and legend row heights (24 px) are held twice,** in `place.ts` and in the layout's CSS.
6. One 404 in the bench's console, not chased.

## Findings: step 5, the measured pass

Built in `packages/dom/src/measure.ts` and `view.ts`. It settled in one run at every size swept (widths 420 to 40 and back, box heights 200 to 20 and back, 66 views), in Chrome and WebKit, with no hysteresis: nothing it reads depends on what it writes.

**Decision 5 holds: the prose rung is measured.** The threshold is the number's own width, about 69 px for "10.5k", and it now follows the font and the data with no constant. It costs a hidden ruler that holds the number in each form, and a lift-and-reset of the attribute while a view is prose.

What it writes: `data-fit` on the number (`small`, `short`, `delta-short`, `no-note`), `data-fit="prose"` on the figure, `data-thin` on x labels that would collide. The old fixed queries stay as the fallback where there is no `ResizeObserver`.

The seam gained one optional member, `measure?(body, room)`, for a layout's own measured work. Cartesian uses it for tick thinning.

Closed by it: the 40 px box and the trend at 120 by 60 now go to prose; at 120 px wide the number is 34 px with its note, as in pixels.

New findings:

1. **A "ResizeObserver loop" error can reach the host page.** The pass writes inside its observer callback. When that changes the view's natural height and the page itself observes an ancestor, the window gets "ResizeObserver loop completed with undelivered notifications". Benign, but an error tracker on a customer's page will see it. The alternative is to defer the write a frame, which paints one frame unfitted. The synchronous write was kept. **To decide.**
2. **Prose appears in the middle of a narrowing sweep.** In a 60 px box the trend goes sparkline, then prose from about 152 to 104 px, then the number again once the note stops fitting, then prose. `resolve()` does the same at 120 and 80 px, so this is the reducer's behaviour, now visible live. Dropping the note for height before falling to prose would fix it. Not done, to stay with `resolve()`. Decided October 7, and core's half fixed in `7c1139d`: `place()` drops the note of a number that stands alone and is too tall, `resolve()` goes to prose only if it is still too tall, and the plan lists "the note under the number" in `dropped`. In the 60 px box the trend now goes sparkline, number, prose. This departs from the prototype in 36 swept cases, all of them prose there and the number alone here; they are named in `test/core.test.ts` and have their own describe. Two limits: only a number that stands alone gives up its note, so a spec that keeps its marks still goes straight to prose; and any note goes, the unranked one of an instant metric too, to agree with the measured pass. No swept case turns on either.
3. **Prose overflows a small box.** At 40 or 60 px tall the sentence is clipped by whatever holds the view.
4. **The `mid-tick` rule is more cautious than the labels need.** By measurement the middle label clears the others down to about 150 px; the rule drops it under 380. Kept, since it matches `resolve()`.
5. **The ladder skips the full form at 26 px.** `place()` can show a long full number small; the pass goes to the short form at 37 px first.
6. **Layers in a 40 px box shows the number where `resolve()` says prose.** `place()` counts a lone number as 42 px tall; the DOM sets it in 34, which fits.
7. **The no-prior delta shows whole** where pixels clip it by character count.
8. Still not measured: a bare plot beside a number wider than 76 px. Still left-to-right only.
9. Not observed: a web font swapping in. The ruler is observed for it, but nothing loaded a font.

Still differing from `resolve()` and not the measured pass's: at 346 by 100 the secondary layers stay, and a bare plot fills a box where pixels keep 46 px.

## Findings: step 5, transitions

Built in `packages/dom/src/motion.ts`. Observed in real time in Chrome 155 and Playwright's WebKit 26.5.

What moves, only on a data change within the same layout: positions transition as registered custom properties; entering nodes fade in by `@starting-style`, with bars and segments growing from nothing; leaving nodes placed by a ratio fade out, and anything that takes room in the flow leaves at once, so the measured pass never reads a leaving node. Paths are redrawn per frame. Nothing animates on resize, under reduced motion, or where registration fails. Three motion tokens are new: update, exit, and their easings, beside version 4's entrance.

1. **Core's path keys are not stable between data states.** Keys count layers, so when the comparison layer drops, the primary line takes the comparison's key, `L1:line`. By key that would morph the dashed comparison into the primary line. Guarded locally: a path whose role changed is treated as new. Core's keys should name the layer. Fixed in `60da786`: a layer's key is its role and mark, `primary:line` for `L2:line` and `primary:bar:2026-09-08` for `L0:bar:2026-09-08`, in every layout. Two layers of one role and mark are counted among themselves, `primary:text` and `primary:text#2`, with the previous series counted last, so neither a reduction nor missing prior data can move a count. The prototype keeps its keys, and the parity tests map them to ours in one helper, `ourKeys`. The golden scenes changed in key names only. The painter's guard is still there and can go.
2. **`packages/dom` carries its own copy of d3-shape's monotone curve,** because core does not export a path function and the package may not add a dependency. A test holds it string-identical to core's `d` for the trend at 28, 14 and 7 days. Core should export one. Core's half fixed in `7bfb5aa`: `pathD(points, curve, fill)` is exported, and the scene builder and `place()` both draw with it, with no golden scene changed. The copy in `packages/dom` is still there and can go.
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

1. **Three departures from version 4, all the agent's choice.** Up and down also step in the `rows` layout. A click activates, and on touch the second tap does. A chosen point stays when the mouse leaves a focused view. **To decide.**
2. **The readout is not in catalog format.** Core's `fmt` and `fmtDay` are not exported, so dates read `2026-09-08` and numbers are grouped as the table groups them. The catalog's `unit` is unused. Core's half fixed in `fa96d14`: `formatValue(value, metric)` and `formatDimension(value, dimension)` are exported, so a day reads "Sep 8". Every unit in the catalog is a count, so `unit` still picks nothing; the function is where a new unit gets its branch. The readout does not use them yet.
3. **The partial day is not marked in the readout.** The last trend row reads "Visitors 175" with no "so far". Core's half fixed in `fa96d14`: `partialNote(row)` gives "so far" for the unfinished bucket and nothing for a finished one, so the words are core's. The row's `partial` flag is all a painter needs to tell. The tldr prose says nothing of the unfinished day, so there was no wording to match; the scene's own `note` on the dashed tail still reads "incomplete bucket", as the prototype's does.
4. **Rows lost their list semantics** to become a listbox. A screen reader in browse mode may read it as one control. Unverified.
5. **Rows clipped by a height limit are still options** in the accessibility tree: "1 of 8" when five show.
6. **The plan's `vg-hits` layer is only needed in cartesian.** In rows the row is the target, in band the segment, which is no longer `aria-hidden`.
7. **The readout covers the number in a sparkline tile,** since it has to stay inside the view's box, and sits over the x labels under a full trend. It is placed once and does not follow a resize or scroll. The look is the owner's.
8. **No focus token exists** among version 4's names, so the focus ring is the browser's own.
9. **Chrome makes a scrolling table focusable,** so in table mode nine narrow views become tab stops on the figure. Not a trap.
10. `scene.rows[i]` is taken to match `result.rows[i]`. True of every builder today, and marked in the code.

## At the merge of motion and keys

Checked together in Chrome and WebKit: stepping, activation, and a change from 28 days to 7 mid-transition.

- **Hit targets would have slid and faded with the marks,** since they carry the registered properties and a key. Fixed in the merge: the hit layer takes its new places at once and a leaving target goes at once.
- **A leaving band segment keeps `role="option"` with the id `hit--1`** for the 150 ms it fades. It is skipped when stepping. Open.
- **The two branches were merged on a side branch first,** `dom-painter-step5`, because the main checkout held another session's uncommitted edits to `apps/bench/index.html`. It was merged into `dom-painter` once that work was committed, with no conflict.

## Findings: the review of October 7

`dom-painter` was reviewed against `master` at `5ff3def`, with findings reproduced in headless Chromium, WebKit and Chrome 155. Fourteen were fixed in the same pass: row keys that are not strings, the `table` attribute, fit rules at a fractional zoom, a repaint under a resting mouse, sizes under a scaled ancestor, duplicate keys in `keyed`, the alert shown while markup is parsed, marks in print and forced colours, a box shorter than one row (rows finding 4), a lone "0" on a thinned y axis, a touch that becomes a scroll, `placeRows` and `rules.rows`, a partial nested `rules`, and the clipped one-line legend. No screen reader, touch device, Safari or Firefox was used.

Two of the fixes are choices to confirm. Marks keep the page's own colours in forced-colours mode (`forced-color-adjust: none`), where mapping them to system colours is the other answer. `placeRows` now reads `rules.rows`, a departure from the prototype under any row size but the default; it has a named test in `test/fit.test.ts`.

What it found and left, all open:

1. **The container is named plain `view`.** `@container view (block-size …)` skips a host that is sized in width only, and is answered by any ancestor size container the page also names `view`. Seen in Chrome: a `container: view / size` wrapper 500 px tall around a stacked trend at 346 px gave a 46 px host with a 14 px plot, and a Channel mix 0 px tall. The plan names the containers `view` and `plot`. Recommended: prefix both, `vg-view` and `vg-plot`, and change the plan with them.
2. **Ranked y ticks are thinned at two different heights.** The DOM's local rule asks 152 px of the view (cartesian finding 4); `place()` asks 120 px of the plot, gutters included. Bug 2's `plot` rule with `block: 120` would give both one number.
3. **The `legend:top` key meets a segment named "top".** The one-line legend's key is `legend:top`, and so is the legend entry of a band segment whose dimension value is `top`. Keys must be unique.
4. **`note-first` drops unranked lines under the number.** An empty state can show a bare "0" without "No visits yet". The reference marks this to confirm.
5. **Scene labels write a time dimension raw on rows and band:** `2026-09-29` where the readout says "Sep 29". The prototype does the same, so `formatDimension` there is a parity departure to make on purpose.
6. **One unbounded scene scales the y axis to layers a rule later hides.** A sparkline whose secondary layer is hidden can sit at 30% of its height. Design-level: the scale would have to follow what shows.
7. **View-level block needs are wrong when the number sits above the plot.** The need is asked of the view, which also holds the number, so axes can stay around a 4 px plot. Known; the same limit as the band's and the rows' `marks-block` rule.
8. **Compiled rules differ in specificity when one has `keep`,** so "later wins" does not always hold. Latent: no two rules in the set meet this way today.
9. **Only a rule's `needs` are shared.** `resolve()` reads nothing of `hide`, `show`, `set` or `keep`, and `FitRule.set` is read by nothing at all.
10. Residuals of the fixes: a view left inside a removed iframe still raises ResizeObserver loop errors, and a hovering pen is treated as touch.
11. Smaller, as the pixel painter has them: a rule's label sits above the top edge when the rule is at the top of the scale, and the end labels of a category axis overflow. A spec with no primary layer leaves an empty plot. A list clipped to nothing is still a tab stop (keyboard finding 5), and both band legends are exposed to assistive technology in a box.
12. Efficiency, not taken: transitions on registered properties restyle every node each frame (plan section 6); one forced layout per view per data change; the hidden table's inputs are not stored, so it cannot be skipped; `resolve()` builds the scene twice and places it at Infinity; the fit rules are compiled on every render.
13. Cleanups, not taken: `test/fit.test.ts` copies the sweep harness; `paint-svg.ts` duplicates the paint table; `.stage` is defined in both `bench.css` and `demo.css`; `surface.json` is unvalidated; the token generator lost its validation, and `{color.white}` is unresolved in the light primitives.

## Bugs

1. **Prototype: duplicate keys on a one-row time series.** A time series with exactly one row emits two `xtick` nodes with the same key. No swept case reaches it. Fixed in `37edd5d`, as a departure from the prototype on purpose: one row has one tick. It has its own test, which shows the prototype's two and says why ours differs. The prototype itself is unchanged.
2. **`place.ts` and `plan.ts` hard-coded numbers the rules now own.** 380 for the middle tick, 76 for the number beside a bare plot, 40 as the notice's least height. A context that changed the `mid-tick` rule changed what was reported as dropped, but not what was drawn. Fixed in `4f3d51b`:
   - `place()` asks the `mid-tick` rule, with the question `resolve()` asks.
   - 40 is the `notice` rule's block need.
   - 76 is `rules.bare.numberWidth`, read by both. A fit rule could not carry it: it is not a container's need but one term of the `marks` rule's 152 (76, a 12 px gap and a 64 px plot). So it is still held twice in that sense. A context that changes `numberWidth` should change the `marks` need with it.
   - Not touched: 120 px, the plot height under which `place()` drops ranked y ticks. No rule carries it, and section 3 of the plan says one should. A `plot` rule with `block: 120` would say it.
3. **One number held twice.** `axes.minHeight: 120` (the size `place()` builds to) and the `axes` rule's `block: 120`. A context that lowered one had to lower the other, or the axes were dropped anyway. Fixed in `5ee81d2`: `axes.minHeight` is removed and `place()` builds to the rule's block need. The y tick test lowers one number. The same pair remains for a bare plot, `bare.height: 46` and the cartesian `marks` rule's `block: 46`. There the first is the height the plot is drawn at, not only its least, so it was left. Open.
4. **Import cycle between `scene.ts` and `plan.ts`.** `scene.ts` imported `roleOf` from `plan.ts`. Fixed in `112871a`: `roleOf` lives in `scene.ts`, beside `isDim`, and `plan.ts` imports it. The package index exports it as before.
5. **The test run picked up agent worktrees.** `vitest run` globbed `.claude/worktrees/` and reported another agent's unfinished work as a failure here. Fixed in `898dd8e`: `pnpm test` runs `--dir test`, and the worktrees are ignored by git.
6. **`tokens-generate` fails on the working copy.** Uncommitted token edits from another session, not a fault in the committed code. Two parts:
   - `generated/` did not match the edited config. Fixed: it has been regenerated, and "is what the config generates" passes.
   - "aliases the common tier to the ramps, per theme where the step differs" now fails. It expects light `--ua-color-background` to be `neutral-300`; with the retuned ramps it is `neutral-100` in both themes. The test wants a token whose step still differs by theme, or a new expectation. Open, and that session's to settle.

## At the merge

- The two branches merged with no text conflicts but did not typecheck together. `test/fit.test.ts` called the old `buildScene` signature and read `scene.plot`; it now places its scenes. Fixed in `23e8ebc`.
- A branch that reads a removed `ContainerRules` field (`axes.minWidth`, `axes.minHeight`, `secondary`, `bare.minPlotWidth`, `rows.minLabelWidth`, `band`, `notice`) will fail typecheck after merging. So will one that builds a rule set without `bare.numberWidth`, or that switches on every `Part` without `legend-top`. The prototype still needs `axes.minWidth` in its own rules, so a test that hands our rules to the prototype must fill it in.

## Not yet verified

- The bench after the merge was checked by reading its DOM in headless Chrome: 30 frames, no errors. Nobody has looked at it.
- Nothing has been checked in Safari itself or in Firefox. Open `/spike.html` in each and read the seven badges.
- After the merge the spike page was re-read in headless Chrome under virtual time: six items pass and item 3 reads fail, with no transition found. Virtual time fast-forwards transitions, so this is most likely the check and not the page, but it has not been re-run in real time here. Item 3 is the one to look at first when the page is opened by hand.
