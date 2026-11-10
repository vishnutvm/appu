import { ipcMain, BrowserWindow } from 'electron';
import { isTrustedSender } from './ipc-security';
import { UpdaterService } from './updater-service';
import { StorageService } from './storage-service';
import { ReleaseChannel } from './types';

export function registerUpdaterIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  updaterService: UpdaterService,
  storageService: StorageService
): void {
  // Check for updates
  ipcMain.handle('updater:check', async (event, manual?: boolean) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return await updaterService.checkForUpdates(Boolean(manual));
  });

  // Download update
  ipcMain.handle('updater:download', async (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return await updaterService.downloadUpdate();
  });

  // Quit and install update
  ipcMain.on('updater:install', (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      console.warn('[IPC Security] Unauthorized updater:install call');
      return;
    }
    updaterService.quitAndInstall();
  });

  // Get current updater status
  ipcMain.handle('updater:get-status', (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return updaterService.getStatus();
  });

  // Get current release channel
  ipcMain.handle('updater:get-channel', (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return updaterService.getStatus().channel;
  });

  // Set release channel
  ipcMain.handle('updater:set-channel', async (event, channel: ReleaseChannel) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    const validChannels: ReleaseChannel[] = ['development', 'beta', 'stable'];
    if (!validChannels.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    return await updaterService.setChannel(channel);
  });

  // Set auto-check updates toggle
  ipcMain.handle('updater:set-auto-check', async (event, enabled: boolean) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return await updaterService.setAutoCheck(Boolean(enabled));
  });

  // Postpone update (dismiss for now)
  ipcMain.on('updater:postpone', (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      return;
    }
    updaterService.postponeUpdate();
  });

  // Storage handlers: getUserDataPath
  ipcMain.handle('storage:get-user-data-path', (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return storageService.getUserDataPath();
  });

  // Storage handlers: getSettings
  ipcMain.handle('storage:get-settings', (event) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    return storageService.getSettings();
  });

  // Storage handlers: saveSettings
  ipcMain.handle('storage:save-settings', (event, settings: any) => {
    if (!isTrustedSender(event, getMainWindow())) {
      throw new Error('Access denied: Untrusted IPC sender');
    }
    if (typeof settings !== 'object' || settings === null) {
      throw new Error('Settings must be an object');
    }
    storageService.updateSettings(settings);
    return true;
  });
}
