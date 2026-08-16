
import {
    MoreVertical,
    Calendar,
    Pencil,
    Trash2,
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    TaskStatus,
    ProjectPriority,
    usePMS,
    type Task
} from "@/hooks/usePMS";
import { TaskWorkflowActions } from "@/components/pms/TaskWorkflowActions";

interface TaskListViewProps {
    tasks: Task[];
    title?: string;
    emptyMessage?: string;
    onTaskClick?: (task: Task) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (task: Task) => void;
    currentUserId?: string;
    userPermissions?: string[];
    reviewers?: Array<{ id: string; name: string }>; // For reassignment
}

export function TaskListView({
    tasks,
    title = "Tasks",
    emptyMessage = "No tasks found.",
    onTaskClick,
    onEdit,
    onDelete,
    currentUserId,
    currentUserRole, // New prop
    userPermissions = [],
    reviewers = [] // For reassignment
}: TaskListViewProps & { currentUserRole?: string }) {

    const { updateTask } = usePMS();

    const getPriorityColor = (priority: ProjectPriority | string) => {
        switch (priority) {
            case ProjectPriority.HIGH:
                return "bg-red-100 text-red-800";
            case ProjectPriority.MEDIUM:
                return "bg-orange-100 text-orange-800";
            case ProjectPriority.LOW:
                return "bg-gray-100 text-gray-800";
            case ProjectPriority.CRITICAL:
                return "bg-red-200 text-red-900";
            default:
                return "bg-gray-100 text-gray-800";
        }
    };

    const handleTaskComplete = async (task: Task) => {
        // Basic toggle logic - strict workflow might prevent this, but keeping for compatibility
        const newStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
        try {
            await updateTask.mutateAsync({
                id: task.id,
                data: { status: newStatus }
            });
        } catch (e) {
            console.error("Failed to toggle complete", e);
        }
    };

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle className="text-lg">
                    {title} ({tasks.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => onTaskClick?.(task)}
                        >
                            <div className="flex items-start gap-4">
                                <Checkbox
                                    checked={task.status === TaskStatus.DONE}
                                    onCheckedChange={() => handleTaskComplete(task)}
                                    disabled={task.status === TaskStatus.BLOCKED}
                                    className={`mt-1 ${task.status === TaskStatus.BLOCKED ? "opacity-50 cursor-not-allowed" : ""}`}
                                    onClick={(e) => e.stopPropagation()} // Prevent card click
                                    title={task.status === TaskStatus.BLOCKED ? "Unblock this task to complete it" : "Mark as Done"}
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className={`font-medium ${task.status === TaskStatus.DONE
                                            ? "line-through text-gray-400"
                                            : "text-gray-900"
                                            }`}>
                                            {task.title}
                                        </h3>

                                        {(onEdit || onDelete) && (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="p-1 hover:bg-gray-100 rounded">
                                                            <MoreVertical className="h-4 w-4 text-gray-400" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        {onEdit && (
                                                            <DropdownMenuItem onClick={() => onEdit(task)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Edit
                                                            </DropdownMenuItem>
                                                        )}
                                                        {onDelete && (
                                                            <DropdownMenuItem
                                                                className="text-red-600"
                                                                onClick={() => onDelete(task)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                        {task.description}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                        {/* Workflow Actions */}
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <TaskWorkflowActions
                                                task={task}
                                                currentUserId={currentUserId || ''}
                                                hasReviewPermission={
                                                    userPermissions.includes('review_tasks') ||
                                                    !!(currentUserRole && (
                                                        currentUserRole.toLowerCase().includes('admin') ||
                                                        currentUserRole.toLowerCase().includes('owner') ||
                                                        currentUserRole.toLowerCase().includes('manager')
                                                    ))
                                                }
                                                hasReassignPermission={
                                                    (currentUserRole && currentUserRole.toLowerCase() === 'owner') ||
                                                    userPermissions.includes('reassign_tasks')
                                                }
                                                onStatusChange={async (status, comment) => {
                                                    await updateTask.mutateAsync({
                                                        id: task.id,
                                                        data: { status, return_comment: comment }
                                                    });
                                                }}
                                                onClaim={async () => {
                                                    await updateTask.mutateAsync({
                                                        id: task.id,
                                                        data: { reviewer_id: currentUserId }
                                                    });
                                                }}
                                                onReassign={async (newReviewerId) => {
                                                    await updateTask.mutateAsync({
                                                        id: task.id,
                                                        data: { reviewer_id: newReviewerId }
                                                    });
                                                }}
                                                reviewers={reviewers}
                                            />
                                        </div>

                                        <Badge className={getPriorityColor(task.priority)}>
                                            {task.priority}
                                        </Badge>

                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {task.due_date || 'No due date'}
                                        </span>

                                        <span className="text-xs text-gray-400">
                                            {task.project?.name || 'Unknown Project'}
                                        </span>

                                        {/* Late Completion Badge */}
                                        {task.status === TaskStatus.DONE && task.completed_at && task.due_date && (() => {
                                            const completed = new Date(task.completed_at);
                                            completed.setHours(0, 0, 0, 0);
                                            const due = new Date(task.due_date);
                                            due.setHours(0, 0, 0, 0);
                                            return completed > due;
                                        })() && (
                                                <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
                                                    Late Completion
                                                </Badge>
                                            )}

                                        {/* Assignee Display */}
                                        {task.assignee && (
                                            <span className="text-xs text-gray-500 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                                                <span className="h-4 w-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-medium">
                                                    {task.assignee.full_name?.charAt(0).toUpperCase() || '?'}
                                                </span>
                                                {task.assignee.full_name || 'Unknown'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            {emptyMessage}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
