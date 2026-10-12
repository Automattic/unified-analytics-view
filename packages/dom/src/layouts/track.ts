import type { CircleNode, LineNode } from '@unified-analytics/core';
import { attr, prop } from '../dom.ts';
import { token } from '../tokens.ts';

/* What a row's track gains with a rule, a tick and a dot, and with a bar that has two ends. It is the rows layout's,
 * kept in a file of its own: rows.ts adds TRACK_CSS to its own, and calls trackMark for a mark that is not a bar.
 *
 * Such a track is read by where its marks are, so the scene says it stands beside the label (`track: "beside"`) and
 * the body carries `data-track`. The label then has a column of its own, no wider than two fifths of the view, the
 * track is the column that takes what is left, and no mark lies under any text. A mark keeps a row gap's width
 * inside each end of the track, so a dot at either end is whole. A dot is 6 px across, as a dot in a plot is. A tick
 * and a dot are set back by half their width from where they stand, and not moved there, so a track reads from the
 * right where the page does.
 *
 * Under the `track` rule the body goes whole and the number stands alone, as it does under `marks`. Both ask for
 * `data-track`, so a list of bars behind their labels is not touched. */
const along = '(100% - 2 * var(--uav-row-gap))';
const at = (x: string) => `calc(var(--uav-row-gap) + ${x} * ${along})`;
export const TRACK_CSS = `
.uav-body[data-track] .uav-row > .uav-f-label { max-inline-size: 40cqi; }
.uav-body[data-track] .uav-row > i { inset-block: 8px; inset-inline-start: ${at('var(--uav-x, 0)')}; inline-size: max(3px, calc(var(--uav-v) * ${along})); }
.uav-body[data-track] .uav-row > i[data-mark] { border-radius: 0; inset-inline-start: ${at('min(var(--uav-x), var(--uav-x2))')}; }
.uav-body[data-track] .uav-row > i[data-mark="rule"] { inset-block: calc(50% - 0.5px); inline-size: max(1px, calc(max(var(--uav-x2) - var(--uav-x), var(--uav-x) - var(--uav-x2)) * ${along})); }
.uav-body[data-track] .uav-row > i[data-mark="tick"] { inset-block: 0; inline-size: var(--uav-stroke, ${token('stroke-width-rule')}); inset-inline-start: calc(${at('var(--uav-x)')} - var(--uav-stroke, ${token('stroke-width-rule')}) / 2); }
.uav-body[data-track] .uav-row > i[data-mark="dot"] { inset-block: calc(50% - 3px); inline-size: 6px; border-radius: 50%; inset-inline-start: calc(${at('var(--uav-x)')} - 3px); }`;

export const TRACK_FIT: Record<string, Record<string, string>> = {
  track: { '.uav-body[data-track]': 'display: none;', '.uav-number:has(~ .uav-body[data-track])': 'display: block; margin: 0;' },
};

/** A mark in a row's track that is not a bar: a rule along it, a tick across it, or a dot. */
export function trackMark(el: HTMLElement | SVGElement, n: LineNode | CircleNode): void {
  const x2 = n.kind === 'line' ? n.x2 : n.x;
  attr(el, 'data-mark', n.kind === 'circle' ? 'dot' : n.x === x2 ? 'tick' : 'rule');
  prop(el, '--uav-x', n.x); prop(el, '--uav-x2', x2); prop(el, '--uav-stroke', n.kind === 'line' && n.width ? n.width + 'px' : null);
}
