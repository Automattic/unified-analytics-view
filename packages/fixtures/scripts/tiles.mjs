// Builds src/tiles-square.json and src/tiles-hex.json: the fixture's countries as equal tiles, each roughly where the
// country is, for the `geo` mark to draw as a tile grid map and a hex tile map. One tile for every country of
// src/countries.json that has a code, under the same id and name, so a row that has a shape there has a tile here.
// Somaliland has no code there, so no row could be its, and it has no tile.
//   node packages/fixtures/scripts/tiles.mjs [--print]
// The coordinates are on a flat sheet, x to the right and y down, one tile to a unit: the files say `planar`, and the
// mark then fits them as they are, with no map projection. --print draws both grids in the terminal, to be read.
//
// Where a tile goes is worked out here and is nobody's drawing. Each country starts at the middle of its largest
// piece, as longitude and latitude on a sheet CELL degrees to a tile. Each takes the nearest free place, the closest
// pair first, and then any two swap, or one moves to a free place, for as long as that brings the lot nearer home.
// ponytail: this keeps a country near its place and knows nothing of its neighbours, so some that share a border do not
// touch and Europe spills into the sea around it. A grid drawn by hand reads better: replace the two files with one.
import { readFileSync, writeFileSync } from 'node:fs';

const CELL = 13;      // degrees of longitude to a tile. Fewer makes more room between countries, and smaller tiles
const TALL = 1.25;    // how much taller the sheet is drawn than its degrees are: the crowded latitudes get more rows
const src = JSON.parse(readFileSync(new URL('../src/countries.json', import.meta.url), 'utf8'));

// The middle of a ring, by area, and that area. Degrees as they come: this is a sheet, and no sphere.
// A ring that goes round the back of the world (Russia's) is laid out whole, east of where it starts.
const middle = (lonlat) => {
  const turns = Math.max(...lonlat.map((p) => p[0])) - Math.min(...lonlat.map((p) => p[0])) > 180, ring = turns ? lonlat.map(([x, y]) => [x < 0 ? x + 360 : x, y]) : lonlat;
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) { const [x0, y0] = ring[i], [x1, y1] = ring[i + 1], k = x0 * y1 - x1 * y0; a += k; x += (x0 + x1) * k; y += (y0 + y1) * k; }
  return { area: Math.abs(a / 2), at: [x / (3 * a), y / (3 * a)] };
};
const countries = src.features.filter((f) => f.id != null).map((f) => {
  const pieces = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const [lon, lat] = pieces.map((p) => middle(p[0])).sort((a, b) => b.area - a.area)[0].at;
  return { id: f.id, name: f.properties.name, home: [lon / CELL, -lat * TALL / CELL] };
});

const far = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
/** A place on the sheet for each country: `places` are the middles of the tiles there are to take. */
function seat(places) {
  const free = new Set(places.keys()), at = new Map();
  const pairs = countries.flatMap((c, i) => places.map((p, j) => [far(c.home, p), i, j])).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  for (const [, i, j] of pairs) if (!at.has(i) && free.has(j)) { at.set(i, j); free.delete(j); }
  const cost = (i, j) => far(countries[i].home, places[j]);
  for (let better = true; better;) {
    better = false;
    for (const i of at.keys()) {
      for (const k of at.keys()) if (i < k && cost(i, at.get(k)) + cost(k, at.get(i)) < cost(i, at.get(i)) + cost(k, at.get(k)) - 1e-9) { const was = at.get(i); at.set(i, at.get(k)); at.set(k, was); better = true; }
      for (const j of free) if (cost(i, j) < cost(i, at.get(i)) - 1e-9) { free.add(at.get(i)); free.delete(j); at.set(i, j); better = true; }
    }
  }
  return countries.map((c, i) => ({ ...c, at: places[at.get(i)] })).sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
}

// Every place the countries could want, and a margin of sea about them.
const xs = countries.map((c) => c.home[0]), ys = countries.map((c) => c.home[1]);
const range = (lo, hi, step) => Array.from({ length: Math.ceil((hi - lo) / step) + 5 }, (_, i) => Math.floor(lo / step) - 2 + i);
const ROW = Math.sqrt(3) / 2;   // from one row of hexagons to the next, where a hexagon is 1 across
const square = range(Math.min(...ys), Math.max(...ys), 1).flatMap((r) => range(Math.min(...xs), Math.max(...xs), 1).map((c) => [c + 0.5, r + 0.5]));
const hex = range(Math.min(...ys), Math.max(...ys), ROW).flatMap((r) => range(Math.min(...xs), Math.max(...xs), 1).map((c) => [c + (r % 2 ? 0.5 : 0), r * ROW]));

const R = 1 / Math.sqrt(3);     // from the middle of a hexagon 1 across to a corner
const corners = {
  square: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  hex: [[0, -R], [0.5, -R / 2], [0.5, R / 2], [0, R], [-0.5, R / 2], [-0.5, -R / 2]],
};
const round = (n) => Math.round(n * 1000) / 1000;
for (const [shape, places] of Object.entries({ square, hex })) {
  const seated = seat(places), x0 = Math.min(...seated.map((c) => c.at[0])), y0 = Math.min(...seated.map((c) => c.at[1]));
  const features = seated.map((c) => {
    const ring = corners[shape].map(([dx, dy]) => [round(c.at[0] - x0 + dx + 0.5), round(c.at[1] - y0 + dy + (shape === 'hex' ? R : 0.5))]);
    return { type: 'Feature', id: c.id, properties: { name: c.name }, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } };
  });
  writeFileSync(new URL('../src/tiles-' + shape + '.json', import.meta.url), JSON.stringify({ type: 'FeatureCollection', keys: src.keys, planar: true, features }) + '\n');
  const moved = Math.sqrt(seated.reduce((s, c) => s + far(c.home, c.at), 0) / seated.length);
  console.log(shape + ': ' + features.length + ' tiles, ' + (Math.max(...seated.map((c) => c.at[0])) - x0 + 1) + ' across, each ' + moved.toFixed(2) + ' of a tile from home at the root of the mean square');
  if (!process.argv.includes('--print')) continue;
  const rows = new Map();
  for (const c of seated) rows.set(c.at[1], [...(rows.get(c.at[1]) ?? []), c]);
  for (const [y, row] of rows) { let line = ''; for (const c of row) line = line.padEnd(Math.round((c.at[0] - x0) * 4)) + c.id; console.log(String(Math.round((y - y0) * 10) / 10).padStart(5) + '  ' + line); }
}
