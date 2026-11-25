import { dotRadius } from '@unified-analytics/core';
import { attr } from '../dom.ts';
import { em } from '../layout.ts';
import { token } from '../tokens.ts';

/* A plot's dot, across, by its size step: core's dotRadius() is a base and a step for each size, and a dot with no
 * size is NO_SIZE steps. Read back from it, so the stylesheet's dot is core's. Here and not in points.ts, so that
 * the swatch reads it without an import cycle (points.ts -> chrome/size.ts -> here). A grid's dot reads it here too. */
const STEP = dotRadius(2) - dotRadius(1), BASE = dotRadius(1) - STEP;
export const NO_SIZE = +((dotRadius() - BASE) / STEP).toFixed(6);
export const DOT = `calc(var(--uav-em) * (${+(2 * BASE).toFixed(6)} + var(--uav-size, ${NO_SIZE}) * ${+(2 * STEP).toFixed(6)}))`;

/* The swatch: a colour said as a small shape of it, wherever a key names a colour. One rule set for all of them: an
 * entry of the legend, a line of the readout, a step of the ramp, a dot of the key to sizes and the pulse beside the
 * number. Each says its size and shape in data-swatch: `readout`, `pulse` or `legend` for a square of that size, `dot`
 * for a plot's dot (points.ts), `cell` for a grid's cell (with a cell's radius), `circle` for round. A size is in
 * the view's em wherever the swatch stands, so one beside small text is the size of one beside large. It is an element of its own
 * (`.uav-swatch`), or drawn before the words it belongs to (`.uav-swatch-before`) where a wrap must not part the two
 * (legend.ts says why). It is painted from --uav-swatch where its host is not the colour it names, and else from its
 * own paint, and keeps that paint where a printer or forced colours would leave it out.
 * Where it stands, and its margins, are the module's that has it. Figma: the Swatch component set, by Size and Shape;
 * its Size=10, Shape=Circle is the pulse (`pulse circle`). */
/** The sizes, in em of the view's type: a line of the readout, the pulse beside the number (round), and an entry of the legend. */
export const SWATCH = { readout: 0.6, pulse: 0.75, legend: 0.9 } as const;
export const SWATCH_CSS = `
.uav-swatch, .uav-swatch-before::before { display: inline-block; flex: none; inline-size: var(--uav-swatch-i); block-size: var(--uav-swatch-b); border-radius: var(--uav-swatch-r, ${token('border-radius-swatch')});
  background: var(--uav-swatch, var(--uav-paint)); forced-color-adjust: none; }
.uav-swatch-before::before { content: ""; }
${Object.entries(SWATCH).map(([name, s]) => `[data-swatch~="${name}"] { --uav-swatch-i: ${em(s)}; --uav-swatch-b: ${em(s)}; }`).join('\n')}
[data-swatch~="dot"] { --uav-swatch-i: ${DOT}; --uav-swatch-b: ${DOT}; }
[data-swatch~="cell"] { --uav-swatch-i: ${em(1.05)}; --uav-swatch-b: ${em(0.75)}; --uav-swatch-r: ${token('border-radius-cell')}; }
[data-swatch~="circle"] { --uav-swatch-r: 50%; }`;

/** Make an element a swatch of the given size and shape, or (`before`) the host of one drawn before its words. */
export function swatch(el: Element, look: string | null, before = false): void {
  el.classList.toggle(before ? 'uav-swatch-before' : 'uav-swatch', look != null);
  attr(el, 'data-swatch', look);
}
