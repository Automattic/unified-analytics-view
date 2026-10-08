/* The public tokens: every custom property <ua-view> reads from the page it is on, and what each falls back to
 * where the page sets none. The names are @automattic/charts' own, with our prefix for its `--a8c-charts-`
 * (docs/dom-painter-plan.md, 4.1), and more of the same shape where it has none.
 *
 * A page that loads no tokens still gets a legible view: a colour falls back to a system colour, so it follows
 * light and dark, and a size to the fixed one the view was drawn at before it had tokens.
 * packages/tokens declares the same names as its charts tier, and test/dom-tokens.test.ts holds the two together.
 *
 * What is not here is structure: the gaps, gutters and heights that the fit rules' needs are worked out from. A
 * theme that moved those would move what fits. */
export const TOKENS: Record<string, string> = {
  'color-label': 'CanvasText',
  'color-label-secondary': 'GrayText',
  'color-label-axis': 'var(--uav-paint)',
  'color-label-inverse': 'Canvas',
  'color-grid': 'color-mix(in srgb, currentColor 15%, transparent)',
  'color-axis-x': 'GrayText',
  'color-annotation': 'currentColor',
  'color-comparison': 'GrayText',
  'color-trend-up': 'currentColor',
  'color-trend-down': 'currentColor',
  'color-trend-neutral': 'GrayText',
  // Theirs names a direction; these name a judgement, because polarity can make a rise bad.
  'color-delta-good': 'var(--ua-charts-color-trend-up, currentColor)',
  'color-delta-bad': 'var(--ua-charts-color-trend-down, currentColor)',
  'color-live': 'currentColor',
  'color-background': 'Canvas',
  'color-tooltip-surface': 'CanvasText',

  'border-radius-bar': '2px',
  'border-radius-cell': '1px',
  'border-radius-swatch': '2px',
  'border-radius-tooltip': '2px',

  'stroke-width-line': '2px',
  'stroke-width-rule': '1px',
  'stroke-width-active': '2px',

  // The four faces of a scene's text, and the smaller one the number takes where the larger does not fit.
  'font-size-tick': '11px',
  'font-size-label': '13px',
  'font-size-value': '13px',
  'font-size-display': '37px',
  'font-size-display-small': '26px',
  'font-weight-value': '500',
  'font-weight-display': '600',
  'font-weight-heading': '600',
  'letter-spacing-display': '-0.01em',

  'motion-duration-entrance': '200ms',
  'motion-easing-entrance': 'cubic-bezier(0, 0, 0.2, 1)',
  'motion-duration-update': '300ms',
  'motion-easing-update': 'cubic-bezier(0.4, 0, 0.2, 1)',
  'motion-duration-exit': '150ms',
  'motion-easing-exit': 'cubic-bezier(0.4, 0, 1, 1)',
};

/** A colour a scene names that the table does not: `series.2` is `color-series-2`, and a sequential step `color-seq-4`.
 * Each has a tint (`-soft`) and, for a series, a step for text (`-text`). They fall back to `currentColor`. */
export const NAMED = /^color-(series-\d+(-text|-soft)?|seq-(\d+|none)(-soft)?)$/;

/** `var()` for a public token, with its fallback. One part of a view may fall back to another value: a row's bar is rounder. */
export function token(name: string, fallback: string | undefined = TOKENS[name]): string {
  if (fallback == null) throw new Error('<ua-view> has no token "' + name + '". Add it to TOKENS in packages/dom/src/tokens.ts, with the value it falls back to.');
  return 'var(--ua-charts-' + name + ', ' + fallback + ')';
}

/** The faces, as lengths the element works out once for the whole view (view.ts) and every part of it reads. */
export const FACES = ['tick', 'label', 'value', 'display', 'display-small'] as const;
