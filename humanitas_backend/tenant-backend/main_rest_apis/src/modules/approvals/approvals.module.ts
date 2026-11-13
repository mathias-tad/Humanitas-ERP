import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    DatabaseModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, PermissionsGuard],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
