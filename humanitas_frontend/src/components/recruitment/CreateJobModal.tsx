import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CreateJobModalProps {
  onSuccess: () => void;
}

export function CreateJobModal({ onSuccess }: CreateJobModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "",
    description: "",
    requirements: "",
    status: "open"
  });

  if (!hasPermission("manage_recruitment")) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      
      const payload = {
        ...formData,
        requirements: formData.requirements.split("\n").filter((r: string) => r.trim().length > 0)
      };

      const res = await fetch(`${API_BASE_URL}/recruitment/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create job");
      }

      setOpen(false);
      setFormData({
        title: "",
        department: "",
        location: "",
        description: "",
        requirements: "",
        status: "open"
      });
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Post a new job opening to Krinai AI Screening.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Job Title</Label>
              <Input 
                id="title" 
                value={formData.title} 
                onChange={e => setFormData({ ...formData, title: e.target.value })} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">Department</Label>
              <Input 
                id="department" 
                value={formData.department} 
                onChange={e => setFormData({ ...formData, department: e.target.value })} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">Location</Label>
              <Input 
                id="location" 
                value={formData.location} 
                onChange={e => setFormData({ ...formData, location: e.target.value })} 
                className="col-span-3" 
                placeholder="e.g. Remote, New York..."
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="description" className="text-right pt-2">Description</Label>
              <Textarea 
                id="description" 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                className="col-span-3" 
                rows={4}
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="requirements" className="text-right pt-2">Requirements</Label>
              <div className="col-span-3">
                <Textarea 
                  id="requirements" 
                  value={formData.requirements} 
                  onChange={e => setFormData({ ...formData, requirements: e.target.value })} 
                  placeholder="One requirement per line"
                  rows={4}
                  required 
                />
                <p className="text-xs text-muted-foreground mt-1">Enter each requirement on a new line.</p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <div className="col-span-3">
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
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
              Create Job
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
