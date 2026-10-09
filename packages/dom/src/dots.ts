/* The dot-matrix face: what a view's number is set in, wherever it shows one. It is the prototype's dot painter,
 * for the one thing the direction gives it (docs/milestones.md, the tldr value): a glyph is five cells by seven, a
 * shape only decides which cells are lit, and the cells that are not are still there, faintly.
 *
 * The number is on a screen with no surface of its own: its cells sit on whatever the view is on. The unlit cells are
 * the screen's and do not move. A view's number shares its screen with the change and the note under it, which are
 * words set on the screen's rows; a donut's hole has a screen to itself.
 *
 * It is set in type: Ans Mono Scroll, the numerals of a pixel face of five cells by seven in an em of eight, at eight
 * cells to the em, so one of its pixels is one cell. A character is one element in a slot of its own, and the unlit
 * cells are one background. The face has two axes. Its optical size is forced up, which draws each pixel smaller in
 * its cell, so the pitch of the screen shows; and its scroll sets a character some rows up or down, which is the roll.
 * A page loads the face (packages/tokens/fonts/ans-mono-scroll.css). Where it has not, a number is set in the page's
 * own face, as a value the face has no character for is, and is set in the face when it arrives.
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

/** The characters a number is made of. The figures and the marks between them are the face's; the letters and signs
 * are units, set in type beside the cells (below). */
export const FACE = '0123456789.,-– kMB%$€£¥mshGTP';
/** The face, by the name a page loads it under. */
export const FAMILY = 'Ans Mono Scroll';

/** A character that takes less than a glyph and its gap: how many cells it advances by, and how far its glyph is
 * set back to sit at the start of them. The rest advance by six. */
const NARROW: Record<string, [advance: number, back: number]> = { '.': [4, 0], ',': [4, 0], ' ': [3, 0] };
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
  return chars.length > 0 && chars.every((ch) => FACE.includes(ch)) ? chars : null;
}

const ROLL = token('motion-duration-roll');
const U = 'var(--uav-u)', OPSZ = token('font-optical-size-display'), at = (scroll: number) => `font-variation-settings: "opsz" ${OPSZ}, "SCRL" ${scroll};`;

/** It joins the base sheet inside `@layer uav`. `--uav-u` is a cell, `--uav-d` the dot in it (a cell less a px, or
 * less two from eight px up, as the prototype's are) and `--uav-g` the gap.
 * A number wider than its screen (`data-over`, which the view's measured pass sets) runs past under the pointer, right
 * to left and round again: `--uav-s` is how far it has gone off the left, in its own widths, and `--uav-e` how far in
 * from the right it stands, in the screen's (both registered in motion.ts, which is what lets them move). It leaves
 * whole, comes in at the far edge and stops where it began, a whole cell at a time. With reduced motion the pointer
 * shows the end of the number at once.
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
/* A cell of the screen is left clear on every side of what is set on it, so nothing is hard against its edge. */
.uav-number:has(> b .uav-glyphs) { position: relative; isolation: isolate; padding: var(--uav-u); }
.uav-number:has(> b .uav-glyphs)::before { content: ""; position: absolute; z-index: -1; inset-block-start: 0; inset-inline-start: 0;
  inline-size: round(down, 100%, var(--uav-u)); block-size: round(down, 100%, var(--uav-u)); background: var(--uav-cells); }
.uav-number .uav-glyphs { background: none; }
.uav-number:has(> b .uav-glyphs) > span { line-height: calc(var(--uav-u) * 5); }
.uav-number:has(> b .uav-glyphs) > .uav-f-tick { line-height: calc(var(--uav-u) * 4); }
.uav-number:has(> b .uav-glyphs) > b + span { margin-block-start: var(--uav-u); }
.uav-glyph-run { display: flex; flex: none; min-inline-size: 100%; position: relative; left: round(to-zero, calc(var(--uav-e, 0) * 100%), var(--uav-u)); translate: round(to-zero, calc(var(--uav-s, 0) * -100%), var(--uav-u)) 0; }
@keyframes uav-run { 0%, 10% { --uav-s: 0; --uav-e: 0; } 55% { --uav-s: 1; --uav-e: 0; } 55.001% { --uav-s: 0; --uav-e: 1; } 100% { --uav-s: 0; --uav-e: 0; } }
.uav-glyphs[data-over]:hover .uav-glyph-run { animation: uav-run 6s linear infinite; }
@media (prefers-reduced-motion: reduce) { .uav-glyphs[data-over]:hover .uav-glyph-run { animation: none; --uav-s: 1; --uav-e: 1; } }
/* A slot is six cells by seven, and its character is set from the slot's corner at eight cells to the em: seven rows
 * of it are the slot's, and the eighth, where a comma's tail is, is the row under it. The face is as wide as a slot. */
.uav-glyph-run i { position: relative; flex: none; inline-size: calc(${U} * 6); block-size: calc(${U} * 7);
  font: normal 400 calc(${U} * 8) / 1 "${FAMILY}", "Ans Mono", monospace; letter-spacing: 0; font-optical-sizing: none; }
.uav-glyph-run i:last-child { margin-inline-end: calc(${U} * -1); }
/* A unit, in type: in the face's small capitals, whichever case it was written in, at the number's own size and
 * with its pixels as far apart, so it reads as part of the number and a step quieter. It is a slot wide, so what follows
 * it is still on the grid, and it stands on the number's baseline, the foot of the slots: a line three quarters of the
 * face's size ends where the face's baseline is. */
.uav-glyph-run sup { flex: none; align-self: flex-end; inline-size: calc(${U} * 6); font: normal 400 calc(${U} * 8) / 0.75 "Ans Mono", monospace; font-optical-sizing: none;
  font-variation-settings: "opsz" ${OPSZ}; font-variant-caps: all-small-caps; letter-spacing: 0; vertical-align: baseline; white-space: nowrap; }
.uav-glyph-run sup:last-child { margin-inline-end: calc(${U} * -1); }
.uav-glyph-run i::before, .uav-glyph-run i[data-roll]::after { position: absolute; inset-block-start: 0; left: 0; ${at(0)} }
.uav-glyph-run i::before { content: attr(data-ch); }
.uav-glyph-run i[data-roll]::after { content: attr(data-was); }
${Object.entries(NARROW).map(([ch, [advance, back]]) => `.uav-glyph-run i[data-ch="${ch}"] { inline-size: calc(${U} * ${advance}); }${back ? `\n.uav-glyph-run i[data-ch="${ch}"]::before { left: calc(${U} * -${back}); }` : ''}`).join('\n')}
/* The roll, which is the face's own: its SCRL axis sets a character a row up for each step of it, and cuts it at the
 * slot's edge, so the new character comes in from eight rows off and the old one, laid over it, goes out the same way.
 * A whole step at a time, which the face also holds to between steps. Each waits its turn before it starts,
 * holding where it starts from. */
.uav-glyph-run i[data-roll]::after { display: none; }
@media (prefers-reduced-motion: no-preference) {
  .uav-glyph-run i[data-roll]::after { display: block; }
  .uav-glyph-run i[data-roll]::before, .uav-glyph-run i[data-roll]::after { animation: ${ROLL} steps(8) calc(var(--uav-wait, 0) * ${ROLL} / 8) both; }
  .uav-glyph-run i[data-roll="u"]::before { animation-name: uav-roll-in-u; }
  .uav-glyph-run i[data-roll="u"]::after { animation-name: uav-roll-out-u; }
  .uav-glyph-run i[data-roll="d"]::before { animation-name: uav-roll-in-d; }
  .uav-glyph-run i[data-roll="d"]::after { animation-name: uav-roll-out-d; }
}
@keyframes uav-roll-in-u { from { ${at(-8)} } to { ${at(0)} } }
@keyframes uav-roll-out-u { from { ${at(0)} } to { ${at(8)} } }
@keyframes uav-roll-in-d { from { ${at(8)} } to { ${at(0)} } }
@keyframes uav-roll-out-d { from { ${at(0)} } to { ${at(-8)} } }
.uav-glyphs-text { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (forced-colors: active) {
  .uav-glyphs { display: none; }
  .uav-glyphs-text { position: static; inline-size: auto; block-size: auto; overflow: visible; clip-path: none; }
}`;

/* What is set in the page's face for want of this one, and what each says, until the face comes. */
const waiting = new Map<Element, string>(), listening = new WeakSet<FontFaceSet>();

/** Set an element's words in the face, or as they are where the face has not every character. The words are kept
 * beside the dots, out of sight. An element that says the same already is not touched. One that said another number
 * in the face rolls to this one: a character that stays keeps its element, and one that changes has a new one, which
 * is what starts its roll. */
export function dots(el: Element, s: string): void {
  const chars = dotted(s), had = el.getAttribute('data-dots'), fonts = el.ownerDocument.fonts as FontFaceSet | undefined;
  // Without the face there is no screen: the words stand as they are, and are set again when the face has come.
  if (chars && !fonts?.check(`32px "${FAMILY}"`)) {
    waiting.set(el, s);
    // Nothing on the page is set in the face until a number is, so it is asked for: a declared face loads only when used.
    if (fonts && !listening.has(fonts)) { listening.add(fonts); void fonts.load(`32px "${FAMILY}"`).catch(() => {}); fonts.addEventListener('loadingdone', () => { for (const [late, says] of waiting) if (fonts.check(`32px "${FAMILY}"`)) { waiting.delete(late); if (late.isConnected && late.textContent === says) dots(late, says); } }); }
  }
  if (!chars || waiting.has(el) && !fonts?.check(`32px "${FAMILY}"`)) { el.removeAttribute('data-dots'); el.textContent = s; return; }
  waiting.delete(el);
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
