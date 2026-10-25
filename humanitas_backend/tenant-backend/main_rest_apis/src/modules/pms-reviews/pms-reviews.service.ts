import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import {
  CreateReviewCycleDto,
  UpdateReviewCycleDto,
  NominatePeersDto,
  SubmitFeedbackDto,
  CalibrateReviewDto,
  CreatePipDto,
  UpdatePipDto,
  ReviewCycleStatus,
  EmployeeReviewStatus,
  ReviewerType,
  PipStatus,
} from './dto/pms-reviews.dto';

@Injectable()
export class PmsReviewsService {
  private readonly logger = new Logger(PmsReviewsService.name);
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

  private async ensureTables(connection: any) {
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS pms_review_cycles (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          cycle_type VARCHAR(50) DEFAULT 'quarterly',
          status VARCHAR(50) DEFAULT 'draft',
          start_date DATE NOT NULL,
          due_date DATE NOT NULL,
          self_review_due_date DATE,
          peer_review_due_date DATE,
          manager_review_due_date DATE,
          description TEXT,
          is_peer_review_enabled BOOLEAN DEFAULT TRUE,
          min_peers INT DEFAULT 2,
          max_peers INT DEFAULT 5,
          is_upward_review_enabled BOOLEAN DEFAULT TRUE,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_competencies (
          id VARCHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(50) DEFAULT 'core',
          description TEXT,
          rating_scale VARCHAR(50) DEFAULT '1-5',
          is_core BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_employee_reviews (
          id VARCHAR(36) PRIMARY KEY,
          cycle_id VARCHAR(36) NOT NULL,
          employee_id VARCHAR(36) NOT NULL,
          manager_id VARCHAR(36),
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          status VARCHAR(50) DEFAULT 'pending_self',
          self_rating DECIMAL(3,2),
          manager_rating DECIMAL(3,2),
          peer_rating_avg DECIMAL(3,2),
          calibrated_rating DECIMAL(3,2),
          final_rating DECIMAL(3,2),
          manager_summary TEXT,
          strengths TEXT,
          areas_for_growth TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_review_feedbacks (
          id VARCHAR(36) PRIMARY KEY,
          review_id VARCHAR(36) NOT NULL,
          cycle_id VARCHAR(36) NOT NULL,
          reviewer_id VARCHAR(36) NOT NULL,
          reviewer_type VARCHAR(50) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          overall_rating DECIMAL(3,2),
          general_feedback TEXT,
          strengths TEXT,
          improvements TEXT,
          submitted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_review_competency_scores (
          id VARCHAR(36) PRIMARY KEY,
          feedback_id VARCHAR(36) NOT NULL,
          competency_id VARCHAR(36) NOT NULL,
          score DECIMAL(3,2) NOT NULL,
          comments TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pms_performance_improvement_plans (
          id VARCHAR(36) PRIMARY KEY,
          employee_id VARCHAR(36) NOT NULL,
          manager_id VARCHAR(36),
          review_id VARCHAR(36),
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          reason TEXT NOT NULL,
          action_plan TEXT NOT NULL,
          success_criteria TEXT NOT NULL,
          support_resources TEXT,
          start_date DATE NOT NULL,
          target_end_date DATE NOT NULL,
          check_in_frequency VARCHAR(50) DEFAULT 'bi_weekly',
          status VARCHAR(50) DEFAULT 'active',
          outcome_notes TEXT,
          outcome_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed default competencies if none exist
      const existing = await connection.query(`SELECT COUNT(*) as count FROM pms_competencies`);
      const count = Number(existing[0]?.count || 0);
      if (count === 0) {
        await connection.query(`
          INSERT INTO pms_competencies (id, name, category, description, rating_scale, is_core) VALUES
          ('${randomUUID()}', 'Leadership & Strategic Vision', 'leadership', 'Demonstrates ability to guide teams, inspire performance, and execute organizational strategy.', '1-5', TRUE),
          ('${randomUUID()}', 'Technical & Domain Excellence', 'technical', 'Possesses deep knowledge of tools, domain standards, quality best practices, and execution.', '1-5', TRUE),
          ('${randomUUID()}', 'Communication & Collaboration', 'communication', 'Communicates with clarity, empathy, and active listening across cross-functional teams.', '1-5', TRUE),
          ('${randomUUID()}', 'Problem Solving & Innovation', 'innovation', 'Applies critical thinking to navigate ambiguity, overcome hurdles, and implement creative solutions.', '1-5', TRUE),
          ('${randomUUID()}', 'Customer & Stakeholder Focus', 'core', 'Consistently prioritizes internal and external customer satisfaction and reliability.', '1-5', TRUE),
          ('${randomUUID()}', 'Teamwork & Accountability', 'teamwork', 'Takes full ownership of commitments and actively supports team objectives.', '1-5', TRUE);
        `);
      }
    } catch (err) {
      this.logger.error(`Error ensuring PMS Review tables: ${err.message}`, err.stack);
    }
  }

  // ==================== REVIEW CYCLES ====================

  async getReviewCycles(tenantId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT rc.*, 
        (SELECT COUNT(*) FROM pms_employee_reviews er WHERE er.cycle_id = rc.id) as total_participants,
        (SELECT COUNT(*) FROM pms_employee_reviews er WHERE er.cycle_id = rc.id AND er.status = 'completed') as completed_reviews
      FROM pms_review_cycles rc
      WHERE 1=1
    `;
    const params: any[] = [];
    if (companyId) {
      params.push(companyId);
      query += ` AND (rc.company_id = $${params.length} OR rc.company_id IS NULL)`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND (rc.branch_id = $${params.length} OR rc.branch_id IS NULL)`;
    }
    query += ` ORDER BY rc.created_at DESC`;
    return connection.query(query, params);
  }

  async getReviewCycleById(tenantId: string, cycleId: string) {
    const connection = await this.getConnection(tenantId);
    const result = await connection.query(
      `SELECT rc.*,
        (SELECT COUNT(*) FROM pms_employee_reviews er WHERE er.cycle_id = rc.id) as total_participants,
        (SELECT COUNT(*) FROM pms_employee_reviews er WHERE er.cycle_id = rc.id AND er.status = 'completed') as completed_reviews
      FROM pms_review_cycles rc
      WHERE rc.id = $1`,
      [cycleId]
    );
    if (!result || result.length === 0) {
      throw new NotFoundException(`Review cycle ${cycleId} not found`);
    }
    return result[0];
  }

  async createReviewCycle(tenantId: string, dto: CreateReviewCycleDto, userId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    const cycleId = randomUUID();

    await connection.query(
      `INSERT INTO pms_review_cycles (
        id, company_id, branch_id, title, cycle_type, status,
        start_date, due_date, self_review_due_date, peer_review_due_date,
        manager_review_due_date, description, is_peer_review_enabled,
        min_peers, max_peers, is_upward_review_enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        cycleId,
        companyId || null,
        branchId || null,
        dto.title,
        dto.cycle_type,
        ReviewCycleStatus.ACTIVE,
        dto.start_date,
        dto.due_date,
        dto.self_review_due_date || dto.due_date,
        dto.peer_review_due_date || dto.due_date,
        dto.manager_review_due_date || dto.due_date,
        dto.description || null,
        dto.is_peer_review_enabled ?? true,
        dto.min_peers ?? 2,
        dto.max_peers ?? 5,
        dto.is_upward_review_enabled ?? true,
        userId,
      ]
    );

    // If participants specified, enroll them automatically
    if (dto.participant_ids && dto.participant_ids.length > 0) {
      for (const empId of dto.participant_ids) {
        await this.enrollParticipant(connection, cycleId, empId, companyId, branchId);
      }
    } else {
      // Auto enroll all active employees in scope
      let empQuery = `SELECT id, company_id, branch_id FROM users WHERE is_active = TRUE`;
      const empParams: any[] = [];
      if (companyId) {
        empParams.push(companyId);
        empQuery += ` AND (company_id = $${empParams.length} OR company_id IS NULL)`;
      }
      const employees = await connection.query(empQuery, empParams);
      for (const emp of employees) {
        await this.enrollParticipant(connection, cycleId, emp.id, emp.company_id, emp.branch_id);
      }
    }

    return this.getReviewCycleById(tenantId, cycleId);
  }

  private async enrollParticipant(connection: any, cycleId: string, empId: string, companyId?: string, branchId?: string) {
    const reviewId = randomUUID();
    // Find manager if available
    const managerRes = await connection.query(
      `SELECT manager_id FROM users WHERE id = $1`,
      [empId]
    );
    const managerId = managerRes[0]?.manager_id || null;

    await connection.query(
      `INSERT INTO pms_employee_reviews (
        id, cycle_id, employee_id, manager_id, company_id, branch_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [reviewId, cycleId, empId, managerId, companyId || null, branchId || null, EmployeeReviewStatus.PENDING_SELF]
    );

    // Create self-review feedback slot
    await connection.query(
      `INSERT INTO pms_review_feedbacks (
        id, review_id, cycle_id, reviewer_id, reviewer_type, status
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [randomUUID(), reviewId, cycleId, empId, ReviewerType.SELF, 'pending']
    );

    // Create manager feedback slot if manager exists
    if (managerId) {
      await connection.query(
        `INSERT INTO pms_review_feedbacks (
          id, review_id, cycle_id, reviewer_id, reviewer_type, status
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), reviewId, cycleId, managerId, ReviewerType.MANAGER, 'pending']
      );
    }
  }

  async updateReviewCycle(tenantId: string, cycleId: string, dto: UpdateReviewCycleDto) {
    const connection = await this.getConnection(tenantId);
    await this.getReviewCycleById(tenantId, cycleId);

    const fields: string[] = [];
    const params: any[] = [cycleId];

    if (dto.title) {
      params.push(dto.title);
      fields.push(`title = $${params.length}`);
    }
    if (dto.status) {
      params.push(dto.status);
      fields.push(`status = $${params.length}`);
    }
    if (dto.due_date) {
      params.push(dto.due_date);
      fields.push(`due_date = $${params.length}`);
    }
    if (dto.description !== undefined) {
      params.push(dto.description);
      fields.push(`description = $${params.length}`);
    }

    if (fields.length > 0) {
      await connection.query(
        `UPDATE pms_review_cycles SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        params
      );
    }

    return this.getReviewCycleById(tenantId, cycleId);
  }

  // ==================== EMPLOYEE REVIEWS ====================

  async getEmployeeReviews(tenantId: string, cycleId?: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT er.*,
        u.first_name, u.last_name, u.email, u.department, u.job_title,
        m.first_name as manager_first_name, m.last_name as manager_last_name,
        rc.title as cycle_title, rc.status as cycle_status
      FROM pms_employee_reviews er
      JOIN users u ON u.id = er.employee_id
      LEFT JOIN users m ON m.id = er.manager_id
      JOIN pms_review_cycles rc ON rc.id = er.cycle_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (cycleId) {
      params.push(cycleId);
      query += ` AND er.cycle_id = $${params.length}`;
    }
    if (companyId) {
      params.push(companyId);
      query += ` AND (er.company_id = $${params.length} OR er.company_id IS NULL)`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND (er.branch_id = $${params.length} OR er.branch_id IS NULL)`;
    }
    query += ` ORDER BY er.created_at DESC`;
    return connection.query(query, params);
  }

  async getMyReviews(tenantId: string, userId: string) {
    const connection = await this.getConnection(tenantId);

    // Reviews where I am the employee being evaluated
    const myEvaluations = await connection.query(`
      SELECT er.*,
        rc.title as cycle_title, rc.due_date as cycle_due_date, rc.status as cycle_status,
        m.first_name as manager_first_name, m.last_name as manager_last_name
      FROM pms_employee_reviews er
      JOIN pms_review_cycles rc ON rc.id = er.cycle_id
      LEFT JOIN users m ON m.id = er.manager_id
      WHERE er.employee_id = $1
      ORDER BY er.created_at DESC
    `, [userId]);

    // Feedbacks where I am requested to give review (self, manager, peer, upward)
    const feedbackRequests = await connection.query(`
      SELECT rf.*,
        rc.title as cycle_title, rc.due_date as cycle_due_date,
        u.first_name as subject_first_name, u.last_name as subject_last_name,
        u.job_title as subject_job_title, u.department as subject_department
      FROM pms_review_feedbacks rf
      JOIN pms_employee_reviews er ON er.id = rf.review_id
      JOIN users u ON u.id = er.employee_id
      JOIN pms_review_cycles rc ON rc.id = rf.cycle_id
      WHERE rf.reviewer_id = $1
      ORDER BY rf.created_at DESC
    `, [userId]);

    return {
      evaluations: myEvaluations,
      pending_requests: feedbackRequests.filter((f: any) => f.status === 'pending'),
      completed_requests: feedbackRequests.filter((f: any) => f.status === 'submitted'),
    };
  }

  async getReviewById(tenantId: string, reviewId: string) {
    const connection = await this.getConnection(tenantId);
    const reviewRes = await connection.query(`
      SELECT er.*,
        u.first_name, u.last_name, u.email, u.department, u.job_title,
        m.first_name as manager_first_name, m.last_name as manager_last_name,
        rc.title as cycle_title, rc.due_date as cycle_due_date, rc.status as cycle_status
      FROM pms_employee_reviews er
      JOIN users u ON u.id = er.employee_id
      LEFT JOIN users m ON m.id = er.manager_id
      JOIN pms_review_cycles rc ON rc.id = er.cycle_id
      WHERE er.id = $1
    `, [reviewId]);

    if (!reviewRes || reviewRes.length === 0) {
      throw new NotFoundException(`Review ${reviewId} not found`);
    }

    const review = reviewRes[0];

    // Fetch feedbacks
    const feedbacks = await connection.query(`
      SELECT rf.*,
        u.first_name as reviewer_first_name, u.last_name as reviewer_last_name
      FROM pms_review_feedbacks rf
      JOIN users u ON u.id = rf.reviewer_id
      WHERE rf.review_id = $1
    `, [reviewId]);

    // Fetch competency scores for all submitted feedbacks
    const scores = await connection.query(`
      SELECT rcs.*, c.name as competency_name, c.category as competency_category
      FROM pms_review_competency_scores rcs
      JOIN pms_competencies c ON c.id = rcs.competency_id
      JOIN pms_review_feedbacks rf ON rf.id = rcs.feedback_id
      WHERE rf.review_id = $1
    `, [reviewId]);

    return {
      ...review,
      feedbacks,
      competency_scores: scores,
    };
  }

  async nominatePeers(tenantId: string, reviewId: string, dto: NominatePeersDto, nominatedBy: string) {
    const connection = await this.getConnection(tenantId);
    const review = await this.getReviewById(tenantId, reviewId);

    for (const peerId of dto.peer_ids) {
      // Don't nominate self
      if (peerId === review.employee_id) continue;

      // Check if already nominated
      const existing = await connection.query(
        `SELECT id FROM pms_review_feedbacks WHERE review_id = $1 AND reviewer_id = $2`,
        [reviewId, peerId]
      );
      if (existing.length === 0) {
        await connection.query(
          `INSERT INTO pms_review_feedbacks (
            id, review_id, cycle_id, reviewer_id, reviewer_type, status
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), reviewId, review.cycle_id, peerId, ReviewerType.PEER, 'pending']
        );
      }
    }

    return { success: true, count: dto.peer_ids.length };
  }

  async submitFeedback(tenantId: string, feedbackId: string, dto: SubmitFeedbackDto, reviewerId: string) {
    const connection = await this.getConnection(tenantId);
    const fbRes = await connection.query(
      `SELECT * FROM pms_review_feedbacks WHERE id = $1`,
      [feedbackId]
    );
    if (!fbRes || fbRes.length === 0) {
      throw new NotFoundException(`Feedback request ${feedbackId} not found`);
    }
    const feedback = fbRes[0];

    // Update feedback
    await connection.query(
      `UPDATE pms_review_feedbacks SET
        status = 'submitted',
        overall_rating = $1,
        general_feedback = $2,
        strengths = $3,
        improvements = $4,
        submitted_at = CURRENT_TIMESTAMP
      WHERE id = $5`,
      [dto.overall_rating, dto.general_feedback || null, dto.strengths || null, dto.improvements || null, feedbackId]
    );

    // Save competency scores
    if (dto.competency_scores && dto.competency_scores.length > 0) {
      for (const cs of dto.competency_scores) {
        await connection.query(
          `INSERT INTO pms_review_competency_scores (
            id, feedback_id, competency_id, score, comments
          ) VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), feedbackId, cs.competency_id, cs.score, cs.comments || null]
        );
      }
    }

    // Recalculate employee review averages
    await this.recalculateReviewRatings(connection, feedback.review_id);

    return { success: true, feedback_id: feedbackId };
  }

  private async recalculateReviewRatings(connection: any, reviewId: string) {
    const feedbacks = await connection.query(
      `SELECT reviewer_type, overall_rating FROM pms_review_feedbacks WHERE review_id = $1 AND status = 'submitted'`,
      [reviewId]
    );

    let selfRating: number | null = null;
    let managerRating: number | null = null;
    const peerRatings: number[] = [];

    for (const fb of feedbacks) {
      const rating = Number(fb.overall_rating);
      if (fb.reviewer_type === 'self') {
        selfRating = rating;
      } else if (fb.reviewer_type === 'manager') {
        managerRating = rating;
      } else if (fb.reviewer_type === 'peer' || fb.reviewer_type === 'upward') {
        peerRatings.push(rating);
      }
    }

    const peerAvg = peerRatings.length > 0
      ? Number((peerRatings.reduce((a, b) => a + b, 0) / peerRatings.length).toFixed(2))
      : null;

    // Default final rating calculation: weighted (Manager 50%, Peers 30%, Self 20%)
    let finalRating: number | null = null;
    if (managerRating !== null) {
      const p = peerAvg !== null ? peerAvg : managerRating;
      const s = selfRating !== null ? selfRating : managerRating;
      finalRating = Number((managerRating * 0.5 + p * 0.3 + s * 0.2).toFixed(2));
    }

    await connection.query(
      `UPDATE pms_employee_reviews SET
        self_rating = $1,
        manager_rating = $2,
        peer_rating_avg = $3,
        final_rating = COALESCE(calibrated_rating, $4),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5`,
      [selfRating, managerRating, peerAvg, finalRating, reviewId]
    );
  }

  async calibrateReview(tenantId: string, reviewId: string, dto: CalibrateReviewDto, managerId: string) {
    const connection = await this.getConnection(tenantId);
    await connection.query(
      `UPDATE pms_employee_reviews SET
        calibrated_rating = $1,
        final_rating = $1,
        manager_summary = COALESCE($2, manager_summary),
        strengths = COALESCE($3, strengths),
        areas_for_growth = COALESCE($4, areas_for_growth),
        status = COALESCE($5, 'completed'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6`,
      [
        dto.calibrated_rating,
        dto.manager_summary || null,
        dto.strengths || null,
        dto.areas_for_growth || null,
        dto.status || EmployeeReviewStatus.COMPLETED,
        reviewId,
      ]
    );
    return this.getReviewById(tenantId, reviewId);
  }

  // ==================== COMPETENCIES ====================

  async getCompetencies(tenantId: string) {
    const connection = await this.getConnection(tenantId);
    return connection.query(`SELECT * FROM pms_competencies ORDER BY category, name`);
  }

  // ==================== PERFORMANCE IMPROVEMENT PLANS ====================

  async getPips(tenantId: string, employeeId?: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT pip.*,
        u.first_name, u.last_name, u.email, u.department, u.job_title,
        m.first_name as manager_first_name, m.last_name as manager_last_name
      FROM pms_performance_improvement_plans pip
      JOIN users u ON u.id = pip.employee_id
      LEFT JOIN users m ON m.id = pip.manager_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (employeeId) {
      params.push(employeeId);
      query += ` AND pip.employee_id = $${params.length}`;
    }
    if (companyId) {
      params.push(companyId);
      query += ` AND (pip.company_id = $${params.length} OR pip.company_id IS NULL)`;
    }
    if (branchId) {
      params.push(branchId);
      query += ` AND (pip.branch_id = $${params.length} OR pip.branch_id IS NULL)`;
    }
    query += ` ORDER BY pip.created_at DESC`;
    return connection.query(query, params);
  }

  async createPip(tenantId: string, dto: CreatePipDto, managerId: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);
    const pipId = randomUUID();

    await connection.query(
      `INSERT INTO pms_performance_improvement_plans (
        id, employee_id, manager_id, review_id, company_id, branch_id,
        title, reason, action_plan, success_criteria, support_resources,
        start_date, target_end_date, check_in_frequency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        pipId,
        dto.employee_id,
        managerId,
        dto.review_id || null,
        companyId || null,
        branchId || null,
        dto.title,
        dto.reason,
        dto.action_plan,
        dto.success_criteria,
        dto.support_resources || null,
        dto.start_date,
        dto.target_end_date,
        dto.check_in_frequency || 'bi_weekly',
        PipStatus.ACTIVE,
      ]
    );

    const res = await connection.query(
      `SELECT * FROM pms_performance_improvement_plans WHERE id = $1`,
      [pipId]
    );
    return res[0];
  }

  async updatePip(tenantId: string, pipId: string, dto: UpdatePipDto) {
    const connection = await this.getConnection(tenantId);
    const fields: string[] = [];
    const params: any[] = [pipId];

    if (dto.status) {
      params.push(dto.status);
      fields.push(`status = $${params.length}`);
    }
    if (dto.action_plan) {
      params.push(dto.action_plan);
      fields.push(`action_plan = $${params.length}`);
    }
    if (dto.outcome_notes !== undefined) {
      params.push(dto.outcome_notes);
      fields.push(`outcome_notes = $${params.length}`);
    }
    if (dto.outcome_date) {
      params.push(dto.outcome_date);
      fields.push(`outcome_date = $${params.length}`);
    }

    if (fields.length > 0) {
      await connection.query(
        `UPDATE pms_performance_improvement_plans SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        params
      );
    }

    const res = await connection.query(
      `SELECT * FROM pms_performance_improvement_plans WHERE id = $1`,
      [pipId]
    );
    return res[0];
  }

  // ==================== ANALYTICS & REPORTS ====================

  async getReviewAnalytics(tenantId: string, cycleId?: string, companyId?: string, branchId?: string) {
    const connection = await this.getConnection(tenantId);

    // Counts
    const cyclesRes = await connection.query(`SELECT COUNT(*) as count FROM pms_review_cycles`);
    const totalCycles = Number(cyclesRes[0]?.count || 0);

    let reviewsQuery = `
      SELECT er.status, er.final_rating, u.department
      FROM pms_employee_reviews er
      JOIN users u ON u.id = er.employee_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (cycleId) {
      params.push(cycleId);
      reviewsQuery += ` AND er.cycle_id = $${params.length}`;
    }
    if (companyId) {
      params.push(companyId);
      reviewsQuery += ` AND (er.company_id = $${params.length} OR er.company_id IS NULL)`;
    }

    const allReviews = await connection.query(reviewsQuery, params);

    const totalReviews = allReviews.length;
    const completedReviews = allReviews.filter((r: any) => r.status === 'completed').length;
    const completionRate = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;

    // Distribution (Bell Curve)
    const distribution = {
      '1.0-1.9 (Needs Improvement)': 0,
      '2.0-2.9 (Approaching Expectations)': 0,
      '3.0-3.9 (Meets Expectations)': 0,
      '4.0-4.9 (Exceeds Expectations)': 0,
      '5.0 (Outstanding)': 0,
    };

    let totalScoreSum = 0;
    let scoredCount = 0;

    for (const r of allReviews) {
      if (r.final_rating !== null && r.final_rating !== undefined) {
        const score = Number(r.final_rating);
        totalScoreSum += score;
        scoredCount++;

        if (score < 2.0) distribution['1.0-1.9 (Needs Improvement)']++;
        else if (score < 3.0) distribution['2.0-2.9 (Approaching Expectations)']++;
        else if (score < 4.0) distribution['3.0-3.9 (Meets Expectations)']++;
        else if (score < 5.0) distribution['4.0-4.9 (Exceeds Expectations)']++;
        else distribution['5.0 (Outstanding)']++;
      }
    }

    const avgScore = scoredCount > 0 ? Number((totalScoreSum / scoredCount).toFixed(2)) : 0;

    // Department completion rates
    const deptMap: { [dept: string]: { total: number; completed: number } } = {};
    for (const r of allReviews) {
      const d = r.department || 'General';
      if (!deptMap[d]) deptMap[d] = { total: 0, completed: 0 };
      deptMap[d].total++;
      if (r.status === 'completed') deptMap[d].completed++;
    }

    const departmentStats = Object.keys(deptMap).map(d => ({
      department: d,
      total: deptMap[d].total,
      completed: deptMap[d].completed,
      completion_rate: Math.round((deptMap[d].completed / deptMap[d].total) * 100),
    }));

    // Active PIPs
    const pipsRes = await connection.query(
      `SELECT COUNT(*) as count FROM pms_performance_improvement_plans WHERE status = 'active'`
    );
    const activePips = Number(pipsRes[0]?.count || 0);

    return {
      total_cycles: totalCycles,
      total_reviews: totalReviews,
      completed_reviews: completedReviews,
      completion_rate: completionRate,
      average_rating: avgScore,
      active_pips: activePips,
      rating_distribution: distribution,
      department_stats: departmentStats,
    };
  }
}
