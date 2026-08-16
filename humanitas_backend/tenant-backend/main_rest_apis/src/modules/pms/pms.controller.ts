import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { PmsService } from './pms.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/create-task.dto';
import { CreateSprintDto, UpdateSprintDto } from './dto/create-sprint.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/create-team.dto';
import { UpdatePMSSettingsDto } from './dto/update-pms-settings.dto';
import { CreateManualMetricDto } from './dto/create-manual-metric.dto';
import { UpdateManualMetricDto } from './dto/update-manual-metric.dto';
import { LogTimeDto } from './dto/log-time.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pms')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PmsController {
    constructor(private readonly pmsService: PmsService) { }

    // ============ PROJECTS ============
    @Post('projects')
    @RequirePermissions('create_projects')
    createProject(@Req() req, @Body() dto: CreateProjectDto) {
        return this.pmsService.createProject(req.user.tenantId, req.user.sub, dto);
    }

    @Get('projects')
    @RequirePermissions('view_projects', 'view_pms', 'view_tasks', 'view_my_tasks')
    findAllProjects(@Req() req) {
        return this.pmsService.findAllProjects(req.user.tenantId);
    }

    @Get('projects/:id')
    @RequirePermissions('view_projects')
    findOneProject(@Req() req, @Param('id') id: string) {
        return this.pmsService.findOneProject(req.user.tenantId, id);
    }

    @Patch('projects/:id')
    @RequirePermissions('edit_projects')
    updateProject(
        @Req() req,
        @Param('id') id: string,
        @Body() dto: UpdateProjectDto,
    ) {
        return this.pmsService.updateProject(req.user.tenantId, id, dto);
    }

    @Delete('projects/:id')
    @RequirePermissions('delete_projects')
    removeProject(@Req() req, @Param('id') id: string) {
        return this.pmsService.removeProject(req.user.tenantId, id);
    }

    @Get('projects/:id/kpi')
    @RequirePermissions('view_pms_reports')
    getProjectKPIs(@Req() req, @Param('id') id: string) {
        return this.pmsService.getProjectKPIs(req.user.tenantId, id);
    }

    @Post('projects/:id/members')
    @RequirePermissions('manage_project_members')
    addProjectMember(
        @Req() req,
        @Param('id') id: string,
        @Body() dto: AddProjectMemberDto,
    ) {
        return this.pmsService.addProjectMember(req.user.tenantId, id, dto);
    }

    @Delete('projects/:id/members/:userId')
    @RequirePermissions('manage_project_members')
    removeProjectMember(
        @Req() req,
        @Param('id') id: string,
        @Param('userId') userId: string,
    ) {
        return this.pmsService.removeProjectMember(req.user.tenantId, id, userId);
    }

    @Get('projects/:id/members')
    @RequirePermissions('view_project_members')
    getProjectMembers(@Req() req, @Param('id') id: string) {
        return this.pmsService.getProjectMembers(req.user.tenantId, id);
    }

    // ============ SPRINTS ============
    @Patch('projects/:id/members/:userId')
    @RequirePermissions('edit_projects')
    updateProjectMember(
        @Req() req,
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Body() dto: AddProjectMemberDto
    ) {
        return this.pmsService.updateProjectMember(req.user.tenantId, id, userId, dto);
    }

    @Post('sprints')
    @RequirePermissions('manage_sprints')
    createSprint(@Req() req, @Body() dto: CreateSprintDto) {
        return this.pmsService.createSprint(req.user.tenantId, dto);
    }

    @Get('sprints')
    @RequirePermissions('view_sprints')
    findAllSprints(@Req() req, @Query('projectId') projectId: string) {
        return this.pmsService.findAllSprints(req.user.tenantId, projectId);
    }

    // ============ TASKS ============
    @Post('tasks')
    @RequirePermissions('create_tasks')
    createTask(@Req() req, @Body() dto: CreateTaskDto) {
        return this.pmsService.createTask(req.user.tenantId, req.user, dto);
    }

    @Get('tasks')
    // We allow view_tasks AND view_my_tasks. 
    @RequirePermissions('view_pms', 'view_tasks', 'view_my_tasks')
    findAllTasks(@Req() req, @Query() filters: any) {
        // Basic filter logic could be enhanced to restrict 'view_my_tasks' users to only their tasks
        // logic inside service or here based on permissions.
        // For now assuming view_pms allows listing, filtering handled by UI.
        return this.pmsService.findAllTasks(req.user.tenantId, filters);
    }

    @Get('tasks/:id')
    @RequirePermissions('view_pms', 'view_tasks', 'view_my_tasks')
    findOneTask(@Req() req, @Param('id') id: string) {
        return this.pmsService.findOneTask(req.user.tenantId, id);
    }

    @Get('tasks/:id/history')
    async getTaskHistory(
        @Req() req,
        @Param('id') id: string,
    ) {
        return this.pmsService.getTaskHistory(req.user.tenantId, id);
    }

    @Patch('tasks/:id')
    @RequirePermissions('edit_tasks', 'edit_own_tasks')
    updateTask(
        @Req() req,
        @Param('id') id: string,
        @Body() dto: UpdateTaskDto,
    ) {
        // Should verify ownership if only 'edit_own_tasks' is present
        // User ID is stored as 'sub' in JWT payload
        return this.pmsService.updateTask(req.user.tenantId, req.user.sub, id, dto);
    }

    @Delete('tasks/:id')
    @RequirePermissions('delete_tasks')
    removeTask(@Req() req, @Param('id') id: string) {
        return this.pmsService.removeTask(req.user.tenantId, id);
    }

    @Post('tasks/log-time')
    @RequirePermissions('log_time')
    logTime(@Req() req, @Body() dto: LogTimeDto) {
        return this.pmsService.logTime(req.user.tenantId, req.user.sub, dto);
    }

    // ============ SETTINGS ============
    @Get('settings')
    @RequirePermissions('view_pms') // Basic access
    getSettings(@Req() req) {
        return this.pmsService.getSettings(req.user.tenantId);
    }

    @Patch('settings')
    @RequirePermissions('manage_pms_settings')
    updateSettings(@Req() req, @Body() dto: UpdatePMSSettingsDto) {
        return this.pmsService.updateSettings(req.user.tenantId, dto);
    }

    // ============ USER KPI ============
    @Get('kpi/user/:userId')
    @RequirePermissions('view_team_kpis', 'view_own_kpis')
    getUserKPIs(@Req() req, @Param('userId') userId: string) {
        return this.pmsService.getUserKPIs(req.user.tenantId, userId);
    }

    @Get('kpi/tenant/:tenantId')
    @RequirePermissions('view_pms_reports')
    getTenantKPIs(@Req() req, @Param('tenantId') tenantId: string) {
        // Security check: ensure user is requesting for their own tenant
        if (tenantId !== req.user.tenantId) {
            // Or just ignore param and use req.user.tenantId? 
            // Better to match param but enforce check.
            // Actually, we can just use req.user.tenantId to be safe and ignore the param effectively, 
            // but the route expects it. 
        }
        return this.pmsService.getTenantKPIs(req.user.tenantId);
    }

    @Get('kpi/all-users')
    @RequirePermissions('view_pms_reports', 'view_team_kpis')
    getAllUsersKPIs(@Req() req) {
        return this.pmsService.getAllUsersKPIs(req.user.tenantId);
    }

    // ============ TEAMS ============
    @Post('teams')
    @RequirePermissions('create_teams')
    createTeam(@Req() req, @Body() dto: CreateTeamDto) {
        return this.pmsService.createTeam(req.user.tenantId, dto);
    }

    @Get('teams')
    @RequirePermissions('view_teams')
    findAllTeams(@Req() req) {
        return this.pmsService.findAllTeams(req.user.tenantId);
    }

    @Get('teams/:id')
    @RequirePermissions('view_teams')
    findOneTeam(@Req() req, @Param('id') id: string) {
        return this.pmsService.findOneTeam(req.user.tenantId, id);
    }

    @Patch('teams/:id')
    @RequirePermissions('edit_teams')
    updateTeam(@Req() req, @Param('id') id: string, @Body() dto: UpdateTeamDto) {
        return this.pmsService.updateTeam(req.user.tenantId, id, dto);
    }

    @Delete('teams/:id')
    @RequirePermissions('delete_teams')
    removeTeam(@Req() req, @Param('id') id: string) {
        return this.pmsService.removeTeam(req.user.tenantId, id);
    }

    @Post('teams/:id/members')
    @RequirePermissions('manage_team_members')
    addTeamMember(@Req() req, @Param('id') id: string, @Body() dto: AddTeamMemberDto) {
        return this.pmsService.addTeamMember(req.user.tenantId, id, dto, req.user);
    }

    @Delete('teams/:id/members/:userId')
    @RequirePermissions('manage_team_members')
    removeTeamMember(@Req() req, @Param('id') id: string, @Param('userId') userId: string) {
        return this.pmsService.removeTeamMember(req.user.tenantId, id, userId, req.user);
    }

    @Get('teams/:id/members')
    @RequirePermissions('view_teams')
    getTeamMembers(@Req() req, @Param('id') id: string) {
        return this.pmsService.getTeamMembers(req.user.tenantId, id);
    }

    @Get('teams/:id/dashboard')
    @RequirePermissions('view_team_dashboard')
    getTeamDashboard(@Req() req, @Param('id') id: string) {
        return this.pmsService.getTeamDashboard(req.user.tenantId, id);
    }

    // ============ MANUAL METRICS ============
    @Post('metrics')
    @RequirePermissions('manage_pms_settings')
    createMetric(@Req() req, @Body() dto: CreateManualMetricDto) {
        return this.pmsService.createMetric(req.user.tenantId, dto);
    }

    @Get('metrics')
    @RequirePermissions('view_pms_settings', 'manage_pms_settings')
    findAllMetrics(@Req() req) {
        return this.pmsService.findAllMetrics(req.user.tenantId);
    }

    @Patch('metrics/:id')
    @RequirePermissions('manage_pms_settings')
    updateMetric(@Req() req, @Param('id') id: string, @Body() dto: UpdateManualMetricDto) {
        return this.pmsService.updateMetric(req.user.tenantId, id, dto);
    }

    @Delete('metrics/:id')
    @RequirePermissions('manage_pms_settings')
    deleteMetric(@Req() req, @Param('id') id: string) {
        return this.pmsService.deleteMetric(req.user.tenantId, id);
    }
}
