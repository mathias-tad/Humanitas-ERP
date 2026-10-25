import { Module } from '@nestjs/common';
import { HrmsTrainingService } from './hrms-training.service';
import { HrmsTrainingController } from './hrms-training.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsTrainingController],
  providers: [HrmsTrainingService],
  exports: [HrmsTrainingService],
})
export class HrmsTrainingModule {}
