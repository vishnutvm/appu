import { app } from 'electron';

export const DEV_SERVER_ORIGIN = 'http://localhost:5173';

type SenderEvent = {
  sender: unknown;
  senderFrame?: { url?: string; parent?: unknown } | null;
};

type TrustedWindow = { webContents: unknown; isDestroyed: () => boolean } | null;

export function isTrustedUrl(url: string | undefined, isPackaged: boolean = app.isPackaged): boolean {
  if (!url) return false;
  if (url.startsWith('file://')) return true;
  return !isPackaged && (url === DEV_SERVER_ORIGIN || url.startsWith(`${DEV_SERVER_ORIGIN}/`));
}

/**
 * Only the top frame of Appu's own window, loaded from the bundled app (or the
 * Vite dev server in unpackaged builds), may call privileged IPC channels.
 */
export function isTrustedSender(
  event: SenderEvent,
  mainWindow: TrustedWindow,
  isPackaged: boolean = app.isPackaged
): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event.sender !== mainWindow.webContents) return false;
  const frame = event.senderFrame;
  if (!frame) return false;
  if (frame.parent) return false;
  return isTrustedUrl(frame.url, isPackaged);
}

export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:';
  } catch {
    return false;
  }
}
