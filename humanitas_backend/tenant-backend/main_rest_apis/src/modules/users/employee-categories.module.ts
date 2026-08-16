
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { EmployeeCategoryController } from './employee-category.controller';
import { EmployeeCategoryService } from './employee-category.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Tenant]),
        DatabaseModule,
    ],
    controllers: [EmployeeCategoryController],
    providers: [EmployeeCategoryService, PermissionsGuard],
    exports: [EmployeeCategoryService],
})
export class EmployeeCategoriesModule {
    constructor() {
        console.log('[DEBUG] EmployeeCategoriesModule Initialized');
    }
}
