import * as path from 'path';
import { InvoiceSnapshot } from '../invoice-data.builder';

/** Images the template places: both PNG. */
export interface InvoiceRenderAssets {
  logo: Buffer;
  qr: Buffer;
}

/**
 * Turns an invoice snapshot into PDF bytes. The invoice logic only depends on
 * this, so the engine can change (INVOICE_PDF_RENDERER) without touching it.
 */
export interface PdfRenderer {
  render(
    snapshot: InvoiceSnapshot,
    assets: InvoiceRenderAssets,
  ): Promise<Buffer>;
}

export const PDF_RENDERER = Symbol('PDF_RENDERER');

/** The template, fonts and default logo (copied next to the build by nest-cli). */
export const TYPST_DIR = path.join(__dirname, '..', 'typst');
export const TYPST_FONTS_DIR = path.join(TYPST_DIR, 'fonts');
export const TYPST_TEMPLATE = 'invoice.typ';
