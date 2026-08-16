import { useState } from "react";
import { format, startOfWeek, endOfWeek, addDays, subDays, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useUsers } from "@/hooks/useUsers";
import { useShifts, usePatterns } from "@/hooks/useScheduling";
import { RefreshButton } from "@/components/ui/refresh-button";
import { usePermissions } from "@/hooks/usePermissions";
import {
    ChevronLeft,
    ChevronRight,
    Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";

interface Shift {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    color: string;
    is_active: boolean;
    // Alternative field names used by SchedulingService response
    start?: string;
    end?: string;
}

interface User {
    id: string;
    full_name: string;
    email: string;
    department?: string;
    position?: string;
}

interface Schedule {
    id: string;
    user_id: string;
    shift_id?: string;
    date: string;
    is_day_off: boolean;
    is_override: boolean;
    note?: string;
    shift?: Shift;
    updated_by_name?: string;
    updated_at?: string;
    has_attendance?: boolean;
    holiday_name?: string;
}

export function SchedulerView() {
    const [currentDate, setCurrentDate] = useState(new Date());


    // Assignment Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [assignmentForm, setAssignmentForm] = useState({
        shift_id: "",
        is_day_off: false,
        note: ""
    });
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // --- TANSTACK QUERY INTEGRATION ---
    const { data: users = [], isLoading: isLoadingUsers } = useUsers();
    const { data: shifts = [], isLoading: isLoadingShifts } = useShifts();
    const { data: patterns = [], isLoading: isLoadingPatterns } = usePatterns();

    // MISSING STATE RESTORATION
    const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
    const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
    const { hasPermission } = usePermissions();

    // Derived state for filtered users
    const filteredUsers = users.filter(user =>
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.department && user.department.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Calculate week range for schedule fetching
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });

    // Fetch schedules for ALL users in the view (optimally this should be a bulk endpoint, 
    // but for now we map hooks or use a component-level fetcher if the hook is single-user)
    // NOTE: The previous logic fetched per-user. Calling useUserSchedule for 50 users is bad.
    // Ideally, we need a BULK endpoint. Since we don't have one readily available in hooks yet,
    // let's create a temporary specialized bulk query OR iterate if the list is small.
    //
    // HOWEVER, to match the previous logic exactly without refactoring the backend yet:
    // The previous logic did `Promise.all(users.map(...))`.
    // We can replicate this using `useQueries` or a single `useQuery` that does the Promise.all.

    // Let's use a single useQuery for the *Roster Grid* to keep it simple and fast.
    const { data: schedules = [], isLoading: isLoadingSchedules, refetch: refetchSchedules } = useQuery({
        queryKey: ['roster-schedules', format(start, 'yyyy-MM-dd'), users.map((u: User) => u.id).join(',')],
        queryFn: async () => {
            if (users.length === 0) return [];
            const promises = users.map((user: User) =>
                fetch(`${API_BASE_URL}/attendance/user-schedule/${user.id}?startDate=${format(start, 'yyyy-MM-dd')}&endDate=${format(end, 'yyyy-MM-dd')}`, { credentials: 'include' }).then(res => res.json())
            );
            const results = await Promise.all(promises);
            return results.flat();
        },
        enabled: users.length > 0,
        staleTime: 60 * 1000,
    });

    const isLoading = isLoadingUsers || isLoadingShifts || isLoadingPatterns || isLoadingSchedules;




    const handlePreviousWeek = () => setCurrentDate(subDays(currentDate, 7));
    const handleNextWeek = () => setCurrentDate(addDays(currentDate, 7));
    const handleToday = () => setCurrentDate(new Date());

    const getWeekDays = () => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(start, i));
        }
        return days;
    };

    const weekDays = getWeekDays();

    // Helper to find schedule for a cell
    const getScheduleForCell = (userId: string, date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        // Cast to Schedule because the query returns raw JSON which matches the shape roughly but we want strict typing if possible.
        // The error TS6196 'Schedule is declared but never used' suggests we aren't using the type.
        // We can cast here to use it.
        return schedules.find((s: Schedule) => s.user_id === userId && s.date === dateStr) as Schedule | undefined;
    };

    const handleCellClick = (user: User, date: Date) => {
        const existing = getScheduleForCell(user.id, date);
        setSelectedUser(user);
        setSelectedDate(date);

        setAssignmentForm({
            shift_id: existing?.shift_id || "",
            is_day_off: existing?.is_day_off || false,
            note: existing?.note || ""
        });

        setIsAssignModalOpen(true);
    };

    const handleSaveAssignment = async () => {
        if (!selectedUser || !selectedDate) return;

        setIsSaving(true);
        try {
            const payload = {
                user_id: selectedUser.id,
                date: format(selectedDate, 'yyyy-MM-dd'),
                shift_id: assignmentForm.is_day_off ? null : (assignmentForm.shift_id || null),
                is_day_off: assignmentForm.is_day_off,
                note: assignmentForm.note
            };

            const response = await fetch(`${API_BASE_URL}/attendance/assign-schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success("Schedule updated");
                setIsAssignModalOpen(false);
                refetchSchedules(); // Refresh grid
            } else {
                const error = await response.json();
                toast.error(error.message || "Failed to update schedule");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        } finally {
            setIsSaving(false);
        }
    };

    // Pattern Assignment State
    const [patternForm, setPatternForm] = useState({
        user_id: "",
        pattern_id: "",
        start_date: format(new Date(), 'yyyy-MM-dd'),
        day_off_days: [] as number[],
        auto_rotate_dayoff: true
    });

    const handleAssignPattern = async () => {
        if (!patternForm.user_id || !patternForm.pattern_id || !patternForm.start_date) {
            toast.error("Please fill all required fields");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                user_id: patternForm.user_id,
                pattern_id: patternForm.pattern_id === 'standard_schedule' ? undefined : patternForm.pattern_id,
                start_date: patternForm.start_date,
                day_off_days: patternForm.day_off_days,
                auto_rotate_dayoff: patternForm.auto_rotate_dayoff
            };

            const response = await fetch(`${API_BASE_URL}/attendance/assign-pattern`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success("Pattern assigned successfully");
                setIsPatternModalOpen(false);
                refetchSchedules();
            } else {
                const error = await response.json();
                toast.error(error.message || "Failed to assign pattern");
            }
        } catch (error) {
            console.error(error);
            toast.error("Network error");
        } finally {
            setIsSaving(false);
        }
    };

    // Calculate Roster Stats
    const rosterStats = weekDays.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const daySchedules = schedules.filter((s: Schedule) => s.date === dateStr);
        //const totalStaff = users.length;
        const dayOffs = daySchedules.filter((s: Schedule) => s.is_day_off).length;
        const shiftsMap: { [key: string]: number } = {};

        daySchedules.filter((s: Schedule) => !s.is_day_off && s.shift?.name).forEach((s: Schedule) => {
            const name = s.shift!.name;
            shiftsMap[name] = (shiftsMap[name] || 0) + 1;
        });

        // Implicitly, users without a schedule record might be considered "Standard" or "Empty"? 
        // For now, only counting explicit records.

        return {
            date: day,
            dayOffs,
            shifts: shiftsMap
        };
    });

    return (
        <Card className="h-full flex flex-col gap-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle>Team Roster</CardTitle>
                    <CardDescription>Manage weekly schedules and assignments</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    {hasPermission('manage_shift_assignment') && (
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => setIsPatternModalOpen(true)}
                        >
                            Assign Pattern
                        </Button>
                    )}
                    <div className="relative w-64 mr-2">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search employees..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-9"
                        />
                    </div>
                    <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" onClick={handlePreviousWeek}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 font-medium min-w-[140px] text-center">
                            {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleNextWeek}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
                    <RefreshButton
                        queryKey={[['roster-schedules'], ['shifts'], ['patterns'], ['users']]}
                        variant="outline"
                    />
                </div>
            </CardHeader>

            {/* Roster Stats Report */}
            <div className="px-6 pb-2">
                <div className="bg-muted/30 border rounded-md p-3 text-xs">
                    <div className="font-semibold mb-2">Daily Coverage Report</div>
                    <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                            <div className="grid grid-cols-7 gap-2">
                                {rosterStats.map((stat, i) => (
                                    <div key={i} className="bg-background border rounded p-2">
                                        <div className="font-medium mb-1 text-muted-foreground">{format(stat.date, 'EEE d')}</div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Day Offs:</span>
                                                <span className="font-bold">{stat.dayOffs}</span>
                                            </div>
                                            {Object.entries(stat.shifts).map(([shift, count]) => (
                                                <div key={shift} className="flex justify-between">
                                                    <span>{shift}:</span>
                                                    <span>{count}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <CardContent className="flex-1 overflow-auto">
                <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px] sticky left-0 bg-background z-10 border-r">Employee</TableHead>
                                {weekDays.map(day => (
                                    <TableHead key={day.toString()} className={`text-center min-w-[120px] ${isSameDay(day, new Date()) ? 'bg-muted/50' : ''}`}>
                                        <div className="text-xs font-normal text-muted-foreground">{format(day, 'EEE')}</div>
                                        <div className="font-medium">{format(day, 'd')}</div>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24">Loading roster...</TableCell>
                                </TableRow>
                            ) : isLoading && users.length > 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                            <span className="text-muted-foreground">Loading schedule data...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.length === 0 && !isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No employees found matching "{searchQuery}"</TableCell>
                                </TableRow>
                            ) : filteredUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium sticky left-0 bg-background border-r z-10">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                                {user.full_name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="text-sm">{user.full_name}</div>
                                                <div className="text-xs text-muted-foreground">{user.position || user.department || "Employee"}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    {weekDays.map(day => {
                                        const schedule = getScheduleForCell(user.id, day);
                                        const isToday = isSameDay(day, new Date());
                                        const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                                        const hasAttendance = schedule?.has_attendance;
                                        const isLocked = isPast || hasAttendance;

                                        return (
                                            <TableCell
                                                key={day.toString()}
                                                className={`p-1 border-l transition-colors ${isToday ? 'bg-muted/20' : ''} ${isLocked ? 'cursor-not-allowed opacity-60 bg-gray-50/50' : 'cursor-pointer hover:bg-muted/50'}`}
                                                onClick={() => !isLocked && handleCellClick(user, day)}
                                            >
                                                {schedule ? (
                                                    schedule.is_day_off ? (
                                                        schedule.holiday_name ? (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className={`h-full min-h-[50px] rounded bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center text-xs text-purple-700 dark:text-purple-400 font-medium ${isLocked ? 'grayscale' : ''} cursor-help`}>
                                                                            OFF
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p className="font-semibold">{schedule.holiday_name}</p>
                                                                        <p className="text-xs text-muted-foreground">Public Holiday</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        ) : (
                                                            <div className={`h-full min-h-[50px] rounded bg-gray-100 dark:bg-gray-800/50 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 font-medium ${isLocked ? 'grayscale' : ''}`}>
                                                                OFF
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div
                                                            className={`h-full min-h-[50px] p-2 rounded flex flex-col justify-center text-xs border-l-4 ${schedule.is_override ? 'ring-1 ring-orange-200' : ''} ${isLocked ? 'grayscale filter brightness-95' : ''}`}
                                                            style={{
                                                                backgroundColor: schedule.shift?.color ? `${schedule.shift.color}15` : '#EFF6FF',
                                                                borderLeftColor: schedule.shift?.color || '#3B82F6'
                                                            }}
                                                        >
                                                            <div className="font-semibold truncate flex items-center gap-1">
                                                                {schedule.shift?.name || "Shift"}
                                                                {isLocked && <span className="text-[10px] opacity-70">🔒</span>}
                                                            </div>
                                                            <div className="text-muted-foreground">{schedule.shift?.start?.substring(0, 5)} - {schedule.shift?.end?.substring(0, 5)}</div>
                                                            {schedule.is_override && (
                                                                <div
                                                                    className="mt-1 flex flex-col cursor-help"
                                                                    title={`Modified by: ${schedule.updated_by_name || 'Unknown'}\nWhen: ${schedule.updated_at ? new Date(schedule.updated_at).toLocaleString() : 'Unknown'}\nReason: ${schedule.note || 'No reason provided'}`}
                                                                >
                                                                    <span className="text-[10px] text-orange-600 font-medium">Modified</span>
                                                                    {schedule.updated_by_name && (
                                                                        <span className="text-[9px] text-muted-foreground truncate">by {schedule.updated_by_name}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {schedule.has_attendance && (
                                                                <div className="mt-1 text-[10px] text-green-600 font-medium flex items-center gap-1">
                                                                    <span>✓ Worked</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className={`h-full min-h-[50px] flex items-center justify-center text-xs text-gray-300 ${isLocked ? 'bg-gray-50/50' : ''}`}>
                                                        {isLocked ? '🔒' : '-'}
                                                    </div>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* Assignment Dialog */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Shift</DialogTitle>
                        <DialogDescription>
                            {selectedUser?.full_name} - {selectedDate && format(selectedDate, 'EEEE, MMM d, yyyy')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="isDayOff"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={assignmentForm.is_day_off}
                                onChange={(e) => setAssignmentForm({ ...assignmentForm, is_day_off: e.target.checked })}
                            />
                            <Label htmlFor="isDayOff">Mark as Day Off</Label>
                        </div>

                        {!assignmentForm.is_day_off && (
                            <div className="grid gap-2">
                                <Label>Shift</Label>
                                <Select
                                    value={assignmentForm.shift_id}
                                    onValueChange={(val) => setAssignmentForm({ ...assignmentForm, shift_id: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a shift" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {shifts.map(shift => (
                                            <SelectItem key={shift.id} value={shift.id}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: shift.color }}></div>
                                                    <span>{shift.name} ({shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="note">Note (Optional)</Label>
                            <Input
                                id="note"
                                value={assignmentForm.note}
                                onChange={(e) => setAssignmentForm({ ...assignmentForm, note: e.target.value })}
                                placeholder="Reason for change..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveAssignment} disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save Assignment"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Pattern Assignment Dialog */}
            <Dialog open={isPatternModalOpen} onOpenChange={setIsPatternModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Schedule Pattern</DialogTitle>
                        <DialogDescription>
                            Auto-generate schedule based on a recurring pattern.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Employee</Label>
                            <Popover open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isUserSearchOpen}
                                        className="w-full justify-between"
                                    >
                                        {patternForm.user_id
                                            ? users.find((u) => u.id === patternForm.user_id)?.full_name
                                            : "Select employee..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search employee..." />
                                        <CommandList>
                                            <CommandEmpty>No employee found.</CommandEmpty>
                                            <CommandGroup>
                                                {users.map((u) => (
                                                    <CommandItem
                                                        key={u.id}
                                                        value={u.full_name}
                                                        onSelect={() => {
                                                            setPatternForm({ ...patternForm, user_id: u.id });
                                                            setIsUserSearchOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                patternForm.user_id === u.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {u.full_name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid gap-2">
                            <Label>Pattern</Label>
                            <Select
                                value={patternForm.pattern_id}
                                onValueChange={(val) => setPatternForm({ ...patternForm, pattern_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a pattern..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="standard_schedule">✨ Standard Schedule (Default Working Days)</SelectItem>
                                    {patterns.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label>Start Date (Day 1 of Cycle)</Label>
                            <Input
                                type="date"
                                value={patternForm.start_date}
                                onChange={(e) => setPatternForm({ ...patternForm, start_date: e.target.value })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Only change this date to stagger the pattern (e.g. rotate day offs).
                                The selected date will correspond to "Day 1" of the pattern.
                            </p>
                        </div>

                        {/* Day-Off Selection */}
                        <div className="grid gap-3 p-3 border rounded-md bg-gradient-to-r from-purple-50/50 to-blue-50/50">
                            <Label className="font-medium">Day-Off Settings</Label>

                            <div className="flex items-center space-x-2 pb-2">
                                <input
                                    type="checkbox"
                                    id="auto_rotate_dayoff"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={patternForm.auto_rotate_dayoff}
                                    onChange={(e) => setPatternForm({ ...patternForm, auto_rotate_dayoff: e.target.checked })}
                                />
                                <Label htmlFor="auto_rotate_dayoff" className="cursor-pointer">Rotate Automatically</Label>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Select Days Off (applies to whole pattern)</Label>
                                <div className="flex flex-wrap gap-2">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                                        <div
                                            key={day}
                                            className={`
                                            cursor-pointer px-3 py-1.5 rounded-md border text-sm transition-colors select-none
                                            ${patternForm.day_off_days.includes(index)
                                                    ? 'bg-purple-600 text-white border-purple-600 font-medium'
                                                    : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}
                                        `}
                                            onClick={() => {
                                                const current = patternForm.day_off_days;
                                                const updated = current.includes(index)
                                                    ? current.filter(d => d !== index)
                                                    : [...current, index];
                                                setPatternForm({ ...patternForm, day_off_days: updated });
                                            }}
                                        >
                                            {day}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground mt-1">
                                {patternForm.auto_rotate_dayoff
                                    ? "Selected days will shift forward by 1 day every week (e.g. Mon → Tue)."
                                    : "Selected days will repeat every week."}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPatternModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAssignPattern} disabled={isSaving}>
                            {isSaving ? "Assigning..." : "Assign Pattern"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
