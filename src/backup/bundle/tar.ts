import { open } from 'fs/promises';

/**
 * Minimal POSIX ustar writer/reader for backup bundles (no dependency).
 *
 * Only what bundles need: regular files, names ≤ 100 bytes (no prefix
 * field), sizes < 8 GiB. The writer streams entries one after another; the
 * reader lists entries of a tar file on disk with their byte offsets, so a
 * large entry can be streamed with createReadStream({ start, end }).
 */
export const TAR_BLOCK = 512;
const MAX_NAME_BYTES = 100;
const MAX_SIZE = 8 ** 11 - 1; // 11 octal digits

export class TarFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TarFormatError';
  }
}

export interface TarEntrySource {
  name: string;
  size: number;
  mtime?: Date;
  /** Opened only when the entry is written. Must yield exactly `size` bytes. */
  open():
    | Promise<AsyncIterable<Buffer> | Iterable<Buffer>>
    | AsyncIterable<Buffer>
    | Iterable<Buffer>;
}

/** Relative, '/' separated, no empty/'.'/'..' segments, printable ASCII. */
export function assertSafeTarName(name: string): string {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    Buffer.byteLength(name) > MAX_NAME_BYTES ||
    !/^[\x21-\x7e]+$/.test(name) ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.split('/').some((s) => s === '' || s === '.' || s === '..')
  ) {
    throw new TarFormatError(`Unsafe or unsupported tar entry name: ${name}`);
  }
  return name;
}

const padTo = (n: number) => (TAR_BLOCK - (n % TAR_BLOCK)) % TAR_BLOCK;

/** Exact byte length of the archive `writeTar` produces (for Content-Length). */
export function tarSize(entries: { size: number }[]): number {
  return (
    entries.reduce((sum, e) => sum + TAR_BLOCK + e.size + padTo(e.size), 0) +
    2 * TAR_BLOCK
  );
}

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, '0') + '\0';
}

export function tarHeader(name: string, size: number, mtime = new Date()) {
  assertSafeTarName(name);
  if (!Number.isInteger(size) || size < 0 || size > MAX_SIZE) {
    throw new TarFormatError(`Unsupported tar entry size: ${size}`);
  }
  const h = Buffer.alloc(TAR_BLOCK, 0);
  h.write(name, 0, 'ascii');
  h.write(octal(0o644, 8), 100, 'ascii');
  h.write(octal(0, 8), 108, 'ascii');
  h.write(octal(0, 8), 116, 'ascii');
  h.write(octal(size, 12), 124, 'ascii');
  h.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 'ascii');
  h.fill(0x20, 148, 156); // checksum placeholder: spaces
  h.write('0', 156, 'ascii'); // regular file
  h.write('ustar\0', 257, 'ascii');
  h.write('00', 263, 'ascii');
  const sum = h.reduce((a, b) => a + b, 0);
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return h;
}

/** Streams a tar archive of `entries`, in order. */
export async function* writeTar(
  entries: TarEntrySource[],
  signal?: AbortSignal,
): AsyncGenerator<Buffer> {
  for (const entry of entries) {
    signal?.throwIfAborted();
    yield tarHeader(entry.name, entry.size, entry.mtime);
    let written = 0;
    for await (const chunk of await entry.open()) {
      written += chunk.length;
      if (written > entry.size) {
        throw new TarFormatError(`Entry ${entry.name} is larger than declared`);
      }
      yield chunk;
    }
    if (written !== entry.size) {
      throw new TarFormatError(
        `Entry ${entry.name} ended early (${written}/${entry.size} bytes)`,
      );
    }
    const pad = padTo(entry.size);
    if (pad) yield Buffer.alloc(pad, 0);
  }
  yield Buffer.alloc(2 * TAR_BLOCK, 0);
}

export interface TarEntry {
  name: string;
  size: number;
  /** Byte offset of the entry's data in the file. */
  offset: number;
}

function parseOctal(buf: Buffer, start: number, len: number): number {
  const text = buf
    .subarray(start, start + len)
    .toString('ascii')
    .replace(/[\0 ]+$/g, '')
    .trim();
  if (!/^[0-7]+$/.test(text)) {
    throw new TarFormatError('Corrupt tar header (bad number)');
  }
  return parseInt(text, 8);
}

/**
 * Lists the regular-file entries of a tar file, validating each header
 * (magic, checksum, type, safe name) and that every entry fits in the file.
 */
export async function listTarEntries(
  path: string,
  maxEntries = 200_000,
): Promise<TarEntry[]> {
  const fh = await open(path, 'r');
  try {
    const { size: fileSize } = await fh.stat();
    const entries: TarEntry[] = [];
    const header = Buffer.alloc(TAR_BLOCK);
    let pos = 0;
    for (;;) {
      if (pos + TAR_BLOCK > fileSize) {
        throw new TarFormatError('Tar archive is truncated (no end marker)');
      }
      await fh.read(header, 0, TAR_BLOCK, pos);
      if (header.every((b) => b === 0)) return entries; // end of archive
      if (header.subarray(257, 262).toString('ascii') !== 'ustar') {
        throw new TarFormatError('Not a ustar archive');
      }
      const stored = parseOctal(header, 148, 8);
      const copy = Buffer.from(header);
      copy.fill(0x20, 148, 156);
      if (copy.reduce((a, b) => a + b, 0) !== stored) {
        throw new TarFormatError('Corrupt tar header (checksum)');
      }
      const type = String.fromCharCode(header[156]);
      if (type !== '0' && type !== '\0') {
        throw new TarFormatError('Only regular files are allowed in a bundle');
      }
      const nameEnd = header.indexOf(0);
      const name = header
        .subarray(0, nameEnd === -1 || nameEnd > 100 ? 100 : nameEnd)
        .toString('ascii');
      if (header[345] !== 0) {
        throw new TarFormatError('Long (prefixed) names are not supported');
      }
      assertSafeTarName(name);
      const size = parseOctal(header, 124, 12);
      const offset = pos + TAR_BLOCK;
      if (offset + size > fileSize) {
        throw new TarFormatError(`Tar entry ${name} is truncated`);
      }
      entries.push({ name, size, offset });
      if (entries.length > maxEntries) {
        throw new TarFormatError('Too many entries in the archive');
      }
      pos = offset + size + padTo(size);
    }
  } finally {
    await fh.close();
  }
}
