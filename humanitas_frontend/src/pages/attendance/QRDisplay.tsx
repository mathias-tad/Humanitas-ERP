import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, RefreshCw } from "lucide-react";

interface QRCodeData {
  id: string;
  code: string;
  type: string;
  expires_at: string;
}

export default function QRDisplay() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getHeaders = () => ({
    "Content-Type": "application/json",
  });

  const fetchQRCode = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/attendance/qr-code?type=clock_in`, {
        headers: getHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setQrData(data);

        // Calculate time left
        const expiresAt = new Date(data.expires_at).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setTimeLeft(diff);
      }
    } catch (error) {
      console.error("Error fetching QR code:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      fetchQRCode();

      // Refresh QR code every 25 seconds (before 30s expiry)
      intervalRef.current = setInterval(() => {
        fetchQRCode();
      }, 25000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [isAuthenticated, authLoading]);

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Attendance Check-In</h1>
        <p className="text-xl text-blue-200">Scan this QR code with your registered device</p>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-2xl">
        {qrData ? (
          <QRCodeSVG
            value={qrData.code}
            size={350}
            level="H"
            includeMargin={true}
          />
        ) : (
          <div className="w-[350px] h-[350px] flex items-center justify-center bg-gray-100 rounded-lg">
            <p className="text-gray-500">Loading QR Code...</p>
          </div>
        )}
      </div>

      <div className="mt-8 text-center">
        <div className="flex items-center justify-center gap-2 text-white mb-4">
          <RefreshCw className={`h-5 w-5 ${timeLeft <= 5 ? 'animate-spin text-yellow-400' : ''}`} />
          <span className={`text-2xl font-mono ${timeLeft <= 5 ? 'text-yellow-400' : ''}`}>
            Refreshing in {timeLeft}s
          </span>
        </div>
        <p className="text-blue-200 text-sm">
          QR code automatically refreshes every 30 seconds for security
        </p>
      </div>

      <div className="mt-12 text-center">
        <p className="text-white text-lg mb-2">Current Time</p>
        <p className="text-5xl font-bold text-white font-mono">
          {new Date().toLocaleTimeString()}
        </p>
        <p className="text-blue-200 mt-2">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
