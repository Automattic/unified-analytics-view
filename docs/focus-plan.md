# Focus plan

As of November 24, 2026. **Status: steps 1 to 7 and 9 are built, with the first stage of step 8 and the parts of steps 10, 11 and 12 that need no one else.** David then went through every call made by judgement: what each came to, and the eight steps that follow, are under "Decided with David".

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

- `prototype/` held two files that are not the grammar's prototype: `Clock under crystal.html` and `Glass drops.html`, sketches of materials that the bench's `material.css` was ported from. They moved to `sketches/` once David said so.
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
- `apps/bench-archive` used two of them and was kept on the terms that it not change, so it was deleted first, in a commit of its own (decided since: it stays deleted).

### 4. Nothing dropped without a word

The reference's section 7 lists what is still drawn wrong, or not at all, with nothing said: two layers in one place, a band's second bar, and `paint`, `series` and `stack` outside the tables.

- Each is refused by name, or drawn.
- Each limit that stays says why it holds and what to use in its place. Limits are backpressure: sort them first by reason (what an eye can tell apart, what keeps a number true, what keeps a spec data, what is the engine's), and change none without that.

**Done when** that list in section 7 is empty, and `test/reads.test.ts` holds the three fields.

**Built November 24** (reference, Decided 55). What it found:

- No sample and no existing test relied on anything that is now refused: the suite passed as it stood once the table was in.
- A probe over every sample said which marks read each field. It found two forms the table cannot say, a `paint` beside a dimension on `color` and a period before of no metric, and both are refused by the plan.
- A view whose every layer was left out, for want of a period before, was never checked against the table. It is now.
- Two bars on one x could have been refused or drawn. They are drawn side by side.
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

**Built November 24.** `pnpm --filter @unified-analytics/bench capture spec=<file>` takes a JSON file that is a spec, drawn on the fixtures' engine and catalog, or `{ spec, result, catalog }` for one drawn on its own, and `check` holds that capture as it holds any. What it found:

- The page takes the view before its own script runs, so nothing of the capture or the check changed: a capture of every sample differs from the last on no frame.
- `check` took the newest entry in `captures/` for the latest capture, and a stray picture there stopped it. It takes the newest that is a capture.
- It was first used on step 4: two bar layers on one x, side by side with their legend, at eight widths.

### 7. The agent surface

A package of its own, wrapping what core and the bench have and adding no rule:

- **What can be said:** the schemas, `READS`, `GUIDES`, `FIT_RULES`, the presets, the catalog.
- **A spec checked with no browser:** the refusal, or `explain` at each room asked for, with the sentence.
- **A spec drawn:** step 6's pictures and findings.

It needs a dependency core does not have (an MCP library), which is asked for before it is added.

**Done when** each of the three answers for every sample, and a refused spec gets the message `resolve()` gives.

**Built November 24** (reference, Decided 57): `packages/agent`, and `pnpm agent` for the server. What it found:

- **`resolve()` read past a field it had no use for.** A `width` in a spec, or a filter written as `filter`, was drawn without, and only the schema said so. Core refuses them now, by name, with the fields there are. No sample and no test had one.
- **The protocol is written out, in about thirty lines,** for the three methods a server of tools needs. It adds no dependency but `ajv`, which the tests had. It is held by tests that speak it, over stdio among them, and it has not been connected to a real MCP client.
- **The fixtures could not be loaded by Node:** their three JSON files were imported with no `type`. They say it now, so the server and anything else with no bundler can load them.
- **`draw_view` was run for real** on the two-bar spec of step 4: three pictures back, and the check's findings.
- A board is read as its views on the fixture engine. With answers of its own each view is checked alone, since a board has no one answer.

### 8. Fit needs worked out, not picked

The largest step. A model is proposed and approved before anything is built, and every stage is held to the capture, frame for frame.

What is known:

- 30 rules in `fit.ts`, each with px typed by hand. Several are already sums of sizes: 152 is 120 for the plot, 10 above it and 22 for the axis.
- 9 are for one kind of view, 5 of them for the `unit` mark's forms.
- A legend gives way the same in a band, a list and a circle, by rules written three times.

The direction: a need is the sum of the sizes of what its part holds, said once. A part has one ladder wherever it stands. A rule for one kind of view is the exception, and has to earn its place. The first stage changes no number: each literal is written as its sum.

Not every threshold can go. A container query compares against a length, so something says when the axes leave. What goes is the picking.

**The first stage is built** (November 24; reference, Decided 58), and it changes no number: the 30 rules are the same data, compared before and after. What it found:

- **Forty numbers are picked.** They are in one table now, `LEAST` in `fit.ts`, each named for the part it is the least room of. Every rule's need is one of them or a sum.
- **Five needs were sums already,** typed as their totals: the short plot's ticks (120 + 10 + 22), the bare plot beside its number (76 + 12 + 64), a band (24 + 24), a list's one-line legend (two rows, a gap and a line) and a circle's (the least circle and a line). So the legend's ladder is one ladder already, said three times with the same parts.
- **All forty are px at the default type sizes.** A theme that sets larger type moves none of them, so a view themed large gives way too late. This is where a need most plainly fails to follow what its part holds.
- **Nine rules are for one kind of view.** Two exist because a legend can become labels only where a line has an end (`legend`, `legend-area`), one because points have no bare form, one for a track read by position, and five for the forms of `unit`.

**Proposed for the next stage, and not built,** because each changes what a view looks like at some size and wants an eye on it:

1. **A need in the type's own units.** The picked numbers become multiples of the face their part is set in, so a need follows the type scale. A container query can compare against `em`, to verify, and `fitTo` would take the face's size with the room.
2. **One ladder for a legend,** written once and applied to a band, a list and a circle, with each layout's least for its marks as the one thing that differs.
3. **Glyphs as the last rule for one kind of view.** `unit` has five of the nine. Its forms give way to plainer presets by height, which is the only place a rule names a preset.

`unit` stays in core: it stands on the plot's own axes, which a custom mark cannot. `keep` stays too.

### 9. Custom marks as candidates

A custom mark is where something enters the system, far upstream, and not a way round it. It is held to what a core mark is held to.

- One suite a custom mark's package runs: its reads stated, its rules passing `test/guides.test.ts`, its scales through `common`, its scene valid against `scene/0`, tokens and never colours, unique keys, a clean check at every room.
- The words change with it: the header of `marks.ts` ("the escape hatch") and the rule in `CLAUDE.md` ("each one counts against the grammar"). The count is a queue of candidates.
- A short note on what moves a mark into core, or out of it.

**Done when** `geo`, `link` and `partition` pass the suite.

**Built November 24** (reference, Decided 59): `test/admission.test.ts`, run for each of the five marks registered, the two sets of tiles among them. All pass. What it found:

- Most of what a custom mark is held to was already held somewhere: its own suite, the scene schema, the guides. What was missing was one place that says so, and that a mark with no suite of its own is run through.
- `link` and `partition` said the channels they read and no fields. Each says `fields: []` now, so a `paint` written on one is refused.
- Two things the suite cannot see: that a mark's scales go through `common`, and that it paints. The first is read in its code, the second is the capture's.
- What moves a mark into core is written in the reference's section 7 as a proposal. No mark has moved either way, so it is untested.

### 10. The catalog and the answer say more

With the API's owners; this repo proposes and then reads what they accept.

- **The catalog:** which dimensions and grains a metric may be asked by, and whether it adds up, so a query that cannot be answered is refused before it is run.
- **The answer:** how fresh it is, what was filtered from it (bots, consent), and that a metric is not available here. These are the three states the reference's section 13 lists as to do.

**Done when** the proposals are with the owners, and what they accept is in the schema and said by the view.

**Built November 24, in part** (reference, Decided 60 and Open 23). What is built is the one thing with a reader here: a metric may say the dimensions it is answered by (`by`), and a query that asks it by another is refused before it is run. The fixture catalog states none yet. What is not built, and why:

- **Grains, and whether a metric adds up.** Nothing in this repository would read either. They go to the owners as proposals.
- **Fresh, filtered, not available.** Each is a state a view has to show somewhere, and where is a look.
- **The proposals are not with the owners.** That is a conversation, and yours.

### 11. Accessibility and theming that need no effort

From `docs/positioning.md`'s list of what is not there: a live region, patterns as a second channel beside colour, a pass with a screen reader, and the `--wpds-*` alias sheet. With them a look for Selected, and a bench page that re-themes every view from tokens alone. The visual design pass is David's.

**Built November 24, in part** (reference, Decided 61). What is built is what needs no eye:

- **A live region.** A view says its sentence when new data changes it, and not the first time. Tried in a browser: silent on first paint and on the same answer again, and the new sentence on a new total. A capture differs on no frame. Not heard through a screen reader.
- **A draft of the WordPress alias sheet,** `packages/tokens/wpds.css`: 29 of the view's tokens, each as the WordPress Design System token of the same role. The series colours past the first, the ramps and the type sizes have no role there to take. A pair that is wrong leaves the view unthemed, never broken. Nobody has looked at it on a WordPress page.

Not built, because each is a look: patterns beside colour, Selected, and the page that re-themes every view. `test/dom-tokens.test.ts` already holds that every colour, radius, stroke, weight, motion and face the element uses is a public token.

### 12. Docs for shipping

- The reference keeps what an author needs and the decision log. Plans that are built leave the tree; git keeps them.
- `CLAUDE.md`'s Layout section is cut to what the code does not say, and its rules are reworded as each step lands.
- ~~`docs/positioning.md` cites `design-inputs/`, which is not in the repository.~~ It is: `docs/design-inputs/`. I looked for it at the root.

**Built November 24, in part.** What it found:

- **Six plans that are built are in `docs/archive/`,** with a note on what each is: 304 kB of the 514 kB of docs. They are moved and not deleted, because the reference and some forty files of code and tests point at what building each found, and those pointers still resolve.
- **`CLAUDE.md`'s Layout section is under half its size:** what each package is and what the code does not say of it, with the lists of what each exports left to the code.
- **The reference is not rewritten.** Its stale section 18 is retired and its prototype claims were fixed in step 1, and it is otherwise as long as it was: 154 kB, a fifth of it the decision log. Making it concise is an editorial job that wants its reader decided first.

## Decided with David, November 24

Once the steps were built he went through every call made by judgement, twenty-two in all. What each came to:

**Stands as built**

- The sentence says "top" for its leader, whatever the metric's polarity, as the note under the number does.
- The sentence says every metric the query asks for, and not the first alone.
- Bars of several layers on one x sit side by side.
- A `text` layer takes no `paint`, and is refused one.
- The library is thirteen presets, and four that custom marks' packages register.
- `apps/bench-archive` stays deleted. Git keeps it: `git checkout c46acd2 -- apps/bench-archive test/goals.test.ts`.
- The built plans stay in `docs/archive/`.
- A spec, a query and a layer refuse a field they do not take.
- The MCP server speaks its protocol by hand, with no SDK. A real client is still to be connected to it.
- What moves a custom mark into core stays a proposal in the reference.
- `unit` stays in core.
- No size is held in CI yet.

**Turned over**

- **`keep` goes.** I had left it in. A spec then has no lever over what a container drops.
- **The reference is one concise document,** for an author, with the decision log. I had recommended a short guide beside a builders' record.
- **A spec gains `description`:** what the view is for, in its author's words, said before the derived sentence. I had recommended neither that nor facts as data, and facts as data stays unbuilt.

**What follows,** each a commit of its own:

13. The two sketches in `prototype/` move to `sketches/`. Done.
14. `keep` is removed: the spec field, the rules' `keep`, and what `explain` says of a lever.
15. `description` on a spec.
16. The parts page gives each frame a place that no other frame moves, so a capture can say which change moved a frame.
17. A fit rule's need in the type's own units, held to the capture at the default type, where nothing should move.
18. A proposal for the API's owners: a metric's `by`, grains, whether a metric adds up, and the three states of an answer.
19. The reference, rewritten as one concise document.
20. A real MCP client connected to the server.

**How the work is committed:** each step locally, on a feature branch, and nothing pushed or opened as a pull request without his word.

**Still his, and not asked:** the WordPress alias sheet wants a look on a WordPress page; patterns beside colour, a look for Selected and the visual pass are design; a pass with a screen reader is owed; and the cut of `CLAUDE.md`'s Layout section is his to read.

## Not in this plan

- The share bar as a list of one row, and a slice as a bar, bent. Left on November 24.
- New chart types. A form that is wanted is a bench sample or a custom mark.
- Packaging, a React binding and localisation (Open 17). Step 2 leaves far fewer words to translate, which changes Open 17's recommendation when it is taken up.
