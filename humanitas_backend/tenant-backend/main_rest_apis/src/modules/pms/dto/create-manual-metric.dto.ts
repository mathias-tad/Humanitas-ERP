import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateManualMetricDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ default: 10 })
    @IsInt()
    @IsOptional()
    max_score?: number;

    @ApiPropertyOptional({ default: 1 })
    @IsInt()
    @IsOptional()
    weight?: number;

    @ApiPropertyOptional({ default: true })
    @IsBoolean()
    @IsOptional()
    is_active?: boolean;
}
