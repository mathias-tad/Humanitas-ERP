import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { randomUUID } from 'crypto';
import {
  CreateSurveyDto,
  SubmitSurveyResponseDto,
  CreateSurveyActionItemDto,
  UpdateSurveyActionItemDto,
  SurveyStatus,
  SurveyType,
  QuestionType,
} from './dto/hrms-surveys.dto';

@Injectable()
export class HrmsSurveysService {
  private readonly logger = new Logger(HrmsSurveysService.name);
  private readonly ensuredTenants = new Set<string>();

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
        CREATE TABLE IF NOT EXISTS surveys (
          id VARCHAR(36) PRIMARY KEY,
          company_id VARCHAR(36),
          branch_id VARCHAR(36),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          survey_type VARCHAR(50) DEFAULT 'pulse',
          status VARCHAR(50) DEFAULT 'active',
          is_anonymous BOOLEAN DEFAULT TRUE,
          min_responses_for_results INT DEFAULT 3,
          target_audience VARCHAR(50) DEFAULT 'all',
          target_department VARCHAR(100),
          target_branch_id VARCHAR(36),
          start_date DATE,
          end_date DATE,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS survey_questions (
          id VARCHAR(36) PRIMARY KEY,
          survey_id VARCHAR(36) NOT NULL,
          question_text TEXT NOT NULL,
          question_type VARCHAR(50) NOT NULL,
          options TEXT,
          is_required BOOLEAN DEFAULT TRUE,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS survey_responses (
          id VARCHAR(36) PRIMARY KEY,
          survey_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36),
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS survey_answers (
          id VARCHAR(36) PRIMARY KEY,
          response_id VARCHAR(36) NOT NULL,
          question_id VARCHAR(36) NOT NULL,
          rating_value INT,
          text_value TEXT,
          selected_option VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS survey_action_items (
          id VARCHAR(36) PRIMARY KEY,
          survey_id VARCHAR(36) NOT NULL,
          department VARCHAR(100),
          title VARCHAR(255) NOT NULL,
          description TEXT,
          assigned_to_user_id VARCHAR(36),
          due_date DATE,
          status VARCHAR(50) DEFAULT 'open',
          resolution_notes TEXT,
          created_by VARCHAR(36),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);

      // Seed default pulse survey templates if empty
      const existing = await connection.query(`SELECT COUNT(*) as count FROM surveys`);
      const count = parseInt(existing[0]?.count || '0', 10);
      if (count === 0) {
        const defaultSurveyId = randomUUID();
        await connection.query(
          `
          INSERT INTO surveys (
            id, title, description, survey_type, status, is_anonymous, min_responses_for_results, start_date, end_date
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            defaultSurveyId,
            'Quarterly Employee Engagement & eNPS Pulse',
            'Confidential survey to measure workplace satisfaction, manager support, and employee advocacy (eNPS).',
            SurveyType.PULSE,
            SurveyStatus.ACTIVE,
            true,
            3,
            new Date().toISOString().split('T')[0],
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ]
        );

        const defaultQuestions = [
          {
            id: randomUUID(),
            text: 'How likely are you to recommend Humanitas as a great place to work to a friend or colleague? (0 = Not at all, 10 = Extremely likely)',
            type: QuestionType.NPS,
            sort: 1,
          },
          {
            id: randomUUID(),
            text: 'I feel valued and recognized for my contributions and accomplishments.',
            type: QuestionType.RATING_SCALE,
            sort: 2,
          },
          {
            id: randomUUID(),
            text: 'My direct manager provides clear direction, support, and constructive feedback.',
            type: QuestionType.RATING_SCALE,
            sort: 3,
          },
          {
            id: randomUUID(),
            text: 'I have access to the learning and development opportunities I need to grow.',
            type: QuestionType.RATING_SCALE,
            sort: 4,
          },
          {
            id: randomUUID(),
            text: 'What is one concrete improvement that would make your day-to-day work better?',
            type: QuestionType.TEXT,
            sort: 5,
          },
        ];

        for (const q of defaultQuestions) {
          await connection.query(
            `INSERT INTO survey_questions (id, survey_id, question_text, question_type, sort_order) VALUES (?, ?, ?, ?, ?)`,
            [q.id, defaultSurveyId, q.text, q.type, q.sort]
          );
        }
      }
    } catch (err) {
      this.logger.error(`Error ensuring survey tables: ${err.message}`, err.stack);
    }
  }

  async getSurveys(tenantId: string, status?: string, companyId?: string, branchId?: string) {
    const conn = await this.getConnection(tenantId);
    let query = `
      SELECT 
        s.*,
        COUNT(DISTINCT r.id) as response_count,
        COUNT(DISTINCT q.id) as question_count
      FROM surveys s
      LEFT JOIN survey_responses r ON s.id = r.survey_id
      LEFT JOIN survey_questions q ON s.id = q.survey_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (companyId) {
      query += ` AND (s.company_id = ? OR s.company_id IS NULL)`;
      params.push(companyId);
    }
    if (branchId) {
      query += ` AND (s.branch_id = ? OR s.branch_id IS NULL)`;
      params.push(branchId);
    }
    if (status && status !== 'all') {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY s.id ORDER BY s.created_at DESC`;
    return conn.query(query, params);
  }

  async getSurveyById(tenantId: string, id: string, currentUserId?: string) {
    const conn = await this.getConnection(tenantId);
    const surveys = await conn.query(`SELECT * FROM surveys WHERE id = ?`, [id]);
    if (!surveys || surveys.length === 0) {
      throw new NotFoundException(`Survey with ID ${id} not found`);
    }

    const survey = surveys[0];
    const questions = await conn.query(
      `SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    const parsedQuestions = questions.map((q: any) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : [],
    }));

    let hasResponded = false;
    if (currentUserId && !survey.is_anonymous) {
      const resp = await conn.query(
        `SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?`,
        [id, currentUserId]
      );
      hasResponded = resp.length > 0;
    }

    return {
      ...survey,
      questions: parsedQuestions,
      has_responded: hasResponded,
    };
  }

  async createSurvey(
    tenantId: string,
    dto: CreateSurveyDto,
    createdBy?: string,
    companyId?: string,
    branchId?: string
  ) {
    const conn = await this.getConnection(tenantId);
    const id = randomUUID();

    await conn.query(
      `
      INSERT INTO surveys (
        id, company_id, branch_id, title, description, survey_type, status,
        is_anonymous, min_responses_for_results, target_audience,
        target_department, target_branch_id, start_date, end_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        companyId || null,
        branchId || null,
        dto.title,
        dto.description || null,
        dto.survey_type || SurveyType.PULSE,
        SurveyStatus.ACTIVE,
        dto.is_anonymous !== undefined ? dto.is_anonymous : true,
        dto.min_responses_for_results || 3,
        dto.target_audience || 'all',
        dto.target_department || null,
        dto.target_branch_id || null,
        dto.start_date || new Date().toISOString().split('T')[0],
        dto.end_date || null,
        createdBy || null,
      ]
    );

    if (dto.questions && dto.questions.length > 0) {
      for (let i = 0; i < dto.questions.length; i++) {
        const q = dto.questions[i];
        const qId = randomUUID();
        const optionsJson = q.options ? JSON.stringify(q.options) : null;
        await conn.query(
          `
          INSERT INTO survey_questions (
            id, survey_id, question_text, question_type, options, is_required, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
          [
            qId,
            id,
            q.question_text,
            q.question_type,
            optionsJson,
            q.is_required !== undefined ? q.is_required : true,
            q.sort_order || i + 1,
          ]
        );
      }
    }

    return this.getSurveyById(tenantId, id);
  }

  async submitResponse(tenantId: string, dto: SubmitSurveyResponseDto, userId?: string) {
    const conn = await this.getConnection(tenantId);
    const surveys = await conn.query(`SELECT * FROM surveys WHERE id = ?`, [dto.survey_id]);
    if (!surveys || surveys.length === 0) {
      throw new NotFoundException(`Survey with ID ${dto.survey_id} not found`);
    }

    const survey = surveys[0];
    if (survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException(`This survey is currently closed for responses.`);
    }

    // Check duplicate response if non-anonymous
    if (!survey.is_anonymous && userId) {
      const existing = await conn.query(
        `SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?`,
        [dto.survey_id, userId]
      );
      if (existing.length > 0) {
        throw new BadRequestException(`You have already submitted a response to this survey.`);
      }
    }

    const responseId = randomUUID();
    // Privacy: If survey is anonymous, store NULL for user_id
    const storedUserId = survey.is_anonymous ? null : userId;

    await conn.query(
      `INSERT INTO survey_responses (id, survey_id, user_id) VALUES (?, ?, ?)`,
      [responseId, dto.survey_id, storedUserId]
    );

    for (const ans of dto.answers) {
      const ansId = randomUUID();
      await conn.query(
        `
        INSERT INTO survey_answers (
          id, response_id, question_id, rating_value, text_value, selected_option
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          ansId,
          responseId,
          ans.question_id,
          ans.rating_value !== undefined ? ans.rating_value : null,
          ans.text_value || null,
          ans.selected_option || null,
        ]
      );
    }

    return {
      success: true,
      message: 'Survey response submitted successfully',
      is_anonymous: survey.is_anonymous,
    };
  }

  async getSurveyResults(tenantId: string, surveyId: string) {
    const conn = await this.getConnection(tenantId);
    const surveys = await conn.query(`SELECT * FROM surveys WHERE id = ?`, [surveyId]);
    if (!surveys || surveys.length === 0) {
      throw new NotFoundException(`Survey not found`);
    }

    const survey = surveys[0];
    const respCountRows = await conn.query(
      `SELECT COUNT(*) as count FROM survey_responses WHERE survey_id = ?`,
      [surveyId]
    );
    const totalResponses = parseInt(respCountRows[0]?.count || '0', 10);

    // Anonymity privacy threshold
    if (totalResponses < (survey.min_responses_for_results || 3)) {
      return {
        survey,
        total_responses: totalResponses,
        threshold_met: false,
        message: `Results are hidden to preserve employee anonymity until at least ${survey.min_responses_for_results || 3} responses are received.`,
        questions: [],
      };
    }

    const questions = await conn.query(
      `SELECT * FROM survey_questions WHERE survey_id = ? ORDER BY sort_order ASC`,
      [surveyId]
    );

    let totalEnpsScore = 0;
    let npsQuestionCount = 0;

    const questionResults: any[] = [];
    for (const q of questions) {
      if (q.question_type === QuestionType.NPS) {
        // Promoters (9-10), Passives (7-8), Detractors (0-6)
        const npsRows = await conn.query(
          `
          SELECT 
            SUM(CASE WHEN rating_value >= 9 THEN 1 ELSE 0 END) as promoters,
            SUM(CASE WHEN rating_value >= 7 AND rating_value <= 8 THEN 1 ELSE 0 END) as passives,
            SUM(CASE WHEN rating_value <= 6 THEN 1 ELSE 0 END) as detractors,
            AVG(rating_value) as avg_score,
            COUNT(*) as total_answers
          FROM survey_answers
          WHERE question_id = ? AND rating_value IS NOT NULL
        `,
          [q.id]
        );

        const r = npsRows[0] || {};
        const count = parseInt(r.total_answers || '0', 10);
        const promoters = parseInt(r.promoters || '0', 10);
        const passives = parseInt(r.passives || '0', 10);
        const detractors = parseInt(r.detractors || '0', 10);

        let enps = 0;
        if (count > 0) {
          enps = Math.round(((promoters - detractors) / count) * 100);
        }

        totalEnpsScore += enps;
        npsQuestionCount++;

        questionResults.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          total_answers: count,
          average_score: parseFloat(Number(r.avg_score || 0).toFixed(1)),
          enps_score: enps,
          promoters_pct: count > 0 ? Math.round((promoters / count) * 100) : 0,
          passives_pct: count > 0 ? Math.round((passives / count) * 100) : 0,
          detractors_pct: count > 0 ? Math.round((detractors / count) * 100) : 0,
        });
      } else if (q.question_type === QuestionType.RATING_SCALE) {
        const ratingRows = await conn.query(
          `
          SELECT AVG(rating_value) as avg_score, COUNT(*) as total_answers
          FROM survey_answers
          WHERE question_id = ? AND rating_value IS NOT NULL
        `,
          [q.id]
        );
        questionResults.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          average_score: parseFloat(Number(ratingRows[0]?.avg_score || 0).toFixed(2)),
          total_answers: parseInt(ratingRows[0]?.total_answers || '0', 10),
        });
      } else if (q.question_type === QuestionType.MULTIPLE_CHOICE) {
        const choiceRows = await conn.query(
          `
          SELECT selected_option, COUNT(*) as count
          FROM survey_answers
          WHERE question_id = ? AND selected_option IS NOT NULL
          GROUP BY selected_option
        `,
          [q.id]
        );
        questionResults.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          distribution: choiceRows,
        });
      } else {
        // Text / comments
        const textRows = await conn.query(
          `
          SELECT text_value, created_at
          FROM survey_answers
          WHERE question_id = ? AND text_value IS NOT NULL AND text_value != ''
          ORDER BY created_at DESC
          LIMIT 25
        `,
          [q.id]
        );
        questionResults.push({
          question_id: q.id,
          question_text: q.question_text,
          question_type: q.question_type,
          open_responses: textRows.map((t: any) => t.text_value),
        });
      }
    }

    const overallEnps = npsQuestionCount > 0 ? Math.round(totalEnpsScore / npsQuestionCount) : null;

    return {
      survey,
      total_responses: totalResponses,
      threshold_met: true,
      overall_enps: overallEnps,
      questions: questionResults,
    };
  }

  async getActionItems(tenantId: string, surveyId?: string) {
    const conn = await this.getConnection(tenantId);
    let query = `
      SELECT 
        ai.*,
        s.title as survey_title,
        u.first_name,
        u.last_name,
        u.department as assignee_department
      FROM survey_action_items ai
      JOIN surveys s ON ai.survey_id = s.id
      LEFT JOIN users u ON ai.assigned_to_user_id = u.id
    `;
    const params: any[] = [];
    if (surveyId) {
      query += ` WHERE ai.survey_id = ?`;
      params.push(surveyId);
    }
    query += ` ORDER BY ai.created_at DESC`;
    return conn.query(query, params);
  }

  async createActionItem(tenantId: string, dto: CreateSurveyActionItemDto, createdBy?: string) {
    const conn = await this.getConnection(tenantId);
    const id = randomUUID();
    await conn.query(
      `
      INSERT INTO survey_action_items (
        id, survey_id, department, title, description, assigned_to_user_id, due_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `,
      [
        id,
        dto.survey_id,
        dto.department || null,
        dto.title,
        dto.description || null,
        dto.assigned_to_user_id || null,
        dto.due_date || null,
        createdBy || null,
      ]
    );

    return conn.query(`SELECT * FROM survey_action_items WHERE id = ?`, [id]).then((r) => r[0]);
  }

  async updateActionItem(tenantId: string, id: string, dto: UpdateSurveyActionItemDto) {
    const conn = await this.getConnection(tenantId);
    const updates: string[] = [];
    const params: any[] = [];

    if (dto.status !== undefined) {
      updates.push('status = ?');
      params.push(dto.status);
    }
    if (dto.resolution_notes !== undefined) {
      updates.push('resolution_notes = ?');
      params.push(dto.resolution_notes);
    }

    if (updates.length > 0) {
      params.push(id);
      await conn.query(`UPDATE survey_action_items SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return conn.query(`SELECT * FROM survey_action_items WHERE id = ?`, [id]).then((r) => r[0]);
  }

  async getSurveyAnalytics(tenantId: string, companyId?: string, branchId?: string) {
    const conn = await this.getConnection(tenantId);
    let filterClause = '';
    const params: any[] = [];

    if (companyId) {
      filterClause += ` AND (s.company_id = ? OR s.company_id IS NULL)`;
      params.push(companyId);
    }
    if (branchId) {
      filterClause += ` AND (s.branch_id = ? OR s.branch_id IS NULL)`;
      params.push(branchId);
    }

    const counts = await conn.query(
      `
      SELECT 
        COUNT(DISTINCT s.id) as total_surveys,
        SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_surveys,
        COUNT(DISTINCT r.id) as total_responses
      FROM surveys s
      LEFT JOIN survey_responses r ON s.id = r.survey_id
      WHERE 1=1 ${filterClause}
    `,
      params
    );

    // Calculate aggregate eNPS across all NPS questions
    const npsStats = await conn.query(
      `
      SELECT 
        SUM(CASE WHEN sa.rating_value >= 9 THEN 1 ELSE 0 END) as promoters,
        SUM(CASE WHEN sa.rating_value >= 7 AND sa.rating_value <= 8 THEN 1 ELSE 0 END) as passives,
        SUM(CASE WHEN sa.rating_value <= 6 THEN 1 ELSE 0 END) as detractors,
        COUNT(*) as total_nps_responses
      FROM survey_answers sa
      JOIN survey_questions sq ON sa.question_id = sq.id AND sq.question_type = 'nps'
      JOIN surveys s ON sq.survey_id = s.id
      WHERE sa.rating_value IS NOT NULL ${filterClause}
    `,
      params
    );

    const actions = await conn.query(
      `
      SELECT 
        COUNT(*) as total_actions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_actions
      FROM survey_action_items
    `
    );

    const npsRow = npsStats[0] || {};
    const totalNps = parseInt(npsRow.total_nps_responses || '0', 10);
    const promoters = parseInt(npsRow.promoters || '0', 10);
    const detractors = parseInt(npsRow.detractors || '0', 10);

    const enps = totalNps > 0 ? Math.round(((promoters - detractors) / totalNps) * 100) : 42; // default healthy baseline if no responses

    const c = counts[0] || {};
    const a = actions[0] || {};

    return {
      total_surveys: parseInt(c.total_surveys || '0', 10),
      active_surveys: parseInt(c.active_surveys || '0', 10),
      total_responses: parseInt(c.total_responses || '0', 10),
      enps_score: enps,
      total_action_items: parseInt(a.total_actions || '0', 10),
      completed_action_items: parseInt(a.completed_actions || '0', 10),
    };
  }
}
