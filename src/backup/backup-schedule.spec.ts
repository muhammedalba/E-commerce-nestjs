import { BackupScheduler } from './backup.scheduler';
import {
  SUPPORTED_BACKUPS_PER_DAY,
  buildCronPattern,
  sanitizeError,
  scheduleRunTimes,
} from './backup.types';

/** Local wall-clock HH:mm of a Date in a zone. */
const local = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);

const localDay = (d: Date, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

describe('buildCronPattern', () => {
  it.each([
    [1, '03:00', '0 3 * * *'],
    [2, '03:00', '0 3,15 * * *'],
    [3, '03:00', '0 3,11,19 * * *'],
    [4, '03:00', '0 3,9,15,21 * * *'],
    [6, '03:00', '0 3,7,11,15,19,23 * * *'],
    [8, '03:30', '30 0,3,6,9,12,15,18,21 * * *'],
    [12, '01:15', '15 1,3,5,7,9,11,13,15,17,19,21,23 * * *'],
    [
      24,
      '00:05',
      `5 ${Array.from({ length: 24 }, (_, h) => h).join(',')} * * *`,
    ],
    [4, '22:45', '45 4,10,16,22 * * *'],
  ])('%i/day from %s → %s', (perDay, time, expected) => {
    expect(buildCronPattern(perDay, time)).toBe(expected);
  });

  it('returns N evenly spaced local run times for every supported frequency', () => {
    for (const perDay of SUPPORTED_BACKUPS_PER_DAY) {
      const times = scheduleRunTimes(perDay, '03:00');
      expect(times).toHaveLength(perDay);
      expect(times).toContain('03:00');
    }
    expect(scheduleRunTimes(4, '03:00')).toEqual([
      '03:00',
      '09:00',
      '15:00',
      '21:00',
    ]);
  });

  it('rejects unsupported frequencies and malformed times', () => {
    for (const bad of [0, -1, 5, 7, 2.5, 48]) {
      expect(() => buildCronPattern(bad, '03:00')).toThrow(/Unsupported/);
    }
    for (const bad of ['3:00', '24:00', '03:60', '03-00', '', '03:00:00']) {
      expect(() => buildCronPattern(4, bad)).toThrow(/Invalid schedule time/);
    }
  });
});

describe('schedule timing (same cron-parser semantics BullMQ uses)', () => {
  it('runs 4×/day at 03,09,15,21 Riyadh time (no DST)', () => {
    const runs = BackupScheduler.previewRuns(
      buildCronPattern(4, '03:00'),
      'Asia/Riyadh',
      8,
      new Date('2026-10-11T23:59:00Z'), // cron-parser returns runs strictly after this
    );
    expect(runs.map((d) => local(d, 'Asia/Riyadh'))).toEqual([
      '03:00',
      '09:00',
      '15:00',
      '21:00',
      '03:00',
      '09:00',
      '15:00',
      '21:00',
    ]);
    // Riyadh is UTC+3 all year.
    expect(runs[0].toISOString()).toBe('2026-10-12T00:00:00.000Z');
  });

  it('spring forward (Europe/Berlin): a skipped local time runs once, one hour later', () => {
    const runs = BackupScheduler.previewRuns(
      '30 2 * * *',
      'Europe/Berlin',
      4,
      new Date('2026-03-27T00:00:00Z'),
    );
    const days = runs.map((d) => localDay(d, 'Europe/Berlin'));
    expect(new Set(days).size).toBe(4); // exactly one run per day
    const dstDay = runs.find(
      (d) => localDay(d, 'Europe/Berlin') === '2026-03-29',
    )!;
    expect(local(dstDay, 'Europe/Berlin')).toBe('03:30');
  });

  it('fall back (Europe/Berlin): a repeated local time runs once (first occurrence)', () => {
    const runs = BackupScheduler.previewRuns(
      '30 2 * * *',
      'Europe/Berlin',
      4,
      new Date('2026-10-24T00:00:00Z'),
    );
    const days = runs.map((d) => localDay(d, 'Europe/Berlin'));
    expect(days).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
    const dstDay = runs[1];
    expect(local(dstDay, 'Europe/Berlin')).toBe('02:30');
    expect(dstDay.toISOString()).toBe('2026-10-25T00:30:00.000Z'); // CEST occurrence
  });

  it('keeps every-6h runs on local wall-clock hours across a DST change', () => {
    const runs = BackupScheduler.previewRuns(
      buildCronPattern(4, '00:30'),
      'Europe/Berlin',
      6,
      new Date('2026-10-24T20:00:00Z'),
    );
    expect(runs.map((d) => local(d, 'Europe/Berlin'))).toEqual([
      '00:30',
      '06:30',
      '12:30',
      '18:30',
      '00:30',
      '06:30',
    ]);
  });
});

describe('sanitizeError', () => {
  it('removes connection strings, tokens and secrets', () => {
    const msg = sanitizeError(
      new Error(
        'failed mongodb+srv://user:pa55@cluster0.x.mongodb.net/db?x=1 with Bearer ya29.a0AfH6SMB token=abc123 refresh_token=1//0gAbCdEfGhIjKlMnOpQrStUv client_secret: "shh"',
      ),
    );
    expect(msg).not.toMatch(/pa55|ya29\.a0|abc123|1\/\/0g|shh/);
    expect(msg).toContain('mongodb://[redacted]');
  });

  it('caps the length', () => {
    expect(sanitizeError('x'.repeat(5000))).toHaveLength(500);
  });
});
