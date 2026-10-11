import { IsString, IsNotEmpty, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateLoanDto {
  @IsNumber()
  @Min(1)
  total_amount: number;

  @IsNumber()
  @Min(1)
  term_months: number;

  @IsNumber()
  @Min(1)
  start_month: number;

  @IsNumber()
  @Min(2000)
  start_year: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  loan_type?: string;
}
