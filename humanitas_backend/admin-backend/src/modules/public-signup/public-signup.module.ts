import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettings } from '../settings/entities/settings.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { TenantModule } from '../tenant/tenant.module';
import { PublicSignupController } from './public-signup.controller';
import { PublicSignupService } from './public-signup.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettings, Tenant]), TenantModule],
  controllers: [PublicSignupController],
  providers: [PublicSignupService],
})
export class PublicSignupModule {}
