import { Module } from '@nestjs/common';
import { HrmsOnboardingService } from './hrms-onboarding.service';
import { HrmsOnboardingController } from './hrms-onboarding.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsOnboardingController],
  providers: [HrmsOnboardingService],
  exports: [HrmsOnboardingService],
})
export class HrmsOnboardingModule {}
