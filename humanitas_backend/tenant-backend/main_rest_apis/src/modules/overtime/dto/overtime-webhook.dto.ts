import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class OvertimeWebhookDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  payload?: any;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  logId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  error?: string;
}
