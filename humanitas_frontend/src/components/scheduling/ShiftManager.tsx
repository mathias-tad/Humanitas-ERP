import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useShifts, usePatterns, type Pattern, type Shift } from "@/hooks/useScheduling";
import { Plus, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";

// INTERFACES removed (using types from useScheduling)

export function ShiftManager() {
    const [activeTab, setActiveTab] = useState("shifts");
    const { hasPermission } = usePermissions();
    const canManage = hasPermission("manage_shifts");

    if (!hasPermission("view_shifts") && !hasPermission("manage_shifts")) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <p>You do not have permission to view shift definitions.</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Shifts & Patterns</CardTitle>
                <CardDescription>Manage work shifts and recurring schedule patterns.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="shifts">Shift Definitions</TabsTrigger>
                        <TabsTrigger value="patterns">Schedule Patterns</TabsTrigger>
                    </TabsList>

                    <TabsContent value="shifts">
                        <ShiftList canManage={canManage} />
                    </TabsContent>

                    <TabsContent value="patterns">
                        <PatternList canManage={canManage} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

function ShiftList({ canManage }: { canManage: boolean }) {
    const { data: shifts = [], isLoading } = useShifts();
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: "",
        start_time: "09:00",
        end_time: "17:00",
        color: "#3B82F6",
        grace_minutes: 15
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingId
                ? `${API_BASE_URL}/attendance/shifts/${editingId}`
                : `${API_BASE_URL}/attendance/shifts`;

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to save shift");
            }
            return response.json();
        },
        onSuccess: () => {
            toast.success(editingId ? "Shift updated" : "Shift created successfully");
            setIsCreateModalOpen(false);
            setEditingId(null);
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
            setFormData({
                name: "",
                start_time: "09:00",
                end_time: "17:00",
                color: "#3B82F6",
                grace_minutes: 15
            });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/attendance/shifts/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to delete shift");
            }
        },
        onSuccess: () => {
            toast.success("Shift deleted");
            queryClient.invalidateQueries({ queryKey: ['shifts'] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const handleCreate = () => {
        if (!formData.name) return;
        createMutation.mutate(formData);
    };

    const handleEdit = (shift: Shift) => {
        setFormData({
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            color: shift.color,
            grace_minutes: shift.grace_minutes
        });
        setEditingId(shift.id);
        setIsCreateModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm("Are you sure you want to delete this shift?")) return;
        deleteMutation.mutate(id);
    };

    return (
        <div>
            <div className="flex justify-end mb-4">
                {canManage && (
                    <Button onClick={() => {
                        setEditingId(null);
                        setFormData({
                            name: "",
                            start_time: "09:00",
                            end_time: "17:00",
                            color: "#3B82F6",
                            grace_minutes: 15
                        });
                        setIsCreateModalOpen(true);
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Shift
                    </Button>
                )}
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Shift Name</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead>Grace</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">Loading shifts...</TableCell>
                            </TableRow>
                        ) : shifts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                                    No shifts defined yet.
                                </TableCell>
                            </TableRow>
                        ) : shifts.map((shift) => (
                            <TableRow key={shift.id}>
                                <TableCell className="font-medium">{shift.name}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        <span>{shift.start_time?.substring(0, 5)} - {shift.end_time?.substring(0, 5)}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{shift.grace_minutes}m</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-4 h-4 rounded border ${shift.color.startsWith('bg-') ? shift.color : ''}`}
                                            style={{ backgroundColor: shift.color.startsWith('bg-') ? undefined : shift.color }}
                                        ></div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    {canManage && (
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(shift)}
                                                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                            >
                                                <div className="h-4 w-4">✎</div>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(shift.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Shift" : "Create New Shift"}</DialogTitle>
                        <DialogDescription>{editingId ? "Update shift details." : "Define a new work shift."}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Shift Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="start">Start Time</Label>
                                <Input
                                    id="start"
                                    type="time"
                                    value={formData.start_time}
                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="end">End Time</Label>
                                <Input
                                    id="end"
                                    type="time"
                                    value={formData.end_time}
                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="grace">Grace (min)</Label>
                                <Input
                                    id="grace"
                                    type="number"
                                    value={formData.grace_minutes}
                                    onChange={(e) => setFormData({ ...formData, grace_minutes: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="color">Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="color"
                                        type="color"
                                        className="w-12 p-1 h-10"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    />
                                    <Input
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={createMutation.isPending}>{editingId ? "Update" : "Create"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PatternList({ canManage }: { canManage: boolean }) {
    const { data: patterns = [], isLoading: isLoadingPatterns } = usePatterns();
    const { data: shifts = [] } = useShifts(); // Needed for dropdown
    const queryClient = useQueryClient();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [newPattern, setNewPattern] = useState({
        name: "",
        rotation_type: "fixed" as "fixed" | "weekly" | "bi-weekly" | "custom",
        auto_rotate: false,
        enable_dayoff_rotation: false,
        rotation_weeks: [{ week_number: 1, shift_id: "" }]
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = editingId
                ? `${API_BASE_URL}/attendance/patterns/${editingId}`
                : `${API_BASE_URL}/attendance/patterns`;

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || "Failed to save pattern");
            }
            return response.json();
        },
        onSuccess: () => {
            toast.success(editingId ? "Pattern updated" : "Pattern created");
            queryClient.invalidateQueries({ queryKey: ['patterns'] });
            setIsCreateModalOpen(false);
            setEditingId(null);
            setNewPattern({
                name: "",
                rotation_type: "fixed",
                auto_rotate: false,
                enable_dayoff_rotation: false,
                rotation_weeks: [{ week_number: 1, shift_id: "" }]
            });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await fetch(`${API_BASE_URL}/attendance/patterns/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error("Failed to delete pattern");
            }
        },
        onSuccess: () => {
            toast.success("Pattern deleted");
            queryClient.invalidateQueries({ queryKey: ['patterns'] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    const isLoading = isLoadingPatterns;

    const handleCreate = () => {
        if (!newPattern.name) return;

        // Transform UI model (weeks) to Backend model (flat days)
        const flatShifts: { day_number: number; shift_id: string | null; is_day_off: boolean }[] = [];

        newPattern.rotation_weeks.forEach((week, wIndex) => {
            const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
            days.forEach((_, dIndex) => {
                const dayNumber = (wIndex * 7) + (dIndex + 1); // 1-based index (1..14 etc)

                flatShifts.push({
                    day_number: dayNumber,
                    shift_id: week.shift_id || null, // Require shift_id
                    is_day_off: false // Always false in pattern definition
                });
            });
        });

        // Cycle length is weeks * 7
        const cycleLength = newPattern.rotation_weeks.length * 7;

        const payload = {
            name: newPattern.name,
            description: newPattern.rotation_type, // Storing type in description for now or extra logic
            cycle_length_days: cycleLength,
            shifts: flatShifts,
            enable_dayoff_rotation: newPattern.enable_dayoff_rotation
        };

        createMutation.mutate(payload);
    };

    const handleEdit = (pattern: Pattern) => {
        setNewPattern({
            name: pattern.name,
            rotation_type: pattern.rotation_type,
            auto_rotate: pattern.auto_rotate,
            enable_dayoff_rotation: (pattern as any).enable_dayoff_rotation ?? false,
            rotation_weeks: pattern.rotation_weeks || []
        });
        setEditingId(pattern.id);
        setIsCreateModalOpen(true);
    };

    const handleDelete = (id: string) => {
        if (!confirm("Delete this pattern?")) return;
        deleteMutation.mutate(id);
    };



    return (
        <div>
            <div className="flex justify-end mb-4">
                {canManage && (
                    <Button onClick={() => {
                        setEditingId(null);
                        setNewPattern({
                            name: "",
                            rotation_type: "fixed",
                            auto_rotate: false,
                            enable_dayoff_rotation: false,
                            rotation_weeks: [{ week_number: 1, shift_id: "" }]
                        });
                        setIsCreateModalOpen(true);
                    }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Pattern
                    </Button>
                )}
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pattern Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Cycle Length</TableHead>
                            <TableHead>Auto-Rotate</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-24">Loading...</TableCell></TableRow>
                        ) : patterns.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center h-32">No patterns defined.</TableCell></TableRow>
                        ) : patterns.map((p) => (
                            <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell className="capitalize">{p.rotation_type}</TableCell>
                                <TableCell>{p.rotation_weeks?.length || 1} week(s)</TableCell>
                                <TableCell>{p.auto_rotate ? "Yes" : "No"}</TableCell>
                                <TableCell className="text-right">
                                    {canManage && (
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(p)} className="text-blue-500 hover:text-blue-700 hover:bg-blue-50">
                                                <div className="h-4 w-4">✎</div>
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-red-500">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Schedule Pattern" : "Create Schedule Pattern"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Pattern Name</Label>
                            <Input value={newPattern.name} onChange={e => setNewPattern({ ...newPattern, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Rotation Type</Label>
                                <Select
                                    value={newPattern.rotation_type}
                                    onValueChange={(v: any) => setNewPattern({ ...newPattern, rotation_type: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Fixed (Same every week)</SelectItem>
                                        <SelectItem value="weekly">Weekly Rotation</SelectItem>
                                        <SelectItem value="bi-weekly">Bi-Weekly Rotation</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end pb-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="auto_rotate"
                                        checked={newPattern.auto_rotate}
                                        onCheckedChange={(checked) => setNewPattern({ ...newPattern, auto_rotate: checked as boolean })}
                                    />
                                    <Label htmlFor="auto_rotate">Auto-Rotate Assignments</Label>
                                </div>
                            </div>
                        </div>



                        <div className="border rounded-md p-4 bg-muted/20">
                            <div className="flex items-center justify-between mb-2">
                                <Label>Weekly Schedule (Cycle)</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setNewPattern({
                                            ...newPattern,
                                            rotation_weeks: [
                                                ...newPattern.rotation_weeks,
                                                { week_number: newPattern.rotation_weeks.length + 1, shift_id: "" }
                                            ]
                                        });
                                    }}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Week
                                </Button>
                            </div>

                            {newPattern.rotation_weeks.map((week, index) => (
                                <div key={index} className="space-y-3 mb-4 last:mb-0 p-3 bg-background rounded border relative">
                                    <div className="absolute top-2 right-2">
                                        {newPattern.rotation_weeks.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                                onClick={() => {
                                                    const updated = newPattern.rotation_weeks.filter((_, i) => i !== index);
                                                    // Re-index weeks
                                                    const reindexed = updated.map((w, i) => ({ ...w, week_number: i + 1 }));
                                                    setNewPattern({ ...newPattern, rotation_weeks: reindexed });
                                                }}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Week {week.week_number}</Label>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <Label className="text-xs mb-1 block">Default Shift</Label>
                                            <Select
                                                value={week.shift_id}
                                                onValueChange={(val) => {
                                                    const updated = [...newPattern.rotation_weeks];
                                                    updated[index].shift_id = val;
                                                    setNewPattern({ ...newPattern, rotation_weeks: updated });
                                                }}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Select shift..." /></SelectTrigger>
                                                <SelectContent>
                                                    {shifts.map(s => (
                                                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.start_time?.slice(0, 5)}-{s.end_time?.slice(0, 5)})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs mb-1 block">Full Week Schedule</Label>
                                        <div className="flex gap-2">
                                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                                                <div
                                                    key={day}
                                                    className={`
                                                        w-8 h-8 rounded-full flex items-center justify-center text-xs border bg-primary text-primary-foreground border-primary font-bold
                                                    `}
                                                    title="Working Day"
                                                >
                                                    {day.substring(0, 1)}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Pattern defines shifts only. Day-offs are set when assigning to an employee.
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={createMutation.isPending}>{editingId ? "Update Pattern" : "Create Pattern"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
