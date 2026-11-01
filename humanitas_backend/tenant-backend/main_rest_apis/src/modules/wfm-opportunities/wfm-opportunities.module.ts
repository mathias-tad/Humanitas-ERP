import { Module, forwardRef } from '@nestjs/common';
import { WfmOpportunitiesController } from './wfm-opportunities.controller';
import { WfmOpportunitiesService } from './wfm-opportunities.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [WfmOpportunitiesController],
  providers: [WfmOpportunitiesService],
  exports: [WfmOpportunitiesService],
})
export class WfmOpportunitiesModule {}
