import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { CrmActivitiesController, CrmLeadsController, CrmOpportunitiesController, CrmSetupController } from './crm.controllers';
import { CrmLeadsService } from './crm-leads.service';
import { CrmOpportunitiesService } from './crm-opportunities.service';
import { CrmActivitiesService } from './crm-activities.service';
import { CrmSetupService } from './crm-setup.service';
import { CrmImportService } from './crm-import.service';
import { CrmFollowUpsService } from './crm-follow-ups.service';

/** CRM core (featureslist §4.1): leads, opportunities and pipelines, activities. Contacts come from ContactsModule. */
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant]), ContactsModule],
  controllers: [CrmLeadsController, CrmOpportunitiesController, CrmActivitiesController, CrmSetupController],
  providers: [CrmLeadsService, CrmOpportunitiesService, CrmActivitiesService, CrmSetupService, CrmImportService, CrmFollowUpsService],
  exports: [CrmLeadsService, CrmOpportunitiesService, CrmActivitiesService, CrmSetupService],
})
export class CrmModule {}
