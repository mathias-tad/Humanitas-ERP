import { IsNotEmpty, IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewClaimDto {
  @IsNotEmpty()
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  review_notes?: string;
}
