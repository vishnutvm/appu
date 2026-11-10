import { contextBridge, ipcRenderer } from 'electron';
import { UpdaterStatus, ReleaseChannel, StorageSettings } from './types';

contextBridge.exposeInMainWorld('desktopAPI', {
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore);
  },
  moveWindowBy: (deltaX: number, deltaY: number, allowOffscreen?: boolean) => {
    ipcRenderer.send('move-window-by', deltaX, deltaY, allowOffscreen);
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
  setMenuOpen: (isOpen: boolean, mode?: 'menu' | 'modal' | 'chat') => {
    ipcRenderer.send('set-menu-open', isOpen, mode);
  },
  getMenuPlacement: (): Promise<{ horizontal: 'left' | 'right'; vertical: 'top' | 'bottom' }> => {
    return ipcRenderer.invoke('get-menu-placement');
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

  // Intelligent AI Brain Bridge (Google Gemini)
  ai: {
    sendMessage: (payload: { conversationId?: string; text: string }): Promise<any> => {
      return ipcRenderer.invoke('ai:send-message', payload);
    },
    getConversation: (conversationId?: string): Promise<any> => {
      return ipcRenderer.invoke('ai:get-conversation', conversationId);
    },
    createConversation: (title?: string): Promise<any> => {
      return ipcRenderer.invoke('ai:create-conversation', title);
    },
    clearConversation: (conversationId: string): Promise<any> => {
      return ipcRenderer.invoke('ai:clear-conversation', conversationId);
    },
    getStatus: (): Promise<{
      enabled: boolean;
      provider: string;
      model: string;
      hasApiKey: boolean;
      isSecureStorageAvailable: boolean;
      error?: string;
    }> => {
      return ipcRenderer.invoke('ai:get-status');
    },
    setConfig: (config: {
      enabled?: boolean;
      model?: string;
      apiKey?: string;
      clearKey?: boolean;
    }): Promise<{ success: boolean; error?: string }> => {
      return ipcRenderer.invoke('ai:set-config', config);
    },
    testConnection: (): Promise<{ valid: boolean; error?: string }> => {
      return ipcRenderer.invoke('ai:test-connection');
    },
    getMemories: (query?: string): Promise<any[]> => {
      return ipcRenderer.invoke('ai:get-memories', query);
    },
    deleteMemory: (memoryId: string): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:delete-memory', memoryId);
    },
    saveMemory: (payload: { content: string; category?: string; importance?: number }): Promise<any> => {
      return ipcRenderer.invoke('ai:save-memory', payload);
    },
    getReminders: (): Promise<any[]> => {
      return ipcRenderer.invoke('ai:get-reminders');
    },
    syncReminders: (reminders: any[]): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:sync-reminders-from-renderer', reminders);
    },
    deleteReminder: (reminderId: string): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:delete-reminder', reminderId);
    },
    completeReminder: (reminderId: string): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:complete-reminder', reminderId);
    },
    snoozeReminder: (reminderId: string, minutes: number = 5): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:snooze-reminder', reminderId, minutes);
    },
    clearReminders: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:clear-reminders');
    },
    notifyRemindersReady: (): Promise<{ success: boolean }> => {
      return ipcRenderer.invoke('ai:reminders-ready');
    },
    onStateChanged: (callback: (data: { state: string; detail?: string; timestamp: number }) => void): (() => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('appu-ai-state-changed', listener);
      return () => {
        ipcRenderer.removeListener('appu-ai-state-changed', listener);
      };
    },
    onRemindersSynced: (callback: (reminders: any[]) => void): (() => void) => {
      const listener = (_event: any, data: any) => callback(data);
      ipcRenderer.on('appu-reminders-synced', listener);
      return () => {
        ipcRenderer.removeListener('appu-reminders-synced', listener);
      };
    },
    onOpenSettings: (callback: () => void): (() => void) => {
      const listener = () => callback();
      ipcRenderer.on('open-settings-modal', listener);
      return () => {
        ipcRenderer.removeListener('open-settings-modal', listener);
      };
    },
  },
});
