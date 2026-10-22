import {
  buildInvoiceSnapshot,
  InvoiceOrderInput,
  InvoiceSettingsInput,
} from './invoice-data.builder';
import { decodeZatcaTlv } from './utils/zatca-tlv';

/*
 * The expected values below were printed by the client's own invoice code
 * (useInvoiceData, formatCurrency, buildZatcaTlvBase64) for these same
 * orders, so the issued PDF shows what the preview shows. Where they differ
 * on purpose, the test says so (README: differences).
 */
const settings: InvoiceSettingsInput = {
  legalName: {
    ar: 'شركة سكاي جالكسي للتجارة',
    en: 'Sky Galaxy Trading Co.',
  },
  siteName: {
    ar: 'سكاي جالكسي',
    en: 'Sky Galaxy',
  },
  currencyCode: 'SAR',
  businessAddress: {
    country: {
      ar: 'المملكة العربية السعودية',
      en: 'Saudi Arabia',
    },
    city: {
      ar: 'الرياض',
      en: 'Riyadh',
    },
    area: {
      ar: 'العليا',
      en: 'Olaya',
    },
    street: {
      ar: 'طريق الملك فهد',
      en: 'King Fahd Rd',
    },
    mailBox: '11564',
    poBox: '12211',
    vatNo: '300000000000003',
    crNo: '1010101010',
  },
  bankTransferDetails: {
    bankName: 'مصرف الراجحي',
    accountName: 'شركة سكاي جالكسي',
    accountNumber: '123456789',
    iban: 'SA0380000000608010167519',
  },
  contactInfo: {
    email: 'info@example.com',
    phones: ['+966500000000'],
  },
};

const orders: Record<string, InvoiceOrderInput> = {
  inclusive: {
    _id: '66f1a2b3c4d5e6f7a8b9c0d1',
    invoiceNumber: 42,
    createdAt: '2026-10-21T21:30:00.000Z',
    currency: 'SAR',
    totalPrice: 1500,
    discountAmount: 100,
    shippingAmount: 35,
    paymentFees: 0,
    taxAmount: 215.25,
    grandTotal: 1650.25,
    productsAmountBeforeTax: 1217.39,
    productsAmountAfterTax: 1400,
    shippingAddress: {
      firstName: 'محمد',
      lastName: 'البحلي',
      street: 'شارع الملك فهد',
      postalCode: '12345',
      country: {
        name: {
          ar: 'المملكة العربية السعودية',
          en: 'Saudi Arabia',
        },
      },
      city: {
        name: {
          ar: 'الرياض',
          en: 'Riyadh',
        },
      },
      region: {
        name: {
          ar: 'منطقة الرياض',
          en: 'Riyadh Region',
        },
      },
    },
    items: [
      {
        title: {
          ar: 'دهان أكريليك داخلي',
          en: 'Interior Acrylic Paint',
        },
        attributes: {
          color: {
            ar: 'أبيض',
            en: 'White',
          },
          volume: {
            value: 18,
            unit: 'ltr',
          },
          finish: 'matte',
        },
        quantity: 2,
        price: 250.5,
        totalPrice: 501,
      },
      {
        title: {
          ar: 'فرشاة',
          en: 'Brush',
        },
        components: [
          {
            name: 'A',
            value: 10.5,
            unit: 'kg',
          },
          {
            name: 'B',
            value: 3.5,
            unit: 'kg',
          },
        ],
        quantity: 3,
        price: 333,
        totalPrice: 999,
      },
    ],
  },
  exclusive: {
    _id: '66f1a2b3c4d5e6f7a8b9c0d2',
    invoiceNumber: 7,
    createdAt: '2026-03-01T10:00:00.000Z',
    currency: 'SAR',
    totalPrice: 200,
    discountAmount: 20,
    shippingAmount: 30,
    paymentFees: 4.6,
    taxAmount: 32.19,
    grandTotal: 246.79,
    productsAmountBeforeTax: 180,
    productsAmountAfterTax: 207,
    shippingAddress: {
      firstName: 'Sara',
      lastName: 'Ali',
      companyName: 'شركة الأفق',
      vendorVatNo: '310000000000003',
      street: 'Tahlia St',
      postalCode: '23434',
      country: {
        name: {
          ar: 'المملكة العربية السعودية',
          en: 'Saudi Arabia',
        },
      },
      city: {
        name: {
          ar: 'جدة',
          en: 'Jeddah',
        },
      },
    },
    items: [
      {
        title: {
          ar: 'منتج واحد',
        },
        quantity: 1,
        price: 200,
        totalPrice: 200,
      },
    ],
  },
  legacy: {
    _id: '5f0000000000000000abcdef',
    createdAt: '2025-12-31T22:30:00.000Z',
    totalPrice: 100,
    discountAmount: 10,
    shippingAmount: 25,
    paymentFees: 2,
    shippingAddress: {
      firstName: 'Ali',
      lastName: 'Hassan',
      street: '',
      postalCode: '',
    },
    items: [
      {
        productId: {
          title: {
            ar: 'منتج قديم',
            en: 'Old product',
          },
        },
        variantId: {
          attributes: {
            size: 'XL',
          },
        },
        quantity: 1,
        price: 100,
      },
    ],
  },
  zeroVat: {
    _id: '66f1a2b3c4d5e6f7a8b9c0d3',
    invoiceNumber: 1234,
    createdAt: '2026-06-15T12:00:00.000Z',
    currency: 'SAR',
    totalPrice: 80,
    discountAmount: 0,
    shippingAmount: 20,
    paymentFees: 0,
    taxAmount: 0,
    grandTotal: 100,
    shippingAddress: {
      firstName: 'Omar',
      lastName: 'Saleh',
      street: 'X',
      postalCode: '1',
    },
    items: [
      {
        title: {
          ar: 'كتاب',
          en: 'Book',
        },
        quantity: 4,
        price: 20,
        totalPrice: 80,
      },
    ],
  },
};

const issuedAt = new Date('2026-10-22T08:00:00.000Z');

const build = (name: string) =>
  buildInvoiceSnapshot(orders[name], settings, issuedAt);

describe('buildInvoiceSnapshot', () => {
  it('matches the preview for tax-inclusive prices with a coupon', () => {
    const s = build('inclusive');
    expect(s.summary).toEqual({
      subtotal: '1,500 ⃁',
      discount: '100 ⃁',
      productsBeforeTax: '1,217.39 ⃁',
      productsAfterTax: '1,400 ⃁',
      shipping: '35 ⃁',
      paymentFees: '0 ⃁',
      taxableSubtotal: '1,435 ⃁',
      tax: '215.25 ⃁',
      grandTotal: '1,650.25 ⃁',
      amountWords:
        'فقط ألف وستمائة وخمسون ريالاً سعودياً وخمس وعشرون هللة لا غير',
    });
    expect(s.items.map((i) => [i.price, i.total])).toEqual([
      ['250.50 ⃁', '501 ⃁'],
      ['333 ⃁', '999 ⃁'],
    ]);
    // The preview's own QR payload for this order, byte for byte
    expect(s.qr.payload).toBe(
      'AS3YtNix2YPYqSDYs9mD2KfZiiDYrNin2YTZg9iz2Yog2YTZhNiq2KzYp9ix2KkCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNi0xMC0yMVQyMTozMDowMC4wMDBaBAcxNjUwLjI1BQYyMTUuMjUGQGU0ZjI2MDAxMThjMjQwNDc3OGIxYTM0ZjUwMmRmMDczZThiN2ZhMzVlOGYxZTI1MzkwOWI5MzExMjJjNzI2ZDg=',
    );
  });

  it('matches the preview for tax-exclusive prices with payment fees', () => {
    const s = build('exclusive');
    expect(s.amounts).toMatchObject({
      subtotal: 200,
      discount: 20,
      shipping: 30,
      paymentFees: 4.6,
      taxableSubtotal: 214.6,
      tax: 32.19,
      grandTotal: 246.79,
    });
    expect(s.summary).toMatchObject({
      paymentFees: '4.60 ⃁',
      taxableSubtotal: '214.60 ⃁',
      tax: '32.19 ⃁',
      grandTotal: '246.79 ⃁',
      productsBeforeTax: '180 ⃁',
      productsAfterTax: '207 ⃁',
      amountWords:
        'فقط مائتان وستة وأربعون ريالاً سعودياً وتسع وسبعون هللة لا غير',
    });
    // Every amount counted once: products - discount + shipping + fees + VAT
    const a = s.amounts;
    expect(
      a.subtotal - a.discount + a.shipping + a.paymentFees + a.tax,
    ).toBeCloseTo(a.grandTotal, 10);
    expect(s.qr.payload).toBe(
      'AS3YtNix2YPYqSDYs9mD2KfZiiDYrNin2YTZg9iz2Yog2YTZhNiq2KzYp9ix2KkCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNi0wMy0wMVQxMDowMDowMC4wMDBaBAYyNDYuNzkFBTMyLjE5BkBmZDlhMmZjYzY5MTQ4YTFiMDk1YzM0NDQwNWVjNGQ2YzcxYWZiYTlkMjc5MDJmMTQ4ODZlZjFmM2E0NWNlMjM2',
    );
  });

  it('shows the company as the customer, with its VAT number', () => {
    const s = build('exclusive');
    expect(s.customer.name).toBe('شركة الأفق');
    expect(s.customer.vatNo).toBe('310000000000003');
    expect(s.customer.address).toEqual({
      country: 'المملكة العربية السعودية',
      area: '-',
      city: 'جدة',
      street: 'Tahlia St',
      mailBox: '-',
      poBox: '23434',
    });
    expect(s.meta.description).toBe('طلب شراء من العميل :  شركة الأفق- ');
  });

  it('estimates VAT only for an old order that never stored it', () => {
    const s = build('legacy');
    expect(s.amounts).toMatchObject({
      taxableSubtotal: 117,
      tax: 17.55,
      grandTotal: 134.55,
    });
    expect(s.summary.productsBeforeTax).toBeUndefined();
    expect(s.summary.productsAfterTax).toBeUndefined();
    expect(s.summary.amountWords).toBe(
      'فقط مائة وأربعة وثلاثون ريالاً سعودياً وخمس وخمسون هللة لا غير',
    );
    // Title and attributes from the populated product/variant (no snapshot)
    expect(s.items[0]).toMatchObject({
      titleAr: 'منتج قديم',
      titleEn: 'Old product',
      badges: ['المقاس: XL'],
      quantity: '1',
      total: '100 ⃁',
    });
  });

  it('keeps a stored VAT of 0 (a VAT-free order shows no VAT)', () => {
    const s = build('zeroVat');
    expect(s.amounts.tax).toBe(0);
    expect(s.summary.tax).toBe('0 ⃁');
    expect(s.summary.grandTotal).toBe('100 ⃁');
    expect(s.summary.taxableSubtotal).toBe('100 ⃁');
    expect(s.summary.amountWords).toBe('فقط مائة ريال سعودي لا غير');
    expect(decodeZatcaTlv(s.qr.payload)[5]).toBe('0.00');
    expect(s.qr.payload).toBe(
      'AS3YtNix2YPYqSDYs9mD2KfZiiDYrNin2YTZg9iz2Yog2YTZhNiq2KzYp9ix2KkCDzMwMDAwMDAwMDAwMDAwMwMYMjAyNi0wNi0xNVQxMjowMDowMC4wMDBaBAYxMDAuMDAFBDAuMDAGQDk3NzJlNzYxODFhNjk1MTMyYzk5ZGU3Mzg2OGM5YTcxMTM1YjMxMWY2MDliYjYwMjQyOWRkNDNlZDM4ZTg2YmM=',
    );
  });

  it('numbers and dates the invoice in the store timezone', () => {
    // 21:30 UTC on Oct 21 is 00:30 on Oct 22 in Riyadh
    const s = build('inclusive');
    expect(s.meta.date).toBe('10/22/2026');
    expect(s.meta.number).toBe('RUH-8-2026-0042');
    expect(s.displayNumber).toBe('RUH-8-2026-0042');
    expect(s.footer.printedOn).toBe('Oct 22, 2026');
    expect(s.meta.placeOfDelivery).toBe('الرياض, المملكة العربية السعودية');

    // New Year's Eve 22:30 UTC is already 2026 in Riyadh (the preview used the
    // browser's zone); no serial: the last 4 characters of the id
    const legacy = build('legacy');
    expect(legacy.meta.number).toBe('RUH-8-2026-CDEF');
    expect(legacy.meta.date).toBe('1/1/2026');
    expect(build('zeroVat').meta.number).toBe('RUH-8-2026-1234');
  });

  it('prints no "undefined" while the order has no delivery receipt', () => {
    expect(build('inclusive').meta.description).toBe(
      'طلب شراء من العميل :  محمد البحلي- ',
    );
  });

  it('labels variant attributes and kits like the preview badges', () => {
    const [paint, brush] = build('inclusive').items;
    expect(paint.badges).toEqual([
      'اللون: أبيض',
      'الحجم: 18 Ltr',
      'Finish: Matte',
    ]);
    expect(brush.badges).toEqual(['مكونات الطقم: A 10.5 Kg + B 3.5 Kg']);
    expect(brush.titleEn).toBe('Brush');
  });

  it('freezes the store details shown on the invoice', () => {
    const s = build('inclusive');
    expect(s.header).toEqual({
      siteNameAr: 'شركة سكاي جالكسي للتجارة',
      siteNameEn: 'Sky Galaxy Trading Co.',
      crNo: '1010101010',
      vatNo: '300000000000003',
    });
    expect(s.vendor.address.country).toBe(
      'المملكة العربية السعودية | Saudi Arabia',
    );
    expect(s.footer.contact).toBe(
      'Mob: +966500000000 - E-mail: info@example.com',
    );
    expect(s.bank.iban).toBe('SA0380000000608010167519');
  });

  it('falls back like the preview when settings are empty', () => {
    const s = buildInvoiceSnapshot(orders.legacy, null, issuedAt);
    expect(s.header).toEqual({
      siteNameAr: 'متجري',
      siteNameEn: 'My Store',
      crNo: '-',
      vatNo: '-',
    });
    expect(s.vendor.address.country).toBe(
      'المملكة العربية السعودية | Saudi Arabia',
    );
    expect(s.bank).toEqual({
      accountName: '-',
      bankName: '-',
      accountNumber: '-',
      iban: '-',
    });
    expect(s.footer.contact).toBe('');
  });
});

describe('ZATCA QR payload', () => {
  it('encodes the five legal fields and the invoice hash', () => {
    const tags = decodeZatcaTlv(build('inclusive').qr.payload);
    expect(tags).toMatchObject({
      1: 'شركة سكاي جالكسي للتجارة',
      2: '300000000000003',
      3: '2026-10-21T21:30:00.000Z',
      4: '1650.25',
      5: '215.25',
    });
    expect(tags[6]).toMatch(/^[0-9a-f]{64}$/);
  });
});
