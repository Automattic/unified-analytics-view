import { columnRoom } from './scene.ts';
import type { Scene, SceneNode, TextNode } from './types.ts';

/* The sizes a surface builds a view to, in px, where no token and no fit rule says them: gutters, the least a part is
 * drawn at, the widths at which a number takes its shorter forms. They are said once, here, so that every surface
 * reads the same ones: the DOM's stylesheets do, and a painter with no CSS would. */

/** The margins of a plot: above one with axes, the gutter under it for the x axis, and above and below a bare one.
 * The band's bar, and the line the key to sizes takes with the space above it. */
export const PLOT_TOP = 10, X_AXIS_BLOCK = 22, BARE_PAD = 3, BAND_BAR = 24, SIZE_KEY_BLOCK = 28;
/** The least a half circle of seats is built to: a seat of 7. Under that the legend gives way before the seats do. */
export const SEATS_LEAST = 160;
/** The least a unit's grid of a hundred is built to: a cell of 9 px, a hairline apart. */
export const GRID_LEAST = 100;
/** A facet's views stand side by side while each has FACET_LEAST, with FACET_GAP between them, and wrap where they
 * would have less. A spec says no columns: this is how a surface counts them. */
export const FACET_LEAST = 200, FACET_GAP = 16;
/** How many of a facet's `count` views stand side by side in a room `inline` px wide. The element's grid is the same sum, in CSS. */
export const facetColumns = (inline: number, count: number): number => Math.max(1, Math.min(count, Math.floor((inline + FACET_GAP) / (FACET_LEAST + FACET_GAP))));
/** A number's widths: under NUMBER_SHORT its value takes its short form, under DELTA_FULL its delta does, and
 * under NOTE_LEAST the note under it goes. */
export const NUMBER_SHORT = 160, DELTA_FULL = 200, NOTE_LEAST = 120;
/** The px a point scale keeps inside each end of the plot. */
export const POINT_INSET = 2;
/** The height of a notice, where the view has room for it. */
export const NOTICE_HEIGHT = 120;
/** A dot's radius: by its size step, or the one size of a dot that has none. */
export const radius = (size?: number) => (size ? 2 + 2.5 * size : 3);

/** A label's box, and its rank: a ranked label is given up before an unranked one, and the higher its rank the sooner. */
export interface LabelBox { x: number; y: number; w: number; h: number; rank?: number | undefined }
/** Which labels to give up so that no two are closer than `gap`. They are taken in order of rank, and one that would
 * meet a label already kept goes. For any surface that has measured its labels, as the DOM's measured pass has.
 * ponytail: every label against every kept one, and a label never moves to make room. A first cut, and not the answer
 * to label collision (reference, Open 5). */
export function declutter(boxes: LabelBox[], gap = 2): boolean[] {
  const kept: LabelBox[] = [], gone = boxes.map(() => false);
  boxes.map((_, i) => i).sort((a, b) => (boxes[a]!.rank || 0) - (boxes[b]!.rank || 0) || a - b).forEach((i) => {
    const b = boxes[i]!;
    if (kept.some((k) => b.x < k.x + k.w + gap && k.x < b.x + b.w + gap && b.y < k.y + k.h + gap && k.y < b.y + b.h + gap)) gone[i] = true; else kept.push(b);
  });
  return gone;
}


/** The room each of a row's columns takes, the first of them first: its widest text, a header among them, and COLUMN_PAD.
 * The DOM sets a column by its content. It asks this only for when to give one up. */
export function columnRooms(scene: Scene): number[] {
  const values: number[] = [], headers: number[] = [];
  scene.nodes.forEach((n) => {
    if (!inColumn(n)) return;
    const i = n.rank || 0, of = n.part === 'columns' ? headers : values;
    of[i] = Math.max(of[i] || 0, n.text.length);
    values[i] ??= 0;
  });
  return values.map((v, i) => columnRoom(v, headers[i]));
}
/** Whether a node is text in a column of a row's values: a value, or the header over one. The header over the labels
 * is no column of values: it starts where they do and takes no room of its own. */
export const inColumn = (n: SceneNode): n is TextNode => n.kind === 'text' && ((n.part === 'columns' && n.anchor !== 'start') || (n.part === 'rows' && n.font === 'value'));
export const COLUMNS_BLOCK = 20;   // px the headers take over the rows
