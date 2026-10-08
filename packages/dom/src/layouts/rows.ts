import type { RectNode, SceneNode } from '@universal-analytics/core';
import { ensure, keyed, prop, text } from '../dom.ts';
import { NUMBER_ALONE, type LayoutPainter } from '../layout.ts';

/* A dimension on y, a metric on x: the ranked bar list. Each row is a grid, the label in the track that gives way
 * and the value in one sized by its content, so nothing here estimates a character's width. The bar lies behind them.
 * Under a height limit the list is a wrapping column: a row that does not fit whole wraps into a second column, which
 * is clipped. The empty first item makes that true of the first row too, so a number above the list can stand alone. */
const css = `
.vg[data-layout="rows"] .vg-body { display: grid; grid-template-rows: minmax(0, 1fr); }
.vg-rows { display: flex; flex-flow: column wrap; gap: var(--vg-row-gap); overflow: hidden; }
.vg-rows::before { content: ""; inline-size: 100%; margin-block-end: calc(0px - var(--vg-row-gap)); }
.vg-row { flex: none; position: relative; box-sizing: border-box; inline-size: 100%; block-size: var(--vg-row-block); padding-inline: 8px;
  display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 8px; align-items: center; }
.vg-row > i { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: max(3px, calc(var(--vg-v) * 100%));
  background: var(--vg-paint); border-radius: var(--a8c-charts-border-radius-bar, 3px); }
.vg-row > span { position: relative; grid-row: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--vg-paint); }
.vg-row > [data-anchor="end"] { grid-column: 2; }`;

export const rows: LayoutPainter = {
  layout: 'rows',
  css,
  // The number alone. The body goes whole, so the gap its grid row would hold goes with it.
  fit: { marks: NUMBER_ALONE, 'marks-block': NUMBER_ALONE },
  // The wrap clips whole rows, so a box shorter than one row shows none, and with no number above it shows nothing at
  // all. Under a row's height the list goes and the number stands in, as it does under the width the `marks` rule needs.
  // ponytail: core's `marks` rule for rows has no block need, so this asks the view, as the band's does. Right while
  // the list has the view's whole height, which is where it matters: a number above the list already stands alone.
  rules: (context) => [{ id: 'marks-block', layout: 'rows', container: 'view', needs: { block: context.rows.rowHeight }, hide: ['rows'], show: ['number'], keep: 'marks' }],

  paint(body, scene, rules) {
    const list = ensure(body, 'div', 'vg-rows'), by = new Map<string, SceneNode[]>();
    list.setAttribute('data-hits', 'y');                                     // each row is its own hit target
    prop(list, '--vg-row-block', rules.rows.rowHeight + 'px'); prop(list, '--vg-row-gap', rules.rows.gap + 'px');
    for (const n of scene.nodes) if (n.part === 'rows' && n.row != null) by.set(n.row, (by.get(n.row) ?? []).concat(n));
    // A row has no node in the scene, so it is keyed here by its dimension value.
    const row = (k: string): RectNode => ({ key: 'row:' + k, part: 'rows', kind: 'rect', row: k, paint: 'ink', layer: 'data' });
    keyed(list, (scene.rows ?? []).map(row), () => 'div', (el, r) => {
      el.classList.add('vg-row');
      keyed(el, by.get(r.row!) ?? [], (n) => (n.kind === 'text' ? 'span' : 'i'), (c, n) => {
        if (n.kind === 'text') { text(c, n); c.setAttribute('data-anchor', n.anchor); } else if (n.kind === 'rect') prop(c, '--vg-v', n.v);
      });
    });
  },
};
