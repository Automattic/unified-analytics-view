import { defineUaView, surfaceSheet, type UaView } from '@unified-analytics/dom';
import { facetSamples, moreSamples, samples as known } from '@unified-analytics/fixtures';
import { registerLinkPainter } from '@unified-analytics/flow/dom';
import { registerGeoPainters } from '@unified-analytics/geo/dom';
import { registerPartitionPainter } from '@unified-analytics/partition/dom';
import './theme.ts';

/* What every page of the bench shares. */

/** Every sample the fixtures have: the first six, then the rest. */
export const samples = { ...known, ...moreSamples };
/** The specs with a `facet`. They are a view for each value and have no one plan, so the pages that read a sample's plan (parts, and the capture off it) do not hold them. */
export const faceted = facetSamples;

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

/** The bench's own rule inside a view: the picked part outlined, everything that neither holds it nor is in it faded. */
export function focus(view: UaView, part: string): void {
  const root = view.shadowRoot;
  if (!root) return;
  const sheet = new CSSStyleSheet(), p = `.uav-${part}`;
  if (part) sheet.replaceSync(`.uav :not(:has(${p}), ${p}, ${p} *) { opacity: .15; } ${p} { outline: 1px dashed #e0306a; outline-offset: 1px; }`);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets.filter((s) => !(s as CSSStyleSheet & { bench?: true }).bench), Object.assign(sheet, { bench: true })];
}
