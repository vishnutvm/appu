import { BrowserWindow } from 'electron';

export type AIActivityState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'waiting_approval'
  | 'responding'
  | 'error';

export interface AIStateEvent {
  state: AIActivityState;
  detail?: string;
  timestamp: number;
}

export class CharacterStateService {
  private static instance: CharacterStateService | null = null;
  private currentState: AIActivityState = 'idle';
  private getWindow: () => BrowserWindow | null;
  private listeners: Set<(event: AIStateEvent) => void> = new Set();

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;
  }

  public static getInstance(getWindow?: () => BrowserWindow | null): CharacterStateService {
    if (!CharacterStateService.instance) {
      if (!getWindow) {
        throw new Error('CharacterStateService requires getWindow callback on initial call');
      }
      CharacterStateService.instance = new CharacterStateService(getWindow);
    }
    return CharacterStateService.instance;
  }

  public getState(): AIActivityState {
    return this.currentState;
  }

  public setState(state: AIActivityState, detail?: string): void {
    this.currentState = state;
    const event: AIStateEvent = {
      state,
      detail,
      timestamp: Date.now(),
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in character state listener:', err);
      }
    }

    try {
      const win = typeof this.getWindow === 'function' ? this.getWindow() : null;
      if (win && !win.isDestroyed()) {
        win.webContents.send('appu-ai-state-changed', event);
      }
    } catch (err) {
      console.warn('Failed to dispatch appu-ai-state-changed to renderer:', err);
    }
  }

  public subscribe(listener: (event: AIStateEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
