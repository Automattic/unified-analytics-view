import { describe, expect, it } from 'vitest';
import { hovers, pressed, rove } from '../packages/dom/src/rove.ts';
import { roveItems, step } from '../packages/dom/src/keys.ts';
import { hits } from '../packages/dom/src/dom.ts';

// The interaction every holder shares, against a holder of three numbered things with no DOM: the event's target
// is the holder, and `on` the number it is on. Which thing a key moves to is the holder's, here the element's own step().
const holder = (elsewhere = false, under?: (t: number, at: number) => boolean) => {
  const on = new EventTarget() as unknown as HTMLElement, log: string[] = [];
  let at: number | null = null, activated = 0;
  rove<number>(on, {
    hit: (e) => ((e as unknown as { on?: number }).on ?? null),
    chosen: () => at,
    choose: (t, how) => { at = t; log.push(t == null ? 'none' : t + ' by ' + how); },
    activate: () => { if (at == null) return false; activated++; return true; },
    step: (e) => step(e.key, at ?? -1, 3),
    holder: () => (elsewhere ? null : on),
    ...(under && { under }),
  });
  const send = (type: string, init: object = {}) => { const e = Object.assign(new Event(type, { cancelable: true }), init); on.dispatchEvent(e); return e.defaultPrevented; };
  return { send, log, at: () => at, activated: () => activated };
};

describe('pressed and hovers', () => {
  it('tell a touch, and a pen on the glass, from a mouse, and a pen held over it', () => {
    const p = (pointerType: string, buttons = 0) => ({ pointerType, buttons }) as PointerEvent;
    expect([p('mouse'), p('touch'), p('pen'), p('pen', 1)].map(pressed)).toEqual([false, true, false, true]);
    expect([hovers(p('mouse'), true), hovers(p('touch'), false), hovers(p('pen'), false), hovers(p('pen'), true)]).toEqual([true, false, true, false]);
  });
});

describe('rove', () => {
  it('chooses what a mouse is over, lets it go when the mouse leaves, and activates on the click', () => {
    const v = holder();
    v.send('pointerover', { pointerType: 'mouse', on: 1 });
    expect(v.at()).toBe(1);
    v.send('click', { on: 1 });
    expect(v.activated()).toBe(1);
    v.send('pointerleave', { pointerType: 'mouse' });
    expect(v.at()).toBe(null);
  });
  it('only chooses on a touch\'s first press, activates on its next, and lets go when the browser cancels it', () => {
    const v = holder();
    v.send('pointerover', { pointerType: 'touch', on: 2 }); v.send('pointerleave', { pointerType: 'touch' }); v.send('click', { on: 2 });
    expect([v.at(), v.activated()]).toEqual([2, 0]);
    v.send('pointerover', { pointerType: 'touch', on: 2 }); v.send('click', { on: 2 });
    expect(v.activated()).toBe(1);
    v.send('pointercancel');
    expect(v.at()).toBe(null);
  });
  it('steps by the holder\'s step, and takes Escape, Enter and Space only while something is chosen', () => {
    const v = holder();
    expect(v.send('keydown', { key: 'Escape' })).toBe(false);
    expect(v.send('keydown', { key: 'Enter' })).toBe(false);
    expect(v.send('keydown', { key: 'ArrowRight' })).toBe(true);
    expect(v.log.at(-1)).toBe('0 by keys');
    expect(v.send('keydown', { key: 'Tab' })).toBe(false);
    expect(v.send('keydown', { key: ' ' })).toBe(true);
    expect(v.activated()).toBe(1);
    expect(v.send('keydown', { key: 'Escape' })).toBe(true);
    expect(v.at()).toBe(null);
  });
  it('activates on a click under the chosen thing, by the holder\'s own measure where it has one', () => {
    const v = holder();
    v.send('keydown', { key: 'ArrowRight' }); v.send('keydown', { key: 'ArrowRight' }); v.send('click', { on: 0 });
    expect(v.activated()).toBe(0);
    // Things in tens: a click on 7 is under the 0 chosen.
    const tens = holder(false, (t, at) => Math.floor(t / 10) === Math.floor(at / 10));
    tens.send('keydown', { key: 'ArrowRight' }); tens.send('click', { on: 7 });
    expect(tens.activated()).toBe(1);
  });
  it('leaves a key pressed on anything but the holder alone, and lets go when focus leaves', () => {
    expect(holder(true).send('keydown', { key: 'ArrowRight' })).toBe(false);
    const v = holder();
    v.send('keydown', { key: 'ArrowRight' }); v.send('focusout');
    expect(v.at()).toBe(null);
  });
});

describe('roveItems', () => {
  it('finds the chosen one by any selector of a list, and activates outside a shadow root as in one', () => {
    const asked: string[] = [], on = { id: 'b' }, holder = Object.assign(new EventTarget(), { querySelector: (sel: string) => (asked.push(sel), on), getRootNode: () => ({}) }) as unknown as HTMLElement;
    const heard: unknown[] = [];
    holder.addEventListener('ua-activate', (e) => heard.push((e as CustomEvent).detail));
    roveItems(holder, '.a, .b', () => null, (el) => ({ id: el.id }));
    holder.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'Enter' }));
    expect(asked).toEqual([':is(.a, .b)[data-active]']);
    expect(heard).toEqual([{ id: 'b' }]);
  });
});

describe('hits', () => {
  it('takes from a holder that stands down what the keyboard set on it, so no empty tab stop is left', () => {
    const a = new Map<string, string>(), el = { getAttribute: (n: string) => a.get(n) ?? null, setAttribute: (n: string, v: string) => a.set(n, v), removeAttribute: (n: string) => a.delete(n) } as unknown as Element;
    hits(el, 'x');
    for (const [n, v] of [['role', 'listbox'], ['tabindex', '0'], ['aria-label', 'Visitors'], ['aria-orientation', 'horizontal'], ['aria-activedescendant', 'p1']]) el.setAttribute(n!, v!);
    hits(el, null);
    expect(Object.fromEntries(a)).toEqual({ 'aria-hidden': 'true' });
  });
});
