import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/design-system/PageHeader";
import { KPITile } from "@/components/design-system/KPITile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Fingerprint,
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  Wifi,
  WifiOff,
  AlertCircle,
  Users,
  Trash2,
  Edit,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Server,
  Radio,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  AddDeviceModal,
  type DeviceData,
} from "@/components/devices/AddDeviceModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL, SOCKET_URL } from "@/config/api.config";

interface Device {
  id: string;
  name: string;
  model: string;
  brand: string;
  protocol: string;
  location: string;
  status: "Online" | "Offline" | "Error" | "Syncing" | "offline" | "online" | "pending_authorization";
  ip_address: string;
  registered_ip?: string;
  last_seen_ip?: string;
  is_authorized: boolean;
  authorized_at?: string;
  pending_since?: string;
  last_sync_at: string;
  last_heartbeat_at?: string;
  current_users: number;
  max_users: number;
  serial_number: string;
  port: number;
}

interface ServerInfo {
  server_url: string;
  base_domain: string;
  tenant_slug: string;
  port: number;
  ssl_port: number;
  protocol: string;
  note: string;
}

const getStatusIcon = (status: string, isAuthorized: boolean) => {
  if (!isAuthorized) {
    return <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />;
  }
  const normalized = status?.toLowerCase() || 'offline';
  switch (normalized) {
    case "online":
      return <Wifi className="h-4 w-4 text-green-600" />;
    case "offline":
      return <WifiOff className="h-4 w-4 text-gray-400" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    case "syncing":
      return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
    default:
      return <WifiOff className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusColor = (status: string, isAuthorized: boolean) => {
  if (!isAuthorized) {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
  }
  const normalized = status?.toLowerCase() || 'offline';
  switch (normalized) {
    case "online":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    case "offline":
      return "bg-surface-2 text-muted-foreground border border-border";
    case "error":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    case "syncing":
      return "bg-primary/10 text-primary border border-primary/20";
    default:
      return "bg-surface-2 text-muted-foreground border border-border";
  }
};

export default function Devices() {
  const { user, hasPermission } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPort, setCopiedPort] = useState(false);
  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);
  const [authorizingId, setAuthorizingId] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceData | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);

  const canAuthorize = hasPermission("authorize_devices") || hasPermission("manage_devices");
  const canSync = hasPermission("sync_devices") || hasPermission("manage_devices");
  const canManage = hasPermission("manage_devices");

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/biometric-devices`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      } else {
        toast.error("Failed to load devices");
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServerInfo = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/biometric-devices/server-info`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setServerInfo(data);
      }
    } catch (e) {
      console.error("Failed to fetch biometric server info:", e);
    }
  };

  // Real-time WebSocket connection to /devices gateway
  useEffect(() => {
    if (!user) return;

    fetchDevices();
    fetchServerInfo();

    const socket = io(`${SOCKET_URL}/devices`, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Devices Gateway] Live WebSocket connected");
    });

    socket.on("device_registered", (newDevice: Device) => {
      toast.info(
        `New terminal discovered: ${newDevice.name} (${newDevice.serial_number}). Pending Authorization.`,
        { duration: 6000 }
      );
      setDevices((prev) => {
        const exists = prev.some((d) => d.id === newDevice.id || d.serial_number === newDevice.serial_number);
        if (exists) {
          return prev.map((d) => (d.id === newDevice.id ? newDevice : d));
        }
        return [newDevice, ...prev];
      });
    });

    socket.on("device_status_changed", (updatedDevice: Device) => {
      setDevices((prev) =>
        prev.map((d) => (d.id === updatedDevice.id ? { ...d, ...updatedDevice } : d))
      );
    });

    socket.on("device_authorized", (authorizedDevice: Device) => {
      toast.success(`Terminal ${authorizedDevice.name} is now Authorized and active!`);
      setDevices((prev) =>
        prev.map((d) => (d.id === authorizedDevice.id ? { ...d, ...authorizedDevice, is_authorized: true } : d))
      );
    });

    socket.on("device_revoked", (revokedDevice: Device) => {
      toast.warning(`Terminal ${revokedDevice.name} authorization has been revoked.`);
      setDevices((prev) =>
        prev.map((d) => (d.id === revokedDevice.id ? { ...d, ...revokedDevice, is_authorized: false } : d))
      );
    });

    socket.on("device_deleted", ({ deviceId }: { deviceId: string }) => {
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    });

    socket.on("device_sync", (data: { device_name: string; synced_users: number }) => {
      toast.success(`Queued ${data.synced_users} employee(s) for hardware sync to ${data.device_name}`);
    });

    socket.on("biometric_enrolled", (data: { fullName: string; templateType: string; deviceSn: string }) => {
      toast.success(
        `Biometric Enrolled: ${data.fullName} registered ${data.templateType} on terminal ${data.deviceSn}!`,
        { duration: 5000 }
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const handleCopyServerUrl = () => {
    if (!serverInfo) return;
    navigator.clipboard.writeText(serverInfo.server_url);
    setCopiedUrl(true);
    toast.success("Server address copied to clipboard!");
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyPort = () => {
    const port = serverInfo?.port ? String(serverInfo.port) : "80";
    navigator.clipboard.writeText(port);
    setCopiedPort(true);
    toast.success("Server port 80 copied to clipboard!");
    setTimeout(() => setCopiedPort(false), 2500);
  };

  const handleAuthorize = async (deviceId: string) => {
    setAuthorizingId(deviceId);
    try {
      const res = await fetch(`${API_BASE_URL}/biometric-devices/${deviceId}/authorize`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || "Device authorized successfully");
        fetchDevices();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to authorize device");
      }
    } catch (e) {
      toast.error("Failed to connect to server");
    } finally {
      setAuthorizingId(null);
    }
  };

  const handleRevoke = async (deviceId: string) => {
    if (!confirm("Revoking this device will immediately stop accepting its attendance punches. Continue?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/biometric-devices/${deviceId}/revoke`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        toast.warning("Device authorization revoked");
        fetchDevices();
      } else {
        toast.error("Failed to revoke authorization");
      }
    } catch (e) {
      toast.error("Failed to connect to server");
    }
  };

  const handleSyncUsers = async (deviceId: string, deviceName: string) => {
    setSyncingDeviceId(deviceId);
    try {
      const res = await fetch(`${API_BASE_URL}/biometric-devices/${deviceId}/sync-users`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || `Employees queued for synchronization to ${deviceName}`);
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to sync users");
      }
    } catch (e) {
      toast.error("Failed to trigger sync");
    } finally {
      setSyncingDeviceId(null);
    }
  };

  const handleAddDevice = async (data: DeviceData) => {
    try {
      const url = editingDevice
        ? `${API_BASE_URL}/biometric-devices/${editingDevice.id}`
        : `${API_BASE_URL}/biometric-devices`;

      const method = editingDevice ? "PATCH" : "POST";

      const payload = {
        name: data.name,
        brand: data.brand,
        model: data.model,
        protocol: data.protocol,
        location: data.location,
        ip_address: data.ipAddress,
        port: parseInt(data.port),
        serial_number: data.serialNumber,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(`Device ${editingDevice ? "updated" : "added"} successfully`);
        fetchDevices();
        setIsAddModalOpen(false);
        setEditingDevice(undefined);
      } else {
        const error = await response.json();
        toast.error(error.message || "Failed to save device");
      }
    } catch (error) {
      console.error("Error saving device:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Are you sure you want to remove this device?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/biometric-devices/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Device removed successfully");
        fetchDevices();
      } else {
        toast.error("Failed to delete device");
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const handleEditClick = (device: Device) => {
    setEditingDevice({
      id: device.id,
      name: device.name,
      brand: device.brand,
      model: device.model,
      protocol: device.protocol,
      location: device.location,
      ipAddress: device.ip_address,
      port: device.port?.toString() || "4370",
      serialNumber: device.serial_number,
    });
    setIsAddModalOpen(true);
  };

  const pendingDevices = devices.filter((d) => d.is_authorized === false);
  const authorizedDevices = devices.filter((d) => d.is_authorized !== false);

  const filteredDevices = authorizedDevices.filter(
    (device) =>
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.ip_address?.includes(searchQuery)
  );

  const stats = {
    total: devices.length,
    online: authorizedDevices.filter((d) => d.status?.toLowerCase() === "online").length,
    pending: pendingDevices.length,
    offline: authorizedDevices.filter((d) => d.status?.toLowerCase() !== "online").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Executive Page Header */}
      <PageHeader
        title="Biometric Hardware & Terminals"
        description="Monitor physical access devices, authorize newly discovered ADMS terminals, and sync employee fingerprints and facial recognition templates in real-time."
        breadcrumbs={[
          { label: "Organization", href: "/dashboard" },
          { label: "Biometric Devices" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDevices}
              className="gap-2 h-9 text-xs"
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {canManage && (
              <Button
                onClick={() => {
                  setEditingDevice(undefined);
                  setIsAddModalOpen(true);
                }}
                className="gap-2 h-9 px-3.5 text-xs font-bold gold-gradient gold-glow border-none text-slate-950 transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                Add Device
              </Button>
            )}
          </div>
        }
      />

      {/* ADMS Server Setup Banner */}
      <Card className="border-blue-200 dark:border-blue-900 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-background dark:from-blue-950/30 dark:via-indigo-950/20 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Server className="h-4 w-4" />
                </div>
                <h4 className="font-semibold text-foreground text-sm sm:text-base">
                  Biometric Terminal Cloud Server Connection
                </h4>
                <Badge variant="outline" className="text-[10px] font-mono border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/40">
                  Zero-Config Auto-Registration
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                  HTTP Port 80
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Configure physical biometric terminals (ZKTeco, SpeedFace, Hikvision) with this dedicated tenant address. Terminals self-register on first handshake and will appear below for authorization.
              </p>
            </div>

            {/* Address & Port Badges / Copy Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Server Address */}
              <div className="flex items-center gap-1.5 bg-surface-1 border border-border px-2.5 py-1.5 rounded-lg shadow-sm">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Server:</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground select-all">
                  {serverInfo?.server_url || "Resolving tenant subdomain..."}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyServerUrl}
                  disabled={!serverInfo}
                  title="Copy Server Address"
                >
                  {copiedUrl ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>

              {/* Server Port */}
              <div className="flex items-center gap-1.5 bg-surface-1 border border-border px-2.5 py-1.5 rounded-lg shadow-sm">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Port:</span>
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground">
                  {serverInfo?.port || 80}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyPort}
                  disabled={!serverInfo}
                  title="Copy Port"
                >
                  {copiedPort ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Hardware Terminal Setup Steps */}
          <div className="pt-2 border-t border-border/50 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2 bg-background/60 p-2.5 rounded-md border border-border/40">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[11px]">1</span>
              <div>
                <strong className="text-foreground">Open Device Settings:</strong> Go to <span className="font-mono">Menu ➔ Comm. ➔ Cloud Server / ADMS</span> on the device LCD.
              </div>
            </div>
            <div className="flex items-start gap-2 bg-background/60 p-2.5 rounded-md border border-border/40">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[11px]">2</span>
              <div>
                <strong className="text-foreground">Enable Domain & Port:</strong> Turn <span className="font-semibold text-foreground">Enable Domain Name = ON</span> and set <span className="font-semibold text-foreground">Server Port = 80</span>.
              </div>
            </div>
            <div className="flex items-start gap-2 bg-background/60 p-2.5 rounded-md border border-border/40">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[11px]">3</span>
              <div>
                <strong className="text-foreground">Auto-Discover:</strong> Save and reboot. The terminal will connect and show in <em>Pending Authorization</em> below.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Authorization Warning / Action Card */}
      {pendingDevices.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 shadow-sm animate-pulse-border">
          <CardHeader className="pb-3 border-b border-amber-200/60 dark:border-amber-800/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-amber-950 dark:text-amber-200">
                    Terminals Pending Authorization ({pendingDevices.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-800 dark:text-amber-400">
                    Newly discovered biometric hardware terminals must be authorized by an administrator before punches and templates are ingested.
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-200/60 dark:divide-amber-800/60">
              {pendingDevices.map((dev) => (
                <div key={dev.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-amber-100/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{dev.name}</span>
                      <Badge variant="outline" className="font-mono text-xs border-amber-400 text-amber-700 bg-amber-100/50">
                        SN: {dev.serial_number}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                        {dev.brand} {dev.model}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-3">
                      <span>IP: <strong className="font-mono">{dev.last_seen_ip || dev.ip_address || "Unknown"}</strong></span>
                      <span>•</span>
                      <span>Connected: {dev.pending_since ? new Date(dev.pending_since).toLocaleTimeString() : "Just now"}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canAuthorize ? (
                      <>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          onClick={() => handleAuthorize(dev.id)}
                          disabled={authorizingId === dev.id}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {authorizingId === dev.id ? "Authorizing..." : "Authorize Terminal"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
                          onClick={() => handleDeleteDevice(dev.id)}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Requires 'authorize_devices' permission
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Total Terminals"
          value={stats.total}
          subtitle="Configured hardware devices"
          icon={Fingerprint}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KPITile
          title="Online Devices"
          value={stats.online}
          subtitle="Actively communicating"
          icon={Wifi}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/10"
        />
        <KPITile
          title="Pending Approval"
          value={stats.pending}
          subtitle="Awaiting authorization"
          icon={ShieldAlert}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/10"
        />
        <KPITile
          title="Offline Devices"
          value={stats.offline}
          subtitle="Connection unreachable"
          icon={WifiOff}
          iconColor="text-muted-foreground"
          iconBg="bg-surface-2"
        />
      </div>

      <div className="space-y-4">
        {/* Search Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search devices by name, serial number, location, or IP address..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-mono text-muted-foreground">
                  <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
                  Live Sync On
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Registered Devices Table */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">
              Active Authorized Devices ({filteredDevices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Brand & Model</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Authorization</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Seen IP</TableHead>
                    <TableHead>Last Sync / Heartbeat</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Loading devices...
                      </TableCell>
                    </TableRow>
                  ) : filteredDevices.map((device) => (
                    <TableRow key={device.id} className="hover:bg-surface-1 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Fingerprint className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {device.name}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground">
                              SN: {device.serial_number}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{device.brand}</span>
                          <span className="text-xs text-muted-foreground">{device.model}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs border-border">
                          {device.protocol}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Authorized
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${getStatusColor(
                            device.status,
                            device.is_authorized
                          )} flex items-center gap-1 w-fit`}
                        >
                          {getStatusIcon(device.status, device.is_authorized)}
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {device.last_seen_ip || device.ip_address || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canSync && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleSyncUsers(device.id, device.name)}
                              disabled={syncingDeviceId === device.id}
                              title="Sync Employees to Device"
                            >
                              <Users className={`h-3.5 w-3.5 ${syncingDeviceId === device.id ? "animate-spin" : ""}`} />
                              Sync Users
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canAuthorize && (
                                <DropdownMenuItem
                                  className="text-amber-600"
                                  onClick={() => handleRevoke(device.id)}
                                >
                                  <ShieldAlert className="h-4 w-4 mr-2" />
                                  Revoke Authorization
                                </DropdownMenuItem>
                              )}
                              {canManage && (
                                <DropdownMenuItem onClick={() => handleEditClick(device)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Terminal
                                </DropdownMenuItem>
                              )}
                              {canManage && (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDeleteDevice(device.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove Terminal
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!isLoading && filteredDevices.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                No active biometric devices found. Connect a ZKTeco terminal to your subdomain or click "Add Device".
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddDevice}
        device={editingDevice}
      />
    </div>
  );
}
