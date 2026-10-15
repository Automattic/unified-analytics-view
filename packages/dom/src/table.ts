import { formatDimension, formatValue, metricOf, type Catalog, type Layer, type Query, type Result, type Row } from '@unified-analytics/core';
import { companionLabel, companions } from './keys.ts';

/* The table alternative: the same result as a table, in place of the marks. The element's own is here, and so are the
 * parts every table is made of, for a layout or a custom mark that lays out its own (matrix.ts's, a treemap's): a
 * field's column label, a value's words, and a row of cells. Totals are the engine's, never a sum of the rows. */

/** A cell: its words, `th` for a heading and `td` for a value, and whether it holds a number, which is set to the end. */
export type Cell = [text: string, tag: 'th' | 'td', num?: boolean];

/** A row of cells, at the end of `parent`. A heading heads its column in the head, and its row anywhere else. */
export function tableRow(parent: HTMLElement, cells: Cell[]): HTMLTableRowElement {
  const tr = parent.appendChild(document.createElement('tr'));
  for (const [s, tag, num] of cells) {
    const c = tr.appendChild(document.createElement(tag));
    c.textContent = s; if (num) c.setAttribute('data-num', ''); if (tag === 'th') c.scope = parent.tagName === 'THEAD' ? 'col' : 'row';
  }
  return tr;
}

/** A field's column label: its metric's, and after it the period before or a companion's own name, as the readout says it. */
export function fieldLabel(f: string, catalog: Catalog): string {
  const [m, of] = f.split('@');
  return catalog.metrics[m!]!.label + (of == null ? '' : ', ' + (of === 'previous' ? 'previous period' : companionLabel(f, catalog)));
}

/** A field's value in a table: exact, in its own unit. */
export function valueText(v: Row[string] | undefined, f: string, catalog: Catalog): string {
  return formatValue(v as number | null, metricOf(catalog, f)!, 'exact');
}

/** A table's caption and nothing else: what a table is rebuilt from. Nothing in it moves, so there is nothing to keep. */
export function emptyTable(table: HTMLTableElement, title: string | undefined): void {
  table.replaceChildren();
  if (title) table.createCaption().textContent = title;
}

/** A result by two dimensions as a pivot: a row per value of the first, a column per value of the second for each
 * field, then the field over all of them. Totals are the engine's, per value of each dimension, so a cell is empty
 * where the result has none. The columns run in the engine's order, as the series of a plot do. */
export function pivot(q: Query, result: Result, fields: string[]): { cols: Row[string][]; rows: { key: Row[string]; cells: Row[string][] }[]; foot: Row[string][] } {
  const [a, b] = q.by as [string, string], uniq = (rows: Row[], d: string) => [...new Set(rows.map((r) => r[d]))];
  const of = (d: string, v: Row[string]) => result.totalsBy?.[d]?.find((t) => t[d] === v);
  const cols = uniq(result.totalsBy?.[b] ?? result.rows, b);
  return {
    cols,
    rows: uniq(result.rows, a).map((key) => {
      const at = result.rows.filter((r) => r[a] === key);
      return { key, cells: [...cols.flatMap((c) => fields.map((f) => at.find((r) => r[b] === c)?.[f])), ...fields.map((f) => of(a, key)?.[f])] };
    }),
    foot: [...cols.flatMap((c) => fields.map((f) => of(b, c)?.[f])), ...fields.map((f) => result.totals[f])],
  };
}

/** The element's table: a row of the table per row of the result, or with two dimensions the pivot. */
export function paintTable(table: HTMLTableElement, title: string | undefined, q: Query, result: Result, catalog: Catalog, layers: Layer[]): void {
  const by = q.by || [], prev = q.compare === 'previous';
  // A companion of a metric that a layer encodes has a column after it, under its suffix, or its own label where the catalog has an entry for it, as the readout says it, and in its own unit. With two dimensions the table is a pivot, and has none.
  const more = (m: string) => (by.length === 2 ? [] : companions(m, result.rows[0], layers));
  const fields = q.metrics.flatMap((m) => [m, ...(prev ? [m + '@previous'] : []), ...more(m)]);
  const label = (f: string) => fieldLabel(f, catalog), value = (v: Row[string] | undefined, f: string): Cell => [valueText(v, f, catalog), 'td', true];
  emptyTable(table, title);
  if (by.length === 2) {
    // Two dimensions: the first down the side, the second across, and each field once more for the whole row.
    const p = pivot(q, result, fields), per = (v: Row[string][]) => v.map((x, i): Cell => (x === undefined ? ['', 'td', true] : value(x, fields[i % fields.length]!)));
    const dim = (i: number, v: Row[string]) => formatDimension(v, catalog.dimensions[by[i]!]!);
    tableRow(table.createTHead(), [[catalog.dimensions[by[0]!]!.label, 'th'], ...p.cols.flatMap((c) => fields.map((f): Cell => [dim(1, c) + (fields.length > 1 ? ', ' + label(f) : ''), 'th', true])), ...fields.map((f): Cell => [label(f), 'th', true])]);
    const tbody = table.createTBody();
    for (const r of p.rows) tableRow(tbody, [[dim(0, r.key), 'th'], ...per(r.cells)]);
    tableRow(table.createTFoot(), [['Total', 'th'], ...per(p.foot)]);
    return;
  }
  tableRow(table.createTHead(), [...by.map((d): Cell => [catalog.dimensions[d]!.label, 'th']), ...fields.map((f): Cell => [label(f), 'th', true])]);
  const body = table.createTBody(), totals = fields.map((f) => value(result.totals[f], f));
  for (const r of result.rows) tableRow(body, [...by.map((d): Cell => [formatDimension(r[d], catalog.dimensions[d]!), 'th']), ...fields.map((f) => value(r[f], f))]);
  if (!by.length) tableRow(body, totals);
  else tableRow(table.createTFoot(), [['Total', 'th'], ...by.slice(1).map((): Cell => ['', 'td']), ...totals]);
}
