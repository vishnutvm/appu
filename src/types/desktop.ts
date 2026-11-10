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

export interface AIStatus {
  enabled: boolean;
  provider: string;
  model: string;
  hasApiKey: boolean;
  keySource?: 'settings' | 'environment' | null;
  isSecureStorageAvailable: boolean;
  error?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: { id: string; name: string; args: Record<string, any> }[];
  toolResults?: { toolCallId: string; name: string; result: any; error?: string }[];
  createdAt: number;
}

export interface AIMemoryItem {
  id: string;
  content: string;
  category: string;
  importance: number;
  metadata?: string | null;
  created_at: number;
  updated_at: number;
}

export interface AIStateChangedEvent {
  state: 'idle' | 'listening' | 'thinking' | 'executing' | 'waiting_approval' | 'responding' | 'error';
  detail?: string;
  timestamp: number;
}

export interface AI_API {
  sendMessage: (payload: { conversationId?: string; text: string }) => Promise<{
    conversationId?: string;
    userMessageId?: string;
    assistantMessageId?: string;
    response?: string;
    error?: string;
    toolCallsExecuted?: { name: string; args: any; result: any; error?: string }[];
  }>;
  getConversation: (conversationId?: string) => Promise<{
    conversation?: { id: string; title: string };
    messages?: AIChatMessage[];
    error?: string;
  }>;
  createConversation: (title?: string) => Promise<{ success: boolean; conversation?: any }>;
  clearConversation: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<AIStatus>;
  setConfig: (config: {
    enabled?: boolean;
    model?: string;
    apiKey?: string;
    clearKey?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  testConnection: () => Promise<{ valid: boolean; error?: string }>;
  getMemories: (query?: string) => Promise<AIMemoryItem[]>;
  deleteMemory: (memoryId: string) => Promise<{ success: boolean }>;
  saveMemory: (payload: { content: string; category?: string; importance?: number }) => Promise<any>;
  getReminders: () => Promise<any[]>;
  syncReminders: (reminders: any[]) => Promise<{ success: boolean }>;
  deleteReminder: (reminderId: string) => Promise<{ success: boolean }>;
  completeReminder?: (reminderId: string) => Promise<{ success: boolean }>;
  snoozeReminder?: (reminderId: string, minutes?: number) => Promise<{ success: boolean }>;
  clearReminders: () => Promise<{ success: boolean }>;
  notifyRemindersReady?: () => Promise<{ success: boolean }>;
  onStateChanged: (callback: (data: AIStateChangedEvent) => void) => () => void;
  onRemindersSynced: (callback: (reminders: any[]) => void) => () => void;
  onOpenSettings?: (callback: () => void) => () => void;
}

export interface DesktopAPI {
  setIgnoreMouseEvents: (ignore: boolean) => void;
  moveWindowBy: (deltaX: number, deltaY: number, allowOffscreen?: boolean) => void;
  setWindowPosition: (x: number, y: number) => void;
  getScreenBounds: () => Promise<{ width: number; height: number; x: number; y: number }>;
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  onTriggerReminder: (callback: (data: any) => void) => () => void;
  onScreenEdgeBump: (callback: (data: ScreenEdgeBumpData) => void) => () => void;
  showContextMenu: (options: { isPinned: boolean; isHidden: boolean }) => void;
  onContextAction: (callback: (action: string) => void) => () => void;
  quitApp: () => void;
  hideApp: () => void;
  showApp: () => void;
  onToggleMenu: (callback: () => void) => () => void;
  onVisibilityChanged: (callback: (visible: boolean) => void) => () => void;
  setMenuOpen: (isOpen: boolean, mode?: 'menu' | 'modal' | 'chat') => void;
  getMenuPlacement?: () => Promise<MenuPlacement>;
  onMenuPlacementChanged: (callback: (placement: MenuPlacement) => void) => () => void;
  onRequestHide?: (callback: () => void) => () => void;
  onRequestShow?: (callback: () => void) => () => void;
  notifyHideFinished?: () => void;
  notifyReminderState?: (isActive: boolean) => void;
  updater?: UpdaterAPI;
  storage?: StorageAPI;
  ai?: AI_API;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}
