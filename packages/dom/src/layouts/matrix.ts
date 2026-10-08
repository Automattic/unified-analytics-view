import { formatDimension, formatValue, type RectNode, type Row, type TextNode } from '@universal-analytics/core';
import { attr, ensure, keyed, paintVar, prop, text } from '../dom.ts';
import { readout } from '../keys.ts';
import type { LayoutPainter } from '../layout.ts';
import { thin } from '../measure.ts';

/* A dimension on x, another on y, a metric on colour: a grid of cells. The cells are a CSS grid, each set in its
 * track by two custom properties, so nothing here runs on resize. The axes are the plot's own: the row labels are a
 * column sized by the widest, the column labels a row under the grid, and both are placed by the stylesheet
 * cartesian.ts wrote for `.vg-y-axis`, `.vg-x-axis` and `.vg-plot`. Below them, the ramp.
 *
 * A cell is its own hit target, and no cell carries `data-row`, so the element's keyboard (keys.ts) leaves this
 * layout alone and the one here stands in for it. It is version 4's model, taken to two dimensions: one tab stop,
 * nothing chosen on focus, left and right along x and up and down along y, stopping at the edges, Enter or Space to
 * activate, Escape to let go. To assistive technology it is a grid of rows of cells, each named by its readout.
 * ponytail: version 4 has no model for two dimensions, so this one is a proposal (chart-coverage-plan, section 6). */
const css = `
.vg[data-layout="matrix"] { --vg-body-block: var(--vg-axes-height, 184px); }
.vg[data-layout="matrix"] .vg-body { display: grid; grid-template: "y plot" minmax(0, 1fr) ". x" auto "ramp ramp" auto / auto minmax(0, 1fr); }
.vg[data-layout="matrix"] [data-thin] { visibility: hidden; }
.vg-cells { position: absolute; inset: 0; display: grid; gap: 1px; grid-template: repeat(var(--vg-ny), minmax(0, 1fr)) / repeat(var(--vg-nx), minmax(0, 1fr)); }
.vg-cells:focus-visible { outline-offset: 2px; }
.vg-cells > div { display: contents; }
.vg-cells i { grid-area: var(--vg-cy) / var(--vg-cx); background: var(--vg-paint); border-radius: 1px; }
.vg-cells [data-active] { z-index: 1; outline: 2px solid ${paintVar('ink')}; outline-offset: 1px; }
.vg-ramp { grid-area: ramp; display: flex; align-items: center; gap: 1px; block-size: 24px; overflow: hidden; white-space: nowrap; font-variant-numeric: tabular-nums; }
.vg-ramp i { flex: none; inline-size: 14px; block-size: 10px; border-radius: 1px; background: var(--vg-paint); }
.vg-ramp span { color: var(--vg-paint); margin-inline: 5px; }
.vg-ramp span:first-child { margin-inline-start: 0; }
.vg-ramp [data-key="ramp:none"] { margin-inline-start: 5px; }`;

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

/** Choose a cell, or none. The readout is the cell's own name, set by it and always inside the view, as keys.ts sets one.
 * ponytail: its placing is keys.ts's, written again, since that one is private to its class. One function when the two meet. */
function choose(cells: HTMLElement, el: HTMLElement | null): void {
  cells.querySelector('[data-active]')?.removeAttribute('data-active');
  el?.setAttribute('data-active', '');
  attr(cells, 'aria-activedescendant', el?.id);
  const fig = cells.closest<HTMLElement>('.vg')!, tip = ensure(fig, 'div', 'vg-readout');
  tip.hidden = !el;
  if (!el) return;
  tip.textContent = el.getAttribute('aria-label');
  const f = fig.getBoundingClientRect(), r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  const above = r.top - f.top - h - 3, below = r.bottom - f.top + 3;
  tip.style.setProperty('left', Math.max(0, Math.min(r.left + r.width / 2 - f.left - w / 2, f.width - w)) + 'px');
  tip.style.setProperty('top', (above >= 0 ? above : below + h <= f.height ? below : 0) + 'px');
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
    choose(cells, cells.querySelector<HTMLElement>('#' + id(...to)));
  });
}

// The number alone. The body goes whole, so kept axes do not stand with no grid between them.
const alone = { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.vg-body': 'display: none;', '.vg-number': 'margin: 0;' };

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
        const s = el.getBoundingClientRect()[size], lo = Number(el.style.getPropertyValue(at)) * room - s / 2;
        return { lo, hi: lo + s, rank: Number(el.dataset.rank) || 0 };
      });
      // A label that would run past the far edge goes before the rest are thinned: whatever holds a view may clip there.
      const fits = spans.map((s) => s.hi <= room + 1), gone = thin(spans.filter((_, i) => fits[i]), gap);
      all.forEach((el, i) => el.toggleAttribute('data-thin', !fits[i] || gone[fits.slice(0, i).filter(Boolean).length]));
    };
    along('.vg-x-axis', '--vg-x', 'width', 6);
    along('.vg-y-axis', '--vg-t', 'height', 0);
  },

  paint(body, scene, _rules, data) {
    const xs = scene.rows ?? [], ys = scene.ys ?? [], { x: xf, y: yf, color: m } = data.layers[0]!.encode as Record<string, string>;
    const yAxis = ensure(body, 'div', 'vg-y-axis'), plot = ensure(body, 'div', 'vg-plot'), xAxis = ensure(body, 'div', 'vg-x-axis'), ramp = ensure(body, 'div', 'vg-ramp');
    const cells = ensure(plot, 'div', 'vg-cells'), dims = data.catalog.dimensions;
    // The labels and the ramp say again what each cell's name says whole.
    for (const el of [yAxis, xAxis, ramp]) el.setAttribute('aria-hidden', 'true');
    const texts = (part: string) => scene.nodes.filter((n): n is TextNode => n.part === part && n.kind === 'text');
    keyed(yAxis, texts('y-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--vg-t', n.t); });
    keyed(xAxis, texts('x-axis'), () => 'span', (el, n) => { text(el, n); prop(el, '--vg-x', n.x); });
    keyed(ramp, scene.nodes.filter((n) => n.part === 'ramp'), (n) => (n.kind === 'text' ? 'span' : 'i'), (el, n) => { if (n.kind === 'text') text(el, n); });

    if (!grids.has(cells)) bind(cells);
    const at = new Map(data.result.rows.map((r) => [r[xf!] + '\n' + r[yf!], r])), rows = new Map<string, Row>();
    grids.set(cells, { nx: xs.length, ny: ys.length, rows, fresh: false });
    prop(cells, '--vg-nx', xs.length); prop(cells, '--vg-ny', ys.length);
    attr(cells, 'role', 'grid'); attr(cells, 'tabindex', xs.length && ys.length ? 0 : null);
    attr(cells, 'aria-label', dims[yf!]!.label + ' by ' + dims[xf!]!.label);
    const by = new Map<string, RectNode[]>();
    for (const n of scene.nodes) if (n.part === 'plot' && n.kind === 'rect' && n.pair) by.set(n.pair[1], (by.get(n.pair[1]) ?? []).concat(n));
    // A row of the grid has no node in the scene, so it is keyed here by its dimension value. It takes no box of its own.
    const line = (y: string): RectNode => ({ key: 'row:' + y, part: 'plot', kind: 'rect', paint: 'ink', layer: 'data' });
    keyed(cells, ys.map(line), () => 'div', (el, r) => {
      attr(el, 'role', 'row');
      keyed(el, by.get(r.key.slice(4)) ?? [], () => 'i', (c, n) => {
        const [x, y] = n.pair!, cx = xs.indexOf(x), cy = ys.indexOf(y), row = at.get(x + '\n' + y);
        prop(c, '--vg-cx', cx + 1); prop(c, '--vg-cy', cy + 1);
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
    const at = new Map(result.rows.map((r) => [r[xf!] + '\n' + r[yf!], r[m!]]));
    const value = (v: Row[string]) => formatValue(v as number | null, M, 'exact');
    const total = (f: string, k: string) => value(result.totalsBy?.[f]?.find((r) => r[f] === k)?.[m!]);
    const cell = (tr: HTMLTableRowElement, s: string, scope?: 'col' | 'row', num = !scope) => {
      const c = tr.appendChild(document.createElement(scope ? 'th' : 'td'));
      c.textContent = s; if (scope) c.scope = scope; if (num) c.setAttribute('data-num', '');
    };
    table.replaceChildren();
    if (title) table.createCaption().textContent = title;
    const head = table.createTHead().insertRow(), body = table.createTBody(), xs = scene.rows ?? [];
    cell(head, catalog.dimensions[yf!]!.label, 'col');
    for (const x of xs) cell(head, formatDimension(x, catalog.dimensions[xf!]!), 'col', true);
    cell(head, 'Total', 'col', true);
    for (const y of scene.ys ?? []) {
      const tr = body.insertRow();
      cell(tr, formatDimension(y, catalog.dimensions[yf!]!), 'row');
      for (const x of xs) cell(tr, value(at.get(x + '\n' + y)));
      cell(tr, total(yf!, y));
    }
    const foot = table.createTFoot().insertRow();
    cell(foot, 'Total', 'row');
    for (const x of xs) cell(foot, total(xf!, x));
    cell(foot, value(result.totals[m!]));
  },
};
