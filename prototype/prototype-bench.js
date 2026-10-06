/* View grammar bench, v0
 *
 * Pipeline:  spec -> resolve -> scene -> painter
 *
 *  - spec      what the author writes: a query in catalog names, plus layers or a preset that expands into layers
 *  - resolve   expands the preset, then applies the host's reductions by layer role until the view fits
 *  - scene     a flat JSON list of positioned shapes with stable keys
 *  - painter   draws a scene (SVG, or a fixed dot grid)
 *
 * Everything up to and including the scene is pure and has no DOM.
 * d3 is used only for scales, path geometry and a few array helpers.
 */
(function (root) {
'use strict';
const d3 = root.d3;

/* ───────────────────────── 1. Catalog ─────────────────────────
 * The small contract the front end needs from the semantic model. */
const CATALOG = {
  metrics: {
    visitors:  { label: 'Visitors',    unit: 'count', polarity: 'up',   rangeTotal: 'sum of daily' },
    pageviews: { label: 'Page views',  unit: 'count', polarity: 'up',   rangeTotal: 'sum' },
    present:   { label: 'Present now', unit: 'count', polarity: 'none', instant: true },
  },
  dimensions: {
    'date.day': { label: 'Day',     type: 'time' },
    page:       { label: 'Page',    type: 'categorical' },
    channel:    { label: 'Channel', type: 'categorical' },
  },
};

/* ───────────────────── 2. Fixtures and query ─────────────────────
 * Stands in for the coordinator and the engines. Totals come from the
 * "engine", never from summing the rows a view happens to receive. */
function seeded(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAY = 86400000, TODAY = Date.UTC(2026, 9, 5);
const DAILY = (function () {
  const rand = seeded(11);
  return Array.from({ length: 56 }, function (_, i) {
    const t = TODAY - (55 - i) * DAY, dow = new Date(t).getUTCDay();
    const season = [0.72, 1.06, 1.12, 1.1, 1.04, 0.96, 0.7][dow];
    const launch = i === 45 ? 1.55 : i === 46 ? 1.25 : 1;
    let visitors = Math.round((330 + i * 1.6) * season * launch * (0.92 + rand() * 0.16));
    let pageviews = Math.round(visitors * (2.1 + rand() * 0.5));
    const partial = i === 55;
    if (partial) { visitors = Math.round(visitors * 0.42); pageviews = Math.round(pageviews * 0.42); }
    return { iso: new Date(t).toISOString().slice(0, 10), visitors: visitors, pageviews: pageviews, partial: partial };
  });
})();
const PAGES = [
  { page: '/',                                pageviews: 4820, visitors: 2610, prev: { pageviews: 4410, visitors: 2380 } },
  { page: '/pricing',                         pageviews: 2960, visitors: 1705, prev: { pageviews: 2310, visitors: 1390 } },
  { page: '/blog/launch-notes',               pageviews: 2105, visitors: 1622, prev: { pageviews: 640,  visitors: 488 } },
  { page: '/docs/getting-started',            pageviews: 1730, visitors: 901,  prev: { pageviews: 1802, visitors: 940 } },
  { page: '/changelog',                       pageviews: 940,  visitors: 612,  prev: { pageviews: 1010, visitors: 655 } },
  { page: '/about',                           pageviews: 610,  visitors: 498,  prev: { pageviews: 580,  visitors: 470 } },
  { page: '/blog/analytics-without-cookies',  pageviews: 455,  visitors: 371,  prev: null },
  { page: '/contact',                         pageviews: 290,  visitors: 244,  prev: { pageviews: 310,  visitors: 262 } },
];
const CHANNELS = [['Search', 0.41, 0.44], ['Direct', 0.28, 0.29], ['Social', 0.14, 0.13], ['AI assistants', 0.08, 0.04], ['Email', 0.06, 0.07], ['Other', 0.03, 0.03]];
const LIVE = [{ page: '/', present: 3 }, { page: '/pricing', present: 2 }, { page: '/blog/launch-notes', present: 1 }, { page: '/docs/getting-started', present: 1 }];

function runQuery(q, scenario) {
  q = q || {}; scenario = scenario || 'typical';
  const metrics = q.metrics || [], by = (q.by || [])[0] || null;
  metrics.forEach(function (m) { if (!CATALOG.metrics[m]) throw new Error('Unknown metric "' + m + '". The catalog has: ' + Object.keys(CATALOG.metrics).join(', ') + '.'); });
  if (by && !CATALOG.dimensions[by]) throw new Error('Unknown dimension "' + by + '". The catalog has: ' + Object.keys(CATALOG.dimensions).join(', ') + '.');
  const wantPrev = q.compare === 'previous', hasPrev = wantPrev && scenario !== 'no-prior';
  const meta = { range: q.range || '28d', compare: q.compare || null, notes: [] };
  const totals = {}; let rows = [];
  const live = metrics.indexOf('present') >= 0;
  if (live && (metrics.length > 1 || (by && by !== 'page'))) throw new Error('"present" is an instantaneous count. Query it alone, optionally by page.');

  if (scenario === 'empty') {
    metrics.forEach(function (m) { totals[m] = 0; if (wantPrev) totals[m + '@previous'] = null; });
    meta.empty = true;
    return { rows: rows, totals: totals, meta: meta };
  }
  if (live) {
    totals.present = d3.sum(LIVE, function (d) { return d.present; });
    meta.range = 'now';
    return { rows: by ? LIVE.map(function (d) { return Object.assign({}, d); }) : [], totals: totals, meta: meta };
  }
  const cur = DAILY.slice(28), prev = DAILY.slice(0, 28);
  metrics.forEach(function (m) {
    totals[m] = d3.sum(cur, function (d) { return d[m]; });
    if (wantPrev) totals[m + '@previous'] = hasPrev ? d3.sum(prev, function (d) { return d[m]; }) : null;
  });
  if (by === 'date.day') {
    rows = cur.map(function (d, i) {
      const r = { 'date.day': d.iso, partial: d.partial };
      metrics.forEach(function (m) { r[m] = d[m]; if (wantPrev) r[m + '@previous'] = hasPrev ? prev[i][m] : null; });
      return r;
    });
    meta.notes.push('Today is still in progress.');
  } else if (by === 'page') {
    rows = PAGES.map(function (p) {
      const r = { page: p.page };
      metrics.forEach(function (m) { r[m] = p[m]; if (wantPrev) r[m + '@previous'] = hasPrev && p.prev ? p.prev[m] : null; });
      return r;
    });
  } else if (by === 'channel') {
    rows = CHANNELS.map(function (c) {
      const r = { channel: c[0] };
      metrics.forEach(function (m) { r[m] = Math.round(totals[m] * c[1]); if (wantPrev) r[m + '@previous'] = hasPrev ? Math.round(totals[m + '@previous'] * c[2]) : null; });
      return r;
    });
  }
  if (by && by !== 'date.day') {
    const m0 = metrics[0];
    rows.sort(function (a, b) { return b[m0] - a[m0]; });
    if (q.limit) rows = rows.slice(0, q.limit);
  }
  return { rows: rows, totals: totals, meta: meta };
}

/* ───────────────────────── 3. Formatting ───────────────────────── */
const NF = new Intl.NumberFormat('en-US');
const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const CHAR_W = 6.6;                       // rough advance of the 13px label face, for clipping
function fmt(v, compact) {
  if (v == null) return '–';
  return compact || Math.abs(v) >= 10000 ? CF.format(v).replace('K', 'k') : NF.format(v);
}
function fmtPct(p) { const x = p * 100; return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + '%'; }
function fmtDay(iso) { return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); }
function rangeLabel(r) { const m = /^(\d+)d$/.exec(r || ''); return r === 'now' ? 'right now' : m ? 'last ' + m[1] + ' days' : String(r); }
function clip(s, n) { n = Math.max(3, n); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function delta(cur, prev, polarity) {
  if (prev == null) return { state: 'none', text: 'No prior period', paint: 'ink.muted' };
  if (prev === 0) return { state: 'new', text: 'New', paint: 'ink.muted' };
  const p = (cur - prev) / prev;
  if (Math.abs(p) < 0.005) return { state: 'flat', text: 'No change', paint: 'ink.muted' };
  const up = p > 0, good = polarity === 'none' ? null : (polarity === 'up') === up;
  return { state: up ? 'up' : 'down', pct: p, text: (up ? '▲ ' : '▼ ') + fmtPct(Math.abs(p)), paint: good == null ? 'ink.muted' : good ? 'delta.good' : 'delta.bad' };
}

/* ───────────────────────── 4. Host context ─────────────────────────
 * The host owns sizes. It states the least room each kind of part needs,
 * and the order in which parts are given up when a view does not fit. */
const HOST_RULES = {
  axes:      { minWidth: 280, minHeight: 120, height: 184 },   // a plot with axes
  secondary: { minPlotWidth: 180, minPlotHeight: 90 },         // comparison and reference layers stay legible above this
  bare:      { minPlotWidth: 64, height: 46 },                 // a plot with no guides, set beside the number
  rows:      { rowHeight: 28, gap: 4, minLabelWidth: 90 },
  band:      { minWidth: 110, minWidthWithLegend: 170 },
  notice:    { minWidth: 150 },
  order:     ['drop-guides', 'drop-secondary', 'trim-rows', 'collapse', 'sentence'],
};
const KEEP = { 'drop-guides': 'guides', 'drop-secondary': 'secondary', 'trim-rows': 'rows', 'collapse': 'marks' };
function makeHost(width, height, painter, cell) {
  return {
    width: width, height: height || null, painter: painter || 'svg', cell: cell || 4, rules: HOST_RULES,
    // Metrics of the big-number face. The dot painter sets digits on a 5x7 grid at one of two cell sizes.
    display: function (len, avail, small) {
      if (this.painter === 'dots') { const c = !small && this.cell === 8 && (len * 6 - 1) * 8 <= avail ? 8 : 4; return { h: 7 * c, cell: c }; }
      return { h: small || avail / Math.max(1, len) < 21 ? 24 : 34 };
    },
    displayWidth: function (len) { return this.painter === 'dots' ? (len * 6 - 1) * 4 : Math.ceil(len * 14.5); },
  };
}

/* ───────────────────────── 5. Presets ─────────────────────────
 * A preset is a saved fragment of a spec. It expands into ordinary layers
 * before the grammar runs, and nothing downstream knows its name. */
const PRESET_LIB = {
  'trend': { layers: [
    { mark: 'area', encode: { x: '$by', y: '$metric' }, role: 'context' },
    { mark: 'line', encode: { x: '$by', y: '$metric' }, series: 'previous', role: 'comparison' },
    { mark: 'line', encode: { x: '$by', y: '$metric' }, role: 'primary' } ] },
  'bar-list': { layers: [
    { mark: 'bar',  encode: { y: '$by', x: '$metric' } },
    { mark: 'text', encode: { y: '$by', text: '$by' } },
    { mark: 'text', encode: { y: '$by', text: '$metric' }, align: 'end' } ] },
  'share-bar': { layers: [
    { mark: 'bar', encode: { x: '$metric', color: '$by' }, stack: 'normalize' } ] },
};
function expand(spec) {
  if (!spec.use) return spec;
  const p = PRESET_LIB[spec.use];
  if (!p) throw new Error('Unknown preset "' + spec.use + '". The library has: ' + Object.keys(PRESET_LIB).join(', ') + '.');
  const q = spec.query || {}, by = (q.by || [])[0], m = (q.metrics || [])[0];
  if (!by) throw new Error('The "' + spec.use + '" preset needs a dimension in query.by.');
  const out = {};
  Object.keys(spec).forEach(function (k) { if (k !== 'use') out[k] = spec[k]; });
  if (spec.layers) return out;                               // layers written in the spec win over the preset
  out.layers = p.layers.filter(function (l) { return l.series !== 'previous' || q.compare === 'previous'; }).map(function (l) {
    const c = JSON.parse(JSON.stringify(l));
    Object.keys(c.encode).forEach(function (ch) { c.encode[ch] = c.encode[ch] === '$by' ? by : c.encode[ch] === '$metric' ? m : c.encode[ch]; });
    return c;
  });
  return out;
}

/* ───────────────────────── 6. Plan ─────────────────────────
 * Start from everything the spec asks for, then apply the host's reductions
 * in order until the view fits. Layers carry a role; reductions act on roles. */
const ROLE_NAMES = { comparison: 'comparison series', reference: 'reference lines', context: 'context fill' };
function roleOf(l) { return l.role || (l.series === 'previous' ? 'comparison' : l.mark === 'rule' ? 'reference' : 'primary'); }
function isDim(f) { return typeof f === 'string' && f in CATALOG.dimensions; }
function detectLayout(layers) {
  if (layers.some(function (l) { return l.encode && isDim(l.encode.x); })) return 'cartesian';
  if (layers.some(function (l) { return l.encode && isDim(l.encode.y); })) return 'rows';
  if (layers.some(function (l) { return l.encode && isDim(l.encode.color); })) return 'band';
  throw new Error('These layers put no dimension on x, y or color, so there is nothing to lay out.');
}
function checkLayers(layers, q) {
  const known = (q.by || []).concat(q.metrics);
  layers.forEach(function (l, i) {
    if (!l || !l.mark) throw new Error('Layer ' + (i + 1) + ' has no "mark". Use one of: line, area, bar, rule, text.');
    Object.keys(l.encode || {}).forEach(function (ch) {
      const f = l.encode[ch];
      if (typeof f === 'number') return;
      if (known.indexOf(f) < 0) throw new Error('Layer ' + (i + 1) + ' encodes "' + f + '" on ' + ch + ', which the query does not return. It returns: ' + known.join(', ') + '.');
    });
  });
}
function headValue(q, result, compact) {
  const m = q.metrics[0];
  if (CATALOG.metrics[m].instant) return String(result.totals[m] || 0);
  return result.meta.empty ? '0' : fmt(result.totals[m], compact);
}
// The sentence is derived from the query and the transforms, not from a named chart type.
function describe(q, result, share) {
  const m = q.metrics[0], M = CATALOG.metrics[m], t = result.totals, rows = result.rows, by = (q.by || [])[0];
  const range = rangeLabel(result.meta.range), name = M.label.toLowerCase();
  if (M.instant) {
    const n = t[m] || 0;
    if (!n) return 'Nobody is on the site right now.';
    return n + (n === 1 ? ' person is' : ' people are') + ' on the site right now' + (rows[0] ? '; the busiest page is ' + rows[0].page + ' (' + rows[0][m] + ').' : '.');
  }
  if (result.meta.empty) return 'No ' + name + ' recorded in the ' + range + '.';
  if (by && CATALOG.dimensions[by].type !== 'time' && rows.length) {
    const label = CATALOG.dimensions[by].label.toLowerCase();
    if (share && rows.length > 1) {
      const tot = d3.sum(rows, function (r) { return r[m]; }) || 1;
      return rows[0][by] + ' is the largest ' + label + ' at ' + fmtPct(rows[0][m] / tot) + ' of ' + name + ', followed by ' + rows[1][by] + ' at ' + fmtPct(rows[1][m] / tot) + '.';
    }
    return 'Top ' + label + 's by ' + name + ', ' + range + ': ' + rows.slice(0, 3).map(function (r) { return r[by] + ' (' + fmt(r[m]) + ')'; }).join(', ') + '.';
  }
  let s = M.label + ': ' + fmt(t[m]) + ' in the ' + range;
  if (q.compare === 'previous') {
    const d = delta(t[m], t[m + '@previous'], M.polarity);
    s += d.pct != null ? ', ' + (d.pct > 0 ? 'up ' : 'down ') + fmtPct(Math.abs(d.pct)) + ' on the previous period'
       : d.state === 'flat' ? ', level with the previous period' : ', with no prior period to compare';
  }
  s += '.';
  if (M.rangeTotal === 'sum of daily') s += ' This is a sum of daily counts, not unique people.';
  return s;
}

function resolve(spec0, result, host) {
  const spec = expand(spec0), q = spec.query || {};
  if (!q.metrics || !q.metrics.length) throw new Error('A view needs query.metrics, for example ["visitors"].');
  const m = q.metrics[0], M = CATALOG.metrics[m], by = (q.by || [])[0], rules = host.rules, keep = spec.keep || [], dropped = [];
  let layers = (spec.layers || []).slice();
  if (!layers.length && by) throw new Error('This spec has a dimension but no layers, so there is nothing to draw it with. Add "layers", or "use" one of: ' + Object.keys(PRESET_LIB).join(', ') + '.');
  checkLayers(layers, q);
  if (layers.some(function (l) { return l.series === 'previous'; }) && (q.compare !== 'previous' || result.totals[m + '@previous'] == null)) {
    layers = layers.filter(function (l) { return l.series !== 'previous'; });
    if (!result.meta.empty) dropped.push(q.compare === 'previous' ? 'comparison series (no prior data)' : 'comparison series (the query has no "compare")');
  }
  const share = layers.some(function (l) { return l.stack === 'normalize'; });
  const p = { layout: layers.length ? detectLayout(layers) : 'none', layers: layers, guides: {}, headline: !!spec.headline || !layers.length, side: false, rowLimit: null,
              share: share, text: describe(q, result, share) };
  if (p.layout === 'cartesian') p.guides = Object.assign({ x: true, y: true, grid: true }, spec.guides || {});
  if (p.layout === 'band') p.guides = { legend: (spec.guides && spec.guides.legend) || 'full' };
  if (result.meta.empty || (M.instant && !result.rows.length)) {
    if (M.instant || !layers.length) { p.layout = 'none'; p.layers = []; p.headline = true; p.guides = {}; }
    else { p.layout = 'notice'; p.layers = []; p.guides = {}; p.headline = false; }
  }

  const headLen = headValue(q, result, true).length;
  const sideMin = Math.max(76, host.displayWidth(headLen));
  function minWidth() {
    let w = 0;
    if (p.layout === 'none') w = host.displayWidth(headLen);
    else if (p.layout === 'notice') w = rules.notice.minWidth;
    else if (p.layout === 'cartesian') w = p.side ? sideMin + 12 + rules.bare.minPlotWidth : (p.guides.x || p.guides.y) ? rules.axes.minWidth : rules.bare.minPlotWidth;
    else if (p.layout === 'rows') w = valueRoomOf(p.layers, result.rows) + rules.rows.minLabelWidth;
    else if (p.layout === 'band') w = p.guides.legend === 'full' ? rules.band.minWidthWithLegend : rules.band.minWidth;
    return p.headline && !p.side && p.layout !== 'sentence' ? Math.max(w, host.displayWidth(headLen)) : w;
  }
  let scene;
  function fits() {
    scene = buildScene(p, q, result, host);
    if (p.layout === 'sentence') return true;
    if (host.width < minWidth()) return false;
    if (host.height != null && scene.height > host.height) return false;
    if (p.layout === 'cartesian' && scene.plot && p.layers.some(function (l) { return roleOf(l) !== 'primary'; }))
      return scene.plot.w >= rules.secondary.minPlotWidth && scene.plot.h >= rules.secondary.minPlotHeight;
    return true;
  }
  const act = {
    'drop-guides': function () {
      if (p.layout === 'cartesian' && (p.guides.x || p.guides.y || p.guides.grid)) { p.guides = { x: false, y: false, grid: false }; p.headline = true; p.side = true; return 'axes and grid (added the number to make up for them)'; }
      if (p.layout === 'band' && p.guides.legend === 'full') { p.guides = { legend: 'top' }; return 'the legend, except the largest segment'; }
      return null;
    },
    'drop-secondary': function () {
      const gone = p.layers.filter(function (l) { return roleOf(l) !== 'primary'; });
      if (!gone.length) return null;
      p.layers = p.layers.filter(function (l) { return roleOf(l) === 'primary'; });
      if (!p.layers.length) { p.layout = 'none'; p.headline = true; p.side = false; p.guides = {}; }
      return gone.map(function (l) { return ROLE_NAMES[roleOf(l)] || roleOf(l) + ' layers'; }).filter(function (s, i, a) { return a.indexOf(s) === i; }).join(', ');
    },
    'trim-rows': function () {
      if (p.layout !== 'rows' || host.height == null) return null;
      const n = result.rows.length, cur = p.rowLimit || n, rh = rules.rows.rowHeight + rules.rows.gap;
      const above = p.headline ? headline(q, result, share, host, host.width, false).height + 16 : 0;
      const k = Math.max(1, Math.floor((host.height - above + rules.rows.gap) / rh));
      if (k >= cur) return null;
      p.rowLimit = k;
      return k + 1 === n ? 'row ' + n : 'rows ' + (k + 1) + ' to ' + n;
    },
    'collapse': function () {
      if (p.layout === 'none') return null;
      const was = p.layout; p.layout = 'none'; p.layers = []; p.guides = {}; p.headline = true; p.side = false; p.rowLimit = null;
      return was === 'notice' ? 'the empty-state notice' : 'all marks (kept the number)';
    },
    'sentence': function () { p.layout = 'sentence'; p.layers = []; p.guides = {}; p.headline = false; p.side = false; return 'the number (kept the sentence)'; },
  };
  const steps = rules.order.map(function (id) { return { id: id, state: 'not needed' }; });
  let done = fits();
  steps.forEach(function (st) {
    if (done) return;
    if (KEEP[st.id] && keep.indexOf(KEEP[st.id]) >= 0) { st.state = 'kept by the spec'; return; }
    const what = act[st.id]();
    if (what) { st.state = 'applied'; dropped.push(what); done = fits(); } else st.state = 'nothing to drop';
  });
  if (p.layout === 'cartesian' && p.guides.x && host.width < 380 && isDim(by) && CATALOG.dimensions[by].type === 'time') dropped.push('the middle date label');

  return {
    preset: spec0.use && !spec0.layers ? spec0.use : null, layout: p.layout,
    layers: p.layers.map(function (l) { return Object.assign({}, l, { role: roleOf(l) }); }),
    guides: p.guides, headline: p.headline, side: p.side, rowLimit: p.rowLimit, share: p.share,
    reductions: steps, dropped: dropped, needs: { width: minWidth(), height: scene.height }, text: p.text,
  };
}

/* ───────────────────────── 7. Scene ─────────────────────────
 * Node kinds: rect, path, line, circle, text. Every node has a stable key,
 * a paint token (never a colour) and a layer: "data" or "guide". */
function shift(nodes, dx, dy) { nodes.forEach(function (n) { n.tx = (n.tx || 0) + dx; n.ty = (n.ty || 0) + dy; }); return nodes; }
// A dimension on x, a metric on y: line, area, bar, rule.
function sceneCartesian(layers, guides, rows, W, H) {
  const nodes = [];
  const xField = layers.map(function (l) { return l.encode && l.encode.x; }).find(isDim);
  const keys = rows.map(function (r) { return r[xField]; });
  const isTime = CATALOG.dimensions[xField].type === 'time';
  const hasBar = layers.some(function (l) { return l.mark === 'bar'; });
  const yField = function (l) { return l.series === 'previous' ? l.encode.y + '@previous' : l.encode.y; };
  const yVals = [];
  layers.forEach(function (l) {
    const y = l.encode && l.encode.y;
    if (typeof y === 'number') yVals.push(y);
    else if (y) rows.forEach(function (r) { const v = r[yField(l)]; if (v != null) yVals.push(v); });
  });
  const nTicks = H < 120 ? 2 : 4;
  const ml = guides.y ? 36 : 1, mr = guides.y ? 6 : 1, mt = guides.y ? 10 : 3, mb = guides.x ? 22 : 3;
  const y = d3.scaleLinear().domain([0, d3.max(yVals) || 1]).range([H - mb, mt]);
  if (guides.y) y.nice(nTicks);
  const x = hasBar
    ? d3.scaleBand().domain(keys).range([ml, W - mr]).paddingInner(0.26).paddingOuter(0.1)
    : d3.scalePoint().domain(keys).range([ml + 2, W - mr - 2]);
  const cx = function (k) { return x(k) + (hasBar ? x.bandwidth() / 2 : 0); };

  if (guides.y) y.ticks(nTicks).forEach(function (t) {
    if (guides.grid) nodes.push({ key: 'grid:' + t, kind: 'line', x1: ml, x2: W - mr, y1: y(t), y2: y(t), paint: t === 0 ? 'axis' : 'grid', layer: 'guide' });
    nodes.push({ key: 'ytick:' + t, kind: 'text', x: ml - 6, y: y(t), text: fmt(t, true), anchor: 'end', baseline: 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
  });
  if (guides.x && keys.length) {
    const last = keys.length - 1;
    const idx = isTime ? (W < 380 || last < 2 ? [0, last] : [0, Math.floor(last / 2), last]) : keys.map(function (_, i) { return i; });
    idx.forEach(function (i, j) {
      nodes.push({ key: 'xtick:' + keys[i], kind: 'text', x: cx(keys[i]), y: H - 5, text: isTime ? fmtDay(keys[i]) : String(keys[i]),
        anchor: !isTime ? 'middle' : j === 0 ? 'start' : j === idx.length - 1 ? 'end' : 'middle', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    });
  }
  layers.forEach(function (l, i) {
    const id = 'L' + i + ':' + l.mark, prev = l.series === 'previous';
    const paint = l.paint || (prev ? 'compare' : 'series.1');
    if (l.mark === 'line' || l.mark === 'area') {
      const f = yField(l), pts = rows.filter(function (r) { return r[f] != null; });
      const whole = pts.filter(function (r) { return prev || !r.partial; });
      if (!whole.length) return;
      const px = function (r) { return cx(r[xField]); }, py = function (r) { return y(r[f]); };
      if (l.mark === 'area') {
        nodes.push({ key: id, kind: 'path', d: d3.area().x(px).y0(y(0)).y1(py).curve(d3.curveMonotoneX)(whole), fill: true, paint: paint, opacity: 0.14, layer: 'data' });
      } else {
        nodes.push({ key: id, kind: 'path', d: d3.line().x(px).y(py).curve(d3.curveMonotoneX)(whole), paint: paint, width: prev ? 1.5 : 2, dash: prev ? '3 3' : null, layer: 'data' });
        const tail = prev ? [] : pts.filter(function (r) { return r.partial; });
        if (tail.length) nodes.push({ key: id + ':partial', kind: 'path', d: d3.line().x(px).y(py)([whole[whole.length - 1]].concat(tail)), paint: paint, width: 2, dash: '2 4', opacity: 0.75, layer: 'data', note: 'incomplete bucket' });
      }
    } else if (l.mark === 'bar') {
      const f = yField(l);
      rows.forEach(function (r) {
        if (r[f] == null) return;
        nodes.push({ key: id + ':' + r[xField], kind: 'rect', x: x(r[xField]), y: y(r[f]), w: x.bandwidth(), h: Math.max(0, y(0) - y(r[f])), rx: Math.min(2, x.bandwidth() / 4),
          paint: paint, opacity: r.partial && !prev ? 0.4 : 1, layer: 'data' });
      });
    } else if (l.mark === 'rule') {
      const v = l.encode.y;
      nodes.push({ key: id, kind: 'line', x1: ml, x2: W - mr, y1: y(v), y2: y(v), paint: 'rule', dash: '5 3', width: 1.5, layer: 'data' });
      if (l.label) nodes.push({ key: id + ':label', kind: 'text', x: W - mr, y: y(v) - 5, text: l.label, anchor: 'end', font: 'tick', paint: 'rule', halo: true, layer: 'guide' });
    } else {
      throw new Error('The "' + l.mark + '" mark has no rule for a time or category axis yet. Use line, area, bar or rule.');
    }
  });
  return { nodes: nodes, height: H };
}

function valueRoomOf(layers, rows) {
  let room = 0;
  layers.forEach(function (l) {
    if (l.mark === 'text' && l.encode.text in CATALOG.metrics) room = Math.max(room, (d3.max(rows, function (r) { return fmt(r[l.encode.text]).length; }) || 0) * CHAR_W + 14);
  });
  return room;
}
// A dimension on y, a metric on x: the ranked bar list.
function sceneRows(layers, rows, W, rowH) {
  const nodes = [], gap = 4; rowH = rowH || 28;
  const dim = layers.map(function (l) { return l.encode && l.encode.y; }).find(isDim);
  const barL = layers.find(function (l) { return l.mark === 'bar'; });
  const x = d3.scaleLinear().domain([0, barL ? d3.max(rows, function (r) { return r[barL.encode.x]; }) || 1 : 1]).range([0, W]);
  const valueRoom = valueRoomOf(layers, rows);
  rows.forEach(function (r, i) {
    const top = i * (rowH + gap), k = r[dim];
    layers.forEach(function (l, li) {
      if (l.mark === 'bar') {
        nodes.push({ key: 'L' + li + ':bar:' + k, kind: 'rect', x: 0, y: top, w: Math.max(3, x(r[l.encode.x])), h: rowH, rx: 3, paint: l.paint || 'series.1', opacity: 0.2, layer: 'data' });
      } else if (l.mark === 'text') {
        const f = l.encode.text, metric = f in CATALOG.metrics, end = l.align === 'end';
        const raw = metric ? fmt(r[f]) : String(r[f]);
        nodes.push({ key: 'L' + li + ':text:' + k, kind: 'text', x: end ? W - 8 : 8, y: top + rowH / 2, text: end ? raw : clip(raw, Math.floor((W - 16 - valueRoom) / CHAR_W)),
          anchor: end ? 'end' : 'start', baseline: 'middle', font: metric ? 'value' : 'label', paint: 'ink', layer: 'data' });
      } else {
        throw new Error('The "' + l.mark + '" mark has no rule for rows yet. Use bar or text.');
      }
    });
  });
  return { nodes: nodes, height: Math.max(0, rows.length * (rowH + gap) - gap) };
}

// No positional dimension: one band, stacked and normalized, split by colour.
function sceneBand(layer, rows, W, legend) {
  const nodes = [], m = layer.encode.x, dim = layer.encode.color, barH = 24, gap = 2;
  const total = d3.sum(rows, function (r) { return r[m]; }) || 1, usable = W - gap * (rows.length - 1);
  let x0 = 0, h = barH;
  rows.forEach(function (r, i) {
    const w = (r[m] / total) * usable;
    nodes.push({ key: 'seg:' + r[dim], kind: 'rect', x: x0, y: 0, w: w, h: barH, rx: 2, paint: 'series.' + ((i % 6) + 1), layer: 'data' });
    x0 += w + gap;
  });
  if (legend === 'full') {
    rows.forEach(function (r, i) {
      const yy = barH + 20 + i * 24;
      nodes.push({ key: 'swatch:' + r[dim], kind: 'rect', x: 0, y: yy - 6, w: 12, h: 12, rx: 2, paint: 'series.' + ((i % 6) + 1), layer: 'data' });
      nodes.push({ key: 'legend:' + r[dim], kind: 'text', x: 20, y: yy, text: clip(String(r[dim]), Math.floor((W - 70) / CHAR_W)), anchor: 'start', baseline: 'middle', font: 'label', paint: 'ink', layer: 'guide' });
      nodes.push({ key: 'share:' + r[dim], kind: 'text', x: W, y: yy, text: fmtPct(r[m] / total), anchor: 'end', baseline: 'middle', font: 'value', paint: 'ink', layer: 'guide' });
      h = yy + 10;
    });
  } else if (legend === 'top' && rows.length) {
    nodes.push({ key: 'legend:top', kind: 'text', x: 0, y: barH + 18, text: clip(rows[0][dim] + ' ' + fmtPct(rows[0][m] / total), Math.floor(W / CHAR_W)), anchor: 'start', font: 'label', paint: 'ink', layer: 'guide' });
    h = barH + 24;
  }
  return { nodes: nodes, height: h };
}

// One big number, an optional delta and an optional note.
function sceneStat(o) {
  const nodes = [], W = o.W, lead = o.pulse != null ? 20 : 0;
  const disp = o.host.display(o.value.length, W - lead, o.small);
  if (o.pulse != null) nodes.push({ key: 'pulse', kind: 'circle', cx: 7, cy: disp.h / 2, r: 5, paint: o.pulse ? 'live' : 'ink.muted', pulse: !!o.pulse, layer: 'data' });
  nodes.push({ key: 'value', kind: 'text', x: lead, y: 0, h: disp.h, cell: disp.cell, text: o.value, anchor: 'start', font: 'display', paint: 'ink', layer: 'data' });
  let yy = disp.h + 18;
  if (o.delta) {
    const long = !o.small && W >= 200 && o.delta.pct != null;
    nodes.push({ key: 'delta', kind: 'text', x: 0, y: yy, text: clip(o.delta.text + (long ? ' on the previous period' : ''), Math.floor(W / CHAR_W)), anchor: 'start', font: 'value', paint: o.delta.paint, layer: 'guide' });
    yy += 18;
  }
  if (o.sub && W >= 120) {
    nodes.push({ key: 'sub', kind: 'text', x: 0, y: yy, text: clip(o.sub, Math.floor(W / (CHAR_W - 0.8))), anchor: 'start', font: 'tick', paint: 'ink.muted', layer: 'guide' });
    yy += 16;
  }
  return { nodes: nodes, height: yy - 10 };
}

// The number: a total from the engine, a delta if the query compares, and a derived note.
function headline(q, result, share, host, W, small) {
  const m = q.metrics[0], M = CATALOG.metrics[m], t = result.totals, by = (q.by || [])[0], rows = result.rows;
  if (M.instant) { const n = t[m] || 0; return sceneStat({ value: String(n), sub: n ? 'on the site right now' : 'Nobody is here right now', W: W, host: host, pulse: n > 0, small: small }); }
  if (result.meta.empty) return sceneStat({ value: '0', sub: 'No visits yet', W: W, host: host, small: small });
  let note = M.rangeTotal === 'sum of daily' ? 'Sum of daily counts' : null;
  if (by && CATALOG.dimensions[by].type !== 'time' && rows.length) {
    note = share ? rows[0][by] + ' ' + fmtPct(rows[0][m] / (d3.sum(rows, function (r) { return r[m]; }) || 1)) : 'Top: ' + rows[0][by];
  }
  const dl = q.compare === 'previous' ? delta(t[m], t[m + '@previous'], M.polarity) : null;
  return sceneStat({ value: fmt(t[m], small || W < 160), delta: dl, sub: small ? null : note, W: W, host: host, small: small });
}

function buildScene(p, q, result, host) {
  const W = host.width, H = host.height, rules = host.rules;
  if (p.layout === 'sentence') return { width: W, height: 0, nodes: [], text: p.text };
  let out, plot = null;
  if (p.layout === 'none') {
    out = headline(q, result, p.share, host, W, false);
  } else if (p.layout === 'cartesian' && p.side) {             // a bare plot, set beside the number
    const lw = Math.round(Math.max(host.displayWidth(headValue(q, result, true).length), Math.min(120, Math.max(76, W * 0.42))));
    const s = headline(q, result, p.share, host, lw, true), h = Math.max(rules.bare.height, s.height), pw = Math.max(8, W - lw - 12);
    const c = sceneCartesian(p.layers, p.guides, result.rows, pw, h);
    out = { nodes: s.nodes.concat(shift(c.nodes, lw + 12, 0)), height: h }; plot = { w: pw, h: h };
  } else {
    const hd = p.headline ? headline(q, result, p.share, host, W, false) : null, above = hd ? hd.height + 16 : 0;
    let body;
    if (p.layout === 'notice') {
      const h = H ? Math.max(40, Math.min(120, H - above)) : 120;
      body = { height: h, nodes: [{ key: 'notice', kind: 'text', x: W / 2, y: h / 2, text: clip('No visits in this period yet', Math.floor(W / CHAR_W)), anchor: 'middle', baseline: 'middle', font: 'label', paint: 'ink.muted', layer: 'guide' }] };
    } else if (p.layout === 'cartesian') {
      const guided = p.guides.x || p.guides.y;
      const ph = !guided ? rules.bare.height : H ? Math.max(rules.axes.minHeight, Math.min(rules.axes.height, H - above)) : rules.axes.height;
      body = sceneCartesian(p.layers, p.guides, result.rows, W, ph); plot = { w: W, h: ph };
    } else if (p.layout === 'rows') {
      body = sceneRows(p.layers, result.rows.slice(0, p.rowLimit || result.rows.length), W);
    } else {
      body = sceneBand(p.layers[0], result.rows, W, p.guides.legend);
    }
    out = hd ? { nodes: hd.nodes.concat(shift(body.nodes, 0, above)), height: above + body.height } : body;
  }
  const scene = { width: W, height: Math.ceil(out.height), nodes: out.nodes };
  if (plot) scene.plot = plot;
  return scene;
}

const core = { CATALOG: CATALOG, HOST_RULES: HOST_RULES, PRESET_LIB: PRESET_LIB, runQuery: runQuery, makeHost: makeHost, expand: expand, resolve: resolve, buildScene: buildScene, rangeLabel: rangeLabel };
root.VGB = core;
if (typeof document === 'undefined') return;

/* ───────────────────────── 8. Painters ───────────────────────── */
const NS = 'http://www.w3.org/2000/svg';
const pv = function (token) { return 'var(--p-' + token.replace(/\./g, '-') + ')'; };

// SVG painter. Elements are reused by key, so a later version can animate between scenes.
function paintSVG(svg, scene, keep) {
  svg.setAttribute('width', scene.width); svg.setAttribute('height', scene.height);
  svg.setAttribute('viewBox', '0 0 ' + scene.width + ' ' + scene.height);
  const els = svg._els || (svg._els = new Map()), seen = new Set();
  let i = 0;
  scene.nodes.forEach(function (n) {
    if (keep && !keep(n)) return;
    const tag = n.kind === 'text' ? 'text' : n.kind;
    let el = els.get(n.key);
    if (!el || el.tagName !== tag) { if (el) el.remove(); el = document.createElementNS(NS, tag); els.set(n.key, el); }
    const c = pv(n.paint), a = { transform: n.tx || n.ty ? 'translate(' + (n.tx || 0) + ',' + (n.ty || 0) + ')' : null, opacity: n.opacity == null ? null : n.opacity };
    if (n.kind === 'rect') Object.assign(a, { x: n.x, y: n.y, width: Math.max(0, n.w), height: Math.max(0, n.h), rx: n.rx || 0, fill: c });
    else if (n.kind === 'path') Object.assign(a, { d: n.d, fill: n.fill ? c : 'none', stroke: n.fill ? null : c, 'stroke-width': n.fill ? null : n.width || 2, 'stroke-dasharray': n.dash || null, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (n.kind === 'line') Object.assign(a, { x1: n.x1, y1: n.y1, x2: n.x2, y2: n.y2, stroke: c, 'stroke-width': n.width || 1, 'stroke-dasharray': n.dash || null, 'shape-rendering': 'crispEdges' });
    else if (n.kind === 'circle') Object.assign(a, { cx: n.cx, cy: n.cy, r: n.r, fill: c, class: n.pulse ? 'pulse' : null });
    else {
      const display = n.font === 'display';
      Object.assign(a, { x: n.x, y: display ? n.y + n.h * 0.82 : n.y, fill: c, class: 'f-' + n.font + (n.halo ? ' halo' : ''), 'text-anchor': n.anchor || 'start',
        'dominant-baseline': n.baseline === 'middle' ? 'central' : null, 'font-size': display ? Math.round(n.h * 1.08) : null });
      el.textContent = n.text;
    }
    Object.keys(a).forEach(function (k) { if (a[k] == null) el.removeAttribute(k); else el.setAttribute(k, a[k]); });
    if (svg.children[i] !== el) svg.insertBefore(el, svg.children[i] || null);
    seen.add(n.key); i++;
  });
  els.forEach(function (el, k) { if (!seen.has(k)) { el.remove(); els.delete(k); } });
}

// Dot painter. Cells are fixed in space; a shape only decides which cells are lit.
// Light mode reads as an LCD (one ink, series told apart by dither pattern).
// Dark mode reads as a VFD (series told apart by wide-gamut hue, no glow).
const FONT = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'], '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'], '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'], '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'], '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'], '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'], ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  'k': ['10000', '10000', '10010', '10100', '11000', '10100', '10010'], 'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'], '%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'], '–': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
};
const NARROW = { '.': 1, ',': 1 };
const PATTERNS = {
  solid:   function () { return true; },
  checker: function (x, y) { return (x + y) % 2 === 0; },
  hstripe: function (x, y) { return y % 2 === 0; },
  sparse:  function (x, y) { return x % 2 === 0 && y % 2 === 0; },
  diag:    function (x, y) { return (x + y) % 3 === 0; },
  vstripe: function (x, y) { return x % 2 === 0; },
};
const LCD_PATTERNS = ['solid', 'checker', 'hstripe', 'sparse', 'diag', 'vstripe'];
const DOT_THEME = {
  light: { off: 'rgba(28,42,34,0.075)', hues: [['#1c2a22', null]] },
  dark:  { off: 'rgba(120,255,230,0.055)', hues: [
    ['#3dffd9', 'color(display-p3 0.20 1.00 0.84)'], ['#ffb640', 'color(display-p3 1.00 0.72 0.20)'], ['#ff5c9a', 'color(display-p3 1.00 0.36 0.60)'],
    ['#6aa0ff', 'color(display-p3 0.40 0.62 1.00)'], ['#e6f0ee', 'color(display-p3 0.90 0.94 0.93)'], ['#2f8f80', 'color(display-p3 0.25 0.56 0.50)']] },
};
function dotStyle(n, mode) {
  const s = /^series\.(\d)$/.exec(n.paint);
  let slot = s ? +s[1] - 1 : n.paint === 'rule' ? 1 : n.paint === 'compare' || n.paint === 'ink.muted' ? 5 : 0;
  let pattern = mode === 'light' ? LCD_PATTERNS[slot] : 'solid';
  if (n.paint === 'compare' || n.dash) pattern = 'checker';
  if (n.kind === 'line' && n.dash) pattern = 'vstripe';
  if (n.opacity != null && n.opacity < 0.3) pattern = 'sparse';
  else if (n.opacity != null && n.opacity < 0.6) pattern = 'checker';
  return { slot: mode === 'light' ? 0 : slot, pattern: pattern };
}
function paintDots(canvas, scene, cell, mode) {
  const cols = Math.max(1, Math.floor(scene.width / cell)), rows = Math.max(1, Math.ceil(scene.height / cell));
  const dpr = Math.min(3, window.devicePixelRatio || 1), theme = DOT_THEME[mode] || DOT_THEME.light;
  canvas.width = cols * cell * dpr; canvas.height = rows * cell * dpr;
  canvas.style.width = cols * cell + 'px'; canvas.style.height = rows * cell + 'px';
  let ctx; try { ctx = canvas.getContext('2d', { colorSpace: 'display-p3' }); } catch (e) { ctx = null; }
  ctx = ctx || canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cols * cell, rows * cell);
  const grid = new Array(cols * rows).fill(null);
  const light = function (x, y, st) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    if (PATTERNS[st.pattern](x, y)) grid[y * cols + x] = st.slot; else if (st.clear) grid[y * cols + x] = null;
  };
  const mask = paintDots._mask || (paintDots._mask = document.createElement('canvas'));
  mask.width = cols; mask.height = rows;
  const mctx = mask.getContext('2d', { willReadFrequently: true });

  scene.nodes.forEach(function (n) {
    const tx = n.tx || 0, ty = n.ty || 0;
    if (n.kind === 'text') {
      if (n.font !== 'display') return;
      const c = n.cell || cell, k = c / cell;                // glyph cells may be coarser than the grid
      let gx = Math.round((n.x + tx) / cell);
      const gy = Math.round((n.y + ty) / cell);
      n.text.split('').forEach(function (ch) {
        const g = FONT[ch], off = NARROW[ch] || 0;
        if (g) g.forEach(function (row, ry) { row.split('').forEach(function (bit, rx) {
          if (bit !== '1') return;
          for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) light(gx + (rx - off) * k + a, gy + ry * k + b, { slot: 0, pattern: 'solid' });
        }); });
        gx += (NARROW[ch] ? 4 : 6) * k;
      });
      return;
    }
    if (n.layer !== 'data') return;
    const st = dotStyle(n, mode); st.clear = true;           // a shape replaces what was under it
    if (n.kind === 'rect') {
      const x0 = Math.round((n.x + tx) / cell), y0 = Math.round((n.y + ty) / cell);
      const x1 = Math.max(x0 + 1, Math.round((n.x + tx + n.w) / cell)), y1 = Math.max(y0 + (n.h > 0 ? 1 : 0), Math.round((n.y + ty + n.h) / cell));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) light(x, y, st);
      return;
    }
    mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.clearRect(0, 0, cols, rows);
    mctx.setTransform(1 / cell, 0, 0, 1 / cell, tx / cell, ty / cell);
    mctx.fillStyle = mctx.strokeStyle = '#000'; mctx.lineWidth = cell * 1.3; mctx.lineJoin = mctx.lineCap = 'round';
    let cut = 110;
    if (n.kind === 'path') { const p = new Path2D(n.d); if (n.fill) { mctx.fill(p); cut = 127; } else mctx.stroke(p); }
    else if (n.kind === 'line') { mctx.beginPath(); mctx.moveTo(n.x1, n.y1); mctx.lineTo(n.x2, n.y2); mctx.stroke(); }
    else if (n.kind === 'circle') { mctx.beginPath(); mctx.arc(n.cx, n.cy, Math.max(n.r, cell), 0, Math.PI * 2); mctx.fill(); cut = 90; }
    const px = mctx.getImageData(0, 0, cols, rows).data;
    if (n.fill) st.clear = false;                            // a soft fill sits under what is already lit
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (px[(y * cols + x) * 4 + 3] > cut) { if (n.fill && grid[y * cols + x] != null) continue; light(x, y, st); }
  });

  const size = cell - (cell >= 8 ? 2 : 1);
  ctx.fillStyle = theme.off;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y * cols + x] == null) ctx.fillRect(x * cell, y * cell, size, size);
  theme.hues.forEach(function (h, slot) {
    ctx.fillStyle = h[0]; if (h[1]) { try { ctx.fillStyle = h[1]; } catch (e) { /* keep sRGB */ } }
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (grid[y * cols + x] === slot) ctx.fillRect(x * cell, y * cell, size, size);
  });
}

/* ───────────────────────── 9. The bench ───────────────────────── */
const SAMPLES = {
  trend:  { label: 'Visitors over time', spec: { spec: 'view/0', title: 'Visitors',    use: 'trend',     query: { metrics: ['visitors'],  by: ['date.day'], range: '28d', compare: 'previous' } } },
  pages:  { label: 'Top pages',          spec: { spec: 'view/0', title: 'Top pages',   use: 'bar-list',  query: { metrics: ['pageviews'], by: ['page'],     range: '28d', limit: 8 } } },
  mix:    { label: 'Channel mix',        spec: { spec: 'view/0', title: 'Channels',    use: 'share-bar', query: { metrics: ['visitors'],  by: ['channel'],  range: '28d' } } },
  total:  { label: 'Page views total',   spec: { spec: 'view/0', title: 'Page views',  query: { metrics: ['pageviews'], range: '28d', compare: 'previous' } } },
  live:   { label: 'Present now',        spec: { spec: 'view/0', title: 'Present now', use: 'bar-list',  headline: true, query: { metrics: ['present'], by: ['page'] } } },
  layers: { label: 'Written as layers: bars and a target', spec: { spec: 'view/0', title: 'Daily page views', query: { metrics: ['pageviews'], by: ['date.day'], range: '28d' },
            layers: [{ mark: 'bar', encode: { x: 'date.day', y: 'pageviews' } }, { mark: 'rule', encode: { y: 1000 }, label: 'Target 1,000', role: 'reference' }] } },
};
const STEP_LABEL = { 'drop-guides': 'guides', 'drop-secondary': 'secondary', 'trim-rows': 'rows', 'collapse': 'marks', 'sentence': 'number' };
const PAD = 13;                                              // frame padding plus border, each side
const NO_LIMIT = 324;                                        // top of the height slider means "no limit"

function boot() {
  const $ = function (id) { return document.getElementById(id); };
  const state = { sample: 'trend', scenario: 'typical', painter: 'svg', cell: 4, width: 372, height: null, spec: null };
  const frame = $('frame'), body = $('body'), svg = $('svg'), dots = $('dots'), sentence = $('sentence'), specBox = $('spec');
  const mode = function () { return getComputedStyle(frame).getPropertyValue('--mode').trim() || 'light'; };

  function showError(msg) { const e = $('err'); e.hidden = !msg; e.textContent = msg || ''; }
  function pretty(v, ind) {
    ind = ind || '';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    const flat = JSON.stringify(v);
    if (flat.length <= 44) return flat.replace(/([{,\[])"/g, '$1 "').replace(/":/g, '": ').replace(/([^\[{ ])([}\]])/g, '$1 $2').replace(/\[ /g, '[').replace(/ \]/g, ']');
    const next = ind + '  ';
    if (Array.isArray(v)) return '[\n' + v.map(function (x) { return next + pretty(x, next); }).join(',\n') + '\n' + ind + ']';
    return '{\n' + Object.keys(v).map(function (k) { return next + JSON.stringify(k) + ': ' + pretty(v[k], next); }).join(',\n') + '\n' + ind + '}';
  }
  function round(k, v) { return typeof v === 'number' ? Math.round(v * 10) / 10 : k === 'd' && typeof v === 'string' && v.length > 64 ? v.slice(0, 64) + '…' : v; }

  function render(animate) {
    frame.style.width = state.width + 'px';
    frame.classList.toggle('dots', state.painter === 'dots');
    $('mark').style.left = state.width + 'px';
    const inner = state.width - PAD * 2;
    const W = state.painter === 'dots' ? Math.floor(inner / state.cell) * state.cell : inner;
    $('wOut').textContent = state.width + ' px wide, ' + W + ' px for the view. ' + (state.height ? state.height + ' px tall.' : 'No height limit.');
    $('expand').disabled = !(state.spec && state.spec.use && !state.spec.layers);
    let plan, scene, result;
    try {
      const host = makeHost(W, state.height, state.painter, state.cell);
      result = runQuery(state.spec.query, state.scenario);
      plan = resolve(state.spec, result, host);
      scene = buildScene(plan, state.spec.query, result, host);
    } catch (e) { showError('This spec can\u2019t be drawn. ' + e.message); return; }
    showError(null);

    const M = CATALOG.metrics[state.spec.query.metrics[0]];
    $('vTitle').textContent = state.spec.title || M.label;
    const rl = rangeLabel(result.meta.range);
    $('vRange').textContent = rl.charAt(0).toUpperCase() + rl.slice(1);
    $('vRange').hidden = W < 190;

    const isText = plan.layout === 'sentence';
    sentence.hidden = !isText; svg.style.display = isText ? 'none' : ''; dots.hidden = isText || state.painter !== 'dots';
    body.style.height = isText ? '' : (state.height || scene.height) + 'px';
    body.style.minHeight = isText && state.height ? state.height + 'px' : '';
    if (isText) sentence.textContent = scene.text;
    else {
      svg.classList.toggle('animate', !!animate);
      if (state.painter === 'dots') {
        paintDots(dots, scene, state.cell, mode());
        paintSVG(svg, scene, function (n) { return n.kind === 'text' ? n.font !== 'display' : n.layer === 'guide'; });
      } else paintSVG(svg, scene);
    }

    $('ladder').innerHTML = '';
    plan.reductions.forEach(function (st) {
      const li = document.createElement('li');
      li.textContent = STEP_LABEL[st.id]; li.title = st.state.charAt(0).toUpperCase() + st.state.slice(1);
      if (st.state === 'applied') li.setAttribute('aria-current', 'true');
      if (st.state === 'kept by the spec') li.className = 'off';
      $('ladder').appendChild(li);
    });
    $('rDropped').textContent = plan.dropped.length ? plan.dropped.join('; ') : 'Nothing';
    $('rText').textContent = plan.text;
    $('resolved').textContent = pretty(plan);
    const counts = {}; scene.nodes.forEach(function (n) { counts[n.kind] = (counts[n.kind] || 0) + 1; });
    $('sceneSum').textContent = scene.nodes.length + ' nodes' + (scene.nodes.length ? ': ' + Object.keys(counts).map(function (k) { return counts[k] + ' ' + k; }).join(', ') : '') + '. ' + scene.width + ' by ' + scene.height + ' px.';
    $('scene').textContent = pretty(JSON.parse(JSON.stringify(scene, round)));
  }

  function setSpec(spec) { state.spec = spec; specBox.value = pretty(spec); render(true); }
  function loadSample(id) { state.sample = id; setSpec(JSON.parse(JSON.stringify(SAMPLES[id].spec))); }
  function fitSlider() {
    const max = Math.max(160, Math.floor(($('stage').clientWidth) / 4) * 4);
    $('w').max = max; if (state.width > max) state.width = max; $('w').value = state.width;
  }

  Object.keys(SAMPLES).forEach(function (id) { const o = document.createElement('option'); o.value = id; o.textContent = SAMPLES[id].label; $('view').appendChild(o); });
  $('catalog').textContent = pretty({ catalog: CATALOG, presets: PRESET_LIB, hostRules: HOST_RULES });

  $('view').addEventListener('change', function (e) { loadSample(e.target.value); });
  $('data').addEventListener('change', function (e) { state.scenario = e.target.value; render(true); });
  $('w').addEventListener('input', function (e) { state.width = +e.target.value; render(false); });
  $('h').addEventListener('input', function (e) { const v = +e.target.value; state.height = v >= NO_LIMIT ? null : v; render(false); });
  $('reset').addEventListener('click', function () { loadSample(state.sample); });
  $('expand').addEventListener('click', function () { try { setSpec(expand(state.spec)); } catch (e) { showError('This spec can\u2019t be expanded. ' + e.message); } });
  $('theme').addEventListener('change', function (e) {
    if (e.target.value === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', e.target.value);
    render(false);
  });
  document.querySelectorAll('input[name=painter]').forEach(function (r) { r.addEventListener('change', function () { state.painter = r.value; $('cellPick').hidden = r.value !== 'dots'; render(false); }); });
  document.querySelectorAll('input[name=cell]').forEach(function (r) { r.addEventListener('change', function () { state.cell = +r.value; render(false); }); });
  document.querySelectorAll('[role=tab]').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('[role=tab]').forEach(function (o) { o.setAttribute('aria-selected', o === t ? 'true' : 'false'); $(o.getAttribute('aria-controls')).hidden = o !== t; });
    });
  });
  let timer;
  specBox.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      let parsed;
      try { parsed = JSON.parse(specBox.value); } catch (e) { showError('This spec isn\u2019t valid JSON yet (' + e.message + '). The last valid spec is still drawn.'); return; }
      state.spec = parsed; render(true);
    }, 300);
  });
  window.addEventListener('resize', function () { fitSlider(); render(false); });
  if (window.matchMedia) { const mq = window.matchMedia('(prefers-color-scheme: dark)'); if (mq.addEventListener) mq.addEventListener('change', function () { render(false); }); }

  fitSlider(); loadSample('trend');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { render(false); });
}

if (!d3) {
  document.addEventListener('DOMContentLoaded', function () {
    const e = document.getElementById('err'); e.hidden = false;
    e.textContent = 'The d3 library did not load, so nothing can be drawn. Check the connection and reload the page.';
  });
} else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
