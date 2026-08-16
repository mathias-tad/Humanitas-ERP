import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsUUID, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  full_name: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001', description: 'Tenant ID to register in' })
  @IsUUID()
  tenant_id: string;
}
