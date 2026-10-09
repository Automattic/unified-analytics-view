/* The pixel look of the marks: lines, areas and arcs drawn as if on a coarse screen, in squares with no gap between
 * them, and bars cut to the same squares. It is the prototype's dot painter (prototype-bench.js, paintDots) at a
 * higher resolution: its dots had a gap, and these have none, so a line reads as a line and its steps as the screen's.
 *
 * A square is on or it is off. It is one colour all over, at full strength, with no blend at a mark's edge and no
 * opacity. What a paint's opacity said is said by a pattern, as the prototype says it: every other square for a paint
 * half there, one in four for a tint. A dashed line is whole: a comparison is told from its line by its colour, which
 * is why that colour is an opaque one.
 *
 * A plot's SVG is still built, by the layout, and is still what moves from one shape to the next. It is not shown.
 * Beside it is a canvas with one px of its own to a square, which the browser scales up without smoothing. The
 * squares that are on are written in the path's own colour, as it is computed, so a token or a theme still decides it.
 * An area is drawn on a mask that size, and a square is on where the mask is more than half covered. A line is not:
 * a line cut from its coverage is thick where it is steep and thin where it is flat, and breaks into lumps. It is
 * walked instead, as a graphing calculator plots one, and a square brush is set down at every square it passes
 * through, so it is the same weight all along and its steps are clean. That is done when the SVG changes, a frame of a morph included, and when its box does: never under the
 * pointer, since hover and the readout are layers of their own.
 * ponytail: a colour is read when the squares are written, so a theme that changes with no change of data or size
 * shows on the next one. Watch the scheme (matchMedia) if that is seen.
 *
 * A bar is HTML and a rectangle already. Its edges go to the nearest square and its corners are square, in the
 * stylesheet, and one that is part transparent, the bar of a day still filling, is every other square of itself.
 *
 * The guides are on the same squares: a grid line, the axis and a rule sit on a whole square and a grid line is
 * 1 px, and a tick's label is moved by whole px, so a pixel face in it is sharp.
 *
 * The square is `size-pixel`, a public token, to a quarter of a px: 1 px, which is two of a dense screen's own a side
 * and still plainly a square. At 0 there is no look at all: the marks are the clean vector they were. The element reads the token as a length, off a probe, after each paint and when its
 * room changes. */
import { token } from './tokens.ts';

/** Which squares of a shape are on, by where they are on the screen. The prototype's. */
export const PATTERNS = {
  solid: () => true,
  checker: (x: number, y: number) => (x + y) % 2 === 0,
  sparse: (x: number, y: number) => x % 2 === 0 && y % 2 === 0,
};
/** The pattern for a paint: one about half there is every other square, and a tint is one in four. */
export function pattern(opacity: number): keyof typeof PATTERNS {
  return opacity < 0.3 ? 'sparse' : opacity < 0.6 ? 'checker' : 'solid';
}
/** The brush a line is drawn with, in squares a side: its own width, and two at the least, which is a graphing
 * calculator's line. */
export const brush = (width: number, square: number): number => Math.max(2, Math.round(width / square));

/** Squares of room about the plot, for a line that runs along its edge and the ends of one that leaves it. */
const PAD = 2;
const PX = 'var(--uav-px)', to = (length: string) => `round(${length}, ${PX})`;
/** It joins the base sheet inside `@layer uav`. `--uav-px` is the square. Every rule but the probe's waits for the
 * element to say the look is on: `data-px` on the figure, and `data-pixels` on an SVG whose canvas is drawn.
 * A bar's far edge is found and then its near one taken from it, so two bars that met still meet: a stack has no
 * seam and no overlap. The canvas is placed and sized in px by the element, to whole squares. */
export const PIXELS_CSS = `
.uav { --uav-px: ${token('size-pixel')}; }
.uav-pixel { position: absolute; inline-size: ${PX}; block-size: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
.uav-pixels { position: absolute; image-rendering: pixelated; pointer-events: none; }
.uav[data-px] svg[data-pixels] { opacity: 0; }
@media (prefers-reduced-motion: no-preference) { .uav-plot svg[data-draw] + .uav-pixels { animation: uav-draw ${token('motion-duration-draw')} linear both; } }
.uav[data-px] .uav-bars i { border-radius: 0;
  inset-inline-start: ${to('calc(var(--uav-x) * 100%)')}; inline-size: max(${PX}, calc(${to('calc((var(--uav-x) + var(--uav-w)) * 100%)')} - ${to('calc(var(--uav-x) * 100%)')} - var(--uav-gap-x, 0px)));
  inset-block-end: ${to('calc(min(var(--uav-v0, 0), var(--uav-v)) * 100%)')}; block-size: max(0px, calc(${to('calc(max(var(--uav-v0, 0), var(--uav-v)) * 100%)')} - ${to('calc(min(var(--uav-v0, 0), var(--uav-v)) * 100%)')} - var(--uav-gap-y, 0px))); }
.uav[data-px] .uav-body:not([data-track]) .uav-row > i { border-radius: 0;
  inset-inline-start: ${to('calc(var(--uav-x, 0) * 100%)')}; inline-size: max(${PX}, calc(${to('calc((var(--uav-x, 0) + var(--uav-v)) * 100%)')} - ${to('calc(var(--uav-x, 0) * 100%)')})); }
.uav[data-px] .uav-band i { border-radius: 0; }
.uav[data-px] .uav-line { inset-block-start: ${to('calc((1 - var(--uav-t)) * 100%)')}; }
.uav[data-px] .uav-grid .uav-line { block-size: 1px; }
.uav[data-px] :is(.uav-y-axis, .uav-y-axis-2) span { inset-block-start: ${to('calc((1 - var(--uav-t)) * 100%)')}; translate: 0 round(-50%, 1px); }
.uav[data-px] .uav-x-axis span { inset-inline-start: ${to('calc(var(--uav-x) * 100%)')}; translate: round(-50%, 1px); }
.uav[data-px] .uav-x-axis [data-anchor="start"] { translate: 0; }
.uav[data-px] .uav-x-axis [data-anchor="end"] { translate: -100%; }
.uav[data-px] :is(.uav-plot, .uav-y-axis, .uav-y-axis-2, .uav-x-axis, .uav-labels) { translate: var(--uav-nx, 0px) var(--uav-ny, 0px); }
.uav[data-px] .uav-bars i[style*="opacity"] { opacity: 1 !important; mask: conic-gradient(#000 25%, #0000 0 50%, #000 0 75%, #0000 0) 0 0 / calc(${PX} * 2) calc(${PX} * 2); }`;

interface Watched { canvas: HTMLCanvasElement; square: number; frame: number; stop(): void }
const watched = new WeakMap<SVGSVGElement, Watched>();
let scratch: HTMLCanvasElement | undefined, dab: HTMLCanvasElement | undefined;

/** A computed colour as it is, whatever notation the browser gives it in: its channels, and how opaque it is. */
function colour(css: string): [r: number, g: number, b: number, a: number] {
  const ctx = (dab ||= Object.assign(document.createElement('canvas'), { width: 1, height: 1 })).getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

/** Draw the SVG's paths as squares, on its canvas. */
function draw(svg: SVGSVGElement, w: Watched): void {
  w.frame = 0;
  const box = svg.getBoundingClientRect(), view = svg.viewBox.baseVal, n = w.square;
  if (!box.width || !box.height || !view.width || !view.height) return;
  const cols = Math.max(1, Math.round(box.width / n)) + 2 * PAD, rows = Math.max(1, Math.round(box.height / n)) + 2 * PAD, canvas = w.canvas;
  const ctx = canvas.getContext('2d'), mask = (scratch ||= document.createElement('canvas')), mctx = mask.getContext('2d', { willReadFrequently: true });
  if (!ctx || !mctx) return;
  if (canvas.width !== cols || canvas.height !== rows) { canvas.width = cols; canvas.height = rows; }
  // Where the SVG is in the plot, less the room about it, to whole squares of its own.
  const held = (svg.parentElement ?? svg).getBoundingClientRect();
  canvas.style.left = box.left - held.left - PAD * n + 'px'; canvas.style.top = box.top - held.top - PAD * n + 'px';
  canvas.style.width = cols * n + 'px'; canvas.style.height = rows * n + 'px';
  mask.width = cols; mask.height = rows;
  const sx = box.width / view.width / n, sy = box.height / view.height / n, place = new DOMMatrix([sx, 0, 0, sy, PAD - view.x * sx, PAD - view.y * sy]);
  const out = ctx.createImageData(cols, rows), cells = new Uint32Array(out.data.buffer);
  for (const path of svg.querySelectorAll('path')) {
    const d = path.getAttribute('d'), style = getComputedStyle(path);
    if (!d || style.display === 'none' || style.visibility === 'hidden') continue;
    const filled = style.fill !== 'none', [r, g, b, a] = colour(filled ? style.fill : style.stroke), on = PATTERNS[pattern(a * Number(style.opacity || 1))];
    // A shape replaces what was under it: where its pattern is off, so is the square. Little-endian, as every screen is.
    const lit = (255 << 24 | b << 16 | g << 8 | r) >>> 0;
    // Walk the path with a square brush, setting every square it passes through. Half a square a step, so none is
    // missed, and the brush hangs about the path's middle.
    const walk = (size: number, set: (x: number, y: number) => number) => {
      const back = (size - 1) / 2, length = path.getTotalLength(), stride = 0.5 / Math.max(sx, sy);
      for (let at = 0, last = -1; at <= length; at += stride) {
        const p = path.getPointAtLength(at), x0 = Math.round(p.x * sx + place.e - 0.5 - back), y0 = Math.round(p.y * sy + place.f - 0.5 - back);
        if (y0 * cols + x0 === last) continue;
        last = y0 * cols + x0;
        for (let y = Math.max(0, y0); y < Math.min(rows, y0 + size); y++) for (let x = Math.max(0, x0); x < Math.min(cols, x0 + size); x++) cells[y * cols + x] = set(x, y);
      }
    };
    const width = style.stroke === 'none' ? 0 : parseFloat(style.strokeWidth) || 0;
    if (!filled) { walk(brush(width || 1, n), (x, y) => (on(x, y) ? lit : 0)); continue; }
    const shape = new Path2D(); shape.addPath(new Path2D(d), place);
    mctx.clearRect(0, 0, cols, rows); mctx.fill(shape);
    const covered = mctx.getImageData(0, 0, cols, rows).data;
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) if (covered[i * 4 + 3]! > 127) cells[i] = on(x, y) ? lit : 0;
    // A shape with an edge of its own, a segment of a pie, is parted from the next by it: squares off along the edge,
    // as wide as the edge all the way, where two fills that only meet leave a gap as uneven as their corners.
    if (width) walk(Math.max(1, Math.round(width / n)), () => 0);
  }
  ctx.putImageData(out, 0, 0);
  svg.setAttribute('data-pixels', '');
}

/** Keep a canvas beside an SVG, drawn again when the SVG or its box changes. */
function watch(svg: SVGSVGElement, square: number): void {
  const was = watched.get(svg);
  if (was) { if (was.square !== square) { was.square = square; draw(svg, was); } return; }
  const canvas = document.createElement('canvas');
  canvas.className = 'uav-pixels'; canvas.setAttribute('aria-hidden', 'true');
  svg.after(canvas);
  const again = () => { w.frame ||= requestAnimationFrame(() => draw(svg, w)); };
  const changes = new MutationObserver(again), sizes = new ResizeObserver(again);
  const w: Watched = { canvas, square, frame: 0, stop: () => { changes.disconnect(); sizes.disconnect(); cancelAnimationFrame(w.frame); canvas.remove(); svg.removeAttribute('data-pixels'); } };
  changes.observe(svg, { subtree: true, childList: true, attributes: true, attributeFilter: ['d', 'style', 'class', 'data-fill', 'stroke-width', 'stroke-dasharray', 'opacity', 'viewBox'] });
  sizes.observe(svg);
  watched.set(svg, w);
  draw(svg, w);
}

/** Set a plot on whole device px of the screen. Whatever is above and beside a view puts its plot at a fraction of a
 * px, and then nothing in it is sharp however whole its own places are. The plot and its axes are moved by what is
 * left over, together, which changes no size. What the plot's place would be unmoved is where it is, less the move. */
function settle(fig: HTMLElement, on: boolean): void {
  const plot = on ? fig.querySelector('.uav-plot') : null, was = ['--uav-nx', '--uav-ny'].map((name) => parseFloat(fig.style.getPropertyValue(name)) || 0);
  if (!plot) { fig.style.removeProperty('--uav-nx'); fig.style.removeProperty('--uav-ny'); return; }
  const box = plot.getBoundingClientRect(), dpr = fig.ownerDocument.defaultView?.devicePixelRatio || 1;
  [box.left - was[0]!, box.top - was[1]!].forEach((at, i) => {
    const move = Math.round(at * dpr) / dpr - at;
    if (Math.abs(move - was[i]!) > 0.005) fig.style.setProperty(i ? '--uav-ny' : '--uav-nx', move.toFixed(3) + 'px');
  });
}

/** Read the square, and give every SVG of marks in the figure its canvas, or take them away where the look is off. */
export function pixels(fig: HTMLElement): void {
  let probe = fig.querySelector<HTMLElement>(':scope > .uav-pixel');
  if (!probe) { probe = fig.appendChild(document.createElement('i')); probe.className = 'uav-pixel'; probe.setAttribute('aria-hidden', 'true'); }
  const n = Math.round(probe.getBoundingClientRect().width * 4) / 4, on = n > 0 && typeof ResizeObserver === 'function' && typeof Path2D === 'function' && typeof DOMMatrix === 'function';
  if (on) fig.dataset.px = String(n); else delete fig.dataset.px;
  for (const svg of fig.querySelectorAll<SVGSVGElement>(':is(.uav-plot, .uav-radial) > svg')) {
    if (on) watch(svg, n); else { watched.get(svg)?.stop(); watched.delete(svg); }
  }
  settle(fig, on);
}
