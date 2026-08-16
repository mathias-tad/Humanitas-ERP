
import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { SOCKET_URL } from "@/config/api.config";
import { usePMS, TaskStatus, type Task } from "@/hooks/usePMS";
import { useBasicUsers } from "@/hooks/useUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Filter } from "lucide-react";
import { TaskWorkflowActions } from "@/components/pms/TaskWorkflowActions";
import { TaskModal } from "@/components/pms/TaskModal";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function ReviewQueue() {
    const { isAuthenticated, user: authUser } = useAuth(); // Get authUser for role check if needed
    const { useTasks, useCurrentUser, updateTask } = usePMS();
    const { data: currentUser } = useCurrentUser();
    const { data: users = [] } = useBasicUsers(); // Fetch potential reviewers (basic info)
    const { data: reviewTasksRaw = [], isLoading, refetch } = useTasks({ status: TaskStatus.IN_REVIEW });

    console.log('[ReviewQueue] Basic Users fetched:', users.length);
    console.log('[ReviewQueue] Auth User:', authUser?.id);

    const [filterBy, setFilterBy] = useState<'all' | 'unclaimed' | 'mine'>('all');
    const [sortBy, setSortBy] = useState<'date' | 'priority'>('priority');
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;

        const socket = io(SOCKET_URL + '/notifications', {
            withCredentials: true,
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            console.log('[ReviewQueue] Connected to notifications');
        });

        socket.on('newNotification', (data: any) => {
            if (data?.type === 'task-review-ready') {
                console.log('[ReviewQueue] New review task, refetching...');
                refetch();
                toast.info("New task ready for review!");
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [isAuthenticated, refetch]);

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        setIsTaskModalOpen(true);
    };

    const handleClaim = async (task: Task) => {
        try {
            await updateTask.mutateAsync({
                id: task.id,
                data: { reviewer_id: currentUser?.id }
            });
            toast.success("Review claimed!");
        } catch (error) {
            toast.error("Failed to claim review");
        }
    };

    const handleStatusChange = async (task: Task, status: TaskStatus, comment?: string) => {
        try {
            await updateTask.mutateAsync({
                id: task.id,
                data: { status, return_comment: comment }
            });
            toast.success(`Task marked as ${status}`);
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleReassign = async (task: Task, newReviewerId: string) => {
        try {
            await updateTask.mutateAsync({
                id: task.id,
                data: { reviewer_id: newReviewerId }
            });
            // Toast handled in component via promise or here? 
            // TaskWorkflowActions handles toast success if promise resolves.
        } catch (error) {
            throw error; // Let component handle error toast
        }
    };

    // Filter and Sort
    const processedTasks = reviewTasksRaw
        .filter(task => {
            // Server Status filter handles "IN_REVIEW"

            // Ownership filter
            const isMine = task.reviewer_id === currentUser?.id;
            const isUnclaimed = !task.reviewer_id;

            // Base inclusion: Must be Unclaimed OR Claimed by me
            if (!isMine && !isUnclaimed) return false;

            if (filterBy === 'unclaimed') return isUnclaimed;
            if (filterBy === 'mine') return isMine;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'priority') {
                const priorityWeight: Record<string, number> = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
            } else {
                return new Date(a.due_date || '9999-12-31').getTime() - new Date(b.due_date || '9999-12-31').getTime();
            }
        });

    // Prepare reviewers list for dropdown
    const reviewersList = users.map(u => ({ id: u.id, name: u.full_name }));

    if (isLoading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900">Review Queue</h1>
                    <p className="text-gray-500">Tasks awaiting your review and approval</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-white p-1 rounded-lg border flex items-center">
                        <Button
                            variant={filterBy === 'all' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilterBy('all')}
                        >
                            All
                        </Button>
                        <Button
                            variant={filterBy === 'unclaimed' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilterBy('unclaimed')}
                        >
                            Unclaimed
                        </Button>
                        <Button
                            variant={filterBy === 'mine' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setFilterBy('mine')}
                        >
                            My Reviews
                        </Button>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortBy(sortBy === 'priority' ? 'date' : 'priority')}
                        className="gap-2"
                    >
                        <Filter className="h-4 w-4" />
                        Sort by {sortBy === 'priority' ? 'Priority' : 'Due Date'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {processedTasks.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                        <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900">All Caught Up!</h3>
                        <p className="text-gray-500">
                            {reviewTasksRaw.length === 0
                                ? "There are no tasks pending review at the moment."
                                : "No tasks match your current filters."}
                        </p>
                    </div>
                ) : (
                    processedTasks.map(task => (
                        <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow group" onClick={() => handleTaskClick(task)}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className={`
                                        ${task.priority === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                                            task.priority === 'Critical' ? 'bg-red-100 text-red-800 border-red-200' :
                                                'bg-primary/5 text-primary border-primary/20'
                                        }
                                    `}>
                                        {task.priority}
                                    </Badge>
                                    {!task.reviewer_id ? (
                                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                            Unclaimed
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                                            In Review
                                        </Badge>
                                    )}
                                </div>
                                <CardTitle className="text-lg leading-tight mt-2 line-clamp-2 group-hover:text-primary transition-colors">
                                    {task.title}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-between items-end mt-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Clock className="h-3 w-3" />
                                            <span>{task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No Goal Date'}</span>
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            Reporter: {task.reporter?.full_name || 'Unknown'}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div onClick={e => e.stopPropagation()}>
                                        <TaskWorkflowActions
                                            task={task}
                                            currentUserId={currentUser?.id || ''}
                                            hasReviewPermission={true} // Assumed true since they are on this page
                                            hasReassignPermission={true} // Allow reassign
                                            onClaim={() => handleClaim(task)}
                                            onStatusChange={(s, c) => handleStatusChange(task, s, c)}
                                            onReassign={(id) => handleReassign(task, id)}
                                            reviewers={reviewersList}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Reuse Task Modal for details */}
            <TaskModal
                isOpen={isTaskModalOpen}
                onClose={() => {
                    setIsTaskModalOpen(false);
                    setSelectedTask(null);
                }}
                onSave={() => {
                    // Refresh on close just to be sure we catch changes made in modal
                    refetch();
                }}
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
                projects={[]} // Passed for completeness
                assignees={[]}
                readOnly={true} // Review Queue is for reviewing, not editing task details
            />
        </div>
    );
}
