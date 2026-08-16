import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string; // Present, Absent, Late, Early Leave, etc.
  actual_in?: string;
  actual_out?: string;
  work_hours?: string | { hours: number; minutes: number }; // Can be string or PostgreSQL interval object
  remarks?: string;
  shift_name?: string;
  shift_color?: string;
  scheduled_in?: string;
  scheduled_out?: string;
}

const getStatusColor = (status: string) => {
  const normalizedStatus = status?.toLowerCase() || "";

  if (normalizedStatus.includes("present")) {
    return "bg-green-500/15 text-green-600 border-green-500/20";
  } else if (normalizedStatus.includes("absent")) {
    return "bg-red-500/15 text-red-600 border-red-500/20";
  } else if (normalizedStatus.includes("late")) {
    return "bg-yellow-500/15 text-yellow-600 border-yellow-500/20";
  } else if (normalizedStatus.includes("early")) {
    return "bg-orange-500/15 text-orange-600 border-orange-500/20";
  } else if (normalizedStatus.includes("half") || normalizedStatus.includes("pending")) {
    return "bg-primary/10 text-primary border-primary/20";
  } else if (normalizedStatus.includes("leave") || normalizedStatus.includes("day-off")) {
    return "bg-purple-500/15 text-purple-600 border-purple-500/20";
  } else if (normalizedStatus.includes("scheduled")) {
    return "bg-indigo-500/15 text-indigo-600 border-indigo-500/20";
  } else {
    return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusIcon = (status: string) => {
  const normalizedStatus = status?.toLowerCase() || "";

  if (normalizedStatus.includes("present")) {
    return <CheckCircle className="h-4 w-4" />;
  } else if (normalizedStatus.includes("absent")) {
    return <XCircle className="h-4 w-4" />;
  } else if (normalizedStatus.includes("late")) {
    return <AlertCircle className="h-4 w-4" />;
  } else if (normalizedStatus.includes("early") || normalizedStatus.includes("half")) {
    return <Clock className="h-4 w-4" />;
  } else if (normalizedStatus.includes("leave") || normalizedStatus.includes("day-off")) {
    return <Coffee className="h-4 w-4" />;
  } else if (normalizedStatus.includes("scheduled")) {
    return <Clock className="h-4 w-4" />;
  } else {
    return <CalendarIcon className="h-4 w-4" />;
  }
};

const getDaysInMonth = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)

  const days: (Date | null)[] = [];

  // Add empty slots for days before the 1st of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }

  // Add actual days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return days;
};

function Calendar() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  /* Restoring missing state and fetch logic */
  const [currentDate, setCurrentDate] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch attendance records and holidays
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchAttendance();
      fetchHolidays();
    }
  }, [isAuthenticated, authLoading, currentDate]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const month = currentDate.getMonth() + 1; // 0-indexed
      const year = currentDate.getFullYear();

      const response = await fetch(
        `${API_BASE_URL}/attendance/my-records?month=${month}&year=${year}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setAttendance(data);
      } else {
        console.error('Failed to fetch attendance');
        setAttendance([]);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendance([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/holidays`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error('[Calendar] Error fetching holidays:', error);
    }
  };

  const getHolidayForDate = (date: Date | null) => {
    if (!date) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const monthDay = dateStr.substring(5);

    return holidays.find(h => {
      if (!h.date) return false;

      // Parse holiday date
      // If it's stored as "YYYY-MM-DD", splitting T is fine.
      // If it's ISO, we should parse it.
      // But we want to preserve the "intended" date.
      // If backend says "2024-05-01T00:00:00.000Z", it means May 1st.
      // We should treat it as UTC string and extract the date part directly from the string 
      // without timezone conversion, because usually holidays are defined as "Dates" not "Moments in Time".
      let hDateStr = String(h.date);
      if (hDateStr.includes('T')) {
        hDateStr = hDateStr.split('T')[0];
      }

      // Check exact date
      if (hDateStr === dateStr) return true;

      // Check recurring date (ignoring year)
      if (h.is_recurring && hDateStr.substring(5) === monthDay) return true;

      return false;
    });
  };

  // ... (existing getAttendanceForDate, formatTime, etc.) will be preserved by context matching if possible, but simpler to just insert helper and update render

  const getAttendanceForDate = (date: Date | null): AttendanceRecord | null => {
    if (!date) return null;

    // Format date string directly from date components to avoid timezone issues
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`; // e.g., "2025-12-11"

    // Find matching attendance record
    const found = attendance.find((record) => {
      // Extract date portion from backend's ISO timestamp
      const recordDate = record.date.split("T")[0]; // Convert "2025-12-11T00:00:00.000Z" to "2025-12-11"
      return recordDate === dateStr;
    });

    return found || null;
  };

  // ... formatTime, formatWorkHours, formatMonth, goToPreviousMonth, goToNextMonth, isToday ...

  // Format time from "HH:MM:SS" or ISO string to "HH:MM"
  const formatTime = (timeStr: string | undefined) => {
    if (!timeStr) return undefined;
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString("en-US", {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }
      return timeStr.substring(0, 5);
    } catch {
      return timeStr;
    }
  };

  const formatWorkHours = (workHours: any) => {
    if (!workHours) return undefined;
    if (typeof workHours === 'string') return workHours;
    if (typeof workHours === 'object') {
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

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const stats = {
    present: attendance.filter((r) => r.status?.toLowerCase().includes("present")).length,
    absent: attendance.filter((r) => r.status?.toLowerCase().includes("absent")).length,
    late: attendance.filter((r) => r.status?.toLowerCase().includes("late")).length,
    dayOff: attendance.filter((r) =>
      r.status?.toLowerCase().includes("leave") ||
      r.status?.toLowerCase().includes("day-off")
    ).length,
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header and Stats Cards ... (Using existing code structure, simplified update) */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              My Attendance Calendar
            </h1>
            <p className="text-gray-500 mt-1">
              Track your attendance, punch times, and leave records
            </p>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* ... existing stats cards ... */}
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Present Days</p>
                <p className="text-2xl font-bold text-foreground">{stats.present}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Absent Days</p>
                <p className="text-2xl font-bold text-foreground">{stats.absent}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Late Arrivals</p>
                <p className="text-2xl font-bold text-foreground">{stats.late}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Coffee className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Off</p>
                <p className="text-2xl font-bold text-foreground">{stats.dayOff}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar View */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold">
                    {formatMonth(currentDate)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={goToNextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px]">
                    <div className="grid grid-cols-7 gap-2 mb-2">
                      {weekDays.map((day) => (
                        <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                      {days.map((date, index) => {
                        const dayAttendance = getAttendanceForDate(date);
                        const holiday = getHolidayForDate(date);
                        const today = isToday(date);

                        return (
                          <div
                            key={index}
                            className={`min-h-[180px] p-2 border rounded-lg ${date ? "bg-card hover:bg-muted/50 cursor-pointer" : "bg-muted/20"
                              } ${today ? "ring-2 ring-primary" : ""} ${holiday ? "bg-purple-500/10 hover:bg-purple-500/20" : ""}`}
                          >
                            {date && (
                              <>
                                <div className="flex justify-between items-start mb-2">
                                  <div
                                    className={`text-sm font-medium ${today
                                      ? "bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center rounded-full"
                                      : "text-foreground"
                                      }`}
                                  >
                                    {date.getDate()}
                                  </div>
                                  {holiday && (
                                    <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">
                                      Holiday
                                    </Badge>
                                  )}
                                </div>

                                {holiday && (
                                  <div className="text-xs font-medium text-purple-700 mb-1 truncate" title={holiday.name}>
                                    {holiday.name}
                                  </div>
                                )}

                                {dayAttendance && (
                                  <div className="space-y-1">
                                    <Badge
                                      className={`text-[10px] px-1 py-0 h-5 w-full justify-start whitespace-nowrap overflow-hidden ${getStatusColor(
                                        dayAttendance.status
                                      )}`}
                                      title={dayAttendance.status}
                                    >
                                      <span className="flex items-center gap-1 truncate">
                                        {getStatusIcon(dayAttendance.status)}
                                        <span className="truncate">{dayAttendance.status}</span>
                                      </span>
                                    </Badge>

                                    {/* Scheduled Shift Times */}
                                    {(dayAttendance.scheduled_in || dayAttendance.scheduled_out) && (
                                      <div className="text-[10px] text-gray-500 border-t pt-1">
                                        <div className="flex flex-col">
                                          <div className="flex items-center gap-0.5">
                                            <Clock className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate">
                                              {formatTime(dayAttendance.scheduled_in)}-{formatTime(dayAttendance.scheduled_out)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Actual Clock In/Out */}
                                    {(dayAttendance.actual_in || dayAttendance.actual_out) && (
                                      <div className="text-xs border-t pt-1">
                                        <div className="font-medium text-gray-700 mb-0.5">Actual:</div>
                                        {dayAttendance.actual_in && (
                                          <div className="flex items-center gap-1 text-gray-600">
                                            <LogIn className="h-3 w-3 text-green-600" />
                                            <span>In: {formatTime(dayAttendance.actual_in)}</span>
                                          </div>
                                        )}
                                        {dayAttendance.actual_out && (
                                          <div className="flex items-center gap-1 text-gray-600">
                                            <LogOut className="h-3 w-3 text-red-600" />
                                            <span>Out: {formatTime(dayAttendance.actual_out)}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {dayAttendance.work_hours && (
                                      <div className="text-xs font-semibold text-blue-700 border-t pt-1">
                                        Total: {formatWorkHours(dayAttendance.work_hours)}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {/* ... Legend and Recent Records ... */}

            {/* Legend */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Status Legend</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 bg-purple-100 rounded border border-purple-200 flex items-center justify-center">
                    <span className="text-[10px] text-purple-700">H</span>
                  </div>
                  <span className="text-sm text-gray-700">Public Holiday</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-gray-700">Present</span>
                </div>
                {/* ... other legend items ... */}
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-gray-700">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-gray-700">Late Arrival</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-700">Half Day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coffee className="h-4 w-4 text-purple-600" />
                  <span className="text-sm text-gray-700">Day Off</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Weekend</span>
                </div>
              </CardContent>
            </Card>

            {/* Recent Attendance */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-lg">Recent Records</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {attendance.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No attendance records yet
                  </p>
                ) : (
                  attendance
                    .slice(-5)
                    .reverse()
                    .map((record) => (
                      <div
                        key={record.id}
                        className="p-3 border rounded-lg hover:bg-gray-50"
                      >
                        {/* ... Recent record logic ... */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-foreground">
                              {new Date(record.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <Badge
                              className={`text-xs mt-1 ${getStatusColor(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </Badge>
                          </div>
                          {record.shift_name && (
                            <Badge variant="outline" className="text-xs">
                              {record.shift_name}
                            </Badge>
                          )}
                        </div>
                        {/* ... (rest of record details) ... */}
                        {(record.scheduled_in || record.scheduled_out) && (
                          <div className="bg-gray-50 p-2 rounded mb-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-3 w-3" />
                              <span className="font-medium">Schedule:</span>
                              <span>
                                {formatTime(record.scheduled_in) || '--'} - {formatTime(record.scheduled_out) || '--'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Actual Times */}
                        {(record.actual_in || record.actual_out) && (
                          <div className="space-y-1 mb-2">
                            {record.actual_in && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <LogIn className="h-3 w-3 text-green-600" />
                                <span className="font-medium">In:</span>
                                <span>{formatTime(record.actual_in)}</span>
                              </div>
                            )}
                            {record.actual_out && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <LogOut className="h-3 w-3 text-red-600" />
                                <span className="font-medium">Out:</span>
                                <span>{formatTime(record.actual_out)}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {record.work_hours && (
                          <div className="text-sm font-semibold text-primary bg-primary/20 p-2 rounded mb-2">
                            Total Hours: {formatWorkHours(record.work_hours)}
                          </div>
                        )}
                        {record.remarks && (
                          <div className="text-xs text-gray-500 italic border-t pt-2">
                            💬 {record.remarks}
                          </div>
                        )}
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

export default Calendar;
