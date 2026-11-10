import { describe, it, expect } from 'vitest';
import { resolveCompanionEntry } from '../../electron/companion-entry';
import { DEV_SERVER_ORIGIN } from '../../electron/ipc-security';

describe('resolveCompanionEntry', () => {
  const bundled = '/Applications/Appu.app/Contents/Resources/app.asar/dist/index.html';

  it('uses loadFile/file entry only when packaged (never localhost)', () => {
    const entry = resolveCompanionEntry(true, bundled);
    expect(entry).toEqual({
      kind: 'file',
      filePath: bundled,
      query: { mode: 'companion' },
    });
    expect(JSON.stringify(entry)).not.toContain('localhost');
    expect(JSON.stringify(entry)).not.toContain('5173');
    expect(JSON.stringify(entry)).not.toContain(DEV_SERVER_ORIGIN);
  });

  it('prefers the Vite localhost URL when unpackaged/dev', () => {
    const entry = resolveCompanionEntry(false, bundled);
    expect(entry).toEqual({
      kind: 'url',
      url: `${DEV_SERVER_ORIGIN}/?mode=companion`,
    });
  });
});
