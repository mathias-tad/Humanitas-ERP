import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, Min, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePMSSettingsDto {
    @IsBoolean()
    @IsOptional()
    enable_budget_tracking?: boolean;

    @IsBoolean()
    @IsOptional()
    enable_hr_integration?: boolean;

    @IsBoolean()
    @IsOptional()
    enable_payroll_integration?: boolean;

    @IsBoolean()
    @IsOptional()
    enable_time_tracking?: boolean;

    @IsNumber()
    @Min(0)
    @IsOptional()
    default_task_time_estimate?: number;

    // KPI Configuration
    @IsBoolean()
    @IsOptional()
    kpi_include_completion_rate?: boolean;

    @IsBoolean()
    @IsOptional()
    kpi_include_on_time_rate?: boolean;

    @IsBoolean()
    @IsOptional()
    kpi_include_avg_duration?: boolean;

    @IsBoolean()
    @IsOptional()
    kpi_include_overdue_count?: boolean;

    @ApiPropertyOptional()
    @IsInt()
    @IsOptional()
    kpi_weight_system?: number;

    @ApiPropertyOptional()
    @IsInt()
    @IsOptional()
    kpi_weight_manual?: number;
}
