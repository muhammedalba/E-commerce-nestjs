import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Setting,
  SettingDocument,
} from 'src/settings/shared/schema/setting.schema';
import {
  Country,
  CountryDocument,
} from 'src/locations/shared/schema/country.schema';
import { BackupConfig } from './backup.config';
import {
  BackupSettings,
  DEFAULT_BACKUP_SETTINGS,
  FOLDER_NAME_PATTERN,
  SCHEDULE_TIME_PATTERN,
  SUPPORTED_BACKUPS_PER_DAY,
  SUPPORTED_RETENTION_DAYS,
} from './backup.types';
import {
  ResolvedTimezone,
  StoreAddressInput,
  normalizePlaceName,
  resolveStoreTimezone,
} from './store-timezone';

const SETTINGS_KEY = 'global';

/** Fields an admin may change (folderId is server-managed). */
export interface BackupSettingsPatch {
  enabled?: boolean;
  backupsPerDay?: number;
  scheduleTime?: string;
  retentionDays?: number;
  googleDrive?: { folderName?: string };
}

const includes = (list: readonly number[], v: unknown): v is number =>
  typeof v === 'number' && list.includes(v);

/**
 * Persistence for the admin backup settings, stored as `backup` on the
 * global `Setting` document. Writes use `$set` on individual `backup.*`
 * paths, so a partial update never touches other settings (or other backup
 * fields), and concurrent updates of different fields don't clobber each
 * other. Reads merge stored values over validated defaults, so documents
 * created before this feature (no `backup` field) behave as "disabled".
 */
@Injectable()
export class BackupSettingsStore {
  constructor(
    @InjectModel(Setting.name)
    private readonly settingModel: Model<SettingDocument>,
    @InjectModel(Country.name)
    private readonly countryModel: Model<CountryDocument>,
    private readonly config: BackupConfig,
  ) {}

  defaults(): BackupSettings {
    const retention = this.config.retentionDefault;
    return {
      ...DEFAULT_BACKUP_SETTINGS,
      retentionDays: includes(SUPPORTED_RETENTION_DAYS, retention)
        ? (retention as BackupSettings['retentionDays'])
        : DEFAULT_BACKUP_SETTINGS.retentionDays,
      googleDrive: {
        folderName: this.config.folderNameDefault,
        folderId: '',
      },
    };
  }

  /** Stored values over defaults; anything invalid in the DB falls back. */
  normalize(
    stored: Partial<BackupSettings> | null | undefined,
  ): BackupSettings {
    const d = this.defaults();
    const s = stored ?? {};
    return {
      enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled,
      backupsPerDay: includes(SUPPORTED_BACKUPS_PER_DAY, s.backupsPerDay)
        ? s.backupsPerDay
        : d.backupsPerDay,
      scheduleTime:
        typeof s.scheduleTime === 'string' &&
        SCHEDULE_TIME_PATTERN.test(s.scheduleTime)
          ? s.scheduleTime
          : d.scheduleTime,
      retentionDays: includes(SUPPORTED_RETENTION_DAYS, s.retentionDays)
        ? s.retentionDays
        : d.retentionDays,
      googleDrive: {
        folderName:
          typeof s.googleDrive?.folderName === 'string' &&
          FOLDER_NAME_PATTERN.test(s.googleDrive.folderName)
            ? s.googleDrive.folderName
            : d.googleDrive.folderName,
        folderId:
          typeof s.googleDrive?.folderId === 'string'
            ? s.googleDrive.folderId
            : '',
      },
      enabledAt: s.enabledAt instanceof Date ? s.enabledAt : null,
    };
  }

  async load(): Promise<{
    settings: BackupSettings;
    address: StoreAddressInput | null;
  }> {
    const doc = await this.settingModel
      .findOne({ key: SETTINGS_KEY })
      .select('backup businessAddress')
      .lean<{
        backup?: Partial<BackupSettings>;
        businessAddress?: StoreAddressInput;
      }>();
    return {
      settings: this.normalize(doc?.backup),
      address: doc?.businessAddress ?? null,
    };
  }

  async get(): Promise<BackupSettings> {
    return (await this.load()).settings;
  }

  /** Applies a validated patch atomically; returns the resulting settings. */
  async update(patch: BackupSettingsPatch): Promise<BackupSettings> {
    const $set: Record<string, unknown> = {};
    if (patch.enabled != null) $set['backup.enabled'] = patch.enabled;
    if (patch.backupsPerDay != null) {
      $set['backup.backupsPerDay'] = patch.backupsPerDay;
    }
    if (patch.scheduleTime != null) {
      $set['backup.scheduleTime'] = patch.scheduleTime;
    }
    if (patch.retentionDays != null) {
      $set['backup.retentionDays'] = patch.retentionDays;
    }
    if (patch.googleDrive?.folderName != null) {
      $set['backup.googleDrive.folderName'] = patch.googleDrive.folderName;
    }
    if (Object.keys($set).length === 0) return this.get();

    if (patch.enabled === true) {
      // Only on an off → on switch, so the watchdog measures from there.
      await this.settingModel.updateOne(
        { key: SETTINGS_KEY, 'backup.enabled': { $ne: true } },
        { $set: { 'backup.enabledAt': new Date() } },
      );
    }

    const doc = await this.settingModel
      .findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set },
        { returnDocument: 'after', upsert: true },
      )
      .select('backup')
      .lean<{ backup?: Partial<BackupSettings> }>();
    return this.normalize(doc?.backup);
  }

  /** Records the Drive folder id the server resolved (server-managed field). */
  async setFolderId(folderId: string): Promise<void> {
    await this.settingModel.updateOne(
      { key: SETTINGS_KEY },
      { $set: { 'backup.googleDrive.folderId': folderId } },
    );
  }

  /** Timezone derived from the store owner's business address. */
  async resolveTimezone(
    address: StoreAddressInput | null,
  ): Promise<ResolvedTimezone> {
    const names = [address?.country?.en, address?.country?.ar].filter(
      (n): n is string => !!n?.trim(),
    );
    let code: string | null = null;
    if (names.length) {
      const countries = await this.countryModel
        .find({}, { name: 1, code: 1 })
        .lean<{ name?: { ar?: string; en?: string }; code: string }[]>();
      const wanted = new Set(names.map(normalizePlaceName));
      code =
        countries.find(
          (c) =>
            (c.name?.en && wanted.has(normalizePlaceName(c.name.en))) ||
            (c.name?.ar && wanted.has(normalizePlaceName(c.name.ar))),
        )?.code ?? null;
    }
    return resolveStoreTimezone(address, this.config.fallbackTimezone, code);
  }
}
