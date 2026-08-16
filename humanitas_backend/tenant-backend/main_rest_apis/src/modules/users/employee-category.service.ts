import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EmployeeCategory } from './entities/employee-category.entity';

@Injectable()
export class EmployeeCategoryService {
  constructor(private readonly databaseService: DatabaseService) { }

  private async getTenantConnection(tenantSlug: string) {
    // We need to resolve database name via TenantRepository usually, but for now
    // we can use a helper or inject UsersService to get db name.
    // Since this is inside UsersModule, we can inject UsersService?
    // Or just duplicate the logic to look up tenant.
    // For simplicity, let's assume we can query master DB or rely on request context.
    // Ideally, we should inject UsersService. let's Assume UsersService is available or duplicate getTenantDatabaseName.
    // To avoid circular dependency, let's duplicate the logic or better yet, assume 'tenantSlug' is passed correctly.
    // Actually, DatabaseService usually needs dbName, not slug.
    // Let's use `databaseService.getTenantConnectionById` if we have tenant ID, but we have slug.
    // We'll rely on `UsersService` being injected to resolve it,
    // OR just use `databaseService.masterDataSource` query to find db name.

    // For now, I'll use a direct query to master to find db name.
    const result = await this.databaseService['masterDataSource'].query(
      `SELECT database_name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException('Tenant not found');
    }
    return this.databaseService.getTenantConnection(result[0].database_name);
  }

  async findAll(tenantSlug: string) {
    const connection = await this.getTenantConnection(tenantSlug);
    return connection.getRepository(EmployeeCategory).find({
      order: { name: 'ASC' },
    });
  }

  async create(tenantSlug: string, dto: Partial<EmployeeCategory>) {
    const connection = await this.getTenantConnection(tenantSlug);
    const repo = connection.getRepository(EmployeeCategory);
    const category = repo.create(dto);
    return repo.save(category);
  }

  async update(tenantSlug: string, id: string, dto: Partial<EmployeeCategory>) {
    const connection = await this.getTenantConnection(tenantSlug);
    const repo = connection.getRepository(EmployeeCategory);

    await repo.update(id, dto);
    return repo.findOne({ where: { id } });
  }

  async findOne(tenantSlug: string, id: string) {
    console.log(`[DEBUG] EmployeeCategoryService.findOne called with id: ${id}`);
    const connection = await this.getTenantConnection(tenantSlug);
    const category = await connection.getRepository(EmployeeCategory).findOne({ where: { id } });
    if (!category) {
      console.log(`[DEBUG] Category not found in DB`);
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async remove(tenantSlug: string, id: string) {
    const connection = await this.getTenantConnection(tenantSlug);
    const repo = connection.getRepository(EmployeeCategory);

    const category = await repo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');

    if (category.is_system) {
      throw new Error('Cannot delete system default categories');
    }

    return repo.delete(id);
  }
}
