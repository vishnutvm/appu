import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('electron', () => {
  const app = {
    getVersion: () => '1.0.0',
    getPath: (name: string) => `/tmp/appu-mock-${name}`,
    isPackaged: false,
    name: 'Appu',
    on: vi.fn(),
    whenReady: () => Promise.resolve(),
    quit: vi.fn(),
  };

  return {
    default: { app },
    app,
    BrowserWindow: class {
      webContents = { send: vi.fn() };
      isDestroyed = () => false;
      show = vi.fn();
      hide = vi.fn();
      setAlwaysOnTop = vi.fn();
      setBounds = vi.fn();
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
    },
    screen: {
      getPrimaryDisplay: () => ({ workArea: { width: 1440, height: 900, x: 0, y: 0 } }),
      getDisplayNearestPoint: () => ({ workArea: { width: 1440, height: 900, x: 0, y: 0 } }),
    },
    Menu: {
      buildFromTemplate: vi.fn(() => ({})),
      setApplicationMenu: vi.fn(),
    },
    Tray: class {
      setToolTip = vi.fn();
      setContextMenu = vi.fn();
      on = vi.fn();
      isDestroyed = () => false;
    },
    globalShortcut: {
      register: vi.fn(),
      unregisterAll: vi.fn(),
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({ setTemplateImage: vi.fn() })),
    },
  };
});

vi.mock('electron-updater', () => {
  return {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      allowDowngrade: false,
      channel: 'latest',
      on: vi.fn(),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      downloadUpdate: vi.fn().mockResolvedValue(null),
      quitAndInstall: vi.fn(),
    },
  };
});
