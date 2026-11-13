import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { SelectTenantDto } from './dto/select-tenant.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) { }

  private getCookieOptions(maxAgeSeconds: number) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('COOKIE_DOMAIN');

    const frontendUrl = this.configService.get<string>('ADMIN_FRONTEND_URL') || this.configService.get<string>('FRONTEND_URL') || '';
    const isHttps = isProduction && frontendUrl.startsWith('https://');

    return {
      httpOnly: true,
      secure: isHttps, // False for HTTP
      sameSite: 'lax' as const, // Lax works for top-level navigation, strict might break some flows
      path: '/',
      maxAge: maxAgeSeconds * 1000,
      ...(cookieDomain && { domain: cookieDomain }),
    };
  }

  // ==================== USER AUTH ====================

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login - returns tokens or tenant selection' })
  @ApiResponse({ status: 200, description: 'Login successful or tenant selection required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Select tenant after login (for multi-tenant users)' })
  @ApiResponse({ status: 200, description: 'Tenant selected, tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or tenant' })
  selectTenant(@Body() selectTenantDto: SelectTenantDto) {
    return this.authService.selectTenant(selectTenantDto);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user in a tenant' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists in this tenant' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  // ==================== ADMIN AUTH ====================

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Admin login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async adminLogin(@Body() adminLoginDto: AdminLoginDto, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.adminLogin(adminLoginDto);

    // Set HttpOnly cookies
    res.cookie('access_token', result.access_token, this.getCookieOptions(6 * 60 * 60)); // 6 hours
    res.cookie('refresh_token', result.refresh_token, this.getCookieOptions(7 * 24 * 60 * 60)); // 7 days

    // Return user data only (no tokens in response body)
    return {
      admin: result.admin,
    };
  }

  // ==================== TOKEN MANAGEMENT ====================

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New tokens generated' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout - invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Request() req: any, @Res({ passthrough: true }) res: any) {
    await this.authService.logout(req.user.sub, req.user.type);

    // Clear cookies with same options (required for cross-origin)
    const clearOptions = this.getCookieOptions(0);
    res.clearCookie('access_token', clearOptions);
    res.clearCookie('refresh_token', clearOptions);

    return { message: 'Logged out successfully' };
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user info from token' })
  me(@Request() req: any) {
    return {
      id: req.user.sub,
      email: req.user.email,
      role: req.user.role,
      type: req.user.type,
      tenantId: req.user.tenantId,
      tenantSlug: req.user.tenantSlug,
    };
  }
}
