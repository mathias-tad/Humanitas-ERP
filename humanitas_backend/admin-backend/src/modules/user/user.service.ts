import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UserTenantMap, UserRole } from './entities/user-tenant-map.entity';
import { AdminUser, AdminRole } from './entities/admin-user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserTenantMap)
    private readonly userTenantRepository: Repository<UserTenantMap>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) { }

  // ==================== TENANT USERS ====================

  async findUsersByTenant(tenantId: string): Promise<UserTenantMap[]> {
    return this.userTenantRepository.find({
      where: { tenant_id: tenantId },
      select: ['id', 'email', 'full_name', 'phone', 'role', 'is_active', 'last_login_at', 'created_at'],
    });
  }

  async findUserByEmail(email: string): Promise<UserTenantMap[]> {
    return this.userTenantRepository.find({
      where: { email },
      relations: ['tenant'],
    });
  }

  async findUserById(id: string): Promise<UserTenantMap> {
    const user = await this.userTenantRepository.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateUserRole(id: string, role: UserRole): Promise<UserTenantMap> {
    const user = await this.findUserById(id);
    user.role = role;
    return this.userTenantRepository.save(user);
  }

  async deactivateUser(id: string): Promise<UserTenantMap> {
    const user = await this.findUserById(id);
    user.is_active = false;
    return this.userTenantRepository.save(user);
  }

  async activateUser(id: string): Promise<UserTenantMap> {
    const user = await this.findUserById(id);
    user.is_active = true;
    return this.userTenantRepository.save(user);
  }

  // ==================== ADMIN USERS ====================

  async findAllAdmins(): Promise<AdminUser[]> {
    return this.adminUserRepository.find({
      select: ['id', 'email', 'full_name', 'role', 'is_active', 'last_login_at', 'created_at'],
    });
  }

  async findAdminById(id: string): Promise<AdminUser> {
    const admin = await this.adminUserRepository.findOne({
      where: { id },
    });
    if (!admin) {
      throw new NotFoundException('Admin not found');
    }
    return admin;
  }

  async createAdmin(email: string, password: string, full_name: string, role: AdminRole): Promise<AdminUser> {
    const existing = await this.adminUserRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Admin with this email already exists');
    }

    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'), 10);
    const password_hash = await bcrypt.hash(password, saltRounds);

    const admin = this.adminUserRepository.create({
      email,
      password_hash,
      full_name,
      role,
    });

    return this.adminUserRepository.save(admin);
  }

  async seedSuperAdmin(): Promise<{ message: string; admin?: AdminUser }> {
    console.log('🔧 Running database seed...');

    // Create/update all required tables
    await this.createTables();

    // Check if admin exists
    const existingAdmin = await this.adminUserRepository.findOne({
      where: { role: AdminRole.SUPER_ADMIN },
    });

    if (existingAdmin) {
      console.log('✅ Super admin already exists');
      return { message: 'Database tables updated. Super admin already exists.' };
    }

    const admin = await this.createAdmin(
      'admin@saas.com',
      'admin123456',
      'Super Admin',
      AdminRole.SUPER_ADMIN,
    );

    console.log('✅ Super admin created');
    return { message: 'Database seeded successfully', admin };
  }

  private async createTables(): Promise<void> {
    console.log('📝 Creating/updating database tables...');

    // Create admins table
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ admins table ready');

    // Create tenants table
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(255) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        database_name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255) NOT NULL,
        contact_phone VARCHAR(255),
        address TEXT,
        city VARCHAR(255),
        state VARCHAR(255),
        country VARCHAR(255),
        postal_code VARCHAR(50),
        logo_url VARCHAR(500),
        subscription_status VARCHAR(50) DEFAULT 'trial',
        subscription_plan VARCHAR(50) DEFAULT 'basic',
        subscription_started_at TIMESTAMP,
        subscription_ends_at TIMESTAMP,
        trial_ends_at TIMESTAMP,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        monthly_fee DECIMAL(10,2) DEFAULT 0,
        per_user_fee DECIMAL(10,2) DEFAULT 0,
        max_users INTEGER DEFAULT 10,
        current_users INTEGER DEFAULT 0,
        max_devices INTEGER DEFAULT 5,
        current_devices INTEGER DEFAULT 0,
        storage_limit_gb DECIMAL(10,2) DEFAULT 10,
        storage_used_gb DECIMAL(10,2) DEFAULT 0,
        enabled_features TEXT,
        timezone VARCHAR(100) DEFAULT 'UTC',
        date_format VARCHAR(50) DEFAULT 'YYYY-MM-DD',
        currency VARCHAR(10) DEFAULT 'USD',
        is_active BOOLEAN DEFAULT true,
        is_setup_complete BOOLEAN DEFAULT false,
        setup_token VARCHAR(255),
        setup_token_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns if table already exists
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)`);
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP`);
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`);
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)`);
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS monthly_fee DECIMAL(10,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS per_user_fee DECIMAL(10,2) DEFAULT 0`);
    await this.dataSource.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS database_name VARCHAR(255)`);
    console.log('✅ tenants table ready');

    // Create platform_settings table
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform_name VARCHAR(255) DEFAULT 'Humanitas',
        support_email VARCHAR(255),
        smtp_host VARCHAR(255),
        smtp_port INTEGER,
        smtp_username VARCHAR(255),
        smtp_password VARCHAR(255),
        from_email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ platform_settings table ready');

    // Create user_tenant_maps table
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS user_tenant_maps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        phone VARCHAR(50),
        tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ user_tenant_maps table ready');

    // Insert default platform settings if not exists
    const settings = await this.dataSource.query(`SELECT id FROM platform_settings LIMIT 1`);
    if (settings.length === 0) {
      await this.dataSource.query(`
        INSERT INTO platform_settings (platform_name, support_email)
        VALUES ('Humanitas', 'support@humanitas.com')
      `);
      console.log('✅ Default platform settings created');
    }

    console.log('✅ All tables ready');
  }
}
