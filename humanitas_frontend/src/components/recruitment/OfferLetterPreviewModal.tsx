import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  Printer,
  Building,
  Loader2,
} from "lucide-react";
import { useUpdateOfferStatus, type JobOffer } from "@/hooks/useRecruitmentPipeline";
import { toast } from "sonner";

interface OfferLetterPreviewModalProps {
  offer: JobOffer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated?: () => void;
  onConvertToEmployee?: (offer: JobOffer) => void;
}

export function OfferLetterPreviewModal({
  offer,
  open,
  onOpenChange,
  onStatusUpdated,
  onConvertToEmployee,
}: OfferLetterPreviewModalProps) {
  const updateStatus = useUpdateOfferStatus();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!offer) return null;

  const handleStatusChange = async (
    newStatus: "draft" | "sent" | "accepted" | "rejected"
  ) => {
    try {
      setIsUpdating(true);
      await updateStatus.mutateAsync({
        id: offer.id,
        status: newStatus,
        notes: `Status changed to ${newStatus} on ${new Date().toLocaleDateString()}`,
      });
      toast.success(`Offer status updated to ${newStatus}`);
      if (onStatusUpdated) onStatusUpdated();
      if (newStatus === "accepted" && onConvertToEmployee) {
        onConvertToEmployee(offer);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update offer status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-emerald-600">Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive">Declined / Rejected</Badge>;
      case "sent":
        return <Badge className="bg-blue-600">Sent to Candidate</Badge>;
      default:
        return <Badge variant="secondary">Draft</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Formal Offer Letter Document</DialogTitle>
                <DialogDescription>
                  Digital contract & compensation details for {offer.candidate_name}
                </DialogDescription>
              </div>
            </div>
            <div>{getStatusBadge(offer.status)}</div>
          </div>
        </DialogHeader>

        {/* Printable Letter Paper */}
        <div className="border rounded-xl p-8 bg-card text-card-foreground shadow-sm space-y-6 text-sm print:border-none print:shadow-none">
          <div className="flex justify-between items-start border-b pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <h2 className="font-extrabold text-xl text-primary tracking-tight">
                  HUMANITAS ENTERPRISE
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Division of People Operations & Human Resources
              </p>
              <p className="text-xs text-muted-foreground">
                Reference ID: {offer.id}
              </p>
            </div>
            <div className="text-right text-xs space-y-1 text-muted-foreground">
              <p>Issue Date: {new Date(offer.created_at).toLocaleDateString()}</p>
              {offer.sent_at && (
                <p>Dispatched: {new Date(offer.sent_at).toLocaleDateString()}</p>
              )}
              <p className="text-amber-600 font-semibold">
                Valid Until: {offer.expiration_date}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-base">To: {offer.candidate_name}</p>
            <p className="text-xs text-muted-foreground">
              Email: {offer.candidate_email}
            </p>
            <p className="text-sm text-foreground pt-2 leading-relaxed">
              Dear {offer.candidate_name},
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We are delighted to present this official offer of employment for
              the position of{" "}
              <strong className="text-foreground">{offer.position}</strong> in
              the <strong className="text-foreground">{offer.department}</strong>{" "}
              department. Based on your experience and demonstrated technical
              acumen, we are confident that you will make significant
              contributions to our team.
            </p>
          </div>

          <div className="border rounded-lg p-5 bg-muted/30 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Compensation & Appointment Terms
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Position Title: </span>
                <span className="font-semibold text-foreground">{offer.position}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Department: </span>
                <span className="font-semibold text-foreground">{offer.department}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Annual Base Salary: </span>
                <span className="font-bold text-base text-primary">
                  {offer.currency} {Number(offer.base_salary).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Classification: </span>
                <span className="font-semibold capitalize text-foreground">
                  {offer.employment_type.replace("_", "-")}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Anticipated Start Date: </span>
                <span className="font-semibold text-foreground">{offer.start_date}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Offer Expiry: </span>
                <span className="font-semibold text-amber-600">{offer.expiration_date}</span>
              </div>
            </div>
          </div>

          {offer.terms_notes && (
            <div className="space-y-1.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Benefits, Bonus & Stipulations
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line border rounded-md p-3 bg-muted/10">
                {offer.terms_notes}
              </p>
            </div>
          )}

          <div className="border-t pt-6 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">For Humanitas Enterprise:</p>
              <div className="h-12 border-b border-dashed mb-1 flex items-end">
                <span className="font-serif italic text-primary/80">Authorized Digital Signature</span>
              </div>
              <p>VP of Human Resources & Talent</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Candidate Acceptance:</p>
              <div className="h-12 border-b border-dashed mb-1 flex items-end">
                {offer.status === "accepted" ? (
                  <span className="font-serif italic text-emerald-600 font-bold">
                    ✓ Digitally Signed & Accepted
                  </span>
                ) : (
                  <span className="italic text-muted-foreground">Pending Signature</span>
                )}
              </div>
              <p>Signature & Date</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Print / PDF
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {offer.status === "draft" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleStatusChange("sent")}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-4 w-4" />
                )}
                Mark as Sent
              </Button>
            )}

            {offer.status !== "accepted" && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleStatusChange("accepted")}
                disabled={isUpdating}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Mark Accepted & Hire
              </Button>
            )}

            {offer.status !== "rejected" && offer.status !== "accepted" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleStatusChange("rejected")}
                disabled={isUpdating}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Decline / Reject
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
