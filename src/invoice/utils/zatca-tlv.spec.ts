import jsQR from 'jsqr';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import {
  buildZatcaTlvBase64,
  decodeZatcaTlv,
  zatcaInvoiceHash,
} from './zatca-tlv';

const fields = {
  sellerName: 'شركة سكاي جالكسي للتجارة',
  vatNumber: '300000000000003',
  invoiceDateTime: '2026-10-21T21:30:00.000Z',
  totalWithVat: '1650.25',
  vatAmount: '215.25',
};

// CPU-heavy (QR decoding, PDF rendering): the default 5 s is too short
// while the whole suite runs in parallel
jest.setTimeout(30_000);

describe('ZATCA TLV', () => {
  it('round-trips every tag, Arabic included', () => {
    expect(decodeZatcaTlv(buildZatcaTlvBase64(fields))).toEqual({
      1: fields.sellerName,
      2: fields.vatNumber,
      3: fields.invoiceDateTime,
      4: fields.totalWithVat,
      5: fields.vatAmount,
      6: zatcaInvoiceHash(fields),
    });
  });

  it('hashes with standard SHA-256', () => {
    expect(
      zatcaInvoiceHash({
        sellerName: 'a',
        vatNumber: 'b',
        invoiceDateTime: 'c',
        totalWithVat: 'd',
        vatAmount: 'e',
      }),
    ).toBe('2d4b7507de8bf3f1c304248f357c3de417fa87257fb68e22f1afe1da51c504a2');
  });

  it('keeps a stored invoice hash as tag 6', () => {
    const payload = buildZatcaTlvBase64({ ...fields, invoiceHash: 'abc' });
    expect(decodeZatcaTlv(payload)[6]).toBe('abc');
  });

  it('is what the QR image the invoice embeds decodes to', async () => {
    // Same options as InvoiceService.render
    const payload = buildZatcaTlvBase64(fields);
    const png = await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 560,
    });
    // On the invoice the code sits on white: give the scanner that margin
    const white = { r: 255, g: 255, b: 255, alpha: 1 };
    const { data, info } = await sharp(png)
      .extend({ top: 40, bottom: 40, left: 40, right: 40, background: white })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const code = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    expect(code?.data).toBe(payload);
  });
});
