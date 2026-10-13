import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGzip, gzipSync } from 'zlib';
import { mongo } from 'mongoose';
import {
  BACKUP_FORMAT_VERSION,
  BackupEncryptStream,
  BackupFormatError,
  backupKeyId,
  createBackupHeader,
  decodeBackupKey,
  encodeHeaderPrefix,
  parseRecord,
  reviveEjson,
  serializeCollection,
  serializeDoc,
  serializeRecord,
} from './backup-format';
import { verifyBackupFile } from './restore';

const {
  Binary,
  Decimal128,
  Double,
  Int32,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
  BSONRegExp,
  EJSON,
} = mongo.BSON;

const KEY = Buffer.alloc(32, 7);
const OTHER_KEY = Buffer.alloc(32, 9);

const sampleDoc = {
  _id: new ObjectId('65a1b2c3d4e5f60718293a4b'),
  createdAt: new Date('2026-10-12T03:00:00.000Z'),
  price: Decimal128.fromString('1234.5678'),
  bigCount: Long.fromString('9007199254740993'),
  small: new Int32(42),
  ratio: new Double(1),
  blob: new Binary(Buffer.from([0, 1, 2, 255]), 0),
  uuid: new Binary(Buffer.alloc(16, 0xab), 4),
  ts: new Timestamp({ t: 1700000000, i: 3 }),
  pattern: new BSONRegExp('^sku-\\d+$', 'i'),
  min: new MinKey(),
  max: new MaxKey(),
  nested: { list: [1, 'two', { three: new Date(0) }], empty: [] },
  text: 'line\nbreak "quoted"   عربي',
  nothing: null,
};

function payloadLines(opts: { omitEnd?: boolean; badCount?: boolean } = {}) {
  const lines = [
    serializeRecord({
      t: 'begin',
      formatVersion: BACKUP_FORMAT_VERSION,
      backupId: 'b1',
      createdAt: '2026-10-12T03:00:00.000Z',
      sourceDb: 'skyGalaxy',
      consistency: 'snapshot',
    }),
    serializeCollection({
      name: 'products',
      type: 'collection',
      options: { collation: { locale: 'ar', strength: new Int32(2) } },
      indexes: [
        { v: 2, key: { _id: 1 }, name: '_id_' },
        { v: 2, key: { slug: 1 }, name: 'slug_1', unique: true },
      ],
    }),
    serializeDoc('products', sampleDoc),
    serializeRecord({
      t: 'collectionEnd',
      name: 'products',
      count: opts.badCount ? 2 : 1,
    }),
  ];
  if (!opts.omitEnd) {
    lines.push(
      serializeRecord({
        t: 'end',
        collections: { products: 1 },
        totalDocs: 1,
        completedAt: '2026-10-12T03:00:01.000Z',
      }),
    );
  }
  return lines.map((l) => l + '\n').join('');
}

async function buildFile(
  plaintext: Buffer,
  key = KEY,
  gzip = true,
): Promise<Buffer> {
  const { header, iv } = createBackupHeader({
    backupId: 'b1',
    createdAt: new Date('2026-10-12T03:00:00Z'),
    sourceDb: 'skyGalaxy',
    key,
  });
  const chunks: Buffer[] = [];
  const stages: NodeJS.ReadWriteStream[] = gzip ? [createGzip()] : [];
  await pipeline(
    Readable.from([plaintext]),
    ...(stages as [NodeJS.ReadWriteStream]),
    new BackupEncryptStream(key, header, iv),
    async (source: AsyncIterable<Buffer>) => {
      for await (const c of source) chunks.push(c);
    },
  );
  return Buffer.concat(chunks);
}

describe('backup format', () => {
  let dir: string;
  const write = (name: string, data: Buffer) => {
    const p = join(dir, name);
    writeFileSync(p, data);
    return p;
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgbk-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('round-trips every BSON type exactly through canonical EJSON', async () => {
    const file = write(
      'ok.sgbk',
      await buildFile(Buffer.from(payloadLines(), 'utf8')),
    );
    const verified = await verifyBackupFile(file, [KEY]);
    expect(verified.header.sourceDb).toBe('skyGalaxy');
    expect(verified.counts).toEqual({ products: 1 });
    expect(verified.end.totalDocs).toBe(1);

    const rec = parseRecord(serializeDoc('products', sampleDoc));
    if (rec.t !== 'doc') throw new Error('expected doc');
    const revived = reviveEjson<typeof sampleDoc>(rec.d);
    // Byte-identical BSON means every type and value survived.
    expect(Buffer.from(mongo.BSON.serialize(revived))).toEqual(
      Buffer.from(mongo.BSON.serialize(sampleDoc)),
    );
    expect(revived.small).toBeInstanceOf(Int32);
    expect(revived.ratio).toBeInstanceOf(Double);
    expect(revived.price).toBeInstanceOf(Decimal128);
    expect(revived.bigCount).toBeInstanceOf(Long);
    expect(revived.ts).toBeInstanceOf(Timestamp);
    expect(revived.createdAt).toBeInstanceOf(Date);
  });

  it('keeps one record per line even with newlines inside strings', () => {
    const line = serializeDoc('c', { s: 'a\nb\r\nc' });
    expect(line.includes('\n')).toBe(false);
    expect(
      EJSON.parse(JSON.stringify((JSON.parse(line) as { d: unknown }).d)),
    ).toEqual({
      s: 'a\nb\r\nc',
    });
  });

  it('writes the documented header layout', () => {
    const { header } = createBackupHeader({
      backupId: 'x',
      createdAt: new Date(0),
      sourceDb: 'db',
      key: KEY,
    });
    const prefix = encodeHeaderPrefix(header);
    expect(prefix.subarray(0, 4).toString('ascii')).toBe('SGBK');
    expect(prefix.readUInt8(4)).toBe(1);
    const len = prefix.readUInt32BE(5);
    expect(JSON.parse(prefix.subarray(9, 9 + len).toString())).toEqual(header);
    expect(header.keyId).toBe(backupKeyId(KEY));
    expect(Buffer.from(header.iv, 'base64')).toHaveLength(12);
  });

  it('uses a fresh IV for every backup', () => {
    const ivs = new Set(
      Array.from(
        { length: 50 },
        () =>
          createBackupHeader({
            backupId: 'x',
            createdAt: new Date(),
            sourceDb: 'db',
            key: KEY,
          }).header.iv,
      ),
    );
    expect(ivs.size).toBe(50);
  });

  it('rejects the wrong key', async () => {
    const file = write('k.sgbk', await buildFile(Buffer.from(payloadLines())));
    await expect(verifyBackupFile(file, [OTHER_KEY])).rejects.toThrow(
      /No configured key matches/,
    );
  });

  it('picks the matching key among several (rotation)', async () => {
    const file = write(
      'rot.sgbk',
      await buildFile(Buffer.from(payloadLines()), OTHER_KEY),
    );
    await expect(
      verifyBackupFile(file, [KEY, OTHER_KEY]),
    ).resolves.toBeTruthy();
  });

  it('rejects a modified authentication tag', async () => {
    const buf = await buildFile(Buffer.from(payloadLines()));
    buf[buf.length - 1] ^= 0x01;
    await expect(
      verifyBackupFile(write('tag.sgbk', buf), [KEY]),
    ).rejects.toThrow(BackupFormatError);
  });

  it('rejects modified ciphertext', async () => {
    const buf = await buildFile(Buffer.from(payloadLines()));
    buf[buf.length - 30] ^= 0x01;
    await expect(
      verifyBackupFile(write('ct.sgbk', buf), [KEY]),
    ).rejects.toThrow(BackupFormatError);
  });

  it('rejects a modified header (authenticated as AAD)', async () => {
    const buf = await buildFile(Buffer.from(payloadLines()));
    const json = buf.toString('latin1');
    const tampered = Buffer.from(
      json.replace('"sourceDb":"skyGalaxy"', '"sourceDb":"skyGalaxz"'),
      'latin1',
    );
    expect(tampered.equals(buf)).toBe(false);
    await expect(
      verifyBackupFile(write('aad.sgbk', tampered), [KEY]),
    ).rejects.toThrow(/authentication failed/);
  });

  it('rejects a truncated file', async () => {
    const buf = await buildFile(Buffer.from(payloadLines()));
    await expect(
      verifyBackupFile(write('trunc.sgbk', buf.subarray(0, buf.length - 40)), [
        KEY,
      ]),
    ).rejects.toThrow(BackupFormatError);
    await expect(
      verifyBackupFile(write('trunc2.sgbk', buf.subarray(0, 20)), [KEY]),
    ).rejects.toThrow(BackupFormatError);
  });

  it('rejects bad magic and unsupported versions', async () => {
    const buf = await buildFile(Buffer.from(payloadLines()));
    const badMagic = Buffer.from(buf);
    badMagic.write('XXXX', 0, 'ascii');
    await expect(
      verifyBackupFile(write('magic.sgbk', badMagic), [KEY]),
    ).rejects.toThrow(/bad magic/);
    const badVersion = Buffer.from(buf);
    badVersion.writeUInt8(2, 4);
    await expect(
      verifyBackupFile(write('ver.sgbk', badVersion), [KEY]),
    ).rejects.toThrow(/Unsupported backup format version 2/);
  });

  it('rejects a corrupt compressed payload', async () => {
    const notGzip = await buildFile(
      Buffer.from('this is not gzip data'),
      KEY,
      false,
    );
    await expect(
      verifyBackupFile(write('gz.sgbk', notGzip), [KEY]),
    ).rejects.toThrow(/corrupt/i);
  });

  it('rejects an incomplete export (no end record)', async () => {
    const file = write(
      'noend.sgbk',
      await buildFile(Buffer.from(payloadLines({ omitEnd: true }))),
    );
    await expect(verifyBackupFile(file, [KEY])).rejects.toThrow(/incomplete/);
  });

  it('rejects count mismatches', async () => {
    const file = write(
      'count.sgbk',
      await buildFile(Buffer.from(payloadLines({ badCount: true }))),
    );
    await expect(verifyBackupFile(file, [KEY])).rejects.toThrow(
      /count mismatch/,
    );
  });

  it('rejects garbage records', async () => {
    const plain = gzipSync(Buffer.from('{"t":"nope"}\n'));
    const file = write('garbage.sgbk', await buildFile(plain, KEY, false));
    await expect(verifyBackupFile(file, [KEY])).rejects.toThrow(
      BackupFormatError,
    );
  });

  it('validates key encoding and length', () => {
    expect(() => decodeBackupKey(Buffer.alloc(16).toString('base64'))).toThrow(
      /32 bytes/,
    );
    expect(() => decodeBackupKey('not base64 !!')).toThrow(/base64/);
    expect(decodeBackupKey(KEY.toString('base64'))).toEqual(KEY);
  });
});
