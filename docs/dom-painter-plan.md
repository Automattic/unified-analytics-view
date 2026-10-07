# DOM painter plan

As of October 5, 2026. **For review. No DOM code is written until this is agreed.**

The decision on record: browser containers degrade per element, from the start, with intrinsic layout and container queries. This note proposes how, with the trend view worked through. Five calls for you are at the end.

## 1. The shape of it

```
spec ─► expand ─► plan (unbounded) ─► scene (ratios, by part) ─┬─► DOM painter: CSS fits it, live
                                                               └─► place(scene, size) ─► pixel scene ─► dots, canvas
fit rules (data) ─► compiled to container queries for the DOM
                 └► evaluated in code by resolve(), for containers with no CSS
```

- A browser container plans **once per data change**, for a container with no limits, and gets everything the spec asks for. CSS decides what shows. Nothing runs on resize except the measured pass in section 5.
- Containers with no CSS (the tldr prose for an agent, the dot grid, a native shell) keep calling `resolve()` with a size, as today.
- Both read the same fit rules. A context that wants its containers to behave differently passes them a different set (decided October 7; see section 10 of the reference).

## 2. Fit rules

One declaration per part. It names a container, the room the part needs in it, and what happens otherwise.

```ts
interface FitRule {
  id: string;                                   // 'axes', 'secondary', 'legend', …
  layout: Layout;                               // which layout it applies to
  container: 'view' | 'plot';
  needs: { inline?: number; block?: number };   // px; the part stays while the container has at least this
  hide: string[];                               // parts or roles given up otherwise
  show?: string[];                              // parts that appear in compensation, under the same condition
  set?: Record<string, string>;                 // layout switches under the same condition, as data-attributes
  keep?: KeepPart;                              // the spec's `keep` entry that disables this rule
}
```

The trend view's rules, carrying today's thresholds over unchanged:

```ts
[
  { id: 'axes',      layout: 'cartesian', container: 'view', needs: { inline: 280 },
    hide: ['x-axis', 'y-axis', 'grid'], show: ['number'], set: { arrange: 'side' }, keep: 'guides' },
  { id: 'mid-tick',  layout: 'cartesian', container: 'view', needs: { inline: 380 }, hide: ['x-tick.mid'] },
  { id: 'secondary', layout: 'cartesian', container: 'plot', needs: { inline: 180, block: 90 },
    hide: ['role:comparison', 'role:reference', 'role:context'], keep: 'secondary' },
  { id: 'marks',     layout: 'cartesian', container: 'view', needs: { inline: 152 },
    hide: ['plot'], show: ['number'], keep: 'marks' },
]
```

**Compiled** (by `packages/dom`, once, into the shadow root's stylesheet):

```css
@container view (inline-size < 280px) {
  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) :is(.vg-x-axis, .vg-y-axis, .vg-grid) { display: none; }
  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) .vg-number { display: block; }
  .vg[data-layout="cartesian"]:not([data-keep~="guides"]) { --vg-arrange: side; grid-template-columns: auto minmax(0, 1fr); }
}
@container plot (inline-size < 180px) or (block-size < 90px) {
  .vg:not([data-keep~="secondary"]) :is([data-role="comparison"], [data-role="reference"], [data-role="context"]) { display: none; }
}
```

**Evaluated** (by `packages/core`): `applies(rule, { view, plot }) → boolean`. `resolve()` uses it in place of the numbers now in `CONTAINER_RULES`, and reports what was dropped exactly as it does today.

What makes this work is that the rules chain through layout, as the central reducer's steps do. Dropping the axes puts the number beside the plot, the plot gets narrower, and the plot's own query then drops the comparison. Nobody wrote "under 280 px, also drop the comparison".

**What a rule cannot express,** and where it goes instead:

| Need | Why not CSS | Goes to |
|---|---|---|
| Tldr prose rung: the tldr value itself does not fit | The threshold is the width of this number, and a container query cannot read a variable | Measured pass |
| Tick labels colliding | CSS cannot see collisions | Measured pass |
| Top-N, coarser grain | Needs different data | The resolver, and a re-query |
| Which rows fit under a height limit | Countable in CSS only by a trick | See below |

Rows under a height limit: a column flex container with `flex-wrap: wrap` and `overflow: hidden` clips whole rows that do not fit, with no script. I propose using it and reporting the count through the measured pass when something needs to know.

## 3. The scene: ratios, by part

**Proposal: one scene, in ratios, with a `part` on every node. Pixel painters get today's pixel scene from a pure function, `place(scene, size)`.**

- Each layout has a fixed set of parts: for `cartesian` they are `number`, `plot`, `x-axis`, `y-axis`; for `rows`, `number` and `rows`; for `band`, `number`, `band`, `legend`. The `number` part is the tldr value.
- A node's coordinates are 0 to 1 within its part's box. A bar is `{ part: 'plot', x: 0.036, w: 0.026, v: 0.62 }`. A y tick is `{ part: 'y-axis', t: 0.25, text: '200' }`.
- A line or area is a path in a 100 by 100 box. The painter stretches it with `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`. Monotone-x curves are unchanged by stretching each axis, so the stretched path is the same curve as one computed at pixel size.
- The pixel gutters the builders hard-code today (36 px for y labels, 22 px for x labels) leave the scene. In the DOM they are grid tracks sized by their content. In `place()` they are constants, as now.
- Keys, paint tokens, roles and `layer` are identical in both forms. Data nodes gain `row`, the dimension value they came from.

`place()` is held to the existing golden pixel scenes, so the dot-grid painter and the parity sweep keep working through the change.

**One departure from the prototype.** Today the y scale is rounded to 2 ticks when the plot is under 120 px tall and 4 otherwise, which changes the scale's domain with the size. A ratio scene cannot do that. Proposal: always round to 4, mark each tick with a rank, and let a rule hide the lower-ranked ticks on short plots. Pixel output changes slightly for plots under 120 px tall.

## 4. Elements and containers

One custom element, `<ua-view>`, with an open shadow root. It takes `spec`, `result` and `catalog` as properties.

```html
<ua-view fit="width">                         <!-- :host is the `view` container -->
  #shadow-root
  <figure class="vg" data-layout="cartesian" data-keep="" aria-describedby="s">
    <figcaption id="s" class="vg-prose">Visitors: 10.5k in the last 28 days, up 12%…</figcaption>
    <div class="vg-number">                   <!-- value, delta, note -->
    <div class="vg-y-axis"> <span style="--t:.25" data-rank="1">200</span> … </div>
    <div class="vg-plot">                     <!-- the `plot` container; definite block size -->
      <div class="vg-grid"> <i style="--t:.25"></i> … </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path data-key="L0:area" data-role="context" />
        <path data-key="L1:line" data-role="comparison" />
        <path data-key="L2:line" data-role="primary" />
        <path data-key="L2:line:partial" data-role="primary" />
      </svg>
      <div class="vg-hits"> <i data-row="2026-09-08" style="--x:.0"></i> … </div>
    </div>
    <div class="vg-x-axis"> <span style="--x:0">Sep 8</span> <span class="mid" style="--x:.5">Sep 21</span> … </div>
    <table class="vg-table" hidden>…</table>  <!-- the same result as a table -->
  </figure>
</ua-view>
```

- **`view`** is the host element. `fit="width"` (the default) makes it `container-type: inline-size`: the view takes the width it is given and its natural height. `fit="box"` makes it `container-type: size` and the plot fills the height left over. The surface picks; a panel uses `width`, a dashboard tile uses `box`.
- **`plot`** is `container-type: size`. Its height is always definite: 184 px with axes, 46 px bare, or the leftover in `box` mode. That is what makes height queries on it legal.
- A rule about axes queries `view`, never `plot`, because hiding the x axis changes the plot's size. A rule about roles queries `plot`, because those elements live inside it.
- **Bars are HTML,** positioned by custom properties (`inset-inline-start: calc(var(--x) * 100%)`, `block-size: calc(var(--v) * 100%)`), so corner radii and hairlines stay true at any size. Lines and areas are the stretched SVG. Text is never inside the SVG.
- **`rows`** is a grid per row: `minmax(0, 1fr) auto`, label ellipsized by CSS, the bar a background sized by `--v`. No character-width estimates.
- **`band`** segments use `flex-grow: var(--v)`.
- Paint tokens become custom properties on `:host`, so a surface themes a view from outside the shadow root. They use the `@automattic/charts` names; see section 4.1.

### 4.1 Paint tokens as `@automattic/charts` custom properties

Names on the right were read from `src/styles/chart-scope.scss` on Jetpack trunk. A page that already styles `@automattic/charts` themes a view with no extra work.

| Paint token | Custom property | Note |
|---|---|---|
| `ink` | `--a8c-charts-color-label` | |
| `ink.muted` | `--a8c-charts-color-label-secondary` | Tick labels use `--a8c-charts-color-label-axis` |
| `grid` | `--a8c-charts-color-grid` | |
| `axis` | `--a8c-charts-color-axis-x`, `-axis-y` | |
| `series.1` to `series.6` | `--a8c-charts-color-series-1` to `-6` | Theirs declares only slot 1 and generates the rest in script. We declare all six |
| `rule` | `--a8c-charts-color-annotation` | |
| `compare` | `--a8c-charts-color-comparison` | **New.** Theirs dashes the series colour instead |
| `delta.good`, `delta.bad` | `--a8c-charts-color-delta-good`, `-delta-bad` | **New.** They default to `-trend-up` and `-trend-down`. Theirs names a direction; ours names a judgement, because polarity can make a rise bad |
| flat delta | `--a8c-charts-color-trend-neutral` | |
| `live` | `--a8c-charts-color-live` | **New** |
| panel and tile surfaces | `--a8c-charts-color-surface`, `-surface-secondary`, `-background` | |
| bar track | `--a8c-charts-color-track` | |
| tooltip | `--a8c-charts-color-tooltip-surface` | |
| bar corner | `--a8c-charts-border-radius-bar` | |
| entrance motion | `--a8c-charts-motion-duration-entrance`, `-motion-easing-entrance` | Update and exit motion tokens are new |

## 5. The measured pass

One `ResizeObserver` on the plot, and a run after each paint. It only reads sizes and writes attributes; CSS does the hiding.

- `data-fit="prose"` on the figure when the number is wider than the view.
- `data-thin` on x tick labels that would collide.
- Later: label placement on points and lines, behind the same hook.

It never rebuilds the scene.

## 6. Keys, keyboard and transitions

- Every element carries `data-key`. Repainting reconciles by key: new keys enter, missing keys exit, the rest update in place.
- Positions are custom properties, so an update is a CSS transition on `--x`, `--w`, `--v`, `--t`, timed by motion tokens. They have to be registered as numbers to animate. `@property` is ignored inside a shadow root, so the painter registers them once on the document with `CSS.registerProperty`. Where that is missing, values still apply and nothing animates.
- Path shapes cannot transition in CSS. On a data change the painter interpolates the values and regenerates `d` per frame. This is the one scripted animation.
- No transition runs during a resize. Elements hidden by a container query simply go.
- **Keyboard:** the `@automattic/charts` model, kept as is. One tab stop per view; left and right arrows step through points; Enter or Space activates the point; Tab and Escape leave; the tooltip is the readout. The arrows move across `vg-hits`, one per row of the result, which is also what hover and tooltips attach to. The readout announces the dimension value, the metric in its catalog format, and the comparison if present. Lines need this because a line is one path with no element per point.
- The tldr prose is the figure's description. The table is the same result and is reachable by a control the surface provides.

## 7. Things to prove first

A half-day spike on the trend view, before the rest of the painter, to check:

1. Dashes on a stretched path with `non-scaling-stroke` keep their screen length in Safari and Firefox.
2. The nested chain works: a `view` query changes the grid, the plot narrows, a `plot` query drops the comparison, with no flicker.
3. `CSS.registerProperty` animates custom properties used inside a shadow root.
4. `container-type: size` on the plot behaves inside a grid in Safari.
5. The stretched monotone path matches the pixel path from `place()` to within a pixel.

If 1 or 2 fails, the fallback is the pixel scene painted as SVG and re-planned on resize, which is proven.

## 8. Calls for you

1. **Fit modes.** `fit="width"` and `fit="box"` as the two ways a surface sizes a view. Recommended.
2. **The scene carries ratios and a `part`,** and pixel painters go through `place()`. Recommended over two scene forms.
3. **Y ticks always round to 4,** with a rule thinning them on short plots. A small, deliberate departure from the prototype.
4. **Bars as HTML, lines as stretched SVG.** Recommended. The alternative is everything in SVG with a script on resize.
5. **The tldr prose rung is measured, not a container query.** I see no way around it.

## 9. Order of work, once agreed

1. Fit rules in `core`, with `resolve()` reading them. The parity sweep must stay green.
2. The ratio scene and `place()`. The golden pixel scenes must stay green, apart from call 3.
3. The spike in section 7.
4. `<ua-view>` for `cartesian`, then `rows`, then `band`, each on the bench at 346 px.
5. The measured pass, then keys and transitions.
