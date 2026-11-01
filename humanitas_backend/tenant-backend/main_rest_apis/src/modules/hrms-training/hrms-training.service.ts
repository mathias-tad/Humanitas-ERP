import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateCourseDto,
  UpdateCourseDto,
  CreateSessionDto,
  EnrollLearnerDto,
  UpdateEnrollmentProgressDto,
  UpsertSkillDto,
  DeliveryMethod,
  EnrollmentStatus,
} from './dto/hrms-training.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class HrmsTrainingService {
  private readonly logger = new Logger(HrmsTrainingService.name);
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
        CREATE TABLE IF NOT EXISTS training_courses (
          id VARCHAR(36) PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          prerequisites TEXT,
          delivery_method VARCHAR(50) DEFAULT 'online',
          duration_hours NUMERIC(5, 2) DEFAULT 1.0,
          capacity_limit INT DEFAULT 50,
          is_mandatory BOOLEAN DEFAULT false,
          passing_score INT DEFAULT 80,
          provider_name VARCHAR(255),
          cost_per_learner NUMERIC(10, 2) DEFAULT 0.0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS training_sessions (
          id VARCHAR(36) PRIMARY KEY,
          course_id VARCHAR(36) NOT NULL,
          instructor_name VARCHAR(255),
          venue_or_link VARCHAR(500),
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP NOT NULL,
          max_participants INT DEFAULT 30,
          status VARCHAR(50) DEFAULT 'scheduled',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS training_enrollments (
          id VARCHAR(36) PRIMARY KEY,
          course_id VARCHAR(36) NOT NULL,
          session_id VARCHAR(36),
          user_id VARCHAR(36) NOT NULL,
          enrolled_by VARCHAR(36),
          status VARCHAR(50) DEFAULT 'confirmed',
          completion_percentage INT DEFAULT 0,
          score NUMERIC(5, 2),
          attendance_confirmed BOOLEAN DEFAULT false,
          certificate_issued BOOLEAN DEFAULT false,
          completion_date DATE,
          expiry_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await connection.query(`
        CREATE TABLE IF NOT EXISTS employee_skills (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          skill_name VARCHAR(150) NOT NULL,
          category VARCHAR(100) NOT NULL,
          proficiency_level VARCHAR(50) DEFAULT 'intermediate',
          verified BOOLEAN DEFAULT false,
          verified_by VARCHAR(36),
          verified_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Seed standard default courses if none exist
      const existing = await connection.query(`SELECT COUNT(*) as count FROM training_courses`);
      const count = parseInt(existing[0]?.count || '0', 10);
      if (count === 0) {
        const seedCourses = [
          {
            id: 'tc-001',
            title: 'Workplace Anti-Harassment, DE&I & Ethics',
            category: 'compliance',
            description: 'Essential compliance training covering corporate ethical standards, anti-harassment protections, and whistleblower protocols.',
            prerequisites: 'None',
            delivery_method: 'online',
            duration_hours: 2.0,
            capacity_limit: 1000,
            is_mandatory: true,
            passing_score: 85,
            provider_name: 'Humanitas Academy',
            cost_per_learner: 0.0,
          },
          {
            id: 'tc-002',
            title: 'Information Security & Data Protection (ISO 27001 / GDPR)',
            category: 'compliance',
            description: 'Comprehensive cybersecurity readiness covering phishing prevention, credential security, data classification, and privacy laws.',
            prerequisites: 'None',
            delivery_method: 'online',
            duration_hours: 3.0,
            capacity_limit: 1000,
            is_mandatory: true,
            passing_score: 90,
            provider_name: 'Global CyberSec Institute',
            cost_per_learner: 45.0,
          },
          {
            id: 'tc-003',
            title: 'Executive Leadership & Adaptive Management',
            category: 'leadership',
            description: 'Strategic people management, OKR alignment, 360 review coaching, and high-performance team motivation.',
            prerequisites: 'People Manager designation',
            delivery_method: 'blended',
            duration_hours: 16.0,
            capacity_limit: 25,
            is_mandatory: false,
            passing_score: 80,
            provider_name: 'Executive Coaching Partners',
            cost_per_learner: 450.0,
          },
          {
            id: 'tc-004',
            title: 'Enterprise Microservices & Cloud-Native TypeScript',
            category: 'technical',
            description: 'Deep dive into NestJS, event streaming, multi-tenant isolation, caching strategies, and CI/CD pipelines.',
            prerequisites: 'Software Engineer Level 2+',
            delivery_method: 'online',
            duration_hours: 24.0,
            capacity_limit: 100,
            is_mandatory: false,
            passing_score: 85,
            provider_name: 'Internal Engineering Guild',
            cost_per_learner: 120.0,
          },
          {
            id: 'tc-005',
            title: 'Workplace Health, Safety & Emergency First Aid',
            category: 'safety',
            description: 'Hands-on emergency drills, workplace hazards identification, CPR certification, and fire safety.',
            prerequisites: 'None',
            delivery_method: 'in_person',
            duration_hours: 8.0,
            capacity_limit: 20,
            is_mandatory: true,
            passing_score: 80,
            provider_name: 'Red Cross Certified Trainers',
            cost_per_learner: 85.0,
          },
        ];

        for (const c of seedCourses) {
          await connection.query(
            `INSERT INTO training_courses (id, title, category, description, prerequisites, delivery_method, duration_hours, capacity_limit, is_mandatory, passing_score, provider_name, cost_per_learner, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
            [
              c.id,
              c.title,
              c.category,
              c.description,
              c.prerequisites,
              c.delivery_method,
              c.duration_hours,
              c.capacity_limit,
              c.is_mandatory,
              c.passing_score,
              c.provider_name,
              c.cost_per_learner,
            ],
          );
        }
        this.logger.log(`[HRMS Training] Seeded ${seedCourses.length} default learning courses for tenant.`);
      }
    } catch (err) {
      this.logger.error(`Error ensuring HRMS Training tables: ${err.message}`, err.stack);
    }
  }

  async getCourses(tenantId: string, filters?: { category?: string; delivery_method?: string; is_mandatory?: boolean; is_active?: boolean }) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT c.*,
             COUNT(DISTINCT e.id) as total_enrolled,
             COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as total_completed
      FROM training_courses c
      LEFT JOIN training_enrollments e ON c.id = e.course_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.category) {
      query += ` AND c.category = $${idx++}`;
      params.push(filters.category);
    }
    if (filters?.delivery_method) {
      query += ` AND c.delivery_method = $${idx++}`;
      params.push(filters.delivery_method);
    }
    if (filters?.is_mandatory !== undefined) {
      query += ` AND c.is_mandatory = $${idx++}`;
      params.push(filters.is_mandatory);
    }
    if (filters?.is_active !== undefined) {
      query += ` AND c.is_active = $${idx++}`;
      params.push(filters.is_active);
    }

    query += ` GROUP BY c.id ORDER BY c.title ASC`;
    return connection.query(query, params);
  }

  async getCourseById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(`SELECT * FROM training_courses WHERE id = $1`, [id]);
    if (!rows.length) throw new NotFoundException(`Training course ${id} not found`);

    const sessions = await connection.query(
      `SELECT * FROM training_sessions WHERE course_id = $1 ORDER BY start_time ASC`,
      [id],
    );

    return { ...rows[0], sessions };
  }

  async createCourse(tenantId: string, dto: CreateCourseDto) {
    const connection = await this.getConnection(tenantId);
    const id = randomUUID();
    await connection.query(
      `INSERT INTO training_courses (
        id, title, category, description, prerequisites, delivery_method,
        duration_hours, capacity_limit, is_mandatory, passing_score,
        provider_name, cost_per_learner, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
      [
        id,
        dto.title,
        dto.category,
        dto.description || null,
        dto.prerequisites || null,
        dto.delivery_method || DeliveryMethod.ONLINE,
        dto.duration_hours || 1.0,
        dto.capacity_limit || 50,
        dto.is_mandatory ?? false,
        dto.passing_score ?? 80,
        dto.provider_name || null,
        dto.cost_per_learner || 0.0,
      ],
    );
    return this.getCourseById(tenantId, id);
  }

  async updateCourse(tenantId: string, id: string, dto: UpdateCourseDto) {
    const connection = await this.getConnection(tenantId);
    await this.getCourseById(tenantId, id);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) { fields.push(`title = $${idx++}`); values.push(dto.title); }
    if (dto.category !== undefined) { fields.push(`category = $${idx++}`); values.push(dto.category); }
    if (dto.description !== undefined) { fields.push(`description = $${idx++}`); values.push(dto.description); }
    if (dto.prerequisites !== undefined) { fields.push(`prerequisites = $${idx++}`); values.push(dto.prerequisites); }
    if (dto.delivery_method !== undefined) { fields.push(`delivery_method = $${idx++}`); values.push(dto.delivery_method); }
    if (dto.duration_hours !== undefined) { fields.push(`duration_hours = $${idx++}`); values.push(dto.duration_hours); }
    if (dto.capacity_limit !== undefined) { fields.push(`capacity_limit = $${idx++}`); values.push(dto.capacity_limit); }
    if (dto.is_mandatory !== undefined) { fields.push(`is_mandatory = $${idx++}`); values.push(dto.is_mandatory); }
    if (dto.passing_score !== undefined) { fields.push(`passing_score = $${idx++}`); values.push(dto.passing_score); }
    if (dto.provider_name !== undefined) { fields.push(`provider_name = $${idx++}`); values.push(dto.provider_name); }
    if (dto.cost_per_learner !== undefined) { fields.push(`cost_per_learner = $${idx++}`); values.push(dto.cost_per_learner); }
    if (dto.is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(dto.is_active); }

    if (fields.length > 0) {
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);
      await connection.query(`UPDATE training_courses SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    return this.getCourseById(tenantId, id);
  }

  async getSessions(tenantId: string, courseId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT s.*, c.title as course_title, c.category as course_category,
             COUNT(e.id) as enrolled_count
      FROM training_sessions s
      JOIN training_courses c ON s.course_id = c.id
      LEFT JOIN training_enrollments e ON s.id = e.session_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (courseId) {
      query += ` AND s.course_id = $1`;
      params.push(courseId);
    }
    query += ` GROUP BY s.id, c.title, c.category ORDER BY s.start_time ASC`;
    return connection.query(query, params);
  }

  async createSession(tenantId: string, dto: CreateSessionDto) {
    const connection = await this.getConnection(tenantId);
    await this.getCourseById(tenantId, dto.course_id);

    const id = randomUUID();
    await connection.query(
      `INSERT INTO training_sessions (id, course_id, instructor_name, venue_or_link, start_time, end_time, max_participants, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')`,
      [
        id,
        dto.course_id,
        dto.instructor_name || null,
        dto.venue_or_link || null,
        dto.start_time,
        dto.end_time,
        dto.max_participants || 30,
      ],
    );

    const rows = await connection.query(`SELECT * FROM training_sessions WHERE id = $1`, [id]);
    return rows[0];
  }

  async enrollLearner(tenantId: string, dto: EnrollLearnerDto, enrolledBy: string) {
    const connection = await this.getConnection(tenantId);
    const course = await this.getCourseById(tenantId, dto.course_id);

    const targetUserId = dto.user_id || enrolledBy;

    // Check if already enrolled
    const existing = await connection.query(
      `SELECT * FROM training_enrollments WHERE course_id = $1 AND user_id = $2 AND status NOT IN ('cancelled', 'failed')`,
      [dto.course_id, targetUserId],
    );
    if (existing.length > 0) {
      throw new BadRequestException('Learner is already enrolled in this training course');
    }

    // Determine status (check capacity)
    let status: EnrollmentStatus = EnrollmentStatus.CONFIRMED;
    if (dto.session_id) {
      const sessionRows = await connection.query(
        `SELECT s.max_participants, COUNT(e.id) as enrolled
         FROM training_sessions s
         LEFT JOIN training_enrollments e ON s.id = e.session_id AND e.status = 'confirmed'
         WHERE s.id = $1
         GROUP BY s.id, s.max_participants`,
        [dto.session_id],
      );
      if (sessionRows.length && parseInt(sessionRows[0].enrolled || '0', 10) >= sessionRows[0].max_participants) {
        status = EnrollmentStatus.WAITLISTED;
      }
    }

    const id = randomUUID();
    await connection.query(
      `INSERT INTO training_enrollments (
        id, course_id, session_id, user_id, enrolled_by, status, completion_percentage, attendance_confirmed, certificate_issued
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, false, false)`,
      [id, dto.course_id, dto.session_id || null, targetUserId, enrolledBy, status],
    );

    return this.getEnrollmentById(tenantId, id);
  }

  async getEnrollments(tenantId: string, filters?: { course_id?: string; user_id?: string; status?: string }) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT e.*, c.title as course_title, c.category as course_category,
             c.duration_hours, c.is_mandatory, c.passing_score,
             COALESCE(u.full_name, '') as user_name, u.email as user_email, u.department as user_department,
             s.start_time as session_start_time, s.venue_or_link as session_venue
      FROM training_enrollments e
      JOIN training_courses c ON e.course_id = c.id
      JOIN users u ON e.user_id::text = u.id::text
      LEFT JOIN training_sessions s ON e.session_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.course_id) {
      query += ` AND e.course_id = $${idx++}`;
      params.push(filters.course_id);
    }
    if (filters?.user_id) {
      query += ` AND e.user_id = $${idx++}`;
      params.push(filters.user_id);
    }
    if (filters?.status) {
      query += ` AND e.status = $${idx++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY e.created_at DESC`;
    return connection.query(query, params);
  }

  async getEnrollmentById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `SELECT e.*, c.title as course_title, c.category as course_category,
              c.duration_hours, c.is_mandatory, c.passing_score,
              COALESCE(u.full_name, '') as user_name, u.email as user_email, u.department as user_department
       FROM training_enrollments e
       JOIN training_courses c ON e.course_id = c.id
       JOIN users u ON e.user_id::text = u.id::text
       WHERE e.id = $1`,
      [id],
    );
    if (!rows.length) throw new NotFoundException(`Enrollment ${id} not found`);
    return rows[0];
  }

  async updateEnrollmentProgress(tenantId: string, id: string, dto: UpdateEnrollmentProgressDto) {
    const connection = await this.getConnection(tenantId);
    const enrollment = await this.getEnrollmentById(tenantId, id);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.status !== undefined) { fields.push(`status = $${idx++}`); values.push(dto.status); }
    if (dto.completion_percentage !== undefined) { fields.push(`completion_percentage = $${idx++}`); values.push(dto.completion_percentage); }
    if (dto.score !== undefined) { fields.push(`score = $${idx++}`); values.push(dto.score); }
    if (dto.attendance_confirmed !== undefined) { fields.push(`attendance_confirmed = $${idx++}`); values.push(dto.attendance_confirmed); }
    if (dto.certificate_issued !== undefined) { fields.push(`certificate_issued = $${idx++}`); values.push(dto.certificate_issued); }

    // If marked completed, calculate completion date and 1-year renewal expiry date
    if (dto.status === EnrollmentStatus.COMPLETED || (dto.completion_percentage !== undefined && dto.completion_percentage >= 100)) {
      fields.push(`completion_date = CURRENT_DATE`);
      fields.push(`expiry_date = CURRENT_DATE + INTERVAL '1 year'`);
      if (dto.status === undefined) {
        fields.push(`status = 'completed'`);
      }
    }

    if (fields.length > 0) {
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);
      await connection.query(`UPDATE training_enrollments SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    return this.getEnrollmentById(tenantId, id);
  }

  async getEmployeeSkills(tenantId: string, userId?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT s.*, COALESCE(u.full_name, '') as user_name, u.department as user_department
      FROM employee_skills s
      JOIN users u ON s.user_id::text = u.id::text
      WHERE 1=1
    `;
    const params: any[] = [];
    if (userId) {
      query += ` AND s.user_id = $1`;
      params.push(userId);
    }
    query += ` ORDER BY s.skill_name ASC`;
    return connection.query(query, params);
  }

  async upsertEmployeeSkill(tenantId: string, dto: UpsertSkillDto, verifiedBy?: string) {
    const connection = await this.getConnection(tenantId);
    const userId = dto.user_id || verifiedBy;

    const existing = await connection.query(
      `SELECT id FROM employee_skills WHERE user_id = $1 AND LOWER(skill_name) = LOWER($2)`,
      [userId, dto.skill_name],
    );

    if (existing.length > 0) {
      await connection.query(
        `UPDATE employee_skills
         SET proficiency_level = $1, category = $2, verified = $3,
             verified_by = $4, verified_at = CASE WHEN $3 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [dto.proficiency_level, dto.category, dto.verified ?? false, dto.verified ? verifiedBy : null, existing[0].id],
      );
      const rows = await connection.query(`SELECT * FROM employee_skills WHERE id = $1`, [existing[0].id]);
      return rows[0];
    } else {
      const id = randomUUID();
      await connection.query(
        `INSERT INTO employee_skills (id, user_id, skill_name, category, proficiency_level, verified, verified_by, verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $6 = true THEN CURRENT_TIMESTAMP ELSE NULL END)`,
        [id, userId, dto.skill_name, dto.category, dto.proficiency_level, dto.verified ?? false, dto.verified ? verifiedBy : null],
      );
      const rows = await connection.query(`SELECT * FROM employee_skills WHERE id = $1`, [id]);
      return rows[0];
    }
  }

  async getTrainingStats(tenantId: string) {
    const connection = await this.getConnection(tenantId);

    const courseCounts = await connection.query(`
      SELECT COUNT(*) as total_courses,
             COUNT(CASE WHEN is_mandatory = true THEN 1 END) as mandatory_courses
      FROM training_courses WHERE is_active = true
    `);

    const enrollmentCounts = await connection.query(`
      SELECT COUNT(*) as total_enrollments,
             COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_enrollments,
             COUNT(CASE WHEN status IN ('confirmed', 'nominated') THEN 1 END) as active_enrollments,
             COUNT(CASE WHEN status = 'waitlisted' THEN 1 END) as waitlisted_enrollments,
             AVG(CASE WHEN status = 'completed' THEN score END) as average_score
      FROM training_enrollments
    `);

    const complianceCounts = await connection.query(`
      SELECT COUNT(*) as mandatory_assignments,
             COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as mandatory_completed
      FROM training_enrollments e
      JOIN training_courses c ON e.course_id = c.id
      WHERE c.is_mandatory = true
    `);

    const skillCounts = await connection.query(`
      SELECT COUNT(*) as total_skills,
             COUNT(DISTINCT user_id) as employees_with_skills,
             COUNT(CASE WHEN verified = true THEN 1 END) as verified_skills
      FROM employee_skills
    `);

    const totalCourses = parseInt(courseCounts[0]?.total_courses || '0', 10);
    const mandatoryCourses = parseInt(courseCounts[0]?.mandatory_courses || '0', 10);
    const totalEnrollments = parseInt(enrollmentCounts[0]?.total_enrollments || '0', 10);
    const completedEnrollments = parseInt(enrollmentCounts[0]?.completed_enrollments || '0', 10);
    const activeEnrollments = parseInt(enrollmentCounts[0]?.active_enrollments || '0', 10);
    const waitlistedEnrollments = parseInt(enrollmentCounts[0]?.waitlisted_enrollments || '0', 10);
    const averageScore = parseFloat(enrollmentCounts[0]?.average_score || '0');

    const mandAssigned = parseInt(complianceCounts[0]?.mandatory_assignments || '0', 10);
    const mandCompleted = parseInt(complianceCounts[0]?.mandatory_completed || '0', 10);
    const complianceRate = mandAssigned > 0 ? Math.round((mandCompleted / mandAssigned) * 100) : 100;
    const completionRate = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

    return {
      total_courses: totalCourses,
      mandatory_courses: mandatoryCourses,
      total_enrollments: totalEnrollments,
      completed_enrollments: completedEnrollments,
      active_enrollments: activeEnrollments,
      waitlisted_enrollments: waitlistedEnrollments,
      completion_rate: completionRate,
      compliance_rate: complianceRate,
      average_score: Math.round(averageScore * 10) / 10,
      total_skills_logged: parseInt(skillCounts[0]?.total_skills || '0', 10),
      verified_skills: parseInt(skillCounts[0]?.verified_skills || '0', 10),
      employees_with_skills: parseInt(skillCounts[0]?.employees_with_skills || '0', 10),
    };
  }
}
