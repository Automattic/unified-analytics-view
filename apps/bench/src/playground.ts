import { expand, resolve, unboundedContainer, type Spec } from '@unified-analytics/core';
import { UaView } from '@unified-analytics/dom';
import { catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { resizable } from './resizer.ts';
import { boxIn, register, samples } from './setup.ts';

/* The playground: write a spec, see the view it makes on the fixture engine. The spec and the controls live in the
 * URL's hash, so a reload or a shared link keeps them. */
register();

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const controls = $<HTMLFormElement>('#controls'), editor = $<HTMLTextAreaElement>('#spec'), status = $('#status');
const frame = $('#frame'), plan = $('#plan'), rows = $('#rows'), picker = controls.querySelector('select')!;
const expanded = $<HTMLDetailsElement>('#expanded');
let written: Spec | undefined;
const view = frame.appendChild(new UaView());
resizable(frame);
view.catalog = catalog;

for (const [name, s] of Object.entries(samples)) picker.add(new Option(s.label, name));
// What a query can ask for: every metric and dimension, by the name a spec uses.
const list = (title: string, defs: Record<string, { label: string }>) =>
  '<h3>' + title + '</h3>' + Object.entries(defs).map(([k, d]) => `<p><code>${k}</code> ${d.label}</p>`).join('');
$('#catalog').innerHTML = list('Metrics', catalog.metrics) + list('Dimensions', catalog.dimensions);

const pretty = (spec: Spec) => JSON.stringify(spec, null, 2);
const hash = new URLSearchParams(location.hash.slice(1));
for (const [k, v] of hash) { const input = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${CSS.escape(v)}"]`); if (input) input.checked = true; }
picker.value = hash.get('sample') ?? (hash.has('spec') ? '' : 'trend');
editor.value = hash.get('spec') ?? pretty(samples[picker.value]!.spec);

function apply() {
  const { scenario, height } = Object.fromEntries(new FormData(controls)) as { scenario: Scenario; height: string };
  boxIn(frame, height);
  const keep = new URLSearchParams({ scenario, height });
  // A sample unedited is kept by its name, so the link stays short; anything else by its text.
  if (picker.value) keep.set('sample', picker.value); else keep.set('spec', editor.value);
  history.replaceState(null, '', '#' + keep);
  let spec: Spec;
  try { spec = JSON.parse(editor.value); } catch (e) { return fail('Not JSON yet: ' + (e as Error).message); }
  try {
    const result = runQuery(spec.query, scenario);
    // Planned here first, so a spec the core refuses says why in the status line, and the last good view stays up.
    const p = resolve(spec, result, unboundedContainer(), catalog);
    view.spec = spec; view.result = result;
    // A preset is shorthand for layers: core's expand() writes them out, as the plan does before it reads them.
    written = spec.use ? expand(spec) : undefined;
    expanded.hidden = !written;
    if (written) expanded.querySelector('pre')!.textContent = JSON.stringify(written.layers, null, 2);
    editor.removeAttribute('aria-invalid'); status.className = 'meta'; status.textContent = 'OK';
    plan.textContent = 'planned with no limits: ' + p.layout + ' · ' + p.text;
    rows.textContent = JSON.stringify(result.rows, null, 1);
  } catch (e) { fail((e as Error).message); }
}
function fail(message: string) {
  editor.setAttribute('aria-invalid', 'true'); status.className = 'meta error'; status.textContent = message;
}

let timer = 0;
editor.addEventListener('input', () => { picker.value = ''; clearTimeout(timer); timer = window.setTimeout(apply, 250); });
picker.addEventListener('change', () => { if (picker.value) editor.value = pretty(samples[picker.value]!.spec); });
expanded.querySelector('button')!.addEventListener('click', () => { editor.value = pretty(written!); picker.value = ''; apply(); });
controls.addEventListener('change', apply);
apply();
