# Feedback from the build

As of October 7, 2026. What executing `docs/dom-painter-plan.md` has found so far: where the plan did not hold as written, bugs, and loose ends. Steps 1 and 2 are merged into `dom-painter`. Step 3, the spike, is still running and has no entries yet.

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

## Bugs

1. **Prototype: duplicate keys on a one-row time series.** A time series with exactly one row emits two `xtick` nodes with the same key. No swept case reaches it. Kept and flagged, as the parity rule asks. To fix it, change the behaviour and the test together, on purpose.
2. **`scene.ts` hard-codes numbers the rules now own.** 380 for the middle tick, 76 for the number beside a bare plot, 40 as the notice's least height. A context that changes the `mid-tick` rule changes what is reported as dropped, but not what is drawn. Open.
3. **One number held twice.** `axes.minHeight: 120` (the size `place()` builds to) and the `axes` rule's `block: 120`. A context that lowers one must lower the other, or the axes are dropped anyway. The y tick test hit exactly this at the merge. Open.
4. **Import cycle between `scene.ts` and `plan.ts`.** `scene.ts` imports `roleOf` from `plan.ts`. It is safe, since each uses the other only inside functions. Moving `roleOf` out would remove it. Open.
5. **The test run picked up agent worktrees.** `vitest run` globbed `.claude/worktrees/` and reported another agent's unfinished work as a failure here. Fixed in `898dd8e`: `pnpm test` runs `--dir test`, and the worktrees are ignored by git.
6. **`tokens-generate` fails on the working copy.** `packages/tokens/config/leonardo.colors.js` and `leonardo.json` have uncommitted edits from another session, and `generated/` has not been rerun to match. Not a fault in the committed code. Open until that session regenerates or reverts.

## At the merge

- The two branches merged with no text conflicts but did not typecheck together. `test/fit.test.ts` called the old `buildScene` signature and read `scene.plot`; it now places its scenes. Fixed in `23e8ebc`.
- A branch that reads a removed `ContainerRules` field (`axes.minWidth`, `secondary`, `bare.minPlotWidth`, `rows.minLabelWidth`, `band`, `notice`) will fail typecheck after merging. The prototype still needs `axes.minWidth` in its own rules, so a test that hands our rules to the prototype must fill it in.

## Not yet verified

- The bench after the merge was checked by reading its DOM in headless Chrome: 30 frames, no errors. Nobody has looked at it.
- Nothing has been checked in Safari or Firefox. The spike's verdicts for those browsers will need a person.
