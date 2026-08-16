import { Injectable, NotFoundException, ConflictException, ForbiddenException, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { Repository, ObjectLiteral, EntityTarget } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { Sprint } from './entities/sprint.entity';
import { Task } from './entities/task.entity';
import { PMSSettings } from './entities/pms-settings.entity';
import { ProjectMember, ProjectRole } from './entities/project-member.entity';
import { Team } from './entities/team.entity';
import { TeamMember } from './entities/team-member.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { CreateTeamDto, UpdateTeamDto, AddTeamMemberDto } from './dto/create-team.dto';
import { CreateTaskDto, UpdateTaskDto } from './dto/create-task.dto';
import { CreateSprintDto, UpdateSprintDto } from './dto/create-sprint.dto';
import { UpdatePMSSettingsDto } from './dto/update-pms-settings.dto';
import { LogTimeDto } from './dto/log-time.dto';
import { TaskTimeLog } from './entities/task-time-log.entity';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { ManualKPIMetric } from './entities/manual-kpi-metric.entity';
import { ManualKPIScore } from './entities/manual-kpi-score.entity';
import { CreateManualMetricDto } from './dto/create-manual-metric.dto';
import { UpdateManualMetricDto } from './dto/update-manual-metric.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TaskStatus } from './entities/task.entity';
import { TaskActivityLog, ActivityAction } from './entities/task-activity-log.entity';
import { TenantUser } from '../auth/entities/tenant-user.entity';
import { RolesService } from '../roles/roles.service';

@Injectable()
export class PmsService {
    private syncedTenants = new Set<string>();

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly notificationsService: NotificationsService,
        @Inject(forwardRef(() => RolesService))
        private readonly rolesService: RolesService,
    ) { }

    private async notifyKPIUpdate(tenantId: string, userIds: string[]) {
        const uniqueIds = [...new Set(userIds.filter(id => id))];
        if (uniqueIds.length === 0) return;

        try {
            await this.notificationsService.createBulkNotifications(tenantId, uniqueIds, {
                type: 'pms-kpi-update',
                title: 'KPI Updated',
                message: 'Your performance metrics have been updated.'
            });
        } catch (error) {
            console.error('Failed to notify KPI update:', error);
        }
    }

    private async getTenantRepo<T extends ObjectLiteral>(tenantId: string, entity: EntityTarget<T>): Promise<Repository<T>> {
        const connection = await this.databaseService.getTenantConnectionById(tenantId);

        // Ensure PMS tables exist in the tenant database
        if (!this.syncedTenants.has(tenantId)) {
            // Only strictly necessary if tables are not created by global sync
            // Since DatabaseService has synchronize: false, we run it here lazily
            // Syncing is now handled via manual migration (POST /system/logs/migrate)
            // to avoid duplicates and race conditions.
            this.syncedTenants.add(tenantId);
        }

        return connection.getRepository(entity);
    }

    // Projects
    async createProject(tenantId: string, userId: string, dto: CreateProjectDto) {
        const repo = await this.getTenantRepo<Project>(tenantId, Project);
        const project = repo.create({
            ...dto,
            tenant_id: tenantId,
            created_by: userId,
        });
        return repo.save(project);
    }

    async findAllProjects(tenantId: string) {
        const repo = await this.getTenantRepo<Project>(tenantId, Project);
        return repo.find({
            where: { tenant_id: tenantId },
            order: { created_at: 'DESC' },
            relations: ['manager', 'creator', 'members.user', 'sprints', 'team'],
        });
    }

    async findOneProject(tenantId: string, id: string) {
        const repo = await this.getTenantRepo<Project>(tenantId, Project);
        const project = await repo.findOne({
            where: { id, tenant_id: tenantId },
            relations: ['manager', 'creator', 'members.user', 'sprints', 'team'],
        });
        if (!project) throw new NotFoundException('Project not found');
        return project;
    }

    async updateProject(tenantId: string, id: string, dto: UpdateProjectDto) {
        const repo = await this.getTenantRepo<Project>(tenantId, Project);
        await this.findOneProject(tenantId, id); // Ensure exists
        await repo.update({ id, tenant_id: tenantId }, dto);
        return this.findOneProject(tenantId, id);
    }

    async removeProject(tenantId: string, id: string) {
        const repo = await this.getTenantRepo<Project>(tenantId, Project);
        const project = await this.findOneProject(tenantId, id);
        // Soft delete by updating status to ARCHIVED
        project.status = ProjectStatus.ARCHIVED;
        return repo.save(project);
    }

    async addProjectMember(tenantId: string, projectId: string, dto: AddProjectMemberDto) {
        const memberRepo = await this.getTenantRepo<ProjectMember>(tenantId, ProjectMember);
        // Check if project exists (optional, implicit by FK, but good for error msg)
        const project = await this.findOneProject(tenantId, projectId);

        // STICT TEAM PROJECT CHECK
        if (project.team_id) {
            const teamMemberRepo = await this.getTenantRepo(tenantId, TeamMember);
            const isTeamMember = await teamMemberRepo.findOne({ where: { team_id: project.team_id, user_id: dto.user_id } });
            if (!isTeamMember) {
                throw new BadRequestException('For Team Projects, you can only add members who belong to the owning Team.');
            }
        }

        // Check if already a member
        const existing = await memberRepo.findOne({ where: { project_id: projectId, user_id: dto.user_id } });
        if (existing) {
            throw new ConflictException('User is already a member of this project');
        }

        const member = memberRepo.create({
            project_id: projectId,
            user_id: dto.user_id,
            role: dto.role || ProjectRole.MEMBER,
            can_create_tasks: dto.can_create_tasks || false,
        });
        return memberRepo.save(member);
    }

    async updateProjectMember(tenantId: string, projectId: string, userId: string, dto: AddProjectMemberDto) {
        const memberRepo = await this.getTenantRepo<ProjectMember>(tenantId, ProjectMember);
        // Check if project exists (optional, implicit by FK, but good for error msg)
        // await this.findOneProject(tenantId, projectId); // Optimized out if we trust ID, but good for safety.

        // Check if member exists
        const member = await memberRepo.findOne({ where: { project_id: projectId, user_id: userId } });
        if (!member) {
            throw new NotFoundException('Project member not found');
        }

        if (dto.role) member.role = dto.role;
        if (dto.can_create_tasks !== undefined) member.can_create_tasks = dto.can_create_tasks;

        return memberRepo.save(member);
    }

    async removeProjectMember(tenantId: string, projectId: string, userId: string) {
        const memberRepo = await this.getTenantRepo<ProjectMember>(tenantId, ProjectMember);
        return memberRepo.delete({ project_id: projectId, user_id: userId });
    }

    async getProjectMembers(tenantId: string, projectId: string) {
        const memberRepo = await this.getTenantRepo<ProjectMember>(tenantId, ProjectMember);
        return memberRepo.find({
            where: { project_id: projectId },
            relations: ['user'],
        });
    }

    // Tasks
    async createTask(tenantId: string, currentUser: TenantUser, dto: CreateTaskDto) {
        const repo = await this.getTenantRepo<Task>(tenantId, Task);
        const userRepo = await this.getTenantRepo<TenantUser>(tenantId, TenantUser);
        const projectRepo = await this.getTenantRepo<Project>(tenantId, Project);

        // Fetch Project with Team and Members
        const project = await projectRepo.findOne({
            where: { id: dto.project_id },
            relations: ['team', 'members'],
        });

        if (!project) throw new NotFoundException('Project not found');

        // GATEKEEPER CHECK: If project belongs to a team, restricted access
        if (project.team_id) {
            let canCreate = false;

            // 1. Global Permission (Admin/Owner)
            const hasGlobalCreate = await this.rolesService.hasPermission(tenantId, currentUser.role_id, 'create_tasks');
            // Assuming admins have create_tasks. But we need to distinguish "Global Admin" vs "User with create_tasks".
            // Implementation Plan said: "Global create_tasks permission is overruled... except for Tenant Owners/Admins".
            // We can check 'manage_pms_settings' or 'manage_teams' as proxy for Admin, or rely on RolesService to return true for Admin role automatically if handled there.
            // Let's assume strict project rules override standard 'create_tasks' unless explicit override.
            // For now, let's allow if user is Team Leader or Project Manager.

            // Check if Leader
            if (project.team?.leader_id === currentUser.id) canCreate = true;

            // Check if Project Manager
            if (project.manager_id === currentUser.id) canCreate = true;

            // Check if Whitelisted Member
            if (!canCreate) {
                const member = project.members.find(m => m.user_id === currentUser.id);
                if (member && member.can_create_tasks) canCreate = true;
            }

            // Check Global Admin/Owner Override (optional, usually implied by permissions, but here we want to restrict standard users)
            // If user has 'manage_teams' (High level permission), allow.
            const isAdmin = await this.rolesService.hasPermission(tenantId, currentUser.role_id, 'manage_teams');
            if (isAdmin) canCreate = true;

            if (!canCreate) {
                throw new ForbiddenException('Restricted Project: Only Team Leader, Manager, or authorized members can create tasks.');
            }

            // ASSIGNMENT SCOPE CHECK
            if (dto.assignee_id) {
                const teamMemberRepo = await this.getTenantRepo(tenantId, TeamMember);
                const isTeamMember = await teamMemberRepo.findOne({ where: { team_id: project.team_id, user_id: dto.assignee_id } });
                if (!isTeamMember) {
                    throw new BadRequestException('Tasks in this project can only be assigned to members of the owning team.');
                }
            }
        }

        const task = repo.create({
            ...dto,
            tenant_id: tenantId,
            reporter_id: currentUser.id, // Use ID from currentUser
        });
        const savedTask = await repo.save(task);

        // Log task creation
        await this.logActivity(tenantId, savedTask.id, currentUser.id, ActivityAction.CREATE, {
            to: savedTask.title,
            reason: `Task created by ${currentUser.email}` // Use email as fallback name
        }, new Date());

        // Log initial assignment if assignee is set
        if (savedTask.assignee_id) {
            const assignee = await userRepo.findOne({ where: { id: savedTask.assignee_id } });
            await this.logActivity(tenantId, savedTask.id, currentUser.id, ActivityAction.ASSIGN, {
                from: 'Unassigned',
                to: assignee?.full_name || 'Unknown',
            }, new Date());

            // Notify Assignee
            this.notificationsService.createNotification(tenantId, savedTask.assignee_id, {
                type: 'task-assigned',
                title: 'New Task Assigned',
                message: `You have been assigned a new task: ${savedTask.title}`,
                referenceId: savedTask.id
            });
        }

        this.notifyKPIUpdate(tenantId, [savedTask.assignee_id, savedTask.reporter_id]);
        return savedTask;
    }

    async findAllTasks(tenantId: string, filters?: any) {
        const repo = await this.getTenantRepo<Task>(tenantId, Task);
        const where: any = { tenant_id: tenantId };
        if (filters?.projectId) where.project_id = filters.projectId;
        if (filters?.assigneeId) where.assignee_id = filters.assigneeId;
        if (filters?.status) where.status = filters.status;
        if (filters?.sprintId) where.sprint_id = filters.sprintId;

        return repo.find({
            where,
            order: { created_at: 'DESC' },
            relations: ['project', 'assignee', 'reporter', 'sprint'],
        });
    }

    async findOneTask(tenantId: string, id: string) {
        const repo = await this.getTenantRepo<Task>(tenantId, Task);
        const task = await repo.findOne({
            where: { id, tenant_id: tenantId },
            relations: [
                'project',
                'assignee',
                'reporter',
                'sprint',
                'parentTask',
                'comments.user',
                'attachments.uploader',
                'timeLogs.user',
            ],
        });
        if (!task) throw new NotFoundException('Task not found');
        return task;
    }

    // --- WORKFLOW HELPERS ---
    private async logActivity(
        tenantId: string,
        taskId: string,
        userId: string,
        action: ActivityAction,
        details: { from?: string; to?: string; reason?: string },
        createdAt: Date = new Date()
    ) {
        console.log(`[LOG ACTIVITY] userId received: "${userId}", taskId: ${taskId}, action: ${action}`);
        if (!userId) {
            console.error('[LOG ACTIVITY] ERROR: userId is null/undefined!');
            throw new Error('Cannot log activity: userId is required');
        }
        const repo = await this.getTenantRepo(tenantId, TaskActivityLog);
        const log = repo.create({
            task_id: taskId,
            user_id: userId,
            action,
            from_value: details.from,
            to_value: details.to,
            reason: details.reason,
            created_at: createdAt,
        });
        console.log('[LOG ACTIVITY] About to save:', log);
        await repo.save(log);
    }

    private validateTransition(
        task: Task,
        newStatus: TaskStatus,
        userId: string,
        user: TenantUser | null
    ) {
        const isAssignee = task.assignee_id === userId;
        const isReviewer = task.reviewer_id === userId;
        // Basic Permissions Check (simplified for service - strictly we should check roles)
        // For now, we enforce Logic-based roles.

        // 1. Backlog -> To Do (Manager/Admin only - usually handled by Guard, but we can double check)

        // 2. To Do -> In Progress
        if (task.status === TaskStatus.TODO && newStatus === TaskStatus.IN_PROGRESS) {
            // Allowed for Assignee
            return;
        }

        // 3. In Progress -> In Review
        if (task.status === TaskStatus.IN_PROGRESS && newStatus === TaskStatus.IN_REVIEW) {
            if (!isAssignee) throw new ConflictException('Only the assignee can submit for review.');
            return;
        }

        // 4. In Review -> Done (Reviewer Only)
        if (task.status === TaskStatus.IN_REVIEW && newStatus === TaskStatus.DONE) {
            if (task.reviewer_id && !isReviewer) throw new ConflictException('Only the assigned reviewer can approve this task.');
            if (!task.reviewer_id) {
                // If no reviewer, technically anyone with permission can, but we want to force Claiming first?
                // For "World Class", we assume implicit claim if allowed, OR force them to claim first.
                // Let's allow instant approval if no specific reviewer, but log it.
            }
            return;
        }

        // 5. In Review -> In Progress (Rejection)
        if (task.status === TaskStatus.IN_REVIEW && newStatus === TaskStatus.IN_PROGRESS) {
            if (task.reviewer_id && !isReviewer) throw new ConflictException('Only the assigned reviewer can reject this task.');
            return;
        }

        // 6. Grace Period (Undo)
        const GRACE_PERIOD_MS = 30 * 1000; // 30s
        if (task.status_changed_at) {
            const timeSinceChange = new Date().getTime() - new Date(task.status_changed_at).getTime();
            if (timeSinceChange < GRACE_PERIOD_MS && task.status_changed_by === userId) {
                // Allow Undo (returning to previous status - effectively any transition is allowed if it's an undo)
                return;
            }
        }

        // 7. Blocking
        if (newStatus === TaskStatus.BLOCKED) return;
        // Unblocking - if current status is blocked, allow any transition to unblock
        if ((task.status as string) === TaskStatus.BLOCKED) return;

        // If strict flow enabled, we might reject other jumps. For now, we allow others if not caught above, 
        // assuming standard role guards are in place. But "World Class" should be strict.
    }


    async getTaskHistory(tenantId: string, taskId: string) {
        const repo = await this.getTenantRepo(tenantId, TaskActivityLog);
        return repo.find({
            where: { task_id: taskId },
            relations: ['user'],
            order: { created_at: 'DESC' }
        });
    }

    async updateTask(tenantId: string, userId: string, id: string, dto: UpdateTaskDto) {
        const repo = await this.getTenantRepo<Task>(tenantId, Task);
        const userRepo = await this.getTenantRepo<TenantUser>(tenantId, TenantUser);
        const originalTask = await this.findOneTask(tenantId, id);
        const user = await userRepo.findOne({ where: { id: userId } });

        // --- WORKFLOW LOGIC ---

        // 1. Status Change Check
        if (dto.status && dto.status !== originalTask.status) {
            this.validateTransition(originalTask, dto.status, userId, user);

            // Handle Reviewer Claim (if moving to In Review)
            if (dto.status === TaskStatus.IN_REVIEW) {
                // Check if it's a new submission (from something else to IN_REVIEW)
                if (originalTask.status !== TaskStatus.IN_REVIEW) {
                    let targetReviewerId = dto['reviewer_id'] || originalTask.reviewer_id;

                    // STRICT TEAM REVIEW ROUTING
                    // Fetch project with team to check for strict routing
                    const projectRepo = await this.getTenantRepo<Project>(tenantId, Project);
                    const project = await projectRepo.findOne({ where: { id: originalTask.project_id }, relations: ['team'] });

                    if (project && project.team_id && project.team?.leader_id) {
                        // Force routing to Team Leader
                        targetReviewerId = project.team.leader_id;
                        dto['reviewer_id'] = targetReviewerId; // Ensure it saves to DB
                    }

                    // Notify Reviewers
                    if (targetReviewerId) {
                        // Notify specific reviewer (if they are not the one triggering the change, e.g. self-assign)
                        if (targetReviewerId !== userId) {
                            this.notificationsService.createNotification(tenantId, targetReviewerId, {
                                type: 'task-review-ready',
                                title: 'Review Request',
                                message: `Task "${originalTask.title}" is ready for your review.`,
                                referenceId: originalTask.id,
                                priority: originalTask.priority
                            });
                        }
                    } else {
                        // Notify all potential reviewers (Managers/Admins typically)
                        try {
                            const reviewers = await userRepo.query(`
                                 SELECT u.id 
                                 FROM users u
                                 JOIN roles r ON CAST(u.role AS TEXT) = r.name OR LOWER(CAST(u.role AS TEXT)) = LOWER(r.name)
                                 WHERE r.permissions @> '["review_tasks"]'::jsonb
                                 AND u.is_active = true
                             `);
                            const reviewerIds = reviewers.map(r => r.id).filter(id => id !== userId); // Exclude self
                            if (reviewerIds.length > 0) {
                                this.notificationsService.createBulkNotifications(tenantId, reviewerIds, {
                                    type: 'task-review-ready',
                                    title: 'New Task for Review',
                                    message: `Task "${originalTask.title}" is waiting for review.`,
                                    referenceId: originalTask.id,
                                    priority: originalTask.priority
                                });
                            }
                        } catch (err) {
                            console.error("Failed to notify reviewers:", err);
                        }
                    }
                }
            }

            // Set Audit Fields
            dto['status_changed_at'] = new Date();
            dto['status_changed_by'] = userId;
            dto['previous_status'] = originalTask.status;

            // Log Activity
            await this.logActivity(tenantId, id, userId, ActivityAction.STATUS_CHANGE, {
                from: originalTask.status,
                to: dto.status,
                reason: dto['return_comment'] || undefined
            });

            // Rejection Logic (In Review -> In Progress/To Do)
            if (originalTask.status === TaskStatus.IN_REVIEW && (dto.status === TaskStatus.IN_PROGRESS || dto.status === TaskStatus.TODO)) {
                if (originalTask.assignee_id && originalTask.assignee_id !== userId) {
                    const reason = dto['return_comment'] ? ` Reason: ${dto['return_comment']}` : '';
                    this.notificationsService.createNotification(tenantId, originalTask.assignee_id, {
                        type: 'task-rejected',
                        title: 'Task Returned',
                        message: `Task "${originalTask.title}" was returned for revision.${reason}`,
                        referenceId: originalTask.id,
                    });
                }
            }

            // [NEW] Approval Logic (In Review -> Done)
            if (originalTask.status === TaskStatus.IN_REVIEW && dto.status === TaskStatus.DONE) {
                // If reviewer approves (or someone else with permission), notify Assignee
                if (originalTask.assignee_id && originalTask.assignee_id !== userId) {
                    this.notificationsService.createNotification(tenantId, originalTask.assignee_id, {
                        type: 'task-approved',
                        title: 'Task Approved',
                        message: `Task "${originalTask.title}" has been approved and marked as Done.`,
                        referenceId: originalTask.id,
                        priority: 'High' // Good news is important
                    });
                }
            }
        }

        // 2. Assignee Change
        if (dto.assignee_id && dto.assignee_id !== originalTask.assignee_id) {
            await this.logActivity(tenantId, id, userId, ActivityAction.ASSIGN, {
                from: originalTask.assignee?.full_name || 'Unassigned',
                to: (await userRepo.findOne({ where: { id: dto.assignee_id } }))?.full_name || 'Unknown',
            });
        }

        // 3. Reviewer Claim
        if (dto['reviewer_id'] && dto['reviewer_id'] !== originalTask.reviewer_id) {
            await this.logActivity(tenantId, id, userId, ActivityAction.CLAIM_REVIEW, {
                from: originalTask.reviewer?.full_name || 'None',
                to: 'Assigned Reviewer' // Simplified
            });
        }

        // 4. Blocking
        if (dto.status === TaskStatus.BLOCKED && originalTask.status !== TaskStatus.BLOCKED) {
            await this.logActivity(tenantId, id, userId, ActivityAction.BLOCK, {
                reason: dto['blocker_category']
            });
        }

        // 5. Completion Logic [FIX]
        if (dto.status === TaskStatus.DONE && originalTask.status !== TaskStatus.DONE) {
            (dto as any).completed_at = new Date();
        } else if (dto.status && dto.status !== TaskStatus.DONE && originalTask.status === TaskStatus.DONE) {
            (dto as any).completed_at = null; // Field reset - TypeORM handles null for TIMESTAMP
        }

        // Perform Update
        // Note: We need to cast dto to any because we added extra fields not in UpdateTaskDto class yet (like reviewer_id if not added)
        // Ideally UpdateTaskDto should be updated.
        await repo.update({ id, tenant_id: tenantId }, dto as any);

        const updated = await this.findOneTask(tenantId, id);

        // Notify if assignee changed
        if (dto.assignee_id && dto.assignee_id !== originalTask.assignee_id) {
            this.notificationsService.createNotification(tenantId, dto.assignee_id, {
                type: 'task-assigned',
                title: 'Task Assigned',
                message: `You have been assigned to task: ${updated.title}`,
                referenceId: updated.id
            });
        }

        // [FIX] Broadcast general update notification for live updates
        // Use reporter and current user as recipients; frontend will filter
        const broadcastRecipients = [
            updated.assignee_id,
            updated.reporter_id,
            originalTask.assignee_id,
        ].filter((id, i, arr) => id && arr.indexOf(id) === i); // Unique non-null IDs

        if (broadcastRecipients.length > 0) {
            this.notificationsService.createBulkNotifications(tenantId, broadcastRecipients, {
                type: 'task-updated',
                title: 'Task Updated',
                message: `Task "${updated.title}" was updated.`,
                referenceId: updated.id,
            });
        }

        this.notifyKPIUpdate(tenantId, [updated.assignee_id, updated.reporter_id]);
        return updated;
    }

    async removeTask(tenantId: string, id: string) {
        const repo = await this.getTenantRepo<Task>(tenantId, Task);
        const task = await this.findOneTask(tenantId, id);
        await repo.delete({ id, tenant_id: tenantId });
        this.notifyKPIUpdate(tenantId, [task.assignee_id, task.reporter_id]);
        return { success: true };
    }

    // Time Logs
    async logTime(tenantId: string, userId: string, dto: LogTimeDto) {
        const taskRepo = await this.getTenantRepo<Task>(tenantId, Task);
        const timeRepo = await this.getTenantRepo<TaskTimeLog>(tenantId, TaskTimeLog);

        const task = await this.findOneTask(tenantId, dto.task_id);
        const log = timeRepo.create({
            ...dto,
            user_id: userId,
            task_id: dto.task_id,
        });
        const savedLog = await timeRepo.save(log);

        // Update task actual hours
        task.actual_hours = Number(task.actual_hours || 0) + (dto.duration_minutes / 60);
        await taskRepo.save(task);

        return savedLog;
    }

    // Sprints
    async createSprint(tenantId: string, dto: CreateSprintDto) {
        const repo = await this.getTenantRepo<Sprint>(tenantId, Sprint);
        const sprint = repo.create({
            ...dto,
            tenant_id: tenantId,
        });
        return repo.save(sprint);
    }

    async findAllSprints(tenantId: string, projectId: string) {
        const repo = await this.getTenantRepo<Sprint>(tenantId, Sprint);
        return repo.find({
            where: { tenant_id: tenantId, project_id: projectId },
            order: { start_date: 'DESC' }
        });
    }

    // Settings
    async getSettings(tenantId: string) {
        const repo = await this.getTenantRepo<PMSSettings>(tenantId, PMSSettings);
        let settings = await repo.findOne({
            where: { tenant_id: tenantId },
        });
        if (!settings) {
            settings = repo.create({
                tenant_id: tenantId,
                // Ensure defaults are set explicitly
                kpi_include_completion_rate: true,
                kpi_include_on_time_rate: true,
                kpi_include_avg_duration: true,
                kpi_include_overdue_count: true,
            });
            await repo.save(settings);
        } else {
            // Ensure properties exist (migration fallback)
            if (settings.kpi_include_completion_rate === undefined) settings.kpi_include_completion_rate = true;
            if (settings.kpi_include_on_time_rate === undefined) settings.kpi_include_on_time_rate = true;
            if (settings.kpi_include_avg_duration === undefined) settings.kpi_include_avg_duration = true;
            if (settings.kpi_include_overdue_count === undefined) settings.kpi_include_overdue_count = true;
        }
        return settings;
    }

    async updateSettings(tenantId: string, dto: UpdatePMSSettingsDto) {
        const repo = await this.getTenantRepo<PMSSettings>(tenantId, PMSSettings);
        const settings = await this.getSettings(tenantId);
        Object.assign(settings, dto);
        return repo.save(settings);
    }

    // [UPDATED] Use Calculation Service (FastAPI) for advanced KPI calculation
    async getProjectKPIs(tenantId: string, projectId: string) {
        const calculationServiceUrl = this.configService.get<string>('CALCULATION_SERVICE_URL') || 'http://localhost:8000';
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${calculationServiceUrl}/api/pms/kpi/project/${tenantId}/${projectId}`)
            );
            return data.data;
        } catch (error) {
            console.error('Calculation Service Error (Project KPIs):', error.message);
            // Fallback to basic empty structure or re-throw
            // For now, let's return a basic structure to avoid crashing frontend
            return {
                project_id: projectId,
                progress_percentage: 0,
                blocked_task_ratio: 0,
                budget_variance_percentage: 0,
                total_tasks: 0,
                completed_tasks: 0,
                status: 'Error'
            };
        }
    }

    async getUserKPIs(tenantId: string, userId: string) {
        const calculationServiceUrl = this.configService.get<string>('CALCULATION_SERVICE_URL') || 'http://localhost:8000';
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${calculationServiceUrl}/api/pms/kpi/user/${tenantId}/${userId}`)
            );
            return data.data;
        } catch (error) {
            console.error('Calculation Service Error (User KPIs):', error.message);
            // Return basic structure on error
            return {
                user_id: userId,
                completion_rate: 0,
                on_time_delivery_rate: 0,
                average_task_duration_hours: 0,
                overdue_tasks_count: 0,
                current_workload_hours: 0,
                total_assigned_tasks: 0,
                completed_tasks: 0,
                system_score: 0,
                manual_score: 0,
                final_score: 0
            };
        }
    }

    async getTenantKPIs(tenantId: string) {
        const calculationServiceUrl = this.configService.get<string>('CALCULATION_SERVICE_URL') || 'http://localhost:8000';
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${calculationServiceUrl}/api/pms/kpi/tenant/${tenantId}`)
            );
            return data.data;
        } catch (error) {
            console.error('Calculation Service Error (Tenant KPIs):', error.message);
            // Return basic structure on error
            return {
                final_score: 0,
                completion_rate: 0,
                on_time_delivery_rate: 0,
                average_task_duration_hours: 0,
                overdue_tasks_count: 0,
                total_tasks: 0,
                completed_tasks: 0,
                system_score: 0,
                manual_score: 0
            };
        }
    }

    async getAllUsersKPIs(tenantId: string) {
        const calculationServiceUrl = this.configService.get<string>('CALCULATION_SERVICE_URL') || 'http://localhost:8000';
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${calculationServiceUrl}/api/pms/kpi/all-users/${tenantId}`)
            );
            return data.data || [];
        } catch (error) {
            console.error('Calculation Service Error (All Users KPIs):', error.message);
            return [];
        }
    }

    // ============ TEAMS ============
    async createTeam(tenantId: string, dto: CreateTeamDto) {

        const repo = await this.getTenantRepo(tenantId, Team);

        const team = repo.create({
            name: dto.name,
            description: dto.description,
            leader_id: dto.leader_id,
            tenant_id: tenantId,
        });
        const savedTeam = await repo.save(team);

        // Add initial members if provided
        if (dto.member_ids && dto.member_ids.length > 0) {
            const memberRepo = await this.getTenantRepo(tenantId, TeamMember);
            for (const userId of dto.member_ids) {
                await memberRepo.save({ team_id: savedTeam.id, user_id: userId });
            }
        }

        return savedTeam;
    }

    async findAllTeams(tenantId: string) {

        const repo = await this.getTenantRepo(tenantId, Team);
        return repo.find({ relations: ['leader', 'members', 'members.user'] });
    }

    async findOneTeam(tenantId: string, id: string) {

        const repo = await this.getTenantRepo(tenantId, Team);
        const team = await repo.findOne({ where: { id }, relations: ['leader', 'members', 'members.user'] });
        if (!team) throw new NotFoundException('Team not found');
        return team;
    }

    async updateTeam(tenantId: string, id: string, dto: UpdateTeamDto) {

        const repo = await this.getTenantRepo(tenantId, Team);
        await this.findOneTeam(tenantId, id);
        await repo.update(id, dto);
        return this.findOneTeam(tenantId, id);
    }

    async removeTeam(tenantId: string, id: string) {

        const repo = await this.getTenantRepo(tenantId, Team);
        await this.findOneTeam(tenantId, id);
        return repo.delete(id);
    }

    async addTeamMember(tenantId: string, teamId: string, dto: AddTeamMemberDto, currentUser: TenantUser) {
        // Permission Check: Global 'manage_team_members' OR Team Leader
        const hasGlobalPerm = await this.rolesService.hasPermission(tenantId, currentUser.role_id, 'manage_team_members');
        const team = await this.findOneTeam(tenantId, teamId);

        if (!hasGlobalPerm && team.leader_id !== currentUser.id) {
            // If not global admin, MUST be the team leader
            throw new ForbiddenException('You only have permission to manage members of your own team.');
        }

        const memberRepo = await this.getTenantRepo(tenantId, TeamMember);
        const existing = await memberRepo.findOne({ where: { team_id: teamId, user_id: dto.user_id } });
        if (existing) throw new NotFoundException('User is already a member');
        return memberRepo.save({ team_id: teamId, user_id: dto.user_id });
    }

    async removeTeamMember(tenantId: string, teamId: string, userId: string, currentUser: TenantUser) {
        // Permission Check: Global 'manage_team_members' OR Team Leader
        const hasGlobalPerm = await this.rolesService.hasPermission(tenantId, currentUser.role_id, 'manage_team_members');
        const team = await this.findOneTeam(tenantId, teamId);

        if (!hasGlobalPerm && team.leader_id !== currentUser.id) {
            throw new ForbiddenException('You only have permission to manage members of your own team.');
        }

        const memberRepo = await this.getTenantRepo(tenantId, TeamMember);
        return memberRepo.delete({ team_id: teamId, user_id: userId });
    }

    async getTeamMembers(tenantId: string, teamId: string) {

        const memberRepo = await this.getTenantRepo(tenantId, TeamMember);
        return memberRepo.find({ where: { team_id: teamId }, relations: ['user'] });
    }

    async getTeamDashboard(tenantId: string, teamId: string) {
        await this.findOneTeam(tenantId, teamId);
        const taskRepo = await this.getTenantRepo(tenantId, Task);
        const tasks = await taskRepo.find({ where: { team_id: teamId } });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Done').length;
        const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
        const blockedTasks = tasks.filter(t => t.status === 'Blocked').length;

        return {
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            in_progress_tasks: inProgressTasks,
            blocked_tasks: blockedTasks,
            completion_rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        };
    }

    // ============ MANUAL KPI METRICS ============
    async createMetric(tenantId: string, dto: CreateManualMetricDto) {
        const repo = await this.getTenantRepo(tenantId, ManualKPIMetric);
        const metric = repo.create({
            ...dto,
            tenant_id: tenantId,
        });
        return repo.save(metric);
    }

    async findAllMetrics(tenantId: string) {
        const repo = await this.getTenantRepo(tenantId, ManualKPIMetric);
        return repo.find({
            where: { tenant_id: tenantId, is_active: true },
            order: { created_at: 'DESC' }
        });
    }

    async updateMetric(tenantId: string, id: string, dto: UpdateManualMetricDto) {
        const repo = await this.getTenantRepo(tenantId, ManualKPIMetric);
        const metric = await repo.findOne({ where: { id, tenant_id: tenantId } });
        if (!metric) throw new NotFoundException('Metric not found');

        Object.assign(metric, dto);
        return repo.save(metric);
    }

    async deleteMetric(tenantId: string, id: string) {
        const repo = await this.getTenantRepo(tenantId, ManualKPIMetric);
        const metric = await repo.findOne({ where: { id, tenant_id: tenantId } });
        if (!metric) throw new NotFoundException('Metric not found');

        metric.is_active = false;
        return repo.save(metric);
    }
}
