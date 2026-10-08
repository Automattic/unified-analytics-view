import type { Room } from '@universal-analytics/core';

/* The measured pass: what a container query cannot ask, because the need is the size of the content itself.
 * It reads sizes and writes attributes, and the stylesheet does the hiding. It never rebuilds the scene.
 *
 * It converges because nothing it reads depends on what it writes. The room is a probe that takes the view's
 * width, and its height only when the view was handed a box. The number is measured in a ruler, set once in each
 * way it can be set, outside the figure. A label given up keeps its box. So a state is a function of the sizes
 * alone, the same whichever way they were reached, and a second run writes nothing. */

/** One way of setting the number, measured: the tokens that ask for it, the width of its value and the pulse
 * before it, and its height with the delta but without the note. */
export interface NumberForm { fit: string; inline: number; block: number }
export interface NumberSizes {
  /** In the order they are tried: the fullest first. */
  forms: NumberForm[];
  /** The width of the delta's long form. Null when it has no shorter one, or there is no delta. */
  delta: number | null;
  note: { inline: number; block: number } | null;
  /** The number is in dots, on a screen, which is cut to its room where no form fits (dots.ts). */
  screen?: boolean;
}

/** The ways the number is set, as `data-fit` tokens on it, fullest first. The ruler holds one of each. */
export const NUMBER_FITS = ['', 'short', 'small short'];
/** The least room a number in dots is cut to, in px: two glyphs and the screen about them, at the least cell. */
export const SCREEN_LEAST = 52;

/** The number's `data-fit` for this room: the first form whose value fits, the delta's short form when the long
 * one does not fit, and no note when it would be cut or would make the number taller than the box. The note is
 * given up before the number is. Null when no form fits the width, or that form without its note is still taller
 * than the box: the view then falls to its prose. A number on a screen is not given up for its width while the room
 * holds a screen at all: its last form stands, cut to the room, and the pointer runs the rest of it past. */
export function fitNumber(room: Room, sizes: NumberSizes): string | null {
  const form = sizes.forms.find((f) => f.inline <= room.inline) ?? (sizes.screen && room.inline >= SCREEN_LEAST ? sizes.forms.at(-1) : undefined);
  if (!form || (room.block != null && form.block > room.block)) return null;
  const note = !!sizes.note && sizes.note.inline <= room.inline && (room.block == null || form.block + sizes.note.block <= room.block);
  return [form.fit, sizes.delta != null && sizes.delta > room.inline && 'delta-short', sizes.note && !note && 'no-note'].filter(Boolean).join(' ');
}

/** A label's extent along its axis, and its rank: a ranked label is given up before an unranked one. */
export interface Span { lo: number; hi: number; rank?: number }

/** Which labels to give up so that no two stand closer than `gap`. Unranked labels are placed first, and among
 * equals the two ends, then the rest in order. One that would meet a label already placed goes. */
export function thin(spans: Span[], gap = 6): boolean[] {
  const last = spans.length - 1, kept: Span[] = [];
  const order = spans.map((_, i) => i).sort((a, b) => (spans[a]!.rank || 0) - (spans[b]!.rank || 0) || Number(a % last !== 0) - Number(b % last !== 0) || a - b);
  const gone = spans.map(() => false);
  for (const i of order) {
    const s = spans[i]!;
    if (kept.some((k) => s.lo < k.hi + gap && k.lo < s.hi + gap)) gone[i] = true; else kept.push(s);
  }
  return gone;
}

/** Where to set labels so that each stands at least `line` from the next: every one as near its own place as that
 * allows, pushed down from the highest and then back up from the bottom of the room, as place() sets them. Null for
 * one there is no room for; the lowest go first. */
export function apart(ys: number[], line: number, room: number): (number | null)[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a]! - ys[b]!).slice(0, Math.max(0, Math.floor(room / line) + 1));
  const at: (number | null)[] = ys.map(() => null);
  order.reduce((least, i) => { at[i] = Math.max(ys[i]!, least); return at[i]! + line; }, -Infinity);
  order.reverse().reduce((most, i) => { at[i] = Math.min(at[i]!, most); return at[i]! - line; }, room);
  return at;
}

/** Read the ruler: one painted number per entry of NUMBER_FITS.
 * ponytail: the value's extent is taken from the left, so not right for right-to-left, as the x axis is not. */
export function readNumber(ruler: HTMLElement[]): NumberSizes {
  const child = (el: Element, cls: string) => el.querySelector<HTMLElement>(':scope > .' + cls);
  const size = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { inline: r.width, block: r.height }; };
  const first = ruler[0]!, delta = child(first, 'uav-f-value'), note = child(first, 'uav-f-tick');
  return {
    forms: ruler.flatMap((el) => {
      const value = child(el, 'uav-f-display'), sub = child(el, 'uav-f-tick'), box = el.getBoundingClientRect();
      return value ? [{ fit: el.dataset.fit || '', inline: value.getBoundingClientRect().right - box.left, block: box.height - (sub ? size(sub).block : 0) }] : [];
    }),
    delta: delta && child(delta, 'uav-short') ? size(delta).inline : null,
    screen: !!first.querySelector('.uav-glyphs'),
    note: note && size(note),
  };
}
