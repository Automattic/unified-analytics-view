import { COLUMNS_BLOCK, columnRooms, type RowNode, type SceneNode, type TextNode } from '@universal-analytics/core';
import { ensure, keyed, prop, text } from '../dom.ts';
import type { LayoutPainter } from '../layout.ts';

/* A dimension on y: a row for each of its values. The body is one grid, with a track for the label, which gives way,
 * and one for each column of values, sized by its content. The headers and every row are subgrids of it, so a column
 * lines up down the list and nothing here sets a width. The bar lies in the row's own track: behind the label and
 * the first column, and short of the ranked columns beyond it.
 *
 * A ranked column is given up when the view is narrower than the label's room and every column's up to it. That
 * need is the one resolve() measures, in characters, written on the cell, and a clamp on the cell's width answers
 * it: a container query cannot hold a number that depends on the data. Only the need is estimated, never a width.
 *
 * Under a height limit only whole rows show: the list is as tall as the rows that fit, rounded down. */
const short = '(100cqi - var(--vg-need) + 0.01px) * 999999';
const css = `
.vg[data-layout="rows"] .vg-body { display: grid; grid-template: auto minmax(0, 1fr) / var(--vg-tracks, minmax(0, 1fr)); }
.vg-columns, .vg-rows, .vg-row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; }
.vg-columns { grid-row: 1; align-items: center; block-size: var(--vg-columns-block); max-block-size: max(0px, ${short}); overflow: hidden; }
.vg[data-layout="rows"]:not([data-parts~="columns"]) .vg-columns { display: none; }
.vg-rows { grid-row: 2; align-content: start; row-gap: var(--vg-row-gap); overflow: hidden; }
.vg-row { position: relative; align-items: center; block-size: var(--vg-row-block); }
.vg-row > i { position: absolute; grid-column: 1 / 3; inset-block: 0; inset-inline-start: calc(var(--vg-x, 0) * 100%); inline-size: max(3px, calc(var(--vg-v) * 100%));
  background: var(--vg-paint); border-radius: var(--a8c-charts-border-radius-bar, 3px); }
:is(.vg-row, .vg-columns) > span { position: relative; grid-row: 1; padding-inline: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--vg-paint); }
.vg-row > .vg-f-label { grid-column: 1; padding-inline-end: 0; }
:is(.vg-row, .vg-columns) > span:not(.vg-f-label) { grid-column: var(--vg-col); }
:is(.vg-row, .vg-columns) > [data-anchor="end"] { text-align: end; }
:is(.vg-row, .vg-columns) > [data-rank] { max-inline-size: max(0px, ${short}); padding-inline: min(8px, max(0px, ${short})); }
@container view (block-size >= 0px) {
  .vg-rows { max-block-size: calc(round(down, 100% + var(--vg-row-gap), var(--vg-row-block) + var(--vg-row-gap)) - var(--vg-row-gap)); }
}`;

export const rows: LayoutPainter = {
  layout: 'rows',
  css,
  // The number alone. The body goes whole, so the gap its grid row would hold goes with it.
  fit: { marks: { '': 'grid-template: "number" auto / minmax(0, 1fr);', '.vg-body': 'display: none;', '.vg-number': 'margin: 0;' } },

  paint(body, scene, rules) {
    const head = ensure(body, 'div', 'vg-columns'), list = ensure(body, 'div', 'vg-rows'), by = new Map<string, SceneNode[]>();
    const rooms = columnRooms(scene), label = rules.fit.find((r) => r.layout === 'rows' && r.id === 'marks')?.needs.inline ?? 0;
    // The room a view needs to show the column of this rank: the label's, by the `marks` rule, and each column's up to it.
    const need = (rank?: number) => (rank ? label + rooms.slice(0, rank + 1).reduce((s, w) => s + w, 0) + 'px' : null);
    list.setAttribute('data-hits', 'y');                                     // each row is its own hit target
    prop(body, '--vg-tracks', 'minmax(0, 1fr)' + ' auto'.repeat(rooms.length));
    prop(body, '--vg-row-block', rules.rows.rowHeight + 'px'); prop(body, '--vg-row-gap', rules.rows.gap + 'px'); prop(body, '--vg-columns-block', COLUMNS_BLOCK + 'px');
    // A column's cell says which track is its own, so one that is given up leaves the others where they are.
    const cell = (c: HTMLElement | SVGElement, n: TextNode) => {
      text(c, n); c.setAttribute('data-anchor', n.anchor);
      if (n.font !== 'label') { prop(c, '--vg-col', (n.rank || 0) + 2); prop(c, '--vg-need', need(n.rank)); }
    };
    // Headers stand over more than one column, so they go with the second.
    prop(head, '--vg-need', need(1));
    keyed(head, scene.nodes.filter((n): n is TextNode => n.part === 'columns' && n.kind === 'text'), () => 'span', cell);
    for (const n of scene.nodes) if (n.part === 'rows' && n.kind !== 'row' && n.row != null) by.set(n.row, (by.get(n.row) ?? []).concat(n));
    keyed(list, scene.nodes.filter((n): n is RowNode => n.kind === 'row'), () => 'div', (el, r) => {
      el.classList.add('vg-row');
      keyed(el, by.get(r.row) ?? [], (n) => (n.kind === 'text' ? 'span' : 'i'), (c, n) => {
        if (n.kind === 'text') cell(c, n);
        // A bar lies from where its track has zero to its value.
        else if (n.kind === 'rect') { const from = n.v0 ?? 0; prop(c, '--vg-x', Math.min(from, n.v!) || null); prop(c, '--vg-v', Math.abs(n.v! - from)); }
      });
    });
  },
};
