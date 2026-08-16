import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AddCandidateModalProps {
  jobs: any[];
  onSuccess: () => void;
}

export function AddCandidateModal({ jobs, onSuccess }: AddCandidateModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAuth();

  const [formData, setFormData] = useState({
    job_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: ""
  });
  
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  if (!hasPermission("manage_recruitment")) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      setError("Please select a resume file.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const payload = new FormData();
      payload.append("job_id", formData.job_id);
      payload.append("first_name", formData.first_name);
      payload.append("last_name", formData.last_name);
      payload.append("email", formData.email);
      if (formData.phone) payload.append("phone", formData.phone);
      payload.append("resume_file", resumeFile);

      const res = await fetch(`${API_BASE_URL}/recruitment/applications`, {
        method: "POST",
        credentials: "include",
        body: payload // fetch handles multipart form-data headers automatically when body is FormData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to add candidate");
      }

      setOpen(false);
      setFormData({
        job_id: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: ""
      });
      setResumeFile(null);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Only allow adding to open jobs
  const openJobs = jobs.filter(j => j.status === 'open' || j.is_active);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Candidate</DialogTitle>
          <DialogDescription>
            Submit an application for AI screening.
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
              <Label htmlFor="job_id" className="text-right">Job</Label>
              <div className="col-span-3">
                <Select value={formData.job_id} onValueChange={(v) => setFormData({ ...formData, job_id: v })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {openJobs.length === 0 ? (
                      <SelectItem value="none" disabled>No open jobs available</SelectItem>
                    ) : (
                      openJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="first_name" className="text-right">First Name</Label>
              <Input 
                id="first_name" 
                value={formData.first_name} 
                onChange={e => setFormData({ ...formData, first_name: e.target.value })} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="last_name" className="text-right">Last Name</Label>
              <Input 
                id="last_name" 
                value={formData.last_name} 
                onChange={e => setFormData({ ...formData, last_name: e.target.value })} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">Email</Label>
              <Input 
                id="email" 
                type="email"
                value={formData.email} 
                onChange={e => setFormData({ ...formData, email: e.target.value })} 
                className="col-span-3" 
                required 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">Phone</Label>
              <Input 
                id="phone" 
                type="tel"
                value={formData.phone} 
                onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="resume_file" className="text-right">Resume</Label>
              <Input 
                id="resume_file" 
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    setResumeFile(e.target.files[0]);
                  }
                }} 
                className="col-span-3" 
                required 
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || openJobs.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
