globalThis.d3 = require('d3');
require('./bench.js');
const V = globalThis.VGB;
const specs = {
  trend:  { use:'trend', query:{metrics:['visitors'],by:['date.day'],range:'28d',compare:'previous'} },
  pages:  { use:'bar-list', query:{metrics:['pageviews'],by:['page'],range:'28d',limit:8} },
  mix:    { use:'share-bar', query:{metrics:['visitors'],by:['channel'],range:'28d'} },
  total:  { query:{metrics:['pageviews'],range:'28d',compare:'previous'} },
  live:   { use:'bar-list', headline:true, query:{metrics:['present'],by:['page']} },
  layers: { query:{metrics:['pageviews'],by:['date.day'],range:'28d'}, layers:[{mark:'bar',encode:{x:'date.day',y:'pageviews'}},{mark:'rule',encode:{y:1000},label:'Target',role:'reference'}] },
  headed: { use:'trend', headline:true, query:{metrics:['visitors'],by:['date.day'],range:'28d',compare:'previous'} },
  kept:   { use:'trend', keep:['guides'], query:{metrics:['visitors'],by:['date.day'],range:'28d',compare:'previous'} },
};
let bad = 0;
const line = (name, w, h, r, s) => console.log(name.padEnd(7), String(w).padStart(4), String(h||'-').padStart(4), r.layout.padEnd(9), (r.side?'side':r.headline?'head':'').padEnd(5), String(s.nodes.length).padStart(3), String(s.height).padStart(4), '|', r.reductions.filter(x=>x.state==='applied').map(x=>x.id).join(',') || '-', '|', r.dropped.join('; '));
for (const [name, spec] of Object.entries(specs)) for (const sc of ['typical','no-prior','empty']) for (const p of ['svg','dots']) for (const h of [null, 300, 160, 100, 60, 40]) for (const w of [54, 80, 120, 170, 250, 290, 346, 500, 700]) {
  try {
    const host = V.makeHost(w, h, p, 8), res = V.runQuery(spec.query, sc), r = V.resolve(spec, res, host), s = V.buildScene(r, spec.query, res, host);
    const keys = s.nodes.map(n => n.key);
    if (new Set(keys).size !== keys.length) { bad++; console.log('DUP KEYS', name, sc, w, h, r.layout); }
    if (/NaN/.test(JSON.stringify(s, (k,v)=> typeof v==='number' && isNaN(v) ? 'NaN' : v))) { bad++; console.log('NaN', name, sc, w, h, r.layout); }
    if (h != null && r.layout !== 'sentence' && s.height > h) { bad++; console.log('TOO TALL', name, sc, p, w, h, r.layout, s.height); }
    if (p==='svg' && sc==='typical' && (h===null || (h===100 && [120,346,700].includes(w)))) line(name, w, h, r, s);
  } catch (e) { bad++; console.log('ERR', name, sc, p, w, h, e.message, e.stack.split('\n')[1]); }
}
for (const n of ['trend','pages','mix','total','live']) console.log(V.resolve(specs[n], V.runQuery(specs[n].query), V.makeHost(346)).text);
console.log(JSON.stringify(V.expand(specs.trend)).slice(0,200));
for (const bad_spec of [{use:'donut',query:{metrics:['visitors'],by:['channel']}}, {query:{metrics:['visitors'],by:['channel']}}, {use:'trend',query:{metrics:['visitors']}}])
  try { V.resolve(bad_spec, V.runQuery(bad_spec.query), V.makeHost(346)) } catch(e) { console.log('OK err:', e.message) }
console.log('problems:', bad);
