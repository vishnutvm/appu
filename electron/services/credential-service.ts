import * as fs from 'fs';
import * as path from 'path';
import { safeStorage } from 'electron';

export class CredentialService {
  private static instance: CredentialService | null = null;
  private secretFilePath: string;
  private fallbackSecretFilePath: string;

  constructor(userDataPath: string) {
    this.secretFilePath = path.join(userDataPath, '.gemini_credentials.enc');
    this.fallbackSecretFilePath = path.join(userDataPath, '.gemini_credentials.fallback');
  }

  public static getInstance(userDataPath?: string): CredentialService {
    if (!CredentialService.instance) {
      if (!userDataPath) {
        throw new Error('CredentialService requires userDataPath on first initialization');
      }
      CredentialService.instance = new CredentialService(userDataPath);
    }
    return CredentialService.instance;
  }

  public isSecureStorageAvailable(): boolean {
    try {
      return typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  public getApiKey(): string | null {
    // A key saved in Settings wins over GEMINI_API_KEY so users can change or clear it from the UI
    return this.getStoredApiKey() || this.getEnvApiKey();
  }

  public getKeySource(): 'settings' | 'environment' | null {
    if (this.getStoredApiKey()) return 'settings';
    if (this.getEnvApiKey()) return 'environment';
    return null;
  }

  private getEnvApiKey(): string | null {
    const envKey = process.env.GEMINI_API_KEY?.trim();
    return envKey ? envKey : null;
  }

  private getStoredApiKey(): string | null {
    if (this.isSecureStorageAvailable() && fs.existsSync(this.secretFilePath)) {
      try {
        const encryptedBuffer = fs.readFileSync(this.secretFilePath);
        const decrypted = safeStorage.decryptString(encryptedBuffer);
        if (decrypted && decrypted.trim().length > 0) {
          return decrypted.trim();
        }
      } catch (err) {
        console.warn('Failed to decrypt API key via safeStorage:', err);
      }
    }

    // Fallback file is only obfuscated (base64, 0600); used when the OS keychain is unavailable
    if (fs.existsSync(this.fallbackSecretFilePath)) {
      try {
        const raw = fs.readFileSync(this.fallbackSecretFilePath, 'utf8');
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        if (decoded && decoded.trim().length > 0) {
          return decoded.trim();
        }
      } catch (err) {
        console.warn('Failed to read fallback API key:', err);
      }
    }

    return null;
  }

  public hasApiKey(): boolean {
    return Boolean(this.getApiKey());
  }

  public setApiKey(key: string): boolean {
    const trimmed = key.trim();
    if (!trimmed) {
      this.clearApiKey();
      return true;
    }

    if (this.isSecureStorageAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(trimmed);
        fs.writeFileSync(this.secretFilePath, encrypted, { mode: 0o600 });
        if (fs.existsSync(this.fallbackSecretFilePath)) {
          fs.unlinkSync(this.fallbackSecretFilePath);
        }
        return true;
      } catch (err) {
        console.warn('safeStorage.encryptString failed, writing fallback:', err);
      }
    }

    // Explicit protected fallback when OS keychain is not available
    try {
      const encoded = Buffer.from(trimmed, 'utf8').toString('base64');
      fs.writeFileSync(this.fallbackSecretFilePath, encoded, { mode: 0o600, encoding: 'utf8' });
      return true;
    } catch (err) {
      console.error('Failed to write fallback API key:', err);
      return false;
    }
  }

  public clearApiKey(): void {
    if (fs.existsSync(this.secretFilePath)) {
      try {
        fs.unlinkSync(this.secretFilePath);
      } catch {}
    }
    if (fs.existsSync(this.fallbackSecretFilePath)) {
      try {
        fs.unlinkSync(this.fallbackSecretFilePath);
      } catch {}
    }
  }
}
