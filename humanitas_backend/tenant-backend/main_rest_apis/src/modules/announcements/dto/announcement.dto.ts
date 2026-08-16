import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TargetType {
    ALL = 'all',
    ROLE = 'role',
    CATEGORY = 'category',
    INDIVIDUAL = 'individual',
}

export enum Priority {
    NORMAL = 'normal',
    IMPORTANT = 'important',
    URGENT = 'urgent',
}

export class CreateAnnouncementDto {
    @ApiProperty()
    @IsString()
    title: string;

    @ApiProperty()
    @IsString()
    content: string;

    @ApiPropertyOptional({ enum: Priority })
    @IsOptional()
    @IsEnum(Priority)
    priority?: Priority;

    @ApiProperty({ enum: TargetType })
    @IsEnum(TargetType)
    target_type: TargetType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    target_ids?: string[];
}

export class UpdateAnnouncementDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    content?: string;

    @ApiPropertyOptional({ enum: Priority })
    @IsOptional()
    @IsEnum(Priority)
    priority?: Priority;

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
