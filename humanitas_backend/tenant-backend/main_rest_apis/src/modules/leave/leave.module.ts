import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveGateway } from './leave.gateway';
import { LeaveScheduler } from './leave.scheduler';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([Tenant]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [LeaveController],
  providers: [LeaveService, LeaveGateway, LeaveScheduler],
  exports: [LeaveService, LeaveGateway, LeaveScheduler],
})
export class LeaveModule {}
