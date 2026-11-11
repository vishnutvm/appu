import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { StorageService } from '../../electron/storage-service';
import { UpdaterService } from '../../electron/updater-service';

class MockAutoUpdater extends EventEmitter {
  public autoDownload = false;
  public autoInstallOnAppQuit = false;
  public allowDowngrade = false;
  public allowPrerelease = false;
  public channel = 'latest';
  public disableDifferentialDownload = false;
  public logger: any = null;

  public checkForUpdates = vi.fn().mockResolvedValue(null);
  public downloadUpdate = vi.fn().mockResolvedValue(null);
  public quitAndInstall = vi.fn();
}

describe('UpdaterService & Channel Management', () => {
  let tempDir: string;
  let storage: StorageService;
  let mockUpdater: MockAutoUpdater;
  let updater: UpdaterService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appu-test-updater-'));
    storage = new StorageService(tempDir);
    mockUpdater = new MockAutoUpdater();
    updater = new UpdaterService(storage, mockUpdater);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('initializes with default stable channel and idle state', () => {
    const status = updater.getStatus();
    expect(status.state).toBe('Idle');
    expect(status.channel).toBe('stable');
    expect(status.autoCheckEnabled).toBe(true);
    expect(status.updateInfo).toBeNull();
    expect(mockUpdater.autoDownload).toBe(false);
  });

  it('switches release channels and persists preference in StorageService', async () => {
    await updater.setChannel('beta');
    expect(updater.getStatus().channel).toBe('beta');
    expect(storage.getSettings().releaseChannel).toBe('beta');
    expect(mockUpdater.allowPrerelease).toBe(true);

    await updater.setChannel('development');
    expect(updater.getStatus().channel).toBe('development');
    expect(storage.getSettings().releaseChannel).toBe('development');
  });

  it('updates autoCheckEnabled and persists in StorageService', async () => {
    await updater.setAutoCheck(false);
    expect(updater.getStatus().autoCheckEnabled).toBe(false);
    expect(storage.getSettings().autoCheckUpdates).toBe(false);
  });

  it('handles update-available and download-progress events from updater', () => {
    mockUpdater.emit('update-available', {
      version: '1.2.0',
      releaseNotes: 'Awesome features',
      releaseDate: '2026-11-02',
    });

    let status = updater.getStatus();
    expect(status.state).toBe('Update Available');
    expect(status.updateInfo?.version).toBe('1.2.0');

    mockUpdater.emit('download-progress', {
      percent: 50,
      bytesPerSecond: 1024 * 1024,
      transferred: 5000000,
      total: 10000000,
    });

    status = updater.getStatus();
    expect(status.state).toBe('Downloading');
    expect(status.progress?.percent).toBe(50);
  });

  it('postpones an update and remembers the dismissed version', () => {
    mockUpdater.emit('update-available', {
      version: '1.2.0',
      releaseNotes: 'Some notes',
    });

    updater.postponeUpdate();
    expect(updater.getStatus().state).toBe('Idle');
    expect((updater as any).userDismissedVersion).toBe('1.2.0');
  });

  it('coordinates with active reminders and defers notifications', () => {
    const broadcastSpy = vi.spyOn(updater, 'broadcastStatus');

    // Simulate active reminder
    updater.setReminderActive(true);
    expect((updater as any).isReminderActive).toBe(true);

    // When reminder ends, if there was a deferred update, it broadcasts
    (updater as any).pendingNotificationInfo = {
      version: '1.3.0',
    };
    updater.setReminderActive(false);

    expect(broadcastSpy).toHaveBeenCalled();
  });

  it('formats network error messages cleanly for end users', () => {
    const offlineErr = new Error('net::ERR_INTERNET_DISCONNECTED: Failed to reach update server');
    const msg = (updater as any).formatErrorMessage(offlineErr);
    expect(msg).toContain('No internet connection');

    const timeoutErr = new Error('Connection timed out after 30000ms');
    const timeoutMsg = (updater as any).formatErrorMessage(timeoutErr);
    expect(timeoutMsg).toContain('timed out');

    const checksumErr = new Error('sha512 checksum mismatch');
    const checksumMsg = (updater as any).formatErrorMessage(checksumErr);
    expect(checksumMsg).toContain('Security verification failed');

    const sigErr = new Error('Code signature at URL did not pass validation');
    expect((updater as any).isMacSignatureError(sigErr)).toBe(true);
    expect((updater as any).formatErrorMessage(sigErr)).toContain('unsigned');
  });

  it('records downloadedFile path when update-downloaded is emitted', () => {
    mockUpdater.emit('update-downloaded', {
      version: '1.0.3',
      releaseNotes: 'Fixes and Rabbit companion',
      releaseDate: '2026-11-11',
      downloadedFile: '/tmp/Appu-1.0.3-arm64-mac.zip',
    });

    expect(updater.getStatus().state).toBe('Downloaded');
    expect((updater as any).downloadedUpdateFilePath).toBe('/tmp/Appu-1.0.3-arm64-mac.zip');
  });
});
