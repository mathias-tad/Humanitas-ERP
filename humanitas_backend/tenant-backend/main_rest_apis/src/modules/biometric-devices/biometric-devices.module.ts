import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BiometricDevicesController } from './biometric-devices.controller';
import { BiometricDevicesService } from './biometric-devices.service';
import { DatabaseModule } from '../database/database.module';
import { DeviceProtocolService } from './device-protocol.service';
import { DeviceConnectorService } from './device-connector.service';
import { AuthModule } from '../auth/auth.module';
import { Tenant } from '../auth/entities/tenant.entity';

import { AdmsService } from './adms.service';
import { AdmsController } from './adms.controller';

@Module({
    imports: [
        DatabaseModule,
        AuthModule,
        TypeOrmModule.forFeature([Tenant])
    ],
    controllers: [BiometricDevicesController, AdmsController],
    providers: [BiometricDevicesService, DeviceProtocolService, DeviceConnectorService, AdmsService],
    exports: [BiometricDevicesService, DeviceProtocolService, DeviceConnectorService, AdmsService],
})
export class BiometricDevicesModule { }
