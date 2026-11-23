/* The checker: what every part of a view promises, held against a capture (capture.ts). No judgement here, only rules,
 * so two runs on the same capture say the same thing, and a capture held against an earlier one shows what moved.
 *
 * What a part promises at each size is the fit rules' (packages/core/src/fit.ts): the room it needs, and what hides or
 * shows without it. The rules are read, not restated, and by core's own reader (fitTo), so a frame where the element and
 * the reader disagree is a finding. Around them, five promises every part keeps:
 *
 *   cut       whole or gone: nothing reaches past the frame, nothing is clipped by its own box.
 *   overlap   parts do not cross, but for the pairs drawn one over the other on purpose (OVERLAPS).
 *   theme     light and dark lay a view out the same.
 *   steady    a part gone at one width stays gone at every narrower one, but for a part a fit rule shows in compensation.
 *   rule      what shows agrees with the fit rules for the frame's room: a part a rule hides is hidden ("hidden"),
 *             and a part the plan has and no rule hides is shown ("shown").
 *
 * Ellipses are counted beside them (`ellipsis`): a label cut short on purpose is a fallback, not a fault, but how
 * often a part leans on it is worth seeing.
 *
 *   pnpm --filter @unified-analytics/bench check [capture=<dir>] [against=<dir>]
 *
 * With no capture, the latest. Writes check.json and check.md into the capture; with `against`, says what is new and
 * what is gone since that one. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { FIT_RULES, fitTo, type FitRule, type KeepPart } from '@unified-analytics/core';
import type { Record } from './capture.ts';

/** Pairs drawn one over the other on purpose: labels on their points, and the ring's labels and its number on the ring. */
const OVERLAPS = [['points', 'point-labels'], ['radial', 'rim'], ['radial', 'hole']].map((p) => p.sort().join('×'));
/** Each part drawn under a class of its name: the ones a rule may name. A rule's other names are roles, the grid and ticks. */
const PARTS = new Set(['number', 'plot', 'x-axis', 'y-axis', 'y-axis-2', 'labels', 'columns', 'rows', 'band', 'legend', 'legend-top', 'radial', 'hole', 'rim',
  'ramp', 'notice', 'points', 'point-labels', 'size', 'note', 'unit-key', 'track']);
const WIDTHS = ['free', '480', '346', '250', '170', '120', '80', '40'];

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=') as [string, string]));
const root = new URL('./captures/', import.meta.url).pathname;
const latest = () => { const all = readdirSync(root).filter((d) => !d.startsWith('.')).sort(); if (!all.length) throw new Error('no capture yet: run pnpm --filter @unified-analytics/bench capture first.'); return root + all.at(-1) + '/'; };
const dir = (d?: string) => (d ? (d.includes('/') ? d : root + d).replace(/\/?$/, '/') : latest());
const read = (d: string): { records: Record[]; commit: string; taken: string } => JSON.parse(readFileSync(d + 'capture.json', 'utf8'));

export interface Finding { check: string; part: string; sample: string; theme: string; height: string; width: string; detail: string }
const key = (f: Finding) => [f.check, f.part, f.sample, f.theme, f.height, f.width].join('|');

function check(records: Record[]): Finding[] {
  const out: Finding[] = [], at = new Map(records.map((r) => [[r.sample, r.theme, r.height, r.width].join('|'), r]));
  const say = (r: Record, check: string, part: string, detail: string) => out.push({ check, part, sample: r.sample, theme: r.theme, height: r.height, width: r.width, detail });
  for (const r of records) {
    const { parts, overlaps, width, height } = r.measure;
    for (const [part, m] of Object.entries(parts)) {
      if (m.outside) say(r, 'cut', part, `reaches past the ${width}×${height} frame: box ${m.box.join(',')}`);
      if (m.clipped > 1) say(r, 'cut', part, `${m.clipped}px clipped by its own box`);
      if (m.ellipsis) say(r, 'ellipsis', part, `${m.ellipsis} cut short`);
    }
    for (const pair of overlaps) if (!OVERLAPS.includes([...pair].sort().join('×'))) say(r, 'overlap', pair.join('×'), `${pair[0]} ${parts[pair[0]]!.box.join(',')} crosses ${pair[1]} ${parts[pair[1]]!.box.join(',')}`);
    if (r.theme === 'light') {
      const dark = at.get([r.sample, 'dark', r.height, r.width].join('|'));
      if (dark && JSON.stringify(dark.measure) !== JSON.stringify(r.measure)) say(r, 'theme', Object.keys({ ...parts, ...dark.measure.parts }).filter((p) => JSON.stringify(parts[p]) !== JSON.stringify(dark.measure.parts[p])).join(' ') || 'frame', 'laid out otherwise in dark');
    }
    if (r.plan) rules(r, say);
  }
  // Steady: down the widths, a part that comes back after it has gone.
  for (const r of records.filter((r) => r.width === 'free' && r.plan)) {
    const shows = new Set(FIT_RULES.filter((f) => f.layout === r.plan!.layout).flatMap((f) => [...(f.show ?? []), ...(f.set?.legend === 'top' ? ['legend-top'] : [])]));
    const seen = new Set<string>(), gone = new Set<string>();
    for (const w of WIDTHS) {
      const frame = at.get([r.sample, r.theme, r.height, w].join('|'));
      if (!frame) continue;
      const now = new Set(Object.keys(frame.measure.parts));
      for (const p of now) if (gone.has(p) && !shows.has(p)) say(frame, 'steady', p, 'shows again after it had gone at a wider width');
      for (const p of seen) if (!now.has(p)) gone.add(p);
      for (const p of now) { seen.add(p); gone.delete(p); }
    }
  }
  return out;
}

/** The fit rules for the frame's room, against what shows. The rules are read by core's own reader, fitTo(), from what
 * the capture kept of the scene, so the checker has no reading of its own. A view a rule would hand to another preset
 * is that preset's to answer for, and the plan here is not its plan, so those frames are passed over. */
function rules(r: Record, say: (r: Record, check: string, part: string, detail: string) => void): void {
  const plan = r.plan!, { parts, width, height } = r.measure;
  const room = { view: { inline: width, block: r.height === 'natural' ? null : height }, plot: box(parts[plan.layout === 'radial' ? 'radial' : 'plot']?.box) };
  // A layout with no rules here is a custom mark's, which fits itself in its own package.
  if (!FIT_RULES.some((f) => f.layout === plan.layout)) return;
  // An older capture kept less of the scene: every part is taken to have something in it, and a track beside its label goes unsaid.
  const has = plan.has ?? plan.parts, scene = { layout: plan.layout, parts: plan.parts, ...(has.includes('track') && { track: 'beside' }), nodes: (plan.drawn ?? [...PARTS]).map((part) => ({ part })) };
  const fit = fitTo(scene, room, FIT_RULES, { keep: plan.keep as KeepPart[], marks: plan.marks, fills: () => true });
  if (fit.fallback) return;
  // A rule that sets the legend at the top hides the full one: `legend-top` takes its place.
  const top = fit.set.legend === 'top', expected = new Set(fit.parts.filter((p) => !(top && p === 'legend')));
  const took = (p: string) => [...fit.held].reverse().find((h) => !h.kept && (h.rule.hide.includes(p) || (p === 'legend' && h.rule.set?.legend === 'top')))?.rule;
  const need = (f: FitRule) => `"${f.id}" needs ${[f.needs.inline && f.needs.inline + ' wide', f.needs.block && f.needs.block + ' tall'].filter(Boolean).join(', ')} of the ${f.container}`;
  for (const p of Object.keys(parts)) { const f = PARTS.has(p) && !expected.has(p) && took(p); if (f) say(r, 'hidden', p, `shown, but ${need(f)} and has ${room[f.container]?.inline ?? '?'}×${room[f.container]?.block ?? 'natural'}`); }
  // Down to the number alone, the view has collapsed, by a rule or by the measured pass, and every other part went with it.
  if (Object.keys(parts).every((p) => p === 'number' || p === 'notice')) return;
  // The number is in every scene and shown in compensation, so its absence says nothing.
  for (const p of plan.parts) if (PARTS.has(p) && p !== 'number' && expected.has(p) && !parts[p]) {
    say(r, 'shown', p, `the plan has it and no fit rule hides it at ${width}×${r.height === 'natural' ? 'natural' : height}`);
  }
}
const box = (b?: number[]) => (b ? { inline: b[2]!, block: b[3]! } : null);

/** Each part's promise, read off the fit rules: where it goes, and what takes its place. */
function contracts(): string {
  const by = new Map<string, string[]>();
  for (const f of FIT_RULES) for (const p of f.hide.filter((p) => PARTS.has(p))) {
    const needs = [f.needs.inline && `${f.needs.inline} wide`, f.needs.block && `${f.needs.block} tall`].filter(Boolean).join(' and ');
    by.set(p, [...(by.get(p) ?? []), `${f.layout}: needs ${needs} of the ${f.container}${f.show?.length ? `; else ${f.show.join(', ')} shows` : ''}${f.keep ? ` (keep: ${f.keep})` : ''}`]);
  }
  return [...by].sort().map(([p, lines]) => `- **${p}**\n${lines.map((l) => `  - ${l}`).join('\n')}`).join('\n');
}

const here = dir(args.capture), { records, commit, taken } = read(here), findings = check(records);
const counts = new Map<string, Map<string, Finding[]>>();
for (const f of findings) { const c = counts.get(f.check) ?? new Map(); c.set(f.part, [...(c.get(f.part) ?? []), f]); counts.set(f.check, c); }
const lines = [`# Check of the capture taken ${taken} at ${commit}`, '', `${records.length} frames, ${findings.length} findings.`, ''];
for (const [check, parts] of counts) {
  lines.push(`## ${check}`, '');
  for (const [part, fs] of [...parts].sort((a, b) => b[1].length - a[1].length)) {
    const samples = [...new Set(fs.map((f) => f.sample))];
    lines.push(`- **${part}**: ${fs.length} in ${samples.length} samples. e.g. ${fs.slice(0, 3).map((f) => `${f.sample} ${f.theme} ${f.height}×${f.width}: ${f.detail}`).join('; ')}`);
  }
  lines.push('');
}
if (args.against) {
  const before = new Set(check(read(dir(args.against)).records).map(key)), now = new Set(findings.map(key));
  const added = findings.filter((f) => !before.has(key(f))), gone = [...before].filter((k) => !now.has(k));
  lines.push(`## Since ${args.against}`, '', `${added.length} new, ${gone.length} gone.`, '', ...added.slice(0, 50).map((f) => `- new: ${key(f)}: ${f.detail}`), ...gone.slice(0, 50).map((k) => `- gone: ${k}`), '');
}
lines.push('## What each part promises', '', 'Read off the fit rules (packages/core/src/fit.ts).', '', contracts(), '');
writeFileSync(here + 'check.json', JSON.stringify(findings, null, 1));
writeFileSync(here + 'check.md', lines.join('\n'));
console.log(lines.slice(0, lines.indexOf('## What each part promises')).join('\n') + `\nWritten to ${here}check.md and check.json.`);
