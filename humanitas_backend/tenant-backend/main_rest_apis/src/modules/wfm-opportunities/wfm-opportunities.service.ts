import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { ClaimOpportunityDto } from './dto/claim-opportunity.dto';
import { ReviewClaimDto } from './dto/review-claim.dto';
import { UpdateWfmSettingsDto } from './dto/update-wfm-settings.dto';

@Injectable()
export class WfmOpportunitiesService {
  private readonly logger = new Logger(WfmOpportunitiesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Helper to ensure wfm_settings and related tables exist (lazy fallback)
   */
  private async ensureTables(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS wfm_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        branch_id UUID,
        vet_enabled BOOLEAN NOT NULL DEFAULT true,
        vto_enabled BOOLEAN NOT NULL DEFAULT true,
        vet_claim_strategy VARCHAR(30) NOT NULL DEFAULT 'fcfs',
        vto_claim_strategy VARCHAR(30) NOT NULL DEFAULT 'fcfs',
        vet_auto_approval BOOLEAN NOT NULL DEFAULT true,
        vto_auto_approval BOOLEAN NOT NULL DEFAULT true,
        max_weekly_ot_hours NUMERIC(5,2) NOT NULL DEFAULT 20.00,
        min_rest_hours_between_shifts NUMERIC(4,2) NOT NULL DEFAULT 11.00,
        vto_allow_pto_funding BOOLEAN NOT NULL DEFAULT false,
        vet_cancellation_cutoff_hours INT NOT NULL DEFAULT 4,
        vto_cancellation_cutoff_hours INT NOT NULL DEFAULT 2,
        notify_via_push BOOLEAN NOT NULL DEFAULT true,
        notify_via_email BOOLEAN NOT NULL DEFAULT true,
        notify_via_in_app BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wfm_opportunities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID,
        branch_id UUID,
        department_id UUID,
        type VARCHAR(10) NOT NULL,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        shift_id UUID,
        start_time TIME,
        end_time TIME,
        hours NUMERIC(5,2) NOT NULL,
        slots_available INT NOT NULL DEFAULT 1,
        slots_claimed INT NOT NULL DEFAULT 0,
        ot_rate_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.50,
        ot_category VARCHAR(30) NOT NULL DEFAULT 'normal',
        urgency VARCHAR(20) NOT NULL DEFAULT 'normal',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        reason TEXT,
        notes TEXT,
        expires_at TIMESTAMP,
        created_by UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wfm_opportunity_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        opportunity_id UUID NOT NULL,
        user_id UUID NOT NULL,
        claim_type VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        use_pto_balance BOOLEAN NOT NULL DEFAULT false,
        reviewed_by UUID,
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        schedule_id UUID,
        overtime_entry_id UUID,
        company_id UUID,
        branch_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(opportunity_id, user_id)
      );
    `);
  }

  /**
   * Helper: Broadcast notifications to all users in the target department/scope
   * Both desktop (WebSocket) and mobile (Push) via NotificationsService
   */
  private async notifyEligibleDepartmentUsers(
    connection: any,
    tenantId: string,
    opportunity: any,
    isReopen = false,
  ) {
    try {
      let userQuery = `SELECT id, full_name, email FROM users WHERE is_active = true`;
      const userParams: any[] = [];
      let pIdx = 1;

      if (opportunity.department_id) {
        userQuery += ` AND (department_id = $${pIdx} OR department = (SELECT name FROM departments WHERE id = $${pIdx} LIMIT 1))`;
        userParams.push(opportunity.department_id);
        pIdx++;
      }
      if (opportunity.company_id) {
        userQuery += ` AND (company_id = $${pIdx} OR company_id IS NULL)`;
        userParams.push(opportunity.company_id);
        pIdx++;
      }
      if (opportunity.branch_id) {
        userQuery += ` AND (branch_id = $${pIdx} OR branch_id IS NULL)`;
        userParams.push(opportunity.branch_id);
        pIdx++;
      }

      const users = await connection.query(userQuery, userParams);
      const userIds = users
        .map((u: any) => u.id)
        .filter((id: string) => id !== opportunity.created_by);

      if (userIds.length === 0) return;

      const oppDateStr = typeof opportunity.date === 'string'
        ? opportunity.date
        : new Date(opportunity.date).toISOString().split('T')[0];

      const slotsLeft = Math.max(1, opportunity.slots_available - opportunity.slots_claimed);

      if (opportunity.type === 'VET') {
        const notifType = isReopen ? 'wfm_slot_reopened' : 'vet_opportunity_broadcast';
        const title = isReopen ? '⚡ VET Shift Re-Opened!' : '📢 Extra Overtime Shift Available (VET)';
        const message = isReopen
          ? `A slot for ${opportunity.title} on ${oppDateStr} (${opportunity.hours}h at ${opportunity.ot_rate_multiplier}x OT) has reopened! Tap to claim.`
          : `${opportunity.title} on ${oppDateStr} (${opportunity.hours}h at ${opportunity.ot_rate_multiplier}x OT). ${slotsLeft} slot(s) open to claim!`;

        await this.notificationsService.createBulkNotifications(tenantId, userIds, {
          type: notifType,
          title,
          message,
          priority: 'high',
          deep_link: '/scheduling/opportunities',
          referenceId: opportunity.id,
        });
      } else {
        const notifType = isReopen ? 'wfm_slot_reopened' : 'vto_opportunity_broadcast';
        const title = isReopen ? '🏖️ VTO Slot Re-Opened!' : '🏖️ Voluntary Time Off Available (VTO)';
        const message = isReopen
          ? `A slot for ${opportunity.title} on ${oppDateStr} (${opportunity.hours}h excused absence) has reopened! Tap to claim.`
          : `${opportunity.title} on ${oppDateStr} (${opportunity.hours}h excused absence). ${slotsLeft} slot(s) open to claim!`;

        await this.notificationsService.createBulkNotifications(tenantId, userIds, {
          type: notifType,
          title,
          message,
          priority: 'high',
          deep_link: '/scheduling/opportunities',
          referenceId: opportunity.id,
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to dispatch opportunity notifications: ${err.message}`);
    }
  }

  /**
   * 1. Get WFM Settings for Tenant/Company/Branch
   */
  async getSettings(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    let query = `SELECT * FROM wfm_settings WHERE 1=1`;
    const params: any[] = [];
    let pIdx = 1;

    if (companyId) {
      query += ` AND (company_id = $${pIdx} OR company_id IS NULL)`;
      params.push(companyId);
      pIdx++;
    }
    if (branchId) {
      query += ` AND (branch_id = $${pIdx} OR branch_id IS NULL)`;
      params.push(branchId);
      pIdx++;
    }

    query += ` ORDER BY company_id NULLS LAST, branch_id NULLS LAST LIMIT 1`;
    const rows = await connection.query(query, params);

    if (rows && rows.length > 0) {
      return rows[0];
    }

    // Default configuration if no row exists yet
    const insertRes = await connection.query(`
      INSERT INTO wfm_settings (
        company_id, branch_id, vet_enabled, vto_enabled,
        vet_claim_strategy, vto_claim_strategy,
        vet_auto_approval, vto_auto_approval,
        max_weekly_ot_hours, min_rest_hours_between_shifts,
        vto_allow_pto_funding, vet_cancellation_cutoff_hours, vto_cancellation_cutoff_hours
      ) VALUES (
        $1, $2, true, true,
        'fcfs', 'fcfs',
        true, true,
        20.00, 11.00,
        false, 4, 2
      ) RETURNING *
    `, [companyId || null, branchId || null]);

    return insertRes[0];
  }

  /**
   * 2. Update WFM Settings
   */
  async updateSettings(tenantId: string, dto: UpdateWfmSettingsDto, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const current = await this.getSettings(tenantId, dto.company_id, dto.branch_id);

    const updated = await connection.query(`
      UPDATE wfm_settings
      SET
        vet_enabled = COALESCE($1, vet_enabled),
        vto_enabled = COALESCE($2, vto_enabled),
        vet_claim_strategy = COALESCE($3, vet_claim_strategy),
        vto_claim_strategy = COALESCE($4, vto_claim_strategy),
        vet_auto_approval = COALESCE($5, vet_auto_approval),
        vto_auto_approval = COALESCE($6, vto_auto_approval),
        max_weekly_ot_hours = COALESCE($7, max_weekly_ot_hours),
        min_rest_hours_between_shifts = COALESCE($8, min_rest_hours_between_shifts),
        vto_allow_pto_funding = COALESCE($9, vto_allow_pto_funding),
        vet_cancellation_cutoff_hours = COALESCE($10, vet_cancellation_cutoff_hours),
        vto_cancellation_cutoff_hours = COALESCE($11, vto_cancellation_cutoff_hours),
        notify_via_push = COALESCE($12, notify_via_push),
        notify_via_email = COALESCE($13, notify_via_email),
        notify_via_in_app = COALESCE($14, notify_via_in_app),
        updated_at = NOW()
      WHERE id = $15
      RETURNING *
    `, [
      dto.vet_enabled,
      dto.vto_enabled,
      dto.vet_claim_strategy,
      dto.vto_claim_strategy,
      dto.vet_auto_approval,
      dto.vto_auto_approval,
      dto.max_weekly_ot_hours,
      dto.min_rest_hours_between_shifts,
      dto.vto_allow_pto_funding,
      dto.vet_cancellation_cutoff_hours,
      dto.vto_cancellation_cutoff_hours,
      dto.notify_via_push,
      dto.notify_via_email,
      dto.notify_via_in_app,
      current.id,
    ]);

    return {
      message: 'WFM settings updated successfully',
      settings: updated[0],
    };
  }

  /**
   * 3. Broadcast VET or VTO Opportunity
   * Emits desktop WebSocket and sends FCM mobile push notifications to all users in the target department
   */
  async broadcastOpportunity(tenantId: string, dto: CreateOpportunityDto, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const settings = await this.getSettings(tenantId, dto.company_id, dto.branch_id);

    if (dto.type === 'VET' && !settings.vet_enabled) {
      throw new BadRequestException('Voluntary Extra Time (VET) broadcasts are currently disabled by tenant policy.');
    }
    if (dto.type === 'VTO' && !settings.vto_enabled) {
      throw new BadRequestException('Voluntary Time Off (VTO) broadcasts are currently disabled by tenant policy.');
    }

    // Default OT Multiplier & Category if not specified
    let multiplier = dto.ot_rate_multiplier;
    let otCategory = dto.ot_category || 'normal';

    if (!multiplier) {
      if (otCategory === 'holiday') multiplier = 2.5;
      else if (otCategory === 'dayoff') multiplier = 2.0;
      else if (otCategory === 'night') multiplier = 1.5;
      else multiplier = 1.25;
    }

    // Fetch shift times if shift_id provided
    let startTime = dto.start_time;
    let endTime = dto.end_time;
    if (dto.shift_id && (!startTime || !endTime)) {
      const shiftRows = await connection.query('SELECT start_time, end_time FROM shifts WHERE id = $1', [dto.shift_id]);
      if (shiftRows.length > 0) {
        startTime = startTime || shiftRows[0].start_time;
        endTime = endTime || shiftRows[0].end_time;
      }
    }

    const result = await connection.query(`
      INSERT INTO wfm_opportunities (
        company_id, branch_id, department_id, type, title,
        date, shift_id, start_time, end_time, hours,
        slots_available, slots_claimed, ot_rate_multiplier, ot_category,
        urgency, status, reason, notes, expires_at, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, 0, $12, $13,
        $14, 'open', $15, $16, $17, $18
      ) RETURNING *
    `, [
      dto.company_id || null,
      dto.branch_id || null,
      dto.department_id || null,
      dto.type,
      dto.title,
      dto.date,
      dto.shift_id || null,
      startTime || null,
      endTime || null,
      dto.hours,
      dto.slots_available,
      multiplier,
      otCategory,
      dto.urgency || 'normal',
      dto.reason || null,
      dto.notes || null,
      dto.expires_at || null,
      userId,
    ]);

    const createdOpp = result[0];

    // Real-time broadcast notification dispatch (Desktop In-App & Mobile Push)
    await this.notifyEligibleDepartmentUsers(connection, tenantId, createdOpp, false);

    try {
      if (this.notificationsGateway) {
        this.notificationsGateway.server?.emit('wfm:opportunity_broadcast', {
          tenantId,
          opportunity: createdOpp,
        });
      }
    } catch (e) {
      this.logger.warn(`Failed to emit websocket broadcast: ${e.message}`);
    }

    return createdOpp;
  }

  /**
   * 4. Get Available Opportunities (Self-Service + Filtering)
   */
  async getOpportunities(
    tenantId: string,
    filters: {
      type?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      departmentId?: string;
      companyId?: string;
      branchId?: string;
      userId?: string;
    },
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    let query = `
      SELECT
        o.*,
        s.name AS shift_name,
        s.color AS shift_color,
        (o.slots_available - o.slots_claimed) AS slots_remaining
      FROM wfm_opportunities o
      LEFT JOIN shifts s ON o.shift_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (filters.type && filters.type !== 'all') {
      query += ` AND o.type = $${pIdx}`;
      params.push(filters.type.toUpperCase());
      pIdx++;
    }

    if (filters.status && filters.status !== 'all') {
      query += ` AND o.status = $${pIdx}`;
      params.push(filters.status);
      pIdx++;
    } else {
      query += ` AND o.status IN ('open', 'filled')`;
    }

    if (filters.startDate) {
      query += ` AND o.date >= $${pIdx}`;
      params.push(filters.startDate);
      pIdx++;
    }
    if (filters.endDate) {
      query += ` AND o.date <= $${pIdx}`;
      params.push(filters.endDate);
      pIdx++;
    }

    if (filters.companyId) {
      query += ` AND (o.company_id = $${pIdx} OR o.company_id IS NULL)`;
      params.push(filters.companyId);
      pIdx++;
    }
    if (filters.branchId) {
      query += ` AND (o.branch_id = $${pIdx} OR o.branch_id IS NULL)`;
      params.push(filters.branchId);
      pIdx++;
    }
    if (filters.departmentId) {
      query += ` AND (o.department_id = $${pIdx} OR o.department_id IS NULL)`;
      params.push(filters.departmentId);
      pIdx++;
    }

    query += ` ORDER BY o.date ASC, o.urgency DESC, o.created_at DESC`;

    const opportunities = await connection.query(query, params);

    // If userId provided, enrich with user's claim status
    if (filters.userId && opportunities.length > 0) {
      const oppIds = opportunities.map((o: any) => o.id);
      const claims = await connection.query(
        `SELECT opportunity_id, id AS claim_id, status AS claim_status, use_pto_balance
         FROM wfm_opportunity_claims
         WHERE user_id = $1 AND opportunity_id = ANY($2::uuid[])`,
        [filters.userId, oppIds],
      );

      const claimsMap = new Map<string, any>();
      for (const c of claims) {
        claimsMap.set(c.opportunity_id, c);
      }

      return opportunities.map((o: any) => {
        const claim = claimsMap.get(o.id);
        return {
          ...o,
          has_claimed: Boolean(claim),
          my_claim_id: claim?.claim_id || null,
          my_claim_status: claim?.claim_status || null,
          my_use_pto: claim?.use_pto_balance || false,
        };
      });
    }

    return opportunities;
  }

  /**
   * 5. Get User's Personal Claims History
   */
  async getMyClaims(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const query = `
      SELECT
        c.*,
        o.title AS opportunity_title,
        o.type AS opportunity_type,
        o.date AS opportunity_date,
        o.start_time,
        o.end_time,
        o.hours,
        o.ot_rate_multiplier,
        o.ot_category,
        s.name AS shift_name
      FROM wfm_opportunity_claims c
      JOIN wfm_opportunities o ON c.opportunity_id = o.id
      LEFT JOIN shifts s ON o.shift_id = s.id
      WHERE c.user_id = $1
      ORDER BY o.date DESC, c.claimed_at DESC
    `;

    return connection.query(query, [userId]);
  }

  /**
   * 6. Claim an Opportunity (VET or VTO)
   * Enforces fatigue limits (max_weekly_ot_hours), rest hour minimums,
   * scheduled work checks for VTO, PTO funding validations, and handles auto-approval.
   */
  async claimOpportunity(
    tenantId: string,
    opportunityId: string,
    userId: string,
    dto: ClaimOpportunityDto,
    userCompanyId?: string,
    userBranchId?: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    // 1. Fetch opportunity
    const oppRows = await connection.query(
      'SELECT * FROM wfm_opportunities WHERE id = $1 FOR UPDATE',
      [opportunityId],
    );
    if (!oppRows || oppRows.length === 0) {
      throw new NotFoundException('Opportunity not found');
    }
    const opportunity = oppRows[0];

    if (opportunity.status !== 'open') {
      throw new BadRequestException(`This opportunity is no longer open for claims (Status: ${opportunity.status})`);
    }
    if (opportunity.slots_claimed >= opportunity.slots_available) {
      throw new BadRequestException('All available slots for this opportunity have already been filled');
    }
    if (opportunity.expires_at && new Date(opportunity.expires_at) < new Date()) {
      throw new BadRequestException('This opportunity has expired');
    }

    // 2. Check duplicate claim
    const existingClaim = await connection.query(
      'SELECT id, status FROM wfm_opportunity_claims WHERE opportunity_id = $1 AND user_id = $2',
      [opportunityId, userId],
    );
    if (existingClaim.length > 0 && existingClaim[0].status !== 'cancelled') {
      throw new BadRequestException('You have already submitted a claim for this opportunity');
    }

    // 3. Load tenant WFM settings
    const settings = await this.getSettings(tenantId, opportunity.company_id || userCompanyId, opportunity.branch_id || userBranchId);

    // 4. VET Fatigue & Rest Period Validations
    if (opportunity.type === 'VET') {
      if (!settings.vet_enabled) {
        throw new BadRequestException('Voluntary Extra Time claims are disabled by tenant policy');
      }

      // Check weekly fatigue limit: calculate current week's OT hours
      const oppDate = new Date(opportunity.date);
      const dayOfWeek = oppDate.getDay(); // 0 is Sunday
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(oppDate);
      monday.setDate(oppDate.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];

      const otWeekQuery = await connection.query(
        `SELECT
          COALESCE(SUM(normal_ot_hours + night_ot_hours + holiday_ot_hours + dayoff_ot_hours), 0) AS total_weekly_ot
         FROM overtime_entries
         WHERE user_id = $1 AND date >= $2 AND date <= $3 AND status != 'Rejected'`,
        [userId, mondayStr, sundayStr],
      );
      const currentWeeklyOt = Number(otWeekQuery[0]?.total_weekly_ot || 0);
      const shiftHours = Number(opportunity.hours);

      if (currentWeeklyOt + shiftHours > Number(settings.max_weekly_ot_hours)) {
        throw new BadRequestException(
          `Cannot claim VET: Exceeds weekly overtime limit of ${settings.max_weekly_ot_hours}h. ` +
          `Your current scheduled OT this week is ${currentWeeklyOt}h, claiming ${shiftHours}h would total ${currentWeeklyOt + shiftHours}h.`,
        );
      }

      // Check rest hours between consecutive shifts
      const dayBefore = new Date(oppDate);
      dayBefore.setDate(oppDate.getDate() - 1);
      const dayAfter = new Date(oppDate);
      dayAfter.setDate(oppDate.getDate() + 1);

      const adjacentSchedules = await connection.query(
        `SELECT s.date, sh.start_time, sh.end_time
         FROM schedules s
         JOIN shifts sh ON s.shift_id = sh.id
         WHERE s.user_id = $1 AND s.date IN ($2, $3) AND s.is_day_off = false`,
        [userId, dayBefore.toISOString().split('T')[0], dayAfter.toISOString().split('T')[0]],
      );

      // Validate at least settings.min_rest_hours_between_shifts
      for (const adj of adjacentSchedules) {
        if (adj.date.toISOString().split('T')[0] === dayBefore.toISOString().split('T')[0] && adj.end_time && opportunity.start_time) {
          const prevEnd = Number(adj.end_time.split(':')[0]) + Number(adj.end_time.split(':')[1]) / 60;
          const currStart = Number(opportunity.start_time.split(':')[0]) + Number(opportunity.start_time.split(':')[1]) / 60;
          const restHours = (24 - prevEnd) + currStart;
          if (restHours < Number(settings.min_rest_hours_between_shifts)) {
            throw new BadRequestException(
              `Cannot claim VET: Rest period between previous shift and this shift is ${restHours.toFixed(1)}h. ` +
              `Tenant policy requires minimum ${settings.min_rest_hours_between_shifts}h rest.`,
            );
          }
        }
      }
    }

    // 5. VTO Scheduled Work & PTO Balances Validations
    if (opportunity.type === 'VTO') {
      if (!settings.vto_enabled) {
        throw new BadRequestException('Voluntary Time Off claims are disabled by tenant policy');
      }

      // Check that employee is actually scheduled on this date
      const scheduledShift = await connection.query(
        `SELECT * FROM schedules WHERE user_id = $1 AND date = $2 AND is_day_off = false`,
        [userId, opportunity.date],
      );
      if (!scheduledShift || scheduledShift.length === 0) {
        throw new BadRequestException('Cannot claim VTO: You do not have a scheduled working shift on this date.');
      }

      // If user wants to fund VTO with PTO balance
      if (dto.use_pto_balance) {
        if (!settings.vto_allow_pto_funding) {
          throw new BadRequestException('Tenant policy does not permit funding VTO with PTO balances.');
        }

        const leaveBalance = await connection.query(
          `SELECT (total_days - used_days) AS remaining_days FROM leave_balances WHERE user_id = $1 LIMIT 1`,
          [userId],
        );
        const remainingDays = Number(leaveBalance[0]?.remaining_days || 0);
        const daysNeeded = Number(opportunity.hours) / 8.0;
        if (remainingDays < daysNeeded) {
          throw new BadRequestException(`Insufficient PTO balance (${remainingDays} days available, ${daysNeeded} days needed).`);
        }
      }
    }

    // 6. Strategy & Auto-Approval Evaluation
    const isAutoApproved =
      opportunity.type === 'VET'
        ? settings.vet_auto_approval && settings.vet_claim_strategy === 'fcfs'
        : settings.vto_auto_approval && settings.vto_claim_strategy === 'fcfs';

    const claimStatus = isAutoApproved ? 'approved' : 'pending';

    // 7. Create or update the claim record
    let claimResult;
    if (existingClaim.length > 0) {
      claimResult = await connection.query(`
        UPDATE wfm_opportunity_claims
        SET
          status = $1,
          use_pto_balance = $2,
          claimed_at = NOW(),
          company_id = $3,
          branch_id = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [
        claimStatus,
        Boolean(dto.use_pto_balance),
        opportunity.company_id || userCompanyId || null,
        opportunity.branch_id || userBranchId || null,
        existingClaim[0].id,
      ]);
    } else {
      claimResult = await connection.query(`
        INSERT INTO wfm_opportunity_claims (
          opportunity_id, user_id, claim_type, status,
          use_pto_balance, company_id, branch_id
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7
        ) RETURNING *
      `, [
        opportunityId,
        userId,
        opportunity.type,
        claimStatus,
        Boolean(dto.use_pto_balance),
        opportunity.company_id || userCompanyId || null,
        opportunity.branch_id || userBranchId || null,
      ]);
    }

    const claim = claimResult[0];
    const oppDateStr = typeof opportunity.date === 'string'
      ? opportunity.date
      : new Date(opportunity.date).toISOString().split('T')[0];

    // 8. If Auto-Approved: Apply scheduling & overtime integration immediately
    if (isAutoApproved) {
      await this.applyApprovedClaim(connection, claim, opportunity, settings);

      // Increment claimed slots
      const updatedOpp = await connection.query(`
        UPDATE wfm_opportunities
        SET
          slots_claimed = slots_claimed + 1,
          status = CASE WHEN slots_claimed + 1 >= slots_available THEN 'filled' ELSE status END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [opportunityId]);

      // Direct Notification to user on both desktop and mobile
      try {
        await this.notificationsService.createNotification(tenantId, userId, {
          type: 'wfm_claim_decision',
          title: `✅ ${opportunity.type} Claim Auto-Approved!`,
          message: `Your ${opportunity.type} claim for ${oppDateStr} (${opportunity.title}) has been automatically approved and scheduled!`,
          priority: 'high',
          deep_link: '/scheduling/opportunities?tab=my-claims',
          referenceId: claim.id,
        });
      } catch (err) {
        this.logger.warn(`Failed to send auto-approval notification: ${err.message}`);
      }

      // Real-time broadcast update
      try {
        if (this.notificationsGateway) {
          this.notificationsGateway.server?.emit('wfm:slot_claimed', {
            tenantId,
            opportunityId,
            slots_claimed: updatedOpp[0].slots_claimed,
            status: updatedOpp[0].status,
          });
        }
      } catch (e) {
        this.logger.warn(`Failed to emit socket update: ${e.message}`);
      }
    } else {
      // Pending review: Notify managers/supervisors across desktop and mobile
      try {
        const userRes = await connection.query('SELECT full_name FROM users WHERE id = $1', [userId]);
        const claimerName = userRes[0]?.full_name || 'An employee';

        const managerRows = await connection.query(`
          SELECT id FROM users
          WHERE is_active = true
            AND (role IN ('Manager', 'HR', 'Admin') OR role_id IN (SELECT id FROM roles WHERE name IN ('Manager', 'HR', 'Admin')))
        `);
        const managerIds = managerRows.map((m: any) => m.id);

        if (managerIds.length > 0) {
          await this.notificationsService.createBulkNotifications(tenantId, managerIds, {
            type: 'wfm_claim_submitted',
            title: `📋 New ${opportunity.type} Claim Submitted`,
            message: `${claimerName} submitted a ${opportunity.type} claim for ${oppDateStr} (${opportunity.title}) awaiting review.`,
            priority: 'normal',
            deep_link: '/scheduling/opportunities?tab=claims',
            referenceId: claim.id,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to notify managers of pending claim: ${err.message}`);
      }
    }

    return {
      message: isAutoApproved
        ? `Your ${opportunity.type} claim has been automatically approved! Your schedule and records are updated.`
        : `Your ${opportunity.type} claim has been submitted and is pending manager review.`,
      claim,
      auto_approved: isAutoApproved,
    };
  }

  /**
   * Helper: Apply Approved Claim to Scheduling, Overtime, and Attendance
   */
  private async applyApprovedClaim(
    connection: any,
    claim: any,
    opportunity: any,
    settings: any,
  ) {
    const oppDateStr = typeof opportunity.date === 'string'
      ? opportunity.date
      : new Date(opportunity.date).toISOString().split('T')[0];

    if (opportunity.type === 'VET') {
      // 1. Scheduling Integration: Upsert into schedules
      const schedUpsert = await connection.query(`
        INSERT INTO schedules (
          user_id, date, shift_id, is_day_off, is_override,
          note, company_id, branch_id
        ) VALUES (
          $1, $2, $3, false, true,
          $4, $5, $6
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          shift_id = EXCLUDED.shift_id,
          is_day_off = false,
          is_override = true,
          note = EXCLUDED.note,
          updated_at = NOW()
        RETURNING id
      `, [
        claim.user_id,
        oppDateStr,
        opportunity.shift_id,
        `VET Approved Shift Claim: ${opportunity.title}`,
        opportunity.company_id || claim.company_id,
        opportunity.branch_id || claim.branch_id,
      ]);

      const scheduleId = schedUpsert[0]?.id;

      // 2. Overtime Calculation Integration
      // Get user basic salary
      const userRes = await connection.query(
        'SELECT basic_salary FROM users WHERE id = $1',
        [claim.user_id],
      );
      const basicSalary = Number(userRes[0]?.basic_salary || 0);

      // Get monthly working hours setting
      let monthlyHours = 160;
      try {
        const payrollSettingsRes = await connection.query(
          "SELECT data FROM settings WHERE category = 'payroll'",
        );
        monthlyHours = Number(payrollSettingsRes[0]?.data?.monthly_working_hours || 160);
      } catch (e) {
        monthlyHours = 160;
      }

      const hourlyRate = monthlyHours > 0 ? basicSalary / monthlyHours : 0;
      const multiplier = Number(opportunity.ot_rate_multiplier || 1.5);
      const hours = Number(opportunity.hours);
      const totalAmount = Number((hours * multiplier * hourlyRate).toFixed(2));

      // Determine category column
      const otCat = opportunity.ot_category || 'normal';
      const normalHours = otCat === 'normal' ? hours : 0;
      const nightHours = otCat === 'night' ? hours : 0;
      const dayoffHours = otCat === 'dayoff' ? hours : 0;
      const holidayHours = otCat === 'holiday' ? hours : 0;

      const otUpsert = await connection.query(`
        INSERT INTO overtime_entries (
          user_id, date, normal_ot_hours, night_ot_hours,
          dayoff_ot_hours, holiday_ot_hours, total_amount,
          status, company_id, branch_id
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          'Approved', $8, $9
        )
        ON CONFLICT (user_id, date) DO UPDATE SET
          normal_ot_hours = overtime_entries.normal_ot_hours + EXCLUDED.normal_ot_hours,
          night_ot_hours = overtime_entries.night_ot_hours + EXCLUDED.night_ot_hours,
          dayoff_ot_hours = overtime_entries.dayoff_ot_hours + EXCLUDED.dayoff_ot_hours,
          holiday_ot_hours = overtime_entries.holiday_ot_hours + EXCLUDED.holiday_ot_hours,
          total_amount = overtime_entries.total_amount + EXCLUDED.total_amount,
          status = 'Approved',
          updated_at = NOW()
        RETURNING id
      `, [
        claim.user_id,
        oppDateStr,
        normalHours,
        nightHours,
        dayoffHours,
        holidayHours,
        totalAmount,
        opportunity.company_id || claim.company_id,
        opportunity.branch_id || claim.branch_id,
      ]);

      const otEntryId = otUpsert[0]?.id;

      // Link IDs to claim
      await connection.query(`
        UPDATE wfm_opportunity_claims
        SET
          schedule_id = $1,
          overtime_entry_id = $2,
          status = 'approved',
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
      `, [scheduleId, otEntryId, claim.id]);
    }

    if (opportunity.type === 'VTO') {
      // 1. Scheduling Integration: Mark day off (excused)
      const schedUpdate = await connection.query(`
        UPDATE schedules
        SET
          is_day_off = true,
          is_override = true,
          note = $1,
          updated_at = NOW()
        WHERE user_id = $2 AND date = $3
        RETURNING id
      `, [
        `VTO Approved: Voluntary Excused Time Off (${opportunity.title})`,
        claim.user_id,
        oppDateStr,
      ]);

      const scheduleId = schedUpdate[0]?.id;

      // 2. Attendance Excused Status
      await connection.query(`
        UPDATE attendance_records
        SET
          status = 'Excused',
          remarks = 'VTO Approved (Voluntary Excused Time Off)',
          updated_at = NOW()
        WHERE user_id = $1 AND date = $2
      `, [claim.user_id, oppDateStr]);

      // 3. PTO Balance deduction if opted
      if (claim.use_pto_balance && settings.vto_allow_pto_funding) {
        const daysToDeduct = Number(opportunity.hours) / 8.0;
        await connection.query(`
          UPDATE leave_balances
          SET
            used_days = used_days + $1,
            updated_at = NOW()
          WHERE user_id = $2
        `, [daysToDeduct, claim.user_id]);
      }

      await connection.query(`
        UPDATE wfm_opportunity_claims
        SET
          schedule_id = $1,
          status = 'approved',
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [scheduleId, claim.id]);
    }
  }

  /**
   * 7. Manager Review of Pending Claims
   * Dispatches notifications to employee on decision (Approved or Rejected)
   */
  async reviewClaim(
    tenantId: string,
    claimId: string,
    reviewerId: string,
    dto: ReviewClaimDto,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const claimRows = await connection.query(
      `SELECT c.*, o.title, o.type, o.date, o.hours, o.ot_rate_multiplier, o.ot_category,
              o.shift_id, o.slots_available, o.slots_claimed, o.company_id, o.branch_id
       FROM wfm_opportunity_claims c
       JOIN wfm_opportunities o ON c.opportunity_id = o.id
       WHERE c.id = $1 FOR UPDATE`,
      [claimId],
    );

    if (!claimRows || claimRows.length === 0) {
      throw new NotFoundException('Claim not found');
    }

    const claim = claimRows[0];
    if (claim.status !== 'pending') {
      throw new BadRequestException(`Claim is already ${claim.status} and cannot be reviewed again.`);
    }

    const oppDateStr = typeof claim.date === 'string'
      ? claim.date
      : new Date(claim.date).toISOString().split('T')[0];

    const settings = await this.getSettings(tenantId, claim.company_id, claim.branch_id);

    if (dto.status === 'approved') {
      if (claim.slots_claimed >= claim.slots_available) {
        throw new BadRequestException('All slots for this opportunity have already been filled.');
      }

      // Apply scheduling & OT integrations
      await this.applyApprovedClaim(connection, claim, claim, settings);

      // Increment slots claimed
      await connection.query(`
        UPDATE wfm_opportunities
        SET
          slots_claimed = slots_claimed + 1,
          status = CASE WHEN slots_claimed + 1 >= slots_available THEN 'filled' ELSE status END,
          updated_at = NOW()
        WHERE id = $1
      `, [claim.opportunity_id]);

      // Update claim
      await connection.query(`
        UPDATE wfm_opportunity_claims
        SET
          status = 'approved',
          reviewed_by = $1,
          reviewed_at = NOW(),
          review_notes = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [reviewerId, dto.review_notes || 'Approved by Manager', claimId]);

      // Notify employee on both desktop and mobile
      try {
        await this.notificationsService.createNotification(tenantId, claim.user_id, {
          type: 'wfm_claim_decision',
          title: `✅ ${claim.type} Claim Approved!`,
          message: `Your manager approved your ${claim.type} claim for ${oppDateStr} (${claim.title}). Schedule & payroll updated.`,
          priority: 'high',
          deep_link: '/scheduling/opportunities?tab=my-claims',
          referenceId: claim.id,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify user on approval: ${err.message}`);
      }

      return {
        message: 'Claim approved successfully and applied to scheduling & payroll.',
        status: 'approved',
      };
    } else {
      // Rejected
      await connection.query(`
        UPDATE wfm_opportunity_claims
        SET
          status = 'rejected',
          reviewed_by = $1,
          reviewed_at = NOW(),
          review_notes = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [reviewerId, dto.review_notes || 'Rejected by Manager', claimId]);

      // Notify employee on both desktop and mobile
      try {
        await this.notificationsService.createNotification(tenantId, claim.user_id, {
          type: 'wfm_claim_decision',
          title: `❌ ${claim.type} Claim Not Approved`,
          message: `Your ${claim.type} claim for ${oppDateStr} was not approved: ${dto.review_notes || 'No reason provided'}.`,
          priority: 'normal',
          deep_link: '/scheduling/opportunities?tab=my-claims',
          referenceId: claim.id,
        });
      } catch (err) {
        this.logger.warn(`Failed to notify user on rejection: ${err.message}`);
      }

      return {
        message: 'Claim rejected.',
        status: 'rejected',
      };
    }
  }

  /**
   * 8. Cancel a Claim (Before Cutoff)
   * If slot reopens, broadcasts notification to department users on both desktop and mobile
   */
  async cancelClaim(tenantId: string, claimId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const claimRows = await connection.query(
      `SELECT c.*, o.title, o.date, o.start_time, o.type, o.hours, o.ot_rate_multiplier,
              o.slots_claimed, o.slots_available, o.department_id, o.company_id, o.branch_id
       FROM wfm_opportunity_claims c
       JOIN wfm_opportunities o ON c.opportunity_id = o.id
       WHERE c.id = $1`,
      [claimId],
    );

    if (!claimRows || claimRows.length === 0) {
      throw new NotFoundException('Claim not found');
    }

    const claim = claimRows[0];
    if (claim.user_id !== userId) {
      throw new BadRequestException('You are not authorized to cancel this claim.');
    }
    if (claim.status === 'cancelled') {
      throw new BadRequestException('Claim is already cancelled.');
    }

    const settings = await this.getSettings(tenantId, claim.company_id, claim.branch_id);
    const cutoffHours = claim.type === 'VET'
      ? settings.vet_cancellation_cutoff_hours
      : settings.vto_cancellation_cutoff_hours;

    // Check cutoff time
    const oppDate = new Date(claim.date);
    const now = new Date();
    const hoursUntilOpp = (oppDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilOpp < cutoffHours) {
      throw new BadRequestException(
        `Claims cannot be cancelled within ${cutoffHours} hours of the shift start.`,
      );
    }

    let slotReopened = false;

    // Revert scheduling & OT if it was approved
    if (claim.status === 'approved') {
      if (claim.type === 'VET') {
        if (claim.schedule_id) {
          await connection.query('DELETE FROM schedules WHERE id = $1', [claim.schedule_id]);
        }
        if (claim.overtime_entry_id) {
          await connection.query('DELETE FROM overtime_entries WHERE id = $1', [claim.overtime_entry_id]);
        }
      }
      if (claim.type === 'VTO') {
        if (claim.schedule_id) {
          await connection.query(
            "UPDATE schedules SET is_day_off = false, note = 'VTO Cancelled' WHERE id = $1",
            [claim.schedule_id],
          );
        }
        // Refund PTO balance if funded
        if (claim.use_pto_balance) {
          const hours = Number(claim.hours || 8);
          await connection.query(
            'UPDATE leave_balances SET used_days = used_days - $1 WHERE user_id = $2',
            [hours / 8.0, userId],
          );
        }
      }

      // Decrement slots claimed & reopen opportunity if filled
      await connection.query(`
        UPDATE wfm_opportunities
        SET
          slots_claimed = GREATEST(0, slots_claimed - 1),
          status = 'open',
          updated_at = NOW()
        WHERE id = $1
      `, [claim.opportunity_id]);

      slotReopened = true;
    }

    await connection.query(`
      UPDATE wfm_opportunity_claims
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
    `, [claimId]);

    // If a slot reopened, notify the entire department immediately on desktop & mobile!
    if (slotReopened) {
      const oppQuery = await connection.query('SELECT * FROM wfm_opportunities WHERE id = $1', [claim.opportunity_id]);
      if (oppQuery.length > 0) {
        await this.notifyEligibleDepartmentUsers(connection, tenantId, oppQuery[0], true);
      }
    }

    return { message: 'Claim successfully cancelled.' };
  }

  /**
   * 9. Get Claims Review Queue for Managers
   * Automatically sorts by tenant claim strategy:
   * - 'seniority': longest tenure (earliest hire_date) first
   * - 'fairness': least overtime hours worked this month first
   * - 'fcfs': first-come first-served (claimed_at)
   */
  async getClaimsReviewQueue(
    tenantId: string,
    filters: {
      status?: string;
      companyId?: string;
      branchId?: string;
      departmentId?: string;
    },
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const settings = await this.getSettings(tenantId, filters.companyId, filters.branchId);
    const strategy = settings.vet_claim_strategy || 'fcfs';

    let query = `
      SELECT
        c.*,
        u.full_name,
        u.email,
        u.department,
        u.position,
        u.hire_date,
        o.title AS opportunity_title,
        o.type AS opportunity_type,
        o.date AS opportunity_date,
        o.start_time,
        o.end_time,
        o.hours,
        o.ot_rate_multiplier,
        o.ot_category,
        COALESCE((
          SELECT SUM(normal_ot_hours + night_ot_hours + holiday_ot_hours + dayoff_ot_hours)
          FROM overtime_entries oe
          WHERE oe.user_id = c.user_id
            AND oe.date >= DATE_TRUNC('month', CURRENT_DATE)
            AND oe.status != 'Rejected'
        ), 0) AS month_ot_hours
      FROM wfm_opportunity_claims c
      JOIN wfm_opportunities o ON c.opportunity_id = o.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (filters.status && filters.status !== 'all') {
      query += ` AND c.status = $${pIdx}`;
      params.push(filters.status);
      pIdx++;
    } else {
      query += ` AND c.status = 'pending'`;
    }

    if (filters.companyId) {
      query += ` AND (c.company_id = $${pIdx} OR c.company_id IS NULL)`;
      params.push(filters.companyId);
      pIdx++;
    }
    if (filters.branchId) {
      query += ` AND (c.branch_id = $${pIdx} OR c.branch_id IS NULL)`;
      params.push(filters.branchId);
      pIdx++;
    }

    // Apply Strategy-Based Priority Ordering
    if (strategy === 'seniority') {
      query += ` ORDER BY u.hire_date ASC NULLS LAST, c.claimed_at ASC`;
    } else if (strategy === 'fairness') {
      query += ` ORDER BY month_ot_hours ASC, c.claimed_at ASC`;
    } else {
      // FCFS
      query += ` ORDER BY c.claimed_at ASC`;
    }

    return connection.query(query, params);
  }

  /**
   * 10. Get WFM Statistics & KPI Dashboard Metrics
   */
  async getWfmStats(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    let scopeWhere = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (companyId) {
      scopeWhere += ` AND (company_id = $${pIdx} OR company_id IS NULL)`;
      params.push(companyId);
      pIdx++;
    }
    if (branchId) {
      scopeWhere += ` AND (branch_id = $${pIdx} OR branch_id IS NULL)`;
      params.push(branchId);
      pIdx++;
    }

    const statsQuery = await connection.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'VET' AND status = 'open' THEN (slots_available - slots_claimed) ELSE 0 END), 0) AS open_vet_slots,
        COALESCE(SUM(CASE WHEN type = 'VTO' AND status = 'open' THEN (slots_available - slots_claimed) ELSE 0 END), 0) AS open_vto_slots,
        COALESCE(SUM(CASE WHEN type = 'VET' THEN slots_claimed ELSE 0 END), 0) AS total_vet_claimed,
        COALESCE(SUM(CASE WHEN type = 'VTO' THEN slots_claimed ELSE 0 END), 0) AS total_vto_claimed
      FROM wfm_opportunities
      ${scopeWhere}
    `, params);

    const pendingClaimsQuery = await connection.query(`
      SELECT COUNT(*) AS pending_claims_count
      FROM wfm_opportunity_claims
      ${scopeWhere} AND status = 'pending'
    `, params);

    return {
      open_vet_slots: Number(statsQuery[0]?.open_vet_slots || 0),
      open_vto_slots: Number(statsQuery[0]?.open_vto_slots || 0),
      total_vet_claimed: Number(statsQuery[0]?.total_vet_claimed || 0),
      total_vto_claimed: Number(statsQuery[0]?.total_vto_claimed || 0),
      pending_reviews: Number(pendingClaimsQuery[0]?.pending_claims_count || 0),
    };
  }

  /**
   * 11. Cancel Opportunity
   */
  async cancelOpportunity(tenantId: string, id: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureTables(connection);

    const check = await connection.query('SELECT * FROM wfm_opportunities WHERE id = $1', [id]);
    if (!check || check.length === 0) {
      throw new NotFoundException('Opportunity not found');
    }

    await connection.query(
      "UPDATE wfm_opportunities SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [id],
    );

    return { message: 'Opportunity successfully cancelled.' };
  }
}
