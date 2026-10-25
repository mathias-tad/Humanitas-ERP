import { IsString, IsOptional, IsEnum, IsBoolean, IsDateString, IsArray, IsNumber, Min } from 'class-validator';

export enum ExpenseReportStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REIMBURSED = 'reimbursed',
}

export enum ExpenseItemStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export class CreateExpenseCategoryDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  spending_limit?: number;

  @IsOptional()
  @IsNumber()
  daily_per_diem_cap?: number;

  @IsOptional()
  @IsBoolean()
  requires_receipt?: boolean;
}

export class CreateExpenseItemDto {
  @IsString()
  category_id: string;

  @IsDateString()
  expense_date: string;

  @IsOptional()
  @IsString()
  merchant_name?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  receipt_url?: string;
}

export class CreateExpenseReportDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  items?: CreateExpenseItemDto[];
}

export class UpdateExpenseReportDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsEnum(ExpenseReportStatus)
  status?: ExpenseReportStatus;
}

export class LineItemDecisionDto {
  @IsString()
  item_id: string;

  @IsEnum(ExpenseItemStatus)
  status: ExpenseItemStatus;
}

export class ApproveExpenseReportDto {
  @IsOptional()
  @IsNumber()
  approved_amount?: number;

  @IsOptional()
  @IsBoolean()
  include_in_payroll?: boolean;

  @IsOptional()
  @IsArray()
  line_item_decisions?: LineItemDecisionDto[];
}

export class RejectExpenseReportDto {
  @IsString()
  rejection_reason: string;
}
