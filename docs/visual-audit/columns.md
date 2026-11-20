# columns

Source: packages/dom/src/layouts/rows.ts (the `.uav-columns` subgrid, `cell`, `roomsHere`), packages/dom/src/table.ts (the accessible table's `thead`), with the nodes made in packages/core/src/scene.ts:737-739 and the `columns` fit rule in packages/core/src/fit.ts:57. Seen in 3 samples (conversions, funnel, league), all in the rows layout.

## Summary
The header row works where it shows. Because it is a subgrid of the rows' grid, every end-anchored metric header sits exactly over the right edge of its numbers, in both themes and at every width from 1240 px down to 250 px, and it is set at the right quiet level. It has two real problems. It goes as soon as the second value column goes, which leaves the remaining number column with no name at the widths where a reader most needs one. In ranked lists the dimension's header sits over the rank digits and not over the labels it names. The tick face's missing descenders (`Pa9e`, `SteP`, `Chan9e`) are the most visible blemish.

## Base issues
### B1. The header leaves with the second column, and the last number loses its name
- **Severity**: medium
- **What**: The whole header row hangs on `need(1)`, the room the rank-1 column needs (rows.ts:110-111, "Headers stand over more than one column, so they go with the second"). Once that column is dropped, `max-block-size` collapses the header to 0. The list goes on showing the first metric's numbers and the dimension's values, but nothing names either one. Funnel and conversions show `10.5k`, `1,310` and so on under no word that says visitors or conversions.
- **Evidence**: conversions light natural 250 (`frames/conversions/light-natural-250.png`, a bare `1,310 … 96`). Funnel dark 100 at 250, 170 and 120 (`sheets/rows/dark-100-1.png`). League dark natural 170 (`frames/league/dark-natural-170.png`, `4,820 … 290` with no "Page views"). The empty 250/170/120 cells on `sheets/columns/light-natural-1.png`.
- **Why it matters**: A number with no unit or measure cannot be read truthfully. The header is the only place in these views where the metric is named, so dropping it removes the encoding's legend just as the view gets denser. A one-metric list (cleveland, lollipop) has the same gap by design, but there the author never had a header to lose.
- **Where to fix**: rows.ts header need (and the `columns` rule in fit.ts). Let the header follow the rank-0 column, which only goes when the list itself does, and drop only the header cells of the columns that are given up. If one remaining header should not stand, hand its name to something that stays, such as the tldr or a caption.

### B2. The header's own text length decides when a column is given up
- **Severity**: medium
- **What**: `roomsHere` (rows.ts:43-46) and core's `columnRooms` size each column to the longer of its header and its values. A 15-character header such as "Conversion rate" makes its column about twice as wide as its values (`12%`, `100%`), which leaves empty space to the left of the numbers and makes the column drop sooner. League's short "Change" keeps both value columns at 250. Funnel and conversions, with "Conversion rate", lose theirs at 250 and keep only one.
- **Evidence**: funnel light natural 346 (`frames/funnel/…-346`, with wide empty space left of `100%`, `16%`). Conversions light natural 346 (`frames/conversions/light-natural-346.png`, where `12%` sits far right in a column sized to its header). Against that, league light natural 250 on `sheets/rows/light-natural-1.png`, which keeps both columns.
- **Why it matters**: The guide is driving the data. A column's survival should depend on the values it holds, not on how wordy the catalog's label is. Agents composing views will get different fallback behaviour from a label rename alone.
- **Where to fix**: rows.ts `roomsHere` and core place.ts `columnRooms`. Size the column on its values, and let a header that is wider than its values wrap to two lines or ellipsize, with the full name kept in the table/title. Do not let the header widen the track.

### B3. The tick face drops descenders, so headers misread
- **Severity**: medium
- **What**: Headers are set in the `tick` face (Ans Mono at 8 px, `--ua-charts-font-size-tick`). At that size, `g` and `p` sit on the baseline with no descender and read as `9` and `P`: "Pa9e views", "Chan9e", "SteP". The x-axis shows the same thing (`parts/x-axis/adjacency-light-100-480.png`: "/docs/9ettin9-started"), so the problem belongs to the face, not to this part.
- **Evidence**: `parts/columns/league-dark-natural-480.png`, `parts/columns/funnel-dark-100-346.png`, `sheets/columns/light-natural-1.png` (all three rows).
- **Why it matters**: Headers are words, unlike ticks, which are mostly digits. A `g` that reads as `9` in a header sitting over a column of numbers invites a misreading, and "SteP" reads as a typo.
- **Where to fix**: The tick face token (packages/tokens charts tier, `font-size-tick` / `font-family-tick`). Either a glyph set with true descenders at the pixel grid, or set column headers (words) in the label face at a small size and keep the pixel face for digits. Flag this to the axes' auditor too.

### B4. Header size is at the floor of legibility
- **Severity**: low
- **What**: At 8 px muted, the header is about a third the cap height of the dot-matrix values under it and well under the ~14 px sans labels. The level is right for a guide, since it should be quieter than the data, but 8 px is below the usual 10-11 px floor for running words. Contrast is fine: muted foreground is 5.0:1 in light and 7.5:1 in dark, per the token comments.
- **Evidence**: `frames/conversions/light-natural-480.png`, `frames/league/dark-natural-250.png`.
- **Why it matters**: The tier is right but the size is not. On a 1× screen the pixel face holds up; on a 2× screen it reads as fine print beside 20 px numbers.
- **Where to fix**: Token level, together with B3. If headers move to the label face, set them a step below `font-size-label`, not at the tick size.

## Situational issues
### S1. In a ranked list the dimension's header sits over the rank, not the labels
- **Severity**: medium
- **Composition**: rows with a leading column before the label (league's rank, `lead > 0` in rows.ts).
- **What**: The start-anchored header is pinned to `--uav-col: 1` (rows.ts:106), which is the rank column when there is a lead. "Page" therefore sits over `1 2 3…`, and the page paths it names start about 40 px further right, with no header of their own.
- **Evidence**: `frames/league/light-natural-480.png` and `frames/league/dark-natural-250.png` ("Page" over the rank digits, paths starting at x≈48). The same holds at 346 in both themes and at both heights.
- **Why it matters**: A header has to stand over what it names. Here it labels the rank as "Page", and the column of paths goes unlabelled.
- **Where to fix**: rows.ts `cell`. Put the dimension header in the label's column (`lead + 1`), the same column `col.get` gives the last label, or let it span `1 / first` so it covers rank and label together.

## Works well
- The subgrid works: every end-anchored header's right edge lands on its numbers' right edge at 480, 346, 250 and free width, in both themes and at both heights. It needs no measuring.
- The start header lines up with the row labels' inset (8 px pad) in the non-ranked samples.
- The tone is right. Muted ink, guide layer, no rule or fill, quieter than both labels and values. It passes AA in both themes.
- Under a 100 px box the header stays and the list shows two whole rows under it, as the `columns` rule promises (needs 80 tall), and the header's 20 px goes back to the rows once it collapses (`rows` box moves to y=0).
- Given-up columns take their header cell with them (conversions 346 drops "Value" with its column) and the other headers stay where they are.

## Open questions
- Where should a view name its metric once only one column is left? A single-metric list (cleveland, lollipop) never names it inside the view, so B1 may belong to the composition (tldr or title) rather than to this part. Settle this with the rows and number audits.
- The checker's `columns` findings at 250/170/120 (clipped 5 px, ellipsis 1-3) come from the header collapsed to 0 px tall, and the ellipsis 1 at conversions 346 from the zero-width "Value" cell. None of them show on screen. Should the checker skip a part whose box is 0 tall, or should the header use `display: none` once collapsed? The collapsed spans also stay in the accessibility tree, though the separate `table.ts` table is what assistive tech is meant to read.
- Should the bar's metric be marked in the header? In conversions and funnel the bar encodes the first metric, but nothing in the header ties the bar to "Conversions" or "Visitors" rather than to "Event"/"Step". It reads well enough at present, but I could not tell whether that is deliberate.
