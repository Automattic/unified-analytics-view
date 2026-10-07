/**
 * Leonardo color definitions.
 *
 * Paste the export from leonardocolor.io directly between the markers below.
 * The Leo shim captures constructor arguments for our token generator.
 */

// ─── Shim: captures Leonardo web UI constructor calls ───────
const _colors = [];
let _theme = null;
const Leo = {
  Color: class Color {
    constructor(opts) {
      Object.assign(this, opts);
      _colors.push(this);
    }
  },
  Theme: class Theme {
    constructor(opts) {
      _theme = {
        backgroundColor: opts.backgroundColor?.name,
        colors: opts.colors?.map((c) => c.name),
        lightness: opts.lightness,
        contrast: opts.contrast,
        saturation: opts.saturation,
        formula: opts.formula,
      };
    }
  },
};

// ─── Paste Leonardo web UI export below ─────────────────────
// Seeded from the Spacefast library's Figma variables ("Primitives" collection,
// read 2026-10-07). Their colours are the key colours; the ramps and names are ours.
// Tune at leonardocolor.io and paste back.
// Local edits to re-apply after re-pasting:
//  - Every ramp has the same 13 ratios, so a step number means the same contrast
//    in each. 100 is -1.07: past the surface, white in light and near-black in
//    dark (Spacefast's paper-2 and ink). 200 is the surface itself: ratio 1 for
//    Neutral, so neutral-200 IS the theme background, and 1.03 for the hues.
//  - 300 to 600 (1.06, 1.15, 1.2, 1.25) are Spacefast's surface stack: canvas,
//    rule, raised and rule-deep in light; surface-2 and surface-3 in dark.
//  - The 900 step targets 4.6 (not 4.5): hex rounding can land a 4.5 target
//    at 4.47, which fails WCAG text contrast. 900 is the text-safe step.

// rule-deep, muted, dark/surface-3: the warm grey
let neutral = new Leo.Color({
  name: "Neutral",
  colorKeys: ['#E5E1D4','#6E6A5E','#2C2924'],
  ratios: [-1.07,1,1.06,1.15,1.2,1.25,2.5,3.5,4.6,6.5,9.3,13.2,17.3],
  colorSpace: "OKLCH",
  smooth: true
});

// marker, marker-text: the brand accent
let lime = new Leo.Color({
  name: "Lime",
  colorKeys: ['#D8F24B','#5C6614'],
  ratios: [-1.07,1.03,1.06,1.15,1.2,1.25,2.5,3.5,4.6,6.5,9.3,13.2,17.3],
  colorSpace: "OKLCH",
  smooth: true
});

// state/info-bright, state/info
let blue = new Leo.Color({
  name: "Blue",
  colorKeys: ['#5ACDFF','#0065DB'],
  ratios: [-1.07,1.03,1.06,1.15,1.2,1.25,2.5,3.5,4.6,6.5,9.3,13.2,17.3],
  colorSpace: "OKLCH",
  smooth: true
});

// state/warning, -text, -foreground
let amber = new Leo.Color({
  name: "Amber",
  colorKeys: ['#FBB605','#8A5E00','#3A2400'],
  ratios: [-1.07,1.03,1.06,1.15,1.2,1.25,2.5,3.5,4.6,6.5,9.3,13.2,17.3],
  colorSpace: "OKLCH",
  smooth: true
});

// state/success, -text
let green = new Leo.Color({
  name: "Green",
  colorKeys: ['#8BE583','#2F7A2A'],
  ratios: [-1.07,1.03,1.06,1.15,1.2,1.25,2.5,3.5,4.6,6.5,9.3,13.2,17.3],
  colorSpace: "OKLCH",
  smooth: true
});

// state/error
let red = new Leo.Color({
  name: "Red",
  colorKeys: ['#EB0E00'],
  ratios: [-1.07,1.03,1.06,1.15,1.2,1.25,2.5,3.5,4.6,6.5,9.3,13.2,17.3],
  colorSpace: "OKLCH",
  smooth: true
});

let Untitled = new Leo.Theme({
  colors: [neutral,lime,blue,amber,green,red],
  backgroundColor: neutral,
  lightness: 100,
  contrast: 1,
  saturation: 100,
  output: "HEX",
  formula: "wcag2"
});

// ─── End paste ──────────────────────────────────────────────

export default {
  colors: _colors.map((c) => ({
    name: c.name,
    colorKeys: c.colorKeys,
    ratios: c.ratios,
    colorspace: c.colorSpace || c.colorspace,
    smooth: c.smooth ?? false,
  })),
  theme: _theme,
};
