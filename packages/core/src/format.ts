import type { DimensionDef, MetricDef, Polarity, Row, Unit } from './types.ts';

const NF = new Intl.NumberFormat('en-US');
const CF = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const DF = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });                    // Sep 8
const HF = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'UTC' });   // Sep 8, 3 PM
const MF = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });                    // Sep 2026
// A time's fields, as fmtTime reads them. The offset is matched and left where it is.
const TIME = /^(\d{4})-(\d\d)(?:-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d)(?:\.\d+)?)?(?:Z|[+-]\d\d(?::?\d\d)?)?)?)?$/, WEEK = /^(\d{4})-W(\d\d)$/;
const RN = new Intl.DisplayNames('en-US', { type: 'region' });                                                        // US: United States
export const CHAR_W = 6.6; // rough advance of the 13px label face, for clipping

export function fmt(v: number | null | undefined, compact?: boolean): string {
  if (v == null) return '–';
  return compact || Math.abs(v) >= 10000 ? CF.format(v).replace('K', 'k') : NF.format(v);
}
export function fmtPct(p: number): string {
  return pct(p * 100);
}
/** A bucket of time, said as the engine wrote it: the date and the time of day are read from the string, and an offset
 * ("Z", "+02:00") is not applied. An engine names a bucket by the clock where it cut it, so "2026-09-08T00:00:00+02:00" is
 * Sep 8 on every machine, and the viewer's zone is never asked. The forms: a day, "2026-09-08"; a day and time, with a "T" or
 * a space, seconds or not, a fraction or not, an offset or not; a month, "2026-09", which reads "Sep 2026"; an ISO week,
 * "2026-W36", which reads as the Monday it starts on. One on an hour of a day reads "Sep 8, 3 PM". Anything else is refused.
 * ponytail: the grain is read from the value, since neither the catalog nor the result states it. So the midnight bucket
 * of an hourly result reads "Sep 8", as a day does. When the result says its grain, branch on that here. */
export function fmtTime(iso: string): string {
  const m = TIME.exec(iso), w = WEEK.exec(iso);
  let t = NaN;
  if (m) {
    const at = m[1] + '-' + m[2] + '-' + (m[3] ?? '01') + 'T' + (m[4] ?? '00') + ':' + (m[5] ?? '00') + ':' + (m[6] ?? '00') + '.000Z';
    t = Date.parse(at);
    if (isNaN(t) || new Date(t).toISOString() !== at) t = NaN;            // February 30 and 24:00 are no time, and are not carried over
  } else if (w) {
    const jan4 = Date.UTC(+w[1]!, 0, 4);                                   // always in week 1, which starts on the Monday on or before it
    t = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * 86400000 + (+w[2]! - 1) * 7 * 86400000;
    if (!+w[2]! || new Date(t + 3 * 86400000).getUTCFullYear() !== +w[1]!) t = NaN;   // a week is in the year its Thursday is in
  }
  if (isNaN(t)) throw new Error('The time ' + JSON.stringify(iso) + ' is not in a form a view reads. Send a day ("2026-09-08"), a day and time ("2026-09-08T15:00:00", "2026-09-08 15:00:00", with or without an offset such as "Z" or "+02:00"), a month ("2026-09") or an ISO week ("2026-W36"), or give the dimension the type "categorical" in the catalog for its values to be written as they come.');
  return (m && !m[3] ? MF : t % 86400000 ? HF : DF).format(t);
}
// Percent points, as a rate is said: whole from ten, a decimal under it. Exact keeps two.
const pct = (x: number, exact?: boolean) => (exact ? +x.toFixed(2) : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + '%';
// Money is in its currency's own units, dollars and not cents, and its unit is the currency's ISO 4217 code in lower case.
// One set of formatters a currency, made when first asked for: $1,234.50, then $49 and $49.50, then $63.5K.
const CURRENCIES = new Set(Intl.supportedValuesOf('currency').map((c) => c.toLowerCase()));
const MONEY = new Map<string, [Intl.NumberFormat, Intl.NumberFormat, Intl.NumberFormat]>();
function money(v: number, unit: string, form?: 'compact' | 'exact'): string {
  const cur = { style: 'currency', currency: unit.toUpperCase() } as const;
  if (!MONEY.has(unit)) MONEY.set(unit, [new Intl.NumberFormat('en-US', cur),
    new Intl.NumberFormat('en-US', { ...cur, trailingZeroDisplay: 'stripIfInteger' } as Intl.NumberFormatOptions),         // ES2023, so not in this target's types
    new Intl.NumberFormat('en-US', { ...cur, notation: 'compact', maximumFractionDigits: 1 })]);
  const [full, whole, short] = MONEY.get(unit)!;
  return form === 'exact' ? full.format(v) : form === 'compact' || Math.abs(v) >= 10000 ? short.format(v).replace('K', 'k') : whole.format(v);
}
const two = (n: number) => String(n).padStart(2, '0');
// A length of time, from milliseconds, in the largest terms that read: "340ms", "1.2s", "2m 05s", "1h 05m".
function duration(ms: number): string {
  const sign = ms < 0 ? '-' : '', a = Math.abs(ms), s = a / 1000, t = Math.round(s);
  if (a < 999.5) return sign + +a.toFixed(a < 10 ? 1 : 0) + 'ms';
  if (s < 59.95) return sign + +s.toFixed(1) + 's';
  return sign + (t < 3600 ? Math.floor(t / 60) + 'm ' + two(t % 60) + 's' : Math.floor(t / 3600) + 'h ' + two(Math.floor((t % 3600) / 60)) + 'm');
}
// A place in an order: "1st", "2nd", "3rd", "11th".
const ordinal = (n: number) => { const th = ['th', 'st', 'nd', 'rd'], v = Math.abs(n) % 100; return n + (th[(v - 20) % 10] || th[v] || th[0]!); };
const BYTES = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];
// Bytes in steps of a thousand, as the SI prefixes mean: "1.2 MB".
function bytes(v: number): string {
  let a = Math.abs(v), i = 0;
  while (a >= 999.95 && i < BYTES.length - 1) { a /= 1000; i++; }
  return (v < 0 ? '-' : '') + +a.toFixed(i ? 1 : 0) + ' ' + BYTES[i];
}
/** A list as a sentence says it: "a, b or c". */
export const orList = (items: readonly string[]): string => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1]);
/** The units a catalog may give a metric, beside a currency's code. The `Unit` type, the catalog schema's enum and `formatUnit` are kept in step: a new unit is added to all three. */
export const UNITS: Unit[] = ['count', 'ratio', 'percent', 'ms', 's', 'bytes', 'rank'];
/** A value in a unit, where there is a unit and no one metric to hand: a tick on a scale that several metrics share. */
export function formatUnit(v: number | null | undefined, unit: string, form?: 'compact' | 'exact'): string {
  if (v == null) return '–';
  const exact = form === 'exact';
  switch (unit) {
    case 'count': return exact ? NF.format(v) : fmt(v, form === 'compact');
    case 'ratio': return pct(v * 100, exact);                             // a rate from 0 to 1
    case 'percent': return pct(v, exact);                                 // percent points already, 0 to 100
    case 'ms': return exact ? NF.format(v) + ' ms' : duration(v);
    case 's': return exact ? NF.format(v) + ' s' : duration(v * 1000);
    case 'bytes': return exact ? NF.format(v) + ' B' : bytes(v);
    case 'rank': return form === 'compact' || !Number.isInteger(v) ? String(v) : ordinal(v);   // a tick on a scale of ranks is the bare number
  }
  if (CURRENCIES.has(unit)) return money(v, unit, form);
  throw new Error('The unit "' + unit + '" has no format. Give the metric one of ' + UNITS.join(', ') + ' in the catalog, or a currency\'s ISO 4217 code in lower case ("usd"), or add a branch for it to formatUnit in packages/core/src/format.ts.');
}
/** A metric's value as its catalog entry sets it: in its unit. With no form it is what a readout says: a count whole
 * under ten thousand and "10.5k" from there, money as "$49.50" and "$63.5k" in its own currency, a rate as "12%", a time as "340ms" or
 * "2m 05s", bytes as "1.2 MB". `compact` is always the short form, and `exact` never is: a table cell, where the digits matter. */
export function formatValue(v: number | null | undefined, metric: MetricDef, form?: 'compact' | 'exact'): string {
  return formatUnit(v, metric.unit, form);
}
/** A dimension's value as its catalog entry sets it: a day as "Sep 8", an hour as "Sep 8, 3 PM", a country's code as its
 * name, a category as itself. A code the engine left empty is no value, and one that is not a code is said as it came. */
/** A bin by both its ends: "10–20", and in words where an end is below zero, since a dash there reads as a sign. */
export function formatBin(start: Row[string], end: Row[string]): string {
  return end == null ? String(start) : start + (Number(start) < 0 || Number(end) < 0 ? ' to ' : '–') + end;
}
export function formatDimension(v: Row[string], dim: DimensionDef): string {
  if (v == null || (dim.values && v === '')) return '–';
  if (dim.values === 'country') return /^[A-Z]{2}$/.test(String(v)) ? RN.of(String(v)) ?? String(v) : String(v);
  return dim.type === 'time' ? fmtTime(String(v)) : String(v);
}
export function rangeLabel(r: string | null | undefined): string {
  const m = /^([1-9]\d*)d$/.exec(r || '');
  if (r !== 'now' && !m) throw new Error('The result has meta.range: ' + JSON.stringify(r) + ', and a view reads a range as a count of days, "28d", or as "now". Send one of those from the query layer, or leave meta.range out and the prose names no range.');
  return m ? (m[1] === '1' ? 'last day' : 'last ' + m[1] + ' days') : 'right now';
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
/** The change from what was to what is. With no current figure there is nothing to compare and nothing to say of it:
 * state `none` with no text, where no prior figure has "No prior period". A caller with an empty text adds no node and no clause. */
export function delta(cur: number | null | undefined, prev: number | null | undefined, polarity: Polarity): Delta {
  if (cur == null) return { state: 'none', text: '', paint: 'ink.muted' };
  if (prev == null) return { state: 'none', text: 'No prior period', paint: 'ink.muted' };
  if (prev === 0 && cur !== 0) return { state: 'new', text: 'New', paint: 'ink.muted' };
  const p = (cur - prev) / Math.abs(prev);                                // against the size of what was, so a rise from below zero is a rise
  if (cur === prev || Math.abs(p) < 0.005) return { state: 'flat', text: 'No change', paint: 'ink.muted' };
  const up = p > 0, good = polarity === 'none' ? null : (polarity === 'up') === up;
  return { state: up ? 'up' : 'down', pct: p, text: (up ? '▲ ' : '▼ ') + fmtPct(Math.abs(p)), paint: good == null ? 'ink.muted' : good ? 'delta.good' : 'delta.bad' };
}
