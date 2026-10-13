import { createHash, randomBytes } from 'crypto';
import {
  DriveApiError,
  DriveFile,
  FOLDER_ROLE_PROPERTY,
  FOLDER_ROLE_VALUE,
  GoogleDriveClient,
  UPLOAD_CHUNK_ALIGNMENT,
} from './google-drive.client';
import { BACKUP_KIND_PROPERTY, BACKUP_KIND_VALUE } from './retention';

type Fault =
  | { kind: 'status'; status: number }
  | { kind: 'network'; storeBytes?: number }
  | { kind: 'corrupt' };

interface StoredFile extends DriveFile {
  parents?: string[];
  data?: Buffer;
}

/** A tiny in-memory Google Drive v3 (just what the backup client uses). */
class FakeDrive {
  files = new Map<string, StoredFile>();
  sessions = new Map<
    string,
    {
      meta: StoredFile;
      data: Buffer[];
      length: number;
      done?: StoredFile;
      cancelled?: boolean;
    }
  >();
  putFaults: Fault[] = [];
  startFaults: Fault[] = [];
  putBodySizes: number[] = [];
  requests: { method: string; url: string }[] = [];
  pageSize = 2;
  private seq = 0;

  id(prefix: string) {
    return `${prefix}${++this.seq}`;
  }

  addFolder(name: string, ours = true): StoredFile {
    const f: StoredFile = {
      id: this.id('folder'),
      name,
      mimeType: 'application/vnd.google-apps.folder',
      trashed: false,
      createdTime: new Date(Date.now() + this.seq).toISOString(),
      appProperties: ours ? { [FOLDER_ROLE_PROPERTY]: FOLDER_ROLE_VALUE } : {},
    };
    this.files.set(f.id, f);
    return f;
  }

  addBackup(folderId: string, name: string): StoredFile {
    const f: StoredFile = {
      id: this.id('file'),
      name,
      size: '10',
      parents: [folderId],
      createdTime: new Date().toISOString(),
      appProperties: { [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE },
    };
    this.files.set(f.id, f);
    return f;
  }

  private json(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {},
  ) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  }

  private public(f: StoredFile): DriveFile {
    const rest: StoredFile = { ...f };
    delete rest.data;
    delete rest.parents;
    return rest;
  }

  fetch = async (input: string | URL | Request, init: RequestInit = {}) => {
    await Promise.resolve(); // network latency
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init.method ?? 'GET';
    this.requests.push({ method, url: url.toString() });
    const headers = new Headers(init.headers);

    // ── resumable sessions ──
    if (url.host === 'upload.test') {
      const session = this.sessions.get(url.pathname.slice(1))!;
      if (method === 'DELETE') {
        session.cancelled = true;
        return new Response(null, { status: 204 });
      }
      const range = headers.get('content-range')!;
      const status = () =>
        session.done
          ? this.json(this.public(session.done), 200)
          : new Response(null, {
              status: 308,
              headers: session.length
                ? { range: `bytes=0-${session.length - 1}` }
                : {},
            });
      if (range.startsWith('bytes */')) return status();

      const body = Buffer.from(init.body as Uint8Array);
      this.putBodySizes.push(body.length);
      const fault = this.putFaults.shift();
      if (fault?.kind === 'status')
        return new Response('{}', { status: fault.status });
      const m = range.match(/^bytes (\d+)-(\d+)\/(\d+|\*)$/)!;
      const start = Number(m[1]);
      if (start !== session.length) return new Response('{}', { status: 400 });
      if (fault?.kind === 'network') {
        const keep = body.subarray(0, fault.storeBytes ?? 0);
        session.data.push(Buffer.from(keep));
        session.length += keep.length;
        throw new TypeError('fetch failed');
      }
      const stored = Buffer.from(body);
      if (fault?.kind === 'corrupt') stored[0] ^= 0xff;
      session.data.push(stored);
      session.length += stored.length;
      if (m[3] !== '*' && session.length === Number(m[3])) {
        const data = Buffer.concat(session.data);
        const file: StoredFile = {
          ...session.meta,
          id: this.id('file'),
          size: String(data.length),
          md5Checksum: createHash('md5').update(data).digest('hex'),
          createdTime: new Date().toISOString(),
          data,
        };
        this.files.set(file.id, file);
        session.done = file;
        return this.json(this.public(file), 200);
      }
      return status();
    }

    if (url.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const fault = this.startFaults.shift();
      if (fault?.kind === 'status') {
        return this.json(
          { error: { message: 'nope access_token=leaked' } },
          fault.status,
        );
      }
      const meta = JSON.parse(init.body as string) as StoredFile;
      const id = this.id('session');
      this.sessions.set(id, { meta, data: [], length: 0 });
      return new Response(null, {
        status: 200,
        headers: { location: `https://upload.test/${id}` },
      });
    }

    // ── metadata ──
    expect(headers.get('authorization')).toBe('Bearer test-token');
    const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch) {
      const file = this.files.get(decodeURIComponent(fileMatch[1]));
      if (!file)
        return this.json({ error: { message: 'File not found' } }, 404);
      if (method === 'DELETE') {
        this.files.delete(file.id);
        return new Response(null, { status: 204 });
      }
      if (method === 'PATCH') {
        Object.assign(file, JSON.parse(init.body as string));
        return this.json(this.public(file));
      }
      return this.json(this.public(file));
    }
    if (url.pathname === '/drive/v3/files' && method === 'POST') {
      const meta = JSON.parse(init.body as string) as StoredFile;
      const f = {
        ...meta,
        id: this.id('folder'),
        trashed: false,
        createdTime: new Date().toISOString(),
      };
      this.files.set(f.id, f);
      return this.json(this.public(f));
    }
    if (url.pathname === '/drive/v3/files' && method === 'GET') {
      const q = url.searchParams.get('q')!;
      let matches = [...this.files.values()].filter((f) => !f.trashed);
      const parent = q.match(/'([^']+)' in parents/);
      if (parent)
        matches = matches.filter((f) => f.parents?.includes(parent[1]));
      const name = q.match(/name='([^']+)'/);
      if (name) matches = matches.filter((f) => f.name === name[1]);
      for (const [, key, value] of q.matchAll(
        /key='([^']+)' and value='([^']+)'/g,
      )) {
        matches = matches.filter((f) => f.appProperties?.[key] === value);
      }
      if (q.includes('mimeType=')) {
        matches = matches.filter(
          (f) => f.mimeType === 'application/vnd.google-apps.folder',
        );
      }
      const offset = Number(url.searchParams.get('pageToken') ?? 0);
      const page = matches.slice(offset, offset + this.pageSize);
      const next =
        offset + this.pageSize < matches.length
          ? String(offset + this.pageSize)
          : undefined;
      return this.json({
        files: page.map((f) => this.public(f)),
        nextPageToken: next,
      });
    }
    throw new Error(`Unexpected request ${method} ${url}`);
  };
}

const CHUNK = UPLOAD_CHUNK_ALIGNMENT; // 256 KiB keeps tests fast

function client(drive: FakeDrive) {
  return new GoogleDriveClient(
    { getAccessToken: () => Promise.resolve('test-token') },
    {
      fetchImpl: drive.fetch,
      chunkSize: CHUNK,
      maxRetries: 3,
      sleep: () => Promise.resolve(),
    },
  );
}

async function* chunks(data: Buffer, size = 64 * 1024) {
  for (let i = 0; i < data.length; i += size) {
    await Promise.resolve(); // an asynchronous source, like the encrypt stream
    yield data.subarray(i, i + size);
  }
}

const params = (folderId: string, signal?: AbortSignal) => ({
  name: 'skygalaxy-test.sgbk',
  folderId,
  appProperties: { [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE },
  signal,
});

describe('GoogleDriveClient', () => {
  describe('ensureFolder', () => {
    it('creates the app folder when none exists', async () => {
      const drive = new FakeDrive();
      const res = await client(drive).ensureFolder('backups');
      expect(res.created).toBe(true);
      const folder = drive.files.get(res.id)!;
      expect(folder.name).toBe('backups');
      expect(folder.appProperties?.[FOLDER_ROLE_PROPERTY]).toBe(
        FOLDER_ROLE_VALUE,
      );
    });

    it('reuses the stored folder and does not create duplicates', async () => {
      const drive = new FakeDrive();
      const existing = drive.addFolder('backups');
      const res = await client(drive).ensureFolder('backups', existing.id);
      expect(res).toEqual({ id: existing.id, created: false, renamed: false });
      expect(drive.files.size).toBe(1);
    });

    it('renames the stored folder in place when the configured name changes', async () => {
      const drive = new FakeDrive();
      const existing = drive.addFolder('old-name');
      drive.addBackup(existing.id, 'a.sgbk');
      const res = await client(drive).ensureFolder('new-name', existing.id);
      expect(res).toEqual({ id: existing.id, created: false, renamed: true });
      expect(drive.files.get(existing.id)!.name).toBe('new-name');
      expect(drive.files.size).toBe(2); // nothing created or deleted
    });

    it('finds an existing app folder by name when the stored id is gone', async () => {
      const drive = new FakeDrive();
      const existing = drive.addFolder('backups');
      const res = await client(drive).ensureFolder('backups', 'missing-id');
      expect(res.id).toBe(existing.id);
      expect(res.created).toBe(false);
    });

    it('ignores folders that were not created by the app', async () => {
      const drive = new FakeDrive();
      const foreign = drive.addFolder('backups', false);
      const res = await client(drive).ensureFolder('backups', foreign.id);
      expect(res.id).not.toBe(foreign.id);
      expect(res.created).toBe(true);
    });
  });

  describe('uploadResumable', () => {
    it('uploads in aligned chunks and verifies size + md5', async () => {
      const drive = new FakeDrive();
      const data = randomBytes(CHUNK * 2 + 12345);
      const res = await client(drive).uploadResumable(
        chunks(data),
        params('f1'),
      );
      expect(res.sizeBytes).toBe(data.length);
      expect(res.md5).toBe(createHash('md5').update(data).digest('hex'));
      expect(drive.files.get(res.id)!.data!.equals(data)).toBe(true);
      // Memory bound: no single request body exceeds one chunk.
      expect(Math.max(...drive.putBodySizes)).toBeLessThanOrEqual(CHUNK);
      expect(drive.putBodySizes.slice(0, -1).every((n) => n === CHUNK)).toBe(
        true,
      );
    });

    it('resumes after a 503 on a chunk', async () => {
      const drive = new FakeDrive();
      drive.putFaults = [undefined as never, { kind: 'status', status: 503 }];
      const data = randomBytes(CHUNK * 3 + 7);
      const res = await client(drive).uploadResumable(
        chunks(data),
        params('f1'),
      );
      expect(drive.files.get(res.id)!.data!.equals(data)).toBe(true);
    });

    it('resumes from the offset Drive confirms after a dropped connection', async () => {
      const drive = new FakeDrive();
      // Drive keeps the first 1000 bytes of chunk 2, then the connection drops.
      drive.putFaults = [
        undefined as never,
        { kind: 'network', storeBytes: 1000 },
      ];
      const data = randomBytes(CHUNK * 2 + 99);
      const res = await client(drive).uploadResumable(
        chunks(data),
        params('f1'),
      );
      expect(drive.files.get(res.id)!.data!.equals(data)).toBe(true);
    });

    it('fails after exhausting retries and cancels the session', async () => {
      const drive = new FakeDrive();
      drive.putFaults = Array.from({ length: 10 }, () => ({
        kind: 'status' as const,
        status: 500,
      }));
      await expect(
        client(drive).uploadResumable(chunks(randomBytes(1000)), params('f1')),
      ).rejects.toThrow(DriveApiError);
      expect([...drive.sessions.values()][0].cancelled).toBe(true);
      expect(drive.files.size).toBe(0);
    });

    it('deletes the uploaded file when verification fails', async () => {
      const drive = new FakeDrive();
      drive.putFaults = [{ kind: 'corrupt' }];
      await expect(
        client(drive).uploadResumable(chunks(randomBytes(5000)), params('f1')),
      ).rejects.toThrow(/verification/);
      expect(drive.files.size).toBe(0);
    });

    it('cancels the session when aborted mid-stream', async () => {
      const drive = new FakeDrive();
      const controller = new AbortController();
      async function* slow() {
        await Promise.resolve();
        yield randomBytes(CHUNK + 10);
        controller.abort(new Error('lock lost'));
        yield randomBytes(10);
      }
      await expect(
        client(drive).uploadResumable(slow(), params('f1', controller.signal)),
      ).rejects.toThrow('lock lost');
      expect([...drive.sessions.values()][0].cancelled).toBe(true);
      expect(drive.files.size).toBe(0);
    });

    it('propagates a source stream error without leaving a file', async () => {
      const drive = new FakeDrive();
      async function* broken() {
        await Promise.resolve();
        yield randomBytes(100);
        throw new Error('encryption finalization failed');
      }
      await expect(
        client(drive).uploadResumable(broken(), params('f1')),
      ).rejects.toThrow('encryption finalization failed');
      expect(drive.files.size).toBe(0);
    });

    it('does not retry client errors and sanitizes their message', async () => {
      const drive = new FakeDrive();
      drive.startFaults = [{ kind: 'status', status: 403 }];
      const err = await client(drive)
        .uploadResumable(chunks(randomBytes(10)), params('f1'))
        .catch((e: DriveApiError) => e);
      expect(err).toBeInstanceOf(DriveApiError);
      expect((err as DriveApiError).status).toBe(403);
      expect((err as Error).message).not.toContain('leaked');
      expect(drive.requests.filter((r) => r.method === 'POST')).toHaveLength(1);
    });

    it('rejects a misaligned chunk size', () => {
      expect(
        () =>
          new GoogleDriveClient(
            { getAccessToken: () => Promise.resolve('t') },
            { chunkSize: 1000 },
          ),
      ).toThrow(/256 KiB/);
    });
  });

  describe('listing and deletion', () => {
    it('lists every page, scoped to the backup folder and backup files', async () => {
      const drive = new FakeDrive();
      const folder = drive.addFolder('backups');
      const other = drive.addFolder('elsewhere');
      for (let i = 0; i < 5; i++) drive.addBackup(folder.id, `b${i}.sgbk`);
      drive.addBackup(other.id, 'not-in-folder.sgbk');
      drive.files.set('stray', {
        id: 'stray',
        name: 'notes.txt',
        parents: [folder.id],
        appProperties: {},
      });

      const files = await client(drive).listBackups(folder.id);
      expect(files.map((f) => f.name).sort()).toEqual([
        'b0.sgbk',
        'b1.sgbk',
        'b2.sgbk',
        'b3.sgbk',
        'b4.sgbk',
      ]);
      const listCalls = drive.requests.filter(
        (r) => r.url.includes('in+parents') || r.url.includes('in%20parents'),
      );
      expect(listCalls.length).toBe(3); // 5 files at 2 per page
    });

    it('gives up on a request that hangs and retries it', async () => {
      const drive = new FakeDrive();
      let calls = 0;
      const hangOnce = (
        url: string | URL | Request,
        init?: RequestInit,
      ): Promise<Response> => {
        calls++;
        if (calls > 1) return drive.fetch(url, init);
        // Never answers: only the timeout can end it.
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          ),
        );
      };
      const c = new GoogleDriveClient(
        { getAccessToken: () => Promise.resolve('test-token') },
        {
          fetchImpl: hangOnce,
          maxRetries: 3,
          sleep: () => Promise.resolve(),
          requestTimeoutMs: 20,
        },
      );
      await expect(c.deleteFile('gone')).resolves.toBeUndefined();
      expect(calls).toBe(2);
    });

    it('treats deleting an already-deleted file as success', async () => {
      const drive = new FakeDrive();
      await expect(client(drive).deleteFile('gone')).resolves.toBeUndefined();
    });

    it('testConnection is read-only', async () => {
      const drive = new FakeDrive();
      const res = await client(drive).testConnection('backups');
      expect(res).toEqual({ folderId: null, folderExists: false });
      expect(drive.files.size).toBe(0);
    });
  });
});
