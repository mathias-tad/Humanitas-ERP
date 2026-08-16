import { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";
import {
  Loader2,
  Smartphone,
  QrCode,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Camera,
  LogIn,
  LogOut
} from "lucide-react";

interface Device {
  id: string;
  device_id: string;
  device_name: string;
  device_type: string;
  registered_at: string;
  approved_at: string | null;
}

// Generate a unique device ID based on browser fingerprint
const generateDeviceId = (): string => {
  const nav = window.navigator;
  const screen = window.screen;
  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    nav.hardwareConcurrency || '',
    (nav as any).deviceMemory || '',
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'DEV-' + Math.abs(hash).toString(36).toUpperCase();
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let deviceName = 'Unknown Device';
  let deviceType = 'desktop';

  if (/iPhone/.test(ua)) {
    deviceName = 'iPhone';
    deviceType = 'mobile';
  } else if (/iPad/.test(ua)) {
    deviceName = 'iPad';
    deviceType = 'tablet';
  } else if (/Android/.test(ua)) {
    deviceName = 'Android Device';
    deviceType = /Mobile/.test(ua) ? 'mobile' : 'tablet';
  } else if (/Windows/.test(ua)) {
    deviceName = 'Windows PC';
  } else if (/Mac/.test(ua)) {
    deviceName = 'Mac';
  } else if (/Linux/.test(ua)) {
    deviceName = 'Linux PC';
  }

  return { deviceName, deviceType };
};

export default function ClockIn() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [currentDeviceId] = useState(generateDeviceId());
  const [isDeviceRegistered, setIsDeviceRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isClocking, setIsClocking] = useState(false);

  const [qrCode, setQrCode] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [clockStatus, setClockStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [clockMessage, setClockMessage] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Schedule validation state
  const [scheduleInfo, setScheduleInfo] = useState<{
    schedule: any;
    validation: {
      canClockIn: boolean;
      message: string;
      shift?: any;
      isLate?: boolean;
      minutesLate?: number;
      lateTolerance?: number;
    };
  } | null>(null);

  const getHeaders = () => ({
    "Content-Type": "application/json",
  });

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchDevices();
      fetchScheduleInfo();
    }
  }, [isAuthenticated, authLoading]);

  const fetchScheduleInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance/my-schedule`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setScheduleInfo(data);
      }
    } catch (error) {
      console.error("Error fetching schedule:", error);
    }
  };

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/attendance/device/my-devices`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data);

        // Check if current device is registered
        const found = data.find((d: Device) => d.device_id === currentDeviceId);
        setIsDeviceRegistered(!!found);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterDevice = async () => {
    setIsRegistering(true);
    const { deviceName, deviceType } = getDeviceInfo();

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/device/register`, {
        method: "POST",
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          device_id: currentDeviceId,
          device_name: deviceName,
          device_type: deviceType,
        }),
      });

      if (response.ok) {
        await fetchDevices();
        setClockStatus('success');
        setClockMessage('Device registered successfully!');
      } else {
        const error = await response.json();
        setClockStatus('error');
        setClockMessage(error.message || 'Failed to register device');
      }
    } catch (error) {
      console.error("Error registering device:", error);
      setClockStatus('error');
      setClockMessage('Failed to register device');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to remove this device?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/attendance/device/${deviceId}`, {
        method: "DELETE",
        headers: getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices();
      }
    } catch (error) {
      console.error("Error removing device:", error);
    }
  };

  const handleClock = async (type: 'in' | 'out') => {
    if (!qrCode.trim()) {
      setClockStatus('error');
      setClockMessage('Please enter or scan a QR code');
      return;
    }

    setIsClocking(true);
    setClockStatus('idle');

    try {
      const endpoint = type === 'in' ? 'secure-clock-in' : 'secure-clock-out';
      const response = await fetch(`${API_BASE_URL}/attendance/${endpoint}`, {
        method: "POST",
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          qr_code: qrCode,
          device_id: currentDeviceId,
        }),
      });

      if (response.ok) {
        setClockStatus('success');
        setClockMessage(`Successfully clocked ${type}!`);
        setQrCode("");
      } else {
        const error = await response.json();
        setClockStatus('error');
        setClockMessage(error.message || `Failed to clock ${type}`);
      }
    } catch (error) {
      console.error("Error clocking:", error);
      setClockStatus('error');
      setClockMessage(`Failed to clock ${type}`);
    } finally {
      setIsClocking(false);
    }
  };

  const startScanner = async () => {
    setScannerError("");
    setIsScanning(true);

    try {
      // First, request camera permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" }, // Use back camera on mobile
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR code scanned successfully
          setQrCode(decodedText);
          stopScanner();
          setIsScannerOpen(false);
          setClockStatus('success');
          setClockMessage('QR code scanned successfully!');
        },
        () => {
          // Scan error (ignore, keep scanning)
        }
      );
    } catch (err: any) {
      console.error("Scanner error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setScannerError("Camera permission denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setScannerError("No camera found on this device.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setScannerError("Camera is already in use by another application.");
      } else if (err.name === 'OverconstrainedError') {
        setScannerError("Camera constraints not satisfied. Trying front camera...");
        // Try front camera as fallback
        tryFrontCamera();
        return;
      } else {
        setScannerError(err?.message || "Failed to start camera. Please check camera permissions.");
      }
      setIsScanning(false);
    }
  };

  const tryFrontCamera = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "user" }, // Use front camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          setQrCode(decodedText);
          stopScanner();
          setIsScannerOpen(false);
          setClockStatus('success');
          setClockMessage('QR code scanned successfully!');
        },
        () => { }
      );
    } catch (err: any) {
      console.error("Front camera error:", err);
      setScannerError("Could not access any camera. Please check permissions.");
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  const handleOpenScanner = () => {
    setIsScannerOpen(true);
    setScannerError("");
    // Start scanner after dialog opens
    setTimeout(() => {
      startScanner();
    }, 500);
  };

  const handleCloseScanner = () => {
    stopScanner();
    setIsScannerOpen(false);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Attendance Clock</h1>
        <p className="text-gray-500 mt-1">Clock in/out using QR code verification</p>
      </div>

      {/* Current Time Display */}
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-12 w-12 mx-auto text-blue-600 mb-4" />
          <p className="text-4xl font-bold text-foreground font-mono">
            {new Date().toLocaleTimeString()}
          </p>
          <p className="text-gray-500 mt-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </CardContent>
      </Card>

      {/* Schedule Status */}
      {scheduleInfo && (
        <Card className={
          !scheduleInfo.validation.canClockIn
            ? 'border-red-200 bg-red-50'
            : scheduleInfo.validation.isLate
              ? 'border-yellow-200 bg-yellow-50'
              : 'border-green-200 bg-green-50'
        }>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              {!scheduleInfo.validation.canClockIn ? (
                <XCircle className="h-6 w-6 text-red-600 mt-0.5" />
              ) : scheduleInfo.validation.isLate ? (
                <Clock className="h-6 w-6 text-yellow-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-6 w-6 text-green-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${!scheduleInfo.validation.canClockIn
                  ? 'text-red-800'
                  : scheduleInfo.validation.isLate
                    ? 'text-yellow-800'
                    : 'text-green-800'
                  }`}>
                  {!scheduleInfo.validation.canClockIn
                    ? 'Cannot Clock In'
                    : scheduleInfo.validation.isLate
                      ? 'You Will Be Marked Late'
                      : 'Ready to Clock In'}
                </p>
                <p className={`text-sm ${!scheduleInfo.validation.canClockIn
                  ? 'text-red-700'
                  : scheduleInfo.validation.isLate
                    ? 'text-yellow-700'
                    : 'text-green-700'
                  }`}>
                  {scheduleInfo.validation.message}
                </p>
                {scheduleInfo.schedule && scheduleInfo.schedule.shift && (
                  <p className="text-sm text-gray-600 mt-2">
                    Today's shift: <strong>{scheduleInfo.schedule.shift.name}</strong> ({scheduleInfo.schedule.shift.start_time} - {scheduleInfo.schedule.shift.end_time})
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Device Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Device Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">This Device</p>
              <p className="text-sm text-gray-500">{currentDeviceId}</p>
            </div>
            {isDeviceRegistered ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Registered
              </Badge>
            ) : (
              <Button onClick={handleRegisterDevice} disabled={isRegistering}>
                {isRegistering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Register Device
              </Button>
            )}
          </div>

          {devices.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Your Registered Devices</p>
              <div className="space-y-2">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{device.device_name}</p>
                      <p className="text-xs text-gray-500">{device.device_id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {device.device_id === currentDeviceId && (
                        <Badge variant="outline">Current</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDevice(device.device_id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clock In/Out Section */}
      {isDeviceRegistered && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Clock In/Out
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>QR Code</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value)}
                  placeholder="Enter or scan QR code from office display"
                />
                <Button variant="outline" onClick={handleOpenScanner}>
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Scan the QR code displayed on the office screen
              </p>
            </div>

            {clockStatus !== 'idle' && (
              <div className={`p-4 rounded-lg flex items-center gap-2 ${clockStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                {clockStatus === 'success' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                {clockMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-16 bg-green-600 hover:bg-green-700 disabled:opacity-50"
                onClick={() => handleClock('in')}
                disabled={isClocking || !qrCode || !!(scheduleInfo && !scheduleInfo.validation.canClockIn)}
              >
                {isClocking ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <LogIn className="h-5 w-5 mr-2" />
                )}
                Clock In
              </Button>
              <Button
                size="lg"
                className="h-16 bg-orange-600 hover:bg-orange-700"
                onClick={() => handleClock('out')}
                disabled={isClocking || !qrCode}
              >
                {isClocking ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5 mr-2" />
                )}
                Clock Out
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Clock In/Out</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Register this device (one-time setup)</li>
            <li>Go to the office QR display screen</li>
            <li>Enter or scan the QR code shown on the display</li>
            <li>Click Clock In or Clock Out</li>
            <li>QR code changes every 30 seconds for security</li>
          </ol>
        </CardContent>
      </Card>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={handleCloseScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* QR Scanner Container */}
            <div
              id="qr-reader"
              className="w-full rounded-lg overflow-hidden bg-black"
              style={{ minHeight: '300px' }}
            />

            {isScanning && (
              <div className="flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Scanning... Point camera at QR code</span>
              </div>
            )}

            {scannerError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <p className="font-medium">Camera Error</p>
                <p>{scannerError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={startScanner}
                >
                  Try Again
                </Button>
              </div>
            )}

            <p className="text-sm text-gray-500 text-center">
              Position the QR code within the frame to scan
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseScanner}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
