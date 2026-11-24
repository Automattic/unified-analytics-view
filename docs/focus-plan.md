# Focus plan

As of November 24, 2026. **Status: steps 1 to 5 are built.** On November 24 David said to go ahead with the rest by best judgement, weighed against the vision, and to keep what wants his opinion for the end: it is under "For David, at the end".

## Why

A review on November 24 asked what loses value as models improve, and what gains. Its line: what was built because writing a view was hard for its author fades. What was built because no model runs when a view is drawn, because a number must be true, or because a person sets the taste, holds or gains.

A spec stays plain data for the second reason and not the first: a page can take one from an agent it does not trust, check it, and draw it with no code run.

So this plan cuts what was built for the author's sake, and builds what gives an author, a person or an agent, a true signal.

## The order

Cuts first: they are mostly deletion, and they shrink what every later step has to describe.

| # | Step | Kind |
|---|---|---|
| 1 | The prototype goes | Cut |
| 2 | One sentence | Cut |
| 3 | Presets to the common ones | Cut |
| 4 | Nothing dropped without a word | Signal |
| 5 | A scene schema | Signal |
| 6 | Capture and check for any spec | Signal |
| 7 | The agent surface | Signal |
| 8 | Fit needs worked out, not picked | Fit |
| 9 | Custom marks as candidates | Extension |
| 10 | The catalog and the answer say more | Truth |
| 11 | Accessibility and theming that need no effort | Polish |
| 12 | Docs for shipping | Ship |

## The steps

### 1. The prototype goes

It was an artifact of development. `test/core.test.ts` is the only suite that loads it (one line); ten others name it in a comment.

- Delete `prototype/`, and the comparison in the sweep. The sweep keeps what it holds of its own: unique keys, no `NaN`, the fixture facts.
- Remove the parity rule and the `prototype/` line from `CLAUDE.md`. The tag `prototype-parity` stays as the record.

**Done when** the tests pass with the prototype's files gone, and no test or doc tells a reader to hold to it.

**Built November 24** (reference, Decided 52). What it found:

- `prototype/` held two files that are not the grammar's prototype: `Clock under crystal.html` and `Glass drops.html`, sketches of materials that the bench's `material.css` was ported from. They are left where they were (To decide, 8).
- Eight groups of tests in `test/core.test.ts` compared ours with the prototype's. Each departure they asserted is now asserted for itself, and the two tests that said only what the prototype did are gone: 1,442 tests became 1,440.
- The plans that are history (`milestones.md`, `claude-code-prompt.md`, `feedback.md`, `dom-painter-plan.md`, the two coverage plans) still speak of the prototype, as what was done. They are step 12's.

### 2. One sentence

The sentence is the number block in words, then the filter. The number block already works out a value, a change and a note (`sceneNumber`), so the sentence knows nothing of what kind of view it is in. It stays because a view's data is live and an authored sentence is not, and because it is the accessible name and the last rung.

- `rankProse`, `gridProse`, `rangeProse` and `differenceProse` go, with the branches of `tldrProse` for points, two dimensions, bins and rankings: about 90 of 123 lines. Five call sites in `plan.ts` become one.
- A custom mark then needs no way to give the prose.
- A list's sentence no longer names its second and third rows. The table and the readout say every row.

**Done when** every sample in every data state says a sentence of the one shape, and the reference's section 16 is one row.

**Built November 24** (reference, Decided 53). What it found:

- Each metric the query asks for is still said, as it was, so a bubble chart's sentence has three totals where its scatter has two.
- An instant metric's sentence lost its leader ("the top page is / (3)"): the number block of an instant metric names none.
- A total the engine does not give was a dash in the sentence. It is now "no figure", and a leader with no name is not said.
- 59 tests asserted the old sentences. Each now asserts the one shape, and the tests of the sentences that are gone went with them: 1,440 tests became 1,436.

### 3. Presets to the common ones

`use` stays. Core keeps the charts version 4 has (by `docs/positioning.md`) and the ones a fit rule falls back to. The rest stay in the bench, written as layers.

- Recommended to keep, 13 of 38: `line`, `bar`, `bar-list`, `share-bar`, `grouped-bar`, `stacked-bar`, `stacked-area`, `pie`, `donut`, `pie-semi-circle`, `gauge`, `heatmap`, `funnel`.
- A custom mark's package keeps one preset for its mark, and `pair-list`, which a treemap falls back to.
- `test/docs.test.ts` holds the library, the reference and the schema to one another, so the cut is mechanical.

**Done when** `PRESETS` is the kept list, and every sample's scene is what it was, node for node.

**Built November 24** (reference, Decided 54). What it found:

- 31 samples were written with a cut preset. Each is its layers now, and all 300 plans and scenes of every sample in every data state, 9,889 nodes, are what they were.
- Three presets a custom mark's package registered went too: `symbol-map`, `tile-grid-map` and `hex-tile-map`. `registerGeo` still takes names for them from a page that wants them.
- The cut presets are kept as slots in `test/examples.ts`, since the suites exercise the preset mechanism with them: a second dimension, a second metric, a companion's suffix. No package holds them.
- `apps/bench-archive` used two of them and was kept on the terms that it not change, so it was deleted first, in a commit of its own (To decide, 7).

### 4. Nothing dropped without a word

The reference's section 7 lists what is still drawn wrong, or not at all, with nothing said: two layers in one place, a band's second bar, and `paint`, `series` and `stack` outside the tables.

- Each is refused by name, or drawn.
- Each limit that stays says why it holds and what to use in its place. Limits are backpressure: sort them first by reason (what an eye can tell apart, what keeps a number true, what keeps a spec data, what is the engine's), and change none without that.

**Done when** that list in section 7 is empty, and `test/reads.test.ts` holds the three fields.

**Built November 24** (reference, Decided 55). What it found:

- No sample and no existing test relied on anything that is now refused: the suite passed as it stood once the table was in.
- A probe over every sample said which marks read each field. It found two forms the table cannot say, a `paint` beside a dimension on `color` and a period before of no metric, and both are refused by the plan.
- A view whose every layer was left out, for want of a period before, was never checked against the table. It is now.
- Two bars on one x could have been refused or drawn. They are drawn side by side (For David, 6).
- The limits are in the reference's section 7, sorted by the reason each holds: eight, of which only the last, the engine's contract, is open.

### 5. A scene schema

`packages/core/schema/scene.schema.json`, as `scene/0`, a draft: the node vocabulary of Decided 51, an arc's own fields, and the parts that carry no position, said as such.

**Done when** every sample's scene in every data state validates against it. Ajv is already in the tests.

**Built November 24** (reference, Decided 56). What it found:

- Every scene validates: each sample in each data state, each view of a facet and of a board, the custom marks' among them.
- Two things no type said. A `text` in a grid carries the `pair` it stands at, which is in the type now. And `partition` paints a name in `background`, a token no list had: the reference's list has it now.
- The schema is strict: a node may hold only what it lists. So a custom mark that wants a field of its own has to add it to the schema, which is the conversation step 9 is about.

### 6. Capture and check for any spec

The capture takes the bench's samples off the parts page. It should take any spec, result and catalog handed to it, and give the pictures, what was measured, and the check's findings.

**Done when** one command does that for a spec that is not a sample.

### 7. The agent surface

A package of its own, wrapping what core and the bench have and adding no rule:

- **What can be said:** the schemas, `READS`, `GUIDES`, `FIT_RULES`, the presets, the catalog.
- **A spec checked with no browser:** the refusal, or `explain` at each room asked for, with the sentence.
- **A spec drawn:** step 6's pictures and findings.

It needs a dependency core does not have (an MCP library), which is asked for before it is added.

**Done when** each of the three answers for every sample, and a refused spec gets the message `resolve()` gives.

### 8. Fit needs worked out, not picked

The largest step. A model is proposed and approved before anything is built, and every stage is held to the capture, frame for frame.

What is known:

- 30 rules in `fit.ts`, each with px typed by hand. Several are already sums of sizes: 152 is 120 for the plot, 10 above it and 22 for the axis.
- 9 are for one kind of view, 5 of them for the `unit` mark's forms.
- A legend gives way the same in a band, a list and a circle, by rules written three times.

The direction: a need is the sum of the sizes of what its part holds, said once. A part has one ladder wherever it stands. A rule for one kind of view is the exception, and has to earn its place. The first stage changes no number: each literal is written as its sum.

Not every threshold can go. A container query compares against a length, so something says when the axes leave. What goes is the picking.

### 9. Custom marks as candidates

A custom mark is where something enters the system, far upstream, and not a way round it. It is held to what a core mark is held to.

- One suite a custom mark's package runs: its reads stated, its rules passing `test/guides.test.ts`, its scales through `common`, its scene valid against `scene/0`, tokens and never colours, unique keys, a clean check at every room.
- The words change with it: the header of `marks.ts` ("the escape hatch") and the rule in `CLAUDE.md` ("each one counts against the grammar"). The count is a queue of candidates.
- A short note on what moves a mark into core, or out of it.

**Done when** `geo`, `link` and `partition` pass the suite.

### 10. The catalog and the answer say more

With the API's owners; this repo proposes and then reads what they accept.

- **The catalog:** which dimensions and grains a metric may be asked by, and whether it adds up, so a query that cannot be answered is refused before it is run.
- **The answer:** how fresh it is, what was filtered from it (bots, consent), and that a metric is not available here. These are the three states the reference's section 13 lists as to do.

**Done when** the proposals are with the owners, and what they accept is in the schema and said by the view.

### 11. Accessibility and theming that need no effort

From `docs/positioning.md`'s list of what is not there: a live region, patterns as a second channel beside colour, a pass with a screen reader, and the `--wpds-*` alias sheet. With them a look for Selected, and a bench page that re-themes every view from tokens alone. The visual design pass is David's.

### 12. Docs for shipping

- The reference keeps what an author needs and the decision log. Plans that are built leave the tree; git keeps them.
- `CLAUDE.md`'s Layout section is cut to what the code does not say, and its rules are reworded as each step lands.
- `docs/positioning.md` cites `design-inputs/`, which is not in the repository.

## To decide

1. **The order.** Recommended as above.
2. **The kept presets** (step 3).
3. **Whether `unit` stays in core.** It has five forms and five fit rules of its own. Recommended: decide at step 8, when those rules are looked at.
4. **`keep`.** No sample uses it, so by Decided 17 it goes. Recommended: remove it at step 8, and take up what an author may say of what matters most with Open 14, when a view needs it.
5. **A spec field for an author's description:** what a view is for, which does not change with its data. A grammar change.
6. **Facts as data:** what the sentence is made of, for a surface to say in its own words. Recommended: with step 7, if the surface needs it.
7. **`apps/bench-archive`.** Deleted on November 24, with `test/goals.test.ts`, which swept its dashboards: its goals pages used presets that step 3 cut, and it was kept on the terms that it not change. Git keeps it: `git checkout c46acd2 -- apps/bench-archive test/goals.test.ts` brings it back.
8. **The two sketches left in `prototype/`.** Recommended: move them to `sketches/`, which holds the rest of the visual direction, so the folder goes.

## Not in this plan

- The share bar as a list of one row, and a slice as a bar, bent. Left on November 24.
- New chart types. A form that is wanted is a bench sample or a custom mark.
- Packaging, a React binding and localisation (Open 17). Step 2 leaves far fewer words to translate, which changes Open 17's recommendation when it is taken up.

## For David, at the end

Calls made by best judgement while building, each to confirm or turn over.

1. **"The top page is /."** The sentence names the leader with the number's own word, "top", whatever the metric's polarity: for response time the top page is the slowest. The note under the number has always said "Top:" the same way.
2. **Every metric of the query is said,** not the first alone, though the number block shows only the first. It was so before, and a table of three metrics reads better for it.
3. **A capture is not independent of where a frame stands on the page.** After step 2 the frames 40 px wide changed height, as they should: they show the sentence. That moved the frames at free width under them, and 28 of those set their x axis 1 px from where it was, because a plot is set on whole device px from its place on the page. Two captures of the same code still agree on every frame. The parts page could give each frame a place that no other frame moves.
4. **The kept presets.** Thirteen, as recommended in step 3, and four that custom marks' packages register (`choropleth`, `sankey`, `treemap`, `pair-list`). `gauge` stays because an icon array falls back to it, not because it is common.
5. **The archive is deleted,** with the test that swept its seventeen goal dashboards. The dashboards were the only record in the tree of which views serve which goal. One command brings it back (To decide, 7).
6. **Two bar layers on one x sit side by side,** in place of one drawn over the other. The other answer was to refuse them. No sample has such a spec, so nothing drawn today changed.
7. **A `text` layer takes no `paint`.** It was dropped, and is refused now. Letting a label be muted (`ink.muted`) is a small thing to build if it is wanted.
8. **`background` is a paint token a custom mark brought in.** `partition` sets a name in it on a filled box. It is in the scene schema, since scenes hold it, and in no token list of the element's. It should be a token of the system's or go.
