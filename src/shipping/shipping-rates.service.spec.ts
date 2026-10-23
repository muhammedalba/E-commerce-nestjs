// Pulls in sharp and the ESM-only uuid through its services; unused here
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

import { ShippingRatesService } from './shipping-rates.service';

const option = (providerId: string, totalShippingCost: number) => ({
  providerId,
  providerName: providerId,
  basePrice: totalShippingCost,
  extraWeightCost: 0,
  totalShippingCost,
  estimatedDays: '2-3',
  supportsCOD: true,
  rateId: `rate-${providerId}`,
});

/** Checkout and returns (OrderCreditNoteService) price shipping with these. */
describe('ShippingRatesService: choosing and pricing a shipping option', () => {
  const service = new ShippingRatesService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const options = [option('aramex', 30), option('smsa', 25)];

  it('picks the requested provider, else the first one', () => {
    expect(service.selectShippingOption(options, 'smsa').providerId).toBe(
      'smsa',
    );
    expect(service.selectShippingOption(options, 'gone').providerId).toBe(
      'aramex',
    );
    expect(() => service.selectShippingOption([], 'smsa')).toThrow(
      'No shipping options available',
    );
  });

  it("is free once the subtotal reaches the store's threshold", () => {
    const settings = { freeShippingThreshold: 500 } as never;
    expect(service.calculateShippingCost(options[0], 499, settings)).toBe(30);
    expect(service.calculateShippingCost(options[0], 500, settings)).toBe(0);
  });

  it('leaves custom rates to their own threshold', () => {
    const settings = {
      freeShippingThreshold: 500,
      hasCustomShippingRates: true,
    } as never;
    expect(service.calculateShippingCost(options[0], 900, settings)).toBe(30);
  });
});
