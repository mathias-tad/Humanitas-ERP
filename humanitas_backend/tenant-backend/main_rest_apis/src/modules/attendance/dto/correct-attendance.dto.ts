import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CorrectAttendanceDto {
    @ApiPropertyOptional({ description: 'New attendance status (Present, Absent, Late, Leave, Half-Day)' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({ description: 'Corrected clock-in time (HH:mm format)' })
    @IsOptional()
    @IsString()
    clock_in?: string;

    @ApiPropertyOptional({ description: 'Corrected clock-out time (HH:mm format)' })
    @IsOptional()
    @IsString()
    clock_out?: string;

    @ApiPropertyOptional({ description: 'Reason for correction' })
    @IsOptional()
    @IsString()
    reason?: string;
}
