import { buildScene, expand, hasOf, resolve, type Catalog, type Result, type Spec } from '@unified-analytics/core';
import { UaView } from '@unified-analytics/dom';
import { catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { el } from './page.ts';
import { resizable } from './resizer.ts';
import { boxIn, focus, register, samples } from './setup.ts';

/* The parts bench: one view at a time, at a ladder of widths, in light and in dark, with one of its parts picked out.
 * The page holds the controls and a half for each theme; each half is this page again, embedded, with its theme handed
 * to it in the URL (theme-boot.js). Every control lives in the URL, so a reload or a link reopens the same view. */
register();

const WIDTHS = [480, 346, 250, 170, 120, 80, 40];
/* Each part of a scene is drawn under a class of its name (core's `Part`), and the readout chip is one more. */
const PARTS = ['number', 'plot', 'x-axis', 'y-axis', 'y-axis-2', 'labels', 'columns', 'rows', 'band', 'legend', 'legend-top', 'radial', 'hole', 'rim',
  'ramp', 'notice', 'points', 'point-labels', 'size', 'note', 'unit-key', 'track', 'readout'];

/** A view handed in from outside the page, which the capture does for `spec=<file>` (capture.ts): a spec, and with it
 * the answer and the catalog it is drawn against where those are not the fixtures'. It joins the samples under its name. */
const given = (window as unknown as { benchGiven?: { name: string; spec: Spec; result?: Result; catalog?: Catalog } }).benchGiven;
if (given) samples[given.name] = { label: given.name, spec: given.spec };

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
      // Text cut short with an ellipsis is counted as that, not as clipped.
      clipped: Math.max(0, ...inner.filter((n) => getComputedStyle(n).overflow !== 'visible' && getComputedStyle(n).textOverflow !== 'ellipsis').map(over)),
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
  // And why: what the view says changed here from its plan with no limits, by the rule or the measured pass that did it. The whole of it on hover.
  const e = frame.querySelector<UaView>('ua-view')?.explain(), changed = e?.entries.filter((b) => b.what !== 'shown' && !b.what.startsWith('the layout')) ?? [];
  caption.textContent = `${m.width} × ${m.height} · ${Object.entries(m.parts).map(([p, v]) => p + cut(v)).join(' ') || 'nothing'}`
    + (changed.length ? ' · ' + changed.map((b) => `${b.part ? b.part + ' ' : ''}${b.what}${b.rule ? ` (${b.rule})` : ''}`).join(', ') : '');
  caption.title = e ? e.entries.map((b) => [b.part, b.what, b.from, b.why, b.lever].filter(Boolean).join(' · ')).join('\n') : '';
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
  // A view that was handed in is drawn on the answer and the catalog it came with, where it came with them.
  const mine = given?.name === sample ? given : undefined, cat = mine?.catalog ?? catalog, answer = () => mine?.result ?? runQuery(spec.query, scenario);
  // What the view plans with no limits: its layout and every part it can show. The capture keeps it beside the frames, for the checker.
  try {
    const result = answer(), plan = resolve(spec, result, cat), scene = buildScene(plan, spec.query, result, cat);
    // And what a fit rule may ask of the scene: what kind of view it is, and which parts it has anything for.
    Object.assign(window, { benchPlan: { layout: plan.layout, parts: scene.parts, keep: expand(spec).keep ?? [], marks: (expand(spec).layers ?? []).map((l) => l.mark), has: hasOf(scene), drawn: [...new Set(scene.nodes.map((n) => n.part))] } });
  } catch { /* the frames say what went wrong */ }
  const strip = el('div', 'strip');
  for (const w of [...WIDTHS, 0]) {
    const cell = el('div', 'cell'), frame = el('div', 'frame'), caption = el('p', 'meta'), view = new UaView();
    // The last frame is the free one: as wide as the page, and dragged from its corner.
    frame.dataset.width = w ? String(w) : 'free';
    if (w) frame.style.inlineSize = w + 'px'; else cell.classList.add('free');
    boxIn(frame, height);
    resizable(frame);
    view.catalog = cat; view.spec = spec;
    try { view.result = answer(); } catch (e) { caption.className = 'meta error'; caption.textContent = (e as Error).message; }
    frame.prepend(view);
    cell.append(frame, caption);
    strip.append(cell);
    // The view paints, then fits on the next frame or two; read it once that has settled, and again at every new size.
    new ResizeObserver(() => requestAnimationFrame(() => requestAnimationFrame(() => { focus(view, part); readout(frame, caption); }))).observe(frame);
  }
  main.append(strip);
}
