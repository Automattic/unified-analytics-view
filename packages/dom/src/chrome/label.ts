import { token } from '../tokens.ts';

/* A plot label: words set in or about a plot at a point the scene gave them. An axis's ticks, the names at the line
 * ends, a reference line's words, a point's, a rim's, a Sankey node's and a treemap box's are all one, told apart by
 * the options here; where each stands is its layout's. In Figma it is `Plot label`, Anchor × Tone × Halo × Inset ×
 * State, with a Truncate boolean. Each maps to code as follows.
 *
 *   anchor     where the label stands from its point along the line: from its start, its middle or its end, as the
 *              share of its own width it is moved back by. A layout that places by translate reads it here (ANCHOR).
 *   tone       `axis`, the axis label's colour, or `paint`, the colour its node carries in --uav-paint (label()'s tone).
 *   truncate   no wider than 14 characters, cut with an ellipsis (label()'s truncate).
 *   halo       `data-halo` on the label, from its node: a ring of the background round each letter, so it reads over
 *              marks (LABEL_CSS).
 *   inset      6 px of padding between the label and its point: a tick label's from its axis (axes.ts) and a line
 *              end's from the line (cartesian.ts). Each layout writes it in its own rule.
 *   state      Chosen is the name of a chosen series: `[data-chosen]` on the label, underlined (keys.ts).
 *
 * A label the measured pass gave up has `data-thin` and keeps its box, so the next measurement reads the same. */
export const ANCHOR = { start: '0', middle: '-50%', end: '-100%' } as const;
export type Anchor = keyof typeof ANCHOR;

export interface LabelOptions { tone?: 'axis' | 'paint'; truncate?: boolean }

/** A plot label's declarations, for a layout's rule that places it. */
export const label = ({ tone = 'paint', truncate = false }: LabelOptions = {}): string =>
  'white-space: nowrap; color: ' + (tone === 'axis' ? token('color-label-axis') : 'var(--uav-paint)') + ';'
  + (truncate ? ' max-inline-size: 14ch; overflow: hidden; text-overflow: ellipsis;' : '');

/* Once for every view, whichever layout set the label. */
export const LABEL_CSS = `
.uav [data-halo] { -webkit-text-stroke: 3px ${token('color-background')}; paint-order: stroke fill; }
.uav [data-thin] { visibility: hidden; }`;
