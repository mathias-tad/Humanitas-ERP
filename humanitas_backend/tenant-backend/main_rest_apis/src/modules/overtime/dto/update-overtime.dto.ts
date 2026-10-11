import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateOvertimeDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  normal?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  night?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  holiday?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  dayoff?: number;
}
