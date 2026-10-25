import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CreateChecklistTemplateDto,
  CreateChecklistItemDto,
  StartOnboardingDto,
  UpdateOnboardingTaskDto,
  RecordProbationOutcomeDto,
  StartOffboardingDto,
  UpdateOffboardingTaskDto,
  SubmitExitInterviewDto,
  OnboardingFilterDto,
  OnboardingStatus,
  OffboardingStatus,
  TaskStatus,
} from './dto/hrms-onboarding.dto';

@Injectable()
export class HrmsOnboardingService {
  private readonly logger = new Logger(HrmsOnboardingService.name);
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
        -- Onboarding/Offboarding checklist templates
        CREATE TABLE IF NOT EXISTS onboarding_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL DEFAULT 'onboarding',
          department VARCHAR(100),
          employment_type VARCHAR(50),
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Template checklist items
        CREATE TABLE IF NOT EXISTS onboarding_template_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          assignee_role VARCHAR(100),
          due_days_from_start INT DEFAULT 1,
          is_required BOOLEAN DEFAULT TRUE,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Employee onboarding instances
        CREATE TABLE IF NOT EXISTS employee_onboarding (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          template_id UUID,
          status VARCHAR(50) DEFAULT 'not_started',
          start_date DATE,
          target_completion_date DATE,
          completed_date DATE,
          probation_days INT DEFAULT 90,
          probation_end_date DATE,
          probation_outcome VARCHAR(50),
          probation_outcome_notes TEXT,
          probation_extended_until DATE,
          created_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Onboarding task instances per employee
        CREATE TABLE IF NOT EXISTS onboarding_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          onboarding_id UUID NOT NULL,
          template_item_id UUID,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          assignee_role VARCHAR(100),
          due_date DATE,
          is_required BOOLEAN DEFAULT TRUE,
          status VARCHAR(50) DEFAULT 'pending',
          completed_by UUID,
          completed_at TIMESTAMP,
          notes TEXT,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Employee offboarding instances
        CREATE TABLE IF NOT EXISTS employee_offboarding (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          template_id UUID,
          status VARCHAR(50) DEFAULT 'initiated',
          last_working_day DATE,
          reason VARCHAR(255),
          initiated_by UUID,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Offboarding tasks per employee
        CREATE TABLE IF NOT EXISTS offboarding_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          offboarding_id UUID NOT NULL,
          template_item_id UUID,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          category VARCHAR(50) DEFAULT 'general',
          assignee_role VARCHAR(100),
          due_date DATE,
          is_required BOOLEAN DEFAULT TRUE,
          status VARCHAR(50) DEFAULT 'pending',
          completed_by UUID,
          completed_at TIMESTAMP,
          notes TEXT,
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Exit interview responses
        CREATE TABLE IF NOT EXISTS exit_interviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          offboarding_id UUID NOT NULL,
          user_id UUID,
          satisfaction_score SMALLINT,
          reason_for_leaving TEXT,
          feedback TEXT,
          is_anonymous BOOLEAN DEFAULT FALSE,
          submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_emp_onboarding_user ON employee_onboarding(user_id);
        CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_parent ON onboarding_tasks(onboarding_id);
        CREATE INDEX IF NOT EXISTS idx_emp_offboarding_user ON employee_offboarding(user_id);
        CREATE INDEX IF NOT EXISTS idx_offboarding_tasks_parent ON offboarding_tasks(offboarding_id);
      `);

      await this.seedDefaultTemplates(connection);
    } catch (err: any) {
      this.logger.error(`Error ensuring onboarding tables: ${err.message}`);
    }
  }

  private async seedDefaultTemplates(connection: any) {
    try {
      await connection.query(`
        INSERT INTO onboarding_templates (id, name, type, is_default, description)
        VALUES ('00000000-0000-0000-0000-000000000001', 'Standard Onboarding', 'onboarding', TRUE, 'Default onboarding checklist for new hires')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO onboarding_templates (id, name, type, is_default, description)
        VALUES ('00000000-0000-0000-0000-000000000002', 'Standard Offboarding', 'offboarding', TRUE, 'Default offboarding checklist for departing employees')
        ON CONFLICT (id) DO NOTHING;
      `);

      const onboardingItemsCount = await connection.query(
        `SELECT COUNT(*) as count FROM onboarding_template_items WHERE template_id = '00000000-0000-0000-0000-000000000001'`,
      );
      if (parseInt(onboardingItemsCount[0]?.count || '0', 10) === 0) {
        await connection.query(`
          INSERT INTO onboarding_template_items (template_id, title, category, due_days_from_start, is_required, sort_order) VALUES
          ('00000000-0000-0000-0000-000000000001', 'Set up company email account', 'it', 1, TRUE, 1),
          ('00000000-0000-0000-0000-000000000001', 'Provide laptop/equipment', 'it', 1, TRUE, 2),
          ('00000000-0000-0000-0000-000000000001', 'Complete payroll setup (bank details, tax forms)', 'hr', 2, TRUE, 3),
          ('00000000-0000-0000-0000-000000000001', 'Sign employment contract', 'hr', 1, TRUE, 4),
          ('00000000-0000-0000-0000-000000000001', 'Office/facility tour and introductions', 'facilities', 1, FALSE, 5),
          ('00000000-0000-0000-0000-000000000001', 'Team introduction meeting', 'manager', 2, FALSE, 6),
          ('00000000-0000-0000-0000-000000000001', 'Review company policies and handbook', 'hr', 3, TRUE, 7),
          ('00000000-0000-0000-0000-000000000001', '30-day check-in meeting with manager', 'manager', 30, FALSE, 8);
        `);
      }

      const offboardingItemsCount = await connection.query(
        `SELECT COUNT(*) as count FROM onboarding_template_items WHERE template_id = '00000000-0000-0000-0000-000000000002'`,
      );
      if (parseInt(offboardingItemsCount[0]?.count || '0', 10) === 0) {
        await connection.query(`
          INSERT INTO onboarding_template_items (template_id, title, category, due_days_from_start, is_required, sort_order) VALUES
          ('00000000-0000-0000-0000-000000000002', 'Return all company equipment', 'it', -1, TRUE, 1),
          ('00000000-0000-0000-0000-000000000002', 'Revoke system access and accounts', 'it', -1, TRUE, 2),
          ('00000000-0000-0000-0000-000000000002', 'Process final payroll and settlement', 'finance', -1, TRUE, 3),
          ('00000000-0000-0000-0000-000000000002', 'Complete knowledge transfer documentation', 'manager', -5, TRUE, 4),
          ('00000000-0000-0000-0000-000000000002', 'Conduct exit interview', 'hr', -2, FALSE, 5),
          ('00000000-0000-0000-0000-000000000002', 'Return company ID/access card', 'facilities', -1, TRUE, 6),
          ('00000000-0000-0000-0000-000000000002', 'Update org chart and reassign tasks', 'manager', -3, FALSE, 7);
        `);
      }
    } catch (err: any) {
      this.logger.error(`Error seeding default templates: ${err.message}`);
    }
  }

  // ── TEMPLATES ─────────────────────────────────────────────────────────────

  async getTemplates(tenantId: string, type?: string) {
    const connection = await this.getConnection(tenantId);
    let query = `
      SELECT t.*, 
             COUNT(ti.id)::int as item_count
      FROM onboarding_templates t
      LEFT JOIN onboarding_template_items ti ON t.id = ti.template_id
    `;
    const params: any[] = [];
    if (type) {
      query += ` WHERE t.type = $1`;
      params.push(type);
    }
    query += ` GROUP BY t.id ORDER BY t.created_at DESC`;

    return connection.query(query, params);
  }

  async getTemplateById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const templates = await connection.query(
      `SELECT * FROM onboarding_templates WHERE id = $1`,
      [id],
    );
    if (!templates || templates.length === 0) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    const items = await connection.query(
      `SELECT * FROM onboarding_template_items WHERE template_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id],
    );

    return {
      ...templates[0],
      items,
    };
  }

  async createTemplate(tenantId: string, dto: CreateChecklistTemplateDto) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `INSERT INTO onboarding_templates (name, description, type, department, employment_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dto.name,
        dto.description || null,
        dto.type,
        dto.department || null,
        dto.employment_type || null,
      ],
    );
    return rows[0];
  }

  async createTemplateItem(tenantId: string, dto: CreateChecklistItemDto) {
    const connection = await this.getConnection(tenantId);
    // Verify template exists
    const template = await connection.query(
      `SELECT id FROM onboarding_templates WHERE id = $1`,
      [dto.template_id],
    );
    if (!template || template.length === 0) {
      throw new NotFoundException(`Template with ID ${dto.template_id} not found`);
    }

    const rows = await connection.query(
      `INSERT INTO onboarding_template_items (
         template_id, title, description, category, assignee_role, due_days_from_start, is_required, sort_order
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dto.template_id,
        dto.title,
        dto.description || null,
        dto.category,
        dto.assignee_role || null,
        dto.due_days_from_start !== undefined ? dto.due_days_from_start : 1,
        dto.is_required !== undefined ? dto.is_required : true,
        dto.sort_order !== undefined ? dto.sort_order : 0,
      ],
    );
    return rows[0];
  }

  // ── ONBOARDING INSTANCES ──────────────────────────────────────────────────

  async startOnboarding(tenantId: string, dto: StartOnboardingDto, createdBy?: string) {
    const connection = await this.getConnection(tenantId);

    // Verify employee exists
    const userRows = await connection.query(`SELECT id, first_name, last_name FROM users WHERE id = $1`, [
      dto.user_id,
    ]);
    if (!userRows || userRows.length === 0) {
      throw new NotFoundException(`User with ID ${dto.user_id} not found`);
    }

    // Determine template
    let templateId = dto.template_id;
    if (!templateId) {
      const defaultTpl = await connection.query(
        `SELECT id FROM onboarding_templates WHERE type = 'onboarding' AND is_default = TRUE LIMIT 1`,
      );
      if (defaultTpl && defaultTpl.length > 0) {
        templateId = defaultTpl[0].id;
      }
    }

    const startDate = dto.start_date ? new Date(dto.start_date) : new Date();
    const probationDays = dto.probation_days !== undefined ? dto.probation_days : 90;
    const probationEndDate = new Date(startDate.getTime());
    probationEndDate.setDate(probationEndDate.getDate() + probationDays);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedProbationEndDate = probationEndDate.toISOString().split('T')[0];

    const onboardingRows = await connection.query(
      `INSERT INTO employee_onboarding (
         user_id, template_id, status, start_date, probation_days, probation_end_date, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        dto.user_id,
        templateId || null,
        OnboardingStatus.IN_PROGRESS,
        formattedStartDate,
        probationDays,
        formattedProbationEndDate,
        createdBy || null,
      ],
    );

    const onboarding = onboardingRows[0];

    // Copy template items to onboarding tasks
    if (templateId) {
      const templateItems = await connection.query(
        `SELECT * FROM onboarding_template_items WHERE template_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [templateId],
      );

      for (const item of templateItems) {
        const itemDue = new Date(startDate.getTime());
        itemDue.setDate(itemDue.getDate() + (item.due_days_from_start || 0));
        const formattedDueDate = itemDue.toISOString().split('T')[0];

        await connection.query(
          `INSERT INTO onboarding_tasks (
             onboarding_id, template_item_id, title, description, category, assignee_role,
             due_date, is_required, status, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            onboarding.id,
            item.id,
            item.title,
            item.description || null,
            item.category || 'general',
            item.assignee_role || null,
            formattedDueDate,
            item.is_required,
            TaskStatus.PENDING,
            item.sort_order || 0,
          ],
        );
      }
    }

    return this.getOnboardingById(tenantId, onboarding.id);
  }

  async getOnboardings(tenantId: string, filters?: OnboardingFilterDto) {
    const connection = await this.getConnection(tenantId);

    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let idx = 1;

    if (filters?.status) {
      conditions.push(`eo.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters?.user_id) {
      conditions.push(`eo.user_id = $${idx++}`);
      params.push(filters.user_id);
    }
    if (filters?.company_id) {
      conditions.push(`u.company_id = $${idx++}`);
      params.push(filters.company_id);
    }
    if (filters?.branch_id) {
      conditions.push(`u.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }

    const query = `
      SELECT 
        eo.*,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.position,
        t.name as template_name,
        COUNT(tsk.id)::int as total_tasks,
        COUNT(CASE WHEN tsk.status = 'completed' THEN 1 END)::int as completed_tasks,
        CASE 
          WHEN COUNT(tsk.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN tsk.status = 'completed' THEN 1 END)::numeric / COUNT(tsk.id)::numeric) * 100, 1)::float
          ELSE 0.0
        END as completion_percentage
      FROM employee_onboarding eo
      LEFT JOIN users u ON eo.user_id = u.id
      LEFT JOIN onboarding_templates t ON eo.template_id = t.id
      LEFT JOIN onboarding_tasks tsk ON eo.id = tsk.onboarding_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY eo.id, u.first_name, u.last_name, u.email, u.department, u.position, t.name
      ORDER BY eo.created_at DESC
    `;

    return connection.query(query, params);
  }

  async getOnboardingById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `SELECT 
         eo.*,
         u.first_name,
         u.last_name,
         u.email,
         u.department,
         u.position,
         t.name as template_name
       FROM employee_onboarding eo
       LEFT JOIN users u ON eo.user_id = u.id
       LEFT JOIN onboarding_templates t ON eo.template_id = t.id
       WHERE eo.id = $1`,
      [id],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Onboarding record with ID ${id} not found`);
    }

    const onboarding = rows[0];

    const tasks = await connection.query(
      `SELECT * FROM onboarding_tasks WHERE onboarding_id = $1 ORDER BY sort_order ASC, due_date ASC, created_at ASC`,
      [id],
    );

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...onboarding,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_percentage: completionPercentage,
      tasks,
    };
  }

  async updateOnboardingTask(tenantId: string, taskId: string, dto: UpdateOnboardingTaskDto) {
    const connection = await this.getConnection(tenantId);

    const taskRows = await connection.query(`SELECT * FROM onboarding_tasks WHERE id = $1`, [taskId]);
    if (!taskRows || taskRows.length === 0) {
      throw new NotFoundException(`Task with ID ${taskId} not found`);
    }

    const currentTask = taskRows[0];
    const isCompleted = dto.status === TaskStatus.COMPLETED;
    const completedAt = isCompleted ? new Date().toISOString() : null;
    const completedBy = isCompleted ? (dto.completed_by || currentTask.completed_by) : null;

    const updatedRows = await connection.query(
      `UPDATE onboarding_tasks
       SET status = $1,
           notes = COALESCE($2, notes),
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END,
           completed_by = CASE WHEN $1 = 'completed' THEN $3 ELSE NULL END,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [dto.status, dto.notes !== undefined ? dto.notes : null, completedBy, taskId],
    );

    // Auto-update onboarding instance status if all tasks are complete
    const remainingTasks = await connection.query(
      `SELECT COUNT(*)::int as count FROM onboarding_tasks 
       WHERE onboarding_id = $1 AND status NOT IN ('completed', 'skipped')`,
      [currentTask.onboarding_id],
    );

    if (parseInt(remainingTasks[0]?.count || '0', 10) === 0) {
      await connection.query(
        `UPDATE employee_onboarding 
         SET status = 'completed', completed_date = CURRENT_DATE, updated_at = NOW() 
         WHERE id = $1`,
        [currentTask.onboarding_id],
      );
    } else {
      await connection.query(
        `UPDATE employee_onboarding 
         SET status = 'in_progress', updated_at = NOW() 
         WHERE id = $1 AND status = 'not_started'`,
        [currentTask.onboarding_id],
      );
    }

    return updatedRows[0];
  }

  async recordProbationOutcome(tenantId: string, dto: RecordProbationOutcomeDto) {
    const connection = await this.getConnection(tenantId);

    const rows = await connection.query(
      `UPDATE employee_onboarding
       SET probation_outcome = $1,
           probation_outcome_notes = $2,
           probation_extended_until = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        dto.outcome,
        dto.notes || null,
        dto.extended_until || null,
        dto.onboarding_id,
      ],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Onboarding record with ID ${dto.onboarding_id} not found`);
    }

    return rows[0];
  }

  // ── OFFBOARDING INSTANCES ─────────────────────────────────────────────────

  async startOffboarding(tenantId: string, dto: StartOffboardingDto, initiatedBy?: string) {
    const connection = await this.getConnection(tenantId);

    // Verify employee exists
    const userRows = await connection.query(`SELECT id FROM users WHERE id = $1`, [dto.user_id]);
    if (!userRows || userRows.length === 0) {
      throw new NotFoundException(`User with ID ${dto.user_id} not found`);
    }

    // Determine template
    let templateId = dto.template_id;
    if (!templateId) {
      const defaultTpl = await connection.query(
        `SELECT id FROM onboarding_templates WHERE type = 'offboarding' AND is_default = TRUE LIMIT 1`,
      );
      if (defaultTpl && defaultTpl.length > 0) {
        templateId = defaultTpl[0].id;
      }
    }

    const lastWorkingDay = dto.last_working_day ? new Date(dto.last_working_day) : new Date();
    const formattedLastDay = lastWorkingDay.toISOString().split('T')[0];

    const offboardingRows = await connection.query(
      `INSERT INTO employee_offboarding (
         user_id, template_id, status, last_working_day, reason, initiated_by
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.user_id,
        templateId || null,
        OffboardingStatus.IN_PROGRESS,
        formattedLastDay,
        dto.reason || null,
        initiatedBy || null,
      ],
    );

    const offboarding = offboardingRows[0];

    // Copy template items to offboarding tasks
    if (templateId) {
      const templateItems = await connection.query(
        `SELECT * FROM onboarding_template_items WHERE template_id = $1 ORDER BY sort_order ASC, created_at ASC`,
        [templateId],
      );

      for (const item of templateItems) {
        const itemDue = new Date(lastWorkingDay.getTime());
        // For offboarding, due_days_from_start could be negative (e.g., -5 days before last day)
        itemDue.setDate(itemDue.getDate() + (item.due_days_from_start || 0));
        const formattedDueDate = itemDue.toISOString().split('T')[0];

        await connection.query(
          `INSERT INTO offboarding_tasks (
             offboarding_id, template_item_id, title, description, category, assignee_role,
             due_date, is_required, status, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            offboarding.id,
            item.id,
            item.title,
            item.description || null,
            item.category || 'general',
            item.assignee_role || null,
            formattedDueDate,
            item.is_required,
            TaskStatus.PENDING,
            item.sort_order || 0,
          ],
        );
      }
    }

    return this.getOffboardingById(tenantId, offboarding.id);
  }

  async getOffboardings(tenantId: string) {
    const connection = await this.getConnection(tenantId);
    const query = `
      SELECT 
        ef.*,
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.position,
        t.name as template_name,
        COUNT(tsk.id)::int as total_tasks,
        COUNT(CASE WHEN tsk.status = 'completed' THEN 1 END)::int as completed_tasks,
        CASE 
          WHEN COUNT(tsk.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN tsk.status = 'completed' THEN 1 END)::numeric / COUNT(tsk.id)::numeric) * 100, 1)::float
          ELSE 0.0
        END as completion_percentage,
        (SELECT COUNT(*)::int FROM exit_interviews ei WHERE ei.offboarding_id = ef.id) as exit_interview_count
      FROM employee_offboarding ef
      LEFT JOIN users u ON ef.user_id = u.id
      LEFT JOIN onboarding_templates t ON ef.template_id = t.id
      LEFT JOIN offboarding_tasks tsk ON ef.id = tsk.offboarding_id
      GROUP BY ef.id, u.first_name, u.last_name, u.email, u.department, u.position, t.name
      ORDER BY ef.created_at DESC
    `;

    return connection.query(query);
  }

  async getOffboardingById(tenantId: string, id: string) {
    const connection = await this.getConnection(tenantId);
    const rows = await connection.query(
      `SELECT 
         ef.*,
         u.first_name,
         u.last_name,
         u.email,
         u.department,
         u.position,
         t.name as template_name
       FROM employee_offboarding ef
       LEFT JOIN users u ON ef.user_id = u.id
       LEFT JOIN onboarding_templates t ON ef.template_id = t.id
       WHERE ef.id = $1`,
      [id],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Offboarding record with ID ${id} not found`);
    }

    const offboarding = rows[0];

    const tasks = await connection.query(
      `SELECT * FROM offboarding_tasks WHERE offboarding_id = $1 ORDER BY sort_order ASC, due_date ASC, created_at ASC`,
      [id],
    );

    const exitInterviews = await connection.query(
      `SELECT * FROM exit_interviews WHERE offboarding_id = $1 ORDER BY submitted_at DESC`,
      [id],
    );

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'completed').length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      ...offboarding,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      completion_percentage: completionPercentage,
      tasks,
      exit_interview: exitInterviews[0] || null,
    };
  }

  async updateOffboardingTask(tenantId: string, taskId: string, dto: UpdateOffboardingTaskDto) {
    const connection = await this.getConnection(tenantId);

    const taskRows = await connection.query(`SELECT * FROM offboarding_tasks WHERE id = $1`, [taskId]);
    if (!taskRows || taskRows.length === 0) {
      throw new NotFoundException(`Offboarding task with ID ${taskId} not found`);
    }

    const currentTask = taskRows[0];

    const updatedRows = await connection.query(
      `UPDATE offboarding_tasks
       SET status = $1,
           notes = COALESCE($2, notes),
           completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [dto.status, dto.notes !== undefined ? dto.notes : null, taskId],
    );

    // Auto-update offboarding status if all tasks are complete
    const remainingTasks = await connection.query(
      `SELECT COUNT(*)::int as count FROM offboarding_tasks 
       WHERE offboarding_id = $1 AND status NOT IN ('completed', 'skipped')`,
      [currentTask.offboarding_id],
    );

    if (parseInt(remainingTasks[0]?.count || '0', 10) === 0) {
      await connection.query(
        `UPDATE employee_offboarding 
         SET status = 'completed', updated_at = NOW() 
         WHERE id = $1`,
        [currentTask.offboarding_id],
      );
    }

    return updatedRows[0];
  }

  async submitExitInterview(tenantId: string, dto: SubmitExitInterviewDto, userId?: string) {
    const connection = await this.getConnection(tenantId);

    const offboardingRows = await connection.query(
      `SELECT id, user_id FROM employee_offboarding WHERE id = $1`,
      [dto.offboarding_id],
    );
    if (!offboardingRows || offboardingRows.length === 0) {
      throw new NotFoundException(`Offboarding record with ID ${dto.offboarding_id} not found`);
    }

    const effectiveUserId = dto.is_anonymous ? null : (userId || offboardingRows[0].user_id);

    const rows = await connection.query(
      `INSERT INTO exit_interviews (
         offboarding_id, user_id, satisfaction_score, reason_for_leaving, feedback, is_anonymous
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.offboarding_id,
        effectiveUserId,
        dto.satisfaction_score !== undefined ? dto.satisfaction_score : null,
        dto.reason_for_leaving || null,
        dto.feedback || null,
        dto.is_anonymous !== undefined ? dto.is_anonymous : false,
      ],
    );

    return rows[0];
  }

  // ── STATS & KPIs ──────────────────────────────────────────────────────────

  async getOnboardingStats(tenantId: string) {
    const connection = await this.getConnection(tenantId);

    const countsRow = await connection.query(`
      SELECT 
        COUNT(*)::int as total_onboarding,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_onboarding,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END)::int as in_progress_onboarding,
        COUNT(CASE WHEN probation_outcome IS NULL AND probation_end_date IS NOT NULL 
                        AND probation_end_date >= CURRENT_DATE 
                        AND probation_end_date <= (CURRENT_DATE + INTERVAL '30 days') THEN 1 END)::int as upcoming_probation_reviews,
        COALESCE(AVG(CASE WHEN status = 'completed' AND completed_date IS NOT NULL 
                          THEN (completed_date - start_date) END), 0)::float as avg_completion_days
      FROM employee_onboarding
    `);

    const overdueTasksRow = await connection.query(`
      SELECT COUNT(*)::int as overdue_tasks
      FROM onboarding_tasks
      WHERE status NOT IN ('completed', 'skipped')
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
    `);

    const row = countsRow[0] || {};
    const overdueRow = overdueTasksRow[0] || {};

    return {
      total_onboarding: row.total_onboarding || 0,
      completed_onboarding: row.completed_onboarding || 0,
      in_progress_onboarding: row.in_progress_onboarding || 0,
      overdue_tasks: overdueRow.overdue_tasks || 0,
      avg_completion_days: Math.round((row.avg_completion_days || 0) * 10) / 10,
      upcoming_probation_reviews: row.upcoming_probation_reviews || 0,
    };
  }
}
