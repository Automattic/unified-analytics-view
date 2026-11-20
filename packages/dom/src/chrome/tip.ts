import { attr } from '../dom.ts';
import { token } from '../tokens.ts';

/* The tooltip chip: words on the tooltip surface, over whatever they are said of. The readout and the crosshair's
 * words on the axes are this one thing, with three options, each an attribute:
 *  - anchor: `point` (the readout, at a point and in the top layer where there is one) or `axis` (a chip on an axis,
 *    placed absolutely and centred on its value), which is set closer and never wraps;
 *  - tone: primary, or `secondary`, quieter, for the second line of a comparison. Only the crosshair's chips on the
 *    axes are ever secondary (keys.ts); the readout is always primary;
 *  - content: one line, or lines (`data-lines`): the readout of a split point, a head and a line to each series,
 *    laid out by the readout's own rules in keys.ts.
 * Figma: the `Tooltip` component set, Tone × Content × Anchor, with no Secondary at Anchor=Point, as code draws none. */
export const TIP_CSS = `
.uav-tip { position: absolute; box-sizing: border-box; padding: 2px 6px; border-radius: ${token('border-radius-tooltip')}; pointer-events: none;
  font-family: ${token('font-family-tick')}; font-size: var(--uav-font-tick); font-optical-sizing: none; font-variant-numeric: tabular-nums;
  color: ${token('color-label-inverse')}; background: ${token('color-tooltip-surface')}; box-shadow: ${token('elevation-tooltip')}; }
.uav-tip[data-anchor="axis"] { padding: 1px 5px; white-space: nowrap; }
.uav-tip[data-tone="secondary"] { background: ${token('color-tooltip-surface-secondary')}; }`;

/** Make an element a tooltip chip, at a point or on an axis, in the primary tone or the secondary. */
export function tip<T extends HTMLElement>(el: T, anchor: 'point' | 'axis', tone: 'primary' | 'secondary' = 'primary'): T {
  el.classList.add('uav-tip');
  attr(el, 'data-anchor', anchor);
  attr(el, 'data-tone', tone === 'secondary' ? tone : null);
  return el;
}

/** Set what a chip says: one line of words, or lines, the nodes laid out as the readout's grid. */
export function say(el: HTMLElement, words: string | Node[]): void {
  const lines = typeof words !== 'string';
  el.toggleAttribute('data-lines', lines);
  if (lines) el.replaceChildren(...words); else el.textContent = words;
}

/** Where a chip `w` wide starts so that it is centred on `mid` and inside `lo` to `hi`, or at `lo` where it is wider. */
export function centred(mid: number, w: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(mid - w / 2, hi - w));
}
