import { describe, it, expect } from 'vitest';
import { isTrustedSender, isTrustedUrl, isSafeExternalUrl } from '../../electron/ipc-security';

describe('IPC Security & Sender Validation', () => {
  const mockWebContents = { id: 1 };
  const mockMainWindow = {
    webContents: mockWebContents,
    isDestroyed: () => false,
  };
  const topFrame = (url: string) => ({ parent: null, url });

  it('approves the bundled app top frame', () => {
    const event = { sender: mockWebContents, senderFrame: topFrame('file:///Applications/Appu.app/dist/index.html') };
    expect(isTrustedSender(event, mockMainWindow, true)).toBe(true);
  });

  it('approves the Vite dev server only in unpackaged builds', () => {
    const event = { sender: mockWebContents, senderFrame: topFrame('http://localhost:5173/?mode=companion') };
    expect(isTrustedSender(event, mockMainWindow, false)).toBe(true);
    expect(isTrustedSender(event, mockMainWindow, true)).toBe(false);
  });

  it('rejects look-alike origins', () => {
    expect(isTrustedUrl('http://localhost:51730/', false)).toBe(false);
    expect(isTrustedUrl('https://evil.example/index.html', false)).toBe(false);
    expect(isTrustedUrl(undefined, false)).toBe(false);
  });

  it('rejects requests from foreign or untrusted webContents', () => {
    const event = { sender: { id: 99 }, senderFrame: topFrame('file:///app/index.html') };
    expect(isTrustedSender(event, mockMainWindow, true)).toBe(false);
  });

  it('rejects requests originating from nested child iframes', () => {
    const event = {
      sender: mockWebContents,
      senderFrame: { parent: { id: 'top' }, url: 'file:///app/index.html' },
    };
    expect(isTrustedSender(event, mockMainWindow, true)).toBe(false);
  });

  it('rejects requests without a sender frame', () => {
    expect(isTrustedSender({ sender: mockWebContents, senderFrame: null }, mockMainWindow, true)).toBe(false);
  });

  it('rejects requests when main window is destroyed or null', () => {
    const event = { sender: mockWebContents, senderFrame: topFrame('file:///app/index.html') };
    expect(isTrustedSender(event, null, true)).toBe(false);
    expect(isTrustedSender(event, { webContents: mockWebContents, isDestroyed: () => true }, true)).toBe(false);
  });

  it('only opens http(s) and mailto links externally', () => {
    expect(isSafeExternalUrl('https://example.com')).toBe(true);
    expect(isSafeExternalUrl('mailto:hi@example.com')).toBe(true);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
  });
});
