import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsBoolean, Min, Max, IsOptional, IsString, IsEnum, IsUUID, IsNumber } from 'class-validator';

export class AssignPerDiemDto {
    @ApiProperty({ description: 'User ID to assign per diem to' })
    @IsUUID()
    user_id: string;

    @ApiProperty({ example: 1, description: 'Month (1-12)' })
    @IsInt()
    @Min(1)
    @Max(12)
    month: number;

    @ApiProperty({ example: 2024 })
    @IsInt()
    year: number;
}

export class SubmitPerDiemChoiceDto {
    @ApiProperty({ enum: ['WITH_RECEIPT', 'WITHOUT_RECEIPT'] })
    @IsEnum(['WITH_RECEIPT', 'WITHOUT_RECEIPT'])
    choice: 'WITH_RECEIPT' | 'WITHOUT_RECEIPT';
}

export class ReviewPerDiemClaimDto {
    @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
    @IsEnum(['APPROVED', 'REJECTED'])
    status: 'APPROVED' | 'REJECTED';

    @ApiPropertyOptional({ description: 'Modified receipt amount if approved' })
    @IsOptional()
    @IsNumber()
    approved_amount?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    rejection_reason?: string;
}

export class UpdatePerDiemClaimDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    has_receipt?: boolean;
}
