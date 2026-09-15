import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  MapPin,
  Users,
  Trash2,
  Edit,
} from "lucide-react";
import { useState, useEffect } from "react";
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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface Device {
  id: string;
  name: string;
  model: string;
  brand: string;
  protocol: string;
  location: string;
  status: "Online" | "Offline" | "Error" | "Syncing" | "offline" | "online";
  ip_address: string;
  last_sync_at: string;
  current_users: number;
  max_users: number;
  serial_number: string;
  port: number;
}

const getStatusIcon = (status: string) => {
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

const getStatusColor = (status: string) => {
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
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceData | undefined>(
    undefined
  );

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
        console.error("Failed to fetch devices");
        toast.error("Failed to load devices");
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast.error("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchDevices();
  }, [user]);

  const handleAddDevice = async (data: DeviceData) => {
    try {
      const url = editingDevice
        ? `${API_BASE_URL}/biometric-devices/${editingDevice.id}`
        : `${API_BASE_URL}/biometric-devices`;

      const method = editingDevice ? "PATCH" : "POST";

      // Map frontend data to backend schema
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
        headers: {
          "Content-Type": "application/json",
        },
        credentials: 'include',
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
    if (!confirm("Are you sure you want to delete this device?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/biometric-devices/${id}`, {
        method: "DELETE",
        credentials: 'include',
      });

      if (response.ok) {
        toast.success("Device deleted successfully");
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

  const handleOpenAddModal = () => {
    setEditingDevice(undefined);
    setIsAddModalOpen(true);
  };

  const filteredDevices = devices.filter(
    (device) =>
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.ip_address?.includes(searchQuery)
  );

  const stats = {
    total: devices.length,
    online: devices.filter((d) => d.status?.toLowerCase() === "online").length,
    offline: devices.filter((d) => d.status?.toLowerCase() === "offline").length,
    error: devices.filter((d) => d.status?.toLowerCase() === "error").length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Executive Page Header */}
      <PageHeader
        title="Biometric Hardware & Terminals"
        description="Monitor physical access devices, sync live fingerprint and facial recognition templates, and configure attendance gateways."
        breadcrumbs={[
          { label: "Organization", href: "/dashboard" },
          { label: "Biometric Devices" },
        ]}
        actions={
          <Button
            onClick={handleOpenAddModal}
            className="gap-2 h-9 px-3.5 text-xs font-bold gold-gradient gold-glow border-none text-slate-950 transition-transform hover:scale-105"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            Add Device
          </Button>
        }
      />

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
          title="Offline Devices"
          value={stats.offline}
          subtitle="Connection unreachable"
          icon={WifiOff}
          iconColor="text-muted-foreground"
          iconBg="bg-surface-2"
        />
        <KPITile
          title="Sync Errors"
          value={stats.error}
          subtitle="Requires attention"
          icon={AlertCircle}
          iconColor="text-rose-500"
          iconBg="bg-rose-500/10"
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
                  placeholder="Search devices by name, location, or IP address..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" className="gap-2" onClick={fetchDevices} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Sync Status
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Devices Table */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg">
              Registered Devices ({filteredDevices.length})
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
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
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
                            <p className="text-xs text-muted-foreground">
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
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 text-muted-foreground/70" />
                          {device.location}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${getStatusColor(
                            device.status
                          )} flex items-center gap-1 w-fit`}
                        >
                          {getStatusIcon(device.status)}
                          {device.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {device.ip_address}:{device.port}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {device.last_sync_at ? new Date(device.last_sync_at).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4 text-muted-foreground/70" />
                          {device.current_users || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClick(device)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteDevice(device.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!isLoading && filteredDevices.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No biometric devices found. Click "Add Device" to register one.
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
