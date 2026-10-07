import type { Layout, TextNode } from '@universal-analytics/core';
import { keyed, text } from '../dom.ts';
import type { LayoutPainter } from '../layout.ts';
import { band } from './band.ts';
import { cartesian } from './cartesian.ts';
import { rows } from './rows.ts';

// The empty state: one line, centred in the room a plot would have taken.
const notice: LayoutPainter = {
  layout: 'notice',
  css: `
.vg[data-layout="notice"] { --vg-body-block: 120px; }
.vg[data-layout="notice"] .vg-body { display: grid; }
.vg-notice { place-self: center; text-align: center; color: var(--vg-paint); }`,
  fit: { notice: { '.vg-body': 'display: none;' } },      // the room goes with the line
  paint(body, scene) {
    keyed(body, scene.nodes.filter((n): n is TextNode => n.part === 'notice' && n.kind === 'text'), () => 'div', (el, n) => { el.classList.add('vg-notice'); text(el, n); });
  },
};

/** One painter per layout. `none` and `prose` have no body, so the element paints them alone. */
export const LAYOUTS: Partial<Record<Layout, LayoutPainter>> = { cartesian, rows, band, notice };
