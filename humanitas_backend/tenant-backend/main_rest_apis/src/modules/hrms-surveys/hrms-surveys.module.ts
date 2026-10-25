import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HrmsSurveysService } from './hrms-surveys.service';
import { HrmsSurveysController } from './hrms-surveys.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsSurveysController],
  providers: [HrmsSurveysService],
  exports: [HrmsSurveysService],
})
export class HrmsSurveysModule {}
