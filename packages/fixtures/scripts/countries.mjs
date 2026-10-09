// Rebuilds src/countries.json: the boundary shapes the fixtures hand the `geo` mark.
// Natural Earth's 1:110m countries, by way of world-atlas 2.0.2 (a TopoJSON file), as they are drawn there: every ring
// of every country the file already lists, to a tenth of a degree. Which countries those are is not changed here, since
// the samples and the tests count on some having no shape (Singapore, Malta, Bahrain).
//   node packages/fixtures/scripts/countries.mjs [path to countries-110m.json]
// With no path it fetches https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json.
import { readFileSync, writeFileSync } from 'node:fs';

const out = new URL('../src/countries.json', import.meta.url), was = JSON.parse(readFileSync(out, 'utf8'));
const topo = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json')).json();
const { scale: [kx, ky], translate: [dx, dy] } = topo.transform, round = (n) => Math.round(n * 10) / 10;
// An arc is its first point and then steps from each to the next, in the file's own whole numbers.
const arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([a, b]) => [round((x += a) * kx + dx), round((y += b) * ky + dy)]); });
// A ring is arcs end to end, each sharing its first point with the last of the one before. A negative index runs backwards.
const ring = (ids) => {
  const points = ids.flatMap((i, n) => { const arc = i < 0 ? [...arcs[~i]].reverse() : arcs[i]; return n ? arc.slice(1) : arc; });
  return points.filter((p, i) => !i || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
};
const whole = (rings) => rings.map(ring).filter((r) => r.length >= 4);
const drawn = new Map(topo.objects.countries.geometries.map((g) => [g.properties.name, g]));
// The one country the fixture names more shortly than the file does.
const LONGER = { 'United States': 'United States of America' };
const features = was.features.map((f) => {
  const g = drawn.get(LONGER[f.properties.name] ?? f.properties.name);
  if (!g) throw new Error('world-atlas has no country named "' + f.properties.name + '". Check the name in src/countries.json against the file\'s.');
  const polygons = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map(whole).filter((p) => p.length);
  return { ...f, geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons } };
});
writeFileSync(out, JSON.stringify({ ...was, features }) + '\n');
console.log(features.length + ' countries, ' + features.reduce((n, f) => n + JSON.stringify(f.geometry.coordinates).split('],[').length, 0) + ' points');
