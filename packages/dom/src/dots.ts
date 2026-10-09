/* The dot-matrix face: what a view's number is set in, wherever it shows one. It is the prototype's dot painter,
 * for the one thing the direction gives it (docs/milestones.md, the tldr value): a glyph is five cells by seven, a
 * shape only decides which cells are lit, and the cells that are not are still there, faintly.
 *
 * The number is on a screen with no surface of its own: its cells sit on whatever the view is on. The unlit cells are
 * the screen's and do not move. A view's number shares its screen with the change and the note under it, which are
 * words set on the screen's rows; a donut's hole has a screen to itself.
 *
 * It is drawn by the stylesheet. A character is one element, and its lit cells are that element's shadows, each a
 * whole number of cells from the first. The unlit cells are one background. So a number is as many elements as it
 * has characters, nothing is drawn in script, and the strict content security policy holds.
 *
 * A cell is CELL px, everywhere: the face's size does not move it, so two screens side by side have the same dots.
 * The lit cells have a colour of their own, the screen's label, and the unlit ones are a tenth of it.
 *
 * A screen is as wide as its room, to a whole cell, so screens in a row of equal rooms are equal. Where the number
 * is wider than that, under the pointer it runs along the screen a cell at a time and back, so the end of it
 * can be read. The cells stay where they are and only which are lit changes, as on the prototype's grid. A donut's
 * hole is the one place a screen is only as wide as its number: it is a circle, and has no room to fill.
 * ponytail: the run is the pointer's alone. A reader with no pointer has the words, which are in the document.
 *
 * When the number first shows it rolls up to its value from nothing, every character of it, and when it changes
 * each character that is not what it was rolls to the next, as the readout sketch's does:
 * a row at a time, eight steps for the seven rows and the one that parts them, up when the number has risen and down
 * when it has fallen, the last character first and each one before it a step later. A character that stays does not
 * move. That is the stylesheet's too: the old glyph and the new are two layers of one slot, moved a whole cell a
 * step. With reduced motion the number changes at once.
 *
 * ponytail: the glyphs are here and not in core because this is the only painter that sets them. When the dot-grid
 * painter is ported (packages/dots) they move to where both can read them. */
import { once } from './motion.ts';
import { token } from './tokens.ts';

/** A cell, in px: a dot of 3 and a gap of 1. */
export const CELL = 4;

/** Five columns by seven rows, a row a string, "1" where a cell is lit. */
export const FONT: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'], ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  'k': ['10000', '10000', '10010', '10100', '11000', '10100', '10010'], 'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], '%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '–': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  // Beyond the prototype's, for what a value is said in: money, a length of time, and bytes (core's format.ts).
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'], '€': ['00110', '01001', '11100', '01000', '11100', '01001', '00110'],
  '£': ['00110', '01001', '01000', '11100', '01000', '01000', '11111'], '¥': ['10001', '01010', '00100', '11111', '00100', '11111', '00100'],
  'm': ['00000', '00000', '11010', '10101', '10101', '10101', '10101'], 's': ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  'h': ['10000', '10000', '10110', '11001', '10001', '10001', '10001'], 'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'], 'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};
/** A character that takes less than a glyph and its gap: how many cells it advances by, and how far its glyph is
 * set back to sit at the start of them. The rest advance by six. */
const NARROW: Record<string, [advance: number, back: number]> = { '.': [4, 1], ',': [4, 1], ' ': [3, 0] };
/** What a value is counted in, and the letter that shortens it: `k`, `%`, `s`, `$`. These are words about the number
 * and not the number, so they are set in type beside the cells, in capitals at the top of them, and do not roll. The
 * face keeps their glyphs: a donut's hole and the ruler are the same string either way. */
const UNIT = /[^\d.,\-– ]/;
/** Whether a character is set in type on the screen, and not in cells. */
export const unit = (ch: string): boolean => UNIT.test(ch);

/** What a value comes to, for telling a rise from a fall: its first number, in the thousands its suffix says. Null
 * where it has none. A length of time is read by its first part, which is enough to tell which way it went. */
export function amount(s: string): number | null {
  const m = /(-?)\s*([\d,]*\.?\d+)\s*([kMB]?)/.exec(s);
  return m ? (m[1] ? -1 : 1) * Number(m[2]!.replace(/,/g, '')) * ({ k: 1e3, M: 1e6, B: 1e9 }[m[3]!] ?? 1) : null;
}

/** Which characters roll when a number goes from one string to another, by their place from the end, since that
 * is where a number's units are: for each character of `to`, what stood there and how many steps it waits, or null
 * where it stays. The last to differ goes first. A place the old string did not reach held a space. */
export function rolls(from: string[], to: string[]): ({ was: string; wait: number } | null)[] {
  const out: ({ was: string; wait: number } | null)[] = to.map(() => null);
  for (let i = to.length - 1, j = from.length - 1, wait = 0; i >= 0; i--, j--) { const was = from[j] ?? ' '; if (was !== to[i]) out[i] = { was, wait: wait++ }; }
  return out;
}

/** The characters of a string, where the face has every one of them. Null where it has not, so that a value is
 * set whole in one face or the other and never in two. */
export function dotted(s: string): string[] | null {
  const chars = Array.from(s);
  return chars.length > 0 && chars.every((ch) => Object.hasOwn(FONT, ch)) ? chars : null;
}

const ROLL = token('motion-duration-roll');
const U = 'var(--uav-u)', lit = (ch: string) => FONT[ch]!.flatMap((row, y) => Array.from(row, (bit, x) => (bit === '1' ? [x, y] as const : null)).filter((c) => c != null));
/* The shadows start a cell before the glyph, so the first column is a shadow too: a box hides a shadow that is under it. */
const shadows = (ch: string) => lit(ch).map(([x, y]) => `calc(${U} * ${x + 1 - (NARROW[ch]?.[1] ?? 0)}) ${y ? `calc(${U} * ${y})` : '0'}`).join(', ');

/** It joins the base sheet inside `@layer uav`. `--uav-u` is a cell, `--uav-d` the dot in it (a cell less a px, or
 * less two from eight px up, as the prototype's are) and `--uav-g` the gap. The run is at least as wide as the screen,
 * so that one that fits has nowhere to run to.
 * `--uav-s` is how far along its run the number is, from 0 to 1 (registered in motion.ts, which is what lets it
 * move): the track is set that share of the screen's width forward and of its own back, each to a whole cell, which
 * is nothing at all where the number fits. With reduced motion the pointer shows the end of the number at once.
 * The words stay in the document for a screen reader and for a copy, and are what shows where a shadow is not
 * drawn: under forced colours. */
export const DOTS_CSS = `
.uav-glyphs, .uav-number { --uav-u: ${CELL}px; --uav-d: calc(var(--uav-u) - max(1px, round(down, var(--uav-u) / 4, 1px))); --uav-g: calc(var(--uav-u) - var(--uav-d));
  --uav-cells: conic-gradient(at var(--uav-d) var(--uav-d), transparent 75%, color-mix(in srgb, ${token('color-label-screen')} 9%, transparent) 0) 0 0 / var(--uav-u) var(--uav-u); }
.uav-glyphs { display: flex; box-sizing: border-box; overflow: hidden; vertical-align: middle; color: ${token('color-label-screen')};
  inline-size: round(down, 100%, var(--uav-u)); background: var(--uav-cells); }
.uav-hole .uav-glyphs { display: inline-flex; inline-size: auto; }
/* A view's number is on one screen with what is said under it: the unlit cells run under the value, its change and
 * its note, a row past the last of them, to a whole cell each way. Every line there is a whole number of cells, a
 * row parts the value from the words, and so the words sit on the screen's rows as the value's cells do. */
.uav-number:has(> b .uav-glyphs) { position: relative; isolation: isolate; padding-block-end: var(--uav-u); }
.uav-number:has(> b .uav-glyphs)::before { content: ""; position: absolute; z-index: -1; inset-block-start: 0; inset-inline-start: 0;
  inline-size: round(down, 100%, var(--uav-u)); block-size: round(down, 100%, var(--uav-u)); background: var(--uav-cells); }
.uav-number .uav-glyphs { background: none; }
.uav-number:has(> b .uav-glyphs) > span { line-height: calc(var(--uav-u) * 5); }
.uav-number:has(> b .uav-glyphs) > .uav-f-tick { line-height: calc(var(--uav-u) * 4); }
.uav-number:has(> b .uav-glyphs) > b + span { margin-block-start: var(--uav-u); }
.uav-glyph-run { display: flex; flex: none; min-inline-size: 100%; position: relative; left: round(to-zero, calc(var(--uav-s, 0) * 100%), var(--uav-u)); translate: round(to-zero, calc(var(--uav-s, 0) * -100%), var(--uav-u)) 0; }
@keyframes uav-run { 0%, 15% { --uav-s: 0; } 85%, 100% { --uav-s: 1; } }
.uav-glyphs:hover .uav-glyph-run { animation: uav-run 4s linear infinite alternate; }
@media (prefers-reduced-motion: reduce) { .uav-glyphs:hover .uav-glyph-run { animation: none; --uav-s: 1; } }
.uav-glyph-run i { position: relative; flex: none; inline-size: calc(${U} * 6); block-size: calc(${U} * 7); overflow: hidden; }
.uav-glyph-run i:last-child { margin-inline-end: calc(${U} * -1); }
/* A unit, in type: in capitals, in the face, size and weight of the change under the number, so the two read as one voice.
 * It is three cells wide a character so that what follows it is still on the grid, and four rows tall at the top of
 * the screen. */
.uav-glyph-run sup { flex: none; align-self: flex-start; inline-size: calc(${U} * 3); font-family: ${token('font-family-value')}; font-size: var(--uav-font-value); line-height: calc(${U} * 4);
  font-weight: ${token('font-weight-value')}; font-variant-numeric: tabular-nums; letter-spacing: 0; text-transform: uppercase; vertical-align: baseline; white-space: nowrap; }
.uav-glyph-run i::before, .uav-glyph-run i[data-roll]::after { content: ""; position: absolute; inset-block-start: 0; left: calc(${U} * -1); inline-size: var(--uav-d); block-size: var(--uav-d); }
${Object.entries(NARROW).map(([ch, [advance]]) => `.uav-glyph-run i[data-ch="${ch}"] { inline-size: calc(${U} * ${advance}); }`).join('\n')}
${Object.keys(FONT).filter((ch) => lit(ch).length).map((ch) => `.uav-glyph-run i[data-ch="${ch}"]::before, .uav-glyph-run i[data-was="${ch}"]::after { box-shadow: ${shadows(ch)}; }`).join('\n')}
/* The roll. The new glyph is the slot's own and the old one is laid over it; each goes eight cells, a cell a step,
 * and waits its turn before it starts, holding where it starts from. The old one ends outside the slot, which cuts it. */
.uav-glyph-run i[data-roll]::after { display: none; }
@media (prefers-reduced-motion: no-preference) {
  .uav-glyph-run i[data-roll]::after { display: block; }
  .uav-glyph-run i[data-roll]::before, .uav-glyph-run i[data-roll]::after { animation: ${ROLL} steps(8) calc(var(--uav-wait, 0) * ${ROLL} / 8) both; }
  .uav-glyph-run i[data-roll="u"]::before { animation-name: uav-roll-in-u; }
  .uav-glyph-run i[data-roll="u"]::after { animation-name: uav-roll-out-u; }
  .uav-glyph-run i[data-roll="d"]::before { animation-name: uav-roll-in-d; }
  .uav-glyph-run i[data-roll="d"]::after { animation-name: uav-roll-out-d; }
}
@keyframes uav-roll-in-u { from { translate: 0 calc(${U} * 8); } to { translate: 0 0; } }
@keyframes uav-roll-out-u { from { translate: 0 0; } to { translate: 0 calc(${U} * -8); } }
@keyframes uav-roll-in-d { from { translate: 0 calc(${U} * -8); } to { translate: 0 0; } }
@keyframes uav-roll-out-d { from { translate: 0 0; } to { translate: 0 calc(${U} * 8); } }
.uav-glyphs-text { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (forced-colors: active) {
  .uav-glyphs { display: none; }
  .uav-glyphs-text { position: static; inline-size: auto; block-size: auto; overflow: visible; clip-path: none; }
}`;

/** Set an element's words in the face, or as they are where the face has not every character. The words are kept
 * beside the dots, out of sight. An element that says the same already is not touched. One that said another number
 * in the face rolls to this one: a character that stays keeps its element, and one that changes has a new one, which
 * is what starts its roll. */
export function dots(el: Element, s: string): void {
  const chars = dotted(s), had = el.getAttribute('data-dots');
  if (!chars) { el.removeAttribute('data-dots'); el.textContent = s; return; }
  if (had === s && el.firstChild) return;
  // A slot, and with `was` one that rolls there from it. What the roll goes by comes off when it is over (motion.ts).
  const slot = (ch: string, roll?: { was: string; wait: number }, dir = 'u') => {
    if (unit(ch)) { const sup = document.createElement('sup'); sup.textContent = ch; return sup; }
    const i = document.createElement('i');
    i.setAttribute('data-ch', ch);
    if (roll) { i.setAttribute('data-was', roll.was); i.setAttribute('data-roll', dir); i.style.setProperty('--uav-wait', String(roll.wait)); once(i, ['data-roll', 'data-was']); }
    return i;
  };
  const run = el.querySelector(':scope > .uav-glyphs > .uav-glyph-run'), from = had == null ? null : dotted(had);
  el.setAttribute('data-dots', s);
  if (run && from) {
    const old = Array.from(run.children), plan = rolls(from, chars), a = amount(had!), b = amount(s), dir = a != null && b != null && b < a ? 'd' : 'u';
    run.replaceChildren(...chars.map((ch, i) => {
      const roll = plan[i], kept = old[i - (chars.length - from.length)];
      // A cell that held a unit has nothing to roll from: what comes after it rolls up from an empty one.
      return !roll && kept ? kept : slot(ch, roll && unit(roll.was) ? { ...roll, was: ' ' } : roll ?? undefined, dir);
    }));
    el.querySelector(':scope > .uav-glyphs-text')!.textContent = s;
    return;
  }
  const words = document.createElement('span'), screen = document.createElement('span'), fresh = screen.appendChild(document.createElement('span'));
  words.className = 'uav-glyphs-text'; words.textContent = s;
  screen.className = 'uav-glyphs'; screen.setAttribute('aria-hidden', 'true');
  fresh.className = 'uav-glyph-run';
  // New: it rolls up from an empty screen, the last character first.
  fresh.append(...chars.map((ch, i) => slot(ch, { was: ' ', wait: chars.length - 1 - i })));
  el.replaceChildren(words, screen);
}
