import { SIZES, SIZE_KEY_BLOCK, type CircleNode, type RectNode, type Row } from '@unified-analytics/core';
import { attr, ensure, keyed, nodePaint, prop } from '../dom.ts';
import { token } from '../tokens.ts';
import { chooseItem, dimName, readout, roveItems } from '../keys.ts';
import { emptyTable, fieldLabel, tableRow, valueText, type Cell } from '../table.ts';
import { ARROWS } from '../rove.ts';
import { AXES_HEIGHT, NUMBER_ALONE, type LayoutPainter } from '../layout.ts';
import { paintAxes, thinAxis } from '../chrome/axes.ts';
import { paintRamp } from '../chrome/ramp.ts';
import { paintSize } from '../chrome/size.ts';
import { DOT, NO_SIZE } from '../chrome/swatch.ts';

/* A dimension on x, another on y, a metric on colour: a grid of cells. The cells are a CSS grid, each set in its
 * track by two custom properties, so nothing here runs on resize. The axes are a plot's (chrome/axes.ts): the row labels are a
 * column sized by the widest, the column labels a row under the grid. The part that holds the cells is placed by the
 * stylesheet cartesian.ts wrote for `.uav-plot`. Below them, the ramp (chrome/ramp.ts).
 *
 * A `dot` layer is drawn in the cell's own element, so a pair is one hit target whichever marks it has: alone, the
 * element has no fill and the dot is all there is; over a cell, it is the cell with the dot on it. Under the ramp,
 * the key to sizes a plot of points has (chrome/size.ts), in the same steps.
 *
 * A cell is its own hit target, and no cell carries `data-row`, so the element's keyboard (keys.ts) leaves this
 * layout alone and the one here stands in for it. It is version 4's model, taken to two dimensions: one tab stop,
 * nothing chosen on focus, left and right along x and up and down along y, stopping at the edges, Enter or Space to
 * activate, Escape to let go. To assistive technology it is a grid of rows of cells, each named by its readout.
 * ponytail: version 4 has no model for two dimensions, so this one is a proposal (chart-coverage-plan, section 6). */
const css = `
.uav[data-layout="matrix"] { --uav-body-block: ${AXES_HEIGHT}; }
/* The frame is set from the left whichever way the page reads, as a plot's is (cartesian.ts): the row labels stay on
 * the left of the cells. The ramp is a legend, and follows the page. */
.uav[data-layout="matrix"] .uav-body { display: grid; grid-template: "y plot" minmax(0, 1fr) ". x" auto "ramp ramp" auto "size size" auto / auto minmax(0, 1fr); direction: ltr; }
.uav[data-layout="matrix"][data-parts~="size"] { --uav-body-block: calc(${AXES_HEIGHT} + ${SIZE_KEY_BLOCK}px); }
.uav[data-layout="matrix"] .uav-y-axis { grid-area: y; }
.uav[data-layout="matrix"] .uav-x-axis { grid-area: x; }
.uav[data-layout="matrix"] .uav-size { grid-area: size; }
/* One row of cells is 34 px tall and no taller, with its labels and its ramp under it. Handed a box, it fills it. */
.uav[data-layout="matrix"]:has(> .uav-body[data-strip]) { --uav-body-block: auto; }
.uav[data-layout="matrix"] .uav-body[data-strip] { grid-template-rows: minmax(34px, 1fr) auto auto auto; }
.uav-cells { position: absolute; inset: 0; container-type: size; display: grid; gap: 1px; grid-template: repeat(var(--uav-ny), minmax(0, 1fr)) / repeat(var(--uav-nx), minmax(0, 1fr)); }
.uav-cells > div { display: contents; }
.uav-cells i { grid-area: var(--uav-cy) / var(--uav-cx); background: var(--uav-paint); border-radius: ${token('border-radius-cell')}; }
/* A dot is a plot's dot, in a plot's steps, and no wider than its cell: where the cells are small each step is its share of one. */
.uav-cells i[data-dot] { display: grid; place-items: center; }
.uav-cells i[data-dot="alone"] { background: none; --uav-dot: var(--uav-paint); }
.uav-cells i[data-dot]::before { content: ""; border-radius: 50%; background: var(--uav-dot);
  inline-size: min(${DOT}, (min(100cqw / var(--uav-nx), 100cqh / var(--uav-ny)) - 1px) * var(--uav-size, ${NO_SIZE}) / ${SIZES}); aspect-ratio: 1; }
.uav-cells [data-active] { z-index: 1; }
.uav[data-layout="matrix"] .uav-ramp { grid-area: ramp; }`;

/** Where a key moves to in a grid `nx` cells across and `ny` down, from `at` (null when none is chosen): left and
 * right along x, up and down along y, stopping at the edges. From nothing, any arrow is the first cell. Null when
 * the key is not a step. */
export function stepCell(key: string, at: [x: number, y: number] | null, nx: number, ny: number): [x: number, y: number] | null {
  const d = ARROWS[key];
  if (!d || !nx || !ny) return null;
  return at ? [Math.min(Math.max(at[0] + d[0], 0), nx - 1), Math.min(Math.max(at[1] + d[1], 0), ny - 1)] : [0, 0];
}

/* What the listeners read. They are bound once to the grid, which outlives every paint, and this is set by each. */
interface Grid { nx: number; ny: number; rows: Map<string, Row> }
const grids = new WeakMap<HTMLElement, Grid>();
const id = (x: number, y: number) => 'cell-' + x + '-' + y;

/* The interaction is the one every holder has (rove.ts, roveItems in keys.ts). A cell's is the step from its place. */
function bind(cells: HTMLElement): void {
  roveItems(cells, '[role="gridcell"]:not([data-exit])', (e, on) => {
    const g = grids.get(cells)!, to = stepCell(e.key, on ? (on.id.split('-').slice(1).map(Number) as [number, number]) : null, g.nx, g.ny);
    if (to) e.preventDefault();
    return to && cells.querySelector<HTMLElement>('#' + id(...to));
  }, (el) => { const row = grids.get(cells)!.rows.get(el.id); return row && { row }; });
}

export const matrix: LayoutPainter = {
  layout: 'matrix',
  css,
  // The number alone. The body goes whole, so kept axes do not stand with no grid between them.
  fit: { marks: NUMBER_ALONE },

  // Labels that would meet, by their real sizes, along each axis (chrome/axes.ts). A grid's are not anchored to stay inside
  // it, so one that would run past the far edge goes first, and down the side they may stand line on line.
  measure(body) {
    thinAxis(body, 'x', { inside: true });
    thinAxis(body, 'y', { gap: 0, inside: true });
  },

  paint(body, scene, _rules, data) {
    const xs = scene.rows ?? [], ys = scene.ys ?? [], { x: xf, y: yf } = data.layers[0]!.encode as Record<string, string>;
    const plot = paintAxes(body, scene);
    paintRamp(body, scene); paintSize(body, scene);
    const cells = ensure(plot, 'div', 'uav-cells'), dims = data.catalog.dimensions;

    if (!grids.has(cells)) bind(cells);
    const at = new Map(data.result.rows.map((r) => [(xf ? r[xf] : '') + '\n' + (yf ? r[yf] : ''), r])), rows = new Map<string, Row>();
    grids.set(cells, { nx: xs.length, ny: ys.length, rows });
    prop(cells, '--uav-nx', xs.length); prop(cells, '--uav-ny', ys.length);
    attr(cells, 'role', 'grid'); attr(cells, 'tabindex', xs.length && ys.length ? 0 : null);
    attr(cells, 'aria-label', [yf, xf].filter(Boolean).map((f) => dims[f!]!.label).join(' by '));
    // One row is as tall as a cell and no taller: the stylesheet gives a strip its own height.
    body.toggleAttribute('data-strip', !yf);
    // A pair is one element: its cell, with its dot on it where it has one, or its dot alone where no cell is drawn.
    const marks = scene.nodes.filter((n): n is RectNode | CircleNode => n.part === 'plot' && (n.kind === 'rect' || n.kind === 'circle') && !!n.pair);
    const dots = new Map(marks.filter((n) => n.kind === 'circle').map((n) => [n.pair!.join('\n'), n as CircleNode])), filled = marks.some((n) => n.kind === 'rect');
    const by = new Map<string, (RectNode | CircleNode)[]>();
    for (const n of marks) if ((n.kind === 'rect') === filled) by.set(n.pair![1], (by.get(n.pair![1]) ?? []).concat(n));
    // A row of the grid has no node in the scene, so it is keyed here by its dimension value. It takes no box of its own.
    const line = (y: string): RectNode => ({ key: 'row:' + y, part: 'plot', kind: 'rect', paint: 'ink', layer: 'data' });
    keyed(cells, ys.map(line), () => 'div', (el, r) => {
      attr(el, 'role', 'row');
      keyed(el, by.get(r.key.slice(4)) ?? [], () => 'i', (c, n) => {
        const [x, y] = n.pair!, cx = xs.indexOf(x), cy = ys.indexOf(y), row = at.get(x + '\n' + y), dot = dots.get(x + '\n' + y);
        prop(c, '--uav-cx', cx + 1); prop(c, '--uav-cy', cy + 1);
        attr(c, 'data-dot', dot ? (dot === n ? 'alone' : 'over') : null); prop(c, '--uav-size', dot?.size); prop(c, '--uav-dot', dot && dot !== n ? nodePaint(dot) : null);
        attr(c, 'role', 'gridcell'); attr(c, 'id', id(cx, cy));
        // Never colour alone: the value is in the cell's name, which is also its readout. No value says so in words.
        attr(c, 'aria-label', readout(row ?? Object.fromEntries((data.query.by || []).map((d) => [d, d === xf ? x : y])), data.query, data.catalog, data.layers));
        if (row) rows.set(c.id, row);
      });
    });
    // ponytail: a chosen cell is let go on every paint, where keys.ts keeps a point that is still there.
    chooseItem(cells, null);
  },

  // The same query pivoted: a row for each value on y, a column for each on x, and the engine's totals at the edges.
  // ponytail: the cells' metric alone. A second metric or a comparison has no place in a pivot of one value yet.
  table(table, title, scene, { layers, result, catalog }) {
    // ponytail: the first layer's metric, on color or else on size. Dots over cells of another metric are in the readout and not in the pivot.
    // Not pivot() (table.ts): the grid's columns are the scene's, in its order, and named as its axis names them.
    const { x: xf, y: yf, color, size } = layers[0]!.encode as Record<string, string>, m = (color ?? size)!;
    const at = new Map(result.rows.map((r) => [(xf ? r[xf] : '') + '\n' + (yf ? r[yf] : ''), r[m]]));
    const value = (v: Row[string] | undefined): Cell => [valueText(v, m, catalog), 'td', true];
    // A value is a key here, and so a string: a bin's start is a number in the result. A bin is named by both its ends.
    const of = (f: string, k: string) => (result.totalsBy?.[f] ?? result.rows).find((r) => String(r[f]) === k);
    const total = (f: string, k: string) => value(result.totalsBy?.[f]?.find((r) => String(r[f]) === k)?.[m]);
    const name = (f: string, k: string) => dimName({ ...of(f, k), [f]: k }, f, catalog), xs = scene.rows ?? [];
    emptyTable(table, title);
    const head = table.createTHead(), body = table.createTBody(), foot = table.createTFoot();
    // A strip is a list: its one dimension down the side, and the metric's own column, with no total beside it to repeat it.
    if (!xf || !yf) {
      const f = (yf || xf)!;
      tableRow(head, [[catalog.dimensions[f]!.label, 'th'], [fieldLabel(m, catalog), 'th', true]]);
      for (const k of (yf ? scene.ys : xs) ?? []) tableRow(body, [[name(f, k), 'th'], value(at.get(yf ? '\n' + k : k + '\n'))]);
      tableRow(foot, [['Total', 'th'], value(result.totals[m])]);
      return;
    }
    tableRow(head, [[catalog.dimensions[yf]!.label, 'th'], ...xs.map((x): Cell => [name(xf, x), 'th', true]), ['Total', 'th', true]]);
    // A quantity down the side is drawn from the foot, as a plot is, and listed from its least, as a table is.
    for (const y of catalog.dimensions[yf]!.type === 'number' ? (scene.ys ?? []).slice().reverse() : scene.ys ?? []) {
      tableRow(body, [[name(yf, y), 'th'], ...xs.map((x) => value(at.get(x + '\n' + y))), total(yf, y)]);
    }
    tableRow(foot, [['Total', 'th'], ...xs.map((x) => total(xf, x)), value(result.totals[m])]);
  },
};
