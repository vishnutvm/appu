import { app, BrowserWindow, screen, ipcMain, Menu, Tray, globalShortcut, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from './storage-service';
import { UpdaterService } from './updater-service';
import { registerUpdaterIpcHandlers } from './ipc-updater';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let storageService: StorageService | null = null;
let updaterService: UpdaterService | null = null;

const COMPACT_WIDTH = 220;
const COMPACT_HEIGHT = 300;
const MENU_EXPANDED_WIDTH = 540;
const MENU_EXPANDED_HEIGHT = 380;
const MODAL_EXPANDED_WIDTH = 540;
const MODAL_EXPANDED_HEIGHT = 380;

const INSET_LEFT = 50;
const INSET_RIGHT = 50;
const INSET_BOTTOM = 42;
const INSET_TOP = 36;

let currentWindowWidth = COMPACT_WIDTH;
let currentWindowHeight = COMPACT_HEIGHT;
let compactAppuPos = { x: 0, y: 0 };
let currentMenuPlacement: { horizontal: 'left' | 'right'; vertical: 'top' | 'bottom' } = {
  horizontal: 'right',
  vertical: 'bottom',
};
let isMenuCurrentlyOpen = false;
let hideSafetyTimeout: NodeJS.Timeout | null = null;

function toggleAppuVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isVisible()) {
    // Request renderer to play smooth spawn-out / hide animation
    mainWindow.webContents.send('appu-request-hide');
    updateTrayMenu(false);

    // Fallback timer if renderer doesn't reply within 600ms
    if (hideSafetyTimeout) clearTimeout(hideSafetyTimeout);
    hideSafetyTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.hide();
        mainWindow.webContents.send('appu-visibility-changed', false);
      }
    }, 600);
  } else {
    if (hideSafetyTimeout) clearTimeout(hideSafetyTimeout);
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.webContents.send('appu-visibility-changed', true);
    mainWindow.webContents.send('appu-request-show');
    updateTrayMenu(true);
  }
}

function summonAppuHome() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (hideSafetyTimeout) clearTimeout(hideSafetyTimeout);
  if (!mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  }
  mainWindow.webContents.send('appu-visibility-changed', true);
  mainWindow.webContents.send('appu-request-show');
  mainWindow.webContents.send('context-action', 'go-home');
  updateTrayMenu(true);
}

function updateTrayMenu(isVisible: boolean) {
  if (!tray || tray.isDestroyed()) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '🤖 Appu Desktop Companion',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isVisible ? '💨 Hide Appu (⌘H)' : '👀 Show Appu (⌘H)',
      click: () => toggleAppuVisibility(),
    },
    {
      label: '⚡ Open Interaction Menu',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (!mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        }
        mainWindow.webContents.send('toggle-interaction-menu');
      },
    },
    {
      label: '🏠 Return to Home Position',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.webContents.send('context-action', 'go-home');
        }
      },
    },
    { type: 'separator' },
    {
      label: '🔄 Check for Updates...',
      click: () => {
        if (updaterService) {
          updaterService.checkForUpdates(true);
        }
      },
    },
    { type: 'separator' },
    {
      label: '❌ Quit Appu',
      role: 'quit',
    },
  ]);
  tray.setContextMenu(contextMenu);
}

function setupTray() {
  try {
    const iconPath = path.join(__dirname, '..', 'public', 'tray-icon.png');
    const image = nativeImage.createFromPath(iconPath);
    image.setTemplateImage(true);

    tray = new Tray(image);
    tray.setToolTip('Appu 3D Desktop Companion');

    tray.on('click', () => {
      toggleAppuVisibility();
    });

    updateTrayMenu(true);
  } catch (err) {
    console.error('Tray initialization error:', err);
  }
}

function setupAppMenu() {
  const isMac = process.platform === 'darwin';
  const template: any[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              {
                label: 'Check for Updates...',
                click: () => {
                  if (updaterService) {
                    updaterService.checkForUpdates(true);
                  }
                },
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (updaterService) {
              updaterService.checkForUpdates(true);
            }
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function computeMenuPlacement(
  pos: { x: number; y: number },
  targetWidth = MENU_EXPANDED_WIDTH,
  targetHeight = MENU_EXPANDED_HEIGHT
): { horizontal: 'left' | 'right'; vertical: 'top' | 'bottom' } {
  try {
    const activeDisplay = screen.getDisplayNearestPoint({
      x: pos.x + COMPACT_WIDTH / 2,
      y: pos.y + COMPACT_HEIGHT / 2,
    });
    const bounds = activeDisplay.bounds;
    const menuWidthNeeded = targetWidth - COMPACT_WIDTH;
    const spaceOnRight = bounds.x + bounds.width + INSET_RIGHT - (pos.x + COMPACT_WIDTH);
    const placementHorizontal = spaceOnRight >= menuWidthNeeded ? 'right' : 'left';

    const heightDiff = targetHeight - COMPACT_HEIGHT;
    const spaceOnTop = pos.y - bounds.y + INSET_TOP;
    const placementVertical = spaceOnTop >= heightDiff ? 'bottom' : 'top';

    return { horizontal: placementHorizontal, vertical: placementVertical };
  } catch {
    return { horizontal: 'left', vertical: 'bottom' };
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: displayX, y: displayY } = primaryDisplay.bounds;

  // Position in the Home Corner (bottom-right: Appu feet directly on bottom surface, right side at corner)
  const initialX = Math.round(displayX + screenWidth - COMPACT_WIDTH + INSET_RIGHT - 10);
  const initialY = Math.round(displayY + screenHeight - COMPACT_HEIGHT + INSET_BOTTOM);
  compactAppuPos = { x: initialX, y: initialY };
  currentMenuPlacement = computeMenuPlacement(compactAppuPos);

  mainWindow = new BrowserWindow({
    width: COMPACT_WIDTH,
    height: COMPACT_HEIGHT,
    x: initialX,
    y: initialY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    movable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: fs.existsSync(path.join(__dirname, 'preload.cjs'))
        ? path.join(__dirname, 'preload.cjs')
        : path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Keep window reliably above regular apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  const devUrl = 'http://localhost:5173/?mode=companion';
  mainWindow.loadURL(devUrl).catch(() => {
    mainWindow?.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { mode: 'companion' },
    });
  });

  // Default to mouse passthrough so clicks pass through to apps underneath
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('menu-placement-changed', currentMenuPlacement);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupTray();
  setupAppMenu();
}

// IPC Handlers with robust argument validation and error boundaries
ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
    }
  } catch (err) {
    console.error('set-ignore-mouse-events error:', err);
  }
});

ipcMain.on('set-menu-open', (event, isOpen: boolean, mode: 'menu' | 'modal' = 'menu') => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    if (isOpen) {
      isMenuCurrentlyOpen = true;
      const targetExpandedWidth = mode === 'modal' ? MODAL_EXPANDED_WIDTH : MENU_EXPANDED_WIDTH;
      const targetExpandedHeight = mode === 'modal' ? MODAL_EXPANDED_HEIGHT : MENU_EXPANDED_HEIGHT;

      currentWindowWidth = targetExpandedWidth;
      currentWindowHeight = targetExpandedHeight;

      const activeDisplay = screen.getDisplayNearestPoint({
        x: compactAppuPos.x + COMPACT_WIDTH / 2,
        y: compactAppuPos.y + COMPACT_HEIGHT / 2,
      });
      const bounds = activeDisplay.bounds;

      currentMenuPlacement = computeMenuPlacement(compactAppuPos, targetExpandedWidth, targetExpandedHeight);
      win.webContents.send('menu-placement-changed', currentMenuPlacement);

      const menuWidthNeeded = targetExpandedWidth - COMPACT_WIDTH;
      let targetX =
        currentMenuPlacement.horizontal === 'right'
          ? compactAppuPos.x
          : compactAppuPos.x - menuWidthNeeded;

      const minTargetX = bounds.x - INSET_LEFT;
      const maxTargetX = bounds.x + bounds.width - targetExpandedWidth + INSET_RIGHT;
      targetX = Math.max(minTargetX, Math.min(maxTargetX, targetX));

      const heightDiff = targetExpandedHeight - COMPACT_HEIGHT;
      let targetY =
        currentMenuPlacement.vertical === 'bottom'
          ? compactAppuPos.y - heightDiff
          : compactAppuPos.y;

      const minTargetY = bounds.y - INSET_TOP;
      const maxTargetY = bounds.y + bounds.height - targetExpandedHeight + INSET_BOTTOM;
      targetY = Math.max(minTargetY, Math.min(maxTargetY, targetY));

      win.setBounds({
        x: Math.round(targetX),
        y: Math.round(targetY),
        width: targetExpandedWidth,
        height: targetExpandedHeight,
      });
    } else {
      isMenuCurrentlyOpen = false;
      currentWindowWidth = COMPACT_WIDTH;
      currentWindowHeight = COMPACT_HEIGHT;

      win.setBounds({
        x: Math.round(compactAppuPos.x),
        y: Math.round(compactAppuPos.y),
        width: COMPACT_WIDTH,
        height: COMPACT_HEIGHT,
      });
    }
  } catch (err) {
    console.error('set-menu-open error:', err);
  }
});

let lastBumpTime = 0;

ipcMain.on('move-window-by', (event, deltaX: number, deltaY: number) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    const dX = Math.round(Number(deltaX));
    const dY = Math.round(Number(deltaY));
    if (!Number.isFinite(dX) || !Number.isFinite(dY)) return;

    const rawNewX = compactAppuPos.x + dX;
    const rawNewY = compactAppuPos.y + dY;

    const centerX = Math.round(rawNewX + COMPACT_WIDTH / 2);
    const centerY = Math.round(rawNewY + COMPACT_HEIGHT / 2);

    let activeDisplay = screen.getPrimaryDisplay();
    try {
      if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
        activeDisplay = screen.getDisplayNearestPoint({ x: centerX, y: centerY });
      }
    } catch {
      activeDisplay = screen.getPrimaryDisplay();
    }

    const bounds = activeDisplay.bounds;

    // Use top-level character visual insets (INSET_LEFT, INSET_RIGHT, INSET_BOTTOM, INSET_TOP)
    const minX = Math.round(bounds.x - INSET_LEFT);
    const maxX = Math.round(bounds.x + bounds.width - COMPACT_WIDTH + INSET_RIGHT);
    const minY = Math.round(bounds.y - INSET_TOP);
    const maxY = Math.round(bounds.y + bounds.height - COMPACT_HEIGHT + INSET_BOTTOM);

    const clampedX = Math.max(minX, Math.min(maxX, rawNewX));
    const clampedY = Math.max(minY, Math.min(maxY, rawNewY));

    const hitLeft = rawNewX <= minX;
    const hitRight = rawNewX >= maxX;
    const hitTop = rawNewY <= minY;
    const hitBottom = rawNewY >= maxY;

    if (hitLeft || hitRight || hitTop || hitBottom) {
      const now = Date.now();
      if (now - lastBumpTime > 350) {
        lastBumpTime = now;
        let edge = 'left';
        if ((hitLeft || hitRight) && (hitTop || hitBottom)) {
          edge = 'corner';
        } else if (hitLeft) edge = 'left';
        else if (hitRight) edge = 'right';
        else if (hitTop) edge = 'top';
        else if (hitBottom) edge = 'bottom';

        const impactSpeed = Math.hypot(dX, dY);
        win.webContents.send('screen-edge-bump', {
          edge,
          impactSpeed,
          hitLeft,
          hitRight,
          hitTop,
          hitBottom,
        });
      }
    }

    compactAppuPos = { x: clampedX, y: clampedY };

    const updatedPlacement = computeMenuPlacement(compactAppuPos);
    if (
      updatedPlacement.horizontal !== currentMenuPlacement.horizontal ||
      updatedPlacement.vertical !== currentMenuPlacement.vertical
    ) {
      currentMenuPlacement = updatedPlacement;
      win.webContents.send('menu-placement-changed', currentMenuPlacement);
    }

    if (!isMenuCurrentlyOpen) {
      win.setBounds({
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        width: COMPACT_WIDTH,
        height: COMPACT_HEIGHT,
      });
    }
  } catch (err) {
    console.error('move-window-by error:', err);
  }
});

ipcMain.on('set-window-position', (event, x: number, y: number) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    const targetX = Math.round(Number(x));
    const targetY = Math.round(Number(y));
    if (Number.isFinite(targetX) && Number.isFinite(targetY)) {
      compactAppuPos = { x: targetX, y: targetY };

      const updatedPlacement = computeMenuPlacement(compactAppuPos);
      if (
        updatedPlacement.horizontal !== currentMenuPlacement.horizontal ||
        updatedPlacement.vertical !== currentMenuPlacement.vertical
      ) {
        currentMenuPlacement = updatedPlacement;
        win.webContents.send('menu-placement-changed', currentMenuPlacement);
      }

      if (!isMenuCurrentlyOpen) {
        win.setBounds({
          x: targetX,
          y: targetY,
          width: COMPACT_WIDTH,
          height: COMPACT_HEIGHT,
        });
      }
    }
  } catch (err) {
    console.error('set-window-position error:', err);
  }
});

ipcMain.handle('get-screen-bounds', () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    return primaryDisplay.bounds;
  } catch (err) {
    console.error('get-screen-bounds error:', err);
    return { width: 1440, height: 900, x: 0, y: 0 };
  }
});

ipcMain.handle('get-window-position', (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      return { x: Math.round(compactAppuPos.x), y: Math.round(compactAppuPos.y) };
    }
    return { x: 0, y: 0 };
  } catch (err) {
    console.error('get-window-position error:', err);
    return { x: 0, y: 0 };
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

ipcMain.on('hide-app', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('appu-request-hide');
  }
});

ipcMain.on('hide-app-finished', () => {
  if (hideSafetyTimeout) {
    clearTimeout(hideSafetyTimeout);
    hideSafetyTimeout = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    mainWindow.webContents.send('appu-visibility-changed', false);
    updateTrayMenu(false);
  }
});

ipcMain.on('show-app', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow.webContents.send('appu-visibility-changed', true);
    updateTrayMenu(true);
  }
});

ipcMain.on('show-context-menu', (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.webContents.send('toggle-interaction-menu');
    }
  } catch (err) {
    console.error('show-context-menu error:', err);
  }
});

ipcMain.on('reminder-state-changed', (_event, isActive: boolean) => {
  if (updaterService) {
    updaterService.setReminderActive(Boolean(isActive));
  }
});

app.whenReady().then(() => {
  // Initialize services and secure IPC handlers
  storageService = StorageService.getInstance();
  updaterService = UpdaterService.getInstance(storageService);
  registerUpdaterIpcHandlers(() => mainWindow, updaterService, storageService);

  createWindow();

  if (mainWindow && updaterService) {
    updaterService.init(mainWindow, { startupDelayMs: 8000 });
  }

  // Global shortcuts for showing / hiding Appu and opening interaction menu
  try {
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      toggleAppuVisibility();
    });
    globalShortcut.register('CommandOrControl+H', () => {
      toggleAppuVisibility();
    });
    globalShortcut.register('CommandOrControl+0', () => {
      summonAppuHome();
    });
    globalShortcut.register('CommandOrControl+Shift+H', () => {
      summonAppuHome();
    });
  } catch (err) {
    console.error('globalShortcut registration error:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
