import { mongo } from 'mongoose';

/**
 * Every API instance marks the database it runs on as "live" at startup
 * (and refreshes it periodically). Tools that drop databases — the test
 * restore slot, `backup:restore --drop` — refuse a database carrying the
 * marker, so a database that has ever served the store (for example after
 * switching MONGODB_DB_NAME, or during a rolling restart where instances
 * disagree on the name) is never dropped by a name-based rule.
 *
 * The marker is internal: backups never export it, so a restored copy only
 * gets one once an API instance actually runs on it.
 */
export const LIVE_MARKER_COLLECTION = '__sgbk_live';
const LIVE_MARKER_ID = 'live';

/** Collections the backup system keeps for itself (never exported or compared). */
export const isInternalCollection = (name: string): boolean =>
  name.startsWith('__sgbk_');

interface LiveMarkerDoc {
  _id: string;
  dbName: string;
  since: Date;
  lastSeenAt: Date;
}

type MarkerDb = Pick<
  mongo.Db,
  'collection' | 'listCollections' | 'databaseName'
>;

export class LiveDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LiveDatabaseError';
  }
}

/** Marks `db` as the database this API instance serves. */
export async function markLiveDatabase(db: MarkerDb): Promise<void> {
  const now = new Date();
  await db.collection<LiveMarkerDoc>(LIVE_MARKER_COLLECTION).updateOne(
    { _id: LIVE_MARKER_ID },
    {
      $set: { dbName: db.databaseName, lastSeenAt: now },
      $setOnInsert: { since: now },
    },
    { upsert: true },
  );
}

/** The live marker of `db`, or null if no API instance ever ran on it. */
export async function liveMarkerOf(
  db: MarkerDb,
): Promise<{ lastSeenAt: Date | null } | null> {
  const found = await db
    .listCollections({ name: LIVE_MARKER_COLLECTION }, { nameOnly: true })
    .toArray();
  if (found.length === 0) return null;
  const doc = await db
    .collection<LiveMarkerDoc>(LIVE_MARKER_COLLECTION)
    .findOne({ _id: LIVE_MARKER_ID });
  return { lastSeenAt: doc?.lastSeenAt ?? null };
}

/** Throws {@link LiveDatabaseError} if `db` has served the store. */
export async function assertNotLiveDatabase(
  db: MarkerDb,
  action: string,
): Promise<void> {
  const marker = await liveMarkerOf(db);
  if (!marker) return;
  const seen = marker.lastSeenAt
    ? ` (last used ${marker.lastSeenAt.toISOString()})`
    : '';
  throw new LiveDatabaseError(
    `Database "${db.databaseName}" has been used as the store's live database${seen}; ` +
      `refusing to ${action} it. If it is really no longer used, drop it yourself in mongosh.`,
  );
}
