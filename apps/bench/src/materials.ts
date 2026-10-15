/* The materials, on the tokens page: each material over the page and over each surface it has to sit on, at the sizes it has
 * to hold up at, under one light. The same light is the one elevation's shadows fall away from. The material's surface is material.css; this file builds
 * the stage and the lens filter. */
import { el, heading } from './page.ts';
const main = document.querySelector<HTMLElement>('#materials')!;

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

main.append(heading('Crystal', 'clear glass over the page and over three surfaces; the dot outside each is where the light is. Then as a surface: a container of any fill under a sheet of it'));
swatches((size) => {
  const glass = crystal();
  crystals.push({ size, el: glass });
  return glass;
});

// The same glass as a surface: a container of any fill, with a little elevation, under a sheet of it.
{
  const row = el('div', 'stages panels');
  for (const fill of ['surface-card', 'surface-raised', 'surface-screen', 'marker']) {
    const fig = el('figure'), panel = el('div', 'ua-crystal-surface');
    panel.style.background = `var(--ua-color-${fill})`;
    panel.append(el('b', '', '10.5k'), el('span', '', 'Visitors, last 28 days'));
    fig.append(panel, el('small', '', 'a container · ' + fill.replace('surface-', '')));
    row.append(fig);
  }
  main.append(row);
}

main.append(heading('Frost', 'frosted glass: the light model, blur and vibrancy on what is behind, grain, and an elevation; as a disc over each surface, then as a panel'));
swatches(() => el('div', 'ua-frost'));

// The same glass as a surface: a panel at each elevation it can stand at, over something for it to blur.
{
  const row = el('div', 'stages panels');
  for (const level of [1, 2, 3]) {
    const fig = el('figure'), back = el('div', 'backdrop'), panel = el('div', 'ua-frost');
    panel.dataset.elevation = String(level);
    panel.append(el('b', '', '10.5k'), el('span', '', 'Visitors, last 28 days'));
    back.append(panel);
    fig.append(back, el('small', '', 'a panel · elevation ' + level + (level === 3 ? ', the default' : '')));
    row.append(fig);
  }
  main.append(row);
}

main.append(heading('Screen', 'a surface sunk into the page, as an LCD is: the inset elevation, a darker fill, grain, and a small shadow under what is on it'));
{
  const row = el('div', 'stages screens');
  for (const [w, text] of [[320, '10.5k'], [200, '3m 48s'], [120, '38%']] as const) {
    const fig = el('figure'), screen = el('div', 'ua-screen');
    screen.style.inlineSize = w + 'px';
    screen.append(el('b', '', text), el('span', '', 'Visitors, last 28 days'));
    fig.append(screen, el('small', '', `page · ${w} px`));
    row.append(fig);
  }
  main.append(row);
}

// The light and the material are material.css's. The lens is built for the bevel it sets; how thick the glass is and how
// much it disperses are the lens's alone, as they were settled when the page had controls to move them.
lens(parseFloat(getComputedStyle(crystals[0]!.el).getPropertyValue('--flat')) / 100, 0.44, 0.6);
