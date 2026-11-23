import { CONTAINER_RULES, makeContainer, unboundedContainer } from './container.ts';
import { applies, type FitRule, type Room } from './fit.ts';
import { GUIDE_CHANNEL } from './guides.ts';
import { customMarks } from './marks.ts';
import { place } from './place.ts';
import { PRESETS, expand, usesPrevious } from './presets.ts';
import { layoutOf, resolve } from './plan.ts';
import { buildScene, layerKeys, measuresOf } from './scene.ts';
import { baseOf } from './types.ts';
import type { Catalog, Layout, PresetLibrary, Result, Spec } from './types.ts';

/* Why a view looks as it does, said in the words of its spec. Every entry names the place in the spec it came from,
 * and the lever that changes it, where the spec has one. A decision with no lever is a default, and the rules are
 * where it is fixed.
 *
 * It explains what `<ua-view>` does: the view planned once with no limits, the parts that plan has, and the fit rules
 * that hold at a given room. What the measured pass decides at the real size (labels thinned, the number's shorter
 * forms) is the element's to say: `UaView.explain()` adds it. */

export interface Because {
  /** The part it is about, where it is about one. */
  part?: string;
  /** What happened: "the layout is rows", "shown", "hidden", "kept", "shown in its place", "not drawn", a key's shorter
   * form ("shown as a thin strip"), or what went with a key ("hidden, and the marks it keyed drawn in one colour"). */
  what: string;
  /** Where in the spec it came from: a path such as `layers[0].encode.color`, `keep` or `query.metrics[0]`. A layer of
   * a preset is named through it: `use "bar-list", layer 1`. */
  from: string;
  why: string;
  /** The fit rule that decided it, by its id, where one did. */
  rule?: string;
  /** What in the spec would change it. Absent where nothing does, and the default decides. */
  lever?: string;
}
export interface Explanation { layout: Layout; entries: Because[] }

/** The room a view has: its width, its height where it was handed one, and its plot's, where it has been measured. */
export interface ExplainRoom { inline: number; block?: number | null; plot?: Room | null }

/** A key's shorter form, by the switch a fit rule sets for it: the part, and what is said of it. */
const SHORTER: Record<string, [part: string, what: string]> = { 'legend: top': ['legend', 'shown as one line'], 'ramp: strip': ['ramp', 'shown as a thin strip'], 'size-key: most': ['size', 'shown as its largest step'] };
/** What the marks give up when a rule takes their key, by the switch it sets: the parts that are that key, and what is said of them. */
const PLAIN: Record<string, [parts: string[], what: string]> = { 'split: plain': [['legend', 'legend-top', 'labels'], 'hidden, and the marks it keyed drawn in one colour'], 'dots: one': [['size'], 'hidden, and the dots drawn at one size'] };
/** A part a rule thins and does not take, by the target it names. */
const THINNED: Record<string, [part: string, what: string]> = { 'rim.ranked': ['rim', 'thinned to about four'] };
/** The parts the marks are drawn in. */
const DATA = new Set(['plot', 'points', 'rows', 'band', 'radial', 'track']);
const need = (r: FitRule) => [r.needs.inline && r.needs.inline + ' px wide', r.needs.block && r.needs.block + ' px tall'].filter(Boolean).join(' and ');
const has = (r?: Room | null) => (r ? Math.round(r.inline) + ' × ' + (r.block == null ? 'natural height' : Math.round(r.block)) : 'none');

export function explain(spec0: Spec, result: Result, catalog: Catalog, room?: ExplainRoom, presets: PresetLibrary = PRESETS): Explanation {
  const spec = expand(spec0, presets), layers = spec.layers ?? [], q = spec.query;
  // A layer of a preset is named through it, as the preset's own layers[i].
  const at = (i: number) => (spec0.layers ? '' : 'use "' + spec0.use + '": ') + 'layers[' + i + ']';
  const plan = resolve(spec0, result, unboundedContainer(), catalog, presets), scene = buildScene(plan, q, result, catalog);
  const out: Because[] = [];

  // A plan's layers are copies, with their roles: each is found again in the spec by what it is.
  const origin = (k: number) => { const pl = plan.layers[k]!; return layers.findIndex((l) => l.mark === pl.mark && l.series === pl.series && JSON.stringify(l.encode) === JSON.stringify(pl.encode)); };
  const of = (k: number) => at(origin(k));
  if (plan.layout === 'notice' || plan.layout === 'none') {
    out.push({ what: plan.layout === 'notice' ? 'the layout is a notice' : 'the view is its number', from: 'result', why: result.meta.empty ? 'no rows came back for this query and range' : 'there are no layers to draw' });
  } else {
    const choice = layoutOf(catalog, plan.layers);
    out.push({ what: 'the layout is ' + choice.layout, from: of(choice.layer), why: choice.why, lever: 'change what that layer puts on x, y, color or angle' });
  }
  // Layers of the period before need it in the query and in the result.
  layers.forEach((l, i) => {
    if (!usesPrevious(l) || plan.layers.some((p) => p.series === l.series)) return;
    const asked = q.compare === 'previous';
    out.push({ what: 'not drawn', from: at(i) + '.series', why: asked ? 'the result has no previous period to compare with' : 'the query does not ask for the previous period', lever: asked ? undefined : 'add "compare": "previous" to the query' });
  });

  // Where each part comes from: a guide from the field on its channel, a part of marks from the layers drawn in it.
  const keys = layerKeys(plan.layers), source = (part: string): { from: string; why: string } => {
    if (part === 'number' || part === 'hole') return { from: 'query.metrics[0]', why: 'the total of "' + q.metrics[0] + '", from the engine' };
    if (part === 'notice') return { from: 'result', why: 'no rows came back' };
    const ch = GUIDE_CHANNEL[part], on = plan.layers.map((l, k) => ((l.encode as Record<string, unknown> | undefined)?.[ch!] != null ? k : -1)).filter((k) => k >= 0);
    // The second y axis is the last layer's to measure on y; every other guide is the first's.
    const j = !ch || !on.length ? -1 : part === 'y-axis-2' ? on.at(-1)! : on[0]!;
    if (part === 'labels' && j < 0) { const d = plan.layers.findIndex((l) => l.encode?.detail != null); if (d >= 0) return { from: of(d) + '.encode.detail', why: 'a label at the end of each series' }; }
    if (j >= 0) { const f = (plan.layers[j]!.encode as Record<string, unknown>)[ch!]; return { from: of(j) + '.encode.' + ch, why: JSON.stringify(f) + ' on ' + ch }; }
    // With nothing on color, a plot's legend is of the metrics its layers measure: the first layer of each says which.
    const told = part === 'legend' || part === 'labels' ? measuresOf(catalog, plan.layers) : [];
    if (told.length > 1) return { from: told.map((m) => of(plan.layers.findIndex((l) => [l.encode?.y, l.encode?.y2].some((f) => typeof f === 'string' && (f === m || baseOf(f) === m)))) + '.encode.y').join(', '), why: 'the layers measure ' + told.length + ' metrics, told apart by colour' };
    const drawn = [...new Set(scene.nodes.filter((n) => n.part === part).map((n) => keys.findIndex((k) => n.key === k || n.key.startsWith(k + ':'))).filter((k) => k >= 0))];
    // A part some layouts draw from the layers whole, with no key of a layer's own on its nodes: the band, a grid of glyphs.
    if (!drawn.length && DATA.has(part)) drawn.push(...plan.layers.map((_, k) => k));
    if (drawn.length) return { from: (spec0.layers ? '' : 'use "' + spec0.use + '": ') + drawn.map((k) => 'layers[' + origin(k) + ']').join(', '), why: drawn.map((k) => plan.layers[k]!.mark).filter((m, n, a) => a.indexOf(m) === n).join(' and ') + ' marks' };
    const unit = plan.layers.findIndex((l) => l.mark === 'unit');
    if (part === 'unit-key' && unit >= 0) return { from: of(unit), why: 'what one glyph is worth' };
    return { from: customMarks().has(plan.layout) ? at(0) : 'the layout', why: 'the ' + plan.layout + ' layout draws it' };
  };
  const parts = scene.parts.filter((p) => p !== 'number' || plan.tldrValue);
  for (const p of parts) out.push({ part: p, what: 'shown', ...source(p) });
  if (!room) return { layout: plan.layout, entries: out };

  // At this room: each fit rule of the layout that holds, and what it does to the parts the plan has.
  const custom = customMarks().get(plan.layout), rules = CONTAINER_RULES.fit.concat(custom ? custom.rules : []).filter((r) => r.layout === plan.layout);
  const keep = new Set(spec.keep ?? []), marks = plan.layers.map((l) => l.mark);
  const plot = room.plot !== undefined ? room.plot : (() => { const b = place(scene, makeContainer(room.inline, room.block)).plot; return b ? { inline: b.w, block: b.h } : null; })();
  const rooms = { view: { inline: room.inline, block: room.block ?? null }, plot };
  const gone = new Set<string>(), placed = new Set<string>(), said = (r: FitRule) => 'rule "' + r.id + '" needs ' + need(r) + ' of the ' + r.container + ', and it has ' + has(rooms[r.container]);
  for (const r of rules) {
    if (r.mark && !marks.includes(r.mark)) continue;
    // A rule on the plot holds when there is no plot left: what sits in it has gone with it.
    const holds = applies(r, rooms) || (r.container === 'plot' && (!plot || gone.has('plot')));
    if (!holds) continue;
    if (r.keep && keep.has(r.keep)) {
      out.push({ part: r.hide.filter((p) => parts.includes(p as never)).join(' ') || undefined, what: 'kept', from: 'keep', why: said(r), rule: r.id, lever: 'remove "' + r.keep + '" from keep to let it go here' });
      continue;
    }
    if (r.fallback) {
      const j = plan.layers.findIndex((l) => !r.mark || l.mark === r.mark);
      out.push({ what: 'drawn as "' + r.fallback + '"', from: of(j), why: said(r), rule: r.id, lever: r.keep && 'add "' + r.keep + '" to keep to hold these marks' });
      return { layout: plan.layout, entries: out };
    }
    // What the room is short of: a width, a height, or both. Only those are worth asking for.
    const c = rooms[r.container], short = [r.needs.inline != null && c && c.inline < r.needs.inline && r.needs.inline + ' px wide', r.needs.block != null && c?.block != null && c.block < r.needs.block && r.needs.block + ' px tall'].filter(Boolean).join(' and ');
    const lever = r.keep ? 'add "' + r.keep + '" to keep to hold it' + (short ? ', or give the ' + r.container + ' ' + short : '') : undefined;
    let acted = false;
    // What a rule does to a part without taking it: a key in its shorter form, by a switch, and a rim thinned to its unranked names.
    const less = new Map<string, string>([...Object.entries(r.set ?? {}).flatMap(([k, v]): [string, string][] => (SHORTER[k + ': ' + v] ? [SHORTER[k + ': ' + v]!] : [])), ...r.hide.flatMap((t): [string, string][] => (THINNED[t] ? [THINNED[t]!] : []))]);
    const plain = Object.entries(r.set ?? {}).flatMap(([k, v]) => (PLAIN[k + ': ' + v] ? [PLAIN[k + ': ' + v]!] : []));
    for (const p of [...r.hide, ...less.keys()]) {
      if ((!parts.includes(p as never) && !placed.has(p)) || gone.has(p)) continue;
      gone.add(p); acted = true;
      out.push({ part: p, what: less.get(p) ?? plain.find(([of]) => of.includes(p))?.[1] ?? 'hidden', from: source(p).from, why: said(r), rule: r.id, lever });
    }
    // What a rule shows takes the place of what it hid, so it is said only where the rule hid something.
    if (acted) for (const p of r.show ?? []) if (!gone.has(p) && !out.some((b) => b.part === p && b.what === 'shown in its place')) { placed.add(p); out.push({ part: p, what: 'shown in its place', from: source(p).from, why: said(r), rule: r.id }); }
  }
  // A part shown and then hidden is said once, as hidden: one the plan shows, and one a rule put in another's place.
  return { layout: plan.layout, entries: out.filter((b) => !((b.what === 'shown' || b.what === 'shown in its place') && gone.has(b.part!))) };
}
