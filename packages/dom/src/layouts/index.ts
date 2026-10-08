import type { TextNode } from '@universal-analytics/core';
import { keyed, text } from '../dom.ts';
import type { LayoutPainter } from '../layout.ts';
import { band } from './band.ts';
import { cartesian } from './cartesian.ts';
import { radial } from './radial.ts';
import { matrix } from './matrix.ts';
import { rows } from './rows.ts';

// The empty state: one line, centred in the room a plot would have taken.
const notice: LayoutPainter = {
  layout: 'notice',
  css: `
.uav[data-layout="notice"] { --uav-body-block: 120px; }
.uav[data-layout="notice"] .uav-body { display: grid; }
.uav-notice { place-self: center; text-align: center; color: var(--uav-paint); }`,
  fit: { notice: { '.uav-body': 'display: none;' } },      // the room goes with the line
  paint(body, scene) {
    keyed(body, scene.nodes.filter((n): n is TextNode => n.part === 'notice' && n.kind === 'text'), () => 'div', (el, n) => { el.classList.add('uav-notice'); text(el, n); });
  },
};

/** One painter per layout. `none` and `prose` have no body, so the element paints them alone. */
export const LAYOUTS: Record<string, LayoutPainter> = { cartesian, rows, band, radial, matrix, notice };

/** Register the painter of a custom mark: the DOM's half of it. A custom mark is a layout of its own under its own
 * name (core's marks.ts), so `painter.layout` is the name the mark was registered under there. */
export function registerPainter(painter: LayoutPainter): void {
  LAYOUTS[painter.layout] = painter;
}
