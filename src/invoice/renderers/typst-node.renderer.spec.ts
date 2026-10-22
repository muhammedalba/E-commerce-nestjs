import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { buildInvoiceSnapshot } from '../invoice-data.builder';
import { TYPST_DIR } from './pdf-renderer.interface';
import { TypstNodeRenderer } from './typst-node.renderer';

const settings = {
  legalName: { ar: 'شركة سكاي جالكسي للتجارة', en: 'Sky Galaxy Trading Co.' },
  currencyCode: 'SAR',
  businessAddress: { vatNo: '300000000000003', crNo: '1010101010' },
};

const order = (lines: number) => ({
  _id: '66f1a2b3c4d5e6f7a8b9c0d1',
  invoiceNumber: 42,
  createdAt: '2026-10-21T21:30:00.000Z',
  totalPrice: 501 * lines,
  shippingAmount: 35,
  taxAmount: 75.15 * lines,
  grandTotal: 576.15 * lines + 35,
  shippingAddress: { firstName: 'محمد', lastName: 'البحلي' },
  items: Array.from({ length: lines }, (_, i) => ({
    title: { ar: `دهان أكريليك داخلي ${i + 1}`, en: `Interior Paint ${i + 1}` },
    attributes: { volume: { value: 18, unit: 'ltr' } },
    quantity: 2,
    price: 250.5,
    totalPrice: 501,
  })),
});

/** Page objects in the PDF (Typst writes them uncompressed). */
const pageCount = (pdf: Buffer) =>
  (pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

describe('TypstNodeRenderer', () => {
  const renderer = new TypstNodeRenderer();
  let assets: { logo: Buffer; qr: Buffer };
  let warn: jest.SpyInstance;

  beforeAll(async () => {
    assets = {
      logo: await fs.readFile(
        path.join(TYPST_DIR, 'assets', 'default-logo.png'),
      ),
      qr: await QRCode.toBuffer('test', { margin: 0, width: 280 }),
    };
  });
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('renders an ordinary order as a one-page A4 PDF', async () => {
    const snapshot = buildInvoiceSnapshot(order(3), settings, new Date());
    const pdf = await renderer.render(snapshot, assets);

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pageCount(pdf)).toBe(1);
    // A4 in points
    expect(pdf.toString('latin1')).toMatch(
      /\/MediaBox\s*\[\s*0 0 595\.2\d* 841\.8\d*/,
    );
    // No Typst warnings (missing glyphs are checked in font-coverage.spec)
    expect(warn).not.toHaveBeenCalled();
  });

  it('spreads a long order over several pages', async () => {
    const snapshot = buildInvoiceSnapshot(order(40), settings, new Date());
    const pdf = await renderer.render(snapshot, assets);
    expect(pageCount(pdf)).toBeGreaterThan(1);
  });

  it('gives the same bytes for the same snapshot (a re-render is the same invoice)', async () => {
    const snapshot = buildInvoiceSnapshot(
      order(2),
      settings,
      new Date('2026-10-22T08:00:00Z'),
    );
    const [a, b] = [
      await renderer.render(snapshot, assets),
      await renderer.render(snapshot, assets),
    ];
    expect(a.equals(b)).toBe(true);
  });
});
