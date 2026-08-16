import { useState } from "react";
import {
    Play,
    Send,
    CheckCircle,
    XCircle,
    GitPullRequest,
    RotateCcw,
    Lock,
    UserPlus,
    Check,
    ChevronsUpDown
} from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TaskStatus, type Task } from "@/hooks/usePMS";


interface TaskWorkflowActionsProps {
    task: Task;
    currentUserId: string;
    hasReviewPermission?: boolean; // New prop to control review actions visibility
    hasReassignPermission?: boolean; // Controls reassign button visibility
    onStatusChange: (status: TaskStatus, comment?: string) => Promise<void>;
    onClaim: () => Promise<void>;
    onReassign?: (newReviewerId: string) => Promise<void>; // For reassigning reviewer
    reviewers?: Array<{ id: string; name: string }>; // List of potential reviewers
}

export function TaskWorkflowActions({
    task,
    currentUserId,
    hasReviewPermission = false, // Default to false for safety
    hasReassignPermission = false,
    onStatusChange,
    onClaim,
    onReassign,
    reviewers = []
}: TaskWorkflowActionsProps) {
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [loading, setLoading] = useState(false);

    // Undo Logic State
    const [pendingAction, setPendingAction] = useState<{ status: TaskStatus, comment?: string } | null>(null);
    const [countdown, setCountdown] = useState(0);
    const [timerId, setTimerId] = useState<ReturnType<typeof setTimeout> | null>(null);

    console.log('[TaskWorkflowActions] Debug ID:', task.id, {
        isReviewer: task.reviewer_id === currentUserId,
        hasReassignPermission,
        reviewersCount: reviewers.length,
        hasReviewerId: !!task.reviewer_id,
        hasOnReassign: !!onReassign,
        status: task.status
    });

    const executeAction = async (status: TaskStatus, comment?: string) => {
        setLoading(true);
        try {
            await onStatusChange(status, comment);
            toast.success("Status updated");
        } catch (error) {
            toast.error("Action failed");
        } finally {
            setLoading(false);
            setRejectOpen(false);
            setPendingAction(null);
        }
    };

    const handleAction = (status: TaskStatus, comment?: string) => {
        // For Rejection or easy transitions, maybe instant? 
        // User asked for "accident sending for review and accidental clicking done".
        // So applied to: IN_REVIEW and DONE.
        if (status === TaskStatus.IN_REVIEW || status === TaskStatus.DONE) {
            startUndoTimer(status, comment);
        } else {
            executeAction(status, comment);
        }
    };

    const startUndoTimer = (status: TaskStatus, comment?: string) => {
        setPendingAction({ status, comment });
        setCountdown(5); // Reduced from 30s to 5s

        // Clear existing timer if any
        if (timerId) clearInterval(timerId);

        const id = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(id);
                    executeAction(status, comment);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        setTimerId(id);
    };

    const handleUndo = () => {
        if (timerId) clearInterval(timerId);
        setPendingAction(null);
        setCountdown(0);
        toast.info("Action cancelled");
    };

    // If pending action, show Undo UI
    if (pendingAction) {
        return (
            <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 w-full justify-center"
                onClick={handleUndo}
            >
                <RotateCcw className="h-3 w-3 animate-spin-slow" /> Undo ({countdown}s)
            </Button>
        );
    }

    const isAssignee = task.assignee_id === currentUserId;
    const isReviewer = task.reviewer_id === currentUserId;

    // --- State Machine UI ---

    // 1. To Do -> In Progress
    if (task.status === TaskStatus.TODO) {
        return (
            <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => handleAction(TaskStatus.IN_PROGRESS)}
                disabled={loading}
            >
                <Play className="h-3 w-3" /> Start Work
            </Button>
        );
    }

    // 2. In Progress -> In Review
    if (task.status === TaskStatus.IN_PROGRESS) {
        if (!isAssignee) return <StatusBadge status={task.status} />;
        return (
            <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={() => handleAction(TaskStatus.IN_REVIEW)}
                disabled={loading}
            >
                <Send className="h-3 w-3" /> Submit for Review
            </Button>
        );
    }

    // 3. In Review -> Reviewer Actions
    if (task.status === TaskStatus.IN_REVIEW) {
        if (!task.reviewer_id) {
            // Only show Claim button if user has permission
            if (!hasReviewPermission) {
                return (
                    <span className="flex items-center gap-1 text-xs text-purple-600 font-medium px-2 py-1 bg-purple-50 rounded-full border border-purple-100 opacity-60">
                        <Lock className="h-3 w-3" /> Waiting for Reviewer
                    </span>
                );
            }

            return (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-purple-200 text-purple-700 hover:bg-purple-50"
                    onClick={onClaim}
                    disabled={loading}
                >
                    <GitPullRequest className="h-3 w-3" /> Claim Review
                </Button>
            );
        }


        // ... inside the component function, modify the Reassign block

        // Reusable Reassign Component (Since used in two places)
        const ReassignButton = () => {
            const [open, setOpen] = useState(false);

            if (!hasReassignPermission || !onReassign) return null;

            return (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="h-7 text-xs px-2 gap-1 border-orange-200 text-orange-700 hover:bg-orange-50 w-auto justify-between"
                            disabled={loading}
                        >
                            <span className="flex items-center gap-1">
                                <UserPlus className="h-3 w-3" /> Reassign
                            </span>
                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="end">
                        <Command>
                            <CommandInput placeholder="Search reviewer..." className="h-9" />
                            <CommandList>
                                <CommandEmpty>No users found.</CommandEmpty>
                                <CommandGroup>
                                    {reviewers.filter(r => r.id !== task.reviewer_id).map((reviewer) => (
                                        <CommandItem
                                            key={reviewer.id}
                                            value={reviewer.name}
                                            onSelect={async () => {
                                                setOpen(false);
                                                setLoading(true);
                                                try {
                                                    await onReassign(reviewer.id);
                                                    toast.success(`Reassigned to ${reviewer.name}`);
                                                } catch {
                                                    toast.error("Reassignment failed");
                                                } finally {
                                                    setLoading(false);
                                                }
                                            }}
                                        >
                                            <span className="truncate">{reviewer.name}</span>
                                            <Check
                                                className={`ml-auto h-4 w-4 ${task.reviewer_id === reviewer.id ? "opacity-100" : "opacity-0"}`}
                                            />
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            );
        };

        if (isReviewer) {
            return (
                <div className="flex gap-1">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => setRejectOpen(true)}
                        disabled={loading}
                    >
                        <XCircle className="h-3 w-3" /> Reject
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2 gap-1 border-green-200 text-green-700 hover:bg-green-50"
                        onClick={() => handleAction(TaskStatus.DONE)}
                        disabled={loading}
                    >
                        <CheckCircle className="h-3 w-3" /> Approve
                    </Button>

                    <ReassignButton />

                    <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Reject Task</DialogTitle>
                                <DialogDescription>Please provide a reason for sending this task back.</DialogDescription>
                            </DialogHeader>
                            <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. Tests failing, Logic error..."
                            />
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={() => handleAction(TaskStatus.IN_PROGRESS, rejectReason)}
                                    disabled={!rejectReason.trim()}
                                >
                                    Reject Task
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            );
        }

        // Waiting for review - but show reassign for authorized users
        return (
            <div className="flex items-center gap-1">
                <span className="flex items-center gap-1 text-xs text-purple-600 font-medium px-2 py-1 bg-purple-50 rounded-full border border-purple-100">
                    <Lock className="h-3 w-3" /> In Review
                </span>
                <ReassignButton />
            </div>
        );
    }

    // 4. Fallback (Done, Blocked, etc.)
    return <StatusBadge status={task.status} />;
}

function StatusBadge({ status }: { status: string }) {
    // Simplified badge
    return <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded text-gray-700">{status}</span>;
}
