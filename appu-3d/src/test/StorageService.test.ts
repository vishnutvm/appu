import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StorageService } from '../../electron/storage-service';

describe('StorageService & Data Persistence', () => {
  let tempDir: string;
  let storage: StorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appu-test-storage-'));
    storage = new StorageService(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  });

  it('initializes in userData path and seeds default settings.json', () => {
    expect(storage.getUserDataPath()).toBe(tempDir);
    expect(fs.existsSync(storage.getUserDataPath())).toBe(true);

    const settings = storage.getSettings();
    expect(settings.releaseChannel).toBe('stable');
    expect(settings.autoCheckUpdates).toBe(true);
    expect(settings.isPinned).toBe(false);
  });

  it('updates settings and persists to disk atomically', () => {
    storage.updateSettings({
      releaseChannel: 'beta',
      isPinned: true,
      volume: 0.9,
    });

    const updated = storage.getSettings();
    expect(updated.releaseChannel).toBe('beta');
    expect(updated.isPinned).toBe(true);
    expect(updated.volume).toBe(0.9);

    // Verify raw file content
    const raw = fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.releaseChannel).toBe('beta');
  });

  it('creates timestamped database backup and restores safely', () => {
    const dbPath = storage.getDatabasePath();
    // Simulate user database content
    fs.writeFileSync(dbPath, 'SQLITE-TEST-DATABASE-CONTENT-V1');

    const backupFile = storage.createDatabaseBackup('pre_update');
    expect(backupFile).not.toBeNull();
    expect(fs.existsSync(backupFile!)).toBe(true);
    expect(fs.readFileSync(backupFile!, 'utf8')).toBe('SQLITE-TEST-DATABASE-CONTENT-V1');

    // Simulate corrupted/modified database
    fs.writeFileSync(dbPath, 'CORRUPTED-DB-AFTER-FAILED-MIGRATION');
    expect(fs.readFileSync(dbPath, 'utf8')).toBe('CORRUPTED-DB-AFTER-FAILED-MIGRATION');

    // Restore from backup
    const restored = storage.restoreDatabaseFromBackup(backupFile!);
    expect(restored).toBe(true);
    expect(fs.readFileSync(dbPath, 'utf8')).toBe('SQLITE-TEST-DATABASE-CONTENT-V1');
  });

  it('prunes old backups to prevent disk bloat', () => {
    const dbPath = storage.getDatabasePath();
    fs.writeFileSync(dbPath, 'SQLITE-DATA');

    // Create 7 backups
    for (let i = 0; i < 7; i++) {
      storage.createDatabaseBackup(`test_${i}`);
    }

    const backupsDir = storage.getBackupsPath();
    const backupFiles = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith('appu_backup_') && f.endsWith('.db'));

    // Should keep at most 5 backups
    expect(backupFiles.length).toBeLessThanOrEqual(5);
  });
});
