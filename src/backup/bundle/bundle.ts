import { createReadStream } from 'fs';
import { open } from 'fs/promises';
import { Readable } from 'stream';
import { TarEntry, TarFormatError, listTarEntries } from './tar';

/**
 * Layout of a downloadable backup bundle (`skygalaxy-<backupId>.backup.tar`):
 *
 *   README.txt                              how to use it (plain text)
 *   skygalaxy-<backupId>.sgbk               database (encrypted)
 *   skygalaxy-<backupId>.uploads.sgbk       uploads manifest (encrypted, optional)
 *   uploads-blobs/<blobId>.sgbk             each uploaded file the manifest lists (encrypted)
 *
 * Every .sgbk entry is copied byte for byte from Google Drive: the bundle is
 * as encrypted as the backup itself and useless without the key.
 */
export const BACKUP_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const BLOB_ENTRY = /^uploads-blobs\/([0-9a-f]{64})\.sgbk$/;
const DB_ENTRY = /^skygalaxy-([A-Za-z0-9-]{1,64})\.sgbk$/;
const MANIFEST_ENTRY = /^skygalaxy-([A-Za-z0-9-]{1,64})\.uploads\.sgbk$/;
export const README_ENTRY = 'README.txt';

export const bundleFileName = (backupId: string) =>
  `skygalaxy-${backupId}.backup.tar`;
export const dbEntryName = (backupId: string) => `skygalaxy-${backupId}.sgbk`;
export const manifestEntryName = (backupId: string) =>
  `skygalaxy-${backupId}.uploads.sgbk`;
export const blobEntryName = (blobId: string) => `uploads-blobs/${blobId}.sgbk`;

export function bundleReadme(backupId: string, hasUploads: boolean): string {
  return [
    `Sky Galaxy backup bundle — backup ${backupId}`,
    '',
    `${dbEntryName(backupId)}  : the database (encrypted, AES-256-GCM)`,
    hasUploads
      ? `${manifestEntryName(backupId)}  : list of uploaded files (encrypted)\nuploads-blobs/  : the uploaded files themselves (encrypted)`
      : '(no uploaded files were backed up with this backup)',
    '',
    'Everything is encrypted. You need BACKUP_ENCRYPTION_KEY to use it.',
    '',
    'Restore (in server/, after `npm run build`):',
    `  npm run backup:restore -- <this file> "<mongodb uri>" --db <new database name>`,
    `  npm run backup:restore-uploads -- --from-bundle <this file> --target <uploads folder>`,
    'Or upload this file in Admin > Backups to verify it or restore it into the test database.',
    '',
  ].join('\n');
}

export interface ParsedBundle {
  backupId: string;
  db: TarEntry;
  manifest: TarEntry | null;
  blobs: Map<string, TarEntry>;
}

/** Validates a bundle's entry list (names, one backup id, no strays). */
export function classifyBundleEntries(entries: TarEntry[]): ParsedBundle {
  let db: TarEntry | null = null;
  let manifest: TarEntry | null = null;
  let backupId: string | null = null;
  const blobs = new Map<string, TarEntry>();
  const claim = (id: string) => {
    if (backupId && backupId !== id) {
      throw new TarFormatError('Bundle mixes files of different backups');
    }
    backupId = id;
  };
  for (const e of entries) {
    let m: RegExpMatchArray | null;
    if (e.name === README_ENTRY) continue;
    if ((m = e.name.match(MANIFEST_ENTRY))) {
      if (manifest) throw new TarFormatError('Duplicate manifest in bundle');
      claim(m[1]);
      manifest = e;
    } else if ((m = e.name.match(DB_ENTRY))) {
      if (db) throw new TarFormatError('Duplicate database file in bundle');
      claim(m[1]);
      db = e;
    } else if ((m = e.name.match(BLOB_ENTRY))) {
      if (blobs.has(m[1])) throw new TarFormatError('Duplicate blob in bundle');
      blobs.set(m[1], e);
    } else {
      throw new TarFormatError(`Unexpected file in bundle: ${e.name}`);
    }
  }
  if (!db || !backupId) {
    throw new TarFormatError('Bundle has no database backup file');
  }
  if (!manifest && blobs.size > 0) {
    throw new TarFormatError('Bundle has uploaded files but no manifest');
  }
  return { backupId, db, manifest, blobs };
}

/** Lists and validates a bundle on disk. */
export async function readBundle(path: string): Promise<ParsedBundle> {
  return classifyBundleEntries(await listTarEntries(path));
}

/** Streams one entry's bytes from the tar file. */
export function openEntry(path: string, entry: TarEntry): Readable {
  if (entry.size === 0) return Readable.from([]);
  return createReadStream(path, {
    start: entry.offset,
    end: entry.offset + entry.size - 1,
  });
}

/** The first `bytes` of a file (zero-filled if it is shorter). */
export async function readHead(path: string, bytes = 512): Promise<Buffer> {
  const head = Buffer.alloc(bytes);
  const fh = await open(path, 'r');
  try {
    await fh.read(head, 0, bytes, 0);
  } finally {
    await fh.close();
  }
  return head;
}

/** True if the file starts like a tar archive (ustar magic at 257). */
export function looksLikeTar(head: Buffer): boolean {
  return (
    head.length >= 262 && head.subarray(257, 262).toString('ascii') === 'ustar'
  );
}
