# Database Backups → Google Drive

Automatic, encrypted MongoDB backups made by the API itself (no `mongodump`, no
hosting or Atlas backup features) and uploaded to a dedicated Google Drive folder,
together with the local `uploads` folder (images, order attachments).

```
BullMQ job scheduler "db-backup"  (cron + store timezone, from admin settings)
        ↓   Redis lock: one backup at a time across all instances
MongoDB snapshot session → canonical EJSON NDJSON → gzip → AES-256-GCM → Drive resumable upload
        ↓   only after Drive's size + MD5 match
uploads folder → new/changed files as encrypted blobs + one manifest per backup
        ↓
retention (keep ≥ 4 newest, delete older than N days)   →   alert email if all 3 attempts fail
```

Code: `src/backup/`. Admin UI: **Dashboard → Backups** (`/dashboard/backups`).

Arabic step-by-step setup guide (from creating the Google Cloud project to restoring): [BACKUP_AR.md](./BACKUP_AR.md).

---

## 1. One-time setup

### 1.1 Google Cloud project and Drive API
1. <https://console.cloud.google.com> → create (or pick) a project.
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **APIs & Services → OAuth consent screen**
   - User type: *External* (a personal Gmail) or *Internal* (Google Workspace).
   - Add the scope `https://www.googleapis.com/auth/drive.file` only.
     It lets the app see and manage **only the files it creates** — never the rest
     of your Drive.
   - **Publishing status:** while the app is in **Testing**, Google expires refresh
     tokens of external users after **7 days** and backups stop. Click
     **Publish app** (In production) before generating the token. `drive.file` is a
     non-sensitive scope, so publishing normally needs no verification, but Google
     may still show an "unverified app" screen or apply other limits — publishing
     alone is not a guarantee.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID →
   Desktop app.** Copy the client ID and secret.

### 1.2 Encryption key
```bash
cd server
npm run backup:keygen
```
Put `BACKUP_ENCRYPTION_KEY=…` in `server/.env` **and** store the key in a password
manager / secrets vault **outside the server and outside Google Drive**.
A backup whose key is lost cannot be restored by anyone. Keeping the key next to
the backups (Drive) or only on the server defeats the encryption or loses it with
the server.

### 1.3 Refresh token (run on your own computer)
```bash
cd server
# GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET must be in server/.env (or exported)
npm run backup:auth
```
Open the printed URL, sign in with the Google account that should own the
backups, approve. The script prints `GDRIVE_REFRESH_TOKEN=…` once (never written
to disk). Copy it to the server's environment.

### 1.4 Environment variables (`server/.env`)
| Variable | Required | Notes |
|---|---|---|
| `BACKUP_ENABLED` | – | Server master switch (`true`/`false`, default `false`). |
| `BACKUP_ENCRYPTION_KEY` | when enabled | base64 of 32 bytes. **Secret.** |
| `GDRIVE_CLIENT_ID` | when enabled | OAuth client (Desktop app). |
| `GDRIVE_CLIENT_SECRET` | when enabled | **Secret.** |
| `GDRIVE_REFRESH_TOKEN` | when enabled | From `npm run backup:auth`. **Secret.** |
| `BACKUP_ALERT_EMAIL` | – | Failure alerts; defaults to `ADMIN_EMAIL`. |
| `BACKUP_RETENTION_DAYS` | – | Default retention until an admin saves one (14). |
| `BACKUP_TIMEZONE` | – | Only used when the store address gives no timezone (`Asia/Riyadh`). |
| `BACKUP_CRON` | – | Ops/dev override of the admin schedule. Leave empty in production. |
| `BACKUP_FOLDER_NAME` | – | Initial Drive folder name (`skygalaxy-db-backups`). |
| `BACKUP_BATCH_SIZE` | – | Documents per cursor batch (1000). Fewer round trips to MongoDB; memory stays bounded by one batch. |
| `BACKUP_READ_PREFERENCE` | – | `secondaryPreferred` (default) … see §5. |
| `BACKUP_ALLOW_NON_SNAPSHOT` | – | `false`. See §5 before changing. |
| `BACKUP_TEST_RESTORE_TTL_HOURS` | – | `24`. The test-restore database (a full copy of the store's data) is dropped automatically this long after it was made; `0` keeps it until deleted by hand. |
| `BACKUP_WORKER_ENABLED` | – | `true`. Set `false` on API instances when another instance (same code and variables) is dedicated to running backups, so exports, compression and uploads never compete with the store. At least one instance must keep `true` (the watchdog alerts otherwise). |
| `BACKUP_DECRYPTION_KEYS` | – | Old keys after a rotation (comma-separated): restore, and reading old uploads manifests during retention. |
| `MONGODB_DB_NAME` | – | Database name inside `MONGODB_URI` (default `skyGalaxy`). Change it to point the app at a restored database. |
| `BACKUP_TEST_RESTORE_MAX_MB` | – | Test restores are refused when the live database is larger (default 200; empty = no limit). |
| `BACKUP_UPLOAD_MAX_MB` | – | Largest backup file/bundle the panel accepts (default 512). |

With `BACKUP_ENABLED=true` the API refuses to start if a required variable is
missing or invalid (key must decode to exactly 32 bytes, cron must be valid, …).
Secrets are never stored in the database, returned by any API or logged.

### 1.5 Permissions
Backups have their own permissions (Roles page → group "Database Backups"),
independent of the settings permissions:

| Permission | Allows |
|---|---|
| `view_backups` | open the Backups page (settings, status, list, results) |
| `manage_backup_settings` | change schedule / retention / folder, test the Drive connection |
| `run_backup` | Run backup now |
| `verify_backup` | verify a backup |
| `restore_backup_test` | restore into the test database, delete the test database |
| `restore_backup_files` | restore a backup's uploaded files into the live uploads folder |
| `download_backup` | download a backup bundle |
| `upload_backup` | upload a backup file/bundle, delete uploaded backups |

Any backup permission implies `view_backups`. **Super Admin has all of them
automatically; every other role must be granted them explicitly** — none is
given silently on update. Failure alerts go to roles holding any backup
permission (and `BACKUP_ALERT_EMAIL`).

### 1.6 Enable
Restart the API, then in **Dashboard → Backups**:
1. **Test Google Drive connection** → "Connected".
2. Turn on **Automatic backups**, choose frequency / time / retention → **Save**.
3. **Run backup now** and watch the status card; the file appears in Drive in the
   folder `skygalaxy-db-backups` (created by the app on the first backup).

---

## 2. Admin settings

| Setting | Values | Meaning |
|---|---|---|
| Automatic backups | on/off | Off removes the schedule; existing backups are kept. Turning on requires the server configuration above. |
| Backups per day | 1, 2, 3, 4, 6, 8, 12, 24 | Runs per day, evenly spaced (not files kept). |
| First backup time | HH:mm (24 h) | Start of the day's series: 03:00 × 4 → 03:00, 09:00, 15:00, 21:00. |
| Keep backups for | 7, 14, 30, 60, 90 days | Older backups are deleted, but the **4 newest trusted backups are always kept** (complete and not failed verification), plus the newest one that passed verification. |
| Drive folder name | text | Renames the same app folder in place (no duplicate, no lost backups). |

- **Timezone** is not edited here: it is derived from **Contact → Business address**
  (country, and city for countries with several zones), e.g. Saudi Arabia →
  `Asia/Riyadh`. The panel shows the zone and where it came from; if the address
  cannot be resolved, `BACKUP_TIMEZONE` is used and the panel asks you to complete
  the address. Changing the address re-applies the schedule automatically.
- **Precedence:** the saved admin settings are the source of truth.
  `BACKUP_ENABLED=false` disables everything regardless of the toggle;
  `BACKUP_CRON` (if set) overrides the times and the panel says so.
- Changes apply immediately (no restart): the BullMQ scheduler `db-backup` is
  updated in place under a cluster-wide lock, so several API instances never
  create duplicate schedules. If the scheduler update fails, the save returns an
  error instead of claiming the new schedule is active.
- **Daylight saving** (zones that have it): a scheduled time that does not exist
  on the spring-forward day runs once at the next valid time (02:30 → 03:30); a
  time that occurs twice on the fall-back day runs once (first occurrence).
  Saudi Arabia has no DST.
- Access: see the permissions table in §1.5.

---

## 3. Operations

- **Status card:** last result, last successful backup (time, size, Drive file id),
  next run, number of backups kept, last failure and its sanitized error,
  Drive connection state. It polls while a backup is running.
- **Run backup now:** queued as a BullMQ job (HTTP 202). Refused with 409 while a
  backup is running or a manual one is already queued.
- **Retries and alerts:** each job has 3 attempts with exponential backoff (1, 2 min).
  After the last failed attempt the alert email (`BACKUP_ALERT_EMAIL` /
  `ADMIN_EMAIL`) and an in-app notification are sent — once per job.
- **Watchdog** (every 30 min, each instance): re-applies the schedule if it has
  vanished from Redis (restart without persistence, eviction, new Redis), and
  alerts when the last successful backup is older than two schedule intervals
  + 1 h (measured from when backups were enabled if none succeeded yet). At most
  one such alert per 12 h across instances. It also fails checks left
  "queued"/"running" for 12 h by a crash, drops an expired test database
  (`BACKUP_TEST_RESTORE_TTL_HOURS`), and at startup removes temp files older
  than 6 h left by a crash.
- **Timeouts:** every Drive request gives up after 60 s (an upload chunk after
  5 min) and is retried; a download is limited only while waiting for Drive's
  answer, then by Node's 5-minute idle limit.
- **Maintenance mode:** the Backups API stays reachable for roles holding a
  backup permission (each route still checks its own permission).
- **Runtime:** Node.js ≥ 20.12.
- **Overlap protection:** a Redis lock (`app-<env>:lock:db-backup`, 2-minute lease
  renewed every 40 s) that records what holds it (backup, check, import). If the
  lease is lost the running operation aborts. A backup job that finds another
  backup running is recorded as *skipped* (no duplicate backup); one that finds
  a check or an upload holding the lock is postponed by 30 s (up to 1 h)
  without using an attempt. Checks wait the same way.
- **Logs:** `BackupService`, `BackupProcessor`, `BackupScheduler` — start, duration,
  per-collection counts, size, Drive file id, retention deletions, retries,
  sanitized errors. Never document contents, URIs, tokens or keys.
- **Run history:** collection `backupruns` (kept 180 days).
- **Retention** runs after the new backup was uploaded and verified; a failed
  deletion is logged and counted but never fails the backup. Only files the app
  uploaded into its own folder are ever considered. A database file is tagged
  `sgbkStatus=partial` until its uploads manifest is saved (`complete`), and
  each verification tags it `sgbkVerified=ok|failed`: partial or failed files
  never count toward the 4 kept backups (they are still kept if fewer than 4
  trusted ones exist).
- **Temp file:** the encrypted export is written to `<os temp>/sgbk-spool`
  (ciphertext only, removed afterwards) and uploaded from there, so the snapshot
  read lasts only as long as the export itself — not as long as the upload.
  Needs free disk space about the size of one encrypted backup.

### Uploaded files (local `uploads` folder)
Every backup run also saves the uploads folder (`UPLOADS_ROOT`; product images,
brand logos, order attachments, avatars…). Media stored on Cloudinary is not
local and is not part of it; if there is no local folder this step is skipped.

- **Incremental:** each distinct file content is stored once in the Drive
  subfolder `uploads-blobs` as an encrypted *blob*, named by a keyed hash
  (HMAC) of its content. A run only uploads new or changed files.
- **Manifest:** each backup writes `skygalaxy-<backupId>.uploads.sgbk` next to the
  database file: the encrypted list of every file (path → blob) at that moment.
  Restoring a backup's uploads = its manifest + the blobs it lists.
- **All-or-nothing:** a run is successful only when the database file **and** the
  uploads manifest are saved. If the uploads step fails, the run is marked failed
  and retried (the already-saved database file stays valid).
- **Retention:** a manifest is deleted with its database backup; a blob is
  deleted only when no remaining manifest references it and it is older than a
  day. If any remaining manifest cannot be read, no blob is deleted.
- Files are encrypted with the same key as the database (orders and users may
  contain personal data). Files are streamed (constant memory, any size up to
  2 GiB); larger files are left out of the backup with a warning instead of
  failing it. A file that changes while it is uploaded is re-read, so a blob's
  content always matches its id and the manifest records the size that was
  actually saved.
- Collections `backupuploadindex` (skip re-hashing unchanged files) and
  `backupuploadmanifests` (blob lists for retention) are caches only.

### Backups page (verify, test restore, download, upload)
- **Available backups** lists every backup in Drive: scheduled, manual, and
  uploaded from a device, with size, documents, files and a verification badge.
- **Automatic verification:** right after each backup, the server decrypts and
  validates the whole database file and checks that every uploaded file it
  lists exists. It reads the local copy that was just uploaded — Drive's MD5 of
  the stored file must equal it, which proves the bytes in Drive are the same —
  instead of downloading it again (Drive is read if the MD5 differs). A failure
  sends the alert ("created but failed verification"); the backup job itself is
  not retried. Manual **Verify** always reads from Drive.
- **Speed:** documents are read 1000 per round trip (`BACKUP_BATCH_SIZE`), Drive
  listings fetch up to 1000 files per page, and new uploaded files are sent 4
  at a time.
- **Verify** (manual): the same, plus every uploaded file is decrypted and
  checked against its id. Read-only.
- **Restore to test database:** restores the backup into `<MONGODB_DB_NAME>_restore`
  (e.g. `skyGalaxy_restore`) — **never the live database** — after verifying the
  whole file first. The report compares, per collection, the backup, the restored
  copy and the live data now (differences = what switching would lose). Only one
  test copy exists at a time (a new one replaces it); **Delete test database**
  frees the space. Refused when the live database is larger than
  `BACKUP_TEST_RESTORE_MAX_MB` — on Atlas M0 (512 MB) a test copy doubles usage.
  **Never switch the store to the test copy**: the panel replaces and deletes it.
  To switch to a backup, restore it with the CLI into a new database (e.g.
  `--db skyGalaxy_20261012_0300`: the live name + the backup's date and time
  in UTC, as the panel suggests), set `MONGODB_DB_NAME` to it and restart (§4).
  As a safety net every API instance marks the database it runs on (collection
  `__sgbk_live`, never exported in backups); the panel refuses to replace or
  delete a test database carrying that mark and shows a warning instead.
- **Restore files:** restores a backup's uploaded files into the live uploads
  folder (`UPLOADS_ROOT` of the server running the job) with the CLI's options:
  *preview* (writes nothing), *restore missing files* (existing different files
  are left untouched and listed as conflicts), *restore and replace* (also
  replaces different files; needs an explicit confirmation). Nothing is ever
  deleted; identical files are skipped; every file is verified before an atomic
  write. Requires `restore_backup_files`. Existing files are compared by their
  keyed id locally (no download), so a preview downloads nothing (it does not
  check blob contents — use **Verify** for that). A corrupt or unreadable file
  in Drive is reported as *failed* and the other files are still restored.
- **List cache:** the Drive part of the list is reused for 20 s (the page polls
  while checks run); the refresh button and any change (backup, upload, delete)
  read Drive again.
- **Download:** one file `skygalaxy-<backupId>.backup.tar` containing
  `README.txt`, the database file, its uploads manifest and **only the uploaded
  files that backup lists** (`uploads-blobs/…`). Everything inside is copied from
  Drive as-is — still encrypted, useless without the key, safe to keep offline.
  The panel requests a one-time link (60 s, single use; only a hash of the token
  is stored) and the browser's download manager streams it to disk. If a listed
  file is missing in Drive the download is refused (409) rather than incomplete.
- **Upload:** accepts a `.sgbk` database file or a `.backup.tar` bundle. Before
  anything reaches Drive the server checks the header, that the key is one it
  has (`BACKUP_ENCRYPTION_KEY` / `BACKUP_DECRYPTION_KEYS`), and decrypts every
  bundled file against its id. Imports go to the Drive subfolder
  `manual-uploads` (never touched by retention), are verified automatically, and
  can be deleted from the panel. The request returns as soon as the file is
  received and checked (bad files fail at once); sending it to Drive runs in
  the background (waiting for a running backup if needed) and the panel follows
  its progress. The temporary copy on the server is always removed. A reverse proxy in front of the API may limit request size
  (nginx `client_max_body_size`, hosting panels): raise it to match
  `BACKUP_UPLOAD_MAX_MB` or uploads fail with HTTP 413.

---

## 4. Restore

1. Get the backup: the `.backup.tar` bundle from **Dashboard → Backups → Download**,
   or the `skygalaxy-….sgbk` file from the Drive folder. Both work below.
2. On a machine with the key (and Node 22+):
```bash
cd server
npm install && npm run build            # the restore script uses the compiled code
# verify only (decrypt + authenticate + completeness), writes nothing:
npm run backup:restore -- ./skygalaxy-2026-10-12T03-00-00Z-ab12cd.sgbk --verify-only
# restore into a NEW, separate database:
npm run backup:restore -- ./skygalaxy-2026-10-12T03-00-00Z-ab12cd.sgbk \
  "mongodb://localhost:27017" --db skyGalaxy_restore_test
```
- The whole file is verified **before anything is written**: wrong key, modified
  or truncated files and incomplete exports are rejected.
- A non-empty target database is refused. To replace one:
  `--drop --confirm <exact database name>`.
- Restoring into the live database on the production cluster (`MONGODB_URI`
  hosts + the backup's source db or `MONGODB_DB_NAME`) is always refused.
- `--drop` also refuses any database an API instance has run on (live marker
  `__sgbk_live`), whatever the URI looks like. To deliberately replace an old,
  no longer used live database add `--overwrite-live`.
- The target URI is never printed. Keys come from `BACKUP_ENCRYPTION_KEY` and
  `BACKUP_DECRYPTION_KEYS` (env or `server/.env`).
- Restored: documents (all BSON types), collection options (validators,
  collation, capped, time-series, clustered), views, all secondary indexes. Counts
  are compared per collection at the end.
- Then point a test instance of the API at the restored database, check it, and
  only then switch production: `MONGODB_URI` (server/cluster) and
  `MONGODB_DB_NAME` (database), then restart.

### 4.1 Restore the uploaded files
From a downloaded bundle — **offline**, no Google access needed:
```bash
npm run backup:restore-uploads -- --from-bundle ./skygalaxy-<id>.backup.tar --target ./uploads
```
Or straight from Drive (needs the `GDRIVE_*` credentials and the key in the env):
```bash
npm run backup:restore-uploads -- --list                   # backups, newest first
npm run backup:restore-uploads -- --target ./uploads --dry-run
npm run backup:restore-uploads -- --target ./uploads --backup <backupId>   # or latest
```
- Use the **same backup id** as the database restore (the id is in the file
  name `skygalaxy-<backupId>.sgbk`) so files and data match. Default: latest.
- `--target` = the new server's `UPLOADS_ROOT`.
- Every file is decrypted and checked against its id before it is written
  (atomically). Existing identical files are kept; different existing files are
  reported as conflicts and only replaced with `--overwrite`. Missing blobs or
  conflicts make the command exit with an error after listing them.

### 4.2 Scenarios
**Data damaged on Atlas (same cluster).** Restoring over the live database is
refused. Restore into a new name, then switch:
```bash
# name = live name + backup date/time (UTC): clearly not the test database
npm run backup:restore -- ./skygalaxy-<id>.sgbk "<atlas URI>" --db skyGalaxy_20261012_0300
# server/.env: MONGODB_DB_NAME=skyGalaxy_20261012_0300   → restart the API
```
(or restore into a new cluster under the normal name and change `MONGODB_URI`.)

**Moving to a VPS with a local MongoDB.**
1. Install MongoDB **as a replica set** (one member is fine): the app uses
   transactions and backups use snapshot reads — neither works on a standalone
   server. `mongod.conf`: `replication.replSetName: rs0`, `net.bindIp: 127.0.0.1`,
   `security.authorization: enabled`; then `rs.initiate()` once and create a user.
2. Turn on maintenance mode, click **Run backup now**, wait for success (no
   data written after it is lost).
3. On the VPS: `npm run backup:restore -- <file> "mongodb://user:pass@127.0.0.1:27017/?replicaSet=rs0&authSource=admin" --db skyGalaxy`
   and `npm run backup:restore-uploads -- --target <UPLOADS_ROOT> --backup <same id>`.
4. Set `MONGODB_URI` (and `MONGODB_DB_NAME` if not `skyGalaxy`), start the API,
   check, turn maintenance off. Keep Atlas a few days before deleting it.
   Backups continue from the VPS to the same Drive folder.

**Server lost?** Nothing needed lives on the server: the latest backup and its
uploads are in Drive, the key is in your password manager. Restore the database
and the uploads on a new server as above and deploy the API with the same env.

---

## 5. Consistency model and limits

- All collections are read in **one snapshot session** (`readConcern: snapshot`,
  same cluster time), so a backup is a point-in-time copy even while orders are
  being written. Each collection's exported count is cross-checked with a
  snapshot `countDocuments`. The backup records `atClusterTime` in its end record.
- Snapshot reads need a replica set (Atlas, including M0, is one). If a
  deployment rejects them, the backup **fails** with an explicit error — it never
  silently falls back. `BACKUP_ALLOW_NON_SNAPSHOT=true` accepts non point-in-time
  backups (collections may reflect slightly different moments); such backups are
  marked `consistency: none`.
- MongoDB keeps snapshot history for about 5 minutes. A database that takes
  longer than that to export fails with *SnapshotTooOld* (and is retried); at the
  current size (< 100 MB) an export takes seconds.
- Collection and index metadata is read just before the documents, outside the
  snapshot; a collection created during the export may be missing from it.
- `secondaryPreferred` reduces load on the primary when a secondary is available,
  but does not guarantee it; a lagging secondary waits for the snapshot time.
  Streaming keeps memory bounded (one cursor batch + one 8 MiB upload chunk), it
  does not make the reads free.
- Snapshot reads are limited by the server's history window
  (`minSnapshotHistoryWindowInSeconds`, 300 s by default and on Atlas): an
  export (reading + compressing, not uploading) longer than that fails. On a
  self-hosted MongoDB the window can be raised.
- The schedule runs inside the API: if every API instance is down, no backups
  run and the watchdog (which runs in the API too) cannot alert. Add an external
  uptime check for the API itself.

### 5.1 If the server itself is compromised

The server holds both `GDRIVE_REFRESH_TOKEN` and `BACKUP_ENCRYPTION_KEY`. With
`drive.file` the token can only reach the files this app created — but it can
**delete all of them**, and the key decrypts them. Backups in Drive protect
against a broken database, a bad deploy or an admin mistake; they do not, on
their own, survive an attacker who controls the server. What closes the gap:

1. **An offline copy:** download a bundle regularly (e.g. weekly) and keep it
   off the server and off that Google account (external disk, another cloud).
   It is encrypted, so it is safe to store anywhere.
2. **The key off the server too:** keep `BACKUP_ENCRYPTION_KEY` (and old keys)
   in a password manager. Without it no copy can be restored.
3. **The Google account:** use a dedicated account for backups with 2-step
   verification; revoke the app there (Security → Third-party access) if the
   server is compromised, then issue a new refresh token.
4. **Rotate after an incident:** new refresh token, new encryption key (keep the
   old one in `BACKUP_DECRYPTION_KEYS` to read older backups).
5. **Strongest option (not built in):** a second destination that refuses
   deletion for a period — S3 / Backblaze B2 with Object Lock — written with
   credentials that cannot delete. It needs its own account and costs; worth it
   once the store's data is valuable enough.

---

## 6. Rotation

- **OAuth credentials:** create a new client secret / refresh token
  (`npm run backup:auth`), update the env, restart, **Test connection**. Revoke
  the old token at <https://myaccount.google.com/permissions>.
- **Encryption key:** `npm run backup:keygen`, set the new `BACKUP_ENCRYPTION_KEY`
  and restart. New backups use the new key; old backups still need the old key —
  keep it in the password manager and pass it as `BACKUP_DECRYPTION_KEYS` when
  restoring. Each backup header carries a `keyId` (hash prefix) so the right key
  is picked automatically. Discard an old key only after every backup made with
  it has expired from Drive.

---

## 7. File format (SGBK v1)

```
offset  size  field
0       4     "SGBK"
4       1     format version = 1
5       4     header length N (uint32 BE, ≤ 64 KiB)
9       N     header JSON: formatVersion, backupId, createdAt, sourceDb,
              encryption "aes-256-gcm", compression "gzip", keyId, iv (12 bytes, base64)
9+N     …     AES-256-GCM ciphertext of gzip(NDJSON payload)
end-16  16    GCM authentication tag
```
Bytes `0 … 9+N` are the GCM additional authenticated data (the header cannot be
altered). The header's optional `payload` field says what the file holds:
absent or `db` = database backup (below), `upload-blob` = gzip of one uploaded
file, `upload-manifest` = gzip of the JSON file list
`{formatVersion, backupId, createdAt, files: [{path, blob, size, mtime}], totalBytes}`.
Each tool refuses the wrong kind. The database payload is one JSON record per line:

| `t` | Fields |
|---|---|
| `begin` | formatVersion, backupId, createdAt, sourceDb, consistency |
| `collection` | name, type (`collection`/`view`/`timeseries`), options, indexes (canonical EJSON) |
| `doc` | `c` (collection), `d` (document, canonical EJSON) |
| `collectionEnd` | name, count |
| `end` | collections {name: count}, totalDocs, completedAt, atClusterTime |

A payload without a matching `end` record is an incomplete backup and is
rejected. A restore tool must support the format version it reads; v1 readers
reject other versions.

## 8. Tests

```bash
cd server
npx jest src/backup src/config/env.validation.backup.spec.ts   # unit tests (mocked Drive/Redis/queue, temp dirs)
# end-to-end export → restore against a disposable replica set:
BACKUP_TEST_MONGODB_URI="mongodb://127.0.0.1:27017/?replicaSet=rs0" \
  npx jest --config ./test/jest-e2e.json backup-restore
```
