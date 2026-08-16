import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Tenant, SubscriptionStatus } from './entities/tenant.entity';
import { TenantUser, UserRole } from './entities/tenant-user.entity';
import { DatabaseService } from '../database/database.service';
import { TenantLoginDto } from './dto/login.dto';
import { InitialSetupDto } from './dto/setup.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
  type: 'tenant_user';
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * One-way SHA-256 hash of a refresh token before storing in DB.
   * If the database is ever breached, raw tokens cannot be extracted.
   */
  private readonly logger = new Logger(AuthService.name);

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(loginDto: TenantLoginDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: Partial<TenantUser>;
    tenant: Partial<Tenant>;
    requires_setup: boolean;
  }> {
    const { tenant_slug, email, password } = loginDto;

    // Find tenant
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenant_slug },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant or credentials');
    }

    // Check tenant status
    if (!tenant.is_active) {
      throw new UnauthorizedException('Tenant is inactive');
    }

    if (tenant.subscription_status === SubscriptionStatus.SUSPENDED) {
      throw new UnauthorizedException('Tenant subscription is suspended');
    }

    if (tenant.subscription_status === SubscriptionStatus.CANCELED) {
      throw new UnauthorizedException('Tenant subscription is canceled');
    }

    // Check if setup is complete
    if (!tenant.is_setup_complete) {
      throw new BadRequestException(
        'Tenant setup is not complete. Please complete initial setup first.',
      );
    }

    // Get tenant database connection
    const tenantConnection = await this.databaseService.getTenantConnection(
      tenant.database_name,
    );
    const userRepository = tenantConnection.getRepository(TenantUser);

    // Find user
    const user = await userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('User account is disabled');
    }

    if (!user.is_password_set || !user.password_hash) {
      throw new BadRequestException(
        'Password not set. Please set your password first.',
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role,
      type: 'tenant_user',
    };

    const access_token = this.jwtService.sign({ ...payload });
    const refresh_token = this.jwtService.sign(
      { ...payload },
      {
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as any,
      },
    );

    // Update user's last login and store HASHED refresh token (never store raw tokens)
    await tenantConnection.query(
      `UPDATE users SET last_login_at = NOW(), refresh_token = $1, updated_at = NOW() WHERE id = $2`,
      [this.hashToken(refresh_token), user.id],
    );

    // Return response
    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        position: user.position,
        phone: user.phone,
        avatar_url: user.avatar_url,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        company_name: tenant.company_name,
        subscription_plan: tenant.subscription_plan,
        enabled_features: tenant.enabled_features,
      },
      requires_setup: false,
    };
  }

  async completeInitialSetup(setupDto: InitialSetupDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: Partial<TenantUser>;
    tenant: Partial<Tenant>;
  }> {
    const { setup_token, owner_email, owner_name, password, phone } = setupDto;

    // Find tenant by setup token
    const tenant = await this.tenantRepository.findOne({
      where: { setup_token },
    });

    if (!tenant) {
      throw new BadRequestException('Invalid or expired setup token');
    }

    if (
      tenant.setup_token_expires_at &&
      new Date() > tenant.setup_token_expires_at
    ) {
      throw new BadRequestException('Setup token has expired');
    }

    if (tenant.is_setup_complete) {
      throw new BadRequestException('Setup has already been completed');
    }

    // Create tenant database if not exists
    await this.databaseService.createTenantDatabase(tenant.database_name);

    // Get tenant database connection
    const tenantConnection = await this.databaseService.getTenantConnection(
      tenant.database_name,
    );
    const userRepository = tenantConnection.getRepository(TenantUser);

    // Check if user already exists
    const existingUser = await userRepository.findOne({
      where: { email: owner_email },
    });
    if (existingUser) {
      // If user exists, check if it's the owner and update password
      if (existingUser.role === 'owner') {
        const saltRounds = parseInt(
          this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'),
          10,
        );
        const password_hash = await bcrypt.hash(password, saltRounds);

        existingUser.password_hash = password_hash;
        existingUser.is_password_set = true;
        existingUser.is_active = true;
        existingUser.full_name = owner_name;
        existingUser.phone = phone || '';

        await userRepository.save(existingUser);

        // Mark tenant setup as complete
        await this.tenantRepository.update(tenant.id, {
          is_setup_complete: true,
          setup_token: null as any,
          setup_token_expires_at: null as any,
          current_users: 1,
        });

        // Generate tokens
        const payload: JwtPayload = {
          sub: existingUser.id,
          email: existingUser.email,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          role: existingUser.role,
          type: 'tenant_user',
        };

        const access_token = this.jwtService.sign({ ...payload });
        const refresh_token = this.jwtService.sign(
          { ...payload },
          {
            expiresIn: this.configService.get<string>(
              'JWT_REFRESH_EXPIRES_IN',
              '7d',
            ) as any,
          },
        );

        // Store HASHED refresh token
        await userRepository.update(existingUser.id, { refresh_token: this.hashToken(refresh_token) as any });

        return {
          access_token,
          refresh_token,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            full_name: existingUser.full_name,
            role: existingUser.role,
            phone: existingUser.phone,
            avatar_url: existingUser.avatar_url,
          },
          tenant: {
            id: tenant.id,
            slug: tenant.slug,
            company_name: tenant.company_name,
            subscription_plan: tenant.subscription_plan,
            enabled_features: tenant.enabled_features,
          },
        };
      } else {
        throw new BadRequestException(
          'Email already exists and is not the owner account',
        );
      }
    }

    // Hash password
    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'),
      10,
    );
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create owner user
    const owner = userRepository.create({
      email: owner_email,
      password_hash,
      full_name: owner_name,
      phone,
      role: 'owner',
      is_active: true,
      is_password_set: true,
    });

    await userRepository.save(owner);

    // Mark tenant setup as complete
    await this.tenantRepository.update(tenant.id, {
      is_setup_complete: true,
      setup_token: null as any,
      setup_token_expires_at: null as any,
      current_users: 1,
    });

    // Generate tokens
    const payload: JwtPayload = {
      sub: owner.id,
      email: owner.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: owner.role,
      type: 'tenant_user',
    };

    const access_token = this.jwtService.sign({ ...payload });
    const refresh_token = this.jwtService.sign(
      { ...payload },
      {
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as any,
      },
    );

    // Store HASHED refresh token
    await userRepository.update(owner.id, { refresh_token: this.hashToken(refresh_token) as any });

    return {
      access_token,
      refresh_token,
      user: {
        id: owner.id,
        email: owner.email,
        full_name: owner.full_name,
        role: owner.role,
        phone: owner.phone,
        avatar_url: owner.avatar_url,
      },
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        company_name: tenant.company_name,
        subscription_plan: tenant.subscription_plan,
        enabled_features: tenant.enabled_features,
      },
    };
  }

  async getTenantBySlug(slug: string): Promise<Partial<Tenant>> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      company_name: tenant.company_name,
      is_setup_complete: tenant.is_setup_complete,
      subscription_status: tenant.subscription_status,
    };
  }

  async verifySetupToken(token: string): Promise<{
    valid: boolean;
    tenant: Partial<Tenant> | null;
  }> {
    this.logger.debug(`Verifying setup token for: ${token.substring(0, 8)}...`);
    const tenant = await this.tenantRepository.findOne({
      where: { setup_token: token },
    });

    if (!tenant) {
      this.logger.debug('Tenant not found for provided setup token');
      return { valid: false, tenant: null };
    }

    this.logger.debug(`Found tenant: ${tenant.slug}, setup_complete: ${tenant.is_setup_complete}`);

    if (
      tenant.setup_token_expires_at &&
      new Date() > tenant.setup_token_expires_at
    ) {
      this.logger.debug(`Setup token expired for tenant: ${tenant.slug}`);
      return { valid: false, tenant: null };
    }

    if (tenant.is_setup_complete) {
      this.logger.debug(`Setup already complete for tenant: ${tenant.slug}`);
      return { valid: false, tenant: null };
    }

    return {
      valid: true,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        company_name: tenant.company_name,
        contact_email: tenant.contact_email,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken);

      // Get tenant connection
      const tenant = await this.tenantRepository.findOne({
        where: { id: payload.tenantId },
      });

      if (!tenant) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tenantConnection = await this.databaseService.getTenantConnection(
        tenant.database_name,
      );
      const userRepository = tenantConnection.getRepository(TenantUser);

      // Compare incoming token against stored hash
      const user = await userRepository.findOne({
        where: { id: payload.sub, refresh_token: this.hashToken(refreshToken) as any },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        role: user.role,
        type: 'tenant_user',
      };

      const access_token = this.jwtService.sign({ ...newPayload });
      const refresh_token = this.jwtService.sign(
        { ...newPayload },
        {
          expiresIn: this.configService.get<string>(
            'JWT_REFRESH_EXPIRES_IN',
            '7d',
          ) as any,
        },
      );

      // Store HASHED new refresh token
      await userRepository.update(user.id, { refresh_token: this.hashToken(refresh_token) as any });

      return { access_token, refresh_token };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, tenantId: string): Promise<void> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (tenant) {
      const tenantConnection = await this.databaseService.getTenantConnection(
        tenant.database_name,
      );
      const userRepository = tenantConnection.getRepository(TenantUser);
      await userRepository.update(userId, { refresh_token: undefined });
    }
  }

  async verifyUserSetupToken(
    token: string,
    email: string,
    tenantSlug: string,
  ): Promise<{
    valid: boolean;
    user?: { full_name: string; email: string };
    message?: string;
  }> {
    try {
      const tenant = await this.tenantRepository.findOne({
        where: { slug: tenantSlug },
      });

      if (!tenant) {
        return { valid: false, message: 'Tenant not found' };
      }

      const tenantConnection = await this.databaseService.getTenantConnection(
        tenant.database_name,
      );

      // Query user with setup token
      const result = await tenantConnection.query(
        `SELECT id, email, full_name, setup_token, setup_token_expires_at, is_password_set 
         FROM users WHERE email = $1 AND setup_token = $2`,
        [email, token],
      );

      if (!result || result.length === 0) {
        return { valid: false, message: 'Invalid or expired setup link' };
      }

      const user = result[0];

      // Check if token is expired
      if (
        user.setup_token_expires_at &&
        new Date() > new Date(user.setup_token_expires_at)
      ) {
        return { valid: false, message: 'Setup link has expired' };
      }

      // Check if password is already set
      if (user.is_password_set) {
        return { valid: false, message: 'Account has already been set up' };
      }

      return {
        valid: true,
        user: {
          full_name: user.full_name,
          email: user.email,
        },
      };
    } catch (error) {
      this.logger.error('Error verifying user setup token', error.stack);
      return { valid: false, message: 'Failed to verify setup token' };
    }
  }

  async completeUserSetup(
    token: string,
    email: string,
    password: string,
    tenantSlug: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    const tenantConnection = await this.databaseService.getTenantConnection(
      tenant.database_name,
    );

    // Verify token again
    const result = await tenantConnection.query(
      `SELECT id, email, full_name, setup_token, setup_token_expires_at, is_password_set 
       FROM users WHERE email = $1 AND setup_token = $2`,
      [email, token],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Invalid or expired setup link');
    }

    const user = result[0];

    // Check if token is expired
    if (
      user.setup_token_expires_at &&
      new Date() > new Date(user.setup_token_expires_at)
    ) {
      throw new BadRequestException('Setup link has expired');
    }

    // Check if password is already set
    if (user.is_password_set) {
      throw new BadRequestException('Account has already been set up');
    }

    // Hash password
    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS', '12'),
      10,
    );
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Update user
    await tenantConnection.query(
      `UPDATE users SET 
        password_hash = $1, 
        is_password_set = true, 
        setup_token = NULL, 
        setup_token_expires_at = NULL,
        updated_at = NOW()
       WHERE id = $2`,
      [password_hash, user.id],
    );

    return {
      success: true,
      message: 'Account setup completed successfully',
    };
  }
}
