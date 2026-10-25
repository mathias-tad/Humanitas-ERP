import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Milestone,
  Clock,
  Layers,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePMS, type ProjectCalendarEvent } from "@/hooks/usePMS";

export default function ProjectCalendarPage() {
  const { useProjects, useProjectCalendar } = usePMS();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const activeProjectId = selectedProjectId || (projects[0]?.id ?? "");

  const { data: events = [], isLoading: eventsLoading } = useProjectCalendar(activeProjectId);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: ProjectCalendarEvent[] } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build grid days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Blank cells before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, dateStr: null });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, "0");
      const dayStr = String(d).padStart(2, "0");
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      days.push({ day: d, dateStr });
    }

    return days;
  }, [year, month]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ProjectCalendarEvent[]>();
    for (const ev of events) {
      const d = ev.start ? ev.start.split("T")[0] : "";
      if (d) {
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(ev);
      }
    }
    return map;
  }, [events]);

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header and Project Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Project Calendar</h1>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Schedule Board
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Deadlines, sprint schedules, and milestone delivery dates
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            className="px-3 py-2 border rounded-lg bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]"
            value={activeProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projectsLoading ? (
              <option>Loading projects...</option>
            ) : projects.length === 0 ? (
              <option>No projects found</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.visibility === "private" ? "🔒 (Private)" : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Calendar Controls & Month Switcher */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">
              {monthName} {year}
            </h2>
            <Button size="sm" variant="outline" onClick={handleToday} className="text-xs ml-2">
              Today
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {eventsLoading ? (
            <div className="p-16 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Loading calendar deadlines...
            </div>
          ) : (
            <div>
              {/* Day-of-week Headers */}
              <div className="grid grid-cols-7 border-b bg-muted/40 text-center py-2.5 text-xs font-semibold text-muted-foreground">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Day Grid Cells */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y">
                {calendarDays.map((cell, idx) => {
                  if (!cell.day) {
                    return <div key={`empty-${idx}`} className="min-h-[105px] bg-muted/10 p-2" />;
                  }

                  const isToday = cell.dateStr === todayStr;
                  const dayEvents = cell.dateStr ? eventsByDate.get(cell.dateStr) || [] : [];

                  return (
                    <div
                      key={cell.dateStr}
                      onClick={() => {
                        if (dayEvents.length > 0 && cell.dateStr) {
                          setSelectedDayEvents({ date: cell.dateStr, events: dayEvents });
                        }
                      }}
                      className={`min-h-[105px] p-2 transition-colors cursor-pointer hover:bg-muted/20 ${
                        isToday ? "bg-primary/5 font-semibold" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                          }`}
                        >
                          {cell.day}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            {dayEvents.length} items
                          </span>
                        )}
                      </div>

                      {/* Event Pills */}
                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const isMilestone = ev.type === "milestone" || ev.is_milestone;
                          const isSprint = ev.type === "sprint";

                          return (
                            <div
                              key={ev.id}
                              className={`text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 ${
                                isMilestone
                                  ? "bg-purple-100 text-purple-800 font-semibold"
                                  : isSprint
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {isMilestone && <Milestone className="h-2.5 w-2.5 shrink-0" />}
                              {isSprint && <Layers className="h-2.5 w-2.5 shrink-0" />}
                              <span className="truncate">{ev.title}</span>
                            </div>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <span className="text-[10px] text-muted-foreground font-medium pl-1">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day Detail Modal */}
      <Dialog
        open={Boolean(selectedDayEvents)}
        onOpenChange={(open) => !open && setSelectedDayEvents(null)}
      >
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Scheduled Items: {selectedDayEvents?.date}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2.5 py-2 max-h-[60vh] overflow-y-auto">
            {selectedDayEvents?.events.map((ev) => (
              <div
                key={ev.id}
                className="p-3 border rounded-lg bg-card space-y-1 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    {ev.type === "milestone" ? (
                      <Milestone className="h-3 w-3 text-purple-600" />
                    ) : ev.type === "sprint" ? (
                      <Layers className="h-3 w-3 text-amber-600" />
                    ) : (
                      <Clock className="h-3 w-3 text-blue-600" />
                    )}
                    {ev.title}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {ev.type}
                  </Badge>
                </div>

                {ev.assignee_name && (
                  <p className="text-[11px] text-muted-foreground">
                    Assigned: {ev.assignee_name}
                  </p>
                )}
                {ev.priority && (
                  <p className="text-[10px] text-muted-foreground">
                    Priority: {ev.priority}
                  </p>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
