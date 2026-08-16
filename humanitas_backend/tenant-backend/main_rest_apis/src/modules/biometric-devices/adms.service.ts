import { Injectable, Logger } from '@nestjs/common';
import { BiometricDevicesService } from './biometric-devices.service';

@Injectable()
export class AdmsService {
    private readonly logger = new Logger(AdmsService.name);

    constructor(
        private readonly devicesService: BiometricDevicesService,
    ) { }

    /**
     * Handles the initialization/handshake request from the device.
     * Path: /iclock/cdata?SN={sn}&options=all
     */
    async handleHandshake(sn: string): Promise<string> {
        this.logger.log(`Device Handshake: ${sn}`);

        // Find device across all tenants
        const result = await this.devicesService.getDeviceBySerial(sn);

        if (!result) {
            this.logger.warn(`Unauthorized Handshake attempt from SN: ${sn}`);
            throw new Error('Unauthorized Device');
        }

        const { device, tenantId } = result;

        // Update status to Online
        await this.devicesService.updateDeviceStatus(tenantId, device.id, {
            status: 'Online',
            last_sync_at: new Date()
        });

        const serverTime = Math.floor(Date.now() / 1000);
        return `GET OPTION FROM: ${sn}
Stamp=${serverTime}
OpStamp=${serverTime}
PhotoStamp=${serverTime}
ErrorDelay=30
Delay=30
TransTimes=00:00;14:05
TransInterval=1
TransFlag=1111000000
Realtime=1
Encrypt=0`;
    }

    /**
     * Handles data pushed from the device (Attendance Logs, Users, etc.)
     * Path: /iclock/cdata?SN={sn}&table=ATTLOG&Stamp={stamp}
     */
    async receiveData(sn: string, table: string, body: string): Promise<string> {
        this.logger.log(`Received ${table} from ${sn}`);

        // Validate request
        const result = await this.devicesService.getDeviceBySerial(sn);
        if (!result) {
            this.logger.warn(`Unauthorized Data Push from SN: ${sn}`);
            return 'FAIL';
        }

        if (table === 'ATTLOG') {
            await this.processAttendanceLogs(result.tenantId, result.device, body);
        }

        return 'OK';
    }

    private async processAttendanceLogs(tenantId: string, device: any, data: string) {
        // Format: ID \t Time \t Status \t Verify
        // Example: 1	2023-10-27 09:00:00	1	1

        const lines = data.split('\n').filter(line => line.trim().length > 0);
        this.logger.log(`Processing ${lines.length} logs from ${device.serial_number}`);

        for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 2) {
                const userId = parts[0];
                const timestamp = parts[1];
                const status = parts[2]; // 0=CheckIn, 1=CheckOut, etc. (varies by device)

                this.logger.debug(`Log: User ${userId} at ${timestamp} (${status})`);

                // TODO: Save to attendance_records
            }
        }

        await this.devicesService.updateDeviceStatus(tenantId, device.id, {
            status: 'Online',
            last_sync_at: new Date()
        });
    }

    /**
     * Device asks for commands
     * Path: /iclock/getrequest?SN={sn}
     */
    async getCommands(sn: string): Promise<string> {
        // Return "OK" if no commands, or "C:{id}:{command}" if commands exist
        return 'OK';
    }

    /**
     * Device reports command result
     * Path: /iclock/devicecmd?SN={sn}
     */
    async receiveCmdResult(sn: string, body: string): Promise<string> {
        return 'OK';
    }
}
