import {
  Search,
  Filter,
  Download,
  Plus,
  Loader2,
  RefreshCcw,
  Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/config/api.config";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TaskModal, type TaskFormData } from "@/components/pms/TaskModal";
import { DeleteModal } from "@/components/pms/DeleteModal";
import { TaskListView } from "@/components/pms/TaskListView";
import { useAuth } from "@/context/AuthContext";
import { usePMS, type Task, TaskStatus } from "@/hooks/usePMS";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function PMSAllTasks() {
  const {
    useTasks,
    useProjects,
    useUsers,
    createTask,
    updateTask,
    deleteTask
  } = usePMS();

  const { permissions, user } = useAuth();
  const { data: tasks = [], isLoading, refetch } = useTasks({});
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [isLive, setIsLive] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Real-time updates
  useEffect(() => {
    if (!user || !isLive) return;

    const socketUrl = SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl + '/notifications', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[AllTasks] Live updates connected');
    });

    socket.on('newNotification', (data: any) => {
      // Refresh on any PMS task-related notification
      if (
        data?.type === 'task-assigned' ||
        data?.type === 'task-updated' ||
        data?.type === 'task-created' ||
        data?.type === 'task-deleted' ||
        data?.type === 'task-review-ready' ||
        data?.type === 'task-rejected' ||
        data?.type === 'task-approved' ||
        data?.type === 'pms-kpi-update'
      ) {
        console.log('[AllTasks] Live update received:', data.type);
        refetch();
        toast.info("Task list updated");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user, isLive, refetch]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success("Tasks refreshed");
  };

  // Modal states
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Options for filters and modals
  const projectOptions = projects.map(p => ({ id: p.id, name: p.name }));
  const assigneeOptions = users.map(u => ({ id: u.id, name: u.full_name }));

  // Derived unique values for filters (optional, or use full lists)
  const taskStatuses = Object.values(TaskStatus);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.assignee ? (task.assignee.full_name.toLowerCase().includes(searchQuery.toLowerCase())) : false);
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;
    const matchesProject =
      projectFilter === "all" || task.project_id === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
  });

  const handleSaveTask = async (taskData: TaskFormData) => {
    // ... (logic handled below in original code, but we kept it)
    const dto: any = {
      title: taskData.title,
      description: taskData.description,
      status: taskData.status,
      priority: taskData.priority,
      project_id: taskData.projectId,
      assignee_id: taskData.assigneeId || undefined,
      due_date: taskData.dueDate || undefined,
      estimated_hours: taskData.estimatedHours ? Number(taskData.estimatedHours) : undefined
    };

    if (selectedTask) {
      await updateTask.mutateAsync({ id: selectedTask.id, data: dto });
    } else {
      await createTask.mutateAsync(dto);
    }
    setIsTaskModalOpen(false);
    setSelectedTask(null);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleDeleteClick = (task: Task) => {
    setSelectedTask(task);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedTask) {
      await deleteTask.mutateAsync(selectedTask.id);
      setIsDeleteModalOpen(false);
      setSelectedTask(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">All Tasks</h1>
            <p className="text-gray-500 mt-1">
              View and manage all tasks across projects
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg mr-2">
              <Switch
                id="live-mode"
                checked={isLive}
                onCheckedChange={setIsLive}
              />
              <Label htmlFor="live-mode" className="text-sm font-medium flex items-center gap-1 cursor-pointer">
                <Zap className={`h-3 w-3 ${isLive ? 'text-green-500 fill-green-500' : 'text-gray-400'}`} />
                Live
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-10 border-gray-200"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2 h-10">
              <Download className="h-4 w-4" />
              Export
            </button>
            {(permissions.includes('create_tasks') || user?.role === 'owner' || user?.role === 'admin') && (
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setIsTaskModalOpen(true);
                }}
                className="px-4 py-2 !bg-primary !text-primary-foreground rounded-lg hover:!bg-primary/90 transition-colors flex items-center gap-2 h-10"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks or assignees..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="all">All Projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                More Filters
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        <TaskListView
          tasks={filteredTasks}
          title="All Tasks"
          emptyMessage="No tasks found matching your criteria."
          onTaskClick={(task) => {
            setSelectedTask(task);
            setIsTaskModalOpen(true);
          }}
          onEdit={handleEditTask}
          onDelete={handleDeleteClick}
          currentUserId={user?.id}
          currentUserRole={user?.role}
          userPermissions={permissions}
          reviewers={users
            .filter(u => {
              const roleStr = ((u.role || '') + ' ' + ((u as any).role_name || '')).toLowerCase();
              return roleStr.includes('admin') || roleStr.includes('manage') || roleStr.includes('owner');
            })
            .map(u => ({ id: u.id, name: u.full_name }))
          }
        />
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveTask}
        task={
          selectedTask
            ? {
              id: selectedTask.id,
              title: selectedTask.title,
              description: selectedTask.description,
              projectId: selectedTask.project_id,
              assigneeId: selectedTask.assignee_id || "",
              status: selectedTask.status,
              priority: selectedTask.priority,
              dueDate: selectedTask.due_date || "",
              estimatedHours: selectedTask.estimated_hours
            } as any
            : null
        }
        projects={projectOptions}
        assignees={assigneeOptions}
        readOnly={
          selectedTask !== null &&
          !permissions.includes('edit_tasks') &&
          user?.role !== 'owner' &&
          user?.role !== 'admin'
        }
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
      />
    </>
  );
}
