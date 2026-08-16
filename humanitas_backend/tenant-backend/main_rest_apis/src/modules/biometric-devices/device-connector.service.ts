import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BiometricDevicesService } from './biometric-devices.service';
import { DeviceProtocolService } from './device-protocol.service';

@Injectable()
export class DeviceConnectorService {
    private readonly logger = new Logger(DeviceConnectorService.name);

    constructor(
        private readonly devicesService: BiometricDevicesService,
        private readonly protocolService: DeviceProtocolService,
    ) { }

    /**
     * Test connection to a specific device
     */
    async testConnection(tenantId: string, deviceId: string): Promise<{ success: boolean; message: string; info?: any }> {
        const device = await this.devicesService.getDeviceById(tenantId, deviceId);
        if (!device) {
            throw new NotFoundException(`Device with ID ${deviceId} not found`);
        }

        const adapter = this.protocolService.getProtocolAdapter(device.protocol);

        try {
            const connected = await adapter.connect({
                ip: device.ip_address || '',
                port: Number(device.port) || 4370,
                timeout: 5000
            });

            if (connected) {
                const info = await adapter.getDeviceInfo();
                await adapter.disconnect();

                // Update status in DB
                await this.devicesService.updateDeviceStatus(tenantId, deviceId, { status: 'Online' });

                return { success: true, message: 'Connection successful', info };
            }

            await this.devicesService.updateDeviceStatus(tenantId, deviceId, { status: 'Offline' });
            return { success: false, message: 'Could not establish connection' };
        } catch (error) {
            this.logger.error(`Connection test failed for device ${device.name}: ${error.message}`);
            await this.devicesService.updateDeviceStatus(tenantId, deviceId, { status: 'Error' });
            return { success: false, message: error.message };
        }
    }

    /**
     * Sync data from a device (Attendance Logs)
     */
    async syncDeviceLogs(tenantId: string, deviceId: string): Promise<{ success: boolean; logsCount: number }> {
        const device = await this.devicesService.getDeviceById(tenantId, deviceId);
        if (!device) throw new NotFoundException('Device not found');

        const adapter = this.protocolService.getProtocolAdapter(device.protocol);

        try {
            await adapter.connect({
                ip: device.ip_address || '',
                port: Number(device.port) || 4370,
            });

            const logs = await adapter.getAttendanceLogs(false);

            // TODO: Process logs and save to attendance_records
            this.logger.log(`Fetched ${logs.length} logs from device ${device.name}`);

            await adapter.disconnect();

            // Update last sync time
            await this.devicesService.updateDeviceStatus(tenantId, deviceId, {
                last_sync_at: new Date(),
                status: 'Online'
            });

            return { success: true, logsCount: logs.length };
        } catch (error) {
            this.logger.error(`Sync failed for device ${device.name}: ${error.message}`);
            await this.devicesService.updateDeviceStatus(tenantId, deviceId, { status: 'Error' });
            return { success: false, logsCount: 0 };
        }
    }
}
