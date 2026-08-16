import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TaskFormData {
    id?: string;
    title: string;
    description?: string;
    projectId: string;
    assigneeId: string;
    status: string;
    priority: string;
    dueDate: string;
    estimatedHours?: number;
}

interface Option {
    id: string;
    name: string;
}

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (task: TaskFormData) => void;
    task?: TaskFormData | null;
    projects: Option[];
    assignees: Option[];
    readOnly?: boolean; // When true, form fields are disabled and Save button is hidden
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskHistory } from "./TaskHistory";

// ... (imports remain)

export function TaskModal({
    isOpen,
    onClose,
    onSave,
    task,
    projects,
    assignees,
    readOnly = false,
}: TaskModalProps) {
    const [formData, setFormData] = useState<TaskFormData>({
        // ... (data init remains the same)
        title: "",
        description: "",
        projectId: "",
        assigneeId: "",
        status: "Pending",
        priority: "Medium",
        dueDate: "",
        estimatedHours: 0
    });

    // ... (useEffect remains)
    useEffect(() => {
        if (task) {
            setFormData(task);
        } else {
            setFormData({
                title: "",
                description: "",
                projectId: projects[0]?.id || "",
                assigneeId: "",
                status: "To Do",
                priority: "Medium",
                dueDate: "",
                estimatedHours: 0
            });
        }
    }, [task, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px]"> {/* Increased width for history */}
                <DialogHeader>
                    <DialogTitle>{readOnly ? "View Task" : (task ? "Edit Task" : "Create New Task")}</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="history" disabled={!task?.id}>History & Audit</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details">
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            {/* ... (Existing Form Fields - Title, Desc) ... */}
                            <div className="space-y-2">
                                <Label htmlFor="title">Task Title</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="Enter task title"
                                    required
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief description"
                                    rows={2}
                                    disabled={readOnly}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="project">Project</Label>
                                    <select
                                        id="project"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.projectId}
                                        onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                                        required
                                        disabled={readOnly}
                                    >
                                        <option value="" disabled>Select Project</option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="assignee">Assignee</Label>
                                    <select
                                        id="assignee"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.assigneeId}
                                        onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value })}
                                        disabled={readOnly}
                                    >
                                        <option value="">Unassigned</option>
                                        {assignees.map((a) => (
                                            <option key={a.id} value={a.id}>{a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <select
                                        id="status"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        disabled={readOnly}
                                    >
                                        <option value="To Do">To Do</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="In Review">In Review</option>
                                        <option value="Done">Done</option>
                                        <option value="Blocked">Blocked</option>
                                        <option value="Backlog">Backlog</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <select
                                        id="priority"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        disabled={readOnly}
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="dueDate">Due Date</Label>
                                    <Input
                                        id="dueDate"
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        required
                                        disabled={readOnly}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="estimatedHours">Est. Hours</Label>
                                    <Input
                                        id="estimatedHours"
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={formData.estimatedHours}
                                        onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) })}
                                        disabled={readOnly}
                                    />
                                </div>
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={onClose}>
                                    {readOnly ? "Close" : "Cancel"}
                                </Button>
                                {!readOnly && (
                                    <Button type="submit" className="!bg-primary hover:!bg-primary/90 !text-primary-foreground">
                                        {task ? "Save Changes" : "Create Task"}
                                    </Button>
                                )}
                            </DialogFooter>
                        </form>
                    </TabsContent>

                    <TabsContent value="history">
                        <div className="py-4">
                            {task?.id ? <TaskHistory taskId={task.id} /> : <p>Save task to seeing history</p>}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
