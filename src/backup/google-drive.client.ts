import { createHash } from 'crypto';
import { Readable } from 'stream';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import { OAuth2Client } from 'google-auth-library';
import { sanitizeError } from './backup.types';
import {
  BACKUP_KIND_PROPERTY,
  BACKUP_KIND_VALUE,
  RetentionCandidate,
} from './retention';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_FIELDS = 'id,name,size,md5Checksum,createdTime,appProperties';

/** Marks the folder this app created for backups. */
export const FOLDER_ROLE_PROPERTY = 'sgbkRole';
export const FOLDER_ROLE_VALUE = 'backup-folder';

/** The only scope requested: files this app created or the user opened with it. */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** Resumable chunks must be multiples of 256 KiB. */
export const UPLOAD_CHUNK_ALIGNMENT = 256 * 1024;
export const DEFAULT_UPLOAD_CHUNK = 8 * 1024 * 1024;

export interface DriveFile extends RetentionCandidate {
  md5Checksum?: string;
  mimeType?: string;
  trashed?: boolean;
  parents?: string[];
}

export interface FolderOptions {
  /** `sgbkRole` the folder is tagged with (default: the backup folder). */
  role?: string;
  /** Create/look up the folder inside this parent. */
  parentId?: string;
}

export interface UploadResult {
  id: string;
  name: string;
  sizeBytes: number;
  md5: string;
}

export interface AccessTokenProvider {
  getAccessToken(): Promise<string>;
}

export class DriveApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

export interface GoogleDriveClientOptions {
  fetchImpl?: typeof fetch;
  /** Must be a multiple of 256 KiB. */
  chunkSize?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** Per-request timeout (tests). */
  requestTimeoutMs?: number;
}

/** Escapes a value for a Drive `q` string literal. */
const q = (value: string) =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const isRetryableStatus = (status: number) => status === 429 || status >= 500;

/** A Drive API call (metadata, listing, session start) gives up after this. */
export const REQUEST_TIMEOUT_MS = 60_000;
/** One upload chunk (8 MiB) gives up after this. */
export const CHUNK_TIMEOUT_MS = 5 * 60_000;

/** `signal` (if any) or a timeout, whichever fires first. */
const withTimeout = (ms: number, signal?: AbortSignal): AbortSignal =>
  signal
    ? AbortSignal.any([signal, AbortSignal.timeout(ms)])
    : AbortSignal.timeout(ms);

/**
 * Minimal Google Drive v3 client for backups (REST over `fetch`, OAuth2
 * access tokens from google-auth-library — no extra SDK dependency).
 *
 * Only ever touches the app's own backup folder and the backup files inside
 * it; with the `drive.file` scope Drive does not even expose other files.
 */
export class GoogleDriveClient {
  private readonly fetchImpl: typeof fetch;
  private readonly chunkSize: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly tokens: AccessTokenProvider,
    options: GoogleDriveClientOptions = {},
  ) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.chunkSize = options.chunkSize ?? DEFAULT_UPLOAD_CHUNK;
    if (this.chunkSize <= 0 || this.chunkSize % UPLOAD_CHUNK_ALIGNMENT !== 0) {
      throw new Error('Upload chunk size must be a multiple of 256 KiB');
    }
    this.maxRetries = options.maxRetries ?? 5;
    this.retryBaseMs = options.retryBaseMs ?? 1000;
    this.sleep =
      options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  }

  /** Builds a client from an OAuth client + refresh token (token refresh is automatic). */
  static fromOAuth(
    creds: { clientId: string; clientSecret: string; refreshToken: string },
    options?: GoogleDriveClientOptions,
  ): GoogleDriveClient {
    const oauth = new OAuth2Client({
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    oauth.setCredentials({ refresh_token: creds.refreshToken });
    return new GoogleDriveClient(
      {
        getAccessToken: async () => {
          try {
            const { token } = await oauth.getAccessToken();
            if (!token) throw new Error('empty access token');
            return token;
          } catch (err) {
            const msg = sanitizeError(err);
            throw new DriveApiError(
              /invalid_grant/i.test(msg)
                ? 'Google OAuth refresh token was rejected (invalid_grant): regenerate GDRIVE_REFRESH_TOKEN (Testing-mode consent screens expire tokens after 7 days)'
                : `Google OAuth token refresh failed: ${msg}`,
              null,
              !/invalid_grant|invalid_client|unauthorized_client/i.test(msg),
            );
          }
        },
      },
      options,
    );
  }

  // ─── low-level ─────────────────────────────────────────────────────────────

  private backoff(attempt: number): number {
    const base = this.retryBaseMs * 2 ** attempt;
    return base + Math.floor(Math.random() * Math.min(base, 1000));
  }

  private async errorFrom(res: Response, what: string): Promise<DriveApiError> {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? '';
    } catch {
      /* non-JSON body */
    }
    return new DriveApiError(
      sanitizeError(
        `${what} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`,
      ),
      res.status,
      isRetryableStatus(res.status),
    );
  }

  /**
   * One authenticated request with retries on network errors, timeouts,
   * 429 and 5xx (exponential backoff). Only the wait for Drive's answer is
   * time-limited; a body may then stream for long (Node's fetch aborts one
   * that stalls for 5 minutes). `accept` can reject a 2xx answer as a
   * (retryable) error. A 404 is returned as is when `allow404`.
   */
  private async send(
    what: string,
    request: (token: string) => { url: string; init?: RequestInit },
    opts: {
      signal?: AbortSignal;
      allow404?: boolean;
      accept?: (res: Response) => DriveApiError | null;
    } = {},
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      const opening = new AbortController();
      const timer = setTimeout(
        () => opening.abort(new Error('Drive did not answer in time')),
        this.requestTimeoutMs,
      );
      try {
        const { url, init } = request(await this.tokens.getAccessToken());
        res = await this.fetchImpl(url, {
          ...init,
          signal: opts.signal
            ? AbortSignal.any([opts.signal, opening.signal])
            : opening.signal,
        });
      } catch (err) {
        const retryable = !(err instanceof DriveApiError) || err.retryable;
        if (opts.signal?.aborted || !retryable || attempt >= this.maxRetries) {
          throw err instanceof DriveApiError
            ? err
            : new DriveApiError(
                `${what} failed: ${sanitizeError(err)}`,
                null,
                true,
              );
        }
        await this.sleep(this.backoff(attempt));
        continue;
      } finally {
        clearTimeout(timer);
      }
      if (opts.allow404 && res.status === 404) return res;
      const error = res.ok
        ? (opts.accept?.(res) ?? null)
        : await this.errorFrom(res, what);
      if (!error) return res;
      if (!error.retryable || attempt >= this.maxRetries) throw error;
      await this.sleep(this.backoff(attempt));
    }
  }

  /** Authenticated JSON request (see {@link send}). Null for 204 or an allowed 404. */
  private async api<T>(
    method: string,
    url: string,
    what: string,
    body?: unknown,
    allow404 = false,
  ): Promise<T | null> {
    const res = await this.send(
      what,
      (token) => ({
        url,
        init: {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined && {
              'Content-Type': 'application/json; charset=UTF-8',
            }),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
      }),
      { allow404 },
    );
    if (res.status === 204 || res.status === 404) return null;
    return (await res.json()) as T;
  }

  // ─── folder ────────────────────────────────────────────────────────────────

  private async getFile(id: string): Promise<DriveFile | null> {
    return this.api<DriveFile>(
      'GET',
      `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed,appProperties`,
      'Read backup folder',
      undefined,
      true,
    );
  }

  private isOurFolder(
    file: DriveFile | null,
    role = FOLDER_ROLE_VALUE,
  ): file is DriveFile {
    return (
      !!file &&
      !file.trashed &&
      file.mimeType === FOLDER_MIME &&
      file.appProperties?.[FOLDER_ROLE_PROPERTY] === role
    );
  }

  /** App-created folders with this name and role (optionally inside a parent), oldest first. */
  async findFolders(
    name: string,
    opts: FolderOptions = {},
  ): Promise<DriveFile[]> {
    const role = opts.role ?? FOLDER_ROLE_VALUE;
    const query = [
      `mimeType=${q(FOLDER_MIME)}`,
      'trashed=false',
      `name=${q(name)}`,
      `appProperties has { key=${q(FOLDER_ROLE_PROPERTY)} and value=${q(role)} }`,
      ...(opts.parentId ? [`${q(opts.parentId)} in parents`] : []),
    ].join(' and ');
    const res = await this.api<{ files?: DriveFile[] }>(
      'GET',
      `${DRIVE_API}/files?spaces=drive&orderBy=createdTime&pageSize=10&fields=files(id,name,createdTime,appProperties)&q=${encodeURIComponent(query)}`,
      'Search backup folder',
    );
    return res?.files ?? [];
  }

  /**
   * Returns the id of the app-owned backup folder, reusing `storedId` when it
   * is still ours (renaming it if the configured name changed, so existing
   * backups stay in place), else an existing folder with that name, else a
   * new one. Never deletes or moves anything. Callers serialize this (lock).
   */
  async ensureFolder(
    name: string,
    storedId?: string,
    opts: FolderOptions = {},
  ): Promise<{ id: string; created: boolean; renamed: boolean }> {
    const role = opts.role ?? FOLDER_ROLE_VALUE;
    if (storedId) {
      const current = await this.getFile(storedId);
      if (this.isOurFolder(current, role)) {
        if (current.name === name) {
          return { id: current.id, created: false, renamed: false };
        }
        await this.api(
          'PATCH',
          `${DRIVE_API}/files/${encodeURIComponent(current.id)}?fields=id,name`,
          'Rename backup folder',
          { name },
        );
        return { id: current.id, created: false, renamed: true };
      }
    }
    const [existing] = await this.findFolders(name, opts);
    if (existing) return { id: existing.id, created: false, renamed: false };

    const created = await this.api<DriveFile>(
      'POST',
      `${DRIVE_API}/files?fields=id,name`,
      'Create backup folder',
      {
        name,
        mimeType: FOLDER_MIME,
        appProperties: { [FOLDER_ROLE_PROPERTY]: role },
        ...(opts.parentId && { parents: [opts.parentId] }),
      },
    );
    if (!created?.id) {
      throw new DriveApiError(
        'Create backup folder returned no id',
        null,
        true,
      );
    }
    return { id: created.id, created: true, renamed: false };
  }

  /** Verifies authentication and whether the backup folder is reachable. Read-only. */
  async testConnection(
    folderName: string,
    storedId?: string,
  ): Promise<{ folderId: string | null; folderExists: boolean }> {
    await this.tokens.getAccessToken();
    if (storedId) {
      const current = await this.getFile(storedId);
      if (this.isOurFolder(current)) {
        return { folderId: current.id, folderExists: true };
      }
    }
    const [existing] = await this.findFolders(folderName);
    return { folderId: existing?.id ?? null, folderExists: !!existing };
  }

  // ─── files ─────────────────────────────────────────────────────────────────

  /** Every database backup file this app uploaded into `folderId` (all pages). */
  async listBackups(folderId: string): Promise<DriveFile[]> {
    return this.listFiles(folderId, BACKUP_KIND_VALUE);
  }

  /** Every file of this app's `kind` (sgbkKind) directly inside `folderId`. */
  async listFiles(folderId: string, kind: string): Promise<DriveFile[]> {
    const query = [
      `${q(folderId)} in parents`,
      'trashed=false',
      `appProperties has { key=${q(BACKUP_KIND_PROPERTY)} and value=${q(kind)} }`,
    ].join(' and ');
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const res = await this.api<{
        files?: DriveFile[];
        nextPageToken?: string;
      }>(
        'GET',
        `${DRIVE_API}/files?spaces=drive&pageSize=1000&fields=nextPageToken,files(${FILE_FIELDS})&q=${encodeURIComponent(query)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
        'List backups',
      );
      files.push(...(res?.files ?? []));
      pageToken = res?.nextPageToken;
    } while (pageToken);
    return files;
  }

  /**
   * Streams a file's content. Retries opening the download on 429/5xx and
   * network errors; a failure mid-stream surfaces to the consumer.
   */
  async downloadFile(
    id: string,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<Buffer>> {
    const res = await this.send(
      'Download',
      (token) => ({
        url: `${DRIVE_API}/files/${encodeURIComponent(id)}?alt=media`,
        init: { headers: { Authorization: `Bearer ${token}` } },
      }),
      {
        signal,
        accept: (r) =>
          r.body
            ? null
            : new DriveApiError('Download returned no body', r.status, true),
      },
    );
    return Readable.fromWeb(res.body as WebReadableStream<Uint8Array>);
  }

  /**
   * A file's metadata, but only when it is inside one of the `allowed`
   * folders with the matching `sgbkKind` and not trashed — so ids sent by
   * a browser can never reach other files. Null otherwise.
   */
  async getBackupFile(
    id: string,
    allowed: { folderId: string; kind: string }[],
  ): Promise<DriveFile | null> {
    const file = await this.api<DriveFile>(
      'GET',
      `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS},parents,trashed`,
      'Read backup file',
      undefined,
      true,
    );
    if (!file || file.trashed) return null;
    const kind = file.appProperties?.[BACKUP_KIND_PROPERTY];
    const ok = allowed.some(
      (a) => a.kind === kind && (file.parents ?? []).includes(a.folderId),
    );
    return ok ? file : null;
  }

  /** Sets (merges) app properties of a file this app created. */
  async setAppProperties(
    id: string,
    appProperties: Record<string, string>,
  ): Promise<void> {
    await this.api(
      'PATCH',
      `${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id`,
      'Update backup file properties',
      { appProperties },
    );
  }

  /** Permanently deletes a file. A file that is already gone counts as deleted. */
  async deleteFile(id: string): Promise<void> {
    await this.api(
      'DELETE',
      `${DRIVE_API}/files/${encodeURIComponent(id)}`,
      'Delete backup',
      undefined,
      true,
    );
  }

  // ─── resumable upload ──────────────────────────────────────────────────────

  private async startSession(
    name: string,
    folderId: string,
    appProperties: Record<string, string>,
  ): Promise<string> {
    const res = await this.send(
      'Start upload',
      (token) => ({
        url: `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=${FILE_FIELDS}`,
        init: {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': 'application/octet-stream',
          },
          body: JSON.stringify({
            name,
            parents: [folderId],
            mimeType: 'application/octet-stream',
            appProperties,
          }),
        },
      }),
      {
        accept: (r) =>
          r.headers.get('location')
            ? null
            : new DriveApiError(
                'Start upload returned no session URI',
                r.status,
                true,
              ),
      },
    );
    return res.headers.get('location')!;
  }

  /** Bytes Drive has persisted for the session, or the finished file. */
  private async querySession(
    sessionUri: string,
    total: string,
    signal?: AbortSignal,
  ): Promise<{ offset: number } | { file: DriveFile }> {
    const res = await this.fetchImpl(sessionUri, {
      method: 'PUT',
      headers: { 'Content-Range': `bytes */${total}` },
      redirect: 'manual',
      signal: withTimeout(this.requestTimeoutMs, signal),
    });
    if (res.status === 200 || res.status === 201) {
      return { file: (await res.json()) as DriveFile };
    }
    if (res.status === 308) return { offset: parseRangeEnd(res) };
    throw await this.errorFrom(res, 'Query upload session');
  }

  /**
   * Sends bytes [start, start + data.length) of the upload. `total` is the
   * final file size on the last chunk, null before that. Resumes from the
   * offset Drive confirms after a network error, 5xx or 429. Returns the file
   * metadata once Drive reports the upload complete.
   */
  private async putChunk(
    sessionUri: string,
    data: Buffer,
    start: number,
    total: number | null,
    signal?: AbortSignal,
  ): Promise<DriveFile | null> {
    const end = start + data.length;
    const totalStr = total === null ? '*' : String(total);
    let sent = start;

    for (let attempt = 0; ;) {
      signal?.throwIfAborted();
      const slice = data.subarray(sent - start);
      let res: Response | null = null;
      try {
        res = await this.fetchImpl(sessionUri, {
          method: 'PUT',
          headers: {
            'Content-Range':
              slice.length > 0
                ? `bytes ${sent}-${end - 1}/${totalStr}`
                : `bytes */${totalStr}`,
          },
          body: slice as unknown as BodyInit,
          redirect: 'manual',
          signal: withTimeout(CHUNK_TIMEOUT_MS, signal),
        });
      } catch (err) {
        if (signal?.aborted) throw err;
        res = null;
      }

      if (res && (res.status === 200 || res.status === 201)) {
        if (total === null) {
          throw new DriveApiError(
            'Drive finished the upload early',
            res.status,
            false,
          );
        }
        return (await res.json()) as DriveFile;
      }
      if (res && res.status === 308) {
        const confirmed = parseRangeEnd(res);
        if (confirmed >= end && total === null) return null;
        if (confirmed < start) {
          throw new DriveApiError(
            'Drive lost bytes from an earlier chunk; upload cannot resume',
            308,
            true,
          );
        }
        if (confirmed > sent) {
          sent = confirmed; // partial progress; send the rest without counting a failure
          continue;
        }
      } else if (res && !isRetryableStatus(res.status)) {
        // 404/410: the session expired; anything else is a client error.
        throw await this.errorFrom(res, 'Upload chunk');
      }

      if (attempt++ >= this.maxRetries) {
        throw new DriveApiError(
          `Upload chunk failed after ${this.maxRetries} retries${res ? ` (HTTP ${res.status})` : ''}`,
          res?.status ?? null,
          true,
        );
      }
      await this.sleep(this.backoff(attempt - 1));
      const state = await this.querySession(sessionUri, totalStr, signal);
      if ('file' in state) {
        if (total === null) {
          throw new DriveApiError(
            'Drive finished the upload early',
            200,
            false,
          );
        }
        return state.file;
      }
      if (state.offset < start) {
        throw new DriveApiError(
          'Drive lost bytes from an earlier chunk; upload cannot resume',
          308,
          true,
        );
      }
      if (state.offset >= end && total === null) return null;
      sent = Math.min(state.offset, end);
    }
  }

  private async cancelSession(sessionUri: string): Promise<void> {
    try {
      await this.fetchImpl(sessionUri, {
        method: 'DELETE',
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch {
      /* best effort: an unfinished session expires on its own */
    }
  }

  /**
   * Streams `source` to a new file in `folderId` with Drive's resumable
   * protocol, holding at most one chunk (+ one incoming read) in memory.
   * Succeeds only after Drive's size and MD5 match what was sent; on any
   * failure the session is cancelled and a created-but-unverified file is
   * deleted, so no partial backup is left behind.
   */
  async uploadResumable(
    source: AsyncIterable<Buffer>,
    params: {
      name: string;
      folderId: string;
      appProperties: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<UploadResult> {
    const { signal } = params;
    signal?.throwIfAborted();
    const sessionUri = await this.startSession(
      params.name,
      params.folderId,
      params.appProperties,
    );
    const md5 = createHash('md5');
    let total = 0;
    let offset = 0;
    let pending: Buffer[] = [];
    let pendingLength = 0;
    let file: DriveFile | null = null;

    try {
      for await (const chunk of source) {
        signal?.throwIfAborted();
        md5.update(chunk);
        total += chunk.length;
        pending.push(chunk);
        pendingLength += chunk.length;
        while (pendingLength > this.chunkSize) {
          const all = Buffer.concat(pending, pendingLength);
          await this.putChunk(
            sessionUri,
            all.subarray(0, this.chunkSize),
            offset,
            null,
            signal,
          );
          offset += this.chunkSize;
          const rest = Buffer.from(all.subarray(this.chunkSize));
          pending = [rest];
          pendingLength = rest.length;
        }
      }
      signal?.throwIfAborted();
      if (total === 0) {
        throw new DriveApiError(
          'Refusing to upload an empty backup',
          null,
          false,
        );
      }
      file = await this.putChunk(
        sessionUri,
        Buffer.concat(pending, pendingLength),
        offset,
        total,
        signal,
      );
      if (!file?.id) {
        throw new DriveApiError(
          'Upload finished without a file id',
          null,
          true,
        );
      }
      const digest = md5.digest('hex');
      if (Number(file.size) !== total || file.md5Checksum !== digest) {
        throw new DriveApiError(
          `Uploaded file failed verification (size ${file.size} vs ${total}, md5 ${file.md5Checksum === digest ? 'ok' : 'mismatch'})`,
          null,
          true,
        );
      }
      return { id: file.id, name: file.name, sizeBytes: total, md5: digest };
    } catch (err) {
      await this.cancelSession(sessionUri);
      if (file?.id) {
        await this.deleteFile(file.id).catch(() => undefined);
      }
      throw err;
    }
  }
}

/** `Range: bytes=0-N` → N + 1 bytes persisted; no header → 0. */
function parseRangeEnd(res: Response): number {
  const range = res.headers.get('range');
  const match = range?.match(/bytes=0-(\d+)/);
  return match ? Number(match[1]) + 1 : 0;
}
