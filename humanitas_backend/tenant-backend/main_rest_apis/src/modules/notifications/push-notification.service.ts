import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from '../database/database.service';

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  deep_link?: string;
  category?: string;
  reference_id?: string;
  actions?: PushAction[];
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private firebaseApp: App | null = null;
  private isInitialized = false;

  constructor(private readonly databaseService: DatabaseService) {
    this.initFirebase();
  }

  private initFirebase() {
    try {
      const existingApps = getApps();
      if (existingApps.length > 0) {
        this.firebaseApp = existingApps[0];
        this.isInitialized = true;
        this.logger.log('Firebase Admin SDK already initialized');
        return;
      }

      // Check for service account file
      const serviceAccountPath = path.resolve(__dirname, 'firebase-service-account.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        this.firebaseApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id || 'humanitas-be2bf',
        });
        this.isInitialized = true;
        this.logger.log(`Firebase Admin SDK initialized successfully for project: ${serviceAccount.project_id}`);
      } else {
        this.logger.warn(`Firebase service account file not found at ${serviceAccountPath}. Push sending will be queued in dry-run mode.`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to initialize Firebase Admin SDK: ${err.message}`, err.stack);
    }
  }

  /**
   * Helper that resolves pre-configured quick action buttons based on category
   */
  resolveActionsForCategory(category?: string, referenceId?: string): PushAction[] {
    if (!category) return [];

    switch (category) {
      case 'leave_approval_requests':
        return [
          { action: 'approve_leave', title: 'Approve' },
          { action: 'reject_leave', title: 'Reject' },
        ];
      case 'expense_approval_requests':
        return [
          { action: 'approve_expense', title: 'Approve' },
          { action: 'reject_expense', title: 'Reject' },
        ];
      case 'approval_request_created':
        return [
          { action: 'approve_request', title: 'Approve' },
          { action: 'reject_request', title: 'Reject' },
        ];
      case 'payslip_ready':
        return [{ action: 'view_payslip', title: 'View Payslip' }];
      case 'shift_assigned':
        return [{ action: 'view_shift', title: 'View Schedule' }];
      case 'onboarding_task':
        return [{ action: 'view_task', title: 'View Checklist' }];
      default:
        return [];
    }
  }

  /**
   * Sends push notification to an individual user's registered devices
   */
  async sendPushToUser(
    tenantId: string,
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number; totalTokens: number }> {
    try {
      const connection = await this.databaseService.getTenantConnectionById(tenantId);
      const rows = await connection.query(
        `SELECT token, platform FROM push_device_tokens WHERE user_id = $1 AND is_active = TRUE`,
        [userId],
      );

      if (!rows || rows.length === 0) {
        return { sent: 0, failed: 0, totalTokens: 0 };
      }

      const tokens: string[] = rows.map((r: any) => r.token);
      return this.sendPushToTokens(tenantId, tokens, payload);
    } catch (err: any) {
      this.logger.error(`Error querying tokens for user ${userId}: ${err.message}`);
      return { sent: 0, failed: 0, totalTokens: 0 };
    }
  }

  /**
   * Sends push notification to a list of device tokens using Firebase Admin Multicast
   */
  async sendPushToTokens(
    tenantId: string,
    tokens: string[],
    payload: PushNotificationPayload,
  ): Promise<{ sent: number; failed: number; totalTokens: number }> {
    if (!tokens || tokens.length === 0) {
      return { sent: 0, failed: 0, totalTokens: 0 };
    }

    const actions = payload.actions || this.resolveActionsForCategory(payload.category, payload.reference_id);

    // Build data payload (all values must be strings in FCM data)
    const stringData: Record<string, string> = {
      ...(payload.data || {}),
      title: payload.title,
      body: payload.body,
      deep_link: payload.deep_link || '',
      category: payload.category || 'general',
      reference_id: payload.reference_id || '',
      actions: JSON.stringify(actions),
    };

    if (!this.isInitialized || !this.firebaseApp) {
      this.logger.warn(`Firebase not initialized. Dry-run push logged for ${tokens.length} token(s).`);
      return { sent: tokens.length, failed: 0, totalTokens: tokens.length };
    }

    try {
      const message: MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: stringData,
        android: {
          priority: 'high',
          notification: {
            channelId: 'high_importance_channel',
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: 'default',
              badge: 1,
              category: payload.category ? payload.category.toUpperCase() : 'GENERAL',
            },
          },
        },
      };

      const response = await getMessaging(this.firebaseApp).sendEachForMulticast(message);
      let sent = response.successCount;
      let failed = response.failureCount;

      // Clean up stale or invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errCode = resp.error?.code;
            if (
              errCode === 'messaging/invalid-registration-token' ||
              errCode === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          try {
            const connection = await this.databaseService.getTenantConnectionById(tenantId);
            await connection.query(
              `UPDATE push_device_tokens SET is_active = FALSE, updated_at = NOW() WHERE token = ANY($1)`,
              [invalidTokens],
            );
            this.logger.log(`Deactivated ${invalidTokens.length} stale FCM device token(s)`);
          } catch (e: any) {
            this.logger.warn(`Failed to deactivate stale tokens: ${e.message}`);
          }
        }
      }

      this.logger.log(`FCM Multicast sent: ${sent} succeeded, ${failed} failed out of ${tokens.length} devices.`);
      return { sent, failed, totalTokens: tokens.length };
    } catch (err: any) {
      this.logger.error(`Failed to send FCM multicast: ${err.message}`, err.stack);
      return { sent: 0, failed: tokens.length, totalTokens: tokens.length };
    }
  }
}
