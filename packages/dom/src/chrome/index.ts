import { RAMP_CSS } from './ramp.ts';
import { SIZE_CSS } from './size.ts';

/* The furniture around the marks: what a view has beside them that is the same whichever layout drew it. One module
 * for each, exporting its stylesheet and the one function that paints it into a layout's body from the scene. The
 * sheets join the base sheet here, once, for every view (view.ts), so a custom mark's layout has them as the
 * element's own layouts do. The key to a unit's glyphs is the same kind of thing, in layouts/unit.ts beside the glyph. */
export const CHROME_CSS = RAMP_CSS + SIZE_CSS;

export { paintRamp } from './ramp.ts';
export { paintSize } from './size.ts';
