import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Milestone,
  Sparkles,
  Loader2,
} from "lucide-react";
import { usePMS, TaskStatus, ProjectPriority, type GanttTask } from "@/hooks/usePMS";

export default function ProjectGanttPage() {
  const { useProjects, useProjectGantt } = usePMS();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const activeProjectId = selectedProjectId || (projects[0]?.id ?? "");

  const { data: ganttData, isLoading: ganttLoading } = useProjectGantt(activeProjectId);
  const [filterMilestonesOnly, setFilterMilestonesOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTasks = useMemo(() => {
    if (!ganttData?.tasks) return [];
    return ganttData.tasks.filter((t) => {
      if (filterMilestonesOnly && !t.is_milestone) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [ganttData, filterMilestonesOnly, statusFilter]);

  // Compute timeline date range
  const { startDate, endDate, totalDays } = useMemo(() => {
    if (!ganttData?.tasks || ganttData.tasks.length === 0) {
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 86400000);
      return {
        startDate: now,
        endDate: end,
        totalDays: 30,
      };
    }

    const dates = ganttData.tasks
      .flatMap((t) => [new Date(t.start_date).getTime(), new Date(t.due_date).getTime()])
      .filter((d) => !isNaN(d));

    if (ganttData.project.start_date) dates.push(new Date(ganttData.project.start_date).getTime());
    if (ganttData.project.target_end_date) dates.push(new Date(ganttData.project.target_end_date).getTime());

    const minTime = dates.length > 0 ? Math.min(...dates) : Date.now();
    const maxTime = dates.length > 0 ? Math.max(...dates) : Date.now() + 30 * 86400000;

    const start = new Date(minTime);
    start.setDate(start.getDate() - 2); // 2 days buffer
    const end = new Date(maxTime);
    end.setDate(end.getDate() + 4); // 4 days buffer

    const days = Math.max(7, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      startDate: start,
      endDate: end,
      totalDays: days,
    };
  }, [ganttData]);

  const getTaskPosition = (task: GanttTask) => {
    const tStart = new Date(task.start_date).getTime();
    const tEnd = new Date(task.due_date).getTime();
    const sTime = startDate.getTime();

    const startOffsetDays = Math.max(0, (tStart - sTime) / (1000 * 60 * 60 * 24));
    const durationDays = Math.max(1, (tEnd - tStart) / (1000 * 60 * 60 * 24));

    const leftPercent = (startOffsetDays / totalDays) * 100;
    const widthPercent = (durationDays / totalDays) * 100;

    return {
      left: `${Math.min(98, Math.max(0, leftPercent))}%`,
      width: `${Math.min(100 - leftPercent, Math.max(2, widthPercent))}%`,
    };
  };

  const getPriorityBadgeColor = (p: ProjectPriority | string) => {
    switch (p) {
      case "Critical":
        return "bg-red-500 text-white";
      case "High":
        return "bg-amber-500 text-white";
      case "Medium":
        return "bg-blue-500 text-white";
      default:
        return "bg-gray-400 text-white";
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header and Project Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Interactive Gantt & Milestones</h1>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Timeline View
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Visual task dependencies, duration bars, and project milestone checkpoints
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

      {/* Filter and Legend Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              className="px-3 py-1.5 border rounded-md text-xs font-medium bg-background"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="In Review">In Review</option>
              <option value="Done">Done</option>
            </select>

            <button
              onClick={() => setFilterMilestonesOnly(!filterMilestonesOnly)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-colors ${
                filterMilestonesOnly
                  ? "bg-purple-100 text-purple-800 border-purple-300"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Milestone className="h-3.5 w-3.5" /> Milestones Only
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500" /> Task Duration
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Completed
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rotate-45 bg-purple-600 rounded-[2px]" /> Milestone
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gantt Timeline Board */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {ganttData?.project.name ?? "Project Timeline"}
              </CardTitle>
              <CardDescription className="text-xs">
                {ganttData?.milestones.length ?? 0} Milestones • {filteredTasks.length} Tasks Scheduled
              </CardDescription>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {startDate.toISOString().split("T")[0]} → {endDate.toISOString().split("T")[0]}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {ganttLoading ? (
            <div className="p-16 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Calculating timeline and schedule bars...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No tasks scheduled with start and due dates</p>
              <p className="text-xs mt-1">
                Edit tasks to assign dates and story points to populate the Gantt timeline.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                {/* Timeline Header Row */}
                <div className="grid grid-cols-12 border-b text-[11px] font-semibold text-muted-foreground bg-muted/40 py-2.5 px-4">
                  <div className="col-span-4">Task Name & Details</div>
                  <div className="col-span-8 relative">
                    <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                      <span>{startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span>
                        {new Date(startDate.getTime() + (totalDays / 2) * 86400000).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </span>
                      <span>{endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                {/* Task Rows */}
                <div className="divide-y">
                  {filteredTasks.map((task) => {
                    const pos = getTaskPosition(task);
                    const isDone = task.status === TaskStatus.DONE;

                    return (
                      <div
                        key={task.id}
                        className="grid grid-cols-12 py-3 px-4 items-center hover:bg-muted/15 transition-colors gap-2"
                      >
                        {/* Task Column */}
                        <div className="col-span-4 pr-3 min-w-0">
                          <div className="flex items-center gap-2">
                            {task.is_milestone ? (
                              <div className="w-3.5 h-3.5 rotate-45 bg-purple-600 rounded-[2px] shrink-0" />
                            ) : (
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isDone ? "bg-emerald-500" : "bg-blue-500"
                                }`}
                              />
                            )}
                            <span className="text-xs font-medium truncate">{task.title}</span>
                          </div>

                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground pl-4">
                            <span className={`px-1 rounded text-[9px] ${getPriorityBadgeColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            <span>{task.story_points ?? 0} pts</span>
                            <span>•</span>
                            <span>Due {task.due_date}</span>
                          </div>
                        </div>

                        {/* Timeline Bar Column */}
                        <div className="col-span-8 relative h-7 flex items-center bg-muted/5 rounded">
                          {task.is_milestone ? (
                            /* Diamond Milestone Indicator */
                            <div
                              className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5"
                              style={{ left: pos.left }}
                            >
                              <div className="w-5 h-5 rotate-45 bg-purple-600 border-2 border-white shadow-sm rounded-[3px] flex items-center justify-center">
                                <span className="rotate-[-45deg] text-[9px] text-white font-bold">M</span>
                              </div>
                              <span className="text-[10px] font-semibold text-purple-900 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 shadow-xs">
                                {task.title}
                              </span>
                            </div>
                          ) : (
                            /* Gantt Task Bar */
                            <div
                              className={`absolute top-1 bottom-1 rounded-md shadow-xs overflow-hidden transition-all duration-300 flex items-center px-2 text-[10px] font-medium text-white ${
                                isDone ? "bg-emerald-600" : "bg-blue-600"
                              }`}
                              style={{ left: pos.left, width: pos.width }}
                            >
                              {/* Progress overlay */}
                              <div
                                className="absolute inset-0 bg-white/20"
                                style={{ width: `${task.progress}%` }}
                              />
                              <span className="relative z-10 truncate text-[10px] drop-shadow-xs">
                                {task.title} ({task.progress}%)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
