import { UpdaterStatus, ReleaseChannel, StorageSettings } from './updater';

export * from './updater';

export interface ScreenEdgeBumpData {
  edge: string;
  impactSpeed: number;
  hitLeft?: boolean;
  hitRight?: boolean;
  hitTop?: boolean;
  hitBottom?: boolean;
}

export interface MenuPlacement {
  horizontal: 'left' | 'right';
  vertical: 'top' | 'bottom';
}

export interface UpdaterAPI {
  checkForUpdates: (manual?: boolean) => Promise<UpdaterStatus>;
  downloadUpdate: () => Promise<boolean>;
  quitAndInstall: () => void;
  getStatus: () => Promise<UpdaterStatus>;
  getChannel: () => Promise<ReleaseChannel>;
  setChannel: (channel: ReleaseChannel) => Promise<boolean>;
  setAutoCheck: (enabled: boolean) => Promise<boolean>;
  postponeUpdate: () => void;
  onStatusChange: (callback: (status: UpdaterStatus) => void) => () => void;
}

export interface StorageAPI {
  getUserDataPath: () => Promise<string>;
  getSettings: () => Promise<StorageSettings>;
  saveSettings: (settings: Partial<StorageSettings>) => Promise<boolean>;
}

export interface DesktopAPI {
  setIgnoreMouseEvents: (ignore: boolean) => void;
  moveWindowBy: (deltaX: number, deltaY: number) => void;
  setWindowPosition: (x: number, y: number) => void;
  getScreenBounds: () => Promise<{ width: number; height: number; x: number; y: number }>;
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  onTriggerReminder: (callback: (data: { title: string; message: string; actionText?: string }) => void) => void;
  onScreenEdgeBump: (callback: (data: ScreenEdgeBumpData) => void) => void;
  showContextMenu: (options: { isPinned: boolean; isHidden: boolean }) => void;
  onContextAction: (callback: (action: string) => void) => void;
  quitApp: () => void;
  hideApp: () => void;
  showApp: () => void;
  onToggleMenu: (callback: () => void) => void;
  onVisibilityChanged: (callback: (visible: boolean) => void) => void;
  setMenuOpen: (isOpen: boolean, mode?: 'menu' | 'modal') => void;
  onMenuPlacementChanged: (callback: (placement: MenuPlacement) => void) => void;
  onRequestHide?: (callback: () => void) => void;
  onRequestShow?: (callback: () => void) => void;
  notifyHideFinished?: () => void;
  notifyReminderState?: (isActive: boolean) => void;
  updater?: UpdaterAPI;
  storage?: StorageAPI;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
