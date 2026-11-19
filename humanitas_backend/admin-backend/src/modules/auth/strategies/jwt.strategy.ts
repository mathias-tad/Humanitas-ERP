import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { JwtPayload } from '../auth.service';
import { AdminUser } from '../../user/entities/admin-user.entity';

// Extract JWT from cookies or Authorization header
const cookieExtractor = (req: Request): string | null => {
  if (req && req.cookies) {
    return req.cookies['access_token'] || null;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token');
    }
    // Refresh tokens are never valid as access tokens
    if (payload.token_use === 'refresh') {
      throw new UnauthorizedException('Invalid token');
    }
    // This service only serves platform administrators. Tenant-API tokens are
    // signed with the same secret, so reject anything that is not an admin token.
    if (payload.type !== 'admin') {
      throw new UnauthorizedException('Invalid token');
    }

    // Re-check the account on every request so deactivation and role changes
    // take effect immediately instead of when the token expires.
    const admin = await this.adminUserRepository.findOne({ where: { id: payload.sub } });
    if (!admin || !admin.is_active) {
      throw new UnauthorizedException('Account is not active');
    }

    return {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin' as const,
    };
  }
}
