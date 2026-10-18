import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BiometricDevicesController } from './biometric-devices.controller';
import { BiometricDevicesService } from './biometric-devices.service';
import { DatabaseModule } from '../database/database.module';
import { DeviceProtocolService } from './device-protocol.service';
import { DeviceConnectorService } from './device-connector.service';
import { AuthModule } from '../auth/auth.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { BiometricDevicesGateway } from './biometric-devices.gateway';
import { AttendanceModule } from '../attendance/attendance.module';
import { AdmsService } from './adms.service';
import { AdmsController } from './adms.controller';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    ConfigModule,
    TypeOrmModule.forFeature([Tenant]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => AttendanceModule),
  ],
  controllers: [BiometricDevicesController, AdmsController],
  providers: [
    BiometricDevicesService,
    DeviceProtocolService,
    DeviceConnectorService,
    AdmsService,
    BiometricDevicesGateway,
  ],
  exports: [
    BiometricDevicesService,
    DeviceProtocolService,
    DeviceConnectorService,
    AdmsService,
    BiometricDevicesGateway,
  ],
})
export class BiometricDevicesModule {}
