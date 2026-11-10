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
    expect(settings.assistantName).toBe('Appu');
  });

  it('migrates legacy default companion name Novi3 to Appu and persists', () => {
    // Simulate an older install that still has the pre-Appu product default.
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        userName: 'Vishnu',
        assistantName: 'Novi3',
        isPinned: true,
        autonomousRoaming: true,
        freeFallEnabled: true,
        edgeSoundEnabled: true,
        autoCheckUpdates: true,
        releaseChannel: 'stable',
        volume: 0.8,
      }),
      'utf8'
    );

    const migrated = new StorageService(tempDir);
    expect(migrated.getSettings().assistantName).toBe('Appu');
    expect(migrated.getSettings().isPinned).toBe(true);

    const raw = JSON.parse(fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8'));
    expect(raw.assistantName).toBe('Appu');
  });

  it('preserves intentional companion renames and coerces empty names to Appu', () => {
    storage.updateSettings({ assistantName: 'Buddy' });
    expect(storage.getSettings().assistantName).toBe('Buddy');

    storage.updateSettings({ assistantName: '   ' });
    expect(storage.getSettings().assistantName).toBe('Appu');

    storage.updateSettings({ assistantName: 'novi3' });
    expect(storage.getSettings().assistantName).toBe('Appu');
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
