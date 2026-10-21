import { TaxesService } from './taxes.service';

// These pull in ESM-only deps (uuid) that Jest can't load; calculateTax doesn't use them.
jest.mock('../settings/settings.service', () => ({
  SettingsService: class {},
}));
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

/** Builds a service whose tax lookup returns the given rule (no DB needed). */
const serviceWithRule = (percentage: number, isIncludedInPrice: boolean) => {
  const service = Object.create(TaxesService.prototype) as TaxesService;
  service.findApplicableTax = jest.fn(() =>
    Promise.resolve(percentage > 0 ? [{ percentage, isIncludedInPrice }] : []),
  ) as never;
  return service;
};

describe('TaxesService.calculateTax', () => {
  it('taxes products and charges when prices exclude tax', async () => {
    const result = await serviceWithRule(15, false).calculateTax(100, 30);

    expect(result).toMatchObject({
      taxAmount: 19.5,
      chargedTaxAmount: 19.5,
      productsAmountBeforeTax: 100,
      productsAmountAfterTax: 115,
      totalWithTax: 149.5,
      isIncluded: false,
    });
  });

  it('only taxes products when there are no taxable charges', async () => {
    const result = await serviceWithRule(15, false).calculateTax(100, 0);

    expect(result).toMatchObject({ taxAmount: 15, chargedTaxAmount: 15 });
  });

  it('adds VAT on charges only when prices include tax, but reports full VAT', async () => {
    const result = await serviceWithRule(15, true).calculateTax(115, 30);

    expect(result).toMatchObject({
      taxAmount: 19.5,
      chargedTaxAmount: 4.5,
      productsAmountBeforeTax: 100,
      productsAmountAfterTax: 115,
      totalWithTax: 149.5,
      isIncluded: true,
    });
  });

  it('adds nothing when prices include tax and charges are not taxable', async () => {
    const result = await serviceWithRule(15, true).calculateTax(115, 0);

    expect(result).toMatchObject({
      taxAmount: 15,
      chargedTaxAmount: 0,
      totalWithTax: 115,
    });
  });

  it('returns zero tax when no rule applies', async () => {
    const result = await serviceWithRule(0, false).calculateTax(100, 30);

    expect(result).toMatchObject({
      taxAmount: 0,
      chargedTaxAmount: 0,
      productsAmountBeforeTax: 100,
      productsAmountAfterTax: 100,
      totalWithTax: 130,
    });
  });
});
