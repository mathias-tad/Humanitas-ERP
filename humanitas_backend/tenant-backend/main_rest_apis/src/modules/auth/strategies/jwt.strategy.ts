import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth.service';
import { FastifyRequest } from 'fastify';
import { DatabaseService } from '../../database/database.service';

// Extract token from HttpOnly cookie only (secure)
const cookieExtractor = (req: FastifyRequest): string | null => {
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private databaseService: DatabaseService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.email || !payload.tenantId) {
      throw new UnauthorizedException('Invalid token');
    }

    // Check if user exists and is active
    try {
      const connection = await this.databaseService.getTenantConnectionById(
        payload.tenantId,
      );
      // Query both existence and active status
      const result = await connection.query(
        `SELECT is_active FROM users WHERE id = $1`,
        [payload.sub],
      );

      if (!result || result.length === 0) {
        console.warn(`[JwtStrategy] User ${payload.sub} not found in tenant ${payload.tenantId}. Token might be stale.`);
        throw new UnauthorizedException('User not found');
      }

      if (result[0].is_active === false) {
        throw new UnauthorizedException('Your account has been deactivated');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // If we can't connect to check, we should probably fail safe?
      // For now, logging error but potentially allowing if it's just a connection blip?
      // BUT safely, if we can't verify, we shouldn't allow.
      console.error('Error verifying user status:', error);
      throw new UnauthorizedException('Could not verify user status');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      role: payload.role,
      type: payload.type,
    };
  }
}
