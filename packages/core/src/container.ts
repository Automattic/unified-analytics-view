import { FIT_RULES } from './fit.ts';
import type { ContainerRules } from './types.ts';

/* The container owns sizes. Its fit rules state the least room each part needs, and what is given up without it.
 * These are the defaults; a context passes its containers a different set. */
export const CONTAINER_RULES: ContainerRules = {
  fit:       FIT_RULES,
  axes:      { height: 13.8 },                                  // a plot with axes: its natural height. Its least is the `axes` rule's block need
  bare:      { height: 3.45, numberWidth: 5.7 },                  // a plot with no guides, set beside the number, and the least width that number is given
  rows:      { rowHeight: 2.1, gap: 0.3 },
  tldrValue: { above: 'instant' },                             // above the marks only for an instant metric
};
