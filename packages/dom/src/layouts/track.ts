import { dotRadius, type CircleNode, type LineNode } from '@unified-analytics/core';
import { attr, prop } from '../dom.ts';
import { token } from '../tokens.ts';
import { RULE } from '../chrome/rule.ts';

/* What a row's track gains with a rule, a tick and a dot, and with a bar that has two ends. It is the rows layout's,
 * kept in a file of its own: rows.ts adds TRACK_CSS to its own, and calls trackMark for a mark that is not a bar.
 *
 * Such a track is read by where its marks are, so the scene says it stands beside the label (`track: "beside"`) and
 * the body carries `data-track`. The label then has a column of its own, no wider than two fifths of the view, the
 * track is the column that takes what is left, and no mark lies under any text. A mark keeps a row gap's width
 * inside each end of the track, so a dot at either end is whole. A dot is 6 px across, as a dot in a plot is. A tick
 * and a dot are set back by half their width from where they stand, and not moved there, so a track reads from the
 * right where the page does. A glyph of a `unit` is a dot with room of its own: its share of the track across, and the
 * row's height less 4 px above and below. It is as wide as the lesser of the two, less a hairline, and as tall as it is
 * wide (chrome/unit.ts).
 *
 * A bar divided into series is its parts end to end, parted by a line's width as a stack's are in a plot, and none
 * has a least length: one would lie over the next. A part of the range behind the marks is as tall as the row, under
 * them, and the parts meet. Dots and ticks that are several to a row, by detail, are drawn light by the scene, so
 * where they lie over each other the row reads darker. Half a tick, by `align`, stands in the half of the row the scene gives it.
 *
 * Under the `track` rule the body goes whole and the number stands alone, as it does under `marks`. Both ask for
 * `data-track`, so a list of bars behind their labels is not touched. */
const along = '(100% - 2 * var(--uav-row-gap))';
const at = (x: string) => `calc(var(--uav-row-gap) + ${x} * ${along})`;
const glyph = `max(1px, calc(min(var(--uav-w) * ${along}, var(--uav-row-block) - 8px) - 1px))`;
export const TRACK_CSS = `
.uav-body[data-track] .uav-row > .uav-f-label { max-inline-size: 40cqi; }
.uav-body[data-track] .uav-row > i { inset-block: 8px; inset-inline-start: ${at('var(--uav-x, 0)')}; inline-size: max(3px, calc(var(--uav-v) * ${along})); }
.uav-body[data-track] .uav-row > i[data-mark] { border-radius: 0; inset-inline-start: ${at('min(var(--uav-x), var(--uav-x2))')}; }
.uav-body[data-track] .uav-row > i[data-mark="rule"] { inset-block: calc(50% - ${RULE} / 2); inline-size: max(${RULE}, calc(max(var(--uav-x2) - var(--uav-x), var(--uav-x) - var(--uav-x2)) * ${along})); }
.uav-body[data-track] .uav-row > i[data-series]:not([data-mark]) { border-radius: 0; inline-size: max(0px, calc(var(--uav-v) * ${along} - ${token('stroke-width-rule')})); }
.uav-body[data-track] .uav-row > i[data-mark="band"] { inset-block: 0; inset-inline-start: ${at('var(--uav-x, 0)')}; inline-size: calc(var(--uav-v) * ${along}); }
.uav-body[data-track] .uav-row > i[data-mark="tick"] { inset-block: calc((1 - var(--uav-t2)) * 100%) calc(var(--uav-t) * 100%); inline-size: ${RULE}; inset-inline-start: calc(${at('var(--uav-x)')} - ${RULE} / 2); }
.uav-body[data-track] .uav-row > i[data-mark="dot"] { inset-block: calc(50% - ${dotRadius()}px); inline-size: ${2 * dotRadius()}px; border-radius: 50%; inset-inline-start: calc(${at('var(--uav-x)')} - ${dotRadius()}px); }
.uav-body[data-track] .uav-row > i[data-mark="unit"] { inset-block: 0; margin-block: auto; inline-size: ${glyph}; block-size: auto; aspect-ratio: 1; border-radius: 50%; inset-inline-start: calc(${at('var(--uav-x)')} - ${glyph} / 2); }`;

export const TRACK_FIT: Record<string, Record<string, string>> = {
  track: { '.uav-body[data-track]': 'display: none;', '.uav-number:has(~ .uav-body[data-track])': 'display: block; margin: 0;' },
};

/** A mark in a row's track that is not a bar: a rule along it, a tick across it, or a dot. */
export function trackMark(el: HTMLElement | SVGElement, n: LineNode | CircleNode): void {
  const x2 = n.kind === 'line' ? n.x2 : n.x;
  attr(el, 'data-mark', n.kind === 'circle' ? (n.w == null ? 'dot' : 'unit') : n.x === x2 ? 'tick' : 'rule');
  prop(el, '--uav-x', n.x); prop(el, '--uav-x2', x2); prop(el, '--uav-w', n.kind === 'circle' ? n.w : null); prop(el, '--uav-stroke', n.kind === 'line' && n.width ? n.width + 'px' : null);
  // How far up the row a tick starts and ends: the whole of it, or the half `align` gives it. Always stated, since a
  // ratio is a registered property, and one that is not set is nothing and not what a var() falls back to.
  if (n.kind === 'line') { prop(el, '--uav-t', n.t); prop(el, '--uav-t2', n.t2 ?? n.t); }
}
