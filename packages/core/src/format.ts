import type { DimensionDef, MetricDef, Polarity, Row } from './types.ts';

const NF = new Intl.NumberFormat('en-US');
const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const CHAR_W = 6.6; // rough advance of the 13px label face, for clipping

export function fmt(v: number | null | undefined, compact?: boolean): string {
  if (v == null) return '–';
  return compact || Math.abs(v) >= 10000 ? CF.format(v).replace('K', 'k') : NF.format(v);
}
export function fmtPct(p: number): string {
  const x = p * 100;
  return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + '%';
}
export function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
/** A metric's value as its catalog entry sets it. With no form it is what a readout says: whole under ten thousand,
 * "10.5k" from there. `compact` is always the short form, and `exact` never is: a table cell, where the digits matter.
 * A `ratio` is a share of a whole and reads as a percentage in every form.
 * ponytail: every other unit is set as a count, `usd` too. A new unit gets its branch here. */
export function formatValue(v: number | null | undefined, metric: MetricDef, form?: 'compact' | 'exact'): string {
  if (metric.unit === 'ratio' && v != null) return fmtPct(v);
  return form === 'exact' && v != null ? NF.format(v) : fmt(v, form === 'compact');
}
/** A dimension's value as its catalog entry sets it: a day as "Sep 8", a category as itself. */
export function formatDimension(v: Row[string], dim: DimensionDef): string {
  return v == null ? '–' : dim.type === 'time' ? fmtDay(String(v)) : String(v);
}
export function rangeLabel(r: string | null | undefined): string {
  const m = /^(\d+)d$/.exec(r || '');
  return r === 'now' ? 'right now' : m ? 'last ' + m[1] + ' days' : String(r);
}
export function clip(s: string, n: number): string {
  n = Math.max(3, n);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export interface Delta {
  state: 'none' | 'new' | 'flat' | 'up' | 'down';
  text: string;
  paint: string;
  pct?: number;
}
export function delta(cur: number, prev: number | null | undefined, polarity: Polarity): Delta {
  if (prev == null) return { state: 'none', text: 'No prior period', paint: 'ink.muted' };
  if (prev === 0) return { state: 'new', text: 'New', paint: 'ink.muted' };
  const p = (cur - prev) / prev;
  if (Math.abs(p) < 0.005) return { state: 'flat', text: 'No change', paint: 'ink.muted' };
  const up = p > 0, good = polarity === 'none' ? null : (polarity === 'up') === up;
  return { state: up ? 'up' : 'down', pct: p, text: (up ? '▲ ' : '▼ ') + fmtPct(Math.abs(p)), paint: good == null ? 'ink.muted' : good ? 'delta.good' : 'delta.bad' };
}
