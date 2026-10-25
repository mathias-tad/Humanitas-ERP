import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HrmsAssetsService } from './hrms-assets.service';
import { HrmsAssetsController } from './hrms-assets.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsAssetsController],
  providers: [HrmsAssetsService],
  exports: [HrmsAssetsService],
})
export class HrmsAssetsModule {}
