import * as fontkit from 'fontkit';
import { readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { deductionNotes } from '../credit-note-data.builder';
import { amountToArabicWords } from '../utils/arabic-amount-words';
import { formatInvoiceCurrency } from '../utils/invoice-currency';
import { TYPST_DIR, TYPST_FONTS_DIR } from './pdf-renderer.interface';

/*
 * Typst draws a blank box for a character none of the bundled fonts has, and
 * does not warn: so every character the invoice can print is checked here
 * (labels, amounts in words, currency symbols, the riyal sign).
 */
const fonts = readdirSync(TYPST_FONTS_DIR)
  .filter((f) => f.endsWith('.ttf'))
  .map((f) => fontkit.create(readFileSync(path.join(TYPST_FONTS_DIR, f))))
  .filter((f): f is fontkit.Font => 'hasGlyphForCodePoint' in f);

/** Whitespace and invisible direction marks need no glyph. */
const needsGlyph = (cp: number) =>
  cp > 0x20 && ![0x200e, 0x200f, 0x061c, 0x200c, 0x200d].includes(cp);

function missing(text: string): string[] {
  const chars = new Set(text);
  return [...chars].filter((ch) => {
    const cp = ch.codePointAt(0)!;
    return needsGlyph(cp) && !fonts.some((f) => f.hasGlyphForCodePoint(cp));
  });
}

describe('invoice fonts', () => {
  it('loads Inter, Noto Kufi Arabic and the riyal font', () => {
    // The typographic family (name ID 16) groups the weights, as Typst does
    const family = (f: fontkit.Font) =>
      (f as { name?: { records?: { preferredFamily?: { en?: string } } } }).name
        ?.records?.preferredFamily?.en ?? f.familyName;
    expect(new Set(fonts.map(family))).toEqual(
      new Set(['Inter', 'Noto Kufi Arabic', 'Riyal']),
    );
  });

  it("cover every character of the template's labels", () => {
    const template = readFileSync(path.join(TYPST_DIR, 'invoice.typ'), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(missing(template)).toEqual([]);
  });

  it('cover the amounts in words and the symbols of every store currency', () => {
    const codes = ['SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'EGP', 'JOD'];
    codes.push('IQD', 'EUR', 'GBP', 'TRY', 'MAD', 'DZD', 'TND', 'LYD', 'YER');
    codes.push('LBP', 'SYP', 'USD', 'AUD', 'XYZ');
    const text = codes
      .flatMap((code) =>
        [0, 1, 2, 11, 1234567.89, 999999999.99].flatMap((n) => [
          amountToArabicWords(n, code),
          formatInvoiceCurrency(n, code),
        ]),
      )
      .join(' ');
    expect(missing(text)).toEqual([]);
  });

  it("cover a credit note's deduction clause", () => {
    const money = (n: number) => formatInvoiceCurrency(n, 'SAR');
    const notes = deductionNotes(
      { amount: 25, tax: 3.75, total: 28.75 },
      316.25,
      money,
    );
    expect(missing(notes.deductionNote + notes.deductionNoteEn)).toEqual([]);
  });
});
