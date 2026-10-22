import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { InvoiceSnapshot } from '../invoice-data.builder';
import {
  InvoiceRenderAssets,
  PdfRenderer,
  TYPST_DIR,
  TYPST_FONTS_DIR,
  TYPST_TEMPLATE,
} from './pdf-renderer.interface';

const execFileAsync = promisify(execFile);
const RENDER_TIMEOUT_MS = 30_000;

/**
 * Typst through its executable (TYPST_BIN, default `typst` on PATH), for hosts
 * where the native binding cannot load. Each render runs in its own temp
 * folder: the data goes in a file (an argument is capped at 128 KB on Linux).
 */
@Injectable()
export class TypstCliRenderer implements PdfRenderer {
  async render(
    snapshot: InvoiceSnapshot,
    assets: InvoiceRenderAssets,
  ): Promise<Buffer> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'invoice-'));
    try {
      await Promise.all([
        fs.copyFile(
          path.join(TYPST_DIR, TYPST_TEMPLATE),
          path.join(dir, TYPST_TEMPLATE),
        ),
        fs.writeFile(path.join(dir, 'data.json'), JSON.stringify(snapshot)),
        fs.writeFile(path.join(dir, 'logo.png'), assets.logo),
        fs.writeFile(path.join(dir, 'qr.png'), assets.qr),
      ]);
      const out = path.join(dir, 'invoice.pdf');
      await execFileAsync(
        process.env.TYPST_BIN || 'typst',
        [
          'compile',
          '--root',
          dir,
          '--font-path',
          TYPST_FONTS_DIR,
          '--ignore-system-fonts',
          path.join(dir, TYPST_TEMPLATE),
          out,
        ],
        { timeout: RENDER_TIMEOUT_MS },
      );
      return await fs.readFile(out);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}
