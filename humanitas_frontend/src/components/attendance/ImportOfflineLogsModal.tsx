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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  UploadCloud,
    CheckCircle2,
  AlertCircle,
    RefreshCw,
  Loader2,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { useImportOfflinePunchLogs, type OfflineImportResult } from "@/hooks/useAttendance";

interface ImportOfflineLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDeviceSerialNumber?: string;
}

export function ImportOfflineLogsModal({
  isOpen,
  onClose,
  defaultDeviceSerialNumber = "",
}: ImportOfflineLogsModalProps) {
  const [deviceSn, setDeviceSn] = useState(defaultDeviceSerialNumber);
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<OfflineImportResult | null>(null);

  const importMutation = useImportOfflinePunchLogs();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text || "");
    };
    reader.onerror = () => {
      toast.error("Failed to read the selected file.");
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    setContent("");
    setFileName(null);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Please select a file or paste offline punch logs.");
      return;
    }

    try {
      const res = await importMutation.mutateAsync({
        device_serial_number: deviceSn.trim() || "USB_OFFLINE_DEVICE",
        content: content.trim(),
      });
      setResult(res);
      toast.success(
        `Successfully synced ${res.total} punches (${res.reconciled} shifts reconciled)!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to import offline punch logs.");
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Import Offline Biometric Punch Logs</DialogTitle>
              <DialogDescription>
                Sync backlog punches exported via USB or terminal storage during network/server outages.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-3">
            <div className="p-4 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold mb-3">
                <CheckCircle2 className="h-5 w-5" />
                <span>Offline Synchronization Complete</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card className="border shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-foreground">{result.total}</p>
                    <p className="text-xs text-muted-foreground">Total Ingested</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {result.reconciled}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Shifts Reconciled</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{result.processed}</p>
                    <p className="text-xs text-muted-foreground">New Sessions</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{result.duplicatesSkipped}</p>
                    <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-slate-500">{result.debounced}</p>
                    <p className="text-xs text-muted-foreground">5-Min Debounced</p>
                  </CardContent>
                </Card>
                <Card className="border shadow-none">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-red-500">{result.errors}</p>
                    <p className="text-xs text-muted-foreground">Parse Errors</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Past days that were closed with missed punches have been re-evaluated with actual timestamps.
              Any overtime logged past scheduled hours is marked for supervisor review.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-3">
            <div className="p-3 rounded-lg border bg-muted/40 text-xs space-y-1.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <AlertCircle className="h-4 w-4 text-primary" />
                <span>Format Guidelines:</span>
              </div>
              <p>
                Accepts ZKTeco, Hikvision, and Dahua flash drive exports (<code>.dat</code>, <code>.txt</code>, <code>.csv</code>).
                Each line should contain: <code>PIN &lt;TAB/COMMA&gt; YYYY-MM-DD HH:mm:ss</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device-sn">Device Serial Number (Optional)</Label>
              <Input
                id="device-sn"
                placeholder="e.g. ZK-BIO-001 or OFFLINE_IMPORT"
                value={deviceSn}
                onChange={(e) => setDeviceSn(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Upload Export File (.dat, .txt, .csv)</Label>
              <div className="border-2 border-dashed rounded-xl p-4 text-center hover:bg-muted/30 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".dat,.txt,.csv"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={handleFileUpload}
                />
                <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                  <UploadCloud className="h-7 w-7 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {fileName ? fileName : "Click to select or drag and drop offline file"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Supports up to 50,000 punch records per batch
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paste-content">Or Paste Punch Log Lines</Label>
                {content && (
                  <Badge variant="outline" className="text-[10px]">
                    {content.split("\n").filter((l) => l.trim()).length} lines detected
                  </Badge>
                )}
              </div>
              <Textarea
                id="paste-content"
                rows={4}
                placeholder="101&#9;2026-11-08 08:32:15&#9;1&#9;1&#10;102&#9;2026-11-08 17:05:42&#9;1&#9;1"
                className="font-mono text-xs"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {result ? (
            <Button onClick={handleClose} className="w-full sm:w-auto">
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={importMutation.isPending || !content.trim()}
                className="gap-2"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Reconciling Punches...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Process & Reconcile
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
