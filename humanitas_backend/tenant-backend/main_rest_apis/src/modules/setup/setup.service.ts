import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class SetupService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly databaseService: DatabaseService,
  ) { }

  async checkSetupStatus(slug: string): Promise<{
    tenant_exists: boolean;
    is_setup_complete: boolean;
    requires_setup: boolean;
    company_name: string | null;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug },
    });

    if (!tenant) {
      return {
        tenant_exists: false,
        is_setup_complete: false,
        requires_setup: false,
        company_name: null,
      };
    }

    return {
      tenant_exists: true,
      is_setup_complete: tenant.is_setup_complete,
      requires_setup: !tenant.is_setup_complete,
      company_name: tenant.company_name,
    };
  }

  async getTenantSetupInfo(setupToken: string): Promise<{
    valid: boolean;
    tenant: {
      slug: string;
      company_name: string;
      contact_email: string;
      subscription_plan: string;
    } | null;
  }> {
    const tenant = await this.tenantRepository.findOne({
      where: { setup_token: setupToken },
    });

    if (!tenant) {
      return { valid: false, tenant: null };
    }

    if (
      tenant.setup_token_expires_at &&
      new Date() > tenant.setup_token_expires_at
    ) {
      return { valid: false, tenant: null };
    }

    if (tenant.is_setup_complete) {
      return { valid: false, tenant: null };
    }

    // [SELF-HEALING] Force schema migration to ensure all columns exist
    // This fixes the "missing column" error (42703) if the DB volume is stale
    try {
      console.log(`[SetupService] Triggering schema check for ${tenant.slug}`);
      await this.databaseService.runManualMigration();
    } catch (e) {
      console.error('[SetupService] Manual migration failed (non-critical):', e.message);
    }

    return {
      valid: true,
      tenant: {
        slug: tenant.slug,
        company_name: tenant.company_name,
        contact_email: tenant.contact_email,
        subscription_plan: tenant.subscription_plan,
      },
    };
  }
}
