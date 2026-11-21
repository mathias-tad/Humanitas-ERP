import { useRef, useState, type KeyboardEvent } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import {
  resetScannerSettings, scanBeep, tuneMaxGap, updateScannerSettings, useScannerSettings, type ScanSuffix,
} from '@/lib/scannerSettings';

interface TestResult {
  code: string;
  slowestGapMs: number;
  suffix: 'enter' | 'tab';
}

/**
 * Barcode scanner settings for this device (saved in the browser): USB/Bluetooth scanner on/off with a
 * test that measures the scanner and tunes detection, what the scanner sends after a code, a beep, and
 * the default camera. Products uses it today; Sales and POS reuse it.
 */
export function ScannerSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const s = useScannerSettings();
  const [result, setResult] = useState<TestResult | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[] | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const times = useRef<number[]>([]);
  const chars = useRef('');

  // While this window is open, scans belong to the test, not to the page behind it.
  useBarcodeScanner(() => {}, { enabled: open });

  /** Measure the scanner directly from the keys it sends, so even a slow device can be tuned. */
  const onTestKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const stamps = times.current;
      const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
      if (chars.current.length >= 1) {
        setResult({ code: chars.current, slowestGapMs: gaps.length ? Math.round(Math.max(...gaps)) : 0, suffix: e.key === 'Tab' ? 'tab' : 'enter' });
        if (s.beep) scanBeep();
      }
      times.current = [];
      chars.current = '';
      e.currentTarget.value = '';
      return;
    }
    if (e.key.length === 1) {
      const now = e.timeStamp || performance.now();
      const last = times.current[times.current.length - 1];
      if (last !== undefined && now - last > 400) {
        times.current = [];
        chars.current = '';
      }
      times.current.push(now);
      chars.current += e.key;
    }
  };

  const applyTest = () => {
    if (!result) return;
    updateScannerSettings({
      maxGapMs: tuneMaxGap(result.slowestGapMs ? [result.slowestGapMs] : []),
      suffix: result.suffix,
      minLength: Math.min(s.minLength, Math.max(1, result.code.length)),
      hardwareEnabled: true,
    });
  };

  const findCameras = async () => {
    setCameraError(null);
    try {
      const list = await Html5Qrcode.getCameras();
      setCameras(list.map((c, i) => ({ id: c.id, label: c.label || `Camera ${i + 1}` })));
    } catch {
      setCameraError('Allow camera access in the browser to list cameras (needs https).');
      setCameras([]);
    }
  };

  const looksLikeScanner = result && result.slowestGapMs <= 120 && result.code.length >= 4;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResult(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanBarcode className="h-4 w-4" /> Barcode scanner settings</DialogTitle>
          <DialogDescription>Saved on this device only, so each till, desk or tablet keeps its own scanner.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="sc-hw">USB / Bluetooth scanner</Label>
              <p className="text-xs text-muted-foreground">Scan anywhere on the page without clicking a field.</p>
            </div>
            <Switch id="sc-hw" checked={s.hardwareEnabled} onCheckedChange={(v) => updateScannerSettings({ hardwareEnabled: v })} />
          </div>

          <div className="space-y-1.5 rounded-md border p-3">
            <Label htmlFor="sc-test">Test your scanner</Label>
            <Input id="sc-test" data-barcode-input placeholder="Click here and scan any barcode" onKeyDown={onTestKey} autoComplete="off" />
            {result && (
              <div className="space-y-2 pt-1 text-sm" role="status">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Read <span className="font-mono">{result.code}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Slowest gap between characters: {result.slowestGapMs} ms · ends with {result.suffix === 'tab' ? 'Tab' : 'Enter'}.{' '}
                  {looksLikeScanner ? 'This is a scanner.' : 'That looks like typing; scan with the device to tune it.'}
                </p>
                {looksLikeScanner && (
                  <Button size="sm" variant="outline" onClick={applyTest}>Use these settings for this scanner</Button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-suffix">Sent after each code</Label>
              <Select value={s.suffix} onValueChange={(v) => updateScannerSettings({ suffix: v as ScanSuffix })}>
                <SelectTrigger id="sc-suffix"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Enter or Tab</SelectItem>
                  <SelectItem value="enter">Enter</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-min">Shortest code</Label>
              <Input id="sc-min" type="number" min={1} max={64} value={s.minLength}
                onChange={(e) => updateScannerSettings({ minLength: Number(e.target.value) })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Detection speed: up to {s.maxGapMs} ms between characters.</p>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sc-beep">Beep on every scan</Label>
            <Switch id="sc-beep" checked={s.beep} onCheckedChange={(v) => { updateScannerSettings({ beep: v }); if (v) scanBeep(); }} />
          </div>
        </section>

        <section className="space-y-2 border-t pt-3">
          <Label>Camera for "Scan with camera"</Label>
          <div className="flex items-center gap-2">
            <Select
              value={s.cameraId ?? 'auto'}
              onValueChange={(v) => {
                const cam = cameras?.find((c) => c.id === v);
                updateScannerSettings(v === 'auto' ? { cameraId: null, cameraLabel: null } : { cameraId: v, cameraLabel: cam?.label ?? s.cameraLabel });
              }}
            >
              <SelectTrigger className="flex-1" aria-label="Default camera"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Back camera (automatic)</SelectItem>
                {s.cameraId && !cameras?.some((c) => c.id === s.cameraId) && (
                  <SelectItem value={s.cameraId}>{s.cameraLabel ?? 'Saved camera'}</SelectItem>
                )}
                {(cameras ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={findCameras}>Find cameras</Button>
          </div>
          {cameraError && <p className="text-xs text-destructive">{cameraError}</p>}
        </section>

        <div className="flex justify-between border-t pt-3">
          <Button variant="ghost" size="sm" onClick={() => { resetScannerSettings(); setResult(null); }}>Reset to defaults</Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
