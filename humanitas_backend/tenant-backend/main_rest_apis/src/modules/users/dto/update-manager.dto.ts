import { IsOptional, IsUUID } from 'class-validator';

export class UpdateManagerDto {
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}
