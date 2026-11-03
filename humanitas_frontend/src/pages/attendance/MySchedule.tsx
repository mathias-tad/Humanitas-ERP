import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  AlertTriangle,
  Loader2,
  HelpCircle,
  Edit3,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

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
  is_day_off?: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  type?: string;
}

type TabType = "schedule" | "timecard" | "find-shifts" | "vto";

export default function MySchedule() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("schedule");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPunchTimesExpanded, setIsPunchTimesExpanded] = useState(true);

  // Missed Punch Request Dialog State
  const [isMissedPunchOpen, setIsMissedPunchOpen] = useState(false);
  const [punchType, setPunchType] = useState<"in" | "out">("in");
  const [punchTime, setPunchTime] = useState("09:00");
  const [punchReason, setPunchReason] = useState("");
  const [isSubmittingPunch, setIsSubmittingPunch] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchMonthlyData();
    }
  }, [isAuthenticated, authLoading, currentDate]);

  const fetchMonthlyData = async () => {
    setIsLoading(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();

      const [attRes, holRes] = await Promise.all([
        fetch(`${API_BASE_URL}/attendance/my-monthly-calendar?month=${month}&year=${year}`, {
          credentials: "include",
        }),
        fetch(`${API_BASE_URL}/holidays?year=${year}`, {
          credentials: "include",
        }),
      ]);

      if (attRes.ok) {
        const data = await attRes.json();
        setRecords(data || []);
      }
      if (holRes.ok) {
        const data = await holRes.json();
        setHolidays(data || []);
      }
    } catch (err) {
      console.error("Failed to load schedule data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  };

  const getRecordForDate = (date: Date | null) => {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    return records.find((r) => {
      const rDate = r.date.split("T")[0];
      return rDate === dateStr;
    }) || null;
  };

  const getHolidayForDate = (date: Date | null) => {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    return holidays.find((h) => {
      const hDate = h.date.split("T")[0];
      return hDate === dateStr;
    }) || null;
  };

  const isToday = (d: Date | null) => {
    if (!d) return false;
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date | null) => {
    if (!d || !selectedDay) return false;
    return (
      d.getDate() === selectedDay.getDate() &&
      d.getMonth() === selectedDay.getMonth() &&
      d.getFullYear() === selectedDay.getFullYear()
    );
  };

  // Determine visual day state matching the screenshots:
  // 1. Punches (Solid Blue)
  // 2. Attention (Red polygon)
  // 3. Scheduled Shifts (Light blue diagonal hatch)
  // 4. Payday (Dot on 25th or last working day)
  const getDayVisualState = (date: Date | null) => {
    if (!date) return null;
    const rec = getRecordForDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isPastOrToday = date <= today;
    const hasPunched = !!(rec && rec.actual_in);
    const hasScheduledShift = !!(rec && (rec.scheduled_in || rec.shift_name) && !rec.is_day_off);
    const isPayday = date.getDate() === 25; // Standard 25th payday dot

    // Attention conditions:
    // Missed punch on a scheduled past day, or punched in without clocking out on a past day, or marked absent
    const statusLower = rec?.status?.toLowerCase() || "";
    const isAttention =
      (isPastOrToday && hasScheduledShift && !hasPunched) ||
      (isPastOrToday && hasPunched && !rec?.actual_out && date < today) ||
      statusLower.includes("absent") ||
      statusLower.includes("late");

    if (isAttention) {
      return { type: "attention", isPayday, rec };
    }
    if (hasPunched) {
      return { type: "punches", isPayday, rec };
    }
    if (hasScheduledShift) {
      return { type: "scheduled", isPayday, rec };
    }
    return { type: "empty", isPayday, rec };
  };

  const formatMonthTitle = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatSelectedDateHeader = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).toUpperCase();
  };

  const formatTimeOnly = (isoOrTime?: string) => {
    if (!isoOrTime) return "--:--";
    try {
      if (isoOrTime.includes("T")) {
        const d = new Date(isoOrTime);
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      }
      return isoOrTime.substring(0, 5);
    } catch {
      return isoOrTime;
    }
  };

  const handleMissedPunchSubmit = async () => {
    if (!selectedDay) return;
    setIsSubmittingPunch(true);
    try {
      const y = selectedDay.getFullYear();
      const m = String(selectedDay.getMonth() + 1).padStart(2, "0");
      const d = String(selectedDay.getDate()).padStart(2, "0");
      const targetDate = `${y}-${m}-${d}`;

      const res = await fetch(`${API_BASE_URL}/attendance/corrections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: targetDate,
          punch_type: punchType,
          requested_time: punchTime,
          reason: punchReason,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to submit punch correction");
      }

      toast.success("Punch correction submitted for manager review");
      setIsMissedPunchOpen(false);
      setPunchReason("");
      fetchMonthlyData();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setIsSubmittingPunch(false);
    }
  };

  const days = getDaysInMonth(currentDate);
  const selectedDayRecord = getRecordForDate(selectedDay);
  const selectedDayHoliday = getHolidayForDate(selectedDay);
  const hasPunchesForSelected = !!(selectedDayRecord && selectedDayRecord.actual_in);
  const punchCount = hasPunchesForSelected ? (selectedDayRecord?.actual_out ? 2 : 1) : 0;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5 animate-fadeIn">
      {/* Top Header & Sub-Tabs */}
      <div>
        <div className="flex items-center justify-between pb-2">
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Schedule
          </h1>
          <div className="flex items-center gap-2">
            <Link to="/attendance/clock-in">
              <Button size="sm" className="h-8 px-3 text-xs font-bold gold-gradient text-slate-950">
                <LogIn className="h-3.5 w-3.5 mr-1" />
                Clock In
              </Button>
            </Link>
          </div>
        </div>

        {/* Subtabs Bar matching Screenshot */}
        <div className="flex items-center gap-6 border-b border-border text-sm font-semibold overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("schedule")}
            className={`pb-2.5 transition-colors relative whitespace-nowrap ${
              activeTab === "schedule"
                ? "text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Schedule
          </button>
          <button
            onClick={() => {
              setActiveTab("timecard");
              navigate("/attendance/my-attendance");
            }}
            className="pb-2.5 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            Timecard
          </button>
          <button
            onClick={() => {
              setActiveTab("find-shifts");
              navigate("/hr/scheduling");
            }}
            className="pb-2.5 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            Find Shifts
          </button>
          <button
            onClick={() => {
              setActiveTab("vto");
              navigate("/hr/scheduling");
            }}
            className="pb-2.5 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap flex items-center gap-0.5"
          >
            <span>VTO</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Schedule Calendar Card */}
      <Card className="border-border shadow-sm overflow-hidden bg-card">
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Month Navigator Header (< October 2026 >) */}
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-foreground">
              {formatMonthTitle(currentDate)}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="w-full">
            {/* Weekday Row */}
            <div className="grid grid-cols-7 mb-1 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
                <div key={dayName} className="text-xs font-semibold text-muted-foreground py-1">
                  {dayName}
                </div>
              ))}
            </div>

            {/* Day Cells Grid */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                <span className="text-xs text-muted-foreground">Loading schedule...</span>
              </div>
            ) : (
              <div className="grid grid-cols-7 border-t border-l border-border/80">
                {days.map((date, idx) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="h-14 sm:h-16 border-r border-b border-border/80 bg-surface-1/30"
                      />
                    );
                  }

                  const visual = getDayVisualState(date);
                  const isSelectedDate = isSelected(date);
                  const isCurDay = isToday(date);
                  const isPayday = visual?.isPayday;

                  // Visual style based on status:
                  // 1. Punches: solid vibrant blue (#1D70B8 / #2563EB)
                  // 2. Attention: red badge/fill
                  // 3. Scheduled: light blue diagonal hatch pattern
                  // 4. Empty: plain white / dark surface
                  let cellBgStyle: React.CSSProperties = {};
                  let cellClasses = "border-r border-b border-border/80 flex flex-col justify-between p-1.5 transition-all cursor-pointer relative h-14 sm:h-16 ";

                  if (visual?.type === "punches") {
                    cellClasses += "bg-[#1D70B8] text-white ";
                  } else if (visual?.type === "attention") {
                    cellClasses += "bg-rose-600 text-white ";
                  } else if (visual?.type === "scheduled") {
                    cellClasses += "text-foreground ";
                    cellBgStyle = {
                      background:
                        "repeating-linear-gradient(45deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.12) 4px, rgba(59, 130, 246, 0.28) 4px, rgba(59, 130, 246, 0.28) 8px)",
                    };
                  } else {
                    cellClasses += "bg-card hover:bg-surface-1 text-foreground ";
                  }

                  // Selected day indicator (prominent gold / amber border ring)
                  if (isSelectedDate) {
                    cellClasses += "ring-2 ring-amber-500 ring-offset-1 z-10 font-black shadow-md ";
                  }

                  return (
                    <div
                      key={date.toISOString()}
                      onClick={() => setSelectedDay(date)}
                      className={cellClasses}
                      style={cellBgStyle}
                    >
                      {/* Top: Date Number & Payday dot */}
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs sm:text-sm font-bold ${
                            visual?.type === "punches" || visual?.type === "attention"
                              ? "text-white"
                              : isCurDay
                              ? "text-blue-600 dark:text-blue-400 font-black"
                              : "text-foreground"
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {/* Attention Icon Indicator */}
                        {visual?.type === "attention" && (
                          <AlertTriangle className="h-3 w-3 text-white shrink-0 fill-white" />
                        )}
                      </div>

                      {/* Bottom indicator: Payday dot or status tag */}
                      <div className="flex items-center justify-center">
                        {isPayday && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              visual?.type === "punches" || visual?.type === "attention"
                                ? "bg-white"
                                : "bg-blue-600 dark:bg-blue-400"
                            }`}
                            title="Payday"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend Bar (matching screenshot exactly) */}
          <div className="flex flex-wrap items-center gap-5 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-[#1D70B8] shrink-0" />
              <span className="font-medium text-foreground">Punches</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-rose-600 shrink-0 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              </span>
              <span className="font-medium text-foreground">Attention</span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0 border border-blue-400"
                style={{
                  background:
                    "repeating-linear-gradient(45deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.2) 2px, rgba(59, 130, 246, 0.5) 2px, rgba(59, 130, 246, 0.5) 4px)",
                }}
              />
              <span className="font-medium text-foreground">Scheduled shifts</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
              <span className="font-medium text-foreground">Payday</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Details Section (matching screenshot bottom pane) */}
      <div className="space-y-3 pt-2">
        {/* Selected Date Title in bold uppercase */}
        <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
          {formatSelectedDateHeader(selectedDay)}
        </h3>

        {/* Punch Times Card */}
        <Card className="border-border shadow-sm overflow-hidden bg-card">
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Header: Punch times (N) + Missed a punch? */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsPunchTimesExpanded(!isPunchTimesExpanded)}
                className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-foreground hover:opacity-80 transition-opacity"
              >
                <span>Punch times ({punchCount})</span>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </button>

              <button
                onClick={() => {
                  setPunchType(selectedDayRecord?.actual_in && !selectedDayRecord?.actual_out ? "out" : "in");
                  setIsMissedPunchOpen(true);
                }}
                className="text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <span>Missed a punch?</span>
              </button>
            </div>

            {/* Disclaimer note */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Please note that it may take up to 5 minutes for any changes to appear on this page.
            </p>

            {/* Punches Timeline or Empty State */}
            {isPunchTimesExpanded && (
              <div className="pt-2">
                {hasPunchesForSelected ? (
                  /* Vertical Punch Timeline matching screenshot */
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-500">
                    {/* IN Punch */}
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900" />
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-foreground uppercase tracking-wide block">
                            In
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {selectedDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-foreground">
                            {formatTimeOnly(selectedDayRecord?.actual_in)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPunchType("in");
                              setIsMissedPunchOpen(true);
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* OUT Punch */}
                    <div className="relative">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-100 dark:ring-blue-900" />
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-foreground uppercase tracking-wide block">
                            Out
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {selectedDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-foreground">
                            {selectedDayRecord?.actual_out
                              ? formatTimeOnly(selectedDayRecord.actual_out)
                              : "No Out Punch"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPunchType("out");
                              setIsMissedPunchOpen(true);
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 0 Punches State matching Screenshot 2 */
                  <div className="text-center py-8 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto border border-blue-500/20">
                      <Clock className="h-7 w-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">No punches recorded</h4>
                      {selectedDayRecord?.shift_name ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Scheduled Shift: <span className="font-semibold text-foreground">{selectedDayRecord.shift_name}</span>{" "}
                          ({selectedDayRecord.scheduled_in?.substring(0, 5)} - {selectedDayRecord.scheduled_out?.substring(0, 5)})
                        </p>
                      ) : selectedDayHoliday ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Official Holiday: <span className="font-semibold text-foreground">{selectedDayHoliday.name}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          No punch activity or shift logs found for this date.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Missed Punch Correction Dialog */}
      <Dialog open={isMissedPunchOpen} onOpenChange={setIsMissedPunchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Submit Missed Punch Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <Input
                type="text"
                disabled
                value={selectedDay.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                className="mt-1 bg-surface-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Punch Type</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={punchType === "in" ? "default" : "outline"}
                    onClick={() => setPunchType("in")}
                    className="flex-1 h-8 text-xs font-bold"
                  >
                    IN
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={punchType === "out" ? "default" : "outline"}
                    onClick={() => setPunchType("out")}
                    className="flex-1 h-8 text-xs font-bold"
                  >
                    OUT
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Requested Time</Label>
                <Input
                  type="time"
                  value={punchTime}
                  onChange={(e) => setPunchTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Reason for Missed Punch *</Label>
              <Textarea
                placeholder="e.g. Forgot to clock in upon arrival / scanner error"
                value={punchReason}
                onChange={(e) => setPunchReason(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsMissedPunchOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleMissedPunchSubmit}
              disabled={isSubmittingPunch || !punchReason.trim()}
              className="gold-gradient text-slate-950 font-bold"
            >
              {isSubmittingPunch ? "Submitting..." : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
