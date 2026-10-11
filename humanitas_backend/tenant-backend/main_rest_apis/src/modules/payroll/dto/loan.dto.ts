import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateLoanDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  total_amount?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  term_months?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  start_month?: number;

  @IsNumber()
  @Min(2000)
  @IsOptional()
  start_year?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  loan_type?: string;
}

export class ApproveLoanDto {
  @IsString()
  @IsOptional()
  comment?: string;
}

export class RejectLoanDto {
  @IsString()
  @IsOptional()
  comment?: string;
}

export class SetLoanWorkflowDto {
  steps: {
    role_required: string;
    is_final?: boolean;
    step_order?: number;
  }[];
}
