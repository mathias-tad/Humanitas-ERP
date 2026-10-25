import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, IsDateString, Min, IsBoolean } from 'class-validator';

export class LogTimeDto {
    @IsUUID()
    @IsNotEmpty()
    task_id: string;

    @IsDateString()
    @IsNotEmpty()
    started_at: string;

    @IsDateString()
    @IsOptional()
    ended_at?: string;

    @IsNumber()
    @Min(1)
    @IsNotEmpty()
    duration_minutes: number;

    @IsString()
    @IsOptional()
    description?: string;

    @IsBoolean()
    @IsOptional()
    is_billable?: boolean;

    @IsNumber()
    @IsOptional()
    hourly_rate?: number;
}
