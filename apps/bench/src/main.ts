import { buildScene, resolve, unboundedContainer } from '@unified-analytics/core';
import { UaView, defineUaView, registerPainter, surfaceSheet } from '@unified-analytics/dom';
import { catalog, moreSamples, runQuery, samples as known, type Scenario } from '@unified-analytics/fixtures';
import { geoPainter, geoPainterAs } from '@unified-analytics/geo/dom';

/* The bench: every sample, in frames that stand in for containers.
 * Controls live in the URL, so a reload or a shared link keeps them. */
const WIDTHS = [346, 250, 170, 120, 80];
const samples = { ...known, ...moreSamples };
const controls = document.querySelector<HTMLFormElement>('#controls')!;
const views = document.querySelector('#views')!;

const params = new URLSearchParams(location.search);
for (const [k, v] of params) { const input = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`); if (input) input.checked = true; }
const state = () => Object.fromEntries(new FormData(controls)) as { scenario: Scenario; range: string; height: string; theme: string };

// The surface layouts are the surface's to adopt. Here the page is the surface, and each frame a stack or a row of one.
defineUaView();
// The `geo` mark is registered in code, in two halves. The fixtures hand core's half its boundary shapes; this is the DOM's.
registerPainter(geoPainter);
// The tile maps are the same mark, registered by the fixtures under a name for each set of tiles: a painter for each name.
for (const name of ['geo-tiles', 'geo-hexes']) registerPainter(geoPainterAs(name));
document.adoptedStyleSheets.push(surfaceSheet());

function paint(frame: HTMLElement) {
  const { scenario, range, height } = state(), sample = samples[frame.dataset.sample!]!.spec;
  // The range changes how many rows come back, which is what shows keys entering and leaving. A query with none keeps none.
  const spec = sample.query.range ? { ...sample, query: { ...sample.query, range } } : sample;
  const caption = frame.nextElementSibling!, boxed = !!Number(height);
  // With a height the view is handed a box, as a row or a tile would hand it one.
  frame.classList.toggle('ua-row', boxed); frame.classList.toggle('ua-stack', !boxed);
  frame.style.blockSize = boxed ? height + 'px' : '';
  try {
    const result = runQuery(spec.query, scenario);
    caption.className = 'meta';
    // Planned once, with no limits. Nothing here runs when the frame is resized, so the caption says only what the plan holds.
    const view = (frame.firstElementChild as UaView | null) ?? frame.appendChild(new UaView());
    view.spec = spec; view.result = result; view.catalog = catalog;
    const plan = resolve(spec, result, unboundedContainer(), catalog), scene = buildScene(plan, spec.query, result, catalog);
    caption.textContent = 'planned with no limits: ' + plan.layout + ', parts ' + scene.parts.join(', ') + ' · CSS decides what shows at this size · ' + plan.text;
  } catch (e) {
    caption.className = 'meta error';
    caption.textContent = (e as Error).message;
  }
}

for (const [name, sample] of Object.entries(samples)) {
  const h2 = document.createElement('h2'), small = document.createElement('small'), sizes = document.createElement('div');
  h2.textContent = sample.label + ' '; small.textContent = JSON.stringify(sample.spec); h2.append(small);
  sizes.className = 'sizes';
  for (const w of WIDTHS) {
    // The frame is the container and holds nothing but the view. What the bench says about it sits outside.
    const cell = document.createElement('div'), frame = document.createElement('div');
    cell.className = 'cell'; frame.className = 'frame'; frame.dataset.sample = name; frame.style.inlineSize = w + 'px';
    cell.append(frame, document.createElement('p'));
    sizes.append(cell);
  }
  views.append(h2, sizes);
}

function apply() {
  const s = state();
  if (s.theme) document.documentElement.dataset.theme = s.theme; else delete document.documentElement.dataset.theme;
  history.replaceState(null, '', '?' + new URLSearchParams(s));
  document.querySelectorAll<HTMLElement>('.frame').forEach(paint);
}
controls.addEventListener('change', apply);
apply();
