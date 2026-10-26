import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateSignatureDto {
  @IsOptional() @IsString() signature_url?: string;
}

export class UpdateSignatureProviderDto {
  @IsIn(['none', 'docusign', 'hellosign', 'adobe'])
  provider: 'none' | 'docusign' | 'hellosign' | 'adobe';
  @IsOptional() @IsString() client_id?: string;
  @IsOptional() @IsString() client_secret?: string;
  @IsOptional() @IsString() account_id?: string;
}
