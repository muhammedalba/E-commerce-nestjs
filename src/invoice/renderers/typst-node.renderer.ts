import { Injectable, Logger } from '@nestjs/common';
import type { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import * as path from 'path';
import { InvoiceSnapshot } from '../invoice-data.builder';
import {
  InvoiceRenderAssets,
  PdfRenderer,
  TYPST_DIR,
  TYPST_FONTS_DIR,
  TYPST_TEMPLATE,
} from './pdf-renderer.interface';

/**
 * Typst through its native Node binding: no browser and no child process.
 * One compiler is kept (fonts load once). Once loaded, a render is fully
 * synchronous, so two invoices never share the mapped images.
 */
@Injectable()
export class TypstNodeRenderer implements PdfRenderer {
  private readonly logger = new Logger(TypstNodeRenderer.name);
  private compiler?: NodeCompiler;

  /**
   * Loaded on first use, not at boot: a host where the native binding cannot
   * load still starts, and can switch to INVOICE_PDF_RENDERER=typst-cli.
   */
  private async getCompiler(): Promise<NodeCompiler> {
    if (!this.compiler) {
      const { NodeCompiler } =
        await import('@myriaddreamin/typst-ts-node-compiler');
      this.compiler = NodeCompiler.create({
        workspace: TYPST_DIR,
        fontArgs: [{ fontPaths: [TYPST_FONTS_DIR] }],
      });
    }
    return this.compiler;
  }

  async render(
    snapshot: InvoiceSnapshot,
    assets: InvoiceRenderAssets,
  ): Promise<Buffer> {
    const compiler = await this.getCompiler();
    // Shadow files are real paths under the workspace, seen as "/logo.png"
    compiler.mapShadow(path.join(TYPST_DIR, 'logo.png'), assets.logo);
    compiler.mapShadow(path.join(TYPST_DIR, 'qr.png'), assets.qr);
    try {
      const result = compiler.compile({
        mainFilePath: path.join(TYPST_DIR, TYPST_TEMPLATE),
        inputs: { data: JSON.stringify(snapshot) },
      });
      const error = result.takeError();
      if (error) {
        throw new Error(
          `Typst failed: ${JSON.stringify(compiler.fetchDiagnostics(error))}`,
        );
      }
      const warnings = result.takeWarnings();
      if (warnings) {
        // e.g. a glyph none of the bundled fonts has
        this.logger.warn(
          `Typst warnings for invoice ${snapshot.displayNumber}: ${JSON.stringify(compiler.fetchDiagnostics(warnings))}`,
        );
      }
      if (!result.result) throw new Error('Typst produced no document');
      return compiler.pdf(result.result);
    } finally {
      compiler.unmapShadow(path.join(TYPST_DIR, 'logo.png'));
      compiler.unmapShadow(path.join(TYPST_DIR, 'qr.png'));
      // Keep the compiler's caches from growing with every invoice
      compiler.evictCache(10);
    }
  }
}
