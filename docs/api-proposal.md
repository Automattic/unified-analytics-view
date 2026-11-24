# What the views ask of the query API

As of November 24, 2026. **A proposal to the owners of the analytics query API. Nothing here is agreed.**

`<ua-view>` draws an answer and computes nothing: every number it shows or says is the engine's. So what a view can say truthfully is bounded by what the catalog and the answer tell it. This lists what is asked of each, why, and where it stands on this side.

- **Built** means a view already reads it where an answer or a catalog has it. Agreeing it costs this side nothing more.
- **Not built** means nothing here reads it yet. The shape given is a suggestion, and yours to change.

An adapter between your API and these shapes is cheap (`packages/spacefast` is one), so the names matter less than the facts being there.

## 1. What an answer already is

A view needs `{ rows, totals, meta }`, and holds an answer to this:

- **Totals are the engine's.** A view never adds up the rows it is given, since many metrics do not add up.
- **Unknown is null,** never zero. A null total is written as a dash and compared with nothing.
- **The period before is a field beside this one:** `visitors@previous`, row by row and in the totals. Other statistics come the same way: `response_time@p25`.
- **An unfinished bucket says so:** `partial: true` on its row.

## 2. Of the catalog

| Asked | Suggested shape | What a view does with it | Here |
|---|---|---|---|
| Which dimensions a metric can be answered by | `"by": ["channel", "page"]` on the metric | Refuses a query that asks it by another, in `by` or in `where`, before the query is run, and says which it can be asked by | Built |
| Whether a metric adds up over a dimension | `"adds": ["channel", "page"]` on the metric, or `false` | A surface that filters by a selection knows what it may sum and what it must ask for again | Not built |
| The grains a time dimension may be asked at | `"grains": ["hour", "day", "week", "month"]` on the dimension | Refuses a grain the engine does not have. Today the grain is read off each value's form | Not built |
| A range a metric is read against | `"domain": [0, 100]`, `"target": 80`, `"bands": [50, 75]` on the metric | A gauge and a bullet graph: the range, the mark at the target, the bands behind | Built |
| A quantity the engine cuts into bins | A dimension of type `"number"`, with each row's `<dimension>@end` | A histogram: bars with no gap, labelled by their bins | Built |
| A colour for a value of a dimension | `"colors": { "Search": 1, "Direct": 2 }` on the dimension, a place in the series order | "Search" is one colour in every view. Today a value's colour is its place in the answer | Not built |

## 3. Of the query

| Asked | Suggested shape | What a view does with it | Here |
|---|---|---|---|
| A filter by dimension | `"where": { "channel": "Search" }`: a value, a list of values, or `{ "from", "to" }` for a time or a number. Dimensions are joined by "and" | A board filters every view by a selection. A view says what it is filtered to | Built |
| A statistic by name | `"with": ["p25", "p75"]` beside `metrics` | A box plot or a fan can ask for what it draws. Today such a view works only against an answer that happens to have the fields | Not built |
| A range that is not a count of days | A named period, or `{ "from", "to" }` | A view can say "this month". Today a range is `"28d"` or `"now"`, and any other form is refused | Not built |

## 4. Of the answer

| Asked | Suggested shape | What a view does with it | Here |
|---|---|---|---|
| The filter that was applied | `meta.where`, as the query wrote it | Refuses an answer that is not of its query's filter, so a view never says one thing and shows another | Built |
| Totals for each value of a dimension, where a query is by two | `totalsBy: { "channel": [{ "channel": "Search", "visitors": 4318 }] }` | A share of a row, a stacked bar and a treemap divide by the engine's total, and not by a sum of pairs | Built |
| How fresh it is | `meta.asOf`: the instant the data is complete to. `meta.stale: true` where the engine knows it is behind | Says so, by the engine's word. A view has no clock of its own, so it cannot tell | Not built |
| What was left out of it | `meta.excluded: ["bots", "no-consent"]` | Says that the number is of less than everything, and of what | Not built |
| That a metric is not available here | `meta.unavailable: { "revenue": "No store is connected" }`, with a null total | Shows the reason where it would show a dash | Not built |
| The zone its buckets were cut in | Each bucket named by the clock where it was cut: `2026-09-08` for a day in the site's zone | Writes "Sep 8" on every machine and never asks the viewer's zone. An instant in another zone would be written a day off | Built for bare dates; a site's time zone is yours to add |

## 5. What follows an agreement

1. `by` on a metric is in the catalog's schema already. A catalog that states it gets the refusal.
2. The three states of an answer in section 4 each need a place on the view, which is a design question on this side. The shape comes first.
3. Nothing here reads `adds`, `grains` or `colors` yet. Each has its reader waiting: a surface that filters a board, the time axis, and the colour scale.
