from sqlalchemy import text
from typing import Optional, Dict, Any
from app.database import db_manager

class PMSKPIService:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    async def get_user_kpis(self, user_id: str) -> Dict[str, Any]:
        """Calculate individual KPIs for a user, respecting PMS Settings and Weights"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            # 1. Fetch PMS Settings (with graceful fallback if table doesn't exist)
            settings = None
            try:
                settings_query = """
                    SELECT 
                        kpi_include_completion_rate,
                        kpi_include_on_time_rate,
                        kpi_include_avg_duration,
                        kpi_include_overdue_count,
                        kpi_weight_system,
                        kpi_weight_manual
                    FROM pms_settings
                    LIMIT 1
                """
                settings_res = await session.execute(text(settings_query))
                settings = settings_res.fetchone()
            except Exception as e:
                print(f"[KPI] Warning: Could not fetch settings (table may not exist): {e}")
                settings = None

            # Default settings if not found or table missing
            if not settings:
                kpi_conf = {
                    "include_completion": True,
                    "include_on_time": True,
                    "include_avg_duration": True,
                    "include_overdue": True,
                    "weight_system": 50,
                    "weight_manual": 50
                }
            else:
                kpi_conf = {
                    "include_completion": settings[0],
                    "include_on_time": settings[1],
                    "include_avg_duration": settings[2],
                    "include_overdue": settings[3],
                    "weight_system": settings[4] if settings[4] is not None else 50,
                    "weight_manual": settings[5] if settings[5] is not None else 50
                }

            # 2. Fetch Task Statistics (with graceful fallback if table doesn't exist)
            # For now, SQL is fast enough to just fetch aggregates.
            try:
                query = """
                    SELECT 
                        COUNT(*) as total_assigned,
                        COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'Done' AND completed_at::date <= due_date THEN 1 END) as on_time,
                        AVG(
                            CASE 
                                WHEN status = 'Done' THEN 
                                    CASE 
                                        WHEN actual_hours > 0 THEN actual_hours
                                        WHEN completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600
                                        ELSE 0 
                                    END
                            END
                        ) as avg_duration,
                        COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'Done' THEN 1 END) as overdue_count,
                        SUM(CASE WHEN status NOT IN ('Done', 'Backlog') THEN estimated_hours ELSE 0 END) as current_workload
                    FROM pms_tasks
                    WHERE assignee_id = :user_id AND status != 'Blocked'
                """
                result = await session.execute(text(query), {"user_id": user_id})
                stats = result.fetchone()

            except Exception as e:
                print(f"[KPI] Warning: Could not fetch task stats (table may not exist): {e}")
                return self._get_empty_user_kpis()

            if not stats:
                return self._get_empty_user_kpis()

            total_assigned = stats[0] or 0
            completed = stats[1] or 0
            on_time = stats[2] or 0
            avg_duration = round(stats[3] or 0, 1)
            overdue = stats[4] or 0
            workload = round(stats[5] or 0, 1)

            # 3. Calculate System Metrics based on Settings
            system_score_components = []
            
            completion_rate = 0
            if kpi_conf["include_completion"]:
                completion_rate = (completed / total_assigned * 100) if total_assigned > 0 else 0
                system_score_components.append(completion_rate)
            
            on_time_rate = 0
            if kpi_conf["include_on_time"]:
                on_time_rate = (on_time / completed * 100) if completed > 0 else 0
                system_score_components.append(on_time_rate)

            # Avg duration isn't a 0-100 score usually, so it's hard to include in "System Score" directly 
            # without normalization. For now, we exclude it from the generic "System Score" aggregation 
            # unless a specific logic is defined. 
            # [TODO] Normalize avg_duration? For now, we just return it.

            # Overdue count is negative. 
            # We'll treat system score as average of Rates for simplicity in this MVP.
            
            system_score = 0
            if system_score_components:
                system_score = sum(system_score_components) / len(system_score_components)

            # 4. Fetch Manual Score (Average of latest valid scores)
            # We assume pms_manual_kpi_scores table exists from previous steps
            manual_score = 0
            try:
                manual_score_query = """
                    SELECT AVG(score) as avg_manual_score
                    FROM pms_manual_kpi_scores
                    WHERE user_id = :user_id
                """
                manual_res = await session.execute(text(manual_score_query), {"user_id": user_id})
                manual_stats = manual_res.fetchone()
                manual_score = float(manual_stats[0] or 0)
            except Exception as e:
                # Table might not exist yet if sync is off
                print(f"[PMS-KPI] Warning: Could not fetch manual scores: {e}")
                manual_score = 0

            # 5. Calculate Weighted Final Score
            # weight_system + weight_manual should ideally sum to 100, but we normalize just in case
            total_weight = kpi_conf["weight_system"] + kpi_conf["weight_manual"]
            final_score = 0
            
            if total_weight > 0:
                final_score = (
                    (system_score * kpi_conf["weight_system"]) + 
                    (manual_score * kpi_conf["weight_manual"])
                ) / total_weight

            return {
                "final_score": round(final_score, 1),
                "completion_rate": round(completion_rate, 1),
                "on_time_delivery_rate": round(on_time_rate, 1),
                "average_task_duration_hours": round(avg_duration, 1),
                "overdue_tasks_count": overdue,
                "total_tasks": total_assigned,
                "completed_tasks": completed,
                "system_score": round(system_score, 1),
                "manual_score": round(manual_score, 1),
                "weights": {
                    "system": kpi_conf["weight_system"],
                    "manual": kpi_conf["weight_manual"]
                }
            }

    async def get_project_kpis(self, project_id: str) -> Dict[str, Any]:
        """Calculate KPIs for a project"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            # Project Info & Budget
            project_query = """
                SELECT 
                    start_date, 
                    target_end_date, 
                    budget, 
                    actual_cost,
                    status
                FROM pms_projects
                WHERE id = :project_id
            """
            project_res = await session.execute(text(project_query), {"project_id": project_id})
            project = project_res.fetchone()
            
            if not project:
                return {}

            # Task Stats for Project
            task_query = """
                SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed_tasks,
                    COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked_tasks,
                    SUM(estimated_hours) as total_estimated_hours,
                    SUM(actual_hours) as total_actual_hours
                FROM pms_tasks
                WHERE project_id = :project_id
            """
            task_res = await session.execute(text(task_query), {"project_id": project_id})
            tasks = task_res.fetchone()

            total_tasks = tasks[0] or 0
            completed_tasks = tasks[1] or 0
            blocked_tasks = tasks[2] or 0
            
            progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
            blocked_ratio = (blocked_tasks / total_tasks * 100) if total_tasks > 0 else 0

            # Budget Variance
            budget = float(project[2] or 0)
            actual_cost = float(project[3] or 0)
            budget_variance = 0
            if budget > 0:
                budget_variance = ((budget - actual_cost) / budget) * 100

            return {
                "project_id": project_id,
                "progress_percentage": round(progress, 2),
                "blocked_task_ratio": round(blocked_ratio, 2),
                "budget_variance_percentage": round(budget_variance, 2),
                "overdue_tasks": overdue
            }

    async def get_tenant_kpis(self) -> Dict[str, Any]:
        """Calculate aggregated KPIs for the entire tenant"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            # 1. Fetch PMS Settings
            settings = None
            try:
                settings_query = """
                    SELECT 
                        kpi_include_completion_rate,
                        kpi_include_on_time_rate,
                        kpi_include_avg_duration,
                        kpi_include_overdue_count,
                        kpi_weight_system,
                        kpi_weight_manual
                    FROM pms_settings
                    LIMIT 1
                """
                settings_res = await session.execute(text(settings_query))
                settings = settings_res.fetchone()
            except Exception as e:
                print(f"[KPI] Warning: Could not fetch settings for tenant (using defaults): {e}")

            # Default settings if not found
            if not settings:
                kpi_conf = {
                    "include_completion": True,
                    "include_on_time": True,
                    "include_avg_duration": True,
                    "include_overdue": True,
                    "weight_system": 50,
                    "weight_manual": 50
                }
            else:
                kpi_conf = {
                    "include_completion": settings[0],
                    "include_on_time": settings[1],
                    "include_avg_duration": settings[2],
                    "include_overdue": settings[3],
                    "weight_system": settings[4] if settings[4] is not None else 50,
                    "weight_manual": settings[5] if settings[5] is not None else 50
                }

            # 2. Fetch Aggregated Task Statistics
            try:
                query = """
                    SELECT 
                        COUNT(*) as total_assigned,
                        COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'Done' AND completed_at::date <= due_date THEN 1 END) as on_time,
                        AVG(
                            CASE 
                                WHEN status = 'Done' THEN 
                                    CASE 
                                        WHEN actual_hours > 0 THEN actual_hours
                                        WHEN completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600
                                        ELSE 0 
                                    END
                            END
                        ) as avg_duration,
                        COUNT(CASE WHEN due_date < CURRENT_DATE AND status != 'Done' THEN 1 END) as overdue_count
                    FROM pms_tasks
                    WHERE status != 'Blocked'
                """
                result = await session.execute(text(query))
                stats = result.fetchone()
            except Exception as e:
                print(f"[KPI] Warning: Could not fetch tenant task stats: {e}")
                return self._get_empty_user_kpis()

            if not stats:
                return self._get_empty_user_kpis()

            total_assigned = stats[0] or 0
            completed = stats[1] or 0
            on_time = stats[2] or 0
            avg_duration = float(stats[3] or 0)
            overdue = stats[4] or 0

            # 3. Calculate System Score
            system_score_components = []
            
            completion_rate = 0
            if kpi_conf["include_completion"]:
                completion_rate = (completed / total_assigned * 100) if total_assigned > 0 else 0
                system_score_components.append(completion_rate)

            on_time_rate = 0
            if kpi_conf["include_on_time"]:
                on_time_rate = (on_time / completed * 100) if completed > 0 else 0
                system_score_components.append(on_time_rate)

            avg_system_score = sum(system_score_components) / len(system_score_components) if system_score_components else 0
            
            # 4. Fetch Average Manual Score
            avg_manual_score = 0
            try:
                manual_query = """
                    SELECT AVG(score) as avg_manual_score
                    FROM pms_manual_kpi_scores
                """
                manual_res = await session.execute(text(manual_query))
                manual_row = manual_res.fetchone()
                if manual_row and manual_row[0] is not None:
                    avg_manual_score = float(manual_row[0]) * 10 
            except Exception as e:
                 print(f"[KPI] Warning: Could not fetch tenant manual scores: {e}")

            # 5. Final Weighted Score
            weight_sys = kpi_conf["weight_system"] / 100.0
            weight_man = kpi_conf["weight_manual"] / 100.0
            
            final_score = (avg_system_score * weight_sys) + (avg_manual_score * weight_man)

            return {
                "final_score": round(final_score, 1),
                "completion_rate": round(completion_rate, 1),
                "on_time_delivery_rate": round(on_time_rate, 1),
                "average_task_duration_hours": round(avg_duration, 1),
                "overdue_tasks_count": overdue,
                "total_tasks": total_assigned,
                "completed_tasks": completed,
                "system_score": round(avg_system_score, 1),
                "manual_score": round(avg_manual_score, 1),
                "weights": {
                    "system": kpi_conf["weight_system"],
                    "manual": kpi_conf["weight_manual"]
                }
            }

    async def get_all_users_kpis(self) -> list:
        """Get KPIs for all users in the tenant, sorted by final_score descending"""
        async with await db_manager.get_tenant_session(self.tenant_id) as session:
            # 1. Fetch PMS Settings (Single Query)
            settings = None
            try:
                settings_query = """
                    SELECT 
                        kpi_weight_system,
                        kpi_weight_manual,
                        kpi_include_completion_rate,
                        kpi_include_on_time_rate
                    FROM pms_settings
                    LIMIT 1
                """
                settings_res = await session.execute(text(settings_query))
                settings = settings_res.fetchone()
            except Exception as e:
                print(f"[KPI] Warning: Could not fetch settings: {e}")

            # Safe extraction with explicit None checks (fix for 0 weights)
            weight_system = 50
            weight_manual = 50
            include_completion = True
            include_on_time = True

            if settings:
                weight_system = settings[0] if settings[0] is not None else 50
                weight_manual = settings[1] if settings[1] is not None else 50
                include_completion = settings[2] if settings[2] is not None else True
                include_on_time = settings[3] if settings[3] is not None else True

            # 2. Get all users
            try:
                users_query = """
                    SELECT id, full_name, email, department, position
                    FROM users
                    WHERE is_active = true
                """
                users_res = await session.execute(text(users_query))
                users = users_res.fetchall()
            except Exception as e:
                print(f"[KPI] Error fetching users: {e}")
                return []

            # 3. Get task stats per user in one query
            try:
                stats_query = """
                    SELECT 
                        assignee_id,
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'Done' AND completed_at::date <= due_date THEN 1 END) as on_time
                    FROM pms_tasks
                    WHERE assignee_id IS NOT NULL AND status != 'Blocked'
                    GROUP BY assignee_id
                """
                stats_res = await session.execute(text(stats_query))
                stats_rows = stats_res.fetchall()
                stats_by_user = {str(row[0]): {"total": row[1], "completed": row[2], "on_time": row[3]} for row in stats_rows}
            except Exception as e:
                print(f"[KPI] Error fetching task stats: {e}")
                stats_by_user = {}

            # 4. Get manual scores per user
            try:
                manual_query = """
                    SELECT user_id, AVG(score) as avg_score
                    FROM pms_manual_kpi_scores
                    GROUP BY user_id
                """
                manual_res = await session.execute(text(manual_query))
                manual_rows = manual_res.fetchall()
                manual_by_user = {str(row[0]): float(row[1] or 0) for row in manual_rows}
            except Exception as e:
                print(f"[KPI] Warning: Could not fetch manual scores: {e}")
                manual_by_user = {}

            # 5. Calculate KPIs for each user
            results = []
            for user in users:
                user_id = str(user[0])
                user_stats = stats_by_user.get(user_id, {"total": 0, "completed": 0, "on_time": 0})
                
                total = user_stats["total"]
                completed = user_stats["completed"]
                on_time = user_stats["on_time"]
                
                # Calculate rates
                completion_rate = (completed / total * 100) if total > 0 else 0
                on_time_rate = (on_time / completed * 100) if completed > 0 else 0
                
                # System score: Average of ENABLED components
                system_score_components = []
                if include_completion:
                    system_score_components.append(completion_rate)
                if include_on_time:
                    system_score_components.append(on_time_rate)
                
                system_score = 0
                if system_score_components:
                    system_score = sum(system_score_components) / len(system_score_components)
                
                # Manual score
                manual_score = manual_by_user.get(user_id, 0)
                
                # Final score with weights
                total_weight = weight_system + weight_manual
                final_score = 0
                if total_weight > 0:
                    final_score = ((system_score * weight_system) + (manual_score * weight_manual)) / total_weight
                
                results.append({
                    "user_id": user_id,
                    "full_name": user[1] or "Unknown",
                    "email": user[2],
                    "department": user[3],
                    "position": user[4],
                    "final_score": round(final_score, 1),
                    "completion_rate": round(completion_rate, 1),
                    "on_time_rate": round(on_time_rate, 1),
                    "system_score": round(system_score, 1),
                    "manual_score": round(manual_score, 1),
                    "total_tasks": total,
                    "completed_tasks": completed
                })
            
            # Sort by final_score descending
            results.sort(key=lambda x: x["final_score"], reverse=True)
            return results

    def _get_empty_user_kpis(self):
        return {
            "completion_rate": 0,
            "on_time_delivery_rate": 0,
            "average_task_duration_hours": 0,
            "overdue_tasks_count": 0,
            "current_workload_hours": 0,
            "total_assigned_tasks": 0,
            "completed_tasks": 0
        }
