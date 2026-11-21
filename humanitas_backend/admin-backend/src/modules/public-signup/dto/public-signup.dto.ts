import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicSignupDto {
  @ApiProperty({ example: 'Abebe Trading PLC' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  company_name: string;

  @ApiProperty({ example: 'abebe-trading', description: 'Organization ID used to sign in' })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/, { message: 'Use only lowercase letters, numbers and hyphens.' })
  slug: string;

  @ApiProperty({ example: 'owner@abebe.et' })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(150)
  contact_email: string;

  @ApiPropertyOptional({ example: '+251911000000' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  contact_phone?: string;

  @ApiPropertyOptional({ example: 'Ethiopia' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @ApiPropertyOptional({ example: 'Africa/Addis_Ababa' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  timezone?: string;

  @ApiProperty({ example: ['hrms', 'products'], description: 'Module keys from GET public/signup/options' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one module.' })
  @ArrayMaxSize(30)
  @IsString({ each: true })
  modules: string[];

  /** Honeypot: hidden on the form, so only bots fill it in. */
  @ApiPropertyOptional({ description: 'Leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
