import { IsString, IsBoolean, IsNumber, IsOptional, Min, Max, IsEnum } from 'class-validator';

export enum AiProvider {
  GEMINI = 'gemini',
  VERTEX = 'vertex',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OLLAMA = 'ollama',
}

export class UpdateAiSettingsDto {
  @IsEnum(AiProvider)
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  api_key?: string;

  @IsString()
  @IsOptional()
  endpoint_url?: string;

  @IsString()
  @IsOptional()
  gcp_project_id?: string;

  @IsString()
  @IsOptional()
  gcp_location?: string;

  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean;

  @IsNumber()
  @IsOptional()
  max_tokens?: number;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;
}
