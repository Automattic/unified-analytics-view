import { formatDimension, formatValue, type RectNode, type Row, type TextNode } from '@unified-analytics/core';
import { attr, ensure, keyed, pageWay, prop, text } from '../dom.ts';
import { token } from '../tokens.ts';
import { hideReadout, placeReadout, readout, readoutOf } from '../keys.ts';
import type { LayoutPainter } from '../layout.ts';
import { thin } from '../measure.ts';

/* A dimension on x, another on y, a metric on colour: a grid of cells. The cells are a CSS grid, each set in its
 * track by two custom properties, so nothing here runs on resize. The axes are the plot's own: the row labels are a
 * column sized by the widest, the column labels a row under the grid, and both are placed by the stylesheet
 * cartesian.ts wrote for `.uav-y-axis`, `.uav-x-axis` and `.uav-plot`. Below them, the ramp.
 *
 * A cell is its own hit target, and no cell carries `data-row`, so the element's keyboard (keys.ts) leaves this
 * layout alone and the one here stands in for it. It is version 4's model, taken to two dimensions: one tab stop,
 * nothing chosen on focus, left and right along x and up and down along y, stopping at the edges, Enter or Space to
 * activate, Escape to let go. To assistive technology it is a grid of rows of cells, each named by its readout.
 * ponytail: version 4 has no model for two dimensions, so this one is a proposal (chart-coverage-plan, section 6). */
const css = `
.uav[data-layout="matrix"] { --uav-body-block: var(--uav-axes-height, 184px); }
/* The frame is set from the left whichever way the page reads, as a plot's is (cartesian.ts): the row labels stay on
 * the left of the cells. The ramp is a legend, and follows the page. */
.uav[data-layout="matrix"] .uav-body { display: grid; grid-template: "y plot" minmax(0, 1fr) ". x" auto "ramp ramp" auto / auto minmax(0, 1fr); direction: ltr; }
.uav[data-layout="matrix"] [data-thin] { visibility: hidden; }
.uav[data-layout="matrix"]:has(> .uav-body[data-strip]) { --uav-body-block: 52px; }
.uav-body[data-strip] .uav-ramp { display: none; }
.uav-cells { position: absolute; inset: 0; display: grid; gap: 1px; grid-template: repeat(var(--uav-ny), minmax(0, 1fr)) / repeat(var(--uav-nx), minmax(0, 1fr)); }
.uav-cells > div { display: contents; }
.uav-cells i { grid-area: var(--uav-cy) / var(--uav-cx); background: var(--uav-paint); border-radius: ${token('border-radius-cell')}; }
.uav-cells [data-active] { z-index: 1; }
.uav-ramp { grid-area: ramp; display: flex; align-items: center; gap: 1px; block-size: 24px; overflow: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }
.uav-ramp i { flex: none; inline-size: 14px; block-size: 10px; border-radius: ${token('border-radius-cell')}; background: var(--uav-paint); }
.uav-ramp span { color: var(--uav-paint); margin-inline: 5px; }
.uav-ramp span:first-child { margin-inline-start: 0; }
.uav-ramp [data-key="ramp:none"] { margin-inline-start: 5px; }
/* Zero is said beside its own swatch, the neutral one, which stands a little clear of the arm before it. */
.uav-ramp i:has(+ [data-key="ramp:zero"]) { margin-inline-start: 4px; }`;

/** Where a key moves to in a grid `nx` cells across and `ny` down, from `at` (null when none is chosen): left and
 * right along x, up and down along y, stopping at the edges. From nothing, any arrow is the first cell. Null when
 * the key is not a step. */
export function stepCell(key: string, at: [x: number, y: number] | null, nx: number, ny: number): [x: number, y: number] | null {
  const d = ({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as Record<string, [number, number]>)[key];
  if (!d || !nx || !ny) return null;
  return at ? [Math.min(Math.max(at[0] + d[0], 0), nx - 1), Math.min(Math.max(at[1] + d[1], 0), ny - 1)] : [0, 0];
}

/* What the listeners read. They are bound once to the grid, which outlives every paint, and this is set by each. */
interface Grid { nx: number; ny: number; rows: Map<string, Row>; fresh: boolean }
const grids = new WeakMap<HTMLElement, Grid>();
const id = (x: number, y: number) => 'cell-' + x + '-' + y;

/** Choose a cell, or none, and say how: by the keys or by the pointer, as keys.ts does. The readout is the cell's own
 * name, and is the view's one readout, shown and placed as keys.ts shows it. */
function choose(cells: HTMLElement, el: HTMLElement | null, how: 'keys' | 'pointer' = 'pointer'): void {
  cells.querySelector('[data-active]')?.removeAttribute('data-active');
  el?.setAttribute('data-active', how);
  attr(cells, 'aria-activedescendant', el?.id);
  const fig = cells.closest<HTMLElement>('.uav')!, tip = readoutOf(fig);
  if (!el) { hideReadout(tip); return; }
  tip.textContent = el.getAttribute('aria-label');
  placeReadout(tip, fig, el);
}

function bind(cells: HTMLElement): void {
  const cell = (e: Event) => (e.target as Element).closest?.<HTMLElement>('[role="gridcell"]:not([data-exit])') ?? null;
  const activate = (el: HTMLElement) => {
    const row = grids.get(cells)!.rows.get(el.id);
    if (row) (cells.getRootNode() as ShadowRoot).host.dispatchEvent(new CustomEvent('ua-activate', { bubbles: true, composed: true, detail: { row } }));
  };
  cells.addEventListener('pointerover', (e) => {
    const el = cell(e);
    if (!el) return;
    // A touch that has only just chosen a cell shows its readout. The next one activates it.
    grids.get(cells)!.fresh = e.pointerType !== 'mouse' && !el.hasAttribute('data-active');
    choose(cells, el);
  });
  cells.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') choose(cells, null); });
  cells.addEventListener('focusout', () => choose(cells, null));
  cells.addEventListener('click', (e) => {
    const el = cell(e), g = grids.get(cells)!;
    if (!el?.hasAttribute('data-active')) return;
    if (g.fresh) g.fresh = false; else activate(el);
  });
  cells.addEventListener('keydown', (e) => {
    const g = grids.get(cells)!, on = cells.querySelector<HTMLElement>('[data-active]');
    // Escape is taken only when a cell is chosen, so the first Escape of a dialog around the view is not swallowed.
    if (e.key === 'Escape') { if (on) { e.preventDefault(); choose(cells, null); } return; }
    if (e.key === 'Enter' || e.key === ' ') { if (on) { e.preventDefault(); activate(on); } return; }
    const to = stepCell(e.key, on ? (on.id.split('-').slice(1).map(Number) as [number, number]) : null, g.nx, g.ny);
    if (!to) return;
    e.preventDefault();
    choose(cells, cells.querySelector<HTMLElement>('#' + id(...to)), 'keys');
  });
}

// The number alone. The body goes whole, so kept axes do not stand with no grid between them.
const alone = { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.uav-body': 'display: none;', '.uav-number': 'align-self: start; margin: 0;' };

export const matrix: LayoutPainter = {
  layout: 'matrix',
  css,
  fit: { marks: alone },

  // Labels that would meet, by their real sizes, along each axis: the ranked go first, in thin()'s order. One a fit rule has hidden has
  // no box and is passed over. Each is placed from its ratio, not read where it stands: a label may be on its way.
  measure(body) {
    const along = (axis: string, at: string, size: 'width' | 'height', gap: number) => {
      const box = body.querySelector<HTMLElement>(axis);
      if (!box) return;
      const all = Array.from(box.querySelectorAll<HTMLElement>(':scope > span:not([data-exit])')).filter((el) => el.getClientRects().length), room = box.getBoundingClientRect()[size];
      const spans = all.map((el) => {
        // A label stands about its ratio, or from it or up to it where it is anchored at an end.
        const s = el.getBoundingClientRect()[size], lo = Number(el.style.getPropertyValue(at)) * room - s * ({ start: 0, end: 1 }[el.dataset.anchor ?? ''] ?? 0.5);
        return { lo, hi: lo + s, rank: Number(el.dataset.rank) || 0 };
      });
      // A label that would run past the far edge goes before the rest are thinned: whatever holds a view may clip there.
      const fits = spans.map((s) => s.hi <= room + 1), gone = thin(spans.filter((_, i) => fits[i]), gap);
      all.forEach((el, i) => el.toggleAttribute('data-thin', !fits[i] || gone[fits.slice(0, i).filter(Boolean).length]));
    };
    along('.uav-x-axis', '--uav-x', 'width', 6);
    along('.uav-y-axis', '--uav-t', 'height', 0);
  },

  paint(body, scene, _rules, data) {
    const xs = scene.rows ?? [], ys = scene.ys ?? [], { x: xf, y: yf, color: m } = data.layers[0]!.encode as Record<string, string>;
    const yAxis = ensure(body, 'div', 'uav-y-axis'), plot = ensure(body, 'div', 'uav-plot'), xAxis = ensure(body, 'div', 'uav-x-axis'), ramp = ensure(body, 'div', 'uav-ramp');
    const cells = ensure(plot, 'div', 'uav-cells'), dims = data.catalog.dimensions;
    // The labels and the ramp say again what each cell's name says whole.
    for (const el of [yAxis, xAxis, ramp]) el.setAttribute('aria-hidden', 'true');
    pageWay(ramp, body);
    const texts = (part: string) => scene.nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text');
    keyed(yAxis, texts('y-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--uav-t', n.t); });
    keyed(xAxis, texts('x-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--uav-x', n.x); el.setAttribute('data-anchor', n.anchor); });
    keyed(ramp, scene.nodes.filter((n) => n.part === 'ramp'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); });

    if (!grids.has(cells)) bind(cells);
    const at = new Map(data.result.rows.map((r) => [(xf ? r[xf] : '') + '\n' + (yf ? r[yf] : ''), r])), rows = new Map<string, Row>();
    grids.set(cells, { nx: xs.length, ny: ys.length, rows, fresh: false });
    prop(cells, '--uav-nx', xs.length); prop(cells, '--uav-ny', ys.length);
    attr(cells, 'role', 'grid'); attr(cells, 'tabindex', xs.length && ys.length ? 0 : null);
    attr(cells, 'aria-label', [yf, xf].filter(Boolean).map((f) => dims[f!]!.label).join(' by '));
    // One row is as tall as a cell and no taller: the stylesheet gives a strip its own height.
    body.toggleAttribute('data-strip', !yf);
    const by = new Map<string, RectNode[]>();
    for (const n of scene.nodes) if (n.part === 'plot' && n.kind === 'rect' && n.pair) by.set(n.pair[1], (by.get(n.pair[1]) ?? []).concat(n));
    // A row of the grid has no node in the scene, so it is keyed here by its dimension value. It takes no box of its own.
    const line = (y: string): RectNode => ({ key: 'row:' + y, part: 'plot', kind: 'rect', paint: 'ink', layer: 'data' });
    keyed(cells, ys.map(line), () => 'div', (el, r) => {
      attr(el, 'role', 'row');
      keyed(el, by.get(r.key.slice(4)) ?? [], () => 'i', (c, n) => {
        const [x, y] = n.pair!, cx = xs.indexOf(x), cy = ys.indexOf(y), row = at.get(x + '\n' + y);
        prop(c, '--uav-cx', cx + 1); prop(c, '--uav-cy', cy + 1);
        attr(c, 'role', 'gridcell'); attr(c, 'id', id(cx, cy));
        // Never colour alone: the value is in the cell's name, which is also its readout. No value says so in words.
        attr(c, 'aria-label', row && row[m!] != null ? readout(row, data.query, data.catalog, data.layers)
          : (data.query.by || []).map((d) => formatDimension(d === xf ? x : y, dims[d]!)).join(', ') + ': No data');
        if (row) rows.set(c.id, row);
      });
    });
    // ponytail: a chosen cell is let go on every paint, where keys.ts keeps a point that is still there.
    choose(cells, null);
  },

  // The same query pivoted: a row for each value on y, a column for each on x, and the engine's totals at the edges.
  // ponytail: the cells' metric alone. A second metric or a comparison has no place in a pivot of one value yet.
  table(table, title, scene, { layers, result, catalog }) {
    const { x: xf, y: yf, color: m } = layers[0]!.encode as Record<string, string>, M = catalog.metrics[m!]!;
    const at = new Map(result.rows.map((r) => [(xf ? r[xf] : '') + '\n' + (yf ? r[yf] : ''), r[m!]]));
    const value = (v: Row[string]) => formatValue(v as number | null, M, 'exact');
    const total = (f: string, k: string) => value(result.totalsBy?.[f]?.find((r) => r[f] === k)?.[m!]);
    const cell = (tr: HTMLTableRowElement, s: string, scope?: 'col' | 'row', num = !scope) => {
      const c = tr.appendChild(document.createElement(scope ? 'th' : 'td'));
      c.textContent = s; if (scope) c.scope = scope; if (num) c.setAttribute('data-num', '');
    };
    table.replaceChildren();
    if (title) table.createCaption().textContent = title;
    const head = table.createTHead().insertRow(), body = table.createTBody(), xs = scene.rows ?? [];
    const foot = table.createTFoot().insertRow();
    cell(foot, 'Total', 'row');
    // A strip is a list: its one dimension down the side, and the metric's own column, with no total beside it to repeat it.
    if (!xf || !yf) {
      const f = (yf || xf)!;
      cell(head, catalog.dimensions[f]!.label, 'col'); cell(head, M.label, 'col', true);
      for (const k of (yf ? scene.ys : xs) ?? []) { const tr = body.insertRow(); cell(tr, formatDimension(k, catalog.dimensions[f]!), 'row'); cell(tr, value(at.get(yf ? '\n' + k : k + '\n'))); }
      cell(foot, value(result.totals[m!]));
      return;
    }
    cell(head, catalog.dimensions[yf]!.label, 'col');
    for (const x of xs) cell(head, formatDimension(x, catalog.dimensions[xf]!), 'col', true);
    cell(head, 'Total', 'col', true);
    // A quantity down the side is drawn from the foot, as a plot is, and listed from its least, as a table is.
    for (const y of catalog.dimensions[yf]!.type === 'number' ? (scene.ys ?? []).slice().reverse() : scene.ys ?? []) {
      const tr = body.insertRow();
      cell(tr, formatDimension(y, catalog.dimensions[yf]!), 'row');
      for (const x of xs) cell(tr, value(at.get(x + '\n' + y)));
      cell(tr, total(yf, y));
    }
    for (const x of xs) cell(foot, total(xf, x));
    cell(foot, value(result.totals[m!]));
  },
};
