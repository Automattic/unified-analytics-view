import { token } from '../tokens.ts';
import { IS } from '../rove.ts';

/* A plot label: words set in or about a plot at a point the scene gave them. An axis's ticks, the names at the line
 * ends, a reference line's words, a point's, a rim's, a Sankey node's and a treemap box's are all one atom: its words,
 * and the states every atom has (docs/component-states-plan.md). Everything else about it is its parent's, as an
 * override in the parent's own rule:
 *
 *   anchor     where it stands from its point along the line: from its start, its middle or its end, as the share of
 *              its own width it is moved back by. A parent that places by translate reads it here (ANCHOR).
 *   tone       the colour: the paint of its node, which the node sets in --uav-paint, and on the axes the axis
 *              label's colour, which the axes' rule sets over it (axes.ts).
 *   cut        how wide it may be before it is cut with an ellipsis: 14 characters at a line's end and a point, 45%
 *              of the part in a Sankey column (cut()).
 *   halo       `data-halo` on the label, from its node: a ring of the background round each letter, so it reads over
 *              marks (LABEL_CSS).
 *   inset      the padding between the label and its point, in the parent's rule.
 *
 * In Figma the atom is `Plot label`, Text and the shared states, and its parents hold these as overrides: the axes,
 * Line ends, Point labels, Rule and Link / Column. A label the measured pass gave up has `data-thin` and keeps its
 * box, so the next measurement reads the same. */
export const ANCHOR = { start: '0', middle: '-50%', end: '-100%' } as const;
export type Anchor = keyof typeof ANCHOR;

/** A plot label's own declarations, for the rule of the parent that places it: on one line, in its paint. */
export const LABEL = 'white-space: nowrap; color: var(--uav-paint);';

/** A parent's cut of the labels it holds: no wider than `width`, and an ellipsis where the words run past it. */
export const cut = (width: string): string => `max-inline-size: ${width}; overflow: hidden; text-overflow: ellipsis;`;

/* Once for every view, whichever layout set the label. */
export const LABEL_CSS = `
.uav [data-halo] { -webkit-text-stroke: 3px ${token('color-background')}; paint-order: stroke fill; }
.uav [data-thin] { visibility: hidden; }
/* Highlighted, a chosen series' name at its line's end, is underlined. */
.uav-labels span${IS.highlighted} { text-decoration: underline; }`;
