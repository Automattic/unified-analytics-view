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

/** Every custom property the page's stylesheets declare on the root, name to declared value, in source order, as the
 * cascade leaves it for the current theme. */
export function declared(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rules: CSSRuleList) => {
    for (const r of rules) {
      if (r instanceof CSSMediaRule) { if (matchMedia(r.conditionText).matches) walk(r.cssRules); }
      else if (r instanceof CSSStyleRule && document.documentElement.matches(r.selectorText)) {
        for (const name of r.style) if (/^--(ua|a8c)-/.test(name)) out.set(name, r.style.getPropertyValue(name).trim());
      }
    }
  };
  // A sheet from another origin, a font's or an extension's, cannot be read, and declares none of these.
  for (const sheet of document.styleSheets) { let rules: CSSRuleList; try { rules = sheet.cssRules; } catch { continue; } walk(rules); }
  return out;
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
