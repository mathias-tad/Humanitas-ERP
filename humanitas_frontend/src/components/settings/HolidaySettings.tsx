import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, Plus, Pencil, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";

interface Holiday {
    id: string;
    name: string;
    date: string;
    description?: string;
    is_recurring: boolean;
    type: string;
}

interface HolidaySettingsProps {
    disabled?: boolean;
}

export function HolidaySettings({ disabled = false }: HolidaySettingsProps) {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [timezone, setTimezone] = useState("UTC");

    const [currentHoliday, setCurrentHoliday] = useState<Partial<Holiday>>({
        name: "",
        date: "",
        description: "",
        is_recurring: true,
        type: "public",
    });

    useEffect(() => {
        fetchHolidays();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/settings/general`, {
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                if (data.timezone) {
                    setTimezone(data.timezone);
                }
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
        }
    };

    const fetchHolidays = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/holidays`, {
                credentials: "include",
            });
            if (response.ok) {
                const data = await response.json();
                setHolidays(data);
            }
        } catch (error) {
            console.error("Failed to fetch holidays:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const url = currentHoliday.id
                ? `${API_BASE_URL}/holidays/${currentHoliday.id}`
                : `${API_BASE_URL}/holidays`;

            const method = currentHoliday.id ? "PATCH" : "POST";

            // Clean payload to remove extra fields like id, created_at, updated_at
            const payload = {
                name: currentHoliday.name,
                date: currentHoliday.date,
                description: currentHoliday.description,
                is_recurring: currentHoliday.is_recurring,
                type: currentHoliday.type,
            };

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (!response.ok) throw new Error("Failed to save holiday");

            toast.success(`Holiday ${currentHoliday.id ? "updated" : "created"} successfully.`);

            setIsDialogOpen(false);
            fetchHolidays();
        } catch (error) {
            toast.error("Failed to save holiday.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this holiday?")) return;
        setIsDeleting(id);
        try {
            const response = await fetch(`${API_BASE_URL}/holidays/${id}`, {
                method: "DELETE",
                credentials: "include",
            });

            if (!response.ok) throw new Error("Failed to delete holiday");

            toast.success("Holiday deleted successfully.");

            setHolidays(holidays.filter(h => h.id !== id));
        } catch (error) {
            toast.error("Failed to delete holiday.");
        } finally {
            setIsDeleting(null);
        }
    };

    const openDialog = (holiday?: Holiday) => {
        if (holiday) {
            let dateStr = "";

            if (holiday.date) {
                try {
                    const d = new Date(holiday.date);
                    dateStr = new Intl.DateTimeFormat('en-CA', {
                        timeZone: timezone,
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    }).format(d);
                } catch (e) {
                    // Fallback
                    dateStr = String(holiday.date).split('T')[0];
                }
            }

            setCurrentHoliday({ ...holiday, date: dateStr });
        } else {
            // For new holiday, default to TODAY in TENANT timezone
            let todayStr = "";
            try {
                todayStr = new Intl.DateTimeFormat('en-CA', {
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(new Date());
            } catch (e) {
                // Fallback
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                todayStr = `${year}-${month}-${day}`;
            }

            setCurrentHoliday({
                name: "",
                date: todayStr,
                description: "",
                is_recurring: true,
                type: "public",
            });
        }
        setIsDialogOpen(true);
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
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Holiday Management</CardTitle>
                    <CardDescription>Configure company and public holidays.</CardDescription>
                </div>
                {!disabled && (
                    <Button onClick={() => openDialog()}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Holiday
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Holiday Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Recurring</TableHead>
                            {!disabled && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {holidays.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                    No holidays found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            holidays.map((honey) => (
                                <TableRow key={honey.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                                            {new Date(honey.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{honey.name}</TableCell>
                                    <TableCell className="capitalize">{honey.type}</TableCell>
                                    <TableCell>{honey.is_recurring ? "Yes" : "No"}</TableCell>
                                    {!disabled && (
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openDialog(honey)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(honey.id)}
                                                    disabled={isDeleting === honey.id}
                                                >
                                                    {isDeleting === honey.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentHoliday.id ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
                        <DialogDescription>
                            Configure the holiday details below.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Holiday Name</Label>
                            <Input
                                id="name"
                                required
                                value={currentHoliday.name}
                                onChange={(e) => setCurrentHoliday({ ...currentHoliday, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="date">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                required
                                value={currentHoliday.date}
                                onChange={(e) => setCurrentHoliday({ ...currentHoliday, date: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="recurring"
                                checked={currentHoliday.is_recurring}
                                onCheckedChange={(checked) =>
                                    setCurrentHoliday({ ...currentHoliday, is_recurring: checked as boolean })
                                }
                            />
                            <Label htmlFor="recurring">Recurring Annually</Label>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
