import { Module } from '@nestjs/common';
import { HrmsGrievancesService } from './hrms-grievances.service';
import { HrmsGrievancesController } from './hrms-grievances.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsGrievancesController],
  providers: [HrmsGrievancesService],
  exports: [HrmsGrievancesService],
})
export class HrmsGrievancesModule {}
