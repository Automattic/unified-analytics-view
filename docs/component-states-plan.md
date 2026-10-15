# Component states: plan

As of October 15, 2026. **Status: agreed in conversation on October 15; nothing is built.** It came out of the Figma audit after #23 (PR #31). That audit found that the Plot label set mixes three concerns on one list of variants. As a result it had gaps: no Paint × End, though the Sankey's right column and a reference line's words both draw one. This note sets one model for every atomic component, in Figma and in code, and the steps to reach it.

## 1. The model

1. **An atom's props are its content and the shared states, nothing else.** Nothing about where it sits or what it is for.
2. **Placement belongs to the parent.** Anchor or alignment, inset or padding, maximum width and truncation are set in the parent's definition, as overrides on the nested atom.
3. **Styling chosen by context belongs to the parent too.** Tone, halo, type size and a mass's lightness are a token override on the nested atom. They become a *parent* property only where that parent needs more than one value in the views: an axis with Tone = Axis | Paint, for example.
4. **A combination exists because a parent uses it.** So it cannot go missing. Paint × End is drawn the day the Sankey column is.
5. **Every atom supports every state**, even where a state looks the same as Default. A pointer passes over an atom whether or not a style is tied to it. The more universal a state, the lower in the tree it sits. The more discretionary an option, the higher.
6. **Focus is drawn by a layer underneath, not by the atom.** Every atom has the Focus state, and its look is always the shared focus indicator under it: the Focus outline (24:12) round a box, or a focus stroke along a path, both in `color-focus` at `stroke-width-focus`.

## 2. The states

| Property | Values | What it means | Lifetime | Set by |
|---|---|---|---|---|
| **Interaction** | Default, Hover, Active | The pointer is over this atom (Hover), or pressing it (Active) | Ephemeral | The user, on this atom |
| **Focus** | Boolean | This atom has the keyboard's place | Ephemeral | The user, on this atom |
| **Selected** | Boolean | The user picked this datum | Persistent | The user proposes it and the host keeps it (section 4) |
| **Emphasis** | Default, Highlighted, Dimmed | Brought forward or pushed back in reaction to something else: another atom's state, the data, or the view. Not an input on this atom | Follows its cause | The element |

These are four independent properties, not one list. An atom can be Selected, Hover and Focus at once, or Dimmed and Hover. Highlighted and Dimmed exclude each other, so they share one property.

**Decided October 15:**
- **Dimmed is in the set everywhere**, even where it looks the same as Default.
- **Selected and emphasis travel with the datum.** Every atom that stands for the same datum takes them: the mark, its label, its legend entry, its swatch, its row. A series hovered in the plot highlights its name at the line end and in the legend.
- **Disabled is left out** until something can be turned off, a series hidden from the legend for example.
- **Names:** Default for Rest, Selected for Chosen, Dimmed for Receded. Active means pressed, as `:active` does.

Examples of emphasis already in code, under their new names:
- **Dimmed:** the rest of the plot stands back while a series is in play (`keys.ts:264`); the rest of a row's dots stand back (`keys.ts:268`).
- **Highlighted:** the one line of a mass drawn whole (`keys.ts:266`); a chosen series' name underlined at the line end (`keys.ts:271`); the rug's tick drawn whole when its point is in play (`ranges.ts:27`).

A mass is not Dimmed. Every line of a split plot drawn light is styling its parent chooses for the whole set (rule 3). Only the line brought out of it is a state.

## 3. The atoms

Each one gets Interaction × Selected × Emphasis, and a Focus layer. A box gets the Focus outline, and a path gets a focus stroke.

| Atom (Figma) | State property today | To fix besides the missing states |
|---|---|---|
| _Bar shape 27:24 | Rest, Hover, Receded | |
| _Bar row shape 28:26 | Rest, Receded | |
| _Path shape 32:68 | Rest, Receded | Line's and Dot's `Mass` move to their parents |
| _Dot shape 34:232 | Rest, Hover, Receded | |
| _Arc shape 35:251 | Rest, Hover; Focus | Focus is a styling variant; make it the focus stroke layer |
| _Tick rug shape 35:311 | Rest, Active | Its Active is Highlighted |
| _Tick row shape 35:323 | Rest, Chosen, Receded | Its Chosen is Highlighted |
| _Link shape 39:455 | Rest, Hover, Receded | |
| _Band segment shape 40:412 | Rest, Hover | |
| _Box shape 40:516 | Rest, Hover | |
| _Cell shape 40:907 | Rest, Hover | |
| _Unit shape 40:1010, _Unit cell shape 40:1013 | Rest, Hover | |
| _Region shape 42:852, _Tile shape 42:857, _Hex shape 42:862 | Rest, Hover | |
| _Rule 113:19020 | Rest, Hover, Focus | Focus is a styling variant; make it the focus stroke layer |
| Plot label 113:19167 | Rest, Chosen | Its Chosen is Highlighted. Anchor, Tone, Halo, Inset and Truncate move to parents (section 5) |
| _Legend name 73:5716, _Legend value 73:5721 | Rest, Chosen | Its Chosen is Highlighted |
| Swatch 113:18912 | None | Size and Shape stay: they are what it is, not where it sits |
| Table / Cell 73:5615, Cell 73:5813 | None | |
| _Row state 73:6015 | Rest, Hover | It is itself a state layer; fold it into the row as that atom's states |

**Not atoms**, and so without the set:
- **Focus outline**, which is the layer underneath.
- **Tooltip**, a passing surface shown *because of* a state.
- **Glyph**, a letter of the number, which stands for no datum.

Everything else is a parent: axes, legends, keys, the sets that arrange marks (Bar / Stack, Cell / Grid…), the metric display and the views. A parent passes emphasis and selection down, and holds the placement and styling options of rules 2 and 3.

## 4. Selected needs an owner

Code has no selection today. What it calls chosen is Hover or Focus:
- a pointer choosing a point sets `data-active="pointer"`;
- the keys set `data-active="keys"` (`keys.ts:209-225`).
- Escape or the pointer leaving lets go.
- Enter, Space or a click *activates* (`rove.ts:21-67`): the activation fires once and nothing is kept.

Selected persists, so it has to outlive a re-render, and the host is the only party that does. The user's activation proposes a selection: the element dispatches an event naming the datum by its key. The host sets the selection back on the element, and the element marks every atom of that datum Selected. Keys are already stable and unique (CLAUDE.md), so a selection survives a new result where its datum does. A spec says nothing about selection: it is the element's state, like a size.

## 5. Plot label, worked through

| Property today | Under the model |
|---|---|
| Text | Stays (content) |
| State | Becomes Interaction × Selected × Emphasis, with a Focus layer |
| Anchor, Inset, Truncate | Move to the parent's layout: Y axis (End, Inset End), X axis (Middle), Line ends (Start, Inset Start, truncated), Point labels (Middle, truncated), Rule (Start or End), Sankey column (Start or End by side, truncated) |
| Tone | A fill variable override in the parent: `color-label-axis` on the axes, the node's paint everywhere else |
| Halo | An override in the parents that set labels over marks: Rule, Point labels, Box |
| Thinned (code only) | A visibility override in the parent. The measured pass decides it |

Line-end names and point labels are placed straight into the views today, with no parent component, which is how their options were pushed down into the atom. They need parents: **Line ends** and **Point labels**. The Sankey's labels go into **Link / Column** (39:475).

## 6. Code

The code has the same shape already in part:
- `label()` is the shared piece.
- Each layout's own rule places a label.
- The stylesheets of `keys.ts` are where the states are drawn.

It moves the rest of the way as follows.

- **The vocabulary is one constant.** Give the state attributes these names: `data-interaction="hover|active"`, `data-focus`, `data-selected`, `data-emphasis="highlighted|dimmed"`. Name them once, beside `rove.ts`, and have every painter and stylesheet read them from there.
- **Retire the old attributes.** `data-active` (which says how a thing was chosen, and clashes with `:active`) and `data-chosen` (which is emphasis) go.
- **Emphasis is set, not inferred.** Today Dimmed is a `:has()` selector over the plot. Instead, the element relays a datum's state to every atom of it and writes Highlighted or Dimmed on each one, so an atom's rule reads its own attribute.
- **`label()` loses `tone` and `truncate`.** Each parent's rule sets `--uav-paint` and its own width. The underline of a highlighted label moves from `keys.ts` into the label's own stylesheet, so the atom owns its states in both places.
- **Labels stay pointer-transparent** (`pointer-events: none`): the mark is the target. They support Hover and Active as rule 5 says, but receive them only by relay.

## 7. Steps

Each step is a PR with its Figma half made at the same time, as #23 and #31 were.

1. **Plot label pilot.**
   - In Figma: rebuild Plot label as Text with Interaction × Selected × Emphasis and a Focus layer. Move its options into parents, and build the **Line ends** and **Point labels** parents. Put the Sankey labels into Link / Column.
   - In code: `label()` without `tone` and `truncate`, and the label's states in its own sheet.
   - Done when every instance in the file still draws as before and the bench is unchanged.
2. **The state vocabulary in code.**
   - Add the constant of section 6.
   - `rove.ts` and `keys.ts` write Interaction, Focus and Emphasis by relay; `data-active` and `data-chosen` go.
   - The keyboard tests in `test/` move to the new names.
   - Nothing the user sees changes.
3. **Selected.**
   - The element: an event on activation, a `selected` input, and every atom of the datum marked.
   - A control on the bench's playground, to try it.
   - The reference gets a Proposed section for it.
4. **The marks.** Every shape on the Marks page:
   - takes the set;
   - drops Focus as a styling variant in favour of the focus layer;
   - maps the rug's Active and the row tick's Chosen to Highlighted;
   - moves `Mass` to its parent.
   - The painters write the same attributes.
5. **The chrome atoms.** Legend name and value, Swatch, the table and row cells, and the row's own states.
6. **Audit and snapshot.**
   - Run the Figma and code diff again.
   - Then take the snapshot in Figma, named after the PR, as the baseline for the next sync.

## 8. Settled when the plan was built

These were open, and were settled on October 15 so the build could go on. Each can still be changed.

- **One selection at a time.** Activating a selected datum again clears it.
- **Escape lets go of Hover and Focus only.** Selected outlives it, as it outlives a re-render.
- **The look of Active, Selected and Highlighted** where none is drawn yet is design's to set. Until then each state is present and looks the same as Default; the looks code already draws are kept.
