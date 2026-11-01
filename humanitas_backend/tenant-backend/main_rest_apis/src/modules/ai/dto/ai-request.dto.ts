import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AiRequestDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  currentRoute?: string;

  @IsString()
  @IsOptional()
  currentModule?: string;

  @IsString()
  @IsOptional()
  platform?: string; // 'web' | 'mobile' | 'both'
}
