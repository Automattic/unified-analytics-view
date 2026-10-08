import { COLUMNS_BLOCK, columnRooms, type RowNode, type SceneNode, type TextNode } from '@universal-analytics/core';
import { attr, ensure, keyed, prop, text } from '../dom.ts';
import { NUMBER_ALONE, type LayoutPainter } from '../layout.ts';
import { TRACK_CSS, TRACK_FIT, trackMark } from './track.ts';

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
.vg-row > i { position: absolute; grid-column: var(--vg-track, 1 / 3); inset-block: 0; inset-inline-start: calc(var(--vg-x, 0) * 100%); inline-size: max(3px, calc(var(--vg-v) * 100%));
  background: var(--vg-paint); border-radius: var(--a8c-charts-border-radius-bar, 3px); }
:is(.vg-row, .vg-columns) > span { position: relative; grid-row: 1; padding-inline: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--vg-paint); }
.vg-row > .vg-f-label { grid-column: var(--vg-col, 1); padding-inline-end: 0; }
:is(.vg-row, .vg-columns) > span:not(.vg-f-label) { grid-column: var(--vg-col); }
:is(.vg-row, .vg-columns) > [data-anchor="end"] { text-align: end; }
:is(.vg-row, .vg-columns) > [data-rank] { max-inline-size: max(0px, ${short}); padding-inline: min(8px, max(0px, ${short})); }
@container vg-view (block-size >= 0px) {
  .vg-rows { max-block-size: calc(round(down, 100% + var(--vg-row-gap), var(--vg-row-block) + var(--vg-row-gap)) - var(--vg-row-gap)); }
}`;

export const rows: LayoutPainter = {
  layout: 'rows',
  css: css + TRACK_CSS,
  // The number alone. The body goes whole, so the gap its grid row would hold goes with it.
  fit: { marks: NUMBER_ALONE, 'marks-block': NUMBER_ALONE, ...TRACK_FIT },
  // The wrap clips whole rows, so a box shorter than one row shows none, and with no number above it shows nothing at
  // all. Under a row's height the list goes and the number stands in, as it does under the width the `marks` rule needs.
  // ponytail: core's `marks` rule for rows has no block need, so this asks the view, as the band's does. Right while
  // the list has the view's whole height, which is where it matters: a number above the list already stands alone.
  rules: (context) => [{ id: 'marks-block', layout: 'rows', container: 'view', needs: { block: context.rows.rowHeight }, hide: ['rows'], show: ['number'], keep: 'marks' }],

  paint(body, scene, rules) {
    const head = ensure(body, 'div', 'vg-columns'), list = ensure(body, 'div', 'vg-rows'), by = new Map<string, SceneNode[]>();
    const beside = scene.track === 'beside', room = (id: string) => rules.fit.find((r) => r.layout === 'rows' && r.id === id)?.needs.inline;
    const rooms = columnRooms(scene), label = (beside ? room('track') : undefined) ?? room('marks') ?? 0;
    // A row's labels stand side by side in the order they come, each before the last in a column as wide as its text.
    // Beside its label the track is a column too. `first` is the column of the first value.
    const col = new Map<string, number>(), count = new Map<string, number>();
    for (const n of scene.nodes) if (n.part === 'rows' && n.kind === 'text' && n.font === 'label') { col.set(n.key, (count.get(n.row!) ?? 0) + 1); count.set(n.row!, col.get(n.key)!); }
    const lead = Math.max(1, ...count.values()) - 1, first = lead + (beside ? 3 : 2);
    // The room a view needs to show the column of this rank: the label's, by the `marks` rule, and each column's up to it.
    const need = (rank?: number) => (rank ? label + rooms.slice(0, rank + 1).reduce((s, w) => s + w, 0) + 'px' : null);
    list.setAttribute('data-hits', 'y');                                     // each row is its own hit target
    prop(body, '--vg-tracks', 'auto '.repeat(lead) + (beside ? 'minmax(0, auto) ' : '') + 'minmax(0, 1fr)' + ' auto'.repeat(rooms.length));
    prop(body, '--vg-track', beside ? first - 1 + ' / ' + first : lead ? '1 / ' + (first + 1) : null); attr(body, 'data-track', scene.track);
    prop(body, '--vg-row-block', rules.rows.rowHeight + 'px'); prop(body, '--vg-row-gap', rules.rows.gap + 'px'); prop(body, '--vg-columns-block', COLUMNS_BLOCK + 'px');
    // A column's cell says which track is its own, so one that is given up leaves the others where they are.
    const cell = (c: HTMLElement | SVGElement, n: TextNode) => {
      text(c, n); c.setAttribute('data-anchor', n.anchor);
      if (n.font !== 'label') { prop(c, '--vg-col', (n.rank || 0) + first); prop(c, '--vg-need', need(n.rank)); }
      else prop(c, '--vg-col', lead ? col.get(n.key) : null);
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
        else if (n.kind === 'line' || n.kind === 'circle') trackMark(c, n);
      });
    });
  },
};
