import { IsString, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TargetType {
    ALL = 'all',
    ROLE = 'role',
    CATEGORY = 'category',
    INDIVIDUAL = 'individual',
}

export class CreateEventDto {
    @ApiProperty()
    @IsString()
    title: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    content?: string;

    @ApiProperty()
    @IsDateString()
    event_date: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    event_time?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    location?: string;

    @ApiProperty({ enum: TargetType })
    @IsEnum(TargetType)
    target_type: TargetType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    target_ids?: string[];
}

export class UpdateEventDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    event_date?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    event_time?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    location?: string;

    @ApiPropertyOptional({ enum: TargetType })
    @IsOptional()
    @IsEnum(TargetType)
    target_type?: TargetType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    target_ids?: string[];
}
