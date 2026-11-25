import type { DimensionDef, MetricDef, Polarity, Row, Unit } from './types.ts';

/* How a view says a number, a time and a name. The forms are core's and the language is where the view lands: a set of
 * formatters is made for a locale (`formats`), and whoever builds a view's text is handed the one for its plan. Nothing
 * here asks the machine what language it is in, so a scene is the same on every machine that has the locale's data. */

// A time's fields, as timeOf reads them. The offset is matched and left where it is.
const TIME = /^(\d{4})-(\d\d)(?:-(\d\d)(?:[T ](\d\d):(\d\d)(?::(\d\d)(?:\.\d+)?)?(?:Z|[+-]\d\d(?::?\d\d)?)?)?)?$/, WEEK = /^(\d{4})-W(\d\d)$/;
export const CHAR_W = 0.495; // rough advance of a character of the label face, in em of it
/** The language a view speaks where its container names none. */
export const LOCALE = 'en-US';

/** A bucket of time, read as the engine wrote it: the date and the time of day are read from the string, and an offset
 * ("Z", "+02:00") is not applied. An engine names a bucket by the clock where it cut it, so "2026-09-08T00:00:00+02:00" is
 * Sep 8 on every machine, and the viewer's zone is never asked. The forms: a day, "2026-09-08"; a day and time, with a "T" or
 * a space, seconds or not, a fraction or not, an offset or not; a month, "2026-09"; an ISO week, "2026-W36", which is
 * the Monday it starts on. Anything else is refused. `t` is that clock time as if it were UTC, and `form` how it is said.
 * ponytail: the grain is read from the value, since neither the catalog nor the result states it. So the midnight bucket
 * of an hourly result is a `day`, as a day is. When the result says its grain, branch on that here. */
export function timeOf(iso: string): { t: number; form: 'month' | 'hour' | 'day' } {
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
  return { t, form: m && !m[3] ? 'month' : t % 86400000 ? 'hour' : 'day' };
}
/** A range an answer is over, read: a count of days, or null for "now". One a view cannot say is refused. */
export function rangeOf(r: string | null | undefined): number | null {
  const m = /^([1-9]\d*)d$/.exec(r || '');
  if (r !== 'now' && !m) throw new Error('The result has meta.range: ' + JSON.stringify(r) + ', and a view reads a range as a count of days, "28d", or as "now". Send one of those from the query layer, or leave meta.range out and the prose names no range.');
  return m ? +m[1]! : null;
}

// Money is in its currency's own units, dollars and not cents, and its unit is the currency's ISO 4217 code in lower case.
const CURRENCIES = new Set(Intl.supportedValuesOf('currency').map((c) => c.toLowerCase()));
// What follows a place in an order: "1st", "2nd", "3rd", "11th".
const nth = (n: number) => { const th = ['th', 'st', 'nd', 'rd'], v = Math.abs(n) % 100; return th[(v - 20) % 10] || th[v] || th[0]!; };
const BYTES = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'];
/** A list as a sentence says it: "a, b or c". */
export const orList = (items: readonly string[]): string => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1]);
/** The units a catalog may give a metric, beside a currency's code. The `Unit` type, the catalog schema's enum and `Formats.unit` are kept in step: a new unit is added to all three. */
export const UNITS: Unit[] = ['count', 'ratio', 'percent', 'ms', 's', 'bytes', 'rank'];
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

/** A view's formatters, in one locale. */
export interface Formats {
  /** The locale they are made for, as it was asked. */
  locale: string;
  /** A plain number: whole under ten thousand, and "10.5k" from there or where `compact`. */
  fmt(v: number | null | undefined, compact?: boolean): string;
  /** A whole number said bare, with nothing grouped and nothing cut short: a count in a sentence, "12 pages". */
  count(n: number): string;
  /** A share from 0 to 1, as a rate is said: whole from ten percent, a decimal under it. */
  pct(p: number): string;
  /** A bucket of time (`timeOf`): a day as "Sep 8", one on an hour as "Sep 8, 3 PM", a month as "Sep 2026". */
  time(iso: string): string;
  /** A number in its metric's format, and a plain number where it has no metric. */
  metric(v: number, metric: MetricDef | undefined, compact?: boolean): string;
  /** A value in a unit, where there is a unit and no one metric to hand: a tick on a scale that several metrics share. */
  unit(v: number | null | undefined, unit: string, form?: 'compact' | 'exact'): string;
  /** A metric's value as its catalog entry sets it: in its unit. With no form it is what a readout says: a count whole
   * under ten thousand and "10.5k" from there, money as "$49.50" and "$63.5k" in its own currency, a rate as "12%", a time as "340ms" or
   * "2m 05s", bytes as "1.2 MB". `compact` is always the short form, and `exact` never is: a table cell, where the digits matter. */
  value(v: number | null | undefined, metric: MetricDef, form?: 'compact' | 'exact'): string;
  /** A dimension's value as its catalog entry sets it: a day as "Sep 8", an hour as "Sep 8, 3 PM", a country's code as its
   * name, a category as itself. A code the engine left empty is no value, and one that is not a code is said as it came. */
  dimension(v: Row[string], dim: DimensionDef): string;
  /** A bin by both its ends: "10–20", and in words where an end is below zero, since a dash there reads as a sign. */
  bin(start: Row[string], end: Row[string]): string;
  /** A range an answer is over (`rangeOf`): "last 28 days", "right now". */
  range(r: string | null | undefined): string;
  /** The change from what was to what is. With no current figure there is nothing to compare and nothing to say of it:
   * state `none` with no text, where no prior figure has "No prior period". A caller with an empty text adds no node and no clause. */
  delta(cur: number | null | undefined, prev: number | null | undefined, polarity: Polarity): Delta;
}

const made = new Map<string, Formats>();
/** The formatters for a locale, a BCP 47 tag, and English where none is given. One set a locale, made when first asked
 * for. A tag that is no locale is refused, and so is one this machine has no data for: Intl would answer for it in the
 * machine's own language, and a scene would then differ from one machine to the next. */
export function formats(locale: string = LOCALE): Formats {
  let f = made.get(locale);
  if (!f) {
    let known: string[] = [];
    try { known = Intl.NumberFormat.supportedLocalesOf(locale); } catch { /* not a tag at all */ }
    if (!known.length) throw new Error('The locale ' + JSON.stringify(locale) + ' is not one a view can speak here. Give a BCP 47 language tag this machine has, such as "en-US", "de" or "pt-BR", or leave it out for English.');
    made.set(locale, (f = make(locale)));
  }
  return f;
}

function make(locale: string): Formats {
  const NF = new Intl.NumberFormat(locale), CF = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  // A number that is said beside a unit of its own: a decimal at most, and no grouping. And one of two digits, for the seconds of "2m 05s".
  const N1 = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: false }), N2 = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
  // Percent points already rounded, said with the sign where the locale puts it: "12%", "12 %".
  const PF = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2, useGrouping: false });
  // The clock time was read as if it were UTC (timeOf), so it is said in UTC: as it was written.
  const DF = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });                    // Sep 8
  const HF = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'UTC' });   // Sep 8, 3 PM
  const MF = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });                    // Sep 2026
  const RN = new Intl.DisplayNames(locale, { type: 'region' });                                                        // US: United States
  // ponytail: the small k is the house's, put on whatever the locale writes for a thousand. A locale that writes a "K" of another meaning would want it left.
  const short = (f: Intl.NumberFormat, v: number) => f.format(v).replace('K', 'k');
  const fmt: Formats['fmt'] = (v, compact) => (v == null ? '–' : compact || Math.abs(v) >= 10000 ? short(CF, v) : NF.format(v));
  // Percent points, as a rate is said: whole from ten, a decimal under it. Exact keeps two. The rounding is done here, so the locale only writes it.
  const pct = (x: number, exact?: boolean) => PF.format((exact ? +x.toFixed(2) : x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) / 100);
  // One set of formatters a currency, made when first asked for: $1,234.50, then $49 and $49.50, then $63.5K.
  const MONEY = new Map<string, [Intl.NumberFormat, Intl.NumberFormat, Intl.NumberFormat]>();
  function money(v: number, unit: string, form?: 'compact' | 'exact'): string {
    const cur = { style: 'currency', currency: unit.toUpperCase() } as const;
    if (!MONEY.has(unit)) MONEY.set(unit, [new Intl.NumberFormat(locale, cur),
      new Intl.NumberFormat(locale, { ...cur, trailingZeroDisplay: 'stripIfInteger' } as Intl.NumberFormatOptions),         // ES2023, so not in this target's types
      new Intl.NumberFormat(locale, { ...cur, notation: 'compact', maximumFractionDigits: 1 })]);
    const [full, whole, less] = MONEY.get(unit)!;
    return form === 'exact' ? full.format(v) : form === 'compact' || Math.abs(v) >= 10000 ? short(less, v) : whole.format(v);
  }
  // A length of time, from milliseconds, in the largest terms that read: "340ms", "1.2s", "2m 05s", "1h 05m".
  // ponytail: the letters are English's. Intl.DurationFormat says them in a locale, where every browser a host has ships it.
  function duration(ms: number): string {
    const sign = ms < 0 ? '-' : '', a = Math.abs(ms), s = a / 1000, t = Math.round(s);
    if (a < 999.5) return sign + N1.format(+a.toFixed(a < 10 ? 1 : 0)) + 'ms';
    if (s < 59.95) return sign + N1.format(+s.toFixed(1)) + 's';
    return sign + (t < 3600 ? N1.format(Math.floor(t / 60)) + 'm ' + N2.format(t % 60) + 's' : N1.format(Math.floor(t / 3600)) + 'h ' + N2.format(Math.floor((t % 3600) / 60)) + 'm');
  }
  // Bytes in steps of a thousand, as the SI prefixes mean: "1.2 MB".
  function bytes(v: number): string {
    let a = Math.abs(v), i = 0;
    while (a >= 999.95 && i < BYTES.length - 1) { a /= 1000; i++; }
    return (v < 0 ? '-' : '') + N1.format(+a.toFixed(i ? 1 : 0)) + ' ' + BYTES[i];
  }
  const unit: Formats['unit'] = (v, unit, form) => {
    if (v == null) return '–';
    const exact = form === 'exact';
    switch (unit) {
      case 'count': return exact ? NF.format(v) : fmt(v, form === 'compact');
      case 'ratio': return pct(v * 100, exact);                             // a rate from 0 to 1
      case 'percent': return pct(v, exact);                                 // percent points already, 0 to 100
      case 'ms': return exact ? NF.format(v) + ' ms' : duration(v);
      case 's': return exact ? NF.format(v) + ' s' : duration(v * 1000);
      case 'bytes': return exact ? NF.format(v) + ' B' : bytes(v);
      // A tick on a scale of ranks is the bare number. ponytail: a rank that is no whole number is said as it came, digits and all.
      case 'rank': return !Number.isInteger(v) ? String(v) : N1.format(v) + (form === 'compact' ? '' : nth(v));
    }
    if (CURRENCIES.has(unit)) return money(v, unit, form);
    throw new Error('The unit "' + unit + '" has no format. Give the metric one of ' + UNITS.join(', ') + ' in the catalog, or a currency\'s ISO 4217 code in lower case ("usd"), or add a branch for it to Formats.unit in packages/core/src/format.ts.');
  };
  const value: Formats['value'] = (v, metric, form) => unit(v, metric.unit, form);
  const time: Formats['time'] = (iso) => { const { t, form } = timeOf(iso); return (form === 'month' ? MF : form === 'hour' ? HF : DF).format(t); };
  return {
    locale, fmt, unit, value, time,
    count: (n) => N1.format(n),
    pct: (p) => pct(p * 100),
    metric: (v, metric, compact = false) => (metric ? value(v, metric, compact ? 'compact' : undefined) : fmt(v, compact)),
    dimension(v, dim) {
      if (v == null || (dim.values && v === '')) return '–';
      if (dim.values === 'country') return /^[A-Z]{2}$/.test(String(v)) ? RN.of(String(v)) ?? String(v) : String(v);
      return dim.type === 'time' ? time(String(v)) : String(v);
    },
    bin: (start, end) => (end == null ? String(start) : start + (Number(start) < 0 || Number(end) < 0 ? ' to ' : '–') + end),
    range(r) { const days = rangeOf(r); return days == null ? 'right now' : days === 1 ? 'last day' : 'last ' + N1.format(days) + ' days'; },
    delta(cur, prev, polarity) {
      if (cur == null) return { state: 'none', text: '', paint: 'ink.muted' };
      if (prev == null) return { state: 'none', text: 'No prior period', paint: 'ink.muted' };
      if (prev === 0 && cur !== 0) return { state: 'new', text: 'New', paint: 'ink.muted' };
      const p = (cur - prev) / Math.abs(prev);                                // against the size of what was, so a rise from below zero is a rise
      if (cur === prev || Math.abs(p) < 0.005) return { state: 'flat', text: 'No change', paint: 'ink.muted' };
      const up = p > 0, good = polarity === 'none' ? null : (polarity === 'up') === up;
      return { state: up ? 'up' : 'down', pct: p, text: (up ? '▲ ' : '▼ ') + pct(Math.abs(p) * 100), paint: good == null ? 'ink.muted' : good ? 'delta.good' : 'delta.bad' };
    },
  };
}

/* The same in English, by the names they had before a view had a locale: for a test, and for a caller that is in no
 * view. What builds a view's text takes its plan's formatters and none of these (test/locale.test.ts holds that). */
const EN = formats();
export const fmt = EN.fmt, fmtPct = EN.pct, fmtTime = EN.time, formatMetric = EN.metric, formatUnit = EN.unit, formatValue = EN.value,
  formatDimension = EN.dimension, formatBin = EN.bin, rangeLabel = EN.range, delta = EN.delta;
