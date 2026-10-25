import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  GitBranch,
  Layers,
  TrendingUp,
  Plus,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Sparkles,
  Milestone,
  Flame,
  Loader2,
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
import { usePMS } from "@/hooks/usePMS";

export default function AgileBacklogPage() {
  const {
    useProjects,
    useSprints,
    useProjectBacklog,
    useSprintBurndown,
    useSprintVelocity,
    updateBacklogOrder,
    assignTaskToSprint,
    createSprint,
  } = usePMS();

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const activeProjectId = selectedProjectId || (projects[0]?.id ?? "");

  const { data: sprints = [] } = useSprints(activeProjectId);
  const { data: backlogTasks = [], isLoading: backlogLoading } = useProjectBacklog(activeProjectId);
  const { data: velocityData } = useSprintVelocity(activeProjectId);

  const [selectedSprintId, setSelectedSprintId] = useState<string>("");
  const activeSprintId = selectedSprintId || (sprints[0]?.id ?? "");
  const { data: burndownData, isLoading: burndownLoading } = useSprintBurndown(activeSprintId);

  // New Sprint Modal
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [sprintName, setSprintName] = useState("");
  const [sprintGoal, setSprintGoal] = useState("");
  const [sprintStart, setSprintStart] = useState("");
  const [sprintEnd, setSprintEnd] = useState("");

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || !sprintName) return;
    await createSprint.mutateAsync({
      project_id: activeProjectId,
      name: sprintName,
      goal: sprintGoal,
      start_date: sprintStart,
      end_date: sprintEnd,
    });
    setSprintName("");
    setSprintGoal("");
    setSprintStart("");
    setSprintEnd("");
    setIsSprintModalOpen(false);
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const reordered = [...backlogTasks];
    const temp = reordered[index - 1];
    reordered[index - 1] = reordered[index];
    reordered[index] = temp;
    await updateBacklogOrder.mutateAsync({
      taskIds: reordered.map((t) => t.id),
      projectId: activeProjectId,
    });
  };

  const handleMoveDown = async (index: number) => {
    if (index >= backlogTasks.length - 1) return;
    const reordered = [...backlogTasks];
    const temp = reordered[index + 1];
    reordered[index + 1] = reordered[index];
    reordered[index] = temp;
    await updateBacklogOrder.mutateAsync({
      taskIds: reordered.map((t) => t.id),
      projectId: activeProjectId,
    });
  };

  const handleAssignToSprint = async (taskId: string, sprintId: string | null) => {
    await assignTaskToSprint.mutateAsync({
      taskId,
      sprintId,
      projectId: activeProjectId,
    });
  };

  const totalBacklogPoints = backlogTasks.reduce(
    (sum, t) => sum + (Number(t.story_points) || 0),
    0
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header and Project Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Agile Sprints & Backlog</h1>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> Scrum Engine
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Sprint velocity, day-by-day burndown charts, and backlog prioritization
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            className="px-3 py-2 border rounded-lg bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
            value={activeProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSelectedSprintId("");
            }}
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

          <Button
            onClick={() => setIsSprintModalOpen(true)}
            disabled={!activeProjectId}
            className="!bg-primary hover:!bg-primary/90 !text-primary-foreground flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> New Sprint
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Active Sprints
              </p>
              <p className="text-2xl font-bold mt-1">{sprints.length}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Backlog Tasks
              </p>
              <p className="text-2xl font-bold mt-1">{backlogTasks.length}</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <GitBranch className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Backlog Story Points
              </p>
              <p className="text-2xl font-bold mt-1">{totalBacklogPoints} pts</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Flame className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Average Velocity
              </p>
              <p className="text-2xl font-bold mt-1">
                {velocityData?.average_velocity ?? 0} pts/sprint
              </p>
            </div>
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sprint Burndown & Velocity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Burndown Chart Card (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-amber-500" /> Sprint Burndown Chart
              </CardTitle>
              <CardDescription>
                Day-by-day ideal burn rate vs. actual story points remaining
              </CardDescription>
            </div>
            {sprints.length > 0 && (
              <select
                className="px-2.5 py-1.5 border rounded-md text-xs font-medium bg-background"
                value={activeSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            )}
          </CardHeader>
          <CardContent>
            {burndownLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading burndown data...
              </div>
            ) : !burndownData || burndownData.dates.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <Layers className="h-8 w-8 mb-2 opacity-50" />
                Select or create an active sprint to view burndown progress.
              </div>
            ) : (
              <div className="space-y-4">
                {/* SVG Burndown Chart */}
                <div className="relative h-56 w-full pt-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180">
                    <defs>
                      <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 45, 90, 135, 180].map((y) => (
                      <line
                        key={y}
                        x1="40"
                        y1={y}
                        x2="490"
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                      />
                    ))}

                    {/* Y-axis labels */}
                    <text x="30" y="15" fill="#94a3b8" fontSize="10" textAnchor="end">
                      {burndownData.total_story_points}
                    </text>
                    <text x="30" y="95" fill="#94a3b8" fontSize="10" textAnchor="end">
                      {Math.round(burndownData.total_story_points / 2)}
                    </text>
                    <text x="30" y="175" fill="#94a3b8" fontSize="10" textAnchor="end">
                      0
                    </text>

                    {/* Ideal Burndown Line (dashed grey) */}
                    {burndownData.dates.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                        points={burndownData.ideal_burndown
                          .map((val, idx) => {
                            const x = 40 + (idx / (burndownData.dates.length - 1)) * 450;
                            const maxVal = Math.max(1, burndownData.total_story_points);
                            const y = 175 - (val / maxVal) * 160;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    )}

                    {/* Actual Burndown Line (solid blue) */}
                    {burndownData.actual_burndown.length > 0 && (
                      <polyline
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3"
                        points={burndownData.actual_burndown
                          .map((val, idx) => {
                            const totalD = Math.max(1, burndownData.dates.length - 1);
                            const x = 40 + (idx / totalD) * 450;
                            const maxVal = Math.max(1, burndownData.total_story_points);
                            const y = 175 - (val / maxVal) * 160;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    )}

                    {/* Actual points dots */}
                    {burndownData.actual_burndown.map((val, idx) => {
                      const totalD = Math.max(1, burndownData.dates.length - 1);
                      const x = 40 + (idx / totalD) * 450;
                      const maxVal = Math.max(1, burndownData.total_story_points);
                      const y = 175 - (val / maxVal) * 160;
                      return (
                        <circle
                          key={idx}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </svg>
                </div>

                {/* Legend & Summary */}
                <div className="flex flex-wrap items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 border-t-2 border-dashed border-gray-400" />
                      Ideal Guideline
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-4 h-0.5 bg-blue-600 rounded" />
                      Actual Points Remaining
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-medium text-foreground">
                    <span>Total: {burndownData.total_story_points} pts</span>
                    <span>•</span>
                    <span className="text-green-600">Done: {burndownData.completed_points} pts</span>
                    <span>•</span>
                    <span className="text-amber-600">Left: {burndownData.remaining_points} pts</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sprint Velocity History Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" /> Sprint Velocity
            </CardTitle>
            <CardDescription>Committed vs completed points by sprint</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!velocityData || velocityData.sprints.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No past sprint performance logged yet.
              </p>
            ) : (
              velocityData.sprints.map((s) => (
                <div key={s.sprint_id} className="space-y-1.5 p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{s.sprint_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {s.velocity_percentage}%
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, s.velocity_percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Committed: {s.committed_points} pts</span>
                    <span>Completed: {s.completed_points} pts</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Backlog Tasks Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" /> Product Backlog ({backlogTasks.length})
            </CardTitle>
            <CardDescription>
              Prioritized backlog queue. Order defines development precedence.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="font-semibold">
            {totalBacklogPoints} Total Points
          </Badge>
        </CardHeader>
        <CardContent>
          {backlogLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading backlog tasks...
            </div>
          ) : backlogTasks.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed rounded-xl">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2 opacity-80" />
              <p className="font-medium">No tasks in backlog</p>
              <p className="text-xs text-muted-foreground mt-1">
                All tasks for this project have been assigned to sprints.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backlogTasks.map((task, index) => (
                <div
                  key={task.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border rounded-lg hover:border-primary/50 transition-colors gap-3 bg-card"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex flex-col items-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        disabled={index === 0}
                        onClick={() => handleMoveUp(index)}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        #{index + 1}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        disabled={index === backlogTasks.length - 1}
                        onClick={() => handleMoveDown(index)}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{task.title}</span>
                        {task.is_milestone && (
                          <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-[10px] gap-1">
                            <Milestone className="h-2.5 w-2.5" /> Milestone
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {task.story_points ?? 0} pts
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Sprint Assignment */}
                  <div className="flex items-center gap-3 shrink-0">
                    {task.assignee && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px]">
                            {task.assignee.full_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden md:inline">
                          {task.assignee.full_name || task.assignee.email || "User"}
                        </span>
                      </div>
                    )}

                    {sprints.length > 0 && (
                      <select
                        className="px-2.5 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAssignToSprint(task.id, e.target.value);
                          }
                        }}
                      >
                        <option value="" disabled>
                          Assign to sprint...
                        </option>
                        {sprints.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Sprint Modal */}
      <Dialog open={isSprintModalOpen} onOpenChange={setIsSprintModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateSprint}>
            <DialogHeader>
              <DialogTitle>Create New Sprint</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sprint-name">Sprint Name</Label>
                <Input
                  id="sprint-name"
                  placeholder="e.g. Sprint 14 - Checkout Flow"
                  value={sprintName}
                  onChange={(e) => setSprintName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sprint-goal">Sprint Goal</Label>
                <Input
                  id="sprint-goal"
                  placeholder="e.g. Complete payment gateway integration"
                  value={sprintGoal}
                  onChange={(e) => setSprintGoal(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sprint-start">Start Date</Label>
                  <Input
                    id="sprint-start"
                    type="date"
                    value={sprintStart}
                    onChange={(e) => setSprintStart(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sprint-end">End Date</Label>
                  <Input
                    id="sprint-end"
                    type="date"
                    value={sprintEnd}
                    onChange={(e) => setSprintEnd(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSprintModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="!bg-primary hover:!bg-primary/90 !text-primary-foreground">
                Create Sprint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
