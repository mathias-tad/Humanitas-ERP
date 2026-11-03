import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Filter,
  MapPin,
  CalendarDays,
  CheckCircle2,
  Trash2,
  Edit2,
  ExternalLink,
  Download,
  Search,
  Briefcase,
  Layers,
  Loader2,
  FolderKanban,
  ShoppingCart,
  DollarSign,
  Users2,
} from "lucide-react";
import { useCalendar, type CalendarEvent, type EventCategory } from "@/hooks/useCalendar";
import { usePermissions } from "@/hooks/usePermissions";
import { useModules } from "@/context/ModuleContext";
import { useNavigate, Link } from "react-router-dom";

type ViewMode = "month" | "week" | "agenda";

const PRESET_COLORS = [
  { label: "Gold", value: "#D4A017" },
  { label: "Emerald", value: "#10B981" },
  { label: "Cyan", value: "#06B6D4" },
  { label: "Violet", value: "#8B5CF6" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Indigo", value: "#6366F1" },
  { label: "Pink", value: "#EC4899" },
  { label: "Orange", value: "#F97316" },
  { label: "Green", value: "#22C55E" },
  { label: "Red", value: "#EF4444" },
];

const ALL_CATEGORY_TABS: { id: "all" | EventCategory; label: string; icon: any; modules?: string[] }[] = [
  { id: "all", label: "All Modules", icon: Layers },
  { id: "workforce", label: "HR & Workforce", icon: Users2, modules: ["hrms", "attendance", "leave"] },
  { id: "projects", label: "Projects & PMS", icon: FolderKanban, modules: ["pms"] },
  { id: "commercial", label: "Commercial ERP", icon: ShoppingCart, modules: ["sales", "purchasing"] },
  { id: "financial", label: "Financial & Tax", icon: DollarSign, modules: ["accounting"] },
  { id: "common", label: "General & Org", icon: Briefcase },
];

export default function UnifiedCalendar() {
  const navigate = useNavigate();
  const { isModuleSubscribed } = useModules();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("create_calendar_events") || hasPermission("manage_calendar");
  const canEdit = hasPermission("edit_calendar_events") || hasPermission("manage_calendar");
  const canDelete = hasPermission("delete_calendar_events") || hasPermission("manage_calendar");

  const availableCategoryTabs = useMemo(() => {
    return ALL_CATEGORY_TABS.filter((tab) => {
      if (!tab.modules) return true;
      return tab.modules.some((m) => isModuleSubscribed(m));
    });
  }, [isModuleSubscribed]);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [categoryFilter, setCategoryFilter] = useState<"all" | EventCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeSources, setActiveSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("calendar_active_sources");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Calculate range for query based on view
  const { startRange, endRange } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const start = new Date(year, month - 1, 1).toISOString();
    const end = new Date(year, month + 2, 0).toISOString();
    return { startRange: start, endRange: end };
  }, [currentDate]);

  const {
    sources,
    events,
    isLoadingEvents,
    createEvent,
    isCreating,
    updateEvent,
    isUpdating,
    deleteEvent,
    isDeleting,
  } = useCalendar(
    startRange,
    endRange,
    activeSources.length > 0 ? activeSources : undefined
  );

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("10:00");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formEventType, setFormEventType] = useState("custom");
  const [formColor, setFormColor] = useState("#D4A017");
  const [formLocation, setFormLocation] = useState("");

  // Filter events by selected category and search query
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Category filter
      if (categoryFilter !== "all" && ev.category !== categoryFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = ev.title.toLowerCase().includes(q);
        const descMatch = ev.description?.toLowerCase().includes(q);
        const sourceMatch = ev.source.toLowerCase().includes(q);
        const locMatch = ev.location?.toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !sourceMatch && !locMatch) {
          return false;
        }
      }
      return true;
    });
  }, [events, categoryFilter, searchQuery]);

  const visibleSources = useMemo(() => {
    return sources.filter((s) => {
      if (s.isCommon || s.category === "common") return true;
      if (s.category === "workforce") {
        if (s.id === "leave" || s.id === "holidays") return isModuleSubscribed("leave") || isModuleSubscribed("hrms");
        if (s.id === "shift") return isModuleSubscribed("attendance") || isModuleSubscribed("scheduling") || isModuleSubscribed("hrms");
        if (s.id === "training") return isModuleSubscribed("training") || isModuleSubscribed("hrms");
        if (s.id === "interview") return isModuleSubscribed("recruitment") || isModuleSubscribed("hrms");
        if (s.id === "payroll") return isModuleSubscribed("payroll") || isModuleSubscribed("hrms");
        return isModuleSubscribed("hrms");
      }
      if (s.category === "projects") {
        return isModuleSubscribed("pms");
      }
      if (s.category === "commercial") {
        if (s.id === "sales") return isModuleSubscribed("sales");
        if (s.id === "purchasing") return isModuleSubscribed("purchasing");
        return isModuleSubscribed("sales") || isModuleSubscribed("purchasing");
      }
      if (s.category === "financial") {
        return isModuleSubscribed("accounting");
      }
      return s.enabled !== false;
    });
  }, [sources, isModuleSubscribed]);

  const toggleSource = (sourceId: string) => {
    setActiveSources((prev) => {
      let next: string[];
      if (prev.length === 0) {
        next = visibleSources.map((s) => s.id).filter((id) => id !== sourceId);
      } else if (prev.includes(sourceId)) {
        next = prev.filter((id) => id !== sourceId);
      } else {
        next = [...prev, sourceId];
      }
      try {
        localStorage.setItem("calendar_active_sources", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const resetSources = () => {
    setActiveSources([]);
    try {
      localStorage.removeItem("calendar_active_sources");
    } catch {}
  };

  // Date Navigation helpers
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
      setCurrentDate(prev);
    } else {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 14);
      setCurrentDate(prev);
    }
  };

  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 14);
      setCurrentDate(next);
    }
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today);
  };

  // Month grid calculation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentDate]);

  // Week days calculation
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay();
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(curr.setDate(first + i)));
    }
    return days;
  }, [currentDate]);

  // Helper to filter events for a specific date
  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split("T")[0];

    return filteredEvents.filter((ev) => {
      const startStr = ev.start ? ev.start.split("T")[0] : "";
      const endStr = ev.end ? ev.end.split("T")[0] : startStr;
      return dateStr >= startStr && dateStr <= endStr;
    });
  };

  // KPI Stats
  const kpiStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

    const monthEvents = filteredEvents.filter((ev) => ev.start && ev.start.startsWith(monthPrefix));
    const leaves = monthEvents.filter((ev) => ev.source === "leave").length;
    const tasks = monthEvents.filter((ev) => ev.source === "task" || ev.source === "sprint").length;
    const commercial = monthEvents.filter((ev) => ev.source === "sales" || ev.source === "purchasing").length;

    return {
      total: monthEvents.length,
      leaves,
      tasks,
      commercial,
    };
  }, [filteredEvents, currentDate]);

  const openCreateModal = (presetDate?: Date) => {
    const target = presetDate || selectedDay || new Date();
    const dateStr = target.toISOString().split("T")[0];
    setFormTitle("");
    setFormDescription("");
    setFormStartDate(dateStr);
    setFormStartTime("09:00");
    setFormEndDate(dateStr);
    setFormEndTime("10:00");
    setFormAllDay(false);
    setFormEventType("custom");
    setFormColor("#D4A017");
    setFormLocation("");
    setIsCreateModalOpen(true);
  };

  const openEditModal = (ev: CalendarEvent) => {
    setSelectedEvent(ev);
    setFormTitle(ev.title.replace(/^[^a-zA-Z0-9]+/, "").trim());
    setFormDescription(ev.description || "");
    const startDatePart = ev.start ? ev.start.split("T")[0] : "";
    const startTimePart = ev.start && ev.start.includes("T") ? ev.start.split("T")[1].substring(0, 5) : "09:00";
    setFormStartDate(startDatePart);
    setFormStartTime(startTimePart);

    const endDatePart = ev.end ? ev.end.split("T")[0] : startDatePart;
    const endTimePart = ev.end && ev.end.includes("T") ? ev.end.split("T")[1].substring(0, 5) : "10:00";
    setFormEndDate(endDatePart);
    setFormEndTime(endTimePart);
    setFormAllDay(ev.allDay);
    setFormEventType(ev.eventType || "custom");
    setFormColor(ev.color || "#D4A017");
    setFormLocation(ev.location || "");
    setIsDetailModalOpen(false);
    setIsEditModalOpen(true);
  };

  const handleSaveCreate = async () => {
    if (!formTitle.trim()) return;
    const startIso = formAllDay
      ? `${formStartDate}T00:00:00`
      : `${formStartDate}T${formStartTime}:00`;
    const endIso = formEndDate
      ? formAllDay
        ? `${formEndDate}T23:59:59`
        : `${formEndDate}T${formEndTime}:00`
      : undefined;

    await createEvent({
      title: formTitle,
      description: formDescription,
      start_date: startIso,
      end_date: endIso,
      all_day: formAllDay,
      event_type: formEventType,
      color: formColor,
      location: formLocation,
    });
    setIsCreateModalOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!selectedEvent || !formTitle.trim()) return;
    const startIso = formAllDay
      ? `${formStartDate}T00:00:00`
      : `${formStartDate}T${formStartTime}:00`;
    const endIso = formEndDate
      ? formAllDay
        ? `${formEndDate}T23:59:59`
        : `${formEndDate}T${formEndTime}:00`
      : undefined;

    await updateEvent({
      id: selectedEvent.id,
      dto: {
        title: formTitle,
        description: formDescription,
        start_date: startIso,
        end_date: endIso,
        all_day: formAllDay,
        event_type: formEventType,
        color: formColor,
        location: formLocation,
      },
    });
    setIsEditModalOpen(false);
    setSelectedEvent(null);
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    if (confirm("Are you sure you want to delete this event?")) {
      await deleteEvent(selectedEvent.id);
      setIsDetailModalOpen(false);
      setSelectedEvent(null);
    }
  };

  // Export to iCalendar (.ics) format
  const exportToICal = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Humanitas ERP//Unified Calendar//EN\n";

    filteredEvents.forEach((ev) => {
      const cleanTitle = ev.title.replace(/[\\;,]/g, "");
      const cleanDesc = (ev.description || "").replace(/[\\;,]/g, "").replace(/\n/g, "\\n");
      const startDt = ev.start ? ev.start.replace(/[-:]/g, "").split(".")[0] + "Z" : "";
      const endDt = ev.end ? ev.end.replace(/[-:]/g, "").split(".")[0] + "Z" : startDt;

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${ev.id}@humanitas\n`;
      icsContent += `SUMMARY:${cleanTitle}\n`;
      if (cleanDesc) icsContent += `DESCRIPTION:${cleanDesc}\n`;
      if (ev.location) icsContent += `LOCATION:${ev.location}\n`;
      icsContent += `DTSTART:${startDt}\n`;
      icsContent += `DTEND:${endDt}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `humanitas-calendar-${new Date().toISOString().split("T")[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const formatMonthTitle = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const formatEventTime = (isoString?: string, allDay?: boolean) => {
    if (!isoString || allDay) return "All Day";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "";
    }
  };

  const selectedDayEvents = useMemo(() => {
    return getEventsForDate(selectedDay);
  }, [selectedDay, filteredEvents]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Page Header */}
      <PageHeader
        title="Unified Calendar"
        description="Comprehensive enterprise calendar aggregating workforce schedules, PMS deadlines, sales orders, purchase deliveries, and fiscal tax dates."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Calendar" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToICal}
              className="h-9 px-3 text-xs font-semibold"
              title="Export iCal / Outlook Sync"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export .ics
            </Button>

            <div className="flex items-center bg-surface-1 border border-border rounded-lg p-0.5">
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
                className="h-8 px-3 text-xs font-semibold"
              >
                Month
              </Button>
              <Button
                variant={viewMode === "week" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("week")}
                className="h-8 px-3 text-xs font-semibold"
              >
                Week
              </Button>
              <Button
                variant={viewMode === "agenda" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("agenda")}
                className="h-8 px-3 text-xs font-semibold"
              >
                Agenda
              </Button>
            </div>

            {canCreate && (
              <Button
                size="sm"
                onClick={() => openCreateModal()}
                className="h-9 px-4 text-xs font-bold gold-gradient gold-glow border-none text-slate-950 transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4 mr-1.5 stroke-[2.5]" />
                New Event
              </Button>
            )}
          </div>
        }
      />

      {/* Module Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {availableCategoryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = categoryFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                isActive
                  ? "bg-primary text-slate-950 gold-gradient border-primary shadow-sm font-bold"
                  : "bg-card hover:bg-surface-1 text-muted-foreground border-border"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Active Events"
          value={kpiStats.total}
          subtitle={`Scheduled in ${formatMonthTitle(currentDate)}`}
          icon={CalendarDays}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KPITile
          title="Approved Leaves"
          value={kpiStats.leaves}
          subtitle="Workforce vacation & rest"
          icon={Clock}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
        <KPITile
          title="PMS Deadlines"
          value={kpiStats.tasks}
          subtitle="Tasks & sprint milestones"
          icon={CheckCircle2}
          iconColor="text-indigo-500"
          iconBg="bg-indigo-500/10"
        />
        <KPITile
          title="Commercial Orders"
          value={kpiStats.commercial}
          subtitle="Sales delivery & PO arrivals"
          icon={ShoppingCart}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
      </div>

      {/* Source Filters Bar & Quick Search */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Source chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5 mr-1">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                Sources:
              </span>

              {visibleSources.map((s) => {
                const isSelectedSource =
                  activeSources.length === 0 || activeSources.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSource(s.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isSelectedSource
                        ? "bg-surface-2 border-border text-foreground shadow-sm ring-1 ring-border"
                        : "opacity-40 hover:opacity-75 bg-transparent border-dashed border-border/70 text-muted-foreground"
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span>{s.label}</span>
                  </button>
                );
              })}

              {activeSources.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSources}
                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
                >
                  Show All
                </Button>
              )}
            </div>

            {/* Quick Search */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search events, tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-surface-1 border-border"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Calendar Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border shadow-sm overflow-hidden">
            {/* Calendar Controls Bar */}
            <CardHeader className="border-b border-border bg-surface-1/50 py-3.5 px-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight">
                      {formatMonthTitle(currentDate)}
                    </h2>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      {filteredEvents.length} events active across modules
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg p-0.5 shadow-sm">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevious}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Previous"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToToday}
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNext}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-4">
              {isLoadingEvents ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Loading cross-module enterprise calendar...
                  </span>
                </div>
              ) : viewMode === "month" ? (
                /* ================= MONTH VIEW ================= */
                <div className="w-full">
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                      <div
                        key={dayName}
                        className={`text-center text-xs font-bold py-1.5 rounded-md ${
                          idx === 0 || idx === 6
                            ? "text-muted-foreground/60 bg-surface-1/40"
                            : "text-muted-foreground bg-surface-1"
                        }`}
                      >
                        {dayName}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {monthDays.map((date, index) => {
                      if (!date) {
                        return (
                          <div
                            key={`empty-${index}`}
                            className="min-h-[95px] sm:min-h-[110px] rounded-xl border border-dashed border-border/40 bg-surface-1/20"
                          />
                        );
                      }

                      const dayEvents = getEventsForDate(date);
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

                            {dayEvents.length > 0 && (
                              <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                                {dayEvents.length}
                              </span>
                            )}
                          </div>

                          {/* Event Pills */}
                          <div className="my-1 space-y-1 overflow-hidden">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvent(ev);
                                  setIsDetailModalOpen(true);
                                }}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate text-foreground transition-opacity hover:opacity-85 flex items-center gap-1 border border-border/60"
                                style={{
                                  backgroundColor: `${ev.color}18`,
                                  borderColor: `${ev.color}40`,
                                }}
                                title={ev.title}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: ev.color }}
                                />
                                <span className="truncate">{ev.title}</span>
                              </div>
                            ))}

                            {dayEvents.length > 3 && (
                              <span className="text-[10px] text-primary font-semibold block text-center">
                                +{dayEvents.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : viewMode === "week" ? (
                /* ================= WEEK VIEW ================= */
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((date) => {
                    const dayEvents = getEventsForDate(date);
                    const isCurrentDay = isToday(date);
                    const isSelectedDate = isSelected(date);

                    return (
                      <div
                        key={date.toISOString()}
                        onClick={() => setSelectedDay(date)}
                        className={`min-h-[360px] p-2 rounded-xl border flex flex-col justify-start gap-2 cursor-pointer transition-all ${
                          isSelectedDate
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : isCurrentDay
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-card hover:bg-surface-1"
                        }`}
                      >
                        <div className="text-center pb-2 border-b border-border">
                          <span className="text-xs text-muted-foreground uppercase font-bold block">
                            {date.toLocaleDateString("en-US", { weekday: "short" })}
                          </span>
                          <span
                            className={`inline-block text-sm font-extrabold mt-1 px-2 py-0.5 rounded-full ${
                              isCurrentDay ? "bg-primary text-slate-950" : "text-foreground"
                            }`}
                          >
                            {date.getDate()}
                          </span>
                        </div>

                        <div className="space-y-1.5 overflow-y-auto max-h-[300px]">
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(ev);
                                setIsDetailModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg border text-left text-xs space-y-0.5 hover:shadow-sm"
                              style={{
                                backgroundColor: `${ev.color}15`,
                                borderColor: `${ev.color}35`,
                              }}
                            >
                              <div className="flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: ev.color }}
                                />
                                <span className="font-semibold text-foreground text-[11px] truncate">
                                  {ev.title}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground block font-mono">
                                {formatEventTime(ev.start, ev.allDay)}
                              </span>
                            </div>
                          ))}
                          {dayEvents.length === 0 && (
                            <span className="text-[11px] text-muted-foreground/50 italic block text-center pt-8">
                              No events
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ================= AGENDA VIEW ================= */
                <div className="space-y-3">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-16 space-y-2">
                      <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                      <p className="text-sm font-semibold text-foreground">No matching events found</p>
                      <p className="text-xs text-muted-foreground">
                        Try clearing search filters or create a new event.
                      </p>
                    </div>
                  ) : (
                    filteredEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedEvent(ev);
                          setIsDetailModalOpen(true);
                        }}
                        className="p-3 rounded-xl border border-border bg-card hover:bg-surface-1 cursor-pointer transition-all flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-3 h-10 rounded-full"
                            style={{ backgroundColor: ev.color }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">{ev.title}</h4>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-semibold uppercase"
                                style={{
                                  borderColor: `${ev.color}60`,
                                  color: ev.color,
                                }}
                              >
                                {ev.source}
                              </Badge>
                              {ev.status && (
                                <Badge variant="secondary" className="text-[9px] uppercase">
                                  {ev.status}
                                </Badge>
                              )}
                            </div>
                            {ev.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-foreground block">
                            {ev.start ? new Date(ev.start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {formatEventTime(ev.start, ev.allDay)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Day Details Panel */}
        <div className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3 px-4 bg-surface-1/50 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {selectedDay.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </CardTitle>

              {canCreate && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openCreateModal(selectedDay)}
                  className="h-7 text-xs font-semibold px-2"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <CalendarIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-xs font-medium text-foreground">No events on this day</p>
                  <p className="text-[11px] text-muted-foreground">
                    Click "Add" above to schedule an event.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => {
                        setSelectedEvent(ev);
                        setIsDetailModalOpen(true);
                      }}
                      className="p-2.5 rounded-xl border border-border bg-surface-1 hover:bg-surface-2 cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground truncate">
                          {ev.title}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 uppercase shrink-0"
                          style={{
                            borderColor: `${ev.color}50`,
                            color: ev.color,
                          }}
                        >
                          {ev.source}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span>{formatEventTime(ev.start, ev.allDay)}</span>
                        {ev.location && (
                          <span className="flex items-center gap-1 truncate max-w-[140px]">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {ev.location}
                          </span>
                        )}
                      </div>

                      {ev.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Module Navigation Shortcuts */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-border py-3 px-4 bg-surface-1/50">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Cross-Module Calendar Hubs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <Link
                to="/leave"
                className="flex items-center justify-between p-2 rounded-lg bg-surface-1 hover:bg-surface-2 text-foreground font-medium transition-colors"
              >
                <span>Team Leave Calendar</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/hr/scheduling"
                className="flex items-center justify-between p-2 rounded-lg bg-surface-1 hover:bg-surface-2 text-foreground font-medium transition-colors"
              >
                <span>Shift Rosters & Coverage</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/pms/calendar"
                className="flex items-center justify-between p-2 rounded-lg bg-surface-1 hover:bg-surface-2 text-foreground font-medium transition-colors"
              >
                <span>PMS Task Deadlines & Milestones</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
              <Link
                to="/events"
                className="flex items-center justify-between p-2 rounded-lg bg-surface-1 hover:bg-surface-2 text-foreground font-medium transition-colors"
              >
                <span>Company Townhalls & Events</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================= MODAL: EVENT DETAILS ================= */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="text-xs font-semibold uppercase"
                    style={{
                      borderColor: `${selectedEvent.color}60`,
                      color: selectedEvent.color,
                    }}
                  >
                    {selectedEvent.source}
                  </Badge>
                  {selectedEvent.allDay && (
                    <Badge variant="secondary" className="text-[10px]">
                      All Day
                    </Badge>
                  )}
                  {selectedEvent.status && (
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      {selectedEvent.status}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {selectedEvent.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3 py-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    {selectedEvent.start ? new Date(selectedEvent.start).toLocaleString() : ""}
                    {selectedEvent.end ? ` — ${new Date(selectedEvent.end).toLocaleString()}` : ""}
                  </span>
                </div>

                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>{selectedEvent.location}</span>
                  </div>
                )}

                {selectedEvent.description && (
                  <div className="p-3 rounded-lg bg-surface-1 border border-border text-foreground leading-relaxed whitespace-pre-line">
                    {selectedEvent.description}
                  </div>
                )}

                {selectedEvent.createdByName && (
                  <p className="text-[11px] text-muted-foreground">
                    Created by: <span className="font-semibold text-foreground">{selectedEvent.createdByName}</span>
                  </p>
                )}
              </div>

              <DialogFooter className="flex justify-between sm:justify-between items-center gap-2">
                {selectedEvent.routeUrl && selectedEvent.routeUrl !== "/calendar" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      navigate(selectedEvent.routeUrl!);
                    }}
                    className="h-8 px-3 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Open in Module
                  </Button>
                ) : <div />}

                {selectedEvent.source === "custom" ? (
                  <div className="flex items-center gap-2">
                    {canDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="h-8 px-3"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => openEditModal(selectedEvent)}
                        className="h-8 px-3"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDetailModalOpen(false)}
                  >
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CREATE EVENT ================= */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Create Calendar Event
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold">Event Title *</Label>
              <Input
                placeholder="e.g. Quarterly Executive Planning"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Event Type</Label>
                <Select value={formEventType} onValueChange={setFormEventType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">General / Custom</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Event Color</Label>
                <div className="flex items-center gap-1.5 mt-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      className={`w-6 h-6 rounded-full border transition-transform ${
                        formColor === c.value ? "scale-110 ring-2 ring-primary ring-offset-2" : "opacity-80"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="formAllDay"
                checked={formAllDay}
                onCheckedChange={(checked) => setFormAllDay(!!checked)}
              />
              <Label htmlFor="formAllDay" className="text-xs font-medium cursor-pointer">
                All Day Event
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Start Date *</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {!formAllDay && (
                <div>
                  <Label className="text-xs font-semibold">Start Time</Label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">End Date</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {!formAllDay && (
                <div>
                  <Label className="text-xs font-semibold">End Time</Label>
                  <Input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Location / Link</Label>
              <Input
                placeholder="e.g. Conference Room A or Zoom link"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                placeholder="Optional notes or agenda"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCreate}
              disabled={isCreating || !formTitle.trim()}
              className="gold-gradient text-slate-950 font-bold"
            >
              {isCreating ? "Saving..." : "Create Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: EDIT EVENT ================= */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Edit Calendar Event
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-semibold">Event Title *</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Event Type</Label>
                <Select value={formEventType} onValueChange={setFormEventType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">General / Custom</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="training">Training</SelectItem>
                    <SelectItem value="reminder">Reminder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Event Color</Label>
                <div className="flex items-center gap-1.5 mt-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setFormColor(c.value)}
                      className={`w-6 h-6 rounded-full border transition-transform ${
                        formColor === c.value ? "scale-110 ring-2 ring-primary ring-offset-2" : "opacity-80"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="editFormAllDay"
                checked={formAllDay}
                onCheckedChange={(checked) => setFormAllDay(!!checked)}
              />
              <Label htmlFor="editFormAllDay" className="text-xs font-medium cursor-pointer">
                All Day Event
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Start Date *</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {!formAllDay && (
                <div>
                  <Label className="text-xs font-semibold">Start Time</Label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">End Date</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {!formAllDay && (
                <div>
                  <Label className="text-xs font-semibold">End Time</Label>
                  <Input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold">Location / Link</Label>
              <Input
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEdit}
              disabled={isUpdating || !formTitle.trim()}
              className="gold-gradient text-slate-950 font-bold"
            >
              {isUpdating ? "Saving..." : "Update Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
