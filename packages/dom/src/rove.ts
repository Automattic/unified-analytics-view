/* The one interaction of every holder of things to choose: the element's points (keys.ts), a grid's cells
 * (layouts/matrix.ts) and a custom mark's own, a treemap's boxes among them (roveItems in keys.ts). It is version 4's
 * model: one tab stop, nothing chosen on focus. The pointer chooses what it is over and a mouse leaving lets it go.
 * A touch's first press chooses and shows the readout, and the next activates. Focus leaving, or a touch the browser
 * cancels, lets go. Escape lets go of what is chosen, and is taken only then, so the first Escape of a dialog around
 * the view is not swallowed. Enter or Space activates it. What an arrow does is the holder's own: `step`. */

export type How = 'keys' | 'pointer';

/** Where each arrow key points, across and down the page. A holder whose arrows step in two dimensions reads it. */
export const ARROWS: Record<string, [x: number, y: number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

/** What a holder tells rove(). `T` is what is chosen: an element, or a row and one series there. */
export interface Roving<T> {
  /** The thing an event's target is in, or null where it is in none. */
  hit(e: Event): T | null;
  /** The thing chosen, or null. */
  chosen(): T | null;
  /** Choose a thing, or none, and say how. Letting go says nothing of how. */
  choose(t: T | null, how?: How): void;
  /** Activate the chosen thing, by a click or by a key. False where nothing is chosen to activate, so Enter and Space
   * go on to the page. */
  activate(how: How): boolean;
  /** Where any other key moves the choice, or null where it is no step. A step that goes nowhere may still take its
   * key with preventDefault(), so the page behind does not scroll. */
  step(e: KeyboardEvent): T | null;
  /** Whether two are one thing. By default, the one value. */
  same?(a: T, b: T): boolean;
  /** Whether a click on `t` is on the chosen thing `at`, and activates it. By default, whether they are the same. */
  under?(t: T, at: T): boolean;
  /** The element with the tab stop: a key pressed on anything else is not the holder's. By default, the one bound. */
  holder?(): Element | null;
}

/** Whether a pointer chose by pressing, a touch or a pen on the glass, so the press that follows activates. A mouse,
 * or a pen held over the glass, chooses by hovering. */
export function pressed(e: PointerEvent): boolean { return e.pointerType === 'touch' || (e.pointerType === 'pen' && e.buttons > 0); }
/** Whether a pointer leaving lets its point go: a mouse, or a pen that was hovering. A touch, or a pen whose press has
 * not yet clicked, leaves as it lifts, before the click it chose for. */
export function hovers(e: PointerEvent, fresh: boolean): boolean { return e.pointerType === 'mouse' || (e.pointerType === 'pen' && !fresh); }

/** Bind the interaction to `on`, once: it listens there, so `on` must outlive every paint, and nothing is bound per thing. */
export function rove<T>(on: HTMLElement, r: Roving<T>): void {
  const same = r.same ?? Object.is, under = r.under ?? same, holds = (t: T) => { const at = r.chosen(); return at != null && same(t, at); };
  // A touch that has only just chosen a thing shows its readout. The next one activates it.
  let fresh = false;
  on.addEventListener('pointerover', (e) => {
    const t = r.hit(e);
    if (t == null) return;
    fresh = pressed(e) && !holds(t);
    r.choose(t, 'pointer');
  });
  // As version 4: the thing goes with the mouse, focus or none, and the next arrow starts from nothing. A touch has
  // no leaving to speak of.
  on.addEventListener('pointerleave', (e) => { if (hovers(e, fresh)) r.choose(null); });
  // A touch that turns into a scroll chose its thing on the way down. The browser cancels it, and it lets go.
  on.addEventListener('pointercancel', () => r.choose(null));
  on.addEventListener('focusout', () => r.choose(null));
  on.addEventListener('click', (e) => {
    const t = r.hit(e), at = r.chosen();
    if (t == null || at == null || !under(t, at)) return;
    if (fresh) fresh = false; else r.activate('pointer');
  });
  on.addEventListener('keydown', (e) => {
    if (e.target !== (r.holder ? r.holder() : on)) return;
    if (e.key === 'Escape') { if (r.chosen() != null) { e.preventDefault(); r.choose(null); } return; }
    if (e.key === 'Enter' || e.key === ' ') { if (r.activate('keys')) e.preventDefault(); return; }
    const t = r.step(e);
    if (t == null) return;
    e.preventDefault();
    r.choose(t, 'keys');
  });
}
