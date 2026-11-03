import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Tenant } from '../auth/entities/tenant.entity';

@Module({
  imports: [
    DatabaseModule,
    NotificationsModule,
    TypeOrmModule.forFeature([Tenant]),
  ],
  controllers: [DelegationsController],
  providers: [DelegationsService],
  exports: [DelegationsService],
})
export class DelegationsModule {}
