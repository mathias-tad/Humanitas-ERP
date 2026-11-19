import { ConfigService } from '@nestjs/config';
import { MessageEncryptionService } from './message-encryption.service';

function serviceWith(env: Record<string, string | undefined>): MessageEncryptionService {
  const config = {
    get: jest.fn().mockImplementation((key: string) => env[key]),
  } as unknown as ConfigService;
  return new MessageEncryptionService(config);
}

describe('MessageEncryptionService', () => {
  it('should throw an error if no encryption secret is configured (no hardcoded fallback)', () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new MessageEncryptionService(mockConfigService)).toThrow(
      /FATAL: MESSAGE_ENCRYPTION_KEY or ENCRYPTION_SECRET/,
    );
  });

  it('should encrypt and decrypt messages properly with configured key', () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'MESSAGE_ENCRYPTION_KEY') return 'test-secure-key-1234567890123456';
        return undefined;
      }),
    } as unknown as ConfigService;

    const service = new MessageEncryptionService(mockConfigService);
    const plaintext = 'Secret HR confidential communication';

    const { content, iv } = service.encrypt(plaintext);
    expect(content).toBeDefined();
    expect(iv).toBeDefined();
    expect(content).not.toEqual(plaintext);

    const decrypted = service.decrypt(content, iv);
    expect(decrypted).toEqual(plaintext);
  });

  describe('key rotation', () => {
    const OLD = 'old-key-aaaaaaaaaaaaaaaaaaaaaaaa';
    const NEW = 'new-key-bbbbbbbbbbbbbbbbbbbbbbbb';
    const text = 'Payroll for March is ready – ✓ unicode';

    it('keeps the stored format unchanged (ciphertext:authTag, hex IV)', () => {
      const { content, iv } = serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW }).encrypt(text);
      expect(content).toMatch(/^[0-9a-f]+:[0-9a-f]{32}$/);
      expect(iv).toMatch(/^[0-9a-f]{32}$/);
    });

    it('decrypts messages written with a previous key', () => {
      const old = serviceWith({ MESSAGE_ENCRYPTION_KEY: OLD }).encrypt(text);
      const rotated = serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW, MESSAGE_ENCRYPTION_PREVIOUS_KEYS: OLD });
      expect(rotated.decrypt(old.content, old.iv)).toBe(text);
    });

    it('encrypts new messages with the current key only', () => {
      const rotated = serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW, MESSAGE_ENCRYPTION_PREVIOUS_KEYS: OLD });
      const fresh = rotated.encrypt(text);
      expect(serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW }).decrypt(fresh.content, fresh.iv)).toBe(text);
      expect(() => serviceWith({ MESSAGE_ENCRYPTION_KEY: OLD }).decrypt(fresh.content, fresh.iv)).toThrow();
    });

    it('throws when no configured key matches', () => {
      const old = serviceWith({ MESSAGE_ENCRYPTION_KEY: OLD }).encrypt(text);
      expect(() => serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW }).decrypt(old.content, old.iv)).toThrow();
    });

    it('accepts several previous keys with spaces and duplicates', () => {
      const old = serviceWith({ MESSAGE_ENCRYPTION_KEY: OLD }).encrypt(text);
      const rotated = serviceWith({
        MESSAGE_ENCRYPTION_KEY: NEW,
        MESSAGE_ENCRYPTION_PREVIOUS_KEYS: ` other-key , ${OLD},${NEW}, ,${OLD} `,
      });
      expect(rotated.previousKeyCount).toBe(2);
      expect(rotated.decrypt(old.content, old.iv)).toBe(text);
    });

    it('re-encrypts only messages that are on a previous key', () => {
      const rotated = serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW, MESSAGE_ENCRYPTION_PREVIOUS_KEYS: OLD });
      const old = serviceWith({ MESSAGE_ENCRYPTION_KEY: OLD }).encrypt(text);
      const current = rotated.encrypt(text);

      expect(rotated.reencryptIfNeeded(current.content, current.iv)).toBeNull();
      expect(rotated.reencryptIfNeeded('plain legacy text', '')).toBeNull();

      const moved = rotated.reencryptIfNeeded(old.content, old.iv);
      expect(moved).not.toBeNull();
      expect(serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW }).decrypt(moved!.content, moved!.iv)).toBe(text);
    });

    it('re-encryption throws for content no key can read', () => {
      const foreign = serviceWith({ MESSAGE_ENCRYPTION_KEY: 'unknown-key' }).encrypt(text);
      const rotated = serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW, MESSAGE_ENCRYPTION_PREVIOUS_KEYS: OLD });
      expect(() => rotated.reencryptIfNeeded(foreign.content, foreign.iv)).toThrow();
    });

    it('returns non-encrypted legacy content as is', () => {
      expect(serviceWith({ MESSAGE_ENCRYPTION_KEY: NEW }).decrypt('hello', '')).toBe('hello');
    });
  });
});
