import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { SprintStatus } from '../entities/sprint.entity';

export class CreateSprintDto {
    @IsUUID()
    @IsNotEmpty()
    project_id: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    goal?: string;

    @IsDateString()
    @IsNotEmpty()
    start_date: string;

    @IsDateString()
    @IsNotEmpty()
    end_date: string;

    @IsEnum(SprintStatus)
    @IsOptional()
    status?: SprintStatus;
}

export class UpdateSprintDto extends CreateSprintDto { }
