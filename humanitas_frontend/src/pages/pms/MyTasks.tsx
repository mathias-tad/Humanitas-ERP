import { Card, CardContent } from "@/components/ui/card";
import {
  Filter,
  Search,
  RefreshCcw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  Circle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { io } from "socket.io-client";
import { SOCKET_URL } from "@/config/api.config";
import { TaskModal, type TaskFormData } from "@/components/pms/TaskModal";
import { TaskListView } from "@/components/pms/TaskListView";
import { usePMS, TaskStatus, type Task } from "@/hooks/usePMS";
import { useAuth } from "@/context/AuthContext";
import { PerformanceOverview } from "@/components/pms/PerformanceOverview";

const getStatusIcon = (status: TaskStatus | string) => {
  switch (status) {
    case TaskStatus.DONE:
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case TaskStatus.IN_PROGRESS:
      return <Clock className="h-4 w-4 text-primary" />;
    case TaskStatus.TODO:
      return <Circle className="h-4 w-4 text-gray-400" />;
    default:
      return <Circle className="h-4 w-4 text-gray-400" />;
  }
};

export default function PMSMyTasks() {
  const {
    useTasks,
    useProjects,
    useUsers,
    createTask,
  } = usePMS();

  const { user: currentUser, permissions, isLoading: isUserLoading } = useAuth();
  const { data: allTasks = [], isLoading: loadingTasks, refetch } = useTasks({});
  const { data: projects = [] } = useProjects();
  const { data: users = [] } = useUsers();

  // Filter tasks for current user if available, else show all (or none?)
  // For demo, if currentUser is missing, effectively showing all is maybe confusing for "My Tasks".
  // But we'll fallback to showing all to ensure visibility during development if auth fails.
  // Filter tasks for current user if available
  // Fix: Ensure we handle string vs number ID mismatches safely by comparing as strings
  const tasks = currentUser
    ? allTasks.filter(t => {
      const isMatch = String(t.assignee_id) === String(currentUser.id);
      return isMatch;
    })
    : allTasks;

  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Real-time updates
  useEffect(() => {
    if (!currentUser) return;

    const socketUrl = SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl + '/notifications', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('newNotification', (data: any) => {
      // Refresh on new assignment or status update
      if (
        data?.type === 'task-assigned' ||
        data?.type === 'pms-kpi-update' ||
        data?.type === 'task-rejected' ||
        data?.type === 'task-review-ready'
      ) {
        console.log('[MyTasks] WebSocket Notification:', data.type, 'Refetching...');
        refetch();
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, refetch]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (currentUser && allTasks.length > 0) {
    console.log('Current User:', currentUser.id);
    console.log('First Task:', allTasks[0]);
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesFilter = filter === "all" || task.status === filter;
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return matchesFilter && matchesSearch;
  });

  const handleSaveTask = async (taskData: TaskFormData) => {
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
    await createTask.mutateAsync(dto);
    setIsTaskModalOpen(false);
  };

  const taskCounts = {
    all: tasks.length,
    todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
    "in-progress": tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
    completed: tasks.filter((t) => t.status === TaskStatus.DONE).length,
  };

  if (loadingTasks || isUserLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Options
  const projectOptions = projects.map(p => ({ id: p.id, name: p.name }));
  const assigneeOptions = users.map(u => ({ id: u.id, name: u.full_name }));

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
            <p className="text-muted-foreground">
              Manage and track your assigned tasks
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="h-10"
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {(permissions.includes('create_tasks') || currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
              <button
                onClick={() => {
                  setSelectedTask(null); // Ensure we're creating new, not editing
                  setIsTaskModalOpen(true);
                }}
                className="px-4 py-2 !bg-primary !text-primary-foreground rounded-lg hover:!bg-primary/90 transition-colors flex items-center gap-2 h-10"
              >
                <AlertCircle className="h-4 w-4" />
                New Task
              </button>
            )}
          </div>
        </div>

        {/* Performance Score */}
        {currentUser && (
          <PerformanceOverview
            userId={currentUser.id}
            showTitle={false}
          />
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(["all", TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE] as const).map(
            (status) => {
              let countValue = 0;
              if (status === "all") countValue = taskCounts.all;
              else if (status === TaskStatus.TODO) countValue = taskCounts.todo;
              else if (status === TaskStatus.IN_PROGRESS) countValue = taskCounts["in-progress"];
              else if (status === TaskStatus.DONE) countValue = taskCounts.completed;

              return (
                <Card
                  key={status}
                  className={`py-3 cursor-pointer transition-all ${filter === status ? "ring-2 ring-blue-500" : ""}`}
                  onClick={() => setFilter(status)}
                >
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 capitalize">
                        {status === "all" ? "All Tasks" : status}
                      </p>
                      <p className="text-2xl font-bold text-gray-900">{countValue}</p>
                    </div>
                    {status !== "all" && getStatusIcon(status)}
                  </CardContent>
                </Card>
              );
            })}
        </div>

        {/* Search and Filter */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Task List */}
        <TaskListView
          tasks={filteredTasks}
          title="Tasks"
          emptyMessage="No tasks found matching your criteria."
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role} // Pass role for permission bypass
          userPermissions={permissions}
          reviewers={users
            .filter(u => {
              const roleStr = ((u.role || '') + ' ' + ((u as any).role_name || '')).toLowerCase();
              return roleStr.includes('admin') || roleStr.includes('manage') || roleStr.includes('owner');
            })
            .map(u => ({ id: u.id, name: u.full_name }))
          }
          onTaskClick={(task) => {
            setSelectedTask(task);
            setIsTaskModalOpen(true);
          }}
        />
      </div >

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleSaveTask}
        task={selectedTask ? {
          id: selectedTask.id,
          title: selectedTask.title,
          description: selectedTask.description,
          projectId: selectedTask.project_id,
          assigneeId: selectedTask.assignee_id || "",
          status: selectedTask.status,
          priority: selectedTask.priority,
          dueDate: selectedTask.due_date || "",
          estimatedHours: selectedTask.estimated_hours
        } : null}
        projects={projectOptions}
        assignees={assigneeOptions}
        readOnly={
          selectedTask !== null &&
          !permissions.includes('edit_tasks') &&
          currentUser?.role !== 'owner' &&
          currentUser?.role !== 'admin'
        }
      />
    </>
  );
}
