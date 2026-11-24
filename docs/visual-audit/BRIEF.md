# Visual audit: the brief every part's critic works from

You are auditing one **part** of `<ua-view>`, the chart component in this repo, from a **visual design and data-visualisation** point of view. Read, look and write. **Do not change any code**, and do not propose patches as diffs: describe what is wrong and where the fix belongs.

## What the component is

A view is written once as JSON (marks, encodings, roles) and the container it lands in decides how to present it. The element plans once with no size, paints the result in ratios, and leaves fitting to CSS container queries and a measured pass. As the container narrows or shortens, **parts** (axes, legend, number, plot…) step down or drop out by the fit rules in `packages/core/src/fit.ts`. The goal is that **agents compose views and dashboards open-endedly**, so every part has to be dependable in combinations no one has tried. Colours, type, radius, stroke and motion are tokens (`--ua-charts-*`, `packages/dom/src/tokens.ts`). The headline number is set in a 5 × 7 dot-matrix face (`packages/dom/src/dots.ts`), on purpose.

## What to look at

The capture is `apps/bench/captures/2026-11-20T20-50-34-247Z/`. Paths below are relative to it.

- **Contact sheets** for your part: `sheets/<part>/<theme>-<height>-<n>.png`. A row per sample (its layout under the name), a column per frame width: 480, 346, 250, 170, 120, 80, 40 px. Height `natural` is the view at its own height; `100` is a view handed a 100 px tall box. An empty cell means the part is not shown at that width. Look at **every sheet** for your part, light and dark.
- **Crops** at full resolution: `parts/<part>/<sample>-<theme>-<height>-<width>.png` (2× pixel density). Open them to check detail: alignment, weight, clipping, contrast.
- **Whole frames** for context: `frames/<sample>/<theme>-<height>-<width>.png`. Look at a part's neighbours before calling its spacing or weight wrong.
- **Measurements**: `capture.json`, a record per frame, with `measure.parts.<part>` = box `[x, y, w, h]` in px from the frame's corner, `outside`, `clipped` (px), `ellipsis` (count), and `plan` (layout, parts, marks).
- **The checker's findings**: `check.md` (and `check.json`). Its last section, "What each part promises", is your part's contract: the room it needs and what replaces it.
- **The source** of your part (named in your task), and the reference: `docs/view-grammar-reference.md` sections 10 and 11. Read enough to say whether an issue is the part's own or the composition's.

Ignore the two short diagonal lines in every crop's bottom-right corner: they are the bench's resize grip, not the component. Ignore the dashed outlines on the sheets.

## What to judge

From a UI and dataviz standpoint, across every sample and width your part appears in:

- **Legibility**: type size, weight, contrast in both themes, label collisions, truncation and how it reads.
- **Hierarchy and weight**: does the part sit at the right visual level beside its neighbours? Too loud, too quiet?
- **Alignment and spacing**: consistent edges, baselines, gaps; does it line up with the plot and the other parts?
- **Graceful fallback**: as widths shrink, does it step down sensibly and early enough, or hang on too long, get cut, or vanish abruptly? Is the step order sensible across samples?
- **Consistency**: does the same part look and behave the same across layouts and samples? Where it differs, is that justified?
- **Dataviz soundness**: does it help read the data truthfully: scale, encoding, colour use, ordering, labelling, accessibility (colour alone, contrast)?
- **Theme parity**: anything that works in light and fails in dark, or the reverse.

## Two kinds of finding

Sort every finding into one of two kinds. This split is the point of the audit.

1. **Base**: the part itself is wrong wherever it appears, so it is fixed **at the source**: its module, its tokens, its fit rule. Evidence is that it shows across several samples or layouts.
2. **Situational**: the part is fine on its own but goes wrong in a **particular composition**: a layout, a mark combination, a data shape (long labels, many series, one row), a height. It is fixed further down: in the layout, the preset, the rule for that case. Name the samples and widths.

## Report

Write **one file**: `docs/visual-audit/<part>.md`, in this shape and nothing else:

```markdown
# <part>

Source: <module path(s)>. Seen in <n> samples across <layouts>.

## Summary
Two to four sentences: how the part holds up overall, and its most important problem.

## Base issues
### B1. <short title>
- **Severity**: high | medium | low
- **What**: what is wrong, concretely.
- **Evidence**: sample, theme, height, width for at least two cases, with the crop or sheet path.
- **Why it matters**: the UI or dataviz principle at stake.
- **Where to fix**: module, token or fit rule, and the direction of the fix in one line (no code).

## Situational issues
### S1. <short title>
(same fields, and **Composition**: the layout, marks or data shape that triggers it)

## Works well
Short bullets: what to keep.

## Open questions
Anything you could not settle from the pictures.
```

Number findings B1, B2… and S1, S2…. Be specific and evidenced; do not pad. A part with few appearances gets a short report. When you are done, reply with the file path and a two-line summary.
