import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Edit } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EditJobModalProps {
  job: any;
  onSuccess: () => void;
}

const EMPTY_FORM = {
  title: "",
  department: "",
  location: "",
  description: "",
  requirements: "",
  status: "open"
};

export function EditJobModal({ job, onSuccess }: EditJobModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState(EMPTY_FORM);

  // When modal opens, fetch the full job details from Krinai via our backend
  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsFetching(true);

    fetch(`${API_BASE_URL}/recruitment/jobs/${job.id}`, { credentials: "include" })
      .then(res => res.ok ? res.json() : Promise.reject("Failed to fetch job details"))
      .then(data => {
        setFormData({
          title: data.title || job.title || "",
          department: data.department || job.department || "",
          location: data.location || job.location || "",
          description: data.description || job.description || "",
          requirements: Array.isArray(data.requirements)
            ? data.requirements.join("\n")
            : (data.requirements || job.requirements || ""),
          status: data.status || job.status || "open"
        });
      })
      .catch(() => {
        // Fallback to list data if fetch fails
        setFormData({
          title: job.title || "",
          department: job.department || "",
          location: job.location || "",
          description: job.description || "",
          requirements: Array.isArray(job.requirements)
            ? job.requirements.join("\n")
            : (job.requirements || ""),
          status: job.status || "open"
        });
      })
      .finally(() => setIsFetching(false));
  }, [open, job]);

  if (!hasPermission("manage_recruitment")) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);

      const payload = {
        title: formData.title,
        department: formData.department,
        location: formData.location,
        description: formData.description,
        requirements: formData.requirements.split("\n").filter((r: string) => r.trim().length > 0),
        status: formData.status
      };

      const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update job");
      }

      setOpen(false);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit Job</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
          <DialogDescription>
            Update job details in Krinai AI Screening.
          </DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading job details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-title" className="text-right">Job Title</Label>
                <Input
                  id="edit-title"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-department" className="text-right">Department</Label>
                <Input
                  id="edit-department"
                  value={formData.department}
                  onChange={e => setFormData({ ...formData, department: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-location" className="text-right">Location</Label>
                <Input
                  id="edit-location"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Remote, New York..."
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-description" className="text-right pt-2">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="col-span-3"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="edit-requirements" className="text-right pt-2">Requirements</Label>
                <div className="col-span-3">
                  <Textarea
                    id="edit-requirements"
                    value={formData.requirements}
                    onChange={e => setFormData({ ...formData, requirements: e.target.value })}
                    placeholder="One requirement per line"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Enter each requirement on a new line.</p>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-status" className="text-right">Status</Label>
                <div className="col-span-3">
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
