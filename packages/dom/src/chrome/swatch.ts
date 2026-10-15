import { dotRadius } from '@unified-analytics/core';
import { attr } from '../dom.ts';
import { token } from '../tokens.ts';

/* A plot's dot, across, by its size step: core's dotRadius() is a base and a step for each size, and a dot with no
 * size is NO_SIZE steps. Read back from it, so the stylesheet's dot is core's. Here and not in points.ts, so that
 * the swatch reads it without an import cycle (points.ts -> chrome/size.ts -> here). A grid's dot reads it here too. */
const STEP = dotRadius(2) - dotRadius(1), BASE = dotRadius(1) - STEP;
export const NO_SIZE = (dotRadius() - BASE) / STEP;
export const DOT = `calc(${2 * BASE}px + var(--uav-size, ${NO_SIZE}) * ${2 * STEP}px)`;

/* The swatch: a colour said as a small shape of it, wherever a key names a colour. One rule set for all of them: an
 * entry of the legend, a line of the readout, a step of the ramp, a dot of the key to sizes and the pulse beside the
 * number. Each says its size and shape in data-swatch: 8, 10 or 12 px square, `dot` for a plot's dot (points.ts),
 * `cell` for a grid's cell (14 by 10, with a cell's radius), `circle` for round. It is an element of its own
 * (`.uav-swatch`), or drawn before the words it belongs to (`.uav-swatch-before`) where a wrap must not part the two
 * (legend.ts says why). It is painted from --uav-swatch where its host is not the colour it names, and else from its
 * own paint, and keeps that paint where a printer or forced colours would leave it out.
 * Where it stands, and its margins, are the module's that has it. Figma: the Swatch component set, by Size and Shape;
 * its Size=10, Shape=Circle is the pulse (`10 circle`). */
/** The sizes, in px: a line of the readout, the pulse beside the number (round), and an entry of the legend. */
export const SWATCH = { readout: 8, pulse: 10, legend: 12 } as const;
export const SWATCH_CSS = `
.uav-swatch, .uav-swatch-before::before { display: inline-block; flex: none; inline-size: var(--uav-swatch-i); block-size: var(--uav-swatch-b); border-radius: var(--uav-swatch-r, ${token('border-radius-swatch')});
  background: var(--uav-swatch, var(--uav-paint)); forced-color-adjust: none; }
.uav-swatch-before::before { content: ""; }
${Object.values(SWATCH).map((s) => `[data-swatch~="${s}"] { --uav-swatch-i: ${s}px; --uav-swatch-b: ${s}px; }`).join('\n')}
[data-swatch~="dot"] { --uav-swatch-i: ${DOT}; --uav-swatch-b: ${DOT}; }
[data-swatch~="cell"] { --uav-swatch-i: 14px; --uav-swatch-b: 10px; --uav-swatch-r: ${token('border-radius-cell')}; }
[data-swatch~="circle"] { --uav-swatch-r: 50%; }`;

/** Make an element a swatch of the given size and shape, or (`before`) the host of one drawn before its words. */
export function swatch(el: Element, look: string | null, before = false): void {
  el.classList.toggle(before ? 'uav-swatch-before' : 'uav-swatch', look != null);
  attr(el, 'data-swatch', look);
}
