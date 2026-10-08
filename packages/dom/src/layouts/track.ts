import type { CircleNode, LineNode } from '@universal-analytics/core';
import { attr, prop } from '../dom.ts';

/* What a row's track gains with a rule, a tick and a dot, and with a bar that has two ends. It is the rows layout's,
 * kept in a file of its own: rows.ts adds TRACK_CSS to its own, and calls trackMark for a mark that is not a bar.
 *
 * Such a track is read by where its marks are, so the scene says it stands beside the label (`track: "beside"`) and
 * the body carries `data-track`. The label then has a column of its own, no wider than two fifths of the view, the
 * track is the column that takes what is left, and no mark lies under any text. A mark keeps a row gap's width
 * inside each end of the track, so a dot at either end is whole. A dot is 6 px across, as a dot in a plot is.
 *
 * Under the `track` rule the body goes whole and the number stands alone, as it does under `marks`. Both ask for
 * `data-track`, so a list of bars behind their labels is not touched. */
const along = '(100% - 2 * var(--vg-row-gap))';
const at = (x: string) => `calc(var(--vg-row-gap) + ${x} * ${along})`;
export const TRACK_CSS = `
.vg-body[data-track] .vg-row > .vg-f-label { max-inline-size: 40cqi; }
.vg-body[data-track] .vg-row > i { inset-block: 8px; inset-inline-start: ${at('var(--vg-x, 0)')}; inline-size: max(3px, calc(var(--vg-v) * ${along})); }
.vg-body[data-track] .vg-row > i[data-mark] { border-radius: 0; inset-inline-start: ${at('min(var(--vg-x), var(--vg-x2))')}; }
/* ponytail: physical translate, as a plot's dots have, so not right for right-to-left. */
.vg-body[data-track] .vg-row > i[data-mark="rule"] { inset-block: calc(50% - 0.5px); inline-size: max(1px, calc(max(var(--vg-x2) - var(--vg-x), var(--vg-x) - var(--vg-x2)) * ${along})); }
.vg-body[data-track] .vg-row > i[data-mark="tick"] { inset-block: 0; inline-size: var(--vg-stroke, 1px); translate: -50%; }
.vg-body[data-track] .vg-row > i[data-mark="dot"] { inset-block: calc(50% - 3px); inline-size: 6px; border-radius: 50%; translate: -50%; }`;

export const TRACK_FIT: Record<string, Record<string, string>> = {
  track: { '.vg-body[data-track]': 'display: none;', '.vg-number:has(~ .vg-body[data-track])': 'display: block; margin: 0;' },
};

/** A mark in a row's track that is not a bar: a rule along it, a tick across it, or a dot. */
export function trackMark(el: HTMLElement | SVGElement, n: LineNode | CircleNode): void {
  const x2 = n.kind === 'line' ? n.x2 : n.x;
  attr(el, 'data-mark', n.kind === 'circle' ? 'dot' : n.x === x2 ? 'tick' : 'rule');
  prop(el, '--vg-x', n.x); prop(el, '--vg-x2', x2); prop(el, '--vg-stroke', n.kind === 'line' && n.width ? n.width + 'px' : null);
}
