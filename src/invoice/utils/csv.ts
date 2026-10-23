/**
 * CSV for the accountant's export (Excel-friendly). Pure.
 *
 * - UTF-8 with a BOM: Excel opens Arabic text correctly only with it.
 * - Fields with a comma, a quote or a line break are quoted, quotes doubled.
 * - Text that a spreadsheet would run as a formula (= + - @, tab, CR) is
 *   prefixed with an apostrophe (CSV injection). Numbers are left as is.
 */

const BOM = '﻿';
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell: a number as is, text escaped and protected against formulas. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The whole file: a header row, the rows, CRLF line ends, with a BOM. */
export function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  return (
    BOM +
    [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') +
    '\r\n'
  );
}
