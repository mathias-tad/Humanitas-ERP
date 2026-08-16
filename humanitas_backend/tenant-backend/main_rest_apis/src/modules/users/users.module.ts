import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { EmployeeCategoryController } from './employee-category.controller';
import { UsersService } from './users.service';
import { EmployeeCategoryService } from './employee-category.service';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { SettingsModule } from '../settings/settings.module';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { EmployeeCategory } from './entities/employee-category.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    DatabaseModule,
    SettingsModule,
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, PermissionsGuard],
  exports: [UsersService],
})
export class UsersModule {
  constructor() {
    console.log('[DEBUG] UsersModule Initialized');
  }
}
