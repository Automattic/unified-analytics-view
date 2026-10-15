import { defineUaView, surfaceSheet } from '@unified-analytics/dom';
import { moreSamples, samples as known } from '@unified-analytics/fixtures';
import { registerLinkPainter } from '@unified-analytics/flow/dom';
import { registerGeoPainters } from '@unified-analytics/geo/dom';
import { registerPartitionPainter } from '@unified-analytics/partition/dom';
import './theme.ts';

/* What every page of the bench shares. */

/** Every sample the fixtures have: the prototype's, then the rest. */
export const samples = { ...known, ...moreSamples };

/** `<ua-view>` and the painters of the custom marks, and the surface layouts, which the page adopts: it is the surface. */
export function register(): void {
  defineUaView();
  // Custom marks are registered in two halves. The fixtures register core's, the map once for each set of shapes; these are the DOM's.
  registerGeoPainters();
  registerLinkPainter();
  registerPartitionPainter();
  document.adoptedStyleSheets.push(surfaceSheet());
}

/** With a height a frame is handed a box, as a row or a tile would hand it one, and is a row; with none it is a stack. */
export function boxIn(frame: HTMLElement, height: string): void {
  const boxed = !!Number(height);
  frame.classList.toggle('ua-row', boxed); frame.classList.toggle('ua-stack', !boxed);
  frame.style.blockSize = boxed ? height + 'px' : '';
}
