import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsUUID } from 'class-validator';

export class SelectTenantDto {
  @ApiProperty({ example: 'user@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  tenant_id: string;
}
