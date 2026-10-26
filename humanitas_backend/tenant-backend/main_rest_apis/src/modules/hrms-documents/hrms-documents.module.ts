import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { HrmsDocumentsService } from './hrms-documents.service';
import { HrmsDocumentsController, HrmsLettersController, HrmsDigitalSignatureController } from './hrms-documents.controller';
import { DocumentExpiryCron } from './document-expiry.cron';
import { Tenant } from '../auth/entities/tenant.entity';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Tenant]),
  ],
  controllers: [HrmsDocumentsController, HrmsLettersController, HrmsDigitalSignatureController],
  providers: [HrmsDocumentsService, DocumentExpiryCron],
  exports: [HrmsDocumentsService],
})
export class HrmsDocumentsModule {}
