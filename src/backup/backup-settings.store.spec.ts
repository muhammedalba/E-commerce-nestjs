import { BackupSettingsStore } from './backup-settings.store';
import { DEFAULT_BACKUP_SETTINGS } from './backup.types';

function setup(stored: unknown = undefined, countries: unknown[] = []) {
  const settingModel = {
    findOne: jest.fn(() => ({
      select: () => ({ lean: () => Promise.resolve(stored) }),
    })),
    findOneAndUpdate: jest.fn(
      (_f: unknown, update: { $set: Record<string, unknown> }) => ({
        select: () => ({
          lean: () => {
            const backup: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(update.$set)) {
              const path = k.replace(/^backup\./, '').split('.');
              let o = backup;
              path
                .slice(0, -1)
                .forEach((p) => (o = (o[p] ??= {}) as Record<string, unknown>));
              o[path.at(-1)!] = v;
            }
            return Promise.resolve({ backup });
          },
        }),
      }),
    ),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const countryModel = {
    find: jest.fn(() => ({ lean: () => Promise.resolve(countries) })),
  };
  const config = {
    retentionDefault: 30,
    folderNameDefault: 'skygalaxy-db-backups',
    fallbackTimezone: 'Asia/Riyadh',
  };
  const store = new BackupSettingsStore(
    settingModel as never,
    countryModel as never,
    config as never,
  );
  return { store, settingModel };
}

describe('BackupSettingsStore', () => {
  it('returns disabled defaults for settings documents created before this feature', async () => {
    const { store } = setup({ businessAddress: {} });
    expect(await store.get()).toEqual({
      ...DEFAULT_BACKUP_SETTINGS,
      retentionDays: 30, // env default
    });
  });

  it('replaces invalid stored values with defaults', async () => {
    const { store } = setup({
      backup: {
        enabled: 'yes',
        backupsPerDay: 5,
        scheduleTime: '25:00',
        retentionDays: 3,
        googleDrive: { folderName: 'ok name', folderId: 'f1' },
      },
    });
    expect(await store.get()).toEqual({
      ...DEFAULT_BACKUP_SETTINGS,
      retentionDays: 30,
      googleDrive: { folderName: 'ok name', folderId: 'f1' },
    });
  });

  it('updates only the backup.* paths that were provided', async () => {
    const { store, settingModel } = setup();
    await store.update({
      retentionDays: 60,
      googleDrive: { folderName: 'new' },
    });
    const [filter, update, options] = settingModel.findOneAndUpdate.mock
      .calls[0] as unknown as [
      unknown,
      { $set: Record<string, unknown> },
      unknown,
    ];
    expect(filter).toEqual({ key: 'global' });
    expect(update).toEqual({
      $set: {
        'backup.retentionDays': 60,
        'backup.googleDrive.folderName': 'new',
      },
    });
    expect(options).toMatchObject({ returnDocument: 'after' });
  });

  it('records when backups are switched on (only on an off → on change)', async () => {
    const { store, settingModel } = setup();
    await store.update({ enabled: true });
    expect(settingModel.updateOne).toHaveBeenCalledWith(
      { key: 'global', 'backup.enabled': { $ne: true } },
      { $set: { 'backup.enabledAt': expect.any(Date) as unknown } },
    );
    settingModel.updateOne.mockClear();
    await store.update({ enabled: false });
    await store.update({ retentionDays: 30 });
    expect(settingModel.updateOne).not.toHaveBeenCalled();
  });

  it('does not write when the patch is empty', async () => {
    const { store, settingModel } = setup();
    await store.update({});
    expect(settingModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('matches the address country through the Country collection', async () => {
    const { store } = setup(undefined, [
      { name: { en: 'Kingdom of Testland', ar: 'تست' }, code: 'EG' },
    ]);
    expect(
      await store.resolveTimezone({
        country: { en: 'Kingdom of Testland', ar: '' },
      }),
    ).toEqual({
      timezone: 'Africa/Cairo',
      source: 'store-address',
      countryCode: 'EG',
    });
  });

  it('falls back to the server timezone for an empty address', async () => {
    const { store } = setup();
    expect(await store.resolveTimezone(null)).toEqual({
      timezone: 'Asia/Riyadh',
      source: 'fallback',
      countryCode: null,
    });
  });
});
