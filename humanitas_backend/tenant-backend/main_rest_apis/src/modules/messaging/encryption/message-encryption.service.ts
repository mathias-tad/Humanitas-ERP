import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM encryption for chat messages, with key rotation.
 *
 * - MESSAGE_ENCRYPTION_KEY (fallback: ENCRYPTION_SECRET) is the current key; every new message uses it.
 * - MESSAGE_ENCRYPTION_PREVIOUS_KEYS is an optional comma-separated list of retired keys that can
 *   still decrypt older messages. GCM's auth tag rejects a wrong key, so keys are tried in order.
 * - The stored format (`ciphertext:authTag` + separate IV) is unchanged, so no data migration is
 *   needed. Run `node dist/scripts/reencrypt-messages.js` to move old messages to the current key,
 *   after which the previous keys can be removed.
 */
@Injectable()
export class MessageEncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    /** keys[0] is the current key, the rest are previous keys. */
    private readonly keys: Buffer[];

    constructor(private configService: ConfigService) {
        const rawKey = this.configService.get<string>('MESSAGE_ENCRYPTION_KEY')
            || this.configService.get<string>('ENCRYPTION_SECRET');

        if (!rawKey) {
            throw new Error(
                'FATAL: MESSAGE_ENCRYPTION_KEY or ENCRYPTION_SECRET environment variable is not set. '
                + 'Message encryption cannot start without a secure key. '
                + 'Please configure this environment variable immediately.',
            );
        }

        const previous = (this.configService.get<string>('MESSAGE_ENCRYPTION_PREVIOUS_KEYS') || '')
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean);

        const derived: Buffer[] = [];
        for (const raw of [rawKey, ...previous]) {
            // Always derive a deterministic 32-byte (256-bit) key using SHA-256 hash
            const key = crypto.createHash('sha256').update(raw).digest();
            if (!derived.some((k) => k.equals(key))) derived.push(key);
        }
        this.keys = derived;
    }

    /** Number of previous (retired) keys still accepted for decryption. */
    get previousKeyCount(): number {
        return this.keys.length - 1;
    }

    encrypt(text: string): { content: string; iv: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.keys[0], iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        // Format: encrypted_content:auth_tag
        return {
            content: `${encrypted}:${authTag.toString('hex')}`,
            iv: iv.toString('hex'),
        };
    }

    decrypt(encryptedContent: string, ivHex: string): string {
        const result = this.tryDecrypt(encryptedContent, ivHex);
        if (result.keyIndex === -2) {
            // Not in encrypted format (legacy/plain content): return as is.
            return encryptedContent;
        }
        if (result.keyIndex === -1) {
            throw result.error ?? new Error('Message could not be decrypted with any configured key');
        }
        return result.plaintext as string;
    }

    /**
     * Re-encrypt a message with the current key if it is only readable with a previous key.
     * Returns null when nothing needs to change (already current, or not encrypted).
     * Throws when no configured key can decrypt it.
     */
    reencryptIfNeeded(encryptedContent: string, ivHex: string): { content: string; iv: string } | null {
        const result = this.tryDecrypt(encryptedContent, ivHex);
        if (result.keyIndex === -2 || result.keyIndex === 0) return null;
        if (result.keyIndex === -1) {
            throw result.error ?? new Error('Message could not be decrypted with any configured key');
        }
        return this.encrypt(result.plaintext as string);
    }

    /**
     * keyIndex: index of the key that decrypted the content, -1 if none did,
     * -2 if the content is not in `ciphertext:authTag` format.
     */
    private tryDecrypt(
        encryptedContent: string,
        ivHex: string,
    ): { keyIndex: number; plaintext?: string; error?: unknown } {
        const parts = (encryptedContent ?? '').split(':');
        if (parts.length !== 2) return { keyIndex: -2 };
        const [content, authTagHex] = parts;

        const iv = Buffer.from(ivHex ?? '', 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        let lastError: unknown;
        for (let i = 0; i < this.keys.length; i++) {
            try {
                const decipher = crypto.createDecipheriv(this.algorithm, this.keys[i], iv);
                decipher.setAuthTag(authTag);
                let decrypted = decipher.update(content, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                return { keyIndex: i, plaintext: decrypted };
            } catch (err) {
                lastError = err;
            }
        }
        return { keyIndex: -1, error: lastError };
    }
}
