import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  Users,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { TaskModal, type TaskFormData } from "@/components/pms/TaskModal";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { usePMS, ProjectStatus, ProjectPriority, TaskStatus } from "@/hooks/usePMS";
import { PerformanceOverview } from "@/components/pms/PerformanceOverview";

const getStatusColor = (status: TaskStatus | string) => {
  switch (status) {
    case TaskStatus.DONE:
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case TaskStatus.IN_PROGRESS:
      return "bg-primary/10 text-primary border border-primary/20";
    case TaskStatus.IN_REVIEW:
      return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20";
    case TaskStatus.BLOCKED:
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    case TaskStatus.TODO:
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case TaskStatus.BACKLOG:
      return "bg-surface-2 text-muted-foreground border border-border";
    default:
      return "bg-surface-2 text-muted-foreground border border-border";
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case ProjectPriority.CRITICAL:
      return "bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 font-bold";
    case ProjectPriority.HIGH:
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    case ProjectPriority.MEDIUM:
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    case ProjectPriority.LOW:
      return "bg-surface-2 text-muted-foreground border border-border";
    default:
      return "bg-surface-2 text-muted-foreground border border-border";
  }
};

export default function PMSDashboard() {
  const navigate = useNavigate();
  const {
    useProjects,
    useTasks,
    createTask,
    useUsers,
  } = usePMS();

  const { tenant } = useAuth(); // Changed this line
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  // Fetching all tasks for now (optimize later with recent/limit endpoint)
  const { data: tasks = [], isLoading: loadingTasks } = useTasks({});
  const { data: users = [] } = useUsers();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const stats = [
    {
      title: "Total Projects",
      value: projects.filter(p => p.status !== ProjectStatus.ARCHIVED).length,
      icon: FolderKanban,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Active Tasks",
      value: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.TODO).length,
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      title: "Completed Tasks",
      value: tasks.filter(t => t.status === TaskStatus.DONE).length,
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      // TODO: This should be team members count, for now just users count
      title: "Team Members",
      value: users.length,
      icon: Users,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const projectProgressList = projects
    .filter(p => p.status === ProjectStatus.ACTIVE)
    .slice(0, 4)
    .map(project => {
      // Calculate progress from tasks (if tasks are loaded)
      const projectTasks = tasks.filter(t => t.project_id === project.id);
      const total = projectTasks.length;
      const completed = projectTasks.filter(t => t.status === TaskStatus.DONE).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        id: project.id,
        name: project.name,
        progress,
        tasks: total,
        completed
      };
    });

  const handleSaveTask = async (taskData: TaskFormData) => {
    // Map TaskFormData to CreateTaskDto format
    // TaskFormData likely has camelCase, DTO expects snake_case?
    // Let's check TaskModal later. Assuming it passes compatible object or we map it.
    // If TaskModal follows previous ProjectModal issue, I might need to correct it.

    // For now assuming taskData matches what backend wants or I map it here.
    // DTO: title, description, status, priority, project_id, assignee_id, etc.
    // Form: title, projectId, assigneeId, etc. (likely)

    const dto = {
      title: taskData.title,
      description: taskData.description,
      status: taskData.status,
      priority: taskData.priority,
      project_id: taskData.projectId,
      assignee_id: taskData.assigneeId || undefined,
      due_date: taskData.dueDate || undefined,
      estimated_hours: taskData.estimatedHours ? Number(taskData.estimatedHours) : undefined
    };

    await createTask.mutateAsync(dto);
    setIsTaskModalOpen(false);
  };

  if (loadingProjects || loadingTasks) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // Options for modal
  const projectOptions = projects.map(p => ({ id: p.id, name: p.name }));
  const assigneeOptions = users.map(u => ({ id: u.id, name: u.full_name }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Executive Page Header */}
      <PageHeader
        title="Project Management (PMS)"
        description="Monitor sprint velocity, project milestone progress, team workloads, and active task review queues."
        breadcrumbs={[
          { label: "PMS", href: "/pms/dashboard" },
          { label: "Overview" },
        ]}
        actions={
          <Button
            onClick={() => setIsTaskModalOpen(true)}
            className="gap-2 h-9 px-3.5 text-xs font-bold gold-gradient gold-glow border-none text-slate-950 transition-transform hover:scale-105"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            New Task
          </Button>
        }
      />

      {/* Advanced Performance Overview (Tenant Wide) */}
      {tenant && <PerformanceOverview tenantId={tenant.id} />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <KPITile
            key={idx}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconColor={stat.color}
            iconBg={stat.bg}
          />
        ))}
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Tasks */}
          <Card className="lg:col-span-2">
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Recent Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentTasks.length === 0 && <div className="p-4 text-gray-500 text-center">No tasks found.</div>}
                {recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {task.title}
                        </p>
                        <p className="text-sm text-gray-500">{task.project?.name || 'Unknown Project'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Assigned to: {task.assignee ? task.assignee.full_name : 'Unassigned'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Project Progress */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-lg">Project Progress</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {projectProgressList.map((project) => (
                <div key={project.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {project.completed}/{project.tasks} tasks completed
                  </p>
                </div>
              ))}
              {projectProgressList.length === 0 && <div className="text-gray-500 text-center">No active projects.</div>}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setIsTaskModalOpen(true)}
                className="px-4 py-2 !bg-primary !text-primary-foreground rounded-lg hover:!bg-primary/90 transition-colors flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4" />
                Create Task
              </button>
              <button
                onClick={() => navigate('/pms/projects')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                New Project
              </button>
              <button
                onClick={() => navigate('/pms/team')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Users className="h-4 w-4" />
                View Team
              </button>
            </div>
          </CardContent>
        </Card>
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        task={null}
        projects={projectOptions as any}
        assignees={assigneeOptions as any}
      />
    </div>
  );
}
