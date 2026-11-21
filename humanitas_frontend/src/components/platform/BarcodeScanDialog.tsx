import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { updateScannerSettings, useScannerSettings } from '@/lib/scannerSettings';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Barcode formats used on retail goods and labels in Ethiopia (EAN/UPC, Code 128/39, ITF) plus QR. */
const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

/** Plain-language reason the camera could not start, with what to do instead. */
export function cameraErrorMessage(err: unknown, secure = typeof window === 'undefined' || window.isSecureContext): string {
  if (!secure) return 'The camera only works on a secure (https) connection. Type the barcode or use a USB scanner instead.';
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  const text = err instanceof Error ? err.message : String(err ?? '');
  if (name === 'NotAllowedError' || /permission|denied|not allowed/i.test(text)) {
    return "Camera access is blocked. Allow the camera for this site (the camera icon in the browser's address bar), then try again.";
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || /not ?found|no camera|requested device/i.test(text)) {
    return 'No camera was found on this device. Type the barcode or use a USB scanner instead.';
  }
  if (name === 'NotReadableError' || /in use|could not start|not readable/i.test(text)) {
    return 'The camera is being used by another app or tab. Close it and try again.';
  }
  return `The camera could not start${text ? `: ${text}` : ''}. Type the barcode or use a USB scanner instead.`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once with the scanned text; the dialog then closes itself. */
  onDetected: (code: string) => void;
  title?: string;
  description?: string;
}

/**
 * Scan a barcode or QR code with the device camera (back camera on phones and tablets).
 * A USB or Bluetooth scanner needs no dialog: it types into the focused field like a keyboard.
 */
export function BarcodeScanDialog({
  open,
  onOpenChange,
  onDetected,
  title = 'Scan a barcode',
  description = 'Point the camera at the barcode. It is read automatically.',
}: Props) {
  const elementId = `barcode-reader-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const onDetectedRef = useRef(onDetected);
  const doneRef = useRef(false);
  const { cameraId } = useScannerSettings();
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let scanner: Html5Qrcode | null = null;
    let cancelled = false;
    doneRef.current = false;
    setError(null);
    setStarting(true);

    // Wait until the dialog has rendered the element the scanner draws into.
    const timer = window.setTimeout(async () => {
      if (cancelled || !document.getElementById(elementId)) return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError(cameraErrorMessage(null, window.isSecureContext));
        setStarting(false);
        return;
      }
      try {
        scanner = new Html5Qrcode(elementId, { verbose: false, formatsToSupport: FORMATS, useBarCodeDetectorIfSupported: true });
        const onRead = (text: string) => {
          const code = text.trim();
          if (doneRef.current || !code) return;
          doneRef.current = true;
          onDetectedRef.current(code);
          onOpenChange(false);
        };
        const keepScanning = () => {
          // No barcode in this frame yet.
        };
        const config = { fps: 10, qrbox: { width: 260, height: 150 } };
        try {
          // The device's chosen camera (Scanner settings); otherwise the back camera.
          await scanner.start(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' }, config, onRead, keepScanning);
        } catch (e) {
          if (!cameraId) throw e;
          // The saved camera is unplugged or gone: forget it; the dialog restarts with the back camera.
          updateScannerSettings({ cameraId: null, cameraLabel: null });
          return;
        }
        Html5Qrcode.getCameras()
          .then((list) => !cancelled && setCameras(list.map((c, i) => ({ id: c.id, label: c.label || `Camera ${i + 1}` }))))
          .catch(() => {});
        if (cancelled && scanner.isScanning) await scanner.stop();
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      } finally {
        if (!cancelled) setStarting(false);
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const s = scanner;
      if (s?.isScanning) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, elementId, onOpenChange, cameraId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera className="h-4 w-4" /> {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="relative min-h-[220px] overflow-hidden rounded-md bg-black/90">
          <div id={elementId} data-testid="barcode-reader" className="w-full" />
          {starting && !error && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="h-4 w-4 animate-spin" /> Starting camera…
            </div>
          )}
          {error && (
            <div role="alert" className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          {cameras.length > 1 ? (
            <Select
              value={cameraId ?? 'auto'}
              onValueChange={(v) => {
                const cam = cameras.find((c) => c.id === v);
                updateScannerSettings(v === 'auto' ? { cameraId: null, cameraLabel: null } : { cameraId: v, cameraLabel: cam?.label ?? null });
              }}
            >
              <SelectTrigger className="h-8 w-56 text-xs" aria-label="Camera"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Back camera (automatic)</SelectItem>
                {cameras.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <span />}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
