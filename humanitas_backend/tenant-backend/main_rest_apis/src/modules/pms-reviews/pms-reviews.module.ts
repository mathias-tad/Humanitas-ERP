import { Module } from '@nestjs/common';
import { PmsReviewsController } from './pms-reviews.controller';
import { PmsReviewsService } from './pms-reviews.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [PmsReviewsController],
  providers: [PmsReviewsService],
  exports: [PmsReviewsService],
})
export class PmsReviewsModule {}
