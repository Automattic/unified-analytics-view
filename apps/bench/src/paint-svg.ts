import type { Scene } from '@universal-analytics/core';

/* The prototype's SVG painter, ported as it stands. It draws the pixel scene,
 * so it needs a size and repaints on resize. It is the bench's stand-in until
 * <ua-view> exists, and the fallback named in docs/dom-painter-plan.md. */
const NS = 'http://www.w3.org/2000/svg';
const PAINT: Record<string, string> = {
  ink: 'label', 'ink.muted': 'label-secondary', grid: 'grid', axis: 'axis-x', rule: 'annotation', compare: 'comparison',
  'delta.good': 'delta-good', 'delta.bad': 'delta-bad', delta: 'trend-neutral', live: 'live',
};
const pv = (token: string) => 'var(--a8c-charts-color-' + (PAINT[token] || token.replace(/\./g, '-')) + ')';
const drawn = new WeakMap<SVGSVGElement, Map<string, SVGElement>>();

type Attrs = Record<string, string | number | null | undefined>;

export function paintSVG(svg: SVGSVGElement, scene: Scene): void {
  svg.setAttribute('width', String(scene.width)); svg.setAttribute('height', String(scene.height));
  svg.setAttribute('viewBox', '0 0 ' + scene.width + ' ' + scene.height);
  let els = drawn.get(svg);
  if (!els) drawn.set(svg, els = new Map());
  const seen = new Set<string>();
  scene.nodes.forEach((n, i) => {
    let el = els.get(n.key);
    if (!el || el.tagName !== n.kind) { el?.remove(); el = document.createElementNS(NS, n.kind); els.set(n.key, el); }
    const c = pv(n.paint);
    const a: Attrs = { transform: n.tx || n.ty ? 'translate(' + (n.tx || 0) + ',' + (n.ty || 0) + ')' : null, opacity: n.opacity };
    if (n.kind === 'rect') Object.assign(a, { x: n.x, y: n.y, width: Math.max(0, n.w), height: Math.max(0, n.h), rx: n.rx || 0, fill: c });
    else if (n.kind === 'path') Object.assign(a, { d: n.d, fill: n.fill ? c : 'none', stroke: n.fill ? null : c, 'stroke-width': n.fill ? null : n.width || 2, 'stroke-dasharray': n.dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (n.kind === 'line') Object.assign(a, { x1: n.x1, y1: n.y1, x2: n.x2, y2: n.y2, stroke: c, 'stroke-width': n.width || 1, 'stroke-dasharray': n.dash, 'shape-rendering': 'crispEdges' });
    else if (n.kind === 'circle') Object.assign(a, { cx: n.cx, cy: n.cy, r: n.r, fill: c });
    else {
      const display = n.font === 'display', h = n.h || 0;
      Object.assign(a, { x: n.x, y: display ? n.y + h * 0.82 : n.y, fill: c, class: 'f-' + n.font + (n.halo ? ' halo' : ''), 'text-anchor': n.anchor,
        'dominant-baseline': n.baseline === 'middle' ? 'central' : null, 'font-size': display ? Math.round(h * 1.08) : null });
      el.textContent = n.text;
    }
    for (const k in a) { if (a[k] == null) el.removeAttribute(k); else el.setAttribute(k, String(a[k])); }
    if (svg.children[i] !== el) svg.insertBefore(el, svg.children[i] || null);
    seen.add(n.key);
  });
  els.forEach((el, k) => { if (!seen.has(k)) { el.remove(); els.delete(k); } });
}
