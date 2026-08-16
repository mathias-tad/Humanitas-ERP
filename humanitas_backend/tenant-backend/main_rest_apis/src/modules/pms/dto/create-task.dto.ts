import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDecimal, IsUUID, IsDateString } from 'class-validator';
import { TaskStatus, TaskPriority } from '../entities/task.entity';

export class CreateTaskDto {
    @IsUUID()
    @IsNotEmpty()
    project_id: string;

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsEnum(TaskStatus)
    @IsOptional()
    status?: TaskStatus;

    @IsEnum(TaskPriority)
    @IsOptional()
    priority?: TaskPriority;

    @IsUUID()
    @IsOptional()
    sprint_id?: string;

    @IsUUID()
    @IsOptional()
    parent_task_id?: string;

    @IsUUID()
    @IsOptional()
    assignee_id?: string;

    @IsDecimal()
    @IsOptional()
    estimated_hours?: number;

    @IsDateString()
    @IsOptional()
    due_date?: string;

    @IsDateString()
    @IsOptional()
    start_date?: string;

    @IsDecimal()
    @IsOptional()
    estimated_cost?: number;
}

import { PartialType } from '@nestjs/mapped-types';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
    @IsDecimal()
    @IsOptional()
    actual_hours?: number;

    @IsDecimal()
    @IsOptional()
    actual_cost?: number;

    @IsDateString()
    @IsOptional()
    completed_at?: string;

    @IsUUID()
    @IsOptional()
    reviewer_id?: string;

    @IsString()
    @IsOptional()
    return_comment?: string;
}
