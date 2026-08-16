import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TenantLoginDto } from './dto/login.dto';
import { InitialSetupDto } from './dto/setup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  private getCookieOptions(maxAgeSeconds: number) {
    // Read from env: COOKIE_SECURE=true in production (HTTPS), false for HTTP/VPS
    const isHttps = this.configService.get<string>('COOKIE_SECURE', 'false') === 'true';

    return {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeSeconds,
    };
  }

  // 10 attempts per 60 seconds per IP — brute-force protection
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login as tenant user' })
  async login(
    @Body() loginDto: TenantLoginDto,
    @Res({ passthrough: true }) reply: any,
  ) {
    const result = await this.authService.login(loginDto);

    // Set HttpOnly cookies
    reply.setCookie(
      'access_token',
      result.access_token,
      this.getCookieOptions(6 * 60 * 60),
    ); // 6 hours
    reply.setCookie(
      'refresh_token',
      result.refresh_token,
      this.getCookieOptions(7 * 24 * 60 * 60),
    ); // 7 days

    // Return tokens in response body as well (for localStorage fallback in cross-origin)
    return {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      user: result.user,
      tenant: result.tenant,
      requires_setup: result.requires_setup,
    };
  }

  @Post('setup')
  @ApiOperation({ summary: 'Complete initial tenant setup' })
  completeSetup(@Body() setupDto: InitialSetupDto) {
    return this.authService.completeInitialSetup(setupDto);
  }

  @Get('setup/verify')
  @ApiOperation({ summary: 'Verify setup token' })
  verifySetupToken(@Query('token') token: string) {
    return this.authService.verifySetupToken(token);
  }

  @Get('verify-setup-token')
  @ApiOperation({ summary: 'Verify user account setup token' })
  verifyUserSetupToken(
    @Query('token') token: string,
    @Query('email') email: string,
    @Query('tenant') tenant: string,
  ) {
    return this.authService.verifyUserSetupToken(token, email, tenant);
  }

  @Post('complete-setup')
  @ApiOperation({ summary: 'Complete user account setup' })
  completeUserSetup(
    @Body() body: { token: string; email: string; password: string },
    @Request() req: any,
  ) {
    const tenantSlug = req.headers['x-tenant-slug'];
    return this.authService.completeUserSetup(
      body.token,
      body.email,
      body.password,
      tenantSlug,
    );
  }

  @Get('tenant/:slug')
  @ApiOperation({ summary: 'Get tenant info by slug' })
  getTenantBySlug(@Param('slug') slug: string) {
    return this.authService.getTenantBySlug(slug);
  }

  // 20 refresh attempts per 60 seconds per IP
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(
    @Request() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    // Read refresh token from cookie
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      reply.status(401);
      return { message: 'No refresh token provided' };
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Set new cookies
    reply.setCookie(
      'access_token',
      result.access_token,
      this.getCookieOptions(6 * 60 * 60),
    ); // 6 hours
    reply.setCookie(
      'refresh_token',
      result.refresh_token,
      this.getCookieOptions(7 * 24 * 60 * 60),
    ); // 7 days

    return { message: 'Token refreshed successfully' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Request() req: any, @Res({ passthrough: true }) reply: any) {
    // Clear cookies
    reply.clearCookie('access_token', { path: '/' });
    reply.clearCookie('refresh_token', { path: '/' });

    // If user is authenticated, also invalidate on backend
    if (req.user?.sub && req.user?.tenantId) {
      await this.authService.logout(req.user.sub, req.user.tenantId);
    }

    return { message: 'Logged out successfully' };
  }

  @SkipThrottle() // Authenticated endpoint — no need to rate-limit
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  getCurrentUser(@Request() req: any) {
    return {
      id: req.user.sub,
      email: req.user.email,
      tenantId: req.user.tenantId,
      tenantSlug: req.user.tenantSlug,
      role: req.user.role,
    };
  }

  @Get('ws-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get WebSocket authentication token' })
  async getWebSocketToken(@Request() req: any) {
    // Return the access token from cookie or generate a new short-lived one
    const token =
      req.cookies?.access_token ||
      req.headers.authorization?.replace('Bearer ', '');
    return {
      token,
      expiresIn: 3600, // 1 hour
    };
  }
}
