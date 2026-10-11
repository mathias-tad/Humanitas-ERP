import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Req,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { BiometricDevicesService } from './biometric-devices.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

import { DeviceConnectorService } from './device-connector.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';

@Controller('biometric-devices')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('attendance')
export class BiometricDevicesController {
    constructor(
        private readonly biometricDevicesService: BiometricDevicesService,
        private readonly deviceConnectorService: DeviceConnectorService
    ) { }

    @Get()
    @RequirePermissions('view_devices', 'manage_devices')
    async getAllDevices(@Req() req: any) {
        const tenantId = req.user.tenantId;
        return this.biometricDevicesService.getAllDevices(tenantId);
    }

    @Get('protocols')
    @RequirePermissions('view_devices', 'manage_devices')
    async getProtocols(@Req() req: any) {
        const tenantId = req.user.tenantId;
        return this.biometricDevicesService.getProtocols(tenantId);
    }

    @Get(':id')
    @RequirePermissions('view_devices', 'manage_devices')
    async getDeviceById(@Req() req: any, @Param('id') id: string) {
        const tenantId = req.user.tenantId;
        const device = await this.biometricDevicesService.getDeviceById(tenantId, id);
        if (!device) {
            throw new BadRequestException('Device not found');
        }
        return device;
    }

    @Post()
    @RequirePermissions('manage_devices')
    async createDevice(@Req() req: any, @Body() body: CreateDeviceDto) {
        const tenantId = req.user.tenantId;
        return this.biometricDevicesService.createDevice(tenantId, {
            ...body,
            created_by: req.user.userId,
        });
    }

    @Patch(':id')
    @RequirePermissions('manage_devices')
    async updateDevice(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: UpdateDeviceDto,
    ) {
        const tenantId = req.user.tenantId;
        return this.biometricDevicesService.updateDevice(tenantId, id, body);
    }

    @Delete(':id')
    @RequirePermissions('manage_devices')
    async deleteDevice(@Req() req: any, @Param('id') id: string) {
        const tenantId = req.user.tenantId;
        return this.biometricDevicesService.deleteDevice(tenantId, id);
    }

    @Post(':id/test-connection')
    @RequirePermissions('manage_devices')
    async testConnection(@Req() req: any, @Param('id') id: string) {
        const tenantId = req.user.tenantId;
        return this.deviceConnectorService.testConnection(tenantId, id);
    }

    @Post(':id/sync')
    @RequirePermissions('manage_devices')
    async syncDevice(@Req() req: any, @Param('id') id: string) {
        const tenantId = req.user.tenantId;
        return this.deviceConnectorService.syncDeviceLogs(tenantId, id);
    }
}
