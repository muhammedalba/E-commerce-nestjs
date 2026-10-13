/** Emitted after `SettingsService.updateSettings` persists a change. */
export const SETTINGS_UPDATED_EVENT = 'settings.updated';

export interface SettingsUpdatedEvent {
  /** Top-level setting keys present in the update payload. */
  changedKeys: string[];
}
