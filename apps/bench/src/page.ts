import './theme.ts';

/* The page's own furniture, which every page of the bench shares: the library is not here, so a page that draws no
 * view, the tokens' and the materials', loads none of it (setup.ts has that). */

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
