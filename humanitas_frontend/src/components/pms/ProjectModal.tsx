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
import { usePMS } from "@/hooks/usePMS";

export interface ProjectFormData {
    id?: number;
    name: string;
    description: string;
    status: "Active" | "On Hold" | "Completed" | "Planning";
    priority: "High" | "Medium" | "Low";
    start_date: string;
    target_end_date: string;
    team_id?: string;
}

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: ProjectFormData) => void;
    project?: ProjectFormData | null;
}

export function ProjectModal({
    isOpen,
    onClose,
    onSave,
    project,
}: ProjectModalProps) {
    const { useTeams } = usePMS();
    const { data: teams = [] } = useTeams();
    const [formData, setFormData] = useState<ProjectFormData>({
        name: "",
        description: "",
        status: "Planning",
        priority: "Medium",
        start_date: "",
        target_end_date: "",
        team_id: "", // Default empty
    });

    useEffect(() => {
        if (project) {
            setFormData(project);
        } else {
            setFormData({
                name: "",
                description: "",
                status: "Planning",
                priority: "Medium",
                start_date: "",
                target_end_date: "",
                team_id: "",
            });
        }
    }, [project, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Allowed fields matching the backend DTO
        const allowedFields = [
            'name',
            'description',
            'status',
            'priority',
            'start_date',
            'target_end_date',
            'team_id',
        ];

        const dataToSubmit: any = {};

        allowedFields.forEach(key => {
            const value = (formData as any)[key];
            // Only include if value is present (not undefined/null) and not empty string
            if (value !== undefined && value !== null && value !== "") {
                dataToSubmit[key] = value;
            }
        });

        onSave(dataToSubmit);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>{project ? "Edit Project" : "Create New Project"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            placeholder="Enter project name"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="team">Owning Team (Optional)</Label>
                        <select
                            id="team"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.team_id || ""}
                            onChange={(e) =>
                                setFormData({ ...formData, team_id: e.target.value })
                            }
                        >
                            <option value="">No Team Assigned</option>
                            {teams.map((team: any) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground">
                            Assigning a team restricts task creation and management to that team.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder="Enter project description"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <select
                                id="status"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.status}
                                onChange={(e) =>
                                    setFormData({ ...formData, status: e.target.value as any })
                                }
                            >
                                <option value="Planning">Planning</option>
                                <option value="Active">Active</option>
                                <option value="On Hold">On Hold</option>
                                <option value="Completed">Completed</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <select
                                id="priority"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.priority}
                                onChange={(e) =>
                                    setFormData({ ...formData, priority: e.target.value as any })
                                }
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={formData.start_date}
                                onChange={(e) =>
                                    setFormData({ ...formData, start_date: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="target_end_date">Target End Date</Label>
                            <Input
                                id="target_end_date"
                                type="date"
                                value={formData.target_end_date}
                                onChange={(e) =>
                                    setFormData({ ...formData, target_end_date: e.target.value })
                                }
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" className="!bg-primary hover:!bg-primary/90 !text-primary-foreground">
                            {project ? "Save Changes" : "Create Project"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
