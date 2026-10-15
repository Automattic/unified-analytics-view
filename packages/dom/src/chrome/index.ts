import { AXES_CSS } from './axes.ts';
import { LABEL_CSS } from './label.ts';
import { LEGEND_CSS } from './legend.ts';
import { RAMP_CSS } from './ramp.ts';
import { SIZE_CSS } from './size.ts';
import { UNIT_CSS } from './unit.ts';

/* The furniture around the marks: what a view has beside them that is the same whichever layout drew it. One module
 * for each, exporting its stylesheet and the one function that paints it into a layout's body from the scene. The
 * sheets join the base sheet here, once, for every view (view.ts), so a custom mark's layout has them as the
 * element's own layouts do. The key to a unit's glyphs is one of them, and unit.ts holds it beside how a glyph takes its size. */
export const CHROME_CSS = LABEL_CSS + AXES_CSS + LEGEND_CSS + RAMP_CSS + SIZE_CSS + '\n' + UNIT_CSS;

export { paintAxes, thinAxis } from './axes.ts';
export { ANCHOR, label, type Anchor, type LabelOptions } from './label.ts';
export { paintLegend } from './legend.ts';
export { paintRamp } from './ramp.ts';
export { paintSize } from './size.ts';
export { paintUnitKey } from './unit.ts';
