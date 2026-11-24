import { columnRoom } from './scene.ts';
import type { Scene, SceneNode, TextNode } from './types.ts';

/* The sizes a surface builds a view to, in em of the view's type, where no token and no fit rule says them: gutters, the least a part is
 * drawn at, the widths at which a number takes its shorter forms. They are said once, here, so that every surface
 * reads the same ones: the DOM's stylesheets do, and a painter with no CSS would. */

/** An em in px, where a surface says no other: the label face on a page of 16 px type, which is five sixths of it. */
export const EM = (16 * 5) / 6;

/** The margins of a plot: above one with axes, the gutter under it for the x axis, and above and below a bare one.
 * The band's bar, and the line the key to sizes takes with the space above it. */
export const PLOT_TOP = 0.75, X_AXIS_BLOCK = 1.65, BARE_PAD = 0.225, BAND_BAR = 1.8, SIZE_KEY_BLOCK = 2.1;
/** The line the colour ramp takes under what it is the key to. */
export const RAMP_BLOCK = 1.8;
/** The least a half circle of seats is built to. Under that the legend gives way before the seats do. */
export const SEATS_LEAST = 12;
/** The least a unit's grid of a hundred is built to, a hairline between its cells. */
export const GRID_LEAST = 7.5;
/** A facet's views stand side by side while each has FACET_LEAST, with FACET_GAP between them, and wrap where they
 * would have less. A spec says no columns: this is how a surface counts them. */
export const FACET_LEAST = 15, FACET_GAP = 1.2;
/** How many of a facet's `count` views stand side by side in a room `inline` px wide, where an em is `em` px. The element's grid is the same sum, in CSS. */
export const facetColumns = (inline: number, count: number, em: number = EM): number => Math.max(1, Math.min(count, Math.floor((inline / em + FACET_GAP) / (FACET_LEAST + FACET_GAP) + 1e-9)));   // a room of exactly two views is two, whatever a float makes of the sum
/** A number's widths: under NUMBER_SHORT its value takes its short form, under DELTA_FULL its delta does, and
 * under NOTE_LEAST the note under it goes. */
export const NUMBER_SHORT = 12, DELTA_FULL = 15, NOTE_LEAST = 9;
/** What a point scale keeps inside each end of the plot. */
export const POINT_INSET = 0.15;
/** The height of a notice, where the view has room for it. */
export const NOTICE_HEIGHT = 9;
/** A dot's radius: by its size step, or the one size of a dot that has none. */
export const radius = (size?: number) => (size ? 0.15 + 0.1875 * size : 0.225);

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
export const COLUMNS_BLOCK = 1.5;   // what the headers take over the rows
