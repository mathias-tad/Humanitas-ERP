import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserTenantMap, UserRole } from '../user/entities/user-tenant-map.entity';
import { AdminUser, AdminRole } from '../user/entities/admin-user.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  tenantSlug?: string;
  role: string;
  type: 'user' | 'admin';
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserTenantMap)
    private readonly userTenantRepository: Repository<UserTenantMap>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ==================== USER AUTHENTICATION ====================

  async login(loginDto: LoginDto): Promise<{
    requires_tenant_selection: boolean;
    tenants?: { id: string; slug: string; name: string }[];
    access_token?: string;
    refresh_token?: string;
    user?: Partial<UserTenantMap>;
  }> {
    const { email, password } = loginDto;

    // Find all user-tenant mappings for this email
    const userMappings = await this.userTenantRepository.find({
      where: { email, is_active: true },
      relations: ['tenant'],
    });

    if (userMappings.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password (same password across all tenants)
    const isPasswordValid = await bcrypt.compare(password, userMappings[0].password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If user belongs to multiple tenants, require selection
    if (userMappings.length > 1) {
      return {
        requires_tenant_selection: true,
        tenants: userMappings.map((mapping) => ({
          id: mapping.tenant.id,
          slug: mapping.tenant.slug,
          name: mapping.tenant.company_name,
        })),
      };
    }

    // Single tenant - generate tokens directly
    const userMapping = userMappings[0];
    const tokens = await this.generateTokens(userMapping);

    // Update last login
    userMapping.last_login_at = new Date();
    await this.userTenantRepository.save(userMapping);

    return {
      requires_tenant_selection: false,
      ...tokens,
      user: this.sanitizeUser(userMapping),
    };
  }

  async selectTenant(selectTenantDto: SelectTenantDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: Partial<UserTenantMap>;
  }> {
    const { email, password, tenant_id } = selectTenantDto;

    const userMapping = await this.userTenantRepository.findOne({
      where: { email, tenant_id, is_active: true },
      relations: ['tenant'],
    });

    if (!userMapping) {
      throw new UnauthorizedException('Invalid credentials or tenant');
    }

    const isPasswordValid = await bcrypt.compare(password, userMapping.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(userMapping);

    // Update last login
    userMapping.last_login_at = new Date();
    await this.userTenantRepository.save(userMapping);

    return {
      ...tokens,
      user: this.sanitizeUser(userMapping),
    };
  }

  async register(registerDto: RegisterDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: Partial<UserTenantMap>;
  }> {
    const { email, password, full_name, phone, tenant_id } = registerDto;

    // Verify tenant exists
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenant_id, is_active: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if user already exists in this tenant
    const existingUser = await this.userTenantRepository.findOne({
      where: { email, tenant_id },
    });
    if (existingUser) {
      throw new ConflictException('User already exists in this organization');
    }

    // Check if this is the first user for the tenant (make them owner)
    const tenantUserCount = await this.userTenantRepository.count({
      where: { tenant_id },
    });
    const role = tenantUserCount === 0 ? UserRole.OWNER : UserRole.EMPLOYEE;

    // Hash password
    const saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'), 10);
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user-tenant mapping
    const userMapping = this.userTenantRepository.create({
      email,
      password_hash,
      full_name,
      phone,
      tenant_id,
      role,
    });

    await this.userTenantRepository.save(userMapping);

    // Update tenant user count
    tenant.current_users += 1;
    await this.tenantRepository.save(tenant);

    // Load relation for token generation
    userMapping.tenant = tenant;

    const tokens = await this.generateTokens(userMapping);

    return {
      ...tokens,
      user: this.sanitizeUser(userMapping),
    };
  }

  // ==================== ADMIN AUTHENTICATION ====================

  async adminLogin(adminLoginDto: AdminLoginDto): Promise<{
    access_token: string;
    refresh_token: string;
    admin: Partial<AdminUser>;
  }> {
    const { email, password } = adminLoginDto;

    const admin = await this.adminUserRepository.findOne({
      where: { email, is_active: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin',
    };

    const access_token = this.jwtService.sign({ ...payload });
    const refresh_token = this.jwtService.sign({ ...payload }, {
      expiresIn: '30d',
    });

    // Update last login and refresh token
    admin.last_login_at = new Date();
    admin.refresh_token = refresh_token;
    await this.adminUserRepository.save(admin);

    return {
      access_token,
      refresh_token,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      },
    };
  }

  async createAdmin(email: string, password: string, full_name: string, role: AdminRole = AdminRole.ADMIN): Promise<AdminUser> {
    const existingAdmin = await this.adminUserRepository.findOne({
      where: { email },
    });
    if (existingAdmin) {
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

  // ==================== TOKEN MANAGEMENT ====================

  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      if (payload.type === 'admin') {
        const admin = await this.adminUserRepository.findOne({
          where: { id: payload.sub, refresh_token: refreshToken },
        });
        if (!admin) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        const newPayload: JwtPayload = {
          sub: admin.id,
          email: admin.email,
          role: admin.role,
          type: 'admin',
        };

        const access_token = this.jwtService.sign({ ...newPayload });
        const refresh_token = this.jwtService.sign({ ...newPayload }, {
          expiresIn: '30d',
        });

        admin.refresh_token = refresh_token;
        await this.adminUserRepository.save(admin);

        return { access_token, refresh_token };
      } else {
        const userMapping = await this.userTenantRepository.findOne({
          where: { id: payload.sub, refresh_token: refreshToken },
          relations: ['tenant'],
        });
        if (!userMapping) {
          throw new UnauthorizedException('Invalid refresh token');
        }

        return this.generateTokens(userMapping);
      }
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string, type: 'user' | 'admin'): Promise<void> {
    if (type === 'admin') {
      await this.adminUserRepository.update(userId, { refresh_token: undefined });
    } else {
      await this.userTenantRepository.update(userId, { refresh_token: undefined });
    }
  }

  // ==================== HELPERS ====================

  private async generateTokens(userMapping: UserTenantMap): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    const payload: JwtPayload = {
      sub: userMapping.id,
      email: userMapping.email,
      tenantId: userMapping.tenant_id,
      tenantSlug: userMapping.tenant?.slug,
      role: userMapping.role,
      type: 'user',
    };

    const access_token = this.jwtService.sign({ ...payload });
    const refresh_token = this.jwtService.sign({ ...payload }, {
      expiresIn: '30d',
    });

    // Save refresh token
    userMapping.refresh_token = refresh_token;
    await this.userTenantRepository.save(userMapping);

    return { access_token, refresh_token };
  }

  private sanitizeUser(userMapping: UserTenantMap): Partial<UserTenantMap> {
    return {
      id: userMapping.id,
      email: userMapping.email,
      full_name: userMapping.full_name,
      phone: userMapping.phone,
      role: userMapping.role,
      tenant_id: userMapping.tenant_id,
      tenant: userMapping.tenant
        ? {
            id: userMapping.tenant.id,
            slug: userMapping.tenant.slug,
            company_name: userMapping.tenant.company_name,
          } as Tenant
        : undefined,
    };
  }
}
