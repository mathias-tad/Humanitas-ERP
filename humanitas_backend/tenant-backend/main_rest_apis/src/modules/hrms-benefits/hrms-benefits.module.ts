import { Module } from '@nestjs/common';
import { HrmsBenefitsService } from './hrms-benefits.service';
import { HrmsBenefitsController } from './hrms-benefits.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsBenefitsController],
  providers: [HrmsBenefitsService],
  exports: [HrmsBenefitsService],
})
export class HrmsBenefitsModule {}
