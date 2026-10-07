/* The materials page: each material over the page and over each surface it has to sit on, at the sizes it has
 * to hold up at, under one light the controls move. The material's surface is material.css; this file builds
 * the stage and the lens filter. */
const root = document.documentElement;
const controls = document.querySelector<HTMLFormElement>('#controls')!;
const main = document.querySelector<HTMLElement>('#materials')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** The crystal's four layers, bottom to top. */
function crystal() {
  const c = el('div', 'ua-crystal');
  for (const layer of ['body', 'bevel', 'sheen', 'rim']) c.append(el('i', layer));
  return c;
}

/* ── The lens ──
 * Under the bevel, a point at radius r shows what lies at r − D·t^p, where t runs 0 to 1 across the bevel
 * (the prototype's rule, and its numbers). The flat is left alone and the bending starts with no kink.
 * It is an SVG filter per size, in pixels. The displacement map is drawn here on a canvas: red carries the
 * pull along x and green along y, mid-grey is no pull, and the filter's scale turns that into pixels.
 * Dispersion is the same bend three times, red a little less and blue a little more. */
const NS = 'http://www.w3.org/2000/svg', P = 1.7;
/** The map for a crystal `size` px across whose flat is `flat` of its radius. Full strength at the rim. */
function lensMap(size: number, flat: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!, img = ctx.createImageData(size, size), c = size / 2;
  for (let y = 0, i = 0; y < size; y++) for (let x = 0; x < size; x++, i += 4) {
    const dx = x + .5 - c, dy = y + .5 - c, r = Math.hypot(dx, dy) || 1;
    const pull = Math.min(1, Math.max(0, (r / c - flat) / (1 - flat))) ** P;      // toward the centre
    img.data[i] = 127.5 - 127.5 * pull * dx / r;
    img.data[i + 1] = 127.5 - 127.5 * pull * dy / r;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}
const lensSvg = document.body.appendChild(document.createElementNS(NS, 'svg'));
lensSvg.setAttribute('class', 'defs');
lensSvg.setAttribute('aria-hidden', 'true');
const crystals: { size: number; el: HTMLElement }[] = [];
let lensBuild = 0;
/** Rebuild the lens filters and point every crystal at its own. flat is the flat's share of the radius,
 *  thick the prototype's thickness, disp 0 to 1. Each build has new ids, so the browser cannot keep an old one. */
function lens(flat: number, thick: number, disp: number) {
  const spread = disp * .12, id = (size: number) => `ua-lens-${size}-${lensBuild}`;
  lensBuild++;
  lensSvg.innerHTML = [...new Set(crystals.map((k) => k.size))].map((size) => {
    const scale = 2 * .9 * thick * (1 - flat) * size;      // the map holds ±half of this
    const pass = (k: number, row: number) => `<feDisplacementMap in="SourceGraphic" in2="map" scale="${(scale * k).toFixed(2)}" xChannelSelector="R" yChannelSelector="G"/>`
      + `<feColorMatrix values="${[0, 1, 2].map((r) => (r === row ? ['1 0 0 0 0', '0 1 0 0 0', '0 0 1 0 0'][r] : '0 0 0 0 0')).join(' ')} 0 0 0 1 0" result="c${row}"/>`;
    return `<filter id="${id(size)}" filterUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}" color-interpolation-filters="sRGB">`
      + `<feImage href="${lensMap(size, flat)}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none" result="map"/>`
      + pass(1 - spread, 0) + pass(1, 1) + pass(1 + spread, 2)
      + '<feBlend in="c0" in2="c1" mode="screen"/><feBlend in2="c2" mode="screen"/></filter>';
  }).join('');
  for (const k of crystals) k.el.style.setProperty('--ua-crystal-lens', `url(#${id(k.size)})`);
}

function heading(title: string, note: string) {
  const h2 = el('h2', '', title + ' ');
  h2.append(el('small', '', note));
  main.append(h2);
}

const SIZES = [320, 150, 96], SURFACES = ['', 'card', 'muted', 'marker'];
/** A material as swatches: over the page and over each surface, at each size. */
function swatches(material: (size: number) => HTMLElement) {
  for (const surface of SURFACES) {
    const row = el('div', 'stages');
    for (const size of SIZES) {
      const fig = el('figure'), stage = el('div', 'stage'), plate = el('div', surface ? 'plate gridded' : 'plate');
      stage.style.inlineSize = size + 'px';
      if (surface) plate.style.backgroundColor = `var(--ua-color-${surface})`;
      plate.append(el('b', '', '10.5k'), material(size));
      stage.append(plate, el('span', 'sun'));
      fig.append(stage, el('small', '', `${surface || 'page'} · ${size} px`));
      row.append(fig);
    }
    main.append(row);
  }
}

heading('Crystal', 'clear glass over the page and over three surfaces; the dot outside each is where the light is');
swatches((size) => {
  const glass = crystal();
  crystals.push({ size, el: glass });
  return glass;
});

heading('Frost', 'frosted glass: the light model, blur and vibrancy on what is behind, and grain');
swatches(() => el('div', 'ua-frost'));

const params = new URLSearchParams(location.search);
for (const [k, v] of params) {
  const input = controls.querySelector<HTMLInputElement>(`[name="${k}"]`);
  if (input?.type === 'range') input.value = v;
  else if (input?.type === 'checkbox') input.checked = v === 'on';
  else { const pick = controls.querySelector<HTMLInputElement>(`[name="${k}"][value="${v}"]`); if (pick) pick.checked = true; }
}
function apply() {
  const s = Object.fromEntries(new FormData(controls)) as Record<'theme' | 'light' | 'bevel' | 'thick' | 'disp' | 'blur' | 'saturate' | 'tint' | 'grain', string> & { crystal?: string };
  if (s.theme) root.dataset.theme = s.theme; else delete root.dataset.theme;
  root.style.setProperty('--ua-light', s.light + 'deg');
  main.style.setProperty('--ua-crystal-flat', 100 - +s.bevel + '%');
  main.style.setProperty('--ua-frost-blur', s.blur + 'px');
  main.style.setProperty('--ua-frost-saturate', s.saturate + '%');
  main.style.setProperty('--ua-frost-tint', s.tint + '%');
  main.style.setProperty('--ua-grain', s.grain);
  main.dataset.crystal = s.crystal ?? 'off';
  lens(1 - +s.bevel / 100, +s.thick, +s.disp);
  for (const range of controls.querySelectorAll<HTMLInputElement>('input[type=range]')) controls[range.name + 'Out'].value = range.value + (range.dataset.unit ?? '');
  history.replaceState(null, '', '?' + new URLSearchParams({ ...s, crystal: s.crystal ?? 'off' }));
}
controls.addEventListener('input', apply);
apply();

export {};
