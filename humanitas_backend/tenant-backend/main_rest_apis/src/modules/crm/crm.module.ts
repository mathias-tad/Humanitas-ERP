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

/** CRM core (featureslist §4.1): leads, opportunities and pipelines, activities. Contacts come from ContactsModule. */
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant]), ContactsModule],
  controllers: [CrmLeadsController, CrmOpportunitiesController, CrmActivitiesController, CrmSetupController],
  providers: [CrmLeadsService, CrmOpportunitiesService, CrmActivitiesService, CrmSetupService],
  exports: [CrmLeadsService, CrmOpportunitiesService, CrmActivitiesService, CrmSetupService],
})
export class CrmModule {}
