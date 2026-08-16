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
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface DeviceData {
  id?: string;
  name: string;
  brand: string;
  model: string;
  protocol: string;
  location: string;
  ipAddress: string;
  port: string;
  serialNumber: string;
  auth_method?: string;
  auth_credentials?: any;
}

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DeviceData) => void;
  device?: DeviceData;
}

export function AddDeviceModal({
  isOpen,
  onClose,
  onSave,
  device,
}: AddDeviceModalProps) {
  const [formData, setFormData] = useState<DeviceData>({
    name: "",
    brand: "ZKTeco",
    model: "",
    protocol: "zkteco",
    location: "",
    ipAddress: "",
    port: "4370",
    serialNumber: "",
  });

  useEffect(() => {
    if (device) {
      setFormData(device);
    } else {
      setFormData({
        name: "",
        brand: "ZKTeco",
        model: "",
        protocol: "zkteco",
        location: "",
        ipAddress: "",
        port: "4370",
        serialNumber: "",
      });
    }
  }, [device, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleChange = (field: keyof DeviceData, value: string) => {
    setFormData((prev) => {
      const updates: any = { [field]: value };

      // Auto-set port based on protocol if not manually set (simple logic)
      if (field === 'protocol') {
        if (value === 'zkteco') updates.port = '4370';
        if (value === 'anviz') updates.port = '5010';
      }
      return { ...prev, ...updates };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{device ? "Edit Device" : "Add New Device"}</DialogTitle>
          <DialogDescription>
            {device
              ? "Update the device information below."
              : "Register a new fingerprint/biometric device."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 grid-cols-2">
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="name">Device Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Main Entrance Device"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="brand">Brand *</Label>
              <Select
                value={formData.brand}
                onValueChange={(val) => handleChange("brand", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZKTeco">ZKTeco</SelectItem>
                  <SelectItem value="Anviz">Anviz</SelectItem>
                  <SelectItem value="Suprema">Suprema</SelectItem>
                  <SelectItem value="eSSL">eSSL</SelectItem>
                  <SelectItem value="Hikvision">Hikvision</SelectItem>
                  <SelectItem value="Generic">Generic / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="model">Model *</Label>
              <Input
                id="model"
                placeholder="e.g., K40, FaceDeep 5"
                value={formData.model}
                onChange={(e) => handleChange("model", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="protocol">Protocol *</Label>
              <Select
                value={formData.protocol}
                onValueChange={(val) => handleChange("protocol", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Protocol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zkteco">ZKTeco (Pull SDK)</SelectItem>
                  <SelectItem value="adms">ADMS / Push Protocol (Recommended)</SelectItem>
                  <SelectItem value="anviz">Anviz Protocol</SelectItem>
                  <SelectItem value="suprema">Suprema BioStar 2</SelectItem>
                  <SelectItem value="generic">Generic API</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => handleChange("port", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2 col-span-2">
              <Label htmlFor="location">Location *</Label>
              <Input
                id="location"
                placeholder="e.g., Reception"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ipAddress">IP Address *</Label>
              <Input
                id="ipAddress"
                placeholder="e.g., 192.168.1.101"
                value={formData.ipAddress}
                onChange={(e) => handleChange("ipAddress", e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="serialNumber">Serial Number *</Label>
              <Input
                id="serialNumber"
                placeholder="Unique Device SN"
                value={formData.serialNumber}
                onChange={(e) => handleChange("serialNumber", e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {device ? "Update Device" : "Add Device"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
