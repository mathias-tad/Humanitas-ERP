import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module';
import { Tenant } from '../auth/entities/tenant.entity';
import { CompanyScopeService } from './company-scope.service';
import { CompanyScopeInterceptor } from './company-scope.interceptor';
import { CompanyScopeController } from './company-scope.controller';

/** Company and branch access for every module (AGENTS.md rule 16). */
@Global()
@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Tenant])],
  controllers: [CompanyScopeController],
  providers: [CompanyScopeService, { provide: APP_INTERCEPTOR, useClass: CompanyScopeInterceptor }],
  exports: [CompanyScopeService],
})
export class CompanyScopeModule {}
