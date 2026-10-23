import { Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { Model, Types } from 'mongoose';
import * as path from 'path';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FileAsset } from 'src/shared/schema/file-asset.schema';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { resolveToFilesystem } from 'src/shared/utils/upload-path.util';
import type { InvoiceSnapshot } from './invoice-data.builder';
import { PdfRenderer, TYPST_DIR } from './renderers/pdf-renderer.interface';

/** How long a worker may hold the generation lease before another takes over. */
const LEASE_MS = 2 * 60_000;
const DEFAULT_LOGO = path.join(TYPST_DIR, 'assets', 'default-logo.png');

/** What an issued document record (invoice, credit note) has in common. */
export interface PdfDocumentFields {
  _id: Types.ObjectId;
  displayNumber: string;
  snapshot: InvoiceSnapshot;
  status: 'pending' | 'generating' | 'generated' | 'failed';
  file?: FileAsset;
  fileSha256?: string;
  attempts: number;
}

export interface IssuedPdf {
  /** The stored PDF: the same bytes are attached and served. */
  buffer: Buffer;
  filename: string;
  file: FileAsset;
  displayNumber: string;
}

interface IssuerOptions {
  /** Upload folder, e.g. "Invoice". */
  folder: string;
  /** For logs, e.g. "Invoice". */
  label: string;
  /** Thrown when another worker holds the lease (retry later). */
  busyError: (id: string) => Error;
  /** Runs once the file is stored and committed (e.g. mirror on the order). */
  onStored?: (doc: PdfDocumentFields, file: FileAsset) => Promise<void>;
}

/**
 * Renders a document's frozen snapshot to PDF once, stores it, and returns the
 * stored bytes on every later call. A generation lease (lockId/lockedUntil)
 * makes concurrent calls render at most once; a worker whose lease was taken
 * over drops its own file and returns the winner's.
 */
export class PdfDocumentIssuer {
  constructor(
    private readonly model: Model<any>,
    private readonly renderer: PdfRenderer,
    private readonly fileUploadService: FileUploadService,
    private readonly logger: Logger,
    private readonly options: IssuerOptions,
  ) {}

  /**
   * The document's PDF: the stored one if any; otherwise rendered under the
   * generation lease, stored, committed, then `onStored`. A failure marks the
   * record `failed` (with `lastError`), drops any file it stored, and throws.
   *
   * @param context For logs and errors, e.g. "order 66f…".
   * @throws The `busyError` while another worker holds the lease.
   */
  async issue(doc: PdfDocumentFields, context: string): Promise<IssuedPdf> {
    if (doc.status === 'generated' && doc.file) return this.loadStored(doc);

    // Take the generation lease (free, or expired after a crash)
    const now = new Date();
    const lockId = randomUUID();
    const locked = await this.model.findOneAndUpdate<PdfDocumentFields>(
      {
        _id: doc._id,
        status: { $ne: 'generated' },
        $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }],
      },
      {
        $set: {
          status: 'generating',
          lockId,
          lockedUntil: new Date(now.getTime() + LEASE_MS),
        },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    if (!locked) {
      const current = await this.model.findById<PdfDocumentFields>(doc._id);
      if (current?.status === 'generated' && current.file) {
        return this.loadStored(current);
      }
      throw this.options.busyError(context);
    }

    let saved: FileAsset | undefined;
    try {
      const buffer = await renderSnapshot(
        this.renderer,
        locked.snapshot,
        this.logger,
      );
      const filename = `${locked.displayNumber}.pdf`;
      saved = await this.fileUploadService.saveFileToDisk(
        {
          buffer,
          originalname: filename,
          mimetype: 'application/pdf',
          fieldname: `${this.options.folder}Pdf`,
          size: buffer.length,
        } as MulterFileType,
        this.options.folder,
      );
      if (!saved?.url) throw new Error('Storage returned no file');

      const committed = await this.model.updateOne(
        { _id: locked._id, lockId },
        {
          $set: {
            status: 'generated',
            file: saved,
            fileSha256: sha256(buffer),
            fileSize: buffer.length,
            generatedAt: new Date(),
          },
          $unset: { lockId: 1, lockedUntil: 1, lastError: 1 },
        },
      );
      if (committed.modifiedCount === 0) {
        // Lease lost (expired and taken over): keep the winner's file only
        await this.discard(saved);
        saved = undefined;
        const current = await this.model.findById<PdfDocumentFields>(
          locked._id,
        );
        if (current?.status === 'generated' && current.file) {
          return this.loadStored(current);
        }
        throw this.options.busyError(context);
      }

      this.logger.log(
        `${this.options.label} ${locked.displayNumber} issued for ${context} (${buffer.length} bytes)`,
      );
      await this.options.onStored?.(locked, saved);
      return {
        buffer,
        filename,
        file: saved,
        displayNumber: locked.displayNumber,
      };
    } catch (err) {
      if (err instanceof Error && err.name.endsWith('BusyError')) throw err;
      if (saved) await this.discard(saved);
      const message = (err as Error).message;
      await this.model.updateOne(
        { _id: locked._id, lockId },
        {
          $set: { status: 'failed', lastError: message.slice(0, 2000) },
          $unset: { lockId: 1, lockedUntil: 1 },
        },
      );
      this.logger.error(
        `${this.options.label} ${locked.displayNumber} for ${context} failed (attempt ${locked.attempts}): ${message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  /** The stored PDF, checked against the hash taken when it was issued. */
  async loadStored(doc: PdfDocumentFields): Promise<IssuedPdf> {
    const file = doc.file as FileAsset;
    const buffer = await readAsset(file.url);
    if (doc.fileSha256 && sha256(buffer) !== doc.fileSha256) {
      throw new Error(
        `Stored ${this.options.label.toLowerCase()} ${doc.displayNumber} does not match its hash`,
      );
    }
    // Repairs a follow-up a crash may have skipped (no-op otherwise)
    await this.options.onStored?.(doc, file);
    return {
      buffer,
      filename: `${doc.displayNumber}.pdf`,
      file,
      displayNumber: doc.displayNumber,
    };
  }

  /** Deletes a file no record points to (logged: it is only clutter). */
  private async discard(file: FileAsset) {
    try {
      await this.fileUploadService.deleteFile(file);
    } catch (err) {
      this.logger.warn(
        `Could not delete unused ${this.options.label.toLowerCase()} file ${file.url}: ${(err as Error).message}`,
      );
    }
  }
}

/** Snapshot → PDF bytes, with its logo and QR code. */
async function renderSnapshot(
  renderer: PdfRenderer,
  snapshot: InvoiceSnapshot,
  logger: Logger,
): Promise<Buffer> {
  const [logo, qr] = await Promise.all([
    loadLogo(snapshot.logo, logger),
    QRCode.toBuffer(snapshot.qr.payload, {
      errorCorrectionLevel: 'M',
      margin: 0,
      width: 560,
    }),
  ]);
  const pdf = await renderer.render(snapshot, { logo, qr });
  if (pdf.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('Renderer did not return a PDF');
  }
  return pdf;
}

/**
 * The frozen logo as PNG (Typst reads no webp), 256px high at most: ~4× its
 * 64px on the document, sharp in print without bloating the PDF. An
 * unreadable logo falls back to the default one, logged: the document must
 * not wait on it forever.
 */
async function loadLogo(
  logo: FileAsset | string | null,
  logger: Logger,
): Promise<Buffer> {
  // Any image format to a PNG at most 256px high
  const toPng = (bytes: Buffer) =>
    sharp(bytes)
      .resize({ height: 256, withoutEnlargement: true })
      .png()
      .toBuffer();
  const url = typeof logo === 'string' ? logo : logo?.url;
  if (url) {
    try {
      return await toPng(await readAsset(url));
    } catch (err) {
      logger.warn(
        `Logo ${url} unreadable, using the default: ${(err as Error).message}`,
      );
    }
  }
  return toPng(await fs.readFile(DEFAULT_LOGO));
}

/** Reads a local upload from disk, anything else over HTTP (Cloudinary). */
async function readAsset(url: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(resolveToFilesystem(url));
}

/** Hex SHA-256 of a file: stored when issued, checked when read back. */
function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Same stored file, whether or not BASE_URL was prepended for the client. */
export function sameFile(a: string, b: string): boolean {
  return a === b || a.endsWith(b) || b.endsWith(a);
}
