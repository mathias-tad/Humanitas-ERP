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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileCheck2, Eye } from "lucide-react";
import { useCreateOffer } from "@/hooks/useRecruitmentPipeline";
import { toast } from "sonner";

interface GenerateOfferModalProps {
  candidate?: any;
  jobs?: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function GenerateOfferModal({
  candidate,
  jobs: _jobs = [],
  open,
  onOpenChange,
  onSuccess,
}: GenerateOfferModalProps) {
  const createOffer = useCreateOffer();

  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [position, setPosition] = useState("");
  const [employmentType, setEmploymentType] = useState<
    "full_time" | "part_time" | "contract"
  >("full_time");
  const [baseSalary, setBaseSalary] = useState("85000");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [termsNotes, setTermsNotes] = useState(
    "Standard full-time employment with comprehensive medical, dental, 401(k) retirement plan matching, and 24 days annual paid time off."
  );
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (candidate) {
      const name =
        candidate.candidate_name ||
        (candidate.first_name && candidate.last_name
          ? `${candidate.first_name} ${candidate.last_name}`
          : candidate.name || "");
      setCandidateName(name);
      setCandidateEmail(candidate.email || candidate.candidate_email || "");
      setJobId(candidate.job_id || "");
      const title = candidate.job_title || candidate.job?.title || "Specialist";
      setJobTitle(title);
      setPosition(title);
      if (candidate.job?.department) setDepartment(candidate.job.department);
    }

    const start = new Date();
    start.setDate(start.getDate() + 14);
    setStartDate(start.toISOString().split("T")[0]);

    const exp = new Date();
    exp.setDate(exp.getDate() + 7);
    setExpirationDate(exp.toISOString().split("T")[0]);
  }, [candidate, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName || !position || !baseSalary || !startDate) {
      toast.error("Please fill in all mandatory offer details.");
      return;
    }

    try {
      await createOffer.mutateAsync({
        job_id: jobId || "general",
        job_title: jobTitle || position,
        candidate_id: candidate?.id || `cand-${Date.now()}`,
        candidate_name: candidateName,
        candidate_email: candidateEmail,
        department: department,
        position: position,
        base_salary: parseFloat(baseSalary) || 0,
        currency: currency,
        employment_type: employmentType,
        start_date: startDate,
        expiration_date: expirationDate,
        terms_notes: termsNotes,
      });

      toast.success(`Official offer letter generated for ${candidateName}`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate offer letter");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Generate Official Job Offer</DialogTitle>
              <DialogDescription>
                Create, preview, and issue a formalized compensation package and employment letter.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="details">Offer Parameters</TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              Digital Letter Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="candidateName">Candidate Name</Label>
                  <Input
                    id="candidateName"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="candidateEmail">Candidate Email</Label>
                  <Input
                    id="candidateEmail"
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="position">Position Title</Label>
                  <Input
                    id="position"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="department">Department</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger id="department">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engineering">Engineering & Technology</SelectItem>
                      <SelectItem value="Product & Design">Product & Design</SelectItem>
                      <SelectItem value="Sales & Marketing">Sales & Marketing</SelectItem>
                      <SelectItem value="Operations & HR">Operations & HR</SelectItem>
                      <SelectItem value="Finance & Accounting">Finance & Accounting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="ETB">ETB (Br)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="baseSalary">Base Annual Compensation</Label>
                  <Input
                    id="baseSalary"
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="employmentType">Contract Type</Label>
                  <Select
                    value={employmentType}
                    onValueChange={(v: any) => setEmploymentType(v)}
                  >
                    <SelectTrigger id="employmentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full-Time Regular</SelectItem>
                      <SelectItem value="part_time">Part-Time</SelectItem>
                      <SelectItem value="contract">Fixed Contract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Anticipated Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expirationDate">Offer Expiry Date</Label>
                  <Input
                    id="expirationDate"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="termsNotes">Terms, Benefits & Stipulations</Label>
                <Textarea
                  id="termsNotes"
                  rows={3}
                  value={termsNotes}
                  onChange={(e) => setTermsNotes(e.target.value)}
                  placeholder="Included benefits, probation conditions, equity, bonuses..."
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setActiveTab("preview")}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Letter
                </Button>
                <Button type="submit" disabled={createOffer.isPending}>
                  {createOffer.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create & Issue Offer
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="preview">
            <div className="border rounded-xl p-6 bg-card text-card-foreground shadow-xs space-y-5 text-sm">
              <div className="border-b pb-4 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-primary tracking-tight">
                    HUMANITAS ENTERPRISE
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Corporate Talent Acquisition & HR
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Date: {new Date().toLocaleDateString()}</p>
                  <p className="font-semibold text-primary">OFFER OF EMPLOYMENT</p>
                </div>
              </div>

              <div>
                <p className="font-medium text-foreground">Dear {candidateName || "[Candidate Name]"},</p>
                <p className="mt-2 text-muted-foreground leading-relaxed">
                  On behalf of <strong>Humanitas Enterprise</strong>, we are thrilled to offer you the position of{" "}
                  <strong className="text-foreground">{position || "[Position Title]"}</strong> within our{" "}
                  <strong>{department}</strong> division. We were tremendously impressed with your background, skills, and values alignment throughout our evaluation process.
                </p>
              </div>

              <div className="bg-muted/40 rounded-lg p-4 space-y-2 border">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Key Employment Terms:
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Position: </span>
                    <span className="font-medium">{position || "TBD"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Department: </span>
                    <span className="font-medium">{department}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Annual Base Salary: </span>
                    <span className="font-bold text-primary">
                      {currency} {Number(baseSalary || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Employment Classification: </span>
                    <span className="font-medium capitalize">{employmentType.replace("_", "-")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Start Date: </span>
                    <span className="font-medium">{startDate || "To be confirmed"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Offer Expiration: </span>
                    <span className="font-medium text-amber-600">{expirationDate || "7 days from issue"}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Benefits & Special Provisions:
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {termsNotes}
                </p>
              </div>

              <div className="border-t pt-4 text-xs text-muted-foreground flex justify-between items-center">
                <span>Authorized Signatory: Humanitas VP People Operations</span>
                <span className="italic">Candidate Acceptance Signature Required</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setActiveTab("details")}>
                Back to Details
              </Button>
              <Button onClick={handleSubmit} disabled={createOffer.isPending}>
                {createOffer.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm & Generate Offer
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
