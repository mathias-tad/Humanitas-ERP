import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength } from 'class-validator';

export class TenantLoginDto {
  @ApiProperty({ example: 'acme', description: 'Tenant slug/identifier' })
  @IsString()
  tenant_slug: string;

  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
