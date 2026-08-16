import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface TaskStatus {
  id?: string;
  name: string;
  color: string;
  order: number;
}

interface TaskPriority {
  id?: string;
  name: string;
  color: string;
  order: number;
}

interface TaskSettingsData {
  statuses: TaskStatus[];
  priorities: TaskPriority[];
}

const defaultColors = [
  "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"
];

interface TaskSettingsProps {
  disabled?: boolean;
}

export function TaskSettings({ disabled: _disabled = false }: TaskSettingsProps) {
  const [settings, setSettings] = useState<TaskSettingsData>({
    statuses: [],
    priorities: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/tasks`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          const statuses = (data.statuses || []).map((s: TaskStatus, i: number) => ({
            id: s.id || crypto.randomUUID(),
            name: s.name || "",
            color: s.color || defaultColors[i % defaultColors.length],
            order: s.order ?? i,
          }));
          const priorities = (data.priorities || []).map((p: TaskPriority, i: number) => ({
            id: p.id || crypto.randomUUID(),
            name: p.name || "",
            color: p.color || ["#ef4444", "#eab308", "#22c55e"][i % 3],
            order: p.order ?? i,
          }));
          setSettings({ statuses, priorities });
        }
      }
    } catch (error) {
      console.error("Failed to fetch task settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(`${API_BASE_URL}/settings/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(settings),
      });

      if (!response.ok) throw new Error("Failed to save settings");
      setMessage({ type: "success", text: "Task settings saved!" });
    } catch (error) {
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  const addStatus = () => {
    const order = settings.statuses.length;
    const newStatus: TaskStatus = {
      id: crypto.randomUUID(),
      name: "",
      color: defaultColors[order % defaultColors.length],
      order,
    };
    setSettings({ ...settings, statuses: [...settings.statuses, newStatus] });
  };

  const updateStatus = (id: string, field: keyof TaskStatus, value: string | number) => {
    setSettings({
      ...settings,
      statuses: settings.statuses.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    });
  };

  const deleteStatus = (id: string) => {
    setSettings({
      ...settings,
      statuses: settings.statuses.filter((s) => s.id !== id),
    });
  };

  const addPriority = () => {
    const order = settings.priorities.length;
    const colors = ["#ef4444", "#eab308", "#22c55e"];
    const newPriority: TaskPriority = {
      id: crypto.randomUUID(),
      name: "",
      color: colors[order % colors.length],
      order,
    };
    setSettings({ ...settings, priorities: [...settings.priorities, newPriority] });
  };

  const updatePriority = (id: string, field: keyof TaskPriority, value: string | number) => {
    setSettings({
      ...settings,
      priorities: settings.priorities.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    });
  };

  const deletePriority = (id: string) => {
    setSettings({
      ...settings,
      priorities: settings.priorities.filter((p) => p.id !== id),
    });
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
    <div className="space-y-6">
      {message.text && (
        <div
          className={`px-4 py-2 rounded text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Task Statuses</CardTitle>
          <CardDescription>Define the workflow stages for tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {settings.statuses.map((status) => (
              <div key={status.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={status.color || "#3b82f6"}
                  onChange={(e) => updateStatus(status.id!, "color", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                  style={{ backgroundColor: status.color || "#3b82f6" }}
                />
                <Input
                  type="text"
                  value={status.name || ""}
                  onChange={(e) => updateStatus(status.id!, "name", e.target.value)}
                  placeholder="Status name"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => deleteStatus(status.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {settings.statuses.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No statuses configured
              </p>
            )}
            <Button variant="outline" onClick={addStatus} className="w-full mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add New Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priorities</CardTitle>
          <CardDescription>Define task priority levels.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {settings.priorities.map((priority) => (
              <div key={priority.id} className="flex items-center gap-2">
                <input
                  type="color"
                  value={priority.color || "#ef4444"}
                  onChange={(e) => updatePriority(priority.id!, "color", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                  style={{ backgroundColor: priority.color || "#ef4444" }}
                />
                <Input
                  type="text"
                  value={priority.name || ""}
                  onChange={(e) => updatePriority(priority.id!, "name", e.target.value)}
                  placeholder="Priority name"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" onClick={() => deletePriority(priority.id!)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {settings.priorities.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No priorities configured
              </p>
            )}
            <Button variant="outline" onClick={addPriority} className="w-full mt-2">
              <Plus className="h-4 w-4 mr-2" />
              Add New Priority
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Task Settings"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
