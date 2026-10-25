import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar, Video } from "lucide-react";
import { useCreateInterview } from "@/hooks/useRecruitmentPipeline";
import { toast } from "sonner";

interface ScheduleInterviewModalProps {
  candidate?: any;
  jobs?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ScheduleInterviewModal({
  candidate,
  jobs = [],
  open,
  onOpenChange,
  onSuccess,
}: ScheduleInterviewModalProps) {
  const createInterview = useCreateInterview();

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [interviewType, setInterviewType] = useState<
    "screening" | "technical" | "cultural" | "managerial" | "final"
  >("technical");
  const [interviewerName, setInterviewerName] = useState("Hiring Team");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [meetingLink, setMeetingLink] = useState("");
  const [location, setLocation] = useState("Remote (Google Meet)");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (candidate) {
      setCandidateName(
        candidate.candidate_name ||
          (candidate.first_name && candidate.last_name
            ? `${candidate.first_name} ${candidate.last_name}`
            : candidate.name || "")
      );
      setCandidateEmail(candidate.email || candidate.candidate_email || "");
      setJobId(candidate.job_id || "");
      setJobTitle(candidate.job_title || candidate.job?.title || "");
    }
    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = tomorrow.toISOString().slice(0, 16);
    setScheduledAt(localIso);
    setMeetingLink("https://meet.google.com/xyz-eval-live");
  }, [candidate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName || !scheduledAt) {
      toast.error("Please fill in candidate name and scheduled time.");
      return;
    }

    try {
      const selectedJob = jobs.find((j) => j.id === jobId);
      await createInterview.mutateAsync({
        job_id: jobId || "general",
        job_title: selectedJob?.title || jobTitle || "Open Requisition",
        candidate_id: candidate?.id || `cand-${Date.now()}`,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        interviewer_name: interviewerName,
        interview_type: interviewType,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: parseInt(durationMinutes, 10) || 45,
        meeting_link: meetingLink,
        location: location,
        notes: notes,
      });

      toast.success(`Interview scheduled successfully for ${candidateName}`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule interview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Schedule Candidate Interview</DialogTitle>
              <DialogDescription>
                Set up an interview session with automated calendar & meeting link dispatch.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="candidateName">Candidate Name</Label>
              <Input
                id="candidateName"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="Candidate full name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="candidateEmail">Email Address</Label>
              <Input
                id="candidateEmail"
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="candidate@example.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="jobId">Target Requisition / Job</Label>
              {jobs.length > 0 ? (
                <Select
                  value={jobId}
                  onValueChange={(val) => {
                    setJobId(val);
                    const j = jobs.find((item) => item.id === val);
                    if (j) setJobTitle(j.title);
                  }}
                >
                  <SelectTrigger id="jobId">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Position title"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="interviewType">Interview Stage / Round</Label>
              <Select
                value={interviewType}
                onValueChange={(v: any) => setInterviewType(v)}
              >
                <SelectTrigger id="interviewType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="screening">Phone / Initial Screening</SelectItem>
                  <SelectItem value="technical">Technical Evaluation</SelectItem>
                  <SelectItem value="cultural">Culture & Values Fit</SelectItem>
                  <SelectItem value="managerial">Managerial / Leadership</SelectItem>
                  <SelectItem value="final">Final Executive Round</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="interviewerName">Primary Interviewer</Label>
              <Input
                id="interviewerName"
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
                placeholder="e.g. Lead Engineer / HR Partner"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="durationMinutes">Duration</Label>
              <Select
                value={durationMinutes}
                onValueChange={setDurationMinutes}
              >
                <SelectTrigger id="durationMinutes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledAt">Date & Time</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location / Medium</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Room 402 or Remote"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meetingLink" className="flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-muted-foreground" />
              Meeting Link (Zoom / Meet / Teams)
            </Label>
            <Input
              id="meetingLink"
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Interviewer Briefing & Questions</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Evaluation focus, technical problem statement, or specific competency notes..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createInterview.isPending}>
              {createInterview.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm & Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
