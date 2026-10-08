import type { DimensionDef, MetricDef, Polarity, Row, Unit } from './types.ts';

const NF = new Intl.NumberFormat('en-US');
const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const DF = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
export const CHAR_W = 6.6; // rough advance of the 13px label face, for clipping

export function fmt(v: number | null | undefined, compact?: boolean): string {
  if (v == null) return '–';
  return compact || Math.abs(v) >= 10000 ? CF.format(v).replace('K', 'k') : NF.format(v);
}
export function fmtPct(p: number): string {
  return pct(p * 100);
}
// One formatter for every call: a readout and a table row each ask for a day, and toLocaleDateString builds its own each time.
export function fmtDay(iso: string): string {
  const day = new Date(iso + 'T00:00:00Z');
  return isNaN(+day) ? String(day) : DF.format(day);                    // "Invalid Date", as toLocaleDateString says it
}
// Percent points, as a rate is said: whole from ten, a decimal under it. Exact keeps two.
const pct = (x: number, exact?: boolean) => (exact ? +x.toFixed(2) : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + '%';
// ponytail: `usd` is the one currency. Currency is per event upstream, and how it reaches a query result is undecided; when it does, the code comes from there.
const USD = { style: 'currency', currency: 'USD' } as const;
const UF = new Intl.NumberFormat('en-US', USD);                                                              // $1,234.50
const UW = new Intl.NumberFormat('en-US', { ...USD, trailingZeroDisplay: 'stripIfInteger' } as Intl.NumberFormatOptions);   // $49, and $49.50. ES2023, so not in this target's types
const UC = new Intl.NumberFormat('en-US', { ...USD, notation: 'compact', maximumFractionDigits: 1 });       // $63.5K
const two = (n: number) => String(n).padStart(2, '0');
// A length of time, from milliseconds, in the largest terms that read: "340ms", "1.2s", "2m 05s", "1h 05m".
function duration(ms: number): string {
  const sign = ms < 0 ? '-' : '', a = Math.abs(ms), s = a / 1000, t = Math.round(s);
  if (a < 999.5) return sign + +a.toFixed(a < 10 ? 1 : 0) + 'ms';
  if (s < 59.95) return sign + +s.toFixed(1) + 's';
  return sign + (t < 3600 ? Math.floor(t / 60) + 'm ' + two(t % 60) + 's' : Math.floor(t / 3600) + 'h ' + two(Math.floor((t % 3600) / 60)) + 'm');
}
const BYTES = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];
// Bytes in steps of a thousand, as the SI prefixes mean: "1.2 MB".
function bytes(v: number): string {
  let a = Math.abs(v), i = 0;
  while (a >= 999.95 && i < BYTES.length - 1) { a /= 1000; i++; }
  return (v < 0 ? '-' : '') + +a.toFixed(i ? 1 : 0) + ' ' + BYTES[i];
}
/** The units a catalog may give a metric. The `Unit` type, the catalog schema's enum and `formatUnit` are kept in step: a new unit is added to all three. */
export const UNITS: Unit[] = ['count', 'ratio', 'percent', 'usd', 'ms', 's', 'bytes'];
/** A value in a unit, where there is a unit and no one metric to hand: a tick on a scale that several metrics share. */
export function formatUnit(v: number | null | undefined, unit: string, form?: 'compact' | 'exact'): string {
  if (v == null) return '–';
  const exact = form === 'exact';
  switch (unit) {
    case 'count': return exact ? NF.format(v) : fmt(v, form === 'compact');
    case 'ratio': return pct(v * 100, exact);                             // a rate from 0 to 1
    case 'percent': return pct(v, exact);                                 // percent points already, 0 to 100
    case 'usd': return exact ? UF.format(v) : form === 'compact' || Math.abs(v) >= 10000 ? UC.format(v).replace('K', 'k') : UW.format(v);
    case 'ms': return exact ? NF.format(v) + ' ms' : duration(v);
    case 's': return exact ? NF.format(v) + ' s' : duration(v * 1000);
    case 'bytes': return exact ? NF.format(v) + ' B' : bytes(v);
  }
  throw new Error('The unit "' + unit + '" has no format. Give the metric one of ' + UNITS.join(', ') + ' in the catalog, or add a branch for it to formatUnit in packages/core/src/format.ts.');
}
/** A metric's value as its catalog entry sets it: in its unit. With no form it is what a readout says: a count whole
 * under ten thousand and "10.5k" from there, money as "$49.50" and "$63.5k", a rate as "12%", a time as "340ms" or
 * "2m 05s", bytes as "1.2 MB". `compact` is always the short form, and `exact` never is: a table cell, where the digits matter. */
export function formatValue(v: number | null | undefined, metric: MetricDef, form?: 'compact' | 'exact'): string {
  return formatUnit(v, metric.unit, form);
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
