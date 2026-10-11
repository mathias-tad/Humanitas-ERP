import { ConfigService } from '@nestjs/config';
import { MessageEncryptionService } from './message-encryption.service';

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
});
