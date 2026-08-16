import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class MessageEncryptionService {
    private readonly algorithm = 'aes-256-gcm';
    private readonly key: Buffer;

    constructor(private configService: ConfigService) {
        const rawKey = this.configService.get<string>('MESSAGE_ENCRYPTION_KEY')
            || this.configService.get<string>('ENCRYPTION_SECRET')
            || this.configService.get<string>('JWT_SECRET')
            || 'humanitas-default-secure-message-encryption-key-2026';

        // Always derive a deterministic 32-byte (256-bit) key using SHA-256 hash
        this.key = crypto.createHash('sha256').update(rawKey).digest();
    }

    encrypt(text: string): { content: string; iv: string } {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

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
        const parts = encryptedContent.split(':');
        if (parts.length !== 2) {
            // Handle unencrypted or legacy content gracefully? 
            // For now throw error or return as is if implementation allows
            return encryptedContent;
        }
        const [content, authTagHex] = parts;

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(content, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}
