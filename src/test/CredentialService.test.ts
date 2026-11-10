import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CredentialService } from '../../electron/services/credential-service';

describe('CredentialService', () => {
  let tempDir: string;
  let service: CredentialService;
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appu-cred-test-'));
    delete process.env.GEMINI_API_KEY;
    service = new CredentialService(tempDir);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('detects when no API key is configured', () => {
    expect(service.hasApiKey()).toBe(false);
    expect(service.getApiKey()).toBeNull();
  });

  it('prefers environment variable if set', () => {
    process.env.GEMINI_API_KEY = 'AIzaSyEnvKey12345';
    expect(service.hasApiKey()).toBe(true);
    expect(service.getApiKey()).toBe('AIzaSyEnvKey12345');
  });

  it('stores and retrieves API key via protected file fallback', () => {
    const success = service.setApiKey('AIzaSyStoredKey98765');
    expect(success).toBe(true);
    expect(service.hasApiKey()).toBe(true);
    expect(service.getApiKey()).toBe('AIzaSyStoredKey98765');
  });

  it('clears API key properly', () => {
    service.setApiKey('AIzaSyToClear');
    expect(service.hasApiKey()).toBe(true);

    service.clearApiKey();
    expect(service.hasApiKey()).toBe(false);
    expect(service.getApiKey()).toBeNull();
  });
});
