import { csvCell, toCsv } from './csv';

describe('CSV export', () => {
  it('starts with a BOM so Excel reads the Arabic text', () => {
    const csv = toCsv(['رقم', 'العميل'], [['RUH-8-2026-0042', 'محمد']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('رقم,العميل\r\nRUH-8-2026-0042,محمد\r\n');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('شركة، الرياض, فرع')).toBe('"شركة، الرياض, فرع"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('keeps numbers as numbers and empties as empty', () => {
    expect(csvCell(316.25)).toBe('316.25');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(NaN)).toBe('');
  });

  it('never lets a name run as a spreadsheet formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+966500000000')).toBe("'+966500000000");
    expect(csvCell('@sum')).toBe("'@sum");
  });
});
