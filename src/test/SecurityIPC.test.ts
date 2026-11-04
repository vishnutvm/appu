import { describe, it, expect, vi } from 'vitest';

describe('IPC Security & Sender Validation', () => {
  // Extract and test the validation logic
  function isTrustedSender(
    event: { sender: any; senderFrame?: any },
    mainWindow: { webContents: any; isDestroyed: () => boolean } | null
  ): boolean {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return false;
    }
    if (event.sender !== mainWindow.webContents) {
      return false;
    }
    if (event.senderFrame && event.senderFrame.parent !== null) {
      return false;
    }
    return true;
  }

  const mockWebContents = { id: 1 };
  const mockMainWindow = {
    webContents: mockWebContents,
    isDestroyed: () => false,
  };

  it('approves requests originating from the trusted main window top frame', () => {
    const validEvent = {
      sender: mockWebContents,
      senderFrame: { parent: null },
    };
    expect(isTrustedSender(validEvent, mockMainWindow)).toBe(true);
  });

  it('rejects requests from foreign or untrusted webContents', () => {
    const rogueWebContents = { id: 99 };
    const invalidEvent = {
      sender: rogueWebContents,
      senderFrame: { parent: null },
    };
    expect(isTrustedSender(invalidEvent, mockMainWindow)).toBe(false);
  });

  it('rejects requests originating from nested child iframes', () => {
    const childFrameEvent = {
      sender: mockWebContents,
      senderFrame: { parent: { id: 'top' } },
    };
    expect(isTrustedSender(childFrameEvent, mockMainWindow)).toBe(false);
  });

  it('rejects requests when main window is destroyed or null', () => {
    const validEvent = {
      sender: mockWebContents,
      senderFrame: { parent: null },
    };
    expect(isTrustedSender(validEvent, null)).toBe(false);

    const destroyedWindow = {
      webContents: mockWebContents,
      isDestroyed: () => true,
    };
    expect(isTrustedSender(validEvent, destroyedWindow)).toBe(false);
  });
});
