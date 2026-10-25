import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsUrl, Min, Max } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rate_limit_per_minute?: number;

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rate_limit_per_minute?: number;
}

export class CreateWebhookDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false })
  target_url: string;

  @IsOptional()
  @IsString()
  secret_key?: string;

  @IsArray()
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsString()
  company_id?: string;

  @IsOptional()
  @IsString()
  branch_id?: string;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  target_url?: string;

  @IsOptional()
  @IsString()
  secret_key?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class TestWebhookDto {
  @IsUrl({ require_tld: false })
  target_url: string;

  @IsOptional()
  @IsString()
  secret_key?: string;

  @IsOptional()
  @IsString()
  event?: string;
}
