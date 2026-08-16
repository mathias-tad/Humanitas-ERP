import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

@Injectable()
export class AiAnalyticsService {
  constructor(private databaseService: DatabaseService) {}

  private async getConnection(tenantSlug: string) {
    const rows = await (this.databaseService as any).masterDataSource.query(
      `SELECT id, database_name FROM tenants WHERE slug = $1`,
      [tenantSlug],
    );
    if (!rows || !rows.length) throw new Error(`Tenant "${tenantSlug}" not found`);
    const ds = await this.databaseService.getTenantConnection(rows[0].database_name);
    return { ds, tenantId: rows[0].id };
  }

  getAnalyticsTools(tenantSlug: string) {
    const getConn = () => this.getConnection(tenantSlug);

    // ─── Task Distribution / Workload Analysis ────────────────────────────────
    const taskDistributionTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const results = await ds.query(`
            SELECT
              u.id AS user_id,
              u.full_name,
              u.position,
              u.department,
              COUNT(t.id)                                                          AS total_tasks,
              COUNT(CASE WHEN t.status IN ('In Progress','To Do','Backlog') THEN 1 END) AS active_tasks,
              COUNT(CASE WHEN t.status = 'Done'                             THEN 1 END) AS completed_tasks,
              COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'Done'     THEN 1 END) AS overdue_tasks,
              COALESCE(ROUND(SUM(CASE WHEN t.status IN ('In Progress','To Do') THEN t.estimated_hours END)::numeric, 1), 0) AS load_hours_in_progress
            FROM users u
            LEFT JOIN pms_tasks t ON t.assignee_id = u.id
            WHERE u.is_active = true
            GROUP BY u.id, u.full_name, u.position, u.department
            ORDER BY active_tasks DESC, overdue_tasks DESC
          `);
          return JSON.stringify(results);
        } catch (err) {
          return `Error: ${err.message}`;
        }
      },
      {
        name: 'analyze_task_distribution',
        description:
          'Analyze workload across all users — shows total, active, completed, and overdue tasks per person. Use for questions like "who has the most tasks?", "workload distribution", "who is busy/available?".',
        schema: z.object({}),
      },
    );

    // ─── User Experience Analysis ─────────────────────────────────────────────
    const userExperienceTool = tool(
      async ({ user_id }) => {
        try {
          const { ds } = await getConn();
          const baseSelect = `
            SELECT
              u.id,
              u.full_name,
              u.position,
              u.department,
              COUNT(t.id)                                                                  AS total_completed_tasks,
              COALESCE(ROUND(AVG(t.actual_hours)::numeric, 2), 0)                        AS avg_actual_hours_per_task,
              COUNT(CASE WHEN t.completed_at <= t.due_date::timestamp THEN 1 END)         AS on_time_completions,
              COUNT(CASE WHEN t.completed_at  > t.due_date::timestamp THEN 1 END)         AS late_completions,
              COUNT(DISTINCT t.project_id)                                                AS projects_worked_on,
              COUNT(CASE WHEN t.priority IN ('High','Critical') THEN 1 END)              AS high_priority_tasks_done,
              STRING_AGG(DISTINCT p.name, ', ')                                           AS project_names
            FROM users u
            LEFT JOIN pms_tasks t   ON t.assignee_id = u.id AND t.status = 'Done'
            LEFT JOIN pms_projects p ON p.id = t.project_id
          `;
          const rows = user_id
            ? await ds.query(`${baseSelect} WHERE u.id = $1 GROUP BY u.id, u.full_name, u.position, u.department`, [user_id])
            : await ds.query(`${baseSelect} WHERE u.is_active = true GROUP BY u.id, u.full_name, u.position, u.department ORDER BY total_completed_tasks DESC`);
          return JSON.stringify(rows);
        } catch (err) {
          return `Error: ${err.message}`;
        }
      },
      {
        name: 'analyze_user_experience',
        description:
          'Evaluate a user\'s experience and performance based on completed task history — on-time rate, high-priority tasks done, projects worked on. Use for questions like "who is most experienced?", "what is John\'s performance track record?".',
        schema: z.object({
          user_id: z.string().optional().describe('UUID of a specific user. Omit to analyse all users.'),
        }),
      },
    );

    // ─── Allocation Suggestions ───────────────────────────────────────────────
    const allocationSuggestionTool = tool(
      async ({ task_description, required_hours, project_id }) => {
        try {
          const { ds } = await getConn();

          const baseQuery = project_id
            ? `
              SELECT u.id, u.full_name, u.position, u.department
              FROM users u
              INNER JOIN pms_project_members pm ON pm.user_id = u.id AND pm.project_id = $1
              WHERE u.is_active = true`
            : `SELECT u.id, u.full_name, u.position, u.department FROM users u WHERE u.is_active = true`;

          const users = project_id ? await ds.query(baseQuery, [project_id]) : await ds.query(baseQuery);

          if (!users.length) return 'No active users found to suggest allocation.';

          const userIds = users.map((u: any) => u.id);

          const workload = await ds.query(`
            SELECT
              t.assignee_id,
              COUNT(CASE WHEN t.status IN ('In Progress','To Do','Backlog') THEN 1 END) AS active_tasks,
              COALESCE(SUM(CASE WHEN t.status IN ('In Progress','To Do')    THEN t.estimated_hours END), 0) AS active_load_hours,
              COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'Done'     THEN 1 END) AS overdue_tasks,
              COUNT(CASE WHEN t.status = 'Done' THEN 1 END)                            AS completed_tasks,
              ROUND(
                CASE WHEN COUNT(CASE WHEN t.status='Done' AND t.due_date IS NOT NULL THEN 1 END) > 0
                  THEN 100.0 * COUNT(CASE WHEN t.status='Done' AND t.completed_at <= t.due_date::timestamp THEN 1 END)
                             / COUNT(CASE WHEN t.status='Done' AND t.due_date IS NOT NULL THEN 1 END)
                  ELSE 0 END::numeric, 1) AS on_time_rate
            FROM pms_tasks t
            WHERE t.assignee_id = ANY($1::uuid[])
            GROUP BY t.assignee_id
          `, [userIds]);

          const workloadMap: Record<string, any> = {};
          workload.forEach((w: any) => { workloadMap[w.assignee_id] = w; });

          const scored = users.map((u: any) => {
            const w = workloadMap[u.id] || { active_tasks: 0, active_load_hours: 0, overdue_tasks: 0, completed_tasks: 0, on_time_rate: 0 };
            const availability = Math.max(0, 100 - (w.active_tasks * 10) - (w.overdue_tasks * 20));
            const performance = Number(w.on_time_rate) || 0;
            const score = (availability * 0.6) + (performance * 0.4);
            return {
              user_id: u.id,
              full_name: u.full_name,
              position: u.position,
              department: u.department,
              active_tasks: Number(w.active_tasks),
              active_load_hours: Number(w.active_load_hours),
              overdue_tasks: Number(w.overdue_tasks),
              completed_tasks: Number(w.completed_tasks),
              on_time_rate_percent: Number(w.on_time_rate),
              recommendation: w.active_tasks === 0 ? '🟢 Highly Available' : w.active_tasks <= 2 ? '🟡 Available' : w.active_tasks <= 5 ? '🟠 Moderately Busy' : '🔴 Very Busy',
              score: Math.round(score),
            };
          }).sort((a: any, b: any) => b.score - a.score);

          return JSON.stringify({
            task_description,
            required_hours,
            top_suggestions: scored.slice(0, 5),
            all_users: scored,
            note: 'Score is based on 60% availability + 40% on-time performance history.',
          });
        } catch (err) {
          return `Error: ${err.message}`;
        }
      },
      {
        name: 'suggest_task_allocation',
        description:
          'Suggest the best user(s) to assign a task to, ranked by current workload + past performance. Use when asked "who should I assign this to?", "who is available?", "best person for this task?".',
        schema: z.object({
          task_description: z.string().describe('Brief description of the task'),
          required_hours: z.number().optional().describe('Estimated hours needed'),
          project_id: z.string().optional().describe('If provided, only suggest users who are members of this project'),
        }),
      },
    );

    // ─── All Users KPI Summary ────────────────────────────────────────────────
    const userKpiTool = tool(
      async () => {
        try {
          const { ds } = await getConn();
          const results = await ds.query(`
            SELECT
              u.full_name,
              u.position,
              u.department,
              COUNT(t.id)                                                                              AS total_tasks,
              COUNT(CASE WHEN t.status = 'Done' THEN 1 END)                                          AS completed,
              COUNT(CASE WHEN t.status IN ('In Progress','To Do','Backlog') THEN 1 END)              AS in_progress,
              COUNT(CASE WHEN t.due_date < NOW() AND t.status != 'Done' THEN 1 END)                 AS overdue,
              ROUND(
                CASE WHEN COUNT(t.id) > 0
                  THEN 100.0 * COUNT(CASE WHEN t.status = 'Done' THEN 1 END) / COUNT(t.id)
                  ELSE 0 END::numeric, 1)                                                            AS completion_rate_percent,
              COALESCE(ROUND(AVG(t.actual_hours)::numeric, 2), 0)                                   AS avg_actual_hours
            FROM users u
            LEFT JOIN pms_tasks t ON t.assignee_id = u.id
            WHERE u.is_active = true
            GROUP BY u.id, u.full_name, u.position, u.department
            ORDER BY completion_rate_percent DESC, completed DESC
          `);
          return JSON.stringify(results);
        } catch (err) {
          return `Error: ${err.message}`;
        }
      },
      {
        name: 'get_all_users_kpi',
        description:
          'Get a KPI performance summary for all active users: completion rate, overdue count, average hours. Use for performance review or ranking questions.',
        schema: z.object({}),
      },
    );

    // ─── Project Analytics ────────────────────────────────────────────────────
    const projectAnalyticsTool = tool(
      async ({ project_id }) => {
        try {
          const { ds } = await getConn();
          const query = project_id
            ? `SELECT p.name AS project, p.status, p.priority, p.start_date, p.target_end_date, p.budget,
                 COUNT(t.id) AS total_tasks,
                 COUNT(CASE WHEN t.status='Done' THEN 1 END) AS done,
                 COUNT(CASE WHEN t.status IN ('In Progress','To Do','Backlog') THEN 1 END) AS open,
                 COUNT(CASE WHEN t.due_date < NOW() AND t.status!='Done' THEN 1 END) AS overdue,
                 ROUND(CASE WHEN COUNT(t.id)>0 THEN 100.0*COUNT(CASE WHEN t.status='Done' THEN 1 END)/COUNT(t.id) ELSE 0 END::numeric,1) AS progress_pct
               FROM pms_projects p LEFT JOIN pms_tasks t ON t.project_id=p.id WHERE p.id=$1 GROUP BY p.id, p.name, p.status, p.priority, p.start_date, p.target_end_date, p.budget`
            : `SELECT p.name AS project, p.status, p.priority, p.start_date, p.target_end_date,
                 COUNT(t.id) AS total_tasks,
                 COUNT(CASE WHEN t.status='Done' THEN 1 END) AS done,
                 COUNT(CASE WHEN t.due_date < NOW() AND t.status!='Done' THEN 1 END) AS overdue,
                 ROUND(CASE WHEN COUNT(t.id)>0 THEN 100.0*COUNT(CASE WHEN t.status='Done' THEN 1 END)/COUNT(t.id) ELSE 0 END::numeric,1) AS progress_pct
               FROM pms_projects p LEFT JOIN pms_tasks t ON t.project_id=p.id GROUP BY p.id, p.name, p.status, p.priority, p.start_date, p.target_end_date ORDER BY p.status, overdue DESC`;
          const rows = project_id ? await ds.query(query, [project_id]) : await ds.query(query);
          return JSON.stringify(rows);
        } catch (err) {
          return `Error: ${err.message}`;
        }
      },
      {
        name: 'analyze_projects',
        description:
          'Get analytics for projects: progress percentage, task counts, overdue items. Omit project_id to get overview of all projects.',
        schema: z.object({
          project_id: z.string().optional().describe('UUID of a specific project, or omit for all projects'),
        }),
      },
    );

    return [taskDistributionTool, userExperienceTool, allocationSuggestionTool, userKpiTool, projectAnalyticsTool];
  }
}
