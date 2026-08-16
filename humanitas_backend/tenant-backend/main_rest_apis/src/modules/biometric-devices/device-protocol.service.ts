import { Injectable, Logger } from '@nestjs/common';
import { IBiometricProtocol } from './protocols/biometric-protocol.interface';
import { ZKTecoAdapter } from './protocols/zkteco.adapter';

export type SupportedProtocol = 'zkteco' | 'anviz' | 'hkv';

@Injectable()
export class DeviceProtocolService {
    private readonly logger = new Logger(DeviceProtocolService.name);

    /**
     * Factory method to get the appropriate protocol adapter
     * @param protocol The protocol identifier (e.g., 'zkteco', 'anviz')
     * @returns An instance implementing IBiometricProtocol
     */
    getProtocolAdapter(protocol: string): IBiometricProtocol {
        const normalizedProtocol = protocol.toLowerCase();

        switch (normalizedProtocol) {
            case 'zkteco':
                return new ZKTecoAdapter();
            // case 'anviz':
            //   return new AnvizAdapter();
            default:
                this.logger.warn(`Unknown protocol: ${protocol}. Defaulting to ZKTeco.`);
                // Ideally throw error, but for robustness in early dev we might default or throw
                throw new Error(`Unsupported protocol: ${protocol}`);
        }
    }

    /**
     * Get list of supported protocols
     */
    getSupportedProtocols(): string[] {
        return ['zkteco', 'anviz', 'hkv'];
    }
}
