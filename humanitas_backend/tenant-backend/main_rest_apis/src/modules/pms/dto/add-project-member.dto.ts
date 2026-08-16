
import { IsEnum, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ProjectRole } from '../entities/project-member.entity';

export class AddProjectMemberDto {
    @IsUUID()
    @IsNotEmpty()
    user_id: string;

    @IsEnum(ProjectRole)
    @IsOptional()
    role?: ProjectRole;

    @IsOptional()
    can_create_tasks?: boolean;
}
