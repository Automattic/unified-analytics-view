import { runQuery } from '@unified-analytics/fixtures';
import { defineSpikeView, shapes, yScale, type SpikeView, type TrendData } from './spike-view.ts';

/* THROWAWAY. The proofs for docs/dom-painter-plan.md section 7. The view is in spike-view.ts;
 * this file is the bench around it: frames, measurements and verdicts. */

// Item 7 listens first, before the painter defines anything.
const violations: string[] = [], refused: string[] = [];
let probing = false;
document.addEventListener('securitypolicyviolation', (e) => {
  (probing ? refused : violations).push(e.effectiveDirective + ' refused ' + (e.blockedURI || 'inline') + (e.sourceFile ? ' at ' + e.sourceFile + ':' + e.lineNumber : ''));
});
defineSpikeView();

const $ = (id: string) => document.getElementById(id)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: Element) => { const e = document.createElement(tag); e.className = cls; return parent.appendChild(e); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const near = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol;
const r1 = (n: number) => Math.round(n * 10) / 10;

/* Data: the real fixture result, and candidates for item 3's data change. */
const QUERY = { metrics: ['visitors'], by: ['date.day'], range: '28d' };
function ask(compare: boolean): TrendData {
  const r = runQuery(compare ? { ...QUERY, compare: 'previous' } : QUERY);
  return { title: 'Visitors', metric: 'visitors', days: 28, rows: r.rows, total: r.totals.visitors!, previous: r.totals['visitors@previous'] ?? null };
}
// A stand-in for a shorter range, which the fixture engine does not have. The page plays the engine here; the view still sums nothing.
function lastDays(d: TrendData, n: number): TrendData {
  const rows = d.rows.slice(-n), sum = (f: string) => rows.reduce((s, r) => s + ((r[f] as number) || 0), 0);
  return { ...d, days: n, rows, total: sum('visitors'), previous: sum('visitors@previous') };
}
const A = ask(true);
const CHANGES = [
  { name: 'the same query without its comparison', data: ask(false) },
  { name: 'the last 14 rows of the same result (a stand-in for a 14-day query)', data: lastDays(A, 14) },
  { name: 'the last 7 rows of the same result (a stand-in for a 7-day query)', data: lastDays(A, 7) },
];

/* Frames. A stack frame hands a width; a row frame hands a box. The layout rules are in bench.css, as section 4.2 writes them. */
interface Held { host: SpikeView; frame: HTMLElement; kind: 'stack' | 'row' }
const held: Held[] = [];
let current = A;
const setAll = (d: TrendData) => { current = d; held.forEach((h) => { h.host.data = d; }); };
const captions = new Map<Element, HTMLElement>();
const resized = new ResizeObserver((entries) => new Set(entries.map((e) => e.target.parentElement!)).forEach(caption));
function caption(frame: Element) {
  captions.get(frame)!.textContent = Array.from(frame.children, (h) => describe(read(h as SpikeView))).join('  |  ');
}
function addFrame(parent: string, kind: Held['kind'], w: number, h?: number, n = 1): Held[] {
  const cell = el('div', 'cell', $(parent)), frame = el('div', 'frame ua-' + kind, cell);
  frame.style.inlineSize = w + 'px';
  if (h) frame.style.blockSize = h + 'px';
  captions.set(frame, el('p', 'meta', cell));
  return Array.from({ length: n }, () => {
    const host = frame.appendChild(document.createElement('ua-spike-view') as SpikeView);
    host.data = current;
    resized.observe(host);
    const one: Held = { host, frame, kind };
    held.push(one);
    return one;
  });
}

/* What a view is showing, read from outside through its open shadow root. */
function read(host: SpikeView) {
  const q = <E extends Element = HTMLElement>(s: string) => host.shadowRoot!.querySelector<E>(s)!;
  const seen = (s: string) => q(s).checkVisibility();
  return {
    q, box: getComputedStyle(host).containerType === 'size', v: host.getBoundingClientRect(), p: q('.uav-plot').getBoundingClientRect(),
    shows: { yAxis: seen('.uav-y-axis'), xAxis: seen('.uav-x-axis'), grid: seen('.uav-grid'), number: seen('.uav-number'), plot: seen('.uav-plot'),
      mid: seen('.uav-x-axis .mid'), comparison: seen('[data-role="comparison"]'), context: seen('[data-role="context"]') },
  };
}
type Read = ReturnType<typeof read>;
const size = (r: DOMRect) => r1(r.width) + '×' + r1(r.height);
function describe(s: Read) {
  const on = Object.entries(s.shows).filter(([, v]) => v).map(([k]) => k);
  return size(s.v) + (s.box ? ' box' : ' natural') + (s.shows.plot ? ' · plot ' + size(s.p) : '') + ' · ' + on.join(', ');
}

/** The four fit rules of section 2, evaluated in script on the sizes the browser reports. Returns what disagrees. */
function againstRules(s: Read): string[] {
  const axes = s.v.width >= 280 && (!s.box || s.v.height >= 120), marks = s.v.width >= 152 && (!s.box || s.v.height >= 46);
  const secondary = marks && s.p.width >= 180 && s.p.height >= 90;
  const want: Read['shows'] = { yAxis: axes, xAxis: axes, grid: axes, number: !axes, plot: marks, mid: axes && s.v.width >= 380, comparison: secondary, context: secondary };
  return (Object.keys(want) as (keyof Read['shows'])[]).filter((k) => s.shows[k] !== want[k])
    .map((k) => k + ' is ' + (s.shows[k] ? 'showing' : 'hidden') + ' at ' + describe(s));
}

/** Item 4 and 6: is every box where the layout should have put it? */
function geometry(h: Held): string[] {
  const s = read(h.host), out: string[] = [], rect = (sel: string) => s.q(sel).getBoundingClientRect();
  const must = (ok: boolean, what: string) => { if (!ok) out.push(what + ' (' + describe(s) + ')'); };
  const fig = rect('.uav'), axes = s.shows.xAxis;
  must(h.host.attributes.length === 0, 'the host carries an attribute');
  must(near(fig.height, s.v.height), 'the figure is ' + r1(fig.height) + ' tall in a host ' + r1(s.v.height) + ' tall');
  if (h.kind === 'row') must(s.box && near(s.v.height, h.frame.clientHeight), 'the view does not fill its box of ' + h.frame.clientHeight);
  else must(!s.box, 'a stacked view is a size container');
  if (!s.shows.plot) return out;
  const side = axes ? rect('.uav-y-axis') : rect('.uav-number'), svg = rect('svg');
  if (s.box) must(near((axes ? rect('.uav-x-axis') : s.p).bottom, s.v.bottom) && near(s.p.top, s.v.top + (axes ? 8 : 0)), 'the plot does not fill the height left over');
  else must(near(s.p.height, axes ? 184 : 46), 'the plot is ' + r1(s.p.height) + ' tall, not ' + (axes ? 184 : 46));
  must(near(s.p.right, s.v.right) && near(s.p.left, side.right + (axes ? 6 : 12)), 'the plot does not take the width the first column leaves');
  must(near(svg.left, s.p.left + 2) && near(svg.width, s.p.width - 4) && near(svg.top, s.p.top) && near(svg.height, s.p.height), 'the SVG does not fill the plot');
  if (axes) s.q('.uav-y-axis').querySelectorAll('span').forEach((label) => {
    const l = label.getBoundingClientRect(), line = rect('[data-key="grid:' + label.dataset.key!.slice(6) + '"]');
    must(near((l.top + l.bottom) / 2, line.top + 0.5, 1), 'the y label ' + label.textContent + ' is ' + r1((l.top + l.bottom) / 2 - line.top) + ' px off its grid line');
  });
  return out;
}

/** Item 5: the greatest distance, in px, between the pixel-size path and the stretched one as placed on screen. */
const ruler = document.body.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg')).appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
ruler.ownerSVGElement!.setAttribute('width', '0'); ruler.ownerSVGElement!.setAttribute('height', '0');
function deviation(host: SpikeView): number | null {
  const s = read(host);
  if (!s.shows.plot) return null;
  const last = current.rows.length - 1, top = yScale(current).domain()[1]!;
  const px = shapes(current, (i) => 2 + ((s.p.width - 4) * i) / last, (v) => s.p.height * (1 - v / top));
  let worst = 0;
  for (const key of ['L1:line', 'L2:line'] as const) {
    const path = s.q<SVGPathElement>('[data-key="' + key + '"]');
    if (!px[key] || !path.checkVisibility()) continue;
    const m = path.getScreenCTM()!, len = path.getTotalLength(), N = 1500;
    const poly = Array.from({ length: N + 1 }, (_, i) => { const p = path.getPointAtLength((len * i) / N).matrixTransform(m); return [p.x - s.p.left, p.y - s.p.top] as const; });
    ruler.setAttribute('d', px[key]);
    const L = ruler.getTotalLength();
    for (let i = 0; i <= 200; i++) {
      const p = ruler.getPointAtLength((L * i) / 200);
      let best = Infinity;
      for (let j = 0; j < N; j++) {   // distance from p to the segment poly[j]..poly[j+1]
        const [ax, ay] = poly[j]!, [bx, by] = poly[j + 1]!, dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(p.x - ax - t * dx, p.y - ay - t * dy));
      }
      worst = Math.max(worst, best);
    }
  }
  return worst;
}

/* Item 1. One stretched SVG, written with presentation attributes so the same node can be serialized for the canvas. */
const DASH_SIZES: [number, number][] = [[80, 160], [170, 60], [346, 184], [700, 46]];
function cross(W: number, H: number) {
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  const attrs = (e: Element, a: Record<string, string | number>) => Object.entries(a).forEach(([k, v]) => e.setAttribute(k, String(v)));
  attrs(svg, { width: W, height: H, viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
  for (const d of ['M0,20H60', 'M90,0V100']) attrs(svg.appendChild(document.createElementNS(NS, 'path')), { d, fill: 'none', stroke: 'currentColor', 'stroke-width': 4, 'stroke-dasharray': '10 10', 'vector-effect': 'non-scaling-stroke' });
  return svg;
}
/** Lengths of the runs of painted and unpainted pixels along a line, the last (cut short by the path's end) left off. */
function runs(alpha: (i: number) => boolean, length: number): number[] {
  const out: number[] = [];
  for (let i = 0, start = 0; i <= length; i++) if (i === length || alpha(i) !== alpha(start)) { out.push(i - start); start = i; }
  return out.slice(0, -1);
}
async function measureDashes(svg: SVGSVGElement, W: number, H: number) {
  const img = new Image(), url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('this browser would not load the SVG as an image')); img.src = url; });
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);
  const a = ctx.getImageData(0, 0, W, H).data, on = (x: number, y: number) => a[(y * W + x) * 4 + 3]! > 127;
  const row = Math.floor(0.2 * H), col = Math.floor(0.9 * W);
  return { across: runs((x) => on(x, row), Math.round(0.6 * W)), down: runs((y) => on(col, y), H) };
}

/* Verdicts. */
type State = 'pass' | 'fail' | 'look';
const verdicts: Record<number, { state: State; detail: string }> = {};
function verdict(n: number, state: State, detail: string) {
  verdicts[n] = { state, detail };
  $('v' + n).textContent = state === 'look' ? 'look at this' : state; $('v' + n).dataset.state = state;
  $('d' + n).textContent = detail;
}
const list = (errors: string[]) => errors.length + ' wrong: ' + errors.slice(0, 4).join('; ') + (errors.length > 4 ? '; …' : '');

async function item1() {
  $('dashes').replaceChildren();
  const bad: string[] = [];
  for (const [W, H] of DASH_SIZES) {
    const cell = el('div', 'cell', $('dashes')), box = el('div', 'dash', cell), note = el('p', 'meta', cell);
    box.style.inlineSize = W + 'px'; box.style.blockSize = H + 'px';
    const svg = box.appendChild(cross(W, H));
    try {
      const m = await measureDashes(svg, W, H), ok = (r: number[]) => r.length >= 2 && r.every((n) => n >= 9 && n <= 11);
      note.textContent = W + '×' + H + ' · across ' + m.across.join(', ') + ' · down ' + m.down.join(', ');
      if (!ok(m.across) || !ok(m.down)) { bad.push(W + '×' + H); note.classList.add('error'); }
    } catch (e) { note.textContent = W + '×' + H + ' · not measured: ' + (e as Error).message; bad.push(W + '×' + H + ' not measured'); }
  }
  const unmeasured = bad.some((b) => b.endsWith('not measured'));
  verdict(1, bad.length ? (unmeasured ? 'look' : 'fail') : 'pass', bad.length ? 'Off at ' + bad.join(', ') + '. A dash that scaled with the path would be 10 px times the stretch.'
    : 'Every whole dash and gap is 10 px (within 1) at all four sizes, across and down, drawn by this browser to a canvas. The rulers and the views below are for the eye.');
}

function sweep(h: Held, from: number, to: number) {
  const was = h.frame.style.inlineSize, errors: string[] = [];
  let axesGo: number | null = null, secondaryGoes: Read | null = null, states = 0;
  for (let w = from; w >= to; w--) {
    h.frame.style.inlineSize = w + 'px';
    const s = read(h.host);   // reading forces style and layout: this is what the next frame would paint
    errors.push(...againstRules(s)); states++;
    if (axesGo == null && !s.shows.xAxis) axesGo = s.v.width;
    if (!secondaryGoes && s.shows.plot && !s.shows.comparison) secondaryGoes = s;
  }
  h.frame.style.inlineSize = was;
  return { errors, axesGo, secondaryGoes, states };
}
function item2(box: Held, natural: Held) {
  const b = sweep(box, 420, 120), n = sweep(natural, 420, 120), errors = [...b.errors, ...n.errors], s = b.secondaryGoes;
  // The chain proper: the axes are already gone, the view is still wide and tall enough, and only the narrowed plot's own query can have dropped the comparison.
  const chained = !!s && b.axesGo != null && s.v.width < b.axesGo && s.v.width >= 180 && s.p.width < 180 && s.p.height >= 90;
  verdict(2, errors.length || !chained ? 'fail' : 'pass', (errors.length ? list(errors) + '. ' : '')
    + 'Box 130 px tall: the axes go at a view ' + b.axesGo + ' px wide and the number moves beside the plot; the comparison goes at a view ' + (s ? r1(s.v.width) + ' px wide, when the plot is ' + size(s.p) : '(never)')
    + '. Natural height: the axes go at ' + n.axesGo + ' and the comparison at ' + (n.secondaryGoes ? r1(n.secondaryGoes.v.width) + ', where the bare plot is ' + size(n.secondaryGoes.p) : '(never)')
    + '. ' + (b.states + n.states - errors.length) + ' of ' + (b.states + n.states) + ' widths agree with the rules, read after a forced layout, so no frame can paint a stale state. Flicker itself is for the eye.');
}

async function item3(h: Held) {
  const ya = yScale(A), topA = ya.domain()[1]!;
  const pick = CHANGES.map((c) => {
    const yb = yScale(c.data), topB = yb.domain()[1]!, tick = topB === topA ? undefined : ya.ticks(4).find((t) => t > 0 && yb.ticks(4).includes(t));
    return tick ? { ...c, tick, from: tick / topA, to: tick / topB } : null;
  }).find((c) => c);
  if (!pick) return verdict(3, 'fail', 'No data change on offer moves a tick, so nothing was tested.');
  const line = h.host.shadowRoot!.querySelector<HTMLElement>('[data-key="grid:' + pick.tick + '"]')!;
  const t = () => parseFloat(getComputedStyle(line).getPropertyValue('--uav-t')), y = () => line.getBoundingClientRect().top;
  // A fresh frame first. Chrome stamps a transition with the time of the last frame, so one started at the end of a long task
  // (the sweep, here) is already over when it is first drawn.
  await frame();
  const y0 = y();
  setAll(pick.data);
  await sleep(300);
  const tMid = t(), yMid = y(), running = line.getAnimations().some((a) => a instanceof CSSTransition && a.transitionProperty === '--uav-t');
  await sleep(500);
  const tEnd = t(), y1 = y();
  setAll(A);
  await sleep(750);
  const between = (v: number, a: number, b: number) => v > Math.min(a, b) + 1e-4 && v < Math.max(a, b) - 1e-4;
  const ok = between(tMid, pick.from, pick.to) && between(yMid, y0, y1) && near(tEnd, pick.to, 1e-4);
  verdict(3, ok ? 'pass' : 'fail', 'Data change: ' + pick.name + '. The ' + pick.tick + ' tick goes from --uav-t ' + r1(pick.from * 1000) / 1000 + ' to ' + r1(pick.to * 1000) / 1000
    + '. At 300 ms of 600 the computed value was ' + tMid.toFixed(4) + ' and the grid line was at ' + r1(yMid) + ' px, between ' + r1(y0) + ' and ' + r1(y1)
    + '. It ended at ' + tEnd.toFixed(4) + '. ' + (running ? 'A CSSTransition on --uav-t was running.' : 'No CSSTransition on --uav-t was found.')
    + ' CSS.registerProperty is ' + (typeof CSS.registerProperty === 'function' ? 'present.' : 'missing.'));
}

function item456() {
  const errors = held.flatMap(geometry), states = held.map((h) => read(h.host));
  const rules = states.flatMap(againstRules);
  // A plot wide enough but too short: only its block-size query can have dropped the comparison.
  const byBlock = states.find((s) => s.shows.plot && s.p.width >= 180 && s.p.height < 90 && !s.shows.comparison);
  verdict(4, errors.length || rules.length || !byBlock ? 'fail' : 'pass', (errors.length || rules.length ? list([...errors, ...rules]) + '. ' : '')
    + held.length + ' views checked. ' + (byBlock ? 'A plot ' + size(byBlock.p) + ' dropped its comparison on block-size alone.' : 'No plot on the page tests block-size alone.'));

  const devs = held.map((h) => deviation(h.host)).filter((d): d is number => d != null), worst = Math.max(...devs);
  verdict(5, worst < 1 ? 'pass' : 'fail', 'Greatest distance ' + worst.toFixed(3) + ' px over ' + devs.length + ' plots, from ' + states.filter((s) => s.shows.plot).map((s) => size(s.p)).join(', ') + '.');

  const stack = held.filter((h) => h.kind === 'stack'), row = held.filter((h) => h.kind === 'row');
  const heights = (hs: Held[]) => hs.map((h) => r1(h.host.getBoundingClientRect().height)).join(', ');
  verdict(6, errors.length ? 'fail' : 'pass', (errors.length ? list(errors) + '. ' : '') + 'One sheet, no attribute on any view, no fit="box". ' + stack.length + ' stacked views take their own heights (' + heights(stack)
    + ' px). ' + row.length + ' views in rows are exactly as tall as their boxes (' + heights(row) + ' px), and where a plot shows it ends on the box\'s edge.');
}

async function item7() {
  await sleep(100);   // let any violation from the work above be reported first
  probing = true;
  console.info('spike: probing the policy now; the three refusals that follow are the test');
  const style = document.createElement('style'); style.textContent = ':root { --spike-probe: 1 }'; document.head.append(style);
  const styleRefused = getComputedStyle(document.documentElement).getPropertyValue('--spike-probe') === '';
  style.remove();
  const div = document.createElement('div'); div.setAttribute('style', '--spike-probe: 1'); document.body.append(div);
  const attrRefused = getComputedStyle(div).getPropertyValue('--spike-probe') === '';
  div.remove();
  let evalRefused = false;
  try { new Function('return 1')(); } catch { evalRefused = true; }
  await sleep(100);
  probing = false;
  const live = styleRefused && attrRefused && evalRefused;
  verdict(7, !live ? 'look' : violations.length ? 'fail' : 'pass', (live ? 'The policy is live: a <style> element, a style attribute and new Function were all refused (' + refused.length + ' reports). '
    : 'The policy is NOT live here, so this proves nothing: <style> ' + (styleRefused ? 'refused' : 'allowed') + ', style attribute ' + (attrRefused ? 'refused' : 'allowed') + ', new Function ' + (evalRefused ? 'refused' : 'allowed') + '. ')
    + (violations.length ? violations.length + ' violations from the page itself: ' + violations.join('; ') : 'No other violation was reported while the views were built, painted, resized and animated.'));
}

/* The page. */
$('ua').textContent = navigator.userAgent;
$('policy').textContent = document.querySelector<HTMLMetaElement>('meta[http-equiv]')!.content;
const [chain] = addFrame('chain', 'row', 300, 130);
const [natural] = [520, 346, 250, 170, 120].map((w) => addFrame('stack', 'stack', w)[0]!);
addFrame('rows', 'row', 700, 240, 2);   // axes, the plot fills what is left
addFrame('rows', 'row', 700, 100, 2);   // no axes; the plot is wide and tall enough for the comparison
addFrame('rows', 'row', 700, 60, 2);    // wide enough, too short: the comparison goes on block-size
addFrame('rows', 'row', 700, 100, 3);   // a third view divides the room: too narrow, the comparison goes on inline-size
addFrame('rows', 'row', 400, 40, 2);    // too short for a plot: the number alone

async function run() {
  delete document.body.dataset.done;
  $('overall').textContent = 'running'; $('overall').dataset.state = 'look';
  await frame();
  await item1();
  item456();
  item2(chain!, natural!);
  await item3(natural!);
  await item7();
  const states = Object.values(verdicts).map((v) => v.state), overall: State = states.includes('fail') ? 'fail' : states.includes('look') ? 'look' : 'pass';
  $('overall').textContent = overall === 'pass' ? 'all seven pass in this browser' : overall === 'fail' ? 'something fails in this browser' : 'something needs looking at'; $('overall').dataset.state = overall;
  $('results').textContent = JSON.stringify({ ua: navigator.userAgent, verdicts, violations });
  document.body.dataset.done = overall;
}
$('rerun').addEventListener('click', run);
$('change').addEventListener('click', () => setAll(current === A ? (CHANGES.find((c) => yScale(c.data).domain()[1] !== yScale(A).domain()[1]) ?? CHANGES[0]!).data : A));
$('play').addEventListener('click', () => {
  let w = 420, dir = -2;
  const step = () => { w += dir; chain!.frame.style.inlineSize = w + 'px'; if (w <= 150) dir = 2; if (w < 420) requestAnimationFrame(step); };
  step();
});
run();
