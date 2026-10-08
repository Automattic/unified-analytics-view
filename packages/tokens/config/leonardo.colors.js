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
// Seeded from the Spacefast library's Figma variables (its "Primitives" and
// "Color" collections, read 2026-10-07). Their colours are the key colours; the
// ramps and names are ours. Tune at leonardocolor.io and paste back.
// Local edits to re-apply after re-pasting:
//  - Every ramp has the same 10 ratios, so a step number means the same contrast
//    in each. Ratios are against the page: Spacefast's canvas in light and ink
//    in dark, which is neutral-200 (ratio 1) in both. The steps are not evenly
//    spaced: each is where Spacefast's colours cluster.
//  - 100 (-1.06) is past the page: paper in light, black in dark. Light cards
//    rise by going lighter than the page. White and black are not ramp steps:
//    they are color.white and color.black in base.tokens.json.
//  - 300 to 500 (1.07, 1.16, 1.35) are the surface stack: rule, then raised and
//    rule-deep, then primary-soft in light; surface, surface-2, then border and
//    surface-3 in dark. 400 is also the light marker.
//  - 600 (2.2) is the input border in both themes.
//  - 700 (5) is the text-safe step: Spacefast's muted, info and the -text
//    states. It holds 4.5:1 down to a 300 surface.
//  - 800 (7.5) is dark muted text, 900 (11.3) ink-soft and the bright dark
//    states, 1000 (17) ink, dark text and the dark marker.

// canvas, input, muted, dark/surface-3, ink
let neutral = new Leo.Color({
  name: "Neutral",
  colorKeys: ['#F7F5EF','#A9A59A','#6E6A5E','#2C2924','#0C0C0C'],
  ratios: [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17],
  colorSpace: "CAM02p",
  smooth: true
});

// marker, marker-text: the brand accent
let lime = new Leo.Color({
  name: "Lime",
  colorKeys: ['#D8F24B','#5C6614'],
  ratios: [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17],
  colorSpace: "CAM02p",
  smooth: true
});

// state/info-bright, state/info
let blue = new Leo.Color({
  name: "Blue",
  colorKeys: ['#5ACDFF','#0065DB'],
  ratios: [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17],
  colorSpace: "CAM02p",
  smooth: true
});

// state/warning, -text, -foreground
let amber = new Leo.Color({
  name: "Amber",
  colorKeys: ['#FBB605','#8A5E00','#3A2400'],
  ratios: [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17],
  colorSpace: "CAM02p",
  smooth: true
});

// state/success, -text
let green = new Leo.Color({
  name: "Green",
  colorKeys: ['#8BE583','#2F7A2A'],
  ratios: [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17],
  colorSpace: "CAM02p",
  smooth: true
});

// state/error
let red = new Leo.Color({
  name: "Red",
  colorKeys: ['#EB0E00'],
  ratios: [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17],
  colorSpace: "CAM02p",
  smooth: true
});

// The qualitative hues: nine seeds, a 10-step interpolation through five colours in
// Leonardo's diverging palette builder. One seed per ramp, named qual-*, apart from the
// state ramps above. No step is singled out as the series colour: whoever paints with a
// hue picks the step that gives the contrast it needs.
const R = [-1.06,1,1.07,1.16,1.35,2.2,5,7.5,11.3,17];
const hue = (name, key) => new Leo.Color({ name: "Qual " + name, colorKeys: [key], ratios: R, colorSpace: "CAM02p", smooth: true });
let indigo = hue("Indigo", '#3c3764');
let steel = hue("Steel", '#36648a');
let teal = hue("Teal", '#00b297');
let grass = hue("Grass", '#76e557');
let chartreuse = hue("Chartreuse", '#cbed00');
let yellow = hue("Yellow", '#e8d000');
let orange = hue("Orange", '#fe9a00');
let coral = hue("Coral", '#ff503b');
let rose = hue("Rose", '#f5006b');

// The sequential ramp is not made here: its steps are chosen by hand, in base.tokens.json.

let Untitled = new Leo.Theme({
  colors: [neutral,lime,blue,amber,green,red,indigo,steel,teal,grass,chartreuse,yellow,orange,coral,rose],
  backgroundColor: neutral,
  lightness: 97,
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
