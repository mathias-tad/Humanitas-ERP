import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Link as LinkIcon, Copy, Plus, AlertOctagon, RefreshCw } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { toast } from "sonner";

interface ApplicationLinksModalProps {
  jobId: string;
  jobTitle: string;
}

export function ApplicationLinksModal({ jobId, jobTitle }: ApplicationLinksModalProps) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const [expiryType, setExpiryType] = useState("none");
  const [expiresAt, setExpiresAt] = useState("");
  const [applicantCap, setApplicantCap] = useState("");

  const fetchLinks = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/links`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setLinks(data || []);
      }
    } catch (err) {
      toast.error("Failed to fetch application links.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLinks();
    }
  }, [open, jobId]);

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const payload: any = { expiry_type: expiryType };
      if (expiryType === "time" && expiresAt) {
        payload.expires_at = new Date(expiresAt).toISOString();
      } else if (expiryType === "count" && applicantCap) {
        payload.applicant_cap = parseInt(applicantCap, 10);
      }

      const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success("Application link generated!");
        setExpiryType("none");
        setExpiresAt("");
        setApplicantCap("");
        fetchLinks();
      } else {
        const errorData = await res.json();
        toast.error(errorData.message || "Failed to generate link.");
      }
    } catch (err) {
      toast.error("Network error while generating link.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloseApplications = async () => {
    setIsClosing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/links/expire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: "Manually closed by recruiter" })
      });
      if (res.ok) {
        toast.success("All links have been closed.");
        fetchLinks();
      } else {
        toast.error("Failed to close applications.");
      }
    } catch (err) {
      toast.error("Network error.");
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopen = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/links/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({})
      });
      if (res.ok) {
        toast.success("Applications re-opened.");
        fetchLinks();
      } else {
        toast.error("Failed to re-open applications.");
      }
    } catch (err) {
      toast.error("Network error.");
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/apply/${token}`;

    // Try modern clipboard API first (HTTPS only)
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Link copied to clipboard!");
      }).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  };

  const fallbackCopy = (text: string) => {
    // Append INSIDE the dialog to escape focus trap
    const dialogEl = document.querySelector('[role="dialog"]') || document.body;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.width = "1px";
    textarea.style.height = "1px";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.boxShadow = "none";
    textarea.style.background = "transparent";
    dialogEl.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    dialogEl.removeChild(textarea);
    if (success) {
      toast.success("Link copied to clipboard!");
    } else {
      toast.error("Auto-copy failed — please copy the URL below manually.");
    }
  };

  const activeLinks = links.filter(l => l.status === "active");
  const hasExpired = links.some(l => l.status === "expired");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LinkIcon className="h-4 w-4 mr-1" /> Links
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Application Links</DialogTitle>
          <DialogDescription>
            Manage public application links for {jobTitle}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* New Link Form */}
            <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
              <h4 className="font-semibold text-sm">Generate New Link</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium">Automatic Expiration</label>
                  <select
                    value={expiryType}
                    onChange={(e) => setExpiryType(e.target.value)}
                    className="w-full mt-1 p-2 border rounded text-sm bg-background"
                  >
                    <option value="none">Never (Manual Close Only)</option>
                    <option value="time">On a Specific Date & Time</option>
                    <option value="count">After a Maximum Number of Applicants</option>
                  </select>
                </div>
                {expiryType === "time" && (
                  <div>
                    <label className="text-xs font-medium">Expiration Date & Time (Local)</label>
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full mt-1 p-2 border rounded text-sm bg-background"
                    />
                  </div>
                )}
                {expiryType === "count" && (
                  <div>
                    <label className="text-xs font-medium">Maximum Applications</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 50"
                      value={applicantCap}
                      onChange={(e) => setApplicantCap(e.target.value)}
                      className="w-full mt-1 p-2 border rounded text-sm bg-background"
                    />
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleGenerateLink}
                    disabled={isGenerating || (expiryType === "time" && !expiresAt) || (expiryType === "count" && !applicantCap)}
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            {/* List Links */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-sm">Active & Past Links</h4>
                <div className="flex gap-2">
                  {activeLinks.length > 0 && (
                    <Button variant="destructive" size="sm" onClick={handleCloseApplications} disabled={isClosing}>
                      {isClosing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <AlertOctagon className="h-3 w-3 mr-1" />}
                      Close All
                    </Button>
                  )}
                  {hasExpired && activeLinks.length === 0 && (
                    <Button variant="outline" size="sm" onClick={handleReopen}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Reopen
                    </Button>
                  )}
                </div>
              </div>

              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No links generated yet.</p>
              ) : (
                <div className="space-y-2">
                  {links.map((link) => (
                    <div key={link.id} className="p-3 border rounded-md bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${link.status === "active" ? "bg-green-500" : "bg-red-400"}`} />
                          <span className={`text-xs font-medium ${link.status === "active" ? "text-green-600" : "text-red-500"}`}>
                            {link.status === "active" ? "Active" : "Expired"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {link.current_count} submissions
                          {link.applicant_cap ? ` / ${link.applicant_cap} cap` : ""}
                          {link.expires_at ? ` · Expires: ${new Date(link.expires_at).toLocaleString()}` : ""}
                        </p>
                      </div>
                      {/* URL row — always visible so user can copy manually on HTTP */}
                      <div className="flex items-center gap-2">
                        <input
                          readOnly
                          value={`${window.location.origin}/apply/${link.token}`}
                          className="flex-1 text-xs font-mono bg-muted/50 border rounded px-2 py-1.5 select-all cursor-text text-foreground"
                          onFocus={(e) => e.target.select()}
                        />
                        <Button variant="outline" size="sm" onClick={() => copyLink(link.token)} className="shrink-0">
                          <Copy className="h-4 w-4 mr-1" /> Copy
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
