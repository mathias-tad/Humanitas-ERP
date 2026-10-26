import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrmsDocumentsService } from './hrms-documents.service';
import { Tenant } from '../auth/entities/tenant.entity';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DocumentExpiryCron {
  private readonly logger = new Logger(DocumentExpiryCron.name);

  constructor(
    private readonly hrmsDocumentsService: HrmsDocumentsService,
    private readonly databaseService: DatabaseService,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkExpiringDocuments() {
    this.logger.log('Running daily document expiry check...');

    let tenants: Tenant[] = [];
    try {
      tenants = await this.tenantRepository.find({ where: { is_active: true } });
    } catch (err: any) {
      this.logger.error(`Failed to fetch tenants for expiry check: ${err.message}`);
      return;
    }

    for (const tenant of tenants) {
      await this.processExpiryReminders(tenant.id).catch((err: any) =>
        this.logger.error(
          `Expiry check failed for tenant ${tenant.slug}: ${err.message}`,
        ),
      );
    }
  }

  private async processExpiryReminders(tenantId: string): Promise<void> {
    try {
      const expiringDocs = await this.hrmsDocumentsService.getExpiringDocuments(tenantId, [7, 30, 60, 90]);
      if (expiringDocs && expiringDocs.length > 0) {
        this.logger.warn(
          `Tenant ${tenantId}: found ${expiringDocs.length} documents expiring on milestone intervals (7, 30, 60, 90 days)`,
        );

        try {
          const conn = await this.databaseService.getTenantConnectionById(tenantId);
          for (const doc of expiringDocs) {
            await conn.query(
              `INSERT INTO notifications (user_id, title, message, type, is_read, created_at)
               VALUES ($1, $2, $3, 'document_expiry', false, NOW())`,
              [
                doc.user_id,
                `Document Expiry Notice: ${doc.title}`,
                `Your document "${doc.title}" expires on ${new Date(doc.expiry_date).toLocaleDateString()}. Please provide an updated copy.`,
              ],
            ).catch(() => {});
          }
        } catch (dbErr: any) {
          this.logger.debug(`In-app notification logging skipped: ${dbErr.message}`);
        }
      }

      const summary =
        await this.hrmsDocumentsService.getExpiringDocumentsSummary(tenantId);

      const { expiredCount, expiring30Days } = summary;

      if (expiredCount > 0 || expiring30Days > 0) {
        this.logger.warn(
          `Tenant ${tenantId}: ${expiredCount} expired, ${expiring30Days} expiring within 30 days`,
        );
      } else {
        this.logger.debug(`Tenant ${tenantId}: no expiring documents`);
      }
    } catch (err: any) {
      this.logger.error(
        `processExpiryReminders failed for tenant ${tenantId}: ${err.message}`,
      );
    }
  }
}
