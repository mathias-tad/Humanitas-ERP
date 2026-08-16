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
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Edit2 } from "lucide-react";
import { usePMS } from "@/hooks/usePMS";
import type { ManualKPIMetric } from "@/hooks/usePMS";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KPISettingsProps {
  disabled?: boolean;
}

export function KPISettings({ disabled: _disabled = false }: KPISettingsProps) {
  const { usePMSSettings, updateSettings, useMetrics, createMetric, updateMetric, deleteMetric } = usePMS();
  const { data: settings, isLoading: isLoadingSettings } = usePMSSettings();
  const { data: metrics, isLoading: isLoadingMetrics } = useMetrics();

  // Settings State
  const [formData, setFormData] = useState<{
    review_cycle: string;
    kpi_weight_system: number;
    kpi_weight_manual: number;
    rating_scale: any[];
  }>({
    review_cycle: "quarterly",
    kpi_weight_system: 50,
    kpi_weight_manual: 50,
    rating_scale: [],
  });

  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<ManualKPIMetric | null>(null);
  const [metricForm, setMetricForm] = useState({
    name: "",
    description: "",
    max_score: 10,
    weight: 1,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        review_cycle: "quarterly", // Fallback as this might not be in PMSSettings interface yet
        kpi_weight_system: settings.kpi_weight_system ?? 50,
        kpi_weight_manual: settings.kpi_weight_manual ?? 50,
        rating_scale: [], // Placeholder if we want to keep rating scale UI
      });
    }
  }, [settings]);

  const handleSliderChange = (val: number[]) => {
    const systemWeight = val[0];
    setFormData((prev) => ({
      ...prev,
      kpi_weight_system: systemWeight,
      kpi_weight_manual: 100 - systemWeight,
    }));
  };

  const saveWeights = async () => {
    // Only update the weights in PMSSettings
    await updateSettings.mutateAsync({
      kpi_weight_system: formData.kpi_weight_system,
      kpi_weight_manual: formData.kpi_weight_manual,
    } as any);
  };

  // Metric CRUD
  const handleOpenMetricModal = (metric?: ManualKPIMetric) => {
    if (metric) {
      setEditingMetric(metric);
      setMetricForm({
        name: metric.name,
        description: metric.description || "",
        max_score: metric.max_score,
        weight: metric.weight,
      });
    } else {
      setEditingMetric(null);
      setMetricForm({ name: "", description: "", max_score: 10, weight: 1 });
    }
    setMetricModalOpen(true);
  };

  const handleSaveMetric = async () => {
    if (editingMetric) {
      await updateMetric.mutateAsync({ id: editingMetric.id, data: metricForm });
    } else {
      await createMetric.mutateAsync(metricForm);
    }
    setMetricModalOpen(false);
  };

  const handleDeleteMetric = async (id: string) => {
    await deleteMetric.mutateAsync(id);
  };

  if (isLoadingSettings || isLoadingMetrics) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Performance Weighting</CardTitle>
          <CardDescription>
            Balance the importance of System Data vs Manual Reviews.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center justify-between text-sm font-medium mb-2">
            <span>System Data ({formData.kpi_weight_system}%)</span>
            <span>Manual Reviews ({formData.kpi_weight_manual}%)</span>
          </div>
          <Slider
            defaultValue={[formData.kpi_weight_system]}
            max={100}
            step={5}
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground text-center">
            Drag to adjust. Left side favors automatic metrics (time, completion), right side favors human assessment.
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={saveWeights} disabled={updateSettings.isPending}>
            {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Weights
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manual Metrics</CardTitle>
            <CardDescription>
              Define subjective criteria for employee evaluation (e.g., Leadership, Innovation).
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => handleOpenMetricModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Metric
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            {metrics?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No manual metrics defined yet.
              </div>
            ) : (
              <div className="divide-y">
                {metrics?.map(metric => (
                  <div key={metric.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div>
                      <h4 className="font-semibold">{metric.name}</h4>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                      <div className="text-xs text-muted-foreground flex gap-4 mt-1">
                        <span>Max Score: <b>{metric.max_score}</b></span>
                        <span>Weight Multiplier: <b>x{metric.weight}</b></span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenMetricModal(metric)}>
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteMetric(metric.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={metricModalOpen} onOpenChange={setMetricModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMetric ? "Edit Metric" : "Add Metric"}</DialogTitle>
            <DialogDescription>
              Define a new performance criterion for manual reviews.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <Label>Metric Name</Label>
              <Input
                value={metricForm.name}
                onChange={e => setMetricForm({ ...metricForm, name: e.target.value })}
                placeholder="e.g. Leadership"
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={metricForm.description}
                onChange={e => setMetricForm({ ...metricForm, description: e.target.value })}
                placeholder="Brief explanation for the reviewer..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  value={metricForm.max_score}
                  onChange={e => setMetricForm({ ...metricForm, max_score: parseInt(e.target.value) })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Weight Multiplier</Label>
                <Input
                  type="number"
                  min="1"
                  value={metricForm.weight}
                  onChange={e => setMetricForm({ ...metricForm, weight: parseInt(e.target.value) })}
                />
                <p className="text-[10px] text-muted-foreground">Higher = more impact</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetricModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveMetric} disabled={createMetric.isPending || updateMetric.isPending}>
              {createMetric.isPending || updateMetric.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
