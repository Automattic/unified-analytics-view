# DOM painter plan

As of October 7, 2026. **Reviewed October 7. Section 8 records what was decided and the one call still proposed.**

The decision on record: browser containers degrade per element, from the start, with intrinsic layout and container queries. This note says how, with the trend view worked through.

**The principle (decided October 7): intrinsic behaviour is the default.** A surface lays its containers out by a scheme of its own: a sidebar stacks them, a toolbar sets them small in a row. A container does not know or care where it is. It fills the room it is handed and renders itself for that room. Nothing in a view or a spec names a surface, a size or a mode.

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
  needs: { inline?: number; block?: number };   // px; the part stays while the container has at least this in each
  hide: string[];                               // parts or roles given up otherwise
  show?: string[];                              // parts that appear in compensation, under the same condition
  set?: Record<string, string>;                 // layout switches under the same condition, as data-attributes
  keep?: KeepPart;                              // the spec's `keep` entry that disables this rule
}
```

The trend view's rules, carrying today's thresholds over unchanged:

```ts
[
  { id: 'axes',      layout: 'cartesian', container: 'view', needs: { inline: 280, block: 120 },
    hide: ['x-axis', 'y-axis', 'grid'], show: ['number'], set: { arrange: 'side' }, keep: 'guides' },
  { id: 'mid-tick',  layout: 'cartesian', container: 'view', needs: { inline: 380 }, hide: ['x-tick.mid'] },
  { id: 'secondary', layout: 'cartesian', container: 'plot', needs: { inline: 180, block: 90 },
    hide: ['role:comparison', 'role:reference', 'role:context'], keep: 'secondary' },
  { id: 'marks',     layout: 'cartesian', container: 'view', needs: { inline: 152, block: 46 },
    hide: ['plot'], show: ['number'], keep: 'marks' },
]
```

**Compiled** (by `compileFitRules` in `packages/dom`, once per rule set, into a constructed stylesheet the shadow root adopts). Corrected at step 4 from what the spike found: one `@container` block per need, never an `or` across both axes, because a width-only container passes over a query that names its height, the inline half included. Corrected again in review: each query asks for half a pixel under its need, because at a fractional zoom a container laid out at exactly the need measures a hair under it, and the part would go at the very size its rule says it fits.

```css
@container uav-view (inline-size < 279.5px) {
  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) :is(.uav-x-axis, .uav-y-axis, .uav-grid) { display: none; }
  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) .uav-number { display: block; }
  .uav[data-layout="cartesian"]:not([data-keep~="guides"]) { --uav-arrange: side; /* then what the layout module adds */ }
}
@container uav-view (block-size < 119.5px) { /* the same three rules */ }
@container uav-plot (inline-size < 179.5px) {
  .uav[data-layout="cartesian"]:not([data-keep~="secondary"]) :is([data-role="comparison"], [data-role="reference"], [data-role="context"]) { display: none; }
}
@container uav-plot (block-size < 89.5px) { /* the same rule */ }
```

A rule's data cannot say everything that changes with it: the grid areas, the gap and the bare plot height all switch with the axes. Each layout module supplies those declarations by rule id, and the compiler writes them under the same condition and `keep`. A `set` entry is written as a custom property (`--uav-arrange: side`), which nothing styles from; it is there to be read. `x-tick.mid` compiles to the ranked x label, `.uav-x-axis [data-rank]`. The base styles sit in a cascade layer, so a compiled rule beats them whatever its specificity, and rules are written in order, so a later rule beats an earlier one.

**Height on the view.** A view in a row or a tile is handed a height as well as a width, so the `view` rules carry a `block` need too: 120 px for a plot with axes and 46 px for a bare one, both from `CONTAINER_RULES`. A view that takes its natural height is a width-only container, where a `block-size` query is unknown and never matches, so the same compiled rules serve both. Step 1's sweep checks that these numbers reproduce what `resolve()` does under its six height limits; if they do not, that is reported, not tuned quietly.

**Evaluated** (by `packages/core`): `applies(rule, { view, plot }) → boolean`, true when the container is short of the room. Built in step 1: the rules are `FIT_RULES` in `packages/core/src/fit.ts`, carried as `rules.fit`, and `resolve()` reads them in place of the thresholds that were in `CONTAINER_RULES`. It reports what was dropped exactly as before.

**What step 1 found** (`test/fit.test.ts` holds each of these):

- Over the sweep, no rule hides what `resolve()` keeps, and the `secondary` and `mid-tick` rules say exactly what it does.
- The 120 px block need does not reproduce `resolve()` when the number sits above the plot. The number takes 92 px of the view (114 in the dot face), so the axes go under 212 px, not 120. In the sweep this is the trend in a context that always shows the number, at 160 px tall. Not tuned; to settle.
- The 46 px block need holds at the six heights, but a bare plot beside a number with a delta is 50 px tall (54 in the dot face), so the two differ between 46 and 49 px. Not tuned; to settle.
- `keep` means different things in the two evaluators. In `resolve()` a kept step is skipped and the next one is tried, so a trend that keeps its guides gives up all its marks under 280 px wide or 120 px tall. A compiled rule is only switched off, so the axes and marks both stay.
- `resolve()` still measures what a rule cannot say. They are added to the table below.

What makes this work is that the rules chain through layout, as the central reducer's steps do. Dropping the axes puts the number beside the plot, the plot gets narrower, and the plot's own query then drops the comparison. Nobody wrote "under 280 px, also drop the comparison".

**What a rule cannot express,** and where it goes instead:

| Need | Why not CSS | Goes to |
|---|---|---|
| Tldr prose rung: the tldr value itself does not fit | The threshold is the width of this number, and a container query cannot read a variable | Measured pass |
| Tick labels colliding | CSS cannot see collisions | Measured pass |
| Top-N, coarser grain | Needs different data | The resolver, and a re-query |
| Which rows fit under a height limit | Countable in CSS only by a trick | See below |
| A bare plot beside a number wider than 76 px (found in step 1) | The `marks` need of 152 px allows the number 76 px; the dot face sets "10.5k" in 116 | Measured in `resolve()`; in the DOM the number is a content-sized track, so a `plot` query could say it |
| A bar list's width (found in step 1) | The rule holds the label's 90 px; the widest value's room depends on the data | Measured in `resolve()`; in the DOM the value is a content-sized track |
| A full legend, or a number above rows, under a height limit (found in step 1) | The height needed depends on how many segments or lines there are | The scene's height, in `resolve()`; open for the DOM |

Rows under a height limit: a column flex container with `flex-wrap: wrap` and `overflow: hidden` clips whole rows that do not fit, with no script. I propose using it and reporting the count through the measured pass when something needs to know.

## 3. The scene: ratios, by part

**Agreed October 7: one scene, in ratios, with a `part` on every node. Pixel painters get today's pixel scene from a pure function, `place(scene, size)`.** A pixel scene needs a size before it can exist, which is the opposite of intrinsic.

- Each layout has a fixed set of parts: for `cartesian` they are `number`, `plot`, `x-axis`, `y-axis`; for `rows`, `number` and `rows`; for `band`, `number`, `band`, `legend`. The `number` part is the tldr value.
- A node's coordinates are 0 to 1 within its part's box. A bar is `{ part: 'plot', x: 0.036, w: 0.026, v: 0.62 }`. A y tick is `{ part: 'y-axis', t: 0.25, text: '200' }`.
- A line or area is a path in a 100 by 100 box. The painter stretches it with `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`. Monotone-x curves are unchanged by stretching each axis, so the stretched path is the same curve as one computed at pixel size.
- The pixel gutters the builders hard-code today (36 px for y labels, 22 px for x labels) leave the scene. In the DOM they are grid tracks sized by their content. In `place()` they are constants, as now.
- Keys, paint tokens, roles and `layer` are identical in both forms. Data nodes gain `row`, the dimension value they came from.

`place()` is held to the existing golden pixel scenes, so the dot-grid painter and the parity sweep keep working through the change.

**One departure from the prototype.** Today the y scale is rounded to 2 ticks when the plot is under 120 px tall and 4 otherwise, which changes the scale's domain with the size. A ratio scene cannot do that. Agreed October 7: always round to 4, mark each tick with a rank, and let a rule hide the lower-ranked ticks on short plots. Pixel output changes slightly for plots under 120 px tall, so the parity test changes with it, on purpose.

## 4. Elements and containers

One custom element, `<ua-view>`, with an open shadow root. It takes `spec`, `result` and `catalog` as properties, or as JSON in child `<script type="application/json" data-for="spec">` elements, so a view can be written as markup alone by an agent or a server template. A property wins over the markup.

```html
<ua-view>                                     <!-- :host is the `view` container -->
  #shadow-root
  <figure class="uav" data-layout="cartesian" data-keep="" aria-describedby="s">
    <figcaption id="s" class="uav-prose">Visitors: 10.5k in the last 28 days, up 12%…</figcaption>
    <div class="uav-number">                   <!-- value, delta, note -->
    <div class="uav-body">                     <!-- the layout's own: one module per layout paints into it -->
      <div class="uav-y-axis"> <span style="--uav-t:.25" data-rank="1">200</span> … </div>
      <div class="uav-plot">                   <!-- the `plot` container; definite block size -->
        <div class="uav-grid"> <i style="--uav-t:.25"></i> … </div>
        <div class="uav-bars"> <i data-row="2026-09-08" style="--uav-x:.01; --uav-w:.03; --uav-v:.6"></i> … </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <path data-key="context:area" data-role="context" />
          <path data-key="comparison:line" data-role="comparison" />
          <path data-key="primary:line" data-role="primary" />
          <path data-key="primary:line:partial" data-role="primary" />
        </svg>
        <div class="uav-refs"> … </div>        <!-- rules and their labels -->
        <div class="uav-hits"> <i data-row="2026-09-08" style="--uav-x:.0"></i> … </div>   <!-- step 5 -->
      </div>
      <div class="uav-x-axis"> <span style="--uav-x:0">Sep 8</span> <span data-rank="1" style="--uav-x:.5">Sep 21</span> … </div>
    </div>
    <table class="uav-table">…</table>         <!-- the same result as a table; shown by the `table` attribute -->
  </figure>
</ua-view>
```

- **`view`** is the host element. In CSS the container is named `uav-view`, and the plot's `uav-plot`: a rule's data keeps the plain names and the compiler writes the prefix, so a page that names a container of its own `view` does not answer the view's queries. By default it is `container-type: inline-size`: it fills the width it is handed and takes its natural height. It cannot collapse, whatever it is dropped into. A surface layout that hands out a box (section 4.2) makes it `container-type: size`, and the plot fills the height left over. Both behaviours have to exist, because an element whose height can be queried cannot also take its height from its content. The view is never told which it is: the layout sets it, in the layout's own CSS.
- **`plot`** is `container-type: size`. Its height is always definite: the leftover when the view was handed a box, and otherwise a size from the context's rule set, read as a custom property (`axes.height` and `bare.height`, 184 and 46 px by default). The painter hard-codes neither. That definite height is what makes height queries on the plot legal. As built at step 4, the stated `block-size` is on `.uav-body`, which holds the plot and its axes, so 184 px is the height of the whole view as it is in pixels; the plot takes what the x axis leaves. One rule, `@container uav-view (block-size >= 0px) { .uav-body { block-size: auto; } }`, matches only when the view was handed a box, and the body then fills it.
- A rule about axes queries `view`, never `plot`, because hiding the x axis changes the plot's size. A rule about roles queries `plot`, because those elements live inside it.
- **Bars are HTML,** positioned by custom properties (`inset-inline-start: calc(var(--uav-x) * 100%)`, `block-size: calc(var(--uav-v) * 100%)`), so corner radii and hairlines stay true at any size. Lines and areas are the stretched SVG. Text is never inside the SVG.
- **`rows`** is a grid per row: `minmax(0, 1fr) auto`, label ellipsized by CSS, the bar a background sized by `--uav-v`. No character-width estimates.
- **`band`** segments use `flex-grow: var(--uav-v)`.
- Paint tokens become custom properties on `:host`, so a surface themes a view from outside the shadow root. They use the `@automattic/charts` names; see section 4.1.
- **The painter is safe under a strict content security policy,** because a browser's own panel and an agent harness's frame both impose one (`docs/shell-plan.md`, section 3). Nodes are made with `createElement`, never `innerHTML`. The `style` attributes in the sketch above show the result; they are written with `style.setProperty`. Styles are constructed stylesheets adopted by the shadow root, never a `<style>` element.

### 4.1 Paint tokens as custom properties, named as `@automattic/charts` names its own

Names on the right were read from `src/styles/chart-scope.scss` on Jetpack trunk, where the prefix is `--a8c-charts-`. Ours is `--ua-charts-` until the two interoperate, so that nobody takes one for the other. A page that already styles `@automattic/charts` themes a view by aliasing each token across: `--ua-charts-color-label: var(--a8c-charts-color-label)`.

| Paint token | Custom property | Note |
|---|---|---|
| `ink` | `--ua-charts-color-label` | |
| `ink.muted` | `--ua-charts-color-label-secondary` | Tick labels use `--ua-charts-color-label-axis` |
| `grid` | `--ua-charts-color-grid` | |
| `axis` | `--ua-charts-color-axis-x`, `-axis-y` | |
| `series.1` to `series.6` | `--ua-charts-color-series-1` to `-6` | Theirs declares only slot 1 and generates the rest in script. We declare all six |
| `rule` | `--ua-charts-color-annotation` | |
| `compare` | `--ua-charts-color-comparison` | **New.** Theirs dashes the series colour instead |
| `delta.good`, `delta.bad` | `--ua-charts-color-delta-good`, `-delta-bad` | **New.** They default to `-trend-up` and `-trend-down`. Theirs names a direction; ours names a judgement, because polarity can make a rise bad |
| flat delta | `--ua-charts-color-trend-neutral` | |
| `live` | `--ua-charts-color-live` | **New** |
| panel and tile surfaces | `--ua-charts-color-surface`, `-surface-secondary`, `-background` | |
| bar track | `--ua-charts-color-track` | |
| tooltip | `--ua-charts-color-tooltip-surface` | |
| bar corner | `--ua-charts-border-radius-bar` | |
| entrance motion | `--ua-charts-motion-duration-entrance`, `-motion-easing-entrance` | Update and exit motion tokens are new |
| cell corner | `--ua-charts-border-radius-cell` | Theirs. A grid's cells and the swatches of its ramp |
| swatch and readout corners | `--ua-charts-border-radius-swatch`, `-border-radius-tooltip` | **New** |
| strokes | `--ua-charts-stroke-width-line`, `-rule`, `-active` | **New.** A line whose layer gives no width, a rule or grid line, and the outline of a chosen mark |
| type faces | `--ua-charts-font-size-tick`, `-label`, `-value`, `-display`, `-display-small` | **New.** Each may be fluid, in `cqi`: the element works a face out once, against the view's width, so it is one size in every part |
| weights and tracking | `--ua-charts-font-weight-value`, `-display`, `-heading`, `--ua-charts-letter-spacing-display` | **New** |

The list the element reads from, with the value each token falls back to, is `packages/dom/src/tokens.ts`. `packages/tokens` declares the same names as its charts tier (`config/charts.tokens.json`), and `test/dom-tokens.test.ts` holds the two together: the tier declares every token the element reads and none it cannot.

**Structure is not a token.** Gaps, gutters and the heights of rows, bars and axes are what the fit rules' needs are worked out from, so a theme that moved them would move what fits. What follows from a face is written from it instead: a line of a legend and the height of the x axis are ratios of the face they hold, so they follow a token that moves it. The fit rules' needs are still px, written for the faces at their least: every need across is under 380 px, where the fluid scale has hardly begun to climb, and ticks and labels are the two steps of it that hardly move at all (11.06 to 11.11 px, 12.4 to 13.3 px). The number is the face that grows, and it is measured.

### 4.2 Surface layouts

The surface owns the layout scheme, and it is plain CSS on the surface, outside the shadow root and outside `packages/dom`. Two to start, both in the bench:

- **Stack** (a sidebar or panel): a column. Each view fills the width and takes its natural height.
- **Row** (a toolbar): a row of equal shares at the height the surface gives. Each view fills its box. Adding a view divides the room again and every view refits itself; no view is told.

```css
.ua-stack { display: grid; gap: var(--space); }
.ua-row   { display: flex; gap: var(--space); }
.ua-row > ua-view { flex: 1 1 0; min-inline-size: 0; block-size: 100%; container-type: size; }
```

When the surface is itself a custom element, these rules sit in its shadow root, not the page's. So they are also exported as a constructed stylesheet a surface can adopt.

A dashboard grid of tiles is the row's rule on a grid. A context that wants its containers fitted differently in one of these (a toolbar that keeps a bare plot at 24 px) passes them a different rule set, as today. Whether the one declaration above is enough for the shadow styles, or the layout must also set an attribute on its children, is spike item 6.

## 5. The measured pass

One `ResizeObserver` on the plot, and a run after each paint. It only reads sizes and writes attributes; CSS does the hiding.

- `data-fit="prose"` on the figure when the number is wider than the view.
- `data-thin` on x tick labels that would collide.
- Later: label placement on points and lines, behind the same hook.

It never rebuilds the scene.

## 6. Keys, keyboard and transitions

- Every element carries `data-key`. Repainting reconciles by key: new keys enter, missing keys exit, the rest update in place.
- Positions are custom properties, so an update is a CSS transition on `--uav-x`, `--uav-w`, `--uav-v`, `--uav-t`, timed by motion tokens. They have to be registered as numbers to animate. `@property` is ignored inside a shadow root, so the painter registers them once on the document with `CSS.registerProperty`. Registration is global to the page, which is why they carry the `uav` prefix: a bare `--x` would change what a customer's own `--x` means. Where registration is missing or fails, values still apply and nothing animates.
- Path shapes cannot transition in CSS. On a data change the painter interpolates the values and regenerates `d` per frame. This is the one scripted animation.
- No transition runs during a resize. Elements hidden by a container query simply go.
- **Keyboard:** the `@automattic/charts` model, kept as is. One tab stop per view; left and right arrows step through points; Enter or Space activates the point; Tab and Escape leave; the tooltip is the readout. The arrows move across `uav-hits`, one per row of the result, which is also what hover and tooltips attach to. The readout announces the dimension value, the metric in its catalog format, and the comparison if present. Lines need this because a line is one path with no element per point.
- The tldr prose is the figure's description. The table is the same result and is reachable by a control the surface provides. The surface is outside the shadow root, so the switch is public: a `table` attribute on `<ua-view>` shows the table in place of the marks.

## 7. Things to prove first

A half-day spike on the trend view, before the rest of the painter, to check:

1. Dashes on a stretched path with `non-scaling-stroke` keep their screen length in Safari and Firefox.
2. The nested chain works: a `view` query changes the grid, the plot narrows, a `plot` query drops the comparison, with no flicker.
3. `CSS.registerProperty` animates custom properties used inside a shadow root.
4. `container-type: size` on the plot behaves inside a grid in Safari.
5. The stretched monotone path matches the pixel path from `place()` to within a pixel.
6. One stylesheet serves both sizings: the same view takes its natural height in a stack and fills its box in a row, with only the layout's CSS differing. If it cannot, the layout also sets a `fit="box"` attribute on its children, and the view's styles key off that.
7. The painter runs clean on a page whose content security policy forbids inline styles and `eval`.

If 1 or 2 fails, the fallback is the pixel scene painted as SVG and re-planned on resize, which is proven.

## 8. Decisions

Reviewed October 7, under the principle at the top.

1. **Sizing belongs to the surface layout, not the view.** Decided. Replaces the proposed `fit` attribute. With nothing said, a view fills the width and takes its natural height; a layout that hands out a box opts its children into filling it.
2. **The scene carries ratios and a `part`,** and pixel painters go through `place()`. Agreed.
3. **Y ticks always round to 4,** with a rule thinning them on short plots. Agreed, as a consequence of 2. A deliberate departure from the prototype.
4. **Bars as HTML, lines as stretched SVG.** Agreed. The alternative was a script on resize.
5. **The tldr prose rung is measured, not a container query.** Still proposed. It is the one place the fit is not intrinsic: the threshold is the width of the number itself. The pass reads sizes and sets an attribute; CSS still does the hiding.
6. **The painter is held to the shell's authoring rules.** Added October 7 from `docs/shell-plan.md`: prefixed registered properties, strict content security, inputs as markup, a public `table` attribute, and the surface layouts as an adoptable stylesheet. The attribute names (`table`, `data-for`) are proposed.

## 9. Order of work, once agreed

1. Fit rules in `core`, with `resolve()` reading them, including the `block` needs on the view. The parity sweep must stay green.
2. The ratio scene and `place()`. The golden pixel scenes must stay green, apart from call 3.
3. The spike in section 7.
4. `<ua-view>` for `cartesian`, then `rows`, then `band`, each on the bench in a stack at 346 px and in a row. All three are built, in `packages/dom`, each a module behind the seam in `packages/dom/src/layout.ts`.
5. The measured pass, then keys and transitions.
