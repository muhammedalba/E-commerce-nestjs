import {
  BACKUP_CREATED_AT_PROPERTY,
  BACKUP_KIND_PROPERTY,
  BACKUP_KIND_VALUE,
  BACKUP_STATUS_PROPERTY,
  BACKUP_VERIFIED_PROPERTY,
  RetentionCandidate,
  isValidBackupFile,
  selectBackupsToDelete,
} from './retention';

const NOW = new Date('2026-10-12T12:00:00Z');
const daysAgo = (d: number) =>
  new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

const backup = (
  id: string,
  ageDays: number,
  size = 100,
): RetentionCandidate => ({
  id,
  name: `skygalaxy-${id}.sgbk`,
  size: String(size),
  createdTime: daysAgo(ageDays),
  appProperties: {
    [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE,
    [BACKUP_CREATED_AT_PROPERTY]: daysAgo(ageDays),
  },
});

const ids = (files: RetentionCandidate[]) => files.map((f) => f.id);

const tagged = (
  file: RetentionCandidate,
  props: Record<string, string>,
): RetentionCandidate => ({
  ...file,
  appProperties: { ...file.appProperties, ...props },
});

describe('selectBackupsToDelete', () => {
  it('deletes only backups older than the retention period, oldest first', () => {
    const files = [
      backup('a', 1),
      backup('b', 2),
      backup('c', 3),
      backup('d', 4),
      backup('e', 5),
      backup('f', 20),
      backup('g', 15),
      backup('h', 13),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['f', 'g']);
  });

  it('always keeps the four newest valid backups even when all are expired', () => {
    const files = [
      backup('a', 100),
      backup('b', 101),
      backup('c', 102),
      backup('d', 103),
      backup('e', 104),
      backup('f', 105),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['f', 'e']);
  });

  it('never deletes anything when there are four or fewer backups', () => {
    const files = [
      backup('a', 50),
      backup('b', 60),
      backup('c', 70),
      backup('d', 80),
    ];
    expect(selectBackupsToDelete(files, NOW, 7)).toEqual([]);
  });

  it('never deletes the protected (just uploaded) backup', () => {
    // Clock skew: the new file's own timestamp looks old.
    const files = [
      backup('new', 30),
      backup('a', 1),
      backup('b', 2),
      backup('c', 3),
      backup('d', 4),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14, 4, 'new'))).toEqual([]);
  });

  it('ignores files that are not valid backups of this app', () => {
    const foreign: RetentionCandidate = {
      id: 'x',
      name: 'notes.txt',
      size: '10',
      createdTime: daysAgo(400),
    };
    const empty = backup('empty', 400, 0);
    const noDate: RetentionCandidate = {
      ...backup('nodate', 400),
      createdTime: undefined,
      appProperties: { [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE },
    };
    const files = [
      foreign,
      empty,
      noDate,
      backup('a', 1),
      backup('b', 2),
      backup('c', 3),
      backup('d', 4),
      backup('old', 30),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['old']);
    expect(isValidBackupFile(foreign)).toBe(false);
    expect(isValidBackupFile(empty)).toBe(false);
    expect(isValidBackupFile(noDate)).toBe(false);
  });

  it('does not let invalid files count towards the minimum kept', () => {
    const files = [
      { ...backup('bad1', 0), size: '0' },
      { ...backup('bad2', 0), size: '0' },
      backup('a', 20),
      backup('b', 21),
      backup('c', 22),
      backup('d', 23),
      backup('e', 24),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['e']);
  });

  it('is deterministic for equal timestamps', () => {
    const files = ['p', 'q', 'r', 's', 't', 'u'].map((id) => backup(id, 30));
    const first = ids(selectBackupsToDelete(files, NOW, 14));
    const second = ids(selectBackupsToDelete([...files].reverse(), NOW, 14));
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
  });

  it('falls back to Drive createdTime when the app property is missing', () => {
    const legacy: RetentionCandidate = {
      ...backup('legacy', 40),
      appProperties: { [BACKUP_KIND_PROPERTY]: BACKUP_KIND_VALUE },
    };
    const files = [
      legacy,
      backup('a', 1),
      backup('b', 2),
      backup('c', 3),
      backup('d', 4),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['legacy']);
  });

  it('rejects invalid retention periods', () => {
    expect(() => selectBackupsToDelete([], NOW, 0)).toThrow();
    expect(() => selectBackupsToDelete([], NOW, 1.5)).toThrow();
  });

  it('keeps the minimum among trusted backups, not partial or failed ones', () => {
    // Retries after an uploads failure left partial files; one failed verification.
    const files = [
      tagged(backup('p1', 20), { [BACKUP_STATUS_PROPERTY]: 'partial' }),
      tagged(backup('p2', 21), { [BACKUP_STATUS_PROPERTY]: 'partial' }),
      tagged(backup('bad', 22), { [BACKUP_VERIFIED_PROPERTY]: 'failed' }),
      backup('g1', 23),
      backup('g2', 24),
      backup('g3', 25),
      backup('g4', 26),
      backup('g5', 27),
    ];
    // The 4 newest trusted (g1–g4) stay; partial/failed/old ones go.
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual([
      'g5',
      'bad',
      'p2',
      'p1',
    ]);
  });

  it('never keeps fewer than before when trusted backups are scarce', () => {
    const files = [
      tagged(backup('p1', 20), { [BACKUP_STATUS_PROPERTY]: 'partial' }),
      tagged(backup('p2', 21), { [BACKUP_STATUS_PROPERTY]: 'partial' }),
      backup('g1', 22),
      tagged(backup('p3', 23), { [BACKUP_STATUS_PROPERTY]: 'partial' }),
      tagged(backup('p4', 24), { [BACKUP_STATUS_PROPERTY]: 'partial' }),
    ];
    // g1 is trusted; the 3 newest others fill up to 4.
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['p4']);
  });

  it('always keeps the newest backup that passed verification', () => {
    const files = [
      backup('a', 20),
      backup('b', 21),
      backup('c', 22),
      backup('d', 23),
      tagged(backup('verified', 40), { [BACKUP_VERIFIED_PROPERTY]: 'ok' }),
      backup('old', 41),
    ];
    expect(ids(selectBackupsToDelete(files, NOW, 14))).toEqual(['old']);
  });
});
