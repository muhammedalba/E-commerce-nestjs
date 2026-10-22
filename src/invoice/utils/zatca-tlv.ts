import { createHash } from 'crypto';

/**
 * ZATCA QR payload (TLV, Base64), built exactly like the invoice preview's
 * buildZatcaTlvBase64 (cleint/features/orders/components/invoice/utils/invoiceUtils.ts)
 * so the issued PDF carries the same QR. Keep both in sync.
 *
 * Tags: 1 seller name, 2 VAT number, 3 invoice date/time, 4 total with VAT,
 * 5 VAT amount, 6 invoice hash (SHA-256 of the fields above when none is given).
 * This is not a full e-invoicing (Fatoora phase 2) implementation: see the
 * module README.
 */
export interface ZatcaFields {
  sellerName: string;
  vatNumber: string;
  invoiceDateTime: string;
  totalWithVat: string;
  vatAmount: string;
  invoiceHash?: string;
}

/** The fallback hash of tag 6, as hex: the same as the client's sha256Hex. */
export function zatcaInvoiceHash(fields: ZatcaFields): string {
  const { sellerName, vatNumber, invoiceDateTime, totalWithVat, vatAmount } =
    fields;
  return createHash('sha256')
    .update(
      `${sellerName}|${vatNumber}|${invoiceDateTime}|${totalWithVat}|${vatAmount}`,
      'utf8',
    )
    .digest('hex');
}

export function buildZatcaTlvBase64(fields: ZatcaFields): string {
  const values = [
    fields.sellerName,
    fields.vatNumber,
    fields.invoiceDateTime,
    fields.totalWithVat,
    fields.vatAmount,
    fields.invoiceHash || zatcaInvoiceHash(fields),
  ];
  const tlv = values.map((value, i) => {
    const bytes = Buffer.from(value, 'utf8');
    // One length byte, like the client (a value over 255 bytes would wrap
    // there too): ZATCA's phase-1 fields are all far shorter.
    return Buffer.concat([Buffer.from([i + 1, bytes.length & 0xff]), bytes]);
  });
  return Buffer.concat(tlv).toString('base64');
}

/** Reads a TLV payload back into tag → value (used to verify the QR content). */
export function decodeZatcaTlv(base64: string): Record<number, string> {
  const bytes = Buffer.from(base64, 'base64');
  const tags: Record<number, string> = {};
  let i = 0;
  while (i + 2 <= bytes.length) {
    const tag = bytes[i];
    const length = bytes[i + 1];
    tags[tag] = bytes.subarray(i + 2, i + 2 + length).toString('utf8');
    i += 2 + length;
  }
  return tags;
}
