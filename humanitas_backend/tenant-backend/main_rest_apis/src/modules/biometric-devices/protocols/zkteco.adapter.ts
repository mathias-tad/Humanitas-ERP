import { IBiometricProtocol, IBiometricDevice, IAttendanceLog, IDeviceUser } from './biometric-protocol.interface';
import { Logger } from '@nestjs/common';

export class ZKTecoAdapter implements IBiometricProtocol {
    private readonly logger = new Logger(ZKTecoAdapter.name);
    private connected = false;
    private config: IBiometricDevice;

    async connect(config: IBiometricDevice): Promise<boolean> {
        this.config = config;
        this.logger.log(`Connecting to ZKTeco device at ${config.ip}:${config.port}...`);

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Simulate successful connection (in real world, acts as socket connection)
        this.connected = true;
        this.logger.log(`Successfully connected to ${config.ip}`);
        return true;
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;
        this.logger.log(`Disconnecting from ${this.config.ip}...`);
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async getDeviceInfo(): Promise<Record<string, any>> {
        this.checkConnection();
        return {
            firmwareVersion: 'Ver 6.60',
            serialNumber: 'ZK' + Math.floor(Math.random() * 1000000),
            platform: 'ZEM560',
            vendor: 'ZKTeco'
        };
    }

    async syncTime(): Promise<void> {
        this.checkConnection();
        this.logger.log(`Syncing time for device ${this.config.ip}`);
    }

    async getAttendanceLogs(clearAfterRead: boolean = false): Promise<IAttendanceLog[]> {
        this.checkConnection();
        this.logger.log(`Fetching logs from ${this.config.ip}`);

        // Return mock data for now
        return [
            {
                userId: '1',
                timestamp: new Date(),
                status: 'CheckIn',
                deviceId: this.config.ip // Using IP as pseudo-ID for now
            },
            {
                userId: '2',
                timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
                status: 'CheckIn',
                deviceId: this.config.ip
            }
        ];
    }

    async uploadUsers(users: IDeviceUser[]): Promise<void> {
        this.checkConnection();
        this.logger.log(`Uploading ${users.length} users to device...`);
    }

    async deleteUsers(userIds: string[]): Promise<void> {
        this.checkConnection();
        this.logger.log(`Deleting ${userIds.length} users from device...`);
    }

    async clearAdminPrivileges(): Promise<void> {
        this.checkConnection();
        this.logger.log('Clearing admin privileges...');
    }

    async restart(): Promise<void> {
        this.checkConnection();
        this.logger.log('Restarting device...');
        this.connected = false;
    }

    private checkConnection() {
        if (!this.connected) {
            throw new Error('Device not connected');
        }
    }
}
