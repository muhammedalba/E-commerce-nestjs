/**
 * In-memory test doubles for the backup code (Google Drive subset, Mongoose
 * models). Lives under test/ so it never ships in the build.
 */
import { createHash } from 'crypto';
import { Readable } from 'stream';
import {
  BACKUP_KIND_PROPERTY,
  BACKUP_KIND_VALUE,
} from '../src/backup/retention';

export interface FakeFile {
  id: string;
  name: string;
  parents: string[];
  appProperties: Record<string, string>;
  createdTime: string;
  size?: string;
  mimeType?: string;
  md5Checksum?: string;
  data?: Buffer;
}

/** In-memory Drive with the subset of GoogleDriveClient the uploads code uses. */
export class MemoryDrive {
  files = new Map<string, FakeFile>();
  private seq = 0;

  add(f: Omit<FakeFile, 'id' | 'createdTime'>, createdTime?: Date) {
    const file: FakeFile = {
      ...f,
      id: `fakeDriveId${String(++this.seq).padStart(6, '0')}`,
      createdTime: (createdTime ?? new Date()).toISOString(),
    };
    this.files.set(file.id, file);
    return file;
  }

  findFolders(name: string, opts: { role?: string; parentId?: string } = {}) {
    const role = opts.role ?? 'backup-folder';
    return Promise.resolve(
      [...this.files.values()].filter(
        (f) =>
          f.mimeType === 'folder' &&
          f.name === name &&
          f.appProperties.sgbkRole === role &&
          (!opts.parentId || f.parents.includes(opts.parentId)),
      ),
    );
  }

  async ensureFolder(
    name: string,
    _stored?: string,
    opts: { role?: string; parentId?: string } = {},
  ) {
    const [existing] = await this.findFolders(name, opts);
    if (existing) return { id: existing.id, created: false, renamed: false };
    const folder = this.add({
      name,
      mimeType: 'folder',
      parents: opts.parentId ? [opts.parentId] : [],
      appProperties: { sgbkRole: opts.role ?? 'backup-folder' },
    });
    return { id: folder.id, created: true, renamed: false };
  }

  listFiles(folderId: string, kind: string) {
    return Promise.resolve(
      [...this.files.values()].filter(
        (f) =>
          f.parents.includes(folderId) &&
          f.appProperties[BACKUP_KIND_PROPERTY] === kind,
      ),
    );
  }

  listBackups(folderId: string) {
    return this.listFiles(folderId, BACKUP_KIND_VALUE);
  }

  async uploadResumable(
    source: AsyncIterable<Buffer>,
    p: {
      name: string;
      folderId: string;
      appProperties: Record<string, string>;
    },
  ) {
    const parts: Buffer[] = [];
    for await (const c of source) parts.push(c);
    const data = Buffer.concat(parts);
    const md5 = createHash('md5').update(data).digest('hex');
    const f = this.add({
      name: p.name,
      parents: [p.folderId],
      appProperties: p.appProperties,
      size: String(data.length),
      md5Checksum: md5,
      data,
    });
    return { id: f.id, name: f.name, sizeBytes: data.length, md5 };
  }

  downloadFile(id: string) {
    const f = this.files.get(id);
    if (!f?.data) return Promise.reject(new Error(`404 ${id}`));
    return Promise.resolve(Readable.from([f.data]));
  }

  testConnection(name: string, storedId?: string) {
    const stored = storedId ? this.files.get(storedId) : undefined;
    if (stored?.mimeType === 'folder') {
      return Promise.resolve({ folderId: stored.id, folderExists: true });
    }
    const found = [...this.files.values()].find(
      (f) =>
        f.mimeType === 'folder' &&
        f.name === name &&
        f.appProperties.sgbkRole === 'backup-folder',
    );
    return Promise.resolve({
      folderId: found?.id ?? null,
      folderExists: !!found,
    });
  }

  getBackupFile(id: string, allowed: { folderId: string; kind: string }[]) {
    const f = this.files.get(id);
    const ok =
      !!f &&
      allowed.some(
        (a) =>
          f.parents.includes(a.folderId) &&
          f.appProperties[BACKUP_KIND_PROPERTY] === a.kind,
      );
    return Promise.resolve(ok ? f : null);
  }

  setAppProperties(id: string, props: Record<string, string>) {
    const f = this.files.get(id);
    if (f) f.appProperties = { ...f.appProperties, ...props };
    return Promise.resolve();
  }

  deleteFile(id: string) {
    this.files.delete(id);
    return Promise.resolve();
  }

  /** A database backup entry, as BackupService writes it. */
  addDbBackup(folderId: string, backupId: string) {
    return this.add({
      name: `skygalaxy-${backupId}.sgbk`,
      parents: [folderId],
      size: '10',
      appProperties: {
        [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE,
        sgbkBackupId: backupId,
      },
    });
  }

  dbBackupsOf(backupId: string) {
    return this.byKind(BACKUP_KIND_VALUE).filter(
      (f) => f.appProperties.sgbkBackupId === backupId,
    );
  }

  byKind(kind: string) {
    return [...this.files.values()].filter(
      (f) => f.appProperties[BACKUP_KIND_PROPERTY] === kind,
    );
  }

  backdate(kind: string, ms: number) {
    for (const f of this.byKind(kind)) {
      f.createdTime = new Date(Date.parse(f.createdTime) - ms).toISOString();
    }
  }
}

/** Minimal in-memory stand-ins for the two Mongoose models. */
export function memoryModel<T extends Record<string, unknown>>(
  keyField: string,
) {
  const docs = new Map<string, T>();
  const matches = (doc: T, filter: Record<string, unknown>) =>
    Object.entries(filter).every(([k, v]) =>
      v && typeof v === 'object' && '$nin' in v
        ? !(v.$nin as unknown[]).includes(doc[k])
        : doc[k] === v,
    );
  return {
    docs,
    find: () => ({ lean: () => Promise.resolve([...docs.values()]) }),
    findOne: (filter: Record<string, unknown>) => ({
      lean: () =>
        Promise.resolve(
          [...docs.values()].find((d) => matches(d, filter)) ?? null,
        ),
    }),
    updateOne: (
      filter: Record<string, string>,
      update: { $set: Partial<T> },
    ) => {
      const key = filter[keyField];
      docs.set(key, {
        ...(docs.get(key) ?? { [keyField]: key }),
        ...update.$set,
      } as T);
      return Promise.resolve({});
    },
    deleteOne: (filter: Record<string, string>) => {
      docs.delete(filter[keyField]);
      return Promise.resolve({});
    },
    deleteMany: (filter: Record<string, unknown>) => {
      for (const [k, d] of docs) if (matches(d, filter)) docs.delete(k);
      return Promise.resolve({});
    },
  };
}

/** In-memory database with the subset of the driver the restore code uses. */
export class FakeMongoDb {
  collections = new Map<
    string,
    { docs: Record<string, unknown>[]; options: unknown; indexes: unknown[] }
  >();
  dropped = 0;

  constructor(
    readonly databaseName: string,
    private readonly dataSize = 1024,
  ) {}

  stats() {
    return Promise.resolve({ dataSize: this.dataSize });
  }

  listCollections(filter: { name?: string } = {}) {
    return {
      toArray: () =>
        Promise.resolve(
          [...this.collections.keys()]
            .filter((name) => !filter.name || name === filter.name)
            .map((name) => ({ name })),
        ),
    };
  }

  createCollection(name: string, options: unknown) {
    if (this.collections.has(name)) {
      return Promise.reject(new Error(`collection ${name} exists`));
    }
    this.collections.set(name, { docs: [], options, indexes: [] });
    return Promise.resolve({});
  }

  dropDatabase() {
    this.collections.clear();
    this.dropped++;
    return Promise.resolve(true);
  }

  /** Seed a collection with `n` simple documents. */
  seed(name: string, n: number) {
    this.collections.set(name, {
      docs: Array.from({ length: n }, (_, i) => ({ i })),
      options: {},
      indexes: [],
    });
  }

  collection(name: string) {
    const get = () => {
      if (!this.collections.has(name)) {
        this.collections.set(name, { docs: [], options: {}, indexes: [] });
      }
      return this.collections.get(name)!;
    };
    return {
      insertMany: (docs: Record<string, unknown>[]) => {
        get().docs.push(...docs);
        return Promise.resolve({ insertedCount: docs.length });
      },
      createIndexes: (specs: unknown[]) => {
        get().indexes.push(...specs);
        return Promise.resolve([]);
      },
      countDocuments: () =>
        Promise.resolve(this.collections.get(name)?.docs.length ?? 0),
      findOne: (q: { _id: unknown }) =>
        Promise.resolve(
          this.collections.get(name)?.docs.find((d) => d._id === q._id) ?? null,
        ),
      updateOne: (
        q: { _id: unknown },
        u: {
          $set?: Record<string, unknown>;
          $setOnInsert?: Record<string, unknown>;
        },
      ) => {
        const docs = get().docs;
        const doc = docs.find((d) => d._id === q._id);
        if (doc) Object.assign(doc, u.$set);
        else docs.push({ _id: q._id, ...u.$setOnInsert, ...u.$set });
        return Promise.resolve({});
      },
    };
  }
}

/** A MongoClient whose `db(name)` returns FakeMongoDb instances by name. */
export class FakeMongoClient {
  dbs = new Map<string, FakeMongoDb>();
  db(name: string) {
    if (!this.dbs.has(name)) this.dbs.set(name, new FakeMongoDb(name));
    return this.dbs.get(name)!;
  }
}

/** Minimal Redis for single-use tokens and locks (SET PX / EVAL get+del). */
export class FakeRedis {
  store = new Map<string, string>();
  set(key: string, value: string) {
    this.store.set(key, value);
    return Promise.resolve('OK');
  }
  eval(_script: string, _n: number, key: string) {
    const v = this.store.get(key) ?? null;
    this.store.delete(key);
    return Promise.resolve(v);
  }
}

/** A real, encrypted SGBK database backup of `collections` (for tests). */
export async function buildDbBackup(params: {
  key: Buffer;
  backupId: string;
  collections: Record<string, Record<string, unknown>[]>;
  sourceDb?: string;
  createdAt?: Date;
}): Promise<Buffer> {
  const { gzipSync } = await import('zlib');
  const fmt = await import('../src/backup/backup-format');
  const createdAt = params.createdAt ?? new Date();
  const lines: string[] = [
    fmt.serializeRecord({
      t: 'begin',
      formatVersion: fmt.BACKUP_FORMAT_VERSION,
      backupId: params.backupId,
      createdAt: createdAt.toISOString(),
      sourceDb: params.sourceDb ?? 'skyGalaxy',
      consistency: 'snapshot',
    }),
  ];
  let total = 0;
  const counts: Record<string, number> = {};
  for (const [name, docs] of Object.entries(params.collections)) {
    lines.push(
      fmt.serializeCollection({
        name,
        type: 'collection',
        options: {},
        indexes: [],
      }),
    );
    for (const d of docs) lines.push(fmt.serializeDoc(name, d));
    lines.push(
      fmt.serializeRecord({ t: 'collectionEnd', name, count: docs.length }),
    );
    counts[name] = docs.length;
    total += docs.length;
  }
  lines.push(
    fmt.serializeRecord({
      t: 'end',
      collections: counts,
      totalDocs: total,
      completedAt: createdAt.toISOString(),
    }),
  );
  const { header, iv } = fmt.createBackupHeader({
    backupId: params.backupId,
    createdAt,
    sourceDb: params.sourceDb ?? 'skyGalaxy',
    key: params.key,
  });
  const enc = new fmt.BackupEncryptStream(params.key, header, iv);
  const out: Buffer[] = [];
  enc.on('data', (c: Buffer) => out.push(c));
  const done = new Promise((r) => enc.on('end', r));
  enc.end(gzipSync(Buffer.from(lines.map((l) => l + '\n').join(''))));
  await done;
  return Buffer.concat(out);
}
