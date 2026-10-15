import { COLUMNS_BLOCK, columnRooms, type RowNode, type Scene, type SceneNode, type TextNode } from '@unified-analytics/core';
import { paintLegend } from '../chrome/legend.ts';
import { attr, ensure, keyed, prop, text } from '../dom.ts';
import { token } from '../tokens.ts';
import { IN_BOX, NUMBER_ALONE, type LayoutPainter } from '../layout.ts';
import { TRACK_CSS, TRACK_FIT, trackMark } from './track.ts';
import { paintUnitKey } from '../chrome/unit.ts';

/* A dimension on y: a row for each of its values. The body is one grid, with a track for the label, which gives way,
 * and one for each column of values, sized by its content. The headers and every row are subgrids of it, so a column
 * lines up down the list and nothing here sets a width. The bar lies in the row's own track: behind the label and
 * the first column, and short of the ranked columns beyond it.
 *
 * A ranked column is given up when the view is narrower than the label's room and every column's up to it. That
 * need is the one resolve() measures, in characters, written on the cell, and a clamp on the cell's width answers
 * it: a container query cannot hold a number that depends on the data. Only the need is estimated, never a width.
 *
 * Under a height limit only whole rows show: the list is as tall as the rows that fit, rounded down.
 *
 * A row divided into series has their key under the rows, in a grid row of its own: a swatch and a name for each, in a
 * line that wraps, as a split plot's is (chrome/legend.ts), or the one line that names the series with the most, in its colour. The plan
 * names the first, and a fit rule swaps them. Either comes out of the rows' room in a box. */
/** A cell's padding at each side, in px. A column's room as read here is its text and both: what it takes on the page, where
 * core's columnRooms() estimates 14 for it from no face. */
const PAD = 8;
const short = '(100cqi - var(--uav-need) + 0.01px) * 999999';

/** The room each column takes, as core reckons it (columnRooms), at the width a character has in this view. Core's is
 * for the faces a view has with no tokens, and a page's may be wider, as a pixel face is: a column that is kept past
 * the room it really takes leaves the label none. Where a width cannot be read, core's stands. It is read in the measured
 * pass, once every view queued with this one has painted: read as it paints, a page of lists was laid out once for each. */
function roomsHere(body: HTMLElement, scene: Scene): number[] {
  // Both faces are put in before either is read, so the page is laid out once for the two.
  const probes = ['tick', 'value'].map((face) => {
    const probe = body.appendChild(document.createElement('span'));
    probe.className = 'uav-f-' + face; probe.textContent = '0'.repeat(10);
    probe.style.position = 'absolute'; probe.style.visibility = 'hidden'; probe.style.whiteSpace = 'nowrap';
    return probe;
  });
  const [tick, value] = probes.map((probe) => probe.getBoundingClientRect().width / 10), room: number[] = [];
  for (const probe of probes) probe.remove();
  if (!tick || !value) return columnRooms(scene);
  for (const n of scene.nodes) {
    if (n.kind !== 'text' || !((n.part === 'columns' && n.anchor !== 'start') || (n.part === 'rows' && n.font === 'value'))) continue;
    const i = n.rank || 0;
    room[i] = Math.max(room[i] || 0, Math.ceil(n.text.length * (n.part === 'columns' ? tick : value)) + 2 * PAD);
  }
  return room;
}
const css = `
.uav[data-layout="rows"] .uav-body { display: grid; grid-template: auto minmax(0, 1fr) / var(--uav-tracks, minmax(0, 1fr)); }
.uav-columns, .uav-rows, .uav-row { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; }
.uav-columns { grid-row: 1; align-items: center; block-size: var(--uav-columns-block); max-block-size: max(0px, ${short}); overflow: hidden; }
.uav[data-layout="rows"]:not([data-parts~="columns"]) .uav-columns { display: none; }
.uav-rows { position: relative; grid-row: 2; align-content: start; row-gap: var(--uav-row-gap); overflow: hidden; }
.uav-row { position: relative; align-items: center; block-size: var(--uav-row-block); }
.uav-row > i { position: absolute; grid-column: var(--uav-track, 1 / 3); inset-block: 0; inset-inline-start: calc(var(--uav-x, 0) * 100%); inline-size: max(3px, calc(var(--uav-v) * 100%));
  background: var(--uav-paint); border-radius: ${token('border-radius-bar', '3px')}; }
:is(.uav-row, .uav-columns) > span { position: relative; grid-row: 1; padding-inline: ${PAD}px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--uav-paint); }
.uav-row > .uav-f-label { grid-column: var(--uav-col, 1); padding-inline-end: 0; }
:is(.uav-row, .uav-columns) > span:not(.uav-f-label) { grid-column: var(--uav-col); }
:is(.uav-row, .uav-columns) > [data-anchor="end"] { text-align: end; }
:is(.uav-row, .uav-columns) > [data-rank] { max-inline-size: max(0px, ${short}); padding-inline: min(${PAD}px, max(0px, ${short})); }
.uav[data-layout="rows"] :is(.uav-legend, .uav-legend-top) { grid-column: 1 / -1; grid-row: 3; }
${IN_BOX} {
  .uav-rows { max-block-size: calc(round(down, 100% + var(--uav-row-gap), var(--uav-row-block) + var(--uav-row-gap)) - var(--uav-row-gap)); }
}`;

/** What the measured pass needs to set each column's room again from the widths it reads: the scene, the label's room,
 * and the cells that hold a room, by the rank of their column. */
const painted = new WeakMap<HTMLElement, { scene: Scene; label: number; cells: [HTMLElement | SVGElement, number | undefined][] }>();
const needOf = (label: number, rooms: number[], rank?: number) => (rank ? label + rooms.slice(0, rank + 1).reduce((s, w) => s + w, 0) + 'px' : null);

export const rows: LayoutPainter = {
  layout: 'rows',
  css: css + TRACK_CSS,
  // The number alone. The body goes whole, so the gap its grid row would hold goes with it.
  // `show` compiles to a block, which the one line of a legend is. The legend it stands in for is a row that wraps.
  fit: { marks: NUMBER_ALONE, 'marks-block': NUMBER_ALONE, ...TRACK_FIT },
  // The wrap clips whole rows, so a box shorter than one row shows none, and with no number above it shows nothing at
  // all. Under a row's height the list goes and the number stands in, as it does under the width the `marks` rule needs.
  // ponytail: core's `marks` rule for rows has no block need, so this asks the view, as the band's does. Right while
  // the list has the view's whole height, which is where it matters: a number above the list already stands alone.
  rules: (context) => [{ id: 'marks-block', layout: 'rows', container: 'view', needs: { block: context.rows.rowHeight }, hide: ['rows'], show: ['number'], keep: 'marks' }],

  paint(body, scene, rules) {
    const head = ensure(body, 'div', 'uav-columns'), list = ensure(body, 'div', 'uav-rows'), by = new Map<string, SceneNode[]>();
    const beside = scene.track === 'beside', room = (id: string) => rules.fit.find((r) => r.layout === 'rows' && r.id === id)?.needs.inline;
    // Core's rooms until the measured pass reads the faces (measure, below).
    const rooms = columnRooms(scene), label = (beside ? room('track') : undefined) ?? room('marks') ?? 0, cells: [HTMLElement | SVGElement, number | undefined][] = [];
    painted.set(body, { scene, label, cells });
    // A row's labels stand side by side in the order they come, each before the last in a column as wide as its text.
    // Beside its label the track is a column too. `first` is the column of the first value.
    const col = new Map<string, number>(), count = new Map<string, number>();
    for (const n of scene.nodes) if (n.part === 'rows' && n.kind === 'text' && n.font === 'label') { col.set(n.key, (count.get(n.row!) ?? 0) + 1); count.set(n.row!, col.get(n.key)!); }
    const lead = Math.max(1, ...count.values()) - 1, first = lead + (beside ? 3 : 2);
    // The room a view needs to show the column of this rank: the label's, by the `marks` rule, and each column's up to it.
    const need = (rank?: number) => needOf(label, rooms, rank);
    list.setAttribute('data-hits', 'y');                                     // each row is its own hit target
    prop(body, '--uav-tracks', 'auto '.repeat(lead) + (beside ? 'minmax(0, auto) ' : '') + 'minmax(0, 1fr)' + ' auto'.repeat(rooms.length));
    prop(body, '--uav-track', beside ? first - 1 + ' / ' + first : lead ? '1 / ' + (first + 1) : null); attr(body, 'data-track', scene.track);
    prop(body, '--uav-row-block', rules.rows.rowHeight + 'px'); prop(body, '--uav-row-gap', rules.rows.gap + 'px'); prop(body, '--uav-columns-block', COLUMNS_BLOCK + 'px');
    // A column's cell says which track is its own, so one that is given up leaves the others where they are.
    const cell = (c: HTMLElement | SVGElement, n: TextNode) => {
      text(c, n); c.setAttribute('data-anchor', n.anchor);
      // The header over the labels stands in their column, the first, and is never given up for room.
      if (n.part === 'columns' && n.anchor === 'start') prop(c, '--uav-col', 1);
      else if (n.font !== 'label') { prop(c, '--uav-col', (n.rank || 0) + first); prop(c, '--uav-need', need(n.rank)); cells.push([c, n.rank]); }
      else prop(c, '--uav-col', lead ? col.get(n.key) : null);
    };
    // Headers stand over more than one column, so they go with the second.
    prop(head, '--uav-need', need(1)); cells.push([head, 1]);
    keyed(head, scene.nodes.filter((n): n is TextNode => n.part === 'columns' && n.kind === 'text'), () => 'span', cell);
    for (const n of scene.nodes) if (n.part === 'rows' && n.kind !== 'row' && n.row != null) by.set(n.row, (by.get(n.row) ?? []).concat(n));
    keyed(list, scene.nodes.filter((n): n is RowNode => n.kind === 'row'), () => 'div', (el, r) => {
      el.classList.add('uav-row');
      keyed(el, by.get(r.row) ?? [], (n) => (n.kind === 'text' ? 'span' : 'i'), (c, n) => {
        if (n.kind === 'text') cell(c, n);
        // A bar lies from where its track has zero to its value. A part of the range behind the marks is a guide, and says so.
        else if (n.kind === 'rect') { const from = n.v0 ?? 0; prop(c, '--uav-x', Math.min(from, n.v!) || null); prop(c, '--uav-v', Math.abs(n.v! - from)); attr(c, 'data-mark', n.layer === 'guide' ? 'band' : null); }
        else if (n.kind === 'line' || n.kind === 'circle') trackMark(c, n);
      });
    });
    paintUnitKey(body, scene);
    // The key to a divided row's series, and the one line that stands in for it.
    paintLegend(body, scene);
  },

  // The columns' rooms at the width a character has here. The tracks stay as painted: they count the columns, and
  // the faces change no count.
  measure(body) {
    const p = painted.get(body);
    if (!p) return;
    const rooms = roomsHere(body, p.scene);
    for (const [el, rank] of p.cells) prop(el, '--uav-need', needOf(p.label, rooms, rank));
  },
};
