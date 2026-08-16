import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHolidayDto {
    @ApiProperty({ example: 'New Year' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: '2025-01-01' })
    @IsDateString()
    @IsNotEmpty()
    date: string;

    @ApiProperty({ example: 'Happy New Year!', required: false })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: true, default: true })
    @IsBoolean()
    @IsOptional()
    is_recurring?: boolean;

    @ApiProperty({ example: 'public', default: 'public' })
    @IsString()
    @IsOptional()
    type?: string;
}

export class UpdateHolidayDto extends CreateHolidayDto { }
