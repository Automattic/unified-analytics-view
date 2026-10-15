import { formatDimension, formatValue, type RectNode, type Result, type Row, type TextNode } from '@unified-analytics/core';
import { FOCUS, HOVER, attr, chooseItem, ensure, keyed, nodePaint, paintRamp, prop, roveItems, text, token, type LayoutPainter } from '@unified-analytics/dom';
import { PARTITION_RULES, boxNames } from './index.ts';

/* The `partition` mark's half for the DOM: the painter of its layout, for registerPainter().
 *
 * The part holds its shape, as a map's does: as wide as the view up to 480 px, and its height follows from the scene's
 * aspect. Boxes are HTML, set by the scene's ratios, so nothing here runs on resize but the measured pass.
 *
 *   .uav-plot                    the tree a reader steps through
 *     div                        a parent's box, set in the part
 *       .uav-head                where its name stands: a line at the top of a parent that is divided, or the whole box
 *         span.uav-label
 *       .uav-kids                its children, where it is divided
 *         i                      a child's box, set in the room under the parent's name
 *           span.uav-label
 *   .uav-ramp                    where a metric is on color
 *
 * A name shows only where it fits its box. That is the measured pass's: it reads each name against the box it stands
 * in and hides the ones that do not fit, and with a parent's name its children's, so a child is never named without
 * the parent it is in.
 *
 * A box is not a row of the result one for one, so no box carries `data-row`, the element's keyboard (keys.ts) leaves
 * this layout alone, and the one here stands in for it, as a grid's does. One tab stop, nothing chosen on focus.
 * Left and right step among the parents, in the engine's order, and stop at the ends. Down goes into the chosen
 * parent, to its first child, and left and right then step among its children. Up comes back out to the parent.
 * Enter or Space activates, and Escape lets go. To assistive technology it is a tree of two levels, and each box is
 * named by its readout, which says its value: never by area or colour alone. The table is long, and not the pivot a
 * query by two dimensions has elsewhere: a page is in one section, so a pivot of them is a column for every page and
 * nearly every cell of it empty.
 * ponytail: version 4 has no model for a hierarchy, so this one is a proposal. Steps go by the engine's order and not
 * by where a box lies, so an arrow does not always move the way it points.
 * Below the room a treemap needs, the `marks` rule's `fallback` shows the same query as a list in its place. That is
 * the element's doing (view.ts), and nothing here knows of it. */
const at = (gap: number, off: number) => `inset-inline-start: calc(var(--uav-x) * 100% + ${off}px); inset-block-start: calc((1 - var(--uav-t)) * 100% + ${off}px); inline-size: calc(var(--uav-w) * 100% - ${gap}px); block-size: calc(var(--uav-v) * 100% - ${gap}px);`;
const css = `
.uav[data-layout="partition"] .uav-body { display: flex; flex-direction: column; }
.uav[data-layout="partition"] .uav-plot { flex: none; align-self: center; inline-size: min(100%, 480px); aspect-ratio: var(--uav-aspect, 1.6); container-type: inline-size; }
/* Parents are 2 px apart, a pixel in from the part's edge all round, and children 1 px: the gap is what tells one box
 * from the next, and a parent's is the wider. A child gives up its gap at its far edges, and the room that holds the
 * children is that much larger, so the last of them end where their parent does. */
.uav[data-layout="partition"] .uav-plot > div { position: absolute; ${at(2, 1)} display: flex; flex-direction: column; overflow: hidden; border-radius: ${token('border-radius-bar')}; background: var(--uav-paint); }
.uav[data-layout="partition"] .uav-head { position: absolute; inset: 0; overflow: hidden; }
.uav[data-layout="partition"] .uav-plot[data-divided] .uav-head { position: relative; inset: auto; flex: none; block-size: 16px; max-block-size: 30%; }
.uav[data-layout="partition"] .uav-kids { position: relative; flex: 1; min-block-size: 0; margin-inline-end: -1px; margin-block-end: -1px; }
.uav[data-layout="partition"] .uav-kids i { position: absolute; ${at(1, 0)} overflow: hidden; border-radius: ${token('border-radius-cell')}; background: var(--uav-paint); }
.uav[data-layout="partition"] .uav-label { position: absolute; inset-inline-start: 0; inset-block-start: 0; inline-size: max-content; padding: 1px 4px; line-height: calc(14 / 11); white-space: nowrap; color: var(--uav-paint); pointer-events: none; }
.uav[data-layout="partition"] .uav-label[data-halo] { -webkit-text-stroke: 3px ${token('color-background')}; paint-order: stroke fill; }
/* A name the measured pass gave up keeps its box, so the next measurement reads the same. */
.uav[data-layout="partition"] .uav-label[data-thin] { visibility: hidden; }
/* Boxes lie edge to edge and a parent cuts off what leaves it, so the chosen one is outlined inside its own edge. */
.uav[data-layout="partition"] .uav-plot { outline: none; }
.uav[data-layout="partition"] .uav-plot:focus-visible::after { content: ""; position: absolute; inset: 0; pointer-events: none; ${FOCUS.around} }
.uav[data-layout="partition"] .uav-plot [data-active="keys"] { ${FOCUS.inside} }
.uav[data-layout="partition"] .uav-plot [data-active="pointer"] { ${HOVER.around} outline-offset: -1px; }
.uav[data-layout="partition"] .uav-ramp:empty { display: none; }
/* In a box the part gives way to the height and its width follows, as a map does. */
@container uav-view (block-size >= 0px) {
  .uav[data-layout="partition"] .uav-body { container-type: size; overflow: hidden; }
  .uav[data-layout="partition"] .uav-plot { flex: 0 1 calc(min(100cqi, 480px) / var(--uav-aspect, 1.6)); min-block-size: 0; inline-size: auto; max-inline-size: 100%; }
  .uav[data-layout="partition"] .uav-ramp { flex: none; }
}`;

/* What the listeners read. They are bound once to the part, which outlives every paint, and this is set by each. */
interface Tree { rows: Map<string, { row: Row; rows: Row[] }> }
const trees = new WeakMap<HTMLElement, Tree>();
const ITEM = '[role="treeitem"]:not([data-exit])';

/** Where a key moves to in a tree of two levels, from the box chosen: `at` is its place among its siblings, `count`
 * how many they are, `depth` 0 for a parent and 1 for a child, and `kids` how many children a parent has. Null where
 * the key is no step, or there is nowhere to go. From nothing, any arrow is the first parent. */
export function stepBox(key: string, chosen: { at: number; count: number; depth: 0 | 1; kids: number } | null): { to: 'first' | 'sibling' | 'child' | 'parent'; at: number } | null {
  const d = ({ ArrowRight: 1, ArrowLeft: -1 } as Record<string, number>)[key];
  if (!d && key !== 'ArrowDown' && key !== 'ArrowUp') return null;
  if (!chosen) return { to: 'first', at: 0 };
  if (d) return { to: 'sibling', at: Math.min(Math.max(chosen.at + d, 0), chosen.count - 1) };
  if (key === 'ArrowDown') return chosen.depth === 0 && chosen.kids ? { to: 'child', at: 0 } : null;
  return chosen.depth === 1 ? { to: 'parent', at: 0 } : null;
}

/* The interaction is the element's own, for a holder of elements (roveItems). A box's is the step through the tree. */
function bind(plot: HTMLElement): void {
  const items = (of: Element) => Array.from(of.querySelectorAll<HTMLElement>(':scope > ' + ITEM)).filter((el) => el.getClientRects().length > 0);
  roveItems(plot, ITEM, (e, on) => {
    const beside = on ? items(on.parentElement!) : [], kids = on?.querySelector('.uav-kids');
    const to = stepBox(e.key, on ? { at: beside.indexOf(on), count: beside.length, depth: on.parentElement === plot ? 0 : 1, kids: kids ? items(kids).length : 0 } : null);
    // An arrow with nowhere to go is still the tree's: the page behind it does not scroll, and take the readout with it.
    if (to || (on && e.key.startsWith('Arrow'))) e.preventDefault();
    if (!to) return null;
    return (to.to === 'first' ? items(plot)[0] : to.to === 'sibling' ? beside[to.at] : to.to === 'child' ? items(kids!)[0] : on!.parentElement!.closest<HTMLElement>(ITEM)) ?? null;
  }, (el) => trees.get(plot)!.rows.get(el.dataset.key!));
}

/** A name fits where the box it stands in is as wide and as tall as it is, to half a pixel. */
export const nameFits = (name: { width: number; height: number }, box: { width: number; height: number }) => name.width <= box.width + 0.5 && name.height <= box.height + 0.5;

export const partitionPainter: LayoutPainter = {
  layout: 'partition',
  css,
  rules: () => PARTITION_RULES,

  paint(body, scene, _rules, data) {
    const plot = ensure(body, 'div', 'uav-plot'), names = boxNames(data);
    prop(plot, '--uav-aspect', scene.aspect ?? 1.6);
    // The scene's order says what is whose: a parent's box, its name, then each child's box with its name after it.
    const parents: RectNode[] = [], kids = new Map<string, RectNode[]>(), labels = new Map<string, TextNode>();
    let last: RectNode | undefined;
    for (const n of scene.nodes) {
      if (n.part !== 'plot') continue;
      if (n.kind === 'text' && last) labels.set(last.key, n);
      if (n.kind !== 'rect') continue;
      if (n.pair) kids.get(parents[parents.length - 1]!.key)!.push(n); else { parents.push(n); kids.set(n.key, []); }
      last = n;
    }
    const divided = parents.some((p) => kids.get(p.key)!.length > 0) || parents.some((p) => p.tone === 'soft' || p.role === 'context');
    plot.toggleAttribute('data-divided', divided);
    let count = 0;
    // The ratios are set in the names the element can move on a data change (motion.ts): x and w across, and a box's
    // top as how far up the room it is, with how far down it runs from there.
    const box = (el: HTMLElement | SVGElement, n: RectNode, level: number) => {
      prop(el, '--uav-x', n.x); prop(el, '--uav-w', n.w); prop(el, '--uav-t', 1 - (n.y ?? 0)); prop(el, '--uav-v', n.h);
      attr(el, 'role', 'treeitem'); attr(el, 'aria-level', level); attr(el, 'id', 'box-' + count++); attr(el, 'aria-label', names.get(n.key)?.says);
    };
    const name = (slot: Element, n: TextNode | undefined) => {
      const el = ensure(slot, 'span', 'uav-label');
      el.setAttribute('aria-hidden', 'true');
      if (!n) { el.textContent = ''; return; }
      text(el, n); prop(el, '--uav-paint', nodePaint(n)); el.toggleAttribute('data-halo', !!n.halo); attr(el, 'data-rank', n.rank);
    };
    keyed(plot, parents, () => 'div', (el, n) => {
      const mine = kids.get(n.key)!;
      box(el, n, 1);
      attr(el, 'aria-expanded', mine.length ? 'true' : null);
      name(ensure(el, 'div', 'uav-head'), labels.get(n.key));
      const group = ensure(el, 'div', 'uav-kids');
      attr(group, 'role', mine.length ? 'group' : null);
      keyed(group, mine, () => 'i', (c, k) => { box(c, k, 2); name(c, labels.get(k.key)); });
    });
    if (!trees.has(plot)) bind(plot);
    trees.set(plot, { rows: new Map([...names].map(([k, v]) => [k, { row: v.row, rows: v.rows }])) });
    attr(plot, 'role', 'tree'); attr(plot, 'tabindex', parents.length ? 0 : null);
    attr(plot, 'aria-label', data.catalog.dimensions[(data.layers[0]?.encode?.x ?? '') as string]?.label);
    // A box that a data change took away takes the choice with it. One that is still here keeps it.
    const on = plot.querySelector<HTMLElement>('[data-active]');
    if (on && (on.hasAttribute('data-exit') || !(plot.matches(':focus') || plot.matches(':hover')))) chooseItem(plot, null);
    else if (on) chooseItem(plot, on, on.getAttribute('data-active') as 'keys' | 'pointer');

    paintRamp(body, scene);
  },

  /* A row for each row of the result, under a row for its parent that holds the engine's total for it, and the engine's
   * total for the whole at the foot. Nothing is summed. With one dimension it is the table every view has. */
  table(table, title, _scene, { query: q, result, catalog }) {
    const by = q.by || [], [a, b] = by, fields = q.metrics.flatMap((m) => (q.compare === 'previous' ? [m, m + '@previous'] : [m]));
    const row = (parent: HTMLElement, heads: string[], from: Row | Result['totals']) => {
      const tr = parent.appendChild(document.createElement('tr'));
      heads.forEach((s) => { const th = tr.appendChild(document.createElement('th')); th.textContent = s; th.scope = 'row'; });
      for (const f of fields) { const td = tr.appendChild(document.createElement('td')); td.textContent = formatValue(from[f] as number | null, catalog.metrics[f.split('@')[0]!]!, 'exact'); td.setAttribute('data-num', ''); }
    };
    const say = (d: string, r: Row) => formatDimension(r[d], catalog.dimensions[d]!);
    table.replaceChildren();
    if (title) table.createCaption().textContent = title;
    const head = table.createTHead().appendChild(document.createElement('tr'));
    for (const [s, num] of [...by.map((d) => [catalog.dimensions[d]!.label, false] as const), ...fields.map((f) => [catalog.metrics[f.split('@')[0]!]!.label + (f.includes('@') ? ', previous period' : ''), true] as const)]) {
      const th = head.appendChild(document.createElement('th')); th.textContent = s; th.scope = 'col'; if (num) th.setAttribute('data-num', '');
    }
    const body = table.createTBody();
    if (b == null) for (const r of result.rows) row(body, [say(a!, r)], r);
    else for (const top of result.totalsBy?.[a!] ?? []) {
      row(body, [say(a!, top), 'All'], top);
      for (const r of result.rows) if (r[a!] === top[a!]) row(body, [say(a!, r), say(b, r)], r);
    }
    row(table.createTFoot(), ['Total', ...by.slice(1).map(() => '')], result.totals);
  },

  /* A name is read against the box it stands in, and one that does not fit is hidden, keeping its box. A child's goes
   * with its parent's. Nothing written here changes a size that is read, so one run settles it. */
  measure(body) {
    const fits = new Map<Element, boolean>();
    for (const el of body.querySelectorAll<HTMLElement>('.uav-plot .uav-label')) fits.set(el, !!el.textContent && nameFits(el.getBoundingClientRect(), el.parentElement!.getBoundingClientRect()));
    for (const [el, fit] of fits) {
      const above = el.closest('.uav-kids')?.parentElement?.querySelector(':scope > .uav-head > .uav-label');
      el.toggleAttribute('data-thin', !fit || (above != null && !fits.get(above)));
    }
  },
};
