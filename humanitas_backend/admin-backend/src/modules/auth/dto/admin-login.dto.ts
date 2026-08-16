import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@saas.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'adminpassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
