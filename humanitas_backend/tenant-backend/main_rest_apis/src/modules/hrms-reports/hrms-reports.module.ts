import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HrmsReportsController } from './hrms-reports.controller';
import { HrmsReportsService } from './hrms-reports.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsReportsController],
  providers: [HrmsReportsService],
  exports: [HrmsReportsService],
})
export class HrmsReportsModule {}
