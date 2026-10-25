import { IsOptional, IsString, IsNumber, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class HrmsReportsFilterDto {
  @ApiPropertyOptional({ description: 'Filter by Company ID' })
  @IsOptional()
  @IsString()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Branch ID' })
  @IsOptional()
  @IsString()
  branch_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Department name' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Month (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: 'Year (e.g. 2026)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class BankTransferExportDto {
  @ApiProperty({ description: 'Payroll Month (1-12)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ description: 'Payroll Year (e.g. 2026)' })
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Export format: csv, nacha, or aba', enum: ['csv', 'nacha', 'aba'], default: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'nacha', 'aba'])
  format?: 'csv' | 'nacha' | 'aba' = 'csv';

  @ApiPropertyOptional({ description: 'Filter by Company ID' })
  @IsOptional()
  @IsString()
  company_id?: string;

  @ApiPropertyOptional({ description: 'Filter by Branch ID' })
  @IsOptional()
  @IsString()
  branch_id?: string;
}
