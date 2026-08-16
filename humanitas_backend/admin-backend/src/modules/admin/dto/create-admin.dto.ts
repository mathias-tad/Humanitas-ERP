import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { AdminRole } from '../../user/entities/admin-user.entity';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securepassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  full_name: string;

  @ApiPropertyOptional({ example: '+1-555-0100' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: AdminRole, default: AdminRole.ADMIN })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}
