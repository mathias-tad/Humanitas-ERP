import {
    IsString,
    IsNotEmpty,
    IsDateString,
    IsBoolean,
    IsOptional,
    IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignScheduleDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    user_id: string;

    @ApiPropertyOptional()
    @IsUUID()
    @IsOptional()
    shift_id?: string; // Null if day off

    @ApiProperty()
    @IsDateString()
    date: string; // YYYY-MM-DD

    @ApiPropertyOptional()
    @IsBoolean()
    @IsOptional()
    is_day_off?: boolean;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    note?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    reason?: string; // Cause of the action (Audit)
}
