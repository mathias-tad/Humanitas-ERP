import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleSubscriptionGuard, RequireModule } from '../auth/guards/module-subscription.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { HrmsTrainingService } from './hrms-training.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateSessionDto,
  EnrollLearnerDto,
  UpdateEnrollmentProgressDto,
  UpsertSkillDto,
} from './dto/hrms-training.dto';

@Controller('hrms/training')
@UseGuards(JwtAuthGuard, ModuleSubscriptionGuard, PermissionsGuard)
@RequireModule('hrms')
export class HrmsTrainingController {
  constructor(private readonly trainingService: HrmsTrainingService) {}

  private getTenantId(req: any, headerTenantId?: string): string {
    return req.user?.tenantId || req.user?.tenant_id || headerTenantId;
  }

  // ── COURSES CATALOG ───────────────────────────────────────────────────────

  @Get('courses')
  @RequirePermissions('view_training_courses', 'view_my_training', 'manage_training')
  async getCourses(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('category') category?: string,
    @Query('delivery_method') delivery_method?: string,
    @Query('is_mandatory') is_mandatory?: string,
    @Query('is_active') is_active?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.getCourses(tenantId, {
      category,
      delivery_method,
      is_mandatory: is_mandatory !== undefined ? is_mandatory === 'true' : undefined,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    });
  }

  @Get('courses/:id')
  @RequirePermissions('view_training_courses', 'view_my_training', 'manage_training')
  async getCourseById(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.getCourseById(tenantId, id);
  }

  @Post('courses')
  @RequirePermissions('manage_training')
  async createCourse(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: CreateCourseDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.createCourse(tenantId, dto);
  }

  @Put('courses/:id')
  @RequirePermissions('manage_training')
  async updateCourse(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.updateCourse(tenantId, id, dto);
  }

  // ── SESSIONS & SCHEDULE ───────────────────────────────────────────────────

  @Get('sessions')
  @RequirePermissions('view_training_courses', 'view_my_training', 'manage_training')
  async getSessions(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('course_id') course_id?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.getSessions(tenantId, course_id);
  }

  @Post('sessions')
  @RequirePermissions('manage_training')
  async createSession(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: CreateSessionDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.createSession(tenantId, dto);
  }

  // ── ENROLLMENTS & COMPLIANCE ──────────────────────────────────────────────

  @Get('enrollments')
  @RequirePermissions('view_training_courses', 'view_my_training', 'manage_training')
  async getEnrollments(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('course_id') course_id?: string,
    @Query('user_id') user_id?: string,
    @Query('status') status?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const hasManage = req.user?.permissions?.includes('manage_training') ||
                      req.user?.permissions?.includes('*') ||
                      ['admin', 'administrator', 'owner'].includes(req.user?.role?.toLowerCase());

    // Regular learners only view their own enrollments
    const targetUserId = hasManage ? user_id : req.user.sub || req.user.id;
    return this.trainingService.getEnrollments(tenantId, {
      course_id,
      user_id: targetUserId,
      status,
    });
  }

  @Get('my-enrollments')
  @RequirePermissions('view_my_training', 'view_training_courses', 'manage_training')
  async getMyEnrollments(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.getEnrollments(tenantId, { user_id: req.user.sub || req.user.id });
  }

  @Get('enrollments/:id')
  @RequirePermissions('view_training_courses', 'view_my_training', 'manage_training')
  async getEnrollmentById(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.getEnrollmentById(tenantId, id);
  }

  @Post('enrollments')
  @RequirePermissions('enroll_training', 'manage_training')
  async enrollLearner(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: EnrollLearnerDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const hasManage = req.user?.permissions?.includes('manage_training') ||
                      req.user?.permissions?.includes('*') ||
                      ['admin', 'administrator', 'owner'].includes(req.user?.role?.toLowerCase());

    const targetUserId = hasManage && dto.user_id ? dto.user_id : req.user.sub || req.user.id;
    return this.trainingService.enrollLearner(
      tenantId,
      { ...dto, user_id: targetUserId },
      req.user.sub || req.user.id,
    );
  }

  @Put('enrollments/:id')
  @RequirePermissions('manage_training', 'complete_training')
  async updateEnrollmentProgress(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentProgressDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.updateEnrollmentProgress(tenantId, id, dto);
  }

  // ── SKILLS MATRIX ─────────────────────────────────────────────────────────

  @Get('skills')
  @RequirePermissions('view_skills', 'manage_skills', 'view_my_training')
  async getEmployeeSkills(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Query('user_id') user_id?: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const hasManage = req.user?.permissions?.includes('manage_skills') ||
                      req.user?.permissions?.includes('*') ||
                      ['admin', 'administrator', 'owner'].includes(req.user?.role?.toLowerCase());

    const targetUserId = hasManage ? user_id : (user_id || req.user.sub || req.user.id);
    return this.trainingService.getEmployeeSkills(tenantId, targetUserId);
  }

  @Post('skills')
  @RequirePermissions('manage_skills', 'view_my_training')
  async upsertEmployeeSkill(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
    @Body() dto: UpsertSkillDto,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    const hasManage = req.user?.permissions?.includes('manage_skills') ||
                      req.user?.permissions?.includes('*') ||
                      ['admin', 'administrator', 'owner'].includes(req.user?.role?.toLowerCase());

    const targetUserId = hasManage && dto.user_id ? dto.user_id : req.user.sub || req.user.id;
    const isVerified = hasManage ? dto.verified : false;

    return this.trainingService.upsertEmployeeSkill(
      tenantId,
      { ...dto, user_id: targetUserId, verified: isVerified },
      req.user.sub || req.user.id,
    );
  }

  // ── TRAINING REPORTS & STATS ──────────────────────────────────────────────

  @Get('stats')
  @RequirePermissions('view_training_reports', 'manage_training', 'view_my_training')
  async getTrainingStats(
    @Request() req: any,
    @Headers('x-tenant-id') tenantIdHeader: string,
  ) {
    const tenantId = this.getTenantId(req, tenantIdHeader);
    return this.trainingService.getTrainingStats(tenantId);
  }
}
