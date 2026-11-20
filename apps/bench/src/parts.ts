import { UaView } from '@unified-analytics/dom';
import { catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { el } from './page.ts';
import { resizable } from './resizer.ts';
import { boxIn, register, samples } from './setup.ts';

/* The parts bench: one view at a time, at a ladder of widths, in light and in dark, with one of its parts picked out.
 * The page holds the controls and a half for each theme; each half is this page again, embedded, with its theme handed
 * to it in the URL (theme-boot.js). Every control lives in the URL, so a reload or a link reopens the same view. */
register();

const WIDTHS = [480, 346, 250, 170, 120, 80, 40];
/* Each part of a scene is drawn under a class of its name (core's `Part`), and the readout chip is one more. */
const PARTS = ['number', 'plot', 'x-axis', 'y-axis', 'y-axis-2', 'labels', 'columns', 'rows', 'band', 'legend', 'legend-top', 'radial', 'hole', 'rim',
  'ramp', 'notice', 'points', 'point-labels', 'size', 'note', 'unit-key', 'readout'];

const params = new URLSearchParams(location.search), embed = params.has('embed');
const controls = document.querySelector<HTMLFormElement>('#controls')!, main = document.querySelector('main')!;
const pick = (name: string, options: [string, string][]) => {
  const select = controls.querySelector<HTMLSelectElement>(`[name="${name}"]`)!;
  for (const [value, label] of options) select.add(new Option(label, value));
};
pick('sample', Object.entries(samples).map(([name, s]) => [name, s.label]));
pick('part', [['', 'none'], ...PARTS.map((p): [string, string] => [p, p])]);
for (const [k, v] of params) {
  const input = controls.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${k}"]`);
  if (input instanceof HTMLSelectElement) input.value = v;
  else controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`)?.click();
}
const state = () => Object.fromEntries(new FormData(controls)) as { sample: string; part: string; scenario: Scenario; height: string };

/** The bench's own rule inside a view: the picked part outlined, everything that neither holds it nor is in it faded. */
function focus(view: UaView, part: string): void {
  const root = view.shadowRoot;
  if (!root) return;
  const sheet = new CSSStyleSheet(), p = `.uav-${part}`;
  if (part) sheet.replaceSync(`.uav :not(:has(${p}), ${p}, ${p} *) { opacity: .15; } ${p} { outline: 1px dashed #e0306a; outline-offset: 1px; }`);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets.filter((s) => !(s as CSSStyleSheet & { bench?: true }).bench), Object.assign(sheet, { bench: true })];
}

type Box = [x: number, y: number, w: number, h: number];
interface PartMeasure { box: Box; /** Reaches past the frame. */ outside: boolean; /** The most, in px, by which something in it holds more than its box shows: 0 when nothing is cut. */ clipped: number; /** Lines cut short with an ellipsis. */ ellipsis: number }
export interface FrameMeasure { width: number; height: number; parts: Record<string, PartMeasure>; /** Parts whose boxes cross, where neither holds the other. */ overlaps: [string, string][] }

/** What shows in a frame once the container and the measured pass have had their say, in px from the frame's corner.
 * The readout under each frame and the capture script (capture.ts) both read this. */
function measure(frame: HTMLElement): FrameMeasure {
  const f = frame.getBoundingClientRect(), root = frame.querySelector('ua-view')?.shadowRoot, parts: Record<string, PartMeasure> = {}, els: Record<string, Element[]> = {};
  for (const p of PARTS) {
    const shown = [...(root?.querySelectorAll(`.uav-${p}`) ?? [])].filter((n) => n.checkVisibility({ visibilityProperty: true }) && n.getBoundingClientRect().width > 0);
    if (!shown.length) continue;
    const rects = shown.map((n) => n.getBoundingClientRect());
    const x0 = Math.min(...rects.map((r) => r.left)), y0 = Math.min(...rects.map((r) => r.top)), x1 = Math.max(...rects.map((r) => r.right)), y1 = Math.max(...rects.map((r) => r.bottom));
    const inner = shown.flatMap((n) => [n, ...n.querySelectorAll('*')]).filter((n): n is HTMLElement => n instanceof HTMLElement && n.checkVisibility({ visibilityProperty: true }));
    // A box of a pixel or none is text kept for a screen reader, not cut.
    const over = (n: HTMLElement) => n.clientWidth <= 1 && n.clientHeight <= 1 ? 0 : Math.max(n.scrollWidth - n.clientWidth, n.scrollHeight - n.clientHeight, 0);
    parts[p] = {
      box: [x0 - f.left, y0 - f.top, x1 - x0, y1 - y0].map(Math.round) as Box,
      outside: x0 < f.left - .5 || y0 < f.top - .5 || x1 > f.right + .5 || y1 > f.bottom + .5,
      clipped: Math.max(0, ...inner.filter((n) => getComputedStyle(n).overflow !== 'visible').map(over)),
      ellipsis: inner.filter((n) => getComputedStyle(n).textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1).length,
    };
    els[p] = shown;
  }
  const names = Object.keys(parts), overlaps: [string, string][] = [];
  const nested = (a: string, b: string) => els[a]!.some((x) => els[b]!.some((y) => x.contains(y) || y.contains(x)));
  for (const [i, a] of names.entries()) for (const b of names.slice(i + 1)) {
    const [ax, ay, aw, ah] = parts[a]!.box, [bx, by, bw, bh] = parts[b]!.box;
    if (Math.min(ax + aw, bx + bw) - Math.max(ax, bx) > 1 && Math.min(ay + ah, by + bh) - Math.max(ay, by) > 1 && !nested(a, b)) overlaps.push([a, b]);
  }
  return { width: Math.round(f.width), height: Math.round(f.height), parts, overlaps };
}
Object.assign(window, { benchMeasure: measure });

/** What the frame says under it: its size, and the parts that show there, with a mark on any that is cut. */
function readout(frame: HTMLElement, caption: HTMLElement): void {
  const m = measure(frame), cut = (p: PartMeasure) => p.outside || p.clipped > 1 || p.ellipsis ? '✂' : '';
  caption.textContent = `${m.width} × ${m.height} · ${Object.entries(m.parts).map(([p, v]) => p + cut(v)).join(' ') || 'nothing'}`;
}

if (!embed) {
  // The page itself: a half for each theme, each as tall as what it holds, so this page scrolls them together.
  const halves = ['light', 'dark'].map((theme) => {
    const frame = el('iframe');
    frame.title = theme;
    frame.addEventListener('load', () => { const root = frame.contentDocument!.documentElement; new ResizeObserver(() => { frame.style.blockSize = root.scrollHeight + 'px'; }).observe(root); });
    main.append(el('h2', '', theme), frame);
    return [theme, frame] as const;
  });
  const apply = () => {
    const query = new URLSearchParams(state());
    history.replaceState(null, '', '?' + query);
    for (const [theme, frame] of halves) frame.src = '?' + query + '&embed&theme=' + theme;
  };
  controls.addEventListener('change', apply);
  apply();
} else {
  document.body.classList.add('embed');
  const { sample, part, scenario, height } = state(), spec = samples[sample]!.spec;
  const strip = el('div', 'strip');
  for (const w of [...WIDTHS, 0]) {
    const cell = el('div', 'cell'), frame = el('div', 'frame'), caption = el('p', 'meta'), view = new UaView();
    // The last frame is the free one: as wide as the page, and dragged from its corner.
    frame.dataset.width = w ? String(w) : 'free';
    if (w) frame.style.inlineSize = w + 'px'; else cell.classList.add('free');
    boxIn(frame, height);
    resizable(frame);
    view.catalog = catalog; view.spec = spec;
    try { view.result = runQuery(spec.query, scenario); } catch (e) { caption.className = 'meta error'; caption.textContent = (e as Error).message; }
    frame.prepend(view);
    cell.append(frame, caption);
    strip.append(cell);
    // The view paints, then fits on the next frame or two; read it once that has settled, and again at every new size.
    new ResizeObserver(() => requestAnimationFrame(() => requestAnimationFrame(() => { focus(view, part); readout(frame, caption); }))).observe(frame);
  }
  main.append(strip);
}
