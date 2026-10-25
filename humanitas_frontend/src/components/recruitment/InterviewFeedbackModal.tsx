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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { useUpdateInterview, type Interview } from "@/hooks/useRecruitmentPipeline";
import { toast } from "sonner";

interface InterviewFeedbackModalProps {
  interview: Interview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function InterviewFeedbackModal({
  interview,
  open,
  onOpenChange,
  onSuccess,
}: InterviewFeedbackModalProps) {
  const updateInterview = useUpdateInterview();
  const [rating, setRating] = useState<number>(4);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [status, setStatus] = useState<
    "scheduled" | "completed" | "cancelled" | "rescheduled"
  >("completed");
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (interview) {
      setRating(interview.rating || 4);
      setStatus(interview.status || "completed");
      setFeedback(interview.feedback || "");
      setNotes(interview.notes || "");
    }
  }, [interview, open]);

  if (!interview) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateInterview.mutateAsync({
        id: interview.id,
        status: status,
        rating: rating,
        feedback: feedback,
        notes: notes,
      });

      toast.success(
        `Evaluation and rating submitted for ${interview.candidate_name}`
      );
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update interview feedback");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
              <Star className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <DialogTitle>Interview Evaluation & Feedback</DialogTitle>
              <DialogDescription>
                Score candidate performance and record structured technical / cultural impressions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Candidate:</span>
              <span className="font-semibold">{interview.candidate_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position:</span>
              <span>{interview.job_title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Interview Type:</span>
              <span className="capitalize">{interview.interview_type}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Performance Rating (1 to 5 Stars)</Label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1 rounded-md transition-colors hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`h-7 w-7 ${
                      star <= (hoverRating || rating)
                        ? "text-amber-500 fill-amber-500"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-semibold text-muted-foreground">
                {rating === 5 && "Outstanding Fit (Strong Hire)"}
                {rating === 4 && "Strong Positive (Hire)"}
                {rating === 3 && "Meets Requirements (Neutral)"}
                {rating === 2 && "Below Standard (Do Not Hire)"}
                {rating === 1 && "Major Concerns (Reject)"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Session Outcome</Label>
            <Select
              value={status}
              onValueChange={(val: any) => setStatus(val)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed Successfully</SelectItem>
                <SelectItem value="scheduled">Keep Scheduled</SelectItem>
                <SelectItem value="rescheduled">Rescheduled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback">Interviewer Evaluation Feedback</Label>
            <Textarea
              id="feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Candidate strengths, problem-solving methodology, domain knowledge, and growth areas..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Internal Hiring Committee Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Next steps, salary expectations noted, or compensation committee comments..."
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
            <Button type="submit" disabled={updateInterview.isPending}>
              {updateInterview.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Save Evaluation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
