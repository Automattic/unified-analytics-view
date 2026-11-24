import { expand, facets, resolve, select, type Proposal, type Spec } from '@unified-analytics/core';
import { UaView } from '@unified-analytics/dom';
import { catalog, runQuery, type Scenario } from '@unified-analytics/fixtures';
import { resizable } from './resizer.ts';
import { boxIn, faceted, focus, register, samples as plain } from './setup.ts';

// Every sample, and after them the ones with a facet.
const samples = { ...plain, ...faceted };

/* The playground: write a spec, see the view it makes on the fixture engine. The spec and the controls live in the
 * URL's hash, so a reload or a shared link keeps them. */
register();

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const controls = $<HTMLFormElement>('#controls'), editor = $<HTMLTextAreaElement>('#spec'), status = $('#status');
const frame = $('#frame'), plan = $('#plan'), rows = $('#rows'), picker = controls.querySelector('select')!;
const expanded = $<HTMLDetailsElement>('#expanded');
let written: Spec | undefined;
const why = $('#why ol');
// ponytail: the element says nothing when its measured pass is done, so the panel waits a moment after a change. An event from the element, if this ever reads a frame late.
let settle = 0;
const later = () => { clearTimeout(settle); settle = window.setTimeout(explainView, 120); };
const view = frame.appendChild(new UaView());
resizable(frame);
view.catalog = catalog;
// The host keeps the selection: what the view proposes is folded into the filter kept (core's select), which is set
// back on the view and said here, since it has no look yet.
const selected = $('#selected');
view.addEventListener('ua-select', (e) => { view.selected = select(view.selected, (e as CustomEvent<Proposal>).detail, catalog); selected.textContent = view.selected == null ? 'Nothing selected. Activate a point, with a click or Enter, to select it, and again to let it go. With Cmd or Ctrl it joins those selected; with Shift a run of days or bins reaches to it.' : 'Selected: ' + JSON.stringify(view.selected); });
view.dispatchEvent(new CustomEvent('ua-select', { detail: { key: null, where: {} } }));

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
    // A facet has no one plan: it is a view for each value, and the first of them is the one planned here.
    const views = spec.facet != null ? facets(spec, result, catalog) : null, p = views ? resolve(views[0]!.spec, views[0]!.result, catalog) : resolve(spec, result, catalog);
    view.spec = spec; view.result = result;
    // A preset is shorthand for layers: core's expand() writes them out, as the plan does before it reads them.
    written = spec.use ? expand(spec) : undefined;
    expanded.hidden = !written;
    if (written) expanded.querySelector('pre')!.textContent = JSON.stringify(written.layers, null, 2);
    editor.removeAttribute('aria-invalid'); status.className = 'meta'; status.textContent = 'OK';
    plan.textContent = (views ? 'a facet: ' + views.length + ' views, one for each value of "' + spec.facet + '", on the same scales · the first ' : '') + 'planned with no limits: ' + p.layout + ' · ' + p.text;
    rows.textContent = JSON.stringify(result.rows, null, 1);
    later();
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

/* Why the view looks as it does, from the view itself (UaView.explain): read again whenever the frame changes size, once
 * the measured pass has run. Pointing at an entry picks its part out in the view. */
function explainView() {
  why.replaceChildren(...view.explain().entries.map((b) => {
    const li = document.createElement('li');
    li.innerHTML = '<b></b> <span></span> <code></code><span class="meta"></span>' + (b.lever ? '<em></em>' : '');
    const [part, what, from, because, lever] = li.children as unknown as HTMLElement[];
    part!.textContent = b.part ?? ''; what!.textContent = b.what; from!.textContent = b.from; because!.textContent = b.why;
    if (lever) lever.textContent = b.lever!;
    if (b.part) { li.dataset.part = b.part; li.addEventListener('pointerenter', () => focus(view, b.part!)); li.addEventListener('pointerleave', () => focus(view, '')); }
    return li;
  }));
}
new ResizeObserver(later).observe(frame);
