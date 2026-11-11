import { app, BrowserWindow } from 'electron';
import { autoUpdater, UpdateInfo as ElectronUpdateInfo, ProgressInfo } from 'electron-updater';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, spawn } from 'child_process';
import {
  UpdateState,
  ReleaseChannel,
  UpdateInfo,
  DownloadProgress,
  UpdaterStatus,
} from './types';
import { StorageService } from './storage-service';

export interface UpdaterEvents {
  'status-changed': (status: UpdaterStatus) => void;
  'update-available': (info: UpdateInfo) => void;
  'update-downloaded': (info: UpdateInfo) => void;
  'download-progress': (progress: DownloadProgress) => void;
  'error': (err: Error) => void;
}

export class UpdaterService extends EventEmitter {
  private static instance: UpdaterService | null = null;
  private storageService: StorageService;
  private updater: any;
  private state: UpdateState = 'Idle';
  private channel: ReleaseChannel = 'stable';
  private autoCheckEnabled: boolean = true;
  private currentUpdateInfo: UpdateInfo | null = null;
  private currentProgress: DownloadProgress | null = null;
  private currentError: string | null = null;
  private lastChecked: number | null = null;
  private userDismissedVersion: string | null = null;
  private isReminderActive: boolean = false;
  private pendingNotificationInfo: UpdateInfo | null = null;
  private mainWindow: BrowserWindow | null = null;
  private initialCheckTimer: NodeJS.Timeout | null = null;
  private downloadedUpdateFilePath: string | null = null;

  constructor(storageService?: StorageService, customUpdater?: any) {
    super();
    this.storageService = storageService || StorageService.getInstance();
    this.updater = customUpdater || autoUpdater;
    const settings = this.storageService.getSettings();
    this.channel = settings.releaseChannel || 'stable';
    this.autoCheckEnabled = settings.autoCheckUpdates !== false;
    this.lastChecked = settings.lastUpdateCheck || null;

    this.configureAutoUpdater();
    this.bindAutoUpdaterEvents();
  }

  public static getInstance(storageService?: StorageService, customUpdater?: any): UpdaterService {
    if (!UpdaterService.instance) {
      UpdaterService.instance = new UpdaterService(storageService, customUpdater);
    }
    return UpdaterService.instance;
  }

  private configureAutoUpdater(): void {
    if (!this.updater) return;

    // SECURITY & REQUIREMENT: Never auto-download updates without user consent.
    this.updater.autoDownload = false;
    this.updater.autoInstallOnAppQuit = false;
    this.updater.allowDowngrade = false;

    // Apply release channel
    this.applyChannelSettings(this.channel);

    // Disable full file download if differential is supported, but fall back safely
    this.updater.disableDifferentialDownload = false;

    // Logger
    this.updater.logger = {
      info: (message: any) => console.log(`[AutoUpdater INFO] ${message}`),
      warn: (message: any) => console.warn(`[AutoUpdater WARN] ${message}`),
      error: (message: any) => console.error(`[AutoUpdater ERROR] ${message}`),
      debug: (message: any) => console.debug(`[AutoUpdater DEBUG] ${message}`),
    };
  }

  private applyChannelSettings(channel: ReleaseChannel): void {
    this.channel = channel;
    if (this.updater) {
      this.updater.channel = channel === 'stable' ? 'latest' : channel;
      this.updater.allowPrerelease = channel === 'beta' || channel === 'development';
    }
  }

  private bindAutoUpdaterEvents(): void {
    if (!this.updater || typeof this.updater.on !== 'function') return;

    this.updater.on('checking-for-update', () => {
      this.downloadedUpdateFilePath = null;
      this.transitionTo('Checking');
    });

    this.updater.on('update-available', (info: ElectronUpdateInfo) => {
      const parsedNotes = this.normalizeReleaseNotes(info.releaseNotes);
      const updateData: UpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: (info as any).releaseName || `Release v${info.version}`,
        releaseNotes: parsedNotes,
        channel: this.channel,
      };

      this.currentUpdateInfo = updateData;
      this.currentError = null;
      this.transitionTo('Update Available');
      this.emit('update-available', updateData);

      // If reminder is active or user previously dismissed this version, avoid nag
      if (this.isReminderActive) {
        this.pendingNotificationInfo = updateData;
      } else if (this.userDismissedVersion !== info.version) {
        this.broadcastStatus();
      }
    });

    this.updater.on('update-not-available', (_info: ElectronUpdateInfo) => {
      this.currentUpdateInfo = null;
      this.currentError = null;
      this.lastChecked = Date.now();
      this.storageService.updateSettings({ lastUpdateCheck: this.lastChecked });
      this.transitionTo('Up To Date');
    });

    this.updater.on('download-progress', (progress: ProgressInfo) => {
      this.currentProgress = {
        bytesPerSecond: Math.round(progress.bytesPerSecond || 0),
        percent: Math.min(100, Math.max(0, Math.round(progress.percent * 10) / 10)),
        transferred: progress.transferred,
        total: progress.total,
      };
      this.transitionTo('Downloading');
      this.emit('download-progress', this.currentProgress);
      this.broadcastStatus();
    });

    this.updater.on('update-downloaded', (info: ElectronUpdateInfo) => {
      const parsedNotes = this.normalizeReleaseNotes(info.releaseNotes);
      this.downloadedUpdateFilePath = (info as any)?.downloadedFile || null;
      this.currentUpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: parsedNotes,
        channel: this.channel,
      };
      this.currentProgress = {
        bytesPerSecond: 0,
        percent: 100,
        transferred: 1,
        total: 1,
      };
      this.currentError = null;

      // Automatically back up user SQLite database prior to installation
      try {
        this.storageService.createDatabaseBackup(`pre_install_v${info.version}`);
      } catch (backupErr) {
        console.warn('Pre-install database backup warning:', backupErr);
      }

      this.transitionTo('Downloaded');
      this.emit('update-downloaded', this.currentUpdateInfo);
      this.broadcastStatus();
    });

    this.updater.on('error', (err: Error) => {
      console.error('[AutoUpdater Error]', err);
      if (
        process.platform === 'darwin' &&
        this.state === 'Installing' &&
        this.isMacSignatureError(err) &&
        this.tryMacFallbackZipInstall()
      ) {
        return;
      }
      const friendlyMessage = this.formatErrorMessage(err);
      this.currentError = friendlyMessage;
      this.currentProgress = null;
      this.transitionTo('Error');
      this.emit('error', err);
      this.broadcastStatus();
    });
  }

  private normalizeReleaseNotes(
    notes: string | Array<any> | undefined | null
  ): string {
    if (!notes) return 'Performance improvements, bug fixes, and stability enhancements.';
    if (typeof notes === 'string') return notes;
    if (Array.isArray(notes)) {
      return notes
        .map((n) => (typeof n === 'string' ? n : n?.note || ''))
        .filter(Boolean)
        .join('\n\n');
    }
    return String(notes);
  }

  private formatErrorMessage(err: Error): string {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('net::err_internet_disconnected') || msg.includes('enotfound') || msg.includes('econnrefused')) {
      return 'No internet connection. Please check your network and try again.';
    }
    if (msg.includes('404') || msg.includes('cannot find channel')) {
      return `No release found for the ${this.channel} channel on the update server.`;
    }
    if (msg.includes('sha512 checksum mismatch') || msg.includes('verification failed')) {
      return 'Security verification failed: Update signature or checksum did not match. Update was safely aborted.';
    }
    if (msg.includes('code signature') || msg.includes('did not pass validation')) {
      return 'macOS could not replace the unsigned app automatically. Move Appu to /Applications or download the latest DMG from appu releases.';
    }
    if (msg.includes('timed out') || msg.includes('timeout')) {
      return 'Connection timed out while checking for updates. Please try again.';
    }
    if (msg.includes('interrupted') || msg.includes('aborted')) {
      return 'Download was interrupted. You can retry downloading whenever you are ready.';
    }
    return err.message || 'An unexpected error occurred while checking for updates.';
  }

  private transitionTo(newState: UpdateState): void {
    this.state = newState;
    if (newState === 'Checking' || newState === 'Up To Date') {
      this.lastChecked = Date.now();
      this.storageService.updateSettings({ lastUpdateCheck: this.lastChecked });
    }
    this.broadcastStatus();
  }

  public init(mainWindow: BrowserWindow, options?: { startupDelayMs?: number }): void {
    this.mainWindow = mainWindow;
    const delay = options?.startupDelayMs ?? 8000;

    if (this.autoCheckEnabled) {
      if (this.initialCheckTimer) clearTimeout(this.initialCheckTimer);
      this.initialCheckTimer = setTimeout(() => {
        this.checkForUpdates(false).catch((err) => {
          console.warn('Initial automatic update check silent fail:', err);
        });
      }, delay);
    }
  }

  public async checkForUpdates(manual: boolean = false): Promise<UpdaterStatus> {
    if (this.state === 'Checking' || this.state === 'Downloading') {
      return this.getStatus();
    }

    this.currentError = null;
    this.transitionTo('Checking');

    // In development mode (!app.isPackaged), electron-updater typically throws
    // unless configured with dev-publisher. Handle gracefully.
    try {
      if (typeof app !== 'undefined' && !app.isPackaged) {
        console.log(`[AutoUpdater] App is unpackaged (development mode). Simulating check.`);
        await new Promise((res) => setTimeout(res, 500));
        this.transitionTo('Up To Date');
        return this.getStatus();
      }
    } catch {
      // In tests/headless
    }

    try {
      if (this.updater && typeof this.updater.checkForUpdates === 'function') {
        await this.updater.checkForUpdates();
      }
      return this.getStatus();
    } catch (err: any) {
      const friendly = this.formatErrorMessage(err);
      this.currentError = friendly;
      this.transitionTo('Error');
      return this.getStatus();
    }
  }

  public async downloadUpdate(): Promise<boolean> {
    if (this.state !== 'Update Available' && this.state !== 'Error') {
      return false;
    }

    this.currentError = null;
    this.transitionTo('Downloading');

    try {
      if (typeof app !== 'undefined' && !app.isPackaged) {
        // Simulate download progress for development & testing
        let progress = 0;
        const interval = setInterval(() => {
          progress += 25;
          this.currentProgress = {
            bytesPerSecond: 1024 * 1024 * 2.5,
            percent: progress,
            transferred: progress * 100000,
            total: 10000000,
          };
          this.broadcastStatus();

          if (progress >= 100) {
            clearInterval(interval);
            this.transitionTo('Downloaded');
          }
        }, 350);
        return true;
      }
    } catch {
      // In tests
    }

    try {
      if (this.updater && typeof this.updater.downloadUpdate === 'function') {
        await this.updater.downloadUpdate();
      }
      return true;
    } catch (err: any) {
      this.currentError = this.formatErrorMessage(err);
      this.transitionTo('Error');
      return false;
    }
  }

  private isMacSignatureError(err: Error | null | undefined): boolean {
    const msg = (err?.message || '').toLowerCase();
    return (
      msg.includes('code signature') ||
      msg.includes('did not pass validation') ||
      msg.includes('codesign')
    );
  }

  private getMacAppBundlePath(): string | null {
    if (process.platform !== 'darwin') return null;
    const marker = '.app/Contents/MacOS/';
    const idx = process.execPath.indexOf(marker);
    if (idx === -1) return null;
    const candidate = process.execPath.slice(0, idx + 4);
    if (!candidate.endsWith('.app') || candidate.startsWith('/Volumes/')) {
      return null;
    }
    return candidate;
  }

  private isMacAdHocOrUnsigned(bundlePath: string): boolean {
    try {
      const output = execFileSync('codesign', ['-dv', bundlePath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return !output.includes('Authority=Developer ID Application:');
    } catch (err: any) {
      const stderr = String(err?.stderr || err?.message || '');
      if (stderr.includes('Authority=Developer ID Application:')) {
        return false;
      }
      return true;
    }
  }

  private tryMacFallbackZipInstall(): boolean {
    if (process.platform !== 'darwin') return false;
    const zipPath = this.downloadedUpdateFilePath;
    if (!zipPath || !fs.existsSync(zipPath)) return false;

    const bundlePath = this.getMacAppBundlePath();
    if (!bundlePath || !fs.existsSync(bundlePath)) return false;

    try {
      fs.accessSync(path.dirname(bundlePath), fs.constants.W_OK);
    } catch {
      return false;
    }

    try {
      if (typeof this.updater?.closeServerIfExists === 'function') {
        this.updater.closeServerIfExists();
      }
    } catch {
      // ignore proxy shutdown errors
    }

    const script = [
      'PID="$1"',
      'ZIP="$2"',
      'APP_PATH="$3"',
      'i=0',
      'while kill -0 "$PID" 2>/dev/null && [ $i -lt 100 ]; do sleep 0.2; i=$((i + 1)); done',
      'TMP_DIR="$(mktemp -d /tmp/appu-update.XXXXXX)" || exit 1',
      'ditto -x -k "$ZIP" "$TMP_DIR" || { rm -rf "$TMP_DIR"; exit 1; }',
      'NEW_APP="$(find "$TMP_DIR" -maxdepth 2 -name "*.app" -type d | head -n 1)"',
      'if [ -z "$NEW_APP" ]; then rm -rf "$TMP_DIR"; exit 1; fi',
      'BACKUP="${APP_PATH}.bak"',
      'rm -rf "$BACKUP"',
      'mv "$APP_PATH" "$BACKUP" || { rm -rf "$TMP_DIR"; exit 1; }',
      'if mv "$NEW_APP" "$APP_PATH"; then',
      '  rm -rf "$BACKUP"',
      '  xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true',
      '  open -n "$APP_PATH"',
      'else',
      '  mv "$BACKUP" "$APP_PATH" 2>/dev/null || true',
      'fi',
      'rm -rf "$TMP_DIR"',
    ].join('\n');

    try {
      const child = spawn(
        '/bin/sh',
        ['-c', script, 'appu-mac-updater', String(process.pid), zipPath, bundlePath],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
      child.unref();
      setTimeout(() => {
        try {
          app.quit();
        } catch {
          // ignore in tests
        }
      }, 150);
      return true;
    } catch (err) {
      console.error('[AutoUpdater] macOS fallback swap launch failed:', err);
      return false;
    }
  }

  public quitAndInstall(): void {
    if (this.state !== 'Downloaded') {
      console.warn('quitAndInstall called but state is not Downloaded');
      return;
    }

    this.transitionTo('Installing');

    // Ensure database backup exists
    try {
      this.storageService.createDatabaseBackup('pre_restart_install');
    } catch (e) {
      console.warn('Pre-install backup error:', e);
    }

    try {
      if (typeof app !== 'undefined' && !app.isPackaged) {
        console.log('[AutoUpdater] In dev mode: quitAndInstall simulated.');
        setTimeout(() => {
          this.transitionTo('Idle');
        }, 1000);
        return;
      }
    } catch {
      // In tests
    }

    if (process.platform === 'darwin') {
      const bundlePath = this.getMacAppBundlePath();
      if (bundlePath && this.isMacAdHocOrUnsigned(bundlePath) && this.tryMacFallbackZipInstall()) {
        return;
      }
    }

    if (this.updater && typeof this.updater.quitAndInstall === 'function') {
      this.updater.quitAndInstall(false, true);
    }
  }

  public postponeUpdate(): void {
    if (this.currentUpdateInfo) {
      this.userDismissedVersion = this.currentUpdateInfo.version;
    }
    // Return to idle state for UI
    this.transitionTo('Idle');
  }

  public setReminderActive(active: boolean): void {
    this.isReminderActive = active;
    // If reminder just became inactive and we have a deferred update notification, show it now
    if (!active && this.pendingNotificationInfo) {
      const info = this.pendingNotificationInfo;
      this.pendingNotificationInfo = null;
      if (this.userDismissedVersion !== info.version) {
        this.broadcastStatus();
      }
    }
  }

  public async setChannel(channel: ReleaseChannel): Promise<boolean> {
    if (this.channel === channel) return true;
    this.applyChannelSettings(channel);
    this.storageService.updateSettings({ releaseChannel: channel });
    this.broadcastStatus();
    // Re-check updates on the new channel
    await this.checkForUpdates(true);
    return true;
  }

  public async setAutoCheck(enabled: boolean): Promise<boolean> {
    this.autoCheckEnabled = enabled;
    this.storageService.updateSettings({ autoCheckUpdates: enabled });
    this.broadcastStatus();
    return true;
  }

  public getStatus(): UpdaterStatus {
    let currentVersion = '1.0.0';
    try {
      if (typeof app !== 'undefined' && typeof app.getVersion === 'function') {
        currentVersion = app.getVersion();
      }
    } catch {
      currentVersion = '1.0.0';
    }

    return {
      state: this.state,
      currentVersion: currentVersion || '1.0.0',
      channel: this.channel,
      autoCheckEnabled: this.autoCheckEnabled,
      updateInfo: this.currentUpdateInfo,
      progress: this.currentProgress,
      error: this.currentError,
      lastChecked: this.lastChecked,
    };
  }

  public broadcastStatus(): void {
    const status = this.getStatus();
    this.emit('status-changed', status);

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater-status-changed', status);
    }
  }
}
