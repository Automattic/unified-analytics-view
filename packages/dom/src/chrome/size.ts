import type { CircleNode, Scene, TextNode } from '@unified-analytics/core';
import { ensure, keyed, pageWay, prop, text } from '../dom.ts';
import { swatch } from './swatch.ts';

/* The key to sizes: the metric's name, then a dot at each step with the most it stands for. A plot of points has it,
 * a grid of dots, and a map of symbols, and a dot in it is a plot's dot, in a plot's steps (points.ts).
 * A layout says only where it stands, and how much taller its view is for it. */
export const SIZE_CSS = `
.uav-size { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; block-size: 24px; margin-block-start: 4px; overflow: hidden; white-space: nowrap; }
.uav-size:empty { display: none; }
.uav-size span { margin-inline-end: 6px; color: var(--uav-paint); }`;

/** The key, after whatever the body holds already. It says again what each mark's name says whole, and reads the way
 * the page does. The element is there, empty, where the scene has no key, so it stands in the same place when a later one has. */
export function paintSize(body: HTMLElement, scene: Scene): void {
  const key = ensure(body, 'div', 'uav-size');
  key.setAttribute('aria-hidden', 'true'); pageWay(key, body);
  keyed(key, scene.nodes.filter((n): n is CircleNode | TextNode => n.part === 'size' && (n.kind === 'circle' || n.kind === 'text')), (n) => (n.kind === 'circle' ? 'i' : 'span'), (el, n) => {
    if (n.kind === 'text') text(el, n); else { swatch(el, 'dot circle'); prop(el, '--uav-size', n.size); }
  });
}
