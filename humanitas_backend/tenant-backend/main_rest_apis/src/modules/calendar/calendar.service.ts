import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateCalendarEventDto, UpdateCalendarEventDto, CalendarEventsQueryDto } from './dto/calendar-event.dto';

export interface CalendarEventResponse {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: string;
  moduleKey: string;
  category: 'common' | 'workforce' | 'projects' | 'commercial' | 'financial';
  eventType: string;
  color: string;
  location?: string;
  sourceId?: string;
  routeUrl?: string;
  status?: string;
  priority?: string;
  isPublic?: boolean;
  createdBy?: string;
  createdByName?: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async ensureCalendarTables(connection: any) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        all_day BOOLEAN DEFAULT false,
        event_type VARCHAR(50) NOT NULL DEFAULT 'custom',
        color VARCHAR(20),
        source_module VARCHAR(50) DEFAULT 'calendar',
        source_id UUID,
        recurrence_rule TEXT,
        location VARCHAR(255),
        is_public BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        company_id UUID,
        branch_id UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id ON calendar_events(company_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_branch_id ON calendar_events(branch_id);
      CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(event_type);
    `);
  }

  async getSources(enabledFeatures: string[] = []) {
    const isModuleOn = (mod: string) => {
      if (!enabledFeatures || enabledFeatures.length === 0 || enabledFeatures.includes('*')) return true;
      return enabledFeatures.includes(mod);
    };

    const hasHrms = isModuleOn('hrms') || isModuleOn('hr') || isModuleOn('attendance') || isModuleOn('leave');
    const hasPms = isModuleOn('pms') || isModuleOn('tasks') || isModuleOn('projects');
    const hasSales = isModuleOn('sales') || isModuleOn('crm');
    const hasPurchasing = isModuleOn('purchasing') || isModuleOn('procurement');
    const hasAccounting = isModuleOn('accounting') || isModuleOn('finance');

    return [
      // Common Platform
      { id: 'custom', label: 'Custom Events', category: 'common', color: '#D4A017', enabled: true, isCommon: true },
      { id: 'company_events', label: 'Company Events', category: 'common', color: '#10B981', enabled: true, isCommon: true },
      { id: 'announcements', label: 'Announcements', category: 'common', color: '#06B6D4', enabled: true, isCommon: true },

      // HR & Workforce
      { id: 'holidays', label: 'Public Holidays', category: 'workforce', color: '#8B5CF6', enabled: hasHrms, isCommon: false },
      { id: 'leave', label: 'Approved Leaves', category: 'workforce', color: '#F59E0B', enabled: hasHrms, isCommon: false },
      { id: 'shift', label: 'Shifts & Rosters', category: 'workforce', color: '#3B82F6', enabled: hasHrms, isCommon: false },
      { id: 'training', label: 'Training Sessions', category: 'workforce', color: '#F97316', enabled: hasHrms, isCommon: false },
      { id: 'interview', label: 'Recruitment Interviews', category: 'workforce', color: '#14B8A6', enabled: hasHrms, isCommon: false },
      { id: 'payroll', label: 'Payroll Cycles', category: 'workforce', color: '#A855F7', enabled: hasHrms, isCommon: false },

      // Projects & Tasks
      { id: 'task', label: 'Task Deadlines', category: 'projects', color: '#6366F1', enabled: hasPms, isCommon: false },
      { id: 'sprint', label: 'Agile Sprints', category: 'projects', color: '#0284C7', enabled: hasPms, isCommon: false },
      { id: 'milestone', label: 'Project Milestones', category: 'projects', color: '#EC4899', enabled: hasPms, isCommon: false },

      // Commercial & ERP
      { id: 'sales', label: 'Sales Orders Due', category: 'commercial', color: '#22C55E', enabled: hasSales, isCommon: false },
      { id: 'purchasing', label: 'PO Expected Delivery', category: 'commercial', color: '#EAB308', enabled: hasPurchasing, isCommon: false },
      { id: 'accounting', label: 'Fiscal & Tax Deadlines', category: 'financial', color: '#EF4444', enabled: hasAccounting, isCommon: false },
    ];
  }

  async getAggregatedEvents(
    tenantId: string,
    userId: string,
    query: CalendarEventsQueryDto,
    companyId?: string,
    branchId?: string,
  ): Promise<CalendarEventResponse[]> {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureCalendarTables(connection);

    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const start = query.start || defaultStart;
    const end = query.end || defaultEnd;
    const startDateOnly = start.split('T')[0];
    const endDateOnly = end.split('T')[0];
    const requestedSources = query.sources && query.sources.length > 0 ? query.sources : null;

    const shouldInclude = (sourceKey: string) => {
      if (!requestedSources) return true;
      return requestedSources.includes(sourceKey);
    };

    const aggregated: CalendarEventResponse[] = [];

    // Helper to check table existence
    const tableExists = async (tableName: string): Promise<boolean> => {
      try {
        const res = await connection.query(`SELECT to_regclass($1) as reg`, [tableName]);
        return res && res.length > 0 && res[0].reg !== null;
      } catch {
        return false;
      }
    };

    // 1. Custom Calendar Events (Common)
    if (shouldInclude('custom')) {
      try {
        let sql = `
          SELECT c.*, u.full_name as created_by_name
          FROM calendar_events c
          LEFT JOIN users u ON c.created_by = u.id
          WHERE c.start_date <= $2
            AND (c.end_date IS NULL OR c.end_date >= $1)
        `;
        const params: any[] = [start, end];

        if (companyId) {
          sql += ` AND (c.company_id IS NULL OR c.company_id = $${params.length + 1})`;
          params.push(companyId);
        }
        if (branchId) {
          sql += ` AND (c.branch_id IS NULL OR c.branch_id = $${params.length + 1})`;
          params.push(branchId);
        }

        const rows = await connection.query(sql, params);
        for (const r of rows) {
          aggregated.push({
            id: r.id,
            title: r.title,
            description: r.description,
            start: r.start_date ? new Date(r.start_date).toISOString() : start,
            end: r.end_date ? new Date(r.end_date).toISOString() : undefined,
            allDay: !!r.all_day,
            source: 'custom',
            moduleKey: 'calendar',
            category: 'common',
            eventType: r.event_type || 'custom',
            color: r.color || '#D4A017',
            location: r.location,
            sourceId: r.id,
            routeUrl: '/calendar',
            isPublic: r.is_public !== false,
            createdBy: r.created_by,
            createdByName: r.created_by_name,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch custom calendar events: ${err.message}`);
      }
    }

    // 2. Company Events (Common)
    if (shouldInclude('company_events') && await tableExists('events')) {
      try {
        const rows = await connection.query(`
          SELECT e.*, u.full_name as created_by_name
          FROM events e
          LEFT JOIN users u ON e.created_by = u.id
          WHERE e.event_date >= $1::date AND e.event_date <= $2::date
          ORDER BY e.event_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.event_date instanceof Date ? r.event_date.toISOString().split('T')[0] : String(r.event_date).split('T')[0];
          const timeStr = r.event_time ? String(r.event_time).substring(0, 8) : null;
          const startIso = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T09:00:00`;

          aggregated.push({
            id: `evt-${r.id}`,
            title: `🎉 ${r.title}`,
            description: r.content,
            start: startIso,
            allDay: !timeStr,
            source: 'company_events',
            moduleKey: 'events',
            category: 'common',
            eventType: 'company_event',
            color: '#10B981',
            location: r.location,
            sourceId: r.id,
            routeUrl: '/events',
            createdByName: r.created_by_name,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch company events: ${err.message}`);
      }
    }

    // 3. Announcements (Common)
    if (shouldInclude('announcements') && await tableExists('announcements')) {
      try {
        const rows = await connection.query(`
          SELECT a.*, u.full_name as created_by_name
          FROM announcements a
          LEFT JOIN users u ON a.created_by = u.id
          WHERE a.created_at >= $1::timestamp AND a.created_at <= $2::timestamp
          ORDER BY a.created_at ASC
        `, [start, end]);

        for (const r of rows) {
          aggregated.push({
            id: `ann-${r.id}`,
            title: `📢 ${r.title}`,
            description: r.content,
            start: r.created_at ? new Date(r.created_at).toISOString() : start,
            allDay: true,
            source: 'announcements',
            moduleKey: 'announcements',
            category: 'common',
            eventType: 'announcement',
            color: '#06B6D4',
            sourceId: r.id,
            routeUrl: '/announcements',
            createdByName: r.created_by_name,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch announcements: ${err.message}`);
      }
    }

    // 4. Public Holidays (Workforce)
    if (shouldInclude('holidays') && await tableExists('holidays')) {
      try {
        const rows = await connection.query(`
          SELECT h.*
          FROM holidays h
          WHERE h.date >= $1::date AND h.date <= $2::date
          ORDER BY h.date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
          aggregated.push({
            id: `hol-${r.id || dateStr}`,
            title: `🏖️ ${r.name}`,
            description: r.type ? `Public Holiday (${r.type})` : 'Official Observed Holiday',
            start: `${dateStr}T00:00:00`,
            allDay: true,
            source: 'holidays',
            moduleKey: 'holidays',
            category: 'workforce',
            eventType: 'holiday',
            color: '#8B5CF6',
            sourceId: r.id,
            routeUrl: '/holidays',
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch holidays: ${err.message}`);
      }
    }

    // 5. Approved Leaves (Workforce)
    if (shouldInclude('leave') && await tableExists('leave_requests')) {
      try {
        const rows = await connection.query(`
          SELECT l.*, u.full_name, u.first_name, u.last_name
          FROM leave_requests l
          JOIN users u ON l.user_id = u.id
          WHERE l.status = 'approved'
            AND l.start_date <= $2::date
            AND l.end_date >= $1::date
          ORDER BY l.start_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const empName = r.full_name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'Employee';
          const startDateStr = r.start_date instanceof Date ? r.start_date.toISOString().split('T')[0] : String(r.start_date).split('T')[0];
          const endDateStr = r.end_date instanceof Date ? r.end_date.toISOString().split('T')[0] : String(r.end_date).split('T')[0];

          aggregated.push({
            id: `leave-${r.id}`,
            title: `🌿 ${empName}: ${r.leave_type || 'Leave'}`,
            description: r.reason ? `Reason: ${r.reason}` : `Approved leave (${r.days_count || 1} days)`,
            start: `${startDateStr}T00:00:00`,
            end: `${endDateStr}T23:59:59`,
            allDay: true,
            source: 'leave',
            moduleKey: 'leave',
            category: 'workforce',
            eventType: 'leave',
            color: '#F59E0B',
            sourceId: r.id,
            routeUrl: '/leave',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch leaves: ${err.message}`);
      }
    }

    // 6. Shift Assignments / Rosters (Workforce)
    if (shouldInclude('shift') && await tableExists('rosters')) {
      try {
        const rows = await connection.query(`
          SELECT r.*, u.full_name, s.name as shift_name, s.start_time, s.end_time, s.color as shift_color
          FROM rosters r
          JOIN users u ON r.user_id = u.id
          LEFT JOIN shifts s ON r.shift_id = s.id
          WHERE r.date >= $1::date AND r.date <= $2::date
          ORDER BY r.date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
          const shiftName = r.shift_name || 'Shift';
          const startTime = r.start_time ? String(r.start_time).substring(0, 8) : '08:00:00';
          const endTime = r.end_time ? String(r.end_time).substring(0, 8) : '17:00:00';

          aggregated.push({
            id: `shift-${r.id}`,
            title: `⏰ ${r.full_name || 'Staff'}: ${shiftName}`,
            description: `Scheduled Shift (${startTime.substring(0,5)} - ${endTime.substring(0,5)})`,
            start: `${dateStr}T${startTime}`,
            end: `${dateStr}T${endTime}`,
            allDay: false,
            source: 'shift',
            moduleKey: 'scheduling',
            category: 'workforce',
            eventType: 'shift',
            color: r.shift_color || '#3B82F6',
            sourceId: r.id,
            routeUrl: '/hr/scheduling',
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch shifts: ${err.message}`);
      }
    }

    // 7. Training Sessions (Workforce)
    if (shouldInclude('training') && await tableExists('training_sessions')) {
      try {
        const rows = await connection.query(`
          SELECT ts.*, tc.title as course_title
          FROM training_sessions ts
          LEFT JOIN training_courses tc ON ts.course_id = tc.id
          WHERE ts.start_time >= $1::timestamp AND ts.start_time <= $2::timestamp
          ORDER BY ts.start_time ASC
        `, [start, end]);

        for (const r of rows) {
          aggregated.push({
            id: `trn-${r.id}`,
            title: `📚 ${r.course_title || 'Training Session'}`,
            description: `Instructor: ${r.instructor_name || 'TBD'} | Venue: ${r.venue_or_link || 'Online'}`,
            start: new Date(r.start_time).toISOString(),
            end: r.end_time ? new Date(r.end_time).toISOString() : undefined,
            allDay: false,
            source: 'training',
            moduleKey: 'training',
            category: 'workforce',
            eventType: 'training',
            color: '#F97316',
            location: r.venue_or_link,
            sourceId: r.id,
            routeUrl: '/hrms/training',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch training sessions: ${err.message}`);
      }
    }

    // 8. Recruitment Interviews (Workforce)
    if (shouldInclude('interview') && await tableExists('recruitment_interviews')) {
      try {
        const rows = await connection.query(`
          SELECT ri.*
          FROM recruitment_interviews ri
          WHERE ri.scheduled_at >= $1::timestamp AND ri.scheduled_at <= $2::timestamp
          ORDER BY ri.scheduled_at ASC
        `, [start, end]);

        for (const r of rows) {
          const startIso = new Date(r.scheduled_at).toISOString();
          const dur = r.duration_minutes || 45;
          const endD = new Date(new Date(r.scheduled_at).getTime() + dur * 60000);

          aggregated.push({
            id: `int-${r.id}`,
            title: `🎯 Interview: ${r.candidate_name}`,
            description: `Type: ${r.interview_type || 'General'} | Interviewer: ${r.interviewer_name || 'Team'}`,
            start: startIso,
            end: endD.toISOString(),
            allDay: false,
            source: 'interview',
            moduleKey: 'recruitment',
            category: 'workforce',
            eventType: 'interview',
            color: '#14B8A6',
            location: r.meeting_link,
            sourceId: r.id,
            routeUrl: '/recruitment',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch interviews: ${err.message}`);
      }
    }

    // 9. Payroll Runs (Workforce)
    if (shouldInclude('payroll') && await tableExists('payroll_runs')) {
      try {
        const rows = await connection.query(`
          SELECT pr.*
          FROM payroll_runs pr
          WHERE pr.payout_date >= $1::date AND pr.payout_date <= $2::date
          ORDER BY pr.payout_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.payout_date instanceof Date ? r.payout_date.toISOString().split('T')[0] : String(r.payout_date).split('T')[0];
          aggregated.push({
            id: `pay-${r.id}`,
            title: `💳 Payroll Payout: ${r.title || 'Disbursement'}`,
            description: `Status: ${r.status || 'Scheduled'} | Cycle: ${r.cycle_type || 'Monthly'}`,
            start: `${dateStr}T09:00:00`,
            allDay: true,
            source: 'payroll',
            moduleKey: 'payroll',
            category: 'workforce',
            eventType: 'payroll',
            color: '#A855F7',
            sourceId: r.id,
            routeUrl: '/payroll',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch payroll runs: ${err.message}`);
      }
    }

    // 10. PMS Tasks (Projects)
    if (shouldInclude('task') && await tableExists('pms_tasks')) {
      try {
        const rows = await connection.query(`
          SELECT t.*, u.full_name as assignee_name, p.title as project_title
          FROM pms_tasks t
          LEFT JOIN users u ON t.assignee_id = u.id
          LEFT JOIN pms_projects p ON t.project_id = p.id
          WHERE t.due_date IS NOT NULL
            AND t.due_date >= $1::date
            AND t.due_date <= $2::date
          ORDER BY t.due_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dueDateStr = r.due_date instanceof Date ? r.due_date.toISOString().split('T')[0] : String(r.due_date).split('T')[0];
          aggregated.push({
            id: `task-${r.id}`,
            title: `✅ ${r.title}`,
            description: `Project: ${r.project_title || 'General'} | Status: ${r.status || 'Open'}${r.assignee_name ? ` | Assigned: ${r.assignee_name}` : ''}`,
            start: `${dueDateStr}T17:00:00`,
            allDay: true,
            source: 'task',
            moduleKey: 'pms',
            category: 'projects',
            eventType: 'task',
            color: '#6366F1',
            sourceId: r.id,
            routeUrl: '/pms/calendar',
            status: r.status,
            priority: r.priority,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch PMS tasks: ${err.message}`);
      }
    }

    // 11. Agile Sprints (Projects)
    if (shouldInclude('sprint') && await tableExists('pms_sprints')) {
      try {
        const rows = await connection.query(`
          SELECT s.*, p.title as project_title
          FROM pms_sprints s
          LEFT JOIN pms_projects p ON s.project_id = p.id
          WHERE s.start_date <= $2::date AND s.end_date >= $1::date
          ORDER BY s.start_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const startStr = r.start_date instanceof Date ? r.start_date.toISOString().split('T')[0] : String(r.start_date).split('T')[0];
          const endStr = r.end_date instanceof Date ? r.end_date.toISOString().split('T')[0] : String(r.end_date).split('T')[0];

          aggregated.push({
            id: `sp-${r.id}`,
            title: `🚀 Sprint: ${r.name}`,
            description: `Project: ${r.project_title || 'Team'} | Goal: ${r.goal || 'Sprint Objectives'}`,
            start: `${startStr}T09:00:00`,
            end: `${endStr}T18:00:00`,
            allDay: true,
            source: 'sprint',
            moduleKey: 'pms',
            category: 'projects',
            eventType: 'sprint',
            color: '#0284C7',
            sourceId: r.id,
            routeUrl: '/pms/sprints',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch sprints: ${err.message}`);
      }
    }

    // 12. Project Milestones (Projects)
    if (shouldInclude('milestone') && await tableExists('project_milestones')) {
      try {
        const rows = await connection.query(`
          SELECT m.*, p.title as project_title
          FROM project_milestones m
          LEFT JOIN pms_projects p ON m.project_id = p.id
          WHERE m.due_date >= $1::date AND m.due_date <= $2::date
          ORDER BY m.due_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.due_date instanceof Date ? r.due_date.toISOString().split('T')[0] : String(r.due_date).split('T')[0];
          aggregated.push({
            id: `mls-${r.id}`,
            title: `🏁 ${r.name || r.title}`,
            description: r.project_title ? `Project: ${r.project_title}` : 'Milestone Deliverable',
            start: `${dateStr}T17:00:00`,
            allDay: true,
            source: 'milestone',
            moduleKey: 'pms',
            category: 'projects',
            eventType: 'milestone',
            color: '#EC4899',
            sourceId: r.id,
            routeUrl: '/pms/projects',
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch milestones: ${err.message}`);
      }
    }

    // 13. Sales Orders Due (Commercial)
    if (shouldInclude('sales') && await tableExists('sales_orders')) {
      try {
        const rows = await connection.query(`
          SELECT so.*
          FROM sales_orders so
          WHERE so.delivery_date >= $1::date AND so.delivery_date <= $2::date
          ORDER BY so.delivery_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.delivery_date instanceof Date ? r.delivery_date.toISOString().split('T')[0] : String(r.delivery_date).split('T')[0];
          aggregated.push({
            id: `so-${r.id}`,
            title: `📦 Order #${r.order_number || r.id.substring(0,8)} Delivery`,
            description: `Customer: ${r.customer_name || 'Client'} | Total: ${r.total_amount ? `$${r.total_amount}` : '--'}`,
            start: `${dateStr}T10:00:00`,
            allDay: true,
            source: 'sales',
            moduleKey: 'sales',
            category: 'commercial',
            eventType: 'sales',
            color: '#22C55E',
            sourceId: r.id,
            routeUrl: '/sales/orders',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch sales orders: ${err.message}`);
      }
    }

    // 14. Purchase Orders Expected Delivery (Commercial)
    if (shouldInclude('purchasing') && await tableExists('purchase_orders')) {
      try {
        const rows = await connection.query(`
          SELECT po.*
          FROM purchase_orders po
          WHERE po.expected_delivery_date >= $1::date AND po.expected_delivery_date <= $2::date
          ORDER BY po.expected_delivery_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.expected_delivery_date instanceof Date ? r.expected_delivery_date.toISOString().split('T')[0] : String(r.expected_delivery_date).split('T')[0];
          aggregated.push({
            id: `po-${r.id}`,
            title: `🛒 PO #${r.po_number || r.id.substring(0,8)} Delivery`,
            description: `Vendor: ${r.vendor_name || 'Supplier'} | Status: ${r.status || 'Pending'}`,
            start: `${dateStr}T11:00:00`,
            allDay: true,
            source: 'purchasing',
            moduleKey: 'purchasing',
            category: 'commercial',
            eventType: 'purchasing',
            color: '#EAB308',
            sourceId: r.id,
            routeUrl: '/purchasing/orders',
            status: r.status,
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch purchase orders: ${err.message}`);
      }
    }

    // 15. Fiscal & Tax Deadlines (Financial)
    if (shouldInclude('accounting') && await tableExists('accounting_fiscal_periods')) {
      try {
        const rows = await connection.query(`
          SELECT fp.*
          FROM accounting_fiscal_periods fp
          WHERE fp.end_date >= $1::date AND fp.end_date <= $2::date
          ORDER BY fp.end_date ASC
        `, [startDateOnly, endDateOnly]);

        for (const r of rows) {
          const dateStr = r.end_date instanceof Date ? r.end_date.toISOString().split('T')[0] : String(r.end_date).split('T')[0];
          aggregated.push({
            id: `fp-${r.id}`,
            title: `📊 Fiscal Closing: ${r.period_name || 'Period Close'}`,
            description: `Fiscal year period deadline & tax reconciliation`,
            start: `${dateStr}T23:59:59`,
            allDay: true,
            source: 'accounting',
            moduleKey: 'accounting',
            category: 'financial',
            eventType: 'accounting',
            color: '#EF4444',
            sourceId: r.id,
            routeUrl: '/accounting',
          });
        }
      } catch (err) {
        this.logger.debug(`Failed to fetch fiscal periods: ${err.message}`);
      }
    }

    return aggregated;
  }

  async findOne(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureCalendarTables(connection);

    const rows = await connection.query(`
      SELECT c.*, u.full_name as created_by_name
      FROM calendar_events c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = $1
    `, [id]);

    if (!rows.length) throw new NotFoundException('Calendar event not found');
    return rows[0];
  }

  async create(tenantId: string, userId: string, dto: CreateCalendarEventDto, defaultCompanyId?: string, defaultBranchId?: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureCalendarTables(connection);

    const companyId = dto.company_id || defaultCompanyId || null;
    const branchId = dto.branch_id || defaultBranchId || null;

    const result = await connection.query(`
      INSERT INTO calendar_events (
        title, description, start_date, end_date, all_day,
        event_type, color, location, recurrence_rule, is_public,
        created_by, company_id, branch_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      dto.title,
      dto.description || null,
      dto.start_date,
      dto.end_date || null,
      dto.all_day ?? false,
      dto.event_type || 'custom',
      dto.color || '#D4A017',
      dto.location || null,
      dto.recurrence_rule || null,
      dto.is_public ?? true,
      userId,
      companyId,
      branchId,
    ]);

    return result[0];
  }

  async update(tenantId: string, id: string, userId: string, dto: UpdateCalendarEventDto) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureCalendarTables(connection);

    const existing = await this.findOne(tenantId, id);
    if (!existing) throw new NotFoundException('Calendar event not found');

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.title !== undefined) { fields.push(`title = $${idx++}`); values.push(dto.title); }
    if (dto.description !== undefined) { fields.push(`description = $${idx++}`); values.push(dto.description); }
    if (dto.start_date !== undefined) { fields.push(`start_date = $${idx++}`); values.push(dto.start_date); }
    if (dto.end_date !== undefined) { fields.push(`end_date = $${idx++}`); values.push(dto.end_date); }
    if (dto.all_day !== undefined) { fields.push(`all_day = $${idx++}`); values.push(dto.all_day); }
    if (dto.event_type !== undefined) { fields.push(`event_type = $${idx++}`); values.push(dto.event_type); }
    if (dto.color !== undefined) { fields.push(`color = $${idx++}`); values.push(dto.color); }
    if (dto.location !== undefined) { fields.push(`location = $${idx++}`); values.push(dto.location); }
    if (dto.recurrence_rule !== undefined) { fields.push(`recurrence_rule = $${idx++}`); values.push(dto.recurrence_rule); }
    if (dto.is_public !== undefined) { fields.push(`is_public = $${idx++}`); values.push(dto.is_public); }

    fields.push(`updated_at = NOW()`);

    values.push(id);
    const result = await connection.query(`
      UPDATE calendar_events
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, values);

    return result[0];
  }

  async delete(tenantId: string, id: string) {
    const connection = await this.databaseService.getTenantConnectionById(tenantId);
    await this.ensureCalendarTables(connection);

    const result = await connection.query(`
      DELETE FROM calendar_events
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (!result.length) throw new NotFoundException('Calendar event not found');
    return { success: true, id };
  }
}
