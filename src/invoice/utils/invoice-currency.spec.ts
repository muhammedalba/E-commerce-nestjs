import { formatInvoiceCurrency } from './invoice-currency';

describe('formatInvoiceCurrency', () => {
  it("shows the currency's own decimals", () => {
    expect(formatInvoiceCurrency(316.25, 'SAR')).toContain('316.25');
    // Fils: three decimals, never rounded to two
    expect(formatInvoiceCurrency(1.255, 'KWD')).toContain('1.255');
    expect(formatInvoiceCurrency(1.25, 'KWD')).toContain('1.250');
    expect(formatInvoiceCurrency(1500, 'JPY')).toContain('1,500');
  });

  it('shows whole amounts without decimals, as the preview does', () => {
    expect(formatInvoiceCurrency(345, 'KWD')).toBe('345 د.ك');
  });
});
