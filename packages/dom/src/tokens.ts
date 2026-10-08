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
  // The lit cells of a number in dots. With no token they are the colour of the text the number would have been.
  'color-label-screen': 'currentColor',
  'color-tooltip-surface': 'CanvasText',
  'color-tooltip-surface-secondary': 'GrayText',
  'color-tooltip-border': 'CanvasText',
  'color-focus': 'Highlight',
  'color-hover': 'color-mix(in srgb, currentColor 8%, transparent)',

  'border-radius-bar': '2px',
  'border-radius-cell': '1px',
  'border-radius-swatch': '2px',
  'border-radius-tooltip': '2px',
  // The readout stands above the view. Unthemed, a plain shadow straight down.
  'elevation-tooltip': '0 1px 3px color-mix(in srgb, CanvasText 25%, transparent)',

  'stroke-width-line': '2px',
  'stroke-width-rule': '1px',
  'stroke-width-focus': '2px',

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
  // A line drawing in from its start, when its plot first shows (layouts/cartesian.ts).
  'motion-duration-draw': '1400ms',
  // A character of a number in dots rolling to the next: eight steps, a row each (dots.ts).
  'motion-duration-roll': '384ms',
  // How long the readout waits where it says nothing a reader cannot already see (keys.ts).
  'motion-delay-tooltip': '500ms',
};

/** A colour a scene names that the table does not: `series.2` is `color-series-2`, and a sequential step `color-seq-4`.
 * Each has a tint (`-soft`) and, for a series, a step for text (`-text`). They fall back to `currentColor`. */
export const NAMED = /^color-(series-\d+(-text|-soft)?|seq-(\d+|none)(-soft)?)$/;

/** `var()` for a public token, with its fallback. One part of a view may fall back to another value: a row's bar is rounder. */
export function token(name: string, fallback: string | undefined = TOKENS[name]): string {
  if (fallback == null) throw new Error('<ua-view> has no token "' + name + '". Add it to TOKENS in packages/dom/src/tokens.ts, with the value it falls back to.');
  return 'var(--ua-charts-' + name + ', ' + fallback + ')';
}

/* One outline for what the keyboard has: the holder with its focus, and the mark an arrow key chose in it. Every
 * layout draws it from here, so it is one width and one colour wherever it is. Only where it sits differs, and that
 * is by what the thing is, never by which layout it is in. */
const WIDTH = token('stroke-width-focus'), COLOR = token('color-focus');
export const FOCUS = {
  width: WIDTH, color: COLOR,
  /** Inside the box: a holder and a row are clipped at their edge by whatever holds them. */
  inside: `outline: ${WIDTH} solid ${COLOR}; outline-offset: calc(-1 * ${WIDTH});`,
  /** A pixel clear of the box: a bar, a segment, a cell or a dot stands free, and may be too small to hold it. */
  around: `outline: ${WIDTH} solid ${COLOR}; outline-offset: 1px;`,
  /** A shape in an SVG, which an outline would draw a box about: its own edge, at the same width on screen. */
  stroke: `stroke: ${COLOR}; stroke-width: ${WIDTH}; vector-effect: non-scaling-stroke;`,
};

/* What the pointer is over, or a touch chose, is said more quietly, and never with the keyboard's outline: a reader
 * who tabs to a view must be able to tell where focus is from where the mouse was left. It is one treatment too: a
 * hairline in the label's colour about a mark, or as a shape's edge, and a tint behind a row, which is a line of text. */
export const HOVER = {
  width: token('stroke-width-rule'), color: token('color-label'),
  row: `background: ${token('color-hover')}; border-radius: ${token('border-radius-bar')};`,
  around: `outline: ${token('stroke-width-rule')} solid ${token('color-label')};`,
  stroke: `stroke: ${token('color-label')}; stroke-width: ${token('stroke-width-rule')}; vector-effect: non-scaling-stroke;`,
};

/** The faces, as lengths the element works out once for the whole view (view.ts) and every part of it reads. */
export const FACES = ['tick', 'label', 'value', 'display', 'display-small'] as const;
