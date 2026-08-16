import { useEffect, useState } from "react";
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

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | null, name: string, description: string) => void;
  role?: { id: string; name: string; description: string } | null;
}

export function CreateEditRoleModal({
  isOpen,
  onClose,
  onSave,
  role = null,
}: CreateRoleModalProps) {
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const isEditMode = role !== null;

  useEffect(() => {
    if (role) {
      setRoleName(role.name);
      setRoleDescription(role.description);
    } else {
      setRoleName("");
      setRoleDescription("");
    }
  }, [role, isOpen]);
  const handleSave = () => {
    if (roleName.trim() !== "") {
      onSave(role?.id || null, roleName, roleDescription);
      setRoleName("");
      setRoleDescription("");
      onClose();
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Role" : "Create New Role"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update the name and description for this role."
              : "Define the name and description for the new role."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="roleName">Role Name</Label>
            <Input
              id="roleName"
              type="text"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="Enter role name"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="roleDescription">Role Description</Label>
            <Textarea
              id="roleDescription"
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Enter role description"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="bg-blue-800 text-white">
            {isEditMode ? "Save Changes" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
