import type { FitRule } from '@universal-analytics/core';

/* The fit-rule compiler: the same data resolve() evaluates, as container queries.
 * Pure string work, so it runs and is tested with no DOM. */

/** What else changes when a rule applies, which its data cannot say: layout, then rule id, then a selector
 * inside the figure ('' is the figure itself), then declarations. Each layout module supplies its own. */
export type FitExtras = Record<string, Record<string, Record<string, string>>>;

/* Targets that are not a part. Ranked nodes carry data-rank, and each y tick has a grid line. */
const RANKED: Record<string, string> = {
  'x-tick.mid': '.vg-x-axis [data-rank]',
  'y-tick.ranked': ':is(.vg-y-axis, .vg-grid) [data-rank]',
};
// A rule set can arrive as JSON in markup, and every name below lands in a selector.
const NAME = /^[\w.:-]+$/;
function name(s: string, rule: FitRule, what: string): string {
  if (typeof s !== 'string' || !NAME.test(s)) throw new Error('Fit rule "' + rule.id + '" has ' + what + ' ' + JSON.stringify(s) + ', which is not a name. Use letters, digits, ".", ":" and "-" only.');
  return s;
}
function target(t: string, rule: FitRule, what: string): string {
  name(t, rule, what);
  return t.startsWith('role:') ? '[data-role="' + t.slice(5) + '"]' : Object.hasOwn(RANKED, t) ? RANKED[t]! : '.vg-' + t.replace(/[.:]/g, '-');
}
const anyOf = (sel: string[]) => (sel.length > 1 ? ':is(' + sel.join(', ') + ')' : sel[0]!);

/** CSS for a set of fit rules. A rule names its container "view" or "plot"; in CSS they are `vg-view` and `vg-plot`, so a page's
 * own container named "view" does not answer these queries. Each need gets its own @container block: a query naming both axes is passed over
 * whole by a width-only container, so a rule's block need is simply inert until a layout hands the view a box.
 * A query asks for half a pixel under the need: at a fractional zoom a container laid out at exactly its need
 * measures a hair under it, and its part would go at the very size the rule says it fits.
 * Rules are written in order, so where two set the same thing the later one wins. */
export function compileFitRules(rules: FitRule[], extras: FitExtras = {}): string {
  return rules.map((r) => {
    name(r.id, r, 'the id'); name(r.layout, r, 'the layout');
    if (!r.needs || typeof r.needs !== 'object') throw new Error('Fit rule "' + r.id + '" has no "needs". Give the room its part needs, for example { "inline": 280 }.');
    for (const k of ['hide', 'show'] as const) if (r[k] != null && !Array.isArray(r[k])) throw new Error('Fit rule "' + r.id + '" gives "' + k + '" as ' + JSON.stringify(r[k]) + '. It is a list: write ' + JSON.stringify([r[k]]) + '.');
    if (r.container !== 'view' && r.container !== 'plot') throw new Error('Fit rule "' + r.id + '" names the container ' + JSON.stringify(r.container) + '. Use "view" or "plot".');
    const fig = '.vg[data-layout="' + r.layout + '"]' + (r.keep ? ':not([data-keep~="' + name(r.keep, r, 'the keep entry') + '"])' : '');
    const more = extras[r.layout]?.[r.id] ?? {};
    const own = Object.entries(r.set ?? {}).map(([k, v]) => '--vg-' + name(k, r, 'the switch') + ': ' + name(v, r, 'the switch value') + ';').concat(more[''] ?? []).join(' ');
    const body = [
      r.hide?.length ? fig + ' ' + anyOf(r.hide.map((t) => target(t, r, 'the hide target'))) + ' { display: none; }' : '',
      r.show?.length ? fig + ' ' + anyOf(r.show.map((t) => target(t, r, 'the show target'))) + ' { display: block; }' : '',
      // The view gives way, whole, to the one painted beside it for the rule's preset (view.ts).
      r.fallback ? fig + ' { display: none; }' : '',
      r.fallback ? fig + ' ~ .vg-fallback { display: block; }' : '',
      own ? fig + ' { ' + own + ' }' : '',
      ...Object.entries(more).filter(([sel]) => sel).map(([sel, decl]) => fig + ' ' + sel + ' { ' + decl + ' }'),
    ].filter(Boolean).map((line) => '  ' + line).join('\n');
    return Object.entries(r.needs ?? {}).filter(([, px]) => px != null).map(([axis, px]) => {
      if ((axis !== 'inline' && axis !== 'block') || !Number.isFinite(px)) throw new Error('Fit rule "' + r.id + '" needs ' + JSON.stringify(r.needs) + '. Give "inline" or "block" as a number of px.');
      return '/* ' + r.layout + ' ' + r.id + ' */\n@container vg-' + r.container + ' (' + axis + '-size < ' + (px - 0.5) + 'px) {\n' + body + '\n}';
    }).join('\n');
  }).filter(Boolean).join('\n');
}
