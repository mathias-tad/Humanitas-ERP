import { IsOptional, IsBoolean } from 'class-validator';

export class ClaimOpportunityDto {
  @IsOptional()
  @IsBoolean()
  use_pto_balance?: boolean;
}
