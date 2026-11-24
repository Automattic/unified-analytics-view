# unit-key

Source: `packages/dom/src/chrome/unit.ts` (style and painter), `packages/core/src/scene.ts` (the text, `ink.muted`, tick face), `packages/core/src/place.ts` (its 20 px line), fit rules in `packages/core/src/fit.ts` lines 93–96. Seen in 5 samples (icons, isotype, parliament, units, wilkinson) across band, rows, radial and cartesian.

## Summary
The key is quiet, legible and consistent in face and colour: a tick-face, `ink.muted` line that reads the same in light and dark and never clips or ellipsises in this capture. It appears only at natural height at 480, 346 and free widths. At every narrower width the glyphs give way to bars or arcs, so the key leaves with them, as it should. Its main weakness is where it sits: it is pinned to the view's left edge whatever the glyphs do. In the band and radial layouts the glyphs are centred, so the key ends up far from what it explains, and in parliament it reads as the legend's heading. A second weakness is that it is words only, with no glyph shown beside them, so "Each is 500" never says what "each" is.

## Base issues
### B1. The key shows no glyph, so "each" has no referent
- **Severity**: medium
- **What**: The key is text alone ("Each is 200"). There is no sample glyph and no noun. Where the glyph is a square cell (icons), a seat (parliament) or a dot (units, isotype, wilkinson), the reader has to infer that "each" means the glyph. It is worse in icons, where the grid has two tones and "Each is 5" does not say whether the pale cells count too.
- **Evidence**: `parts/unit-key/icons-light-natural-480.png`, `parts/unit-key/parliament-dark-natural-480.png`, `frames/icons/light-natural-480.png`, `frames/isotype/light-natural-480.png`.
- **Why it matters**: Isotype convention (and the legend's own swatch-plus-label pattern in this repo) pairs the symbol with its worth. A key that names its symbol is what makes a unit chart self-explanatory, and it does not rely on position alone.
- **Where to fix**: `paintUnitKey` in `chrome/unit.ts`, with the scene node in `scene.ts`: lead the line with one glyph in the mark's shape and paint, drawn by the shared swatch (`chrome/swatch.ts`), so the key reads "● 500" / "Each ● is 500".

### B2. The key does not say that counts are rounded
- **Severity**: low
- **What**: Glyph counts are rounded to the nearest unit with a floor of one, but the key states an exact worth. In isotype, Other (316) shows one dot worth 500 and Email (632) also shows one, while AI assistants (842) shows two. A reader who counts dots and multiplies by the key gets 500, 500 and 1,000.
- **Evidence**: `frames/isotype/light-natural-480.png`, `frames/isotype/dark-natural-346.png`. Units shows the same kind of rounding: `frames/units/light-natural-480.png` has 8 dots × 200 = 1,600 against an axis reading of about 1.5k.
- **Why it matters**: Truthful encoding. The key is the one place that can tell the reader the glyphs are approximate.
- **Where to fix**: The text in `scene.ts` (the unit-key node): say "about" or "rounded" when any count was rounded (for example "Each ≈ 500"). Alternatively the glyph layer could draw partial glyphs, which would need no change to the key.

### B3. Anchored to the view's edge, not to the glyphs
- **Severity**: medium
- **What**: The key always starts at x = 0 (8 px in rows) of the view's full width, whatever the glyph block's extent. Cartesian and rows get away with it, because the y-axis labels or row labels share that edge. Band and radial centre their glyphs, so the key is stranded at the far left. At free width (1240 px) it sits more than 400 px from the grid.
- **Evidence**: `frames/icons/light-natural-480.png` (grid from about x=160, key at x=0), `frames/parliament/light-natural-480.png` (seats centred, key at x=0), and the `free` crops, for example `parts/unit-key/icons-light-natural-free.png`.
- **Why it matters**: Gestalt proximity. A key should sit against the thing it keys. Far from it, the line reads as a stray caption.
- **Where to fix**: `UNIT_CSS` in `chrome/unit.ts`: align the key to the glyph block's start edge (or centre it under centred bodies) per layout, rather than `grid-column: 1 / -1` from the view's edge.

## Situational issues
### S1. In radial, the key reads as the legend's title
- **Severity**: medium
- **Composition**: radial + `unit` (parliament) with a list legend underneath.
- **What**: The key sits 4 px under the seats and about 20 px above the legend, left-aligned on the same edge as the legend swatches. The eye groups it with the legend, as a heading over "Search 41%…", and not with the seats. The legend shows percentages, so "Each is 200" over them reads as a contradiction.
- **Evidence**: `frames/parliament/light-natural-480.png`, `frames/parliament/dark-natural-346.png`.
- **Why it matters**: Grouping decides meaning. The key's tight top gap and loose bottom gap are right, but the shared left edge with the legend overrides them.
- **Where to fix**: The radial layout (`layouts/radial.ts` with `UNIT_CSS`): centre the key under the half circle, matching B3.

### S2. Rows keep glyphs after the key has gone
- **Severity**: low
- **Composition**: rows + `unit` (isotype) in a short box (100 px tall, at 480, 346 and free).
- **What**: At 100 tall the rows still draw dots, but the key needs 120 tall and drops, so the dots carry no worth. The row values are printed, which softens this.
- **Evidence**: `frames/isotype/light-100-480.png`, `frames/isotype/light-100-346.png`.
- **Why it matters**: A count of glyphs with no unit is a decoration, not an encoding. The reference says the key goes "before the glyphs do", so this is by design (see Open questions).
- **Where to fix**: The rows rule in `fit.ts` (line 94): either let the key outrank the third row, or tie the glyphs' step to bars to the key's rule, so that glyphs never show unkeyed.

### S3. Tight gap under band and radial glyphs
- **Severity**: low
- **Composition**: band (icons) and radial (parliament), where the glyph block runs to the bottom of its box.
- **What**: Only the 4 px `padding-block-start` separates the cell or seat bottoms from the key text. In the 2× crops the glyphs show along the crop's top edge. In cartesian and rows the x-axis or the row padding adds air, so there it looks fine.
- **Evidence**: `parts/unit-key/icons-dark-natural-480.png`, `parts/unit-key/parliament-dark-natural-480.png`, against `parts/unit-key/units-dark-natural-480.png`.
- **Why it matters**: Spacing rhythm. The key is cramped exactly where it is already far from the glyphs horizontally (B3).
- **Where to fix**: The band and radial layouts: give the key the same gap below the glyphs that the axis gives in cartesian (about 8 px).

## Works well
- The tick face in `ink.muted` puts it at the right level: quieter than the number and the row labels, equal to the axis ticks. It never competes.
- Theme parity: the same contrast in light and dark. No clipping or ellipsis anywhere in the capture.
- It leaves with the glyphs. When bars or arcs replace units at narrow widths (`frames/isotype/light-natural-250.png`, `frames/parliament/light-natural-250.png`), no orphan key is left behind.
- The worth uses the metric's own format, and there is no key when a glyph is worth one.
- In rows, the 8 px inset lines the key up with the row labels. In cartesian it shares the y-tick labels' left edge.

## Open questions
- The reference (section 10) says the key drops before the glyphs. Is that still wanted, given S2? An unkeyed glyph count looks less honest than replacing the glyphs with bars.
- What do the pale cells in icons stand for: the remainder to the target, or to 500? The key covers both tones with one worth. That may belong to the band's own legend rather than to this part.
- Should the key be exposed to assistive tech as the description of the glyph group (for example by `aria-describedby` on the glyph container)? The pictures cannot show this.
