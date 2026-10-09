// Builds shapes/countries-110m.json: every country Natural Earth draws at 1:110m, for a page that hands the `geo` mark
// the world. Natural Earth by way of world-atlas 2.0.2 (a TopoJSON file), as the countries are drawn there, islands and
// all, to a tenth of a degree. A shape's id is its ISO 3166-1 alpha-2 code in capitals, and its name is the one that code
// is written by. The fixtures keep their own, shorter file (packages/fixtures/scripts/countries.mjs): its tests count on
// which countries it leaves out.
//   node packages/geo/scripts/countries.mjs [path to countries-110m.json]
// With no path it fetches https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json.
import { readFileSync, writeFileSync } from 'node:fs';

// The file numbers its countries by ISO 3166-1 numeric. This is each of those numbers as its alpha-2 code.
const ALPHA2 = Object.fromEntries(('004AF 008AL 012DZ 024AO 031AZ 032AR 036AU 040AT 044BS 050BD 051AM 056BE 064BT 068BO 070BA 072BW 076BR 084BZ 090SB 096BN ' +
  '100BG 104MM 108BI 112BY 116KH 120CM 124CA 140CF 144LK 148TD 152CL 156CN 158TW 170CO 178CG 180CD 188CR 191HR 192CU 196CY 203CZ 204BJ 208DK 214DO 218EC 222SV ' +
  '226GQ 231ET 232ER 233EE 238FK 242FJ 246FI 250FR 260TF 262DJ 266GA 268GE 270GM 275PS 276DE 288GH 300GR 304GL 320GT 324GN 328GY 332HT 340HN 348HU 352IS 356IN ' +
  '360ID 364IR 368IQ 372IE 376IL 380IT 384CI 388JM 392JP 398KZ 400JO 404KE 408KP 410KR 414KW 417KG 418LA 422LB 426LS 428LV 430LR 434LY 440LT 442LU 450MG 454MW ' +
  '458MY 466ML 478MR 484MX 496MN 498MD 499ME 504MA 508MZ 512OM 516NA 524NP 528NL 540NC 548VU 554NZ 558NI 562NE 566NG 578NO 586PK 591PA 598PG 600PY 604PE 608PH ' +
  '616PL 620PT 624GW 626TL 630PR 634QA 642RO 643RU 646RW 682SA 686SN 688RS 694SL 703SK 704VN 705SI 706SO 710ZA 716ZW 724ES 728SS 729SD 732EH 740SR 748SZ 752SE ' +
  '756CH 760SY 762TJ 764TH 768TG 780TT 784AE 788TN 792TR 795TM 800UG 804UA 807MK 818EG 826GB 834TZ 840US 854BF 858UY 860UZ 862VE 887YE 894ZM').split(' ').map((s) => [s.slice(0, 3), s.slice(3)]));
// What the file draws and does not number. Kosovo has a code by common use; the other two are drawn and are no row's.
const UNNUMBERED = { Kosovo: { id: 'XK' }, 'N. Cyprus': { name: 'Northern Cyprus' }, Somaliland: { name: 'Somaliland' } };
// Left out: nobody visits from it, and it is a third of the map's height.
const LEFT_OUT = new Set(['010']);

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
const named = new Intl.DisplayNames('en', { type: 'region' });
const features = topo.objects.countries.geometries.filter((g) => !LEFT_OUT.has(g.id)).map((g) => {
  const loose = g.id == null ? UNNUMBERED[g.properties.name] : undefined, id = g.id == null ? loose?.id : ALPHA2[g.id];
  if (g.id == null ? !loose : !id) throw new Error('world-atlas draws "' + g.properties.name + '" (' + g.id + '), and this script has no code for it. Add its number to ALPHA2, or its name to UNNUMBERED, in packages/geo/scripts/countries.mjs.');
  const polygons = (g.type === 'Polygon' ? [g.arcs] : g.arcs).map(whole).filter((p) => p.length);
  return { type: 'Feature', ...(id && { id }), properties: { name: id ? named.of(id) : loose.name },
    geometry: polygons.length === 1 ? { type: 'Polygon', coordinates: polygons[0] } : { type: 'MultiPolygon', coordinates: polygons } };
}).sort((a, b) => (a.id ?? '~' + a.properties.name).localeCompare(b.id ?? '~' + b.properties.name));
const out = new URL('../shapes/countries-110m.json', import.meta.url);
writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', keys: 'ISO 3166-1 alpha-2 codes, in capitals', features }) + '\n');
console.log(features.length + ' shapes, ' + features.filter((f) => f.id).length + ' with a code');
