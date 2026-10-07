# Shell plan

As of October 7, 2026. **Decided October 7.** How the chrome and the surfaces around the views are authored, so that one set of components reaches every place we mean to ship.

**How much to trust this.** The decision is David's. The claims about other people's software (how agent harnesses sandbox an artifact, what Chromium and Firefox build their own UI with) are from memory and were not checked. Check them when the integration work starts.

## 1. Where it has to run

| Surface | When | What it gives us |
|---|---|---|
| A panel in a customer's page, from one script tag | Friday | A hostile page: unknown styles, unknown scripts |
| A dashboard page | Friday, cut first | Our own page |
| A UI panel in a native browser, probably Chromium | Next | A privileged web page: strict content security, data from the browser, not the network |
| An artifact in an agent harness (Claude, ChatGPT, Gemini) | After | A sandboxed frame: one self-contained document, little or no network, data inline or over a bridge to the harness |
| Jetpack, wp-admin, any React or Preact app | With the port | A framework that owns the tree |

## 2. The decision

Three layers, each authored in the most portable form that can carry it.

| Layer | Authored as | Reaches |
|---|---|---|
| What a surface is: which views, which params, how params become queries | Plain data and pure functions in `packages/core` | Everything, including an agent and a native shell |
| Chrome primitives, the panel, the dashboard | Custom elements with shadow DOM, beside `<ua-view>` | Every surface in section 1 |
| What draws inside an element | Lit in the stateful ones, nothing in the small ones | Nobody sees it |

- **The unit we ship is the custom element,** never a framework component. A consumer sees tags, properties, events and custom properties.
- **Lit is inside the stateful elements** (the panel, the date and compare control, tabs). It is a dependency of the shell package only. `packages/core` and `packages/dom` stay as they are: `<ua-view>` has a hand-written painter and no framework.
- **Vite builds it:** a dev server for the bench, and one self-contained file for every surface in section 1.
- **React and Preact bindings stay thin and later,** as the reference already says. The bench uses the elements directly.
- **Styling is plain CSS** on the custom properties `packages/tokens` generates. No component library, no CSS-in-JS.
- **Chrome uses native elements first:** `<button>`, `popover`, `<dialog>`, `<input type="date">`. One is replaced only when the design pass rejects it.

Considered and not chosen: Preact components (run only where Preact or React runs), React with `@wordpress/components` (too heavy for a customer's page, and styled for wp-admin), and compile-to-many-frameworks tools (a toolchain to solve what custom elements already solve, and no help outside a browser).

## 3. Rules for authoring

These cost little now and are awkward to retrofit. Each is forced by at least two surfaces.

1. **Nothing fetches.** A surface is handed a query function. In a page it is an HTTP call, in the browser a message to the browser process, in a harness a call over its bridge or a frozen result in the document.
2. **"This page" is an input.** Nothing reads `location`. The in-page panel is told its URL by its loader; the browser panel is told the active tab's.
3. **Everything works from markup.** Every property that takes an object can also be given as JSON in a child `<script type="application/json">`. An agent or a server template writes markup, not wiring.
4. **Strict content security.** No `eval`, no `innerHTML`, no inline `style` attributes in markup, no `<style>` elements. DOM is built by API calls or Lit templates, positions are set with `style.setProperty`, and stylesheets are constructed and adopted.
5. **One self-contained file.** CSS included, no code splitting, nothing loaded at run time.
6. **No storage, cookies or sign-in inside the element.** State is in memory. Whatever lasts belongs to whoever embeds it.
7. **Theme comes from outside.** Light and dark follow the system colour scheme through the custom properties, with an attribute to force one.
8. **Words travel with the picture.** Anything that hands a view to a harness hands over the tldr prose and the table with it.
9. **Nothing global is claimed without a prefix.** Tag names, registered custom properties and events are ours by name.

Friday's panel hard-codes which views it shows. Its state is still one plain object and one pure function from params to queries, so it lifts into core when params and boards arrive.

## 4. What this asks of the painter

Raised against `docs/dom-painter-plan.md` as reviewed October 7, and written into it the same day (its section 8, item 6). None changes its design.

1. **Registered property names leak.** Section 6 registers `--x`, `--w`, `--v` and `--t` on the document. Registration is global, so on a customer's page it changes what their own `--x` means, and it fails if they registered one first. Prefix them (`--vg-x`).
2. **How the DOM is built is not stated.** Rule 4 above applies: the `style="--t:.25"` in section 4's sketch has to be set through the object model, and the compiled fit rules adopted as a constructed stylesheet.
3. **Inputs are properties only.** Rule 3 above: accept `spec`, `result` and `catalog` as child JSON too.
4. **The table has no switch.** Section 6 says a control the surface provides reveals it. The surface is outside the shadow root, so `<ua-view>` needs a public attribute for it.
5. **Layout CSS has to travel.** Section 4.2 puts `.ua-stack` and `.ua-row` on the surface. When the surface is itself a custom element they live in its shadow root, so they ship as a stylesheet it can adopt.

## 5. What waits

- The MCP server, and a bridge adapter per harness.
- Reporting content height to a harness frame.
- React and Preact bindings.
- A surface described as data (boards), in place of Friday's hard-coded panel.
- A native shell with no web view. Only the first layer reaches it; it would need its own chrome and a painter over `place()`.
