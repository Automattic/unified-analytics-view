import { buildScene, resolve, unboundedContainer } from '@unified-analytics/core';
import { UaView } from '@unified-analytics/dom';
import { catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { resizable } from './resizer.ts';
import { heading } from './page.ts';
import { boxIn, register, samples } from './setup.ts';

/* The bench: every sample, in frames that stand in for containers.
 * Controls live in the URL, so a reload or a shared link keeps them. */
const WIDTHS = [346, 250, 170, 120, 80];
const controls = document.querySelector<HTMLFormElement>('#controls')!;
const views = document.querySelector('#views')!;

const params = new URLSearchParams(location.search);
for (const [k, v] of params) { const input = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`); if (input) input.checked = true; }
const state = () => Object.fromEntries(new FormData(controls)) as { scenario: Scenario; range: string; height: string };

// The page is the surface, and each frame a stack or a row of one.
register();

function paint(frame: HTMLElement) {
  const { scenario, range, height } = state(), sample = samples[frame.dataset.sample!]!.spec;
  // The range changes how many rows come back, which is what shows keys entering and leaving. A query with none keeps none.
  const spec = sample.query.range ? { ...sample, query: { ...sample.query, range } } : sample;
  const caption = frame.nextElementSibling!;
  boxIn(frame, height);
  try {
    const result = runQuery(spec.query, scenario);
    caption.className = 'meta';
    // Planned once, with no limits. Nothing here runs when the frame is resized, so the caption says only what the plan holds.
    const view = frame.querySelector<UaView>('ua-view') ?? frame.appendChild(new UaView());
    view.spec = spec; view.result = result; view.catalog = catalog;
    const plan = resolve(spec, result, unboundedContainer(), catalog), scene = buildScene(plan, spec.query, result, catalog);
    caption.textContent = 'planned with no limits: ' + plan.layout + ', parts ' + scene.parts.join(', ') + ' · CSS decides what shows at this size · ' + plan.text;
  } catch (e) {
    caption.className = 'meta error';
    caption.textContent = (e as Error).message;
  }
}

for (const [name, sample] of Object.entries(samples)) {
  const h2 = heading(sample.label, JSON.stringify(sample.spec)), sizes = document.createElement('div');
  sizes.className = 'sizes';
  for (const w of WIDTHS) {
    // The frame is the container and holds nothing but the view. What the bench says about it sits outside.
    const cell = document.createElement('div'), frame = document.createElement('div');
    cell.className = 'cell'; frame.className = 'frame'; frame.dataset.sample = name; frame.style.inlineSize = w + 'px';
    resizable(frame);
    cell.append(frame, document.createElement('p'));
    sizes.append(cell);
  }
  views.append(h2, sizes);
}

function apply() {
  const s = state();
  history.replaceState(null, '', '?' + new URLSearchParams(s));
  document.querySelectorAll<HTMLElement>('.frame').forEach(paint);
}
controls.addEventListener('change', apply);
apply();
