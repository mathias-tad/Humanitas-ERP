import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivityTimelineService } from './activity-timeline.service';

/**
 * Platform service (featureslist §30): available to every module without importing it.
 * Each module exposes its own `GET /<module>/<record>/:id/timeline` endpoint behind its
 * own subscription + permission guards and calls ActivityTimelineService.list().
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [ActivityTimelineService],
  exports: [ActivityTimelineService],
})
export class ActivityTimelineModule {}
