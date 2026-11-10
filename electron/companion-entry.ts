import { DEV_SERVER_ORIGIN } from './ipc-security';

export type CompanionEntry =
  | { kind: 'file'; filePath: string; query: { mode: 'companion' } }
  | { kind: 'url'; url: string };

/**
 * Packaged builds must load the bundled HTML only — never probe the Vite
 * localhost origin. Unpackaged/dev keeps the Vite URL with a file fallback.
 */
export function resolveCompanionEntry(isPackaged: boolean, bundledIndexHtml: string): CompanionEntry {
  if (isPackaged) {
    return {
      kind: 'file',
      filePath: bundledIndexHtml,
      query: { mode: 'companion' },
    };
  }

  return {
    kind: 'url',
    url: `${DEV_SERVER_ORIGIN}/?mode=companion`,
  };
}
