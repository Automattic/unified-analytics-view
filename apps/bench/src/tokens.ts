/* Every custom property the token stylesheet declares, read from the page's own
 * stylesheets, so this page cannot drift from what ships. Values follow the theme. */
const root = document.documentElement;
const main = document.querySelector('#tokens')!;

/** Name to declared value, in source order, as the cascade leaves it for the current theme. */
function declared(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (rules: CSSRuleList) => {
    for (const r of rules) {
      if (r instanceof CSSMediaRule) { if (matchMedia(r.conditionText).matches) walk(r.cssRules); }
      else if (r instanceof CSSStyleRule && root.matches(r.selectorText)) {
        for (const name of r.style) if (/^--(ua|a8c)-/.test(name)) out.set(name, r.style.getPropertyValue(name).trim());
      }
    }
  };
  for (const sheet of document.styleSheets) walk(sheet.cssRules);
  return out;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
/** `var(--ua-color-neutral-300)` reads as `neutral-300`. */
const short = (v: string) => v.replace(/var\(--ua-(?:color-)?([a-z0-9-]+)\)/g, '$1');
const px = (n: number) => (Math.round(n * 10) / 10) + ' px';

let measures: (() => void)[] = [];
const resized = new ResizeObserver(() => measures.forEach((m) => m()));

function swatch(name: string) {
  const s = el('span', 'swatch');
  s.style.setProperty('--c', `var(${name})`);
  return s;
}
function section(title: string, note: string, body: HTMLElement) {
  const h2 = el('h2', '', title + ' ');
  h2.append(el('small', '', note));
  main.append(h2, body);
}
/** A frame with a width of its own. The fluid scales are sized in cqi, so they follow it. */
function fluid() {
  const f = el('div', 'frame fluid');
  resized.observe(f);
  return f;
}

function render() {
  const all = declared(), take = (re: RegExp) => { const hit = [...all].filter(([n]) => re.test(n)); hit.forEach(([n]) => all.delete(n)); return hit; };
  measures = [];
  main.replaceChildren();

  const ramps = new Map<string, [string, string][]>();
  for (const [name, value] of [...all]) {
    const m = /^--ua-color-([a-z-]+)-(\d+)$/.exec(name);
    if (!m || value[0] !== '#') continue;
    if (!ramps.has(m[1]!)) ramps.set(m[1]!, []);
    ramps.get(m[1]!)!.push([name, value]);
    all.delete(name);
  }
  const rampGrid = el('div', 'ramps');
  for (const [ramp, steps] of ramps) {
    rampGrid.append(el('b', '', ramp));
    for (const [name, value] of steps) {
      const cell = el('div', 'step');
      cell.title = name;
      cell.append(swatch(name), el('span', '', name.slice(name.lastIndexOf('-') + 1)), el('small', '', value));
      rampGrid.append(cell);
    }
  }
  rampGrid.style.setProperty('--steps', String(Math.max(0, ...[...ramps.values()].map((steps) => steps.length))));
  section('Colour ramps', 'base tier, from Leonardo', rampGrid);

  const chips = (entries: [string, string][], prefix: string) => {
    const grid = el('div', 'chips');
    for (const [name, value] of entries) {
      const chip = el('div', 'chip'), text = el('div');
      chip.title = name;
      text.append(el('span', '', name.replace(prefix, '')), el('small', '', short(value)));
      chip.append(swatch(name), text);
      grid.append(chip);
    }
    return grid;
  };
  section('Outside the ramps', 'base tier: white, black and the constants, the same in both themes', chips(take(/^--ua-color-(white|black|constant-)/), '--ua-color-'));
  section('Surfaces', 'base tier: the page and the levels that rise from it, a value per theme', chips(take(/^--ua-color-surface-/), '--ua-color-'));
  section('Common colours', 'named roles, aliased into the base tier', chips(take(/^--ua-color-/), '--ua-color-'));
  section('Chart paint', 'the charts tier: what a view reads, aliased into the tiers above', chips(take(/^--ua-charts-color-/), '--ua-charts-color-'));

  const type = fluid();
  for (const [name, value] of take(/^--ua-font-size-/)) {
    const row = el('div', 'type'), sample = el('span', '', 'Visitors 10.5k'), meta = el('small');
    sample.style.fontSize = `var(${name})`;
    measures.push(() => { meta.textContent = name.replace('--ua-', '') + ' · ' + px(parseFloat(getComputedStyle(sample).fontSize)) + ' · ' + value; });
    row.append(sample, meta);
    type.append(row);
  }
  section('Type', 'fluid with the container: drag the corner', type);

  const bars = (entries: [string, string][]) => {
    const f = fluid();
    for (const [name, value] of entries) {
      const row = el('div', 'bar'), bar = el('i'), meta = el('small');
      bar.style.inlineSize = `var(${name})`;
      measures.push(() => { meta.textContent = px(bar.getBoundingClientRect().width) + ' · ' + short(value); });
      row.append(el('span', '', name.replace('--ua-', '')), bar, meta);
      f.append(row);
    }
    return f;
  };
  section('Space', 'fluid steps and pairs', bars(take(/^--ua-space-/)));
  section('Spacing', "Spacefast's 4 px scale, aliased into space", bars(take(/^--ua-spacing-/)));
  section('Control sizes', 'multiples of the base font', bars(take(/^--ua-size-/)));

  const radii = el('div', 'chips');
  for (const [name, value] of take(/^--ua-radius-/)) {
    const chip = el('div', 'chip'), box = el('span', 'radius'), text = el('div');
    box.style.borderRadius = `var(${name})`;
    text.append(el('span', '', name.replace('--ua-', '')), el('small', '', value));
    chip.append(box, text);
    radii.append(chip);
  }
  section('Radius', '', radii);

  // Elevation is seen as a container on a surface: sunk into it, flat, or standing above it. The light is the materials' below.
  const ORDER = ['inset', '0', '1', '2', '3'];
  const levels = el('div', 'elevations');
  for (const [name, value] of take(/^--ua-elevation-/).sort(([a], [b]) => ORDER.indexOf(a.slice(15)) - ORDER.indexOf(b.slice(15)))) {
    const fig = el('figure'), box = el('div', 'elevation'), level = name.slice(15);
    box.style.boxShadow = `var(${name})`;
    if (level === 'inset') box.classList.add('sunk');
    box.append(el('b', '', level === 'inset' ? '−1' : level));
    fig.append(box, el('span', '', name.replace('--ua-', '')), el('small', '', level === '0' ? 'flat, the default' : value.split('),').length + ' shadows'));
    levels.append(fig);
  }
  section('Elevation', 'how far a container stands from its surface; shadows fall away from the light, which the Light control moves', levels);

  const light = el('div', 'chips');
  for (const [name, value] of take(/^--ua-(light|crystal|grain|frost)/)) { const chip = el('div', 'chip'), text = el('div'); text.append(el('span', '', name.replace('--ua-', '')), el('small', '', value.length > 60 ? value.slice(0, 40) + '…' : value)); chip.append(text); light.append(chip); }
  section('Light and materials', 'the light model and what each material is tuned by; the materials are at the foot of the page', light);

  // Whatever no section claimed still shows, so a new kind of token is never hidden.
  if (all.size) {
    const rest = el('div', 'chips');
    for (const [name, value] of all) { const chip = el('div', 'chip'), text = el('div'); text.append(el('span', '', name), el('small', '', value)); chip.append(text); rest.append(chip); }
    section('Other', 'not yet given a visualization', rest);
  }
  measures.forEach((m) => m());
}

// The page follows the system's theme, and reads the tokens again when it turns.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
render();
