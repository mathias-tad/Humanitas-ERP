import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { ContactCategoriesController, ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

/** Contacts (featureslist §4.1, CRM 1.3). ActivityTimelineService comes from the global platform module. */
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant])],
  controllers: [ContactsController, ContactCategoriesController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
