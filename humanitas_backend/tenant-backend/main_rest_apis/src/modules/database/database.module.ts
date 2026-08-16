import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TenantMigrationService } from './tenant-migration.service';

@Global()
@Module({
  providers: [TenantMigrationService, DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
