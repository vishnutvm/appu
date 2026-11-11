import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export type ReleaseChannel = 'development' | 'beta' | 'stable';
export type CompanionCharacterId = 'appu-3d' | 'rabbit-video';

export interface StorageSettings {
  userName?: string;
  assistantName?: string;
  companionCharacter?: CompanionCharacterId;
  companionScale?: number;
  isPinned: boolean;
  autonomousRoaming: boolean;
  freeFallEnabled: boolean;
  edgeSoundEnabled: boolean;
  autoCheckUpdates: boolean;
  releaseChannel: ReleaseChannel;
  volume: number;
  lastUpdateCheck?: number;
  [key: string]: any;
}

const DEFAULT_SETTINGS: StorageSettings = {
  userName: 'Vishnu',
  assistantName: 'Appu',
  companionCharacter: 'appu-3d',
  companionScale: 1.0,
  isPinned: false,
  autonomousRoaming: true,
  freeFallEnabled: true,
  edgeSoundEnabled: true,
  autoCheckUpdates: true,
  releaseChannel: 'stable',
  volume: 0.8,
};

/** Legacy product defaults that should become Appu; keep intentional user renames. */
const LEGACY_DEFAULT_ASSISTANT_NAMES = new Set(['novi3']);

function normalizeAssistantName(name: unknown): string {
  if (typeof name !== 'string') return DEFAULT_SETTINGS.assistantName!;
  const trimmed = name.trim();
  if (!trimmed) return DEFAULT_SETTINGS.assistantName!;
  if (LEGACY_DEFAULT_ASSISTANT_NAMES.has(trimmed.toLowerCase())) {
    return DEFAULT_SETTINGS.assistantName!;
  }
  return trimmed;
}

function applySettingsMigrations(
  settings: StorageSettings
): { settings: StorageSettings; changed: boolean } {
  const migratedName = normalizeAssistantName(settings.assistantName);
  if (migratedName === settings.assistantName) {
    return { settings, changed: false };
  }
  return {
    settings: { ...settings, assistantName: migratedName },
    changed: true,
  };
}

export class StorageService {
  private static instance: StorageService | null = null;
  private userDataPath: string;
  private dbPath: string;
  private settingsPath: string;
  private backupsDir: string;
  private cachedSettings: StorageSettings | null = null;

  constructor(customUserDataPath?: string) {
    if (customUserDataPath) {
      this.userDataPath = customUserDataPath;
    } else {
      // In electron environment, use app.getPath('userData')
      try {
        this.userDataPath = app.getPath('userData');
      } catch {
        this.userDataPath = path.join(process.cwd(), '.appu-userdata');
      }
    }

    this.dbPath = path.join(this.userDataPath, 'appu.db');
    this.settingsPath = path.join(this.userDataPath, 'settings.json');
    this.backupsDir = path.join(this.userDataPath, 'backups');

    this.ensureDirectories();
    this.initializeStorage();
  }

  public static getInstance(customUserDataPath?: string): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(customUserDataPath);
    }
    return StorageService.instance;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.userDataPath)) {
      fs.mkdirSync(this.userDataPath, { recursive: true });
    }
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  private initializeStorage(): void {
    // If settings file doesn't exist, seed with defaults
    if (!fs.existsSync(this.settingsPath)) {
      this.cachedSettings = { ...DEFAULT_SETTINGS };
      this.writeSettingsFile(this.cachedSettings);
    } else {
      try {
        const raw = fs.readFileSync(this.settingsPath, 'utf8');
        const parsed = JSON.parse(raw);
        const merged = { ...DEFAULT_SETTINGS, ...parsed };
        const { settings, changed } = applySettingsMigrations(merged);
        this.cachedSettings = settings;
        if (changed) {
          this.writeSettingsFile(settings);
        }
      } catch (err) {
        console.error('Failed to parse settings.json, recreating with defaults:', err);
        this.cachedSettings = { ...DEFAULT_SETTINGS };
        this.writeSettingsFile(this.cachedSettings);
      }
    }

    // Seed initial database if absent and legacy/dev file exists
    if (!fs.existsSync(this.dbPath)) {
      this.seedDatabaseIfAvailable();
    }
  }

  private seedDatabaseIfAvailable(): void {
    try {
      // Look for data/appu.db from workspace or bundled resources
      const possibleSources = [
        path.join(process.cwd(), 'data', 'appu.db'),
        path.join(__dirname, '..', 'data', 'appu.db'),
        path.join(__dirname, '..', '..', 'data', 'appu.db'),
      ];

      for (const src of possibleSources) {
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, this.dbPath);
          console.log(`Seeded appu.db from ${src} to ${this.dbPath}`);
          return;
        }
      }
    } catch (err) {
      console.warn('Could not seed initial SQLite database:', err);
    }
  }

  public getUserDataPath(): string {
    return this.userDataPath;
  }

  public getDatabasePath(): string {
    return this.dbPath;
  }

  public getBackupsPath(): string {
    return this.backupsDir;
  }

  public getSettings(): StorageSettings {
    if (!this.cachedSettings) {
      try {
        if (fs.existsSync(this.settingsPath)) {
          const raw = fs.readFileSync(this.settingsPath, 'utf8');
          const merged = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
          const { settings, changed } = applySettingsMigrations(merged);
          this.cachedSettings = settings;
          if (changed) {
            this.writeSettingsFile(settings);
          }
        } else {
          this.cachedSettings = { ...DEFAULT_SETTINGS };
        }
      } catch {
        this.cachedSettings = { ...DEFAULT_SETTINGS };
      }
    }
    return { ...(this.cachedSettings || DEFAULT_SETTINGS) } as StorageSettings;
  }

  public updateSettings(updates: Partial<StorageSettings>): StorageSettings {
    const current = this.getSettings();
    const updated: StorageSettings = {
      ...current,
      ...updates,
    };
    if (Object.prototype.hasOwnProperty.call(updates, 'assistantName')) {
      updated.assistantName = normalizeAssistantName(updates.assistantName);
    }
    this.cachedSettings = updated;
    this.writeSettingsFile(updated);
    return { ...updated };
  }

  private writeSettingsFile(settings: StorageSettings): void {
    try {
      const tempPath = `${this.settingsPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf8');
      fs.renameSync(tempPath, this.settingsPath);
    } catch (err) {
      console.error('Failed to write settings.json atomically:', err);
    }
  }

  /**
   * Creates a timestamped backup of the user SQLite database.
   * Runs safely before applying any update or migration.
   */
  public createDatabaseBackup(label: string = 'pre_update'): string | null {
    if (!fs.existsSync(this.dbPath)) {
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `appu_backup_${label}_${timestamp}.db`;
      const backupDestination = path.join(this.backupsDir, backupFilename);

      fs.copyFileSync(this.dbPath, backupDestination);

      // Clean up old backups keeping at most 5 recent backups
      this.pruneOldBackups(5);

      return backupDestination;
    } catch (err) {
      console.error('Failed to create database backup:', err);
      return null;
    }
  }

  private pruneOldBackups(maxToKeep: number): void {
    try {
      const files = fs.readdirSync(this.backupsDir);
      const backupFiles = files
        .filter((f) => f.startsWith('appu_backup_') && f.endsWith('.db'))
        .map((f) => {
          const fullPath = path.join(this.backupsDir, f);
          return { name: f, path: fullPath, mtime: fs.statSync(fullPath).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      if (backupFiles.length > maxToKeep) {
        for (let i = maxToKeep; i < backupFiles.length; i++) {
          try {
            fs.unlinkSync(backupFiles[i].path);
          } catch {
            // ignore prune error
          }
        }
      }
    } catch (err) {
      console.warn('Backup pruning error:', err);
    }
  }

  /**
   * Safely restore database from a backup file if a migration or update fails.
   */
  public restoreDatabaseFromBackup(backupPath: string): boolean {
    try {
      if (!fs.existsSync(backupPath)) return false;
      fs.copyFileSync(backupPath, this.dbPath);
      return true;
    } catch (err) {
      console.error('Failed to restore database from backup:', err);
      return false;
    }
  }
}
