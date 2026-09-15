import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  XCircle,
  CheckCircle,
  Coffee,
  AlertCircle,
  Loader2,
  CalendarCheck,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";
import { Link } from "react-router-dom";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  actual_in?: string;
  actual_out?: string;
  work_hours?: string | { hours: number; minutes: number };
  remarks?: string;
  shift_name?: string;
  shift_color?: string;
  scheduled_in?: string;
  scheduled_out?: string;
}

const getStatusColor = (status: string) => {
  const s = status?.toLowerCase() || "";

  if (s.includes("present")) {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
  } else if (s.includes("absent")) {
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
  } else if (s.includes("late")) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
  } else if (s.includes("early")) {
    return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20";
  } else if (s.includes("half") || s.includes("pending")) {
    return "bg-primary/10 text-primary border border-primary/20";
  } else if (s.includes("leave") || s.includes("day-off") || s.includes("off")) {
    return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20";
  } else if (s.includes("scheduled")) {
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20";
  } else {
    return "bg-surface-2 text-muted-foreground border border-border";
  }
};

const getStatusIcon = (status: string) => {
  const s = status?.toLowerCase() || "";

  if (s.includes("present")) {
    return <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  } else if (s.includes("absent")) {
    return <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />;
  } else if (s.includes("late")) {
    return <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  } else if (s.includes("early") || s.includes("half")) {
    return <Clock className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
  } else if (s.includes("leave") || s.includes("day-off") || s.includes("off")) {
    return <Coffee className="h-3.5 w-3.5 text-violet-500 shrink-0" />;
  } else {
    return <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const days: (Date | null)[] = [];

  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return days;
};

export default function Calendar() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchAttendance();
      fetchHolidays();
    }
  }, [isAuthenticated, authLoading, currentDate]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const response = await fetch(
        `${API_BASE_URL}/attendance/my-monthly-calendar?month=${month}&year=${year}`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setAttendance(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch attendance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await fetch(
        `${API_BASE_URL}/holidays?year=${year}`,
        { credentials: "include" }
      );

      if (response.ok) {
        const data = await response.json();
        setHolidays(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch holidays:", error);
    }
  };

  const getHolidayForDate = (date: Date | null) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    return holidays.find((h) => {
      const holidayDate = h.date.split("T")[0];
      return holidayDate === dateStr;
    }) || null;
  };

  const getAttendanceForDate = (date: Date | null) => {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    return attendance.find((record) => {
      const recordDate = record.date.split("T")[0];
      return recordDate === dateStr;
    }) || null;
  };

  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return undefined;
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
      return timeStr.substring(0, 5);
    } catch {
      return timeStr;
    }
  };

  const formatWorkHours = (workHours: any) => {
    if (!workHours) return undefined;
    if (typeof workHours === "string") return workHours;
    if (typeof workHours === "object") {
      const hours = workHours.hours || 0;
      const minutes = workHours.minutes || 0;
      return `${hours}h ${minutes}m`;
    }
    return String(workHours);
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date());
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date | null) => {
    if (!date || !selectedDay) return false;
    return (
      date.getDate() === selectedDay.getDate() &&
      date.getMonth() === selectedDay.getMonth() &&
      date.getFullYear() === selectedDay.getFullYear()
    );
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = [
    { name: "Sun", isWeekend: true },
    { name: "Mon", isWeekend: false },
    { name: "Tue", isWeekend: false },
    { name: "Wed", isWeekend: false },
    { name: "Thu", isWeekend: false },
    { name: "Fri", isWeekend: false },
    { name: "Sat", isWeekend: true },
  ];

  const stats = {
    present: attendance.filter((r) => r.status?.toLowerCase().includes("present")).length,
    absent: attendance.filter((r) => r.status?.toLowerCase().includes("absent")).length,
    late: attendance.filter((r) => r.status?.toLowerCase().includes("late")).length,
    dayOff: attendance.filter(
      (r) =>
        r.status?.toLowerCase().includes("leave") ||
        r.status?.toLowerCase().includes("day-off") ||
        r.status?.toLowerCase().includes("off")
    ).length,
  };

  const totalTrackedDays = stats.present + stats.absent + stats.late;
  const attendanceRate = totalTrackedDays > 0 ? Math.round((stats.present / totalTrackedDays) * 100) : 100;

  const selectedDayAttendance = selectedDay ? getAttendanceForDate(selectedDay) : null;
  const selectedDayHoliday = selectedDay ? getHolidayForDate(selectedDay) : null;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      <PageHeader
        title="My Attendance Calendar"
        description="Monitor your monthly punch times, scheduled shift rosters, overtime hours, and leave history."
        breadcrumbs={[
          { label: "HRMS", href: "/dashboard" },
          { label: "Attendance", href: "/attendance/view" },
          { label: "Calendar" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentMonth}
              className="h-9 px-3 text-xs font-semibold border-border hover:bg-surface-1"
            >
              Today
            </Button>
            <Link to="/attendance/clock-in">
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-bold gold-gradient gold-glow border-none text-slate-950 transition-transform hover:scale-105"
              >
                <LogIn className="h-4 w-4 mr-1.5 stroke-[2.5]" />
                Clock In
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Present Days"
          value={stats.present}
          subtitle="On-time working days"
          icon={CheckCircle}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <KPITile
          title="Absent Days"
          value={stats.absent}
          subtitle="Unexcused or missing logs"
          icon={XCircle}
          iconColor="text-rose-500"
          iconBg="bg-rose-500/10"
        />
        <KPITile
          title="Late Arrivals"
          value={stats.late}
          subtitle="Shift grace period exceeded"
          icon={AlertCircle}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
        <KPITile
          title="Days Off & Leaves"
          value={stats.dayOff}
          subtitle="Approved leave or rest days"
          icon={Coffee}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border bg-surface-1/50 py-3.5 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                      {formatMonth(currentDate)}
                    </h2>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Click any date to inspect shift intervals and punch timestamps
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-0.5 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Previous Month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToCurrentMonth}
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    Current
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextMonth}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Next Month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">Loading calendar records...</span>
                </div>
              ) : (
                <div className="w-full">
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                    {weekDays.map((day) => (
                      <div
                        key={day.name}
                        className={`text-center text-xs font-bold py-1.5 rounded-md ${
                          day.isWeekend
                            ? "text-muted-foreground/60 bg-surface-1/40"
                            : "text-muted-foreground bg-surface-1"
                        }`}
                      >
                        {day.name}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {days.map((date, index) => {
                      if (!date) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-[90px] sm:min-h-[110px] rounded-xl border border-dashed border-border/40 bg-surface-1/20"
                          />
                        );
                      }

                      const dayAttendance = getAttendanceForDate(date);
                      const holiday = getHolidayForDate(date);
                      const isCurrentDay = isToday(date);
                      const isSelectedDate = isSelected(date);
                      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                      return (
                        <div
                          key={date.toISOString()}
                          onClick={() => setSelectedDay(date)}
                          className={`min-h-[95px] sm:min-h-[115px] p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                            isSelectedDate
                              ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-md"
                              : isCurrentDay
                              ? "border-primary/60 bg-primary/5 shadow-sm"
                              : holiday
                              ? "border-violet-500/30 bg-violet-500/5 hover:border-violet-500/50"
                              : isWeekend
                              ? "border-border/60 bg-surface-1/30 hover:bg-surface-1 hover:border-border"
                              : "border-border bg-card hover:bg-surface-1 hover:border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs sm:text-sm font-bold flex items-center justify-center rounded-lg ${
                                isCurrentDay
                                  ? "w-6 h-6 bg-primary text-slate-950 gold-gradient font-black shadow-sm"
                                  : isSelectedDate
                                  ? "text-primary font-black"
                                  : isWeekend
                                  ? "text-muted-foreground/60"
                                  : "text-foreground"
                              }`}
                            >
                              {date.getDate()}
                            </span>

                            {holiday && (
                              <Badge
                                variant="outline"
                                className="text-[9px] px-1 py-0 h-4 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 font-semibold"
                              >
                                Holiday
                              </Badge>
                            )}
                          </div>

                          <div className="my-1 space-y-1">
                            {holiday && (
                              <p
                                className="text-[10px] font-semibold text-violet-600 dark:text-violet-400 truncate"
                                title={holiday.name}
                              >
                                {holiday.name}
                              </p>
                            )}

                            {dayAttendance ? (
                              <Badge
                                className={`text-[10px] px-1.5 py-0.5 h-auto w-full justify-start font-semibold rounded-md border ${getStatusColor(
                                  dayAttendance.status
                                )}`}
                              >
                                <span className="flex items-center gap-1 truncate">
                                  {getStatusIcon(dayAttendance.status)}
                                  <span className="truncate">{dayAttendance.status}</span>
                                </span>
                              </Badge>
                            ) : !holiday && isWeekend ? (
                              <span className="text-[10px] text-muted-foreground/40 font-medium italic block text-center">
                                Weekend
                              </span>
                            ) : null}
                          </div>

                          {dayAttendance && (dayAttendance.actual_in || dayAttendance.actual_out) ? (
                            <div className="text-[9px] font-mono text-muted-foreground flex items-center justify-between border-t border-border/50 pt-1">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {formatTime(dayAttendance.actual_in) || "--"}
                              </span>
                              <span>&rarr;</span>
                              <span className="text-rose-600 dark:text-rose-400">
                                {formatTime(dayAttendance.actual_out) || "--"}
                              </span>
                            </div>
                          ) : dayAttendance?.scheduled_in ? (
                            <div className="text-[9px] font-mono text-muted-foreground/70 flex items-center gap-1 border-t border-border/40 pt-1">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">
                                {formatTime(dayAttendance.scheduled_in)}-{formatTime(dayAttendance.scheduled_out)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3 px-4 bg-surface-1/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {selectedDay
                    ? selectedDay.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    : "Day Details"}
                </CardTitle>
                {selectedDay && isToday(selectedDay) && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                    Today
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {selectedDayAttendance ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs text-muted-foreground">Attendance Status</span>
                    <Badge className={getStatusColor(selectedDayAttendance.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(selectedDayAttendance.status)}
                        {selectedDayAttendance.status}
                      </span>
                    </Badge>
                  </div>

                  {selectedDayAttendance.shift_name && (
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                      <span className="text-muted-foreground">Assigned Shift</span>
                      <Badge variant="outline" className="font-mono text-xs border-border">
                        {selectedDayAttendance.shift_name}
                      </Badge>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-surface-1 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                        Check In
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        <LogIn className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatTime(selectedDayAttendance.actual_in) || "No Punch"}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-surface-1 border border-border">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold block mb-1">
                        Check Out
                      </span>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                        <LogOut className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatTime(selectedDayAttendance.actual_out) || "No Punch"}</span>
                      </div>
                    </div>
                  </div>

                  {selectedDayAttendance.work_hours && (
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Total Work Hours</span>
                      <span className="font-mono font-bold text-primary">
                        {formatWorkHours(selectedDayAttendance.work_hours)}
                      </span>
                    </div>
                  )}

                  {selectedDayAttendance.remarks && (
                    <div className="p-2.5 rounded-xl bg-surface-1 border border-border text-xs text-muted-foreground italic">
                      💬 {selectedDayAttendance.remarks}
                    </div>
                  )}
                </div>
              ) : selectedDayHoliday ? (
                <div className="text-center py-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-600 flex items-center justify-center mx-auto">
                    <Coffee className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">{selectedDayHoliday.name}</h4>
                  <p className="text-xs text-muted-foreground">Official Company / Public Holiday</p>
                </div>
              ) : (
                <div className="text-center py-6 space-y-1.5">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-medium text-foreground">No logs recorded for this day</p>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedDay && (selectedDay.getDay() === 0 || selectedDay.getDay() === 6)
                      ? "Standard weekend off"
                      : "No punch activity found"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3 px-4 bg-surface-1/50">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Monthly Attendance Health
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Punctuality Score</span>
                <span className="text-lg font-black text-foreground">{attendanceRate}%</span>
              </div>
              <div className="w-full bg-surface-2 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary gold-gradient h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Based on {totalTrackedDays} logged working days in {formatMonth(currentDate)}.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3 px-4 bg-surface-1/50">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Status Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold truncate">Present</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold truncate">Absent</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold truncate">Late Arrival</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400">
                  <Coffee className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold truncate">Day Off / Leave</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold truncate">Half Day</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400">
                  <span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">H</span>
                  <span className="font-semibold truncate">Holiday</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
