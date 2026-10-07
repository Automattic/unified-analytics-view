import type { Container, ContainerRules, KeepPart, PainterName, ReductionId } from './types.ts';

/* The container owns sizes. It states the least room each kind of part needs,
 * and the order in which parts are given up when a view does not fit.
 * These are the defaults; a context passes its containers a different set. */
export const CONTAINER_RULES: ContainerRules = {
  axes:      { minWidth: 280, minHeight: 120, height: 184 },   // a plot with axes
  secondary: { minPlotWidth: 180, minPlotHeight: 90 },         // comparison and reference layers stay legible above this
  bare:      { minPlotWidth: 64, height: 46 },                 // a plot with no guides, set beside the number
  rows:      { rowHeight: 28, gap: 4, minLabelWidth: 90 },
  band:      { minWidth: 110, minWidthWithLegend: 170 },
  notice:    { minWidth: 150 },
  tldrValue: { above: 'instant' },                             // above the marks only for an instant metric
  order:    ['drop-guides', 'drop-secondary', 'trim-rows', 'collapse', 'prose'],
};

/** Which `keep` entry in a spec blocks which reduction. */
export const KEEP: Partial<Record<ReductionId, KeepPart>> = {
  'drop-guides': 'guides', 'drop-secondary': 'secondary', 'trim-rows': 'rows', 'collapse': 'marks',
};

export function makeContainer(width: number, height?: number | null, painter?: PainterName, cell?: number): Container {
  const p = painter || 'svg', c0 = cell || 4;
  return {
    width, height: height || null, painter: p, cell: c0, rules: CONTAINER_RULES,
    // The dot painter sets digits on a 5x7 grid at one of two cell sizes.
    display(len, avail, small) {
      if (p === 'dots') { const c = !small && c0 === 8 && (len * 6 - 1) * 8 <= avail ? 8 : 4; return { h: 7 * c, cell: c }; }
      return { h: small || avail / Math.max(1, len) < 21 ? 24 : 34 };
    },
    displayWidth(len) { return p === 'dots' ? (len * 6 - 1) * 4 : Math.ceil(len * 14.5); },
  };
}
