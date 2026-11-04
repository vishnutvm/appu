import { contextBridge, ipcRenderer } from 'electron';
import { UpdaterStatus, ReleaseChannel, StorageSettings } from './types';

contextBridge.exposeInMainWorld('desktopAPI', {
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  moveWindowBy: (deltaX: number, deltaY: number) => {
    ipcRenderer.send('move-window-by', deltaX, deltaY);
  },
  setWindowPosition: (x: number, y: number) => {
    ipcRenderer.send('set-window-position', x, y);
  },
  getScreenBounds: (): Promise<{ width: number; height: number; x: number; y: number }> => {
    return ipcRenderer.invoke('get-screen-bounds');
  },
  getWindowPosition: (): Promise<{ x: number; y: number }> => {
    return ipcRenderer.invoke('get-window-position');
  },
  onTriggerReminder: (callback: (data: { title: string; message: string; actionText?: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('trigger-reminder', listener);
    return () => {
      ipcRenderer.removeListener('trigger-reminder', listener);
    };
  },
  onScreenEdgeBump: (callback: (data: { edge: string; impactSpeed: number; hitLeft?: boolean; hitRight?: boolean; hitTop?: boolean; hitBottom?: boolean }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('screen-edge-bump', listener);
    return () => {
      ipcRenderer.removeListener('screen-edge-bump', listener);
    };
  },
  showContextMenu: (options: { isPinned: boolean; isHidden: boolean }) => {
    ipcRenderer.send('show-context-menu', options);
  },
  onContextAction: (callback: (action: string) => void) => {
    const listener = (_event: any, action: any) => callback(action);
    ipcRenderer.on('context-action', listener);
    return () => {
      ipcRenderer.removeListener('context-action', listener);
    };
  },
  quitApp: () => {
    ipcRenderer.send('quit-app');
  },
  hideApp: () => {
    ipcRenderer.send('hide-app');
  },
  showApp: () => {
    ipcRenderer.send('show-app');
  },
  onToggleMenu: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-interaction-menu', listener);
    return () => {
      ipcRenderer.removeListener('toggle-interaction-menu', listener);
    };
  },
  onVisibilityChanged: (callback: (visible: boolean) => void) => {
    const listener = (_event: any, visible: boolean) => callback(visible);
    ipcRenderer.on('appu-visibility-changed', listener);
    return () => {
      ipcRenderer.removeListener('appu-visibility-changed', listener);
    };
  },
  setMenuOpen: (isOpen: boolean, mode?: 'menu' | 'modal') => {
    ipcRenderer.send('set-menu-open', isOpen, mode);
  },
  onMenuPlacementChanged: (callback: (placement: { horizontal: 'left' | 'right'; vertical: 'top' | 'bottom' }) => void) => {
    const listener = (_event: any, placement: any) => callback(placement);
    ipcRenderer.on('menu-placement-changed', listener);
    return () => {
      ipcRenderer.removeListener('menu-placement-changed', listener);
    };
  },
  onRequestHide: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('appu-request-hide', listener);
    return () => {
      ipcRenderer.removeListener('appu-request-hide', listener);
    };
  },
  onRequestShow: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('appu-request-show', listener);
    return () => {
      ipcRenderer.removeListener('appu-request-show', listener);
    };
  },
  notifyHideFinished: () => {
    ipcRenderer.send('hide-app-finished');
  },
  notifyReminderState: (isActive: boolean) => {
    ipcRenderer.send('reminder-state-changed', isActive);
  },

  // Secure Updater Bridge
  updater: {
    checkForUpdates: (manual?: boolean): Promise<UpdaterStatus> => {
      return ipcRenderer.invoke('updater:check', manual);
    },
    downloadUpdate: (): Promise<boolean> => {
      return ipcRenderer.invoke('updater:download');
    },
    quitAndInstall: () => {
      ipcRenderer.send('updater:install');
    },
    getStatus: (): Promise<UpdaterStatus> => {
      return ipcRenderer.invoke('updater:get-status');
    },
    getChannel: (): Promise<ReleaseChannel> => {
      return ipcRenderer.invoke('updater:get-channel');
    },
    setChannel: (channel: ReleaseChannel): Promise<boolean> => {
      return ipcRenderer.invoke('updater:set-channel', channel);
    },
    setAutoCheck: (enabled: boolean): Promise<boolean> => {
      return ipcRenderer.invoke('updater:set-auto-check', enabled);
    },
    postponeUpdate: () => {
      ipcRenderer.send('updater:postpone');
    },
    onStatusChange: (callback: (status: UpdaterStatus) => void): (() => void) => {
      const listener = (_event: any, status: UpdaterStatus) => callback(status);
      ipcRenderer.on('updater-status-changed', listener);
      return () => {
        ipcRenderer.removeListener('updater-status-changed', listener);
      };
    },
  },

  // Storage and User Data Bridge
  storage: {
    getUserDataPath: (): Promise<string> => {
      return ipcRenderer.invoke('storage:get-user-data-path');
    },
    getSettings: (): Promise<StorageSettings> => {
      return ipcRenderer.invoke('storage:get-settings');
    },
    saveSettings: (settings: Partial<StorageSettings>): Promise<boolean> => {
      return ipcRenderer.invoke('storage:save-settings', settings);
    },
  },
});
