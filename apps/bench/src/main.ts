import { buildScene, makeContainer, resolve } from '@universal-analytics/core';
import { catalog, runQuery, samples, type Scenario } from '@universal-analytics/fixtures';
import { paintSVG } from './paint-svg.ts';

/* The bench: every sample, in frames that stand in for containers.
 * Controls live in the URL, so a reload or a shared link keeps them. */
const WIDTHS = [346, 250, 170, 120, 80];
const controls = document.querySelector<HTMLFormElement>('#controls')!;
const views = document.querySelector('#views')!;

const params = new URLSearchParams(location.search);
for (const [k, v] of params) { const input = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`); if (input) input.checked = true; }
const state = () => Object.fromEntries(new FormData(controls)) as { scenario: Scenario; height: string; theme: string };

function paint(frame: HTMLElement) {
  const { scenario, height } = state(), spec = samples[frame.dataset.sample!]!.spec;
  const svg = frame.querySelector('svg')!, caption = frame.querySelector('figcaption')!;
  const width = Math.floor(frame.clientWidth - parseFloat(getComputedStyle(frame).paddingInline) * 2);
  try {
    const container = makeContainer(width, Number(height) || null), result = runQuery(spec.query, scenario);
    const plan = resolve(spec, result, container, catalog);
    paintSVG(svg, buildScene(plan, spec.query, result, container, catalog));
    caption.className = '';
    caption.textContent = width + ' px · ' + plan.layout + (plan.dropped.length ? ' · dropped: ' + plan.dropped.join(', ') : '') + ' · ' + plan.text;
  } catch (e) {
    caption.className = 'error';
    caption.textContent = (e as Error).message;
  }
}

const resized = new ResizeObserver((entries) => entries.forEach((e) => paint(e.target as HTMLElement)));
for (const [name, sample] of Object.entries(samples)) {
  const h2 = document.createElement('h2'), small = document.createElement('small'), sizes = document.createElement('div');
  h2.textContent = sample.label + ' '; small.textContent = JSON.stringify(sample.spec); h2.append(small);
  sizes.className = 'sizes';
  for (const w of WIDTHS) {
    const frame = document.createElement('figure');
    frame.className = 'frame'; frame.dataset.sample = name; frame.style.inlineSize = w + 'px';
    frame.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'), document.createElement('figcaption'));
    sizes.append(frame);
    resized.observe(frame);
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
