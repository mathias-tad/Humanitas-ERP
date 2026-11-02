import { IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class ClaimOpportunityDto {
  @IsOptional()
  @IsBoolean()
  use_pto_balance?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  hours?: number;
}
