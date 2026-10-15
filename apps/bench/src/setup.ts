import { defineUaView, registerPainter, surfaceSheet } from '@unified-analytics/dom';
import { moreSamples, samples as known } from '@unified-analytics/fixtures';
import { linkPainter } from '@unified-analytics/flow/dom';
import { geoPainter, geoPainterAs } from '@unified-analytics/geo/dom';
import { partitionPainter } from '@unified-analytics/partition/dom';
import './theme.ts';

/* What every page of the bench shares. */

/** Every sample the fixtures have: the prototype's, then the rest. */
export const samples = { ...known, ...moreSamples };

/** `<ua-view>` and the painters of the custom marks, and the surface layouts, which the page adopts: it is the surface. */
export function register(): void {
  defineUaView();
  // The `geo` mark is registered in code, in two halves. The fixtures hand core's half its boundary shapes; this is the DOM's.
  registerPainter(geoPainter);
  // The tile maps are the same mark, registered by the fixtures under a name for each set of tiles: a painter for each name.
  for (const name of ['geo-tiles', 'geo-hexes']) registerPainter(geoPainterAs(name));
  registerPainter(linkPainter);
  registerPainter(partitionPainter);
  document.adoptedStyleSheets.push(surfaceSheet());
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** A section's heading, and a note after it in small type. */
export function heading(title: string, note: string): HTMLHeadingElement {
  const h2 = el('h2', '', title + ' ');
  h2.append(el('small', '', note));
  return h2;
}

/** With a height a frame is handed a box, as a row or a tile would hand it one, and is a row; with none it is a stack. */
export function boxIn(frame: HTMLElement, height: string): void {
  const boxed = !!Number(height);
  frame.classList.toggle('ua-row', boxed); frame.classList.toggle('ua-stack', !boxed);
  frame.style.blockSize = boxed ? height + 'px' : '';
}
