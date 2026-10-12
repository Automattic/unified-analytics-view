import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTAINER_RULES, FIT_RULES } from '@unified-analytics/core';
import { compileFitRules, paintVar, token } from '@unified-analytics/dom';
import { GEO_RULES } from '@unified-analytics/geo';
import { geoPainter } from '@unified-analytics/geo/dom';
import { KEYS_CSS } from '../packages/dom/src/keys.ts';
import { LAYOUTS } from '../packages/dom/src/layouts/index.ts';
import { MOTION_CSS } from '../packages/dom/src/motion.ts';
import { FACES, FOCUS, HOVER, NAMED, TOKENS } from '../packages/dom/src/tokens.ts';
import { BASE_CSS, FALLBACK_CSS } from '../packages/dom/src/view.ts';
import { ROOT } from '../packages/tokens/src/generate.ts';

// The element depends on core alone, so it and the token package meet only in the names of custom properties.
// This is what holds the two lists to each other.
type Tree = { [key: string]: Tree | unknown };
const leaves = (tree: Tree, path: string[] = []): string[] => Object.entries(tree).flatMap(([key, v]) =>
  key.startsWith('$') ? [] : v && typeof v === 'object' && '$value' in v ? [path.concat(key).join('-')] : leaves(v as Tree, path.concat(key)));
const tier = leaves(JSON.parse(readFileSync(join(ROOT, 'config/charts.tokens.json'), 'utf-8')).charts);

const painters = [...Object.values(LAYOUTS).filter((p) => p.layout !== 'geo'), geoPainter];
const compiled = compileFitRules([...FIT_RULES, ...GEO_RULES, ...painters.flatMap((p) => (p === geoPainter ? [] : p.rules?.(CONTAINER_RULES) ?? []))], Object.fromEntries(painters.map((p) => [p.layout, p.fit ?? {}])));
const css = [BASE_CSS, FALLBACK_CSS, MOTION_CSS, KEYS_CSS, ...painters.map((p) => p.css), compiled].join('\n');

describe('the public tokens', () => {
  it('are all declared by the token package\'s charts tier, which declares nothing the element cannot read', () => {
    expect(Object.keys(TOKENS).filter((name) => !tier.includes(name))).toEqual([]);
    expect(tier.filter((name) => !Object.hasOwn(TOKENS, name) && !NAMED.test(name))).toEqual([]);
  });
  it('are the only properties of the page\'s that a stylesheet of the element reads', () => {
    const read = [...new Set([...css.matchAll(/--ua-charts-([a-z0-9-]+)/g)].map((m) => m[1]!))];
    expect(read.filter((name) => !Object.hasOwn(TOKENS, name))).toEqual([]);
    // Each is read with a fallback, so a page that loads no tokens still gets a view.
    expect(css.match(/var\(--ua-charts-[a-z0-9-]+\)/g)).toBeNull();
  });
  it('fall back to the value in the table, or to the one a part gives in its place', () => {
    expect(token('border-radius-bar')).toBe('var(--ua-charts-border-radius-bar, 2px)');
    expect(token('border-radius-bar', '3px')).toBe('var(--ua-charts-border-radius-bar, 3px)');
    expect(() => token('border-radius-pill')).toThrow(/Add it to TOKENS/);
  });
  it('are what a scene\'s paint tokens read, by the table or by name', () => {
    expect(paintVar('ink.muted')).toBe('var(--ua-charts-color-label-secondary, GrayText)');
    expect(paintVar('delta.bad')).toBe('var(--ua-charts-color-delta-bad, var(--ua-charts-color-trend-down, currentColor))');
    for (const paint of ['series.2', 'seq.10', 'seq.none']) expect(NAMED.test(paintVar(paint).slice(16, paintVar(paint).indexOf(',')))).toBe(true);
  });
});

describe('the focus outline', () => {
  // The holder that has focus and the mark chosen in it wear one outline, in every layout. Only where it sits differs.
  it('and the pointer\'s hairline are the only outlines any stylesheet of the element draws', () => {
    const drawn = [...new Set([...css.matchAll(/outline: ([^;]+);/g)].map((m) => m[1]!))];
    expect(drawn.sort()).toEqual(['none', 'var(--ua-charts-stroke-width-focus, 2px) solid var(--ua-charts-color-focus, Highlight)', 'var(--ua-charts-stroke-width-rule, 1px) solid var(--ua-charts-color-label, CanvasText)']);
    expect([...new Set([...css.matchAll(/outline-offset: ([^;]+);/g)].map((m) => m[1]!))].sort()).toEqual(['1px', 'calc(-1 * var(--ua-charts-stroke-width-focus, 2px))']);
  });
  it('is on every holder that takes focus, and on the mark the keys chose in each kind of holder', () => {
    expect(css).toContain(`:is([data-hits], .uav-cells):focus-visible { ${FOCUS.inside} }`);
    // A list's rows and a row's bar are painted over an outline of the box that holds them, so there it is a box of its own, on top.
    expect(css).toContain(`.uav-rows:focus-visible::after, .uav-row[data-active="keys"]::after { content: ""; position: absolute; inset: 0; pointer-events: none; ${FOCUS.inside} }`);
    expect(css).toContain('.uav-rows { position: relative;');
    expect(css).toContain(`:is(.uav-bars, .uav-dots, .uav-points, .uav-band, .uav-cells) [data-active="keys"] { ${FOCUS.around} }`);
    // An arc and a region are shapes, so the outline is the shape's own edge, at the same width and colour.
    expect(css).toContain(`svg[data-hits] path[data-active="keys"] { ${FOCUS.stroke} }`);
    expect(css).toContain(`.uav[data-layout="geo"] .uav-plot path[data-active="keys"] { ${FOCUS.stroke} }`);
    expect(css).toContain(`.uav[data-layout="geo"] .uav-plot:has(.uav-regions:focus-visible) { ${FOCUS.inside} }`);
  });
  // A reader who tabs to a view must be able to tell where focus is from where the mouse was left.
  it('is never what the pointer\'s mark wears: that has a hairline, and a row a tint', () => {
    expect(css).toContain(`.uav-row[data-active="pointer"] { ${HOVER.row} }`);
    expect(css).toContain(`:is(.uav-bars, .uav-dots, .uav-points, .uav-band, .uav-cells) [data-active="pointer"] { ${HOVER.around} }`);
    expect(css).toContain(`svg[data-hits] path[data-active="pointer"] { ${HOVER.stroke} }`);
    expect(css).toContain(`.uav[data-layout="geo"] .uav-plot path[data-active="pointer"] { ${HOVER.stroke} }`);
    for (const part of Object.values(HOVER)) expect(part).not.toContain('focus');
    // Every rule that draws either names how the mark was chosen. One that did not would draw for both.
    expect(css.match(/\[data-active\] \{ (outline|stroke|background):/g)).toBeNull();
  });
});

describe('the readout', () => {
  // A row that says its value has said what the readout would. A mark read against an axis has said no number.
  it('waits to appear only where a row says its own value', () => {
    expect(css).toContain('.uav:has(.uav-row > .uav-f-value) > .uav-readout { transition: visibility 0s var(--ua-charts-motion-delay-tooltip, 500ms); }');
    expect(css).toContain('@starting-style { .uav:has(.uav-row > .uav-f-value) > .uav-readout { visibility: hidden; } }');
    expect(new Set(css.match(/[^\n}]*\.uav-readout \{ transition:/g)).size).toBe(1);
  });
});

describe('the faces', () => {
  // A face is worked out once, on the children of the view, so that cqi in a fluid token is the view's width
  // wherever the face is read. Inside the plot, which is a container itself, the token would give another size.
  it('are each set from their token where the view is their container, and read from there', () => {
    for (const face of FACES) expect(BASE_CSS).toContain(`--uav-font-${face}: var(--ua-charts-font-size-${face}, ${TOKENS['font-size-' + face]});`);
    expect(BASE_CSS).toContain('.uav, .uav-ruler, .uav-error { --uav-font-tick:');
    expect(css.match(/font-size: [^;]*--ua-charts-/g)).toBeNull();
  });
  it('are the only sizes text is set in, but for the number in a donut\'s hole, which follows its circle', () => {
    const sized = [...new Set([...css.matchAll(/font-size: ([^;]+);/g)].map((m) => m[1]!))].filter((v) => !/^var\(--uav-font-[a-z-]+\)$/.test(v));
    expect(sized).toEqual(['clamp(14px, 18cqi, var(--uav-font-display-small))']);
  });
  it('carry their line with them: no line of text is a height in px', () => {
    expect(css.match(/line-height: [^;]*px/g)).toBeNull();
  });
});
