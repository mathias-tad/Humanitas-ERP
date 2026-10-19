import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { SettingsService } from './settings.service';
import {
  GeneralSettingsDto,
  CompanySettingsDto,
  NotificationSettingsDto,
  HRSettingsDto,
  PayrollSettingsDto,
  TaskSettingsDto,
  KPISettingsDto,
  EmailSettingsDto,
  ThemeSettingsDto,
  IntegrationsSettingsDto,
} from './dto/settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    tenantSlug: string;
    email: string;
    role: string;
  };
}

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all settings' })
  @RequirePermissions('view_general_settings')
  async getAllSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getSettings(req.user.tenantSlug);
  }

  // General Settings
  @Get('general')
  @ApiOperation({ summary: 'Get general settings' })
  async getGeneralSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getGeneralSettings(req.user.tenantSlug);
  }

  @Patch('general')
  @ApiOperation({ summary: 'Update general settings' })
  @RequirePermissions('edit_general_settings')
  async updateGeneralSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: GeneralSettingsDto,
  ) {
    return this.settingsService.updateGeneralSettings(req.user.tenantSlug, dto);
  }

  // Company Settings
  @Get('company')
  @ApiOperation({ summary: 'Get company settings' })
  @RequirePermissions('view_company_settings', 'view_dashboard')
  async getCompanySettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getCompanySettings(req.user.tenantSlug);
  }

  @Patch('company')
  @ApiOperation({ summary: 'Update company settings' })
  @RequirePermissions('edit_company_settings')
  async updateCompanySettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CompanySettingsDto,
  ) {
    return this.settingsService.updateCompanySettings(req.user.tenantSlug, dto);
  }

  // Notification Settings
  @Get('notifications')
  @ApiOperation({ summary: 'Get notification settings' })
  async getNotificationSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getNotificationSettings(req.user.tenantSlug);
  }

  @Patch('notifications')
  @ApiOperation({ summary: 'Update notification settings' })
  async updateNotificationSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: NotificationSettingsDto,
  ) {
    return this.settingsService.updateNotificationSettings(
      req.user.tenantSlug,
      dto,
    );
  }

  // Departments
  @Get('departments')
  @ApiOperation({ summary: 'Get all departments' })
  @RequirePermissions('view_departments', 'view_company_settings', 'view_users', 'create_users', 'edit_users', 'view_roster')
  async getDepartments(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getDepartments(req.user.tenantSlug);
  }

  @Post('departments')
  @ApiOperation({ summary: 'Create department' })
  @RequirePermissions('manage_departments', 'edit_company_settings', 'create_users', 'edit_users')
  async createDepartment(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name: string; description?: string; parent_id?: string },
  ) {
    return this.settingsService.createDepartment(req.user.tenantSlug, body);
  }

  @Patch('departments/:id')
  @ApiOperation({ summary: 'Update department' })
  @RequirePermissions('manage_departments', 'edit_company_settings')
  async updateDepartment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; parent_id?: string },
  ) {
    return this.settingsService.updateDepartment(req.user.tenantSlug, id, body);
  }

  @Delete('departments/:id')
  @ApiOperation({ summary: 'Delete department' })
  @RequirePermissions('manage_departments', 'edit_company_settings')
  async deleteDepartment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.settingsService.deleteDepartment(req.user.tenantSlug, id);
  }

  // HR Settings
  @Get('hr')
  @ApiOperation({ summary: 'Get HR settings' })
  async getHRSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getHRSettings(req.user.tenantSlug);
  }

  @Patch('hr')
  @ApiOperation({ summary: 'Update HR settings' })
  async updateHRSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: HRSettingsDto,
  ) {
    return this.settingsService.updateHRSettings(req.user.tenantSlug, dto);
  }

  // Payroll Settings
  @Get('payroll')
  @ApiOperation({ summary: 'Get payroll settings' })
  async getPayrollSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getPayrollSettings(req.user.tenantSlug);
  }

  @Patch('payroll')
  @ApiOperation({ summary: 'Update payroll settings' })
  async updatePayrollSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: PayrollSettingsDto,
  ) {
    return this.settingsService.updatePayrollSettings(req.user.tenantSlug, dto);
  }

  // Task Settings
  @Get('tasks')
  @ApiOperation({ summary: 'Get task settings' })
  async getTaskSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getTaskSettings(req.user.tenantSlug);
  }

  @Patch('tasks')
  @ApiOperation({ summary: 'Update task settings' })
  async updateTaskSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TaskSettingsDto,
  ) {
    return this.settingsService.updateTaskSettings(req.user.tenantSlug, dto);
  }

  // KPI Settings
  @Get('kpi')
  @ApiOperation({ summary: 'Get KPI settings' })
  async getKPISettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getKPISettings(req.user.tenantSlug);
  }

  @Patch('kpi')
  @ApiOperation({ summary: 'Update KPI settings' })
  async updateKPISettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: KPISettingsDto,
  ) {
    return this.settingsService.updateKPISettings(req.user.tenantSlug, dto);
  }

  // Email Settings
  @Get('email')
  @ApiOperation({ summary: 'Get email settings' })
  async getEmailSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getEmailSettings(req.user.tenantSlug);
  }

  @Post('email')
  @ApiOperation({ summary: 'Update email settings (create or update)' })
  async updateEmailSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmailSettingsDto,
  ) {
    return this.settingsService.updateEmailSettings(req.user.tenantSlug, dto);
  }

  @Put('email')
  @ApiOperation({ summary: 'Update email settings (full update)' })
  async putEmailSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmailSettingsDto,
  ) {
    return this.settingsService.updateEmailSettings(req.user.tenantSlug, dto);
  }

  @Patch('email')
  @ApiOperation({ summary: 'Update email settings' })
  async patchEmailSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: EmailSettingsDto,
  ) {
    return this.settingsService.updateEmailSettings(req.user.tenantSlug, dto);
  }

  @Post('email/test')
  @ApiOperation({ summary: 'Test email configuration' })
  async testEmailSettings(
    @Req() req: AuthenticatedRequest,
    @Body() body: { email: string },
  ) {
    return this.settingsService.testEmailSettings(
      req.user.tenantSlug,
      body.email,
    );
  }

  // Integrations Settings
  @Get('integrations')
  @ApiOperation({ summary: 'Get integrations settings' })
  async getIntegrationsSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getIntegrationsSettings(req.user.tenantSlug);
  }

  @Patch('integrations')
  @ApiOperation({ summary: 'Update integrations settings' })
  async updateIntegrationsSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: IntegrationsSettingsDto,
  ) {
    return this.settingsService.updateIntegrationsSettings(req.user.tenantSlug, dto);
  }

  // Theme Settings
  @Get('theme')
  @ApiOperation({ summary: 'Get theme settings' })
  async getThemeSettings(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getThemeSettings(req.user.tenantSlug);
  }

  @Patch('theme')
  @ApiOperation({ summary: 'Update theme settings' })
  async updateThemeSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ThemeSettingsDto,
  ) {
    return this.settingsService.updateThemeSettings(req.user.tenantSlug, dto);
  }

  // Timezones
  @Get('timezones')
  @ApiOperation({ summary: 'Get list of all available timezones' })
  async getTimezones() {
    return this.settingsService.getTimezones();
  }

  // Income Types
  @Get('income-types')
  @ApiOperation({ summary: 'Get all active income types' })
  async getIncomeTypes(@Req() req: AuthenticatedRequest) {
    return this.settingsService.getIncomeTypes(req.user.tenantSlug);
  }
}
