import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HrmsDocumentsService } from './hrms-documents.service';
import { HrmsDocumentsController } from './hrms-documents.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HrmsDocumentsController],
  providers: [HrmsDocumentsService],
  exports: [HrmsDocumentsService],
})
export class HrmsDocumentsModule {}
