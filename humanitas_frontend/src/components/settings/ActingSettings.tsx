import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";

interface ActingAssignment {
    id: string;
    actor_user_id: string;
    target_user_id: string;
    start_date: string;
    end_date: string;
    actor_name?: string;
    target_name?: string;
}

interface User {
    id: string;
    full_name: string;
}

interface ActingSettingsProps {
    disabled?: boolean;
}

export function ActingSettings({ disabled: _disabled = false }: ActingSettingsProps) {
    const [assignments, setAssignments] = useState<ActingAssignment[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [actingPercentage, setActingPercentage] = useState<number>(0);
    const [additionalType, setAdditionalType] = useState<string>('NONE');
    const [additionalValue, setAdditionalValue] = useState<number>(0);
    const [isSavingPercentage, setIsSavingPercentage] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        actor_user_id: "",
        target_user_id: "",
        start_date: "",
        end_date: "",
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Assignments
            const assignmentsRes = await fetch(`${API_BASE_URL}/payroll/acting-assignments`, { credentials: 'include' });
            const assignmentsData = assignmentsRes.ok ? await assignmentsRes.json() : [];

            // Fetch Users for dropdowns
            const usersRes = await fetch(`${API_BASE_URL}/users`, { credentials: 'include' });
            const usersData = usersRes.ok ? await usersRes.json() : [];

            // Fetch Payroll Settings for acting percentage
            const settingsRes = await fetch(`${API_BASE_URL}/settings/payroll`, { credentials: 'include' });
            if (settingsRes.ok) {
                const settingsData = await settingsRes.json();
                if (settingsData.acting_allowance_percentage !== undefined) {
                    setActingPercentage(settingsData.acting_allowance_percentage);
                }
                if (settingsData.acting_allowance_additional_type) {
                    setAdditionalType(settingsData.acting_allowance_additional_type);
                }
                if (settingsData.acting_allowance_additional_value) {
                    setAdditionalValue(settingsData.acting_allowance_additional_value);
                }
            }

            setAssignments(assignmentsData);
            setUsers(usersData);
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.actor_user_id || !formData.target_user_id || !formData.start_date || !formData.end_date) {
            setMessage({ type: "error", text: "All fields are required" });
            return;
        }

        setIsSaving(true);
        setMessage({ type: "", text: "" });

        try {
            const response = await fetch(`${API_BASE_URL}/payroll/acting-assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to create assignment");
            }

            setMessage({ type: "success", text: "Assignment created successfully" });
            setIsModalOpen(false);
            fetchData(); // Refresh list
            setFormData({ actor_user_id: "", target_user_id: "", start_date: "", end_date: "" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSavePercentage = async () => {
        setIsSavingPercentage(true);
        setMessage({ type: "", text: "" });

        try {
            const response = await fetch(`${API_BASE_URL}/settings/payroll`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    acting_allowance_percentage: actingPercentage,
                    acting_allowance_additional_type: additionalType,
                    acting_allowance_additional_value: additionalValue
                }),
            });

            if (!response.ok) throw new Error("Failed to save percentage");
            setMessage({ type: "success", text: "Acting allowance rate saved successfully" });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message });
        } finally {
            setIsSavingPercentage(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to remove this assignment?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/payroll/acting-assignments/${id}`, {
                method: "DELETE",
                credentials: 'include',
            });

            if (response.ok) {
                setAssignments(assignments.filter((a) => a.id !== id));
                setMessage({ type: "success", text: "Assignment removed" });
            } else {
                setMessage({ type: "error", text: "Failed to remove assignment" });
            }
        } catch (error) {
            setMessage({ type: "error", text: "Failed to remove assignment" });
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {message.text && (
                <div
                    className={`px-4 py-2 rounded text-sm ${message.type === "success"
                        ? "bg-green-50 text-green-600"
                        : "bg-red-50 text-red-600"
                        }`}
                >
                    {message.text}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Acting Assignments</CardTitle>
                    <CardDescription>
                        Assign employees to act on behalf of others. They will receive an automatic
                        Acting Allowance ({actingPercentage}% of the target's basic salary) during the assignment period.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="actingPercentage">
                                Acting Allowance Rate (%) <span className="text-muted-foreground ml-2 text-xs font-normal">(Non-Taxable Base)</span>
                            </Label>
                            <Input
                                id="actingPercentage"
                                type="number"
                                value={actingPercentage}
                                onChange={(e) => setActingPercentage(parseFloat(e.target.value) || 0)}
                                placeholder="e.g. 10"
                            />
                            <p className="text-sm text-muted-foreground">
                                Percentage of the target's basic salary the actor will receive as a tax-free allowance.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="additionalType">Additional Taxable Allowance</Label>
                                <select
                                    id="additionalType"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={additionalType}
                                    onChange={(e) => setAdditionalType(e.target.value)}
                                >
                                    <option value="NONE">None</option>
                                    <option value="PERCENTAGE">Percentage of Target Salary</option>
                                    <option value="FIXED">Fixed Amount</option>
                                </select>
                            </div>

                            {additionalType !== 'NONE' && (
                                <div className="space-y-2">
                                    <Label htmlFor="additionalValue">
                                        {additionalType === 'PERCENTAGE' ? 'Percentage Value (%)' : 'Fixed Amount'}
                                    </Label>
                                    <Input
                                        id="additionalValue"
                                        type="number"
                                        value={additionalValue}
                                        onChange={(e) => setAdditionalValue(parseFloat(e.target.value) || 0)}
                                        placeholder={additionalType === 'PERCENTAGE' ? "e.g. 5" : "e.g. 500"}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4">
                        <Button onClick={handleSavePercentage} disabled={isSavingPercentage}>
                            {isSavingPercentage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Configuration
                        </Button>
                    </div>
                </CardContent>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Actor</TableHead>
                                <TableHead>Acting As (Target)</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assignments.map((assignment) => (
                                <TableRow key={assignment.id}>
                                    <TableCell className="font-medium">{assignment.actor_name}</TableCell>
                                    <TableCell>{assignment.target_name}</TableCell>
                                    <TableCell>{new Date(assignment.start_date).toLocaleDateString()}</TableCell>
                                    <TableCell>{new Date(assignment.end_date).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(assignment.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {assignments.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                                        No active acting assignments
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <div className="mt-4">
                        <Button onClick={() => setIsModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Assign Acting Role
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Acting Assignment</DialogTitle>
                        <DialogDescription>
                            Select the actor and the target user. The actor will receive the allowance.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="actor">Who is Acting? (Actor)</Label>
                            <select
                                id="actor"
                                value={formData.actor_user_id}
                                onChange={(e) => setFormData({ ...formData, actor_user_id: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            >
                                <option value="">Select User...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="target">Acting As Whom? (Target)</Label>
                            <select
                                id="target"
                                value={formData.target_user_id}
                                onChange={(e) => setFormData({ ...formData, target_user_id: e.target.value })}
                                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                            >
                                <option value="">Select Target User...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Create Assignment"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
