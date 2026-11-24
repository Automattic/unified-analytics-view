# labels

Source: packages/dom/src/layouts/cartesian.ts (line ends), packages/dom/src/chrome/label.ts (the atom), packages/flow/src/dom.ts and packages/flow/src/index.ts (Sankey columns); the swap in packages/core/src/fit.ts (`legend`, `labels`) and packages/core/src/plan.ts:181. Seen in 1 sample (sankey, `link`) at 480, 346 and free, natural height, both themes. Line-end labels (cartesian) appear in no frame of this capture.

## Summary
The Sankey's column labels are clean and well placed: centred on their nodes, inside their column, decluttered by node size, legible in both themes. The checker's `plot×labels` overlap is by design (the labels lie over the plot, `grid-area: plot`) and is not a defect. The real problem is the cartesian half: line-end labels exist only in a narrow window (280–319 px wide, or 120–179 px tall) that this capture's width ladder and two heights never enter, so the part is unaudited, and where it does apply it is the fallback for the legend when for line charts it should usually be the first choice.

## Base issues
### B1. Line-end labels only live in a window the capture never visits
- **Severity**: high
- **What**: `legend` (cartesian) needs 320 × 180 and swaps in `labels`; `labels` needs 280 × 120 and goes with the axes. So labels show only at 280 ≤ w < 320 (any height ≥ 120) or w ≥ 320 with 120 ≤ h < 180. The ladder is 480, 346, 250…; natural height is 209–230; the box is 100. Every split line/area sample (area, bump, cumulative, series, slopegraph, stacked, streamgraph) shows the legend at 480/346/free and drops to number + sparkline at 250 and below. `capture.json` has `labels` in no cartesian record.
- **Evidence**: frames/area/light-natural-346.png and frames/bump/light-natural-346.png (legend, 2–3 lines under the plot); frames/area/light-100-480.png (100 tall: neither legend nor labels, the stacked sparkline has no key); capture.json, every cartesian record with `legend` in its plan: `labels` never measured.
- **Why it matters**: a dashboard tile of 480 × 150 is ordinary, and that is exactly where this part takes over; it ships unseen. The checker cannot hold it to anything either.
- **Where to fix**: the capture's ladder and heights (apps/bench capture config): add a width in 280–319 (e.g. 300) and a height in 120–179 (e.g. 150), so the part is ever drawn.

### B2. For lines, the legend-first order is backwards
- **Severity**: medium
- **What**: the rule order makes the legend the default and direct labels the fallback for when the view is short or narrow. For lines (and above all bump and slopegraph, whose reading is "which line ends where") direct labels at the line ends are the convention and read faster than a legend that sends the eye down and back. In bump at 346 the legend takes three lines (6 long paths) under a plot whose right edge has room. The swap is right for height (labels save the legend's rows) and wrong for width: at 280–319 a column up to 14ch + 6 px (~95 px of tick face) is about a third of the view, the narrowest place to spend it.
- **Evidence**: frames/bump/light-natural-346.png (legend of 3 lines, ranks 1–6 decoded by colour only); frames/slopegraph/*-natural-346.png and frames/series/*-natural-480.png (legend under the plot at full room).
- **Why it matters**: direct labelling removes the colour-lookup step, which is also the accessibility fallback for colour-alike series; a legend under the plot is the weaker key at the widths where both fit.
- **Where to fix**: packages/core/src/fit.ts and plan.ts:181: for line/area series of few enough series, plan `labels` first and let the legend replace them when the width cannot carry the column (an inline need on `labels` above the axes' 280, a block need on the legend); keep the legend first for bars.

### B3. Sankey labels have no halo over the ribbons
- **Severity**: low
- **What**: Sankey labels are `paint: 'ink'` with no `halo`, though they always lie over ribbons, which are thickest and most layered at the target column. Reference and point labels, the other labels set over marks, carry `halo`. label.ts says the tone is "the paint of its node"; the Sankey's labels use ink, which is the better choice, but the atom's comment and the code disagree.
- **Evidence**: parts/labels/sankey-dark-natural-480.png ("Changelog" and "Pricing" over blue and crimson strands); parts/labels/sankey-light-natural-346.png ("Search" over lime, "AI assistants" over pale blue: readable, but only because these fills happen to be light).
- **Why it matters**: the contrast of a label over data depends on the data under it; a palette change or a darker ribbon breaks it silently.
- **Where to fix**: packages/flow/src/index.ts, set `halo: true` on the label nodes and toggle `data-halo` in flow/src/dom.ts as cartesian.ts does; correct the tone note in chrome/label.ts.

### B4. The tick face sets words badly
- **Severity**: low
- **What**: labels use `font: 'tick'`, a pixel face whose `g` has a descender that reads as `9`: "Blo9", "Chan9elo9", "Pricin9". On axes the face mostly sets numbers and short dates; labels set names.
- **Evidence**: parts/labels/sankey-dark-natural-480.png, parts/labels/sankey-light-natural-346.png.
- **Why it matters**: a name misread is a datum misread; categorical labels need a face that sets words.
- **Where to fix**: a label face token (or the tick face's lowercase descenders) in packages/dom/src/tokens.ts; this is shared with axes, so decide it once for the tick face.

## Situational issues
### S1. Grouped and other split bars lose their key with nothing in its place
- **Severity**: medium
- **Composition**: cartesian, split `bar` (grouped, marimekko, stacked bars) at 280–319 wide or 120–179 tall.
- **What**: the `legend` rule hides the legend and "shows labels", but line ends are made only from path ends (scene.ts:538, `ends`), and plan.ts:181 sets `labels` only when `series.lines`. For bars the legend just goes and the colours have no key.
- **Evidence**: not drawn in the capture (see B1); read off packages/core/src/fit.ts:42 and plan.ts:181. Nearest frames: frames/grouped/light-natural-346.png (legend shown, the only key).
- **Why it matters**: colour carrying a categorical encoding with no key is unreadable; the checker's contract ("else labels shows") promises a replacement that does not come.
- **Where to fix**: fit.ts / plan.ts: for split bars, keep the legend (as a single top line, as `rows` and `band` do with `legend-top`) instead of swapping to labels.

### S2. A Sankey between 280 and 319 wide, or 120 and 139 tall, has unnamed grey targets
- **Severity**: medium
- **Composition**: `link` mark, where `guides` (320 × 140) has hidden the labels but `marks` (280 × 120) has not yet fallen back to the heatmap.
- **What**: the target nodes are all `ink.muted`, so with no labels they cannot be told apart at all; sources are told only by colour. Not in the capture (the sheet jumps from 346, labelled, to 250, the heatmap).
- **Evidence**: sheets/labels/light-natural-1.png and dark-natural-1.png (labels at 346, empty from 250); packages/flow/src/index.ts:27–31 and :80.
- **Why it matters**: a flow diagram with no names says only "there are flows"; the heatmap fallback says more.
- **Where to fix**: packages/flow/src/index.ts LINK_RULES: fall back to the heatmap when the labels go (make `marks` need what `guides` needs), or keep the target labels and drop only the source ones.

### S3. The smallest Sankey node is unnamed, silently
- **Severity**: low
- **Composition**: a column whose last nodes are thinner than a label line (sankey sources: the orange node under "Email").
- **What**: the declutter rightly keeps the larger node's label ("Email") and hides the orange one; nothing marks that a name was dropped, and the orange node at 4 px is barely visible.
- **Evidence**: parts/labels/sankey-light-natural-346.png and sankey-dark-natural-480.png (bottom-left orange node, no label).
- **Why it matters**: acceptable (the readout names it), but a reader counting categories gets five, not six.
- **Where to fix**: packages/flow/src/index.ts; optionally merge the dropped tail into an "Other" label, or accept as is.

## Works well
- Sankey labels centred on their nodes, source labels left-aligned beside the node and target labels right-aligned before it, inside the plot, with the clamp keeping the top and bottom ones in the part.
- Declutter by node size in each column, in both place() and the measured pass, so the scene and the DOM agree.
- Ink colour on the Sankey: correct for words over multicoloured ribbons; theme parity is good, white on dark and near-black on light.
- Line-end labels take the series' `-text` step (dom.ts:108), not the mark colour, so lime and orange names keep contrast; set apart by the measured pass (`apart`) and cut at 14ch.
- The checker's `plot×labels` overlap on the Sankey is intended layering, not a fault (the checker could exempt `labels` over `plot` for `link`).

## Open questions
- How line-end labels actually look (gap from the plot's right edge, collisions in a 6-series stacked area, the 14ch cut on long paths like `/docs/getting-started`) cannot be judged until a frame at ~300 px wide or ~150 px tall is captured.
- Should a single highlighted series in a plain-painted spaghetti get its name at its end? The underline rule for a highlighted label in label.ts suggests it was meant to; today plain series get no label at all.
- At a 100 px box a split area sparkline has neither key. Is a keyless multi-colour sparkline acceptable, or should it collapse to one colour (the total) there?
