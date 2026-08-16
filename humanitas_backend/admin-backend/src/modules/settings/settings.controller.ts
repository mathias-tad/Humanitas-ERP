import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  UpdateGeneralSettingsDto,
  UpdateEmailSettingsDto,
  UpdateDatabaseSettingsDto,
  UpdateSecuritySettingsDto,
  UpdateServicesSettingsDto,
  TestRedisDto,
} from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all platform settings' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general settings' })
  getGeneralSettings() {
    return this.settingsService.getGeneralSettings();
  }

  @Patch('general')
  @ApiOperation({ summary: 'Update general settings' })
  updateGeneralSettings(@Body() dto: UpdateGeneralSettingsDto) {
    return this.settingsService.updateGeneralSettings(dto);
  }

  @Get('email')
  @ApiOperation({ summary: 'Get email settings' })
  getEmailSettings() {
    return this.settingsService.getEmailSettings();
  }

  @Patch('email')
  @ApiOperation({ summary: 'Update email settings' })
  updateEmailSettings(@Body() dto: UpdateEmailSettingsDto) {
    return this.settingsService.updateEmailSettings(dto);
  }

  @Post('email/test')
  @ApiOperation({ summary: 'Test email connection' })
  testEmailConnection() {
    return this.settingsService.testEmailConnection();
  }

  @Get('database')
  @ApiOperation({ summary: 'Get database settings' })
  getDatabaseSettings() {
    return this.settingsService.getDatabaseSettings();
  }

  @Patch('database')
  @ApiOperation({ summary: 'Update database settings' })
  updateDatabaseSettings(@Body() dto: UpdateDatabaseSettingsDto) {
    return this.settingsService.updateDatabaseSettings(dto);
  }

  @Get('security')
  @ApiOperation({ summary: 'Get security settings' })
  getSecuritySettings() {
    return this.settingsService.getSecuritySettings();
  }

  @Patch('security')
  @ApiOperation({ summary: 'Update security settings' })
  updateSecuritySettings(@Body() dto: UpdateSecuritySettingsDto) {
    return this.settingsService.updateSecuritySettings(dto);
  }

  @Get('services')
  @ApiOperation({ summary: 'Get services settings (Redis, calculation service)' })
  getServicesSettings() {
    return this.settingsService.getServicesSettings();
  }

  @Patch('services')
  @ApiOperation({ summary: 'Update services settings' })
  updateServicesSettings(@Body() dto: UpdateServicesSettingsDto) {
    return this.settingsService.updateServicesSettings(dto);
  }

  @Post('services/test-redis')
  @ApiOperation({ summary: 'Test Redis connection' })
  testRedisConnection(@Body() dto: TestRedisDto) {
    return this.settingsService.testRedisConnection(dto.redis_url);
  }
}
