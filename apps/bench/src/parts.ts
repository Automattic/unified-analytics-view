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

/** What the frame says under it: its size, and the parts that show there once the container and the measured pass have had their say. */
function readout(frame: HTMLElement, view: UaView, caption: HTMLElement): void {
  const { width, height } = frame.getBoundingClientRect(), root = view.shadowRoot;
  const shown = PARTS.filter((p) => [...(root?.querySelectorAll(`.uav-${p}`) ?? [])].some((n) => n.checkVisibility() && n.getBoundingClientRect().width > 0));
  caption.textContent = `${Math.round(width)} × ${Math.round(height)} · ${shown.join(' ') || 'nothing'}`;
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
    if (w) frame.style.inlineSize = w + 'px'; else cell.classList.add('free');
    boxIn(frame, height);
    resizable(frame);
    view.catalog = catalog; view.spec = spec;
    try { view.result = runQuery(spec.query, scenario); } catch (e) { caption.className = 'meta error'; caption.textContent = (e as Error).message; }
    frame.prepend(view);
    cell.append(frame, caption);
    strip.append(cell);
    // The view paints, then fits on the next frame or two; read it once that has settled, and again at every new size.
    new ResizeObserver(() => requestAnimationFrame(() => requestAnimationFrame(() => { focus(view, part); readout(frame, view, caption); }))).observe(frame);
  }
  main.append(strip);
}
