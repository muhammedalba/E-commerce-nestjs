import { randomBytes } from 'crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  BACKUP_ID_PATTERN,
  classifyBundleEntries,
  openEntry,
  readBundle,
} from './bundle';
import {
  TAR_BLOCK,
  TarFormatError,
  listTarEntries,
  tarHeader,
  tarSize,
  writeTar,
} from './tar';

async function collect(gen: AsyncIterable<Buffer>) {
  const parts: Buffer[] = [];
  for await (const c of gen) parts.push(c);
  return Buffer.concat(parts);
}

async function readAll(stream: AsyncIterable<Buffer>) {
  return collect(stream);
}

const entry = (name: string, data: Buffer) => ({
  name,
  size: data.length,
  open: () => [data],
});

describe('tar', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgbk-tar-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trips entries and matches the precomputed size', async () => {
    const files = [
      entry('README.txt', Buffer.from('hello')),
      entry('skygalaxy-b1.sgbk', randomBytes(1000)),
      entry('uploads-blobs/' + 'a'.repeat(64) + '.sgbk', randomBytes(512)),
      entry('empty.txt', Buffer.alloc(0)),
    ];
    const tar = await collect(writeTar(files));
    expect(tar.length).toBe(tarSize(files));
    expect(tar.length % TAR_BLOCK).toBe(0);

    const path = join(dir, 'ok.tar');
    writeFileSync(path, tar);
    const listed = await listTarEntries(path);
    expect(listed.map((e) => e.name)).toEqual(files.map((f) => f.name));
    for (const [i, e] of listed.entries()) {
      expect(await readAll(openEntry(path, e))).toEqual(files[i].open()[0]);
    }
  });

  it('fails when a source yields a different size than declared', async () => {
    await expect(
      collect(
        writeTar([{ name: 'x', size: 10, open: () => [Buffer.alloc(5)] }]),
      ),
    ).rejects.toThrow(/ended early/);
    await expect(
      collect(
        writeTar([{ name: 'x', size: 2, open: () => [Buffer.alloc(5)] }]),
      ),
    ).rejects.toThrow(/larger than declared/);
  });

  it.each(['../evil', '/abs', 'a//b', 'a\\b', 'x'.repeat(101), 'sp ace', ''])(
    'refuses to write the unsafe name %p',
    (name) => {
      expect(() => tarHeader(name, 1)).toThrow(TarFormatError);
    },
  );

  it('rejects a truncated archive', async () => {
    const tar = await collect(writeTar([entry('a.bin', randomBytes(2000))]));
    const path = join(dir, 'trunc.tar');
    writeFileSync(path, tar.subarray(0, 1200));
    await expect(listTarEntries(path)).rejects.toThrow(/truncated/);
  });

  it('rejects a corrupted header checksum', async () => {
    const tar = await collect(writeTar([entry('a.bin', Buffer.from('x'))]));
    tar[10] ^= 0x01; // inside the name
    const path = join(dir, 'sum.tar');
    writeFileSync(path, tar);
    await expect(listTarEntries(path)).rejects.toThrow(TarFormatError);
  });

  it('rejects non-regular entries and traversal names crafted by hand', async () => {
    const craft = (name: string, type: string) => {
      const h = tarHeader('placeholder', 0);
      h.fill(0, 0, 100);
      h.write(name, 0, 'ascii');
      h.write(type, 156, 'ascii');
      h.fill(0x20, 148, 156);
      const sum = h.reduce((a, b) => a + b, 0);
      h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
      return Buffer.concat([h, Buffer.alloc(2 * TAR_BLOCK)]);
    };
    const link = join(dir, 'link.tar');
    writeFileSync(link, craft('a', '2'));
    await expect(listTarEntries(link)).rejects.toThrow(/regular files/);
    const evil = join(dir, 'evil.tar');
    writeFileSync(evil, craft('../../etc/passwd', '0'));
    await expect(listTarEntries(evil)).rejects.toThrow(/Unsafe/);
  });

  it('rejects files that are not tar archives', async () => {
    const path = join(dir, 'notar.tar');
    writeFileSync(path, randomBytes(2048));
    await expect(listTarEntries(path)).rejects.toThrow(TarFormatError);
  });
});

describe('bundle layout', () => {
  const e = (name: string) => ({ name, size: 1, offset: 0 });
  const blob = 'b'.repeat(64);

  it('classifies a complete bundle', () => {
    const parsed = classifyBundleEntries([
      e('README.txt'),
      e('skygalaxy-2026-10-13T09-55-32Z-17ebdf.sgbk'),
      e('skygalaxy-2026-10-13T09-55-32Z-17ebdf.uploads.sgbk'),
      e(`uploads-blobs/${blob}.sgbk`),
    ]);
    expect(parsed.backupId).toBe('2026-10-13T09-55-32Z-17ebdf');
    expect(BACKUP_ID_PATTERN.test(parsed.backupId)).toBe(true);
    expect(parsed.manifest).not.toBeNull();
    expect([...parsed.blobs.keys()]).toEqual([blob]);
  });

  it.each([
    [
      [e('skygalaxy-a.sgbk'), e('skygalaxy-b.uploads.sgbk')],
      /different backups/,
    ],
    [[e('skygalaxy-a.sgbk'), e('notes.txt')], /Unexpected file/],
    [[e('skygalaxy-a.uploads.sgbk')], /no database backup/],
    [[e('skygalaxy-a.sgbk'), e(`uploads-blobs/${blob}.sgbk`)], /no manifest/],
    [[e('skygalaxy-a.sgbk'), e('skygalaxy-a.sgbk')], /Duplicate/],
  ])('rejects an invalid bundle %#', (entries, message) => {
    expect(() => classifyBundleEntries(entries)).toThrow(message);
  });

  it('reads a bundle from disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sgbk-bundle-'));
    try {
      const path = join(dir, 'b.tar');
      const db = randomBytes(300);
      writeFileSync(
        path,
        await collect(
          writeTar([
            entry('README.txt', Buffer.from('r')),
            entry('skygalaxy-x1.sgbk', db),
          ]),
        ),
      );
      const parsed = await readBundle(path);
      expect(parsed.manifest).toBeNull();
      expect(await readAll(openEntry(path, parsed.db))).toEqual(db);
      expect(readFileSync(path).length).toBe(
        tarSize([{ size: 1 }, { size: 300 }]),
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
