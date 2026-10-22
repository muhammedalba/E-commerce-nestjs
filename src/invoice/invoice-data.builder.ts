import { resolveStoreTimezone } from 'src/backup/store-timezone';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { amountToArabicWords } from './utils/arabic-amount-words';
import { formatInvoiceCurrency } from './utils/invoice-currency';
import { buildZatcaTlvBase64, ZatcaFields } from './utils/zatca-tlv';

/**
 * Builds what the issued invoice shows, ported line by line from the client's
 * invoice preview (cleint/features/orders/components/invoice: useInvoiceData
 * and the Invoice* components) so the PDF has the same fields, labels and
 * numbers. Every value comes out as display text: the Typst template only lays
 * it out and computes nothing. Deliberate differences are listed in README.md.
 */

type LocalizedObject = { ar?: string; en?: string };
type Localized = string | LocalizedObject;

interface LocationRef {
  name?: Localized;
}

export interface InvoiceOrderItemInput {
  quantity?: number;
  price?: number;
  totalPrice?: number;
  title?: Localized;
  attributes?: Record<string, unknown> | null;
  components?: { name?: string; value?: unknown; unit?: string }[] | null;
  /**
   * Populated (`{ title }`, `{ attributes, components }`) only to fill a
   * missing snapshot (orders from before it); otherwise a bare id.
   */
  productId?: unknown;
  variantId?: unknown;
}

/**
 * A lean order (no schema defaults applied), so a field missing from an old
 * order stays undefined instead of turning into 0.
 */
export interface InvoiceOrderInput {
  _id: { toString(): string };
  invoiceNumber?: number | null;
  createdAt?: Date | string;
  currency?: string;
  totalPrice?: number;
  shippingAmount?: number;
  discountAmount?: number;
  paymentFees?: number;
  taxAmount?: number | null;
  grandTotal?: number | null;
  productsAmountBeforeTax?: number;
  productsAmountAfterTax?: number;
  deliveryReceiptNumber?: string;
  invoiceHash?: string;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
    vendorVatNo?: string;
    street?: string;
    postalCode?: string;
    // Populated `{ name }` (LocationRef), or a bare id
    country?: unknown;
    city?: unknown;
    region?: unknown;
  };
  items?: InvoiceOrderItemInput[];
}

export interface InvoiceSettingsInput {
  legalName?: Localized;
  siteName?: Localized;
  logo?: FileAsset | string;
  currencyCode?: string;
  businessAddress?: {
    country?: LocalizedObject;
    city?: LocalizedObject;
    area?: LocalizedObject;
    street?: LocalizedObject;
    mailBox?: string;
    poBox?: string;
    vatNo?: string;
    crNo?: string;
  };
  bankTransferDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    iban?: string;
  };
  contactInfo?: { email?: string; phones?: string[] };
}

export interface InvoiceParty {
  name: string;
  vatNo: string;
  address: {
    country: string;
    area: string;
    city: string;
    street: string;
    mailBox: string;
    poBox: string;
  };
}

export interface InvoiceItemRow {
  index: string;
  titleAr: string;
  titleEn: string;
  badges: string[];
  quantity: string;
  price: string;
  total: string;
}

/** Frozen when the invoice is issued; the PDF is always rendered from it. */
export interface InvoiceSnapshot {
  version: 1;
  /** e.g. "RUH-8-2026-0042" */
  displayNumber: string;
  issuedAt: string;
  currencyCode: string;
  /** Store logo at issue time (null: the default logo). */
  logo: FileAsset | string | null;
  header: {
    siteNameAr: string;
    siteNameEn: string;
    crNo: string;
    vatNo: string;
  };
  meta: {
    date: string;
    number: string;
    placeOfDelivery: string;
    description: string;
  };
  vendor: InvoiceParty;
  customer: InvoiceParty;
  items: InvoiceItemRow[];
  summary: {
    subtotal: string;
    discount: string;
    /** Absent for orders placed before the backend stored them. */
    productsBeforeTax?: string;
    productsAfterTax?: string;
    shipping: string;
    paymentFees: string;
    taxableSubtotal: string;
    tax: string;
    grandTotal: string;
    amountWords: string;
  };
  qr: { payload: string; fields: ZatcaFields };
  bank: {
    accountName: string;
    bankName: string;
    accountNumber: string;
    iban: string;
  };
  footer: {
    addressAr: string;
    addressEn: string;
    printedOn: string;
    contact: string;
  };
  /** The raw amounts behind the text above, for checks and tests. */
  amounts: {
    subtotal: number;
    discount: number;
    shipping: number;
    paymentFees: number;
    taxableSubtotal: number;
    tax: number;
    grandTotal: number;
    productsBeforeTax?: number;
    productsAfterTax?: number;
  };
}

/** Client getLocalizedValue: the locale, else ar, else en, else any value. */
function localized(value: unknown, locale: string): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const picked =
      obj[locale] || obj.ar || obj.en || Object.values(obj)[0] || '';
    return typeof picked === 'string' ? picked : '';
  }
  return typeof value === 'string' ? value : '';
}

/** Client getLocationName: a location `{ name }`, a bare `{ ar, en }` or a string. */
function locationName(loc: unknown, locale = 'ar'): string {
  if (!loc) return '';
  const name =
    typeof loc === 'object' && 'name' in loc ? (loc as LocationRef).name : loc;
  return localized(name, locale);
}

/** Attribute labels of the client's product messages (messages/product/ar.json). */
const ATTRIBUTE_LABELS_AR: Record<string, string> = {
  weight: 'الوزن',
  volume: 'الحجم',
  thickness: 'السماكة',
  length: 'الطول',
  diameter: 'القطر',
  density: 'الكثافة',
  size: 'المقاس',
  gsm: 'وزن المتر المربع',
  color: 'اللون',
  type: 'النوع',
  packaging_type: 'نوع التعبئة',
  dimensions: 'الأبعاد',
  components_kit: 'مكونات الطقم',
};

/** Client useAttributeLabel (Arabic): a known name's label, else the key capitalized. */
function attributeLabel(key: string): string {
  const normKey = key.trim().toLowerCase();
  if (Object.hasOwn(ATTRIBUTE_LABELS_AR, normKey)) {
    return ATTRIBUTE_LABELS_AR[normKey];
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** Client formatAttributeValue (Arabic). */
function attributeValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'object') return `${val as string | number | boolean}`;

  const obj = val as Record<string, unknown>;
  const parts: string[] = [];
  if (obj.value !== undefined && obj.value !== null && obj.value !== '') {
    parts.push(`${obj.value as string | number}`);
  }
  if (obj.unit !== undefined && obj.unit !== null && obj.unit !== '') {
    parts.push(`${obj.unit as string}`);
  }
  if (parts.length > 0) return parts.join(' ');

  if (typeof obj.ar === 'string' || typeof obj.en === 'string') {
    return (obj.ar || obj.en) as string;
  }
  try {
    return JSON.stringify(val);
  } catch {
    return '';
  }
}

/** Client formatVariantComponents, e.g. "A 10.5 kg + B 3.5 kg". */
function componentsText(
  components: InvoiceOrderItemInput['components'],
): string {
  if (!components?.length) return '';
  return components
    .map((c) =>
      [c.name, c.value, c.unit]
        .filter((p) => p !== '' && p != null)
        .map((p) => String(p as string | number))
        .join(' '),
    )
    .join(' + ');
}

/** The badges' CSS `capitalize`: first letter of each word in upper case. */
function capitalizeWords(text: string): string {
  return text.replace(
    /(^|\s)(\p{Ll})/gu,
    (_, space: string, letter: string) => `${space}${letter.toUpperCase()}`,
  );
}

/** VariantAttributes badges of one line: "label: value", then the kit. */
function itemBadges(
  attributes: Record<string, unknown> | null | undefined,
  components: InvoiceOrderItemInput['components'],
): string[] {
  const badges: string[] = [];
  if (attributes && typeof attributes === 'object') {
    for (const [key, val] of Object.entries(attributes)) {
      const text = attributeValue(val);
      if (text) badges.push(capitalizeWords(`${attributeLabel(key)}: ${text}`));
    }
  }
  const kit = componentsText(components);
  if (kit) {
    badges.push(capitalizeWords(`${attributeLabel('components_kit')}: ${kit}`));
  }
  return badges;
}

function asObject<T>(value: unknown): T | undefined {
  return value && typeof value === 'object' ? (value as T) : undefined;
}

export function buildInvoiceSnapshot(
  order: InvoiceOrderInput,
  settings: Partial<InvoiceSettingsInput> | null | undefined,
  issuedAt: Date,
): InvoiceSnapshot {
  // Dates on the invoice are the store's (the preview used the browser's zone)
  const { timezone } = resolveStoreTimezone(
    settings?.businessAddress,
    'Asia/Riyadh',
  );
  const createdAt = order.createdAt ? new Date(order.createdAt) : undefined;
  const currencyCode = settings?.currencyCode || 'SAR';
  const money = (amount: number) => formatInvoiceCurrency(amount, currencyCode);

  // ── Amounts (useInvoiceData) ──
  const subtotal = order.totalPrice || 0;
  const shipping = order.shippingAmount || 0;
  const discount = order.discountAmount || 0;
  const paymentFees = order.paymentFees || 0;
  const netBeforeTax = subtotal - discount + shipping + paymentFees;
  // A stored 0 is a VAT-free order: the estimate is only for orders that
  // never stored the field (read lean, so it is then undefined)
  const tax = order.taxAmount ?? netBeforeTax * 0.15;
  const grandTotal = order.grandTotal ?? netBeforeTax + tax;
  // Total excluding VAT; derived from stored totals so tax-inclusive prices are handled too
  const taxableSubtotal =
    order.grandTotal && order.taxAmount
      ? order.grandTotal - order.taxAmount
      : netBeforeTax;
  const orderYear = createdAt
    ? Number(
        new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          timeZone: timezone,
        }).format(createdAt),
      )
    : 2026;

  const address = order.shippingAddress;
  const userVat = address?.vendorVatNo || 'N/A';
  const customerCountry =
    locationName(address?.country, 'ar') || 'المملكة العربية السعودية';
  const customerCity = locationName(address?.city, 'ar') || '-';
  const customerRegion = locationName(address?.region, 'ar') || '-';

  // The order's currency is the store's at checkout; settings cover old orders
  const amountWords = amountToArabicWords(
    grandTotal,
    order.currency || settings?.currencyCode,
  );

  // ── Store settings ──
  // Legal company name takes priority on invoices; display name is the fallback
  const siteNameAr =
    localized(settings?.legalName, 'ar') ||
    localized(settings?.siteName, 'ar') ||
    'متجري';
  const siteNameEn =
    localized(settings?.legalName, 'en') ||
    localized(settings?.siteName, 'en') ||
    'My Store';
  const business = settings?.businessAddress;
  const crNo = business?.crNo || '-';
  const vatNo = business?.vatNo || '-';

  const bank = settings?.bankTransferDetails;
  const email = settings?.contactInfo?.email || '';
  const phone = settings?.contactInfo?.phones?.[0] || '';

  const companyCountryAr =
    localized(business?.country, 'ar') || 'المملكة العربية السعودية';
  const companyCountryEn = localized(business?.country, 'en') || 'Saudi Arabia';
  const companyCityAr = localized(business?.city, 'ar') || '-';
  const companyCityEn = localized(business?.city, 'en') || '-';
  const companyAreaAr = localized(business?.area, 'ar') || '-';
  const companyAreaEn = localized(business?.area, 'en') || '-';
  const companyStreetAr = localized(business?.street, 'ar') || '-';
  const companyStreetEn = localized(business?.street, 'en') || '-';
  const mailBox = business?.mailBox || '-';
  const poBox = business?.poBox || '-';

  // ── Meta table (InvoiceMetaTable) ──
  const customerName =
    address?.companyName ||
    (address?.firstName || '') + ' ' + (address?.lastName || '') ||
    '--';
  const number = `RUH-8-${orderYear}-${
    order.invoiceNumber
      ? String(order.invoiceNumber).padStart(4, '0')
      : order._id.toString().slice(-4).toUpperCase()
  }`;
  const date = createdAt
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: timezone,
      }).format(createdAt)
    : '-';

  // ── Products (InvoiceItemsTable + resolveOrderItem) ──
  const items: InvoiceItemRow[] = (order.items ?? []).map((item, idx) => {
    const product = asObject<{ title?: Localized }>(item.productId);
    const variant = asObject<{
      attributes?: Record<string, unknown>;
      components?: InvoiceOrderItemInput['components'];
    }>(item.variantId);
    const title = item.title ?? product?.title;
    const quantity = item.quantity || 1;
    const price = item.price || 0;
    return {
      index: String(idx + 1),
      titleAr: localized(title, 'ar') || 'منتج',
      titleEn: localized(title, 'en'),
      badges: itemBadges(
        item.attributes ?? variant?.attributes,
        item.components ?? variant?.components,
      ),
      quantity: String(quantity),
      price: money(price),
      total: money(item.totalPrice || quantity * price),
    };
  });

  const zatca: ZatcaFields = {
    sellerName: siteNameAr,
    vatNumber: vatNo,
    invoiceDateTime: (createdAt ?? issuedAt).toISOString(),
    totalWithVat: grandTotal.toFixed(2),
    vatAmount: tax.toFixed(2),
    invoiceHash: order.invoiceHash,
  };

  return {
    version: 1,
    displayNumber: number,
    issuedAt: issuedAt.toISOString(),
    currencyCode,
    logo: settings?.logo || null,
    header: { siteNameAr, siteNameEn, crNo, vatNo },
    meta: {
      date,
      number,
      placeOfDelivery:
        [customerCity, customerCountry].filter(Boolean).join(', ') ||
        'المملكة العربية السعودية',
      // The preview printed "undefined" while no delivery receipt exists
      description: `طلب شراء من العميل :  ${customerName}- ${order.deliveryReceiptNumber ?? ''}`,
    },
    vendor: {
      name: siteNameAr,
      vatNo,
      address: {
        country: `${companyCountryAr} | ${companyCountryEn}`,
        area: `${companyAreaAr} | ${companyAreaEn}`,
        city: `${companyCityAr} | ${companyCityEn}`,
        street: `${companyStreetAr} | ${companyStreetEn}`,
        mailBox,
        poBox,
      },
    },
    customer: {
      name: (
        address?.companyName ||
        (address?.firstName || '') + ' ' + (address?.lastName || '') ||
        'N/A'
      ).trim(),
      vatNo: userVat,
      address: {
        country: customerCountry,
        area: customerRegion,
        city: customerCity,
        street: address?.street || '-',
        mailBox: '-',
        poBox: address?.postalCode || '-',
      },
    },
    items,
    summary: {
      subtotal: money(subtotal),
      discount: money(discount),
      productsBeforeTax:
        order.productsAmountBeforeTax !== undefined
          ? money(order.productsAmountBeforeTax)
          : undefined,
      productsAfterTax:
        order.productsAmountAfterTax !== undefined
          ? money(order.productsAmountAfterTax)
          : undefined,
      shipping: money(shipping),
      paymentFees: money(paymentFees),
      taxableSubtotal: money(taxableSubtotal),
      tax: money(tax),
      grandTotal: money(grandTotal),
      amountWords,
    },
    qr: { payload: buildZatcaTlvBase64(zatca), fields: zatca },
    bank: {
      accountName: bank?.accountName || '-',
      bankName: bank?.bankName || '-',
      accountNumber: bank?.accountNumber || '-',
      iban: bank?.iban || '-',
    },
    footer: {
      addressAr: `${companyCountryAr} - ${companyCityAr} - ${companyAreaAr} - ${companyStreetAr} - صندوق بريد ${mailBox} - الرمز البريدي ${poBox}`,
      addressEn: `${companyCountryEn} - ${companyCityEn} - ${companyAreaEn} - ${companyStreetEn} - P.O. Box ${mailBox} - Postal Code ${poBox}`,
      // The issue date, so a re-render of the same invoice is identical
      printedOn: new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: timezone,
      }).format(issuedAt),
      contact: `${phone ? `Mob: ${phone} - ` : ''}${email ? `E-mail: ${email}` : ''}`,
    },
    amounts: {
      subtotal,
      discount,
      shipping,
      paymentFees,
      taxableSubtotal,
      tax,
      grandTotal,
      productsBeforeTax: order.productsAmountBeforeTax,
      productsAfterTax: order.productsAmountAfterTax,
    },
  };
}
