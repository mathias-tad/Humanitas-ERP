import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AttendanceGateway } from './attendance.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  logToTenantAudit,
} from './attendance.helpers';

/** Admin corrections and employee correction requests, with their audit logs. */
@Injectable()
export class AttendanceCorrectionsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => AttendanceGateway))
    private readonly attendanceGateway: AttendanceGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => NotificationsGateway))
    private readonly notificationsGateway: NotificationsGateway,
  ) { }


  // ============ ATTENDANCE CORRECTION ============
  async correctAttendance(
    tenantId: string,
    recordId: string,
    updates: {
      status?: string;
      clock_in?: string;
      clock_out?: string;
      reason?: string;
    },
    correctedBy: string,
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    // 1. Get the existing record with user info
    const existingResult = await connection.query(
      `SELECT ar.*, u.full_name as target_user_name 
       FROM attendance_records ar
       LEFT JOIN users u ON ar.user_id = u.id
       WHERE ar.id = $1`,
      [recordId],
    );

    if (!existingResult || existingResult.length === 0) {
      throw new NotFoundException(`Attendance record not found: ${recordId} `);
    }

    const existing = existingResult[0];
    const previousState = {
      status: existing.status,
      clock_in: existing.actual_in,
      clock_out: existing.actual_out,
    };

    // 2. Get corrector's name
    const correctorResult = await connection.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [correctedBy],
    );
    const correctorName = correctorResult[0]?.full_name || 'Unknown Admin';

    // 3. Build update query
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined && updates.status !== '') {
      setClauses.push(`status = $${paramIndex++} `);
      values.push(updates.status);
    }
    // Format existing.date (Date object) to YYYY-MM-DD
    const dateObj = new Date(existing.date);
    const dateStr = dateObj.toISOString().split('T')[0];

    // Only update actual_in if it has a value (allow independent updates)
    if (updates.clock_in !== undefined && updates.clock_in !== '') {
      setClauses.push(`actual_in = $${paramIndex++} `);
      // Combine date + time for TIMESTAMP column
      // Time is in tenant timezone (same as scheduled times)
      const timeStr = updates.clock_in.length === 5 ? updates.clock_in : updates.clock_in.substring(0, 5);
      values.push(`${dateStr} ${timeStr}:00`);
    }
    // Only update actual_out if it has a value (allow independent updates)
    if (updates.clock_out !== undefined && updates.clock_out !== '') {
      setClauses.push(`actual_out = $${paramIndex++} `);
      const timeStr = updates.clock_out.length === 5 ? updates.clock_out : updates.clock_out.substring(0, 5);
      values.push(`${dateStr} ${timeStr}:00`);
    }
    if (updates.reason !== undefined) {
      setClauses.push(`remarks = $${paramIndex++} `);
      values.push(updates.reason);
    }

    if (setClauses.length === 0) {
      throw new BadRequestException('No updates provided');
    }

    setClauses.push(`updated_at = NOW()`);
    setClauses.push(`is_corrected = true`);
    setClauses.push(`corrected_by = $${paramIndex++} `);
    values.push(correctedBy);
    values.push(recordId);

    // 4. Update the record
    const updateResult = await connection.query(
      `UPDATE attendance_records 
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
    RETURNING * `,
      values,
    );

    const updatedRecord = updateResult[0];
    const newState = {
      status: updatedRecord.status,
      clock_in: updatedRecord.actual_in,
      clock_out: updatedRecord.actual_out,
    };

    // 5. Log the correction to audit logs
    await logToTenantAudit(this.databaseService, 
      tenantId,
      correctedBy,
      'CORRECT_ATTENDANCE',
      recordId,
      {
        corrected_by: correctedBy,
        corrected_by_name: correctorName,
        target_user_id: existing.user_id,
        target_user_name: existing.target_user_name,
        date: existing.date,
        previous_state: previousState,
        new_state: newState,
        reason: updates.reason || 'No reason provided',
        corrected_at: new Date().toISOString(),
      },
    );

    console.log(`[Attendance] Correction made by ${correctorName} for ${existing.target_user_name}: ${JSON.stringify(previousState)} → ${JSON.stringify(newState)} `);

    // 6. Emit WebSocket update
    try {
      this.attendanceGateway.emitAttendanceUpdate(tenantId, {
        ...updatedRecord,
        full_name: existing.target_user_name,
        corrected: true,
        corrected_by_name: correctorName,
      });
    } catch (error) {
      console.error('[WebSocket] Failed to emit correction update:', error);
    }

    // 7. Create notification for the user whose attendance was corrected
    try {
      const notification = await this.notificationsService.createNotification(
        tenantId,
        existing.user_id,
        {
          type: 'attendance_correction',
          referenceId: recordId,
          title: 'Attendance Corrected',
          message: `${correctorName} corrected your attendance for ${dateStr}.Reason: ${updates.reason || 'No reason provided'}.`
        }
      );

      this.notificationsGateway.pushToUser(tenantId, existing.user_id, notification);
    } catch (notifError) {
      console.error('[AttendanceService] Failed to send attendance correction notification:', notifError);
    }

    return {
      ...updatedRecord,
      previous_state: previousState,
      corrected_by_name: correctorName,
    };
  }


  // Get attendance correction audit logs (for a specific user or all)
  async getAttendanceCorrectionLogs(
    tenantId: string,
    query: { userId?: string; page?: number; limit?: number } = {},
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let whereClause = `WHERE a.action = 'CORRECT_ATTENDANCE'`;
    const params: unknown[] = [];

    // Filter by target user if specified (for employee self-view)
    if (query.userId) {
      params.push(query.userId);
      whereClause += ` AND a.details ->> 'target_user_id' = $${params.length} `;
    }

    params.push(limit, offset);

    const logs = await connection.query(
      `SELECT a.*, u.full_name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length} `,
      params,
    );

    // Map logs to flatten details for the frontend
    const mappedLogs = logs.map(log => {
      // Audit logs store custom data in 'details' JSON column
      // We need to extract these common fields for the UI
      const details = log.details || {};
      return {
        id: log.id,
        action: log.action,
        created_at: log.created_at, // System timestamp

        // Fields expected by frontend CorrectionLog interface
        previous_state: details.previous_state,
        new_state: details.new_state,
        reason: details.reason,

        // Prefer explicit corrected_at from details, fallback to created_at
        corrected_at: details.corrected_at || log.created_at,

        // Names
        corrected_by_name: details.corrected_by_name || log.user_name || 'System',
        target_user_name: details.target_user_name || 'Unknown User',
      };
    });

    // Get total count for pagination
    const countParams = query.userId ? [query.userId] : [];
    const countResult = await connection.query(
      `SELECT COUNT(*) as total 
       FROM audit_logs a 
       ${whereClause} `,
      countParams,
    );
    const total = parseInt(countResult[0]?.total || '0');

    return {
      data: mappedLogs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  // ============ ATTENDANCE REGULARIZATION (CORRECTION REQUESTS) ============
  async requestAttendanceCorrection(
    tenantId: string,
    userId: string,
    recordId: string,
    data: { requested_in?: string; requested_out?: string; reason: string },
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const recResult = await connection.query(`
      SELECT * FROM attendance_records WHERE id = $1
    `, [recordId]);

    if (!recResult || recResult.length === 0) {
      throw new NotFoundException('Attendance record not found');
    }

    const rec = recResult[0];
    if (rec.user_id !== userId) {
      // Verify user permission or ownership
      const user = await connection.query(`SELECT role FROM users WHERE id = $1`, [userId]);
      if (user[0]?.role !== 'Administrator' && user[0]?.role !== 'Manager') {
        throw new BadRequestException('You can only request corrections for your own attendance');
      }
    }

    const result = await connection.query(`
      INSERT INTO attendance_correction_requests (
        tenant_id, attendance_record_id, user_id, work_date, shift_id,
        requested_in, requested_out, reason, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
      RETURNING *
    `, [
      tenantId,
      recordId,
      rec.user_id,
      rec.date,
      rec.shift_id,
      data.requested_in || null,
      data.requested_out || null,
      data.reason || 'Missed punch regularization',
    ]);

    await connection.query(`
      UPDATE attendance_records SET correction_status = 'pending' WHERE id = $1
    `, [recordId]);

    // Notify supervisors / managers with correct_attendance permission
    const supervisors = await connection.query(`
      SELECT id FROM users WHERE role IN ('Administrator', 'Manager') AND is_active = true
    `);

    for (const sup of supervisors) {
      await this.notificationsService.createNotification(tenantId, sup.id, {
        type: 'attendance_correction_request',
        title: '📋 Attendance Regularization Request',
        message: `Employee requested punch correction for ${rec.date}: "${data.reason}"`,
        priority: 'high',
        deep_link: '/attendance?tab=regularizations',
      }).catch(e => console.warn('[Attendance] Failed to notify supervisor:', e));
    }

    return result[0];
  }


  async getAttendanceCorrectionRequests(tenantId: string, filter?: { status?: string }) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    let whereClause = "";
    const params: unknown[] = [];
    if (filter?.status) {
      whereClause = "WHERE acr.status = $1";
      params.push(filter.status);
    }

    return connection.query(`
      SELECT acr.*, 
             u.full_name as employee_name, u.email as employee_email, u.department as employee_department,
             sh.name as shift_name,
             ar.actual_in as original_in, ar.actual_out as original_out, ar.missed_punch_type,
             rev.full_name as reviewer_name
      FROM attendance_correction_requests acr
      JOIN users u ON acr.user_id = u.id
      LEFT JOIN shifts sh ON acr.shift_id = sh.id
      LEFT JOIN attendance_records ar ON acr.attendance_record_id = ar.id
      LEFT JOIN users rev ON acr.reviewed_by = rev.id
      ${whereClause}
      ORDER BY acr.created_at DESC
    `, params);
  }


  async getMyAttendanceCorrectionRequests(tenantId: string, userId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    return connection.query(`
      SELECT acr.*, sh.name as shift_name,
             ar.actual_in as original_in, ar.actual_out as original_out, ar.missed_punch_type
      FROM attendance_correction_requests acr
      LEFT JOIN shifts sh ON acr.shift_id = sh.id
      LEFT JOIN attendance_records ar ON acr.attendance_record_id = ar.id
      WHERE acr.user_id = $1
      ORDER BY acr.created_at DESC
    `, [userId]);
  }


  async reviewAttendanceCorrectionRequest(
    tenantId: string,
    reviewerId: string,
    requestId: string,
    data: { status: 'approved' | 'rejected'; reviewer_notes?: string },
  ) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);

    const reqResult = await connection.query(`
      SELECT * FROM attendance_correction_requests WHERE id = $1
    `, [requestId]);

    if (!reqResult || reqResult.length === 0) {
      throw new NotFoundException('Correction request not found');
    }

    const req = reqResult[0];

    if (data.status === 'approved') {
      // Execute correction via correctAttendance to ensure audit logging
      await this.correctAttendance(
        tenantId,
        req.attendance_record_id,
        {
          clock_in: req.requested_in || undefined,
          clock_out: req.requested_out || undefined,
          status: 'Present',
          reason: `Regularization approved by reviewer: ${data.reviewer_notes || req.reason}`,
        },
        reviewerId,
      );

      await connection.query(`
        UPDATE attendance_records
        SET correction_status = 'approved',
            missed_punch_type = 'none',
            updated_at = NOW()
        WHERE id = $1
      `, [req.attendance_record_id]);

      await connection.query(`
        UPDATE attendance_correction_requests
        SET status = 'approved',
            reviewed_by = $1,
            reviewer_notes = $2,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `, [reviewerId, data.reviewer_notes || 'Approved', requestId]);

      await this.notificationsService.createNotification(tenantId, req.user_id, {
        type: 'attendance_correction_status',
        title: '✓ Attendance Regularization Approved',
        message: `Your attendance regularization for ${req.work_date} has been approved.`,
        priority: 'medium',
        deep_link: '/attendance',
      }).catch(e => console.warn('[Attendance] Failed to notify approval:', e));
    } else {
      await connection.query(`
        UPDATE attendance_records
        SET correction_status = 'rejected',
            updated_at = NOW()
        WHERE id = $1
      `, [req.attendance_record_id]);

      await connection.query(`
        UPDATE attendance_correction_requests
        SET status = 'rejected',
            reviewed_by = $1,
            reviewer_notes = $2,
            reviewed_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
      `, [reviewerId, data.reviewer_notes || 'Declined', requestId]);

      await this.notificationsService.createNotification(tenantId, req.user_id, {
        type: 'attendance_correction_status',
        title: '✗ Attendance Regularization Declined',
        message: `Your attendance regularization for ${req.work_date} was declined: "${data.reviewer_notes || 'No reason provided'}".`,
        priority: 'high',
        deep_link: '/attendance',
      }).catch(e => console.warn('[Attendance] Failed to notify rejection:', e));
    }

    return { success: true, status: data.status };
  }
}
