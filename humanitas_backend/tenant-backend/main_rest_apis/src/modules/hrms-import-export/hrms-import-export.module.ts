import { Module } from '@nestjs/common';
import { HrmsImportExportService } from './hrms-import-export.service';
import { HrmsImportExportController } from './hrms-import-export.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsImportExportController],
  providers: [HrmsImportExportService],
  exports: [HrmsImportExportService],
})
export class HrmsImportExportModule {}
