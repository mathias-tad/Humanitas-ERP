import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class InitialSetupDto {
  @ApiProperty({ description: 'Setup token received via email' })
  @IsString()
  setup_token: string;

  @ApiProperty({ example: 'owner@company.com' })
  @IsEmail()
  owner_email: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  owner_name: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class SetPasswordDto {
  @ApiProperty({ description: 'Password reset token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'newpassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'acme' })
  @IsString()
  tenant_slug: string;

  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email: string;
}
