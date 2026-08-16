import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString, IsDecimal } from 'class-validator';
import { ProjectStatus, ProjectPriority } from '../entities/project.entity';

export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(ProjectStatus)
    @IsOptional()
    status?: ProjectStatus;

    @IsEnum(ProjectPriority)
    @IsOptional()
    priority?: ProjectPriority;

    @IsDateString()
    @IsOptional()
    start_date?: string;

    @IsDateString()
    @IsOptional()
    target_end_date?: string;

    @IsDecimal()
    @IsOptional()
    budget?: number;

    @IsString()
    @IsOptional()
    currency?: string;

    @IsUUID()
    @IsOptional()
    manager_id?: string;

    @IsUUID()
    @IsOptional()
    team_id?: string;
}

export class UpdateProjectDto extends CreateProjectDto {
    @IsDateString()
    @IsOptional()
    actual_end_date?: string;

    @IsDecimal()
    @IsOptional()
    actual_cost?: number;
}
