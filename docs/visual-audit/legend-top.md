# legend-top

Source: `packages/dom/src/chrome/legend.ts`, `packages/dom/src/chrome/swatch.ts` (the text itself is built in `packages/core/src/scene.ts`, `shareLegend` and the divided-rows branch of the rows scene; the swap is in `packages/core/src/fit.ts` and `LEGEND_SWAP`). Seen in 8 samples across radial (donut, half, pie, rings, sunburst), band (mix) and rows (likert, pyramid).

## Summary
The one line is legible, quiet and steady: it never clips, never overlaps, and holds up in both themes down to 80 px. Its weakness is that it no longer works as a key once it has stepped down. In the share form (radial, band) it is ink-only text with no swatch, so nothing ties "Desktop 52%" to a segment. In the series form (rows) it signals the series by colouring the text instead of drawing a swatch. Name and value are also one string, so a longer name would truncate the number first. The step from the full legend changes the swatch, the value's face and its position all at once, which makes the two forms read as different parts.

## Base issues
### B1. The line has no swatch, so it names a colour without showing it
- **Severity**: high
- **What**: The full legend draws a 12 px swatch before every name. The one line draws none. In the share form (`paint: 'ink'` in `shareLegend`) nothing on the line says which segment it means. The series form colours the text itself (`series.N` → the `-text` token), which links the line to its series by hue alone, at a darker shade than the bar.
- **Evidence**: rings dark 100×346 (`frames/rings/dark-100-346.png`): "Search 4,318" under six concentric rings, and the reader cannot tell which ring it is. Sunburst light 100×250 (`parts/legend-top/sunburst-light-100-250.png`): two levels of arcs, and "Desktop 52%" points to neither. Donut and pie light 100×480 (`frames/donut/light-100-480.png`) show the same. In the series form: pyramid light 100×250 (`parts/legend-top/pyramid-light-100-250.png`, olive text) and likert light 100×346 (steel text).
- **Why it matters**: A legend's job is to map a colour to a meaning. Text alone or hue alone fails that job for colour-blind readers, in forced colours (the swatch keeps `forced-color-adjust: none`, the coloured text does not), and wherever segments share a hue family, as the greens here do. It also breaks consistency, because the same part has two tones and neither matches the full legend.
- **Where to fix**: `legend.ts` `paintLegend`: draw the one line's swatch before the name with the existing `.uav-swatch-before` and `--uav-swatch`, as the names form of the full legend does, and keep the text in ink. `scene.ts` `shareLegend` gives the node the leading segment's series paint so the DOM has a colour to draw.

### B2. Name and value are one string, so truncation eats the number first
- **Severity**: medium
- **What**: Core builds one text, `name + ' ' + portion`, and the DOM renders it as one span with `text-overflow: ellipsis`. When the room runs out, the share (the data) is cut before the name.
- **Evidence**: "Desktop 52%" already fills about 76 of 80 px and runs into the frame edge in sunburst light natural×80 (`parts/legend-top/sunburst-light-natural-80.png`) and donut dark natural×80 (`frames/donut/dark-natural-80.png`). Rings natural×80 ("Search 4,318") shows the same. The full legend's own names ("AI assistants", "Strongly disagree") would ellipsize the value at this width. None do in this capture only because the leaders happen to be short.
- **Why it matters**: Truncation should cut the least important text first. Agents compose with arbitrary dimension values, so a long leader name is a case that will come up.
- **Where to fix**: `scene.ts` should emit the name and the value as two nodes or parts. `legend.ts` then lays them out so the value never shrinks (`flex: none`) and the name takes the ellipsis.

### B3. The value changes face and place across the step
- **Severity**: low
- **What**: In the share form the full legend sets each value in the value face (dot matrix), right-aligned in its own column. The one line sets the same value in the label face, run on after the name. The number that a reader has learned to look for at the right in the value face jumps to the left in body type.
- **Evidence**: donut light natural×170 (`frames/donut/light-natural-170.png`, "52%" in the dot face at the right) beside donut light natural×120 (`frames/donut/light-natural-120.png`, "Desktop 52%" in label type). Pie and mix show the same at 170→120.
- **Why it matters**: Continuity across a step-down. The compact form should look like a shortened legend, not a new caption. It is a smaller concern than B1 and may be a deliberate choice for a quieter line. If it is, document it in the module comment.
- **Where to fix**: `legend.ts`: once B2 splits the value off, give it the full legend's value class (`.uav-f-value`) or state in the module why the line keeps the label face.

### B4. The line sits tighter to what it stands under than the full legend does
- **Severity**: low
- **What**: The full legend has a 10 px top margin (`LEGEND_MARGIN`). The one line has a 3 px block padding inside a 20 px line, which leaves about 6 px between the mark and the cap height.
- **Evidence**: mix light 100×250 (`frames/mix/light-100-250.png`): "Search 41%" nearly touches the band. Mix light natural×120 (`parts/legend-top/mix-light-natural-120.png`) shows the same. On radial frames the gap is masked by the circle's curve.
- **Why it matters**: Spacing rhythm. A key should sit at the same distance from its marks whichever form it takes.
- **Where to fix**: `LEGEND_CSS` `.uav-legend-top span` padding: match the full legend's gap from the mark, or derive both from one constant.

## Situational issues
### S1. A band in a short box swaps six lines for one and leaves the room empty
- **Severity**: medium
- **Composition**: band layout with many segments (mix, 6) in a 100 px box.
- **What**: `LEGEND_SWAP` is all or nothing. When the full legend's 139 px will not fit, the one line shows, and about 50 px of the box stays empty under it even though two or three full entries would fit.
- **Evidence**: mix light 100×250 and dark 100×346 (`frames/mix/light-100-250.png`, `frames/mix/dark-100-346.png`).
- **Why it matters**: Graceful fallback. The step comes earlier than the room requires, and it gives up the key to every segment but one.
- **Where to fix**: band layout's use of `LEGEND_SWAP` (`band.ts`, `legend.ts`): cut the full legend at a whole number of lines that fit, and fall to the one line only when not even two entries fit. This is not a problem for radial, where the circle already fills a 100 px box.

### S2. In rows the line floats at the box's foot and misses the row labels' edge
- **Severity**: low
- **Composition**: rows layout with a divided row (likert, pyramid), height 100.
- **What**: The rows end at 60 px and the line sits at 77 px, a gap of about 17 px, wider than any gap between rows. The line starts at x 0 while the row labels are inset about 8 px, so the two left edges do not align.
- **Evidence**: likert light 100×346 (`frames/likert/light-100-346.png`), pyramid dark 100×170 (`frames/pyramid/dark-100-170.png`).
- **Why it matters**: Alignment and grouping. The key reads as a footer rather than as part of the chart.
- **Where to fix**: `rows.ts` grid placement of `.uav-legend-top` (grid row 3): pin it under the last row rather than to the box's end, and give it the label column's inset.

### S3. "The series with the most" is a weak summary for an ordinal, diverging split
- **Severity**: low
- **Composition**: likert (a five-point scale divided in rows).
- **What**: The line names "Agree 33%". That is true, but on a diverging scale the largest single category is not the reading anyone wants: net agreement or agree-plus-strongly-agree is. For a nominal two-way split such as the pyramid's "Female 53%", the leader is a good summary.
- **Evidence**: likert light and dark 100×480 to 100×170 (`sheets/legend-top/light-100-1.png`, row "likert").
- **Why it matters**: The line should summarise the data truthfully for its encoding. Reading one point of an ordinal scale alone can mislead.
- **Where to fix**: the likert preset (or the rows rule for an ordinal split) should choose what the one line names or skip straight from the full legend to none. Core's `leader` stays as the default.

### S4. In a wide, short radial box the line is far from the circle it names
- **Severity**: low
- **Composition**: radial at height 100 and widths 346 to free.
- **What**: The circle is centred and the line hugs the left edge, a few hundred px away. The full legend spans the whole width, so its left edge is consistent, but a single short line on its own looks orphaned.
- **Evidence**: donut light 100×480 (`frames/donut/light-100-480.png`), rings dark 100×346 (`frames/rings/dark-100-346.png`).
- **Why it matters**: Proximity. A label should sit near what it labels.
- **Where to fix**: `radial.ts`: when the one line shows, align it with the circle's box (centred under it) rather than with the body's start edge.

## Works well
- The text never clips, overlaps or ellipsizes in the capture, at any width from 480 to 80, in either theme.
- The step order is sensible: full legend → one line → nothing, before the marks go. The line disappears together with the circle at 40 px rather than hanging on alone.
- Series text uses the `-text` tokens (about 5:1 in both themes), so the coloured line stays readable in light and dark. There is no theme-parity issue.
- The cut full legend is marked `aria-hidden` (`hideCutLegends`), so assistive technology hears only the form that shows.
- The weight is right: label size, ink, no decoration. It sits below the number and the marks in the hierarchy.
- Rings say the value, not a share, consistent with their full legend.

## Open questions
- Waffle (band) and parliament (radial) have full legends, but their records at natural ≤250 and at height 100 measure no parts, and the frames look stale. For example, `frames/parliament/light-100-480.png` shows a half donut reading "Search 41%". I could not tell whether they step to the one line as their layouts' siblings do.
- The keyboard echo (an underline on the highlighted line, `keys.ts`) does not show in a static capture. It is untested here whether the underline is legible on coloured series text.
