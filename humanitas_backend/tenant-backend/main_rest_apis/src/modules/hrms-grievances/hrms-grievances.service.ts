import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  FileGrievanceDto,
  UpdateGrievanceStatusDto,
  AssignInvestigatorDto,
  ProposeResolutionDto,
  SubmitSatisfactionFeedbackDto,
  AddGrievanceNoteDto,
  GrievanceStatus,
} from './dto/hrms-grievances.dto';

@Injectable()
export class HrmsGrievancesService {
  private readonly logger = new Logger(HrmsGrievancesService.name);
  private ensuredTenants = new Set<string>();

  constructor(private readonly databaseService: DatabaseService) {}

  private async getConnection(tenantId: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    if (!this.ensuredTenants.has(tenantId)) {
      await this.ensureTables(connection);
      this.ensuredTenants.add(tenantId);
    }
    return connection;
  }

  async ensureTables(connection: any) {
    try {
      await connection.query(`
        -- Master Grievances Table
        CREATE TABLE IF NOT EXISTS grievances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_number VARCHAR(32) UNIQUE NOT NULL,
          user_id UUID,
          is_anonymous BOOLEAN DEFAULT FALSE,
          category VARCHAR(64) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          priority VARCHAR(32) DEFAULT 'medium',
          status VARCHAR(32) DEFAULT 'filed',
          incident_date DATE,
          incident_location VARCHAR(255),
          accused_parties VARCHAR(255),
          witnesses TEXT,
          assigned_investigator_id UUID,
          investigation_notes TEXT,
          resolution_summary TEXT,
          resolution_action_items TEXT,
          resolution_date TIMESTAMP,
          acknowledged_at TIMESTAMP,
          sla_acknowledgment_deadline TIMESTAMP,
          sla_resolution_deadline TIMESTAMP,
          is_sla_breached BOOLEAN DEFAULT FALSE,
          retaliation_monitoring_flag BOOLEAN DEFAULT FALSE,
          satisfaction_score INT,
          satisfaction_feedback TEXT,
          company_id UUID,
          branch_id UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Grievance Timeline & Audit Events
        CREATE TABLE IF NOT EXISTS grievance_timeline (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          grievance_id UUID NOT NULL,
          actor_id UUID,
          action VARCHAR(64) NOT NULL,
          notes TEXT,
          is_confidential BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Grievance Attachments
        CREATE TABLE IF NOT EXISTS grievance_attachments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          grievance_id UUID NOT NULL,
          uploaded_by UUID,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          file_size INT,
          file_type VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_grievances_user_id ON grievances(user_id);
        CREATE INDEX IF NOT EXISTS idx_grievances_status ON grievances(status);
        CREATE INDEX IF NOT EXISTS idx_grievances_company_id ON grievances(company_id);
        CREATE INDEX IF NOT EXISTS idx_grievance_timeline_grievance_id ON grievance_timeline(grievance_id);
      `);
      this.logger.log('Grievance tables verified/created successfully');
    } catch (error) {
      this.logger.error('Failed to create grievance tables', error);
      throw error;
    }
  }

  private generateTicketNumber(): string {
    const d = new Date();
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `GRV-${ym}-${rand}`;
  }

  async fileGrievance(
    tenantId: string,
    userId: string,
    dto: FileGrievanceDto,
    companyId?: string,
    branchId?: string,
  ) {
    const connection = await this.getConnection(tenantId);
    const ticketNumber = this.generateTicketNumber();

    const ackDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h SLA
    const resDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14d SLA

    const insertResult = await connection.query(
      `INSERT INTO grievances (
        ticket_number, user_id, is_anonymous, category, subject, description,
        priority, status, incident_date, incident_location, accused_parties, witnesses,
        sla_acknowledgment_deadline, sla_resolution_deadline, company_id, branch_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        ticketNumber,
        userId,
        dto.is_anonymous || false,
        dto.category,
        dto.subject,
        dto.description,
        dto.priority || 'medium',
        GrievanceStatus.FILED,
        dto.incident_date || null,
        dto.incident_location || null,
        dto.accused_parties || null,
        dto.witnesses || null,
        ackDeadline,
        resDeadline,
        companyId || null,
        branchId || null,
      ],
    );

    const grievance = insertResult[0];

    // Log timeline event
    await connection.query(
      `INSERT INTO grievance_timeline (grievance_id, actor_id, action, notes)
       VALUES ($1, $2, 'filed', 'Grievance ticket created')`,
      [grievance.id, userId],
    );

    // Save attachments if any
    if (dto.attachments && dto.attachments.length > 0) {
      for (const att of dto.attachments) {
        await connection.query(
          `INSERT INTO grievance_attachments (grievance_id, uploaded_by, file_name, file_url, file_size, file_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [grievance.id, userId, att.file_name, att.file_url, att.file_size || null, att.file_type || null],
        );
      }
    }

    return grievance;
  }

  async getGrievances(
    tenantId: string,
    currentUserId: string,
    hasManagePerm: boolean,
    filters?: { status?: string; category?: string; company_id?: string; branch_id?: string },
  ) {
    const connection = await this.getConnection(tenantId);
    const submitterNameSql = hasManagePerm
      ? `CASE 
          WHEN g.is_anonymous = TRUE THEN CONCAT(COALESCE(u.full_name, u.first_name, ''), ' (Masked/Anonymous)')
          ELSE COALESCE(u.full_name, u.first_name, '')
        END`
      : `CASE 
          WHEN g.is_anonymous = TRUE THEN 'Anonymous Submitter'
          ELSE COALESCE(u.full_name, u.first_name, '')
        END`;

    let query = `
      SELECT 
        g.*,
        ${submitterNameSql} AS submitter_name,
        u.email AS submitter_email,
        u.department AS submitter_department,
        COALESCE(inv.full_name, inv.first_name, '') AS investigator_name,
        (SELECT COUNT(*) FROM grievance_attachments ga WHERE ga.grievance_id = g.id) AS attachments_count,
        CASE 
          WHEN g.status != 'closed' AND NOW() > g.sla_resolution_deadline THEN TRUE
          ELSE FALSE
        END AS is_sla_breached
      FROM grievances g
      LEFT JOIN users u ON g.user_id = u.id
      LEFT JOIN users inv ON g.assigned_investigator_id = inv.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (!hasManagePerm) {
      query += ` AND g.user_id = $${paramIndex++}`;
      params.push(currentUserId);
    }

    if (filters?.status) {
      query += ` AND g.status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters?.category) {
      query += ` AND g.category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters?.company_id) {
      query += ` AND g.company_id = $${paramIndex++}`;
      params.push(filters.company_id);
    }

    if (filters?.branch_id) {
      query += ` AND g.branch_id = $${paramIndex++}`;
      params.push(filters.branch_id);
    }

    query += ` ORDER BY g.created_at DESC`;

    return connection.query(query, params);
  }

  async getGrievanceById(
    tenantId: string,
    id: string,
    currentUserId: string,
    hasManagePerm: boolean,
  ) {
    const connection = await this.getConnection(tenantId);
    const submitterNameSql = hasManagePerm
      ? `CASE 
          WHEN g.is_anonymous = TRUE THEN CONCAT(COALESCE(u.full_name, u.first_name, ''), ' (Anonymous)')
          ELSE COALESCE(u.full_name, u.first_name, '')
        END`
      : `CASE 
          WHEN g.is_anonymous = TRUE THEN 'Anonymous Submitter'
          ELSE COALESCE(u.full_name, u.first_name, '')
        END`;

    const rows = await connection.query(
      `SELECT 
        g.*,
        ${submitterNameSql} AS submitter_name,
        u.email AS submitter_email,
        u.department AS submitter_department,
        COALESCE(inv.full_name, inv.first_name, '') AS investigator_name,
        CASE 
          WHEN g.status != 'closed' AND NOW() > g.sla_resolution_deadline THEN TRUE
          ELSE FALSE
        END AS is_sla_breached
       FROM grievances g
       LEFT JOIN users u ON g.user_id = u.id
       LEFT JOIN users inv ON g.assigned_investigator_id = inv.id
       WHERE g.id = $1`,
      [id],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Grievance not found`);
    }

    const grievance = rows[0];

    if (!hasManagePerm && grievance.user_id !== currentUserId) {
      throw new ForbiddenException(`You do not have permission to view this grievance`);
    }

    // Get timeline
    let timelineQuery = `
      SELECT gt.*, CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS actor_name
      FROM grievance_timeline gt
      LEFT JOIN users u ON gt.actor_id = u.id
      WHERE gt.grievance_id = $1
    `;
    const timelineParams: any[] = [id];

    if (!hasManagePerm) {
      timelineQuery += ` AND gt.is_confidential = FALSE`;
    }
    timelineQuery += ` ORDER BY gt.created_at ASC`;

    const timeline = await connection.query(timelineQuery, timelineParams);

    // Get attachments
    const attachments = await connection.query(
      `SELECT * FROM grievance_attachments WHERE grievance_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    return {
      ...grievance,
      timeline,
      attachments,
    };
  }

  async updateStatus(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateGrievanceStatusDto,
  ) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query(`SELECT * FROM grievances WHERE id = $1`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Grievance not found`);
    }

    let query = `UPDATE grievances SET status = $1, updated_at = CURRENT_TIMESTAMP`;
    const params: any[] = [dto.status, id];

    if (dto.status === GrievanceStatus.ACKNOWLEDGED && !existing[0].acknowledged_at) {
      query += `, acknowledged_at = CURRENT_TIMESTAMP`;
    }

    if (dto.status === GrievanceStatus.CLOSED && !existing[0].resolution_date) {
      query += `, resolution_date = CURRENT_TIMESTAMP`;
    }

    query += ` WHERE id = $2 RETURNING *`;
    const result = await connection.query(query, params);

    // Log timeline
    await connection.query(
      `INSERT INTO grievance_timeline (grievance_id, actor_id, action, notes)
       VALUES ($1, $2, 'status_changed', $3)`,
      [id, userId, dto.notes || `Status changed from ${existing[0].status} to ${dto.status}`],
    );

    return result[0];
  }

  async assignInvestigator(
    tenantId: string,
    id: string,
    actorId: string,
    dto: AssignInvestigatorDto,
  ) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query(`SELECT * FROM grievances WHERE id = $1`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Grievance not found`);
    }

    const nextStatus = existing[0].status === GrievanceStatus.FILED ? GrievanceStatus.INVESTIGATING : existing[0].status;

    const result = await connection.query(
      `UPDATE grievances 
       SET assigned_investigator_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [dto.investigator_id, nextStatus, id],
    );

    await connection.query(
      `INSERT INTO grievance_timeline (grievance_id, actor_id, action, notes)
       VALUES ($1, $2, 'assigned', $3)`,
      [id, actorId, dto.notes || `Assigned investigator to case`],
    );

    return result[0];
  }

  async proposeResolution(
    tenantId: string,
    id: string,
    actorId: string,
    dto: ProposeResolutionDto,
  ) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query(`SELECT * FROM grievances WHERE id = $1`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Grievance not found`);
    }

    const result = await connection.query(
      `UPDATE grievances 
       SET resolution_summary = $1,
           resolution_action_items = $2,
           retaliation_monitoring_flag = $3,
           status = $4,
           resolution_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [
        dto.resolution_summary,
        dto.action_items || null,
        dto.retaliation_monitoring_flag || false,
        GrievanceStatus.RESOLUTION_PROPOSED,
        id,
      ],
    );

    await connection.query(
      `INSERT INTO grievance_timeline (grievance_id, actor_id, action, notes)
       VALUES ($1, $2, 'resolution_proposed', $3)`,
      [id, actorId, `Resolution proposed: ${dto.resolution_summary}`],
    );

    return result[0];
  }

  async submitFeedback(
    tenantId: string,
    id: string,
    userId: string,
    dto: SubmitSatisfactionFeedbackDto,
  ) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query(`SELECT * FROM grievances WHERE id = $1`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Grievance not found`);
    }

    if (existing[0].user_id !== userId) {
      throw new ForbiddenException(`Only the complainant can submit satisfaction feedback`);
    }

    const result = await connection.query(
      `UPDATE grievances 
       SET satisfaction_score = $1,
           satisfaction_feedback = $2,
           status = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [dto.satisfaction_score, dto.satisfaction_feedback || null, GrievanceStatus.CLOSED, id],
    );

    await connection.query(
      `INSERT INTO grievance_timeline (grievance_id, actor_id, action, notes)
       VALUES ($1, $2, 'feedback_submitted', $3)`,
      [id, userId, `Complainant rated resolution: ${dto.satisfaction_score}/5`],
    );

    return result[0];
  }

  async addNote(
    tenantId: string,
    id: string,
    actorId: string,
    dto: AddGrievanceNoteDto,
  ) {
    const connection = await this.getConnection(tenantId);
    const existing = await connection.query(`SELECT * FROM grievances WHERE id = $1`, [id]);
    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Grievance not found`);
    }

    const result = await connection.query(
      `INSERT INTO grievance_timeline (grievance_id, actor_id, action, notes, is_confidential)
       VALUES ($1, $2, 'note_added', $3, $4)
       RETURNING *`,
      [id, actorId, dto.notes, dto.is_confidential || false],
    );

    return result[0];
  }

  async getStats(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let pIdx = 1;

    if (companyId) {
      whereClause += ` AND company_id = $${pIdx++}`;
      params.push(companyId);
    }
    if (branchId) {
      whereClause += ` AND branch_id = $${pIdx++}`;
      params.push(branchId);
    }

    const statsResult = await connection.query(
      `SELECT
        COUNT(*) AS total_cases,
        COUNT(*) FILTER (WHERE status IN ('filed', 'acknowledged', 'investigating', 'resolution_proposed')) AS open_cases,
        COUNT(*) FILTER (WHERE status = 'closed') AS closed_cases,
        COUNT(*) FILTER (WHERE status != 'closed' AND NOW() > sla_resolution_deadline) AS sla_breached_cases,
        COUNT(*) FILTER (WHERE retaliation_monitoring_flag = TRUE) AS retaliation_monitoring_count,
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolution_date, NOW()) - created_at)) / 86400)::numeric, 1), 0) AS avg_resolution_days
       FROM grievances
       ${whereClause}`,
      params,
    );

    const categoriesResult = await connection.query(
      `SELECT category, COUNT(*) as count
       FROM grievances
       ${whereClause}
       GROUP BY category`,
      params,
    );

    const statusResult = await connection.query(
      `SELECT status, COUNT(*) as count
       FROM grievances
       ${whereClause}
       GROUP BY status`,
      params,
    );

    const stat = statsResult[0] || {};
    const total = parseInt(stat.total_cases || '0', 10);
    const closed = parseInt(stat.closed_cases || '0', 10);
    const breached = parseInt(stat.sla_breached_cases || '0', 10);
    const resolvedOnTime = Math.max(0, closed - breached);
    const slaComplianceRate = closed > 0 ? Math.round((resolvedOnTime / closed) * 100) : 100;

    return {
      total_cases: total,
      open_cases: parseInt(stat.open_cases || '0', 10),
      closed_cases: closed,
      sla_breached_cases: breached,
      retaliation_monitoring_count: parseInt(stat.retaliation_monitoring_count || '0', 10),
      avg_resolution_days: parseFloat(stat.avg_resolution_days || '0'),
      sla_compliance_rate: slaComplianceRate,
      by_category: categoriesResult,
      by_status: statusResult,
    };
  }
}
