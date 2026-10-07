# Feedback from the build

As of October 7, 2026. What executing `docs/dom-painter-plan.md` has found so far: where the plan did not hold as written, bugs, and loose ends. Steps 1, 2 and 3 are merged into `dom-painter`.

Each entry says what was found, what was done about it, and what is still to decide. Nothing here has been settled quietly.

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
4. **The notice has no height need.** `resolve()` collapses it under 40 px, but 40 was never a `CONTAINER_RULES` number, so no rule carries it.

**To decide:** whether the DOM painter accepts these gaps as measured-pass work, or the rule shape grows a way to say "this part's need includes that part's size".

## Findings: step 2, ratio scene and `place()`

`buildScene` returns one ratio scene with no size; `place(scene, container)` makes the pixel scene. The parity sweep and the 18 golden pixel scenes are unchanged.

1. **`place()` rebuilds the x scale; it does not multiply ratios.** `lo + ratio * span` differs from d3's band arithmetic in the last bit, and the sweep compares exactly. So the scene also carries `rows` and `scale`, and the `x` and `w` ratios are for the DOM only. A test holds them to the placed pixels within 1e-9. **To decide:** accept, or relax parity to a tolerance and drop the scale from the scene.
2. **Paths carry `points` as well as `d`.** `place()` regenerates the path at pixel size, since scaling a rounded string would not match. The DOM painter's per-frame interpolation needs the points too.
3. **Placed nodes do not carry `part`, `role`, `row` or `rank`.** The prototype's nodes have none, so adding them breaks every parity case. "Identical in both forms" holds for keys, paint and `layer` only. If pixel painters want the rest, the parity test should strip them on purpose.
4. **Four parts have no 0-to-1 coordinates:** `number`, `rows`, `legend` and `notice`. They are text in flow or fixed-height rows. Their nodes carry `row` and order, and `place()` supplies the pixel constants.
5. **A `notice` part was added** for the empty state. The plan's fixed part sets lacked it.
6. **The number's nodes are always in the scene,** even when the plan does not show it, because a rule's `show: ['number']` needs something to show. `scene.parts` says what the plan shows.
7. **The band's one-line legend is not emitted beside the full legend.** Step 4 needs both if a rule swaps them.
8. **A bare sparkline will sit slightly lower in the DOM than in pixels.** The prototype rounds the y scale only when the y guides are on, so a bare plot fills its height. One unbounded scene always rounds. Kept for parity in pixels; not settled for the DOM.
9. **The four-tick departure touches no swept case.** Under the default rules a plot with axes is never under 120 px tall. It is named in its own test, with a context that allows an 80 px plot.
10. **The tick rank policy was the agent's choice.** A tick is unranked if a two-tick scale would also have it, otherwise `rank: 1`. "Keep only the ends" was tried and dropped, because it thinned the trend more than the prototype does.
11. **The middle x tick uses `rank: 1`,** not a `mid` class. The fit rule's `x-tick.mid` has to map to it.
12. **No scene nodes for the hit targets.** `scene.rows` gives the painter the list.
13. **There is no "unbounded" container.** A browser caller passes `makeContainer(Infinity)`. It works and is tested, but it is a convention, not an API.

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

## Bugs

1. **Prototype: duplicate keys on a one-row time series.** A time series with exactly one row emits two `xtick` nodes with the same key. No swept case reaches it. Kept and flagged, as the parity rule asks. To fix it, change the behaviour and the test together, on purpose.
2. **`scene.ts` hard-codes numbers the rules now own.** 380 for the middle tick, 76 for the number beside a bare plot, 40 as the notice's least height. A context that changes the `mid-tick` rule changes what is reported as dropped, but not what is drawn. Open.
3. **One number held twice.** `axes.minHeight: 120` (the size `place()` builds to) and the `axes` rule's `block: 120`. A context that lowers one must lower the other, or the axes are dropped anyway. The y tick test hit exactly this at the merge. Open.
4. **Import cycle between `scene.ts` and `plan.ts`.** `scene.ts` imports `roleOf` from `plan.ts`. It is safe, since each uses the other only inside functions. Moving `roleOf` out would remove it. Open.
5. **The test run picked up agent worktrees.** `vitest run` globbed `.claude/worktrees/` and reported another agent's unfinished work as a failure here. Fixed in `898dd8e`: `pnpm test` runs `--dir test`, and the worktrees are ignored by git.
6. **`tokens-generate` fails on the working copy.** Uncommitted token edits from another session, not a fault in the committed code. Two parts:
   - `generated/` did not match the edited config. Fixed: it has been regenerated, and "is what the config generates" passes.
   - "aliases the common tier to the ramps, per theme where the step differs" now fails. It expects light `--ua-color-background` to be `neutral-300`; with the retuned ramps it is `neutral-100` in both themes. The test wants a token whose step still differs by theme, or a new expectation. Open, and that session's to settle.

## At the merge

- The two branches merged with no text conflicts but did not typecheck together. `test/fit.test.ts` called the old `buildScene` signature and read `scene.plot`; it now places its scenes. Fixed in `23e8ebc`.
- A branch that reads a removed `ContainerRules` field (`axes.minWidth`, `secondary`, `bare.minPlotWidth`, `rows.minLabelWidth`, `band`, `notice`) will fail typecheck after merging. The prototype still needs `axes.minWidth` in its own rules, so a test that hands our rules to the prototype must fill it in.

## Not yet verified

- The bench after the merge was checked by reading its DOM in headless Chrome: 30 frames, no errors. Nobody has looked at it.
- Nothing has been checked in Safari itself or in Firefox. Open `/spike.html` in each and read the seven badges.
- After the merge the spike page was re-read in headless Chrome under virtual time: six items pass and item 3 reads fail, with no transition found. Virtual time fast-forwards transitions, so this is most likely the check and not the page, but it has not been re-run in real time here. Item 3 is the one to look at first when the page is opened by hand.
