import { Module, forwardRef } from '@nestjs/common';
import { PMSSettings } from './entities/pms-settings.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { Sprint } from './entities/sprint.entity';
import { Team } from './entities/team.entity';
import { TenantUser as User } from '../auth/entities/tenant-user.entity';
import { Task } from './entities/task.entity';
import { ProjectMember } from './entities/project-member.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskActivityLog } from './entities/task-activity-log.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { TaskTimeLog } from './entities/task-time-log.entity';
import { TaskDependency } from './entities/task-dependency.entity';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { PmsService } from './pms.service';
import { PmsController } from './pms.controller';

import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesModule } from '../roles/roles.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Tenant, // Required for PermissionsGuard
            Task,
            TaskComment,
            TaskActivityLog,
            Project,
            Sprint,
            Team,
            ProjectMember,
            TaskAttachment,
            TaskTimeLog,
            TaskDependency,
            PMSSettings,
        ]),
        HttpModule,
        ConfigModule,
        DatabaseModule, // Required for PermissionsGuard
        NotificationsModule,
        forwardRef(() => RolesModule),
    ],
    controllers: [PmsController],
    providers: [PmsService],
    exports: [],
})
export class PmsModule { }
