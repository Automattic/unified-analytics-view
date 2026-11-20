# note

Source: `packages/geo/src/index.ts` (scene node, `place`, the `guides` fit rule in `geoRules`), `packages/geo/src/dom.ts` (`.uav-note` styles and paint), `packages/core/src/prose.ts` (`notShownNote`). Seam: `packages/dom/src/layout.ts`. Seen in 1 sample (`unmapped`) in 1 layout (`geo`), at natural height only: 480, 346 and free width, light and dark. Never at height 100.

## Summary
Where it shows, the note is legible, quiet and the same in both themes: one line of the tick face in `ink.muted`, flush with the ramp beneath it. Its problems are about what it says and when it goes, not how it looks. It counts a row with no country as one of the "countries", and it gives no idea how much of the metric is missing. It also leaves with the decorative keys (the `guides` rule, 320 × 170) while the map stays down to 280 × 120, so a map that silently leaves rows out can be drawn with nothing saying so. It is also a one-off. No other custom mark has a note, there is no shared chrome for one, and the words for absence differ from part to part.

## Base issues
### B1. The caveat leaves before the map it qualifies
- **Severity**: medium
- **What**: `geoRules` puts `note` in the `guides` rule's `hide` with the ramp and size key (needs 320 inline, 170 block). The map stays until the `marks` rule (280 × 120). Between those, at 280–319 px wide or in a box 120–169 px tall, the choropleth is drawn without the line saying that 4 rows are not on it. Because the note is a single short line (about 125 px of text at 346), width is never the reason to drop it.
- **Evidence**: from the rules, not from a picture. The capture's ladder steps from 346 to 250, and 250 is already the bar-list fallback (`frames/unmapped/light-natural-250.png`). At height 100 the view is the list too (`frames/unmapped/dark-100-480.png`). So the gap band has no frame. The note is present at 346 (`parts/note/unmapped-light-natural-346.png`) and absent from the 250 sheet cell (`sheets/note/light-natural-1.png`).
- **Why it matters**: data honesty. A footnote that qualifies what the marks show belongs to the marks, not to the legend. If the map is shown, the reader should be told what it omits. A legend can go because the readout and table restate the scale. The omission is not stated anywhere else on the map.
- **Where to fix**: `geoRules` in `packages/geo/src/index.ts`. Take `note` out of `guides`' `hide` so that it goes with `marks`, or give it a rule of its own with only a small block need (its 18 px line).

### B2. The count mislabels a row with no value as a country
- **Severity**: medium
- **What**: the scene counts every row that has no shape, null and empty values included (the code comment says so), and `notShownNote` names them all by the dimension's label. In `unmapped` the 4 are Singapore, Malta, Bahrain and a row with no country. The list fallback shows that row as "–", 82 visitors (`frames/unmapped/light-natural-250.png`). So "4 countries not shown" really means 3 countries plus 1 unknown.
- **Evidence**: `parts/note/unmapped-light-natural-480.png` and `-346.png` (both themes) read "4 countries not shown". The 250 list shows the "–" row among the same rows.
- **Why it matters**: truthful labelling. "Unknown country" is a different finding from "a country this map cannot draw": the first is a tracking gap, the second is the shape file's resolution. Merging them misleads whoever acts on it.
- **Where to fix**: the count in the geo `scene` and the wording in `packages/core/src/prose.ts`. Count the two kinds apart and say them apart (for example "3 countries not on the map, 1 row with no country"), in core's words.

### B3. It says how many rows, not how much
- **Severity**: low
- **What**: the note gives a count of rows and nothing about their weight. Four tiny countries and four large ones read the same. Here the missing rows add up to a few percent of visitors, and the reader cannot tell that from the note.
- **Evidence**: all four crops, `parts/note/unmapped-{light,dark}-natural-{480,346}.png`.
- **Why it matters**: on a choropleth the question a caveat should answer is "how much of the total am I not seeing?". A count alone invites over- or under-reaction.
- **Where to fix**: the rule "totals come from the engine" forbids the view summing the rows itself. The engine would have to send a companion for the unmatched share, which `notShownNote` would then state. See Open questions.

### B4. A one-off part, with its own words for absence
- **Severity**: low
- **What**: the note's only implementation is a style block in `packages/geo/src/dom.ts`: face, line, `:empty`, colour from `--uav-paint`. `flow` and `partition` have nothing like it, and there is no `chrome/` module for a footnote. Meanwhile absence is worded four ways across the views. The empty notice says "Visitors: nothing in this period yet", the geo note says "4 countries not shown", the ramp's swatch says "No data", and a list row with no value shows "–".
- **Evidence**: source only. Of the custom marks, only `packages/geo/src` creates a `note` node. The notice text comes from `emptyNote` (`packages/core/src/prose.ts`), and the "No data" swatch from the ramp.
- **Why it matters**: consistency across agent-built compositions. The next custom mark that drops something (a Sankey's thin links, a treemap's tiny cells) will invent its own line, in its own style, or say nothing.
- **Where to fix**: move the note's style and paint into `packages/dom/src/chrome/` next to the other keys, call it from `registerPainter` users as `paintRamp` is, and let one prose module own the absence vocabulary.

## Situational issues
### S1. Next to the "No data" swatch, two kinds of missing look like one
- **Severity**: medium
- **Composition**: `geo` with `color` on a metric, where some regions have no row and some rows have no region (`unmapped`, every width the note shows).
- **What**: the note sits directly on top of the ramp, start-aligned and in the same face and tone as the ramp's "102 … 3.2k   No data". It is about 4 px under the map's lowest coast and touches the ramp's line box (measured: plot ends at y 237, note 237–250, ramp from 250). Proximity groups it with the key. So "4 countries not shown" and "No data" read as one legend, when they mean opposite things: rows with no shape, and shapes with no row.
- **Evidence**: `frames/unmapped/light-natural-480.png`, `frames/unmapped/dark-natural-346.png`.
- **Why it matters**: Gestalt grouping and legend clarity. A reader can take the grey regions to be the "4 countries not shown".
- **Where to fix**: in the geo painter's layout. Put a gap between the note and the key, or put the note after the keys, as a footnote conventionally comes last. The painter's comment chooses "above the keys" on purpose, so this is a judgement to revisit, not a slip.

### S2. On a wide container the note is detached from the map
- **Severity**: low
- **Composition**: `geo` in a container wider than `MAP` (480 px). The map is held at 480 and centred, while the note (and ramp) start at the view's edge.
- **What**: at free width (1240 px) the map spans x 380–860 and the note starts at x 0 (`capture.json`). The caveat sits 380 px left of what it qualifies.
- **Evidence**: `frames/unmapped/light-natural-free.png`, and dark-natural-free in `capture.json`. The note's crop at free width is `parts/note/unmapped-*-natural-free.png`.
- **Why it matters**: alignment. Footnote and key should share the edge of the figure they annotate.
- **Where to fix**: the geo painter's body (`packages/geo/src/dom.ts`) and `place`'s note x (`packages/geo/src/index.ts`). Align the note, and the keys, to the held map box, not to the view.

## Works well
- Legible and calm in both themes: tick face, `ink.muted`, no clipping or ellipsis at any width captured (`capture.json`: clipped 0, ellipsis 0).
- One line with a fixed block (`NOTE`, 18 px at the drawn face) that `place` reserves, so the map never resizes when the note comes and goes.
- `:empty { display: none }`, and the node only exists when something is missing, so a complete map carries no stray line.
- When the map gives way to the bar list, the note goes too. That is right, because the list shows every row, the "–" one included.
- The words come from core and the dimension's label ("countries"), not from the geo package. That is the right place for the vocabulary.

## Open questions
- **Gap band**: no capture width falls between 280 and 319, and no height between 120 and 169, so B1 is inferred from the rules. Add a 300 px column, or a 150 px height, to the next capture to see the map without its note.
- **Magnitude**: should the engine send the share of the metric that falls on unmatched rows (B3)? Today core may not sum it.
- **Order**: is above the keys right (the painter's choice), or below them, as a footnote (S1)?
- **Empty data, in general**: no capture was taken with `empty`, so none of this was seen. From source: the `notice` layout replaces the marks with one centred line in the label face, `ink.muted`, in a 120 px body. Below 150 × 40 it hides and shows the number. Two things to check on the bench:
  - The wording is always `emptyNote(metric, true)`, "Visitors: nothing in this period yet". For a closed range, such as last month, "yet" is wrong.
  - It is unclear which number shows under the 150 × 40 rule, since the plan sets `tldrValue` false for a notice. The notice also uses a different face and alignment from this note: centred label instead of start-aligned tick. That difference is defensible, a state against a footnote, but it should be a stated rule.
- **Related, out of this part's scope**: at height 100 the fallback list shows 3 of 19 rows with nothing saying "16 more" (`frames/unmapped/dark-100-480.png`). That is the same kind of silence this note exists to prevent, in the `rows` layout.
