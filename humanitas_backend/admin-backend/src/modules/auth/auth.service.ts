import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminUser } from '../user/entities/admin-user.entity';
import { AdminLoginDto } from './dto/admin-login.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId?: string;
  tenantSlug?: string;
  role: string;
  type: 'user' | 'admin';
  token_use?: 'access' | 'refresh';
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

    const access_token = this.signAccessToken(payload);
    const refresh_token = this.signRefreshToken(payload);

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

  // ==================== TOKEN MANAGEMENT ====================

  async refreshToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
  }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.getRefreshSecret(),
      });

      if (payload.token_use !== 'refresh' || payload.type !== 'admin') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Must still be the admin's current refresh token, and the admin must be active.
      const admin = await this.adminUserRepository.findOne({
        where: { id: payload.sub, refresh_token: refreshToken, is_active: true },
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

      const access_token = this.signAccessToken(newPayload);
      const refresh_token = this.signRefreshToken(newPayload);

      admin.refresh_token = refresh_token;
      await this.adminUserRepository.save(admin);

      return { access_token, refresh_token };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(adminId: string): Promise<void> {
    // NOTE: TypeORM skips `undefined` in update(); use null to actually clear the column.
    await this.adminUserRepository.update(adminId, { refresh_token: null as any });
  }

  // ==================== HELPERS ====================

  /**
   * Refresh tokens use a different signing key from access tokens, so the JWT strategy
   * (which verifies with JWT_SECRET) can never accept a refresh token as an access token.
   */
  private getRefreshSecret(): string {
    const accessSecret = this.configService.get<string>('JWT_SECRET') || '';
    const configured = this.configService.get<string>('JWT_REFRESH_SECRET') || '';
    if (configured && configured !== accessSecret) return configured;
    return crypto.createHmac('sha256', accessSecret).update('humanitas-admin-refresh-token-v1').digest('hex');
  }

  private signAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign({ ...payload, token_use: 'access' });
  }

  private signRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(
      { ...payload, token_use: 'refresh' },
      {
        secret: this.getRefreshSecret(),
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d') as any,
      },
    );
  }
}
