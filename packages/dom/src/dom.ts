import type { SceneNode, TextNode } from '@universal-analytics/core';
import { leave } from './motion.ts';
import { token } from './tokens.ts';

/* How the painter touches the document. Everything goes through the object model, as a strict content
 * security policy asks: createElement, never innerHTML; style.setProperty, never a style attribute in markup. */
const SVG = 'http://www.w3.org/2000/svg';

/* A scene's paint tokens, as the public tokens they read (tokens.ts). */
const PAINT: Record<string, string> = {
  ink: 'label', 'ink.muted': 'label-secondary', grid: 'grid', axis: 'axis-x', rule: 'annotation', compare: 'comparison',
  'delta.good': 'delta-good', 'delta.bad': 'delta-bad', delta: 'trend-neutral', live: 'live',
};
/** The custom property a paint token reads. A token the table does not know maps by name: `series.2` is `--ua-charts-color-series-2`. */
export function paintVar(paint: string): string {
  // A spec can name its own paint, so the name is reduced to what a custom property may hold.
  return Object.hasOwn(PAINT, paint) ? token('color-' + PAINT[paint]) : token('color-' + String(paint).replace(/[^\w-]/g, '-'), 'currentColor');
}

/** The child of `parent` with this class, made on first use. Children stay in the order they were first asked for. */
export function ensure<K extends keyof HTMLElementTagNameMap>(parent: Element, tag: K, cls: string): HTMLElementTagNameMap[K] {
  let el = parent.querySelector<HTMLElementTagNameMap[K]>(':scope > .' + cls);
  if (!el) { el = document.createElement(tag); el.className = cls; parent.appendChild(el); }
  return el;
}
/** The one stretched SVG of a plot: paths are drawn in a 100 by 100 box. */
export function ensureSvg(parent: Element): SVGSVGElement {
  let svg = parent.querySelector<SVGSVGElement>(':scope > svg');
  if (!svg) {
    svg = parent.appendChild(document.createElementNS(SVG, 'svg'));
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}

/** Reconcile the children of `parent` with scene nodes, by data-key: new keys enter, missing keys leave (motion.ts
 * says when), the rest update in place. Children end in scene order, which is reading order. A new element is put
 * in its place and a kept one is left where it is unless the kept ones changed order among themselves.
 * ponytail: every kept element found out of place is moved, not the fewest. Longest increasing run if it shows. */
export function keyed<N extends SceneNode>(parent: Element, nodes: N[], tag: (n: N) => string, each: (el: HTMLElement | SVGElement, n: N) => void): void {
  // One child per key. Keys are unique in a sound scene, but two rows of one dimension value, or a spec painted
  // against the result of the one before it, repeat one, and a second child under a key would never be met again.
  const old = new Map<string | null, HTMLElement | SVGElement>();
  for (const c of Array.from(parent.children) as (HTMLElement | SVGElement)[]) { const k = c.getAttribute('data-key'); if (old.has(k)) c.remove(); else old.set(k, c); }
  const svg = parent.namespaceURI === SVG;
  const els = nodes.map((n) => {
    const el = old.get(n.key);
    if (!el) return svg ? document.createElementNS(SVG, tag(n)) as SVGElement : document.createElement(tag(n));
    old.delete(n.key); el.removeAttribute('data-exit');                   // one that was leaving is back
    return el;
  });
  old.forEach(leave);
  let at = parent.firstElementChild;
  els.forEach((el, i) => {
    while (at?.hasAttribute('data-exit')) at = at.nextElementSibling;     // one that is leaving stays where it was
    if (el === at) at = el.nextElementSibling; else move(parent, el, at);
    mark(el, nodes[i]!);
    each(el, nodes[i]!);
  });
}
/* Moving an element with insertBefore cancels its transitions and those of everything in it. moveBefore keeps
 * them, where there is one. */
function move(parent: Element, el: Element, before: Element | null): void {
  const keep = (parent as { moveBefore?: (el: Element, before: Element | null) => void }).moveBefore;
  if (keep && el.parentNode === parent) try { keep.call(parent, el, before); return; } catch { /* not connected */ }
  parent.insertBefore(el, before);
}

/** Set, change or clear an attribute. An element that already says so is not touched. */
export function attr(el: Element, name: string, v: string | number | null | undefined): void {
  if (el.getAttribute(name) === (v == null ? null : String(v))) return;
  if (v == null) el.removeAttribute(name); else el.setAttribute(name, String(v));
}
/** Set or clear one style property. Positions go in as the prefixed ratios: --uav-x, --uav-w, --uav-v, --uav-t. */
export function prop(el: HTMLElement | SVGElement, name: string, v: string | number | null | undefined): void {
  if (v == null) el.style.removeProperty(name); else el.style.setProperty(name, String(v));
}
/** The colour a node is painted with. A tint is its paint's lighter colour, whole, where the tokens have one
 * (`--ua-charts-color-series-1-soft`), and the paint at the node's opacity where they do not. Text in a series colour
 * takes the step that holds contrast for text (`-text`), where the tokens have that, and the mark's colour where not. */
export function nodePaint(n: Pick<SceneNode, 'paint' | 'kind' | 'tone' | 'opacity'>): string {
  const base = paintVar(n.paint), name = base.slice(4, base.indexOf(','));
  if (n.tone === 'soft') return 'var(' + name + '-soft, color-mix(in srgb, ' + base + ' ' + (n.opacity ?? 1) * 100 + '%, transparent))';
  return n.kind === 'text' && n.paint.startsWith('series.') ? 'var(' + name + '-text, ' + base + ')' : base;
}
/** What every painted node carries: its key, what the fit rules select on, the row and series it came from, and its paint. */
function mark(el: HTMLElement | SVGElement, n: SceneNode): void {
  attr(el, 'data-key', n.key); attr(el, 'data-role', n.role); attr(el, 'data-rank', n.rank); attr(el, 'data-row', n.row); attr(el, 'data-series', n.series);
  prop(el, '--uav-paint', nodePaint(n));
  prop(el, 'opacity', n.tone === 'soft' ? null : n.opacity);
}

/** A text node's words. One with a shorter form holds both, and the stylesheet picks. */
export function text(el: Element, n: TextNode): void {
  const face = 'uav-f-' + n.font;
  // A kept key can change its face, and would otherwise carry both.
  if (!el.classList.contains(face)) { for (const c of Array.from(el.classList)) if (c.startsWith('uav-f-')) el.classList.remove(c); el.classList.add(face); }
  if (n.short == null) { el.textContent = n.text; return; }
  if (!el.querySelector(':scope > .uav-full')) el.textContent = '';
  ensure(el, 'span', 'uav-full').textContent = n.text;
  ensure(el, 'span', 'uav-short').textContent = n.short;
}
