import { useState, useEffect } from "react";
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

interface RoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string | null, name: string, description: string) => void;
    role?: { id: string; name: string; description: string } | null;
}

export function RoleModal({
    isOpen,
    onClose,
    onSave,
    role = null,
}: RoleModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const isEditMode = role !== null;

    useEffect(() => {
        if (role) {
            setName(role.name);
            setDescription(role.description);
        } else {
            setName("");
            setDescription("");
        }
    }, [role, isOpen]);

    const handleSave = () => {
        if (name.trim()) {
            onSave(role?.id || null, name, description);
            setName("");
            setDescription("");
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
                            : "Enter the details for the new role."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="role-name">Role Name</Label>
                        <Input
                            id="role-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Manager"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="role-description">Description</Label>
                        <Textarea
                            id="role-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Can manage users and settings"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={!name.trim()}>
                        {isEditMode ? "Save Changes" : "Create Role"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
